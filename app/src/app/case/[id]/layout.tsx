"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { CaseHeader } from "@/components/CaseTabs";
import { SosButton } from "@/components/SosButton";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const params = useParams<{ id: string }>();
  useEffect(() => { if (mounted) void ensureSeeded(); }, [mounted]);
  if (!mounted) return null;

  return (
    <div>
      <CaseHeader caseId={params.id} />
      <main className="mx-auto max-w-md px-4 py-4">{children}</main>
      <SosButton />
    </div>
  );
}
