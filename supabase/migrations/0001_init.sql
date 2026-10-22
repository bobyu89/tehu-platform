-- ============================================================
-- 特護平台 初始 schema（S1）
-- 依規劃書 05 冊資料模型。所有資料表 day-one 帶 org_id（ADR-004）。
-- 適用：Supabase (Postgres 15+)。以 supabase db push 或 SQL Editor 執行。
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type user_role as enum ('owner','supervisor','nurse');
create type employment_type as enum ('employee','contractor'); -- 僱傭/承攬
create type case_status as enum ('inquiry','assessing','quoted','active','paused','closed');
create type shift_status as enum ('unassigned','offered','accepted','in_progress','completed','verified','settled');
create type alert_level as enum ('yellow','red');
create type alert_status as enum ('triggered','claimed','handled','closed');
create type obs_source as enum ('manual','ble_device','device_api');
create type rule_scope as enum ('system_default','org_default','case_override');

-- ---------- 租戶與人員 ----------
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- profiles.id 對應 auth.users.id
create table profiles (
  id uuid primary key,
  org_id uuid not null references orgs(id),
  role user_role not null default 'nurse',
  full_name text not null,
  phone text,
  line_user_id text,             -- LINE 綁定
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table nurse_profiles (
  profile_id uuid primary key references profiles(id),
  org_id uuid not null references orgs(id),
  license_no text,               -- 護理師證書字號
  employment employment_type not null default 'employee',
  skill_tags text[] not null default '{}',  -- 技術標籤：氣切/呼吸器/管灌/傷口…（派單硬條件）
  notes text
);

-- ---------- 個案結構：client → case → service_order → shift ----------
create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  name text not null,
  birth_year int,
  sex text,
  national_id_enc text,          -- 應用層加密（pgsodium），不存明文
  diagnosis text,
  allergies text,
  adl_level text,
  created_at timestamptz not null default now()
);

create table family_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  client_id uuid not null references clients(id),
  name text not null,
  relation text,
  phone text,
  line_user_id text,
  is_primary boolean not null default false  -- 主要決策者
);

create table service_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  label text not null,           -- 例：台大醫院 7F / 個案自宅
  address text,
  lat double precision,
  lng double precision,
  geofence_radius_m int not null default 150  -- 醫院建議 300
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  client_id uuid not null references clients(id),
  location_id uuid references service_locations(id),
  status case_status not null default 'inquiry',
  care_needs text[] not null default '{}',   -- 需求技術標籤（⊆ 護理師 skill_tags 才可派）
  summary text,
  closed_reason text,
  created_at timestamptz not null default now()
);

create table service_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  starts_on date not null,
  ends_on date,
  plan_name text,                -- 收費方案
  rate_note text,
  created_at timestamptz not null default now()
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  service_order_id uuid not null references service_orders(id),
  case_id uuid not null references cases(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,  -- 預設 12 小時制（ADR-002）
  status shift_status not null default 'unassigned',
  is_24h_flagged boolean not null default false, -- 24hr 班標記「需法務確認」
  created_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  shift_id uuid not null references shifts(id),
  nurse_id uuid not null references profiles(id),
  offered_at timestamptz not null default now(),
  respond_by timestamptz,        -- 30 分鐘回覆期限
  responded_at timestamptz,
  response text,                 -- accepted / declined / expired
  unique (shift_id, nurse_id, offered_at)
);

-- ---------- 照護計畫與醫囑 ----------
create table care_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  vitals_schedule text,          -- 例 'Q4H'
  glucose_schedule text,         -- 例 'TID AC'
  reposition_interval_min int default 120,  -- 翻身 Q2H
  tube_feeding_schedule text,
  note text,
  effective_from date not null default current_date
);

create table med_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  drug_name text not null,
  dose text, route text, frequency text,
  source_note text,              -- 依醫囑/藥袋照片
  photo_path text,
  is_active boolean not null default true
);

create table med_administrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  med_order_id uuid not null references med_orders(id),
  shift_id uuid references shifts(id),
  nurse_id uuid references profiles(id),
  due_at timestamptz,
  given_at timestamptz,
  withheld_reason text,          -- 拒服/禁食/嘔吐/其他（未給必填）
  recorded_at timestamptz not null default now()
);

