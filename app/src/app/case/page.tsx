"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { useCaseId } from "@/components/useCaseId";
import { VitalsForm } from "@/components/VitalsForm";

export default function CaseVitalsPage() {
  const caseId = useCaseId();
  const info = useLiveQuery(() => (caseId ? getDb().cases.get(caseId) : undefined), [caseId]);
  if (!info) return null;
  return <VitalsForm info={info} />;
}
