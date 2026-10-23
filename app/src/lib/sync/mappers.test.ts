import { describe, expect, it } from "vitest";
import { localKey, toSqlRow, toUuid, uuidv5, type SyncContext } from "./mappers";

const ctx: SyncContext = {
  orgId: "00000000-0000-0000-0000-0000000000aa",
  profileId: "a0000000-0000-0000-0000-000000000003",
};

describe("UUID v5", () => {
  it("符合 RFC 9562 測試向量（DNS 命名空間＋www.example.com）", async () => {
    expect(await uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"))
      .toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("示範 ID 轉成穩定的 UUID；已是 UUID 原樣保留", async () => {
    const a = await toUuid("case-wang");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await toUuid("case-wang")).toBe(a);
    expect(await toUuid("case-lee")).not.toBe(a);
    expect(await toUuid("A0000000-0000-4000-8000-000000000001")).toBe("a0000000-0000-4000-8000-000000000001");
  });
});

describe("本機 → SQL 欄位轉換", () => {
  it("量測：snake_case、ID 轉 UUID、記錄者為登入者、不帶 recorded_at（由伺服器給）", async () => {
    const { table, row } = await toSqlRow({
      entity: "observation",
      data: {
        id: "0b2f6c1e-1111-4222-8333-444455556666", caseId: "case-wang", type: "hr", category: "vital",
        value: { main: 88 }, measuredAt: "2026-10-22T01:00:00.000Z", recordedAt: "2026-10-22T03:00:00.000Z", source: "manual",
      },
    }, ctx);
    expect(table).toBe("observations");
    expect(row).toEqual({
      id: "0b2f6c1e-1111-4222-8333-444455556666", org_id: ctx.orgId, case_id: await toUuid("case-wang"),
      shift_id: null, nurse_id: ctx.profileId, type: "hr", category: "vital", value: { main: 88 },
      measured_at: "2026-10-22T01:00:00.000Z", source: "manual",
    });
    expect(row).not.toHaveProperty("recorded_at");
  });

  it("給藥：時段轉 due_at；已給有 given_at；未給必有原因", async () => {
    const base = { id: "med-1|2026-10-22|8", caseId: "case-wang", medId: "med-1", date: "2026-10-22", slot: 8, at: "2026-10-22T00:05:00.000Z" };
    const given = (await toSqlRow({ entity: "med_administration", data: { ...base, status: "given" } }, ctx)).row;
    expect(given).toMatchObject({
      id: await toUuid(base.id), med_order_id: await toUuid("med-1"),
      due_at: new Date("2026-10-22T08:00:00").toISOString(), given_at: base.at, withheld_reason: null,
    });
    const withheld = (await toSqlRow({ entity: "med_administration", data: { ...base, status: "withheld", reason: "拒服" } }, ctx)).row;
    expect(withheld).toMatchObject({ given_at: null, withheld_reason: "拒服" });
    const noReason = (await toSqlRow({ entity: "med_administration", data: { ...base, status: "withheld" } }, ctx)).row;
    expect(noReason.withheld_reason).toBe("其他");
  });

  it("照護事件：顯示文字併入 detail", async () => {
    const { row } = await toSqlRow({
      entity: "care_event",
      data: { id: "0b2f6c1e-1111-4222-8333-444455556667", caseId: "case-wang", type: "reposition", label: "翻身：左側臥", occurredAt: "2026-10-22T01:00:00.000Z" },
    }, ctx);
    expect(row).toMatchObject({ type: "reposition", detail: { label: "翻身：左側臥" }, occurred_at: "2026-10-22T01:00:00.000Z" });
  });

  it("傷口評估：不帶照片（需另走 Storage 上傳）", async () => {
    const { table, row } = await toSqlRow({
      entity: "wound_assessment",
      data: { id: "0b2f6c1e-1111-4222-8333-444455556668", woundId: "w-1", caseId: "case-wang", stage: "2 期", photo: "data:image/jpeg;base64,xx", at: "2026-10-22T01:00:00.000Z" },
    }, ctx);
    expect(table).toBe("wound_assessments");
    expect(row).toMatchObject({ wound_id: await toUuid("w-1"), stage: "2 期", description: null });
    expect(JSON.stringify(row)).not.toContain("data:image");
  });

  it("打卡：同一班次同一種打卡的 ID 固定（重送不重複），打卡者為登入者", async () => {
    const e = { entity: "attendance" as const, data: { shiftId: "shift-1", kind: "in" as const, at: "2026-10-22T00:00:00.000Z", geo: { lat: 25.04, lng: 121.5, acc: 12 } } };
    const a = (await toSqlRow(e, ctx)).row;
    expect(a).toMatchObject({ shift_id: await toUuid("shift-1"), nurse_id: ctx.profileId, kind: "in", lat: 25.04, accuracy_m: 12 });
    expect((await toSqlRow(e, ctx)).row.id).toBe(a.id);
    expect((await toSqlRow({ ...e, data: { ...e.data, kind: "out" } }, ctx)).row.id).not.toBe(a.id);
    expect(localKey(e)).toBe("shift-1|in");
  });
});
