"use client";
import { useEffect, useRef, useState } from "react";
import { Siren, Phone, ShieldCheck, X } from "@phosphor-icons/react";
import type { SosIncident } from "@/lib/types";
import * as sos from "@/modules/sos";

// 緊急求助（規格 04 冊 §3）：長按 2 秒啟動，10 秒倒數可取消。
// 示範模式僅寫入本地事件；正式版同時推播 LINE 值班群、簡訊與語音輪撥。

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
    }, 40);
  }

  function cancelHold() {
    if (phase === "holding") { stopHold(); setPhase("idle"); setHoldMs(0); }
  }

  function beginCountdown() {
    if (cdTimer.current) return; // 防重入
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
    await sos.trigger(kind);
    setPhase("sent");
  }

  async function resolve() {
    await sos.resolveLatest();
    cancelAll();
  }

  const pct = Math.min(100, (holdMs / 2000) * 100);

  return (
    <>
      <button
        aria-label="緊急求助，長按 2 秒啟動"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white touch-none select-none"
        style={{
          background: "var(--critical-solid)",
          boxShadow: `var(--shadow), 0 0 0 ${pct > 0 ? 3 : 0}px color-mix(in srgb, var(--critical-solid) 30%, transparent)`,
          backgroundImage: pct > 0
            ? `conic-gradient(rgba(255,255,255,.42) ${pct}%, transparent 0)`
            : undefined,
        }}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Siren size={24} weight="fill" />
      </button>

      {phase === "holding" && (
        <div className="fixed bottom-40 right-4 z-40 sheet px-2.5 py-1.5 t-label enter">
          持續長按 2 秒
        </div>
      )}

      {(phase === "countdown" || phase === "sent") && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--critical-solid)" }}>
          <div className="mx-auto max-w-md min-h-[100dvh] p-4 flex flex-col items-center justify-center gap-4">
            {phase === "countdown" ? (
              <>
                <Siren size={40} weight="fill" color="#fff" />
                <div className="text-white text-center" style={{ fontSize: 18, fontWeight: 700 }}>即將發出緊急求助</div>
                <div className="num text-white" style={{ fontSize: 76, fontWeight: 800, lineHeight: 1 }}>{countdown}</div>
                <div className="sheet w-full">
                  <div className="sheet-title"><span className="t-micro">狀況類型</span></div>
                  <div className="p-2.5 grid grid-cols-2 gap-1.5">
                    {KINDS.map((k) => (
                      <button key={k.key} className="opt" data-on={kind === k.key} onClick={() => setKind(k.key)}>
                        {k.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-on-dark w-full" style={{ minHeight: 56 }} onClick={cancelAll}>
                  <X size={18} weight="bold" /> 取消，我誤觸了
                </button>
              </>
            ) : (
              <>
                <ShieldCheck size={40} weight="fill" color="#fff" />
                <div className="text-white" style={{ fontSize: 22, fontWeight: 800 }}>已通報</div>
                <div className="sheet w-full">
                  <div className="px-3.5 py-3 t-sub">
                    示範模式：事件已記錄。正式版將同時推播 LINE 值班群與簡訊值班主管，
                    2 分鐘無人認領自動語音電話輪撥，並每 30 秒回報定位直到解除。
                  </div>
                </div>
                {kind === "patient_emergency" && (
                  <a href="tel:119" className="btn btn-on-dark w-full" style={{ minHeight: 56, fontSize: 17 }}>
                    <Phone size={20} weight="fill" /> 撥打 119
                  </a>
                )}
                <button className="btn w-full" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.5)" }}
                        onClick={resolve}>
                  解除，我已安全
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
