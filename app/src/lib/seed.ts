import { getDb } from "./db";
import { EDU_UNITS } from "./edu-seed";
import { CASES, MEDS, NURSES, SELF_ID } from "./cases-seed";
import {
  EDU_PUSHES, SIGNED_DOCS, WOUNDS, WOUND_ASSESSMENTS,
  dayKey, genCareEvents, genHandoffs, genMedLogs, genPastShifts, isoAt, lcg,
} from "./demo-history";
import type { AlertRow, Observation, ObsType, Shift } from "./types";

export { SELF_ID };

// 原型示範資料。設計要點：
// 1. 定義類資料每次啟動 upsert（程式碼改了欄位，舊資料庫也會跟上）
// 2. 每天首次開啟自動「補天」：把缺的日子補生成，示範資料永不過期
// 3. 全部使用決定性 ID＋交易，多頁同時掛載不會重複

/** 每個個案的生理輪廓：讓五位個案在趨勢圖上各有各的樣子 */
interface Profile {
  caseId: string;
  hours: number[];
  bt: [number, number];
  hr: [number, number];
  rr: [number, number];
  sbp: [number, number];
  dbp: [number, number];
  spo2: [number, number];
  onO2: boolean;
  rhythm: string;
  posture: string;
  glucoseHours?: number[];
  glucose?: [number, number];
  tubeFeed?: number;
  urine?: [number, number];
  suction?: boolean;
}

const PROFILES: Profile[] = [
  {
    caseId: "case-wang", hours: [8, 12, 16, 20],
    bt: [36.4, 0.6], hr: [72, 14], rr: [15, 4], sbp: [138, 22], dbp: [72, 12],
    spo2: [96, 3], onO2: false, rhythm: "規則", posture: "臥",
    glucoseHours: [7, 11, 17], glucose: [128, 70],
    tubeFeed: 250, urine: [280, 160],
  },
  {
    caseId: "case-lee", hours: [8, 12, 16, 20],
    bt: [36.3, 0.5], hr: [84, 16], rr: [18, 4], sbp: [124, 18], dbp: [68, 10],
    spo2: [91.5, 2], onO2: true, rhythm: "不規則", posture: "坐",
    urine: [320, 140], suction: true,
  },
  {
    caseId: "case-chen", hours: [8, 14, 20],
    bt: [36.5, 0.5], hr: [78, 12], rr: [16, 3], sbp: [132, 16], dbp: [74, 10],
    spo2: [97, 2], onO2: false, rhythm: "規則", posture: "半坐臥",
    tubeFeed: 300, urine: [300, 150],
  },
  {
    caseId: "case-huang", hours: [8, 12, 16, 20],
    bt: [36.6, 0.6], hr: [88, 14], rr: [17, 3], sbp: [118, 16], dbp: [66, 10],
    spo2: [94, 3], onO2: true, rhythm: "規則", posture: "半坐臥",
    tubeFeed: 280, urine: [340, 130], suction: true,
  },
  {
    caseId: "case-chang", hours: [8, 16],
    bt: [36.2, 0.5], hr: [76, 12], rr: [16, 3], sbp: [112, 18], dbp: [62, 10],
    spo2: [95, 3], onO2: false, rhythm: "規則", posture: "臥",
    urine: [240, 120],
  },
];

function obs(
  caseId: string, type: ObsType, category: Observation["category"],
  value: Observation["value"], measuredAt: string, idKey: string,
): Observation {
  return { id: idKey, caseId, type, category, value, measuredAt, recordedAt: measuredAt, source: "manual" };
}

