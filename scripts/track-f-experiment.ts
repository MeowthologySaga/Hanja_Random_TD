/*
 * 트랙 F 실험 러너(커밋하지 않는 임시 스크립트).
 *
 * 게이트 시뮬과 동일한 시드 가족으로 [성어 기원 미사용/사용] 두 팔을 돌려
 * 성어 획득률·승률 전/후를 계측한다. --wish=0 팔은 게이트 보고서의 해당
 * 슬라이스를 그대로 재현해야 정상(시드 결정성 이중 확인).
 *
 *   tsx scripts/track-f-experiment.ts --mode=casual --wish=1 --out=...json
 *   tsx scripts/track-f-experiment.ts --mode=standard --wish=0 --out=...json
 */
import { writeFileSync } from "node:fs";
import { runAutoplay } from "../src/core/autoplay";
import type { GameMode, SimulationResult } from "../src/core/types";

function arg(name: string): string | undefined {
  return process.argv.find((token) => token.startsWith(`--${name}=`))?.split("=")[1];
}

const mode = (arg("mode") ?? "casual") as GameMode;
const wish = arg("wish") === "1";
const out = arg("out") ?? `TRACK_F_${mode}_${wish ? "wish" : "base"}.json`;
const runs = Number(arg("runs") ?? 45);
// 재현 확인용: 시드 색인을 뒤로 밀어 게이트와 겹치지 않는 새 시드 가족을 만든다.
const offset = Number(arg("offset") ?? 0);

// 게이트 시드 가족 재현: 캐주얼은 KR 단독 0001..0045, 표준은 KR/JP/CN 순환
// 135런 중 KR 몫(index % 3 === 0 → 0001, 0004, ..., 0133)의 앞 45개.
const seeds: string[] = [];
if (mode === "casual") {
  for (let index = offset; seeds.length < runs; index += 1) seeds.push(`balance-casual-KR-${String(index + 1).padStart(4, "0")}`);
} else {
  for (let index = offset * 3; seeds.length < runs; index += 3) seeds.push(`balance-standard-KR-${String(index + 1).padStart(4, "0")}`);
}

const results: SimulationResult[] = seeds.map((seed) => runAutoplay(seed, "KR", 5_400, mode, { idiomWish: wish }));

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5))] ?? 0;
}

const seals = results.map((result) => result.idioms);
const victories = results.filter((result) => result.result === "victory").length;
const checkpointIdioms = (wave: number): number =>
  median(results.map((result) => result.checkpoints.find((checkpoint) => checkpoint.wave === wave)?.idioms ?? 0));
const summary = {
  mode,
  wish,
  runs: results.length,
  victoryRate: Number((victories / results.length).toFixed(3)),
  timeouts: results.filter((result) => result.result === "timeout").length,
  idiomSealMean: Number((seals.reduce((sum, count) => sum + count, 0) / results.length).toFixed(2)),
  idiomSealMedian: median(seals),
  runsWithAnySealPct: Number((seals.filter((count) => count > 0).length / results.length * 100).toFixed(1)),
  sealPerFeaturedPct: Number((seals.reduce((sum, count) => sum + count, 0) / (5 * results.length) * 100).toFixed(1)),
  idiomsAtWave20Median: checkpointIdioms(20),
  idiomsAtWave40Median: checkpointIdioms(40),
  summonsMedian: median(results.map((result) => result.summons)),
  elapsedMinutesMedian: Number((median(results.map((result) => result.elapsed)) / 60).toFixed(2))
};

writeFileSync(out, JSON.stringify(summary, null, 2) + "\n", "utf8");
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
