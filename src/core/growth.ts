import type { ElementTraitLevels, Stage, Wuxing } from "./types";

export const ELEMENT_TRAIT_MAX_LEVEL = 10;
export const ELEMENT_TRAIT_UNLOCK_SCORES = Object.freeze([5, 15, 30] as const);
export const ELEMENT_TRAIT_COSTS = Object.freeze([3, 4, 5, 6, 7, 8, 10, 12, 15, 18] as const);
export const DISMANTLE_SCORE_BY_STAGE: Readonly<Record<Stage, number>> = Object.freeze({
  1: 1,
  2: 3,
  3: 6,
  4: 10,
  5: 15
});

export interface ElementTraitDefinition {
  id: string;
  name: string;
  summary: string;
  perLevel: number;
  unit: "%" | "%p";
  milestone?: string;
}

export const ELEMENT_TRAITS: Readonly<Record<Wuxing, readonly [ElementTraitDefinition, ElementTraitDefinition, ElementTraitDefinition]>> = Object.freeze({
  木: [
    { id: "root-network", name: "뿌리망", summary: "장판 반경", perLevel: 2, unit: "%" },
    { id: "growth", name: "생장", summary: "장판 지속", perLevel: 2, unit: "%" },
    { id: "bind", name: "속박", summary: "감속·봉쇄 지속", perLevel: 2.5, unit: "%" }
  ],
  火: [
    { id: "ignite", name: "점화", summary: "지속·추가 피해", perLevel: 2.5, unit: "%" },
    { id: "blast", name: "폭렬", summary: "광역 반경", perLevel: 2, unit: "%" },
    { id: "frenzy", name: "격화", summary: "보스·빈사 적 피해", perLevel: 1.5, unit: "%" }
  ],
  土: [
    { id: "pressure", name: "중압", summary: "감속 강도", perLevel: 1, unit: "%p", milestone: "최종 감속 85% 제한" },
    { id: "crush", name: "압쇄", summary: "철갑 적 피해", perLevel: 2, unit: "%" },
    { id: "quake", name: "지진", summary: "능력 범위", perLevel: 2, unit: "%" }
  ],
  金: [
    { id: "sharp", name: "예리", summary: "치명타 확률", perLevel: 0.4, unit: "%p" },
    { id: "pierce", name: "관통", summary: "방어 관통", perLevel: 1, unit: "%p" },
    { id: "shrapnel", name: "파편", summary: "치명타 피해", perLevel: 2, unit: "%" }
  ],
  水: [
    { id: "flood", name: "범람", summary: "장판 반경", perLevel: 2, unit: "%" },
    { id: "cold", name: "냉기", summary: "감속 지속", perLevel: 2.5, unit: "%" },
    { id: "conduction", name: "유전", summary: "연쇄·보조타 피해", perLevel: 2, unit: "%", milestone: "5·10단계 연쇄 대상 +1" }
  ]
});

export function emptyElementTraitLevels(): ElementTraitLevels {
  return {
    木: [0, 0, 0],
    火: [0, 0, 0],
    土: [0, 0, 0],
    金: [0, 0, 0],
    水: [0, 0, 0]
  };
}

export function dismantleScoreForStage(stage: Stage): number {
  return DISMANTLE_SCORE_BY_STAGE[stage];
}

export function elementTraitUnlockScore(traitIndex: number): number | null {
  return ELEMENT_TRAIT_UNLOCK_SCORES[traitIndex] ?? null;
}

export function elementTraitUpgradeCost(level: number): number | null {
  if (!Number.isInteger(level) || level < 0 || level >= ELEMENT_TRAIT_MAX_LEVEL) return null;
  return ELEMENT_TRAIT_COSTS[level] ?? null;
}

export function elementTraitExtraChainTargets(level: number): number {
  return (level >= 5 ? 1 : 0) + (level >= 10 ? 1 : 0);
}
