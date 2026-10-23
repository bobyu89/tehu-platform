import type { Metadata } from "next";
import { Inter, Noto_Sans_TC } from "next/font/google";
import Image, { type StaticImageData } from "next/image";
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
import clientHomeShot from "@/assets/landing/client-home.webp";
import staffHomeShot from "@/assets/landing/staff-home.webp";
import thumbVitals from "@/assets/landing/thumb-vitals.webp";
import thumbHandoff from "@/assets/landing/thumb-handoff.webp";
import thumbFamily from "@/assets/landing/thumb-family.webp";

// Landing Page：保康健康科技品牌首頁，分兩條路：家屬（找特護）與護理師（考慮加入）。
// 版型方向：taste-skill「sentence-as-layout」（一句話就是版面，句中放一格真實畫面）。
// 圖片全部是平台示範版的實際截圖（示範資料皆虛構）；沒有授權的照片，所以不用人物圖庫。
// 內容原則：不放虛構案例與數字；費率尚未定案，不寫價格；每個數字都對得到規格（02、03、04 冊）；
// 用語遵守醫材紅線（紀錄、提醒、彙整）。

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoTC = Noto_Sans_TC({ weight: ["400", "500", "700"], preload: false, variable: "--font-noto-tc" });

export const metadata: Metadata = {
  title: "保康健康科技｜住院一對一特護",
  description: "保康健康科技提供住院期間的一對一特別護理。給家屬：特護做什麼、怎麼申請、每天看得到什麼；給護理師：班怎麼排、遇到危險怎麼辦、紀錄怎麼寫。",
};

const NAV = [
  { label: "給家屬", href: "#family" },
  { label: "給護理師", href: "#nurses" },
  { label: "常見問題", href: "#faq" },
];

type Band = {
  title: readonly [string, string];
  line: string;
  shot: { src: StaticImageData; alt: string } | null;
  demo: { label: string; on: string; off: string; initial: boolean };
  field: "sage" | "paper" | "gold" | "teal" | "navy";
};

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
    line: "量測趨勢、進食與照護摘要、護理師的話。內部的處置細節與交班備註不放進日報。",
    shot: { src: familyShot, alt: "家屬日報：今日量測、血氧近 7 日趨勢、今日照護與護理師的話" },
    demo: { label: "切換成家屬看到的版本", on: "溝通版・量測趨勢與照護摘要", off: "內部版・含警報處置與交班備註", initial: false },
    field: "navy",
  },
];

