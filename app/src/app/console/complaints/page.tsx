"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChatCircleDots, Check } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { COMPLAINT_STATUS_LABEL, type ComplaintStatus } from "@/lib/types";
import { resolveComplaint, startInvestigation } from "@/modules/customers";
import { fmtDateTime } from "@/lib/digest";

// 公司管理端「客訴」：待處理 → 調查中 → 已結案，結案須填處理結果。

export default function ComplaintsPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const [filter, setFilter] = useState<ComplaintStatus | "all">("all");
  const [resolving, setResolving] = useState<string | null>(null);
  const [text, setText] = useState("");
  const complaints = useLiveQuery(() => db.complaints.orderBy("at").reverse().toArray(), []);
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const nurses = useLiveQuery(() => db.nurses.toArray(), []);

  const rows = (complaints ?? []).filter((c) => filter === "all" || c.status === filter);
  const caseName = (id?: string) => cases?.find((c) => c.id === id)?.name;
  const nurseName = (id?: string) => nurses?.find((n) => n.id === id)?.name;

  async function resolve(id: string) {
    if (!text.trim()) return;
    await resolveComplaint(id, text.trim());
    setResolving(null); setText("");
  }

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1000px]">
      <header>
        <h1 className="t-head">客訴</h1>
        <p className="t-sub">每件客訴都是流程改進的線索；結案必須留下處理結果，回饋到 SOP 與訓練。</p>
      </header>
      <div className="flex gap-1.5">
        <button className="opt" style={{ fontSize: 13, minHeight: 38 }} data-on={filter === "all"} onClick={() => setFilter("all")}>全部</button>
        {(["open", "investigating", "resolved"] as const).map((s) => (
          <button key={s} className="opt" style={{ fontSize: 13, minHeight: 38 }} data-on={filter === s} onClick={() => setFilter(s)}>{COMPLAINT_STATUS_LABEL[s]}</button>
        ))}
      </div>
      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">客訴案件</span><span className="t-micro num">{rows.length} 件</span></div>
        {rows.length === 0 && <div className="empty">沒有符合條件的客訴</div>}
        {rows.map((c) => (
          <div key={c.id} className={`px-3.5 py-3 flex flex-col gap-2 ${c.status === "open" ? "stripe stripe-critical" : c.status === "investigating" ? "stripe stripe-caution" : ""}`} style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <ChatCircleDots size={16} color={c.status === "resolved" ? "var(--ink-3)" : "var(--caution)"} />
              <span className="t-label">{c.customerName}</span>
              <span className="tag">{c.category}</span>
              {caseName(c.caseId) && <span className="t-sub">個案 {caseName(c.caseId)}</span>}
              {nurseName(c.nurseId) && <span className="t-sub">護理師 {nurseName(c.nurseId)}</span>}
              <span className={`tag ${c.status === "open" ? "tag-critical" : c.status === "investigating" ? "tag-caution" : "tag-accent"}`}>{COMPLAINT_STATUS_LABEL[c.status]}</span>
              <span className="t-micro num" style={{ marginLeft: "auto", fontWeight: 400, letterSpacing: 0 }}>{fmtDateTime(c.at)}</span>
            </div>
            <div className="t-sub">{c.detail}</div>
            {c.resolution && (
              <div className="t-sub px-3 py-2" style={{ background: "var(--a-wash)", borderRadius: "var(--r)" }}>
                <Check size={13} weight="bold" style={{ display: "inline", marginRight: 4 }} />處理結果（{c.handledBy}）：{c.resolution}
              </div>
            )}
            {c.status === "open" && <button className="btn btn-primary self-start" style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} onClick={() => startInvestigation(c.id, "護理長")}>開始調查</button>}
            {c.status === "investigating" && resolving !== c.id && <button className="btn btn-primary self-start" style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} onClick={() => setResolving(c.id)}>填寫處理結果並結案</button>}
            {resolving === c.id && (
              <div className="flex flex-col gap-2">
                <textarea className="textfield" style={{ minHeight: 64 }} placeholder="處理經過、對家屬的說明、流程調整…" value={text} onChange={(e) => setText(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn btn-quiet" onClick={() => setResolving(null)}>取消</button>
                  <button className="btn btn-primary" disabled={!text.trim()} onClick={() => void resolve(c.id)}>結案</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
