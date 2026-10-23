import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import s from "../site.module.css";
import { Bands, PageHead, type Band } from "../parts";
import consoleShot from "@/assets/landing/console.webp";
import alertsCenterShot from "@/assets/landing/alerts-center.webp";
import staffHomeShot from "@/assets/landing/staff-home.webp";
import clientHomeShot from "@/assets/landing/client-home.webp";
import alertsShot from "@/assets/landing/alerts.webp";
import baselineShot from "@/assets/landing/baseline.webp";
import familyShot from "@/assets/landing/family.webp";
import handoffCardShot from "@/assets/landing/handoff-card.webp";

// 平台與服務：保康的產品是照護品質平台（三端），不是護理服務本身。
// 每個數字都對得到規格（02、03、04 冊）。

export const metadata: Metadata = {
  title: "平台與服務",
  description: "公司管理端、照護人員端、客戶端：床邊紀錄、三層異常警報、交班簽收、派單與排班、家屬日報。",
};

const PORTALS = [
  {
    name: "公司管理端",
    who: "護理長、調度、行政",
    text: "總覽、需求進線、派單、出勤審核、警報中心、個案照護、家屬日報、績效與品質數據。",
    href: "/console",
    shot: { src: alertsCenterShot, alt: "公司管理端警報中心：每筆警報的觸發、認領、處置與結案" },
  },
  {
    name: "照護人員端",
    who: "護理人員本人",
    text: "今日班次與接案、定位打卡、床邊量測與給藥紀錄、交班、我的檔案與收入明細。",
    href: "/staff",
    shot: { src: staffHomeShot, alt: "照護人員端：今日班次、定位打卡上班與填寫交班" },
  },
  {
    name: "客戶端",
    who: "家屬",
    text: "我的個案、今日照護人員、量測與照護次數、每週日報、給照護人員的評價。",
    href: "/client",
    shot: { src: clientHomeShot, alt: "客戶端：今日照護人員、今日量測次數與本週日報" },
  },
];

const FAMILY_BANDS: Band[] = [
  {
    title: ["數值越線，", "立刻通知主管"],
    line: "SpO₂ ≤ 91%、脈搏 ≥ 130 次/分，或咖啡渣樣嘔吐物等緊急徵象，直接發紅色警報給值班主管，每一筆都有認領與結案紀錄。",
    shot: { src: alertsShot, alt: "公司管理端的警報佇列與近 7 日警報數：每筆警報都有認領與結案紀錄" },
    demo: { label: "SpO₂ 量到 91%", on: "紅色警報・已通知值班主管", off: "數值在範圍內，不通知", initial: true },
    field: "sage",
  },
  {
    title: ["偏離平時水準，", "先提醒一聲"],
    line: "每位病人的平時水準不一樣。與他近 7 天的平均差 2 個標準差就提示；差 3 個標準差且往惡化方向才發黃色。",
    shot: { src: baselineShot, alt: "個案 SpO₂ 近 7 日趨勢：帶狀區為平均上下 2 個標準差，虛線為個人平均線" },
    demo: { label: "脈搏高於平時 3 個標準差", on: "黃色警報・偏離平時水準", off: "在平時範圍內", initial: false },
    field: "paper",
  },
  {
    title: ["每天一份", "看得懂的日報"],
    line: "量測趨勢、進食與照護摘要、護理人員的話。內部的處置細節與交班備註不放進日報。",
    shot: { src: familyShot, alt: "家屬日報：今日量測、血氧近 7 日趨勢、今日照護與護理人員的話" },
    demo: { label: "切換成家屬看到的版本", on: "溝通版・量測趨勢與照護摘要", off: "內部版・含警報處置與交班備註", initial: false },
    field: "navy",
  },
];

const NURSE_BANDS: Band[] = [
  {
    title: ["排班自動守住", "休息時間"],
    line: "12 小時兩班制，同一位護理人員前後兩班至少間隔 11 小時；不足時系統不讓指派。",
    shot: null,
    demo: { label: "上一班 8 小時前才結束", on: "不能指派・間隔不足 11 小時", off: "可以指派", initial: true },
    field: "teal",
  },
  {
    title: ["派單看專長，", "可以婉拒"],
    line: "個案需要的技術必須在你的技術標籤裡，不符合的不會派給你。收到派單 30 分鐘內回覆，接下或婉拒都留紀錄。",
    shot: null,
    demo: { label: "你有氣切照護標籤", on: "符合・可以派給你", off: "不會派給你・缺少氣切照護標籤", initial: false },
    field: "sage",
  },
  {
    title: ["遇到危險，", "長按就有人接"],
    line: "長按 SOS 2 秒、10 秒倒數內可取消；送出後同時通知值班群與主管，2 分鐘沒人認領就電話輪撥，並每 30 秒回報位置。病人急變請先打 119。",
    shot: null,
    demo: { label: "長按 SOS 2 秒", on: "倒數 10 秒後送出・隨時可取消", off: "待命中", initial: false },
    field: "gold",
  },
  {
    title: ["交班不用重寫，", "接班逐項簽收"],
    line: "本班的量測、給藥與警報處置自動帶入，你只補判斷與交辦。接班者把管路、藥品、病人狀態、特殊物品四項勾完才能簽收，歸檔後只能補註。",
    shot: { src: handoffCardShot, alt: "交班已簽收歸檔：送出與簽收時間、本班摘要，勾稽區 4 / 4 項已勾認" },
    demo: { label: "第四項：特殊物品已勾認", on: "4 / 4 項・可以簽收", off: "3 / 4 項・還不能簽收", initial: true },
    field: "paper",
  },
];

export default function PlatformPage() {
  return (
    <>
      <PageHead id="platform-title" title="平台與服務" shot={{ src: consoleShot, alt: "公司管理端總覽：KPI、警報佇列與依 NEWS2 排序的個案" }}>
        一套平台、三個入口：公司管理端管品質與調度，照護人員端在床邊記錄，客戶端讓家屬看見照護。
      </PageHead>

      {/* ---------- 三個入口 ---------- */}
      <section className={s.portals} aria-labelledby="portals-title">
        <h2 id="portals-title" className={s.sectionTitle} data-reveal>三個入口</h2>
        {PORTALS.map((p) => (
          <article key={p.name} className={s.portal}>
            <div className={s.portalText} data-reveal>
              <h3 className={s.bandTitle}>{p.name}</h3>
              <p className={s.portalWho}>給{p.who}</p>
              <p>{p.text}</p>
              <Link href={p.href} className={`${s.link} ${s.more}`}>打開{p.name}示範</Link>
            </div>
            <figure className={s.portalShot} data-reveal>
              <Image src={p.shot.src} alt={p.shot.alt} sizes="(max-width: 900px) 100vw, 50vw" />
            </figure>
          </article>
        ))}
      </section>

      {/* ---------- 給家屬 ---------- */}
      <section id="family" className={s.features} aria-labelledby="family-title">
        <h2 id="family-title" className={s.sectionTitle} data-reveal>給家屬：你不在床邊時</h2>
        <Bands bands={FAMILY_BANDS} />
      </section>

      {/* ---------- 給護理人員 ---------- */}
      <section id="nurses" className={s.features} aria-labelledby="nurses-title">
        <h2 id="nurses-title" className={s.sectionTitle} data-reveal>給護理人員：制度替你守著</h2>
        <Bands bands={NURSE_BANDS} />
      </section>
    </>
  );
}
