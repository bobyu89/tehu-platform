import { getDb, uid } from "./db";
import type { CaseInfo, Observation, ObsType, Shift } from "./types";

// 示範資料：兩個個案＋近 7 天量測史（供趨勢圖與 C 層基準線展示）。
// 以固定種子的偽隨機數生成，每次重建結果一致。

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

const CASE_WANG: CaseInfo = {
  id: "case-wang",
  name: "王林秀英",
  age: 82,
  sex: "女",
  setting: "居家",
  dx: "第 2 型糖尿病、高血壓、失智症（中度）",
  allergies: "Penicillin",
  careNeeds: ["管灌", "血糖監測"],
  tubes: ["鼻胃管（7/28 置入，8/25 到期）"],
};

const CASE_LEE: CaseInfo = {
  id: "case-lee",
  name: "李金火",
  age: 78,
  sex: "男",
  setting: "醫院",
  dx: "COPD 急性惡化後、心房顫動",
  allergies: "無已知過敏",
  careNeeds: ["氧療照護", "抽痰"],
  tubes: ["尿管（8/2 置入，8/30 到期）"],
  overrides: { spo2: { yellowLow: 87, redLow: 85 } },
  overrideNote: "COPD 個案：SpO2 目標 88-92%（護理長 8/5 依醫囑調整）",
};

function isoAt(daysAgo: number, hh: number, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function obs(
  caseId: string, type: ObsType, category: Observation["category"],
  value: Observation["value"], measuredAt: string,
): Observation {
  return { id: uid(), caseId, type, category, value, measuredAt, recordedAt: measuredAt, source: "manual" };
}

function genHistory(): Observation[] {
  const rnd = lcg(20260812);
  const out: Observation[] = [];
  const HOURS = [8, 12, 16, 20];

  for (let day = 7; day >= 1; day--) {
    for (const hh of HOURS) {
      const t = isoAt(day, hh);
      // 王奶奶：血壓偏高但穩定、血糖需盯
      out.push(obs("case-wang", "bt", "vital", { main: +(36.4 + rnd() * 0.6).toFixed(1), site: "耳" }, t));
      out.push(obs("case-wang", "hr", "vital", { main: Math.round(72 + rnd() * 14), rhythm: "規則" }, t));
      out.push(obs("case-wang", "rr", "vital", { main: Math.round(15 + rnd() * 4) }, t));
      out.push(obs("case-wang", "bp", "vital", { main: Math.round(138 + rnd() * 22), dbp: Math.round(72 + rnd() * 12), posture: "臥" }, t));
      out.push(obs("case-wang", "spo2", "vital", { main: Math.round(96 + rnd() * 3), onO2: false }, t));
      // 李爺爺 COPD：SpO2 平時 89-93，最後兩天緩慢下滑（展示 C 層「偏離平時水準」）
      const drift = day <= 2 ? (2 - day) * 0.8 + 0.6 : 0;
      out.push(obs("case-lee", "bt", "vital", { main: +(36.3 + rnd() * 0.5).toFixed(1), site: "耳" }, t));
      out.push(obs("case-lee", "hr", "vital", { main: Math.round(84 + rnd() * 16), rhythm: "不規則" }, t));
      out.push(obs("case-lee", "rr", "vital", { main: Math.round(18 + rnd() * 4 + (day <= 2 ? 2 : 0)) }, t));
      out.push(obs("case-lee", "bp", "vital", { main: Math.round(124 + rnd() * 18), dbp: Math.round(68 + rnd() * 10), posture: "坐" }, t));
      out.push(obs("case-lee", "spo2", "vital", { main: Math.round(91.5 + rnd() * 2 - drift), onO2: true }, t));
    }
    // 王奶奶血糖 TID AC
    for (const [hh, timing] of [[7, "AC"], [11, "AC"], [17, "AC"]] as const) {
      const t = isoAt(day, hh, 30);
      out.push(obs("case-wang", "glucose", "vital", { main: Math.round(128 + rnd() * 70), timing }, t));
    }
    // I/O 摘要級（每日兩筆示意）
    out.push(obs("case-wang", "intake_tube", "io_in", { main: 250, formula: "安素", residual: Math.round(rnd() * 20) }, isoAt(day, 9)));
    out.push(obs("case-wang", "output_urine", "io_out", { main: Math.round(280 + rnd() * 160), color: "淡黃" }, isoAt(day, 14)));
    out.push(obs("case-lee", "output_suction", "io_out", { main: null, amount: "中", color: rnd() > 0.5 ? "黃" : "白", viscosity: "黏" }, isoAt(day, 10)));
  }
  return out;
}

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const seeded = await db.meta.get("seeded");
  if (!seeded) {
    await db.transaction("rw", [db.cases, db.observations, db.meta], async () => {
      await db.cases.bulkPut([CASE_WANG, CASE_LEE]);
      await db.observations.bulkPut(genHistory());
      await db.meta.put({ id: "seeded", value: "v1" });
    });
  }
  // 今日班次：每天開啟自動補（demo 用）
  const today = todayStr();
  const existing = await db.shifts.where("date").equals(today).toArray();
  if (existing.length === 0) {
    const s1: Shift = { id: uid(), caseId: "case-wang", date: today, startHH: 8, endHH: 20, status: "accepted" };
    const s2: Shift = { id: uid(), caseId: "case-lee", date: today, startHH: 20, endHH: 8, status: "accepted" };
    await getDb().shifts.bulkPut([s1, s2]);
  }
}

/** demo 重置：清空本地資料重新種子 */
export async function resetDemo(): Promise<void> {
  const db = getDb();
  await db.delete();
  _reload();
}

function _reload() {
  if (typeof window !== "undefined") window.location.reload();
}
