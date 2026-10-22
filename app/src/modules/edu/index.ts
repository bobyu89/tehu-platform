import { getDb, uid } from "@/lib/db";
import type { EduUnit } from "@/lib/types";

/**
 * edu 模組：衛教推送（08 冊）。
 * 不變量 4：未審核單元不得對外推送。示範模式未接 LINE，只寫入推送紀錄，不送出任何內容。
 */

export type { EduUnit };

/** 可否實際送出給家屬（接上 LINE 推送時以此把關） */
export const canSend = (unit: EduUnit): boolean => unit.reviewed;

/** 寫入推送紀錄 */
export async function recordPush(unitId: string, caseId: string): Promise<void> {
  await getDb().eduPushes.put({ id: uid(), unitId, caseId, at: new Date().toISOString() });
}
