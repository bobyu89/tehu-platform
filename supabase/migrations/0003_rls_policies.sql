-- ============================================================
-- 0003 RLS 權限矩陣（05 冊 §7；10 技術文件 §10 待辦 6）
--
-- 原則
-- 1. 每條 policy 都先檢查 org_id = current_org()：跨機構一律看不到、寫不進（ADR-004）。
-- 2. 管理職（owner、supervisor）看全機構；護理師的可見範圍由「指派關係」決定：
--    - 讀：接受指派、且班次結束未滿 30 天的個案（is_assigned_nurse）
--    - 寫照護紀錄：只在服務期間（is_on_duty：班次開始前 30 分鐘到結束後 2 小時，
--      寬限是為了離線同步與交班收尾）
-- 3. RLS 只能限制「哪幾列」，限制「哪些欄位」改用 trigger（guard_columns、handoff_guard），
--    例如護理師能改自己的可上班時段，但不能改自己的技術標籤或時薪。
-- 4. 不開放 DELETE：紀錄保留（勞基法出勤 5 年、病歷相關紀錄 append-only）。
-- 5. 警報判定、通知、LINE 綁定、電子簽章等由 Edge Function 以 service role 執行（繞過 RLS），
--    因此 alerts、alert_notifications、signatures、audit/access logs 不開放一般使用者寫入。
-- 6. 家屬（客戶）登入屬後期功能，本檔不建家屬 policy：家屬目前讀不到任何資料。
--
-- 同時修正 0001：current_org() 等輔助函式原為一般 SQL 函式，profiles 的 policy 呼叫
-- current_org()、current_org() 又查 profiles，造成無限遞迴（查 profiles 直接報錯）。
-- 改為 SECURITY DEFINER（Supabase 建議做法），並固定 search_path。
-- ============================================================

-- ---------- 輔助函式（SECURITY DEFINER，只回傳與呼叫者本人有關的判斷） ----------
create or replace function current_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid() and is_active
$$;

create or replace function current_role_in_org() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_in_org() in ('owner','supervisor'), false)
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_in_org() = 'owner', false)
$$;

-- 讀取範圍：接受指派、且班次結束未滿 30 天
create or replace function is_assigned_nurse(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a join shifts s on s.id = a.shift_id
    where s.case_id = p_case and a.nurse_id = auth.uid() and a.response = 'accepted'
      and s.ends_at > now() - interval '30 days'
  )
$$;

-- 寫入範圍：服務期間（班次開始前 30 分鐘到結束後 2 小時）
create or replace function is_on_duty(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a join shifts s on s.id = a.shift_id
    where s.case_id = p_case and a.nurse_id = auth.uid() and a.response = 'accepted'
      and now() between s.starts_at - interval '30 minutes' and s.ends_at + interval '2 hours'
  )
$$;

-- 護理師看得到的班次：派給自己的（含待回覆，才能接拒單）
create or replace function has_assignment(p_shift uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignments where shift_id = p_shift and nurse_id = auth.uid())
$$;

create or replace function has_accepted(p_shift uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignments where shift_id = p_shift and nurse_id = auth.uid() and response = 'accepted')
$$;

-- ---------- 欄位層級限制 ----------
-- 非管理職只能改 trigger 參數列出的欄位；service role（auth.uid() 為 null）不受限
create or replace function guard_columns() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null or is_manager() then return new; end if;
  if (to_jsonb(new) - tg_argv) <> (to_jsonb(old) - tg_argv) then
    raise exception '% 只能修改：%', tg_table_name, array_to_string(tg_argv, '、') using errcode = '42501';
  end if;
  return new;
end $$;

-- 交班：簽收歸檔後不可修改；接班者只能簽收或提出疑義；交班者不能改歸屬
create or replace function handoff_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if old.status in ('received','archived') then
    raise exception '交班已簽收歸檔，不可修改（補充請另附註）' using errcode = '42501';
  end if;
  if auth.uid() = old.to_nurse and auth.uid() is distinct from old.from_nurse then
    if (to_jsonb(new) - array['status','received_at','dispute_note'])
       <> (to_jsonb(old) - array['status','received_at','dispute_note']) then
      raise exception '接班者只能簽收或提出疑義' using errcode = '42501';
    end if;
  elsif new.org_id <> old.org_id or new.case_id <> old.case_id or new.shift_id <> old.shift_id
        or new.from_nurse <> old.from_nurse then
    raise exception '交班的機構、個案、班次、交班者不可變更' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger t_nurse_profiles_guard before update on nurse_profiles
  for each row execute function guard_columns('availability', 'bio', 'service_areas');
