"use client";
import { useEffect } from "react";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { useCaseId } from "@/components/useCaseId";
import { CaseHeader } from "@/components/CaseTabs";
import { SosButton } from "@/components/SosButton";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const caseId = useCaseId();
  useEffect(() => { if (mounted) void ensureSeeded(); }, [mounted]);
  if (!mounted || !caseId) return null;

  return (
    <div>
      <CaseHeader caseId={caseId} />
      <main className="mx-auto max-w-md px-4 py-4">{children}</main>
      <SosButton />
    </div>
  );
}
