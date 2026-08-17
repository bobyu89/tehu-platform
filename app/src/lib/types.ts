// 對齊 supabase/migrations/0001_init.sql 的核心型別（本地離線層子集）

export type ObsType =
  | "bt" | "hr" | "rr" | "bp" | "spo2" | "glucose" | "pain" | "consciousness"
  | "intake_oral" | "intake_tube" | "intake_iv"
  | "output_urine" | "output_stool" | "output_vomit" | "output_drain" | "output_suction"
  | "o2";

export type ObsCategory = "vital" | "io_in" | "io_out" | "o2";

/** value.main 對應 SQL 的 numeric_main 熱欄位 */
export interface ObsValue {
  main: number | null;
  [k: string]: unknown;
}

export interface Observation {
  id: string;
  caseId: string;
  shiftId?: string;
  type: ObsType;
  category: ObsCategory;
  value: ObsValue;
  measuredAt: string; // ISO
  recordedAt: string; // ISO
  source: "manual";
}

export interface RuleBounds {
  redLow?: number;
  yellowLow?: number;
  yellowHigh?: number;
  redHigh?: number;
}

export type RuleSet = Partial<Record<ObsType, RuleBounds>>;

export type AlertLayer = "A" | "B" | "C" | "qualitative";
export type AlertLevel = "yellow" | "red";

export interface AlertRow {
  id: string;
  caseId: string;
  obsId?: string;
  layer: AlertLayer;
  level: AlertLevel;
  summary: string;
  status: "triggered" | "claimed" | "handled" | "closed";
  triggeredAt: string;
  claimedAt?: string;
  handledNote?: string;
}

export interface CaseInfo {
  id: string;
  name: string;
  age: number;
  sex: "男" | "女";
  setting: "居家" | "醫院";
  dx: string;          // 診斷摘要
  allergies: string;
  careNeeds: string[]; // 技術需求標籤
  tubes: string[];     // 管路清單（demo 簡化）
  overrides?: RuleSet; // 個案警報覆寫（如 COPD SpO2）
  overrideNote?: string;
  news2Scale2?: boolean;    // COPD 等高碳酸血症風險個案改用 SpO2 Scale 2
  news2AlertsOff?: boolean; // B 層警報停用（慢性穩定個案；計分仍保留供排序）
  status?: CaseStatus;      // 個案狀態機（04 冊）；未填視為 active
  vitalsIntervalH?: number; // 生命徵象量測排程（如 Q4H＝4）；逾 30 分未量提醒
}

export type CareEventType =
  | "reposition" | "suction" | "tube_check" | "tube_event" | "red_flag" | "other";

export interface CareEvent {
  id: string;
  caseId: string;
  type: CareEventType;
  label: string;               // 顯示文字，如「翻身：左側臥」「管路事件：自拔」
  detail?: Record<string, unknown>;
  occurredAt: string;          // ISO
}

export type ShiftStatus =
  | "unassigned" | "offered" | "accepted" | "in_progress" | "completed";

export interface Shift {
  id: string;
  caseId: string;
  date: string;      // YYYY-MM-DD
  startHH: number;
  endHH: number;
  status: ShiftStatus;
  nurseId?: string;
  offeredAt?: string;
  respondBy?: string;  // 30 分鐘回覆期限（04 冊）
  clockInAt?: string;
  clockInGeo?: { lat: number; lng: number; acc: number } | null;
  clockOutAt?: string;
}

export type CaseStatus = "inquiry" | "assessing" | "quoted" | "active" | "paused" | "closed";

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  inquiry: "洽詢", assessing: "評估中", quoted: "報價", active: "服務中", paused: "暫停", closed: "結案",
};

export interface Nurse {
  id: string;
  name: string;
  tags: string[];   // 技術標籤（派單硬條件：需求 ⊆ 標籤）
}

export interface Med {
  id: string;
  caseId: string;
  name: string;     // 品名＋劑量
  route: string;    // 口服／吸入／外用…
  slots: number[];  // 每日給藥時段（時）
  note?: string;
}

export interface MedLog {
  id: string;       // 決定性：`${medId}|${date}|${slot}`，天然冪等
  caseId: string;
  medId: string;
  date: string;
  slot: number;
  status: "given" | "withheld";
  reason?: string;  // 未給必選：拒服/禁食/嘔吐/其他
  at: string;
}

export interface Handoff {
  id: string;
  caseId: string;
  shiftId: string;
  sIssues: string[];
  sNote: string;
  aNote: string;
  rTodos: { text: string; time?: string }[];
  summaryDraft: string;
  status: "draft" | "submitted";
  submittedAt?: string;
}

export interface SosIncident {
  id: string;
  kind: "patient_emergency" | "violence" | "environment" | "other";
  silent: boolean;
  triggeredAt: string;
  resolvedAt?: string;
}

export const OBS_LABEL: Record<ObsType, string> = {
  bt: "體溫", hr: "脈搏", rr: "呼吸", bp: "血壓", spo2: "SpO2",
  glucose: "血糖", pain: "疼痛", consciousness: "意識",
  intake_oral: "經口攝入", intake_tube: "管灌", intake_iv: "靜脈輸液",
  output_urine: "尿量", output_stool: "排便", output_vomit: "嘔吐",
  output_drain: "引流", output_suction: "抽痰", o2: "氧氣",
};

export const OBS_UNIT: Partial<Record<ObsType, string>> = {
  bt: "°C", hr: "次/分", rr: "次/分", bp: "mmHg", spo2: "%",
  glucose: "mg/dL", pain: "/10",
  intake_oral: "ml", intake_tube: "ml", intake_iv: "ml",
  output_urine: "ml", output_drain: "ml", o2: "L/min",
};
