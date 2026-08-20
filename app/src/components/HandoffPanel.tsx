"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Plus, Sparkle, Trash, Warning, WarningOctagon, ArchiveBoxIcon as ArchiveBox } from "@phosphor-icons/react";
import { getDb, uid } from "@/lib/db";
import type { Handoff } from "@/lib/types";
import { OBS_LABEL, OBS_UNIT } from "@/lib/types";
import { buildDigest, draftSummary, fmtDateTime } from "@/lib/digest";
import { round1 } from "@/lib/alert-engine";

// ISBAR 交班＋簽收狀態機（規格 03 冊）：
// 草稿 → 送出 → 簽收（勾稽區逐項勾認）→ 歸檔；接班者可提出疑義退回補充。
// 示範模式：同一裝置先後扮演交班者與接班者。

const S_OPTIONS = ["發燒", "呼吸喘", "疼痛", "意識改變", "血糖異常", "跌倒", "管路事件", "進食差", "無特殊"];

const CHECK_ITEMS = [
  "管路已逐條核對",
  "藥品已清點無誤",
  "病人當下狀態已確認",
  "特殊物品已交接",
];

export function HandoffPanel({ caseId }: { caseId: string }) {
  const db = getDb();
  const [startNew, setStartNew] = useState(false);

  const latest = useLiveQuery(async () => {
    const rows = await db.handoffs.where("caseId").equals(caseId).toArray();
    return rows.reduce<Handoff | undefined>(
      (a, r) => (!a || (r.submittedAt ?? "") > (a.submittedAt ?? "") ? r : a), undefined);
  }, [caseId]);

  if (latest && !startNew) {
    if (latest.status === "submitted") return <SignOffView h={latest} />;
    if (latest.status === "received") return <ArchivedView h={latest} onNew={() => setStartNew(true)} />;
  }
  const draft = latest?.status === "draft" ? latest : undefined;
  return <HandoffForm key={draft?.id ?? "new"} caseId={caseId} draft={draft}
                      onSubmitted={() => setStartNew(false)} />;
}

/* ---------- 交班者：填寫與送出 ---------- */

