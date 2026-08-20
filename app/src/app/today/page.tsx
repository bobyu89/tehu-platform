"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight, MapPin, Warning, Clock, SignOut } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded, resetDemo, SELF_ID } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { SosButton } from "@/components/SosButton";
import type { Shift } from "@/lib/types";

export default function TodayPage() {
  const mounted = useMounted();
  if (!mounted) return <TodaySkeleton />;
  return <TodayContent />;
}

function TodaySkeleton() {
  return (
    <main className="mx-auto max-w-md px-4 py-5 flex flex-col gap-4">
      <div className="skeleton h-4 w-28" />
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-32 w-full" style={{ borderRadius: "var(--r)" }} />
      <div className="skeleton h-40 w-full" style={{ borderRadius: "var(--r)" }} />
    </main>
  );
}

function TodayContent() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const shifts = useLiveQuery(() => db.shifts.orderBy("date").reverse().limit(4).toArray(), []);
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const openAlerts = useLiveQuery(() => db.alerts.where("status").equals("triggered").count(), []);
  const offers = useLiveQuery(async () => {
    const now = new Date().toISOString();
    return (await db.shifts.toArray()).filter(
      (s) => s.status === "offered" && s.nurseId === SELF_ID && (s.respondBy ?? "") >= now);
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 11 ? "早安" : hour < 18 ? "午安" : "晚安";
  const dateStr = new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });

  function caseName(id: string) { return cases?.find((c) => c.id === id)?.name ?? ""; }

  async function clockIn(s: Shift) {
    const stamp = new Date().toISOString();
    const save = (geo: Shift["clockInGeo"]) =>
      db.shifts.update(s.id, { status: "in_progress", clockInAt: stamp, clockInGeo: geo });
    if (!navigator.geolocation) { await save(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => void save({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      () => void save(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  }

  async function clockOut(s: Shift) {
    await db.shifts.update(s.id, { status: "completed", clockOutAt: new Date().toISOString() });
  }

  const hhmm = (iso: string) =>
    new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <main className="mx-auto max-w-md px-4 py-5 flex flex-col gap-4 pb-28">
      <header>
        <div className="t-micro">{dateStr}</div>
        <h1 className="t-hero mt-0.5">{greet}，陳護理師</h1>
      </header>

      {(offers ?? []).map((s) => (
        <div key={s.id} className="sheet stripe stripe-ok">
          <div className="sheet-title">
            <span className="t-micro" style={{ color: "var(--a-ink)" }}>新派單待回覆</span>
            <span className="t-micro num">期限 {new Date(s.respondBy!).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
          </div>
          <div className="px-3.5 py-2.5">
            <div className="t-row">{caseName(s.caseId)}</div>
            <div className="t-sub num">
              {s.date.slice(5).replace("-", "/")}　{String(s.startHH).padStart(2, "0")}:00-{String(s.endHH).padStart(2, "0")}:00
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {cases?.find((c) => c.id === s.caseId)?.careNeeds.map((n) => <span key={n} className="tag">{n}</span>)}
            </div>
          </div>
          <div className="p-2.5 flex gap-2" style={{ borderTop: "1px solid var(--hairline)" }}>
            <button className="btn btn-primary flex-1"
                    onClick={() => db.shifts.update(s.id, { status: "accepted" })}>接受</button>
            <button className="btn btn-quiet flex-1"
                    onClick={() => db.shifts.update(s.id, { status: "unassigned", nurseId: undefined, offeredAt: undefined, respondBy: undefined })}>
              拒絕
            </button>
          </div>
        </div>
      ))}

      {(openAlerts ?? 0) > 0 && (
        <Link href="/admin" className="sheet stripe stripe-caution flex items-center gap-3 px-3.5 py-3">
          <Warning size={20} weight="fill" color="var(--caution)" />
          <span className="t-label flex-1" style={{ color: "var(--caution)" }}>
            {openAlerts} 件警報未認領
          </span>
          <CaretRight size={16} color="var(--caution)" />
        </Link>
      )}

      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">今日班次</span>
          <span className="t-micro num">12 小時制</span>
        </div>
        {(shifts ?? []).length === 0 && <div className="empty">今日尚未排班</div>}
        {(shifts ?? []).map((s) => (
          <div key={s.id} className="px-3.5 py-3 flex flex-col gap-2.5"
               style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div className="flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <div className="t-row truncate">{caseName(s.caseId)}</div>
                <div className="t-sub num flex items-center gap-1.5">
                  <Clock size={13} />
                  {String(s.startHH).padStart(2, "0")}:00-{String(s.endHH).padStart(2, "0")}:00
                </div>
              </div>
              {s.status === "accepted" && <span className="tag">已接班</span>}
              {s.status === "in_progress" && <span className="tag tag-accent">服務中</span>}
              {s.status === "completed" && <span className="tag">已完成</span>}
            </div>

            <div className="flex gap-2">
              {s.status === "accepted" && (
                <button className="btn btn-primary flex-1" onClick={() => clockIn(s)}>
                  <MapPin size={18} weight="fill" /> 定位打卡上班
                </button>
              )}
              {s.status === "in_progress" && (
                <>
                  <Link href={`/case?id=${s.caseId}`} className="btn btn-primary flex-1">進入照護紀錄</Link>
                  <button className="btn btn-quiet" onClick={() => clockOut(s)} aria-label="下班打卡">
                    <SignOut size={18} />
                  </button>
                </>
              )}
              {s.status === "completed" && (
                <Link href={`/case/handoff?id=${s.caseId}`} className="btn btn-quiet flex-1">填寫交班</Link>
              )}
            </div>

            {s.clockInAt && (
              <div className="t-micro num" style={{ letterSpacing: 0 }}>
                上班 {hhmm(s.clockInAt)}
                {s.clockInGeo
                  ? `　定位誤差 ${Math.round(s.clockInGeo.acc)}m`
                  : "　無定位訊號，已標記異常待主管審核"}
                {s.clockOutAt && `　下班 ${hhmm(s.clockOutAt)}`}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">我的個案</span></div>
        {(cases ?? []).map((c) => (
          <Link key={c.id} href={`/case?id=${c.id}`} className="row stripe stripe-ok">
            <div className="flex-1 min-w-0">
              <div className="t-row">
                {c.name}
                <span className="t-sub font-normal">　{c.age} 歲・{c.setting}</span>
              </div>
              <div className="t-sub truncate">{c.dx}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {c.careNeeds.map((n) => <span key={n} className="tag">{n}</span>)}
              </div>
            </div>
            <CaretRight size={16} color="var(--ink-3)" />
          </Link>
        ))}
      </section>

      <footer className="flex flex-col items-center gap-2 pt-1">
        <Link href="/admin" className="t-label" style={{ color: "var(--a-ink)" }}>管理端儀表板</Link>
        <p className="t-micro" style={{ letterSpacing: 0, fontWeight: 400 }}>
          開發版．資料僅存於本機（離線優先）．
          <button className="underline" onClick={() => void resetDemo()}>重置示範資料</button>
        </p>
      </footer>

      <SosButton />
    </main>
  );
}
