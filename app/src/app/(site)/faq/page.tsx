import type { Metadata } from "next";
import Link from "next/link";
import s from "../site.module.css";
import { Faq, PageHead, type QA } from "../parts";
import consoleShot from "@/assets/landing/console.webp";
import familyShot from "@/assets/landing/family.webp";
import dispatchShot from "@/assets/landing/dispatch.webp";
import attendanceShot from "@/assets/landing/attendance.webp";

// 常見問題：關於保康、家屬、護理人員三組，答案全部攤開。
// 不寫預約、費用（護理人員法 §18-1：非護理機構不得為護理業務之廣告；ADR-007）。

export const metadata: Metadata = {
  title: "常見問題",
  description: "保康健康科技是什麼公司、家屬看得到哪些資訊、平台怎麼保障護理人員。",
};

const ABOUT: QA[] = [
  { q: "保康現在提供特護服務嗎？", a: "目前沒有。保康是開發照護品質平台的健康科技公司；服務模式會在法規與營運主體確認後另行公布。" },
  {
    q: "示範平台可以怎麼用？",
    a: (
      <>
        三個入口都可以直接操作，裡面是虛構的示範個案，資料只存在你的瀏覽器，不會傳到任何伺服器。從
        <Link href="/console" className={s.link}>公司管理端</Link>開始最完整。
      </>
    ),
    shot: { src: consoleShot, alt: "公司管理端總覽" },
  },
  { q: "系統會替護理人員做判斷嗎？", a: "不會。系統負責紀錄、提醒與彙整；判斷與處置永遠由具資格的護理人員與醫師負責。" },
  { q: "健康資料怎麼保護？", a: "健康資料屬個資法的特種個資。正式版依指派關係決定誰看得到哪位病人，不同機構之間完全隔離，讀取敏感資料也會留下紀錄。" },
];

const FAMILY: QA[] = [
  { q: "家屬看得到哪些資訊？", a: "溝通版的照護日報：生命徵象趨勢、進食與照護摘要、護理人員的話。內部處置細節與交班備註不對外顯示。", shot: { src: familyShot, alt: "家屬日報預覽：今日量測、血氧近 7 日趨勢、今日照護" } },
  { q: "警報會通知家屬嗎？", a: "警報先通知值班的護理主管處理；需要時由護理人員聯絡家屬，聯絡紀錄留在警報處置裡。家屬在日報裡看到整理過的結果。" },
  { q: "特護和看護有什麼不同？", a: "特別護理人員持有護理執照，能做護理評估、管路與傷口照護；看護多為照顧服務員，以生活照顧為主。涉及醫療輔助的處置，依醫囑執行。" },
];

const NURSE: QA[] = [
  { q: "平台怎麼保障休息時間？", a: "預設 12 小時兩班制，同一位護理人員前後兩班至少間隔 11 小時，不足時系統不讓指派。" },
  { q: "派單怎麼決定？可以拒絕嗎？", a: "個案需要的技術必須在你的技術標籤裡才會派給你。收到派單 30 分鐘內回覆，可以婉拒，接下或婉拒都留紀錄。", shot: { src: dispatchShot, alt: "案件與派單：個案的技術標籤與班次" } },
  { q: "遇到危險怎麼辦？", a: "長按 SOS 2 秒、10 秒倒數內可取消；送出後同時通知值班群與主管，並回報位置。病人急變請先打 119。" },
  { q: "醫院地下室收不到定位怎麼辦？", a: "照樣可以打卡。系統標記為位置異常，交主管審核，不會因為收不到訊號而打不了卡。", shot: { src: attendanceShot, alt: "出勤與工時：待審核的異常打卡，主管可核可或退回" } },
  { q: "現在可以加入了嗎？", a: "還沒有開放。開放時會一併公布資格、班表與報酬。" },
];

export default function FaqPage() {
  return (
    <>
      <PageHead id="faq-head" title="常見問題">
        關於保康、家屬看得到什麼、平台怎麼保障護理人員。找不到答案的話，示範平台可以直接試。
      </PageHead>
      <section className={s.faq} aria-labelledby="faq-about">
        <Faq id="faq-about" title="關於保康" items={ABOUT} />
        <Faq id="faq-family" title="家屬" items={FAMILY} />
        <Faq id="faq-nurse" title="護理人員" items={NURSE} />
      </section>
    </>
  );
}
