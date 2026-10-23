import type { Metadata } from "next";
import Link from "next/link";
import s from "../site.module.css";
import { Faq as Rows, PageHead, type QA } from "../parts";
import reportsShot from "@/assets/landing/reports.webp";
import alertsCenterShot from "@/assets/landing/alerts-center.webp";
import dispatchShot from "@/assets/landing/dispatch.webp";
import performanceShot from "@/assets/landing/performance.webp";

// 關於我們：我們是誰、為什麼成立、使命與願景、核心價值、核心競爭力。
// 內容來自策略藍圖 1.0（91-參考資料）與 11 公司簡介；使命、願景、價值為草案，待團隊定稿。
// 團隊介紹待資料提供後再加；不放未經證實的資歷。

export const metadata: Metadata = {
  title: "關於我們",
  description: "保康健康科技是一家以護理專業為根的健康科技公司：使命、願景、核心價值，以及我們正在建立的四種能力。",
};

const VALUES: QA[] = [
  { q: "以專業為根", a: "照護判斷由具資格的護理人員負責。平台只做紀錄、提醒與彙整，不做診斷。" },
  { q: "以品質為本", a: "標準化紀錄、異常通報、交班簽收，讓照護品質不只靠個人經驗。" },
  { q: "以智慧為翼", a: "AI 協助整理需求與行政紀錄；高風險的判斷，永遠保留給專業人員審核。" },
  { q: "透明", a: "家屬看到溝通版的日報；內部紀錄只增不改，更正會保留原版。" },
  { q: "尊重護理人員", a: "排班守住休息時間，遇到危險有人接，工作安全與合理報酬是平台設計的前提。" },
];

const ABILITIES: QA[] = [
  {
    q: "照護品質系統",
    a: <>三層異常警報、交班四項勾認簽收、溝通版家屬日報。<strong>示範版已可操作。</strong></>,
    shot: { src: alertsCenterShot, alt: "警報中心：每筆警報的觸發、認領、處置與結案" },
  },
  {
    q: "專業保障系統",
    a: <>排班守住 11 小時休息、派單依技術標籤、SOS 長按求助、定位打卡不硬擋。<strong>示範版已可操作；</strong>合約、保險與爭議處理流程規劃中。</>,
    shot: { src: dispatchShot, alt: "案件與派單：技術標籤不符或班次間隔不足 11 小時者不可指派" },
  },
  {
    q: "護理職涯系統",
    a: <>技術標籤由完訓與考核授予，班數、準時率、評價累積成可帶著走的專業履歷。<strong>規劃中；</strong>績效數據示範版已有。</>,
    shot: { src: performanceShot, alt: "績效：近 30 日班數、工時、評價、警報認領、交班與給藥準時率" },
  },
  {
    q: "AI 智慧協作",
    a: <>協助整理需求、彙整交班摘要、分析品質指標；只輔助、不替代判斷。<strong>規劃中，尚未串接。</strong></>,
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHead id="about-title" title="關於我們" shot={{ src: reportsShot, alt: "報表分析：紅色警報平均認領時間、給藥準時率、量測密度與交班簽收" }}>
        保康健康科技是一家以護理專業為根的健康科技公司，打造住院一對一照護的品質平台。
      </PageHead>

      <section className={s.chapter} aria-labelledby="why-title">
        <h2 id="why-title" className={s.sectionTitle} data-reveal>為什麼成立</h2>
        <p className={s.statement} data-reveal>
          家屬很難知道床邊發生了什麼，護理人員常常一個人扛住風險。我們相信，優秀的護理人員願意留下，家庭才會持續信任。
        </p>
      </section>

      <section className={s.mission} aria-labelledby="mission-title">
        <h2 id="mission-title" className={s.sectionTitle} data-reveal>使命與願景</h2>
        <div className={s.missionRow} data-field="sage" data-reveal>
          <h3 className={s.missionLabel}>使命</h3>
          <p>讓住院家庭更容易取得可信任、符合需求的專業照護，也為護理人員建立有保障、有發展性的專業環境。</p>
        </div>
        <div className={s.missionRow} data-field="navy" data-reveal>
          <h3 className={s.missionLabel}>願景</h3>
          <p>成為整合護理人才、照護品質與人工智慧的智慧照護企業。</p>
        </div>
      </section>

      <section className={s.faq} aria-labelledby="values-title">
        <Rows id="values-title" title="核心價值" items={VALUES} />
      </section>

      <section className={s.faq} aria-labelledby="abilities-title">
        <Rows id="abilities-title" title="我們正在建立的四種能力" items={ABILITIES} />
      </section>

      <section className={s.chapter} aria-labelledby="next-title">
        <h2 id="next-title" className={s.sectionTitle} data-reveal>先看平台</h2>
        <p className={s.statement} data-reveal>
          說得再多，不如自己操作一次。示範平台的三個入口都可以直接使用。
        </p>
        <Link href="/platform" className={`${s.button} ${s.chapterAction}`} data-reveal>看平台與服務</Link>
      </section>
    </>
  );
}
