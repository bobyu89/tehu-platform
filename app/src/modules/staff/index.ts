import { getDb } from "@/lib/db";
import type { AlertRow, Handoff, MedLog, NurseProfile, Review, Shift } from "@/lib/types";
import { hoursOf, isFinished } from "@/modules/shifts";
import { ratingOf } from "@/modules/customers";

/**
 * staff 模組：護理師檔案、可服務時段、收入、績效彙整。
 */

export type { NurseProfile };

export type Slot = "day" | "night";

export async function toggleAvailability(nurseId: string, weekday: string, slot: Slot): Promise<void> {
  const db = getDb();
  const p = await db.nurseProfiles.get(nurseId);
  if (!p) return;
  const cur = p.availability[weekday] ?? [];
  const next = cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot];
  await db.nurseProfiles.update(nurseId, { availability: { ...p.availability, [weekday]: next } });
}

/** 證照到期天數；無效期回 null */
export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400_000);
}

export interface IncomeRow { shift: Shift; hours: number; pay: number }

/** 近 N 日已完成班次的估算收入 */
export function incomeOf(shifts: Shift[], nurseId: string, hourlyRate: number, days = 30): {
  rows: IncomeRow[]; totalHours: number; totalPay: number;
} {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const rows = shifts
    .filter((s) => s.nurseId === nurseId && isFinished(s) && hoursOf(s) != null && s.date >= since)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((shift) => { const hours = hoursOf(shift)!; return { shift, hours, pay: Math.round(hours * hourlyRate) }; });
  return {
    rows,
    totalHours: rows.reduce((a, r) => a + r.hours, 0),
    totalPay: rows.reduce((a, r) => a + r.pay, 0),
  };
}

export interface Performance {
  nurseId: string;
  shifts: number;
  hours: number;
  rating: { avg: number; n: number } | null;
  alertsClaimed: number;
  handoffOnTime: { onTime: number; total: number };
  medOnTime: { given: number; total: number };
  complaints: number;
}

/**
 * 績效彙整（近 30 日）：出勤、評價、警報處理、交班準時、給藥準時、客訴。
 * 這些就是第三階段「品質徽章」的原料。
 */
export function performanceOf(
  nurseId: string,
  data: { shifts: Shift[]; reviews: Review[]; alerts: AlertRow[]; handoffs: Handoff[]; medLogs: MedLog[]; complaintNurseIds: (string | undefined)[] },
): Performance {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const sinceDay = since.slice(0, 10);
  const mine = data.shifts.filter((s) => s.nurseId === nurseId && s.clockInAt && s.date >= sinceDay);
  const myShiftIds = new Set(mine.map((s) => s.id));
  const myCaseDays = new Set(mine.map((s) => `${s.caseId}|${s.date}`));

  const handoffs = data.handoffs.filter((h) => myShiftIds.has(h.shiftId));
  const onTime = handoffs.filter((h) => h.status === "received" && h.receivedAt && h.submittedAt
    && new Date(h.receivedAt).getTime() - new Date(h.submittedAt).getTime() <= 60 * 60_000).length;

  const meds = data.medLogs.filter((l) => myCaseDays.has(`${l.caseId}|${l.date}`));

  return {
    nurseId,
    shifts: mine.length,
    hours: mine.reduce((a, s) => a + (hoursOf(s) ?? 0), 0),
    rating: ratingOf(data.reviews, nurseId),
    alertsClaimed: data.alerts.filter((a) => a.claimedAt && a.triggeredAt >= since).length,
    handoffOnTime: { onTime, total: handoffs.length },
    medOnTime: { given: meds.filter((l) => l.status === "given").length, total: meds.length },
    complaints: data.complaintNurseIds.filter((id) => id === nurseId).length,
  };
}
