"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight, Clock, MapPin, SignOut, Warning } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded, resetDemo, SELF_ID } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { clockIn, clockOut, isFinished, respond } from "@/modules/shifts";
import { SHIFT_STATUS_LABEL } from "@/lib/types";

// 今日班次（桌面版）：左欄班次與派單回覆、右欄個案入口。

export default function ConsoleTodayPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  // 同一頁面同時服務公司端與人員端：連結前綴依當前端決定
  const base = usePathname().startsWith("/staff") ? "/staff" : "/console";
  // 人員端只看自己的班次與個案；公司端看全局
  const mine = base === "/staff";
  const db = getDb();
  const shifts = useLiveQuery(
    () => db.shifts.orderBy("date").reverse().filter((s) => !mine || s.nurseId === SELF_ID).limit(6).toArray(), [mine]);
  const cases = useLiveQuery(async () => {
    const all = await db.cases.toArray();
    if (!mine) return all;
    const ids = new Set((await db.shifts.filter((s) => s.nurseId === SELF_ID).toArray()).map((s) => s.caseId));
    return all.filter((c) => ids.has(c.id));
  }, [mine]);
  const openAlerts = useLiveQuery(() => db.alerts.where("status").equals("triggered").count(), []);
  const offers = useLiveQuery(async () => {
    const now = new Date().toISOString();
    return (await db.shifts.toArray()).filter(
      (s) => s.status === "offered" && s.nurseId === SELF_ID && (s.respondBy ?? "") >= now);
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 11 ? "早安" : hour < 18 ? "午安" : "晚安";
  const dateStr = new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });
  const caseName = (id: string) => cases?.find((c) => c.id === id)?.name ?? "";
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1200px]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="t-micro">{dateStr}</div>
          <h1 className="t-head">{greet}，陳護理師</h1>
        </div>
        {(openAlerts ?? 0) > 0 && (
          <Link href="/console/alerts" className="tag tag-caution" style={{ fontSize: 13, padding: "6px 12px" }}>
            <Warning size={14} weight="fill" /> {openAlerts} 件警報未認領
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          {(offers ?? []).map((s) => (
            <div key={s.id} className="sheet stripe stripe-ok">
              <div className="sheet-title">
                <span className="t-micro" style={{ color: "var(--a-ink)" }}>新派單待回覆</span>
                <span className="t-micro num">期限 {s.respondBy ? hhmm(s.respondBy) : ""}</span>
              </div>
              <div className="px-3.5 py-2.5">
                <div className="t-row">{caseName(s.caseId)}</div>
                <div className="t-sub num">{s.date.slice(5).replace("-", "/")}　{String(s.startHH).padStart(2, "0")}:00-{String(s.endHH).padStart(2, "0")}:00</div>
              </div>
              <div className="p-2.5 flex gap-2" style={{ borderTop: "1px solid var(--hairline)" }}>
                <button className="btn btn-primary flex-1" onClick={() => void respond(s.id, true)}>接受</button>
                <button className="btn btn-quiet flex-1"
                        onClick={() => void respond(s.id, false)}>
                  拒絕
                </button>
              </div>
            </div>
          ))}

          <section className="sheet">
            <div className="sheet-title">
              <span className="t-micro">今日班次</span>
              <span className="t-micro num">12 小時制</span>
            </div>
            {(shifts ?? []).length === 0 && <div className="empty">今日尚未排班</div>}
            {(shifts ?? []).map((s) => (
              <div key={s.id} className="px-3.5 py-3 flex flex-col gap-2.5" style={{ borderBottom: "1px solid var(--hairline)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="t-row truncate">{caseName(s.caseId)}</div>
                    <div className="t-sub num flex items-center gap-1.5">
                      <Clock size={13} />
                      {s.date.slice(5).replace("-", "/")}　{String(s.startHH).padStart(2, "0")}:00-{String(s.endHH).padStart(2, "0")}:00
                    </div>
                  </div>
                  {s.status === "accepted" && <span className="tag">已接班</span>}
                  {s.status === "in_progress" && <span className="tag tag-accent">服務中</span>}
                  {isFinished(s) && <span className="tag">{SHIFT_STATUS_LABEL[s.status]}</span>}
                  {s.status === "offered" && <span className="tag tag-caution">待回覆</span>}
                  {s.status === "unassigned" && <span className="tag tag-caution">待派</span>}
                </div>
                <div className="flex gap-2">
                  {s.status === "accepted" && (
                    <button className="btn btn-primary" onClick={() => void clockIn(s.id)}>
                      <MapPin size={17} weight="fill" /> 定位打卡上班
                    </button>
                  )}
                  {s.status === "in_progress" && (
                    <>
                      <Link href={`${base}/case?id=${s.caseId}`} className="btn btn-primary">進入照護工作區</Link>
                      <button className="btn btn-quiet" onClick={() => void clockOut(s.id)}>
                        <SignOut size={17} /> 下班打卡
                      </button>
                    </>
                  )}
                  {isFinished(s) && (
                    <Link href={`${base}/case?id=${s.caseId}`} className="btn btn-quiet">填寫交班</Link>
                  )}
                </div>
                {s.clockInAt && (
                  <div className="t-micro num" style={{ letterSpacing: 0 }}>
                    上班 {hhmm(s.clockInAt)}
                    {s.clockInGeo ? `　定位誤差 ${Math.round(s.clockInGeo.acc)}m` : "　無定位訊號，已標記異常待審核"}
                    {s.clockOutAt && `　下班 ${hhmm(s.clockOutAt)}`}
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>

        <section className="sheet">
          <div className="sheet-title"><span className="t-micro">我的個案</span></div>
          {(cases ?? []).map((c) => (
            <Link key={c.id} href={`${base}/case?id=${c.id}`} className="row stripe stripe-ok" style={{ display: "flex" }}>
              <div className="flex-1 min-w-0">
                <div className="t-row">{c.name}<span className="t-sub font-normal">　{c.age} 歲・{c.setting}</span></div>
                <div className="t-sub truncate">{c.dx}</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.careNeeds.map((n) => <span key={n} className="tag">{n}</span>)}
                </div>
              </div>
              <CaretRight size={16} color="var(--ink-3)" />
            </Link>
          ))}
          <div className="px-3.5 py-2.5 text-center">
            <button className="t-micro underline" style={{ fontWeight: 400, letterSpacing: 0, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}
                    onClick={() => void resetDemo()}>
              重置示範資料
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
