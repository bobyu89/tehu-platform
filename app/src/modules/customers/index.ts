import { getDb, uid } from "@/lib/db";
import type { CaseInfo, Complaint, Review, ServiceRequest } from "@/lib/types";

/**
 * customers 模組：需求單、評價、客訴。
 * 需求單狀態機：待聯繫 → 已聯繫 → 已報價 → 已成案（產生個案）／未成案。
 */

export type { Complaint, Review, ServiceRequest };

/* ---------- 需求單 ---------- */

export async function submitRequest(
  input: Omit<ServiceRequest, "id" | "status" | "createdAt" | "caseId">,
): Promise<string> {
  const id = `req-${uid().slice(0, 8)}`;
  await getDb().requests.put({ ...input, id, status: "new", createdAt: new Date().toISOString() });
  return id;
}

export async function advanceRequest(id: string, status: ServiceRequest["status"]): Promise<void> {
  await getDb().requests.update(id, { status });
}

/** 成案：由需求單建立個案（狀態評估中），並回寫連結 */
export async function convertToCase(req: ServiceRequest): Promise<string> {
  const db = getDb();
  const caseId = `case-${uid().slice(0, 8)}`;
  const c: CaseInfo = {
    id: caseId, name: `${req.customerName}的家人`, age: 0, sex: "女",
    setting: req.setting, dx: req.note?.slice(0, 40) || "（待評估訪視補填）",
    allergies: "待確認", careNeeds: req.needs, tubes: [],
    status: "assessing", vitalsIntervalH: 6,
  };
  await db.transaction("rw", [db.cases, db.requests], async () => {
    await db.cases.put(c);
    await db.requests.update(req.id, { status: "converted", caseId });
  });
  return caseId;
}

/* ---------- 評價 ---------- */

export async function addReview(input: Omit<Review, "id" | "at">): Promise<void> {
  await getDb().reviews.put({ ...input, id: `rv-${uid().slice(0, 8)}`, at: new Date().toISOString() });
}

/** 平均星等與則數；無評價回 null */
export function ratingOf(reviews: Review[], nurseId: string): { avg: number; n: number } | null {
  const mine = reviews.filter((r) => r.nurseId === nurseId);
  if (mine.length === 0) return null;
  return { avg: mine.reduce((a, r) => a + r.rating, 0) / mine.length, n: mine.length };
}

/** 標籤詞頻（給人員檔案與績效用） */
export function topTags(reviews: Review[], limit = 4): string[] {
  const c: Record<string, number> = {};
  for (const r of reviews) for (const t of r.tags) c[t] = (c[t] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
}

/* ---------- 客訴 ---------- */

export async function openComplaint(input: Omit<Complaint, "id" | "status" | "at">): Promise<void> {
  await getDb().complaints.put({ ...input, id: `cp-${uid().slice(0, 8)}`, status: "open", at: new Date().toISOString() });
}

export async function startInvestigation(id: string, handledBy: string): Promise<void> {
  await getDb().complaints.update(id, { status: "investigating", handledBy });
}

export async function resolveComplaint(id: string, resolution: string): Promise<void> {
  await getDb().complaints.update(id, { status: "resolved", resolution, resolvedAt: new Date().toISOString() });
}
