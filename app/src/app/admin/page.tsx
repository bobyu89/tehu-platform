"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 行動版管理端已由桌面主控台取代；手機版精修留待下一階段
export default function AdminRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/console"); }, [router]);
  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <Link href="/console" className="t-label" style={{ color: "var(--a-ink)" }}>前往主控台 →</Link>
    </main>
  );
}