function HandoffForm({ caseId, draft, onSubmitted }: { caseId: string; draft?: Handoff; onSubmitted: () => void }) {
  const db = getDb();
  // 疑義退回時以 key 重新掛載，初始值直接載回原稿供補充
  const [sIssues, setSIssues] = useState<string[]>(() => draft?.sIssues ?? []);
  const [sNote, setSNote] = useState(() => draft?.sNote ?? "");
  const [aNote, setANote] = useState(() => draft?.aNote ?? "");
  const [todoText, setTodoText] = useState("");
  const [todos, setTodos] = useState<{ text: string }[]>(() => draft?.rTodos ?? []);
  const [summary, setSummary] = useState(() => draft?.summaryDraft ?? "");
  const [supplement, setSupplement] = useState(() => draft?.supplementNote ?? "");

  const info = useLiveQuery(() => db.cases.get(caseId), [caseId]);

  const digest = useLiveQuery(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const iso = start.toISOString();
    const obs = await db.observations.where("caseId").equals(caseId).filter((o) => o.measuredAt >= iso).toArray();
    const alerts = await db.alerts.where("caseId").equals(caseId).filter((a) => a.triggeredAt >= iso).toArray();
    return buildDigest(obs, alerts);
  }, [caseId]);

  const medRate = useLiveQuery(async () => {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const meds = await db.meds.where("caseId").equals(caseId).toArray();
    const due = meds.flatMap((m) => m.slots.filter((s) => s <= d.getHours())).length;
    const logs = (await db.medLogs.where("caseId").equals(caseId).toArray()).filter((l) => l.date === date);
    return { due, given: logs.filter((l) => l.status === "given").length, withheld: logs.filter((l) => l.status === "withheld").length };
  }, [caseId]);

  const toggleS = (opt: string) =>
    setSIssues((cur) => cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);

  const addTodo = () => {
    if (!todoText.trim()) return;
    setTodos([...todos, { text: todoText.trim() }]);
    setTodoText("");
  };

  function genSummary() {
    if (!digest || !info) return;
    let s = draftSummary(digest, sIssues, aNote);
    if (medRate && medRate.due > 0) {
      s += `\n給藥：${medRate.given} / ${medRate.due} 已給${medRate.withheld > 0 ? `，未給 ${medRate.withheld} 次（原因見紀錄）` : ""}。`;
    }
    setSummary(s);
  }

  async function submit() {
    await db.handoffs.put({
      id: draft?.id ?? uid(), caseId, shiftId: "today",
      sIssues, sNote, aNote, rTodos: todos, summaryDraft: summary,
      status: "submitted", submittedAt: new Date().toISOString(),
      disputeNote: draft?.disputeNote, supplementNote: supplement || undefined,
    });
    onSubmitted();
  }

  const redCount = digest?.alerts.filter((a) => a.level === "red").length ?? 0;

  return (
    <div className="flex flex-col gap-3 pb-28">
      {draft?.disputeNote && (
        <div className="sheet stripe stripe-caution">
          <div className="sheet-title"><span className="t-micro" style={{ color: "var(--caution)" }}>接班者疑義（退回補充）</span></div>
          <div className="px-3.5 py-2.5 t-sub" style={{ color: "var(--caution)" }}>{draft.disputeNote}</div>
          <div className="p-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
            <textarea className="textfield" style={{ minHeight: 64 }} placeholder="補充說明後重新送出"
                      value={supplement} onChange={(e) => setSupplement(e.target.value)} />
          </div>
        </div>
      )}

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">I 識別與 B 背景（自動帶入）</span></div>
        {info && (
          <div className="px-3.5 py-3 t-sub">
            {info.name}・{info.age} 歲・{info.setting}　{info.dx}
            <div className="t-micro mt-1" style={{ letterSpacing: 0, fontWeight: 400 }}>
              過敏 {info.allergies}　管路 {info.tubes.join("、") || "無"}
            </div>
          </div>
        )}
      </section>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">S 情況：本班主要問題</span></div>
        <div className="p-2.5 flex flex-wrap gap-1.5">
          {S_OPTIONS.map((o) => (
            <button key={o} className="opt" style={{ fontSize: 13, padding: "0 10px" }}
                    data-on={sIssues.includes(o)} onClick={() => toggleS(o)}>{o}</button>
          ))}
        </div>
        <div className="px-2.5 pb-2.5">
          <input className="textfield" placeholder="一句話描述（選填）"
                 value={sNote} onChange={(e) => setSNote(e.target.value)} />
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">A 評估：本班數據</span>
          <span className="t-micro num">{digest?.obsCount ?? 0} 筆紀錄</span>
        </div>
        {digest && digest.vitalRanges.length > 0 ? (
          <div className="grid grid-cols-2 gap-px" style={{ background: "var(--hairline)" }}>
            {digest.vitalRanges.map((v) => (
              <div key={v.type} className="px-3 py-2.5" style={{ background: "var(--surface)" }}>
                <div className="t-micro">{OBS_LABEL[v.type]}　{v.count} 次</div>
                <div className="num" style={{ fontSize: 19, fontWeight: 700 }}>
                  {round1(v.min)}<span style={{ color: "var(--ink-3)", fontWeight: 400 }}> 至 </span>{round1(v.max)}
                  <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}> {OBS_UNIT[v.type]}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">本班尚無量測紀錄</div>
        )}
        <div className="row" style={{ borderTop: "1px solid var(--hairline)" }}>
          <span className="t-label flex-1">給藥（截至目前）</span>
          <span className="num t-label">
            {medRate ? `${medRate.given} / ${medRate.due} 已給${medRate.withheld > 0 ? `，未給 ${medRate.withheld}` : ""}` : "…"}
          </span>
        </div>
        <div className="row">
          <span className="t-label flex-1">攝入與排出</span>
          <span className="num t-label">入 {digest?.ioIn ?? 0} / 出 {digest?.ioOut ?? 0} ml</span>
        </div>
        <div className="row">
          <span className="t-label flex-1">警報</span>
          {(digest?.alerts.length ?? 0) === 0
            ? <span className="tag">本班無警報</span>
            : <span className="flex gap-1.5">
                {redCount > 0 && <span className="tag tag-critical"><WarningOctagon size={11} weight="fill" /> 紅 {redCount}</span>}
                {digest!.alerts.length - redCount > 0 && <span className="tag tag-caution"><Warning size={11} weight="fill" /> 黃 {digest!.alerts.length - redCount}</span>}
              </span>}
        </div>
        <div className="p-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
          <textarea className="textfield" style={{ minHeight: 92 }} placeholder="護理師評估（自由文字）"
                    value={aNote} onChange={(e) => setANote(e.target.value)} />
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">R 建議：交辦事項</span></div>
        <div className="p-2.5 flex gap-2">
          <input className="textfield flex-1" placeholder="例：14:00 回診、飯後測血糖"
                 value={todoText} onChange={(e) => setTodoText(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }} />
          <button className="btn btn-quiet" onClick={addTodo} aria-label="新增交辦事項"><Plus size={18} weight="bold" /></button>
        </div>
        {todos.map((t, i) => (
          <div key={i} className="row" style={{ borderTop: "1px solid var(--hairline)", borderBottom: "none" }}>
            <span className="t-label flex-1">{t.text}</span>
            <button className="btn btn-quiet" style={{ minHeight: 36, padding: "0 8px" }}
                    onClick={() => setTodos(todos.filter((_, j) => j !== i))} aria-label="移除"><Trash size={15} /></button>
          </div>
        ))}
      </section>

      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">交班摘要</span>
          <button className="btn btn-quiet" style={{ minHeight: 34, padding: "0 10px", fontSize: 13 }} onClick={genSummary}>
            <Sparkle size={14} weight="fill" /> 產生草稿
          </button>
        </div>
        {summary ? (
          <>
            <div className="p-2.5">
              <textarea className="textfield" style={{ minHeight: 190, fontSize: 14 }}
                        value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className="px-3.5 pb-3 t-micro" style={{ letterSpacing: 0, fontWeight: 400 }}>
              規則式草稿，所有數字直接取自紀錄。正式版由 Claude API 生成，經數字接地檢查與人工確認。
            </div>
          </>
        ) : (
          <div className="empty">尚未產生草稿。系統會把本班數據整理成接班者 30 秒可讀完的重點。</div>
        )}
      </section>

      <button className="btn btn-primary w-full" style={{ minHeight: 52 }}
              disabled={!summary && sIssues.length === 0} onClick={submit}>
        {draft ? "補充完成，重新送出" : "送出交班（交班者簽章）"}
      </button>
    </div>
  );
}

/* ---------- 接班者：簽收 ---------- */

function SignOffView({ h }: { h: Handoff }) {
  const db = getDb();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [disputeText, setDisputeText] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const allChecked = CHECK_ITEMS.every((c) => checks[c]);

  async function receive() {
    await db.handoffs.update(h.id, {
      status: "received", receivedAt: new Date().toISOString(), checklist: checks,
    });
  }

  async function dispute() {
    if (!disputeText.trim()) return;
    await db.handoffs.update(h.id, { status: "draft", disputeNote: disputeText.trim() });
  }

  return (
    <div className="flex flex-col gap-3 pb-28">
      <div className="sheet stripe stripe-ok">
        <div className="sheet-title">
          <span className="t-micro" style={{ color: "var(--a-ink)" }}>接班簽收（示範：本裝置切換為接班者視角）</span>
          <span className="t-micro num">送出 {h.submittedAt ? fmtDateTime(h.submittedAt) : ""}</span>
        </div>
        <div className="px-3.5 py-2.5 t-sub">
          交班者已完成簽章送出。請閱讀摘要、完成勾稽區逐項勾認後簽收；有疑問可退回請交班者補充。
          正式版：接班 60 分鐘未簽收自動提醒管理端。
        </div>
      </div>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">交班摘要</span></div>
        <div className="px-3.5 py-3 t-sub" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
          {h.summaryDraft || "（無摘要）"}
        </div>
        {h.supplementNote && (
          <div className="px-3.5 py-2.5 t-sub" style={{ borderTop: "1px solid var(--hairline)" }}>
            <b>交班者補充：</b>{h.supplementNote}
          </div>
        )}
        {h.rTodos.length > 0 && (
          <div className="px-3.5 py-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
            <div className="t-micro mb-1">交辦事項</div>
            {h.rTodos.map((t, i) => <div key={i} className="t-label">☐ {t.text}</div>)}
          </div>
        )}
      </section>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">勾稽區（逐項勾認後才能簽收）</span></div>
        {CHECK_ITEMS.map((c) => (
          <button key={c} className="row row-tap w-full"
                  onClick={() => setChecks((prev) => ({ ...prev, [c]: !prev[c] }))}>
            <span className="flex items-center justify-center shrink-0"
                  style={{ width: 24, height: 24, borderRadius: 6,
                           border: checks[c] ? "none" : "1.5px solid var(--line)",
                           background: checks[c] ? "var(--a)" : "var(--surface)" }}>
              {checks[c] && <Check size={15} weight="bold" color="#fff" />}
            </span>
            <span className="t-label">{c}</span>
          </button>
        ))}
      </section>

      <button className="btn btn-primary w-full" style={{ minHeight: 52 }} disabled={!allChecked} onClick={receive}>
        {allChecked ? "確認簽收" : `尚有 ${CHECK_ITEMS.filter((c) => !checks[c]).length} 項未勾認`}
      </button>

      {!showDispute ? (
        <button className="btn btn-quiet w-full" onClick={() => setShowDispute(true)}>提出疑義（退回補充）</button>
      ) : (
        <div className="sheet">
          <div className="p-2.5 flex flex-col gap-2">
            <textarea className="textfield" style={{ minHeight: 72 }} placeholder="疑義內容，例：藥品數量與紀錄不符"
                      value={disputeText} onChange={(e) => setDisputeText(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn btn-quiet flex-1" onClick={() => setShowDispute(false)}>取消</button>
              <button className="btn btn-primary flex-1" disabled={!disputeText.trim()} onClick={dispute}>退回請交班者補充</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 歸檔 ---------- */

function ArchivedView({ h, onNew }: { h: Handoff; onNew: () => void }) {
  return (
    <div className="flex flex-col gap-3 pb-28">
      <div className="sheet">
        <div className="row stripe stripe-ok">
          <ArchiveBox size={20} weight="fill" color="var(--a)" />
          <div className="flex-1">
            <div className="t-row">交班已簽收歸檔</div>
            <div className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>
              送出 {h.submittedAt ? fmtDateTime(h.submittedAt) : ""}　簽收 {h.receivedAt ? fmtDateTime(h.receivedAt) : ""}
            </div>
          </div>
        </div>
        <div className="px-3.5 py-2.5 t-sub" style={{ whiteSpace: "pre-wrap" }}>{h.summaryDraft}</div>
        <div className="px-3.5 py-2.5 t-micro" style={{ borderTop: "1px solid var(--hairline)", letterSpacing: 0, fontWeight: 400 }}>
          勾稽區 {Object.values(h.checklist ?? {}).filter(Boolean).length} / {CHECK_ITEMS.length} 項已勾認。
          歸檔後不可修改（append-only），補充以附註形式掛上。
        </div>
      </div>
      <button className="btn btn-primary w-full" onClick={onNew}>開始本班新交班</button>
    </div>
  );
}
