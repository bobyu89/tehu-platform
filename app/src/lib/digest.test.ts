import { describe, expect, it } from "vitest";
import { buildDigest, draftSummary } from "./digest";
import type { AlertRow, Observation, ObsType } from "./types";

let seq = 0;
const obs = (type: ObsType, category: Observation["category"], main: number | null, at: string): Observation => ({
  id: `o${seq++}`, caseId: "c1", type, category, value: { main },
  measuredAt: at, recordedAt: at, source: "manual",
});

const rows: Observation[] = [
  obs("hr", "vital", 88, "2026-10-21T08:00:00Z"),
  obs("hr", "vital", 72, "2026-10-21T12:00:00Z"),
  obs("hr", "vital", 96, "2026-10-21T16:00:00Z"),
  obs("bp", "vital", 132, "2026-10-21T08:00:00Z"),
  obs("intake_tube", "io_in", 250, "2026-10-21T09:00:00Z"),
  obs("intake_oral", "io_in", 120, "2026-10-21T13:00:00Z"),
  obs("output_urine", "io_out", 300, "2026-10-21T14:00:00Z"),
  obs("output_stool", "io_out", null, "2026-10-21T15:00:00Z"), // 只記性狀，無量
];

const alert: AlertRow = {
  id: "a1", caseId: "c1", layer: "A", level: "yellow", summary: "脈搏 96",
  status: "closed", triggeredAt: "2026-10-21T16:00:00Z",
};

describe("交班 A 段彙整（03 冊）", () => {
  it("生命徵象取範圍與依時間的最近一筆；I/O 只加總有數值者", () => {
    const d = buildDigest(rows, [alert]);
    expect(d.vitalRanges.find((v) => v.type === "hr")).toEqual({ type: "hr", min: 72, max: 96, latest: 96, count: 3 });
    expect(d.ioIn).toBe(370);
    expect(d.ioOut).toBe(300);
    expect(d.obsCount).toBe(rows.length);
    expect(d.vitalRanges.map((v) => v.type)).toEqual(["hr", "bp"]); // 沒量的參數不出現
  });

  it("摘要裡的每個數字都來自紀錄（防幻覺原則）", () => {
    const d = buildDigest(rows, [alert]);
    const text = draftSummary(d, ["血糖異常"], "");
    const source = new Set(["72", "96", "88", "132", "370", "300", String(rows.length), "3", "1"]);
    for (const n of text.match(/\d+(\.\d+)?/g) ?? []) expect(source).toContain(n);
  });

  it("無警報時明確寫出「本班無警報」", () => {
    expect(draftSummary(buildDigest(rows, []), [], "")).toContain("本班無警報");
  });
});