create trigger t_assignments_guard before update on assignments
  for each row execute function guard_columns('response', 'responded_at');
create trigger t_alerts_guard before update on alerts
  for each row execute function guard_columns('handled_note');
create trigger t_sos_guard before update on sos_incidents
  for each row execute function guard_columns('timeline');
create trigger t_handoff_guard before update on handoffs
  for each row execute function handoff_guard();

-- ---------- 移除 0001 中要換掉的 policy ----------
drop policy p_obs_nurse_ins on observations;   -- 原為「曾被指派」即可寫，改為服務期間才可寫

-- ---------- 機構與人員 ----------
create policy p_orgs_update on orgs for update
  using (id = current_org() and is_owner()) with check (id = current_org());

-- 帳號由 owner 管理；本人不得自改（避免自行提升 role）。LINE 綁定由 Edge Function 寫入。
create policy p_profiles_insert on profiles for insert
  with check (org_id = current_org() and is_owner());
create policy p_profiles_update on profiles for update
  using (org_id = current_org() and is_owner()) with check (org_id = current_org());

create policy p_nurse_profiles_select on nurse_profiles for select
  using (org_id = current_org() and (is_manager() or profile_id = auth.uid()));
create policy p_nurse_profiles_insert on nurse_profiles for insert
  with check (org_id = current_org() and is_manager());
create policy p_nurse_profiles_update on nurse_profiles for update
  using (org_id = current_org() and (is_manager() or profile_id = auth.uid()))
  with check (org_id = current_org());

create policy p_licenses_select on nurse_licenses for select
  using (org_id = current_org() and (is_manager() or profile_id = auth.uid()));
create policy p_licenses_insert on nurse_licenses for insert
  with check (org_id = current_org() and is_manager());
create policy p_licenses_update on nurse_licenses for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

-- ---------- 個案結構 ----------
create policy p_clients_select on clients for select
  using (org_id = current_org() and (is_manager()
    or exists (select 1 from cases c where c.client_id = clients.id and is_assigned_nurse(c.id))));
create policy p_clients_insert on clients for insert with check (org_id = current_org() and is_manager());
create policy p_clients_update on clients for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

create policy p_family_select on family_contacts for select
  using (org_id = current_org() and (is_manager()
    or exists (select 1 from cases c where c.client_id = family_contacts.client_id and is_assigned_nurse(c.id))));
create policy p_family_insert on family_contacts for insert with check (org_id = current_org() and is_manager());
create policy p_family_update on family_contacts for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

create policy p_locations_select on service_locations for select
  using (org_id = current_org() and (is_manager()
    or exists (select 1 from cases c where c.location_id = service_locations.id and is_assigned_nurse(c.id))));
create policy p_locations_insert on service_locations for insert with check (org_id = current_org() and is_manager());
create policy p_locations_update on service_locations for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

create policy p_cases_select on cases for select
  using (org_id = current_org() and (is_manager() or is_assigned_nurse(id)));
create policy p_cases_insert on cases for insert with check (org_id = current_org() and is_manager());
create policy p_cases_update on cases for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

-- 服務單含計價方案：只給管理職
create policy p_orders_select on service_orders for select using (org_id = current_org() and is_manager());
create policy p_orders_insert on service_orders for insert with check (org_id = current_org() and is_manager());
create policy p_orders_update on service_orders for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

-- 班次狀態轉換（打卡→服務中等）由伺服器端處理；護理師只讀派給自己的班
create policy p_shifts_select on shifts for select
  using (org_id = current_org() and (is_manager() or has_assignment(id)));
create policy p_shifts_insert on shifts for insert with check (org_id = current_org() and is_manager());
create policy p_shifts_update on shifts for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

-- 派單由管理職；護理師只能回覆自己的派單（欄位由 guard 限制）
create policy p_assign_select on assignments for select
  using (org_id = current_org() and (is_manager() or nurse_id = auth.uid()));
create policy p_assign_insert on assignments for insert with check (org_id = current_org() and is_manager());
create policy p_assign_update on assignments for update
  using (org_id = current_org() and (is_manager() or nurse_id = auth.uid()))
  with check (org_id = current_org() and (is_manager() or nurse_id = auth.uid()));

-- ---------- 照護計畫與醫囑（建檔屬管理職） ----------
create policy p_plans_select on care_plans for select
  using (org_id = current_org() and (is_manager() or is_assigned_nurse(case_id)));
