import { CHEONJAMUN_JARYEONG_ROSTER } from "./cheonjamun-roster";
import { CHEONJAMUN_RUNTIME_JARYEONGS } from "./cheonjamun-runtime";
import generatedCnData from "../data/cn3500-generated-jaryeongs.json";
import type { EnemyArchetype, RegionCode, Wuxing } from "./types";

export interface JaryeongVisual {
  id: string;
  hanja: string;
  name: string;
  wuxing: Wuxing;
  assetPath?: string;
  frameLayout?: "2x2" | "single";
}

const BASE_JARYEONG_VISUALS: readonly JaryeongVisual[] = Object.freeze([
  { id: "wood-mok", hanja: "木", name: "목령", wuxing: "木" },
  { id: "wood-tree", hanja: "樹", name: "수령", wuxing: "木" },
  { id: "wood-life", hanja: "生", name: "생령", wuxing: "木" },
  { id: "wood-bamboo", hanja: "竹", name: "죽령", wuxing: "木" },
  { id: "wood-orchid", hanja: "蘭", name: "난령", wuxing: "木" },
  { id: "wood-forest", hanja: "森", name: "삼령", wuxing: "木" },
  { id: "fire-hwa", hanja: "火", name: "화령", wuxing: "火" },
  { id: "fire-light", hanja: "光", name: "광령", wuxing: "火" },
  { id: "fire-sun", hanja: "日", name: "일령", wuxing: "火" },
  { id: "fire-lantern", hanja: "燈", name: "등령", wuxing: "火" },
  { id: "fire-fox", hanja: "狐", name: "호령", wuxing: "火" },
  { id: "fire-phoenix", hanja: "鳳", name: "봉령", wuxing: "火" },
  { id: "earth-to", hanja: "土", name: "토령", wuxing: "土" },
  { id: "earth-stone", hanja: "石", name: "석령", wuxing: "土" },
  { id: "earth-mountain", hanja: "山", name: "산령", wuxing: "土" },
  { id: "earth-pottery", hanja: "陶", name: "도령", wuxing: "土" },
  { id: "earth-tortoise", hanja: "龜", name: "귀령", wuxing: "土" },
  { id: "earth-valley", hanja: "谷", name: "곡령", wuxing: "土" },
  { id: "metal-gold", hanja: "金", name: "금령", wuxing: "金" },
  { id: "metal-jade", hanja: "玉", name: "옥령", wuxing: "金" },
  { id: "metal-sword", hanja: "劍", name: "검령", wuxing: "金" },
  { id: "metal-bell", hanja: "鐘", name: "종령", wuxing: "金" },
  { id: "metal-mirror", hanja: "鏡", name: "경령", wuxing: "金" },
  { id: "metal-chain", hanja: "鎖", name: "쇄령", wuxing: "金" },
  { id: "water-sui", hanja: "水", name: "수령", wuxing: "水" },
  { id: "water-rain", hanja: "雨", name: "우령", wuxing: "水" },
  { id: "water-sea", hanja: "海", name: "해령", wuxing: "水" },
  { id: "water-abyss", hanja: "淵", name: "연령", wuxing: "水" },
  { id: "water-ice", hanja: "氷", name: "빙령", wuxing: "水" },
  { id: "water-mist", hanja: "霧", name: "무령", wuxing: "水" }
]);

export const CHEONJAMUN_JARYEONG_VISUALS: readonly JaryeongVisual[] = Object.freeze(
  CHEONJAMUN_JARYEONG_ROSTER.map((entry) => ({
    id: entry.id,
    hanja: entry.hanja,
    name: `${entry.reading}령`,
    wuxing: entry.wuxing
  }))
);

export const CHEONJAMUN_RUNTIME_JARYEONG_VISUALS: readonly JaryeongVisual[] = Object.freeze(
  CHEONJAMUN_RUNTIME_JARYEONGS.map((entry) => ({
    id: entry.id,
    hanja: entry.hanja,
    name: `${entry.huneum} 자령`,
    wuxing: entry.wuxing,
    assetPath: entry.assetPath,
    frameLayout: entry.frameLayout
  }))
);

export const CN3500_GENERATED_JARYEONG_VISUALS: readonly JaryeongVisual[] = Object.freeze(
  generatedCnData.entries.map((entry) => ({
    id: entry.id,
    hanja: entry.hanja,
    name: `${entry.reading}령`,
    wuxing: entry.wuxing as Wuxing
  }))
);

