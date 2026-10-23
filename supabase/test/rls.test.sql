-- ============================================================
-- RLS 權限矩陣測試（05 冊 §7、§8 驗收要點；0003_rls_policies.sql）
-- 執行：先套 auth_stub.sql 與全部 migrations，再以 psql -v ON_ERROR_STOP=1 執行本檔。
-- 任一斷言失敗即中止，訊息以「FAIL」開頭。
-- 以 superuser 建測試資料，再用 set role authenticated＋test.uid 模擬各身分（同 Supabase）。
-- ============================================================

-- ---------- Supabase 預設給 authenticated 的權限（RLS 在其上再過濾） ----------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

-- ---------- 斷言工具 ----------
create schema t;
grant usage on schema t to authenticated;

create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- 應被權限拒絕（RLS 的 WITH CHECK 或欄位 guard，SQLSTATE 42501）
create function t.denied(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when insufficient_privilege then
    raise notice 'ok - %', msg; return;
  end;
  raise exception 'FAIL（未被拒絕）: %', msg;
end $$;

-- 應失敗（任何錯誤；用於 append-only trigger）
create function t.fails(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok - %（%）', msg, sqlerrm; return;
  end;
  raise exception 'FAIL（未失敗）: %', msg;
end $$;

-- 執行並回傳影響列數（RLS 的 USING 不符時 UPDATE／DELETE 靜默影響 0 列）
create function t.rows(sql text) returns int language plpgsql as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema t to authenticated;

-- ---------- 測試資料 ----------
-- 機構 A：owner a1、督導 a2、護理師甲 a3（值班中）、護理師乙 a4（只有待回覆派單）
-- 機構 B：owner b1、護理師丙 b3
insert into orgs (id, name) values
  ('00000000-0000-0000-0000-0000000000aa', '機構A'),
  ('00000000-0000-0000-0000-0000000000bb', '機構B');

insert into profiles (id, org_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'owner',      'A-owner'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'supervisor', 'A-督導'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'nurse',      'A-護理師甲'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000aa', 'nurse',      'A-護理師乙'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000bb', 'owner',      'B-owner'),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000bb', 'nurse',      'B-護理師丙');

insert into nurse_profiles (profile_id, org_id, skill_tags, hourly_rate) values
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', '{管灌}', 450),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000aa', '{管灌}', 450),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000bb', '{抽痰}', 500);

insert into clients (id, org_id, name) values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', '個案一'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', '個案二'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000bb', '個案三');

insert into cases (id, org_id, client_id, status) values
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'c0000000-0000-0000-0000-000000000001', 'active'),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'c0000000-0000-0000-0000-000000000002', 'active'),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000bb', 'c0000000-0000-0000-0000-000000000003', 'active');

insert into service_orders (id, org_id, case_id, starts_on) values
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', current_date - 7),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000002', current_date - 7),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000bb', 'd0000000-0000-0000-0000-000000000003', current_date - 7);

-- s1：個案一，現在值班中（甲）；s2：個案二，3 天前已結束（甲）；s3：個案一明天（派給乙待回覆）；s4：機構 B（丙值班中）
insert into shifts (id, org_id, service_order_id, case_id, starts_at, ends_at, status) values
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', now() - interval '2 hours', now() + interval '10 hours', 'in_progress'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', now() - interval '3 days 12 hours', now() - interval '3 days', 'completed'),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 12 hours', 'offered'),
  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000bb', 'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', now() - interval '2 hours', now() + interval '10 hours', 'in_progress');

insert into assignments (id, org_id, shift_id, nurse_id, response) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'accepted'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'accepted'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', null),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000bb', 'f0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'accepted');

insert into observations (id, org_id, case_id, nurse_id, type, category, value, measured_at) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'hr', 'vital', '{"main": 80}', now() - interval '1 hour'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'hr', 'vital', '{"main": 82}', now() - interval '3 days 6 hours'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000bb', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'hr', 'vital', '{"main": 90}', now() - interval '1 hour');

