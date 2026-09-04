"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { Buildings, Pulse, Stethoscope, UsersFour } from "@phosphor-icons/react";
import { SosButton } from "@/components/SosButton";

// 三端共用殼層：左側導覽＋端切換器。
// 原型展示時可直接切換「客戶看到什麼／護理師看到什麼／公司看到什麼」；
// 正式版依登入角色決定，不提供切換。

export type Portal = "admin" | "staff" | "client";

export interface NavItem { href: string; label: string; icon: Icon }

const PORTALS: { key: Portal; label: string; href: string; icon: Icon; hint: string }[] = [
  { key: "admin", label: "公司管理端", href: "/console", icon: Buildings, hint: "營運與品質" },
  { key: "staff", label: "照護人員端", href: "/staff", icon: Stethoscope, hint: "陳曉柔 護理師" },
  { key: "client", label: "客戶端", href: "/client", icon: UsersFour, hint: "王志明（王林秀英家屬）" },
];

export function PortalShell({
  portal, nav, children, sos = true,
}: { portal: Portal; nav: NavItem[]; children: React.ReactNode; sos?: boolean }) {
  const pathname = usePathname();
  const clean = pathname.replace(/\/$/, "");
  const current = PORTALS.find((p) => p.key === portal)!;

  const items = nav.map((n) => {
    const active = clean === n.href || (n.href !== current.href && clean.endsWith(n.href));
    const I = n.icon;
    return (
      <Link key={n.href} href={n.href}
            className="flex items-center gap-2.5 px-3 rounded-[var(--r)] t-label shrink-0"
            style={active
              ? { background: "var(--a-wash)", color: "var(--a-ink)", minHeight: 42, boxShadow: "inset 0 0 0 1px var(--a-line)" }
              : { color: "var(--ink-2)", minHeight: 42 }}>
        <I size={17} weight={active ? "fill" : "regular"} />
        {n.label}
      </Link>
    );
  });

  const switcher = (
    <div className="flex flex-col gap-0.5">
      {PORTALS.map((p) => {
        const on = p.key === portal;
        const I = p.icon;
        return (
          <Link key={p.key} href={p.href}
                className="flex items-center gap-2 px-2.5 rounded-[var(--r)]"
                style={on
                  ? { background: "var(--ink)", color: "var(--bg)", minHeight: 38 }
                  : { color: "var(--ink-3)", minHeight: 38 }}>
            <I size={15} weight={on ? "fill" : "regular"} />
            <span className="t-label" style={{ color: "inherit", fontSize: 12 }}>{p.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="lg:flex min-h-[100dvh]">
      <aside className="hidden lg:flex flex-col w-56 shrink-0 px-3 py-4 gap-1 sticky top-0 h-[100dvh]"
             style={{ background: "var(--surface)", borderRight: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 px-3 pb-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <Pulse size={20} weight="bold" color="var(--a)" />
          <div>
            <div className="t-row" style={{ fontSize: 15 }}>特護平台</div>
            <div className="t-micro">{current.label}</div>
          </div>
        </div>

        <div className="pt-2 pb-1">
          <div className="t-micro px-3 pb-1">切換視角（原型）</div>
          {switcher}
        </div>

        <div className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid var(--hairline)" }}>
          <div className="t-micro px-3 py-1">{current.hint}</div>
          {items}
        </div>

        <div className="mt-auto pt-2" style={{ borderTop: "1px solid var(--hairline)" }}>
          <p className="t-micro px-3 pt-1" style={{ fontWeight: 400, letterSpacing: 0 }}>
            開發版・離線示範模式
          </p>
        </div>
      </aside>

      <div className="lg:hidden sticky top-0 z-30 px-3 py-2 flex gap-1 overflow-x-auto"
           style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        {PORTALS.map((p) => (
          <Link key={p.key} href={p.href} className="tag shrink-0" style={{ minHeight: 36, padding: "0 10px" }}
                data-on={p.key === portal}>
            {p.label}
          </Link>
        ))}
        <span style={{ width: 8 }} />
        {items}
      </div>

      <main className="flex-1 min-w-0">{children}</main>
      {sos && <SosButton />}
    </div>
  );
}
