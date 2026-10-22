import type { Metadata } from "next";
import { Instrument_Serif, Inter, Noto_Serif_TC } from "next/font/google";
import Link from "next/link";
import { HeroVideo } from "@/components/HeroVideo";

// Landing Page：電影感首屏（影片背景手動淡入淡出循環）＋規劃書內容統整。
// 本頁為行銷面，刻意採單一淺色視覺（純白/黑/#6F6F6F），與主控台的儀器介面分離。

const displayLatin = Instrument_Serif({
  weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-display-latin",
});
const displayTC = Noto_Serif_TC({
  weight: ["400", "600"], preload: false, variable: "--font-display-tc",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "特護平台｜把醫院等級的照護，帶進每一個家",
  description: "為特別護理師打造的一體化照護與行政平台：數值監控、三層警報、交班總結、派單打卡與緊急求助。",
};

const DISPLAY = "var(--font-display-latin), var(--font-display-tc), 'Noto Serif TC', serif";
const BODY = "var(--font-inter), 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif";
const GRAY = "#6F6F6F";
const HAIR = "#E8E8E8";

const NAV = [
  { label: "功能", href: "#features" },
  { label: "三層警報", href: "#alerts" },
  { label: "家屬日報", href: "#family" },
  { label: "開發藍圖", href: "#roadmap" },
];

const FEATURES = [
  {
    title: "數值監控與異常警報",
    desc: "生命徵象、輸出入量、給藥與管路照護一次記錄。異常由三層引擎判定，紅色警報推播值班群並全程留存通知紀錄。",
  },
  {
    title: "ISBAR 交班與 AI 總結",
    desc: "背景自動帶入、本班數據系統彙整，護理師只填判斷與交辦。摘要草稿的每一個數字都來自原始紀錄，接班簽收逐項勾認。",
  },
  {
    title: "派單、打卡與緊急求助",
    desc: "技術標籤是指派的硬條件，定位打卡含異常審核流。SOS 長按觸發、倒數可取消，通報鏈直達值班主管。",
  },
  {
    title: "家屬日報與電子簽章",
    desc: "內部紀錄誠實直白，家屬看見專業溫和的溝通版。同意書以電子簽署，雜湊與時間戳入庫存證。",
  },
];

const LAYERS = [
  { code: "A", name: "絕對臨界值", desc: "預設對齊 NEWS2 切點，護理長可依醫囑逐個案調整。咖啡渣樣嘔吐物等質性紅旗直通紅色警報。" },
  { code: "B", name: "早期預警評分", desc: "簡化 NEWS2 自動計分，管理端據此排序「誰最需要關注」。慢性穩定個案可停用警報、保留計分。" },
  { code: "C", name: "個人基準線", desc: "七日移動平均加減兩個標準差。數值仍在正常範圍，但偏離了他自己的平時水準，就是最早的訊號。C 層永不發紅色警報。" },
];

const PHASES = [
  { n: "1", name: "直營打磨", desc: "自家機構先用：照護核心與行政核心全上線，真實個案試點驗證。" },
  { n: "2", name: "衛教與簽章", desc: "自建中文衛教知識庫、媒體資產庫，同意書全面電子化。" },
  { n: "3", name: "開放平台", desc: "累積的品質數據長成信任徽章，開放為特護人才媒合平台。" },
];

export default function LandingPage() {
  return (
    <div className={`${displayLatin.variable} ${displayTC.variable} ${inter.variable}`}
         style={{ background: "#FFFFFF", color: "#000000", fontFamily: BODY }}>

      {/* ---- 首屏 ---- */}
      <div className="relative min-h-screen w-full overflow-hidden">
        <HeroVideo />
        <div className="absolute inset-0 z-0 pointer-events-none"
             style={{ background: "linear-gradient(to bottom, #FFFFFF 0%, rgba(255,255,255,0) 45%, #FFFFFF 96%)" }} />

        {/* 導覽列 */}
        <nav className="relative z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
            <Link href="/" className="text-3xl tracking-tight" style={{ fontFamily: DISPLAY, color: "#000000" }}>
              特護平台
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              <a href="#" className="text-sm transition-colors" style={{ color: "#000000" }}>首頁</a>
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="text-sm transition-colors hover:!text-black" style={{ color: GRAY }}>
                  {n.label}
                </a>
              ))}
            </div>
            <Link href="/console"
                  className="rounded-full px-6 py-2.5 text-sm transition-transform hover:scale-[1.03]"
                  style={{ background: "#000000", color: "#FFFFFF" }}>
              進入示範
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative z-10 flex flex-col items-center justify-center px-6 pb-40 text-center"
                 style={{ paddingTop: "calc(8rem - 75px)" }}>
          <h1 className="animate-fade-rise max-w-7xl text-5xl font-normal sm:text-7xl md:text-8xl"
              style={{ fontFamily: DISPLAY, lineHeight: 1.08, letterSpacing: "-0.02em", color: "#000000" }}>
            把<em style={{ color: GRAY }}>醫院等級</em>的照護，
            <br className="hidden sm:block" />
            帶進<em style={{ color: GRAY }}>每一個家</em>。
          </h1>
          <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed sm:text-lg"
             style={{ color: GRAY }}>
            為特別護理師打造的一體化平台。數值監控、三層警報、交班總結、
            派單打卡與緊急求助，在同一個地方完成。
          </p>
          <Link href="/console"
                className="animate-fade-rise-delay-2 mt-12 rounded-full px-14 py-5 text-base transition-transform hover:scale-[1.03]"
                style={{ background: "#000000", color: "#FFFFFF" }}>
            進入平台示範
          </Link>
        </section>
      </div>

      {/* ---- 功能 ---- */}
      <section id="features" className="mx-auto max-w-5xl px-8 py-28">
        <h2 className="text-4xl sm:text-5xl" style={{ fontFamily: DISPLAY, letterSpacing: "-0.01em" }}>
          照護與行政，<em style={{ color: GRAY }}>一個平台</em>。
        </h2>
        <div className="mt-14">
          {FEATURES.map((f) => (
            <div key={f.title} className="grid gap-3 py-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10"
                 style={{ borderTop: `1px solid ${HAIR}` }}>
              <h3 className="text-2xl" style={{ fontFamily: DISPLAY }}>{f.title}</h3>
              <p className="text-base leading-relaxed" style={{ color: GRAY }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- 三層警報 ---- */}
      <section id="alerts" style={{ background: "#FAFAFA" }}>
        <div className="mx-auto grid max-w-5xl gap-12 px-8 py-28 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div>
            <h2 className="text-4xl sm:text-5xl" style={{ fontFamily: DISPLAY, letterSpacing: "-0.01em" }}>
              三層警報，<br /><em style={{ color: GRAY }}>不吵不漏</em>。
            </h2>
            <p className="mt-6 text-base leading-relaxed" style={{ color: GRAY }}>
              警報疲勞是警報系統死因第一名。每一筆數值同時走過三層判定，
              紅色只留給真正危急的訊號。
            </p>
          </div>
          <div>
            {LAYERS.map((l) => (
              <div key={l.code} className="flex gap-6 py-7" style={{ borderTop: `1px solid ${HAIR}` }}>
                <div className="text-5xl" style={{ fontFamily: DISPLAY, color: GRAY, lineHeight: 1 }}>{l.code}</div>
                <div>
                  <h3 className="text-xl" style={{ fontFamily: DISPLAY }}>{l.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: GRAY }}>{l.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 家屬日報 ---- */}
      <section id="family" className="mx-auto max-w-5xl px-8 py-28 text-center">
        <h2 className="mx-auto max-w-3xl text-4xl sm:text-5xl" style={{ fontFamily: DISPLAY, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
          對內<em style={{ color: GRAY }}>誠實直白</em>，
          對外<em style={{ color: GRAY }}>專業溫和</em>。
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed" style={{ color: GRAY }}>
          內部紀錄與家屬溝通完全分離：護理師敢寫真話，家屬每天收到一份
          看得懂、放得下心的照護日報。這是自費照護裡最直接的價值感。
        </p>
        <Link href="/console/family-report" className="mt-8 inline-block text-sm underline underline-offset-4"
              style={{ color: "#000000" }}>
          看家屬日報示範
        </Link>
      </section>

      {/* ---- 路線 ---- */}
      <section id="roadmap" style={{ background: "#FAFAFA" }}>
        <div className="mx-auto max-w-5xl px-8 py-28">
          <h2 className="text-4xl sm:text-5xl" style={{ fontFamily: DISPLAY, letterSpacing: "-0.01em" }}>
            先直營，<em style={{ color: GRAY }}>後開放</em>。
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {PHASES.map((p) => (
              <div key={p.n} style={{ borderTop: "2px solid #000000", paddingTop: 20 }}>
                <div className="text-sm" style={{ color: GRAY }}>第 {p.n} 階段</div>
                <h3 className="mt-1 text-2xl" style={{ fontFamily: DISPLAY }}>{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: GRAY }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 收尾 CTA ---- */}
      <section className="mx-auto max-w-5xl px-8 py-32 text-center">
        <h2 className="text-4xl sm:text-6xl" style={{ fontFamily: DISPLAY, letterSpacing: "-0.01em" }}>
          現在就走一遍<em style={{ color: GRAY }}>照護現場</em>。
        </h2>
        <Link href="/console"
              className="mt-12 inline-block rounded-full px-14 py-5 text-base transition-transform hover:scale-[1.03]"
              style={{ background: "#000000", color: "#FFFFFF" }}>
          進入平台示範
        </Link>
        <p className="mt-6 text-sm" style={{ color: GRAY }}>
          示範資料僅存於你的瀏覽器，每位訪客各自獨立。
        </p>
      </section>

      {/* ---- Footer ---- */}
      <footer style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-8 py-12 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-2xl tracking-tight" style={{ fontFamily: DISPLAY }}>特護平台</div>
            <p className="mt-2 max-w-md text-xs leading-relaxed" style={{ color: GRAY }}>
              本平台為照護紀錄與提醒工具，不提供醫療診斷，不取代臨床專業判斷與人工巡視。
            </p>
          </div>
          <div className="flex gap-8 text-sm" style={{ color: GRAY }}>
            <Link href="/console" className="hover:!text-black transition-colors">主控台</Link>
            <a href="https://github.com/bobyu89/tehu-platform" target="_blank" rel="noreferrer"
               className="hover:!text-black transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
