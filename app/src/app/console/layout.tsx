"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SquaresFour, BellRinging, UsersThree, DeviceMobile, ChartLineUp,
  BookOpenText, Signature, Pulse,
} from "@phosphor-icons/react";

// 桌面主控台外殼：左側導覽＋內容區。行動裝置（<lg）側欄收合為頂部橫列。

const NAV = [
  { href: "/console", label: "總覽", icon: SquaresFour },
  { href: "/console/alerts", label: "警報中心", icon: BellRinging },
  { href: "/console/dispatch", label: "個案與派單", icon: UsersThree },
];

const PLANNED = [
  { label: "報表分析", icon: ChartLineUp },
  { label: "衛教管理", icon: BookOpenText },
  { label: "電子簽章", icon: Signature },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const items = NAV.map((n) => {
    const active = pathname === n.href;
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

        <div className="mt-3 pt-2 flex flex-col gap-1" style={{ borderTop: "1px solid var(--hairline)" }}>
          <div className="t-micro px-3 py-1">其他入口</div>
          <Link href="/today" className="flex items-center gap-2.5 px-3 t-label" style={{ color: "var(--ink-2)", minHeight: 40 }}>
            <DeviceMobile size={17} /> 護理師端（行動）
          </Link>
        </div>

        <div className="mt-auto pt-2 flex flex-col gap-0.5" style={{ borderTop: "1px solid var(--hairline)" }}>
          <div className="t-micro px-3 py-1">規劃中</div>
          {PLANNED.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.label} className="flex items-center gap-2.5 px-3 t-label" style={{ color: "var(--ink-3)", minHeight: 36 }}>
                <Icon size={16} /> {p.label}
                <span className="tag" style={{ marginLeft: "auto", fontSize: 10 }}>Phase 2+</span>
              </div>
            );
          })}
          <p className="t-micro px-3 pt-2" style={{ fontWeight: 400, letterSpacing: 0 }}>
            開發版・離線示範模式
          </p>
        </div>
      </aside>

      {/* 頂列（行動） */}
      <div className="lg:hidden sticky top-0 z-30 px-3 py-2 flex gap-1 overflow-x-auto"
           style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        {items}
        <Link href="/today" className="flex items-center gap-1.5 px-3 t-label shrink-0" style={{ color: "var(--ink-2)", minHeight: 42 }}>
          <DeviceMobile size={16} /> 護理師端
        </Link>
      </div>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
