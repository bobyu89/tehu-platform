"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 靜態輸出不支援伺服器端 redirect，改用用戶端導向
export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/today"); }, [router]);
  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <Link href="/today" className="t-label" style={{ color: "var(--a-ink)" }}>進入特護平台 →</Link>
    </main>
  );
}
