import type {
  CareEvent, EduPush, Handoff, MedLog, Shift, SignedDoc, Wound, WoundAssessment,
} from "./types";
import { MEDS, SELF_ID } from "./cases-seed";

// 原型示範用的歷史活動：讓每個模組打開就有「系統一直在運轉」的內容。
// 全部使用決定性 ID，重跑不會產生重複；亂數以日曆日為種子，同一天結果一致。

export function lcg(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

export function dayKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isoAt(daysAgo: number, hh: number, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function seedOf(daysAgo: number, salt: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return salt + d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/* ---------- 照護事件：翻身、抽痰、管路勾檢 ---------- */

const REPOSITION_CASES = ["case-wang", "case-chen", "case-huang", "case-chang"];
const SUCTION_CASES = ["case-lee", "case-huang"];
const TUBE_CHECK: Record<string, string> = {
  "case-wang": "鼻胃管", "case-lee": "尿管", "case-chen": "鼻胃管",
  "case-huang": "氣切內管", "case-chang": "周邊靜脈留置針",
};
const POSTURES = ["左側臥", "平躺", "右側臥", "坐起"];
const SPUTUM = [
  { amount: "少", color: "白" }, { amount: "中", color: "白" },
  { amount: "中", color: "黃" }, { amount: "多", color: "黃" },
];

export function genCareEvents(daysAgo: number, maxHour?: number): CareEvent[] {
  const rnd = lcg(seedOf(daysAgo, 31));
  const date = dayKey(daysAgo);
  const out: CareEvent[] = [];

  for (const caseId of REPOSITION_CASES) {
    const hours = [8, 10, 12, 14, 16, 18];
    hours.forEach((hh, i) => {
      if (maxHour != null && hh > maxHour) return;
      if (rnd() < 0.86) {
        out.push({
          id: `ev-${caseId}-${date}-rp-${i}`,
          caseId, type: "reposition",
          label: `翻身：${POSTURES[i % POSTURES.length]}`,
          occurredAt: isoAt(daysAgo, hh, Math.floor(rnd() * 20)),
        });
      }
    });
  }

  for (const caseId of SUCTION_CASES) {
    const times = [7, 11, 15, 19, 23];
    times.forEach((hh, i) => {
      if (maxHour != null && hh > maxHour) return;
      if (rnd() < 0.8) {
        const s = SPUTUM[Math.floor(rnd() * SPUTUM.length)];
        out.push({
          id: `ev-${caseId}-${date}-sx-${i}`,
          caseId, type: "suction",
          label: `抽痰（量${s.amount}、色${s.color}）`,
          detail: { amount: s.amount, color: s.color },
          occurredAt: isoAt(daysAgo, hh, Math.floor(rnd() * 30)),
        });
      }
    });
  }

  for (const [caseId, tube] of Object.entries(TUBE_CHECK)) {
    [9, 21].forEach((hh, i) => {
      if (maxHour != null && hh > maxHour) return;
      out.push({
        id: `ev-${caseId}-${date}-tc-${i}`,
        caseId, type: "tube_check",
        label: `${tube} 勾檢：固定完整、通暢、皮膚正常`,
        occurredAt: isoAt(daysAgo, hh, 10 + Math.floor(rnd() * 15)),
      });
    });
  }

  return out;
}

/* ---------- 給藥紀錄 ---------- */

const WITHHOLD = ["拒服", "禁食", "嘔吐"];

export function genMedLogs(daysAgo: number): MedLog[] {
  const rnd = lcg(seedOf(daysAgo, 57));
  const date = dayKey(daysAgo);
  const out: MedLog[] = [];

  for (const med of MEDS) {
    for (const slot of med.slots) {
      const roll = rnd();
      if (roll > 0.97) continue;
      const withheld = roll > 0.9;
      out.push({
        id: `${med.id}|${date}|${slot}`,
        caseId: med.caseId, medId: med.id, date, slot,
        status: withheld ? "withheld" : "given",
        reason: withheld ? WITHHOLD[Math.floor(rnd() * WITHHOLD.length)] : undefined,
        at: isoAt(daysAgo, slot, Math.floor(rnd() * 25)),
      });
    }
  }
  return out;
}

/* ---------- 班次與打卡歷史 ---------- */

// 一天一位護理師只顧一位個案：避免示範資料自己違反勞基法工時（規劃書最高風險項）
const ROSTER: { caseId: string; day: string }[] = [
  { caseId: "case-wang", day: "nurse-chang" },
  { caseId: "case-lee", day: "nurse-tsai" },
  { caseId: "case-chen", day: SELF_ID },
  { caseId: "case-huang", day: "nurse-lin" },
  { caseId: "case-chang", day: "nurse-wu" },
];

export function genPastShifts(daysAgo: number): Shift[] {
  const rnd = lcg(seedOf(daysAgo, 83));
  const date = dayKey(daysAgo);
  const out: Shift[] = [];

  for (const r of ROSTER) {
    const inMin = Math.floor(rnd() * 12);
    const outMin = 55 + Math.floor(rnd() * 10);
    // 固定保留一筆待審核異常，讓審核流在原型上永遠可示範
    const pending = daysAgo === 2 && r.caseId === "case-chen";
    const noGeo = pending || rnd() > 0.86;
    out.push({
      id: `shift-${r.caseId}-${date}-day`,
      caseId: r.caseId, date, startHH: 8, endHH: 20,
      status: "completed", nurseId: r.day,
      clockInAt: isoAt(daysAgo, 7, 48 + inMin),
      clockInGeo: noGeo ? null : { lat: 25.041 + rnd() * 0.01, lng: 121.516 + rnd() * 0.01, acc: 8 + Math.floor(rnd() * 22) },
      clockOutAt: isoAt(daysAgo, 19, outMin),
      reviewStatus: noGeo && !pending ? "approved" : undefined,
      reviewNote: noGeo && !pending ? "主管確認在場" : undefined,
    });
  }
  return out;
}

/* ---------- 交班（已簽收歸檔） ---------- */

const HANDOFF_TEMPLATES: Record<string, { issues: string[]; a: string; todos: string[] }> = {
  "case-wang": {
    issues: ["血糖異常"],
    a: "血糖較昨日偏高，晚餐後複測仍在觀察範圍。管灌耐受良好，反抽量少。精神狀態穩定，家屬陪伴下情緒佳。",
    todos: ["明日 07:30 空腹血糖", "追蹤晚間血糖趨勢"],
  },
  "case-lee": {
    issues: ["呼吸喘"],
    a: "活動後喘感較明顯，休息後緩解。血氧維持於目標區間，氧流量未調整。痰液量中、色白，抽痰後呼吸型態改善。",
    todos: ["翻身拍背後評估痰量", "留意夜間血氧趨勢"],
  },
  "case-chen": {
    issues: ["進食差"],
    a: "管灌過程順利，無嗆咳。薦尾傷口敷料乾淨無滲液，週邊皮膚無新增發紅。右側肢體被動關節活動完成。",
    todos: ["每 2 小時翻身避開薦尾", "明日換藥時拍照記錄"],
  },
  "case-huang": {
    issues: ["無特殊"],
    a: "呼吸器參數穩定，管路無漏氣。痰液較昨日略增、色白，抽痰後血氧回穩。氣切造口周圍皮膚完整。",
    todos: ["內管清潔", "追蹤痰液性狀變化"],
  },
  "case-chang": {
    issues: ["疼痛"],
    a: "翻身時主訴髖部疼痛，給藥後緩解。進食量少但可接受，家屬陪伴時情緒明顯較安定。",
    todos: ["疼痛評估每班一次", "與家屬討論舒適照護目標"],
  },
};

export function genHandoffs(daysAgo: number): Handoff[] {
  const date = dayKey(daysAgo);
  const checklist = {
    "管路已逐條核對": true, "藥品已清點無誤": true,
    "病人當下狀態已確認": true, "特殊物品已交接": true,
  };
  return Object.entries(HANDOFF_TEMPLATES).map(([caseId, t]) => ({
    id: `ho-${caseId}-${date}`,
    caseId, shiftId: `shift-${caseId}-${date}-day`,
    sIssues: t.issues, sNote: "",
    aNote: t.a,
    rTodos: t.todos.map((text) => ({ text })),
    summaryDraft: `本班主要情況：${t.issues.join("、")}。\n${t.a}\n交辦：${t.todos.join("；")}。`,
    status: "received" as const,
    submittedAt: isoAt(daysAgo, 19, 40),
    receivedAt: isoAt(daysAgo, 20, 5),
    checklist,
  }));
}

/* ---------- 傷口與追蹤評估 ---------- */

export const WOUNDS: Wound[] = [
  { id: "wound-chen-sacrum", caseId: "case-chen", site: "sacrum", siteLabel: "薦尾", identifiedOn: isoAt(12, 10) },
  { id: "wound-chang-heel", caseId: "case-chang", site: "heel_r", siteLabel: "右腳跟", identifiedOn: isoAt(5, 15) },
];

/** 陳美玉薦尾壓傷呈改善軌跡；張春枝右腳跟為近期新發，供惡化端展示 */
export const WOUND_ASSESSMENTS: WoundAssessment[] = [
  {
    id: "wa-chen-1", woundId: "wound-chen-sacrum", caseId: "case-chen", stage: "2 期",
    note: "約 2x1.5 公分表淺破皮，少量清澈滲液，週邊發紅。已加強翻身避開受壓。",
    at: isoAt(12, 10, 30),
  },
  {
    id: "wa-chen-2", woundId: "wound-chen-sacrum", caseId: "case-chen", stage: "2 期",
    note: "滲液減少，基底呈粉紅色肉芽，週邊發紅範圍縮小。",
    at: isoAt(8, 10, 20),
  },
  {
    id: "wa-chen-3", woundId: "wound-chen-sacrum", caseId: "case-chen", stage: "1 期",
    note: "表皮大致癒合，僅餘壓紅，按壓可變白。持續減壓中。",
    at: isoAt(3, 10, 15),
  },
  {
    id: "wa-chang-1", woundId: "wound-chang-heel", caseId: "case-chang", stage: "深部組織損傷",
    note: "右腳跟紫紅色變，界線清楚，觸感較硬。已使用足跟懸空擺位並通報護理長。",
    at: isoAt(5, 15, 40),
  },
  {
    id: "wa-chang-2", woundId: "wound-chang-heel", caseId: "case-chang", stage: "深部組織損傷",
    note: "範圍無擴大，顏色略退。持續懸空減壓，每班觀察。",
    at: isoAt(1, 16, 10),
  },
];

/* ---------- 衛教推送 ---------- */

export const EDU_PUSHES: EduPush[] = [
  { id: "push-1", unitId: "TH-005", caseId: "case-chen", at: isoAt(4, 15, 20) },
  { id: "push-2", unitId: "TH-006", caseId: "case-chen", at: isoAt(4, 15, 22) },
  { id: "push-3", unitId: "TH-002", caseId: "case-wang", at: isoAt(3, 11, 5) },
  { id: "push-4", unitId: "TH-008", caseId: "case-huang", at: isoAt(2, 14, 40) },
  { id: "push-5", unitId: "TH-009", caseId: "case-wang", at: isoAt(1, 9, 30) },
];

/* ---------- 已簽署文件 ---------- */

// 簽名影像以向量塗鴉示意；雜湊為示範佔位值（新簽署會即時計算真實 SHA-256）
const SIG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='60'><path d='M12 42 q18-26 34-4 t30-6 q14-10 28 2 t26-6' fill='none' stroke='%23141c1b' stroke-width='2'/></svg>";

export const SIGNED_DOCS: SignedDoc[] = [
  {
    id: "doc-1", kind: "個人資料暨特種個資蒐集處理利用同意書",
    signerName: "王志明（長子）", caseId: "case-wang", consentElectronic: true,
    signedAt: isoAt(14, 10, 30),
    sha256: "9f2c41ab7d0e6538b1c4a97e2f5d8360c7b1e94a2d6f80351ac9e7b4a2f06d85",
    deviceInfo: "示範資料（家屬手機簽署）", signatureDataUrl: SIG,
  },
  {
    id: "doc-2", kind: "特別護理服務契約確認單",
    signerName: "陳淑芬（女兒）", caseId: "case-chen", consentElectronic: true,
    signedAt: isoAt(11, 14, 5),
    sha256: "3a7e9c15d8b0426617ce5a93f0d248b6e7c1943a05fd8e26b73c9a410e58d2f7",
    deviceInfo: "示範資料（家屬手機簽署）", signatureDataUrl: SIG,
  },
  {
    id: "doc-3", kind: "個人資料暨特種個資蒐集處理利用同意書",
    signerName: "黃美惠（配偶）", caseId: "case-huang", consentElectronic: true,
    signedAt: isoAt(9, 16, 45),
    sha256: "b5d38f0a41e7c962835d7be1049af3268c05e7b19d4a63f8027ce5a91f4b8630",
    deviceInfo: "示範資料（平板簽署）", signatureDataUrl: SIG,
  },
];
