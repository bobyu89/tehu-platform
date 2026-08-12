"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import type { AlertRow, ObsType } from "@/lib/types";
import { OBS_LABEL, OBS_UNIT } from "@/lib/types";
import { fmtDateTime } from "@/lib/digest";

// 管理端儀表板（示意）：個案總覽＋警報佇列（認領→處置→結案）。
// 正式版為獨立後台：LINE Flex 卡片一鍵認領、T+5 簡訊、T+10 語音輪撥（02 冊 §3）。

const SNAPSHOT_TYPES: ObsType[] = ["spo2", "bp", "hr", "bt"];

export default function AdminPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <AdminContent />;
}

function AdminContent() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const alerts = useLiveQuery(
    () => db.alerts.orderBy("triggeredAt").reverse().limit(30).toArray(), []);
  const latest = useLiveQuery(async () => {
    const out: Record<string, Partial<Record<ObsType, { v: string; at: string }>>> = {};
    for (const c of await db.cases.toArray()) {
      out[c.id] = {};
      for (const t of SNAPSHOT_TYPES) {
        const rows = await db.observations.where("[caseId+type]").equals([c.id, t]).toArray();
        const o = rows.reduce<typeof rows[number] | undefined>(
          (acc, r) => (!acc || r.measuredAt > acc.measuredAt ? r : acc), undefined);
        if (o && o.value.main != null) {
          const extra = t === "bp" && o.value.dbp != null ? `/${o.value.dbp}` : "";
          out[c.id][t] = { v: `${o.value.main}${extra}`, at: o.measuredAt };
        }
      }
    }
    return out;
  }, []);

  async function claim(a: AlertRow) {
    await db.alerts.update(a.id, { status: "claimed", claimedAt: new Date().toISOString() });
  }
  async function close(a: AlertRow) {
    await db.alerts.update(a.id, { status: "closed" });
  }

  const open = (alerts ?? []).filter((a) => a.status === "triggered" || a.status === "claimed");
  const closed = (alerts ?? []).filter((a) => a.status === "closed");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">管理端儀表板</h1>
          <p className="text-xs mt-1" style={{ color: "var(--c-muted)" }}>
            示意版。正式版：警報同步推播 LINE 值班群（Flex 一鍵認領）→ T+5 分簡訊 → T+10 分語音輪撥，全程留存通知紀錄。
          </p>
        </div>
        <Link href="/today" className="text-sm font-bold shrink-0" style={{ color: "var(--c-accent-ink)" }}>← 護理師端</Link>
      </header>

      <section>
        <h2 className="text-sm font-black mb-2" style={{ color: "var(--c-muted)" }}>個案總覽</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(cases ?? []).map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-black">{c.name} <span className="text-xs font-bold" style={{ color: "var(--c-muted)" }}>{c.age} 歲・{c.setting}</span></div>
                <Link href={`/case/${c.id}/trends`} className="text-xs font-bold" style={{ color: "var(--c-accent-ink)" }}>趨勢 →</Link>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {SNAPSHOT_TYPES.map((t) => (
                  <div key={t} className="rounded-lg py-1.5" style={{ background: "var(--c-accent-soft)" }}>
                    <div className="text-[10px] font-bold" style={{ color: "var(--c-muted)" }}>{OBS_LABEL[t]}</div>
                    <div className="text-sm font-black mono">{latest?.[c.id]?.[t]?.v ?? "—"}</div>
                    <div className="text-[9px]" style={{ color: "var(--c-muted)" }}>{OBS_UNIT[t]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-black mb-2" style={{ color: "var(--c-muted)" }}>警報佇列（{open.length} 件處理中）</h2>
        <div className="flex flex-col gap-2">
          {open.length === 0 && <div className="card p-4 text-sm" style={{ color: "var(--c-muted)" }}>目前無未結案警報</div>}
          {open.map((a) => (
            <div key={a.id} className="card p-3.5 flex items-center gap-3"
                 style={a.level === "red" ? { borderColor: "var(--c-red-line)", background: "var(--c-red-bg)" } : { borderColor: "var(--c-yellow-line)", background: "var(--c-yellow-bg)" }}>
              <span className={a.level === "red" ? "chip chip-red shrink-0" : "chip chip-yellow shrink-0"}>
                {a.level === "red" ? "紅" : "黃"}・{a.layer === "C" ? "基準線" : a.layer === "qualitative" ? "質性" : "A 層"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{(cases ?? []).find((c) => c.id === a.caseId)?.name}：{a.summary}</div>
                <div className="text-[11px] mono" style={{ color: "var(--c-muted)" }}>
                  {fmtDateTime(a.triggeredAt)}
                  {a.claimedAt && `・已認領 ${fmtDateTime(a.claimedAt)}`}
                  {a.handledNote && `・${a.handledNote}`}
                </div>
              </div>
              {a.status === "triggered"
                ? <button className="btn-primary !min-h-10 text-sm shrink-0" onClick={() => claim(a)}>認領</button>
                : <button className="btn-ghost !min-h-10 text-sm shrink-0" onClick={() => close(a)}>結案</button>}
            </div>
          ))}
        </div>
        {closed.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs font-bold cursor-pointer" style={{ color: "var(--c-muted)" }}>已結案（{closed.length}）</summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {closed.map((a) => (
                <div key={a.id} className="text-xs px-3 py-2 rounded-lg card" style={{ color: "var(--c-muted)" }}>
                  {fmtDateTime(a.triggeredAt)}・{a.summary}
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
