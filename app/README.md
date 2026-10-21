# 特護平台 app

Next.js 16 靜態輸出的離線示範原型。資料全部存在瀏覽器 IndexedDB（Dexie），尚未連接後端。

## 快速開始

需求：Node.js 24。

```bash
npm ci
npm run dev        # http://localhost:3000
```

Windows 可雙擊專案根目錄的 `啟動特護平台.cmd`。

## 送出前檢查

目前沒有自動化測試，請手動執行：

```bash
npx tsc --noEmit   # 型別檢查
npm run lint       # ESLint
npm run build      # 靜態輸出到 out/
```

## 必讀

| 文件 | 內容 |
|---|---|
| [`../CONTEXT.md`](../CONTEXT.md) | 名詞、不變量、模組地圖——命名以此為準 |
| [`../10-技術文件-現況實作.md`](../10-技術文件-現況實作.md) | 技術棧、路由、資料層、引擎參數、部署、待辦 |
| [`AGENTS.md`](AGENTS.md) | 此版 Next.js 有破壞性變更，寫程式前先查 `node_modules/next/dist/docs/` |

## 開發規則摘要

- 寫入資料一律經 `src/modules/*`，頁面不直接操作 Dexie 表。
- `src/lib/alert-engine.ts`、`src/lib/news2.ts` 為純函式，不碰資料庫。
- 修改 Dexie schema 要在 `src/lib/db.ts` 新增 `version(n)`，不要改舊版本。
- 部署：push 到 `master` 會觸發 GitHub Pages workflow。
