"use client";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Warning, WarningOctagon, Phone, TrendUp, TrendDown } from "@phosphor-icons/react";
import { getDb, uid } from "@/lib/db";
import type { AlertRow, CaseInfo, Observation, ObsType } from "@/lib/types";
import { evaluateObs, computeBaseline, baselineFlag, type BaselineFlag } from "@/lib/alert-engine";
import { computeNews2, type News2Result } from "@/lib/news2";
import { fmtDateTime } from "@/lib/digest";

// 量測輸入（規格 02 冊 §4）：三秒原則、大鍵位、自動跳欄、
// 顯示上次值但不預填、一次送出、送出即判定。

type NumKey = "bt" | "hr" | "rr" | "sbp" | "dbp" | "spo2" | "glucose";

const FIELDS: {
  key: NumKey; label: string; unit: string; ph: string; obs: ObsType;
  advance: (s: string) => boolean; pair?: NumKey;
}[] = [
  { key: "bt", label: "體溫", unit: "°C", ph: "36.5", obs: "bt", advance: (s) => /^\d{2}\.\d$/.test(s) },
  { key: "hr", label: "脈搏", unit: "次/分", ph: "72", obs: "hr", advance: (s) => s.length >= 3 },
  { key: "rr", label: "呼吸", unit: "次/分", ph: "16", obs: "rr", advance: (s) => s.length >= 2 },
  { key: "sbp", label: "血壓", unit: "mmHg", ph: "120", obs: "bp", advance: (s) => s.length >= 3, pair: "dbp" },
  { key: "spo2", label: "血氧 SpO2", unit: "%", ph: "97", obs: "spo2", advance: (s) => s.length >= 2 && parseInt(s, 10) >= 50 },
  { key: "glucose", label: "血糖", unit: "mg/dL", ph: "110", obs: "glucose", advance: (s) => s.length >= 3 },
];

const AVPU = [
  { code: "A", label: "清醒" }, { code: "V", label: "對聲音有反應" },
  { code: "P", label: "對疼痛有反應" }, { code: "U", label: "無反應" },
];

interface Result {
  reds: AlertRow[]; yellows: AlertRow[]; hints: BaselineFlag[]; savedCount: number;
  news2: News2Result | null; news2AlertsOff: boolean;
}

