import { describe, expect, it } from "vitest";
import {
  QUALITATIVE_RED_FLAGS, baselineFlag, computeBaseline, evaluateObs, evaluateUrine,
} from "./alert-engine";
import type { ObsType } from "./types";

// 期望值取自規格 02 冊 §2.1（A 層預設值表）與 §2.3（C 層演算法），不是從程式常數抄來。

const level = (type: ObsType, main: number, overrides?: Parameters<typeof evaluateObs>[2]) =>
  evaluateObs(type, { main }, overrides).level;

describe("A 層：絕對臨界值（02 冊 §2.1 預設值）", () => {
  // [參數, 紅低, 黃低, 正常值, 黃高, 紅高]；邊界值本身即觸發（≤ / ≥）
  const table: [ObsType, number, number, number, number | null, number | null][] = [
    ["bp", 90, 100, 120, 180, 200],
    ["hr", 40, 50, 72, 110, 130],
    ["rr", 8, 11, 16, 21, 25],
    ["spo2", 91, 94, 97, null, null],
    ["bt", 35, 35.5, 36.8, 38, 39.5],
    ["glucose", 54, 70, 110, 250, 400],
  ];

  it.each(table)("%s：邊界值分級正確", (type, redLow, yellowLow, normal, yellowHigh, redHigh) => {
    expect(level(type, normal)).toBeNull();
    expect(level(type, yellowLow)).toBe("yellow");
    expect(level(type, redLow)).toBe("red");
    expect(level(type, redLow - 1)).toBe("red");
    if (yellowHigh != null && redHigh != null) {
      expect(level(type, yellowHigh)).toBe("yellow");
      expect(level(type, redHigh)).toBe("red");
      expect(level(type, redHigh + 1)).toBe("red");
    }
  });

  it("邊界內側一點不觸發", () => {
    expect(level("bp", 101)).toBeNull();
    expect(level("bp", 179)).toBeNull();
    expect(level("hr", 51)).toBeNull();
    expect(level("bt", 37.9)).toBeNull();
    expect(level("spo2", 95)).toBeNull();
  });

  it("SpO2 只判低值：再高都不觸發", () => {
    expect(level("spo2", 100)).toBeNull();
  });

  it("未定義規則的參數、空值不觸發", () => {
    expect(level("pain", 10)).toBeNull();
    expect(evaluateObs("hr", { main: null }).level).toBeNull();
  });

  it("個案覆寫逐欄合併（COPD 樣板：黃 ≤87、紅 ≤85）", () => {
    const copd = { spo2: { yellowLow: 87, redLow: 85 } };
    expect(level("spo2", 90, copd)).toBeNull();
    expect(level("spo2", 87, copd)).toBe("yellow");
    expect(level("spo2", 85, copd)).toBe("red");
    // 只覆寫 SpO2，其他參數仍用預設
    expect(level("hr", 130, copd)).toBe("red");
  });

  it("意識：AVPU 任何下降或新發混亂 → 紅色（質性層）", () => {
    for (const avpu of ["V", "P", "U"]) {
      const r = evaluateObs("consciousness", { main: null, avpu });
      expect(r).toMatchObject({ level: "red", layer: "qualitative" });
    }
    expect(evaluateObs("consciousness", { main: null, avpu: "A", newConfusion: true }).level).toBe("red");
    expect(evaluateObs("consciousness", { main: null, avpu: "A" }).level).toBeNull();
  });

  it("質性紅旗清單與規格一致", () => {
    expect([...QUALITATIVE_RED_FLAGS].sort()).toEqual(
      ["咖啡渣樣嘔吐物", "新發胸痛", "大量鮮血便", "管路自拔", "跌倒撞頭", "新發單側無力或口齒不清"].sort());
  });
});