insert into alerts (id, org_id, case_id, layer, level, summary) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'A', 'yellow', '脈搏 112'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000bb', 'd0000000-0000-0000-0000-000000000003', 'A', 'red', 'SpO2 89');

insert into handoffs (id, org_id, case_id, shift_id, from_nurse, to_nurse, status, isbar) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'submitted', '{"S": "穩定"}');

insert into customers (org_id, name) values ('00000000-0000-0000-0000-0000000000aa', '家屬');
insert into complaints (org_id, customer_name, category, detail) values ('00000000-0000-0000-0000-0000000000aa', '家屬', '溝通', '…');
insert into service_requests (org_id, customer_name, phone, setting) values ('00000000-0000-0000-0000-0000000000aa', '家屬', '09', 'home');
insert into reviews (org_id, case_id, nurse_id, customer_name, rating) values
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', '家屬', 5),
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', '家屬', 4);
insert into audit_logs (org_id, actor, action, table_name) values ('00000000-0000-0000-0000-0000000000aa', null, 'insert', 'cases');

-- ============================================================
-- 0. 結構檢查：每張表都啟用 RLS 且至少有一條 policy（否則等於全面拒絕或全面開放）
-- ============================================================
select t.ok(not exists (
  select 1 from pg_tables where schemaname = 'public'
    and (not (select relrowsecurity from pg_class where oid = ('public.' || quote_ident(tablename))::regclass)
         or not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = pg_tables.tablename))
), '每張 public 資料表都啟用 RLS 且有 policy');

-- ============================================================
-- 1. 護理師甲（機構 A，值班中個案一；個案二 3 天前結束）
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', false);
set role authenticated;

select t.ok((select count(*) from profiles) = 4, '甲：查 profiles 不再無限遞迴，只看到本機構 4 人');
select t.ok((select count(*) from cases) = 2, '甲：看得到被指派的個案一、二（結束未滿 30 天）');
select t.ok(not exists (select 1 from cases where org_id = '00000000-0000-0000-0000-0000000000bb'), '甲：看不到機構 B 的個案');
select t.ok((select count(*) from observations) = 2, '甲：只看到個案一、二的量測');
select t.ok((select count(*) from clients) = 2, '甲：只看到被指派個案的病人資料');
select t.ok((select count(*) from service_orders) = 0, '甲：看不到服務單計價');
select t.ok((select count(*) from complaints) + (select count(*) from customers) + (select count(*) from service_requests) = 0,
  '甲：看不到客訴、客戶、需求單');
select t.ok((select count(*) from reviews) = 1, '甲：只看到自己的評價');
select t.ok((select count(*) from audit_logs) = 0, '甲：看不到稽核紀錄');
select t.ok((select count(*) from alerts) = 1, '甲：只看到個案一的警報');

insert into observations (org_id, case_id, nurse_id, type, category, value, measured_at) values
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'bt', 'vital', '{"main": 36.8}', now());
select t.ok(true, '甲：值班中可寫入個案一的量測');

select t.denied($$insert into observations (org_id, case_id, nurse_id, type, category, value, measured_at) values
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'bt', 'vital', '{"main": 36.8}', now())$$,
  '甲：服務期間外不可寫入個案二（只能讀）');
select t.denied($$insert into observations (org_id, case_id, nurse_id, type, category, value, measured_at) values
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'bt', 'vital', '{"main": 36.8}', now())$$,
  '甲：不可冒用他人名義寫紀錄');
select t.denied($$insert into observations (org_id, case_id, nurse_id, type, category, value, measured_at) values
  ('00000000-0000-0000-0000-0000000000bb', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'bt', 'vital', '{"main": 36.8}', now())$$,
  '甲：不可寫入機構 B');
select t.fails($$update observations set value = '{"main": 60}' where id = '20000000-0000-0000-0000-000000000001'$$,
  '甲：量測 append-only，不可改值');
