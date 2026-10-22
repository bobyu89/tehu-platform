import type { MetadataRoute } from "next";

export const dynamic = "force-static"; // output: export 之必要宣告

// PWA 安裝資訊（ADR-006：PWA 加 LINE 通知）。
// iOS 完整安裝體驗需另備 PNG apple-touch-icon，列於後續打磨項目。
export default function manifest(): MetadataRoute.Manifest {
  const bp = process.env.GITHUB_PAGES === "true" ? "/tehu-platform" : "";
  return {
    name: "特護平台",
    short_name: "特護",
    description: "特別護理師照護與行政平台",
    start_url: `${bp}/today/`,
    display: "standalone",
    background_color: "#f4f6f5",
    theme_color: "#0b6b60",
    icons: [
      { src: `${bp}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
