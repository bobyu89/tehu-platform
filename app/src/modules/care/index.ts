import { getDb, uid } from "@/lib/db";
import type {
  AlertRow, CareEvent, CaseInfo, MedLog, Observation, ObsType, Wound, WoundAssessment,
} from "@/lib/types";
import { evaluateObs, computeBaseline, baselineFlag, type BaselineFlag } from "@/lib/alert-engine";
import { computeNews2, news2Alert, type News2Result } from "@/lib/news2";

/**
 * care 模組：床邊照護紀錄（量測、輸出入量、照護事件、給藥、傷口）。
 * 量測寫入時一併跑 A/B/C 三層判定並寫入警報；判定本身是 lib 的純函式。
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

  await db.transaction("rw", [db.observations, db.alerts], async () => {
    await db.observations.bulkPut(obsRows);
    if (alertRows.length > 0) await db.alerts.bulkPut(alertRows);
  });

  return { obsRows, alertRows, hints, news2 };
}

/** 輸出入量（02 冊 §1.2）；質性紅旗由呼叫端依性狀另行觸發 */
export async function recordIo(
  caseId: string, type: ObsType, category: "io_in" | "io_out", value: Observation["value"],
): Promise<void> {
  const now = new Date().toISOString();
  await getDb().observations.put({
    id: uid(), caseId, type, category, value, measuredAt: now, recordedAt: now, source: "manual",
  });
}

/** 照護事件：翻身、抽痰、管路勾檢與事件、緊急徵象 */
export async function logEvent(
  caseId: string, type: CareEvent["type"], label: string, detail?: Record<string, unknown>,
): Promise<void> {
  await getDb().events.put({ id: uid(), caseId, type, label, detail, occurredAt: new Date().toISOString() });
}

/** 給藥紀錄（簡化 MAR）：ID 由 藥單|日期|時段 決定，同一格重複記錄即覆寫，天然冪等 */
export async function logMed(
  caseId: string, medId: string, date: string, slot: number, status: MedLog["status"], reason?: string,
): Promise<void> {
  await getDb().medLogs.put({
    id: `${medId}|${date}|${slot}`, caseId, medId, date, slot, status, reason,
    at: new Date().toISOString(),
  });
}

/** 新增傷口部位；回傳新傷口供呼叫端接著做第一次評估 */
export async function addWound(caseId: string, site: { code: string; label: string }): Promise<Wound> {
  const w: Wound = {
    id: uid(), caseId, site: site.code, siteLabel: site.label,
    identifiedOn: new Date().toISOString(),
  };
  await getDb().wounds.put(w);
  return w;
}

/** 傷口評估：每次新增一筆（append-only），保留完整軌跡 */
export async function assessWound(input: Omit<WoundAssessment, "id" | "at">): Promise<void> {
  await getDb().woundAssessments.put({ ...input, id: uid(), at: new Date().toISOString() });
}
