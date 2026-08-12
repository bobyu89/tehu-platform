"use client";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, uid } from "@/lib/db";
import type { AlertRow, CaseInfo, Observation, ObsType } from "@/lib/types";
import {
  evaluateObs, computeBaseline, baselineFlag, type BaselineFlag,
} from "@/lib/alert-engine";
import { fmtDateTime } from "@/lib/digest";

// 量測輸入（02 冊 §4 床邊 UX）：三秒原則、大鍵位、自動跳欄、
// 顯示上次值但不預填、一次送出、送出即判定。

type NumKey = "bt" | "hr" | "rr" | "sbp" | "dbp" | "spo2" | "glucose";

const NUM_FIELDS: {
  key: NumKey; label: string; unit: string; placeholder: string;
  advance: (s: string) => boolean;
}[] = [
  { key: "bt", label: "體溫", unit: "°C", placeholder: "36.5", advance: (s) => /^\d{2}\.\d$/.test(s) },
  { key: "hr", label: "脈搏", unit: "次/分", placeholder: "72", advance: (s) => s.length >= 3 },
  { key: "rr", label: "呼吸", unit: "次/分", placeholder: "16", advance: (s) => s.length >= 2 },
  { key: "sbp", label: "血壓 SBP", unit: "mmHg", placeholder: "120", advance: (s) => s.length >= 3 },
  { key: "dbp", label: "血壓 DBP", unit: "mmHg", placeholder: "74", advance: (s) => s.length >= 3 },
  { key: "spo2", label: "SpO2", unit: "%", placeholder: "97", advance: (s) => s.length >= 2 && parseInt(s, 10) >= 50 },
  { key: "glucose", label: "血糖", unit: "mg/dL", placeholder: "AC 110", advance: (s) => s.length >= 3 },
];

const AVPU = ["A 清醒", "V 對聲音有反應", "P 對疼痛有反應", "U 無反應"] as const;

interface Result {
  reds: AlertRow[];
  yellows: AlertRow[];
  hints: BaselineFlag[];
  savedCount: number;
}