export const JARYEONG_VISUALS: readonly JaryeongVisual[] = Object.freeze([
  ...BASE_JARYEONG_VISUALS,
  ...CHEONJAMUN_JARYEONG_VISUALS,
  ...CHEONJAMUN_RUNTIME_JARYEONG_VISUALS,
  ...CN3500_GENERATED_JARYEONG_VISUALS
]);

const legacyExactVisuals = new Map(BASE_JARYEONG_VISUALS.map((visual) => [visual.hanja, visual]));
const approvedKrExactVisuals = new Map(CHEONJAMUN_JARYEONG_VISUALS.map((visual) => [visual.hanja, visual]));
const krRuntimeExactVisuals = new Map(CHEONJAMUN_RUNTIME_JARYEONG_VISUALS.map((visual) => [visual.hanja, visual]));
const cnExactVisuals = new Map(CN3500_GENERATED_JARYEONG_VISUALS.map((visual) => [visual.hanja, visual]));
const visualsById = new Map(JARYEONG_VISUALS.map((visual) => [visual.id, visual]));
const fallbackVisualIds = new Set([
  "wood-mok", "wood-tree", "wood-life", "wood-forest",
  "fire-hwa", "fire-light", "fire-sun", "fire-fox", "fire-phoenix",
  "earth-to", "earth-stone", "earth-mountain", "earth-tortoise",
  "metal-gold", "metal-jade", "metal-sword", "metal-bell",
  "water-sui", "water-rain", "water-sea", "water-mist"
]);
const visualsByWuxing = new Map<Wuxing, readonly JaryeongVisual[]>(
  (["木", "火", "土", "金", "水"] as const).map((wuxing) => [
    wuxing,
    JARYEONG_VISUALS.filter((visual) => visual.wuxing === wuxing && fallbackVisualIds.has(visual.id))
  ])
);

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const glyph of value) {
    hash ^= glyph.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function jaryeongVisualFor(char: string, wuxing: Wuxing, region: RegionCode = "KR"): JaryeongVisual {
  const legacyExact = legacyExactVisuals.get(char);
  if (legacyExact) return legacyExact;
  const approvedKrExact = region === "KR" ? approvedKrExactVisuals.get(char) : undefined;
  if (approvedKrExact) return approvedKrExact;
  const krRuntimeExact = region === "KR" ? krRuntimeExactVisuals.get(char) : undefined;
  if (krRuntimeExact?.wuxing === wuxing) return krRuntimeExact;
  const cnExact = region === "CN" ? cnExactVisuals.get(char) : undefined;
  if (cnExact?.wuxing === wuxing) return cnExact;
  const family = visualsByWuxing.get(wuxing) ?? [];
  const visual = family[stableHash(char) % family.length];
  if (!visual) throw new Error(`Missing Jaryeong visual family: ${wuxing}`);
  return visual;
}

export function jaryeongAssetPath(visual: JaryeongVisual): string {
  return visual.assetPath ?? `assets/jaryeongs/${visual.id}/sheet-transparent.png`;
}

export function jaryeongFrameLayout(visual: JaryeongVisual): "2x2" | "single" {
  return visual.frameLayout ?? "2x2";
}

const ENEMY_VISUAL_IDS: Readonly<Record<EnemyArchetype, readonly string[]>> = Object.freeze({
  normal: ["water-mist", "water-cloud", "water-dew"],
  swarm: ["wood-leaf", "fire-crow", "water-cloud"],
  swift: ["fire-soar", "water-flow", "metal-sharp"],
  armored: ["earth-heavy", "earth-firm", "metal-tool"],
  regenerator: ["wood-life", "wood-lush", "water-dew"],
  boss: ["earth-giant", "earth-great-mountain", "earth-tortoise"]
});

/** Enemy silhouettes communicate behavior while their aura communicates weakness. */
export function enemyJaryeongVisualFor(archetype: EnemyArchetype, variant: number): JaryeongVisual {
  const ids = ENEMY_VISUAL_IDS[archetype];
  const id = ids[Math.abs(variant) % ids.length] as string;
  const visual = visualsById.get(id);
  if (!visual) throw new Error(`Missing enemy Jaryeong visual: ${id}`);
  return visual;
}