export function VitalsForm({ info, inline = false }: { info: CaseInfo; inline?: boolean }) {
  const caseId = info.id;
  const [vals, setVals] = useState<Record<NumKey, string>>(
    { bt: "", hr: "", rr: "", sbp: "", dbp: "", spo2: "", glucose: "" });
  const [pain, setPain] = useState<number | null>(null);
  const [avpu, setAvpu] = useState(0);
  const [confusion, setConfusion] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const lastByType = useLiveQuery(async () => {
    const db = getDb();
    const out: Partial<Record<ObsType, Observation>> = {};
    for (const t of ["bt", "hr", "rr", "bp", "spo2", "glucose"] as ObsType[]) {
      // .last() 依主鍵（隨機 UUID）排序，須自行取 measuredAt 最大者
      const rows = await db.observations.where("[caseId+type]").equals([caseId, t]).toArray();
      out[t] = rows.reduce<Observation | undefined>(
        (acc, r) => (!acc || r.measuredAt > acc.measuredAt ? r : acc), undefined);
    }
    return out;
  }, [caseId]);

  const order: NumKey[] = ["bt", "hr", "rr", "sbp", "dbp", "spo2", "glucose"];

  function setField(key: NumKey, raw: string) {
    const s = raw.replace(/[^\d.]/g, "");
    setVals((v) => ({ ...v, [key]: s }));
    const f = FIELDS.find((x) => x.key === key);
    if (f?.advance(s)) {
      const next = order[order.indexOf(key) + 1];
      if (next) refs.current[next]?.focus();
    }
  }

  function lastLine(obs: ObsType) {
    const o = lastByType?.[obs];
    if (!o) return <span style={{ color: "var(--ink-3)" }}>尚無紀錄</span>;
    const extra = obs === "bp" && o.value.dbp != null ? `/${o.value.dbp}` : "";
    return <>上次 <span className="num">{o.value.main}{extra}</span>　{fmtDateTime(o.measuredAt)}</>;
  }

  async function submit() {
    setSaving(true);
    const now = new Date().toISOString();
    const db = getDb();
    const obsRows: Observation[] = [];
    const alertRows: AlertRow[] = [];
    const hints: BaselineFlag[] = [];
    const num = (k: NumKey) => (vals[k].trim() === "" ? null : parseFloat(vals[k]));

    const entries: { type: ObsType; value: Observation["value"] }[] = [];
    if (num("bt") != null) entries.push({ type: "bt", value: { main: num("bt"), site: "耳" } });
    if (num("hr") != null) entries.push({ type: "hr", value: { main: num("hr"), rhythm: "規則" } });
    if (num("rr") != null) entries.push({ type: "rr", value: { main: num("rr") } });
    if (num("sbp") != null) entries.push({ type: "bp", value: { main: num("sbp"), dbp: num("dbp") } });
    // 用氧狀態自動從最近一筆氧療紀錄帶入，不重複輸入（規格 02 冊）
    if (num("spo2") != null) entries.push({ type: "spo2", value: { main: num("spo2"), onO2: Boolean(lastByType?.spo2?.value.onO2) } });
    if (num("glucose") != null) entries.push({ type: "glucose", value: { main: num("glucose") } });
    if (pain != null) entries.push({ type: "pain", value: { main: pain } });
    entries.push({ type: "consciousness", value: { main: null, avpu: AVPU[avpu].code, newConfusion: confusion } });

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    for (const e of entries) {
      const row: Observation = {
        id: uid(), caseId, type: e.type, category: "vital", value: e.value,
        measuredAt: now, recordedAt: now, source: "manual",
      };
      obsRows.push(row);

      const r = evaluateObs(e.type, e.value, info.overrides);
      if (r.level) {
        alertRows.push({
          id: uid(), caseId, obsId: row.id, layer: r.layer, level: r.level,
          summary: r.summary, status: "triggered", triggeredAt: now,
        });
      }

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

    // B 層：NEWS2（規格 02 冊 §2.2）。近 12 小時參數＋本次輸入合併計分。
    const twelveHoursAgo = new Date(Date.now() - 12 * 3600_000).toISOString();
    const recent = await db.observations.where("caseId").equals(caseId)
      .filter((o) => o.measuredAt >= twelveHoursAgo).toArray();
    const news2 = computeNews2(info, [...recent, ...obsRows]);
    if (!info.news2AlertsOff && news2.complete) {
      if (news2.total >= 7) {
        alertRows.push({
          id: uid(), caseId, layer: "B", level: "red",
          summary: `NEWS2 總分 ${news2.total} 分（≥7，建議緊急評估）`,
          status: "triggered", triggeredAt: now,
        });
      } else if (news2.total >= 5 || news2.singleThree) {
        alertRows.push({
          id: uid(), caseId, layer: "B", level: "yellow",
          summary: `NEWS2 總分 ${news2.total} 分${news2.singleThree ? "（含單項 3 分）" : ""}，建議提高觀察頻率`,
          status: "triggered", triggeredAt: now,
        });
      }
    }

    await db.transaction("rw", [db.observations, db.alerts], async () => {
      await db.observations.bulkPut(obsRows);
      if (alertRows.length > 0) await db.alerts.bulkPut(alertRows);
    });

    setResult({
      reds: alertRows.filter((a) => a.level === "red"),
      yellows: alertRows.filter((a) => a.level === "yellow"),
      hints, savedCount: obsRows.length,
      news2, news2AlertsOff: Boolean(info.news2AlertsOff),
    });
    setVals({ bt: "", hr: "", rr: "", sbp: "", dbp: "", spo2: "", glucose: "" });
    setPain(null); setAvpu(0); setConfusion(false);
    setSaving(false);
  }

  const filled = Object.values(vals).filter((v) => v.trim() !== "").length;
  const anyInput = filled > 0 || pain != null || avpu !== 0 || confusion;

  // 量測排程逾時提醒（規格 02 冊 §2.4）：「沒量」本身就是異常訊號
  const overdueMin = useLiveQuery(async () => {
    if (!info.vitalsIntervalH) return 0;
    const rows = await getDb().observations.where("caseId").equals(caseId)
      .filter((o) => ["bt", "hr", "rr", "bp", "spo2"].includes(o.type)).toArray();
    if (rows.length === 0) return 0;
    const last = rows.reduce((a, r) => (r.measuredAt > a ? r.measuredAt : a), rows[0].measuredAt);
    return Math.round((Date.now() - new Date(last).getTime()) / 60000) - info.vitalsIntervalH * 60;
  }, [caseId, info.vitalsIntervalH]) ?? 0;

  return (
    <div className={`flex flex-col gap-3 ${inline ? "" : "pb-32"}`}>
      {overdueMin > 30 && (
        <div className="sheet stripe stripe-caution flex items-center gap-2.5 px-3.5 py-2.5">
          <Warning size={17} weight="fill" color="var(--caution)" className="shrink-0" />
          <span className="t-label" style={{ color: "var(--caution)" }}>
            生命徵象已逾排程 <span className="num">{overdueMin}</span> 分（Q{info.vitalsIntervalH}H）
          </span>
        </div>
      )}
      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">生命徵象</span>
          <span className="t-micro num">{filled} / 7 已填</span>
        </div>

        {FIELDS.map((f) => (
          <div key={f.key} className="row">
            <div className="flex-1 min-w-0">
              <label htmlFor={`f-${f.key}`} className="t-label block">{f.label}</label>
              <div className="t-micro" style={{ letterSpacing: 0, fontWeight: 400 }}>{lastLine(f.obs)}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input id={`f-${f.key}`} ref={(el) => { refs.current[f.key] = el; }}
                     className="numfield text-right" style={{ width: f.pair ? 74 : 104 }}
                     inputMode="decimal" enterKeyHint="next" placeholder={f.ph}
                     value={vals[f.key]} onChange={(e) => setField(f.key, e.target.value)} />
              {f.pair && (
                <>
                  <span style={{ color: "var(--ink-3)" }}>/</span>
                  <input ref={(el) => { refs.current[f.pair!] = el; }}
                         className="numfield text-right" style={{ width: 74 }}
                         inputMode="decimal" enterKeyHint="next" placeholder="74"
                         aria-label="舒張壓 DBP"
                         value={vals[f.pair]} onChange={(e) => setField(f.pair!, e.target.value)} />
                </>
              )}
              <span className="t-micro w-11" style={{ letterSpacing: 0, fontWeight: 400 }}>{f.unit}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">疼痛評分 NRS 0 至 10</span></div>
        <div className="p-2.5 flex gap-1.5 overflow-x-auto">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} className="opt num shrink-0" style={{ minWidth: 46 }}
                    data-on={pain === n} onClick={() => setPain(pain === n ? null : n)}>
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">意識狀態 AVPU</span></div>
        <div className="p-2.5 grid grid-cols-2 gap-1.5">
          {AVPU.map((a, n) => (
            <button key={a.code} className="opt" data-on={avpu === n} onClick={() => setAvpu(n)}>
              <span className="num" style={{ marginRight: 4 }}>{a.code}</span>{a.label}
            </button>
          ))}
        </div>
        <div className="px-2.5 pb-2.5">
          <button className="opt w-full" data-on={confusion} onClick={() => setConfusion(!confusion)}>
            {confusion && <Check size={15} weight="bold" style={{ display: "inline", marginRight: 4 }} />}
            新發混亂
          </button>
        </div>
      </section>

      {/* 行動版：送出固定在拇指區；工作區欄位內改為一般排版 */}
      {inline ? (
        <button className="btn btn-primary w-full" style={{ minHeight: 52, fontSize: 16 }}
                disabled={!anyInput || saving} onClick={submit}>
          {saving ? "儲存中" : "送出並判定"}
        </button>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-4"
             style={{ background: "linear-gradient(to top, var(--bg) 72%, transparent)" }}>
          <div className="mx-auto max-w-md">
            <button className="btn btn-primary w-full" style={{ minHeight: 54, fontSize: 16 }}
                    disabled={!anyInput || saving} onClick={submit}>
              {saving ? "儲存中" : "送出並判定"}
            </button>
          </div>
        </div>
      )}

      <p className="t-micro text-center" style={{ letterSpacing: 0, fontWeight: 400 }}>
        示範模式：警報於本機判定顯示。正式版由伺服器權威判定並推播 LINE 與簡訊。
      </p>

      {result && <ResultOverlay r={result} onClose={() => setResult(null)} />}
    </div>
  );
}

const ACTIONS = ["已觀察複測", "已聯絡家屬", "已聯絡醫師", "已送醫"];

function News2Row({ n, off }: { n: News2Result; off: boolean }) {
  return (
    <div className="row" style={{ borderTop: "1px solid var(--hairline)" }}>
      <span className="t-sub flex-1">早期預警 NEWS2</span>
      <span className="t-label num">
        {n.complete ? `${n.total} 分・${n.bandLabel}` : `資料不全（缺${n.missing.join("、")}）`}
      </span>
      {off && <span className="tag">警報停用</span>}
    </div>
  );
}

function ResultOverlay({ r, onClose }: { r: Result; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null);

  async function confirmHandled() {
    if (note) {
      const db = getDb();
      for (const a of [...r.reds, ...r.yellows]) await db.alerts.update(a.id, { handledNote: note });
    }
    onClose();
  }

  if (r.reds.length > 0) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--critical-solid)" }}>
        <div className="mx-auto max-w-md min-h-[100dvh] p-4 flex flex-col gap-3 justify-center">
          <div className="flex items-center gap-2.5 text-white">
            <WarningOctagon size={34} weight="fill" />
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>紅色警報</div>
              <div style={{ fontSize: 13, opacity: .85 }}>已達絕對臨界值，請立即確認病人狀態</div>
            </div>
          </div>

          <div className="sheet">
            {r.reds.map((a) => (
              <div key={a.id} className="row stripe stripe-critical">
                <WarningOctagon size={17} weight="fill" color="var(--critical)" className="shrink-0" />
                <span className="t-label" style={{ color: "var(--critical)" }}>{a.summary}</span>
              </div>
            ))}
            {r.yellows.map((a) => (
              <div key={a.id} className="row stripe stripe-caution">
                <Warning size={16} weight="fill" color="var(--caution)" className="shrink-0" />
                <span className="t-sub" style={{ color: "var(--caution)" }}>{a.summary}</span>
              </div>
            ))}
          </div>

          <a href="tel:119" className="btn btn-on-dark w-full" style={{ minHeight: 56, fontSize: 17 }}>
            <Phone size={20} weight="fill" /> 撥打 119
          </a>

          <div className="sheet">
            <div className="sheet-title"><span className="t-micro">處置指引</span></div>
            <div className="px-3.5 py-3 t-sub">
              確認病人狀態與量測正確性，必要時立即撥打 119，並通報家屬與機構。
              <div className="t-micro mt-1.5" style={{ letterSpacing: 0, fontWeight: 400 }}>
                正式版此刻已推播 LINE 值班群；5 分鐘無人認領升級簡訊，10 分鐘語音輪撥。
              </div>
            </div>
            <div className="sheet-title" style={{ borderTop: "1px solid var(--hairline)" }}>
              <span className="t-micro">處置紀錄</span>
            </div>
            <div className="p-2.5 grid grid-cols-2 gap-1.5">
              {ACTIONS.map((n) => (
                <button key={n} className="opt" data-on={note === n} onClick={() => setNote(n)}>{n}</button>
              ))}
            </div>
          </div>

          <button className="btn btn-on-dark w-full" onClick={confirmHandled}>確認並返回</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3"
         style={{ background: "rgba(20,28,27,.45)" }} onClick={onClose}>
      <div className="sheet enter w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {r.yellows.length > 0 ? (
          <>
            <div className="sheet-title">
              <span className="t-micro" style={{ color: "var(--caution)" }}>黃色提醒</span>
              <span className="t-micro num">已記錄 {r.savedCount} 筆</span>
            </div>
            {r.yellows.map((a) => (
              <div key={a.id} className="row stripe stripe-caution">
                <Warning size={17} weight="fill" color="var(--caution)" className="shrink-0" />
                <div className="flex-1">
                  <div className="t-label" style={{ color: "var(--caution)" }}>{a.summary}</div>
                  {a.layer === "C" && <div className="t-micro" style={{ letterSpacing: 0, fontWeight: 400 }}>個人基準線偏離</div>}
                </div>
              </div>
            ))}
            <div className="px-3.5 py-2.5 t-sub">建議 15 至 30 分鐘後複測並持續觀察，已列入管理端佇列。</div>
            {r.news2 && <News2Row n={r.news2} off={r.news2AlertsOff} />}
            <div className="p-2.5 grid grid-cols-3 gap-1.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              {ACTIONS.slice(0, 3).map((n) => (
                <button key={n} className="opt" style={{ fontSize: 13 }} data-on={note === n} onClick={() => setNote(n)}>{n}</button>
              ))}
            </div>
            <div className="p-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <button className="btn btn-primary w-full" onClick={confirmHandled}>知道了</button>
            </div>
          </>
        ) : (
          <>
            <div className="row stripe stripe-ok">
              <Check size={20} weight="bold" color="var(--a)" />
              <span className="t-row flex-1">已記錄 <span className="num">{r.savedCount}</span> 筆，無異常</span>
            </div>
            {r.hints.map((h, i) => (
              <div key={i} className="row">
                {h.direction === "high"
                  ? <TrendUp size={16} color="var(--ink-2)" className="shrink-0" />
                  : <TrendDown size={16} color="var(--ink-2)" className="shrink-0" />}
                <span className="t-sub">{h.text}</span>
              </div>
            ))}
            {r.news2 && <News2Row n={r.news2} off={r.news2AlertsOff} />}
            <div className="p-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <button className="btn btn-primary w-full" onClick={onClose}>完成</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
