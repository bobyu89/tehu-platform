import type { Metadata } from "next";
import { Inter, Noto_Sans_TC } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import s from "./landing.module.css";
import { DemoSwitch, MenuButton, RevealObserver, ShowcaseStage, StaySlider } from "./landing-client";
import consoleShot from "@/assets/landing/console.webp";
import staffShot from "@/assets/landing/staff-case.webp";
import handoffShot from "@/assets/landing/handoff.webp";
import familyShot from "@/assets/landing/family.webp";
import alertsShot from "@/assets/landing/alerts.webp";
import baselineShot from "@/assets/landing/baseline.webp";
import handoffCardShot from "@/assets/landing/handoff-card.webp";
import thumbVitals from "@/assets/landing/thumb-vitals.webp";
import thumbHandoff from "@/assets/landing/thumb-handoff.webp";
import thumbFamily from "@/assets/landing/thumb-family.webp";

// Landing Page：保康健康科技品牌首頁。
// 版型方向：taste-skill「sentence-as-layout」（一句話就是版面，句中放一格真實畫面）。
// 圖片全部是平台示範版的實際截圖（示範資料皆虛構）；沒有授權的照片，所以不用人物圖庫。
// 內容原則：不放虛構案例與數字；每個數字都對得到規格（02、03、04 冊）；用語遵守醫材紅線（紀錄、提醒、彙整）。

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoTC = Noto_Sans_TC({ weight: ["400", "500", "700"], preload: false, variable: "--font-noto-tc" });

export const metadata: Metadata = {
  title: "保康健康科技｜住院一對一特護",
  description: "保康健康科技提供住院期間的一對一特別護理；床邊紀錄、異常提醒與交班簽收都在自己的平台上完成。",
};

const NAV = [
  { label: "照護平台", href: "#platform" },
  { label: "一個班", href: "#shift" },
  { label: "常見問題", href: "#faq" },
];

const FEATURES = [
  {
    title: ["數值越線，", "立刻通知主管"],
    shot: { src: alertsShot, alt: "公司管理端的警報佇列與近 7 日警報數：每筆警報都有認領與結案紀錄" },
    line: "SpO₂ ≤ 91%、脈搏 ≥ 130 次/分，或咖啡渣樣嘔吐物等緊急徵象，直接發紅色警報。",
    demo: { label: "SpO₂ 量到 91%", on: "紅色警報・已通知值班主管", off: "數值在範圍內，不通知", initial: true },
    field: "sage",
  },
  {
    title: ["偏離平時水準，", "先提醒一聲"],
    shot: { src: baselineShot, alt: "個案 SpO₂ 近 7 日趨勢：帶狀區為平均上下 2 個標準差，虛線為個人平均線" },
    line: "與個案近 7 天的平均差 2 個標準差就提示；差 3 個標準差且往惡化方向才發黃色，永遠不發紅色。",
    demo: { label: "脈搏高於平時 3 個標準差", on: "黃色警報・偏離個案平時水準", off: "在平時範圍內", initial: false },
    field: "paper",
  },
  {
    title: ["四項全勾，", "才能簽收交班"],
    shot: { src: handoffCardShot, alt: "交班已簽收歸檔：送出與簽收時間、本班摘要，勾稽區 4 / 4 項已勾認" },
    line: "管路、藥品、病人當下狀態、特殊物品，接班者逐項勾認後才能簽收；歸檔後只能補註，不能改。",
    demo: { label: "第四項：特殊物品已勾認", on: "4 / 4 項・可以簽收", off: "3 / 4 項・還不能簽收", initial: true },
    field: "gold",
  },
  {
    title: ["排班自動守住", "休息時間"],
    shot: null,
    line: "同一位護理師前後兩班至少間隔 11 小時；不足時系統不讓指派。",
    demo: { label: "上一班 8 小時前才結束", on: "不能指派・間隔不足 11 小時", off: "可以指派", initial: false },
    field: "teal",
  },
  {
    title: ["家屬看的是", "溝通版日報"],
    shot: { src: familyShot, alt: "家屬日報預覽：今日量測、血氧近 7 日趨勢、今日照護與護理師的話" },
    line: "量測趨勢、進食與照護摘要、護理師的話；不含警報處置細節與交班備註。",
    demo: { label: "切換成家屬看到的版本", on: "溝通版・量測趨勢與照護摘要", off: "內部版・含警報處置與交班備註", initial: false },
    field: "navy",
  },
] as const;