-- ---------- 量測與事件 ----------
-- observations 單一寬表：所有數值量測（生命徵象/I-O/氧療）走同一條路（05 冊決策）
create table observations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  shift_id uuid references shifts(id),
  nurse_id uuid references profiles(id),
  type text not null,            -- 'bt'|'hr'|'rr'|'bp'|'spo2'|'glucose'|'pain'|'consciousness'
                                 -- |'intake_oral'|'intake_tube'|'intake_iv'
                                 -- |'output_urine'|'output_stool'|'output_vomit'|'output_drain'|'output_suction'|'o2'
  category text not null,        -- 'vital'|'io_in'|'io_out'|'o2'
  value jsonb not null,          -- 彈性欄位（sbp/dbp/部位/性狀…）
  numeric_main numeric generated always as ((value->>'main')::numeric) stored, -- 熱欄位
  measured_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source obs_source not null default 'manual',
  device_id text,
  superseded_by uuid references observations(id),  -- append-only 更正鏈
  created_at timestamptz not null default now()
);
create index idx_obs_case_type_time on observations (case_id, type, measured_at desc);
create index idx_obs_org_time on observations (org_id, measured_at desc);

create table care_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  shift_id uuid references shifts(id),
  nurse_id uuid references profiles(id),
  type text not null,            -- 'reposition'|'suction'|'vomit'|'fall'|'tube_event'|'behavior'|'other'
  detail jsonb not null default '{}',
  photo_paths text[] not null default '{}',
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  superseded_by uuid references care_events(id)
);
create index idx_events_case_time on care_events (case_id, occurred_at desc);

create table tubes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  kind text not null,            -- 'NG'|'foley'|'trach'|'PEG'|'drain'…
  inserted_on date,
  replace_due_on date,
  removed_on date,
  note text
);

create table tube_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  tube_id uuid not null references tubes(id),
  shift_id uuid references shifts(id),
  nurse_id uuid references profiles(id),
  secure_ok boolean, patent_ok boolean, skin_ok boolean,
  note text,
  checked_at timestamptz not null default now()
);

create table wounds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  body_site text not null,       -- 人形圖座標/部位代碼
  kind text,                     -- 壓傷/手術傷口/其他
  identified_on date not null default current_date,
  healed_on date
);

create table wound_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  wound_id uuid not null references wounds(id),
  shift_id uuid references shifts(id),
  nurse_id uuid references profiles(id),
  stage text,                    -- 1-4期/深部組織損傷/無法分期
  description text,
  photo_paths text[] not null default '{}',
  assessed_at timestamptz not null default now()
);

-- ---------- 警報（規則版本化：02 冊） ----------
create table alert_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id),          -- system_default 為 null
  case_id uuid references cases(id),        -- case_override 才有值
  scope rule_scope not null,
  obs_type text not null,                   -- 對應 observations.type
  red_low numeric, yellow_low numeric, yellow_high numeric, red_high numeric,
  params jsonb not null default '{}',       -- 例 BP 用 {"field":"sbp"}；C 層 σ 上下限
  version int not null default 1,
  is_active boolean not null default true,
  changed_by uuid references profiles(id),
  change_reason text,                       -- 個案覆寫必填（由應用層強制）
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_rules_lookup on alert_rules (obs_type, scope, is_active);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  observation_id uuid references observations(id),
  care_event_id uuid references care_events(id),
  rule_id uuid references alert_rules(id),  -- 觸發當下規則版本（責任釐清）
  layer text not null,                      -- 'A'|'B'|'C'|'qualitative'
  level alert_level not null,               -- C 層永不為 red（ADR-003，應用層與 check 雙保險）
  status alert_status not null default 'triggered',
  summary text not null,
  triggered_at timestamptz not null default now(),
  claimed_by uuid references profiles(id),
  claimed_at timestamptz,
  handled_note text,                        -- 已觀察/已聯絡家屬/已聯絡醫師/已送醫/119
  closed_at timestamptz,
  constraint c_layer_never_red check (not (layer = 'C' and level = 'red'))
);
create index idx_alerts_org_status on alerts (org_id, status, triggered_at desc);

