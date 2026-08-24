import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_IRG_SHA256 = "D1C817DD7DB84295DAB0643C277D97C2FA742C245F8824E6736C2A0935095325";
const EXPECTED_COUNTS = [332, 252, 167, 105, 68, 33, 25, 18];
const STAR_BINS = [
  { star: 1, minStrokes: 1, maxStrokes: 8 },
  { star: 2, minStrokes: 9, maxStrokes: 11 },
  { star: 3, minStrokes: 12, maxStrokes: 13 },
  { star: 4, minStrokes: 14, maxStrokes: 15 },
  { star: 5, minStrokes: 16, maxStrokes: 17 },
  { star: 6, minStrokes: 18, maxStrokes: 19 },
  { star: 7, minStrokes: 20, maxStrokes: 21 },
  { star: 8, minStrokes: 22, maxStrokes: 29 }
];

const sourcePath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!sourcePath) {
  throw new Error("사용법: npm run generate:strokes -- <Unihan_IRGSources.txt 경로>");
}

const source = readFileSync(sourcePath);
const actualHash = createHash("sha256").update(source).digest("hex").toUpperCase();
if (actualHash !== EXPECTED_IRG_SHA256) {
  throw new Error(`Unihan_IRGSources.txt SHA-256 불일치: ${actualHash}`);
}

const strokeByCodePoint = new Map();
for (const line of source.toString("utf8").split(/\r?\n/u)) {
  const match = /^U\+([0-9A-F]+)\tkTotalStrokes\t(.+)$/u.exec(line);
  if (!match) continue;
  // Some compatibility characters carry two regional values. The first value
  // is Unicode's default total and keeps this build deterministic.
  const stroke = Number(match[2].trim().split(/\s+/u)[0]);
  if (Number.isInteger(stroke)) strokeByCodePoint.set(Number.parseInt(match[1], 16), stroke);
}

const runtimePath = resolve("src/data/cheonjamun-runtime-jaryeongs.json");
const runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
if (!Array.isArray(runtime.entries) || runtime.entries.length !== 1000) {
  throw new Error(`천자문 런타임 데이터가 1000자가 아닙니다: ${runtime.entries?.length ?? "없음"}`);
}

const entries = runtime.entries.map((entry) => {
  const codePoint = entry.hanja.codePointAt(0);
  const strokes = strokeByCodePoint.get(codePoint);
  if (!Number.isInteger(strokes)) throw new Error(`${entry.hanja}(U+${codePoint.toString(16).toUpperCase()}) 획수 누락`);
  const bin = STAR_BINS.find((candidate) => strokes >= candidate.minStrokes && strokes <= candidate.maxStrokes);
  if (!bin) throw new Error(`${entry.hanja} ${strokes}획에 대응하는 별 구간이 없습니다.`);
  return { hanja: entry.hanja, strokes, naturalStar: bin.star };
});

const bins = STAR_BINS.map((bin) => ({
  ...bin,
  count: entries.filter((entry) => entry.naturalStar === bin.star).length
}));
const counts = bins.map((bin) => bin.count);
if (counts.some((count, index) => count !== EXPECTED_COUNTS[index])) {
  throw new Error(`획수 분포가 검증 기준과 다릅니다: ${counts.join(",")}`);
}
if (counts.some((count, index) => index > 0 && count >= counts[index - 1])) {
  throw new Error(`별 분포가 피라미드 구조가 아닙니다: ${counts.join(",")}`);
}

const output = {
  schema: "cheonjamun-strokes-v1",
  scope: "KR_1000",
  unicodeVersion: "17.0.0",
  sourceFile: "Unihan_IRGSources.txt",
  sourceSha256: EXPECTED_IRG_SHA256,
  total: entries.length,
  designRule: "natural-star-by-kTotalStrokes",
  bins,
  entries
};
const outputPath = resolve("src/data/cheonjamun-strokes.json");
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`PASS: ${entries.length}자 · ${bins.map((bin) => `${bin.star}★ ${bin.count}`).join(" · ")}\n`);
