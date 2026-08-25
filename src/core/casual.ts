import strokeData from "../data/cheonjamun-strokes.json";
import supplementData from "../data/hanzi-strokes-supplement.json";
import type { CasualStar } from "./types";

interface StrokeEntry {
  hanja: string;
  strokes: number;
  naturalStar: CasualStar;
}

interface StrokeBin {
  star: CasualStar;
  minStrokes: number;
  maxStrokes: number;
  count: number;
}

interface StrokeData {
  schema: string;
  scope: string;
  unicodeVersion: string;
  sourceSha256: string;
  total: number;
  bins: StrokeBin[];
  entries: StrokeEntry[];
}

const typedStrokeData = strokeData as StrokeData;
if (typedStrokeData.schema !== "cheonjamun-strokes-v1" || typedStrokeData.total !== 1000) {
  throw new Error("천자문 획수 데이터의 스키마 또는 수량이 올바르지 않습니다.");
}

const strokeByChar = new Map(typedStrokeData.entries.map((entry) => [entry.hanja, entry] as const));

// 일본·중국 로스터(3,560자)는 같은 Unihan 17.0.0 kTotalStrokes 에서 뽑은
// 보충 획수를 쓴다. 별 구간은 천자문과 동일한 빈(bin)을 공유하므로
// "실제 획수 = 희귀도" 규칙이 전 지역에서 유지된다.
interface SupplementData {
  schema: string;
  sourceSha256: string;
  total: number;
  strokes: Record<string, number>;
}
const typedSupplement = supplementData as SupplementData;
if (typedSupplement.schema !== "hanzi-strokes-supplement-v1" || typedSupplement.total !== 3560) {
  throw new Error("보충 획수 데이터의 스키마 또는 수량이 올바르지 않습니다.");
}

function starForStrokes(strokes: number): CasualStar {
  for (const bin of typedStrokeData.bins) {
    if (strokes >= bin.minStrokes && strokes <= bin.maxStrokes) return bin.star;
  }
  // 29획 초과 벽자(예: 일부 CN 규범자)는 최상위 구간으로 본다.
  return 8;
}

export const CASUAL_STAR_BINS = Object.freeze(typedStrokeData.bins.map((bin) => Object.freeze({ ...bin })));
export const CASUAL_STROKE_SOURCE = Object.freeze({
  unicodeVersion: typedStrokeData.unicodeVersion,
  sha256: typedStrokeData.sourceSha256,
  total: typedStrokeData.total
});

// Natural 8★ units sit just below the existing standard-mode 5-stage ceiling.
// A 3-for-1 fusion therefore trades total bodies for slot efficiency without
// making one lucky high-stroke summon erase the rest of the board.
export const CASUAL_STAR_POWER: Record<CasualStar, number> = Object.freeze({
  1: 1,
  2: 1.38,
  3: 1.86,
  4: 2.48,
  5: 3.25,
  6: 4.2,
  7: 5.35,
  8: 6.7
});

export const CASUAL_STAR_NAMES: Record<CasualStar, string> = Object.freeze({
  1: "일반",
  2: "숙련",
  3: "희귀",
  4: "영웅",
  5: "전설",
  6: "신화",
  7: "천명",
  8: "극성"
});

export const CASUAL_STAR_COLORS: Record<CasualStar, string> = Object.freeze({
  1: "#aeb9cc",
  2: "#72d8a0",
  3: "#61c8ff",
  4: "#a98cff",
  5: "#f5c65b",
  6: "#ff8a56",
  7: "#ff5f91",
  8: "#fff1ad"
});

export function casualStrokeCount(char: string): number | null {
  return strokeByChar.get(char)?.strokes ?? typedSupplement.strokes[char] ?? null;
}

export function casualNaturalStar(char: string): CasualStar | null {
  const entry = strokeByChar.get(char);
  if (entry) return entry.naturalStar;
  const strokes = typedSupplement.strokes[char];
  return strokes === undefined ? null : starForStrokes(strokes);
}

export function casualStarAfterFusion(star: CasualStar): CasualStar | null {
  return star >= 8 ? null : (star + 1) as CasualStar;
}

export function casualStarRangeLabel(star: CasualStar): string {
  const bin = CASUAL_STAR_BINS.find((candidate) => candidate.star === star);
  if (!bin) return "획수 미상";
  return `${bin.minStrokes}–${bin.maxStrokes}획`;
}
