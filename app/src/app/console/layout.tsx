"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SquaresFour, BellRinging, UsersThree, ChartLineUp, CalendarCheck, FirstAid,
  BookOpenText, Signature, Pulse, HeartStraight, Timer,
} from "@phosphor-icons/react";
import { SosButton } from "@/components/SosButton";

// 桌面主控台外殼：左側導覽＋內容區。行動裝置（<lg）側欄收合為頂部橫列。

const NAV = [
  { href: "/console", label: "總覽", icon: SquaresFour },
  { href: "/console/today", label: "今日班次", icon: CalendarCheck },
  { href: "/console/case", label: "個案照護", icon: FirstAid },
  { href: "/console/alerts", label: "警報中心", icon: BellRinging },
  { href: "/console/dispatch", label: "個案與派單", icon: UsersThree },
  { href: "/console/attendance", label: "出勤與工時", icon: Timer },
  { href: "/console/edu", label: "衛教管理", icon: BookOpenText },
  { href: "/console/family-report", label: "家屬日報", icon: HeartStraight },
  { href: "/console/sign", label: "電子簽章", icon: Signature },
  { href: "/console/reports", label: "報表分析", icon: ChartLineUp },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const clean = pathname.replace(/\/$/, "");
  const items = NAV.map((n) => {
    const active = clean === n.href || clean.endsWith(n.href);
    const Icon = n.icon;
    return (
      <Link key={n.href} href={n.href}
            className="flex items-center gap-2.5 px-3 rounded-[var(--r)] t-label shrink-0"
            style={active
              ? { background: "var(--a-wash)", color: "var(--a-ink)", minHeight: 42, boxShadow: "inset 0 0 0 1px var(--a-line)" }
              : { color: "var(--ink-2)", minHeight: 42 }}>
        <Icon size={17} weight={active ? "fill" : "regular"} />
        {n.label}
      </Link>
    );
  });

  return (
    <div className="lg:flex min-h-[100dvh]">
      {/* 側欄（桌面） */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 px-3 py-4 gap-1 sticky top-0 h-[100dvh]"
             style={{ background: "var(--surface)", borderRight: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 px-3 pb-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <Pulse size={20} weight="bold" color="var(--a)" />
          <div>
            <div className="t-row" style={{ fontSize: 15 }}>特護平台</div>
            <div className="t-micro">管理主控台</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 pt-2">{items}</div>

        <div className="mt-auto pt-2" style={{ borderTop: "1px solid var(--hairline)" }}>
          <p className="t-micro px-3 pt-1" style={{ fontWeight: 400, letterSpacing: 0 }}>
            開發版・離線示範模式
          </p>
        </div>
      </aside>

      {/* 頂列（行動；手機版精修留待下一階段） */}
      <div className="lg:hidden sticky top-0 z-30 px-3 py-2 flex gap-1 overflow-x-auto"
           style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        {items}
      </div>

      <main className="flex-1 min-w-0">{children}</main>
      <SosButton />
    </div>
  );
}
