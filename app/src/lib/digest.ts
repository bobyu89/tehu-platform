import type { AlertRow, Observation, ObsType } from "./types";
import { OBS_LABEL, OBS_UNIT } from "./types";
import { round1 } from "./alert-engine";

// 交班 A 段自動彙整（03 冊）：本班數據系統彙整，護理師只補判斷。

export interface ShiftDigest {
  vitalRanges: { type: ObsType; min: number; max: number; latest: number; count: number }[];
  ioIn: number;
  ioOut: number;
  alerts: AlertRow[];
  obsCount: number;
}

const VITAL_TYPES: ObsType[] = ["bt", "hr", "rr", "bp", "spo2", "glucose"];

export function buildDigest(observations: Observation[], alerts: AlertRow[]): ShiftDigest {
  const vitalRanges = VITAL_TYPES.flatMap((type) => {
    const vals = observations
      .filter((o) => o.type === type && typeof o.value.main === "number")
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
    if (vals.length === 0) return [];
    const nums = vals.map((o) => o.value.main as number);
    return [{
      type,
      min: Math.min(...nums),
      max: Math.max(...nums),
      latest: nums[nums.length - 1],
      count: nums.length,
    }];
  });

  const sum = (cat: Observation["category"]) =>
    observations
      .filter((o) => o.category === cat && typeof o.value.main === "number")
      .reduce((a, o) => a + (o.value.main as number), 0);

  return { vitalRanges, ioIn: sum("io_in"), ioOut: sum("io_out"), alerts, obsCount: observations.length };
}

/**
 * 本地規則式交班摘要草稿（示意）。
 * 正式版：Edge Function 呼叫 Claude API（去識別化＋數字接地檢查＋人工確認，03 冊）。
 * 此處刻意用確定性模板，所有數字直接來自 digest——示範「摘要中的數值必存在於紀錄」原則。
 */
export function draftSummary(caseName: string, d: ShiftDigest, sIssues: string[], aNote: string): string {
  const lines: string[] = [];
  const issues = sIssues.length > 0 ? sIssues.join("、") : "無特殊";
  lines.push(`本班主要情況：${issues}。共完成 ${d.obsCount} 筆紀錄。`);
  for (const v of d.vitalRanges) {
    const unit = OBS_UNIT[v.type] ?? "";
    lines.push(`${OBS_LABEL[v.type]} ${round1(v.min)}–${round1(v.max)}${unit}（最近 ${round1(v.latest)}${unit}，${v.count} 次）`);
  }
  if (d.ioIn > 0 || d.ioOut > 0) lines.push(`I/O：攝入 ${d.ioIn} ml／排出 ${d.ioOut} ml。`);
  if (d.alerts.length > 0) {
    const parts = d.alerts.map((a) => `${a.level === "red" ? "紅" : "黃"}：${a.summary}（${a.status === "closed" ? "已結案" : a.handledNote ?? "處理中"}）`);
    lines.push(`本班警報 ${d.alerts.length} 件——${parts.join("；")}`);
  } else {
    lines.push("本班無警報。");
  }
  if (aNote.trim()) lines.push(`護理師評估：${aNote.trim()}`);
  return lines.join("\n");
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(iso)}`;
}
