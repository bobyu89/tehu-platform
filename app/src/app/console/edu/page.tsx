"use client";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpenText, FilmSlate, ImageSquare, MagnifyingGlass, PaperPlaneTilt, SpeakerHigh, Warning } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import type { EduUnit } from "@/lib/types";
import { recordPush } from "@/modules/edu";
import { fmtDateTime } from "@/lib/digest";

// 衛教管理（規劃書 08 冊）：中文衛教知識庫的查詢、檢視與推送。
// 核心原則沿用衛教機器人 PRO MAX 的設計：
// 1. content 是唯一事實來源；查無主題就明說「知識庫沒有」，不自由發揮（範圍外攔截）
// 2. media 只放資產編號，由系統解析，永不生成連結
// 3. 未經審核的單元不得對外推送（本示範全數為未審核草稿）

const AUDIENCES = ["全部", "家屬", "照護者", "病人"] as const;

export default function EduPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const [q, setQ] = useState("");
  const [aud, setAud] = useState<(typeof AUDIENCES)[number]>("全部");
  const [selId, setSelId] = useState<string | null>(null);
  const [pushFor, setPushFor] = useState<EduUnit | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const units = useLiveQuery(() => db.eduUnits.toArray(), []);
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const pushes = useLiveQuery(() => db.eduPushes.orderBy("at").reverse().limit(8).toArray(), []);

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (units ?? [])
      .filter((u) => aud === "全部" || u.audience === aud)
      .filter((u) => {
        if (!kw) return true;
        return u.title.toLowerCase().includes(kw)
          || u.keywords.some((k) => k.toLowerCase().includes(kw) || kw.includes(k.toLowerCase()))
          || u.content.includes(kw);
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [units, q, aud]);

  const sel = (units ?? []).find((u) => u.id === selId) ?? list[0];

  async function push(unit: EduUnit, caseId: string) {
    await recordPush(unit.id, caseId);
    setPushFor(null);
    setFlash(`已加入推送紀錄：${unit.id}`);
    setTimeout(() => setFlash(null), 2000);
  }

  const nameOf = (id: string) => cases?.find((c) => c.id === id)?.name ?? "";
  const unitTitle = (id: string) => units?.find((u) => u.id === id)?.title ?? id;

  const MediaIcon = ({ kind }: { kind: string }) =>
    kind === "video" ? <FilmSlate size={14} /> : kind === "audio" ? <SpeakerHigh size={14} /> : <ImageSquare size={14} />;

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1200px]">
      <header>
        <h1 className="t-head">衛教管理</h1>
        <p className="t-sub" style={{ maxWidth: "62ch" }}>
          回答只來自審核過的單元內容，媒體以資產編號解析，查無主題就明確說沒有。
          正式版推送走家屬 LINE，並可由家屬提問（前置危機偵測層獨立於 AI 之外）。
        </p>
      </header>

      {/* 全庫未審核警示：醫療內容的誠實原則 */}
      <div className="sheet stripe stripe-caution flex items-start gap-2.5 px-3.5 py-3">
        <Warning size={18} weight="fill" color="var(--caution)" className="shrink-0 mt-0.5" />
        <span className="t-sub" style={{ color: "var(--caution)" }}>
          目前 {units?.length ?? 0} 個單元皆為<b>格式示範用草稿，未經衛教師審核</b>，僅供展示知識庫運作，
          不得作為實際衛教內容。正式路線：健康九九公開授權素材改寫，經合格衛教師審核後上架。
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">
        {/* 左：查詢與清單 */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color="var(--ink-3)" />
              <input className="textfield" style={{ paddingLeft: 34 }}
                     placeholder="用家屬的話搜尋：嗆到、翻身、頭暈冒冷汗…"
                     value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-1.5">
            {AUDIENCES.map((a) => (
              <button key={a} className="opt" style={{ fontSize: 13, minHeight: 38, padding: "0 11px" }}
                      data-on={aud === a} onClick={() => setAud(a)}>{a}</button>
            ))}
          </div>

          <section className="sheet">
            <div className="sheet-title">
              <span className="t-micro">衛教單元</span>
              <span className="t-micro num">{list.length} / {units?.length ?? 0}</span>
            </div>
            {list.map((u) => (
              <button key={u.id} className={`row row-tap w-full ${sel?.id === u.id ? "stripe stripe-ok" : ""}`}
                      onClick={() => setSelId(u.id)}>
                <span className="num t-micro shrink-0" style={{ width: 52 }}>{u.id}</span>
                <span className="t-label flex-1 text-left truncate">{u.title}</span>
                <span className="tag shrink-0">{u.audience}</span>
              </button>
            ))}
            {/* 範圍外攔截：查無主題明確說沒有 */}
            {list.length === 0 && (
              <div className="empty">
                知識庫尚無符合「{q}」的主題。<br />
                依安全設計，系統不會就知識庫外的主題自由發揮，請諮詢醫療團隊；
                此查詢已可作為知識庫擴充的依據。
              </div>
            )}
          </section>
        </div>

        {/* 右：單元內容 */}
        {sel ? (
          <section className="sheet">
            <div className="sheet-title">
              <span className="t-micro num">{sel.id}・{sel.audience}適用</span>
              <span className="tag tag-caution">草稿・未審核</span>
            </div>
            <div className="px-4 py-3">
              <h2 className="t-head flex items-center gap-2">
                <BookOpenText size={20} color="var(--a)" /> {sel.title}
              </h2>
              <p className="t-sub mt-3" style={{ lineHeight: 2 }}>{sel.content}</p>
            </div>

            <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <div className="t-micro mb-1">常見問法</div>
              <div className="flex flex-wrap gap-1.5">
                {sel.keywords.map((k) => <span key={k} className="tag">{k}</span>)}
              </div>
            </div>

            {sel.caution && (
              <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
                <div className="t-micro mb-1" style={{ color: "var(--caution)" }}>回覆界線（內部提示，不對家屬顯示）</div>
                <p className="t-sub" style={{ color: "var(--caution)" }}>{sel.caution}</p>
              </div>
            )}

            <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <div className="t-micro mb-1.5">媒體資產（僅引用編號，由系統解析）</div>
              {(sel.media ?? []).length === 0 && <span className="t-sub" style={{ color: "var(--ink-3)" }}>此單元未綁定媒體</span>}
              <div className="flex flex-col gap-1.5">
                {(sel.media ?? []).map((m) => (
                  <span key={m.code} className="tag self-start">
                    <MediaIcon kind={m.kind} /> {m.code}
                    {!m.ready && <span style={{ color: "var(--ink-3)" }}>・未上架</span>}
                  </span>
                ))}
              </div>
            </div>

            <div className="px-4 py-2.5 t-micro" style={{ borderTop: "1px solid var(--hairline)", fontWeight: 400, letterSpacing: 0 }}>
              來源：{sel.source}
            </div>

            <div className="p-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <button className="btn btn-primary w-full" onClick={() => setPushFor(sel)}>
                <PaperPlaneTilt size={16} weight="fill" /> 推送給家屬（示範）
              </button>
            </div>
          </section>
        ) : (
          <div className="sheet empty">左側選擇單元</div>
        )}
      </div>

      {/* 推送紀錄 */}
      {(pushes ?? []).length > 0 && (
        <section className="sheet" style={{ maxWidth: 720 }}>
          <div className="sheet-title"><span className="t-micro">推送紀錄</span></div>
          {(pushes ?? []).map((p) => (
            <div key={p.id} className="row">
              <PaperPlaneTilt size={15} color="var(--ink-3)" className="shrink-0" />
              <span className="t-label flex-1 truncate">{nameOf(p.caseId)}家屬　{unitTitle(p.unitId)}</span>
              <span className="t-micro num" style={{ fontWeight: 400, letterSpacing: 0 }}>{fmtDateTime(p.at)}</span>
            </div>
          ))}
        </section>
      )}

      {/* 推送確認：未審核一律擋下並說明 */}
      {pushFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
             style={{ background: "rgba(20,28,27,.45)" }} onClick={() => setPushFor(null)}>
          <div className="sheet enter w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title"><span className="t-micro">推送「{pushFor.title}」</span></div>
            {!pushFor.reviewed ? (
              <>
                <div className="row stripe stripe-caution">
                  <Warning size={17} weight="fill" color="var(--caution)" className="shrink-0" />
                  <span className="t-sub" style={{ color: "var(--caution)" }}>
                    此單元未經審核，正式版將直接擋下推送。示範模式僅記錄至推送清單，不會送出任何內容。
                  </span>
                </div>
                <div className="p-2.5 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--hairline)" }}>
                  {(cases ?? []).map((c) => (
                    <button key={c.id} className="opt w-full" onClick={() => void push(pushFor, c.id)}>
                      記錄至 {c.name} 家屬（示範）
                    </button>
                  ))}
                  <button className="btn btn-quiet w-full" onClick={() => setPushFor(null)}>取消</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {flash && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 sheet enter px-3.5 py-2 t-label"
             style={{ boxShadow: "var(--shadow)" }}>
          {flash}
        </div>
      )}
    </div>
  );
}
