-- CI 用：在純 Postgres 上模擬 Supabase 的 auth.uid()，讓 migrations 能直接套用。
-- 不屬於正式 migration；Supabase 環境已內建 auth schema。
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
