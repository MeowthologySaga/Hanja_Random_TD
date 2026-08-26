import krRuntime from "../../handoff_source/data/KR_1000.prelim.runtime.json";
import jpRuntime from "../../handoff_source/data/JP_2136.prelim.runtime.json";
import cnRuntime from "../../handoff_source/data/CN_3500.prelim.runtime.json";
import { composeAbilityLoadout } from "./abilities";
import {
  CHEONJAMUN_SUPPLEMENTAL_CHARACTERS,
  CHEONJAMUN_WUXING_BY_CHAR
} from "./cheonjamun-roster";
import {
  CHEONJAMUN_RUNTIME_JARYEONG_CHARS,
  CHEONJAMUN_RUNTIME_JARYEONGS,
  CHEONJAMUN_RUNTIME_WUXING_BY_CHAR
} from "./cheonjamun-runtime";
import type {
  CombatProfile,
  CombatRole,
  ElementKind,
  GraphRole,
  HanziCatalog,
  HanziDefinition,
  RegionCode,
  Stage,
  SummonIntent,
  UpgradeStat,
  Wuxing
} from "./types";

interface RuntimeCharacter {
  c: string;
  s: number;
  e: string;
  a: "D" | "C";
  p: string[];
  r: number;
}

interface RuntimeData {
  v: string;
  region: RegionCode;
  chars: RuntimeCharacter[];
}

export interface ElementStyle {
  wuxing: Wuxing;
  kind: ElementKind;
  name: string;
  color: string;
  glow: string;
  effectLabel: string;
  combatDescription: string;
}

export const WUXING_ORDER: readonly Wuxing[] = ["木", "火", "土", "金", "水"];

export const ELEMENT_STYLES: Record<Wuxing, ElementStyle> = {
  木: {
    wuxing: "木",
    kind: "wood",
    name: "목",
    color: "#73df8d",
    glow: "#28b765",
    effectLabel: "생장독",
    combatDescription: "3초 지속 피해, 水 상생 시 피해 증가"
  },
  火: {
    wuxing: "火",
    kind: "fire",
    name: "화",
    color: "#ff755a",
    glow: "#ff3550",
    effectLabel: "폭염",
    combatDescription: "대상 주변에 48% 범위 피해"
  },
  土: {
    wuxing: "土",
    kind: "earth",
    name: "토",
    color: "#d9a46d",
    glow: "#a85a3f",
    effectLabel: "진압",
    combatDescription: "확률 기절과 안정적인 방어 대응"
  },
  金: {
    wuxing: "金",
    kind: "metal",
    name: "금",
    color: "#ffd66c",
    glow: "#ffac2f",
    effectLabel: "절단",
    combatDescription: "치명타와 장갑 관통"
  },
  水: {
    wuxing: "水",
    kind: "water",
    name: "수",
    color: "#68c9ff",
    glow: "#357dff",
    effectLabel: "한류",
    combatDescription: "이동 감속과 연쇄 타격"
  }
};

export const STAGE_MULTIPLIERS: Record<Stage, number> = {
  1: 1,
  2: 1.62,
  3: 2.65,
  4: 4.3,
  5: 7
};

export const STAGE_NAMES: Record<Stage, string> = {
  1: "초형",
  2: "결합",
  3: "합성",
  4: "각성",
  5: "극의"
};

export const STAGE_COLORS: Record<Stage, string> = {
  1: "#aeb9cc",
  2: "#62c7ff",
  3: "#c783ff",
  4: "#ffca5b",
  5: "#ff708c"
};

export const ROLE_LABELS: Record<CombatRole, string> = {
  rapid: "연사",
  burst: "중타격",
  splash: "범위",
  control: "제어",
  support: "지원",
  economy: "생성"
};

export const GRAPH_ROLE_LABELS: Record<GraphRole, string> = {
  hub: "허브",
  bridge: "브리지",
  finisher: "피니셔",
  independent: "독립"
};

