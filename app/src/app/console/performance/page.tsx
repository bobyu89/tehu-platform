"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Medal } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { performanceOf } from "@/modules/staff";

// 公司管理端「績效」：近 30 日出勤、評價、警報處理、交班準時、給藥準時、客訴。
// 這張表就是第三階段人才平台「品質徽章」的原料（規劃書 09 冊）。

export default function PerformancePage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const data = useLiveQuery(async () => ({
    nurses: await db.nurses.toArray(),
    shifts: await db.shifts.toArray(),
    reviews: await db.reviews.toArray(),
    alerts: await db.alerts.toArray(),
    handoffs: await db.handoffs.toArray(),
    medLogs: await db.medLogs.toArray(),
    complaintNurseIds: (await db.complaints.toArray()).map((c) => c.nurseId),
  }), []);

  const rows = (data?.nurses ?? []).map((n) => ({ n, p: performanceOf(n.id, data!) }))
    .sort((a, b) => (b.p.rating?.avg ?? 0) - (a.p.rating?.avg ?? 0));

  const pct = (x: { onTime?: number; given?: number; total: number }) =>
    x.total === 0 ? "—" : `${Math.round(((x.onTime ?? x.given ?? 0) / x.total) * 100)}%`;

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1100px]">
      <header>
        <h1 className="t-head">績效</h1>
        <p className="t-sub" style={{ maxWidth: "62ch" }}>近 30 日。指標來自真實紀錄，不靠自評：這是日後開放平台上競品抄不走的信任資產。</p>
      </header>

      <section className="sheet" style={{ overflowX: "auto" }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ background: "var(--sunken)" }}>
              {["護理師", "班數", "工時", "評價", "警報認領", "交班準時", "給藥準時", "客訴"].map((h) => (
                <th key={h} className="t-micro text-left px-3 py-2" style={{ borderBottom: "1px solid var(--hairline)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ n, p }, i) => (
              <tr key={n.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                <td className="px-3 py-2.5 t-label">
                  {i === 0 && p.rating && <Medal size={14} weight="fill" color="var(--caution)" style={{ display: "inline", marginRight: 4 }} />}
                  {n.name}
                </td>
                <td className="px-3 py-2.5 num t-label">{p.shifts}</td>
                <td className="px-3 py-2.5 num t-label">{p.hours.toFixed(0)}h</td>
                <td className="px-3 py-2.5 num t-label">{p.rating ? `${p.rating.avg.toFixed(1)} (${p.rating.n})` : "—"}</td>
                <td className="px-3 py-2.5 num t-label">{p.alertsClaimed}</td>
                <td className="px-3 py-2.5 num t-label">{pct(p.handoffOnTime)}</td>
                <td className="px-3 py-2.5 num t-label">{pct(p.medOnTime)}</td>
                <td className="px-3 py-2.5 num t-label">{p.complaints > 0 ? <span className="tag tag-caution">{p.complaints}</span> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3.5 py-2.5 t-micro" style={{ borderTop: "1px solid var(--hairline)", fontWeight: 400, letterSpacing: 0 }}>
          警報認領為全機構近 30 日認領數（示範資料未記錄認領者）；交班準時＝送出後 60 分鐘內簽收；給藥準時＝其班次個案當日給藥完成率。
        </div>
      </section>
    </div>
  );
}
