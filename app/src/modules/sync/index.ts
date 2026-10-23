import { getDb } from "@/lib/db";
import {
  localKey, toSqlRow, type OutboxItem, type SqlRow, type SyncContext, type SyncEntity,
} from "@/lib/sync/mappers";

/**
 * sync 模組：離線優先的同步佇列（05 冊 §5）。
 * 寫入路徑：模組寫本機 Dexie 時，在同一個交易裡呼叫 enqueue 排入 outbox →
 * flush 依序（seq）送往伺服器 → 成功即移出佇列。
 *
 * - 網路或伺服器暫時性錯誤：停在該筆，之後依退避時間重送（後面的紀錄可能依賴它，不跳過）
 * - 伺服器拒收（權限、約束）：標為 failed，留待人工處理，繼續送後面的
 * - 不會重複寫入：ID 在本機決定，伺服器 on conflict (id) do nothing
 * 示範版沒有設定傳送端（transport），紀錄只會留在佇列裡；接上 Supabase 後用 postgrestTransport。
 */

export type { OutboxItem, SyncContext, SyncEntity };
export { postgrestTransport, isRetryableStatus, type PostgrestConfig } from "./postgrest";

export type SendOutcome = { ok: true } | { ok: false; retryable: boolean; error: string };

/** 傳送端：一次送一筆，回報結果（PostgREST 實作見 lib/sync/postgrest.ts） */
export interface Transport { send(item: SqlRow): Promise<SendOutcome> }

/** 排入佇列。須在含 db.outbox 的交易裡呼叫，與本機寫入同進退；同鍵且尚未送出的會合併成最新內容 */
export async function enqueue(e: SyncEntity): Promise<void> {
  const db = getDb();
  const key = localKey(e);
  const existing = await db.outbox.where("[entity+key]").equals([e.entity, key])
    .filter((i) => i.status === "pending").first();
  if (existing) {
    await db.outbox.update(existing.seq!, { data: e.data });
    return;
  }
  await db.outbox.add({
    entity: e.entity, key, data: e.data, createdAt: new Date().toISOString(), attempts: 0, status: "pending",
  });
}

export async function pendingCount(): Promise<number> {
  return getDb().outbox.where("status").equals("pending").count();
}

export async function failedItems(): Promise<OutboxItem[]> {
  return getDb().outbox.where("status").equals("failed").toArray();
}

/** 第 n 次失敗後的等待：5 秒起跳、每次加倍，上限 10 分鐘 */
export function backoffMs(attempts: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 10 * 60_000);
}

export interface FlushResult { sent: number; failed: number; deferred: boolean }

/** 依序送出到期的待傳紀錄；遇到暫時性錯誤就停，交給下次重試 */
export async function flush(
  transport: Transport, ctx: SyncContext, opts: { batchSize?: number; nowMs?: number } = {},
): Promise<FlushResult> {
  const db = getDb();
  const nowMs = opts.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
  // 嚴格依序：最前面那筆還在退避，後面的也一起等，避免依賴它的紀錄插隊先到伺服器
  const queue = (await db.outbox.where("status").equals("pending").sortBy("seq")).slice(0, opts.batchSize ?? 50);

  const result: FlushResult = { sent: 0, failed: 0, deferred: false };
  for (const item of queue) {
    if (item.nextAttemptAt && item.nextAttemptAt > now) { result.deferred = true; break; }
    let outcome: SendOutcome;
    try {
      outcome = await transport.send(await toSqlRow({ entity: item.entity, data: item.data } as SyncEntity, ctx));
    } catch (err) {
      outcome = { ok: false, retryable: true, error: err instanceof Error ? err.message : String(err) };
    }

    if (outcome.ok) {
      await db.outbox.delete(item.seq!);
      result.sent += 1;
    } else if (outcome.retryable) {
      const attempts = item.attempts + 1;
      await db.outbox.update(item.seq!, {
        attempts, lastError: outcome.error, nextAttemptAt: new Date(nowMs + backoffMs(attempts)).toISOString(),
      });
      result.deferred = true;
      break;
    } else {
      await db.outbox.update(item.seq!, { status: "failed", attempts: item.attempts + 1, lastError: outcome.error });
      result.failed += 1;
    }
  }
  return result;
}

/** 人工處理後重新排入：把 failed 改回 pending */
export async function retryFailed(): Promise<number> {
  return getDb().outbox.where("status").equals("failed")
    .modify({ status: "pending", nextAttemptAt: undefined });
}

/** 啟動自動同步：立即送一次、恢復連線時送、之後定期送；回傳停止函式。同時只會有一個 flush 在跑 */
export function startAutoSync(transport: Transport, ctx: SyncContext, intervalMs = 30_000): () => void {
  let running = false;
  const run = async () => {
    if (running || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    running = true;
    try { await flush(transport, ctx); } finally { running = false; }
  };
  void run();
  const timer = setInterval(() => { void run(); }, intervalMs);
  const onOnline = () => { void run(); };
  if (typeof window !== "undefined") window.addEventListener("online", onOnline);
  return () => {
    clearInterval(timer);
    if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
  };
}
