/// <reference types="vitest/config" />
import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vitest/config";

/**
 * 서비스 워커 캐시 버전 키. 빌드마다 새 값이 박히므로 배포하면 등록 URL
 * (`sw.js?v=…`)이 바뀌고, 워커가 activate 에서 옛 캐시를 통째로 지운다.
 */
const buildId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

export default defineConfig({
  plugins: [sites()],
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(buildId)
  },
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
  },
  /*
   * `npm test`(vitest run tests)의 인자는 경로가 아니라 이름 필터라, 워크트리·
   * 스냅샷 사본의 `…/tests/…` 까지 전부 끌어와 1,246개 파일을 돌리고 그 사본의
   * 옛 코드가 실패로 잡혔다(실측: 본체 28파일 12초 → 사본 포함 1,246파일 200초).
   * 본체 밖은 아예 수집하지 않는다.
   */
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**", "**/.codex_tmp/**", "**/handoff/**"]
  }
});