describe("C 層：個人基準線（02 冊 §2.3）", () => {
  const ten = (v: number) => Array.from({ length: 10 }, () => v);

  it("不足 10 筆不啟用，滿 10 筆啟用", () => {
    expect(computeBaseline("hr", Array(9).fill(80)).enabled).toBe(false);
    expect(computeBaseline("hr", ten(80)).enabled).toBe(true);
    expect(computeBaseline("hr", []).enabled).toBe(false);
    expect(baselineFlag("hr", 200, computeBaseline("hr", Array(9).fill(80)))).toBeNull();
  });

  // [參數, σ 下限, σ 上限]
  const clamps: [ObsType, number, number][] = [
    ["bp", 6, 20], ["hr", 5, 15], ["rr", 2, 4], ["spo2", 1.5, 3], ["bt", 0.3, 0.8], ["glucose", 15, 60],
  ];

  it.each(clamps)("%s：σ 套用上下限", (type, lo, hi) => {
    expect(computeBaseline(type, ten(50)).sd).toBe(lo); // 完全不變 → 拉到下限
    const wild = Array.from({ length: 10 }, (_, i) => (i % 2 ? 0 : 1000));
    expect(computeBaseline(type, wild).sd).toBe(hi);   // 極度雜亂 → 壓到上限
  });

  it("|z| < 2 不提示；2 ≤ |z| < 3 只是 App 內提示", () => {
    const base = computeBaseline("hr", ten(80)); // σ = 下限 5
    expect(baselineFlag("hr", 89, base)).toBeNull();           // z = 1.8
    expect(baselineFlag("hr", 90, base)?.level).toBe("hint");  // z = 2
    expect(baselineFlag("hr", 94, base)?.level).toBe("hint");  // z = 2.8
  });

  it("|z| ≥ 3 且臨床惡化方向 → 黃色", () => {
    const hr = computeBaseline("hr", ten(80));
    expect(baselineFlag("hr", 95, hr)).toMatchObject({ level: "yellow", direction: "high" });
    expect(baselineFlag("hr", 65, hr)).toMatchObject({ level: "yellow", direction: "low" });
    const spo2 = computeBaseline("spo2", ten(97)); // σ = 1.5
    expect(baselineFlag("spo2", 92, spo2)?.level).toBe("yellow");
  });

  it("|z| ≥ 3 但非惡化方向 → 只提示", () => {
    const spo2 = computeBaseline("spo2", ten(92));
    expect(baselineFlag("spo2", 97, spo2)).toMatchObject({ level: "hint", direction: "high" });
    const rr = computeBaseline("rr", ten(18));
    expect(baselineFlag("rr", 10, rr)).toMatchObject({ level: "hint", direction: "low" });
    const bt = computeBaseline("bt", ten(37));
    expect(baselineFlag("bt", 35.5, bt)?.level).toBe("hint");
  });

  it("不變量 1（ADR-003）：C 層永不產生紅色", () => {
    const types: ObsType[] = ["bp", "hr", "rr", "spo2", "bt", "glucose"];
    for (const t of types) {
      const base = computeBaseline(t, ten(50));
      for (let x = -500; x <= 1000; x += 7) {
        const f = baselineFlag(t, x, base);
        expect(f?.level ?? null).not.toBe("red");
      }
    }
  });
});

describe("A 層：尿量（02 冊 §2.1：8 小時 < 240 ml 黃、12 小時無尿紅）", () => {
  const NOW = Date.parse("2026-10-21T12:00:00Z");
  /** [幾小時前, ml]；ml 為 null 表示有解尿但未量 */
  const u = (...rows: [number, number | null][]) =>
    rows.map(([h, ml]) => ({ measuredAt: new Date(NOW - h * 3600_000).toISOString(), value: { main: ml } }));
  const lvl = (rows: ReturnType<typeof u>) => evaluateUrine(rows, NOW)?.level ?? null;

  it("q6h 正常尿量 → 不觸發", () => {
    expect(lvl(u([20, 300], [14, 300], [8, 300], [2, 300]))).toBeNull();
  });

  it("近 8 小時合計 < 240 → 黃；= 240 不觸發", () => {
    expect(lvl(u([14, 300], [7, 100], [2, 100]))).toBe("yellow");   // 200
    expect(lvl(u([14, 300], [7, 120], [2, 120]))).toBeNull();       // 240
    expect(evaluateUrine(u([14, 300], [7, 100], [2, 100]), NOW)?.summary).toContain("200 ml");
  });

  it("近 8 小時沒有紀錄（但 12 小時內有尿）→ 黃，並註明期間無紀錄", () => {
    const r = evaluateUrine(u([20, 300], [10, 300]), NOW);
    expect(r?.level).toBe("yellow");
    expect(r?.summary).toContain("無紀錄");
  });

  it("12 小時內沒有任何解尿 → 紅", () => {
    expect(lvl(u([20, 300], [13, 300]))).toBe("red");
  });

  it("無尿時間窗邊界：最後解尿 12.5 小時前 → 紅；11.5 小時前 → 不紅", () => {
    expect(lvl(u([20, 300], [12.5, 300]))).toBe("red");
    expect(lvl(u([20, 300], [11.5, 300]))).toBe("yellow"); // 8 小時窗內無紀錄，只到黃
  });

  it("12 小時內只有 0 ml 紀錄仍算無尿 → 紅", () => {
    expect(lvl(u([20, 300], [13, 300], [6, 0], [1, 0]))).toBe("red");
  });

  it("有解尿但未量：證明有尿 → 不紅；量不可知 → 不黃", () => {
    expect(lvl(u([20, 300], [13, 300], [3, null]))).toBeNull();
  });

  it("沒有在記錄尿量的個案（24 小時內無紀錄）→ 不判定", () => {
    expect(lvl([])).toBeNull();
    expect(lvl(u([30, 300], [26, 300]))).toBeNull();
  });

  it("監測未滿時間窗不判：剛開始記錄的個案不因資料少而觸發", () => {
    expect(lvl(u([3, 50]))).toBeNull();          // 開始記錄才 3 小時
    expect(lvl(u([10, 50], [3, 50]))).toBe("yellow"); // 已滿 8 小時、未滿 12 小時：只判黃
  });

  it("未來時間的紀錄不計入", () => {
    expect(lvl(u([20, 300], [13, 300], [-1, 500]))).toBe("red");
  });
});
