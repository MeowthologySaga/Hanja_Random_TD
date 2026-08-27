#!/usr/bin/env node
/*
 * 라이브 즉시 되돌리기.
 *
 *   node scripts/rollback-live.mjs            → 직전 라이브(live/prev-*)로
 *   node scripts/rollback-live.mjs <ref>      → 지정한 커밋·태그 상태로
 *
 * 되돌림은 파괴적 force-push 가 아니라 "그 시점의 파일 상태를 그대로 담은
 * 새 커밋"을 main 위에 얹는 방식이다 — 역사는 남고, Pages 배포는 자동으로
 * 다시 돌며, 되돌린 것을 또 되돌릴 수도 있다.
 */
import { execFileSync } from "node:child_process";

const run = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const target = process.argv[2] ?? "live/prev-2026-08-27";

try {
  run("fetch", "origin", "--tags", "--quiet");
  const tree = run("rev-parse", `${target}^{tree}`);
  const targetSha = run("rev-parse", `${target}^{commit}`);
  const mainSha = run("rev-parse", "origin/main");
  if (run("rev-parse", `origin/main^{tree}`) === tree) {
    console.log(`이미 ${target} 상태입니다 (main ${mainSha.slice(0, 7)}). 되돌릴 것이 없습니다.`);
    process.exit(0);
  }
  const message = `라이브 되돌리기 — ${target} (${targetSha.slice(0, 7)}) 상태로 복원`;
  const commit = run("commit-tree", tree, "-p", mainSha, "-m", message);
  run("push", "origin", `${commit}:refs/heads/main`);
  console.log(`되돌렸습니다: main ${mainSha.slice(0, 7)} → ${commit.slice(0, 7)} (${target} 의 파일 상태)`);
  console.log("Pages 배포가 자동으로 다시 돕니다 — 1~2분 뒤 새로고침하세요.");
} catch (error) {
  console.error("되돌리기 실패:", error.message);
  console.error("수동 대안: git push origin " + target + "^{commit}:refs/heads/main --force");
  process.exit(1);
}
