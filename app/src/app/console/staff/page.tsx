"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Certificate, Star, Warning } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { ratingOf } from "@/modules/customers";
import { daysUntil } from "@/modules/staff";
import { rollupByNurse } from "@/modules/shifts";

// 公司管理端「人員管理」：技術標籤、證照效期、可服務時段、近 30 日出勤、評價。

export default function StaffAdminPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const nurses = useLiveQuery(() => db.nurses.toArray(), []);
  const profiles = useLiveQuery(() => db.nurseProfiles.toArray(), []);
  const reviews = useLiveQuery(() => db.reviews.toArray(), []);
  const shifts = useLiveQuery(() => db.shifts.toArray(), []);
  const rollup = rollupByNurse(shifts ?? []);

  const expiring = (profiles ?? []).flatMap((p) =>
    p.licenses.filter((l) => { const d = daysUntil(l.expiresOn); return d != null && d < 120; })
      .map((l) => ({ nurseId: p.nurseId, ...l, days: daysUntil(l.expiresOn)! })));
  const nameOf = (id: string) => nurses?.find((n) => n.id === id)?.name ?? id;

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1100px]">
      <header>
        <h1 className="t-head">人員管理</h1>
        <p className="t-sub">技術標籤是派單硬條件，由機構完訓考核授予；證照效期到期前 120 天提醒。</p>
      </header>

      {expiring.length > 0 && (
        <section className="sheet">
          <div className="sheet-title"><span className="t-micro" style={{ color: "var(--caution)" }}>證照即將到期</span><span className="t-micro num">{expiring.length} 筆</span></div>
          {expiring.map((e) => (
            <div key={`${e.nurseId}-${e.no}`} className="row stripe stripe-caution">
              <Warning size={16} weight="fill" color="var(--caution)" className="shrink-0" />
              <span className="t-label flex-1">{nameOf(e.nurseId)}　{e.name}</span>
              <span className="tag tag-caution">{e.days < 0 ? "已過期" : `${e.days} 天`}</span>
            </div>
          ))}
        </section>
      )}

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">護理師</span><span className="t-micro num">{nurses?.length ?? 0} 位</span></div>
        {(nurses ?? []).map((n) => {
          const p = profiles?.find((x) => x.nurseId === n.id);
          const r = ratingOf(reviews ?? [], n.id);
          const w = rollup[n.id];
          const avail = p ? Object.values(p.availability).reduce((a, v) => a + v.length, 0) : 0;
          return (
            <div key={n.id} className="px-3.5 py-3 flex flex-col gap-1.5" style={{ borderBottom: "1px solid var(--hairline)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="t-label">{n.name}</span>
                <span className="t-sub">{p ? `${p.employment}・${p.yearsExp} 年・${p.hourlyRate} 元/時` : ""}</span>
                {r && <span className="tag"><Star size={11} weight="fill" /> {r.avg.toFixed(1)}（{r.n}）</span>}
                <span className="t-micro num" style={{ marginLeft: "auto", fontWeight: 400, letterSpacing: 0 }}>
                  近 30 日 {w?.shifts ?? 0} 班・{(w?.hours ?? 0).toFixed(0)} 小時・可服務時段 {avail}/14
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {n.tags.map((t) => <span key={t} className="tag tag-accent">{t}</span>)}
                {p?.licenses.map((l) => <span key={l.no} className="tag"><Certificate size={11} /> {l.name}</span>)}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
