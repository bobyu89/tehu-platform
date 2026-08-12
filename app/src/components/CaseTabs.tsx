"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";

export function CaseHeader({ caseId }: { caseId: string }) {
  const info = useLiveQuery(() => getDb().cases.get(caseId), [caseId]);
  const pathname = usePathname();
  if (!info) return <div className="p-4 text-sm" style={{ color: "var(--c-muted)" }}>載入中…</div>;

  const base = `/case/${caseId}`;
  const tabs = [
    { href: base, label: "量測" },
    { href: `${base}/trends`, label: "趨勢" },
    { href: `${base}/handoff`, label: "交班" },
  ];

  return (
    <div className="sticky top-0 z-30 border-b" style={{ background: "var(--c-bg)", borderColor: "var(--c-line)" }}>
      <div className="mx-auto max-w-md px-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/today" className="text-sm font-bold" style={{ color: "var(--c-accent-ink)" }}>← 今日</Link>
          <span className="chip">{info.setting}</span>
        </div>
        <h1 className="mt-1 text-xl font-black">
          {info.name} <span className="text-sm font-bold" style={{ color: "var(--c-muted)" }}>{info.age} 歲・{info.sex}</span>
        </h1>
        <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--c-muted)" }}>{info.dx}｜過敏：{info.allergies}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {info.tubes.map((t) => <span key={t} className="chip">{t}</span>)}
          {info.overrideNote && <span className="chip chip-yellow">⚙ {info.overrideNote}</span>}
        </div>
        <nav className="mt-3 flex gap-1">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link key={t.href} href={t.href}
                    className="flex-1 rounded-t-lg py-2.5 text-center text-sm font-bold"
                    style={active
                      ? { background: "var(--c-surface)", color: "var(--c-accent-ink)", border: "1px solid var(--c-line)", borderBottom: "none" }
                      : { color: "var(--c-muted)" }}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
