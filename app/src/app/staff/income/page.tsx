"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { ensureSeeded, SELF_ID } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { incomeOf } from "@/modules/staff";
import { fmtTime } from "@/lib/digest";

// 人員端「收入管理」：以已完成班次的實際工時 × 費率估算。
// 正式版由機構結算後帶入，並依僱傭／承攬分別處理扣繳與勞健保。

export default function IncomePage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const profile = useLiveQuery(() => db.nurseProfiles.get(SELF_ID), []);
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const shifts = useLiveQuery(() => db.shifts.toArray(), []);

  const rate = profile?.hourlyRate ?? 0;
  const { rows: incomeRows, totalHours, totalPay } = incomeOf(shifts ?? [], SELF_ID, rate);
  const rows = incomeRows.map((r) => ({ s: r.shift, hours: r.hours, pay: r.pay }));

  const byCase: Record<string, { shifts: number; pay: number }> = {};
  for (const r of rows) {
    byCase[r.s.caseId] = byCase[r.s.caseId] ?? { shifts: 0, pay: 0 };
    byCase[r.s.caseId].shifts += 1;
    byCase[r.s.caseId].pay += r.pay;
  }
  const caseName = (id: string) => cases?.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[960px]">
      <header>
        <h1 className="t-head">收入管理</h1>
        <p className="t-sub">近 30 日已完成班次，依實際打卡工時估算。正式版由機構月結後帶入正式金額。</p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">近 30 日估算收入</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>NT$ {totalPay.toLocaleString()}</div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>{profile?.employment ?? ""}・{rate} 元／時</div>
        </div>
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">完成班次</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>{rows.length}</div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>{totalHours.toFixed(1)} 小時</div>
        </div>
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">平均每班</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>
            NT$ {rows.length > 0 ? Math.round(totalPay / rows.length).toLocaleString() : 0}
          </div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>{rows.length > 0 ? (totalHours / rows.length).toFixed(1) : 0} 小時／班</div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
        <section className="sheet">
          <div className="sheet-title"><span className="t-micro">班次明細</span></div>
          {rows.length === 0 && <div className="empty">近 30 日尚無已完成班次</div>}
          {rows.map(({ s, hours, pay }) => (
            <div key={s.id} className="row">
              <div className="flex-1 min-w-0">
                <div className="t-label truncate">{caseName(s.caseId)}<span className="t-sub font-normal num">　{s.date.slice(5).replace("-", "/")}</span></div>
                <div className="t-micro num" style={{ fontWeight: 400, letterSpacing: 0 }}>
                  {fmtTime(s.clockInAt!)}–{fmtTime(s.clockOutAt!)}　{hours.toFixed(1)} 小時
                </div>
              </div>
              <span className="num t-label">NT$ {pay.toLocaleString()}</span>
            </div>
          ))}
        </section>

        <section className="sheet">
          <div className="sheet-title"><span className="t-micro">依個案</span></div>
          {Object.entries(byCase).map(([id, v]) => (
            <div key={id} className="row">
              <span className="t-label flex-1">{caseName(id)}</span>
              <span className="num t-sub">{v.shifts} 班</span>
              <span className="num t-label">NT$ {v.pay.toLocaleString()}</span>
            </div>
          ))}
          <div className="px-3.5 py-2.5 t-micro" style={{ borderTop: "1px solid var(--hairline)", fontWeight: 400, letterSpacing: 0 }}>
            承攬者由機構開立勞務報酬並依法扣繳；僱傭者另含勞健保與加班費計算。
          </div>
        </section>
      </div>
    </div>
  );
}
