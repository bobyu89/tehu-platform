"use client";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * IndexedDB 僅存在於瀏覽器：以此 gate 避免 SSR 預渲染觸碰 Dexie。
 * 用 useSyncExternalStore 而非 useEffect + setState，免除串聯重繪。
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
