import Image from "next/image";
import Link from "next/link";
import s from "./site.module.css";
import { ShowcaseStage } from "./site-client";
import consoleShot from "@/assets/landing/console.webp";
import staffShot from "@/assets/landing/staff-case.webp";
import handoffShot from "@/assets/landing/handoff.webp";
import clientHomeShot from "@/assets/landing/client-home.webp";
import staffHomeShot from "@/assets/landing/staff-home.webp";
import thumbVitals from "@/assets/landing/thumb-vitals.webp";
import thumbHandoff from "@/assets/landing/thumb-handoff.webp";
import thumbFamily from "@/assets/landing/thumb-family.webp";

// 首頁：品牌主視覺、一句話說明平台、分流（家屬／護理人員）、手機展示、為什麼成立、行動按鈕。
// 版型方向：taste-skill「sentence-as-layout」（一句話就是版面，句中放一格真實畫面）。
// 圖片全部是平台示範版的實際截圖（示範資料皆虛構）；沒有授權的照片，所以不用人物圖庫。

export default function HomePage() {
  return (
    <>
      {/* ---------- Hero：一句話，句中一格交班簽收畫面 ---------- */}
      <section className={s.hero} aria-labelledby="hero-title">
        <div className={s.sky}>
          <h1 id="hero-title" className={s.heroTitle}>
            <span className={s.mask}><span>智慧住院照護平台</span></span>
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
            <span>保康健康科技打造住院一對一照護的品質平台，</span>
            <span>讓家屬看得見照護，也讓護理人員有制度可依。</span>
          </p>
        </div>
        <figure className={s.heroShot} data-shutter>
          <Image src={consoleShot} alt="公司管理端總覽：服務中個案、今日班次、未認領警報與依 NEWS2 排序的個案清單" sizes="100vw" priority />
        </figure>
        <div className={s.heroBand}>
          <Link href="/console" className={`${s.button} ${s.buttonBlock}`}>進入示範平台</Link>
        </div>
      </section>

      {/* ---------- 一句話說明平台：三個縮圖就在句子裡 ---------- */}
      <section className={s.chapter} aria-labelledby="what-title">
        <h2 id="what-title" className={s.sectionTitle} data-reveal>平台做什麼</h2>
        <p className={s.statement} data-reveal>
          {/* 縮圖和前一個詞綁在一起，避免縮圖落在行首 */}
          床邊的每一筆<span className={s.keep}>量測<span className={s.thumb}><Image src={thumbVitals} alt="" sizes="80px" /></span>即時判定，</span>
          每一班逐項<span className={s.keep}>交接<span className={s.thumb}><Image src={thumbHandoff} alt="" sizes="80px" /></span>，</span>
          家屬每天收到一份看得懂的<span className={s.keep}>日報<span className={s.thumb}><Image src={thumbFamily} alt="" sizes="80px" /></span>。</span>
        </p>
      </section>

      {/* ---------- 分流：家屬／護理人員 ---------- */}
      <section className={s.forkSection} aria-labelledby="fork-title">
        <h2 id="fork-title" className={s.sectionTitle} data-reveal>為誰而做</h2>
        <div className={s.fork}>
          <Link href="/platform#family" className={s.forkCard} data-field="sage" data-reveal>
            <h3 className={s.forkTitle}>給家屬</h3>
            <p>家人住院時，量測、警報與交班都有紀錄，每天一份溝通版日報。</p>
            <span className={s.forkGo}>家屬看得到什麼</span>
            <figure className={s.forkShot}>
              <Image src={clientHomeShot} alt="客戶端：家屬看到的今日照護人員、今日量測次數與本週日報" sizes="(max-width: 900px) 100vw, 50vw" />
            </figure>
          </Link>
          <Link href="/platform#nurses" className={s.forkCard} data-field="navy" data-reveal>
            <h3 className={s.forkTitle}>給護理人員</h3>
            <p>排班守住休息時間、派單看專長、遇到危險有人接，交班數據已經整理好。</p>
            <span className={s.forkGo}>制度怎麼保障你</span>
            <figure className={s.forkShot}>
              <Image src={staffHomeShot} alt="照護人員端：今日班次、定位打卡上班與填寫交班" sizes="(max-width: 900px) 100vw, 50vw" />
            </figure>
          </Link>
        </div>
      </section>

      {/* ---------- 展示：同一支手機，三種距離 ---------- */}
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

      {/* ---------- 為什麼成立 ---------- */}
      <section className={s.chapter} aria-labelledby="why-title">
        <h2 id="why-title" className={s.sectionTitle} data-reveal>為什麼成立</h2>
        <p className={s.statement} data-reveal>
          家屬很難知道床邊發生了什麼，護理人員常常一個人扛住風險。我們以護理專業為根，先把紀錄與制度做好。
        </p>
        <Link href="/about" className={`${s.link} ${s.more}`} data-reveal>認識保康</Link>
      </section>

      {/* ---------- 行動 ---------- */}
      <section className={s.cta} aria-labelledby="cta-title">
        <h2 id="cta-title" className={s.ctaTitle} data-reveal>
          <span>把每一班</span>
          <span>交得清清楚楚</span>
        </h2>
        <p data-reveal>示範平台已可直接操作：公司管理端、照護人員端、客戶端。示範資料皆為虛構，只存在你的瀏覽器。</p>
        <div className={s.ctaActions} data-reveal>
          <Link href="/console" className={s.button}>進入示範平台</Link>
          <Link href="/platform" className={`${s.button} ${s.buttonQuiet}`}>看平台功能</Link>
        </div>
      </section>
    </>
  );
}
