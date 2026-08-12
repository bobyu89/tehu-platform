"use client";
import { useMemo, useRef, useState } from "react";
import type { Baseline } from "@/lib/alert-engine";
import { fmtDateTime } from "@/lib/digest";

// 趨勢圖（02 冊 §2.3 圖表呈現）：單序列折線＋7 日平均線＋±2σ 帶。
// 依 dataviz 原則：單序列不設圖例（標題即名稱）、細標記、退隱格線、
// 文字用文字色不用序列色、hover 十字提示、深淺色各自取 token。

export interface TrendPoint { t: number; v: number; iso: string }

export function TrendChart({
  points, baseline, unit,
}: { points: TrendPoint[]; baseline: Baseline | null; unit: string }) {
  const W = 360, H = 180, PL = 40, PR = 12, PT = 12, PB = 24;
  const [hover, setHover] = useState<TrendPoint | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { path, xs, ys, yTicks, bandY1, bandY2, meanY } = useMemo(() => {
    if (points.length === 0) {
      return { path: "", xs: (_: number) => 0, ys: (_: number) => 0, yTicks: [] as number[], bandY1: 0, bandY2: 0, meanY: null as number | null };
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
    const xs = (t: number) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
    const ys = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(p.t).toFixed(1)},${ys(p.v).toFixed(1)}`).join(" ");
    const mid = (lo + hi) / 2;
    const yTicks = [lo + pad, mid, hi - pad].map((v) => Math.round(v * 10) / 10);
    const bandY1 = baseline?.enabled ? ys(baseline.mean + 2 * baseline.sd) : 0;
    const bandY2 = baseline?.enabled ? ys(baseline.mean - 2 * baseline.sd) : 0;
    const meanY = baseline?.enabled ? ys(baseline.mean) : null;
    return { path, xs, ys, yTicks, bandY1, bandY2, meanY };
  }, [points, baseline]);

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
    return <div className="card p-6 text-center text-sm" style={{ color: "var(--c-muted)" }}>此參數尚無紀錄</div>;
  }

  const last = points[points.length - 1];

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none"
           role="img" aria-label="趨勢圖"
           onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {/* 退隱格線＋y 軸刻度（文字色） */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={ys(v)} y2={ys(v)} stroke="var(--c-line)" strokeWidth="1" />
            <text x={PL - 6} y={ys(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--c-muted)">{v}</text>
          </g>
        ))}
        {/* ±2σ 帶＋平均線 */}
        {baseline?.enabled && (
          <>
            <rect x={PL} width={W - PL - PR} y={bandY1} height={Math.max(0, bandY2 - bandY1)}
                  fill="var(--c-accent)" opacity="0.09" />
            {meanY != null && (
              <line x1={PL} x2={W - PR} y1={meanY} y2={meanY}
                    stroke="var(--c-accent)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
            )}
          </>
        )}
        {/* 序列 */}
        <path d={path} fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* hover 十字＋強調點 */}
        {hover && (
          <line x1={xs(hover.t)} x2={xs(hover.t)} y1={PT} y2={H - PB} stroke="var(--c-muted)" strokeWidth="1" strokeDasharray="2 3" />
        )}
        <circle cx={xs(last.t)} cy={ys(last.v)} r="4.5" fill="var(--c-accent)" stroke="var(--c-surface)" strokeWidth="2" />
        {hover && hover !== last && (
          <circle cx={xs(hover.t)} cy={ys(hover.v)} r="4" fill="var(--c-surface)" stroke="var(--c-accent)" strokeWidth="2" />
        )}
        {/* x 軸端點時間（文字色） */}
        <text x={PL} y={H - 8} fontSize="10" fill="var(--c-muted)">{fmtDateTime(points[0].iso)}</text>
        <text x={W - PR} y={H - 8} textAnchor="end" fontSize="10" fill="var(--c-muted)">{fmtDateTime(last.iso)}</text>
      </svg>
      {hover && (
        <div className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 card px-2.5 py-1 text-xs font-bold mono">
          {fmtDateTime(hover.iso)}　{hover.v}{unit}
        </div>
      )}
      {baseline?.enabled && (
        <p className="mt-1 text-xs" style={{ color: "var(--c-muted)" }}>
          ▨ 帶狀區＝7 日平均 {Math.round(baseline.mean * 10) / 10}{unit} ±2σ（n={baseline.n}）；虛線＝個人平均線
        </p>
      )}
      {baseline && !baseline.enabled && (
        <p className="mt-1 text-xs" style={{ color: "var(--c-muted)" }}>
          個人基準線需近 7 日滿 10 筆量測才啟用（目前 {baseline.n} 筆）
        </p>
      )}
    </div>
  );
}
