"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretLeft, CaretRight, Warning, WarningOctagon, Check } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import type { AlertRow, ObsType } from "@/lib/types";
import { OBS_LABEL, OBS_UNIT } from "@/lib/types";
import { fmtDateTime } from "@/lib/digest";

// 管理端儀表板（示意）。正式版為獨立後台：
// LINE Flex 卡片一鍵認領、T+5 分簡訊、T+10 分語音輪撥（規格 02 冊 §3）。

const SNAPSHOT: ObsType[] = ["spo2", "bp", "hr", "bt"];

export default function AdminPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <AdminContent />;
}

function AdminContent() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const alerts = useLiveQuery(() => db.alerts.orderBy("triggeredAt").reverse().limit(30).toArray(), []);
  const latest = useLiveQuery(async () => {
    const out: Record<string, Partial<Record<ObsType, string>>> = {};
    for (const c of await db.cases.toArray()) {
      out[c.id] = {};
      for (const t of SNAPSHOT) {
        const rows = await db.observations.where("[caseId+type]").equals([c.id, t]).toArray();
        const o = rows.reduce<typeof rows[number] | undefined>(
          (acc, r) => (!acc || r.measuredAt > acc.measuredAt ? r : acc), undefined);
        if (o && o.value.main != null) {
          out[c.id][t] = t === "bp" && o.value.dbp != null ? `${o.value.main}/${o.value.dbp}` : String(o.value.main);
        }
      }
    }
    return out;
  }, []);

  const claim = (a: AlertRow) => db.alerts.update(a.id, { status: "claimed", claimedAt: new Date().toISOString() });
  const close = (a: AlertRow) => db.alerts.update(a.id, { status: "closed" });
  const nameOf = (id: string) => cases?.find((c) => c.id === id)?.name ?? "";

  const open = (alerts ?? []).filter((a) => a.status === "triggered" || a.status === "claimed");
  const closed = (alerts ?? []).filter((a) => a.status === "closed");
  const reds = open.filter((a) => a.level === "red").length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-5 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="t-head">管理端儀表板</h1>
          <p className="t-sub" style={{ maxWidth: "58ch" }}>
            示意版。正式版警報同步推播 LINE 值班群，一鍵認領；5 分鐘無人認領升級簡訊，
            10 分鐘語音輪撥，全程留存通知紀錄。
          </p>
        </div>
        <Link href="/today" className="t-label flex items-center gap-0.5 shrink-0" style={{ color: "var(--a-ink)" }}>
          <CaretLeft size={15} /> 護理師端
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {(cases ?? []).map((c) => (
          <div key={c.id} className="sheet">
            <div className="sheet-title">
              <span className="t-label">
                {c.name}
                <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>　{c.age} 歲・{c.setting}</span>
              </span>
              <Link href={`/case/${c.id}/trends`} className="t-micro flex items-center" style={{ color: "var(--a-ink)" }}>
                趨勢 <CaretRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-px" style={{ background: "var(--hairline)" }}>
              {SNAPSHOT.map((t) => (
                <div key={t} className="px-1 py-2 text-center" style={{ background: "var(--surface)" }}>
                  <div className="t-micro" style={{ letterSpacing: ".03em" }}>{OBS_LABEL[t]}</div>
                  <div className="num" style={{ fontSize: 17, fontWeight: 700 }}>
                    {latest?.[c.id]?.[t] ?? <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 13 }}>尚無</span>}
                  </div>
                  <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>{OBS_UNIT[t]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">警報佇列</span>
          <span className="t-micro num">
            {open.length} 件處理中{reds > 0 ? `　紅色 ${reds}` : ""}
          </span>
        </div>

        {open.length === 0 && <div className="empty">目前沒有未結案的警報</div>}

        {open.map((a) => (
          <div key={a.id} className={`row ${a.level === "red" ? "stripe stripe-critical" : "stripe stripe-caution"}`}>
            {a.level === "red"
              ? <WarningOctagon size={19} weight="fill" color="var(--critical)" className="shrink-0" />
              : <Warning size={18} weight="fill" color="var(--caution)" className="shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="t-label truncate">
                <span style={{ color: a.level === "red" ? "var(--critical)" : "var(--caution)" }}>
                  {nameOf(a.caseId)}
                </span>
                　{a.summary}
              </div>
              <div className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>
                {a.layer === "C" ? "個人基準線" : a.layer === "qualitative" ? "質性紅旗" : "絕對臨界值"}
                　{fmtDateTime(a.triggeredAt)}
                {a.claimedAt && `　已認領 ${fmtDateTime(a.claimedAt)}`}
                {a.handledNote && `　${a.handledNote}`}
              </div>
            </div>
            {a.status === "triggered"
              ? <button className="btn btn-primary shrink-0" style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }}
                        onClick={() => claim(a)}>認領</button>
              : <button className="btn btn-quiet shrink-0" style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }}
                        onClick={() => close(a)}>結案</button>}
          </div>
        ))}
      </section>

      {closed.length > 0 && (
        <details className="sheet">
          <summary className="sheet-title cursor-pointer">
            <span className="t-micro">已結案</span>
            <span className="t-micro num">{closed.length}</span>
          </summary>
          {closed.map((a) => (
            <div key={a.id} className="row">
              <Check size={15} color="var(--ink-3)" className="shrink-0" />
              <span className="t-sub flex-1 truncate">{nameOf(a.caseId)}　{a.summary}</span>
              <span className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>{fmtDateTime(a.triggeredAt)}</span>
            </div>
          ))}
        </details>
      )}
    </main>
  );
}
