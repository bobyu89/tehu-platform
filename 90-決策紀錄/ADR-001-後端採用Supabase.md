# ADR-001：後端採用 Supabase（BaaS）而非自建

- 日期：2026-08-12｜狀態：採納

## 脈絡
1–2 人團隊＋AI 輔助開發，要在 12–16 週內交付含警報、離線同步、權限隔離的 MVP。健康資料屬特種個資，權限與稽核是硬需求。

## 決策
採用 Supabase（Postgres＋Auth＋RLS＋Realtime＋Storage＋Edge Functions），前端部署 Vercel，資料庫東京區。

## 理由
1. RLS 天然支撐「指派關係決定可見範圍」與多租戶隔離，不必自寫權限中介層
2. Auth／Storage／Realtime 內建，MVP 省下 4–6 週基礎建設
3. 底層是純 Postgres：schema、RLS policy、pg_cron 全部標準——**未來可自建遷出，無不可逆鎖定**
4. pg_cron＋Edge Functions 足以承載警報升級鏈，不需引入佇列服務

## 後果
- 跨境傳輸（東京區）須於隱私政策揭露；成長後評估遷至 GCP 台灣機房
- Edge Functions 冷啟動延遲需實測；警報通知鏈以 pg_cron 每分鐘掃描兜底
- 被推翻條件：若日活個案數＞數百且警報延遲不達標，重新評估自建
