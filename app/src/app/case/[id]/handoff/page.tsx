"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Plus, Sparkle, Trash, Warning, WarningOctagon } from "@phosphor-icons/react";
import { getDb, uid } from "@/lib/db";
import { OBS_LABEL, OBS_UNIT } from "@/lib/types";
import { buildDigest, draftSummary } from "@/lib/digest";
import { round1 } from "@/lib/alert-engine";

// ISBAR 交班（規格 03 冊）：I 與 B 自動帶入，A 段系統彙整，
// 摘要草稿目前為規則式示意，正式版由 Claude API 生成並經數字接地檢查。

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

  const digest = useLiveQuery(async () => {
    const db = getDb();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const iso = start.toISOString();
    const obs = await db.observations.where("caseId").equals(caseId).filter((o) => o.measuredAt >= iso).toArray();
    const alerts = await db.alerts.where("caseId").equals(caseId).filter((a) => a.triggeredAt >= iso).toArray();
    return buildDigest(obs, alerts);
  }, [caseId]);

  // 給藥完成率（03 冊 A 段自動彙整項目）
  const medRate = useLiveQuery(async () => {
    const db = getDb();
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
    await getDb().handoffs.put({
      id: uid(), caseId, shiftId: "today",
      sIssues, sNote, aNote, rTodos: todos, summaryDraft: summary,
      status: "submitted", submittedAt: new Date().toISOString(),
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="sheet">
        <div className="row stripe stripe-ok">
          <Check size={20} weight="bold" color="var(--a)" />
          <span className="t-row">交班已送出</span>
        </div>
        <div className="px-3.5 py-3 t-sub">
          正式版流程：交班者 PIN 簽章，接班者逐項勾認（管路核對、藥品清點）後簽收歸檔；
          60 分鐘未簽收自動提醒管理端。
        </div>
      </div>
    );
  }

  const redCount = digest?.alerts.filter((a) => a.level === "red").length ?? 0;

  return (
    <div className="flex flex-col gap-3 pb-28">
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

        {/* 數值以值為主的方格呈現，不用逐列橫線的長表 */}
        {digest && digest.vitalRanges.length > 0 ? (
          <div className="grid grid-cols-2 gap-px" style={{ background: "var(--hairline)" }}>
            {digest.vitalRanges.map((v) => (
              <div key={v.type} className="px-3 py-2.5" style={{ background: "var(--surface)" }}>
                <div className="t-micro">{OBS_LABEL[v.type]}　{v.count} 次</div>
                <div className="num" style={{ fontSize: 19, fontWeight: 700 }}>
                  {round1(v.min)}
                  <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> 至 </span>
                  {round1(v.max)}
                  <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}> {OBS_UNIT[v.type]}</span>
                </div>
                <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
                  最近 <span className="num">{round1(v.latest)}</span>
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
          <span className="num t-label">
            入 {digest?.ioIn ?? 0}
            <span style={{ color: "var(--ink-3)" }}> / </span>
            出 {digest?.ioOut ?? 0} ml
          </span>
        </div>

        <div className="row">
          <span className="t-label flex-1">警報</span>
          {(digest?.alerts.length ?? 0) === 0
            ? <span className="tag">本班無警報</span>
            : (
              <span className="flex gap-1.5">
                {redCount > 0 && (
                  <span className="tag tag-critical">
                    <WarningOctagon size={11} weight="fill" /> 紅 {redCount}
                  </span>
                )}
                {digest!.alerts.length - redCount > 0 && (
                  <span className="tag tag-caution">
                    <Warning size={11} weight="fill" /> 黃 {digest!.alerts.length - redCount}
                  </span>
                )}
              </span>
            )}
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
          <button className="btn btn-quiet" onClick={addTodo} aria-label="新增交辦事項">
            <Plus size={18} weight="bold" />
          </button>
        </div>
        {todos.map((t, i) => (
          <div key={i} className="row" style={{ borderTop: "1px solid var(--hairline)", borderBottom: "none" }}>
            <span className="t-label flex-1">{t.text}</span>
            <button className="btn btn-quiet" style={{ minHeight: 36, padding: "0 8px" }}
                    onClick={() => setTodos(todos.filter((_, j) => j !== i))} aria-label="移除">
              <Trash size={15} />
            </button>
          </div>
        ))}
      </section>

      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">交班摘要</span>
          <button className="btn btn-quiet" style={{ minHeight: 34, padding: "0 10px", fontSize: 13 }}
                  onClick={genSummary}>
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
              目前為規則式草稿，所有數字直接取自紀錄。正式版由 Claude API 生成，
              經數字接地檢查與人工確認後送出，介面固定標示「AI 生成摘要，以原始紀錄為準」。
            </div>
          </>
        ) : (
          <div className="empty">尚未產生草稿。系統會把本班數據與上方填寫內容整理成接班者 30 秒可讀完的重點。</div>
        )}
      </section>

      <button className="btn btn-primary w-full" style={{ minHeight: 52 }}
              disabled={!summary && sIssues.length === 0} onClick={submit}>
        送出交班
      </button>
    </div>
  );
}
