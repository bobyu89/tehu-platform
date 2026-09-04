"use client";
import { House, PaperPlaneTilt, UsersFour } from "@phosphor-icons/react";
import { PortalShell, type NavItem } from "@/components/PortalShell";

// 客戶端：家屬看到的世界——提出需求、看人、預約、案件進度、評價。
// 不出現內部紀錄、警報處置與評分。

const NAV: NavItem[] = [
  { href: "/client", label: "我的個案", icon: House },
  { href: "/client/nurses", label: "照護人員", icon: UsersFour },
  { href: "/client/request", label: "提出需求", icon: PaperPlaneTilt },
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell portal="client" nav={NAV} sos={false}>{children}</PortalShell>;
}
