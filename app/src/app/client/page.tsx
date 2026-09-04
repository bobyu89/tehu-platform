"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarBlank, HeartStraight, Signature } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { ReviewForm } from "@/components/ReviewForm";
import { fmtDateTime } from "@/lib/digest";

// 客戶端「我的個案」：家屬看到的是溝通版——今天做了什麼、整體平穩與否、誰在照顧。
// 不出現內部處置細節、交班備註與 NEWS2（CONTEXT.md 不變量 5）。

const CUSTOMER_ID = "cust-wang"; // 原型固定以王志明視角

function dayKey(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ClientHome() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const customer = useLiveQuery(() => db.customers.get(CUSTOMER_ID), []);
  const caseId = customer?.caseIds[0] ?? "";
  const info = useLiveQuery(() => (caseId ? db.cases.get(caseId) : undefined), [caseId]);
  const nurses = useLiveQuery(() => db.nurses.toArray(), []);
  const todayShift = useLiveQuery(async () =>
    (await db.shifts.where("date").equals(dayKey(0)).toArray()).find((s) => s.caseId === caseId), [caseId]);
  const week = useLiveQuery(async () => {
    if (!caseId) return [];
    const out: { day: string; vitals: number; care: number; calm: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const start = new Date(); start.setDate(start.getDate() - d); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const s = start.toISOString(), e = end.toISOString();
      const vitals = await db.observations.where("caseId").equals(caseId).filter((o) => o.measuredAt >= s && o.measuredAt < e && o.category === "vital").count();
      const care = await db.events.where("caseId").equals(caseId).filter((x) => x.occurredAt >= s && x.occurredAt < e).count();
      const red = await db.alerts.where("caseId").equals(caseId).filter((a) => a.triggeredAt >= s && a.triggeredAt < e && a.level === "red").count();
      out.push({ day: dayKey(d), vitals, care, calm: red === 0 });
    }
    return out;
  }, [caseId]);
  const docs = useLiveQuery(() => db.signedDocs.filter((d) => d.caseId === caseId).toArray(), [caseId]);
  const myReviews = useLiveQuery(() => db.reviews.where("caseId").equals(caseId).count(), [caseId]);

  const nurseName = (id?: string) => nurses?.find((n) => n.id === id)?.name ?? "尚未指派";
  if (!customer || !info) return null;
  const today = week?.[0];

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[960px]">
      <header>
        <div className="t-micro">{customer.name}（{customer.relation}）</div>
        <h1 className="t-head">{info.name} 的照護</h1>
        <p className="t-sub">
          {today?.calm !== false ? "今日整體平穩，各項數值在照護團隊的掌握之中。" : "今日部分數值有起伏，護理師已即時處理並持續加強觀察，請您放心。"}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">今日照護人員</div>
          <div className="t-head" style={{ fontSize: 20 }}>{nurseName(todayShift?.nurseId)}</div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
            {todayShift ? `${String(todayShift.startHH).padStart(2, "0")}:00-${String(todayShift.endHH).padStart(2, "0")}:00・${todayShift.status === "in_progress" ? "服務中" : "已排班"}` : "今日無排班"}
          </div>
        </div>
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">今日量測</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>{today?.vitals ?? 0} 次</div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>生命徵象與血糖</div>
        </div>
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">今日照護動作</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>{today?.care ?? 0} 次</div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>翻身、抽痰、管路照護</div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <section className="sheet">
          <div className="sheet-title">
            <span className="t-micro">本週日報</span>
            <Link href="/console/family-report" className="t-micro flex items-center gap-1" style={{ color: "var(--a-ink)" }}>
              <HeartStraight size={12} weight="fill" /> 看完整日報
            </Link>
          </div>
          {(week ?? []).map((w) => (
            <div key={w.day} className="row">
              <CalendarBlank size={15} color="var(--ink-3)" className="shrink-0" />
              <span className="t-label num flex-1">{w.day.slice(5).replace("-", "/")}</span>
              <span className="t-sub num">量測 {w.vitals}・照護 {w.care}</span>
              <span className={`tag ${w.calm ? "tag-accent" : "tag-caution"}`}>{w.calm ? "平穩" : "有留意"}</span>
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-4">
          <ReviewForm caseId={caseId} nurseId={todayShift?.nurseId} customerName={customer.name} given={myReviews ?? 0} />
          <section className="sheet">
            <div className="sheet-title"><span className="t-micro">已簽署文件</span></div>
            {(docs ?? []).length === 0 && <div className="empty">尚無文件</div>}
            {(docs ?? []).map((d) => (
              <div key={d.id} className="row">
                <Signature size={15} color="var(--ink-3)" className="shrink-0" />
                <span className="t-label flex-1 truncate">{d.kind}</span>
                <span className="t-micro num" style={{ fontWeight: 400, letterSpacing: 0 }}>{fmtDateTime(d.signedAt)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
