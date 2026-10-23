import type { SendOutcome, Transport } from "./index";

/**
 * 以 PostgREST（Supabase 的 REST 介面）實作的傳送端，不需額外套件。
 * POST /rest/v1/<table>?on_conflict=id＋Prefer: resolution=ignore-duplicates
 * 等同 insert … on conflict (id) do nothing：重送不會重複寫入。
 * 權限由使用者的 access token 帶給 RLS（0003），伺服器端拒收即不可重試。
 */
export interface PostgrestConfig {
  url: string;                              // 例 https://xxxx.supabase.co
  apiKey: string;                           // anon key
  getAccessToken: () => Promise<string>;    // 登入後的 JWT
  fetchImpl?: typeof fetch;
}

/** 暫時性錯誤才重試：連線失敗、逾時、過量、token 過期（換新後重送）、伺服器錯誤 */
export const isRetryableStatus = (status: number): boolean =>
  status === 401 || status === 408 || status === 429 || status >= 500;

export function postgrestTransport(cfg: PostgrestConfig): Transport {
  const doFetch = cfg.fetchImpl ?? fetch;
  return {
    async send({ table, row }): Promise<SendOutcome> {
      let res: Response;
      try {
        res = await doFetch(`${cfg.url}/rest/v1/${table}?on_conflict=id`, {
          method: "POST",
          headers: {
            apikey: cfg.apiKey,
            Authorization: `Bearer ${await cfg.getAccessToken()}`,
            "Content-Type": "application/json",
            Prefer: "resolution=ignore-duplicates,return=minimal",
          },
          body: JSON.stringify(row),
        });
      } catch (err) {
        return { ok: false, retryable: true, error: err instanceof Error ? err.message : String(err) };
      }
      if (res.ok) return { ok: true };
      const body = await res.text().catch(() => "");
      return { ok: false, retryable: isRetryableStatus(res.status), error: `${res.status} ${body.slice(0, 300)}` };
    },
  };
}
