-- ============================================================
-- 0002 前端型別與 SQL 對齊（10 技術文件 §10 待辦 4）
-- 補上原型已在使用、但 0001 沒有落點的資料：
--   客戶與需求單、評價、客訴（三端平台）；個案的照護場域與 NEWS2 個案設定；
--   護理師檔案延伸欄位與證照。
-- 原則同 0001：每張表帶 org_id（ADR-004）、啟用 RLS。
-- 本檔只啟用 RLS、不寫 policy：未授權的存取一律拒絕，policy 隨權限矩陣補齊（待辦 6）。
-- ============================================================

-- ---------- enums ----------
create type care_setting as enum ('home','hospital');                                  -- 居家／醫院
create type request_status as enum ('new','contacted','quoted','converted','declined'); -- 待聯繫→已聯繫→已報價→已成案／未成案
create type complaint_status as enum ('open','investigating','resolved');               -- 待處理→調查中→已結案

-- ---------- 個案：場域與 NEWS2 個案設定（02 冊 §2.2） ----------
alter table cases
  add column setting care_setting,
  add column news2_scale2 boolean not null default false,       -- COPD 等改用 SpO2 Scale 2
  add column news2_alerts_off boolean not null default false,   -- B 層停用警報、保留計分
  add column news2_alerts_off_reason text,                      -- 停用須督導權限＋理由
  add column news2_alerts_off_by uuid references profiles(id),
  add constraint c_news2_off_reason
    check (not news2_alerts_off or (news2_alerts_off_reason is not null and news2_alerts_off_by is not null));

-- ---------- 護理師檔案延伸（人員端「我的檔案」） ----------
alter table nurse_profiles
  add column years_exp int check (years_exp >= 0),
  add column service_areas text[] not null default '{}',        -- 可服務地區
  add column availability jsonb not null default '{}',          -- 週一..週日 → ['day','night']
  add column hourly_rate int check (hourly_rate >= 0),          -- 新台幣／小時
  add column bio text;

-- 證照（含專科／進階證照）；到期日供提醒
create table nurse_licenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  profile_id uuid not null references nurse_profiles(profile_id),
  name text not null,              -- 護理師證書／ACLS／居家護理訓練…
  license_no text,
  expires_on date,
  created_at timestamptz not null default now()
);
create index idx_licenses_expiry on nurse_licenses (org_id, expires_on);

-- ---------- 客戶（付費／決策的家屬），與個案分開；一位客戶可對應多個個案 ----------
-- family_contacts 保留為個案的聯絡人（緊急聯絡等），不一定是付費客戶。
create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  name text not null,
  relation text,                   -- 與個案關係
  phone text,
  line_user_id text,               -- 非 null 即已綁定 LINE
  note text,
  created_at timestamptz not null default now()
);

create table customer_cases (
  org_id uuid not null references orgs(id),
  customer_id uuid not null references customers(id),
  case_id uuid not null references cases(id),
  primary key (customer_id, case_id)
);

-- ---------- 服務需求單（客戶端線上提出） ----------
create table service_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  customer_id uuid references customers(id),   -- 既有客戶；新客戶成案時再建立
  customer_name text not null,
  phone text not null,
  relation text,
  setting care_setting not null,
  area text,
  needs text[] not null default '{}',          -- 技術需求標籤（成案後成為 cases.care_needs）
  start_date date,
  shift_pref text,                             -- 'day'|'night'|'full'
  note text,
  status request_status not null default 'new',
  case_id uuid references cases(id),           -- 成案後連結
  created_at timestamptz not null default now(),
  constraint c_converted_has_case check ((status = 'converted') = (case_id is not null))
);
create index idx_requests_org_status on service_requests (org_id, status, created_at desc);

-- ---------- 服務評價（客戶對護理師） ----------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id),
  nurse_id uuid not null references profiles(id),
  customer_id uuid references customers(id),
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  tags text[] not null default '{}',           -- 準時、細心、溝通清楚…
  comment text,
  created_at timestamptz not null default now()
);
create index idx_reviews_nurse on reviews (org_id, nurse_id, created_at desc);

-- ---------- 客訴 ----------
create table complaints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid references cases(id),
  nurse_id uuid references profiles(id),
  customer_id uuid references customers(id),
  customer_name text not null,
  category text not null,                      -- 服務態度／專業能力／準時／溝通／收費／其他
  detail text not null,
  status complaint_status not null default 'open',
  handled_by uuid references profiles(id),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint c_resolved_complete check (status <> 'resolved' or (resolution is not null and resolved_at is not null))
);
create index idx_complaints_org_status on complaints (org_id, status, created_at desc);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['nurse_licenses','customers','customer_cases','service_requests','reviews','complaints'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
