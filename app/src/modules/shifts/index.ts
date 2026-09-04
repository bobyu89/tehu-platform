import { getDb } from "@/lib/db";
import type { Shift } from "@/lib/types";

/**
 * shifts 模組：派單狀態機、打卡、出勤審核、工時。
 * 介面小、功能深——頁面不直接碰 shifts 表。
 */

export type { Shift };

/** 實際工時（小時）；未完成打卡回 null */
export function hoursOf(s: Shift): number | null {
  if (!s.clockInAt || !s.clockOutAt) return null;
  return (new Date(s.clockOutAt).getTime() - new Date(s.clockInAt).getTime()) / 3600_000;
}

/** 出勤異常：有打卡但無定位（圈外或訊號拒絕）。不硬擋，進審核流。 */
export const isAnomaly = (s: Shift): boolean => Boolean(s.clockInAt) && !s.clockInGeo;

/** 派單：指派後 30 分鐘回覆期限（04 冊） */
export async function assign(shiftId: string, nurseId: string): Promise<void> {
  await getDb().shifts.update(shiftId, {
    status: "offered", nurseId,
    offeredAt: new Date().toISOString(),
    respondBy: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
}

/** 撤回派單或拒接：退回待派 */
export async function recall(shiftId: string): Promise<void> {
  await getDb().shifts.update(shiftId, {
    status: "unassigned", nurseId: undefined, offeredAt: undefined, respondBy: undefined,
  });
}

/** 護理師回覆派單 */
export async function respond(shiftId: string, accept: boolean): Promise<void> {
  if (accept) await getDb().shifts.update(shiftId, { status: "accepted" });
  else await recall(shiftId);
}

/** 定位打卡上班；拿不到定位不硬擋，記 null 進審核流 */
export async function clockIn(shiftId: string): Promise<void> {
  const db = getDb();
  const stamp = new Date().toISOString();
  const save = (geo: Shift["clockInGeo"]) =>
    db.shifts.update(shiftId, { status: "in_progress", clockInAt: stamp, clockInGeo: geo });
  if (typeof navigator === "undefined" || !navigator.geolocation) { await save(null); return; }
  await new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => { void save({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }).then(() => resolve()); },
      () => { void save(null).then(() => resolve()); },
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

export async function clockOut(shiftId: string): Promise<void> {
  await getDb().shifts.update(shiftId, { status: "completed", clockOutAt: new Date().toISOString() });
}

/** 主管審核異常打卡 */
export async function review(shiftId: string, approved: boolean, note?: string): Promise<void> {
  await getDb().shifts.update(shiftId, {
    reviewStatus: approved ? "approved" : "rejected",
    reviewNote: note ?? (approved ? "主管確認在場" : "需補說明"),
  });
}

/** 已派但逾回覆期限：視同待派可重派 */
export function isOfferExpired(s: Shift): boolean {
  return s.status === "offered" && Boolean(s.respondBy) && s.respondBy! < new Date().toISOString();
}

/** 近 N 日每位護理師的班數與工時 */
export function rollupByNurse(shifts: Shift[], days = 30): Record<string, { shifts: number; hours: number }> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const out: Record<string, { shifts: number; hours: number }> = {};
  for (const s of shifts) {
    if (!s.clockInAt || s.date < since) continue;
    const key = s.nurseId ?? "?";
    out[key] = out[key] ?? { shifts: 0, hours: 0 };
    out[key].shifts += 1;
    out[key].hours += hoursOf(s) ?? 0;
  }
  return out;
}
