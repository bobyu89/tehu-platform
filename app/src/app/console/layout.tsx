"use client";
import {
  SquaresFour, BellRinging, UsersThree, ChartLineUp, FirstAid, Timer, Tray,
  BookOpenText, Signature, HeartStraight, AddressBook, IdentificationBadge, Medal, ChatCircleDots,
} from "@phosphor-icons/react";
import { PortalShell, type NavItem } from "@/components/PortalShell";

// 公司管理端：營運、品質與合規。

const NAV: NavItem[] = [
  { href: "/console", label: "總覽", icon: SquaresFour },
  { href: "/console/requests", label: "需求進線", icon: Tray },
  { href: "/console/dispatch", label: "案件與派單", icon: UsersThree },
  { href: "/console/customers", label: "客戶管理", icon: AddressBook },
  { href: "/console/staff", label: "人員管理", icon: IdentificationBadge },
  { href: "/console/attendance", label: "出勤與工時", icon: Timer },
  { href: "/console/performance", label: "績效", icon: Medal },
  { href: "/console/complaints", label: "客訴", icon: ChatCircleDots },
  { href: "/console/alerts", label: "警報中心", icon: BellRinging },
  { href: "/console/case", label: "個案照護", icon: FirstAid },
  { href: "/console/edu", label: "衛教管理", icon: BookOpenText },
  { href: "/console/family-report", label: "家屬日報", icon: HeartStraight },
  { href: "/console/sign", label: "電子簽章", icon: Signature },
  { href: "/console/reports", label: "數據分析", icon: ChartLineUp },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell portal="admin" nav={NAV}>{children}</PortalShell>;
}