create policy p_plans_insert on care_plans for insert with check (org_id = current_org() and is_manager());
create policy p_plans_update on care_plans for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

create policy p_med_orders_select on med_orders for select
  using (org_id = current_org() and (is_manager() or is_assigned_nurse(case_id)));
create policy p_med_orders_insert on med_orders for insert with check (org_id = current_org() and is_manager());
create policy p_med_orders_update on med_orders for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

-- ---------- 照護紀錄：管理職讀；被指派護理師服務期間寫（且只能以本人名義） ----------
create policy p_med_admin_select on med_administrations for select
  using (org_id = current_org() and (is_manager() or is_assigned_nurse(case_id)));
create policy p_med_admin_insert on med_administrations for insert
  with check (org_id = current_org() and nurse_id = auth.uid() and is_on_duty(case_id));

-- observations 的讀取沿用 0001 的 p_obs_nurse_rw
create policy p_obs_insert on observations for insert
  with check (org_id = current_org() and nurse_id = auth.uid() and is_on_duty(case_id));
-- 更正：只能對自己的紀錄設定 superseded_by（其餘欄位由 0001 trigger 禁止）
create policy p_obs_supersede on observations for update
  using (org_id = current_org() and nurse_id = auth.uid() and is_on_duty(case_id))
  with check (org_id = current_org() and nurse_id = auth.uid());

create policy p_events_select on care_events for select
  using (org_id = current_org() and (is_manager() or is_assigned_nurse(case_id)));
create policy p_events_insert on care_events for insert
  with check (org_id = current_org() and nurse_id = auth.uid() and is_on_duty(case_id));
create policy p_events_supersede on care_events for update
  using (org_id = current_org() and nurse_id = auth.uid() and is_on_duty(case_id))
  with check (org_id = current_org() and nurse_id = auth.uid());

create policy p_tubes_select on tubes for select
  using (org_id = current_org() and (is_manager() or is_assigned_nurse(case_id)));
create policy p_tubes_insert on tubes for insert
  with check (org_id = current_org() and (is_manager() or is_on_duty(case_id)));
create policy p_tubes_update on tubes for update
  using (org_id = current_org() and (is_manager() or is_on_duty(case_id))) with check (org_id = current_org());

create policy p_tube_checks_select on tube_checks for select
  using (org_id = current_org() and (is_manager()
    or exists (select 1 from tubes t where t.id = tube_checks.tube_id and is_assigned_nurse(t.case_id))));
create policy p_tube_checks_insert on tube_checks for insert
  with check (org_id = current_org() and nurse_id = auth.uid()
    and exists (select 1 from tubes t where t.id = tube_checks.tube_id and is_on_duty(t.case_id)));

create policy p_wounds_select on wounds for select
  using (org_id = current_org() and (is_manager() or is_assigned_nurse(case_id)));
create policy p_wounds_insert on wounds for insert
  with check (org_id = current_org() and (is_manager() or is_on_duty(case_id)));
create policy p_wounds_update on wounds for update
  using (org_id = current_org() and (is_manager() or is_on_duty(case_id))) with check (org_id = current_org());

create policy p_wound_assess_select on wound_assessments for select
  using (org_id = current_org() and (is_manager()
    or exists (select 1 from wounds w where w.id = wound_assessments.wound_id and is_assigned_nurse(w.case_id))));
create policy p_wound_assess_insert on wound_assessments for insert
  with check (org_id = current_org() and nurse_id = auth.uid()
    and exists (select 1 from wounds w where w.id = wound_assessments.wound_id and is_on_duty(w.case_id)));

-- ---------- 警報 ----------
-- 系統預設規則全體可讀、不可改；機構預設只有 owner 可改；個案覆寫由管理職
create policy p_rules_select on alert_rules for select
  using (scope = 'system_default'
    or (org_id = current_org() and (scope = 'org_default' or is_manager() or is_assigned_nurse(case_id))));
create policy p_rules_insert on alert_rules for insert
  with check (org_id = current_org()
    and ((scope = 'org_default' and is_owner()) or (scope = 'case_override' and is_manager())));
create policy p_rules_update on alert_rules for update
  using (org_id = current_org()
    and ((scope = 'org_default' and is_owner()) or (scope = 'case_override' and is_manager())))
  with check (org_id = current_org()
    and ((scope = 'org_default' and is_owner()) or (scope = 'case_override' and is_manager())));

-- 警報由伺服器判定寫入；讀取沿用 0001 的 p_alerts_org_read。
-- 管理職認領／處置／結案；護理師服務期間回報現場處置（只能改 handled_note）
create policy p_alerts_update on alerts for update
  using (org_id = current_org() and (is_manager() or is_on_duty(case_id)))
  with check (org_id = current_org());

