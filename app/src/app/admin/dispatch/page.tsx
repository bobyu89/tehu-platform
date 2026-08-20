"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 派單已整併至桌面主控台（靜態輸出用用戶端導向）
export default function AdminDispatchRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/console/dispatch"); }, [router]);
  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <Link href="/console/dispatch" className="t-label" style={{ color: "var(--a-ink)" }}>前往個案與派單 →</Link>
    </main>
  );
}
