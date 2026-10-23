# CONTEXT.md — 特護平台共同語言

給人與 agent 共讀的領域模型。規劃書是「為什麼」，這份是「叫什麼、守什麼」。
新增程式碼前先對照本文的名詞與不變量；命名以此為準。

## 三端（Portal）

| 端 | 路由 | 使用者 | 看得到什麼 |
|---|---|---|---|
| 公司管理端 admin | `/console/*` | 護理長、調度、行政 | 全部營運與品質資料 |
| 照護人員端 staff | `/staff/*` | 護理師本人 | 自己的班次、被指派個案的紀錄、檔案、收入 |
| 客戶端 client | `/client/*` | 付費家屬 | 自己個案的溝通版資訊、人員、需求、評價 |

原型以側欄「切換視角」示範三端；正式版由登入角色決定，無切換。

## 核心名詞

- **個案 Case**：接受照護的病人。有狀態機：洽詢 → 評估中 → 報價 → 服務中 → 暫停 → 結案。
- **客戶 Customer**：付費／決策的家屬。與個案分開；一位客戶可對應多個個案。
- **需求單 ServiceRequest**：客戶線上提出的服務需求。狀態：待聯繫 → 已聯繫 → 已報價 → 已成案（產生個案）／未成案。
- **護理師 Nurse**：有**技術標籤**（機構考核授予）。檔案 NurseProfile 含證照、可服務時段、費率、僱傭型態。
- **班次 Shift**：派單與打卡的最小單位，預設 12 小時。狀態：待派 → 已派（30 分鐘回覆期限）→ 已接 → 服務中（打卡觸發）→ 已完成。
- **量測 Observation**：單一寬表；`value.main` 為主數值。生命徵象、輸出入量、氧療皆在此。
- **警報 Alert**：由三層引擎產生，生命週期 觸發 → 認領 → 處置 → 結案。
- **交班 Handoff**：ISBAR 結構。狀態：草稿 → 送出 → 簽收（勾稽區四項全勾）→ 歸檔；接班者可提出疑義退回草稿。
- **衛教單元 EduUnit**：`content` 是唯一事實來源；`media` 只放資產編號。
- **評價 Review**：客戶對護理師，1–5 星＋標籤。**客訴 Complaint**：待處理 → 調查中 → 已結案。

## 三層警報引擎

- **A 層 絕對臨界值**：預設對齊 NEWS2 切點；護理長可依醫囑逐個案覆寫，覆寫須留人／時／理由。質性紅旗（咖啡渣樣嘔吐物、管路自拔、跌倒撞頭…）直通紅色。
- **B 層 早期預警 NEWS2**：自動計分，定位為跨個案排序指標。慢性穩定個案可停用警報、保留計分。COPD 用 SpO2 Scale 2。
- **C 層 個人基準線**：近 7 日移動平均 ±σ（σ 有上下限），滿 10 筆啟用。**永不發紅色。**

## 不變量（違反即 bug）

1. C 層永不產生紅色警報。
2. 技術標籤是派單硬條件：個案需求 ⊆ 護理師標籤，否則不可指派（`shifts.assignBlockers`）。
3. 同一護理師同一日不得連值日夜班（勞基法工時；示範資料亦不得違反）。實作為與其他班次間隔 ≥ 11 小時（ADR-002），同時擋下時段重疊（`shifts.assignBlockers`）。
4. 未審核的衛教單元不得對外推送。
5. 內外分離：客戶端不出現內部處置細節、交班備註、NEWS2 分數。
6. 紀錄 append-only：更正以新版本表達，不覆蓋。
7. AVPU 衡量清醒度而非認知：失智個案的意識評估通常仍為 A。
8. 所有介面用語遵守醫材紅線：說「紀錄、提醒、彙整」，不說「診斷、偵測疾病、醫療級」。
9. 人員端只看自己的班次與個案；公司端看全局。

## 模組地圖（`app/src/modules/*`）

每個模組只暴露 `index.ts`；頁面不得直接寫入 Dexie 表，一律經模組介面（讀取可用 `useLiveQuery`）。

| 模組 | 負責 | 主要介面 |
|---|---|---|
| `shifts` | 派單狀態機與硬條件、打卡、出勤審核、工時 | `createShift` `assignBlockers` `assign` `recall` `respond` `clockIn` `clockOut` `review` `hoursOf` `isAnomaly` |
| `alerts` | 警報生命週期與統計、質性紅旗 | `raiseRedFlag` `claim` `close` `noteHandled` `layerLabel` `responseStats` |
| `care` | 床邊照護紀錄：量測（寫入即三層判定）、輸出入量、事件、給藥、傷口 | `recordVitals` `recordIo` `logEvent` `logMed` `addWound` `assessWound` |
| `handoffs` | ISBAR 交班狀態機與簽收勾稽 | `submit` `receive` `dispute` `CHECK_ITEMS` |
| `cases` | 個案建檔與狀態機 | `create` `advance` `NEXT_STATUS` |
| `customers` | 需求單、評價、客訴 | `submitRequest` `advanceRequest` `convertToCase` `addReview` `ratingOf` `openComplaint` `resolveComplaint` |
| `staff` | 護理師檔案、時段、收入、績效 | `toggleAvailability` `incomeOf` `performanceOf` |
| `sos` | 緊急求助事件 | `trigger` `resolveLatest` |
| `edu` | 衛教推送紀錄與送出把關 | `recordPush` `canSend` |
| `documents` | 電子簽章雜湊存證 | `sign` |
| `sync` | 離線同步佇列：床邊紀錄寫入時同交易排入，依序送出、退避重試 | `enqueue` `flush` `startAutoSync` `postgrestTransport` |

判定引擎（`lib/alert-engine.ts`、`lib/news2.ts`）為純函式，不碰資料庫，維持現狀。

## 示範資料原則

- 定義類資料每次啟動 upsert；歷史依日曆日決定性生成，每天自動補天。
- 今日資料補到「稍早時段」，留最近一格可實際操作。
- 狀態機資料（需求單、客訴）只補不覆蓋，保留使用者操作。
