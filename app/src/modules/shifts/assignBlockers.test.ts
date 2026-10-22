import { describe, expect, it } from "vitest";
import { assignBlockers } from "./index";
import type { CaseInfo, Nurse, Shift } from "@/lib/types";

// 派單硬條件：不變量 2（技術標籤）、不變量 3（輪班間隔 ≥ 11 小時，ADR-002）。

const nurse: Nurse = { id: "n1", name: "A", tags: ["管灌", "抽痰"] };
const needs = (careNeeds: string[]) => ({ id: "c1", careNeeds }) as CaseInfo;
const shift = (id: string, date: string, slot: "day" | "night", extra: Partial<Shift> = {}): Shift => ({
  id, caseId: "c1", date, startHH: slot === "day" ? 8 : 20, endHH: slot === "day" ? 20 : 8,
  status: "unassigned", ...extra,
});
const mine = (id: string, date: string, slot: "day" | "night", status: Shift["status"] = "accepted") =>
  shift(id, date, slot, { nurseId: "n1", status });

const target = shift("t", "2026-10-22", "day");

describe("技術標籤（不變量 2）", () => {
  it("需求 ⊆ 標籤即可指派", () => {
    expect(assignBlockers(target, needs(["管灌"]), nurse, [])).toEqual([]);
    expect(assignBlockers(target, needs([]), nurse, [])).toEqual([]);
  });

  it("缺標籤時列出缺少的項目", () => {
    expect(assignBlockers(target, needs(["管灌", "呼吸器"]), nurse, [])).toEqual(["缺技術標籤：呼吸器"]);
  });
});

describe("輪班間隔（不變量 3）", () => {
  it("同日日夜連值 → 擋", () => {
    expect(assignBlockers(target, needs([]), nurse, [mine("x", "2026-10-22", "night")])).toHaveLength(1);
  });

  it("前一晚夜班接今日日班 → 擋", () => {
    expect(assignBlockers(target, needs([]), nurse, [mine("x", "2026-10-21", "night")])).toHaveLength(1);
  });

  it("同時段另一個案 → 擋", () => {
    expect(assignBlockers(target, needs([]), nurse, [mine("x", "2026-10-22", "day")])).toHaveLength(1);
  });

  it("連續日班、連續夜班（間隔 12 小時）→ 可", () => {
    expect(assignBlockers(target, needs([]), nurse, [mine("x", "2026-10-21", "day"), mine("y", "2026-10-23", "day")])).toEqual([]);
    expect(assignBlockers(shift("t2", "2026-10-22", "night"), needs([]), nurse, [mine("x", "2026-10-21", "night")])).toEqual([]);
  });

  it("他人班次、待派、逾期未回覆的派單不佔用", () => {
    expect(assignBlockers(target, needs([]), nurse, [
      shift("o", "2026-10-22", "night", { nurseId: "n2", status: "accepted" }),
      shift("u", "2026-10-22", "night"),
      shift("e", "2026-10-22", "night", { nurseId: "n1", status: "offered", respondBy: "2000-01-01T00:00:00.000Z" }),
    ])).toEqual([]);
  });

  it("已完成的班次也計入", () => {
    expect(assignBlockers(target, needs([]), nurse, [mine("x", "2026-10-21", "night", "completed")])).toHaveLength(1);
  });

  it("不和自己比", () => {
    const self = { ...target, nurseId: "n1", status: "offered" as const };
    expect(assignBlockers(self, needs([]), nurse, [self])).toEqual([]);
  });
});

it("兩條同時違反時兩個理由都列出", () => {
  expect(assignBlockers(target, needs(["呼吸器"]), nurse, [mine("x", "2026-10-22", "night")])).toHaveLength(2);
});
