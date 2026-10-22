import { getDb, uid } from "@/lib/db";
import type { CaseInfo, CaseStatus } from "@/lib/types";

/**
 * cases 模組：個案建檔與狀態機（04 冊）。
 * 洽詢 → 評估中 → 報價 → 服務中 → 暫停 → 結案。
 * 由需求單成案走 customers.convertToCase。
 */

export type { CaseInfo };

/** 前進一步的狀態；服務中以後（暫停、結案）不在此流程推進 */
export const NEXT_STATUS: Partial<Record<CaseStatus, CaseStatus>> = {
  inquiry: "assessing", assessing: "quoted", quoted: "active",
};

/** 新建個案，狀態為洽詢；回傳個案 id */
export async function create(
  input: Pick<CaseInfo, "name" | "age" | "setting" | "dx" | "careNeeds">,
): Promise<string> {
  const id = `case-${uid().slice(0, 8)}`;
  await getDb().cases.put({
    ...input, id, sex: "女", allergies: "未知", tubes: [], status: "inquiry", vitalsIntervalH: 4,
  });
  return id;
}

/** 推進到下一個狀態；已無下一步則不動 */
export async function advance(c: CaseInfo): Promise<void> {
  const next = NEXT_STATUS[c.status ?? "active"];
  if (next) await getDb().cases.update(c.id, { status: next });
}
