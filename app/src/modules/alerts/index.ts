import { getDb, uid } from "@/lib/db";
import type { AlertLayer, AlertRow } from "@/lib/types";

/**
 * alerts 模組：警報生命週期（觸發 → 認領 → 處置 → 結案）與統計。
 * 判定引擎在 lib/alert-engine.ts 與 lib/news2.ts（純函式），本模組負責資料層。
 */

export type { AlertRow };

export const LAYER_LABEL: Record<AlertLayer, string> = {
  A: "絕對臨界值", B: "早期預警", C: "個人基準線", qualitative: "質性紅旗",
};

export const layerLabel = (l: AlertLayer): string => LAYER_LABEL[l];

/** 質性紅旗（02 冊 §2.1）：不經數值判斷，直通紅色警報 */
export async function raiseRedFlag(caseId: string, summary: string): Promise<void> {
  await getDb().alerts.put({
    id: uid(), caseId, layer: "qualitative", level: "red",
    summary, status: "triggered", triggeredAt: new Date().toISOString(),
  });
}

export async function claim(alertId: string): Promise<void> {
  await getDb().alerts.update(alertId, { status: "claimed", claimedAt: new Date().toISOString() });
}

export async function close(alertId: string): Promise<void> {
  await getDb().alerts.update(alertId, { status: "closed" });
}

export async function noteHandled(alertId: string, note: string): Promise<void> {
  await getDb().alerts.update(alertId, { handledNote: note });
}

export const isOpen = (a: AlertRow): boolean => a.status === "triggered" || a.status === "claimed";

/** 觸發到認領的平均分鐘數與樣本數；無可算樣本回 null */
export function responseStats(rows: AlertRow[]): { avg: number; n: number } | null {
  const mins = rows.filter((a) => a.claimedAt)
    .map((a) => (new Date(a.claimedAt!).getTime() - new Date(a.triggeredAt).getTime()) / 60000);
  return mins.length > 0 ? { avg: mins.reduce((x, y) => x + y, 0) / mins.length, n: mins.length } : null;
}

/** 依來源層×級別計數，供警報疲勞校準 */
export function countByLayer(rows: AlertRow[]): Record<string, { yellow: number; red: number }> {
  const out: Record<string, { yellow: number; red: number }> = {};
  for (const a of rows) {
    const k = layerLabel(a.layer);
    out[k] = out[k] ?? { yellow: 0, red: 0 };
    out[k][a.level] += 1;
  }
  return out;
}
