import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import s from "../site.module.css";
import { PageHead } from "../parts";
import consoleShot from "@/assets/landing/console.webp";
import staffHomeShot from "@/assets/landing/staff-home.webp";
import clientHomeShot from "@/assets/landing/client-home.webp";
import familyShot from "@/assets/landing/family.webp";
import reportsShot from "@/assets/landing/reports.webp";

// 聯絡我們：正式聯絡方式（地址、電話、Email、LINE）待公司登記資料確認後補上，不放假資料。

export const metadata: Metadata = {
  title: "聯絡我們",
  description: "保康健康科技的聯絡方式將於公司登記資料確認後公布；示範平台可以直接操作。",
};

const ENTRIES = [
  { name: "照護人員端", href: "/staff", shot: staffHomeShot, alt: "照護人員端：今日班次與定位打卡" },
  { name: "客戶端", href: "/client", shot: clientHomeShot, alt: "客戶端：家屬看到的今日照護" },
  { name: "家屬日報", href: "/console/family-report", shot: familyShot, alt: "家屬日報預覽" },
  { name: "報表分析", href: "/console/reports", shot: reportsShot, alt: "報表分析：品質指標" },
];

export default function ContactPage() {
  return (
    <>
      <PageHead id="contact-title" title="聯絡我們" shot={{ src: consoleShot, alt: "公司管理端總覽：服務中個案、今日班次、未認領警報與依 NEWS2 排序的個案清單" }}>
        正式的地址、電話、Email 與 LINE 官方帳號，會在公司登記資料確認後公布在這裡。
      </PageHead>

      <section className={s.chapter} aria-labelledby="meanwhile-title">
        <h2 id="meanwhile-title" className={s.sectionTitle} data-reveal>在那之前</h2>
        <p className={s.statement} data-reveal>
          平台的每個入口都可以直接操作，裡面是虛構的示範個案。
        </p>
        <ul className={s.strip}>
          {ENTRIES.map((e) => (
            <li key={e.name} data-reveal>
              <Link href={e.href} className={s.stripLink}>
                <figure className={s.flowShot}>
                  <Image src={e.shot} alt={e.alt} sizes="(max-width: 900px) 50vw, 25vw" />
                </figure>
                <span>{e.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
