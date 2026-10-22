"use client";
import { CalendarCheck, FirstAid, IdentificationCard, Wallet } from "@phosphor-icons/react";
import { PortalShell, type NavItem } from "@/components/PortalShell";

// 照護人員端：接案、案件紀錄、個人檔案、收入。

const NAV: NavItem[] = [
  { href: "/staff", label: "今日班次與接案", icon: CalendarCheck },
  { href: "/staff/case", label: "案件紀錄", icon: FirstAid },
  { href: "/staff/profile", label: "我的檔案", icon: IdentificationCard },
  { href: "/staff/income", label: "收入管理", icon: Wallet },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell portal="staff" nav={NAV}>{children}</PortalShell>;
}
