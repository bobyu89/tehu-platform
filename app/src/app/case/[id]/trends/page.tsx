"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import type { ObsType } from "@/lib/types";
import { OBS_LABEL, OBS_UNIT } from "@/lib/types";
import { computeBaseline, DEFAULT_RULES } from "@/lib/alert-engine";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";

const TYPES: ObsType[] = ["spo2", "bp", "hr", "rr", "bt", "glucose"];

export default function TrendsPage() {
  const params = useParams<{ id: string }>();
  const [type, setType] = useState<ObsType>("spo2");

  const data = useLiveQuery(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const rows = await getDb().observations
      .where("[caseId+type]").equals([params.id, type])
      .filter((o) => o.measuredAt >= sevenDaysAgo && typeof o.value.main === "number")
      .sortBy("measuredAt");
    return rows;
  }, [params.id, type]);

  const info = useLiveQuery(() => getDb().cases.get(params.id), [params.id]);

  const points: TrendPoint[] = (data ?? []).map((o) => ({
    t: new Date(o.measuredAt).getTime(),
    v: o.value.main as number,
    iso: o.measuredAt,
  }));
  const baseline = computeBaseline(type, points.map((p) => p.v));
  const bounds = { ...DEFAULT_RULES[type], ...(info?.overrides?.[type] ?? {}) };

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TYPES.map((t) => (
          <button key={t} className="seg-btn shrink-0" data-on={type === t} onClick={() => setType(t)}>
            {OBS_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="font-black mb-2">{OBS_LABEL[type]}・近 7 日{type === "bp" ? "（SBP）" : ""}</h2>
        <TrendChart points={points} baseline={baseline} unit={OBS_UNIT[type] ?? ""} />
      </div>

      <div className="card p-4 text-sm">
        <h3 className="font-black mb-2">生效中的警報邊界（A 層）</h3>
        <div className="flex flex-wrap gap-1.5">
          {bounds.redLow != null && <span className="chip chip-red">紅 ≤{bounds.redLow}</span>}
          {bounds.yellowLow != null && <span className="chip chip-yellow">黃 ≤{bounds.yellowLow}</span>}
          {bounds.yellowHigh != null && <span className="chip chip-yellow">黃 ≥{bounds.yellowHigh}</span>}
          {bounds.redHigh != null && <span className="chip chip-red">紅 ≥{bounds.redHigh}</span>}
        </div>
        {info?.overrides?.[type] && (
          <p className="mt-2 text-xs" style={{ color: "var(--c-yellow)" }}>⚙ 此參數已依個案覆寫（{info.overrideNote}）</p>
        )}
        <p className="mt-2 text-xs leading-5" style={{ color: "var(--c-muted)" }}>
          個人基準線（C 層）偏離 ±2σ 時 App 內提示、±3σ 且惡化方向升黃色；C 層永不發紅色警報。
        </p>
      </div>
    </div>
  );
}
