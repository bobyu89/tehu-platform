import { describe, expect, it } from "vitest";
import { computeNews2, news2Alert } from "./news2";
import type { CaseInfo, Observation, ObsType } from "./types";

// 計分切點與臨床風險分級對照 RCP NEWS2（2017）；警報分級對照規格 02 冊 §2.2。

const NOW = Date.parse("2026-10-21T12:00:00+08:00");
const info = (extra: Partial<CaseInfo> = {}) => ({ id: "c1", ...extra }) as CaseInfo;

let seq = 0;
function obs(type: ObsType, value: Observation["value"], hoursAgo = 1): Observation {
  return {
    id: `o${seq++}`, caseId: "c1", type, category: "vital", value,
    measuredAt: new Date(NOW - hoursAgo * 3600_000).toISOString(),
    recordedAt: new Date(NOW).toISOString(), source: "manual",
  };
}

/** 全部 0 分的一組參數，可逐項覆寫 */
function set(p: Partial<{ rr: number; spo2: number; onO2: boolean; bt: number; sbp: number; hr: number; avpu: string; confusion: boolean }> = {}) {
  const v = { rr: 16, spo2: 97, onO2: false, bt: 37, sbp: 120, hr: 70, avpu: "A", confusion: false, ...p };
  return [
    obs("rr", { main: v.rr }), obs("spo2", { main: v.spo2, onO2: v.onO2 }), obs("bt", { main: v.bt }),
    obs("bp", { main: v.sbp }), obs("hr", { main: v.hr }),
    obs("consciousness", { main: null, avpu: v.avpu, newConfusion: v.confusion }),
  ];
}

const score = (label: string, rows: Observation[], c = info()) =>
  computeNews2(c, rows, NOW).parts.find((p) => p.label === label)?.score;

describe("NEWS2 各項計分（RCP 切點）", () => {
  it.each([
    [8, 3], [9, 1], [11, 1], [12, 0], [20, 0], [21, 2], [24, 2], [25, 3],
  ])("呼吸 %i → %i 分", (rr, s) => expect(score("呼吸", set({ rr }))).toBe(s));

  it.each([
    [91, 3], [92, 2], [93, 2], [94, 1], [95, 1], [96, 0],
  ])("SpO2 Scale 1：%i → %i 分", (spo2, s) => expect(score("血氧", set({ spo2 }))).toBe(s));

  it("用氧 2 分，室內空氣 0 分（由 SpO2 紀錄自動帶入）", () => {
    expect(score("氧氣", set({ onO2: true }))).toBe(2);
    expect(score("氧氣", set({ onO2: false }))).toBe(0);
  });

  it.each([
    [35, 3], [35.1, 1], [36, 1], [36.1, 0], [38, 0], [38.1, 1], [39, 1], [39.1, 2],
  ])("體溫 %f → %i 分", (bt, s) => expect(score("體溫", set({ bt }))).toBe(s));

  it.each([
    [90, 3], [91, 2], [100, 2], [101, 1], [110, 1], [111, 0], [219, 0], [220, 3],
  ])("收縮壓 %i → %i 分", (sbp, s) => expect(score("收縮壓", set({ sbp }))).toBe(s));

  it.each([
    [40, 3], [41, 1], [50, 1], [51, 0], [90, 0], [91, 1], [110, 1], [111, 2], [130, 2], [131, 3],
  ])("脈搏 %i → %i 分", (hr, s) => expect(score("脈搏", set({ hr }))).toBe(s));

  it("意識：A 為 0 分；V/P/U 或新發混亂為 3 分", () => {
    expect(score("意識", set())).toBe(0);
    for (const avpu of ["V", "P", "U"]) expect(score("意識", set({ avpu }))).toBe(3);
    expect(score("意識", set({ confusion: true }))).toBe(3);
  });
});

describe("SpO2 Scale 2（高碳酸血症風險個案）", () => {
  const copd = info({ news2Scale2: true });
  it.each([
    [83, 3], [84, 2], [85, 2], [86, 1], [87, 1], [88, 0], [92, 0],
  ])("%i → %i 分", (spo2, s) => expect(score("血氧", set({ spo2 }), copd)).toBe(s));

  it("≥93 且室內空氣為 0 分", () => {
    expect(score("血氧", set({ spo2: 96, onO2: false }), copd)).toBe(0);
  });

  it.each([
    [92, 0], [93, 1], [94, 1], [95, 2], [96, 2], [97, 3], [100, 3],
  ])("用氧：%i → %i 分（過度氧療）", (spo2, s) => expect(score("血氧", set({ spo2, onO2: true }), copd)).toBe(s));

  it("≤92 時用氧與否不影響 SpO2 分數", () => {
    expect(score("血氧", set({ spo2: 85, onO2: true }), copd)).toBe(2);
    expect(score("血氧", set({ spo2: 85, onO2: false }), copd)).toBe(2);
  });
});