create policy p_notif_select on alert_notifications for select using (org_id = current_org() and is_manager());

-- ---------- 交班：管理職讀（抽核）；交班者撰寫送出；接班者簽收 ----------
create policy p_handoffs_select on handoffs for select
  using (org_id = current_org() and (is_manager() or from_nurse = auth.uid() or to_nurse = auth.uid()
    or is_assigned_nurse(case_id)));
create policy p_handoffs_insert on handoffs for insert
  with check (org_id = current_org() and from_nurse = auth.uid() and is_on_duty(case_id));
create policy p_handoffs_update on handoffs for update
  using (org_id = current_org() and (from_nurse = auth.uid() or to_nurse = auth.uid()))
  with check (org_id = current_org());

-- ---------- 出勤、值班、SOS ----------
create policy p_attend_select on attendance for select
  using (org_id = current_org() and (is_manager() or nurse_id = auth.uid()));
create policy p_attend_insert on attendance for insert
  with check (org_id = current_org() and nurse_id = auth.uid() and has_accepted(shift_id));
create policy p_attend_update on attendance for update     -- 異常審核
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

create policy p_oncall_select on oncall_roster for select using (org_id = current_org());
create policy p_oncall_insert on oncall_roster for insert with check (org_id = current_org() and is_manager());
create policy p_oncall_update on oncall_roster for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

create policy p_sos_select on sos_incidents for select
  using (org_id = current_org() and (is_manager() or nurse_id = auth.uid()));
create policy p_sos_insert on sos_incidents for insert
  with check (org_id = current_org() and nurse_id = auth.uid());
create policy p_sos_update on sos_incidents for update      -- 管理職接收／結案；本人只能補位置時間軸
  using (org_id = current_org() and (is_manager() or nurse_id = auth.uid()))
  with check (org_id = current_org());

create policy p_incident_select on incident_reports for select
  using (org_id = current_org() and (is_manager() or author = auth.uid()));
create policy p_incident_insert on incident_reports for insert
  with check (org_id = current_org() and author = auth.uid());
create policy p_incident_update on incident_reports for update
  using (org_id = current_org() and (is_manager() or (author = auth.uid() and status = 'draft')))
  with check (org_id = current_org() and (is_manager() or author = auth.uid()));

-- ---------- 文件與衛教 ----------
create policy p_docs_select on documents for select
  using (org_id = current_org() and (is_manager() or is_assigned_nurse(case_id)));
create policy p_docs_insert on documents for insert with check (org_id = current_org() and is_manager());
create policy p_docs_update on documents for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

-- 簽署由 Edge Function（OTP 身分連結）寫入；管理職可查
create policy p_signatures_select on signatures for select using (org_id = current_org() and is_manager());

create policy p_edu_select on edu_assets for select using (org_id = current_org());
create policy p_edu_insert on edu_assets for insert with check (org_id = current_org() and is_manager());
create policy p_edu_update on edu_assets for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

-- ---------- 稽核：只有 owner 可查 ----------
create policy p_audit_select on audit_logs for select using (org_id = current_org() and is_owner());
create policy p_access_select on access_logs for select using (org_id = current_org() and is_owner());

-- ---------- 0002：客戶、需求單、客訴只給管理職；評價護理師可看自己的 ----------
create policy p_customers_select on customers for select using (org_id = current_org() and is_manager());
create policy p_customers_insert on customers for insert with check (org_id = current_org() and is_manager());
create policy p_customers_update on customers for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

create policy p_cust_cases_select on customer_cases for select using (org_id = current_org() and is_manager());
create policy p_cust_cases_insert on customer_cases for insert with check (org_id = current_org() and is_manager());

create policy p_requests_select on service_requests for select using (org_id = current_org() and is_manager());
create policy p_requests_insert on service_requests for insert with check (org_id = current_org() and is_manager());
create policy p_requests_update on service_requests for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());

create policy p_reviews_select on reviews for select
  using (org_id = current_org() and (is_manager() or nurse_id = auth.uid()));
create policy p_reviews_insert on reviews for insert with check (org_id = current_org() and is_manager());

create policy p_complaints_select on complaints for select using (org_id = current_org() and is_manager());
create policy p_complaints_insert on complaints for insert with check (org_id = current_org() and is_manager());
create policy p_complaints_update on complaints for update
  using (org_id = current_org() and is_manager()) with check (org_id = current_org());
