import { getDb, uid } from "@/lib/db";
import type { SignedDoc } from "@/lib/types";

/**
 * documents 模組：電子簽章存證（08 冊 §2）。
 * 文件內容＋簽署人＋時間戳＋簽名影像 → SHA-256，連同載具資訊入庫。
 */

export type { SignedDoc };

export interface SignInput {
  kind: string;             // 文件標題
  content: string;          // 簽署當下的文件全文
  signerName: string;
  caseId?: string;
  consentElectronic: boolean;
  signatureDataUrl: string;
}

/** 簽署並存證；未勾「同意以電子方式簽署」丟出錯誤。回傳雜湊與時間戳供畫面顯示 */
export async function sign(input: SignInput): Promise<{ sha256: string; at: string }> {
  if (!input.consentElectronic) throw new Error("須先同意以電子方式簽署");
  const at = new Date().toISOString();
  const signer = input.signerName.trim();
  const payload = `${input.kind}\n${input.content}\n${signer}\n${at}\n${input.signatureDataUrl}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const sha256 = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  await getDb().signedDocs.put({
    id: uid(), kind: input.kind, signerName: signer, caseId: input.caseId,
    consentElectronic: true, signedAt: at, sha256,
    deviceInfo: navigator.userAgent.slice(0, 80), signatureDataUrl: input.signatureDataUrl,
  });
  return { sha256, at };
}