select t.ok(t.rows($$delete from observations where id = '20000000-0000-0000-0000-000000000001'$$) = 0, '甲：不可刪除量測');

select t.ok(t.rows($$update nurse_profiles set availability = '{"mon": ["day"]}' where profile_id = 'a0000000-0000-0000-0000-000000000003'$$) = 1,
  '甲：可改自己的可上班時段');
select t.denied($$update nurse_profiles set skill_tags = '{管灌,呼吸器}' where profile_id = 'a0000000-0000-0000-0000-000000000003'$$,
  '甲：不可自行加技術標籤（機構考核授予）');
select t.denied($$update nurse_profiles set hourly_rate = 9999 where profile_id = 'a0000000-0000-0000-0000-000000000003'$$,
  '甲：不可自行調時薪');
select t.ok(t.rows($$update profiles set role = 'owner' where id = 'a0000000-0000-0000-0000-000000000003'$$) = 0,
  '甲：不可把自己提升為 owner');

select t.ok(t.rows($$update alerts set handled_note = '已觀察，複測 98' where id = '30000000-0000-0000-0000-000000000001'$$) = 1,
  '甲：值班中可回報警報現場處置');
select t.denied($$update alerts set status = 'closed' where id = '30000000-0000-0000-0000-000000000001'$$,
  '甲：不可自行結案警報（管理職主責）');
select t.denied($$insert into alert_rules (org_id, scope, obs_type, red_low) values ('00000000-0000-0000-0000-0000000000aa', 'org_default', 'hr', 30)$$,
  '甲：不可改機構預設警報規則');
select t.ok((select count(*) from alert_rules where scope = 'system_default') > 0, '甲：看得到系統預設警報規則');

insert into handoffs (org_id, case_id, shift_id, from_nurse, status) values
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'draft');
select t.ok(true, '甲：值班中可建立交班');

reset role;

-- ============================================================
-- 2. 護理師乙（機構 A，只有個案一明天的待回覆派單；交班 h1 的接班者）
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000004', false);
set role authenticated;

select t.ok((select count(*) from cases) = 0, '乙：未接受派單前看不到個案');
select t.ok((select count(*) from observations) = 0, '乙：看不到非指派個案的量測');
select t.ok((select count(*) from shifts) = 1, '乙：看得到派給自己的班（才能接拒單）');
select t.denied($$insert into observations (org_id, case_id, nurse_id, type, category, value, measured_at) values
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'bt', 'vital', '{"main": 36.8}', now())$$,
  '乙：非指派個案不可寫入');

select t.denied($$update assignments set shift_id = 'f0000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000003'$$,
  '乙：不可把派單改到別的班次');
select t.ok(t.rows($$update assignments set response = 'accepted', responded_at = now() where id = '10000000-0000-0000-0000-000000000003'$$) = 1,
  '乙：可接受派給自己的單');
select t.ok((select count(*) from cases) = 1, '乙：接單後看得到個案一');

select t.denied($$update handoffs set isbar = '{"S": "竄改"}' where id = '40000000-0000-0000-0000-000000000001'$$,
  '乙（接班者）：不可改交班內容');
select t.ok(t.rows($$update handoffs set status = 'received', received_at = now() where id = '40000000-0000-0000-0000-000000000001'$$) = 1,
  '乙（接班者）：可簽收');
select t.denied($$update handoffs set dispute_note = '補問' where id = '40000000-0000-0000-0000-000000000001'$$,
  '乙：簽收歸檔後不可修改');

reset role;

-- ============================================================
-- 3. 督導（機構 A）
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000002', false);
set role authenticated;

select t.ok((select count(*) from cases) = 2, '督導：看得到本機構全部個案');
select t.ok((select count(*) from observations) = 3, '督導：看得到本機構全部量測（含甲剛寫入的）');
select t.ok((select count(*) from complaints) = 1 and (select count(*) from service_requests) = 1, '督導：看得到客訴與需求單');
select t.ok((select count(*) from audit_logs) = 0, '督導：看不到稽核紀錄（owner 才可）');
select t.denied($$insert into observations (org_id, case_id, nurse_id, type, category, value, measured_at) values
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'bt', 'vital', '{"main": 36.8}', now())$$,
  '督導：照護紀錄只讀＋覆核，不代寫');
