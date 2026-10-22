import type { CareEvent, MedLog, Observation, Wound, WoundAssessment } from "@/lib/types";

/**
 * 同步用欄位轉換：本機（Dexie、camelCase、示範 ID）→ SQL（snake_case、UUID）。純函式。
 * 對照 supabase/migrations/0001_init.sql；以 contract.test.ts 實際插入 Postgres 驗證欄位。
 *
 * 原則（05 冊 §5）：
 * - 不帶 recorded_at：由伺服器 default now() 給，補登判定（recorded_at − measured_at > 30 分）在伺服器端做。
 * - 警報不同步：本機警報只是即時提示，伺服器收到紀錄後重新判定（02 冊）。
 * - ID 在本機就決定，重送時伺服器以 on conflict (id) do nothing 略過，不會重複寫入。
 */

// 本專案固定命名空間；示範資料的字串 ID（如 case-wang）以 UUID v5 轉成穩定的 UUID
export const ID_NAMESPACE = "92df089f-7b73-4a45-bc10-af9441f904e9";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID v5（RFC 9562 §5.5：SHA-1 名稱式） */
export async function uuidv5(name: string, namespace = ID_NAMESPACE): Promise<string> {
  const ns = namespace.replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16));
  const bytes = new Uint8Array([...ns, ...new TextEncoder().encode(name)]);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes)).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 已是 UUID 就原樣用，否則轉成 UUID v5 */
export async function toUuid(id: string): Promise<string> {
  return UUID_RE.test(id) ? id.toLowerCase() : uuidv5(id);
}

/** 同步時的身分脈絡：登入後由 session 提供（org 與本人的 profiles.id） */
export interface SyncContext { orgId: string; profileId: string }

/** 上班／下班打卡（attendance 表；伺服器以 server_time 為準，device_time 留存比對；打卡者即登入者本人） */
export interface ClockRecord {
  shiftId: string;
  kind: "in" | "out";
  at: string;
  geo?: { lat: number; lng: number; acc: number } | null;
}

export type SyncEntity =
  | { entity: "observation"; data: Observation }
  | { entity: "care_event"; data: CareEvent }
  | { entity: "med_administration"; data: MedLog }
  | { entity: "wound"; data: Wound }
  | { entity: "wound_assessment"; data: WoundAssessment }
  | { entity: "attendance"; data: ClockRecord };

export interface SqlRow { table: string; row: Record<string, unknown> }

/** 本機待傳佇列的一筆（Dexie outbox 表）；seq 自動遞增，決定送出順序（先傳傷口、再傳其評估） */
export interface OutboxItem {
  seq?: number;
  entity: SyncEntity["entity"];
  key: string;                 // localKey：同鍵未送出前合併
  data: SyncEntity["data"];
  createdAt: string;
  attempts: number;
  nextAttemptAt?: string;      // 退避：此時間前不重送
  status: "pending" | "failed"; // failed：伺服器拒收，需人工處理，不再自動重送
  lastError?: string;
}

const dateOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 給藥時段（本機日期＋整點）→ ISO */
const slotIso = (date: string, slot: number): string =>
  new Date(`${date}T${String(slot).padStart(2, "0")}:00:00`).toISOString();

/** 同一筆紀錄在佇列裡的鍵（同鍵未送出前會合併成最新內容） */
export function localKey(e: SyncEntity): string {
  return e.entity === "attendance" ? `${e.data.shiftId}|${e.data.kind}` : e.data.id;
}

export async function toSqlRow(e: SyncEntity, ctx: SyncContext): Promise<SqlRow> {
  const org_id = ctx.orgId;
  switch (e.entity) {
    case "observation": {
      const o = e.data;
      return {
        table: "observations",
        row: {
          id: await toUuid(o.id), org_id, case_id: await toUuid(o.caseId),
          shift_id: o.shiftId ? await toUuid(o.shiftId) : null, nurse_id: ctx.profileId,
          type: o.type, category: o.category, value: o.value,
          measured_at: o.measuredAt, source: o.source,
        },
      };
    }
    case "care_event": {
      const c = e.data;
      return {
        table: "care_events",
        row: {
          id: await toUuid(c.id), org_id, case_id: await toUuid(c.caseId), nurse_id: ctx.profileId,
          type: c.type, detail: { ...(c.detail ?? {}), label: c.label }, occurred_at: c.occurredAt,
        },
      };
    }
    case "med_administration": {
      const m = e.data;
      return {
        table: "med_administrations",
        row: {
          id: await toUuid(m.id), org_id, case_id: await toUuid(m.caseId),
          med_order_id: await toUuid(m.medId), nurse_id: ctx.profileId,
          due_at: slotIso(m.date, m.slot),
          given_at: m.status === "given" ? m.at : null,
          withheld_reason: m.status === "withheld" ? (m.reason ?? "其他") : null,
        },
      };
    }
    case "wound": {
      const w = e.data;
      return {
        table: "wounds",
        row: {
          id: await toUuid(w.id), org_id, case_id: await toUuid(w.caseId), body_site: w.site,
          identified_on: dateOf(w.identifiedOn), healed_on: w.healedOn ? dateOf(w.healedOn) : null,
        },
      };
    }
    case "wound_assessment": {
      const a = e.data;
      // 照片（本機為縮圖 dataURL）需另走 Storage 上傳後才有路徑；此處不帶照片
      return {
        table: "wound_assessments",
        row: {
          id: await toUuid(a.id), org_id, wound_id: await toUuid(a.woundId), nurse_id: ctx.profileId,
          stage: a.stage, description: a.note ?? null, assessed_at: a.at,
        },
      };
    }
    case "attendance": {
      const r = e.data;
      return {
        table: "attendance",
        row: {
          id: await uuidv5(`attendance|${r.shiftId}|${r.kind}`), org_id,
          shift_id: await toUuid(r.shiftId), nurse_id: ctx.profileId,
          kind: r.kind, device_time: r.at,
          lat: r.geo?.lat ?? null, lng: r.geo?.lng ?? null, accuracy_m: r.geo?.acc ?? null,
        },
      };
    }
  }
}
