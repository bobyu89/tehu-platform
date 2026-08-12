"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, uid } from "@/lib/db";
import { OBS_LABEL, OBS_UNIT } from "@/lib/types";
import { buildDigest, draftSummary } from "@/lib/digest";
import { round1 } from "@/lib/alert-engine";

// ISBAR 交班（03 冊）：I/B 自動帶入、A 段系統彙整、AI 摘要草稿（demo 為規則式示意）。

const S_OPTIONS = ["發燒", "呼吸喘", "疼痛", "意識改變", "血糖異常", "跌倒", "管路事件", "進食差", "無特殊"];

export default function HandoffPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const [sIssues, setSIssues] = useState<string[]>([]);
  const [sNote, setSNote] = useState("");
  const [aNote, setANote] = useState("");
  const [todoText, setTodoText] = useState("");
  const [todos, setTodos] = useState<{ text: string }[]>([]);
  const [summary, setSummary] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const info = useLiveQuery(() => getDb().cases.get(caseId), [caseId]);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const digest = useLiveQuery(async () => {
    const db = getDb();
    const iso = todayStart.toISOString();
    const obs = await db.observations.where("caseId").equals(caseId)
      .filter((o) => o.measuredAt >= iso).toArray();
    const alerts = await db.alerts.where("caseId").equals(caseId)
      .filter((a) => a.triggeredAt >= iso).toArray();
    return buildDigest(obs, alerts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function toggleS(opt: string) {
    setSIssues((cur) => cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  }

  function genSummary() {
    if (!digest || !info) return;
    setSummary(draftSummary(info.name, digest, sIssues, aNote));
  }

  async function submit() {
    const db = getDb();
    await db.handoffs.put({
      id: uid(), caseId, shiftId: "today",
      sIssues, sNote, aNote, rTodos: todos, summaryDraft: summary,
      status: "submitted", submittedAt: new Date().toISOString(),
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="card p-6 text-center flex flex-col gap-3 items-center">
        <div className="text-2xl font-black" style={{ color: "var(--c-accent-ink)" }}>✓ 交班已送出</div>
        <p className="text-sm leading-6" style={{ color: "var(--c-muted)" }}>
          正式版流程：交班者 PIN 簽章 → 接班者逐項勾認（管路核對、藥品清點）→ 簽收歸檔；60 分鐘未簽收自動提醒管理端。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* I＋B：全自動帶入 */}
      <div className="card p-4 text-sm">
        <div className="field-label mb-1">I 識別／B 背景（自動帶入）</div>
        {info && (
          <p className="leading-6">
            {info.name}・{info.age} 歲・{info.setting}｜{info.dx}｜過敏：{info.allergies}
            <br />管路：{info.tubes.join("、") || "無"}
          </p>
        )}
      </div>

      {/* S */}
      <div className="card p-4">
        <div className="field-label mb-2">S 情況：本班主要問題（複選）</div>
        <div className="flex flex-wrap gap-1.5">
          {S_OPTIONS.map((o) => (
            <button key={o} className="seg-btn" data-on={sIssues.includes(o)} onClick={() => toggleS(o)}>{o}</button>
          ))}
        </div>
        <input className="field-input mt-3 !text-base !font-normal" placeholder="一句話描述（選填）"
               value={sNote} onChange={(e) => setSNote(e.target.value)} />
      </div>

      {/* A：系統彙整＋評估 */}
      <div className="card p-4">
        <div className="field-label mb-2">A 評估：本班數據（系統彙整）</div>
        {digest && (
          <div className="text-sm flex flex-col gap-1 mono">
            {digest.vitalRanges.map((v) => (
              <div key={v.type} className="flex justify-between border-b py-1" style={{ borderColor: "var(--c-line)" }}>
                <span style={{ fontFamily: "inherit" }}>{OBS_LABEL[v.type]}</span>
                <span>{round1(v.min)}–{round1(v.max)}{OBS_UNIT[v.type]}（{v.count} 次）</span>
              </div>
            ))}
            <div className="flex justify-between py-1">
              <span>I/O</span><span>入 {digest.ioIn} ml／出 {digest.ioOut} ml</span>
            </div>
            <div className="flex justify-between py-1">
              <span>警報</span>
              <span>{digest.alerts.length === 0 ? "無" : `${digest.alerts.length} 件（紅 ${digest.alerts.filter(a => a.level === "red").length}）`}</span>
            </div>
          </div>
        )}
        <textarea className="field-input mt-3 !text-base !font-normal min-h-24" placeholder="護理師評估（自由文字）"
                  value={aNote} onChange={(e) => setANote(e.target.value)} />
      </div>

      {/* R */}
      <div className="card p-4">
        <div className="field-label mb-2">R 建議：交辦事項</div>
        <div className="flex gap-2">
          <input className="field-input !text-base !font-normal flex-1" placeholder="例：14:00 回診、PC 血糖"
                 value={todoText} onChange={(e) => setTodoText(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter" && todoText.trim()) { setTodos([...todos, { text: todoText.trim() }]); setTodoText(""); } }} />
          <button className="btn-ghost" onClick={() => { if (todoText.trim()) { setTodos([...todos, { text: todoText.trim() }]); setTodoText(""); } }}>＋</button>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {todos.map((t, i) => (
            <li key={i} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: "var(--c-accent-soft)" }}>
              <span className="font-bold">☐ {t.text}</span>
              <button className="text-xs" style={{ color: "var(--c-muted)" }} onClick={() => setTodos(todos.filter((_, j) => j !== i))}>移除</button>
            </li>
          ))}
        </ul>
      </div>

      {/* AI 摘要 */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="field-label">交班摘要</div>
          <button className="btn-ghost !min-h-10 text-sm" onClick={genSummary}>產生摘要草稿</button>
        </div>
        {summary && (
          <>
            <textarea className="field-input mt-2 !text-sm !font-normal min-h-44 leading-6"
                      value={summary} onChange={(e) => setSummary(e.target.value)} />
            <p className="mt-1 text-[11px]" style={{ color: "var(--c-muted)" }}>
              示意：目前為規則式草稿（所有數字直接取自紀錄）。正式版由 Claude API 生成，經數字接地檢查＋人工確認——「AI 生成摘要，以原始紀錄為準」。
            </p>
          </>
        )}
      </div>

      <button className="btn-primary w-full !min-h-14" disabled={!summary && sIssues.length === 0} onClick={submit}>
        送出交班（示範）
      </button>
    </div>
  );
}