select t.denied($$insert into alert_rules (org_id, scope, obs_type, red_low) values ('00000000-0000-0000-0000-0000000000aa', 'org_default', 'hr', 30)$$,
  '督導：不可改機構預設警報規則（owner 才可）');
insert into alert_rules (org_id, case_id, scope, obs_type, red_low, change_reason) values
  ('00000000-0000-0000-0000-0000000000aa', 'd0000000-0000-0000-0000-000000000001', 'case_override', 'spo2', 85, 'COPD 依醫囑');
select t.ok(true, '督導：可建立個案警報覆寫');
select t.ok(t.rows($$update alerts set status = 'closed' where id = '30000000-0000-0000-0000-000000000001'$$) = 1, '督導：可結案警報');
select t.ok(t.rows($$update profiles set role = 'owner' where id = 'a0000000-0000-0000-0000-000000000002'$$) = 0, '督導：不可提升自己為 owner');

reset role;

-- ============================================================
-- 4. owner（機構 A）
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000001', false);
set role authenticated;

select t.ok((select count(*) from audit_logs) = 1, 'owner：看得到本機構稽核紀錄');
insert into alert_rules (org_id, scope, obs_type, red_low, change_reason) values
  ('00000000-0000-0000-0000-0000000000aa', 'org_default', 'hr', 35, '機構政策');
select t.ok(true, 'owner：可改機構預設警報規則');
select t.ok(t.rows($$update nurse_profiles set skill_tags = '{管灌,呼吸器}' where profile_id = 'a0000000-0000-0000-0000-000000000003'$$) = 1,
  'owner：可授予技術標籤');
select t.ok(t.rows($$delete from cases where id = 'd0000000-0000-0000-0000-000000000001'$$) = 0, 'owner：也不可刪除個案（紀錄保留）');

reset role;

-- ============================================================
-- 5. 跨機構：機構 B 的 owner 與護理師
-- ============================================================
select set_config('test.uid', 'b0000000-0000-0000-0000-000000000001', false);
set role authenticated;

select t.ok((select count(*) from cases) = 1 and (select count(*) from observations) = 1, 'B-owner：只看到機構 B 的個案與量測');
select t.ok((select count(*) from profiles) = 2, 'B-owner：只看到機構 B 的人員');
select t.ok((select count(*) from complaints) + (select count(*) from audit_logs) = 0, 'B-owner：看不到機構 A 的客訴與稽核');
select t.denied($$insert into cases (org_id, client_id) values ('00000000-0000-0000-0000-0000000000aa', 'c0000000-0000-0000-0000-000000000001')$$,
  'B-owner：不可在機構 A 建個案');
select t.ok(t.rows($$update cases set status = 'closed' where org_id = '00000000-0000-0000-0000-0000000000aa'$$) = 0,
  'B-owner：改不到機構 A 的個案');
select t.ok(t.rows($$update profiles set role = 'nurse' where org_id = '00000000-0000-0000-0000-0000000000aa'$$) = 0,
  'B-owner：改不到機構 A 的帳號');

reset role;

select set_config('test.uid', 'b0000000-0000-0000-0000-000000000003', false);
set role authenticated;
select t.ok((select count(*) from alerts) = 1 and (select count(*) from cases) = 1, 'B-護理師丙：只看到自己機構、被指派的個案與警報');
reset role;

-- ============================================================
-- 6. 未登入（anon）
-- ============================================================
select set_config('test.uid', '', false);
set role authenticated;
select t.ok((select count(*) from cases) + (select count(*) from profiles) + (select count(*) from observations) = 0,
  '未登入：什麼都看不到');
reset role;

\echo 'RLS 測試全部通過'
