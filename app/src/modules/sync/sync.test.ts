import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import type { CaseInfo } from "@/lib/types";
import { addWound, assessWound, logMed, recordVitals } from "@/modules/care";
import { backoffMs, failedItems, flush, pendingCount, retryFailed, type SendOutcome, type Transport } from "./index";
import { isRetryableStatus, postgrestTransport } from "./postgrest";
import type { SqlRow } from "@/lib/sync/mappers";

const ctx = { orgId: "00000000-0000-0000-0000-0000000000aa", profileId: "a0000000-0000-0000-0000-000000000003" };
const info = { id: "case-wang", careNeeds: [] } as unknown as CaseInfo;

/** 假伺服器：依腳本回應，記錄收到的資料 */
function fakeServer(script: (row: SqlRow, n: number) => SendOutcome = () => ({ ok: true })) {
  const received: SqlRow[] = [];
  const transport: Transport = { async send(item) { received.push(item); return script(item, received.length); } };
  return { transport, received };
}

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("寫入即排入同步佇列", () => {
  it("量測寫入本機時，每筆量測都排入佇列；警報不排入（伺服器重新判定）", async () => {
    const r = await recordVitals(info, [
      { type: "hr", value: { main: 140 } },                      // A 層紅色
      { type: "consciousness", value: { main: null, avpu: "A" } },
    ]);
    expect(r.alertRows.length).toBeGreaterThan(0);
    const items = await getDb().outbox.toArray();
    expect(items.map((i) => i.entity)).toEqual(["observation", "observation"]);
  });

  it("同一給藥時段改了記錄：未送出前合併成一筆最新內容", async () => {
    await logMed("case-wang", "med-1", "2026-10-22", 8, "given");
    await logMed("case-wang", "med-1", "2026-10-22", 8, "withheld", "嘔吐");
    const items = await getDb().outbox.toArray();
    expect(items).toHaveLength(1);
    expect(items[0].data).toMatchObject({ status: "withheld", reason: "嘔吐" });
  });
});

describe("flush 送出", () => {
  it("依寫入順序送出（傷口先於其評估），成功即移出佇列", async () => {
    const w = await addWound("case-wang", { code: "sacrum", label: "薦尾" });
    await assessWound({ woundId: w.id, caseId: "case-wang", stage: "2 期" });
    const { transport, received } = fakeServer();
    expect(await flush(transport, ctx)).toEqual({ sent: 2, failed: 0, deferred: false });
    expect(received.map((r) => r.table)).toEqual(["wounds", "wound_assessments"]);
    expect(await pendingCount()).toBe(0);
  });

  it("暫時性錯誤：停在該筆、後面不送，依退避時間重送", async () => {
    const w = await addWound("case-wang", { code: "sacrum", label: "薦尾" });
    await assessWound({ woundId: w.id, caseId: "case-wang", stage: "2 期" });
    const down = fakeServer(() => ({ ok: false, retryable: true, error: "503" }));
    const t0 = Date.parse("2026-10-22T00:00:00Z");
    expect(await flush(down.transport, ctx, { nowMs: t0 })).toEqual({ sent: 0, failed: 0, deferred: true });
    expect(down.received).toHaveLength(1);                       // 評估沒有被送出
    const [first] = await getDb().outbox.orderBy("seq").toArray();
    expect(first).toMatchObject({ attempts: 1, lastError: "503", status: "pending" });

    const up = fakeServer();
    expect((await flush(up.transport, ctx, { nowMs: t0 + 1_000 })).sent).toBe(0);   // 退避期間不重送，後面的評估也不插隊
    expect(up.received).toHaveLength(0);
    expect((await flush(up.transport, ctx, { nowMs: t0 + backoffMs(1) })).sent).toBe(2);
  });

  it("伺服器拒收：標為 failed 不再自動重送，繼續送後面的；人工處理後可重新排入", async () => {
    await logMed("case-wang", "med-1", "2026-10-22", 8, "given");
    await logMed("case-wang", "med-2", "2026-10-22", 8, "given");
    const srv = fakeServer((_, n) => (n === 1 ? { ok: false, retryable: false, error: "403 rls" } : { ok: true }));
    expect(await flush(srv.transport, ctx)).toEqual({ sent: 1, failed: 1, deferred: false });
    expect((await failedItems()).map((i) => i.lastError)).toEqual(["403 rls"]);
    expect(await pendingCount()).toBe(0);
    expect(await retryFailed()).toBe(1);
    expect(await pendingCount()).toBe(1);
  });

  it("重送同一筆送出的是同一個 ID（伺服器以 on conflict do nothing 去重）", async () => {
    await logMed("case-wang", "med-1", "2026-10-22", 8, "given");
    const ids: unknown[] = [];
    const flaky = fakeServer((row, n) => { ids.push(row.row.id); return n === 1 ? { ok: false, retryable: true, error: "timeout" } : { ok: true }; });
    await flush(flaky.transport, ctx, { nowMs: 0 });
    await flush(flaky.transport, ctx, { nowMs: backoffMs(1) });
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("退避：5 秒起跳、每次加倍、上限 10 分鐘", () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([5_000, 10_000, 20_000]);
    expect(backoffMs(20)).toBe(600_000);
  });
});

describe("PostgREST 傳送端", () => {
  it("以 on_conflict=id＋ignore-duplicates 送出，帶 anon key 與使用者 token", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const t = postgrestTransport({
      url: "https://x.supabase.co", apiKey: "anon", getAccessToken: async () => "jwt",
      fetchImpl: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(null, { status: 201 }); }) as typeof fetch,
    });
    expect(await t.send({ table: "observations", row: { id: "1" } })).toEqual({ ok: true });
    const h = calls[0].init.headers as Record<string, string>;
    expect(calls[0].url).toBe("https://x.supabase.co/rest/v1/observations?on_conflict=id");
    expect(h.Prefer).toContain("resolution=ignore-duplicates");
    expect(h.apikey).toBe("anon");
    expect(h.Authorization).toBe("Bearer jwt");
  });

  it("錯誤分類：連線失敗、401、429、5xx 可重試；403（RLS）、409、400 不可重試", async () => {
    expect([401, 408, 429, 500, 503].every(isRetryableStatus)).toBe(true);
    expect([400, 403, 409, 422].some(isRetryableStatus)).toBe(false);
    const offline = postgrestTransport({
      url: "https://x", apiKey: "k", getAccessToken: async () => "t",
      fetchImpl: (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch,
    });
    expect(await offline.send({ table: "observations", row: {} })).toMatchObject({ ok: false, retryable: true });
  });
});
