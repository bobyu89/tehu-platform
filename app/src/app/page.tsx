import type { Metadata } from "next";
import { Inter, Noto_Sans_TC } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight, Bell, Buildings, ChartLineUp, ClipboardText, Handshake, Heartbeat, HouseLine,
  MapPin, ShieldCheck, Signature, Stethoscope,
} from "@phosphor-icons/react/ssr";
import s from "./landing.module.css";

// Landing Page：保康健康科技品牌首頁（品牌規範見上傳之品牌識別提案）。
// 版型參考照護類網站；主視覺不用照片（無授權影像），改以平台實際介面做成浮動卡片。
// 內容原則：不放虛構案例與數字；數據列只列系統實際具備的規格；用語遵守醫材紅線（紀錄、提醒、彙整）。

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoTC = Noto_Sans_TC({ weight: ["400", "500", "700", "800"], preload: false, variable: "--font-noto-tc" });

export const metadata: Metadata = {
  title: "保康健康科技｜讓專業照護，成為安心的力量",
  description: "保康健康科技以護理專業為起點，結合照護品質管理與智慧科技，串連住院家庭、護理人員與照護機構。",
};

/** 品牌標誌：守護盾形＋醫療十字＋承托弧線（品牌識別提案，尚非註冊商標） */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M50 7C28 7 11 24 11 46c0 28 21 43 39 49 18-6 39-21 39-49C89 24 72 7 50 7Z" fill="currentColor" opacity=".12" />
      <path d="M50 12C28 12 16 27 16 46c0 23 17 36 34 43 17-7 34-20 34-43C84 27 72 12 50 12Z" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M50 28v36M32 46h36" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <path d="M28 72c11-8 20-10 22-10s11 2 22 10" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function Brand() {
  return (
    <span className={s.brand}>
      <Mark className={s.mark} />
      <span>保康健康科技<small>BAOKANG HEALTH TECHNOLOGY</small></span>
    </span>
  );
}

const NAV = [
  { label: "服務", href: "#services" },
  { label: "照護平台", href: "#platform" },
  { label: "為什麼是保康", href: "#why" },
  { label: "服務流程", href: "#process" },
  { label: "常見問題", href: "#faq" },
];

// 只列系統實際具備的規格（見規劃書 02、04 冊與 ADR-002、ADR-003）
const SPECS = [
  { value: "3 層", label: "異常警報判定：絕對值、早期預警、個人基準線" },
  { value: "12 小時", label: "兩班制排班，不排未經確認的 24 小時班" },
  { value: "≥ 11 小時", label: "派單系統自動守住輪班間隔" },
  { value: "全程留痕", label: "照護紀錄只增不改，更正保留原版" },
];

const SERVICES = [
  {
    icon: HouseLine, tag: "FOR FAMILIES", title: "住院照護需求協作",
    desc: "協助家庭釐清住院期間的一對一照護需求、了解服務範圍，在合規前提下銜接合適的專業照護人員。",
  },
  {
    icon: Stethoscope, tag: "FOR NURSES", title: "護理專業支持",
    desc: "資格查核、技術標籤、合理班表與透明收入；重視執業安全與職涯成長，而不是把人當成可替換的人力。",
  },
  {
    icon: Buildings, tag: "FOR ORGANIZATIONS", title: "智慧品質協作",
    desc: "以派單、出勤、警報與品質數據的管理工具，支援合規照護機構建立可追蹤的服務品質。",
  },
];

const FEATURES = [
  { icon: Heartbeat, title: "生命徵象與三層異常提醒", desc: "床邊三秒完成輸入；數值異常、偏離個人平時水準、量測逾時都會即時提醒，紅色警報直通值班主管。" },
  { icon: ClipboardText, title: "ISBAR 交班與簽收", desc: "本班數據由系統彙整，護理師只補判斷；接班逐項勾認簽收，歸檔後不可竄改。" },
  { icon: MapPin, title: "派單、打卡與緊急求助", desc: "技術標籤與輪班間隔是派單硬條件；定位打卡含異常審核；SOS 長按啟動、倒數可取消。" },
  { icon: Signature, title: "家屬日報與電子簽章", desc: "家屬看見專業溫和的溝通版日報；同意書電子簽署，雜湊與時間戳存證。" },
];

const PORTALS = [
  { href: "/console", name: "公司管理端", desc: "總覽、派單、出勤、警報中心、品質報表" },
  { href: "/staff", name: "照護人員端", desc: "今日班次、案件紀錄、我的檔案與收入" },
  { href: "/client", name: "客戶端", desc: "我的個案、照護人員、提出需求" },
];