// 一個班的四段，grow 依實際時長（小時）；最窄 12%，讓短的段落也看得見
const SHIFT = [
  { when: "30 分鐘內", hours: 0.5, text: "先在 30 分鐘內回覆派單，接下或婉拒都留紀錄" },
  { when: "到班時", hours: 0.25, text: "到班定位打卡；位置異常時照樣打卡，交主管審核" },
  { when: "12 小時", hours: 12, text: "照護 12 小時，量測、給藥、事件都留下紀錄" },
  { when: "交班後", hours: 1, text: "交班送出，接班者逐項簽收；60 分鐘未簽收會提醒主管" },
];

const FAQ = [
  {
    q: "現在可以預約特護了嗎？",
    a: (
      <>
        還不行。目前是品牌與平台的展示階段，尚未開放正式預約；上線時間與服務範圍依合法資格與合作機構公告為準。想先了解流程，可以試填
        <Link href="/client/request" className={s.link}>示範需求表單</Link>。
      </>
    ),
  },
  { q: "系統會替護理師做判斷嗎？", a: "不會。系統負責紀錄、提醒與彙整；判斷與處置永遠由具資格的護理人員與醫師負責。" },
  { q: "家屬看得到哪些資訊？", a: "溝通版的照護日報：生命徵象趨勢、進食與照護摘要、護理師的話。內部處置細節與交班備註不對外顯示。" },
  { q: "每一家醫院都能請特護嗎？", a: "不能直接假設可以。須依各醫院規定、服務內容、護理執業法規與合作安排個別確認。" },
  { q: "為什麼是 12 小時兩班制？", a: "連續 24 小時的照護，品質與護理師的身體都撐不住。系統預設兩班制，並守住兩班之間至少 11 小時的休息。" },
  { q: "護理人員加入有什麼保障？", a: "派單依技術標籤與休息間隔把關，班表與收入在照護人員端都看得到；工作安全與合理報酬是平台設計的前提。" },
];

const JS_FLAG = "document.documentElement.classList.add('js')";

