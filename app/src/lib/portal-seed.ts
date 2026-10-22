import type { Complaint, Customer, NurseProfile, Review, ServiceRequest } from "./types";
import { isoAt } from "./demo-history";

// 三端平台示範資料：客戶、需求單、評價、客訴、護理師檔案。

export const CUSTOMERS: Customer[] = [
  { id: "cust-wang", name: "王志明", relation: "長子", phone: "0912-345-678", lineBound: true, caseIds: ["case-wang"], createdAt: isoAt(21, 10) },
  { id: "cust-lee", name: "李淑華", relation: "女兒", phone: "0922-111-222", lineBound: true, caseIds: ["case-lee"], createdAt: isoAt(18, 14) },
  { id: "cust-chen", name: "陳淑芬", relation: "女兒", phone: "0933-222-333", lineBound: false, caseIds: ["case-chen"], createdAt: isoAt(16, 9), note: "偏好電話聯繫，晚上八點後勿擾" },
  { id: "cust-huang", name: "黃美惠", relation: "配偶", phone: "0955-444-555", lineBound: true, caseIds: ["case-huang"], createdAt: isoAt(30, 11) },
  { id: "cust-chang", name: "張文龍", relation: "兒子", phone: "0966-777-888", lineBound: true, caseIds: ["case-chang"], createdAt: isoAt(9, 16) },
  { id: "cust-wu", name: "吳小玲", relation: "媳婦", phone: "0977-888-999", lineBound: false, caseIds: ["case-wu"], createdAt: isoAt(2, 15) },
];

export const REQUESTS: ServiceRequest[] = [
  {
    id: "req-1", customerName: "吳小玲", phone: "0977-888-999", relation: "媳婦", setting: "居家", area: "台北市文山區",
    needs: ["抽痰", "管灌"], startDate: isoAt(-5, 8).slice(0, 10), shiftPref: "白班",
    note: "公公帕金森氏症，最近兩次吸入性肺炎住院，希望有能處理抽痰的護理師。",
    status: "contacted", createdAt: isoAt(2, 15, 20), caseId: "case-wu",
  },
  {
    id: "req-2", customerName: "劉建宏", phone: "0988-123-456", relation: "兒子", setting: "醫院", area: "台北市中正區",
    needs: ["傷口照護", "安寧照護"], startDate: isoAt(-3, 8).slice(0, 10), shiftPref: "全天",
    note: "母親癌末在台大安寧病房，家人輪流照顧體力不支，想找專業人員接手夜間。",
    status: "new", createdAt: isoAt(0, Math.max(0, new Date().getHours() - 3), 12),
  },
  {
    id: "req-3", customerName: "林佩君", phone: "0911-222-333", relation: "女兒", setting: "居家", area: "新北市板橋區",
    needs: ["血糖監測", "失智照護"], startDate: isoAt(-10, 8).slice(0, 10), shiftPref: "白班",
    status: "new", createdAt: isoAt(1, 20, 45),
  },
  {
    id: "req-4", customerName: "張文龍", phone: "0966-777-888", relation: "兒子", setting: "醫院", area: "台北市信義區",
    needs: ["安寧照護", "傷口照護"], startDate: isoAt(8, 8).slice(0, 10), shiftPref: "白班",
    status: "converted", createdAt: isoAt(10, 11, 30), caseId: "case-chang",
  },
  {
    id: "req-5", customerName: "許雅婷", phone: "0900-555-666", relation: "孫女", setting: "居家", area: "桃園市中壢區",
    needs: ["管灌"], startDate: isoAt(-2, 8).slice(0, 10), shiftPref: "夜班",
    status: "declined", createdAt: isoAt(6, 9, 10), note: "服務區域暫不涵蓋桃園，已轉介合作機構。",
  },
];

export const REVIEWS: Review[] = [
  { id: "rv-1", caseId: "case-wang", nurseId: "nurse-chang", customerName: "王志明", rating: 5, tags: ["細心", "溝通清楚"], comment: "母親血糖控制比之前穩定很多，每天的日報讓我們在外地也很安心。", at: isoAt(5, 21) },
  { id: "rv-2", caseId: "case-lee", nurseId: "nurse-tsai", customerName: "李淑華", rating: 4, tags: ["專業", "準時"], comment: "抽痰技術很好，父親說比醫院的還溫柔。", at: isoAt(4, 20, 30) },
  { id: "rv-3", caseId: "case-chen", nurseId: "nurse-chen", customerName: "陳淑芬", rating: 5, tags: ["細心", "主動回報", "溝通清楚"], comment: "傷口一天天好起來，換藥都會拍照給我們看。", at: isoAt(3, 19, 15) },
  { id: "rv-4", caseId: "case-huang", nurseId: "nurse-lin", customerName: "黃美惠", rating: 5, tags: ["專業", "冷靜"], comment: "呼吸器警報時處理很冷靜，讓我很放心。", at: isoAt(2, 22) },
  { id: "rv-5", caseId: "case-chang", nurseId: "nurse-wu", customerName: "張文龍", rating: 4, tags: ["溫柔", "尊重"], at: isoAt(1, 21, 40) },
  { id: "rv-6", caseId: "case-wang", nurseId: "nurse-chang", customerName: "王志明", rating: 5, tags: ["準時", "細心"], at: isoAt(12, 20) },
];

