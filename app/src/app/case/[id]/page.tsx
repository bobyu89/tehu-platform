"use client";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { VitalsForm } from "@/components/VitalsForm";

export default function CaseVitalsPage() {
  const params = useParams<{ id: string }>();
  const info = useLiveQuery(() => getDb().cases.get(params.id), [params.id]);
  if (!info) return null;
  return <VitalsForm info={info} />;
}
