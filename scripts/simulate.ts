import { runAutoplay } from "../src/core/game";
import type { RegionCode, SimulationCheckpoint, SimulationResult, Wuxing } from "../src/core/types";
import { writeFileSync } from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const REGIONS: readonly RegionCode[] = ["KR", "JP", "CN"];
const ELEMENTS: readonly Wuxing[] = ["木", "火", "土", "金", "水"];

interface SimulationWorkerData {
  start: number;
  count: number;
}

function readRuns(): number {
  const raw = process.argv.find((argument) => argument.startsWith("--runs="))?.split("=")[1];
  const parsed = Number(raw ?? 45);
  if (!Number.isInteger(parsed) || parsed < 3 || parsed > 3_000) throw new Error("--runs must be an integer from 3 to 3000");
  return parsed;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function summarize(results: SimulationResult[]): Record<string, unknown> {
  const victories = results.filter((result) => result.result === "victory").length;
  const defeats = results.filter((result) => result.result === "defeat").length;
  const timeouts = results.filter((result) => result.result === "timeout").length;
  const waves = results.map((result) => result.wave);
  const goals = results.map((result) => result.goals);
  const idioms = results.map((result) => result.idioms);
  const evolutions = results.map((result) => result.evolutions);
  const peakTowerCounts = results.map((result) => result.peakTowerCount);
  const discoveries = results.map((result) => result.discoveries);
  const elapsedMinutes = results.map((result) => Number((result.elapsed / 60).toFixed(2)));
  const dismantles = results.map((result) => result.dismantles);
  const essenceGenerated = results.map((result) => result.essenceGenerated);
  const essenceSpent = results.map((result) => result.essenceSpent);
  const essenceSpendRates = results.map((result) => result.essenceSpendRate);
  const defeatReasons = Object.fromEntries(
    [...new Set(results.filter((result) => result.result === "defeat").map((result) => result.endReason))]
      .sort()
      .map((reason) => [reason, results.filter((result) => result.result === "defeat" && result.endReason === reason).length])
  );
  const checkpoints = Object.fromEntries(Array.from({ length: 10 }, (_, index) => (index + 1) * 10).map((wave) => {
    const reached = results
      .map((result) => result.checkpoints.find((checkpoint) => checkpoint.wave === wave))
      .filter((checkpoint): checkpoint is SimulationCheckpoint => Boolean(checkpoint));
    return [wave, {
      reached: reached.length,
      formations: percentile(reached.map((checkpoint) => checkpoint.formations), 0.5),
      towers: percentile(reached.map((checkpoint) => checkpoint.towers), 0.5),
      inventory: percentile(reached.map((checkpoint) => checkpoint.inventory), 0.5),
      summons: percentile(reached.map((checkpoint) => checkpoint.summons), 0.5),
      evolutions: percentile(reached.map((checkpoint) => checkpoint.evolutions), 0.5),
      discoveries: percentile(reached.map((checkpoint) => checkpoint.discoveries), 0.5),
      gold: percentile(reached.map((checkpoint) => checkpoint.gold), 0.5),
      dismantles: percentile(reached.map((checkpoint) => checkpoint.dismantles), 0.5),
      essenceGenerated: percentile(reached.map((checkpoint) => checkpoint.essenceGenerated), 0.5),
      essenceSpent: percentile(reached.map((checkpoint) => checkpoint.essenceSpent), 0.5)
    }];
  }));
  return {
    runs: results.length,
    victories,
    defeats,
    timeouts,
    victoryRate: Number((victories / Math.max(1, results.length)).toFixed(3)),
    elapsedMinutes: {
      p10: percentile(elapsedMinutes, 0.1),
      median: percentile(elapsedMinutes, 0.5),
      p90: percentile(elapsedMinutes, 0.9)
    },
    wave: { p10: percentile(waves, 0.1), median: percentile(waves, 0.5), p90: percentile(waves, 0.9) },
    goals: { median: percentile(goals, 0.5), p90: percentile(goals, 0.9) },
    idioms: { median: percentile(idioms, 0.5), p90: percentile(idioms, 0.9) },
    evolutions: { median: percentile(evolutions, 0.5), p90: percentile(evolutions, 0.9) },
    peakTowers: { median: percentile(peakTowerCounts, 0.5), p90: percentile(peakTowerCounts, 0.9) },
    discoveries: { median: percentile(discoveries, 0.5), p90: percentile(discoveries, 0.9) },
    dismantles: { median: percentile(dismantles, 0.5), p90: percentile(dismantles, 0.9) },
    essence: {
      generatedMedian: percentile(essenceGenerated, 0.5),
      spentMedian: percentile(essenceSpent, 0.5),
      spendRateMedian: Number(percentile(essenceSpendRates, 0.5).toFixed(3))
    },
    elementTraits: Object.fromEntries(ELEMENTS.map((wuxing) => [wuxing, [0, 1, 2].map((index) => percentile(results.map((result) => result.elementTraitLevels[wuxing][index] ?? 0), 0.5))])),
    checkpoints,
    defeatReasons
  };
}

function readWorkers(runs: number): number {
  const raw = process.argv.find((argument) => argument.startsWith("--workers="))?.split("=")[1];
  const parsed = Number(raw ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 16) throw new Error("--workers must be an integer from 1 to 16");
  return Math.min(parsed, runs);
}

function runRange(start: number, count: number): SimulationResult[] {
  return Array.from({ length: count }, (_, offset) => {
    const index = start + offset;
    const region = REGIONS[index % REGIONS.length] as RegionCode;
    return runAutoplay("balance-" + region + "-" + String(index + 1).padStart(4, "0"), region);
  });
}

async function runParallel(runs: number, workers: number): Promise<SimulationResult[]> {
  const base = Math.floor(runs / workers);
  let remainder = runs % workers;
  let start = 0;
  const jobs: Array<Promise<SimulationResult[]>> = [];
  for (let index = 0; index < workers; index += 1) {
    const count = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    const payload: SimulationWorkerData = { start, count };
    start += count;
    jobs.push(new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: payload });
      worker.once("message", (result: SimulationResult[]) => resolve(result));
      worker.once("error", reject);
      worker.once("exit", (code) => { if (code !== 0) reject(new Error(`Simulation worker exited with code ${code}`)); });
    }));
  }
  return (await Promise.all(jobs)).flat();
}