export const COMPLAINTS: Complaint[] = [
  {
    id: "cp-1", caseId: "case-lee", nurseId: "nurse-tsai", customerName: "李淑華", category: "溝通",
    detail: "交班時沒有主動告知父親前一晚血氧下降的情況，我們是看日報才知道。",
    status: "resolved", at: isoAt(6, 10, 20), handledBy: "護理長",
    resolution: "已與護理師檢討，交班摘要新增「家屬溝通事項」必填；已致電家屬說明並致歉。",
    resolvedAt: isoAt(5, 15),
  },
  {
    id: "cp-2", caseId: "case-chang", customerName: "張文龍", category: "收費",
    detail: "上月帳單的夜班加成與報價單上的說明不一致，希望說明計算方式。",
    status: "investigating", at: isoAt(1, 14, 5), handledBy: "行政",
  },
  {
    id: "cp-3", customerName: "劉建宏", category: "其他",
    detail: "線上提出需求後兩天都沒有人聯繫。",
    status: "open", at: isoAt(0, Math.max(0, new Date().getHours() - 1), 30),
  },
];

const WEEK_ALL: NurseProfile["availability"] = {
  一: ["day", "night"], 二: ["day", "night"], 三: ["day", "night"], 四: ["day", "night"], 五: ["day", "night"], 六: ["day"], 日: [],
};

export const NURSE_PROFILES: NurseProfile[] = [
  {
    nurseId: "nurse-chen", licenseNo: "護理師 第 0123456 號",
    licenses: [{ name: "護理師證書", no: "0123456" }, { name: "BLS 基本救命術", no: "BLS-2025-8812", expiresOn: "2027-03-31" }, { name: "傷口造口照護訓練", no: "WOC-2024-115" }],
    yearsExp: 8, areas: ["台北市", "新北市"],
    availability: { 一: ["day"], 二: ["day"], 三: ["day"], 四: ["day"], 五: ["day"], 六: [], 日: [] },
    hourlyRate: 450, employment: "僱傭",
    bio: "內外科病房 6 年，居家特護 2 年。擅長管灌照護與傷口換藥，喜歡跟家屬一起把照護計畫講清楚。",
  },
  {
    nurseId: "nurse-lin", licenseNo: "護理師 第 0234567 號",
    licenses: [{ name: "護理師證書", no: "0234567" }, { name: "ACLS 高級心臟救命術", no: "ACLS-2025-3301", expiresOn: "2027-06-30" }, { name: "呼吸治療照護訓練", no: "RT-2023-077" }],
    yearsExp: 11, areas: ["台北市"],
    availability: WEEK_ALL, hourlyRate: 520, employment: "僱傭",
    bio: "加護病房 9 年，呼吸器與氣切照護經驗豐富。",
  },
  {
    nurseId: "nurse-chang", licenseNo: "護理師 第 0345678 號",
    licenses: [{ name: "護理師證書", no: "0345678" }, { name: "BLS 基本救命術", no: "BLS-2024-5520", expiresOn: "2026-11-30" }, { name: "失智症照護專業訓練", no: "DEM-2024-209" }],
    yearsExp: 5, areas: ["新北市", "台北市"],
    availability: { 一: ["day"], 二: ["day"], 三: [], 四: ["day"], 五: ["day"], 六: ["day"], 日: ["day"] },
    hourlyRate: 420, employment: "承攬",
    bio: "神經內科病房出身，對失智長輩的溝通很有耐心。",
  },
  {
    nurseId: "nurse-wu", licenseNo: "護理師 第 0456789 號",
    licenses: [{ name: "護理師證書", no: "0456789" }, { name: "安寧緩和醫療專業訓練", no: "PC-2023-412" }, { name: "傷口造口照護訓練", no: "WOC-2025-031" }],
    yearsExp: 9, areas: ["台北市"],
    availability: WEEK_ALL, hourlyRate: 480, employment: "僱傭",
    bio: "安寧病房 5 年，相信善終是照護的一部分。",
  },
  {
    nurseId: "nurse-tsai", licenseNo: "護理師 第 0567890 號",
    licenses: [{ name: "護理師證書", no: "0567890" }, { name: "ACLS 高級心臟救命術", no: "ACLS-2024-1187", expiresOn: "2026-09-30" }],
    yearsExp: 6, areas: ["台北市", "新北市", "基隆市"],
    availability: { 一: ["night"], 二: ["night"], 三: ["night"], 四: ["night"], 五: ["night"], 六: ["night"], 日: [] },
    hourlyRate: 500, employment: "承攬",
    bio: "胸腔科背景，夜班為主。",
  },
];
