import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { toSqlRow, toUuid, type SqlRow, type SyncContext, type SyncEntity } from "./mappers";

/**
 * 同步契約測試：欄位轉換的輸出，以「值班中的護理師」身分實際插入 Postgres（已套 0001–0003），
 * 驗證欄位名稱與型別、RLS、重送去重、recorded_at 由伺服器給。
 * 需要資料庫：只在設定 SYNC_CONTRACT_PG 時執行（CI migrations job；連線用 PGHOST 等環境變數）。
 */

const enabled = Boolean(process.env.SYNC_CONTRACT_PG);

const psql = (sql: string): string =>
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-tA", "-f", "-"], { input: sql, encoding: "utf8" }).trim();

const ctx: SyncContext = {
  orgId: "c0000000-0000-4000-8000-0000000000cc",
  profileId: "c0000000-0000-4000-8000-000000000003",
};

/** 以護理師身分 insert … on conflict (id) do nothing（等同 PostgREST ignore-duplicates） */
const insertAsNurse = ({ table, row }: SqlRow): string => {
  const cols = Object.keys(row).join(", ");
  return `
    select set_config('test.uid', '${ctx.profileId}', false);
    set role authenticated;
    insert into ${table} (${cols})
      select ${cols} from jsonb_populate_record(null::${table}, $j$${JSON.stringify(row)}$j$::jsonb)
      on conflict (id) do nothing;
    reset role;`;
};

describe.skipIf(!enabled)("同步契約：本機紀錄 → Postgres（RLS 生效）", () => {
  it("床邊紀錄全部可寫入、重送不重複、recorded_at 由伺服器給、非指派個案被拒", async () => {
    const caseId = await toUuid("contract-case");
    const otherCase = await toUuid("contract-other-case");
    const shiftId = await toUuid("contract-shift");
    const medId = await toUuid("contract-med");
    const woundId = "c0000000-0000-4000-8000-0000000000f1";

    psql(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      end $$;
      grant usage on schema public, auth to authenticated;
      grant select, insert, update, delete on all tables in schema public to authenticated;
      insert into orgs (id, name) values ('${ctx.orgId}', '契約測試');
      insert into profiles (id, org_id, role, full_name) values ('${ctx.profileId}', '${ctx.orgId}', 'nurse', '護理師');
      insert into clients (id, org_id, name) values
        ('c0000000-0000-4000-8000-0000000000a1', '${ctx.orgId}', '病人'),
        ('c0000000-0000-4000-8000-0000000000a2', '${ctx.orgId}', '他人');
      insert into cases (id, org_id, client_id) values
        ('${caseId}', '${ctx.orgId}', 'c0000000-0000-4000-8000-0000000000a1'),
        ('${otherCase}', '${ctx.orgId}', 'c0000000-0000-4000-8000-0000000000a2');
      insert into service_orders (id, org_id, case_id, starts_on) values
        ('c0000000-0000-4000-8000-0000000000b1', '${ctx.orgId}', '${caseId}', current_date);
      insert into shifts (id, org_id, service_order_id, case_id, starts_at, ends_at, status) values
        ('${shiftId}', '${ctx.orgId}', 'c0000000-0000-4000-8000-0000000000b1', '${caseId}', now() - interval '1 hour', now() + interval '11 hours', 'in_progress');
      insert into assignments (org_id, shift_id, nurse_id, response) values ('${ctx.orgId}', '${shiftId}', '${ctx.profileId}', 'accepted');
      insert into med_orders (id, org_id, case_id, drug_name) values ('${medId}', '${ctx.orgId}', '${caseId}', 'Metformin 500mg');
    `);

    const measuredAt = new Date(Date.now() - 90 * 60_000).toISOString(); // 90 分鐘前量的（補登）
    const today = new Date().toISOString().slice(0, 10);
    const entities: SyncEntity[] = [
      { entity: "observation", data: { id: "c0000000-0000-4000-8000-0000000000e1", caseId: "contract-case", type: "spo2", category: "vital", value: { main: 95, onO2: false }, measuredAt, recordedAt: measuredAt, source: "manual" } },
      { entity: "care_event", data: { id: "c0000000-0000-4000-8000-0000000000e2", caseId: "contract-case", type: "reposition", label: "翻身：右側臥", occurredAt: new Date().toISOString() } },
      { entity: "med_administration", data: { id: `contract-med|${today}|8`, caseId: "contract-case", medId: "contract-med", date: today, slot: 8, status: "withheld", reason: "禁食", at: new Date().toISOString() } },
      { entity: "wound", data: { id: woundId, caseId: "contract-case", site: "sacrum", siteLabel: "薦尾", identifiedOn: new Date().toISOString() } },
      { entity: "wound_assessment", data: { id: "c0000000-0000-4000-8000-0000000000e3", woundId, caseId: "contract-case", stage: "2 期", note: "邊緣發紅", at: new Date().toISOString() } },
      { entity: "attendance", data: { shiftId: "contract-shift", kind: "in", at: new Date().toISOString(), geo: { lat: 25.04, lng: 121.52, acc: 15 } } },
    ];
    const rows = await Promise.all(entities.map((e) => toSqlRow(e, ctx)));

    for (const r of rows) psql(insertAsNurse(r));
    for (const r of rows) psql(insertAsNurse(r)); // 重送

    const count = (table: string) => Number(psql(`select count(*) from ${table} where org_id = '${ctx.orgId}'`));
    for (const t of ["observations", "care_events", "med_administrations", "wounds", "wound_assessments", "attendance"]) {
      expect(count(t), t).toBe(1);
    }

    // recorded_at 由伺服器給：晚於量測時間，補登 90 分鐘可被伺服器判定
    const lagMin = Number(psql(`select round(extract(epoch from recorded_at - measured_at) / 60) from observations where org_id = '${ctx.orgId}'`));
    expect(lagMin).toBeGreaterThanOrEqual(89);
    expect(psql(`select nurse_id from observations where org_id = '${ctx.orgId}'`)).toBe(ctx.profileId);
    expect(psql(`select withheld_reason from med_administrations where org_id = '${ctx.orgId}'`)).toBe("禁食");

    // 非指派個案：RLS 拒收
    const foreign = await toSqlRow({
      entity: "observation",
      data: { id: "c0000000-0000-4000-8000-0000000000e9", caseId: "contract-other-case", type: "hr", category: "vital", value: { main: 80 }, measuredAt, recordedAt: measuredAt, source: "manual" },
    }, ctx);
    expect(() => psql(insertAsNurse(foreign))).toThrow(/row-level security/);
  });
});