create table alert_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  alert_id uuid not null references alerts(id),
  channel text not null,          -- 'line'|'sms'|'voice'|'push'
  target text not null,           -- 收訊者識別
  attempted_at timestamptz not null default now(),
  delivered boolean,
  detail jsonb not null default '{}'
);

-- ---------- 交班 ----------
create table handoffs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  shift_id uuid not null references shifts(id),
  from_nurse uuid not null references profiles(id),
  to_nurse uuid references profiles(id),
  isbar jsonb not null default '{}',        -- S/A評估文字/R待辦/勾稽區
  auto_digest jsonb not null default '{}',  -- 系統彙整：VS範圍/IO總帳/警報/達成率
  ai_summary_draft text,                    -- AI 原稿
  ai_summary_final text,                    -- 人工修訂後（差異留存供品質迭代）
  status text not null default 'draft',     -- draft|submitted|received|archived
  submitted_at timestamptz,
  received_at timestamptz,
  dispute_note text
);

-- ---------- 出勤／值班／SOS ----------
create table attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  shift_id uuid not null references shifts(id),
  nurse_id uuid not null references profiles(id),
  kind text not null,             -- 'in'|'out'
  server_time timestamptz not null default now(),  -- 伺服器校時為準
  device_time timestamptz,
  lat double precision, lng double precision, accuracy_m double precision,
  device_fingerprint text,
  out_of_fence boolean not null default false,     -- 圈外不硬擋，標記進審核流
  offline_synced boolean not null default false,
  review_status text,             -- null|pending|approved|rejected
  reviewed_by uuid references profiles(id)
);
-- 出勤紀錄保存 5 年（勞基法§30）：僅由保留政策批次銷毀，禁止其他刪除

create table oncall_roster (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  on_date date not null,
  slot text not null,             -- 'day'|'night'
  profile_id uuid not null references profiles(id),
  priority int not null default 1, -- 語音輪撥順序
  unique (org_id, on_date, slot, priority)
);

create table sos_incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  nurse_id uuid not null references profiles(id),
  case_id uuid references cases(id),
  kind text,                      -- 'patient_emergency'|'violence'|'environment'|'other'
  silent boolean not null default false,
  triggered_at timestamptz not null default now(),
  claimed_by uuid references profiles(id),
  claimed_at timestamptz,
  resolved_at timestamptz,
  timeline jsonb not null default '[]',   -- 位置回報與處理時間軸
  report_id uuid
);

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  sos_id uuid references sos_incidents(id),
  case_id uuid references cases(id),
  author uuid not null references profiles(id),
  body jsonb not null default '{}',       -- 經過/傷害/報警/後續（24hr 內補交）
  status text not null default 'draft',   -- draft|submitted|closed
  created_at timestamptz not null default now()
);

-- ---------- 文件簽署（Phase 2 先建骨架）與衛教資產 ----------
create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  kind text not null,             -- 服務契約/個資同意/照護同意…
  template_version text,
  case_id uuid references cases(id),
  pdf_path text,
  sha256 text,
  created_at timestamptz not null default now()
);

create table signatures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  document_id uuid not null references documents(id),
  signer_kind text not null,      -- family|client|staff
  signer_name text not null,
  auth_method text,               -- otp|account
  signed_at timestamptz not null default now(),
  ip inet, device_info text,
  consent_electronic boolean not null default false  -- 「同意以電子方式簽署」前置勾選
);

create table edu_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  asset_code text not null unique, -- 例 NG-003-VIDEO（ADR-005：模型只引用 ID）
  kind text not null,              -- card|video|audio_zh|audio_tw
  title text not null,
  storage_path text not null,
  license_note text not null,      -- 授權來源追蹤（法遵要求）
  approved_by uuid references profiles(id),
  approved_at timestamptz
);

-- ---------- 稽核（append-only；讀取敏感資料也留痕） ----------
create table audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor uuid,
  action text not null,           -- insert|update|correct|status_change…
  table_name text not null,
  row_id text,
  before jsonb, after jsonb,
  at timestamptz not null default now()
);

create table access_logs (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor uuid,
  resource text not null,         -- 例 'case:xxx' 'observations:case:xxx'
  action text not null default 'read',
  at timestamptz not null default now()
);

-- ---------- append-only 強制 ----------
-- 通用：禁止 UPDATE/DELETE（logs、通知）
create or replace function forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only table: % 不允許 % ', tg_table_name, tg_op;
end $$;

