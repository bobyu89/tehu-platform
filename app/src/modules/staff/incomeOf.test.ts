import { describe, expect, it } from "vitest";
import { incomeOf } from "./index";
import type { Shift } from "@/lib/types";

const today = new Date().toISOString().slice(0, 10);
const shift = (id: string, status: Shift["status"], nurseId = "n1"): Shift => ({
  id, caseId: "c1", date: today, startHH: 8, endHH: 20, status, nurseId,
  clockInAt: `${today}T00:00:00.000Z`, clockOutAt: `${today}T12:00:00.000Z`,
});

describe("incomeOf", () => {
  it("已完成、已核對、已結算的班次都計入收入（對齊 SQL shift_status）", () => {
    const r = incomeOf([shift("a", "completed"), shift("b", "verified"), shift("c", "settled")], "n1", 500);
    expect(r.rows.map((x) => x.shift.id).sort()).toEqual(["a", "b", "c"]);
    expect(r.totalHours).toBe(36);
    expect(r.totalPay).toBe(18000);
  });

  it("服務中、他人的班次不計入", () => {
    const r = incomeOf([shift("a", "in_progress"), shift("b", "completed", "n2")], "n1", 500);
    expect(r.rows).toEqual([]);
  });
});
