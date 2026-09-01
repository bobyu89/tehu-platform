import type { CaseInfo, Med, Nurse } from "./types";

/** 目前登入的示範護理師 */
export const SELF_ID = "nurse-chen";

// 示範個案群：涵蓋特護實務的主要情境，讓原型走一圈就能看到系統的廣度。
// 管灌與失智、COPD 氧療、中風後壓傷追蹤、氣切呼吸器、術後安寧共照，
// 外加一個洽詢中與一個已結案個案，供派單狀態機展示。

export const CASES: CaseInfo[] = [
  {
    id: "case-wang",
    name: "王林秀英", age: 82, sex: "女", setting: "居家",
    dx: "第 2 型糖尿病、高血壓、失智症（中度）",
    allergies: "Penicillin",
    careNeeds: ["管灌", "血糖監測"],
    tubes: ["鼻胃管（7/28 置入，8/25 到期）"],
    status: "active", vitalsIntervalH: 4,
  },
  {
    id: "case-lee",
    name: "李金火", age: 78, sex: "男", setting: "醫院",
    dx: "COPD 急性惡化後、心房顫動",
    allergies: "無已知過敏",
    careNeeds: ["氧療照護", "抽痰"],
    tubes: ["尿管（8/2 置入，8/30 到期）"],
    overrides: { spo2: { yellowLow: 87, redLow: 85 } },
    overrideNote: "COPD 個案：SpO2 目標 88-92%（護理長 8/5 依醫囑調整）",
    news2Scale2: true, news2AlertsOff: true,
    status: "active", vitalsIntervalH: 4,
  },
  {
    id: "case-chen",
    name: "陳美玉", age: 71, sex: "女", setting: "居家",
    dx: "左側腦中風後右側偏癱、吞嚥困難",
    allergies: "海鮮類",
    careNeeds: ["管灌", "傷口照護"],
    tubes: ["鼻胃管（8/1 置入，8/29 到期）"],
    status: "active", vitalsIntervalH: 6,
  },
  {
    id: "case-huang",
    name: "黃國樑", age: 85, sex: "男", setting: "居家",
    dx: "呼吸衰竭、氣切造口術後、居家呼吸器使用中",
    allergies: "無已知過敏",
    careNeeds: ["呼吸器", "抽痰", "管灌"],
    tubes: ["氣切內管（每週更換）", "胃造口（7/15 置入）"],
    overrides: { spo2: { yellowLow: 90, redLow: 88 } },
    overrideNote: "呼吸器個案：SpO2 目標 92% 以上（主治醫師 8/10 指示）",
    status: "active", vitalsIntervalH: 4,
  },
  {
    id: "case-chang",
    name: "張春枝", age: 90, sex: "女", setting: "醫院",
    dx: "右髖關節骨折術後、失智症（重度）、安寧共同照護中",
    allergies: "Morphine（曾有噁心反應）",
    careNeeds: ["安寧照護", "傷口照護"],
    tubes: ["周邊靜脈留置針"],
    status: "active", vitalsIntervalH: 8,
  },
  {
    id: "case-wu",
    name: "吳文昌", age: 76, sex: "男", setting: "居家",
    dx: "帕金森氏症、反覆吸入性肺炎（家屬洽詢中）",
    allergies: "待確認",
    careNeeds: ["抽痰", "管灌"],
    tubes: [],
    status: "assessing", vitalsIntervalH: 6,
  },
  {
    id: "case-lin",
    name: "林秋菊", age: 88, sex: "女", setting: "居家",
    dx: "心衰竭（服務已於上月結束）",
    allergies: "無已知過敏",
    careNeeds: ["血糖監測"],
    tubes: [],
    status: "closed", closedReason: "轉入長照機構",
    vitalsIntervalH: 8,
  },
];

export const NURSES: Nurse[] = [
  { id: SELF_ID, name: "陳曉柔", tags: ["管灌", "血糖監測", "氧療照護", "抽痰", "傷口照護"] },
  { id: "nurse-lin", name: "林士弘", tags: ["氧療照護", "抽痰", "傷口照護", "呼吸器", "管灌"] },
  { id: "nurse-chang", name: "張惠雯", tags: ["管灌", "失智照護", "血糖監測"] },
  { id: "nurse-wu", name: "吳佩珊", tags: ["傷口照護", "安寧照護", "管灌"] },
  { id: "nurse-tsai", name: "蔡明哲", tags: ["呼吸器", "抽痰", "氧療照護"] },
];

export const MEDS: Med[] = [
  { id: "med-w1", caseId: "case-wang", name: "Metformin 500mg", route: "口服", slots: [8, 20], note: "隨餐" },
  { id: "med-w2", caseId: "case-wang", name: "Amlodipine 5mg", route: "口服", slots: [8] },
  { id: "med-w3", caseId: "case-wang", name: "Donepezil 5mg", route: "口服", slots: [21] },
  { id: "med-l1", caseId: "case-lee", name: "Tiotropium 吸入劑", route: "吸入", slots: [8] },
  { id: "med-l2", caseId: "case-lee", name: "Apixaban 2.5mg", route: "口服", slots: [8, 20] },
  { id: "med-c1", caseId: "case-chen", name: "Aspirin 100mg", route: "管餵", slots: [9], note: "磨粉後沖服" },
  { id: "med-c2", caseId: "case-chen", name: "Atorvastatin 20mg", route: "管餵", slots: [21] },
  { id: "med-h1", caseId: "case-huang", name: "Acetylcysteine 化痰劑", route: "吸入", slots: [8, 14, 20] },
  { id: "med-h2", caseId: "case-huang", name: "Pantoprazole 40mg", route: "管餵", slots: [8] },
  { id: "med-g1", caseId: "case-chang", name: "Acetaminophen 500mg", route: "口服", slots: [8, 14, 20], note: "疼痛時依醫囑" },
];
