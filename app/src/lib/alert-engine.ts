import type { ObsType, ObsValue, RuleBounds, RuleSet, AlertLevel } from "./types";
import { OBS_LABEL, OBS_UNIT } from "./types";

// ============================================================
// A 層：絕對臨界值（02 冊 §2.1）
// 系統預設對齊 supabase/migrations/0001_init.sql 的種子資料。
// 正式版由伺服器端權威判定；此處為離線示範／前端即時提示層。
// ============================================================

export const DEFAULT_RULES: RuleSet = {
  bp:      { redLow: 90, yellowLow: 100, yellowHigh: 180, redHigh: 200 }, // 以 SBP 判定
  hr:      { redLow: 40, yellowLow: 50,  yellowHigh: 110, redHigh: 130 },
  rr:      { redLow: 8,  yellowLow: 11,  yellowHigh: 21,  redHigh: 25 },
  spo2:    { redLow: 91, yellowLow: 94 },                                  // 單向：僅低值
  bt:      { redLow: 35, yellowLow: 35.5, yellowHigh: 38, redHigh: 39.5 },
  glucose: { redLow: 54, yellowLow: 70,  yellowHigh: 250, redHigh: 400 },
};

export interface EvalResult {
  level: AlertLevel | null;
  layer: "A" | "qualitative";
  summary: string;
}

function boundsFor(type: ObsType, overrides?: RuleSet): RuleBounds | undefined {
  return { ...DEFAULT_RULES[type], ...(overrides?.[type] ?? {}) };
}

/** A 層判定：回傳最高級別（紅 > 黃） */
export function evaluateObs(type: ObsType, value: ObsValue, overrides?: RuleSet): EvalResult {
  const label = OBS_LABEL[type];
  const unit = OBS_UNIT[type] ?? "";

  // 意識：AVPU 任何下降或新發混亂 → 紅（qualitative 性質）
  if (type === "consciousness") {
    const avpu = String(value.avpu ?? "A");
    const confused = Boolean(value.newConfusion);
    if (avpu !== "A" || confused) {
      return {
        level: "red", layer: "qualitative",
        summary: `意識變化：AVPU=${avpu}${confused ? "、新發混亂" : ""}`,
      };
    }
    return { level: null, layer: "A", summary: "" };
  }

  const v = value.main;
  if (v == null || Number.isNaN(v)) return { level: null, layer: "A", summary: "" };
  const b = boundsFor(type, overrides);
  if (!b) return { level: null, layer: "A", summary: "" };

  const show = type === "bp" ? `SBP ${v}` : `${label} ${v}`;
  if (b.redLow != null && v <= b.redLow)
    return { level: "red", layer: "A", summary: `${show}${unit}（≤紅色下限 ${b.redLow}）` };
  if (b.redHigh != null && v >= b.redHigh)
    return { level: "red", layer: "A", summary: `${show}${unit}（≥紅色上限 ${b.redHigh}）` };
  if (b.yellowLow != null && v <= b.yellowLow)
    return { level: "yellow", layer: "A", summary: `${show}${unit}（≤黃色下限 ${b.yellowLow}）` };
  if (b.yellowHigh != null && v >= b.yellowHigh)
    return { level: "yellow", layer: "A", summary: `${show}${unit}（≥黃色上限 ${b.yellowHigh}）` };
  return { level: null, layer: "A", summary: "" };
}

/** 質性紅旗（02 冊：直通紅色，不經數值） */
export const QUALITATIVE_RED_FLAGS = [
  "咖啡渣樣嘔吐物",
  "新發胸痛",
  "大量鮮血便",
  "管路自拔",
  "跌倒撞頭",
  "新發單側無力或口齒不清",
] as const;

// ============================================================
// C 層：個人基準線（規格 02 冊 §2.3），即需求中的「平均線」
// 近 7 天、滿 10 筆啟用；σ 設上下限；|z|≥2 提示；C 層永不發紅（ADR-003）。
// ============================================================

const SIGMA_CLAMP: Partial<Record<ObsType, [number, number]>> = {
  bp:      [6, 20],
  hr:      [5, 15],
  rr:      [2, 4],
  spo2:    [1.5, 3],
  bt:      [0.3, 0.8],
  glucose: [15, 60],
};

export interface Baseline {
  n: number;
  mean: number;
  sd: number;       // 已套 σ 上下限
  enabled: boolean; // 滿 10 筆才啟用
}

export function computeBaseline(type: ObsType, values: number[]): Baseline {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0, enabled: false };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  let sd = Math.sqrt(variance);
  const clamp = SIGMA_CLAMP[type];
  if (clamp) sd = Math.min(Math.max(sd, clamp[0]), clamp[1]);
  return { n, mean, sd, enabled: n >= 10 };
}

export interface BaselineFlag {
  z: number;
  direction: "high" | "low";
  /** level: hint = App 內提示（|z|≥2）；yellow = 黃色警報（|z|≥3 且臨床惡化方向） */
  level: "hint" | "yellow" | null;
  text: string;
}

/** 臨床惡化方向：spo2 向下惡化；其餘偏離即需留意，僅 |z|≥3 且惡化方向升黃 */
const WORSE_DIRECTION: Partial<Record<ObsType, "high" | "low" | "both">> = {
  bp: "both", hr: "both", rr: "high", spo2: "low", bt: "high", glucose: "both",
};

export function baselineFlag(type: ObsType, latest: number, base: Baseline): BaselineFlag | null {
  if (!base.enabled || base.sd === 0) return null;
  const z = (latest - base.mean) / base.sd;
  if (Math.abs(z) < 2) return null;
  const direction: "high" | "low" = z > 0 ? "high" : "low";
  const worse = WORSE_DIRECTION[type] ?? "both";
  const isWorse = worse === "both" || worse === direction;
  const level: "hint" | "yellow" = Math.abs(z) >= 3 && isWorse ? "yellow" : "hint";
  const dirText = direction === "high" ? "高於" : "低於";
  return {
    z, direction, level,
    text: `${OBS_LABEL[type]}${dirText}個案平時水準（7 日平均 ${round1(base.mean)}，z=${z.toFixed(1)}）`,
  };
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
