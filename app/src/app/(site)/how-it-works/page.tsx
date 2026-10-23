import type { Metadata } from "next";
import Link from "next/link";
import s from "../site.module.css";
import Image from "next/image";
import { PageHead } from "../parts";
import { StaySlider } from "../site-client";
import requestsShot from "@/assets/landing/requests.webp";
import dispatchShot from "@/assets/landing/dispatch.webp";
import attendanceShot from "@/assets/landing/attendance.webp";
import staffShot from "@/assets/landing/staff-case.webp";
import handoffCardShot from "@/assets/landing/handoff-card.webp";
import familyShot from "@/assets/landing/family.webp";

// 運作流程：平台上一個個案從進線到日報的流程、一個班的時間軸、排班試算。
// 數字對得到 04 冊（派單 30 分鐘回覆、圈外打卡不硬擋）、03 冊（60 分鐘未簽收提醒）、ADR-002（12 小時兩班制）。

export const metadata: Metadata = {
  title: "運作流程",
  description: "需求進線、派單、定位打卡、床邊紀錄與警報、交班簽收、家屬日報：一個個案在平台上怎麼走。",
};

const FLOW = [
  { when: "需求進線", text: "家屬或機構提出需求：醫院、時段，以及管路、傷口、失智等照護需求", shot: requestsShot, alt: "公司管理端需求進線：聯繫、報價、成案狀態" },
  { when: "派單", text: "依時段、技術標籤與休息間隔排出候選人，調度指派；護理人員 30 分鐘內回覆", shot: dispatchShot, alt: "案件與派單：個案技術標籤與白班、夜班建立" },
  { when: "定位打卡", text: "到班定位打卡；位置異常照樣能打卡，標記後交主管審核", shot: attendanceShot, alt: "出勤與工時：待審核異常打卡、出勤紀錄與近 30 日工時" },
  { when: "床邊紀錄", text: "量測、給藥、照護事件即時記錄，送出就判定是否需要警報", shot: staffShot, alt: "照護人員端個案頁：最近一次量測與生命徵象輸入欄" },
  { when: "交班簽收", text: "本班數據自動帶入交班，接班者四項逐一勾認後簽收", shot: handoffCardShot, alt: "交班已簽收歸檔：本班摘要與勾稽區 4 / 4 項" },
  { when: "家屬日報", text: "整理成溝通版日報給家屬，不含內部處置細節與交班備註", shot: familyShot, alt: "家屬日報：今日量測、血氧趨勢、今日照護" },
];

// 一個班的四段，grow 依實際時長（小時）；最窄 12%，讓短的段落也看得見
const SHIFT = [
  { when: "30 分鐘內", hours: 0.5, text: "先在 30 分鐘內回覆派單，接下或婉拒都留紀錄" },
  { when: "到班時", hours: 0.25, text: "到班定位打卡；位置異常時照樣打卡，交主管審核" },
  { when: "12 小時", hours: 12, text: "照護 12 小時，量測、給藥、事件都留下紀錄" },
  { when: "交班後", hours: 1, text: "交班送出，接班者逐項簽收；60 分鐘未簽收會提醒主管" },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHead id="how-title" title="運作流程">
        從家屬提出需求，到每天收到日報，每一步都在平台上留下紀錄，誰做了什麼、什麼時候做的都查得到。
      </PageHead>

      <section className={s.shift} aria-labelledby="flow-title">
        <h2 id="flow-title" className={s.sectionTitle} data-reveal>一個個案怎麼走</h2>
        <ol className={`${s.shiftList} ${s.flowList}`}>
          {FLOW.map((x) => (
            <li key={x.when} data-reveal>
              <figure className={s.flowShot}>
                <Image src={x.shot} alt={x.alt} sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw" />
              </figure>
              <strong>{x.when}</strong>{x.text}
            </li>
          ))}
        </ol>
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

      <section className={s.stats} aria-labelledby="stay-title">
        <h2 id="stay-title" className={s.sectionTitle} data-reveal>要排幾個班？</h2>
        <StaySlider />
        <p className={s.statsNote} data-reveal>
          排班引擎以 12 小時兩班制計算：天數 × 2。同一位護理人員兩班之間至少休息 11 小時，所以至少需要 2 位輪替；實際人數依排班與休假另計。
        </p>
      </section>

      <section className={s.chapter} aria-labelledby="try-title">
        <h2 id="try-title" className={s.sectionTitle} data-reveal>自己走一遍</h2>
        <p className={s.statement} data-reveal>
          示範平台裡有一整套虛構個案在運轉。可以從公司管理端派單，切到照護人員端記一輪量測，再到客戶端看家屬收到什麼。
        </p>
        <Link href="/console" className={`${s.button} ${s.chapterAction}`} data-reveal>進入示範平台</Link>
      </section>
    </>
  );
}
