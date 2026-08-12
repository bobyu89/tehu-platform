"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { ensureSeeded, resetDemo } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { SosButton } from "@/components/SosButton";
import type { Shift } from "@/lib/types";

export default function TodayPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <TodayContent />;
}

function TodayContent() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const shifts = useLiveQuery(() => db.shifts.orderBy("date").reverse().limit(4).toArray(), []);
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const openAlerts = useLiveQuery(() => db.alerts.where("status").equals("triggered").count(), []);

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

  return (
    <main className="mx-auto max-w-md px-4 py-5 flex flex-col gap-4 pb-28">
      <header>
        <div className="text-sm font-bold" style={{ color: "var(--c-muted)" }}>{dateStr}</div>
        <h1 className="text-2xl font-black">{greet}，陳護理師</h1>
      </header>

      {(openAlerts ?? 0) > 0 && (
        <Link href="/admin" className="card p-3 flex items-center justify-between"
              style={{ background: "var(--c-yellow-bg)", borderColor: "var(--c-yellow-line)" }}>
          <span className="font-bold text-sm" style={{ color: "var(--c-yellow)" }}>⚠ 有 {openAlerts} 件未認領警報</span>
          <span className="text-xs font-bold" style={{ color: "var(--c-yellow)" }}>管理端 →</span>
        </Link>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-black" style={{ color: "var(--c-muted)" }}>今日班次</h2>
        {(shifts ?? []).map((s) => (
          <div key={s.id} className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-black text-lg">{caseName(s.caseId)}</div>
                <div className="text-sm mono" style={{ color: "var(--c-muted)" }}>
                  {String(s.startHH).padStart(2, "0")}:00–{String(s.endHH).padStart(2, "0")}:00（12 小時班）
                </div>
              </div>
              {s.status === "accepted" && <span className="chip">已接班</span>}
              {s.status === "in_progress" && <span className="chip chip-accent">服務中</span>}
              {s.status === "completed" && <span className="chip">已完成</span>}
            </div>
            <div className="flex gap-2">
              {s.status === "accepted" && (
                <button className="btn-primary flex-1" onClick={() => clockIn(s)}>📍 GPS 打卡上班</button>
              )}
              {s.status === "in_progress" && (
                <>
                  <Link href={`/case/${s.caseId}`} className="btn-primary flex-1">進入個案 →</Link>
                  <button className="btn-ghost" onClick={() => clockOut(s)}>下班打卡</button>
                </>
              )}
              {s.status === "completed" && (
                <Link href={`/case/${s.caseId}/handoff`} className="btn-ghost flex-1">填寫交班 →</Link>
              )}
            </div>
            {s.clockInAt && (
              <div className="text-[11px] mono" style={{ color: "var(--c-muted)" }}>
                上班 {new Date(s.clockInAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                {s.clockInGeo ? `・GPS ±${Math.round(s.clockInGeo.acc)}m` : "・無定位（已標記異常，進主管審核）"}
                {s.clockOutAt && `｜下班 ${new Date(s.clockOutAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-black" style={{ color: "var(--c-muted)" }}>我的個案</h2>
        {(cases ?? []).map((c) => (
          <Link key={c.id} href={`/case/${c.id}`} className="card p-4 flex items-center justify-between">
            <div>
              <div className="font-black">{c.name} <span className="text-xs font-bold" style={{ color: "var(--c-muted)" }}>{c.age} 歲</span></div>
              <div className="text-xs mt-0.5" style={{ color: "var(--c-muted)" }}>{c.dx}</div>
              <div className="mt-1.5 flex gap-1.5">{c.careNeeds.map((n) => <span key={n} className="chip">{n}</span>)}</div>
            </div>
            <span className="chip">{c.setting}</span>
          </Link>
        ))}
      </section>

      <footer className="mt-4 text-center">
        <Link href="/admin" className="text-xs font-bold" style={{ color: "var(--c-accent-ink)" }}>管理端儀表板（示意）→</Link>
        <p className="mt-2 text-[11px] leading-5" style={{ color: "var(--c-muted)" }}>
          開發版・資料僅存於本機（離線優先）・
          <button className="underline" onClick={() => void resetDemo()}>重置示範資料</button>
        </p>
      </footer>

      <SosButton />
    </main>
  );
}
