"use client";
import { useEffect, useRef } from "react";

// 首屏影片背景：手動循環＋首尾各 0.5 秒淡入淡出（requestAnimationFrame 監看
// currentTime／duration；ended 後歸零、停 100ms 再播），達成無縫的電影感循環。
// 影片為外部資產（約 29MB）：metadata 先行、載入完成才淡入，載不到時保持純白背景不影響內容。

const SRC = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4";
const FADE = 0.5;

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const tick = () => {
      if (v.duration > 0 && !v.paused) {
        const t = v.currentTime;
        const remain = v.duration - t;
        let opacity = 1;
        if (t < FADE) opacity = t / FADE;
        else if (remain < FADE) opacity = Math.max(0, remain / FADE);
        v.style.opacity = String(opacity);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onEnded = () => {
      v.style.opacity = "0";
      window.setTimeout(() => {
        v.currentTime = 0;
        void v.play().catch(() => {});
      }, 100);
    };
    v.addEventListener("ended", onEnded);

    void v.play().catch(() => {}); // 自動播放被擋時保持純白背景

    return () => {
      cancelAnimationFrame(rafRef.current);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="absolute z-0 h-auto w-full object-cover"
      style={{ top: 300, right: 0, bottom: 0, left: 0, opacity: 0, height: "calc(100% - 300px)" }}
      src={SRC}
      muted
      playsInline
      autoPlay
      preload="metadata"
      aria-hidden="true"
    />
  );
}