export default function LandingPage() {
  return (
    <div className={`${s.page} ${inter.variable} ${notoTC.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      <RevealObserver />

      <header className={s.nav}>
        <a href="#top" className={s.wordmark}>保康健康科技</a>
        <nav className={s.navLinks} aria-label="主要導覽">
          {NAV.map((n) => <a key={n.href} href={n.href} className={s.link}>{n.label}</a>)}
        </nav>
        <Link href="/console" className={`${s.button} ${s.navAction}`}>進入示範平台</Link>
        <MenuButton links={NAV}>
          <Link href="/console">進入示範平台</Link>
        </MenuButton>
      </header>

      <main id="top">
        {/* ---------- Hero：一句話，句中一格交班簽收畫面 ---------- */}
        <section className={s.hero} aria-labelledby="hero-title">
          <div className={s.sky}>
            <h1 id="hero-title" className={s.heroTitle}>
              <span className={s.mask}><span>住院一對一特護</span></span>
              <span className={s.mask}>
                <span>
                  每一班都
                  <span className={s.slot} aria-hidden="true">
                    <Image src={handoffShot} alt="" sizes="20vw" />
                  </span>
                  交得清楚
                </span>
              </span>
            </h1>
            <p className={s.horizon}>
              <span>保康健康科技提供住院期間的一對一特別護理，</span>
              <span>床邊紀錄、異常提醒與交班簽收都在自己的平台上完成。</span>
            </p>
          </div>
          <figure className={s.heroShot} data-shutter>
            <Image src={consoleShot} alt="公司管理端總覽：服務中個案、今日班次、未認領警報與依 NEWS2 排序的個案清單" sizes="100vw" priority />
          </figure>
          <div className={s.heroBand}>
            <Link href="/console" className={`${s.button} ${s.buttonBlock}`}>進入示範平台</Link>
          </div>
        </section>

        {/* ---------- 開場陳述：三個縮圖就在句子裡 ---------- */}
        <section className={s.intro} aria-label="平台簡介">
          <p className={s.statement} data-reveal>
            {/* 縮圖和前一個詞綁在一起，避免縮圖落在行首 */}
            護理師在床邊記下每一筆<span className={s.keep}>量測<span className={s.thumb}><Image src={thumbVitals} alt="" sizes="80px" /></span>，</span>
            下班前把四項逐一勾認、完成<span className={s.keep}>交班<span className={s.thumb}><Image src={thumbHandoff} alt="" sizes="80px" /></span>，</span>
            家人每天收到一份溝通版<span className={s.keep}>日報<span className={s.thumb}><Image src={thumbFamily} alt="" sizes="80px" /></span>。</span>
          </p>
        </section>

        {/* ---------- 展示：同一支手機，三種距離 ---------- */}
        <section id="platform" aria-labelledby="showcase-title">
          <ShowcaseStage>
            <div className={s.stage}>
              <h2 id="showcase-title" className={s.stageTop}>一支手機</h2>
              <figure className={s.frame}>
                <Image src={staffShot} alt="照護人員端個案頁：個案摘要、最近一次量測與生命徵象輸入欄" sizes="(max-width: 720px) 72vw, 30vw" />
              </figure>
              <p className={s.stageBottom}>記完一整輪量測</p>
              <p className={s.stageCaption}>
                送出就判定：越過臨界值發紅色警報、偏離平時水準先提醒、NEWS2 自動計分。示範版可以直接操作。
              </p>
            </div>
          </ShowcaseStage>
        </section>

        {/* ---------- 功能：一句一帶，每帶一個可切換的情境 ---------- */}
        <section className={s.features} aria-labelledby="features-title">
          <h2 id="features-title" className={s.sectionTitle} data-reveal>系統守住的事</h2>
          {FEATURES.map((f) => (
            <article key={f.title.join("")} className={s.band} data-field={f.field}>
              <div className={s.bandText} data-reveal>
                <h3 className={s.bandTitle}>
                  <span>{f.title[0]}</span>
                  <span>{f.title[1]}</span>
                </h3>
                <p>{f.line}</p>
              </div>
              <div className={s.proof}>
                {f.shot && (
                  <figure className={s.proofShot} data-reveal>
                    <Image src={f.shot.src} alt={f.shot.alt} sizes="(max-width: 900px) 100vw, 40vw" />
                  </figure>
                )}
                <DemoSwitch {...f.demo} />
              </div>
            </article>
          ))}
        </section>

        {/* ---------- 試算：住院天數 → 班數 ---------- */}
        <section className={s.stats} aria-labelledby="stay-title">
          <h2 id="stay-title" className={s.sectionTitle} data-reveal>家人要住院幾天？</h2>
          <StaySlider />
          <p className={s.statsNote} data-reveal>
            以 12 小時兩班制計算：天數 × 2。同一位護理師兩班之間至少休息 11 小時，所以至少需要 2 位護理師輪替；實際人數依排班與休假另計。
          </p>
        </section>

        {/* ---------- 一個班怎麼走：長度照實際時間 ---------- */}
        <section id="shift" className={s.shift} aria-labelledby="shift-title">
          <h2 id="shift-title" className={s.sectionTitle} data-reveal>一個班怎麼走</h2>
          <div className={s.bar} data-ui data-reveal role="img" aria-label="一個班的四段時間：30 分鐘內回覆、到班打卡、照護 12 小時、交班簽收">
            {SHIFT.map((x) => (
              <span key={x.when} className={s.segment} style={{ flexGrow: x.hours }}>{x.when}</span>
            ))}
          </div>
          <ol className={s.shiftList}>
            {SHIFT.map((x) => (
              <li key={x.when} data-reveal><strong>{x.when}</strong>{x.text}</li>
            ))}
          </ol>
        </section>

        {/* ---------- 常見問題：答案全部攤開 ---------- */}
        <section id="faq" className={s.faq} aria-labelledby="faq-title">
          <h2 id="faq-title" className={s.faqTitle}>常見問題</h2>
          <dl className={s.faqList}>
            {FAQ.map((f) => (
              <div key={f.q} className={s.faqRow} data-reveal>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- 行動 ---------- */}
        <section className={s.cta} aria-labelledby="cta-title">
          <h2 id="cta-title" className={s.ctaTitle} data-reveal>
            <span>把每一班</span>
            <span>交給專業</span>
          </h2>
          <p data-reveal>示範平台已可直接操作：公司管理端、照護人員端、客戶端。資料只存在你的瀏覽器。</p>
          <Link href="/console" className={s.button} data-reveal>進入示範平台</Link>
        </section>
      </main>

      <footer className={s.footer}>
        <span>保康健康科技・住院一對一特護</span>
        <nav aria-label="頁尾">
          <Link href="/console" className={s.link}>示範平台</Link>
          <Link href="/client/request" className={s.link}>需求表單</Link>
          <a href="#top" className={s.link}>回到頂端</a>
        </nav>
        <span>© {new Date().getFullYear()}・展示版，非正式預約或醫療建議</span>
      </footer>
    </div>
  );
}