function daySeed(daysAgo: number, salt: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return salt + d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** 生成該日示範量測；以日曆日為亂數種子，重跑結果一致 */
function genDay(daysAgo: number, maxHour?: number): Observation[] {
  const rnd = lcg(daySeed(daysAgo, 19));
  const date = dayKey(daysAgo);
  const out: Observation[] = [];

  for (const p of PROFILES) {
    // 李爺爺近兩日血氧緩降：展示 C 層「偏離個人平時水準」
    const drift = p.caseId === "case-lee" && daysAgo <= 2 ? (2 - daysAgo) * 0.8 + 0.6 : 0;
    const rrBump = p.caseId === "case-lee" && daysAgo <= 2 ? 2 : 0;

    p.hours.forEach((hh, i) => {
      if (maxHour != null && hh > maxHour) return;
      const t = isoAt(daysAgo, hh);
      const k = `o-${p.caseId}-${date}-${i}`;
      out.push(obs(p.caseId, "bt", "vital", { main: +(p.bt[0] + rnd() * p.bt[1]).toFixed(1), site: "耳" }, t, `${k}-bt`));
      out.push(obs(p.caseId, "hr", "vital", { main: Math.round(p.hr[0] + rnd() * p.hr[1]), rhythm: p.rhythm }, t, `${k}-hr`));
      out.push(obs(p.caseId, "rr", "vital", { main: Math.round(p.rr[0] + rnd() * p.rr[1] + rrBump) }, t, `${k}-rr`));
      out.push(obs(p.caseId, "bp", "vital",
        { main: Math.round(p.sbp[0] + rnd() * p.sbp[1]), dbp: Math.round(p.dbp[0] + rnd() * p.dbp[1]), posture: p.posture },
        t, `${k}-bp`));
      out.push(obs(p.caseId, "spo2", "vital",
        { main: Math.round(p.spo2[0] + rnd() * p.spo2[1] - drift), onO2: p.onO2 }, t, `${k}-spo2`));
      // 意識：AVPU 衡量清醒度而非認知，失智個案仍為 A；NEWS2 需此項才算完整
      out.push(obs(p.caseId, "consciousness", "vital", { main: null, avpu: "A", newConfusion: false }, t, `${k}-con`));
    });

    const glucoseHours = p.glucoseHours;
    const glucose = p.glucose;
    if (glucoseHours && glucose) {
      glucoseHours.forEach((hh, i) => {
        if (maxHour != null && hh > maxHour) return;
        out.push(obs(p.caseId, "glucose", "vital",
          { main: Math.round(glucose[0] + rnd() * glucose[1]), timing: "AC" },
          isoAt(daysAgo, hh, 30), `o-${p.caseId}-${date}-glu-${i}`));
      });
    }

    const feed = p.tubeFeed;
    if (feed) {
      [9, 13, 18].forEach((hh, i) => {
        if (maxHour != null && hh > maxHour) return;
        out.push(obs(p.caseId, "intake_tube", "io_in",
          { main: feed, formula: "均衡配方", residual: Math.round(rnd() * 20) },
          isoAt(daysAgo, hh), `o-${p.caseId}-${date}-tf-${i}`));
      });
    }

    const urine = p.urine;
    if (urine) {
      [10, 16, 22].forEach((hh, i) => {
        if (maxHour != null && hh > maxHour) return;
        out.push(obs(p.caseId, "output_urine", "io_out",
          { main: Math.round(urine[0] + rnd() * urine[1]), color: rnd() > 0.8 ? "深黃" : "淡黃" },
          isoAt(daysAgo, hh), `o-${p.caseId}-${date}-ur-${i}`));
      });
    }

    if (p.suction) {
      [11, 19].forEach((hh, i) => {
        if (maxHour != null && hh > maxHour) return;
        out.push(obs(p.caseId, "output_suction", "io_out",
          { main: null, amount: rnd() > 0.5 ? "中" : "少", color: rnd() > 0.6 ? "黃" : "白", viscosity: "黏" },
          isoAt(daysAgo, hh), `o-${p.caseId}-${date}-sx-${i}`));
      });
    }
  }
  return out;
}

/** 歷史警報樣本池（已結案，供趨勢圖與警報中心歷史） */
const ALERT_POOL: { caseId: string; level: "yellow" | "red"; layer: AlertRow["layer"]; summary: string }[] = [
  { caseId: "case-wang", level: "yellow", layer: "A", summary: "SBP 182mmHg（≥黃色上限 180）" },
  { caseId: "case-wang", level: "yellow", layer: "A", summary: "血糖 262mg/dL（≥黃色上限 250）" },
  { caseId: "case-lee", level: "yellow", layer: "A", summary: "SpO2 87%（≤個案覆寫黃色下限 87）" },
  { caseId: "case-lee", level: "yellow", layer: "C", summary: "呼吸高於個案平時水準（7 日平均 18.4，z=3.2）" },
  { caseId: "case-chen", level: "yellow", layer: "A", summary: "體溫 38.2°C（≥黃色上限 38）" },
  { caseId: "case-huang", level: "yellow", layer: "A", summary: "SpO2 89%（≤個案覆寫黃色下限 90）" },
  { caseId: "case-huang", level: "yellow", layer: "B", summary: "NEWS2 總分 5 分，建議提高觀察頻率" },
  { caseId: "case-chang", level: "yellow", layer: "A", summary: "SBP 98mmHg（≤黃色下限 100）" },
  { caseId: "case-lee", level: "red", layer: "A", summary: "SpO2 85%（≤個案覆寫紅色下限 85）" },
  { caseId: "case-chang", level: "red", layer: "qualitative", summary: "跌倒撞頭（質性紅旗）" },
];

const HANDLED = ["已觀察複測", "已聯絡家屬", "已聯絡醫師"];

function genDayAlerts(daysAgo: number): AlertRow[] {
  const rnd = lcg(daySeed(daysAgo, 7));
  const date = dayKey(daysAgo);
  const out: AlertRow[] = [];
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const pick = ALERT_POOL[Math.floor(rnd() * 8)];
    const at = isoAt(daysAgo, 9 + Math.floor(rnd() * 10), Math.floor(rnd() * 60));
    out.push({
      id: `al-${date}-${i}`, caseId: pick.caseId, layer: pick.layer, level: pick.level,
      summary: pick.summary, status: "closed", triggeredAt: at,
      claimedAt: new Date(new Date(at).getTime() + (1 + rnd() * 4) * 60_000).toISOString(),
      handledNote: HANDLED[Math.floor(rnd() * HANDLED.length)],
    });
  }
  if (rnd() > 0.75) {
    const red = ALERT_POOL[rnd() > 0.5 ? 9 : 8];
    const at = isoAt(daysAgo, 3 + Math.floor(rnd() * 4), Math.floor(rnd() * 60));
    out.push({
      id: `al-${date}-red`, caseId: red.caseId, layer: red.layer, level: red.level,
      summary: red.summary, status: "closed", triggeredAt: at,
      claimedAt: new Date(new Date(at).getTime() + (1 + rnd() * 3) * 60_000).toISOString(),
      handledNote: "已聯絡醫師",
    });
  }
  return out;
}

