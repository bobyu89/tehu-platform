"use client";
import { useEffect, useState } from "react";

/** IndexedDB 僅存在於瀏覽器：以 mounted gate 避免 SSR 預渲染觸碰 Dexie */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
