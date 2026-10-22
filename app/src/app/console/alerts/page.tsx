"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Warning, WarningOctagon } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import type { AlertRow } from "@/lib/types";
import * as alertOps from "@/modules/alerts";
import { layerLabel } from "@/modules/alerts";
import { fmtDateTime } from "@/lib/digest";

// 警報中心：全量佇列＋篩選。生命週期 觸發→認領→處置→結案（規格 02 冊 §3.2）。

type StatusFilter = "open" | "closed" | "all";
type LevelFilter = "all" | "red" | "yellow";

export default function AlertsPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <AlertsContent />;
}

function AlertsContent() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [level, setLevel] = useState<LevelFilter>("all");

  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const alerts = useLiveQuery(() => db.alerts.orderBy("triggeredAt").reverse().limit(200).toArray(), []);

  const rows = (alerts ?? []).filter((a) => {
    if (status === "open" && a.status === "closed") return false;
    if (status === "closed" && a.status !== "closed") return false;
    if (level !== "all" && a.level !== level) return false;
    return true;
  });

  const nameOf = (id: string) => cases?.find((c) => c.id === id)?.name ?? "";
  const claim = (a: AlertRow) => alertOps.claim(a.id);
  const close = (a: AlertRow) => alertOps.close(a.id);

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1000px]">
      <header>
        <h1 className="t-head">警報中心</h1>
        <p className="t-sub">
          生命週期：觸發、認領、處置、結案。正式版每次通知嘗試（LINE／簡訊／語音）皆入庫留存，作為通知義務之舉證。
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {([["open", "處理中"], ["closed", "已結案"], ["all", "全部"]] as const).map(([k, label]) => (
          <button key={k} className="opt" style={{ fontSize: 13, minHeight: 40 }} data-on={status === k} onClick={() => setStatus(k)}>{label}</button>
        ))}
        <span style={{ width: 12 }} />
        {([["all", "全部級別"], ["red", "紅色"], ["yellow", "黃色"]] as const).map(([k, label]) => (
          <button key={k} className="opt" style={{ fontSize: 13, minHeight: 40 }} data-on={level === k} onClick={() => setLevel(k)}>{label}</button>
        ))}
      </div>

      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">符合條件</span>
          <span className="t-micro num">{rows.length} 件</span>
        </div>
        {rows.length === 0 && <div className="empty">沒有符合條件的警報</div>}
        {rows.map((a) => (
          <div key={a.id}
               className={`row ${a.status !== "closed" ? (a.level === "red" ? "stripe stripe-critical" : "stripe stripe-caution") : ""}`}>
            {a.status === "closed"
              ? <Check size={16} color="var(--ink-3)" className="shrink-0" />
              : a.level === "red"
                ? <WarningOctagon size={18} weight="fill" color="var(--critical)" className="shrink-0" />
                : <Warning size={17} weight="fill" color="var(--caution)" className="shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className={`t-label truncate ${a.status === "closed" ? "" : ""}`}
                   style={a.status === "closed" ? { color: "var(--ink-2)" } : undefined}>
                {nameOf(a.caseId)}　{a.summary}
              </div>
              <div className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>
                {layerLabel(a.layer)}　{fmtDateTime(a.triggeredAt)}
                {a.claimedAt && `　認領 ${fmtDateTime(a.claimedAt)}`}
                {a.handledNote && `　${a.handledNote}`}
              </div>
            </div>
            {a.status === "triggered" && (
              <button className="btn btn-primary shrink-0" style={{ minHeight: 36, padding: "0 11px", fontSize: 13 }} onClick={() => claim(a)}>認領</button>
            )}
            {a.status === "claimed" && (
              <button className="btn btn-quiet shrink-0" style={{ minHeight: 36, padding: "0 11px", fontSize: 13 }} onClick={() => close(a)}>結案</button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
