"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Tray, Phone } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { REQUEST_STATUS_LABEL, type RequestStatus } from "@/lib/types";
import { advanceRequest, convertToCase } from "@/modules/customers";
import { fmtDateTime } from "@/lib/digest";

// 公司管理端「需求進線」：客戶線上需求的狀態機。成案即建立個案進入評估。

const FLOW: RequestStatus[] = ["new", "contacted", "quoted", "converted", "declined"];

export default function RequestsPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const [filter, setFilter] = useState<RequestStatus | "open">("open");
  const requests = useLiveQuery(() => db.requests.orderBy("createdAt").reverse().toArray(), []);

  const rows = (requests ?? []).filter((r) => filter === "open" ? (r.status === "new" || r.status === "contacted" || r.status === "quoted") : r.status === filter);
  const newCount = (requests ?? []).filter((r) => r.status === "new").length;

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1000px]">
      <header>
        <h1 className="t-head">需求進線</h1>
        <p className="t-sub">客戶端提出的需求在此處理：聯繫、報價、成案。成案會建立評估中的個案，交給派單。</p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <button className="opt" style={{ fontSize: 13, minHeight: 38 }} data-on={filter === "open"} onClick={() => setFilter("open")}>
          處理中{newCount > 0 ? `・${newCount} 新` : ""}
        </button>
        {FLOW.map((s) => (
          <button key={s} className="opt" style={{ fontSize: 13, minHeight: 38 }} data-on={filter === s} onClick={() => setFilter(s)}>{REQUEST_STATUS_LABEL[s]}</button>
        ))}
      </div>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">需求單</span><span className="t-micro num">{rows.length} 件</span></div>
        {rows.length === 0 && <div className="empty">沒有符合條件的需求</div>}
        {rows.map((r) => (
          <div key={r.id} className={`px-3.5 py-3 flex flex-col gap-2 ${r.status === "new" ? "stripe stripe-caution" : ""}`} style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <Tray size={16} color={r.status === "new" ? "var(--caution)" : "var(--ink-3)"} />
              <span className="t-label">{r.customerName}（{r.relation}）</span>
              <span className="t-sub num flex items-center gap-1"><Phone size={12} /> {r.phone}</span>
              <span className={`tag ${r.status === "new" ? "tag-caution" : r.status === "converted" ? "tag-accent" : ""}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
              <span className="t-micro num" style={{ marginLeft: "auto", fontWeight: 400, letterSpacing: 0 }}>{fmtDateTime(r.createdAt)}</span>
            </div>
            <div className="t-sub">
              {r.setting}・{r.area}・{r.shiftPref}・希望 {r.startDate} 開始
              <span className="ml-2 inline-flex gap-1">{r.needs.map((n) => <span key={n} className="tag">{n}</span>)}</span>
            </div>
            {r.note && <div className="t-sub" style={{ fontSize: 13 }}>{r.note}</div>}
            {(r.status === "new" || r.status === "contacted" || r.status === "quoted") && (
              <div className="flex gap-1.5 flex-wrap">
                {r.status === "new" && <button className="btn btn-primary" style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} onClick={() => advanceRequest(r.id, "contacted")}>標記已聯繫</button>}
                {r.status === "contacted" && <button className="btn btn-primary" style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} onClick={() => advanceRequest(r.id, "quoted")}>已報價</button>}
                {(r.status === "contacted" || r.status === "quoted") && <button className="btn btn-primary" style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} onClick={() => void convertToCase(r)}>成案建立個案</button>}
                <button className="btn btn-quiet" style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} onClick={() => advanceRequest(r.id, "declined")}>未成案</button>
              </div>
            )}
            {r.status === "converted" && r.caseId && (
              <Link href="/console/dispatch" className="t-label" style={{ color: "var(--a-ink)" }}>已建立個案，前往派單 →</Link>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
