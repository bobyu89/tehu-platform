import { getDb, uid } from "./db";
import type { AlertRow, CaseInfo, Med, Nurse, Observation, ObsType, Shift } from "./types";

/** 目前登入的示範護理師 */
export const SELF_ID = "nurse-chen";

// 示範資料：兩個個案＋近 7 天量測史（供趨勢圖與 C 層基準線展示）。
// 設計要點：
// 1. 個案定義每次啟動 upsert（程式碼改了欄位，舊資料庫也會跟上）
// 2. 每天首次開啟自動「補天」：把缺的日子補生成，示範資料永不過期
// 3. 班次與補天都以決定性 ID／交易防競態（多頁同時掛載不重複）

function lcg(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
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
  status: "active",
  vitalsIntervalH: 4, // VS Q4H
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
  news2Scale2: true,     // 高碳酸血症風險：SpO2 改用 Scale 2 計分
  news2AlertsOff: true,  // 慢性穩定：B 層警報停用，計分保留供管理端排序
  status: "active",
  vitalsIntervalH: 4,
};

const NURSES: Nurse[] = [
  { id: SELF_ID, name: "陳曉柔", tags: ["管灌", "血糖監測", "氧療照護", "抽痰"] },
  { id: "nurse-lin", name: "林士弘", tags: ["氧療照護", "抽痰", "傷口照護"] },
  { id: "nurse-chang", name: "張惠雯", tags: ["管灌", "失智照護"] },
];

const MEDS: Med[] = [
  { id: "med-w1", caseId: "case-wang", name: "Metformin 500mg", route: "口服", slots: [8, 20], note: "隨餐" },
  { id: "med-w2", caseId: "case-wang", name: "Amlodipine 5mg", route: "口服", slots: [8] },
  { id: "med-w3", caseId: "case-wang", name: "Donepezil 5mg", route: "口服", slots: [21] },
  { id: "med-l1", caseId: "case-lee", name: "Tiotropium 吸入劑", route: "吸入", slots: [8] },
  { id: "med-l2", caseId: "case-lee", name: "Apixaban 2.5mg", route: "口服", slots: [8, 20] },
];

