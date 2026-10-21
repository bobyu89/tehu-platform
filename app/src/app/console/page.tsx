"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight, Check, Siren, Warning, WarningOctagon } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { scanUrineOutput } from "@/modules/care";
import { useMounted } from "@/components/useMounted";
import type { AlertRow, ObsType } from "@/lib/types";
import { OBS_LABEL, SHIFT_STATUS_LABEL } from "@/lib/types";
import { isFinished } from "@/modules/shifts";
import { computeNews2, type News2Result } from "@/lib/news2";
import * as alertOps from "@/modules/alerts";
import { layerLabel } from "@/modules/alerts";
import { fmtDateTime, fmtTime } from "@/lib/digest";

// 主控台總覽：一頁看全局。
// 佈局為桌面優先 12 欄格；KPI 列→警報佇列＋七日趨勢｜NEWS2 個案＋班次＋SOS。

const STRIP: ObsType[] = ["spo2", "bp", "hr", "bt"];

function dstr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ConsolePage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <ConsoleContent />;
}

function ConsoleContent() {
  // 時間窗規則（尿量）沒有輸入事件可觸發：示範資料補完後掃一次，之後每 5 分鐘掃描（正式版由 pg_cron 負責）
  useEffect(() => {
    void ensureSeeded().then(() => scanUrineOutput());
    const t = setInterval(() => { void scanUrineOutput(); }, 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  const db = getDb();
  const today = dstr(new Date());

  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const nurses = useLiveQuery(() => db.nurses.toArray(), []);
  const shifts = useLiveQuery(() => db.shifts.where("date").equals(today).toArray(), [today]);
  const sosOpen = useLiveQuery(async () =>
    (await db.sos.toArray()).filter((s) => !s.resolvedAt), []);
  const alerts7d = useLiveQuery(async () => {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    return (await db.alerts.toArray()).filter((a) => a.triggeredAt >= since);
  }, []);

  const medStats = useLiveQuery(async () => {
    const d = new Date();
    const meds = await db.meds.toArray();
    const due = meds.flatMap((m) => m.slots.filter((s) => s <= d.getHours())).length;
    const logs = (await db.medLogs.toArray()).filter((l) => l.date === today);
    return { due, given: logs.filter((l) => l.status === "given").length };
  }, [today]);

  const perCase = useLiveQuery(async () => {
    const out: Record<string, { news2: News2Result; strip: Partial<Record<ObsType, string>>; overdueMin: number }> = {};
    const since12h = new Date(Date.now() - 12 * 3600_000).toISOString();
    for (const c of await db.cases.toArray()) {
      const obs = await db.observations.where("caseId").equals(c.id).toArray();
      const recent = obs.filter((o) => o.measuredAt >= since12h);
      const strip: Partial<Record<ObsType, string>> = {};
      for (const t of STRIP) {
        const o = obs.filter((x) => x.type === t && x.value.main != null)
          .reduce<typeof obs[number] | undefined>((a, r) => (!a || r.measuredAt > a.measuredAt ? r : a), undefined);
        if (o) strip[t] = t === "bp" && o.value.dbp != null ? `${o.value.main}/${o.value.dbp}` : String(o.value.main);
      }
      const vitals = obs.filter((o) => ["bt", "hr", "rr", "bp", "spo2"].includes(o.type));
      const lastVital = vitals.reduce<string | null>((a, r) => (!a || r.measuredAt > a ? r.measuredAt : a), null);
      const overdueMin = c.vitalsIntervalH && lastVital
        ? Math.round((Date.now() - new Date(lastVital).getTime()) / 60000) - c.vitalsIntervalH * 60
        : 0;
      out[c.id] = { news2: computeNews2(c, recent), strip, overdueMin };
    }
    return out;
  }, []);

  const open = (alerts7d ?? []).filter((a) => a.status === "triggered" || a.status === "claimed")
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));
  const openRed = open.filter((a) => a.level === "red").length;
  const activeCases = (cases ?? []).filter((c) => (c.status ?? "active") === "active");
  const inService = (shifts ?? []).filter((s) => s.status === "in_progress").length;
  const overdueCases = Object.values(perCase ?? {}).filter((x) => x.overdueMin > 30).length;

  const nameOf = (id: string) => cases?.find((c) => c.id === id)?.name ?? "";
  const nurseName = (id?: string) => nurses?.find((n) => n.id === id)?.name ?? "未指派";
  const claim = (a: AlertRow) => alertOps.claim(a.id);
  const close = (a: AlertRow) => alertOps.close(a.id);

  const sortedCases = [...activeCases].sort((a, b) =>
    (perCase?.[b.id]?.news2.total ?? -1) - (perCase?.[a.id]?.news2.total ?? -1));

  // 七日警報趨勢（含今日）
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return dstr(d);
  });
  const trend = days.map((day) => {
    const rows = (alerts7d ?? []).filter((a) => a.triggeredAt.slice(0, 10) === day);
    return { day, yellow: rows.filter((a) => a.level === "yellow").length, red: rows.filter((a) => a.level === "red").length };
  });
  const trendMax = Math.max(1, ...trend.map((t) => t.yellow + t.red));

  const dateStr = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1400px]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="t-head">總覽</h1>
        <span className="t-sub">{dateStr}</span>
      </header>

      {/* KPI 列 */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="服務中個案" value={String(activeCases.length)} sub={`共 ${cases?.length ?? 0} 個案`} />
        <Stat label="今日班次" value={`${inService} / ${shifts?.length ?? 0}`} sub="服務中 / 排班" />
        <Stat label="未認領警報" value={String(open.filter((a) => a.status === "triggered").length)}
              sub={openRed > 0 ? `含紅色 ${openRed} 件` : "無紅色"} tone={openRed > 0 ? "critical" : open.length > 0 ? "caution" : undefined} />
        <Stat label="今日給藥" value={medStats ? `${medStats.given} / ${medStats.due}` : "…"} sub="已給 / 到期" />
        <Stat label="量測逾排程" value={String(overdueCases)} sub="逾 30 分個案數" tone={overdueCases > 0 ? "caution" : undefined} />
        <Stat label="未結 SOS" value={String(sosOpen?.length ?? 0)} sub="緊急求助事件" tone={(sosOpen?.length ?? 0) > 0 ? "critical" : undefined} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* 左：警報佇列＋趨勢 */}
        <div className="xl:col-span-7 flex flex-col gap-4">
          <section className="sheet">
            <div className="sheet-title">
              <span className="t-micro">警報佇列（處理中）</span>
              <Link href="/console/alerts" className="t-micro flex items-center" style={{ color: "var(--a-ink)" }}>
                警報中心 <CaretRight size={12} />
              </Link>
            </div>
            {open.length === 0 && <div className="empty">目前沒有未結案的警報</div>}
            {open.slice(0, 8).map((a) => (
              <div key={a.id} className={`row ${a.level === "red" ? "stripe stripe-critical" : "stripe stripe-caution"}`}>
                {a.level === "red"
                  ? <WarningOctagon size={18} weight="fill" color="var(--critical)" className="shrink-0" />
                  : <Warning size={17} weight="fill" color="var(--caution)" className="shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="t-label truncate">
                    <span style={{ color: a.level === "red" ? "var(--critical)" : "var(--caution)" }}>{nameOf(a.caseId)}</span>
                    　{a.summary}
                  </div>
                  <div className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>
                    {layerLabel(a.layer)}
                    　{fmtDateTime(a.triggeredAt)}
                    {a.claimedAt && `　已認領`}{a.handledNote && `　${a.handledNote}`}
                  </div>
                </div>
                {a.status === "triggered"
                  ? <button className="btn btn-primary shrink-0" style={{ minHeight: 36, padding: "0 11px", fontSize: 13 }} onClick={() => claim(a)}>認領</button>
                  : <button className="btn btn-quiet shrink-0" style={{ minHeight: 36, padding: "0 11px", fontSize: 13 }} onClick={() => close(a)}>結案</button>}
              </div>
            ))}
          </section>

          <section className="sheet">
            <div className="sheet-title">
              <span className="t-micro">近 7 日警報數</span>
              <span className="flex items-center gap-3">
                <span className="t-micro flex items-center gap-1" style={{ letterSpacing: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--caution)", display: "inline-block" }} /> 黃色
                </span>
                <span className="t-micro flex items-center gap-1" style={{ letterSpacing: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--critical-solid)", display: "inline-block" }} /> 紅色
                </span>
              </span>
            </div>
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-end gap-2" style={{ height: 120 }}>
                {trend.map((t) => (
                  <div key={t.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                       title={`${t.day}：黃 ${t.yellow}、紅 ${t.red}`}>
                    <span className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>
                      {t.yellow + t.red > 0 ? t.yellow + t.red : ""}
                    </span>
                    <div className="w-full max-w-9 flex flex-col" style={{ gap: 2 }}>
                      {t.red > 0 && <div style={{ height: (t.red / trendMax) * 88, background: "var(--critical-solid)", borderRadius: 3 }} />}
                      {t.yellow > 0 && <div style={{ height: (t.yellow / trendMax) * 88, background: "var(--caution)", borderRadius: 3, opacity: .85 }} />}
                      {t.yellow + t.red === 0 && <div style={{ height: 2, background: "var(--hairline)", borderRadius: 2 }} />}
                    </div>
                    <span className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>{t.day.slice(5).replace("-", "/")}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* 右：NEWS2 個案＋班次＋SOS */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <section className="sheet">
            <div className="sheet-title">
              <span className="t-micro">個案總覽（依 NEWS2 排序）</span>
            </div>
            {sortedCases.map((c) => {
              const p = perCase?.[c.id];
              const n = p?.news2;
              return (
                <Link key={c.id} href={`/console/case?id=${c.id}`} className="row row-tap" style={{ display: "flex" }}>
                  <div className="flex-1 min-w-0">
                    <div className="t-label">
                      {c.name}
                      <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>　{c.age} 歲・{c.setting}</span>
                    </div>
                    <div className="t-micro num mt-0.5" style={{ letterSpacing: 0, fontWeight: 400 }}>
                      {STRIP.map((t) => `${OBS_LABEL[t]} ${p?.strip[t] ?? "-"}`).join("　")}
                    </div>
                    {p && p.overdueMin > 30 && (
                      <span className="tag tag-caution mt-1">量測逾 {p.overdueMin} 分</span>
                    )}
                  </div>
                  {n && (
                    <span className={`tag num shrink-0 ${n.complete && n.band === "high" ? "tag-critical" : n.complete && (n.band === "medium" || n.band === "low-medium") ? "tag-caution" : ""}`}>
                      NEWS2 {n.complete ? `${n.total}・${n.bandLabel}` : "資料不全"}
                    </span>
                  )}
                </Link>
              );
            })}
          </section>

          <section className="sheet">
            <div className="sheet-title"><span className="t-micro">今日班次與出勤</span></div>
            {(shifts ?? []).length === 0 && <div className="empty">今日無排班</div>}
            {(shifts ?? []).map((s) => (
              <div key={s.id} className="row">
                <div className="flex-1 min-w-0">
                  <div className="t-label truncate">
                    {nameOf(s.caseId)}
                    <span className="t-sub font-normal num">　{String(s.startHH).padStart(2, "0")}:00-{String(s.endHH).padStart(2, "0")}:00</span>
                  </div>
                  <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
                    {nurseName(s.nurseId)}
                    {s.clockInAt && `・上班 ${fmtTime(s.clockInAt)}${s.clockInGeo ? "" : "（無定位，待審核）"}`}
                    {s.clockOutAt && `・下班 ${fmtTime(s.clockOutAt)}`}
                  </div>
                </div>
                {s.status === "in_progress" && <span className="tag tag-accent">服務中</span>}
                {s.status === "accepted" && <span className="tag">已接班</span>}
                {isFinished(s) && <span className="tag"><Check size={11} weight="bold" /> {s.status === "completed" ? "完成" : SHIFT_STATUS_LABEL[s.status]}</span>}
                {s.status === "offered" && <span className="tag tag-caution">待回覆</span>}
                {s.status === "unassigned" && <span className="tag tag-caution">待派</span>}
              </div>
            ))}
          </section>

          <section className="sheet">
            <div className="sheet-title"><span className="t-micro">SOS 緊急事件</span></div>
            {(sosOpen ?? []).length === 0
              ? <div className="empty">無未結事件</div>
              : (sosOpen ?? []).map((s) => (
                <div key={s.id} className="row stripe stripe-critical">
                  <Siren size={17} weight="fill" color="var(--critical)" className="shrink-0" />
                  <span className="t-label flex-1" style={{ color: "var(--critical)" }}>
                    {s.kind === "patient_emergency" ? "病人急變" : s.kind === "violence" ? "暴力威脅" : s.kind === "environment" ? "環境危險" : "未分類"}
                  </span>
                  <span className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>{fmtDateTime(s.triggeredAt)}</span>
                </div>
              ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "caution" | "critical" }) {
  return (
    <div className={`sheet px-3.5 py-3 ${tone === "critical" ? "stripe stripe-critical" : tone === "caution" ? "stripe stripe-caution" : "stripe stripe-ok"}`}>
      <div className="t-micro">{label}</div>
      <div className="num" style={{
        fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.3,
        color: tone === "critical" ? "var(--critical)" : tone === "caution" ? "var(--caution)" : "var(--ink)",
      }}>
        {value}
      </div>
      <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>{sub}</div>
    </div>
  );
}
