import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sites()],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 4437,
    strictPort: true,
    watch: {
      // 에이전트 워크트리·코덱스 스냅샷 변경이 본체 dev 서버를 끝없이
      // 리로드시키지 않게 한다 (e2e 안정성에도 필수).
      ignored: ["**/.claude/**", "**/.codex_tmp/**", "**/handoff/**"]
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 4438,
    strictPort: true
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true
  }
});