export const REGION_META: Record<RegionCode, { title: string; short: string; scope: number; glyphStandard: string }> = {
  KR: { title: "한국 · 천자문", short: "천자문 1000", scope: 1000, glyphStandard: "한국 정자체" },
  JP: { title: "일본 · 상용한자", short: "상용한자 2136", scope: 2136, glyphStandard: "일본 신자체" },
  CN: { title: "중국 · 규범한자", short: "1급 규범 3500", scope: 3500, glyphStandard: "중국 간체" }
};

export const GAME_CONFIG = {
  maxBoardSize: 80,
  maxTowerCount: 80,
  maxWaves: 100,
  startingGold: 42,
  prepSeconds: 8,
  bossPrepSeconds: 12,
  goalReward: 18,
  goalRewardPerChapter: 4,
  synergyBonus: 0.1,
  weaknessMultiplier: 1.3,
  targetWeightBase: 1.45,
  idiomWeightBase: 2.15,
  recipeWeightBase: 0.55,
  expansionPoolWeight: 0.32,
  undiscoveredWeight: 2.4,
  repeatWeightDecay: 0.5,
  softPityStep: 0.16,
  maxSoftPity: 8
} as const;

const ACTIVE_POOL_CHARS: Record<RegionCode, readonly string[]> = {
  KR: ["木", "目", "雨", "日", "口", "人", "言", "心", "也", "鳥", "門", "王", "女", "田", "力", "白", "羽", "京", "者", "土", "以", "傳", "百", "發", "中", "溫", "故", "矢", "新", "有", "無"],
  JP: ["木", "目", "雨", "日", "口", "人", "刀", "文", "心", "女", "王", "田", "力", "白", "羽", "京", "十", "一", "子", "言", "以", "伝", "発", "中", "温", "故", "矢", "新", "有", "無"],
  CN: ["木", "目", "雨", "水", "文", "刀", "口", "人", "日", "心", "女", "王", "田", "力", "白", "羽", "京", "十", "一", "子", "以", "专", "发", "中", "温", "故", "矢", "立", "斤", "有", "无", "言"]
};

const GOAL_ORDER: Record<RegionCode, readonly string[]> = {
  KR: ["相", "霜", "林", "景", "信"],
  JP: ["林", "森", "相", "霜", "信"],
  CN: ["刘", "浏", "林", "森", "霜"]
};

const RUNTIME: Record<RegionCode, RuntimeData> = {
  KR: krRuntime as RuntimeData,
  JP: jpRuntime as RuntimeData,
  CN: cnRuntime as RuntimeData
};

const BASE_ACTIVE_POOL_CHAR_SET = new Set(ACTIVE_POOL_CHARS.KR);

const catalogCache = new Map<RegionCode, HanziCatalog>();

