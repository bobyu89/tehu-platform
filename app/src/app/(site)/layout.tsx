import type { Metadata } from "next";
import { Inter, Noto_Sans_TC } from "next/font/google";
import Link from "next/link";
import s from "./site.module.css";
import { MenuButton, NavLinks, RevealObserver, type NavItem } from "./site-client";

// 官網（保康健康科技）共用外框：導覽、頁尾、字體、進場動畫。
// 定位：健康科技公司，介紹開發中的照護品質平台。依護理人員法 §18-1「非護理機構，不得為護理業務之廣告」，
// 營運主體定案前不招攬護理服務：不寫預約、費用、成功案例或見證（ADR-007）。

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoTC = Noto_Sans_TC({ weight: ["400", "500", "700"], preload: false, variable: "--font-noto-tc" });

export const metadata: Metadata = {
  title: { default: "保康健康科技｜智慧住院照護平台", template: "%s｜保康健康科技" },
  description: "保康健康科技打造住院一對一照護的品質平台：床邊紀錄、異常提醒與交班簽收，讓家屬看得見照護，也讓護理人員有制度可依。",
};

const NAV: NavItem[] = [
  { label: "平台與服務", href: "/platform" },
  { label: "運作流程", href: "/how-it-works" },
  { label: "關於我們", href: "/about" },
  { label: "常見問題", href: "/faq" },
];

const JS_FLAG = "document.documentElement.classList.add('js')";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${s.page} ${inter.variable} ${notoTC.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      <RevealObserver />

      <header className={s.nav}>
        <Link href="/" className={s.wordmark}>保康健康科技</Link>
        <NavLinks items={NAV} />
        <Link href="/console" className={`${s.button} ${s.navAction}`}>進入示範平台</Link>
        <MenuButton links={[...NAV, { label: "聯絡我們", href: "/contact" }, { label: "進入示範平台", href: "/console" }]} />
      </header>

      <main id="top">{children}</main>

      <footer className={s.footer}>
        <span>保康健康科技・智慧住院照護平台</span>
        <nav aria-label="頁尾">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={s.link}>{n.label}</Link>)}
          <Link href="/contact" className={s.link}>聯絡我們</Link>
        </nav>
        <span>© {new Date().getFullYear()}・本站介紹開發中的照護平台，不提供護理服務預約或醫療建議</span>
      </footer>
    </div>
  );
}