const NURSE_BANDS: Band[] = [
  {
    title: ["排班自動守住", "休息時間"],
    line: "12 小時兩班制，同一位護理師前後兩班至少間隔 11 小時；不足時系統不讓指派。",
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

const STEPS = [
  { when: "提出需求", text: "說明住院的醫院、時段，以及管路、傷口、失智等照護需求" },
  { when: "確認可行", text: "確認需要的技術，以及醫院是否允許特護進駐、有哪些規定" },
  { when: "說明服務", text: "說明服務內容、班數、費用與契約條件，雙方同意後排班" },
  { when: "開始照護", text: "符合技術標籤的護理師到班，你每天收到一份溝通版日報" },
];

// 一個班的四段，grow 依實際時長（小時）；最窄 12%，讓短的段落也看得見
const SHIFT = [
  { when: "30 分鐘內", hours: 0.5, text: "先在 30 分鐘內回覆派單，接下或婉拒都留紀錄" },
  { when: "到班時", hours: 0.25, text: "到班定位打卡；位置異常時照樣打卡，交主管審核" },
  { when: "12 小時", hours: 12, text: "照護 12 小時，量測、給藥、事件都留下紀錄" },
  { when: "交班後", hours: 1, text: "交班送出，接班者逐項簽收；60 分鐘未簽收會提醒主管" },
];

const FAQ_FAMILY = [
  {
    q: "現在可以預約特護了嗎？",
    a: (
      <>
        還不行。目前是品牌與平台的展示階段，尚未開放正式預約；上線時間與服務範圍依合法資格與合作機構公告為準。想先了解流程，可以試填
        <Link href="/client/request" className={s.link}>示範需求表單</Link>。
      </>
    ),
  },
  { q: "特護和看護有什麼不同？", a: "保康的特護都持有護理師執照，能做護理評估、管路與傷口照護；看護多為照顧服務員，以生活照顧為主。涉及醫療輔助的處置，特護依醫囑執行。" },
  { q: "每一家醫院都能請特護嗎？", a: "不能直接假設可以。須依各醫院規定、服務內容、護理執業法規與合作安排個別確認。" },
  { q: "費用怎麼算？", a: "以班計價，一班 12 小時，依照護需求調整。正式費率會和服務一起公布，示範表單不會收費。" },
  { q: "系統會替護理師做判斷嗎？", a: "不會。系統負責紀錄、提醒與彙整；判斷與處置永遠由具資格的護理人員與醫師負責。" },
];

const FAQ_NURSE = [
  { q: "現在可以加入了嗎？", a: "還沒有開放招募。平台與制度正在展示階段，開放時會一併公布資格、班表與報酬。" },
  { q: "需要什麼資格？", a: "護理師證書與有效的執業登記。氣切、呼吸器、傷口等特殊技術，完訓並通過考核後取得技術標籤，派單依標籤把關。" },
  { q: "收入怎麼算？", a: "依實際打卡工時計算，每一班的時數與金額在照護人員端都查得到；正式費率另行公布。" },
  { q: "為什麼是 12 小時兩班制？", a: "連續 24 小時的照護，品質與護理師的身體都撐不住。系統預設兩班制，並守住兩班之間至少 11 小時的休息。" },
  { q: "醫院地下室收不到定位怎麼辦？", a: "照樣可以打卡。系統標記為位置異常，交主管審核，不會因為收不到訊號而打不了卡。" },
];

const JS_FLAG = "document.documentElement.classList.add('js')";

function Bands({ bands }: { bands: Band[] }) {
  return bands.map((f) => (
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
  ));
}

function Faq({ id, title, items }: { id: string; title: string; items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className={s.faqGroup}>
      <h2 id={id} className={s.faqTitle}>{title}</h2>
      <dl className={s.faqList}>
        {items.map((f) => (
          <div key={f.q} className={s.faqRow} data-reveal>
            <dt>{f.q}</dt>
            <dd>{f.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

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
              <span>讓家屬看得見照護，也讓護理師有制度可依。</span>
            </p>
          </div>
          <figure className={s.heroShot} data-shutter>
            <Image src={consoleShot} alt="公司管理端總覽：服務中個案、今日班次、未認領警報與依 NEWS2 排序的個案清單" sizes="100vw" priority />
          </figure>
          <div className={s.heroBand}>
            <Link href="/client/request" className={`${s.button} ${s.buttonBlock}`}>試填照護需求</Link>
          </div>
        </section>

        {/* ---------- 分流：家屬／護理師 ---------- */}
        <section className={s.forkSection} aria-labelledby="fork-title">
          <h2 id="fork-title" className={s.sectionTitle} data-reveal>你是哪一位？</h2>
          <div className={s.fork}>
            <a href="#family" className={s.forkCard} data-field="sage" data-reveal>
              <h3 className={s.forkTitle}>家人要住院</h3>
              <p>特護能做什麼、怎麼申請、每天看得到哪些紀錄。</p>
              <span className={s.forkGo}>給家屬的說明</span>
              <figure className={s.forkShot}>
                <Image src={clientHomeShot} alt="客戶端：家屬看到的今日照護人員、今日量測次數與本週日報" sizes="(max-width: 900px) 100vw, 50vw" />
              </figure>
            </a>
            <a href="#nurses" className={s.forkCard} data-field="navy" data-reveal>
              <h3 className={s.forkTitle}>我是護理師</h3>
              <p>班怎麼排、遇到危險怎麼辦、紀錄與交班怎麼寫。</p>
              <span className={s.forkGo}>給護理師的說明</span>
              <figure className={s.forkShot}>
                <Image src={staffHomeShot} alt="照護人員端：今日班次、定位打卡上班與填寫交班" sizes="(max-width: 900px) 100vw, 50vw" />
              </figure>
            </a>
          </div>
        </section>

        {/* ================= 給家屬 ================= */}
        <section id="family" className={s.chapter} aria-labelledby="family-title">
          <h2 id="family-title" className={s.sectionTitle} data-reveal>給家屬</h2>
          <p className={s.statement} data-reveal>
            {/* 縮圖和前一個詞綁在一起，避免縮圖落在行首 */}
            保康的特護都是護理師，一對一守在床邊：每筆<span className={s.keep}>量測<span className={s.thumb}><Image src={thumbVitals} alt="" sizes="80px" /></span>都有紀錄，</span>
            每班逐項<span className={s.keep}>交接<span className={s.thumb}><Image src={thumbHandoff} alt="" sizes="80px" /></span>，</span>
            你每天收到一份<span className={s.keep}>日報<span className={s.thumb}><Image src={thumbFamily} alt="" sizes="80px" /></span>。</span>
          </p>
          <div className={s.chapterBands}>
            <Bands bands={FAMILY_BANDS} />
          </div>
        </section>

        <section className={s.stats} aria-labelledby="stay-title">
          <h2 id="stay-title" className={s.sectionTitle} data-reveal>家人住院幾天？</h2>
          <StaySlider />
          <p className={s.statsNote} data-reveal>
            以 12 小時兩班制計算：天數 × 2。同一位護理師兩班之間至少休息 11 小時，所以至少需要 2 位護理師輪替；實際人數依排班與休假另計。
          </p>
        </section>

        <section className={s.shift} aria-labelledby="steps-title">
          <h2 id="steps-title" className={s.sectionTitle} data-reveal>怎麼開始</h2>
          <ol className={s.shiftList}>
            {STEPS.map((x) => (
              <li key={x.when} data-reveal><strong>{x.when}</strong>{x.text}</li>
            ))}
          </ol>
          <Link href="/client/request" className={`${s.button} ${s.chapterAction}`} data-reveal>試填照護需求</Link>
        </section>

        {/* ================= 給護理師 ================= */}
        <section id="nurses" className={s.chapter} aria-labelledby="nurses-title">
          <h2 id="nurses-title" className={s.sectionTitle} data-reveal>給護理師</h2>
          <p className={s.statement} data-reveal>
            我們先把制度做好，再請你來：班表守住休息時間，派單看你的專長，遇到危險有人接，交班時本班數據已經整理好。
          </p>
        </section>

        <section aria-labelledby="showcase-title">
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

        <section className={s.shift} aria-labelledby="shift-title">
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

        <section className={s.features} aria-labelledby="nurse-bands-title">
          <h2 id="nurse-bands-title" className={s.sectionTitle} data-reveal>制度替你守著的事</h2>
          <Bands bands={NURSE_BANDS} />
        </section>

        {/* ---------- 常見問題：分家屬與護理師，答案全部攤開 ---------- */}
        <section id="faq" className={s.faq} aria-labelledby="faq-family">
          <Faq id="faq-family" title="家屬常見問題" items={FAQ_FAMILY} />
          <Faq id="faq-nurse" title="護理師常見問題" items={FAQ_NURSE} />
        </section>

        {/* ---------- 行動 ---------- */}
        <section className={s.cta} aria-labelledby="cta-title">
          <h2 id="cta-title" className={s.ctaTitle} data-reveal>
            <span>把每一班</span>
            <span>交給專業</span>
          </h2>
          <p data-reveal>示範平台已可直接操作，資料只存在你的瀏覽器。家屬可以試填需求表單，護理師可以先看看照護人員端。</p>
          <div className={s.ctaActions} data-reveal>
            <Link href="/client/request" className={s.button}>試填照護需求</Link>
            <Link href="/staff" className={`${s.button} ${s.buttonQuiet}`}>看看照護人員端</Link>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <span>保康健康科技・住院一對一特護</span>
        <nav aria-label="頁尾">
          <Link href="/client/request" className={s.link}>需求表單</Link>
          <Link href="/staff" className={s.link}>照護人員端</Link>
          <Link href="/console" className={s.link}>示範平台</Link>
          <a href="#top" className={s.link}>回到頂端</a>
        </nav>
        <span>© {new Date().getFullYear()}・展示版，非正式預約或醫療建議</span>
      </footer>
    </div>
  );
}
