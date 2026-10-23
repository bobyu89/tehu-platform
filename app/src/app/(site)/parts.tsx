import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import s from "./site.module.css";
import { DemoSwitch } from "./site-client";

// 官網各頁共用的區塊：頁首、色帶、常見問題。

export type Shot = { src: StaticImageData; alt: string };

/** 內頁頁首：標題＋一句說明＋示範平台入口；可選一張滿版截圖（shutter 進場） */
export function PageHead({ id, title, shot, children }: { id: string; title: string; shot?: Shot; children: React.ReactNode }) {
  return (
    <section className={s.pageHead} aria-labelledby={id}>
      <h1 id={id} className={s.heroTitle}>
        <span className={s.mask}><span>{title}</span></span>
      </h1>
      <p className={s.statement}>{children}</p>
      <Link href="/console" className={`${s.button} ${s.chapterAction}`}>進入示範平台</Link>
      {shot && (
        <figure className={s.pageShot} data-shutter>
          <Image src={shot.src} alt={shot.alt} sizes="100vw" priority />
        </figure>
      )}
    </section>
  );
}

export type Band = {
  title: readonly [string, string];
  line: string;
  shot: Shot | null;
  demo: { label: string; on: string; off: string; initial: boolean };
  field: "sage" | "paper" | "gold" | "teal" | "navy";
};

/** 一句一帶：左邊兩行標題＋說明，右邊實際截圖＋可切換的示範情境 */
export function Bands({ bands }: { bands: Band[] }) {
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

export type QA = { q: string; a: React.ReactNode; shot?: Shot };

/** 常見問題一組：答案全部攤開 */
export function Faq({ id, title, items }: { id: string; title: string; items: QA[] }) {
  return (
    <div className={s.faqGroup}>
      <h2 id={id} className={s.faqTitle}>{title}</h2>
      <dl className={s.faqList}>
        {items.map((f) => (
          <div key={f.q} className={s.faqRow} data-reveal>
            <dt>{f.q}</dt>
            <dd>
              {f.a}
              {f.shot && (
                <figure className={s.answerShot}>
                  <Image src={f.shot.src} alt={f.shot.alt} sizes="(max-width: 900px) 100vw, 45vw" />
                </figure>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
