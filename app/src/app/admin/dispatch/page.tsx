"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretLeft, Plus, UserPlus, X } from "@phosphor-icons/react";
import { getDb, uid } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import type { CaseInfo, CaseStatus, Shift } from "@/lib/types";
import { CASE_STATUS_LABEL } from "@/lib/types";
import { fmtTime } from "@/lib/digest";

// 派單（規格 04 冊 §2）：個案建檔、狀態機、班次指派。
// 技術標籤是硬條件：個案需求必須是護理師標籤的子集，不符者不可指派。
// MVP 為人工指派＋系統輔助排序；自動派單留到第三階段。

const NEXT_STATUS: Partial<Record<CaseStatus, CaseStatus>> = {
  inquiry: "assessing", assessing: "quoted", quoted: "active",
};

const NEED_OPTIONS = ["管灌", "血糖監測", "氧療照護", "抽痰", "傷口照護", "失智照護"];

function dstr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function respondDeadline(): string {
  return new Date(Date.now() + 30 * 60_000).toISOString(); // 30 分鐘回覆期限
}

export default function DispatchPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <DispatchContent />;
}

function DispatchContent() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const nurses = useLiveQuery(() => db.nurses.toArray(), []);
  const shifts = useLiveQuery(async () => {
    const rows = await db.shifts.orderBy("date").reverse().limit(30).toArray();
    return rows.sort((a, b) => a.date === b.date ? a.startHH - b.startHH : b.date.localeCompare(a.date));
  }, []);

  const [showNew, setShowNew] = useState(false);
  const [assignFor, setAssignFor] = useState<Shift | null>(null);

  async function advanceStatus(c: CaseInfo) {
    const next = NEXT_STATUS[c.status ?? "active"];
    if (next) await db.cases.update(c.id, { status: next });
  }

  async function addShift(caseId: string, slot: "day" | "night") {
    const t = new Date(); t.setDate(t.getDate() + 1);
    const date = dstr(t);
    await db.shifts.put({
      id: `shift-${caseId}-${date}-${slot}`, caseId, date,
      startHH: slot === "day" ? 8 : 20, endHH: slot === "day" ? 20 : 8,
      status: "unassigned",
    });
  }

  async function assign(shift: Shift, nurseId: string) {
    await db.shifts.update(shift.id, {
      status: "offered", nurseId,
      offeredAt: new Date().toISOString(),
      respondBy: respondDeadline(),
    });
    setAssignFor(null);
  }

  async function recall(shift: Shift) {
    await db.shifts.update(shift.id, { status: "unassigned", nurseId: undefined, offeredAt: undefined, respondBy: undefined });
  }

  const nameOf = (id?: string) => nurses?.find((n) => n.id === id)?.name ?? "";
  const caseOf = (id: string) => cases?.find((c) => c.id === id);

  const shiftTag = (s: Shift) => {
    const expired = s.status === "offered" && s.respondBy && s.respondBy < new Date().toISOString();
    if (expired) return <span className="tag tag-caution">逾時未回覆</span>;
    switch (s.status) {
      case "unassigned": return <span className="tag tag-caution">待派</span>;
      case "offered": return <span className="tag">已派待回覆</span>;
      case "accepted": return <span className="tag tag-accent">已接</span>;
      case "in_progress": return <span className="tag tag-accent">服務中</span>;
      case "completed": return <span className="tag">已完成</span>;
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-5 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="t-head">個案與派單</h1>
          <p className="t-sub">人工指派＋系統輔助；技術標籤不符者不可指派（硬條件）。</p>
        </div>
        <Link href="/admin" className="t-label flex items-center gap-0.5 shrink-0" style={{ color: "var(--a-ink)" }}>
          <CaretLeft size={15} /> 儀表板
        </Link>
      </header>

      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">個案</span>
          <button className="btn btn-quiet" style={{ minHeight: 34, padding: "0 10px", fontSize: 13 }}
                  onClick={() => setShowNew(!showNew)}>
            {showNew ? <X size={14} /> : <Plus size={14} weight="bold" />} 新增個案
          </button>
        </div>
        {showNew && <NewCaseForm onDone={() => setShowNew(false)} />}
        {(cases ?? []).map((c) => {
          const st = c.status ?? "active";
          return (
            <div key={c.id} className="px-3.5 py-3 flex flex-col gap-2" style={{ borderBottom: "1px solid var(--hairline)" }}>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <span className="t-label">{c.name}</span>
                  <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>　{c.age} 歲・{c.setting}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.careNeeds.map((n) => <span key={n} className="tag">{n}</span>)}
                  </div>
                </div>
                <span className={`tag ${st === "active" ? "tag-accent" : ""}`}>{CASE_STATUS_LABEL[st]}</span>
                {NEXT_STATUS[st] && (
                  <button className="btn btn-quiet" style={{ minHeight: 34, padding: "0 10px", fontSize: 13 }}
                          onClick={() => advanceStatus(c)}>
                    推進至{CASE_STATUS_LABEL[NEXT_STATUS[st]!]}
                  </button>
                )}
              </div>
              {st === "active" && (
                <div className="flex gap-1.5 items-center">
                  <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>建立明日班次</span>
                  <button className="opt" style={{ fontSize: 13, minHeight: 36 }} onClick={() => addShift(c.id, "day")}>白班 08-20</button>
                  <button className="opt" style={{ fontSize: 13, minHeight: 36 }} onClick={() => addShift(c.id, "night")}>夜班 20-08</button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">班次</span></div>
        {(shifts ?? []).length === 0 && <div className="empty">尚無班次</div>}
        {(shifts ?? []).map((s) => (
          <div key={s.id} className="row">
            <div className="flex-1 min-w-0">
              <div className="t-label truncate">
                {caseOf(s.caseId)?.name}
                <span className="num t-sub font-normal">
                  　{s.date.slice(5).replace("-", "/")}　{String(s.startHH).padStart(2, "0")}:00-{String(s.endHH).padStart(2, "0")}:00
                </span>
              </div>
              <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
                {s.nurseId ? `指派：${nameOf(s.nurseId)}` : "尚未指派"}
                {s.status === "offered" && s.respondBy && `　回覆期限 ${fmtTime(s.respondBy)}`}
              </div>
            </div>
            {shiftTag(s)}
            {(s.status === "unassigned" || (s.status === "offered" && s.respondBy && s.respondBy < new Date().toISOString())) && (
              <button className="btn btn-primary shrink-0" style={{ minHeight: 38, padding: "0 11px", fontSize: 13 }}
                      onClick={() => setAssignFor(s)}>
                <UserPlus size={15} weight="bold" /> 指派
              </button>
            )}
            {s.status === "offered" && s.respondBy && s.respondBy >= new Date().toISOString() && (
              <button className="btn btn-quiet shrink-0" style={{ minHeight: 38, padding: "0 11px", fontSize: 13 }}
                      onClick={() => recall(s)}>撤回</button>
            )}
          </div>
        ))}
      </section>

      {assignFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
             style={{ background: "rgba(20,28,27,.45)" }} onClick={() => setAssignFor(null)}>
          <div className="sheet enter w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">
              <span className="t-micro">指派護理師</span>
              <span className="t-micro">{caseOf(assignFor.caseId)?.name}・需求 {caseOf(assignFor.caseId)?.careNeeds.join("、")}</span>
            </div>
            {(nurses ?? []).map((n) => {
              const needs = caseOf(assignFor.caseId)?.careNeeds ?? [];
              const ok = needs.every((x) => n.tags.includes(x));
              const missing = needs.filter((x) => !n.tags.includes(x));
              return (
                <div key={n.id} className="row">
                  <div className="flex-1 min-w-0">
                    <div className="t-label">{n.name}</div>
                    <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
                      {ok ? n.tags.join("、") : `缺技術標籤：${missing.join("、")}`}
                    </div>
                  </div>
                  <button className={ok ? "btn btn-primary" : "btn btn-quiet"}
                          style={{ minHeight: 38, padding: "0 12px", fontSize: 13 }}
                          disabled={!ok} onClick={() => assign(assignFor, n.id)}>
                    {ok ? "指派" : "不符"}
                  </button>
                </div>
              );
            })}
            <div className="px-3.5 py-2 t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
              正式版同時推播 LINE 派單卡片（接受/拒絕按鈕），30 分鐘未回覆自動退回待派。
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function NewCaseForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [setting, setSetting] = useState<"居家" | "醫院">("居家");
  const [dx, setDx] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);

  async function save() {
    if (!name.trim()) return;
    await getDb().cases.put({
      id: `case-${uid().slice(0, 8)}`,
      name: name.trim(), age: parseInt(age || "0", 10) || 0, sex: "女",
      setting, dx: dx.trim() || "（待補診斷）", allergies: "未知",
      careNeeds: needs, tubes: [], status: "inquiry", vitalsIntervalH: 4,
    });
    onDone();
  }

  return (
    <div className="px-3.5 py-3 flex flex-col gap-2" style={{ borderBottom: "1px solid var(--hairline)", background: "var(--sunken)" }}>
      <div className="grid grid-cols-2 gap-2">
        <input className="textfield" placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="textfield" placeholder="年齡" inputMode="numeric" value={age}
               onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div className="flex gap-1.5">
        {(["居家", "醫院"] as const).map((s) => (
          <button key={s} className="opt flex-1" style={{ minHeight: 40, fontSize: 13 }}
                  data-on={setting === s} onClick={() => setSetting(s)}>{s}</button>
        ))}
      </div>
      <input className="textfield" placeholder="診斷摘要" value={dx} onChange={(e) => setDx(e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        {NEED_OPTIONS.map((n) => (
          <button key={n} className="opt" style={{ fontSize: 13, minHeight: 38, padding: "0 10px" }}
                  data-on={needs.includes(n)}
                  onClick={() => setNeeds(needs.includes(n) ? needs.filter((x) => x !== n) : [...needs, n])}>
            {n}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>建立個案（狀態：洽詢）</button>
    </div>
  );
}