function dstr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoAt(daysAgo: number, hh: number, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function obs(
  caseId: string, type: ObsType, category: Observation["category"],
  value: Observation["value"], measuredAt: string,
): Observation {
  return { id: uid(), caseId, type, category, value, measuredAt, recordedAt: measuredAt, source: "manual" };
}

/** 歷史警報樣本池（供主控台趨勢圖與佇列歷史展示；全部已結案） */
const ALERT_POOL: { caseId: string; level: "yellow" | "red"; summary: string }[] = [
  { caseId: "case-wang", level: "yellow", summary: "SBP 182mmHg（≥黃色上限 180）" },
  { caseId: "case-wang", level: "yellow", summary: "血糖 262mg/dL（≥黃色上限 250）" },
  { caseId: "case-lee", level: "yellow", summary: "SpO2 87%（≤個案覆寫黃色下限 87）" },
  { caseId: "case-lee", level: "yellow", summary: "呼吸 22次/分（≥黃色上限 21）" },
  { caseId: "case-wang", level: "yellow", summary: "體溫 38.2°C（≥黃色上限 38）" },
  { caseId: "case-lee", level: "red", summary: "SpO2 85%（≤個案覆寫紅色下限 85）" },
];

/** 生成該日的歷史警報（已結案），供主控台趨勢圖與佇列歷史 */
function genDayAlerts(daysAgo: number): AlertRow[] {
  const day = new Date();
  day.setDate(day.getDate() - daysAgo);
  const rnd = lcg(7 + day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate());
  const out: AlertRow[] = [];
  const n = Math.floor(rnd() * 3); // 每日 0-2 件黃色
  for (let i = 0; i < n; i++) {
    const pick = ALERT_POOL[Math.floor(rnd() * 5)]; // 前 5 筆為黃色
    out.push({
      id: uid(), caseId: pick.caseId, layer: "A", level: pick.level, summary: pick.summary,
      status: "closed", triggeredAt: isoAt(daysAgo, 9 + Math.floor(rnd() * 10)),
      handledNote: rnd() > 0.5 ? "已觀察複測" : "已聯絡家屬",
    });
  }
  if (rnd() > 0.82) { // 偶發紅色
    const red = ALERT_POOL[5];
    out.push({
      id: uid(), caseId: red.caseId, layer: "A", level: red.level, summary: red.summary,
      status: "closed", triggeredAt: isoAt(daysAgo, 3 + Math.floor(rnd() * 4)),
      handledNote: "已聯絡醫師",
    });
  }
  return out;
}

/** 生成「距今 daysAgo 天」那一天的示範量測；以該日曆日為亂數種子，重跑結果一致 */
function genDay(daysAgo: number): Observation[] {
  const day = new Date();
  day.setDate(day.getDate() - daysAgo);
  const rnd = lcg(day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate());
  const out: Observation[] = [];
  const HOURS = [8, 12, 16, 20];

  for (const hh of HOURS) {
    const t = isoAt(daysAgo, hh);
    // 王奶奶：血壓偏高但穩定、血糖需盯
    out.push(obs("case-wang", "bt", "vital", { main: +(36.4 + rnd() * 0.6).toFixed(1), site: "耳" }, t));
    out.push(obs("case-wang", "hr", "vital", { main: Math.round(72 + rnd() * 14), rhythm: "規則" }, t));
    out.push(obs("case-wang", "rr", "vital", { main: Math.round(15 + rnd() * 4) }, t));
    out.push(obs("case-wang", "bp", "vital", { main: Math.round(138 + rnd() * 22), dbp: Math.round(72 + rnd() * 12), posture: "臥" }, t));
    out.push(obs("case-wang", "spo2", "vital", { main: Math.round(96 + rnd() * 3), onO2: false }, t));
    // 李爺爺 COPD：SpO2 平時 89-93，近兩天緩慢下滑（展示 C 層「偏離平時水準」）
    const drift = daysAgo <= 2 ? (2 - daysAgo) * 0.8 + 0.6 : 0;
    out.push(obs("case-lee", "bt", "vital", { main: +(36.3 + rnd() * 0.5).toFixed(1), site: "耳" }, t));
    out.push(obs("case-lee", "hr", "vital", { main: Math.round(84 + rnd() * 16), rhythm: "不規則" }, t));
    out.push(obs("case-lee", "rr", "vital", { main: Math.round(18 + rnd() * 4 + (daysAgo <= 2 ? 2 : 0)) }, t));
    out.push(obs("case-lee", "bp", "vital", { main: Math.round(124 + rnd() * 18), dbp: Math.round(68 + rnd() * 10), posture: "坐" }, t));
    out.push(obs("case-lee", "spo2", "vital", { main: Math.round(91.5 + rnd() * 2 - drift), onO2: true }, t));
  }
  // 王奶奶血糖 TID AC
  for (const [hh, timing] of [[7, "AC"], [11, "AC"], [17, "AC"]] as const) {
    out.push(obs("case-wang", "glucose", "vital", { main: Math.round(128 + rnd() * 70), timing }, isoAt(daysAgo, hh, 30)));
  }
  // I/O 摘要級（每日兩筆示意）
  out.push(obs("case-wang", "intake_tube", "io_in", { main: 250, formula: "安素", residual: Math.round(rnd() * 20) }, isoAt(daysAgo, 9)));
  out.push(obs("case-wang", "output_urine", "io_out", { main: Math.round(280 + rnd() * 160), color: "淡黃" }, isoAt(daysAgo, 14)));
  out.push(obs("case-lee", "output_suction", "io_out", { main: null, amount: "中", color: rnd() > 0.5 ? "黃" : "白", viscosity: "黏" }, isoAt(daysAgo, 10)));
  return out;
}

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const today = dstr(new Date());

  // 定義類資料永遠 upsert：程式碼演進（如新增欄位）舊資料庫立即跟上
  await db.cases.bulkPut([CASE_WANG, CASE_LEE]);
  await db.nurses.bulkPut(NURSES);
  await db.meds.bulkPut(MEDS);

  // 量測史：首次全量（近 7 天），之後每天補缺的日子。
  // 交易內重讀 seed_day 防多頁同時掛載的競態。
  await db.transaction("rw", [db.observations, db.alerts, db.meta], async () => {
    const mark = await db.meta.get("seed_day");
    const fill = async (fromDaysAgo: number) => {
      const rows: Observation[] = [];
      const alerts: AlertRow[] = [];
      for (let d = fromDaysAgo; d >= 1; d--) { rows.push(...genDay(d)); alerts.push(...genDayAlerts(d)); }
      if (rows.length > 0) await db.observations.bulkPut(rows);
      if (alerts.length > 0) await db.alerts.bulkPut(alerts);
    };
    if (!mark) {
      await fill(7);
      await db.meta.put({ id: "seed_day", value: today });
      return;
    }
    if (mark.value !== today) {
      const last = new Date(mark.value + "T00:00:00");
      const gap = Math.min(7, Math.max(0, Math.round((Date.now() - last.getTime()) / 86400_000)));
      await fill(gap);
      await db.meta.put({ id: "seed_day", value: today });
    }
  });

  // 今日班次：決定性 ID upsert（天然冪等，無競態），並清掉舊版隨機 ID 造成的重複
  const shifts: Shift[] = [
    { id: `shift-case-wang-${today}`, caseId: "case-wang", date: today, startHH: 8, endHH: 20, status: "accepted", nurseId: SELF_ID },
    { id: `shift-case-lee-${today}`, caseId: "case-lee", date: today, startHH: 20, endHH: 8, status: "accepted", nurseId: SELF_ID },
  ];
  const existing = await db.shifts.where("date").equals(today).toArray();
  const keep = new Set(shifts.map((s) => s.id));
  const dupes = existing.filter((s) => !keep.has(s.id));
  const started = new Set(existing.filter((s) => keep.has(s.id)).map((s) => s.id));
  await db.transaction("rw", [db.shifts], async () => {
    // 已存在（可能已打卡）者不覆蓋
    await db.shifts.bulkPut(shifts.filter((s) => !started.has(s.id)));
    if (dupes.length > 0) await db.shifts.bulkDelete(dupes.map((s) => s.id));
  });
}

/** demo 重置：清空本地資料重新種子 */
export async function resetDemo(): Promise<void> {
  const db = getDb();
  await db.delete();
  if (typeof window !== "undefined") window.location.reload();
}