async function main(): Promise<void> {
  const runs = readRuns();
  const workers = readWorkers(runs);
  const results = workers === 1 ? runRange(0, runs) : await runParallel(runs, workers);
  const byRegion = Object.fromEntries(REGIONS.map((region) => [region, summarize(results.filter((result) => result.region === region))]));
  const byStartingElement = Object.fromEntries(ELEMENTS.map((wuxing) => [wuxing, summarize(results.filter((result) => result.startingWuxing === wuxing))]));
  const byRegionAndStartingElement = Object.fromEntries(REGIONS.map((region) => [region, Object.fromEntries(
    ELEMENTS.map((wuxing) => [wuxing, summarize(results.filter((result) => result.region === region && result.startingWuxing === wuxing))])
  )]));
  const timeouts = results.filter((result) => result.result === "timeout").length;
  const medianWave = percentile(results.map((result) => result.wave), 0.5);
  const medianGoals = percentile(results.map((result) => result.goals), 0.5);
  const medianElapsedMinutes = percentile(results.map((result) => result.elapsed / 60), 0.5);
  const p10Wave = percentile(results.map((result) => result.wave), 0.1);
  const medianFormationsAt20 = percentile(results.map((result) => result.checkpoints.find((checkpoint) => checkpoint.wave === 20)?.formations ?? 0), 0.5);
  const medianFormationsAt40 = percentile(results.map((result) => result.checkpoints.find((checkpoint) => checkpoint.wave === 40)?.formations ?? 0), 0.5);
  const medianFormationsAt60 = percentile(results.map((result) => result.checkpoints.find((checkpoint) => checkpoint.wave === 60)?.formations ?? 0), 0.5);
  const aggregateVictories = results.filter((result) => result.result === "victory").length;
  const victoryRate = aggregateVictories / Math.max(1, results.length);
  const regionVictoryRates = REGIONS.map((region) => {
    const regional = results.filter((result) => result.region === region);
    return regional.filter((result) => result.result === "victory").length / Math.max(1, regional.length);
  });
  const startingElementVictoryRates = ELEMENTS.map((wuxing) => {
    const started = results.filter((result) => result.startingWuxing === wuxing);
    return started.filter((result) => result.result === "victory").length / Math.max(1, started.length);
  });
  const regionVictoryGap = Math.max(...regionVictoryRates) - Math.min(...regionVictoryRates);
  const startingElementVictoryGap = Math.max(...startingElementVictoryRates) - Math.min(...startingElementVictoryRates);
  const victoryEssenceSpendRateMedian = percentile(results.filter((result) => result.result === "victory").map((result) => result.essenceSpendRate), 0.5);
  const report = {
    totalRuns: runs,
    workers,
    byRegion,
    byStartingElement,
    byRegionAndStartingElement,
    aggregate: summarize(results),
    gates: {
      noTimeouts: timeouts === 0,
      medianRunMinutesInTargetBand: medianElapsedMinutes >= 43 && medianElapsedMinutes <= 50,
      victoryRateInTargetBand: victoryRate >= 0.45 && victoryRate <= 0.60,
      regionVictoryGapAtMost15Points: regionVictoryGap <= 0.15,
      startingElementVictoryGapAtMost10Points: startingElementVictoryGap <= 0.10,
      victoryEssenceSpendRateMedianAtLeast70Percent: victoryEssenceSpendRateMedian >= 0.70
    },
    diagnostics: {
      p10Wave,
      medianWave,
      medianGoals,
      medianFormationsAt20,
      medianFormationsAt40,
      medianFormationsAt60,
      regionVictoryGap: Number(regionVictoryGap.toFixed(3)),
      startingElementVictoryGap: Number(startingElementVictoryGap.toFixed(3)),
      victoryEssenceSpendRateMedian: Number(victoryEssenceSpendRateMedian.toFixed(3))
    },
    pass: timeouts === 0
      && medianElapsedMinutes >= 43 && medianElapsedMinutes <= 50
      && victoryRate >= 0.45 && victoryRate <= 0.60
      && regionVictoryGap <= 0.15
      && startingElementVictoryGap <= 0.10
      && victoryEssenceSpendRateMedian >= 0.70
  };

  const serialized = JSON.stringify(report, null, 2) + "\n";
  writeFileSync(new URL("../SIMULATION_REPORT.json", import.meta.url), serialized, "utf8");
  process.stdout.write(serialized);
  if (!report.pass) process.exitCode = 1;
}

if (isMainThread) {
  await main();
} else {
  const payload = workerData as SimulationWorkerData;
  parentPort?.postMessage(runRange(payload.start, payload.count));
}
