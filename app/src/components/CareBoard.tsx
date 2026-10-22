"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Phone, WarningOctagon } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import type { CareEvent, MedLog, Observation, ObsType } from "@/lib/types";
import * as care from "@/modules/care";
import { raiseRedFlag } from "@/modules/alerts";
import { WoundSection } from "@/components/WoundSection";
import { fmtTime } from "@/lib/digest";

const WITHHOLD_REASONS = ["拒服", "禁食", "嘔吐", "其他"];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 照護紀錄（規格 02 冊 §1.2、§1.3）：輸出入量、高頻事件一鍵鈕、
// 管路勾檢與事件、質性紅旗（直通紅色警報，不經數值判斷）。

type IoKey = "oral" | "tube" | "iv" | "urine" | "stool" | "vomit" | "drain" | "suction";

const IO_TYPES: { key: IoKey; label: string; obs: ObsType; dir: "in" | "out"; ml: boolean }[] = [
  { key: "oral", label: "經口", obs: "intake_oral", dir: "in", ml: true },
  { key: "tube", label: "管灌", obs: "intake_tube", dir: "in", ml: true },
  { key: "iv", label: "靜脈", obs: "intake_iv", dir: "in", ml: true },
  { key: "urine", label: "尿", obs: "output_urine", dir: "out", ml: true },
  { key: "stool", label: "便", obs: "output_stool", dir: "out", ml: false },
  { key: "vomit", label: "嘔吐", obs: "output_vomit", dir: "out", ml: false },
  { key: "drain", label: "引流", obs: "output_drain", dir: "out", ml: true },
  { key: "suction", label: "抽痰", obs: "output_suction", dir: "out", ml: false },
];

const OPTS: Record<string, { label: string; values: string[] }> = {
  oral: { label: "進食比例", values: ["全量", "3/4", "半量", "1/4", "拒食"] },
  urine: { label: "顏色", values: ["淡黃", "深黃", "茶色", "血色"] },
  stool: { label: "顏色", values: ["黃褐", "黑", "鮮血", "灰白"] },
  vomit: { label: "性狀", values: ["食物", "膽汁", "咖啡渣樣"] },
  suction: { label: "顏色", values: ["白", "黃", "綠", "血絲"] },
};

const AMOUNTS = ["少", "中", "多"];

const RED_FLAGS = ["新發胸痛", "跌倒撞頭", "新發單側無力或口齒不清"];