const WHY = [
  { n: "01", key: "TRUST", title: "可查核的專業與透明資訊", desc: "專業資格、服務範圍與費用說明一致揭露，作為信任的基礎。" },
  { n: "02", key: "QUALITY", title: "可追蹤的照護品質", desc: "標準化紀錄、異常通報與交班簽收，讓品質不只靠個人經驗。" },
  { n: "03", key: "PEOPLE", title: "重視護理人員保障", desc: "排班守住勞基法工時與輪班間隔；工作安全、報酬透明、長期合作。" },
  { n: "04", key: "PRIVACY", title: "內外分離的資訊揭露", desc: "內部紀錄誠實直白；家屬看到的是溝通版，不含內部處置細節。" },
  { n: "05", key: "RESPONSIBLE AI", title: "負責任的科技應用", desc: "系統負責紀錄、提醒與彙整；臨床判斷永遠由具資格的專業人員負責。" },
  { n: "06", key: "COOPERATION", title: "尊重醫療機構規範", desc: "依各院規定、感染管制與照護流程個別確認，探索可行的合作模式。" },
];

const STEPS = [
  { title: "提出照護需求", desc: "家屬描述住院情境、時間、照護需求與特殊限制。" },
  { title: "專業需求確認", desc: "確認所需技術、資格，以及院方是否允許相關服務。" },
  { title: "服務適配與說明", desc: "說明服務內容、時段、費用、責任與契約條件。" },
  { title: "服務執行與紀錄", desc: "由符合資格的人員提供服務，全程紀錄與異常通報。" },
  { title: "回饋與品質改善", desc: "收集雙方意見，追蹤品質並持續改善。" },
];

const FAQ = [
  { q: "保康目前提供正式的特護預約嗎？", a: "目前為品牌與平台的展示階段，尚未開放正式預約。實際上線時間與服務範圍，將依合法資格、合作機構與營運公告為準。" },
  { q: "保康和一般照護媒合平台有什麼不同？", a: "我們同時重視家庭端的照護品質與護理人員端的專業保障，並以自建的照護平台把紀錄、警報、交班與派單串成可追蹤的流程，而不只追求媒合速度。" },
  { q: "系統會取代護理人員做臨床判斷嗎？", a: "不會。系統負責紀錄、提醒與彙整，例如數值異常提醒與交班數據彙整；判斷與處置永遠由具資格的護理人員與醫師負責。" },
  { q: "家屬可以看到哪些資訊？", a: "家屬看到的是溝通版的照護日報，例如生命徵象趨勢、進食與睡眠、照護摘要；內部處置細節與交班備註不對外顯示。" },
  { q: "可以在所有醫院提供住院一對一照護嗎？", a: "不能直接假設可以。須依各醫院規定、服務內容、護理執業法規與合作安排個別確認。" },
];

