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
  closedReason?: string;    // 結案原因（出院／往生／轉介／終止）
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
  /** 出勤異常審核（04 冊：圈外/無定位不硬擋，標記進審核流） */
  reviewStatus?: "approved" | "rejected";
  reviewNote?: string;
}

/** 傷口／壓傷（02 冊 §1.3：人形圖點選＋拍照＋分期＋描述） */
export interface Wound {
  id: string;
  caseId: string;
  site: string;       // 人形圖部位代碼
  siteLabel: string;  // 顯示名稱（後腦杓/薦尾…）
  identifiedOn: string;
  healedOn?: string;
}

export const WOUND_STAGES = ["1 期", "2 期", "3 期", "4 期", "深部組織損傷", "無法分期"] as const;

export interface WoundAssessment {
  id: string;
  woundId: string;
  caseId: string;
  stage: (typeof WOUND_STAGES)[number];
  note?: string;
  photo?: string;     // 縮壓後的 dataURL（示範）；正式版存 Storage 並留存原檔
  at: string;
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
  /** 狀態機（03 冊）：draft → submitted →（疑義退回 draft）→ received 歸檔 */
  status: "draft" | "submitted" | "received";
  submittedAt?: string;
  /** 簽收勾稽區：全部勾認才能簽收 */
  checklist?: Record<string, boolean>;
  disputeNote?: string;  // 接班者疑義（退回時填寫）
  receivedAt?: string;
  supplementNote?: string; // 交班者對疑義的補充
}

/** 衛教單元（沿用衛教機器人 unit-schema：content 是唯一事實來源、media 只放資產編號） */
export interface EduUnit {
  id: string;            // TH-###
  title: string;
  audience: "病人" | "家屬" | "照護者";
  keywords: string[];    // 用家屬的話，不是專業術語
  content: string;       // 審核後才可對外；示範資料一律標示未審核
  caution?: string;      // 回覆時的行為約束（內部提示，不對家屬顯示）
  media?: { kind: "card" | "video" | "audio"; code: string; ready: boolean }[];
  source: string;        // 來源與版本，供追溯
  reviewed: boolean;     // 未審核單元不得實際推送
}

export interface EduPush {
  id: string;
  unitId: string;
  caseId: string;
  at: string;
}

export interface SignedDoc {
  id: string;
  kind: string;          // 文件類型
  signerName: string;
  caseId?: string;
  consentElectronic: boolean; // 「同意以電子方式簽署」前置勾選（相對人同意要件）
  signedAt: string;
  sha256: string;        // 文件內容＋簽名影像＋時間戳之雜湊（存證）
  deviceInfo: string;
  signatureDataUrl: string;
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

/* ============ 三端平台：客戶、需求、評價、客訴、人員檔案 ============ */

/** 客戶（付費／決策的家屬），與個案（病人）分開 */
export interface Customer {
  id: string;
  name: string;
  relation: string;      // 與個案關係
  phone: string;
  lineBound: boolean;
  caseIds: string[];
  createdAt: string;
  note?: string;
}

export type RequestStatus = "new" | "contacted" | "quoted" | "converted" | "declined";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "待聯繫", contacted: "已聯繫", quoted: "已報價", converted: "已成案", declined: "未成案",
};

/** 客戶線上提出的服務需求單 */
export interface ServiceRequest {
  id: string;
  customerName: string;
  phone: string;
  relation: string;
  setting: "居家" | "醫院";
  area: string;
  needs: string[];          // 技術需求標籤
  startDate: string;
  shiftPref: string;        // 白班／夜班／全天
  note?: string;
  status: RequestStatus;
  createdAt: string;
  caseId?: string;          // 成案後連結的個案
}

/** 服務評價（客戶對護理師） */
export interface Review {
  id: string;
  caseId: string;
  nurseId: string;
  customerName: string;
  rating: number;           // 1-5
  tags: string[];           // 準時、細心、溝通清楚…
  comment?: string;
  at: string;
}

export type ComplaintStatus = "open" | "investigating" | "resolved";

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: "待處理", investigating: "調查中", resolved: "已結案",
};

/** 客訴案件 */
export interface Complaint {
  id: string;
  caseId?: string;
  nurseId?: string;
  customerName: string;
  category: string;         // 服務態度／專業能力／準時／溝通／收費／其他
  detail: string;
  status: ComplaintStatus;
  at: string;
  handledBy?: string;
  resolution?: string;
  resolvedAt?: string;
}

/** 護理師檔案延伸（證照、可服務時段、費率） */
export interface NurseProfile {
  nurseId: string;
  licenseNo: string;
  licenses: { name: string; no: string; expiresOn?: string }[];
  yearsExp: number;
  areas: string[];              // 可服務地區
  availability: Record<string, ("day" | "night")[]>; // 週一..週日 → 可上班別
  hourlyRate: number;
  bio?: string;
  employment: "僱傭" | "承攬";
}
