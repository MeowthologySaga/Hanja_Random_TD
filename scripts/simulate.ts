import { runAutoplay } from "../src/core/game";
import type { RegionCode, SimulationResult } from "../src/core/types";
import { writeFileSync } from "node:fs";

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
  const defeatReasons = Object.fromEntries(
    [...new Set(results.filter((result) => result.result === "defeat").map((result) => result.endReason))]
      .sort()
      .map((reason) => [reason, results.filter((result) => result.result === "defeat" && result.endReason === reason).length])
  );
  return {
    runs: results.length,
    victories,
    defeats,
    timeouts,
    victoryRate: Number((victories / Math.max(1, results.length)).toFixed(3)),
    wave: { p10: percentile(waves, 0.1), median: percentile(waves, 0.5), p90: percentile(waves, 0.9) },
    goals: { median: percentile(goals, 0.5), p90: percentile(goals, 0.9) },
    idioms: { median: percentile(idioms, 0.5), p90: percentile(idioms, 0.9) },
    evolutions: { median: percentile(evolutions, 0.5), p90: percentile(evolutions, 0.9) },
    peakTowers: { median: percentile(peakTowerCounts, 0.5), p90: percentile(peakTowerCounts, 0.9) },
    discoveries: { median: percentile(discoveries, 0.5), p90: percentile(discoveries, 0.9) },
    defeatReasons
  };
}

const runs = readRuns();
const regions: readonly RegionCode[] = ["KR", "JP", "CN"];
const results = Array.from({ length: runs }, (_, index) => {
  const region = regions[index % regions.length] as RegionCode;
  return runAutoplay("balance-" + region + "-" + String(index + 1).padStart(4, "0"), region);
});
const byRegion = Object.fromEntries(regions.map((region) => [region, summarize(results.filter((result) => result.region === region))]));
const timeouts = results.filter((result) => result.result === "timeout").length;
const medianWave = percentile(results.map((result) => result.wave), 0.5);
const medianGoals = percentile(results.map((result) => result.goals), 0.5);
const report = {
  totalRuns: runs,
  byRegion,
  aggregate: summarize(results),
  gates: {
    noTimeouts: timeouts === 0,
    medianWaveAtLeast10: medianWave >= 10,
    medianGoalAtLeast1: medianGoals >= 1
  },
  pass: timeouts === 0 && medianWave >= 10 && medianGoals >= 1
};

const serialized = JSON.stringify(report, null, 2) + "\n";
writeFileSync(new URL("../SIMULATION_REPORT.json", import.meta.url), serialized, "utf8");
process.stdout.write(serialized);
if (!report.pass) process.exitCode = 1;