export default function LandingPage() {
  return (
    <div className={`${s.page} ${inter.variable} ${notoTC.variable}`}>
      {/* ---------- 導覽 ---------- */}
      <header className={s.top}>
        <div className={`${s.wrap} ${s.nav}`}>
          <a href="#top" aria-label="保康健康科技 首頁"><Brand /></a>
          <nav className={s.links} aria-label="主要導覽">
            {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
            <Link href="/console" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}>進入示範平台 <ArrowRight weight="bold" /></Link>
          </nav>
          <details className={s.mobileMenu}>
            <summary aria-label="開啟選單">☰</summary>
            <nav aria-label="行動版導覽">
              {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
              <Link href="/console">進入示範平台 →</Link>
            </nav>
          </details>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className={s.hero}>
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div>
              <div className={s.eyebrow}>Care × People × Intelligence</div>
              <h1>讓專業照護，<br />成為<em>安心的力量。</em></h1>
              <p className={s.lead}>
                保康健康科技以護理專業為起點，結合照護品質管理與智慧科技，讓住院家庭找到值得信任的照護，也讓護理人員安心發揮專業。
              </p>
              <div className={s.actions}>
                <a href="#services" className={`${s.btn} ${s.btnPrimary}`}>了解服務 <ArrowRight weight="bold" /></a>
                <Link href="/console" className={`${s.btn} ${s.btnGhost}`}>看看照護平台</Link>
              </div>
              <ul className={s.chips} aria-label="平台重點">
                <li>三層異常提醒</li>
                <li>交班逐項簽收</li>
                <li>家屬溝通日報</li>
              </ul>
            </div>

            {/* 主視覺：平台介面浮動卡片（示意畫面） */}
            <div className={s.visual} aria-label="照護平台介面示意">
              <div className={s.visualPanel}>
                <span className={s.visualLabel}>BAOKANG CARE PLATFORM</span>
                <Mark className={s.visualMark} />
              </div>

              <div className={`${s.float} ${s.floatVitals}`}>
                <div className={s.floatLabel}>本班量測 · 08:00</div>
                <div className={s.vitalsRow}>
                  <div><b>96</b><span>SpO₂ %</span></div>
                  <div><b>78</b><span>脈搏</span></div>
                  <div><b>36.8</b><span>體溫</span></div>
                </div>
                <div className={s.news2}><span>早期預警 NEWS2</span><i>1 分・低</i></div>
              </div>

              <div className={`${s.float} ${s.floatHandoff}`}>
                <div className={s.floatLabel}>交班</div>
                <div className={s.check}>已簽收歸檔</div>
                <p>勾稽 4 / 4 項・接班 20:05</p>
              </div>

              <div className={`${s.float} ${s.floatFamily}`}>
                <div className={s.floatLabel}>家屬日報</div>
                <p>今天精神穩定，午餐吃了八分滿，下午在陪伴下散步十分鐘。</p>
                <small>溝通版內容・不含內部處置細節</small>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 規格列 ---------- */}
        <section className={s.specs} aria-label="平台規格">
          <div className={`${s.wrap} ${s.specsGrid}`}>
            {SPECS.map((x) => (
              <div key={x.value} className={s.spec}><strong>{x.value}</strong><span>{x.label}</span></div>
            ))}
          </div>
        </section>

        {/* ---------- 服務 ---------- */}
        <section id="services" className={s.section}>
          <div className={s.wrap}>
            <div className={s.head}>
              <div className={s.eyebrow}>Services</div>
              <h2>從住院期間的照護需求，<br />走向長期的智慧照護支持。</h2>
              <p>以下為規劃中的服務架構，將依法規審查與合作模式逐步驗證、推出。</p>
            </div>
            <div className={s.grid3}>
              {SERVICES.map((x, i) => (
                <article key={x.title} className={`${s.card} ${i === 0 ? s.serviceFeatured : ""}`}>
                  <div className={s.icon}><x.icon weight="duotone" /></div>
                  <div className={s.tag}>{x.tag}</div>
                  <h3>{x.title}</h3>
                  <p>{x.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 照護平台 ---------- */}
        <section id="platform" className={`${s.section} ${s.sectionWhite}`}>
          <div className={`${s.wrap} ${s.platform}`}>
            <div>
              <div className={s.head}>
                <div className={s.eyebrow}>Care Platform</div>
                <h2>照護與行政，<br />在同一個平台完成。</h2>
                <p>我們自建的特護照護平台，把床邊紀錄、異常提醒、交班、派單與家屬溝通串成一條可追蹤的流程。示範版已可直接操作。</p>
              </div>
              <div className={s.layers}>
                <div className={s.layer}><div className={s.layerCode}>A</div><p><strong>絕對臨界值</strong>：預設對齊 NEWS2 切點，可依醫囑逐個案調整；咖啡渣樣嘔吐物等緊急徵象直通紅色警報。</p></div>
                <div className={s.layer}><div className={s.layerCode}>B</div><p><strong>早期預警評分</strong>：自動計算 NEWS2，管理端據此排序「誰最需要關注」。</p></div>
                <div className={s.layer}><div className={s.layerCode}>C</div><p><strong>個人基準線</strong>：偏離個案自己的平時水準就提醒；只提醒、不發紅色警報，避免警報疲勞。</p></div>
              </div>
              <div className={s.portals}>
                {PORTALS.map((p) => (
                  <Link key={p.href} href={p.href} className={s.portal}>
                    <div>{p.name}<span>{p.desc}</span></div>
                    <b><ArrowRight weight="bold" /></b>
                  </Link>
                ))}
              </div>
            </div>
            <div className={s.featureList}>
              {FEATURES.map((f) => (
                <article key={f.title} className={s.feature}>
                  <div className={s.icon}><f.icon weight="duotone" /></div>
                  <div><h3>{f.title}</h3><p>{f.desc}</p></div>
                </article>
              ))}
              <article className={s.feature}>
                <div className={s.icon}><ChartLineUp weight="duotone" /></div>
                <div><h3>績效與品質數據</h3><p>出勤、交班準時、給藥準時、評價與客訴自動彙整，成為品質改善與專業認可的依據。</p></div>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- 為什麼是保康 ---------- */}
        <section id="why" className={s.section}>
          <div className={s.wrap}>
            <div className={`${s.head} ${s.headCenter}`}>
              <div className={s.eyebrow}>Why Baokang</div>
              <h2>真正的差異，不只是找到人，<br />而是建立值得信任的照護系統。</h2>
            </div>
            <div className={s.grid3}>
              {WHY.map((w) => (
                <article key={w.n} className={s.card}>
                  <div className={s.num}>{w.n} / {w.key}</div>
                  <h3>{w.title}</h3>
                  <p>{w.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 服務流程 ---------- */}
        <section id="process" className={`${s.section} ${s.sectionWhite}`}>
          <div className={s.wrap}>
            <div className={s.head}>
              <div className={s.eyebrow}>How It Works</div>
              <h2>五個清楚的節點，<br />讓照護服務可管理、可追蹤。</h2>
            </div>
            <ol className={s.steps} style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {STEPS.map((x, i) => (
                <li key={x.title} className={s.step}>
                  <div className={s.stepNo}>{String(i + 1).padStart(2, "0")}</div>
                  <div><h3>{x.title}</h3><p>{x.desc}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- 承諾 ---------- */}
        <section className={s.section} style={{ paddingBottom: 0 }}>
          <div className={s.wrap}>
            <div className={s.banner}>
              <div className={s.goldRule} />
              <h2>讓家庭得到安心，<br />讓護理專業得到尊重。</h2>
              <p>每一項服務與每一個功能，都回到這兩個價值起點。</p>
              <div className={s.actions}>
                <Link href="/client/request" className={`${s.btn} ${s.btnLight}`}>試用需求表單 <ArrowRight weight="bold" /></Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className={s.section}>
          <div className={s.wrap}>
            <div className={`${s.head} ${s.headCenter}`}>
              <div className={s.eyebrow}>FAQ</div>
              <h2>常見問題</h2>
            </div>
            <div className={s.faq}>
              {FAQ.map((f) => (
                <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 聯絡 ---------- */}
        <section id="contact" className={`${s.section} ${s.sectionWhite}`}>
          <div className={s.wrap}>
            <div className={s.head}>
              <div className={s.eyebrow}>Contact</div>
              <h2>一起建立更值得信任的照護未來。</h2>
            </div>
            <div className={s.contact}>
              <div className={s.contactCard}>
                <div className={s.icon}><ShieldCheck weight="duotone" /></div>
                <h3>先看看平台怎麼運作</h3>
                <p>三端示範版可直接操作，資料只存在你的瀏覽器，不會傳送到任何伺服器。</p>
                <div className={s.actions} style={{ marginTop: 0 }}>
                  <Link href="/console" className={`${s.btn} ${s.btnPrimary}`}>進入示範平台 <ArrowRight weight="bold" /></Link>
                </div>
              </div>
              <div className={`${s.contactCard} ${s.pending}`}>
                <div className={s.icon}><Handshake weight="duotone" /></div>
                <h3>合作洽詢</h3>
                <p>無論你是住院家庭、護理專業人員或照護機構，都歡迎與我們聯繫。正式聯絡方式（電話、Email、LINE 官方帳號）將於公司資訊確認後公布。</p>
                <div className={s.tag} style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <Bell weight="bold" /> 聯絡資訊確認中
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- 頁尾 ---------- */}
      <footer className={s.footer}>
        <div className={s.wrap}>
          <div className={s.footerGrid}>
            <div>
              <Brand />
              <p className={s.footerTag}>讓專業照護，成為安心的力量。以專業人才、照護品質與智慧科技，建構更可信任的照護未來。</p>
            </div>
            <nav aria-label="認識保康">
              <strong>認識保康</strong>
              <a href="#services">服務</a>
              <a href="#why">為什麼是保康</a>
              <a href="#process">服務流程</a>
              <a href="#faq">常見問題</a>
            </nav>
            <nav aria-label="照護平台">
              <strong>照護平台</strong>
              {PORTALS.map((p) => <Link key={p.href} href={p.href}>{p.name}</Link>)}
            </nav>
          </div>
          <div className={s.bottom}>
            © {new Date().getFullYear()} 保康健康科技 BAOKANG。品牌與網站為展示版，非正式服務預約或醫療建議；英文名稱、標誌與登記資料待確認。
          </div>
        </div>
      </footer>
    </div>
  );
}
