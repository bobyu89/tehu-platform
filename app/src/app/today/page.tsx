"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 護理師端已整併入主控台；行動版精修留待手機版階段
export default function TodayRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/console/today"); }, [router]);
  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <Link href="/console/today" className="t-label" style={{ color: "var(--a-ink)" }}>前往今日班次 →</Link>
    </main>
  );
}
