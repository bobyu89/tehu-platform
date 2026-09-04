"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Certificate, ShieldCheck, Warning } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded, SELF_ID } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { daysUntil, toggleAvailability } from "@/modules/staff";

// 人員端「我的檔案」：個人資料、證照（到期提醒）、可服務時段（可自行調整）。
// 技術標籤由機構完訓考核授予，人員端唯讀。

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;

export default function ProfilePage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const nurse = useLiveQuery(() => db.nurses.get(SELF_ID), []);
  const profile = useLiveQuery(() => db.nurseProfiles.get(SELF_ID), []);
  const reviews = useLiveQuery(() => db.reviews.where("nurseId").equals(SELF_ID).toArray(), []);

  const avg = reviews && reviews.length > 0
    ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;

  const toggle = (day: string, slot: "day" | "night") => toggleAvailability(SELF_ID, day, slot);

  if (!nurse || !profile) return null;

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[960px]">
      <header>
        <h1 className="t-head">我的檔案</h1>
        <p className="t-sub">這份檔案是第三階段人才平台上家屬會看到的樣子：技術標籤由機構考核授予、評價由真實服務累積。</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
        <div className="flex flex-col gap-4">
          <section className="sheet">
            <div className="sheet-title"><span className="t-micro">個人資料</span></div>
            <div className="px-4 py-3 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full shrink-0 t-head"
                   style={{ background: "var(--a-wash)", color: "var(--a-ink)" }}>{nurse.name.slice(0, 1)}</div>
              <div className="min-w-0">
                <div className="t-head">{nurse.name}</div>
                <div className="t-sub">{profile.licenseNo}・{profile.yearsExp} 年經驗・{profile.employment}</div>
                <div className="t-sub">服務地區：{profile.areas.join("、")}</div>
                {avg != null && (
                  <div className="t-label mt-1" style={{ color: "var(--a-ink)" }}>
                    ★ {avg.toFixed(1)}<span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>　{reviews!.length} 則評價</span>
                  </div>
                )}
              </div>
            </div>
            {profile.bio && <div className="px-4 pb-3 t-sub" style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>{profile.bio}</div>}
          </section>

          <section className="sheet">
            <div className="sheet-title"><span className="t-micro">技術標籤（機構考核授予，為派單硬條件）</span></div>
            <div className="p-3 flex flex-wrap gap-1.5">
              {nurse.tags.map((t) => <span key={t} className="tag tag-accent"><ShieldCheck size={11} weight="fill" /> {t}</span>)}
            </div>
          </section>

          <section className="sheet">
            <div className="sheet-title"><span className="t-micro">證照與訓練</span></div>
            {profile.licenses.map((l) => {
              const d = daysUntil(l.expiresOn);
              const soon = d != null && d < 120;
              return (
                <div key={l.no} className={`row ${soon ? "stripe stripe-caution" : ""}`}>
                  <Certificate size={17} color={soon ? "var(--caution)" : "var(--a)"} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="t-label">{l.name}</div>
                    <div className="t-micro num" style={{ fontWeight: 400, letterSpacing: 0 }}>
                      {l.no}{l.expiresOn ? `　效期至 ${l.expiresOn}` : "　永久有效"}
                    </div>
                  </div>
                  {soon && <span className="tag tag-caution"><Warning size={11} weight="fill" /> {d! < 0 ? "已過期" : `${d} 天後到期`}</span>}
                </div>
              );
            })}
          </section>
        </div>

        <section className="sheet">
          <div className="sheet-title">
            <span className="t-micro">可服務時段</span>
            <span className="t-micro">點格子切換</span>
          </div>
          <div className="p-3">
            <div className="grid gap-1" style={{ gridTemplateColumns: "2.5rem repeat(2, 1fr)" }}>
              <div />
              <div className="t-micro text-center">白班</div>
              <div className="t-micro text-center">夜班</div>
              {WEEKDAYS.map((d) => (
                <div key={d} className="contents">
                  <div className="t-label flex items-center justify-center">{d}</div>
                  {(["day", "night"] as const).map((slot) => {
                    const on = (profile.availability[d] ?? []).includes(slot);
                    return (
                      <button key={slot} className="opt" style={{ minHeight: 38 }} data-on={on}
                              onClick={() => void toggle(d, slot)}>
                        {on ? "可" : ""}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="t-micro mt-3" style={{ fontWeight: 400, letterSpacing: 0 }}>
              派單時系統只會把班次配給標記可上班的時段。費率 {profile.hourlyRate} 元／時（{profile.employment}）。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
