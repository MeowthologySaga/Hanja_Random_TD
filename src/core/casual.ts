import strokeData from "../data/cheonjamun-strokes.json";
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
  return strokeByChar.get(char)?.strokes ?? null;
}

export function casualNaturalStar(char: string): CasualStar | null {
  return strokeByChar.get(char)?.naturalStar ?? null;
}

export function casualStarAfterFusion(star: CasualStar): CasualStar | null {
  return star >= 8 ? null : (star + 1) as CasualStar;
}

export function casualStarRangeLabel(star: CasualStar): string {
  const bin = CASUAL_STAR_BINS.find((candidate) => candidate.star === star);
  if (!bin) return "획수 미상";
  return `${bin.minStrokes}–${bin.maxStrokes}획`;
}