export function VitalsForm({ info }: { info: CaseInfo }) {
  const caseId = info.id;
  const [vals, setVals] = useState<Record<NumKey, string>>({ bt: "", hr: "", rr: "", sbp: "", dbp: "", spo2: "", glucose: "" });
  const [pain, setPain] = useState<number | null>(null);
  const [avpu, setAvpu] = useState(0);
  const [confusion, setConfusion] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const lastByType = useLiveQuery(async () => {
    const db = getDb();
    const out: Partial<Record<ObsType, Observation>> = {};
    for (const t of ["bt", "hr", "rr", "bp", "spo2", "glucose"] as ObsType[]) {
      // 注意：.last() 依主鍵（隨機 UUID）排序，須自行取 measuredAt 最大者
      const rows = await db.observations.where("[caseId+type]").equals([caseId, t]).toArray();
      out[t] = rows.reduce<Observation | undefined>(
        (acc, r) => (!acc || r.measuredAt > acc.measuredAt ? r : acc), undefined);
    }
    return out;
  }, [caseId]);

  function setField(i: number, key: NumKey, raw: string) {
    const s = raw.replace(/[^\d.]/g, "");
    setVals((v) => ({ ...v, [key]: s }));
    if (NUM_FIELDS[i].advance(s)) refs.current[i + 1]?.focus();
  }

  function lastText(t: ObsType): string {
    const o = lastByType?.[t];
    if (!o) return "—";
    const main = o.value.main;
    const extra = t === "bp" && o.value.dbp != null ? `/${o.value.dbp}` : "";
    return `上次 ${main}${extra}　${fmtDateTime(o.measuredAt)}`;
  }

  async function submit() {
    setSaving(true);
    const now = new Date().toISOString();
    const db = getDb();
    const obsRows: Observation[] = [];
    const alertRows: AlertRow[] = [];
    const hints: BaselineFlag[] = [];

    const mk = (type: ObsType, value: Observation["value"]): Observation =>
      ({ id: uid(), caseId, type, category: "vital", value, measuredAt: now, recordedAt: now, source: "manual" });

    const num = (k: NumKey) => (vals[k].trim() === "" ? null : parseFloat(vals[k]));

    const entries: { type: ObsType; value: Observation["value"] }[] = [];
    if (num("bt") != null) entries.push({ type: "bt", value: { main: num("bt"), site: "耳" } });
    if (num("hr") != null) entries.push({ type: "hr", value: { main: num("hr"), rhythm: "規則" } });
    if (num("rr") != null) entries.push({ type: "rr", value: { main: num("rr") } });
    if (num("sbp") != null) entries.push({ type: "bp", value: { main: num("sbp"), dbp: num("dbp") } });
    if (num("spo2") != null) entries.push({ type: "spo2", value: { main: num("spo2") } });
    if (num("glucose") != null) entries.push({ type: "glucose", value: { main: num("glucose") } });
    if (pain != null) entries.push({ type: "pain", value: { main: pain } });
    entries.push({ type: "consciousness", value: { main: null, avpu: "AVPU"[avpu] ?? "A", newConfusion: confusion } });

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    for (const e of entries) {
      const row = mk(e.type, e.value);
      obsRows.push(row);

      // A 層（含個案覆寫）
      const r = evaluateObs(e.type, e.value, info.overrides);
      if (r.level) {
        alertRows.push({
          id: uid(), caseId, obsId: row.id, layer: r.layer, level: r.level,
          summary: r.summary, status: "triggered", triggeredAt: now,
        });
      }

      // C 層個人基準線（僅數值型；C 層永不發紅——ADR-003）
      if (typeof e.value.main === "number" && e.type !== "pain") {
        const history = await db.observations
          .where("[caseId+type]").equals([caseId, e.type])
          .filter((o) => o.measuredAt >= sevenDaysAgo && typeof o.value.main === "number")
          .toArray();
        const base = computeBaseline(e.type, history.map((o) => o.value.main as number));
        const flag = baselineFlag(e.type, e.value.main, base);
        if (flag) {
          hints.push(flag);
          if (flag.level === "yellow") {
            alertRows.push({
              id: uid(), caseId, obsId: row.id, layer: "C", level: "yellow",
              summary: flag.text, status: "triggered", triggeredAt: now,
            });
          }
        }
      }
    }

    await db.transaction("rw", [db.observations, db.alerts], async () => {
      await db.observations.bulkPut(obsRows);
      if (alertRows.length > 0) await db.alerts.bulkPut(alertRows);
    });

    setResult({
      reds: alertRows.filter((a) => a.level === "red"),
      yellows: alertRows.filter((a) => a.level === "yellow"),
      hints,
      savedCount: obsRows.length,
    });
    setVals({ bt: "", hr: "", rr: "", sbp: "", dbp: "", spo2: "", glucose: "" });
    setPain(null); setAvpu(0); setConfusion(false);
    setSaving(false);
  }

  const anyInput = Object.values(vals).some((v) => v.trim() !== "") || pain != null || avpu !== 0 || confusion;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="grid grid-cols-2 gap-3">
        {NUM_FIELDS.map((f, i) => (
          <label key={f.key} className={f.key === "glucose" ? "col-span-2" : ""}>
            <div className="flex items-baseline justify-between">
              <span className="field-label">{f.label} <span className="font-normal">({f.unit})</span></span>
            </div>
            <input
              ref={(el) => { refs.current[i] = el; }}
              className="field-input mt-1 mono"
              inputMode="decimal" enterKeyHint="next" placeholder={f.placeholder}
              value={vals[f.key]}
              onChange={(e) => setField(i, f.key, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") refs.current[i + 1]?.focus(); }}
            />
            <div className="mt-0.5 text-[11px] mono" style={{ color: "var(--c-muted)" }}>
              {lastText(f.key === "sbp" || f.key === "dbp" ? "bp" : (f.key as ObsType))}
            </div>
          </label>
        ))}
      </div>

      <div>
        <span className="field-label">疼痛 NRS（0–10）</span>
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} className="seg-btn shrink-0 !min-w-12" data-on={pain === n}
                    onClick={() => setPain(pain === n ? null : n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="field-label">意識（AVPU）</span>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {AVPU.map((label, n) => (
            <button key={label} className="seg-btn" data-on={avpu === n} onClick={() => setAvpu(n)}>
              {label}
            </button>
          ))}
        </div>
        <button className="seg-btn mt-1.5 w-full" data-on={confusion} onClick={() => setConfusion(!confusion)}>
          {confusion ? "✓ " : ""}新發混亂
        </button>
      </div>

      <button className="btn-primary w-full !min-h-14 text-lg" disabled={!anyInput || saving} onClick={submit}>
        {saving ? "儲存中…" : "送出並判定"}
      </button>
      <p className="text-xs text-center" style={{ color: "var(--c-muted)" }}>
        示範模式：警報於本機判定顯示。正式版由伺服器權威判定並推播 LINE／簡訊。
      </p>

      {result && <ResultOverlay r={result} onClose={() => setResult(null)} caseId={caseId} />}
    </div>
  );
}

function ResultOverlay({ r, onClose, caseId }: { r: Result; onClose: () => void; caseId: string }) {
  const [note, setNote] = useState<string | null>(null);
  const hasRed = r.reds.length > 0;
  const hasYellow = r.yellows.length > 0;

  async function confirmHandled() {
    if (note) {
      const db = getDb();
      for (const a of [...r.reds, ...r.yellows]) {
        await db.alerts.update(a.id, { handledNote: note });
      }
    }
    onClose();
  }

  if (hasRed) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-center gap-4 p-5 overflow-y-auto"
           style={{ background: "color-mix(in srgb, var(--c-red-solid) 94%, black)" }}>
        <div className="text-white text-3xl font-black text-center">🔴 紅色警報</div>
        <div className="card p-4 flex flex-col gap-2">
          {r.reds.map((a) => <div key={a.id} className="font-bold">{a.summary}</div>)}
          {r.yellows.map((a) => <div key={a.id} className="text-sm" style={{ color: "var(--c-yellow)" }}>另有黃色：{a.summary}</div>)}
        </div>
        <div className="card p-4 text-sm leading-6">
          <b>處置指引</b>：確認病人狀態與量測正確性→必要時立即撥打 119→通報家屬與機構。
          <div className="mt-1 text-xs" style={{ color: "var(--c-muted)" }}>
            正式版此刻已推播 LINE 值班群；5 分鐘無人認領升級簡訊、10 分鐘語音輪撥。
          </div>
        </div>
        <a href="tel:119" className="btn-danger w-full !min-h-14 text-lg" style={{ background: "#fff", color: "var(--c-red-solid)" }}>📞 撥打 119</a>
        <div className="card p-3">
          <div className="field-label mb-1.5">處置紀錄</div>
          <div className="flex flex-wrap gap-1.5">
            {["已觀察複測", "已聯絡家屬", "已聯絡醫師", "已送醫"].map((n) => (
              <button key={n} className="seg-btn" data-on={note === n} onClick={() => setNote(n)}>{n}</button>
            ))}
          </div>
        </div>
        <button className="btn-ghost w-full" style={{ background: "#fff", borderColor: "#fff" }} onClick={confirmHandled}>
          確認並返回
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="card m-4 mb-8 w-full max-w-md p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        {hasYellow ? (
          <>
            <div className="text-xl font-black" style={{ color: "var(--c-yellow)" }}>🟡 黃色提醒</div>
            {r.yellows.map((a) => (
              <div key={a.id} className="rounded-lg p-3 text-sm font-bold"
                   style={{ background: "var(--c-yellow-bg)", color: "var(--c-yellow)", border: "1px solid var(--c-yellow-line)" }}>
                {a.summary}{a.layer === "C" ? "（個人基準線）" : ""}
              </div>
            ))}
            <div className="text-sm" style={{ color: "var(--c-muted)" }}>建議：15–30 分鐘後複測並持續觀察。已列入管理端儀表板佇列。</div>
            <div className="flex flex-wrap gap-1.5">
              {["已觀察複測", "已聯絡家屬", "已聯絡醫師"].map((n) => (
                <button key={n} className="seg-btn" data-on={note === n} onClick={() => setNote(n)}>{n}</button>
              ))}
            </div>
            <button className="btn-primary w-full" onClick={confirmHandled}>知道了</button>
          </>
        ) : (
          <>
            <div className="text-xl font-black" style={{ color: "var(--c-accent-ink)" }}>✓ 已記錄 {r.savedCount} 筆，無異常</div>
            {r.hints.map((h, i) => (
              <div key={i} className="chip chip-accent self-start">◔ {h.text}</div>
            ))}
            <button className="btn-primary w-full" onClick={onClose}>完成</button>
          </>
        )}
      </div>
    </div>
  );
}