function hashChar(char: string): number {
  let hash = 2166136261;
  for (const glyph of char) {
    hash ^= glyph.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function chooseGraphRole(stage: Stage, parentCount: number, childCount: number): GraphRole {
  if (childCount >= 8) return "hub";
  if (parentCount > 0 && childCount >= 2) return "bridge";
  if (stage >= 3 || (parentCount > 0 && childCount === 0)) return "finisher";
  return "independent";
}

function chooseCombatRole(char: string, graphRole: GraphRole): CombatRole {
  const hash = hashChar(char);
  if (graphRole === "hub") return hash % 2 === 0 ? "support" : "economy";
  if (graphRole === "finisher") return hash % 2 === 0 ? "burst" : "splash";
  const roles: readonly CombatRole[] = ["rapid", "burst", "splash", "control", "support", "economy"];
  return roles[hash % roles.length] as CombatRole;
}

function buildCombatProfile(
  char: string,
  wuxing: Wuxing,
  stage: Stage,
  role: CombatRole,
  graphRole: GraphRole,
  childCount: number,
  parents: string[],
  parentWuxing: Wuxing[]
): CombatProfile {
  const hash = hashChar(char);
  const connectivityTax = Math.min(0.26, Math.log2(childCount + 1) * 0.055);
  const deadEndCompensation = childCount === 0 ? 0.12 : 0;
  const budgetMultiplier = 1 - connectivityTax + deadEndCompensation;
  const roleDamage: Record<CombatRole, number> = { rapid: 0.76, burst: 1.42, splash: 0.93, control: 0.84, support: 0.82, economy: 0.78 };
  const roleCooldown: Record<CombatRole, number> = { rapid: 0.6, burst: 1.1, splash: 0.9, control: 0.84, support: 0.8, economy: 0.78 };
  const roleRange: Record<CombatRole, number> = { rapid: 238, burst: 226, splash: 242, control: 258, support: 264, economy: 246 };
  const style = ELEMENT_STYLES[wuxing];
  const abilities = composeAbilityLoadout({ char, wuxing, stage, role, graphRole, parents, parentWuxing });
  const activeSkills = stage > 1 || childCount === 0;
  return {
    role,
    baseDamage: (17 + (hash % 5)) * roleDamage[role],
    range: roleRange[role] + (hash % 13),
    cooldown: roleCooldown[role],
    budgetMultiplier,
    effectLabel: activeSkills ? style.effectLabel : "기본 타격",
    roleLabel: ROLE_LABELS[role],
    description: activeSkills
      ? `${abilities.semantic.name} · ${abilities.element.name} · ${abilities.role.name} · ${abilities.graph.name}`
      : `조합 가능한 1단 재료 · 기본 공격 · ${abilities.graph.name}`,
    abilities
  };
}

function descendantSet(char: string, childMap: Map<string, string[]>, memo: Map<string, Set<string>>, visiting: Set<string>): Set<string> {
  const cached = memo.get(char);
  if (cached) return cached;
  if (visiting.has(char)) return new Set();
  visiting.add(char);
  const descendants = new Set<string>();
  for (const child of childMap.get(char) ?? []) {
    descendants.add(child);
    for (const nested of descendantSet(child, childMap, memo, visiting)) descendants.add(nested);
  }
  visiting.delete(char);
  memo.set(char, descendants);
  return descendants;
}

export function getCatalog(region: RegionCode): HanziCatalog {
  const cached = catalogCache.get(region);
  if (cached) return cached;
  const runtime = RUNTIME[region];
  const runtimeChars: RuntimeCharacter[] = runtime.chars.map((entry) => ({
    ...entry,
    e: region === "KR"
      ? CHEONJAMUN_WUXING_BY_CHAR.get(entry.c) ?? CHEONJAMUN_RUNTIME_WUXING_BY_CHAR.get(entry.c) ?? entry.e
      : entry.e,
    p: [...entry.p]
  }));
  if (region === "KR") {
    const existing = new Set(runtimeChars.map((entry) => entry.c));
    for (const supplemental of CHEONJAMUN_SUPPLEMENTAL_CHARACTERS) {
      if (!existing.has(supplemental.c)) {
        runtimeChars.push({
          c: supplemental.c,
          s: supplemental.s,
          e: supplemental.e,
          a: supplemental.a,
          p: [...supplemental.p],
          r: supplemental.r
        });
      }
    }
  }
  const runtimeWuxing = new Map(runtimeChars.map((entry) => [entry.c, entry.e as Wuxing]));
  const childMap = new Map<string, string[]>();
  for (const entry of runtimeChars) {
    for (const parent of entry.p) {
      const children = childMap.get(parent) ?? [];
      children.push(entry.c);
      childMap.set(parent, children);
    }
  }
  const memo = new Map<string, Set<string>>();
  const definitions = new Map<string, HanziDefinition>();
  for (const entry of runtimeChars) {
    const stage = Math.max(1, Math.min(5, entry.s)) as Stage;
    const directChildCount = (childMap.get(entry.c) ?? []).length;
    const descendantCount = descendantSet(entry.c, childMap, memo, new Set()).size;
    const graphRole = chooseGraphRole(stage, entry.p.length, directChildCount);
    const combatRole = chooseCombatRole(entry.c, graphRole);
    const wuxing = entry.e as Wuxing;
    definitions.set(entry.c, {
      id: `${region}:${entry.c}`,
      region,
      char: entry.c,
      stage,
      acquisition: entry.a === "C" ? "craft" : "direct",
      wuxing,
      parents: [...entry.p],
      needsReview: entry.r === 1,
      graph: {
        directChildCount,
        descendantCount,
        connectivityScore: directChildCount + Math.sqrt(descendantCount),
        graphRole
      },
      combat: buildCombatProfile(
        entry.c,
        wuxing,
        stage,
        combatRole,
        graphRole,
        directChildCount,
        entry.p,
        entry.p.map((parent) => runtimeWuxing.get(parent)).filter((element): element is Wuxing => Boolean(element))
      )
    });
  }
  const recipes = [...definitions.values()].filter((definition) => definition.acquisition === "craft" && definition.parents.length > 0);
  const activePoolCharacters = region === "KR"
    ? [...new Set([...ACTIVE_POOL_CHARS.KR, ...CHEONJAMUN_RUNTIME_JARYEONGS.map((entry) => entry.hanja)])]
    : ACTIVE_POOL_CHARS[region];
  const activePool = activePoolCharacters
    .map((char) => definitions.get(char))
    .filter((definition): definition is HanziDefinition => Boolean(definition));
  const goalOrder = GOAL_ORDER[region].filter((char) => definitions.has(char));
  const catalog: HanziCatalog = {
    region,
    title: REGION_META[region].title,
    scope: definitions.size,
    definitions,
    recipes,
    activePool,
    goalOrder
  };
  catalogCache.set(region, catalog);
  return catalog;
}

export function activePoolBaseWeight(region: RegionCode, char: string): number {
  if (region === "KR" && CHEONJAMUN_RUNTIME_JARYEONG_CHARS.has(char) && !BASE_ACTIVE_POOL_CHAR_SET.has(char)) {
    return GAME_CONFIG.expansionPoolWeight;
  }
  return 1;
}

export function definitionForTower(catalog: HanziCatalog, definitionId: string): HanziDefinition {
  const char = definitionId.slice(definitionId.indexOf(":") + 1);
  const definition = catalog.definitions.get(char);
  if (!definition) throw new Error(`Unknown regional character: ${definitionId}`);
  return definition;
}

export function summonCost(summonCount: number): number {
  return Math.min(24, 7 + Math.floor(Math.max(0, summonCount) / 12));
}

/**
 * 상점 소환 상품의 기본가 가산분.
 *
 * 확률 보정은 공짜가 아니다. 목적 소환은 기본가 위에 정찰료를 얹어
 * "무엇을 노리는가"가 곧 지출 판단이 되도록 한다. 균형 소환만 0이며
 * 10연 소환은 균형가를 그대로 쓴다(`multiSummonCost`).
 */
export const SUMMON_SURCHARGE: Readonly<Record<SummonIntent, number>> = Object.freeze({
  balanced: 0,
  discovery: 2,
  lineage: 3,
  concentration: 2,
  midstar: 5,
  highstar: 12
});

export const SUMMON_INTENT_LABELS: Readonly<Record<SummonIntent, string>> = Object.freeze({
  balanced: "기본",
  discovery: "탐색",
  lineage: "계보",
  concentration: "중복",
  midstar: "중급",
  highstar: "고급"
});

/**
 * 캐주얼 소환의 별 밴드 `[하한, 상한]`. 하한은 하드 필터(밑의 별은 아예
 * 나오지 않는다 — 티어 "N★ 확정" 광고의 근거), 상한은 소프트다 — 상한 위
 * 별도 `CASUAL_STAR_TAIL_DECAY` 의 가파른 꼬리 확률로 8★까지 나온다.
 *
 * 기본 계열은 "주로 1~3★"이다 — 상위 별의 정공법은 3기 조합이고, 하한을
 * 올려 파는 중급·고급이 그 지름길이라는 루프는 그대로다. 꼬리는 잭팟의
 * 손맛일 뿐 경로가 아니다(원 기획: 별이 오를수록 확률이 확 떨어짐).
 * 실제 적용 밴드는 지역 풀 크기에 따라 `GameEngine.summonStarBand()`가 조정한다.
 */
export const SUMMON_STAR_BANDS: Readonly<Record<SummonIntent, readonly [number, number] | null>> = Object.freeze({
  balanced: [1, 3],
  discovery: [1, 3],
  lineage: null,
  concentration: [1, 3],
  midstar: [2, 5],
  highstar: [3, 8]
});

// 밴드 안 감쇠(CASUAL_STAR_DECAY)와 상한 위 꼬리 감쇠(CASUAL_STAR_TAIL_DECAY)는
// 다른 조율 상수들과 함께 engine-tuning.ts 에 있다.

/** 하한을 문구로 광고하는 티어 소환인가(= 밴드 하한이 1보다 큰가). */
export function isTierSummonIntent(intent: SummonIntent): boolean {
  const band = SUMMON_STAR_BANDS[intent];
  return band !== null && band[0] > 1;
}

/**
 * 티어 밴드가 성립하려면 후보가 이만큼은 남아야 한다.
 * JP·CN 처럼 활성 풀이 좁은 지역에서 같은 글자 서너 개만 반복되는 것을 막는다.
 */
export const MIN_TIER_POOL_SIZE = 30;

/** 같은 (오행, 별) 묶음을 1~2기 들고 있을 때 후보 가중치 배수. */
export const CASUAL_PAIR_WEIGHT = 2.2;

/** 상품 카드에 표시하고 실제로 청구하는 1회 소환가. */
export function summonProductCost(summonCount: number, intent: SummonIntent): number {
  return summonCost(summonCount) + SUMMON_SURCHARGE[intent];
}

export function multiSummonCost(summonCount: number, amount = 10): number {
  return Array.from({ length: Math.max(0, amount) }, (_, index) => summonCost(summonCount + index))
    .reduce((total, cost) => total + cost, 0);
}

export const MAX_UPGRADE_LEVEL = 99;
export const UPGRADE_STAT_ORDER: readonly UpgradeStat[] = ["damage", "attackSpeed", "range", "abilityPower", "statusPower"];

export interface UpgradeStatMeta {
  label: string;
  glyph: string;
  description: string;
  globalPerLevel: number;
  elementPerLevel: number;
  globalBaseCost: number;
  globalCostGrowth: number;
}

export const UPGRADE_STAT_META: Record<UpgradeStat, UpgradeStatMeta> = {
  damage: { label: "공격력", glyph: "攻", description: "기본 공격과 공격 기반 피해", globalPerLevel: 0.0125, elementPerLevel: 0.018, globalBaseCost: 16, globalCostGrowth: 3 },
  attackSpeed: { label: "공격 속도", glyph: "速", description: "공격 대기시간을 완만하게 단축", globalPerLevel: 0.006, elementPerLevel: 0.008, globalBaseCost: 18, globalCostGrowth: 4 },
  range: { label: "사거리", glyph: "遠", description: "공격 가능 반경", globalPerLevel: 1.25, elementPerLevel: 1.5, globalBaseCost: 12, globalCostGrowth: 3 },
  abilityPower: { label: "능력 위력", glyph: "術", description: "광역·연쇄·독·추가타 피해", globalPerLevel: 0.0125, elementPerLevel: 0.018, globalBaseCost: 20, globalCostGrowth: 4 },
  statusPower: { label: "효과 지속", glyph: "持", description: "감속·봉쇄·독 지속시간", globalPerLevel: 0.01, elementPerLevel: 0.014, globalBaseCost: 15, globalCostGrowth: 3 }
};

/**
 * FB7-강화: "강화 효율이 초반에만 좋다"에 대한 이정표 곡선.
 *
 * 보너스는 단계당 선형(+1.25%p 등)인데 비용은 2차로 체증해 후반 1단계의
 * 가성비가 계속 나빠졌다. 10단계 이정표에 도달할 때마다 4단계치 보너스를
 * 더 얹는다 — 공용 공격력 기준 정확히 +5%p 다. 값 자체는 스탯별 단가
 * (perLevel × 4)로 계산하므로 사거리 같은 비백분율 스탯에도 같은 규칙이 선다.
 */
export const UPGRADE_MILESTONE_INTERVAL = 10;
export const UPGRADE_MILESTONE_LEVEL_BONUS = 4;

/** 이정표 가산을 포함한 실효 단계 수. 보너스 = perLevel × 실효 단계. */
export function upgradeEffectiveLevels(level: number): number {
  const safeLevel = Math.max(0, Math.floor(level));
  return safeLevel + Math.floor(safeLevel / UPGRADE_MILESTONE_INTERVAL) * UPGRADE_MILESTONE_LEVEL_BONUS;
}

/** 이 단계까지 지나온 10단계 이정표 수. 강화 버튼 표기가 함께 쓴다. */
export function upgradeMilestoneCount(level: number): number {
  return Math.floor(Math.max(0, Math.floor(level)) / UPGRADE_MILESTONE_INTERVAL);
}

export function globalUpgradeCost(stat: UpgradeStat, level: number): number {
  if (level >= MAX_UPGRADE_LEVEL) return 0;
  const meta = UPGRADE_STAT_META[stat];
  const safeLevel = Math.max(0, Math.floor(level));
  // FB7-강화: 2차항을 /12 → /20 으로 완화해 중·후반 단계 단가를 낮춘다.
  return meta.globalBaseCost + meta.globalCostGrowth * safeLevel + Math.floor(safeLevel * safeLevel / 20);
}

export function elementUpgradeCost(level: number): number {
  return level >= MAX_UPGRADE_LEVEL ? 0 : 1 + Math.floor(Math.max(0, level) / 6);
}

export function researchCost(level: number): number {
  return [40, 70, 110, 160, 220][Math.max(0, Math.floor(level))] ?? 0;
}

export const RESEARCH_UNLOCK_WAVES = Object.freeze([10, 25, 45, 65, 85] as const);

export function researchUnlockWave(level: number): number {
  return RESEARCH_UNLOCK_WAVES[Math.max(0, Math.floor(level))] ?? Number.POSITIVE_INFINITY;
}

export const SUMMON_STAGE_UNLOCK_WAVES: Readonly<Record<Stage, number>> = Object.freeze({
  1: 0,
  2: 10,
  3: 30,
  4: 50,
  5: 70
});

export function summonStageUnlockWave(stage: Stage): number {
  return SUMMON_STAGE_UNLOCK_WAVES[stage];
}

export function maxSummonStageForWave(wave: number): Stage {
  if (wave >= SUMMON_STAGE_UNLOCK_WAVES[5]) return 5;
  if (wave >= SUMMON_STAGE_UNLOCK_WAVES[4]) return 4;
  if (wave >= SUMMON_STAGE_UNLOCK_WAVES[3]) return 3;
  if (wave >= SUMMON_STAGE_UNLOCK_WAVES[2]) return 2;
  return 1;
}

export function goalRewardForWave(wave: number): number {
  const chapter = Math.max(0, Math.min(10, Math.ceil(Math.max(0, wave) / 10)));
  return GAME_CONFIG.goalReward + chapter * GAME_CONFIG.goalRewardPerChapter;
}

export function researchConnectionBonus(level: number): number {
  return 0.12 + level * 0.11;
}

export function sellValue(stage: Stage): number {
  return [0, 4, 11, 25, 54, 115][stage] as number;
}

export function generatedBy(wuxing: Wuxing): Wuxing {
  const cycle: Record<Wuxing, Wuxing> = { 水: "木", 木: "火", 火: "土", 土: "金", 金: "水" };
  return cycle[wuxing];
}

export function generatorOf(wuxing: Wuxing): Wuxing {
  const reverse: Record<Wuxing, Wuxing> = { 木: "水", 火: "木", 土: "火", 金: "土", 水: "金" };
  return reverse[wuxing];
}