/** 今日待處理警報：主控台一打開就有東西可認領 */
function todayOpenAlerts(): AlertRow[] {
  const date = dayKey(0);
  const h = new Date().getHours();
  return [
    {
      id: `al-open-${date}-1`, caseId: "case-huang", layer: "A", level: "yellow",
      summary: "SpO2 89%（≤個案覆寫黃色下限 90）", status: "triggered",
      triggeredAt: isoAt(0, Math.max(0, h - 1), 20),
    },
    {
      id: `al-open-${date}-2`, caseId: "case-chang", layer: "C", level: "yellow",
      summary: "SBP 低於個案平時水準（7 日平均 121.4，z=-2.6）", status: "claimed",
      triggeredAt: isoAt(0, Math.max(0, h - 2), 5),
      claimedAt: isoAt(0, Math.max(0, h - 2), 9),
      handledNote: "已觀察複測",
    },
  ];
}

const DAYS = 7;

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const today = dayKey(0);

  // 定義類資料永遠 upsert
  await db.cases.bulkPut(CASES);
  await db.nurses.bulkPut(NURSES);
  await db.meds.bulkPut(MEDS);
  await db.eduUnits.bulkPut(EDU_UNITS);

  // 歷史資料：首次全量，之後每天補缺的日子
  await db.transaction("rw",
    [db.observations, db.alerts, db.events, db.medLogs, db.handoffs, db.shifts, db.meta],
    async () => {
      const mark = await db.meta.get("seed_day");
      const fill = async (fromDaysAgo: number) => {
        for (let d = fromDaysAgo; d >= 1; d--) {
          await db.observations.bulkPut(genDay(d));
          await db.alerts.bulkPut(genDayAlerts(d));
          await db.events.bulkPut(genCareEvents(d));
          await db.medLogs.bulkPut(genMedLogs(d));
          await db.handoffs.bulkPut(genHandoffs(d));
          await db.shifts.bulkPut(genPastShifts(d));
        }
      };
      if (!mark) {
        await fill(DAYS);
        await db.alerts.bulkPut(todayOpenAlerts());
        await db.meta.put({ id: "seed_day", value: today });
        return;
      }
      if (mark.value !== today) {
        const last = new Date(mark.value + "T00:00:00");
        const gap = Math.min(DAYS, Math.max(0, Math.round((Date.now() - last.getTime()) / 86400_000)));
        await fill(gap);
        await db.alerts.bulkPut(todayOpenAlerts());
        await db.meta.put({ id: "seed_day", value: today });
      }
    });

  // 靜態示範內容（決定性 ID，天然冪等）
  await db.wounds.bulkPut(WOUNDS);
  await db.woundAssessments.bulkPut(WOUND_ASSESSMENTS);
  await db.eduPushes.bulkPut(EDU_PUSHES);
  await db.signedDocs.bulkPut(SIGNED_DOCS);

  // 今日班次：登入者兩班在手，另有兩班服務中與一張待派供派單流程展示
  const shifts: Shift[] = [
    { id: `shift-case-wang-${today}`, caseId: "case-wang", date: today, startHH: 8, endHH: 20, status: "accepted", nurseId: SELF_ID },
    // 夜班另派他人：同一人不連值日夜（勞基法輪班間隔）
    { id: `shift-case-lee-${today}`, caseId: "case-lee", date: today, startHH: 20, endHH: 8, status: "accepted", nurseId: "nurse-tsai" },
    {
      id: `shift-case-chen-${today}`, caseId: "case-chen", date: today, startHH: 8, endHH: 20,
      status: "in_progress", nurseId: "nurse-wu",
      clockInAt: isoAt(0, 7, 52), clockInGeo: { lat: 25.0421, lng: 121.5198, acc: 14 },
    },
    {
      id: `shift-case-huang-${today}`, caseId: "case-huang", date: today, startHH: 8, endHH: 20,
      status: "in_progress", nurseId: "nurse-lin",
      clockInAt: isoAt(0, 7, 58), clockInGeo: { lat: 25.0388, lng: 121.5231, acc: 22 },
    },
    { id: `shift-case-chang-${today}`, caseId: "case-chang", date: today, startHH: 8, endHH: 20, status: "unassigned" },
  ];
  const existing = await db.shifts.where("date").equals(today).toArray();
  const started = new Set(existing.map((s) => s.id));
  await db.shifts.bulkPut(shifts.filter((s) => !started.has(s.id)));

  await seedTodayVitals();
  await seedTodayEvents();
  await seedTodayMedLogs();
}