export function CareBoard({ caseId }: { caseId: string }) {
  const db = getDb();

  const info = useLiveQuery(() => db.cases.get(caseId), [caseId]);

  const [io, setIo] = useState<IoKey>("oral");
  const [ml, setMl] = useState("");
  const [amount, setAmount] = useState<string | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [residual, setResidual] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [redFired, setRedFired] = useState<string | null>(null);
  const [confirmFlag, setConfirmFlag] = useState<string | null>(null);
  const [withholdFor, setWithholdFor] = useState<{ medId: string; slot: number } | null>(null);

  // 簡化 MAR（規格 02 冊 §1.3）：藥單勾選給藥，未給必選原因
  const meds = useLiveQuery(() => db.meds.where("caseId").equals(caseId).toArray(), [caseId]);
  const medLogs = useLiveQuery(async () => {
    const rows = await db.medLogs.where("caseId").equals(caseId).toArray();
    const map: Record<string, MedLog> = {};
    for (const r of rows) map[r.id] = r;
    return map;
  }, [caseId]);

  const nowHH = new Date().getHours();
  const dueList = (meds ?? [])
    .flatMap((m) => m.slots.map((slot) => ({ med: m, slot })))
    .filter((x) => x.slot <= nowHH + 1)
    .sort((a, b) => a.slot - b.slot);

  async function logMed(medId: string, slot: number, status: MedLog["status"], reason?: string) {
    await care.logMed(caseId, medId, todayStr(), slot, status, reason);
    setWithholdFor(null);
    toast(status === "given" ? "已記錄給藥" : `已記錄未給（${reason}）`);
  }

  const todayIso = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); })();

  const totals = useLiveQuery(async () => {
    const obs = await db.observations.where("caseId").equals(caseId)
      .filter((o) => o.measuredAt >= todayIso).toArray();
    const sum = (cat: Observation["category"]) =>
      obs.filter((o) => o.category === cat && typeof o.value.main === "number")
        .reduce((a, o) => a + (o.value.main as number), 0);
    return { in: sum("io_in"), out: sum("io_out") };
  }, [caseId]);

  const timeline = useLiveQuery(async () => {
    const ev = await db.events.where("caseId").equals(caseId)
      .filter((e) => e.occurredAt >= todayIso).toArray();
    const obs = await db.observations.where("caseId").equals(caseId)
      .filter((o) => o.measuredAt >= todayIso && (o.category === "io_in" || o.category === "io_out"))
      .toArray();
    const items = [
      ...ev.map((e) => ({ at: e.occurredAt, text: e.label, red: e.type === "red_flag" || e.label.includes("自拔") })),
      ...obs.map((o) => {
        const t = IO_TYPES.find((x) => x.obs === o.type);
        const parts = [
          typeof o.value.main === "number" ? `${o.value.main} ml` : null,
          (o.value.amount as string) ? `量${o.value.amount}` : null,
          (o.value.quality as string) || null,
        ].filter(Boolean).join("、");
        return { at: o.measuredAt, text: `${t?.label ?? o.type}：${parts || "已記錄"}`, red: o.value.quality === "咖啡渣樣" };
      }),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
    return items;
  }, [caseId]);

  function toast(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  }

  async function fireRedAlert(summary: string) {
    await raiseRedFlag(caseId, summary);
    setRedFired(summary);
  }

  async function quickEvent(type: CareEvent["type"], label: string, detail?: Record<string, unknown>) {
    await care.logEvent(caseId, type, label, detail);
    toast(`已記錄：${label}`);
  }

  async function saveIo() {
    const t = IO_TYPES.find((x) => x.key === io)!;
    const value: Observation["value"] = {
      main: t.ml && ml.trim() !== "" ? parseFloat(ml) : null,
      ...(amount ? { amount } : {}),
      ...(quality ? { quality } : {}),
      ...(io === "tube" && residual.trim() !== "" ? { residual: parseFloat(residual) } : {}),
    };
    if (value.main == null && !amount && !quality) return;

    await care.recordIo(caseId, t.obs, t.dir === "in" ? "io_in" : "io_out", value);

    // 質性紅旗（規格 02 冊 §2.1）：直通紅色，不經數值
    if (io === "vomit" && quality === "咖啡渣樣") {
      await fireRedAlert("咖啡渣樣嘔吐物（疑上消化道出血徵象）");
    } else if (io === "stool" && quality === "鮮血" && amount === "多") {
      await fireRedAlert("大量鮮血便");
    } else {
      toast(`已記錄：${t.label}`);
    }
    setMl(""); setAmount(null); setQuality(null); setResidual("");
  }

  async function tubeEvent(tube: string, kind: string) {
    await quickEvent("tube_event", `管路事件：${tube} ${kind}`);
    if (kind === "自拔") await fireRedAlert(`管路自拔（${tube}）`);
  }

  if (!info) return null;
  const opts = OPTS[io];
  const cur = IO_TYPES.find((x) => x.key === io)!;

  return (
    <div className="flex flex-col gap-3 pb-28">
      {/* 今日給藥（簡化 MAR）。用語「協助服藥／依醫囑給藥」，不提供用藥建議（醫材紅線） */}
      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">今日給藥（依醫囑協助服藥）</span>
          <span className="t-micro num">
            {dueList.filter((x) => medLogs?.[`${x.med.id}|${todayStr()}|${x.slot}`]?.status === "given").length}
            {" / "}{dueList.length} 已給
          </span>
        </div>
        {dueList.length === 0 && <div className="empty">目前時段無到期藥單</div>}
        {dueList.map(({ med, slot }) => {
          const log = medLogs?.[`${med.id}|${todayStr()}|${slot}`];
          const overdue = !log && slot < nowHH;
          return (
            <div key={`${med.id}-${slot}`} className={`row ${overdue ? "stripe stripe-caution" : ""}`}>
              <span className="num t-label shrink-0" style={{ width: 48 }}>{String(slot).padStart(2, "0")}:00</span>
              <div className="flex-1 min-w-0">
                <div className="t-label truncate">{med.name}</div>
                <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
                  {med.route}{med.note ? `・${med.note}` : ""}{overdue ? "・已逾時" : ""}
                </div>
              </div>
              {log ? (
                log.status === "given"
                  ? <span className="tag tag-accent"><Check size={11} weight="bold" /> {fmtTime(log.at)} 已給</span>
                  : <span className="tag tag-caution">未給・{log.reason}</span>
              ) : (
                <span className="flex gap-1.5">
                  <button className="btn btn-primary" style={{ minHeight: 38, padding: "0 12px", fontSize: 13 }}
                          onClick={() => logMed(med.id, slot, "given")}>給藥</button>
                  <button className="btn btn-quiet" style={{ minHeight: 38, padding: "0 10px", fontSize: 13 }}
                          onClick={() => setWithholdFor({ medId: med.id, slot })}>未給</button>
                </span>
              )}
            </div>
          );
        })}
        {withholdFor && (
          <div className="p-2.5 flex items-center gap-1.5" style={{ borderTop: "1px solid var(--hairline)", background: "var(--sunken)" }}>
            <span className="t-micro shrink-0">未給原因</span>
            {WITHHOLD_REASONS.map((r) => (
              <button key={r} className="opt flex-1" style={{ fontSize: 13, minHeight: 38 }}
                      onClick={() => logMed(withholdFor.medId, withholdFor.slot, "withheld", r)}>{r}</button>
            ))}
          </div>
        )}
      </section>

      {/* 高頻事件一鍵鈕：先以預設值一鍵入帳 */}
      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">快速紀錄</span></div>
        <div className="p-2.5 grid grid-cols-4 gap-1.5">
          {["左側臥", "平躺", "右側臥", "坐起"].map((p) => (
            <button key={p} className="opt" style={{ fontSize: 13 }}
                    onClick={() => quickEvent("reposition", `翻身：${p}`)}>
              {p}
            </button>
          ))}
        </div>
        <div className="px-2.5 pb-2.5 flex gap-1.5">
          <button className="opt flex-1" onClick={() => quickEvent("suction", "抽痰（量中、色白）")}>
            抽痰
          </button>
          <span className="t-micro self-center" style={{ fontWeight: 400, letterSpacing: 0 }}>
            翻身列入 Q2H 達成率；細節可稍後於輸出入補記
          </span>
        </div>
      </section>

      {/* 輸出入量 */}
      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">輸出入量</span>
          <span className="t-micro num">今日 入 {totals?.in ?? 0} / 出 {totals?.out ?? 0} ml</span>
        </div>
        <div className="p-2.5 flex gap-1.5 overflow-x-auto">
          {IO_TYPES.map((t) => (
            <button key={t.key} className="opt shrink-0" style={{ fontSize: 13, padding: "0 11px" }}
                    data-on={io === t.key}
                    onClick={() => { setIo(t.key); setMl(""); setAmount(null); setQuality(null); setResidual(""); }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-2.5 pb-2.5 flex flex-col gap-2">
          {cur.ml && (
            <div className="flex items-center gap-2">
              <input className="numfield text-right" style={{ width: 120 }} inputMode="numeric"
                     placeholder="0" value={ml} onChange={(e) => setMl(e.target.value.replace(/[^\d]/g, ""))} />
              <span className="t-label">ml</span>
              {io === "tube" && (
                <>
                  <span className="t-sub" style={{ marginLeft: 8 }}>反抽</span>
                  <input className="numfield text-right" style={{ width: 86 }} inputMode="numeric"
                         placeholder="0" value={residual}
                         onChange={(e) => setResidual(e.target.value.replace(/[^\d]/g, ""))} />
                  <span className="t-label">ml</span>
                </>
              )}
            </div>
          )}

          {!cur.ml && (
            <div className="flex items-center gap-1.5">
              <span className="t-sub w-14">量</span>
              {AMOUNTS.map((a) => (
                <button key={a} className="opt flex-1" data-on={amount === a}
                        onClick={() => setAmount(amount === a ? null : a)}>{a}</button>
              ))}
            </div>
          )}

          {opts && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="t-sub w-14">{opts.label}</span>
              {opts.values.map((v) => (
                <button key={v} className="opt" style={{ fontSize: 13, padding: "0 11px" }}
                        data-on={quality === v}
                        onClick={() => setQuality(quality === v ? null : v)}>{v}</button>
              ))}
            </div>
          )}

          <button className="btn btn-primary" onClick={saveIo}
                  disabled={cur.ml ? ml.trim() === "" && !quality : !amount && !quality}>
            記錄{cur.label}
          </button>
        </div>
      </section>

      {/* 管路照護 */}
      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">管路照護</span></div>
        {info.tubes.length === 0 && <div className="empty">此個案無登錄管路</div>}
        {info.tubes.map((tube) => {
          const short = tube.split("（")[0];
          return (
            <div key={tube} className="px-3.5 py-3 flex flex-col gap-2"
                 style={{ borderBottom: "1px solid var(--hairline)" }}>
              <div className="t-label">{tube}</div>
              <div className="flex gap-1.5">
                <button className="opt flex-1" style={{ fontSize: 13 }}
                        onClick={() => quickEvent("tube_check", `${short} 勾檢：固定完整、通暢、皮膚正常`)}>
                  <Check size={14} weight="bold" style={{ display: "inline", marginRight: 3 }} />
                  三項勾檢正常
                </button>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>事件</span>
                {["滑脫", "阻塞", "自拔"].map((k) => (
                  <button key={k} className="opt" style={{ fontSize: 13, padding: "0 11px" }}
                          onClick={() => void tubeEvent(short, k)}>{k}</button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* 傷口／壓傷 */}
      <WoundSection caseId={caseId} />

      {/* 質性紅旗 */}
      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro" style={{ color: "var(--critical)" }}>緊急徵象（直通紅色警報）</span>
        </div>
        <div className="p-2.5 flex flex-col gap-1.5">
          {RED_FLAGS.map((f) => (
            <button key={f} className="opt text-left" style={{ borderColor: "var(--critical-line)" }}
                    onClick={() => setConfirmFlag(f)}>
              <WarningOctagon size={15} weight="fill" color="var(--critical)"
                              style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
              {f}
            </button>
          ))}
        </div>
      </section>

      {/* 今日紀錄 */}
      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">今日紀錄</span></div>
        {(timeline ?? []).length === 0 && <div className="empty">今日尚無照護紀錄</div>}
        {(timeline ?? []).map((it, i) => (
          <div key={i} className="row">
            <span className="t-micro num shrink-0" style={{ fontWeight: 400, letterSpacing: 0 }}>{fmtTime(it.at)}</span>
            <span className="t-sub flex-1" style={it.red ? { color: "var(--critical)", fontWeight: 700 } : undefined}>
              {it.text}
            </span>
          </div>
        ))}
      </section>

      {flash && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 sheet enter px-3.5 py-2 t-label"
             style={{ boxShadow: "var(--shadow)" }}>
          {flash}
        </div>
      )}

      {/* 紅旗確認 */}
      {confirmFlag && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3"
             style={{ background: "rgba(20,28,27,.45)" }} onClick={() => setConfirmFlag(null)}>
          <div className="sheet enter w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="row stripe stripe-critical">
              <WarningOctagon size={19} weight="fill" color="var(--critical)" />
              <span className="t-label" style={{ color: "var(--critical)" }}>確認記錄「{confirmFlag}」？</span>
            </div>
            <div className="px-3.5 py-2.5 t-sub">此徵象將直接觸發紅色警報並通報管理端。</div>
            <div className="p-2.5 flex gap-2" style={{ borderTop: "1px solid var(--hairline)" }}>
              <button className="btn btn-quiet flex-1" onClick={() => setConfirmFlag(null)}>取消</button>
              <button className="btn btn-critical flex-1"
                      onClick={async () => {
                        const f = confirmFlag; setConfirmFlag(null);
                        await quickEvent("red_flag", `緊急徵象：${f}`);
                        await fireRedAlert(f!);
                      }}>
                確認觸發
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 紅色警報覆蓋層 */}
      {redFired && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--critical-solid)" }}>
          <div className="mx-auto max-w-md min-h-[100dvh] p-4 flex flex-col gap-3 justify-center">
            <div className="flex items-center gap-2.5 text-white">
              <WarningOctagon size={34} weight="fill" />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>紅色警報</div>
                <div style={{ fontSize: 13, opacity: .85 }}>質性紅旗，不經數值判斷直接觸發</div>
              </div>
            </div>
            <div className="sheet">
              <div className="row stripe stripe-critical">
                <WarningOctagon size={17} weight="fill" color="var(--critical)" className="shrink-0" />
                <span className="t-label" style={{ color: "var(--critical)" }}>{redFired}</span>
              </div>
              <div className="px-3.5 py-3 t-sub">
                請立即確認病人狀態，必要時撥打 119。
                正式版此刻已推播 LINE 值班群；5 分鐘無人認領升級簡訊，10 分鐘語音輪撥。
              </div>
            </div>
            <a href="tel:119" className="btn btn-on-dark w-full" style={{ minHeight: 56, fontSize: 17 }}>
              <Phone size={20} weight="fill" /> 撥打 119
            </a>
            <button className="btn btn-on-dark w-full" onClick={() => setRedFired(null)}>確認並返回</button>
          </div>
        </div>
      )}
    </div>
  );
}
