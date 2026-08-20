import type { NextConfig } from "next";

// GitHub Pages：靜態輸出＋專案子路徑（bobyu89.github.io/tehu-platform）。
// 本機開發與一般建置不帶 basePath；workflow 以 GITHUB_PAGES=true 觸發。
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true, // 每頁輸出 folder/index.html，靜態主機免改寫規則
  basePath: isPages ? "/tehu-platform" : "",
  images: { unoptimized: true },
};

export default nextConfig;
