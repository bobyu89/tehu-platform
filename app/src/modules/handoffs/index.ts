import { getDb, uid } from "@/lib/db";
import type { Handoff } from "@/lib/types";

/**
 * handoffs 模組：ISBAR 交班狀態機（03 冊）。
 * 草稿 → 送出 → 簽收（勾稽區逐項勾認）→ 歸檔；接班者可提出疑義退回草稿。
 */

export type { Handoff };

/** 簽收勾稽區：全部勾認才能簽收 */
export const CHECK_ITEMS = [
  "管路已逐條核對",
  "藥品已清點無誤",
  "病人當下狀態已確認",
  "特殊物品已交接",
] as const;

export type HandoffDraft = Pick<Handoff,
  "caseId" | "shiftId" | "sIssues" | "sNote" | "aNote" | "rTodos" | "summaryDraft" | "disputeNote" | "supplementNote"> & { id?: string };

/** 交班者送出；帶 id 代表補充疑義後重新送出 */
export async function submit(draft: HandoffDraft): Promise<void> {
  await getDb().handoffs.put({
    ...draft, id: draft.id ?? uid(),
    status: "submitted", submittedAt: new Date().toISOString(),
  });
}

export const allChecked = (checklist: Record<string, boolean>): boolean =>
  CHECK_ITEMS.every((c) => checklist[c]);

/** 接班者簽收歸檔；勾稽區未全勾丟出錯誤 */
export async function receive(id: string, checklist: Record<string, boolean>): Promise<void> {
  if (!allChecked(checklist)) throw new Error("勾稽區未全部勾認，不可簽收");
  await getDb().handoffs.update(id, {
    status: "received", receivedAt: new Date().toISOString(), checklist,
  });
}

/** 接班者提出疑義：退回草稿請交班者補充 */
export async function dispute(id: string, note: string): Promise<void> {
  if (!note.trim()) throw new Error("請填寫疑義內容");
  await getDb().handoffs.update(id, { status: "draft", disputeNote: note.trim() });
}