describe("NEWS2 參數完整性與時間窗", () => {
  it("七項齊全才算完整", () => {
    const r = computeNews2(info(), set(), NOW);
    expect(r).toMatchObject({ complete: true, total: 0, missing: [] });
  });

  it("缺項列出名稱", () => {
    const rows = set().filter((o) => o.type !== "bt");
    const r = computeNews2(info(), rows, NOW);
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(["體溫"]);
  });

  it("只取 12 小時內，且取最近一筆", () => {
    const rows = [...set(), obs("hr", { main: 140 }, 13)];
    expect(score("脈搏", rows)).toBe(0);           // 13 小時前的 140 不採用
    const stale = set().filter((o) => o.type !== "hr").concat(obs("hr", { main: 70 }, 13));
    expect(computeNews2(info(), stale, NOW).missing).toEqual(["脈搏"]);
    const newer = [...set({ hr: 70 }), obs("hr", { main: 135 }, 0.5)];
    expect(score("脈搏", newer)).toBe(3);          // 30 分鐘前的 135 較新
  });
});

describe("NEWS2 警報分級（02 冊 §2.2）", () => {
  const alert = (rows: Observation[], off = false) => news2Alert(computeNews2(info(), rows, NOW), off)?.level ?? null;

  it("0–4 分且無單項 3 分 → 不發", () => {
    expect(alert(set())).toBeNull();
    expect(alert(set({ hr: 105, rr: 22 }))).toBeNull(); // 1 + 2 = 3
  });

  it("5–6 分 → 黃", () => {
    expect(alert(set({ rr: 22, spo2: 93, hr: 105 }))).toBe("yellow"); // 2 + 2 + 1 = 5
    expect(alert(set({ rr: 22, spo2: 93, hr: 115 }))).toBe("yellow"); // 2 + 2 + 2 = 6
  });

  it("任一單項 3 分（總分 < 5）→ 黃", () => {
    expect(alert(set({ avpu: "V" }))).toBe("yellow");
  });

  it("總分 ≥ 7 → 紅", () => {
    expect(alert(set({ rr: 22, spo2: 93, hr: 115, bt: 38.5 }))).toBe("red"); // 2 + 2 + 2 + 1 = 7
  });

  it("參數不全不發；個案停用只計分不發", () => {
    const partial = set({ avpu: "U", rr: 30 }).filter((o) => o.type !== "bt");
    expect(alert(partial)).toBeNull();
    expect(alert(set({ rr: 30, spo2: 90, hr: 140 }), true)).toBeNull();
    expect(computeNews2(info(), set({ rr: 30, spo2: 90, hr: 140 }), NOW).total).toBe(9);
  });
});

describe("NEWS2 臨床風險分級（band，RCP 四級）", () => {
  const r = (rows: Observation[]) => computeNews2(info(), rows, NOW);

  it("0–4 分且無單項 3 分 → 低", () => {
    expect(r(set()).band).toBe("low");
    expect(r(set({ hr: 105, rr: 22 })).band).toBe("low"); // 3 分
  });

  it("任一單項 3 分且總分 < 5 → 低–中", () => {
    expect(r(set({ avpu: "V" }))).toMatchObject({ total: 3, band: "low-medium", bandLabel: "低–中" });
  });

  it("5–6 分 → 中（含單項 3 分者亦同）", () => {
    expect(r(set({ rr: 22, spo2: 93, hr: 105 })).band).toBe("medium");                 // 2 + 2 + 1
    expect(r(set({ rr: 25, spo2: 94, hr: 95 }))).toMatchObject({ total: 5, singleThree: true, band: "medium" }); // 3 + 1 + 1
    expect(r(set({ avpu: "V", rr: 22, hr: 95 }))).toMatchObject({ total: 6, singleThree: true, band: "medium" }); // 3 + 2 + 1
  });

  it("≥7 → 高", () => {
    expect(r(set({ rr: 22, spo2: 93, hr: 115, bt: 38.5 }))).toMatchObject({ total: 7, band: "high", bandLabel: "高" });
  });

  it("顯示分級與警報分級一致：中與低–中發黃、高發紅", () => {
    for (const [rows, level] of [
      [set({ avpu: "V" }), "yellow"], [set({ rr: 25, spo2: 94, hr: 95 }), "yellow"],
      [set({ rr: 22, spo2: 93, hr: 115, bt: 38.5 }), "red"], [set(), null],
    ] as const) {
      expect(news2Alert(r(rows))?.level ?? null).toBe(level);
    }
  });
});