create trigger t_audit_ro  before update or delete on audit_logs  for each row execute function forbid_mutation();
create trigger t_access_ro before update or delete on access_logs for each row execute function forbid_mutation();
create trigger t_notif_ro  before update or delete on alert_notifications for each row execute function forbid_mutation();

-- observations / care_events：僅允許「單純標記 superseded_by」的 UPDATE（更正鏈），其他一律拒絕
create or replace function allow_supersede_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'append-only table: % 不允許 DELETE', tg_table_name;
  end if;
  if old.superseded_by is not null then
    raise exception '此紀錄已被更正版本取代，不可再修改';
  end if;
  if new.superseded_by is null
     or to_jsonb(new) - 'superseded_by' <> to_jsonb(old) - 'superseded_by' then
    raise exception 'append-only table: 僅允許設定 superseded_by（更正請新增新版本）';
  end if;
  return new;
end $$;

create trigger t_obs_supersede    before update or delete on observations for each row execute function allow_supersede_only();
create trigger t_events_supersede before update or delete on care_events  for each row execute function allow_supersede_only();

-- ---------- RLS ----------
-- 原則（05 冊）：org 隔離 ＋「指派關係決定可見範圍」。
-- Edge Functions 以 service role 執行（繞過 RLS，內部自行檢核）。
-- 注意：以下為 S1 骨架；上線前依 05 冊權限矩陣補完並加自動化測試（跨 org 必拒）。

create or replace function current_org() returns uuid
language sql stable as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function current_role_in_org() returns user_role
language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

-- 是否為（現在或近期）被指派此個案的護理師：結案/退派 30 天後轉不可見
create or replace function is_assigned_nurse(p_case uuid) returns boolean
language sql stable as $$
  select exists (
    select 1
    from assignments a
    join shifts s on s.id = a.shift_id
    where s.case_id = p_case
      and a.nurse_id = auth.uid()
      and a.response = 'accepted'
      and s.ends_at > now() - interval '30 days'
  )
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'orgs','profiles','nurse_profiles','clients','family_contacts','service_locations',
    'cases','service_orders','shifts','assignments','care_plans','med_orders','med_administrations',
    'observations','care_events','tubes','tube_checks','wounds','wound_assessments',
    'alert_rules','alerts','alert_notifications','handoffs','attendance','oncall_roster',
    'sos_incidents','incident_reports','documents','signatures','edu_assets','audit_logs','access_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- org 隔離（管理職全讀；orgs 表本身：只能看自己的 org）
create policy p_orgs_read on orgs for select using (id = current_org());
create policy p_profiles_org on profiles for select using (org_id = current_org());

-- 代表性 policy：observations（其餘表於權限矩陣落地時比照補完）
create policy p_obs_nurse_rw on observations
  for select using (org_id = current_org()
                    and (current_role_in_org() in ('owner','supervisor') or is_assigned_nurse(case_id)));
create policy p_obs_nurse_ins on observations
  for insert with check (org_id = current_org() and is_assigned_nurse(case_id) and nurse_id = auth.uid());

create policy p_alerts_org_read on alerts
  for select using (org_id = current_org()
                    and (current_role_in_org() in ('owner','supervisor') or is_assigned_nurse(case_id)));

-- ---------- A 層系統預設警報規則（02 冊表，種子資料） ----------
insert into alert_rules (scope, obs_type, red_low, yellow_low, yellow_high, red_high, params) values
  ('system_default','bp',      90, 100, 180, 200, '{"field":"sbp"}'),
  ('system_default','hr',      40,  50, 110, 130, '{}'),
  ('system_default','rr',       8,  11,  21,  25, '{}'),
  ('system_default','spo2',  null,null,null,null, '{"yellow_low":94,"red_low":91,"low_only":true}'),
  ('system_default','bt',      35, 35.5, 38, 39.5, '{}'),
  ('system_default','glucose', 54,  70, 250, 400, '{}'),
  ('system_default','urine_shift', null, 240, null, null, '{"per":"8h","red_rule":"12h_anuria"}');
-- SpO2 以 params 表達單向規則；意識(AVPU 下降)與質性紅旗由應用層/引擎判定（qualitative layer）。
