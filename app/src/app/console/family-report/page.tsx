"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { HeartStraight, PaperPlaneTilt } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import type { ObsType } from "@/lib/types";
import { OBS_LABEL, OBS_UNIT } from "@/lib/types";
import { computeBaseline, round1 } from "@/lib/alert-engine";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";

// 家屬日報（Phase 1.5，規劃書 05 冊權限矩陣）：
// 「溝通版日報」與內部紀錄完全分離——內部要誠實直白，對外要專業溫和。
// 不出現：警報內部處置、交班備註、NEWS2 分數。
// 正式版每日固定時間推送至家屬 LINE（對外官方帳號）。

const RANGE_TYPES: ObsType[] = ["bt", "hr", "bp", "spo2"];

export default function FamilyReportPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const [caseId, setCaseId] = useState("case-wang");
  const [note, setNote] = useState("");

  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const info = cases?.find((c) => c.id === caseId);

  const data = useLiveQuery(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const iso = start.toISOString();
    const obs = await db.observations.where("caseId").equals(caseId).toArray();
    const todayObs = obs.filter((o) => o.measuredAt >= iso);

    const ranges = RANGE_TYPES.flatMap((t) => {
      const nums = todayObs.filter((o) => o.type === t && typeof o.value.main === "number").map((o) => o.value.main as number);
      if (nums.length === 0) return [];
      return [{ t, min: Math.min(...nums), max: Math.max(...nums), n: nums.length }];
    });

    const vitalsCount = todayObs.filter((o) => o.category === "vital").length;
    const intake = todayObs.filter((o) => o.category === "io_in" && typeof o.value.main === "number")
      .reduce((a, o) => a + (o.value.main as number), 0);

    const start7d = new Date(Date.now() - 7 * 86400_000).toISOString();
    const spo2Series: TrendPoint[] = obs
      .filter((o) => o.type === "spo2" && o.measuredAt >= start7d && typeof o.value.main === "number")
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
      .map((o) => ({ t: new Date(o.measuredAt).getTime(), v: o.value.main as number, iso: o.measuredAt }));

    const ev = await db.events.where("caseId").equals(caseId).filter((e) => e.occurredAt >= iso).toArray();
    const reposition = ev.filter((e) => e.type === "reposition").length;
    const suction = ev.filter((e) => e.type === "suction").length;

    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const meds = await db.meds.where("caseId").equals(caseId).toArray();
    const medDue = meds.flatMap((m) => m.slots.filter((s) => s <= d.getHours())).length;
    const medGiven = (await db.medLogs.where("caseId").equals(caseId).toArray())
      .filter((l) => l.date === date && l.status === "given").length;

    const alertsToday = (await db.alerts.where("caseId").equals(caseId).toArray())
      .filter((a) => a.triggeredAt >= iso);

    return { ranges, vitalsCount, intake, spo2Series, reposition, suction, medDue, medGiven, alertsToday: alertsToday.length };
  }, [caseId]);

  const baseline = computeBaseline("spo2", (data?.spo2Series ?? []).map((p) => p.v));

  // 溫和版狀態句（不透露內部警報處置細節）
  const statusLine = !data ? "" :
    data.alertsToday === 0
      ? "今日整體平穩，各項數值在照護團隊的掌握之中。"
      : "今日部分數值有起伏，護理師已即時處理並持續加強觀察，請您放心。";

  const dateStr = new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[860px]">
      <header>
        <h1 className="t-head">家屬日報預覽</h1>
        <p className="t-sub" style={{ maxWidth: "60ch" }}>
          溝通版與內部紀錄完全分離：不含警報處置細節、交班備註與評分。
          正式版每日固定時間由對外 LINE 官方帳號推送給家屬。
        </p>
      </header>

      <div className="flex gap-1.5">
        {(cases ?? []).map((c) => (
          <button key={c.id} className="opt" style={{ fontSize: 13, minHeight: 40 }}
                  data-on={caseId === c.id} onClick={() => setCaseId(c.id)}>{c.name}</button>
        ))}
      </div>

      {/* ---- 日報卡（即家屬在 LINE 看到的內容）---- */}
      <div className="sheet" style={{ maxWidth: 560 }}>
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div className="flex items-center gap-1.5 t-micro" style={{ color: "var(--a-ink)" }}>
            <HeartStraight size={13} weight="fill" /> 特護平台・照護日報
          </div>
          <div className="t-head mt-1">{info?.name}　{dateStr}</div>
          <p className="t-sub mt-1">{statusLine}</p>
        </div>

        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div className="t-micro mb-1.5">今日量測（共 {data?.vitalsCount ?? 0} 次）</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px" style={{ background: "var(--hairline)" }}>
            {(data?.ranges ?? []).map((r) => (
              <div key={r.t} className="px-2 py-2 text-center" style={{ background: "var(--surface)" }}>
                <div className="t-micro" style={{ letterSpacing: ".03em" }}>{OBS_LABEL[r.t]}</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>
                  {round1(r.min)}{r.min !== r.max ? ` - ${round1(r.max)}` : ""}
                </div>
                <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>{OBS_UNIT[r.t]}</div>
              </div>
            ))}
            {(data?.ranges ?? []).length === 0 && (
              <div className="col-span-4 empty" style={{ background: "var(--surface)" }}>今日尚無量測</div>
            )}
          </div>
        </div>

        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div className="t-micro mb-1">血氧近 7 日趨勢</div>
          <TrendChart points={data?.spo2Series ?? []} baseline={baseline} unit="%" maxV={100} />
        </div>

        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div className="t-micro mb-1.5">今日照護</div>
          <div className="t-sub leading-7">
            進食與水分：攝入約 <b className="num">{data?.intake ?? 0}</b> ml
            {(data?.reposition ?? 0) > 0 && <>　翻身擺位 <b className="num">{data?.reposition}</b> 次</>}
            {(data?.suction ?? 0) > 0 && <>　抽痰 <b className="num">{data?.suction}</b> 次</>}
            {(data?.medDue ?? 0) > 0 && <>　協助服藥 <b className="num">{data?.medGiven} / {data?.medDue}</b></>}
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="t-micro mb-1.5">護理師的話</div>
          <textarea className="textfield" style={{ minHeight: 72, fontSize: 14 }}
                    placeholder={`例：${info?.name ?? ""}今天精神不錯，下午聽廣播時有跟著哼歌。`}
                    value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="px-4 py-2.5 t-micro" style={{ background: "var(--sunken)", fontWeight: 400, letterSpacing: 0 }}>
          本日報為照護紀錄之整理摘要，不構成醫療診斷。如有疑問請聯繫機構：（示範）02-1234-5678
        </div>
      </div>

      <button className="btn btn-primary self-start" disabled>
        <PaperPlaneTilt size={16} weight="fill" /> 推送至家屬 LINE（接上官方帳號後啟用）
      </button>
    </div>
  );
}
