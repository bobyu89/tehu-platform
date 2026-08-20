"use client";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const getId = () => new URLSearchParams(window.location.search).get("id") ?? "";

/**
 * 個案 ID 改由查詢參數取得（/case?id=case-wang）。
 * 靜態輸出（GitHub Pages）不支援動態路徑段；資料層本就全在瀏覽器端。
 * SSR 快照回傳空字串，掛載後讀 location.search；換頁即重掛載，無需訂閱變化。
 */
export function useCaseId(): string {
  return useSyncExternalStore(noopSubscribe, getId, () => "");
}
