import krRuntime from "../../handoff_source/data/KR_1000.prelim.runtime.json";
import jpRuntime from "../../handoff_source/data/JP_2136.prelim.runtime.json";
import cnRuntime from "../../handoff_source/data/CN_3500.prelim.runtime.json";
import { composeAbilityLoadout } from "./abilities";
import {
  CHEONJAMUN_JARYEONG_CHARS,
  CHEONJAMUN_JARYEONG_ROSTER,
  CHEONJAMUN_SUPPLEMENTAL_CHARACTERS,
  CHEONJAMUN_WUXING_BY_CHAR
} from "./cheonjamun-roster";
import type {
  CombatProfile,
  CombatRole,
  ElementKind,
  GraphRole,
  HanziCatalog,
  HanziDefinition,
  RegionCode,
  Stage,
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
  maxWaves: 20,
  prepSeconds: 8,
  goalReward: 28,
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
  const roleCooldown: Record<CombatRole, number> = { rapid: 0.55, burst: 1.02, splash: 0.82, control: 0.76, support: 0.72, economy: 0.7 };
  const roleRange: Record<CombatRole, number> = { rapid: 238, burst: 226, splash: 242, control: 258, support: 264, economy: 246 };
  const style = ELEMENT_STYLES[wuxing];
  const abilities = composeAbilityLoadout({ char, wuxing, stage, role, graphRole, parents, parentWuxing });
  return {
    role,
    baseDamage: (17 + (hash % 5)) * roleDamage[role],
    range: roleRange[role] + (hash % 13),
    cooldown: roleCooldown[role],
    budgetMultiplier,
    effectLabel: style.effectLabel,
    roleLabel: ROLE_LABELS[role],
    description: `${abilities.semantic.name} · ${abilities.element.name} · ${abilities.role.name} · ${abilities.graph.name}`,
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
    e: region === "KR" ? CHEONJAMUN_WUXING_BY_CHAR.get(entry.c) ?? entry.e : entry.e,
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
    ? [...new Set([...ACTIVE_POOL_CHARS.KR, ...CHEONJAMUN_JARYEONG_ROSTER.map((entry) => entry.hanja)])]
    : ACTIVE_POOL_CHARS[region];
  const activePool = activePoolCharacters
    .map((char) => definitions.get(char))
    .filter((definition): definition is HanziDefinition => Boolean(definition?.acquisition === "direct" && definition.stage === 1));
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
  if (region === "KR" && CHEONJAMUN_JARYEONG_CHARS.has(char) && !BASE_ACTIVE_POOL_CHAR_SET.has(char)) {
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
  return Math.min(12, 6 + Math.floor(summonCount / 20));
}

export function multiSummonCost(summonCount: number, amount = 10): number {
  return Array.from({ length: Math.max(0, amount) }, (_, index) => summonCost(summonCount + index))
    .reduce((total, cost) => total + cost, 0);
}

export const MAX_ELEMENT_UPGRADE_LEVEL = 5;
export const ELEMENT_UPGRADE_DAMAGE_PER_LEVEL = 0.08;

export function elementUpgradeCost(level: number): number {
  return level >= MAX_ELEMENT_UPGRADE_LEVEL ? 0 : 24 + Math.max(0, level) * 18;
}

export function researchCost(level: number): number {
  return level >= 5 ? 0 : 32 + level * 22;
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
