"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** 舊個案路徑（/case*）一律轉往主控台工作區，保留 ?id= */
export function CaseRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/console/case${window.location.search}`);
  }, [router]);
  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <Link href="/console/case" className="t-label" style={{ color: "var(--a-ink)" }}>前往個案照護 →</Link>
    </main>
  );
}
