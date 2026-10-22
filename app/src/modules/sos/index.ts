import { getDb, uid } from "@/lib/db";
import type { SosIncident } from "@/lib/types";

/**
 * sos 模組：緊急求助事件（04 冊 §3）。
 * 示範模式僅寫入本地事件；正式版同時推播 LINE 值班群、簡訊與語音輪撥。
 */

export type { SosIncident };

export async function trigger(kind: SosIncident["kind"]): Promise<void> {
  await getDb().sos.put({ id: uid(), kind, silent: false, triggeredAt: new Date().toISOString() });
}

/** 解除最近一筆尚未解除的求助 */
export async function resolveLatest(): Promise<void> {
  const db = getDb();
  const all = await db.sos.toArray();
  const last = all.reduce<SosIncident | undefined>(
    (acc, r) => (!acc || r.triggeredAt > acc.triggeredAt ? r : acc), undefined);
  if (last && !last.resolvedAt) await db.sos.update(last.id, { resolvedAt: new Date().toISOString() });
}
