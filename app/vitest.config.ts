import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 單元測試：判定引擎與模組內的純函式（node 環境，不碰 IndexedDB）。
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
