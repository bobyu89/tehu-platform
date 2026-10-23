import { getDb, uid } from "@/lib/db";
import type {
  AlertRow, CareEvent, CaseInfo, MedLog, Observation, ObsType, Wound, WoundAssessment,
} from "@/lib/types";
import {
  URINE_RULE, evaluateObs, evaluateUrine, computeBaseline, baselineFlag, type BaselineFlag,
} from "@/lib/alert-engine";
import { computeNews2, news2Alert, type News2Result } from "@/lib/news2";
import { enqueue } from "@/modules/sync";

/**
 * care 模組：床邊照護紀錄（量測、輸出入量、照護事件、給藥、傷口）。
 * 量測寫入時一併跑 A/B/C 三層判定並寫入警報；判定本身是 lib 的純函式。
 * 紀錄寫入本機時同一交易排入同步佇列（sync）；警報不排入，由伺服器重新判定。
 */

export interface VitalsEntry { type: ObsType; value: Observation["value"] }

export interface VitalsResult {
  obsRows: Observation[];
  alertRows: AlertRow[];
  hints: BaselineFlag[];
  news2: News2Result;
}

/** 一次送出的生命徵象：逐筆 A 層＋C 層判定，再合併近 12 小時做 B 層 NEWS2，同一交易寫入 */
export async function recordVitals(info: CaseInfo, entries: VitalsEntry[]): Promise<VitalsResult> {
  const db = getDb();
  const caseId = info.id;
  const now = new Date().toISOString();
  const obsRows: Observation[] = [];
  const alertRows: AlertRow[] = [];
  const hints: BaselineFlag[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  for (const e of entries) {
    const row: Observation = {
      id: uid(), caseId, type: e.type, category: "vital", value: e.value,
      measuredAt: now, recordedAt: now, source: "manual",
    };
    obsRows.push(row);

    const r = evaluateObs(e.type, e.value, info.overrides);
    if (r.level) {
      alertRows.push({
        id: uid(), caseId, obsId: row.id, layer: r.layer, level: r.level,
        summary: r.summary, status: "triggered", triggeredAt: now,
      });
    }

    if (typeof e.value.main === "number" && e.type !== "pain") {
      const history = await db.observations
        .where("[caseId+type]").equals([caseId, e.type])
        .filter((o) => o.measuredAt >= sevenDaysAgo && typeof o.value.main === "number")
        .toArray();
      const base = computeBaseline(e.type, history.map((o) => o.value.main as number));
      const flag = baselineFlag(e.type, e.value.main, base);
      if (flag) {
        hints.push(flag);
        if (flag.level === "yellow") {
          alertRows.push({
            id: uid(), caseId, obsId: row.id, layer: "C", level: "yellow",
            summary: flag.text, status: "triggered", triggeredAt: now,
          });
        }
      }
    }
  }

  // B 層：NEWS2（規格 02 冊 §2.2）。近 12 小時參數＋本次輸入合併計分。
  const twelveHoursAgo = new Date(Date.now() - 12 * 3600_000).toISOString();
  const recent = await db.observations.where("caseId").equals(caseId)
    .filter((o) => o.measuredAt >= twelveHoursAgo).toArray();
  const news2 = computeNews2(info, [...recent, ...obsRows]);
  const b = news2Alert(news2, info.news2AlertsOff);
  if (b) alertRows.push({ id: uid(), caseId, layer: "B", level: b.level, summary: b.summary, status: "triggered", triggeredAt: now });

  await db.transaction("rw", [db.observations, db.alerts, db.outbox], async () => {
    await db.observations.bulkPut(obsRows);
    if (alertRows.length > 0) await db.alerts.bulkPut(alertRows);
    for (const o of obsRows) await enqueue({ entity: "observation", data: o });
  });

  return { obsRows, alertRows, hints, news2 };
}

/** 輸出入量（02 冊 §1.2）；質性紅旗由呼叫端依性狀另行觸發。記尿量後立即重判尿量規則 */
export async function recordIo(
  caseId: string, type: ObsType, category: "io_in" | "io_out", value: Observation["value"],
): Promise<void> {
  const now = new Date().toISOString();
  const db = getDb();
  const o: Observation = {
    id: uid(), caseId, type, category, value, measuredAt: now, recordedAt: now, source: "manual",
  };
  await db.transaction("rw", [db.observations, db.outbox], async () => {
    await db.observations.put(o);
    await enqueue({ entity: "observation", data: o });
  });
  if (type === "output_urine") await checkUrineOutput(caseId);
}

/**
 * 尿量規則（A 層，時間窗）：判定並寫入警報；回傳新寫入的警報或 null。
 * 去重：同一個案在時間窗內已有同級或更高級的尿量警報（不論是否已結案）就不再發，避免每次掃描重複推播。
 */
export async function checkUrineOutput(caseId: string, nowMs = Date.now()): Promise<AlertRow | null> {
  const db = getDb();
  // 取 24 小時再往前一個紅色時間窗，讓「監測是否已滿時間窗」判得出來
  const lookback = new Date(nowMs - (URINE_RULE.activeWithinH + URINE_RULE.redAnuriaH) * 3600_000).toISOString();
  const urine = await db.observations.where("[caseId+type]").equals([caseId, "output_urine"])
    .filter((o) => o.measuredAt >= lookback).toArray();

  const r = evaluateUrine(urine, nowMs);
  if (!r) return null;

  const windowH = r.level === "red" ? URINE_RULE.redAnuriaH : URINE_RULE.yellowWindowH;
  const recentFrom = new Date(nowMs - windowH * 3600_000).toISOString();
  const dup = await db.alerts.where("caseId").equals(caseId)
    .filter((a) => a.rule === "urine_shift" && a.triggeredAt >= recentFrom && (a.level === "red" || a.level === r.level))
    .count();
  if (dup > 0) return null;

  const row: AlertRow = {
    id: uid(), caseId, layer: "A", level: r.level, summary: r.summary, rule: "urine_shift",
    status: "triggered", triggeredAt: new Date(nowMs).toISOString(),
  };
  await db.alerts.put(row);
  return row;
}

/** 掃描所有服務中個案的尿量規則（離線原型替代 pg_cron 每分鐘掃描，05 冊 §2） */
export async function scanUrineOutput(nowMs = Date.now()): Promise<AlertRow[]> {
  const cases = await getDb().cases.filter((c) => (c.status ?? "active") === "active").toArray();
  const out: AlertRow[] = [];
  for (const c of cases) {
    const a = await checkUrineOutput(c.id, nowMs);
    if (a) out.push(a);
  }
  return out;
}

/** 照護事件：翻身、抽痰、管路勾檢與事件、緊急徵象 */
export async function logEvent(
  caseId: string, type: CareEvent["type"], label: string, detail?: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  const e: CareEvent = { id: uid(), caseId, type, label, detail, occurredAt: new Date().toISOString() };
  await db.transaction("rw", [db.events, db.outbox], async () => {
    await db.events.put(e);
    await enqueue({ entity: "care_event", data: e });
  });
}

/** 給藥紀錄（簡化 MAR）：ID 由 藥單|日期|時段 決定，同一格重複記錄即覆寫，天然冪等；佇列中未送出的也合併 */
export async function logMed(
  caseId: string, medId: string, date: string, slot: number, status: MedLog["status"], reason?: string,
): Promise<void> {
  const db = getDb();
  const m: MedLog = {
    id: `${medId}|${date}|${slot}`, caseId, medId, date, slot, status, reason,
    at: new Date().toISOString(),
  };
  await db.transaction("rw", [db.medLogs, db.outbox], async () => {
    await db.medLogs.put(m);
    await enqueue({ entity: "med_administration", data: m });
  });
}

/** 新增傷口部位；回傳新傷口供呼叫端接著做第一次評估 */
export async function addWound(caseId: string, site: { code: string; label: string }): Promise<Wound> {
  const w: Wound = {
    id: uid(), caseId, site: site.code, siteLabel: site.label,
    identifiedOn: new Date().toISOString(),
  };
  const db = getDb();
  await db.transaction("rw", [db.wounds, db.outbox], async () => {
    await db.wounds.put(w);
    await enqueue({ entity: "wound", data: w });
  });
  return w;
}

/** 傷口評估：每次新增一筆（append-only），保留完整軌跡 */
export async function assessWound(input: Omit<WoundAssessment, "id" | "at">): Promise<void> {
  const db = getDb();
  const a: WoundAssessment = { ...input, id: uid(), at: new Date().toISOString() };
  await db.transaction("rw", [db.woundAssessments, db.outbox], async () => {
    await db.woundAssessments.put(a);
    await enqueue({ entity: "wound_assessment", data: a });
  });
}
