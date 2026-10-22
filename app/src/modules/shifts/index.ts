import { getDb } from "@/lib/db";
import { enqueue } from "@/modules/sync";
import type { CaseInfo, Nurse, Shift } from "@/lib/types";

/**
 * shifts 模組：派單狀態機、打卡、出勤審核、工時。
 * 介面小、功能深——頁面不直接碰 shifts 表。
 */

export type { Shift };

/** 已下班的班次：完成、核對、結算都算（工時與收入計入） */
export const isFinished = (s: Shift): boolean =>
  s.status === "completed" || s.status === "verified" || s.status === "settled";

/** 實際工時（小時）；未完成打卡回 null */
export function hoursOf(s: Shift): number | null {
  if (!s.clockInAt || !s.clockOutAt) return null;
  return (new Date(s.clockOutAt).getTime() - new Date(s.clockInAt).getTime()) / 3600_000;
}

/** 出勤異常：有打卡但無定位（圈外或訊號拒絕）。不硬擋，進審核流。 */
export const isAnomaly = (s: Shift): boolean => Boolean(s.clockInAt) && !s.clockInGeo;

/** 新增待派班次：日班 08–20、夜班 20–08（ADR-002 12 小時兩班制） */
export async function createShift(caseId: string, date: string, slot: "day" | "night"): Promise<void> {
  await getDb().shifts.put({
    id: `shift-${caseId}-${date}-${slot}`, caseId, date,
    startHH: slot === "day" ? 8 : 20, endHH: slot === "day" ? 20 : 8,
    status: "unassigned",
  });
}

/** 輪班間隔下限（ADR-002：勞基法輪班間隔 11 小時） */
export const MIN_REST_H = 11;

/** 班次的實際起訖（本地時間，ms）；跨夜班的結束落在隔日 */
function spanOf(s: Shift): [number, number] {
  const start = new Date(`${s.date}T00:00:00`).getTime() + s.startHH * 3600_000;
  const len = ((s.endHH - s.startHH + 24) % 24 || 24) * 3600_000;
  return [start, start + len];
}

/** 已佔用護理師時間的班次：已派（未逾期）、已接、服務中、已完成 */
const holdsNurse = (s: Shift): boolean => s.status !== "unassigned" && !isOfferExpired(s);

/**
 * 派單硬條件檢查；回傳不可指派的理由，空陣列代表可指派。
 * - 不變量 2：個案技術需求 ⊆ 護理師技術標籤
 * - 不變量 3：與該護理師其他班次間隔須 ≥ 11 小時（涵蓋同日日夜連值與時段重疊）
 * 畫面與 assign() 共用此函式，判斷只有一份。
 */
export function assignBlockers(shift: Shift, caseInfo: CaseInfo | undefined, nurse: Nurse, allShifts: Shift[]): string[] {
  const out: string[] = [];
  const missing = (caseInfo?.careNeeds ?? []).filter((t) => !nurse.tags.includes(t));
  if (missing.length > 0) out.push(`缺技術標籤：${missing.join("、")}`);

  const [start, end] = spanOf(shift);
  const clash = allShifts.find((o) => {
    if (o.id === shift.id || o.nurseId !== nurse.id || !holdsNurse(o)) return false;
    const [os, oe] = spanOf(o);
    return start < oe + MIN_REST_H * 3600_000 && os < end + MIN_REST_H * 3600_000;
  });
  if (clash) {
    const hh = (h: number) => String(h).padStart(2, "0");
    out.push(`與 ${clash.date.slice(5).replace("-", "/")} ${hh(clash.startHH)}–${hh(clash.endHH)} 班次間隔不足 ${MIN_REST_H} 小時`);
  }
  return out;
}

/** 派單：先過硬條件，指派後 30 分鐘回覆期限（04 冊）。違反硬條件丟出錯誤。 */
export async function assign(shiftId: string, nurseId: string): Promise<void> {
  const db = getDb();
  const shift = await db.shifts.get(shiftId);
  const nurse = await db.nurses.get(nurseId);
  if (!shift || !nurse) throw new Error("找不到班次或護理師");
  const blockers = assignBlockers(shift, await db.cases.get(shift.caseId), nurse,
    await db.shifts.where("date").between(dayOffset(shift.date, -1), dayOffset(shift.date, 1), true, true).toArray());
  if (blockers.length > 0) throw new Error(`不可指派：${blockers.join("；")}`);
  await db.shifts.update(shiftId, {
    status: "offered", nurseId,
    offeredAt: new Date().toISOString(),
    respondBy: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
}

/** YYYY-MM-DD 加減天數 */
function dayOffset(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const save = (geo: Shift["clockInGeo"]) => db.transaction("rw", [db.shifts, db.outbox], async () => {
    await db.shifts.update(shiftId, { status: "in_progress", clockInAt: stamp, clockInGeo: geo });
    await enqueue({ entity: "attendance", data: { shiftId, kind: "in", at: stamp, geo } });
  });
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
  const db = getDb();
  const stamp = new Date().toISOString();
  await db.transaction("rw", [db.shifts, db.outbox], async () => {
    await db.shifts.update(shiftId, { status: "completed", clockOutAt: stamp });
    await enqueue({ entity: "attendance", data: { shiftId, kind: "out", at: stamp } });
  });
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
