"use client";
import { useMemo, useRef, useState } from "react";
import type { Baseline } from "@/lib/alert-engine";
import { fmtDateTime } from "@/lib/digest";

// 趨勢圖（規格 02 冊 §2.3）：單序列折線、7 日平均線、±2σ 帶。
// 單序列不設圖例（標題即名稱）；細標記、退隱格線；文字用文字色不用序列色。

export interface TrendPoint { t: number; v: number; iso: string }

export function TrendChart({
  points, baseline, unit, maxV,
}: { points: TrendPoint[]; baseline: Baseline | null; unit: string; maxV?: number }) {
  const W = 360, H = 170, PL = 36, PR = 10, PT = 10, PB = 22;
  const [hover, setHover] = useState<TrendPoint | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { path, xs, ys, yTicks, bandY1, bandY2, meanY } = useMemo(() => {
    if (points.length === 0) {
      const zero = () => 0;
      return { path: "", xs: zero, ys: zero, yTicks: [] as number[], bandY1: 0, bandY2: 0, meanY: null as number | null };
    }
    const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1;
    const vs = points.map((p) => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (baseline?.enabled) {
      lo = Math.min(lo, baseline.mean - 2.2 * baseline.sd);
      hi = Math.max(hi, baseline.mean + 2.2 * baseline.sd);
    }
    const pad = Math.max((hi - lo) * 0.12, 0.5);
    lo -= pad; hi += pad;
    if (maxV != null && hi > maxV) hi = maxV; // 生理上限（如 SpO2 100%）不外溢
    const xs = (t: number) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
    const ys = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(p.t).toFixed(1)},${ys(p.v).toFixed(1)}`).join(" ");
    const mid = (lo + hi) / 2;
    const yTicks = [lo + pad, mid, hi - pad].map((v) => Math.round(v * 10) / 10);
    return {
      path, xs, ys, yTicks,
      bandY1: baseline?.enabled ? ys(baseline.mean + 2 * baseline.sd) : 0,
      bandY2: baseline?.enabled ? ys(baseline.mean - 2 * baseline.sd) : 0,
      meanY: baseline?.enabled ? ys(baseline.mean) : null,
    };
  }, [points, baseline, maxV]);

  function onMove(e: React.PointerEvent) {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best: TrendPoint | null = null, bd = Infinity;
    for (const p of points) {
      const d = Math.abs(xs(p.t) - px);
      if (d < bd) { bd = d; best = p; }
    }
    setHover(best);
  }

  if (points.length === 0) {
    return <div className="empty">此參數近 7 日尚無紀錄</div>;
  }

  const last = points[points.length - 1];

  return (
    <div className="relative px-2 pt-2">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none"
           role="img" aria-label="近 7 日趨勢" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={ys(v)} y2={ys(v)} stroke="var(--hairline)" strokeWidth="1" />
            <text x={PL - 5} y={ys(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)"
                  style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{v}</text>
          </g>
        ))}

        {baseline?.enabled && (
          <>
            <rect x={PL} width={W - PL - PR} y={bandY1} height={Math.max(0, bandY2 - bandY1)}
                  fill="var(--a)" opacity="0.08" />
            {meanY != null && (
              <line x1={PL} x2={W - PR} y1={meanY} y2={meanY} stroke="var(--a)" strokeWidth="1.5"
                    strokeDasharray="5 4" opacity="0.65" />
            )}
          </>
        )}

        <path d={path} fill="none" stroke="var(--a)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hover && (
          <line x1={xs(hover.t)} x2={xs(hover.t)} y1={PT} y2={H - PB} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3" />
        )}
        <circle cx={xs(last.t)} cy={ys(last.v)} r="4.5" fill="var(--a)" stroke="var(--surface)" strokeWidth="2" />
        {hover && hover !== last && (
          <circle cx={xs(hover.t)} cy={ys(hover.v)} r="4" fill="var(--surface)" stroke="var(--a)" strokeWidth="2" />
        )}

        <text x={PL} y={H - 6} fontSize="9.5" fill="var(--ink-3)"
              style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{fmtDateTime(points[0].iso)}</text>
        <text x={W - PR} y={H - 6} textAnchor="end" fontSize="9.5" fill="var(--ink-3)"
              style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{fmtDateTime(last.iso)}</text>
      </svg>

      {hover && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 sheet px-2 py-1 t-label num">
          {fmtDateTime(hover.iso)}　{hover.v}{unit}
        </div>
      )}
    </div>
  );
}