/** demo 重置：清空本地資料重新種子 */
export async function resetDemo(): Promise<void> {
  const db = getDb();
  await db.delete();
  if (typeof window !== "undefined") window.location.reload();
}

/**
 * 今日稍早時段的給藥紀錄：讓原型打開時「今天已經在運轉」，
 * 但保留最近一個時段未給，仍可實際操作給藥流程。
 * 只補不存在的紀錄，不覆蓋使用者操作。
 */
async function seedTodayMedLogs(): Promise<void> {
  const db = getDb();
  const today = dayKey(0);
  const cutoff = new Date().getHours() - 1;
  const rnd = lcg(daySeed(0, 103));

  const rows = MEDS.flatMap((m) =>
    m.slots.filter((slot) => slot <= cutoff).map((slot) => {
      const withheld = rnd() > 0.92;
      return {
        id: `${m.id}|${today}|${slot}`,
        caseId: m.caseId, medId: m.id, date: today, slot,
        status: (withheld ? "withheld" : "given") as "given" | "withheld",
        reason: withheld ? "拒服" : undefined,
        at: isoAt(0, slot, Math.floor(rnd() * 25)),
      };
    }));
  if (rows.length === 0) return;

  const existing = new Set((await db.medLogs.where("caseId").anyOf(MEDS.map((m) => m.caseId)).toArray()).map((l) => l.id));
  const fresh = rows.filter((r) => !existing.has(r.id));
  if (fresh.length > 0) await db.medLogs.bulkAdd(fresh);
}

/**
 * 今日已過時段的量測：讓原型呈現「今天正在進行中」，
 * 而非每個個案都被標為量測逾排程。只補不覆蓋使用者輸入。
 */
async function seedTodayEvents(): Promise<void> {
  const db = getDb();
  const rows = genCareEvents(0, new Date().getHours());
  if (rows.length === 0) return;
  const ids = new Set((await db.events.bulkGet(rows.map((r) => r.id))).filter(Boolean).map((e) => e!.id));
  const fresh = rows.filter((r) => !ids.has(r.id));
  if (fresh.length > 0) await db.events.bulkAdd(fresh);
}

async function seedTodayVitals(): Promise<void> {
  const db = getDb();
  const rows = genDay(0, new Date().getHours());
  if (rows.length === 0) return;
  const ids = new Set((await db.observations.bulkGet(rows.map((r) => r.id))).filter(Boolean).map((o) => o!.id));
  const fresh = rows.filter((r) => !ids.has(r.id));
  if (fresh.length > 0) await db.observations.bulkAdd(fresh);
}
