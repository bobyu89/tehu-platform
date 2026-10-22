import type { CaseInfo, Observation, ObsType } from "./types";

// B 層：早期預警評分（規格 02 冊 §2.2，簡化 NEWS2）。
// 定位為「趨勢與跨個案排序指標」，非主要警報源；
// 慢性穩定個案可停用警報、保留計分（news2AlertsOff）。
// 正式版於伺服器端計分；此處為離線示範層。

export interface News2Result {
  total: number;
  complete: boolean;          // 七項參數是否齊全（12 小時內）
  missing: string[];          // 缺少的參數名
  singleThree: boolean;       // 任一單項 3 分
  parts: { label: string; score: number }[];
  band: "low" | "low-medium" | "medium" | "high";
  bandLabel: string;
}

const WINDOW_MS = 12 * 3600_000;

const BAND_LABEL: Record<News2Result["band"], string> = {
  low: "低", "low-medium": "低–中", medium: "中", high: "高",
}; // 參數取 12 小時內最近一筆

function latestWithin(obs: Observation[], type: ObsType, now: number): Observation | undefined {
  let best: Observation | undefined;
  for (const o of obs) {
    if (o.type !== type || typeof o.value.main !== "number" && type !== "consciousness") continue;
    if (now - new Date(o.measuredAt).getTime() > WINDOW_MS) continue;
    if (!best || o.measuredAt > best.measuredAt) best = o;
  }
  return best;
}

const scoreRR = (v: number) => (v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3);
const scoreSpo2Scale1 = (v: number) => (v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0);
// Scale 2（RCP NEWS2）：88–92 為目標區 0 分；≥93 室內空氣 0 分，
// 用氧時 93–94／95–96／≥97 依過度氧療程度給 1／2／3 分
const scoreSpo2Scale2 = (v: number, onO2: boolean) =>
  v <= 83 ? 3 : v <= 85 ? 2 : v <= 87 ? 1 : v <= 92 || !onO2 ? 0 : v <= 94 ? 1 : v <= 96 ? 2 : 3;
const scoreTemp = (v: number) => (v <= 35 ? 3 : v <= 36 ? 1 : v <= 38 ? 0 : v <= 39 ? 1 : 2);
const scoreSBP = (v: number) => (v <= 90 ? 3 : v <= 100 ? 2 : v <= 110 ? 1 : v <= 219 ? 0 : 3);
const scoreHR = (v: number) => (v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3);

/** obs 需含該個案近期各類量測（呼叫端負責查詢範圍） */
export function computeNews2(info: CaseInfo, obs: Observation[], nowMs?: number): News2Result {
  const now = nowMs ?? Date.now();
  const parts: { label: string; score: number }[] = [];
  const missing: string[] = [];
  let singleThree = false;

  const add = (label: string, score: number | null) => {
    if (score == null) { missing.push(label); return; }
    parts.push({ label, score });
    if (score === 3) singleThree = true;
  };

  const rr = latestWithin(obs, "rr", now);
  add("呼吸", rr ? scoreRR(rr.value.main as number) : null);

  const spo2 = latestWithin(obs, "spo2", now);
  const onO2 = Boolean(spo2?.value.onO2);
  add("血氧", spo2
    ? (info.news2Scale2 ? scoreSpo2Scale2(spo2.value.main as number, onO2) : scoreSpo2Scale1(spo2.value.main as number))
    : null);
  add("氧氣", spo2 ? (onO2 ? 2 : 0) : null); // 用氧狀態自動帶入，不重複輸入

  const bt = latestWithin(obs, "bt", now);
  add("體溫", bt ? scoreTemp(bt.value.main as number) : null);

  const bp = latestWithin(obs, "bp", now);
  add("收縮壓", bp ? scoreSBP(bp.value.main as number) : null);

  const hr = latestWithin(obs, "hr", now);
  add("脈搏", hr ? scoreHR(hr.value.main as number) : null);

  const con = latestWithin(obs, "consciousness", now);
  const conScore = con ? ((con.value.avpu ?? "A") !== "A" || con.value.newConfusion ? 3 : 0) : null;
  add("意識", conScore);

  const total = parts.reduce((a, p) => a + p.score, 0);
  // 臨床風險分級（RCP NEWS2）：≥7 高；5–6 中；任一單項 3 分 低–中；0–4 低
  const band: News2Result["band"] = total >= 7 ? "high"
    : total >= 5 ? "medium" : singleThree ? "low-medium" : "low";

  return {
    total, parts, missing,
    complete: missing.length === 0,
    singleThree,
    band,
    bandLabel: BAND_LABEL[band],
  };
}

/**
 * B 層警報分級（規格 02 冊 §2.2）：總分 ≥7 → 紅；5–6 分或任一單項 3 分 → 黃。
 * 參數不全不發；個案停用警報（news2AlertsOff）時只計分不發。
 */
export function news2Alert(r: News2Result, alertsOff = false): { level: "red" | "yellow"; summary: string } | null {
  if (alertsOff || !r.complete) return null;
  if (r.total >= 7) return { level: "red", summary: `NEWS2 總分 ${r.total} 分（≥7，建議緊急評估）` };
  if (r.total >= 5 || r.singleThree) {
    return { level: "yellow", summary: `NEWS2 總分 ${r.total} 分${r.singleThree ? "（含單項 3 分）" : ""}，建議提高觀察頻率` };
  }
  return null;
}
