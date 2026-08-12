"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretLeft, GearSix } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import type { ObsType } from "@/lib/types";
import { OBS_LABEL } from "@/lib/types";

const STRIP: ObsType[] = ["spo2", "bp", "hr", "bt"];

/** 個案頁頭：身分 + 現況讀數條。輸入新值時仍看得到目前狀態 */
export function CaseHeader({ caseId }: { caseId: string }) {
  const info = useLiveQuery(() => getDb().cases.get(caseId), [caseId]);
  const pathname = usePathname();

  const strip = useLiveQuery(async () => {
    const db = getDb();
    const out: Partial<Record<ObsType, string>> = {};
    for (const t of STRIP) {
      const rows = await db.observations.where("[caseId+type]").equals([caseId, t]).toArray();
      const o = rows.reduce<typeof rows[number] | undefined>(
        (acc, r) => (!acc || r.measuredAt > acc.measuredAt ? r : acc), undefined);
      if (o && o.value.main != null) {
        out[t] = t === "bp" && o.value.dbp != null ? `${o.value.main}/${o.value.dbp}` : String(o.value.main);
      }
    }
    return out;
  }, [caseId]);

  if (!info) {
    return (
      <div className="sticky top-0 z-30" style={{ background: "var(--bg)" }}>
        <div className="mx-auto max-w-md px-4 pt-3 flex flex-col gap-2">
          <div className="skeleton h-6 w-40" /><div className="skeleton h-14 w-full" />
        </div>
      </div>
    );
  }

  const base = `/case/${caseId}`;
  const tabs = [
    { href: base, label: "量測" },
    { href: `${base}/trends`, label: "趨勢" },
    { href: `${base}/handoff`, label: "交班" },
  ];

  return (
    <div className="sticky top-0 z-30" style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
      <div className="mx-auto max-w-md px-4 pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <Link href="/today" className="t-label flex items-center gap-0.5 -ml-2 px-2"
                style={{ color: "var(--a-ink)", minHeight: 44 }}>
            <CaretLeft size={15} /> 今日
          </Link>
          <span className="tag">{info.setting}</span>
        </div>

        <h1 className="t-head mt-1">
          {info.name}
          <span className="t-sub font-normal">　{info.age} 歲・{info.sex}</span>
        </h1>
        <p className="t-sub">{info.dx}</p>
        <p className="t-micro" style={{ letterSpacing: 0, fontWeight: 400 }}>
          過敏：{info.allergies}　管路：{info.tubes.join("、") || "無"}
        </p>

        {/* 現況讀數條 */}
        <div className="mt-2 grid grid-cols-4 gap-px overflow-hidden"
             style={{ background: "var(--line)", border: "1px solid var(--line)", borderRadius: "var(--r)" }}>
          {STRIP.map((t) => (
            <div key={t} className="px-1 py-1.5 text-center" style={{ background: "var(--surface)" }}>
              <div className="t-micro" style={{ letterSpacing: ".03em" }}>{OBS_LABEL[t]}</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700 }}>
                {strip?.[t] ?? <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>尚無</span>}
              </div>
            </div>
          ))}
        </div>

        {info.overrideNote && (
          <div className="mt-1.5 flex items-start gap-1.5 t-micro"
               style={{ color: "var(--caution)", letterSpacing: 0, fontWeight: 400 }}>
            <GearSix size={13} weight="fill" className="mt-0.5 shrink-0" />
            <span>{info.overrideNote}</span>
          </div>
        )}

        <nav className="mt-2.5 flex gap-1">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link key={t.href} href={t.href}
                    className="flex-1 flex items-center justify-center text-center t-label"
                    style={active
                      ? { color: "var(--a-ink)", borderBottom: "2px solid var(--a)", minHeight: 44 }
                      : { color: "var(--ink-3)", borderBottom: "2px solid transparent", minHeight: 44 }}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
