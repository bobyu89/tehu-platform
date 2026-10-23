"use client";

import { useEffect, useRef, useState } from "react";
import s from "./landing.module.css";

// Landing 的互動元件：進場動畫、展示區三段距離、功能區示範開關、住院天數試算。
// 進場與 shutter 只在 html.js 下隱藏起始狀態（page.tsx 以 inline script 設定），沒有 JS 時全部直接可見。

/** 監看 [data-reveal] 與 [data-shutter]，進入視窗時加上 is-in */
export function RevealObserver() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal], [data-shutter]");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add(s.isIn));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add(s.isIn);
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

/** 行動版選單：文字按鈕，展開為整頁清單 */
export function MenuButton({ links, children }: { links: { label: string; href: string }[]; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.menu}>
      <button type="button" className={s.menuButton} aria-expanded={open} aria-controls="landing-menu" onClick={() => setOpen((v) => !v)}>
        {open ? "關閉" : "選單"}
      </button>
      <nav id="landing-menu" className={s.menuSheet} hidden={!open} aria-label="行動版導覽">
        {links.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
        ))}
        {children}
      </nav>
    </div>
  );
}

/** 展示區：同一張畫面三種距離，捲動經過三個隱形標記時切換 */
export function ShowcaseStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(1);
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const markers = root.querySelectorAll<HTMLElement>("[data-stage-marker]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setStage(Number((e.target as HTMLElement).dataset.stageMarker));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    markers.forEach((m) => io.observe(m));
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={s.showcase} data-stage={stage}>
      {children}
      <div className={s.markers} aria-hidden="true">
        <div data-stage-marker="1" />
        <div data-stage-marker="2" />
        <div data-stage-marker="3" />
      </div>
    </div>
  );
}

/** 功能區示範開關：切換情境，右側結果跟著變 */
export function DemoSwitch({ label, on, off, initial }: { label: string; on: string; off: string; initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <div className={s.demo} data-ui data-on={checked}>
      <button type="button" role="switch" aria-checked={checked} className={s.switch} onClick={() => setChecked((v) => !v)}>
        <span className={s.knob} aria-hidden="true" />
        <span>{label}</span>
      </button>
      <p className={s.demoResult} aria-live="polite">{checked ? on : off}</p>
    </div>
  );
}

/** 住院天數 → 班數（12 小時兩班制） */
export function StaySlider() {
  const [days, setDays] = useState(7);
  return (
    <div className={s.stay}>
      <label className={s.stayLabel} htmlFor="stay-days">
        住院 <output htmlFor="stay-days">{days}</output> 天
      </label>
      <input
        id="stay-days" className={s.range} type="range" min={1} max={30} value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        style={{ "--fill": `${((days - 1) / 29) * 100}%` } as React.CSSProperties}
      />
      <p className={s.figure} aria-live="polite">
        <span key={days} className={s.figureNumber}>{days * 2}</span>
        <span className={s.figureUnit}>個班</span>
      </p>
    </div>
  );
}
