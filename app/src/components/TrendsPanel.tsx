"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { GearSix } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import type { ObsType } from "@/lib/types";
import { OBS_LABEL, OBS_UNIT } from "@/lib/types";
import { computeBaseline, DEFAULT_RULES, round1 } from "@/lib/alert-engine";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";

const TYPES: ObsType[] = ["spo2", "bp", "hr", "rr", "bt", "glucose"];

export function TrendsPanel({ caseId }: { caseId: string }) {
  const [type, setType] = useState<ObsType>("spo2");

  const data = useLiveQuery(async () => {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    return getDb().observations
      .where("[caseId+type]").equals([caseId, type])
      .filter((o) => o.measuredAt >= since && typeof o.value.main === "number")
      .sortBy("measuredAt");
  }, [caseId, type]);

  const info = useLiveQuery(() => (caseId ? getDb().cases.get(caseId) : undefined), [caseId]);

  const points: TrendPoint[] = (data ?? []).map((o) => ({
    t: new Date(o.measuredAt).getTime(), v: o.value.main as number, iso: o.measuredAt,
  }));
  const baseline = computeBaseline(type, points.map((p) => p.v));
  const bounds = { ...DEFAULT_RULES[type], ...(info?.overrides?.[type] ?? {}) };
  const unit = OBS_UNIT[type] ?? "";

  return (
    <div className="flex flex-col gap-3 pb-28">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {TYPES.map((t) => (
          <button key={t} className="opt shrink-0" style={{ fontSize: 13, padding: "0 12px" }}
                  data-on={type === t} onClick={() => setType(t)}>
            {OBS_LABEL[t]}
          </button>
        ))}
      </div>

      <section className="sheet">
        <div className="sheet-title">
          <span className="t-micro">{OBS_LABEL[type]}{type === "bp" ? "（收縮壓）" : ""}．近 7 日</span>
          {points.length > 0 && (
            <span className="t-micro num">
              最近 {round1(points[points.length - 1].v)}{unit}
            </span>
          )}
        </div>

        <TrendChart points={points} baseline={baseline} unit={unit} maxV={type === "spo2" ? 100 : undefined} />

        <div className="px-3.5 pb-3 t-micro" style={{ letterSpacing: 0, fontWeight: 400 }}>
          {baseline.enabled ? (
            <>帶狀區為 7 日平均 <span className="num">{round1(baseline.mean)}{unit}</span> 上下 2 個標準差，
              虛線為個人平均線，取樣 <span className="num">{baseline.n}</span> 筆。</>
          ) : (
            <>個人基準線需近 7 日滿 10 筆量測才啟用，目前 <span className="num">{baseline.n}</span> 筆。</>
          )}
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">生效中的警報邊界</span></div>
        <div className="p-2.5 flex flex-wrap gap-1.5">
          {bounds.redLow != null && <span className="tag tag-critical num">紅　≤ {bounds.redLow}</span>}
          {bounds.yellowLow != null && <span className="tag tag-caution num">黃　≤ {bounds.yellowLow}</span>}
          {bounds.yellowHigh != null && <span className="tag tag-caution num">黃　≥ {bounds.yellowHigh}</span>}
          {bounds.redHigh != null && <span className="tag tag-critical num">紅　≥ {bounds.redHigh}</span>}
        </div>

        {info?.overrides?.[type] && (
          <div className="row stripe stripe-caution" style={{ borderTop: "1px solid var(--hairline)" }}>
            <GearSix size={16} weight="fill" color="var(--caution)" className="shrink-0" />
            <span className="t-sub" style={{ color: "var(--caution)" }}>{info.overrideNote}</span>
          </div>
        )}

        <div className="px-3.5 py-2.5 t-micro" style={{ letterSpacing: 0, fontWeight: 400, borderTop: "1px solid var(--hairline)" }}>
          個人基準線偏離 2 個標準差時於 App 內提示，3 個標準差且方向屬臨床惡化才升為黃色警報。
          個人基準線永不觸發紅色警報。
        </div>
      </section>
    </div>
  );
}
