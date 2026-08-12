"use client";
import { useEffect, useRef, useState } from "react";
import { getDb, uid } from "@/lib/db";
import type { SosIncident } from "@/lib/types";

// SOS（04 冊 §3）：長按 2 秒啟動 → 10 秒倒數可取消 → 通報。
// 示範模式：僅寫入本地事件；正式版同時推播 LINE 值班群＋簡訊＋語音輪撥。

type Phase = "idle" | "holding" | "countdown" | "sent";

const KINDS = [
  { key: "patient_emergency", label: "病人急變" },
  { key: "violence", label: "暴力威脅" },
  { key: "environment", label: "環境危險" },
  { key: "other", label: "其他" },
] as const;

export function SosButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [holdMs, setHoldMs] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [kind, setKind] = useState<SosIncident["kind"]>("other");
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { stopHold(); stopCd(); }, []);

  function stopHold() { if (holdTimer.current) clearInterval(holdTimer.current); holdTimer.current = null; }
  function stopCd() { if (cdTimer.current) clearInterval(cdTimer.current); cdTimer.current = null; }

  function startHold() {
    if (phase !== "idle") return;
    setPhase("holding");
    setHoldMs(0);
    const t0 = Date.now();
    holdTimer.current = setInterval(() => {
      const ms = Date.now() - t0;
      setHoldMs(ms);
      if (ms >= 2000) { stopHold(); beginCountdown(); }
    }, 50);
  }

  function cancelHold() {
    if (phase === "holding") { stopHold(); setPhase("idle"); setHoldMs(0); }
  }

  function beginCountdown() {
    if (cdTimer.current) return; // 防重入（背景分頁計時器節流可能造成疊發）
    setPhase("countdown");
    setCountdown(10);
    // 以時間戳計算剩餘秒數，對瀏覽器計時器節流免疫
    const deadline = Date.now() + 10_000;
    cdTimer.current = setInterval(() => {
      const remain = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown(remain);
      if (remain <= 0) { stopCd(); void fire(); }
    }, 250);
  }

  function cancelAll() { stopCd(); stopHold(); setPhase("idle"); }

  async function fire() {
    const incident: SosIncident = { id: uid(), kind, silent: false, triggeredAt: new Date().toISOString() };
    await getDb().sos.put(incident);
    setPhase("sent");
  }

  async function resolve() {
    const db = getDb();
    const last = await db.sos.orderBy("triggeredAt").last();
    if (last && !last.resolvedAt) await db.sos.update(last.id, { resolvedAt: new Date().toISOString() });
    cancelAll();
  }

  const holdPct = Math.min(100, (holdMs / 2000) * 100);

  return (
    <>
      <button
        aria-label="緊急求助（長按 2 秒）"
        className="fixed bottom-5 right-5 z-40 h-16 w-16 rounded-full font-black text-white shadow-lg select-none touch-none"
        style={{
          background: `conic-gradient(var(--c-red-solid) ${holdPct}%, color-mix(in srgb, var(--c-red-solid) 65%, black) 0)`,
        }}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
      >
        SOS
      </button>

      {phase === "holding" && (
        <div className="fixed bottom-24 right-5 z-40 card px-3 py-2 text-sm font-bold">
          持續長按 2 秒啟動…
        </div>
      )}

      {(phase === "countdown" || phase === "sent") && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6"
             style={{ background: "color-mix(in srgb, var(--c-red-solid) 92%, black)" }}>
          {phase === "countdown" ? (
            <>
              <div className="text-white text-xl font-bold">即將發出緊急求助</div>
              <div className="text-white text-7xl font-black mono">{countdown}</div>
              <div className="flex flex-wrap justify-center gap-2">
                {KINDS.map((k) => (
                  <button key={k.key} className="seg-btn"
                          data-on={kind === k.key}
                          style={{ background: kind === k.key ? "#fff" : "rgba(255,255,255,.15)", color: kind === k.key ? "var(--c-red-solid)" : "#fff", borderColor: "transparent" }}
                          onClick={() => setKind(k.key)}>
                    {k.label}
                  </button>
                ))}
              </div>
              <button className="btn-ghost w-full max-w-xs" style={{ background: "#fff", color: "var(--c-red-solid)", borderColor: "#fff", minHeight: 56 }}
                      onClick={cancelAll}>
                取消（誤觸）
              </button>
            </>
          ) : (
            <>
              <div className="text-white text-2xl font-black">已通報</div>
              <div className="text-white/90 text-center text-sm leading-7 max-w-xs">
                示範模式：事件已記錄。<br />
                正式版將同時推播 <b>LINE 值班群＋簡訊值班主管</b>，2 分鐘無人認領自動語音電話輪撥，並每 30 秒回報 GPS 位置。
              </div>
              {kind === "patient_emergency" && (
                <a href="tel:119" className="btn-ghost w-full max-w-xs" style={{ background: "#fff", color: "var(--c-red-solid)", borderColor: "#fff", minHeight: 56 }}>
                  📞 撥打 119
                </a>
              )}
              <button className="btn-ghost w-full max-w-xs" style={{ color: "#fff", borderColor: "rgba(255,255,255,.6)" }} onClick={resolve}>
                解除／我已安全
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
