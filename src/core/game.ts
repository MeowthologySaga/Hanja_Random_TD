import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  CELLS_PER_FORMATION,
  FORMATION_COLUMNS,
  FORMATION_ROWS,
  INITIAL_UNLOCKED_FORMATIONS,
  MAX_ENEMIES,
  SUMMON_CELL_ORDER,
  WAVE_REINFORCEMENT_DELAY,
  bossHpFactorForWave,
  bossTimeLimitForWave,
  isBoardCellUnlocked,
  isFormationUnlocked,
  nextFormationUnlockCost,
  positionOnPath,
  spawnProgressForEnemy,
  unlockedTowerCapacity,
  waveClearReward,
  wavePlan
} from "./content";
import { hasActiveSkills } from "./abilities";
// [SKILL-V1] 스킬 1차 세트 상수·순수 계산.
import {
  FROST_ZONE_DURATION,
  FROST_ZONE_RADIUS,
  GWICHEON_ABILITY,
  GWICHEON_MIN_STAR,
  GWICHEON_RUSH_THRESHOLD,
  MOMENTUM_STACK_BONUS,
  WARFARE_BRAND_DURATION,
  frostSlowRatio,
  gwicheonChargeSeconds,
  idiomBlessingBonus,
  momentumMaxStacks,
  warfareBrandPower
} from "./abilities";
import {
  CASUAL_POLARIS_AURA,
  CASUAL_SPLASH_STAR_SCALE,
  CASUAL_STAR_HASTE_PER_STAR,
  CASUAL_STAR_POWER,
  CASUAL_STAR_RANGE,
  casualNaturalStar,
  casualStrokeCount
} from "./casual";
import { EvolutionService } from "./evolution";
import {
  ELEMENT_TRAIT_MAX_LEVEL,
  dismantleScoreForStage,
  elementTraitExtraChainTargets,
  elementTraitUnlockScore,
  elementTraitUpgradeCost,
  emptyElementTraitLevels
} from "./growth";
import {
  findIdiomPath,
  featuredIdiomsForRun,
  helpfulDirectCharsForIdiom,
  idiomById,
  idiomDirectPoolChars,
  idiomsForRegion
} from "./idioms";
import {
  ELEMENT_STYLES,
  GAME_CONFIG,
  MAX_UPGRADE_LEVEL,
  STAGE_MULTIPLIERS,
  UPGRADE_STAT_ORDER,
  UPGRADE_STAT_META,
  activePoolBaseWeight,
  definitionForTower,
  globalUpgradeCost,
  generatorOf,
  getCatalog,
  elementUpgradeCost,
  goalRewardForWave,
  maxSummonStageForWave,
  multiSummonCost,
  researchConnectionBonus,
  researchCost,
  researchUnlockWave,
  sellValue,
  CASUAL_PAIR_WEIGHT,
  CASUAL_STAR_DECAY,
  isTierSummonIntent,
  MIN_TIER_POOL_SIZE,
  SUMMON_INTENT_LABELS,
  SUMMON_STAR_BANDS,
  SUMMON_SURCHARGE,
  summonCost,
  upgradeEffectiveLevels,
  WUXING_ORDER
} from "./hanzi";
import { SeededRng } from "./rng";
import type {
  ActionResult,
  AutomationMode,
  CombatRole,
  CompositionBranchPreview,
  ConcentrationLevel,
  ConcentrationPayment,
  ConcentrationPath,
  DefeatCause,
  Enemy,
  EvolutionOption,
  GameEvent,
  GameState,
  GoalProgress,
  HanziCatalog,
  HanziDefinition,
  AbilitySpec,
  AbilityZone,
  CasualStar,
  GameMode,
  Point,
  RegionCode,
  SimulationCheckpoint,
  SimulationResult,
  Stage,
  SummonIntent,
  StatUpgradeLevels,
  Tower,
  UpgradeStat,
  WavePlan,
  Wuxing
} from "./types";
import type { IdiomDefinition } from "./idioms";
import type { IdiomBonusKind, IdiomSeal } from "./types";

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const ELEMENT_ZONE_SPECS: Record<Wuxing, { kind: AbilityZone["kind"]; label: string; damageRatio: number; radius: number; duration: number }> = {
  木: { kind: "roots", label: "가시뿌리밭", damageRatio: 0.29, radius: 112, duration: 5.4 },
  火: { kind: "lava", label: "용암화염지대", damageRatio: 0.5, radius: 105, duration: 4.8 },
  土: { kind: "quicksand", label: "유사진흙지대", damageRatio: 0.24, radius: 125, duration: 5.8 },
  金: { kind: "caltrops", label: "쇠압정지대", damageRatio: 0.4, radius: 108, duration: 5.1 },
  水: { kind: "rain", label: "비구름냉우", damageRatio: 0.34, radius: 120, duration: 5.6 }
};

export function elementZoneKind(wuxing: Wuxing): AbilityZone["kind"] {
  return ELEMENT_ZONE_SPECS[wuxing].kind;
}

/**
 * 캐주얼 티어 소환 3종. 별 밴드만 다르고 나머지 규칙은 같으므로
 * 짝 맞추기 가중은 이 셋에 공통으로 적용한다.
 */
const TIERED_SUMMON_INTENTS: ReadonlySet<SummonIntent> = new Set<SummonIntent>(["balanced", "midstar", "highstar"]);

/** 캐주얼 소환의 실효 별 밴드. 상·하한 모두 포함하는 닫힌 구간이다. */
export interface SummonStarBand {
  readonly min: number;
  readonly max: number;
}

export function interestForGold(gold: number): number {
  return Math.min(20, Math.max(0, Math.floor(gold / 20)));
}

function emptyStatUpgrades(): StatUpgradeLevels {
  return { damage: 0, attackSpeed: 0, range: 0, abilityPower: 0, statusPower: 0 };
}

function emptyElementUpgrades(): Record<Wuxing, StatUpgradeLevels> {
  return {
    "木": emptyStatUpgrades(),
    "火": emptyStatUpgrades(),
    "土": emptyStatUpgrades(),
    "金": emptyStatUpgrades(),
    "水": emptyStatUpgrades()
  };
}

function emptyElementEssence(): Record<Wuxing, number> {
  return { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
}

function sumElementValues(values: Record<Wuxing, number>): number {
  return values.木 + values.火 + values.土 + values.金 + values.水;
}

export const MAX_CONCENTRATION_LEVEL: ConcentrationLevel = 3;
export const FIRST_PREP_SECONDS = 15;

/**
 * 수술 8 ⓑ 「개문 보정」: 1~3웨이브 한정, 시작 진의 자령 사거리 +45.
 *
 * 경로 기하 실측: 사거리 235 이하에서는 외곽 진(수·금·목·화)이 반대편 포탈
 * 출신 적을 최장 16.2초 기다리지만, 250 을 넘기면 3.6초로 무너진다. +45 는
 * 별 사거리 곡선 도입 후 가장 좁은 1★ 진(실효 208)도 그 문턱(253) 위에
 * 올린다. 1장 수호(피해 ×1.15, ~10웨이브)와 같은 정신의 초반 완충 장치로,
 * 무작위 첫 진의 재미는 그대로 두고 "다 돌 때까지 기다림"만 걷어 낸다.
 */
export const GATE_OPENING_WARD = Object.freeze({ untilWave: 3, rangeBonus: 45 });
const SUMMON_STAGE_WEIGHTS: Record<Stage, number> = { 1: 1, 2: 0.22, 3: 0.075, 4: 0.025, 5: 0.008 };
/*
 * 문기 농축은 "비싼 대체 지불"이다. 원래 설계는 중복 자령을 재료로 쓰는
 * 것인데(중복 소환 카드의 존재 이유), 문기가 4/6/8로 싸니 아무도 중복을
 * 쓰지 않았다. 값을 올려 중복이 기본, 문기가 급할 때의 우회가 되게 한다.
 */
const CONCENTRATION_ESSENCE_COSTS = [10, 16, 24] as const;
/*
 * 분해 환급은 지불 방식과 무관하게 농축 단계만 보고 지급된다. 환급을
 * 인상된 비용표로 계산하면 [중복으로 싸게 농축 → 분해] 가 문기 조폐가
 * 되므로, 환급 기준표는 예전 값에 고정한다.
 */
const CONCENTRATION_ESSENCE_REFUND_BASE = [4, 6, 8] as const;

export function concentrationEssenceCost(currentLevel: number): number {
  return CONCENTRATION_ESSENCE_COSTS[Math.max(0, Math.min(2, currentLevel))] ?? 24;
}

/**
 * 농축 방향은 더 이상 사람이 고르지 않는다 — 역할이 곧 방향이다.
 *
 * 두 갈래(swift=공속 / potent=피해)는 밸런스 상수로 남지만, 무엇을 고를지는
 * 이미 정답이 있었다: 초당 타수로 먹고사는 연사·지원은 공속, 한 방으로 먹고사는
 * 나머지는 피해. 자동 배치 경로가 쓰던 규칙을 그대로 승격시켜 수동 경로와
 * 하나로 합친다. 이미 방향이 박힌 자령은 기존 세이브와의 일관성을 위해
 * 그 방향을 그대로 유지한다.
 */
export function autoConcentrationPath(tower: {
  combatRole: CombatRole;
  concentrationPath?: ConcentrationPath | null;
}): ConcentrationPath {
  if (tower.concentrationPath) return tower.concentrationPath;
  return tower.combatRole === "rapid" || tower.combatRole === "support" ? "swift" : "potent";
}

/** 화면 어디서나 같은 어휘를 쓰도록 방향 이름을 한곳에서 정한다. */
export function concentrationPathLabel(path: ConcentrationPath): string {
  return path === "swift" ? "공속 농축" : "피해 농축";
}

export function concentrationEssenceRefund(level: number): number {
  return Math.floor(CONCENTRATION_ESSENCE_REFUND_BASE.slice(0, Math.max(0, Math.min(3, level))).reduce((sum, cost) => sum + cost, 0) * 0.7);
}

export function dismantleEssenceValue(stage: Stage, concentration = 0): number {
  return Math.max(1, stage * stage + concentrationEssenceRefund(concentration));
}

/**
 * 별승급 진법의 분해 표. 별 하나가 문기 몇 개인가.
 *
 * 자형연성의 `단계²`(1/4/9/16/25)와 달리 별승급은 8칸이라 곡선을 따로 둔다.
 * 3체 승급이 잉여 자령을 전부 먹어 분해할 것이 남지 않으므로, 이 표는
 * 분해뿐 아니라 승급 환급(`casualFusionEssenceRefund`)의 기준이기도 하다.
 */
const CASUAL_DISMANTLE_ESSENCE: readonly number[] = Object.freeze([0, 1, 1, 2, 3, 5, 7, 10, 14]);
const CASUAL_DISMANTLE_SCORE: readonly number[] = Object.freeze([0, 1, 1, 3, 3, 6, 6, 10, 15]);

export function casualDismantleEssence(star: number): number {
  return CASUAL_DISMANTLE_ESSENCE[Math.max(0, Math.min(8, Math.floor(star)))] ?? 1;
}

export function casualDismantleScore(star: number): number {
  return CASUAL_DISMANTLE_SCORE[Math.max(0, Math.min(8, Math.floor(star)))] ?? 1;
}

/**
 * 삼체일득 — 사라진 셋 가운데 한 몫은 문기로 남는다.
 *
 * 별승급 진법에서 문기의 유일한 입구는 분해였는데, 3체 승급이 잉여 자령을 전부
 * 먹어 분해 대기열이 비어 버렸다(실측 분해 0~4기·문기 0~6/런). 승급 자체를
 * 문기 입구로 삼아 두 루프의 재료 경쟁을 없앤다. 돌려주는 양은 소모한 별
 * 1기의 분해값이므로 "셋 중 하나만큼은 되찾는다"가 규칙 문장 그대로다.
 */
export function casualFusionEssenceRefund(fromStar: number): number {
  return casualDismantleEssence(fromStar);
}

export function casualFusionDismantleScore(fromStar: number): number {
  return casualDismantleScore(fromStar);
}

export interface CleanupAssessment {
  towerId: number;
  protected: boolean;
  score: number;
  reasons: string[];
  protectedReasons: string[];
  /** 이 한자를 이 1기만 갖고 있다. 보호를 껐을 때도 배지로 남겨야 한다. */
  soleCopy: boolean;
}

/**
 * 분해 경로만의 예외.
 *
 * "유일 보유 한자"는 초보자를 지키는 규칙이지만, 문기를 모으려는 숙련자에게는
 * 인벤토리 절반을 잠가 버리는 벽이었다. 이 플래그를 끄면 유일 자령도 후보에
 * 들어온다 — 잠금·농축·전장 공명 등 나머지 보호는 그대로다. 캐주얼 3체 조합의
 * 유일 보호는 이 플래그와 무관하다.
 */
export interface CleanupOptions {
  protectUnique?: boolean;
}

export interface DismantleQuote {
  ids: number[];
  gains: Record<Wuxing, number>;
  scoreGains: Record<Wuxing, number>;
  blocked: Array<{ towerId: number; reason: string }>;
}

export interface UpgradeQuote {
  fromLevel: number;
  toLevel: number;
  levels: number;
  cost: number;
  affordable: boolean;
}

export interface ConcentrationCombatSnapshot {
  damage: number;
  attacksPerSecond: number;
  range: number;
  abilityEffect: number;
}

export interface ConcentrationQuote {
  targetId: number;
  path: ConcentrationPath;
  currentLevel: ConcentrationLevel;
  nextLevel: ConcentrationLevel;
  essenceCost: number;
  duplicateIds: number[];
  current: ConcentrationCombatSnapshot;
  next: ConcentrationCombatSnapshot;
}

// 경고의 성격을 문자열이 아니라 종류로 남긴다. 자동 경로가 "무엇을 건너뛸지"를
// 문안 매칭이 아니라 종류로 판정할 수 있어야 문구를 고쳐도 규칙이 흔들리지 않는다.
export type CasualFusionIssueKind =
  | "deployed"   // 전장에 세워 둔 자령 — 수비 공백이 생긴다
  | "resonance"  // 오행진 공명 임계치가 깨진다
  | "protected"  // 잠금·농축·목표·성어·합성식 — v3 에서는 아예 선정 불가
  | "pool";      // 이 오행에 더 높은 별 글자가 없다

export interface CasualFusionIssue {
  towerId: number | null;
  text: string;
  kind?: CasualFusionIssueKind;
}

/**
 * 3기를 소모하고 나서 "무엇을 뽑을 수 있는가". 별 사다리(star+1 → +2 …)를
 * 훑어 처음으로 비어 있지 않은 칸을 결과 풀로 삼는다.
 */
export interface CasualResultPool {
  star: CasualStar;
  candidates: readonly HanziDefinition[];
  /** star+1 이 비어 상위 별로 건너뛰었는가 */
  starFallback: boolean;
  /** 이번 런 소환 풀에 후보가 없어 지역 로스터까지 넓혔는가 */
  rosterFallback: boolean;
}

export interface CasualFusionQuote {
  /** 소모될 3기. v3 에는 남는 본체가 없다. */
  materialIds: number[];
  fromStar: CasualStar | null;
  toStar: CasualStar | null;
  wuxing: Wuxing | null;
  /** 결과 무작위 후보 수 */
  poolSize: number;
  starFallback: boolean;
  rosterFallback: boolean;
  blocked: CasualFusionIssue[];
  warnings: CasualFusionIssue[];
}

export interface CasualAutoFusionGroup {
  wuxing: Wuxing;
  materialIds: [number, number, number];
  fromStar: CasualStar;
  toStar: CasualStar;
  poolSize: number;
  starFallback: boolean;
  rosterFallback: boolean;
  warnings: CasualFusionIssue[];
  /** 확인 없이 실행하는 원클릭 경로가 스스로 건너뛸 사유. null 이면 즉시 실행 대상. */
  autoSkipReason: string | null;
}

export interface CasualFusionGain {
  wuxing: Wuxing;
  char: string;
  star: CasualStar;
  cell: number;
  newDiscovery: boolean;
}

export interface CasualFusionResult extends ActionResult {
  gained: CasualFusionGain | null;
  consumedChars: string[];
  fromStar: CasualStar | null;
  starFallback: boolean;
  rosterFallback: boolean;
}

export interface CasualAutoFusionReport extends ActionResult {
  fused: number;
  consumed: number;
  skipped: number;
  skipReason: string | null;
  gained: CasualFusionGain[];
  firstFusion: {
    wuxing: Wuxing;
    char: string;
    fromStar: CasualStar;
    toStar: CasualStar;
    consumedChars: string[];
    newDiscovery: boolean;
    starFallback: boolean;
    rosterFallback: boolean;
  } | null;
}

// v3 규칙: 3기가 전부 사라지고 같은 오행의 다음 별 글자 하나를 새로 얻는다.
// 잠금·농축·목표 계보·미완 성어·봉인 성어·일반 합성식 자령은 애초에 3기 어디에도
// 선정되지 않으므로(casualMaterialProtection) 경고가 아니라 차단 사유다.
// `전장 배치` 는 막지 않는다 — 뽑기 후 자동 배치가 기본이라 사실상 모든 자령이
// 전장에 서 있고, 이것을 막으면 [한 번에 승급]이 아무 일도 못 한다. 대신 소모
// 내역과 `전장 N기 소모` 배지로 무엇이 사라지는지 먼저 보여 준다.
// 되돌릴 수 없는 판 손실은 오행진 공명 임계치가 깨지는 경우 하나뿐이다.
const CASUAL_AUTO_SKIP_KINDS = new Set<CasualFusionIssueKind>(["resonance"]);

function casualAutoSkipReason(warnings: readonly CasualFusionIssue[]): string | null {
  return warnings.find((warning) => warning.kind !== undefined && CASUAL_AUTO_SKIP_KINDS.has(warning.kind))?.text ?? null;
}

/** `火 2★×3 → 3★ 炎 획득!` — 폴백이 있었으면 그대로 덧붙인다. */
function casualFusionHeadline(info: {
  wuxing: Wuxing;
  char: string;
  fromStar: CasualStar;
  toStar: CasualStar;
  newDiscovery: boolean;
  starFallback: boolean;
  rosterFallback: boolean;
}): string {
  const notes: string[] = [];
  if (info.newDiscovery) notes.push("첫 발견!");
  if (info.starFallback) notes.push(`${info.fromStar + 1}★ 글자가 없어 ${info.toStar}★에서 뽑음`);
  if (info.rosterFallback) notes.push("소환 풀에 없어 지역 로스터에서 보충");
  return `${info.wuxing} ${info.fromStar}★×3 → ${info.toStar}★ ${info.char} 획득!${notes.length > 0 ? ` · ${notes.join(" · ")}` : ""}`;
}

/**
 * (오행, 자연 별) → 글자 목록 색인. 소환 풀은 런마다 새 배열로 다시 만들어지고
 * 지역 로스터는 카탈로그 캐시라 둘 다 참조를 키로 삼는 WeakMap 이면 충분하다.
 */
const casualStarIndexCache = new WeakMap<object, Map<string, HanziDefinition[]>>();

function casualStarIndexFor(key: object, definitions: Iterable<HanziDefinition>): Map<string, HanziDefinition[]> {
  const cached = casualStarIndexCache.get(key);
  if (cached) return cached;
  const index = new Map<string, HanziDefinition[]>();
  for (const definition of definitions) {
    const star = casualNaturalStar(definition.char);
    if (star === null) continue;
    const bucket = `${definition.wuxing}:${star}`;
    const list = index.get(bucket);
    if (list) list.push(definition);
    else index.set(bucket, [definition]);
  }
  casualStarIndexCache.set(key, index);
  return index;
}

const REGION_ENEMY_HP_CURVE: Record<RegionCode, { base: number; chapterGrowth: number }> = {
  // Five 4x4 elemental formations expose eighty active tower positions.
  // The 80-slot field produces far more sustained fire than the former 20-slot
  // board. JP/CN recipe graphs complete substantially more evolutions, so their
  // durability rises by chapter instead of front-loading a punishing wave-10
  // multiplier. This preserves the opening tutorial curve and checks late snowball.
  //
  // 수술 1 재보정(2026-08): 유지형 성어를 지키는 봇 + 강화 이정표·8성 오라·
  // 광역 별스케일 도입 뒤 세 지역을 45런/지역 시뮬로 승률 0.467~0.578 에
  // 맞춘 값. 승률은 이 계수에 극도로 민감하다(±1% 체력 ≈ ±5~20%p) —
  // 손보려면 반드시 --runs=135 로 재고정하라.
  KR: { base: 25.25, chapterGrowth: 0 },
  JP: { base: 23.4, chapterGrowth: 0.92 },
  CN: { base: 23.4, chapterGrowth: 0.67 }
};

/**
 * 수술 1(FB5): 모드별 적 체력 계수.
 *
 * "별승급(8성)이랑 다른 모드 난이도가 너무 다르다"는 피드백. 기준점은 메인
 * 모드인 별승급(캐주얼)이며, 두 모드 모두 자동 시뮬 승률 45~60% 밴드로
 * 수렴하도록 이 계수만 조정한다 — 웨이브 구성·규칙은 그대로다.
 */
const MODE_ENEMY_HP_SCALE: Record<GameMode, number> = { standard: 1, casual: 2.56 };

// The center formation overlaps more of the loop than the east formation.
// These small route-coverage coefficients make "which element appeared first"
// a build choice rather than a hidden map-position difficulty roll. Once all
// five formations are open their bonuses nearly cancel out.
const FORMATION_ROUTE_COVERAGE_MULTIPLIER = Object.freeze([0.995, 0.995, 0.95, 1.05, 1.01] as const);

function regionEnemyHpMultiplier(region: RegionCode, wave: number, mode: GameMode): number {
  const curve = REGION_ENEMY_HP_CURVE[region];
  const completedChapters = Math.max(0, Math.floor((wave - 1) / 10));
  const regional = curve.base + completedChapters * curve.chapterGrowth;
  return regional * MODE_ENEMY_HP_SCALE[mode];
}

/**
 * F2: 별승급(캐주얼) 목표는 "뽑을 수 있는 글자"여야 한다.
 *
 * 지역 목표(GOAL_ORDER)는 자형연성 합성 계보 기준이라 JP/CN 미리보기 소환
 * 풀(30·32자) 밖의 글자가 섞여 있고, 캐주얼에는 합성이 없어 그 목표는 원리적으로
 * 달성 불가였다. 데이터는 손대지 않고 선정 로직만 좁힌다 — 풀 안 목표를
 * 순서대로 남기고, 모자라면 활성 풀에서 2★ 이상 글자를 별 오름차순(같은 별은
 * 획수순)으로 채워 "뽑고 승급해서 도달하는" 목표 사다리를 만든다.
 */
function casualGoalOrder(catalog: HanziCatalog): readonly string[] {
  const poolChars = new Set(catalog.activePool.map((definition) => definition.char));
  const order = catalog.goalOrder.filter((char) => poolChars.has(char));
  const goalCount = Math.max(1, catalog.goalOrder.length);
  if (order.length >= goalCount) return order;
  const fallback = catalog.activePool
    .filter((definition) => !order.includes(definition.char))
    .map((definition) => ({
      char: definition.char,
      star: casualNaturalStar(definition.char) ?? 1,
      strokes: casualStrokeCount(definition.char) ?? 0
    }))
    .sort((left, right) => left.star - right.star || left.strokes - right.strokes || left.char.localeCompare(right.char));
  for (const entry of fallback) {
    if (order.length >= goalCount) break;
    if (entry.star >= 2) order.push(entry.char);
  }
  // 2★ 이상이 부족한 극소형 풀이면 1★ 라도 채워 목표 자체는 남긴다.
  for (const entry of fallback) {
    if (order.length >= goalCount) break;
    if (!order.includes(entry.char)) order.push(entry.char);
  }
  return order;
}

/*
 * 수련장(튜토리얼) 완화 계수.
 *
 * 수련장은 각본이 정한 여덟 걸음을 "반드시 이기며" 밟는 판이다. 규칙은
 * 본편 그대로 두고 적의 체력·수량만 눌러, 자령 한둘로도 첫 웨이브를
 * 확실히 넘기게 한다. 계수는 엔진 생성 옵션(tutorial)이 켜졌을 때만 쓴다.
 */
export const TUTORIAL_ENEMY_HP_SCALE = 0.4;
export const TUTORIAL_ENEMY_COUNT_SCALE = 0.5;

/** 엔진 생성 옵션. 지금은 수련장 완화·각본 지급 허용 스위치 하나뿐이다. */
export interface GameEngineOptions {
  readonly tutorial?: boolean;
}

function weightedPick(rng: SeededRng, entries: readonly HanziDefinition[], weights: readonly number[]): HanziDefinition {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.next() * total;
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll <= 0) return entries[index] as HanziDefinition;
  }
  return entries[entries.length - 1] as HanziDefinition;
}

export class GameEngine {
  readonly state: GameState;
  readonly catalog: HanziCatalog;
  readonly evolution: EvolutionService;
  /** 이 런의 목표 사다리. 표준은 지역 목표 그대로, 캐주얼은 풀 안 글자로 좁힌다(F2). */
  readonly goalOrder: readonly string[];
  /** 수련장 여부. 켜져 있을 때만 완화 계수와 tutorialGrant* 지급 훅이 산다. */
  readonly tutorial: boolean;
  private rng: SeededRng;
  private events: GameEvent[] = [];
  private nextTowerId = 1;
  private nextEnemyId = 1;
  private nextAbilityZoneId = 1;
  private currentPlan: WavePlan | null = null;
  private autoEvolutionCooldown = 0;
  private runSummonPool: readonly HanziDefinition[] = [];
  private readonly enemyPositions = new Map<number, Point>();
  private readonly targetCandidates: Enemy[] = [];
  private readonly combatCharCounts = new Map<string, number>();
  private readonly combatSynergies = new Set<Wuxing>();
  private readonly combatFormationBonuses = [0, 0, 0, 0, 0];
  // [SKILL-V1] 성어의 가호: 진별 가호 배율 캐시(발동 중 봉인 기준).
  private readonly combatIdiomBlessings = [0, 0, 0, 0, 0];
  private combatDistinctElements = 0;
  /** FB7-8성: 이번 틱에 극성 개안 오라가 살아 있는 오행. 오행당 최대 1개. */
  private readonly combatPolarisElements = new Set<Wuxing>();

  constructor(seed: string, region: RegionCode = "KR", mode: GameMode = "standard", options: GameEngineOptions = {}) {
    this.tutorial = options.tutorial === true;
    this.catalog = getCatalog(region);
    this.evolution = new EvolutionService(this.catalog);
    this.rng = new SeededRng(seed);
    this.goalOrder = mode === "casual" ? casualGoalOrder(this.catalog) : this.catalog.goalOrder;
    const targetChar = this.goalOrder[0] ?? this.catalog.activePool[0]?.char ?? "";
    this.state = {
      seed,
      region,
      mode,
      phase: "title",
      defeatCause: null,
      wave: 0,
      maxWaves: GAME_CONFIG.maxWaves,
      gold: GAME_CONFIG.startingGold,
      researchLevel: 0,
      globalUpgrades: emptyStatUpgrades(),
      elementUpgrades: emptyElementUpgrades(),
      elementTraits: emptyElementTraitLevels(),
      summonCount: 0,
      killCount: 0,
      evolutionCount: 0,
      casualFusionCount: 0,
      interestEarned: 0,
      elementEssence: emptyElementEssence(),
      elementDismantleScore: emptyElementEssence(),
      elementEssenceGenerated: emptyElementEssence(),
      elementEssenceSpent: emptyElementEssence(),
      dismantledTowerCount: 0,
      prepRemaining: FIRST_PREP_SECONDS,
      elapsed: 0,
      waveElapsed: 0,
      spawned: 0,
      spawnCooldown: 0,
      nextWaveRemaining: null,
      bossDefeated: false,
      selectedTowerId: null,
      automationMode: "semi",
      targetChar,
      goalsCompleted: [],
      idiomSeals: [],
      featuredIdiomIds: featuredIdiomsForRun(region, seed).map((idiom) => idiom.id),
      discoveredChars: [],
      softPity: 0,
      lineageClueProgress: 0,
      lineageTargetProgress: 0,
      unlockedFormations: [...INITIAL_UNLOCKED_FORMATIONS],
      startingFormationIndex: null,
      lastMessage: "지역과 목표 한자를 선택하세요.",
      autoPlaceSummons: true,
      summonIntent: "balanced",
      towers: [],
      inventoryTowers: [],
      enemies: [],
      abilityZones: []
    };
    this.runSummonPool = this.buildRunSummonPool();
  }

  begin(): void {
    this.rng = new SeededRng(this.state.seed);
    this.nextTowerId = 1;
    this.nextEnemyId = 1;
    this.nextAbilityZoneId = 1;
    this.currentPlan = null;
    this.autoEvolutionCooldown = 0;
    const targetChar = this.goalOrder[0] ?? this.catalog.activePool[0]?.char ?? "";
    Object.assign(this.state, {
      phase: "prep",
      defeatCause: null,
      wave: 0,
      gold: GAME_CONFIG.startingGold,
      researchLevel: 0,
      globalUpgrades: emptyStatUpgrades(),
      elementUpgrades: emptyElementUpgrades(),
      elementTraits: emptyElementTraitLevels(),
      summonCount: 0,
      killCount: 0,
      evolutionCount: 0,
      casualFusionCount: 0,
      interestEarned: 0,
      elementEssence: emptyElementEssence(),
      elementDismantleScore: emptyElementEssence(),
      elementEssenceGenerated: emptyElementEssence(),
      elementEssenceSpent: emptyElementEssence(),
      dismantledTowerCount: 0,
      prepRemaining: FIRST_PREP_SECONDS,
      elapsed: 0,
      waveElapsed: 0,
      spawned: 0,
      spawnCooldown: 0,
      nextWaveRemaining: null,
      bossDefeated: false,
      selectedTowerId: null,
      automationMode: "semi",
      targetChar,
      goalsCompleted: [],
      idiomSeals: [],
      featuredIdiomIds: [...this.state.featuredIdiomIds],
      discoveredChars: [],
      softPity: 0,
      lineageClueProgress: 0,
      lineageTargetProgress: 0,
      unlockedFormations: [...INITIAL_UNLOCKED_FORMATIONS],
      startingFormationIndex: null,
      lastMessage: "① 상점에서 첫 자령을 소환하세요. 준비 시간은 아직 흐르지 않습니다.",
      autoPlaceSummons: this.state.autoPlaceSummons,
      summonIntent: this.state.summonIntent,
      towers: [],
      inventoryTowers: [],
      enemies: [],
      abilityZones: []
    });
    this.runSummonPool = this.buildRunSummonPool();
    this.events = [{ type: "phase", phase: "prep" }];
  }

  update(rawDelta: number): void {
    if (this.state.phase === "title" || this.state.phase === "victory" || this.state.phase === "defeat") return;
    const delta = Math.min(0.1, Math.max(0, rawDelta));
    // The opening is a true planning state: neither the run clock nor the
    // preparation clock starts until a first Jaryeong determines the formation.
    if (this.state.phase === "prep" && this.state.summonCount === 0) return;
    this.state.elapsed += delta;
    this.autoEvolutionCooldown -= delta;
    if (this.state.mode === "standard" && this.state.automationMode === "goal" && this.autoEvolutionCooldown <= 0) {
      const option = this.availableEvolutions().find((candidate) => candidate.onTargetPath);
      if (option) this.evolve(option.recipeId);
      this.autoEvolutionCooldown = option ? 0.24 : 0.48;
    }

    if (this.state.phase === "prep") {
      this.state.prepRemaining = Math.max(0, this.state.prepRemaining - delta);
      if (this.state.prepRemaining <= 0) this.startNextWave();
      return;
    }

    this.updateCombat(delta);
  }

  private updateCombat(delta: number): void {
    const plan = this.currentPlan;
    if (!plan) return;
    this.state.waveElapsed += delta;
    this.state.spawnCooldown -= delta;

    while (this.state.spawned < plan.count && this.state.spawnCooldown <= 0) {
      this.spawnEnemy(plan);
      this.state.spawnCooldown += plan.interval;
    }

    if (this.state.enemies.length >= MAX_ENEMIES) {
      this.endRun("defeat", `적 ${MAX_ENEMIES}체가 전장을 뒤덮었습니다.`, "enemy-limit");
      return;
    }

    this.updateEnemies(delta);
    if (this.state.phase !== "combat") return;
    this.refreshCombatCache();
    this.updateAbilityZones(delta);
    if (this.state.phase !== "combat") return;
    this.updateTowers(delta);
    const bossLimit = bossTimeLimitForWave(plan.wave);
    if (bossLimit !== null && !this.state.bossDefeated && this.state.waveElapsed >= bossLimit) {
      this.endRun("defeat", `제한시간 ${bossLimit}초 안에 보스를 처치하지 못했습니다.`, "boss-timeout");
      return;
    }
    const allSpawned = this.state.spawned >= plan.count;
    const deadlineUnlocked = !plan.boss || this.state.bossDefeated;
    if (allSpawned && this.state.enemies.length === 0) {
      this.finishWave();
      return;
    }
    if (allSpawned && deadlineUnlocked) {
      // 수련장: 잔존 합류(20초 시계)를 끈다. 각본은 "다 잡으면 준비로 돌아와
      // 다음 걸음"이 전제라, 웨이브가 저절로 겹치면 지도록 설계된 판이 된다.
      if (this.tutorial) return;
      if (this.state.nextWaveRemaining === null) this.state.nextWaveRemaining = WAVE_REINFORCEMENT_DELAY;
      this.state.nextWaveRemaining = Math.max(0, this.state.nextWaveRemaining - delta);
      if (this.state.nextWaveRemaining <= 0) this.advanceWaveWithSurvivors();
    }
  }

  private spawnEnemy(plan: WavePlan): void {
    const isBoss = plan.boss && this.state.spawned === plan.count - 1;
    const bossFactor = bossHpFactorForWave(plan.wave);
    const hpJitter = 0.94 + this.rng.next() * 0.12;
    const hp = plan.hp * (isBoss || !plan.boss ? 1 : 1 / bossFactor) * hpJitter
      * regionEnemyHpMultiplier(this.state.region, this.state.wave, this.state.mode)
      * (this.tutorial ? TUTORIAL_ENEMY_HP_SCALE : 1);
    const archetype = isBoss ? "boss" : plan.boss ? "normal" : plan.archetype;
    this.state.enemies.push({
      id: this.nextEnemyId++,
      wave: plan.wave,
      hp,
      maxHp: hp,
      // Bosses keep circulating; the explicit boss clock is their deadline.
      speed: plan.speed * (isBoss ? 0.34 : 0.92 + this.rng.next() * 0.16),
      progress: spawnProgressForEnemy(this.state.spawned),
      reward: isBoss ? plan.reward : plan.boss ? 1 + Math.floor((plan.wave - 1) / 25) : plan.reward,
      boss: isBoss,
      archetype,
      weakness: plan.weakness,
      armor: isBoss || !plan.boss ? plan.armor : 0,
      regenPerSecond: isBoss || !plan.boss ? plan.regen : 0,
      slowFactor: 1,
      slowUntil: 0,
      stunnedUntil: 0,
      poisonDps: 0,
      poisonUntil: 0,
      flash: 0
    });
    this.state.spawned += 1;
  }

  private updateEnemies(delta: number): void {
    for (const enemy of this.state.enemies) {
      enemy.flash = Math.max(0, enemy.flash - delta);
      if (enemy.regenPerSecond > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenPerSecond * delta);
      if (enemy.poisonUntil > this.state.elapsed && enemy.poisonDps > 0) {
        this.damageEnemy(enemy, enemy.poisonDps * delta, false, false);
        if (!this.state.enemies.includes(enemy)) continue;
      }
      if (enemy.slowUntil <= this.state.elapsed) enemy.slowFactor = 1;
      if (enemy.stunnedUntil > this.state.elapsed) continue;
      enemy.progress += enemy.speed * enemy.slowFactor * (1 - this.idiomBonus("enemySlow")) * delta;
    }
  }

  private refreshCombatCache(): void {
    this.enemyPositions.clear();
    for (const enemy of this.state.enemies) this.enemyPositions.set(enemy.id, positionOnPath(enemy.progress));

    const elements = new Set<Wuxing>();
    const formationMatches = [0, 0, 0, 0, 0];
    this.combatCharCounts.clear();
    this.combatPolarisElements.clear();
    for (const tower of this.state.towers) {
      elements.add(tower.wuxing);
      this.combatCharCounts.set(tower.char, (this.combatCharCounts.get(tower.char) ?? 0) + 1);
      if (this.state.mode === "casual" && (tower.casualStar ?? tower.naturalStar) === CASUAL_POLARIS_AURA.star) {
        this.combatPolarisElements.add(tower.wuxing);
      }
      const formationIndex = Math.floor(tower.cell / CELLS_PER_FORMATION);
      if (BOARD_FORMATIONS[formationIndex]?.preferredWuxing === tower.wuxing) formationMatches[formationIndex] = (formationMatches[formationIndex] ?? 0) + 1;
    }
    this.combatDistinctElements = elements.size;
    this.combatSynergies.clear();
    for (const wuxing of elements) if (elements.has(generatorOf(wuxing))) this.combatSynergies.add(wuxing);
    for (let index = 0; index < this.combatFormationBonuses.length; index += 1) {
      const matching = formationMatches[index] ?? 0;
      const tier = matching >= 16 ? 4 : matching >= 12 ? 3 : matching >= 8 ? 2 : matching >= 4 ? 1 : 0;
      this.combatFormationBonuses[index] = [0, 0.06, 0.12, 0.18, 0.25][tier] ?? 0;
    }
    // [SKILL-V1] 성어의 가호: 발동 중 봉인이 선 진의 자령 전원이 공격 증폭을 받는다.
    for (let index = 0; index < this.combatIdiomBlessings.length; index += 1) {
      this.combatIdiomBlessings[index] = this.idiomBlessingBonusAt(index);
    }
  }

  /**
   * [SKILL-V1] 성어의 가호 — 이 진에 선 "발동 중" 성어 수로 계산한 공격 배율.
   * 첫 구 +10%, 같은 진의 추가 구당 +5%p. 봉인이 흩어지면(active=false) 즉시 0.
   */
  idiomBlessingBonusAt(formationIndex: number): number {
    let seals = 0;
    for (const seal of this.activeIdiomSeals()) {
      const anchorCell = seal.cells[0];
      if (anchorCell === undefined) continue;
      if (Math.floor(anchorCell / CELLS_PER_FORMATION) === formationIndex) seals += 1;
    }
    return idiomBlessingBonus(seals);
  }

  private enemyPoint(enemy: Enemy): Point {
    const cached = this.enemyPositions.get(enemy.id);
    if (cached) return cached;
    const point = positionOnPath(enemy.progress);
    this.enemyPositions.set(enemy.id, point);
    return point;
  }

  private updateAbilityZones(delta: number): void {
    this.state.abilityZones = this.state.abilityZones.filter((zone) => zone.expiresAt > this.state.elapsed);
    for (const zone of this.state.abilityZones) {
      const center = positionOnPath(zone.progress);
      for (const enemy of this.state.enemies) {
        if (distance(this.enemyPoint(enemy), center) > zone.radius) continue;
        // [SKILL-V1] 서리길처럼 피해 없는 지대는 타격·피격 연출 없이 상태만 건다.
        if (zone.damagePerSecond > 0) {
          const armorPenetration = zone.kind === "caltrops" ? 0.42 : 0;
          this.damageEnemy(enemy, zone.damagePerSecond * delta, false, enemy.weakness === zone.wuxing, armorPenetration);
          if (!this.state.enemies.includes(enemy)) continue;
        }
        if (zone.kind === "roots") {
          enemy.poisonDps = Math.max(enemy.poisonDps, zone.damagePerSecond * 0.24);
          enemy.poisonUntil = Math.max(enemy.poisonUntil, this.state.elapsed + 0.65 * (1 + this.elementTraitLevel("木", 2) * 0.025));
        } else if (zone.kind === "quicksand") {
          enemy.slowFactor = Math.min(enemy.slowFactor, Math.max(0.15, 0.72 - this.elementTraitLevel("土", 0) * 0.01));
          enemy.slowUntil = Math.max(enemy.slowUntil, this.state.elapsed + 0.2);
        } else if (zone.kind === "rain") {
          enemy.slowFactor = Math.min(enemy.slowFactor, 0.64);
          enemy.slowUntil = Math.max(enemy.slowUntil, this.state.elapsed + 0.25 * (1 + this.elementTraitLevel("水", 1) * 0.025));
        } else if (zone.kind === "frost") {
          // [SKILL-V1] 서리길: 총 감속 캡 60%(이동 배율 0.4 미만 금지)를 지킨다.
          enemy.slowFactor = Math.min(enemy.slowFactor, Math.max(0.4, zone.slowFactor ?? 1));
          enemy.slowUntil = Math.max(enemy.slowUntil, this.state.elapsed + 0.2);
        }
      }
    }
  }

  private deployElementZone(tower: Tower, target: Enemy, damage: number, potency: number, abilityPower: number): { label: string; duration: number; damagePerSecond: number } {
    const spec = ELEMENT_ZONE_SPECS[tower.wuxing];
    const durationMultiplier = tower.wuxing === "木" ? 1 + this.elementTraitLevel("木", 1) * 0.02 : 1;
    const radiusTraitIndex = tower.wuxing === "木" || tower.wuxing === "水" ? 0 : tower.wuxing === "火" ? 1 : tower.wuxing === "土" ? 2 : -1;
    const radiusMultiplier = radiusTraitIndex >= 0 ? 1 + this.elementTraitLevel(tower.wuxing, radiusTraitIndex) * 0.02 : 1;
    const damageMultiplier = tower.wuxing === "火" ? 1 + this.elementTraitLevel("火", 0) * 0.025 : 1;
    const progressionRank = this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : tower.stage;
    const duration = (spec.duration + progressionRank * 0.22) * durationMultiplier;
    const radius = (spec.radius + progressionRank * 5) * radiusMultiplier;
    const damagePerSecond = damage * spec.damageRatio * potency * abilityPower * damageMultiplier;
    const existing = this.state.abilityZones.find((zone) => zone.towerId === tower.id);
    const zone: AbilityZone = {
      id: existing?.id ?? this.nextAbilityZoneId++,
      towerId: tower.id,
      kind: spec.kind,
      wuxing: tower.wuxing,
      progress: target.progress,
      radius,
      damagePerSecond,
      expiresAt: this.state.elapsed + duration,
      color: ELEMENT_STYLES[tower.wuxing].color
    };
    if (existing) Object.assign(existing, zone);
    else this.state.abilityZones.push(zone);
    if (this.state.abilityZones.length > 20) this.state.abilityZones.shift();
    return { label: spec.label, duration, damagePerSecond };
  }

  /**
   * [SKILL-V1] 서리길(frost) 지대 — 비구름 장판 문법을 그대로 빌린 순수 감속 지대.
   * 피해 0, 밀치기 0. 밟는 동안만 걸음이 늦어지고 벗어나면 곧 풀린다.
   */
  private deployFrostZone(tower: Tower, target: Enemy): { label: string; duration: number; damagePerSecond: number } {
    const star = this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null;
    const slowRatio = frostSlowRatio(star);
    const existing = this.state.abilityZones.find((zone) => zone.towerId === tower.id);
    const zone: AbilityZone = {
      id: existing?.id ?? this.nextAbilityZoneId++,
      towerId: tower.id,
      kind: "frost",
      wuxing: tower.wuxing,
      progress: target.progress,
      radius: FROST_ZONE_RADIUS,
      damagePerSecond: 0,
      expiresAt: this.state.elapsed + FROST_ZONE_DURATION,
      color: "#bfe8ff",
      slowFactor: 1 - slowRatio
    };
    if (existing) Object.assign(existing, zone);
    else this.state.abilityZones.push(zone);
    if (this.state.abilityZones.length > 20) this.state.abilityZones.shift();
    return { label: "서리길", duration: FROST_ZONE_DURATION, damagePerSecond: 0 };
  }

  private updateTowers(delta: number): void {
    for (const tower of this.state.towers) {
      tower.pulse = Math.max(0, tower.pulse - delta * 3);
      tower.abilityFlash = Math.max(0, tower.abilityFlash - delta * 2.4);
      this.chargeGwicheon(tower, delta);
      tower.cooldownLeft -= delta;
      if (tower.cooldownLeft > 0) continue;
      const target = this.findTarget(tower);
      if (target) this.fireTower(tower, target);
    }
  }

  /** 수술 8 ⓑ: 1~3웨이브 동안 시작 진의 자령에게만 주는 개문 사거리. */
  gateOpeningRangeBonus(tower: Tower): number {
    if (this.state.wave > GATE_OPENING_WARD.untilWave || tower.cell < 0 || this.state.startingFormationIndex === null) return 0;
    return Math.floor(tower.cell / CELLS_PER_FORMATION) === this.state.startingFormationIndex ? GATE_OPENING_WARD.rangeBonus : 0;
  }

  /**
   * [SKILL-V1] 귀천(歸天) — 6★ 이상 자령의 충전 스킬.
   * 30초(별당 −2초) 충전 후 자동 발동해 가장 오래 버틴 일반 적 1기를 정화한다.
   * 적 한계 75% 이상이면 충전 2배속. 대상이 없으면 가득 찬 채 다음 적을 기다린다.
   */
  private chargeGwicheon(tower: Tower, delta: number): void {
    if (this.state.mode !== "casual") return;
    const star = tower.casualStar ?? tower.naturalStar ?? 1;
    if (star < GWICHEON_MIN_STAR) return;
    const required = gwicheonChargeSeconds(star);
    const rush = this.state.enemies.length >= MAX_ENEMIES * GWICHEON_RUSH_THRESHOLD ? 2 : 1;
    tower.ascendCharge = Math.min(required, (tower.ascendCharge ?? 0) + delta * rush);
    if (tower.ascendCharge >= required && this.castGwicheon(tower)) tower.ascendCharge = 0;
  }

  /**
   * [SKILL-V1] 귀천 대상 — 화면에서 가장 오래 산(가장 먼저 나타난) 일반 적.
   * 우두머리(boss)와 정예(armored, "정예 철갑 강시")는 면역이다.
   */
  findGwicheonTarget(): Enemy | undefined {
    let oldest: Enemy | undefined;
    for (const enemy of this.state.enemies) {
      if (enemy.boss || enemy.archetype === "boss" || enemy.archetype === "armored") continue;
      if (!oldest || enemy.id < oldest.id) oldest = enemy;
    }
    return oldest;
  }

  /** [SKILL-V1] 귀천 발동 — 즉시 소멸이되 보상·처치 집계는 정상 경로로 지급한다. */
  private castGwicheon(tower: Tower): boolean {
    const target = this.findGwicheonTarget();
    if (!target) return false;
    const origin = BOARD_CELLS[tower.cell] as Point;
    const at = this.enemyPoint(target);
    // 장갑 완전 관통 + 잔여 체력 이상의 피해 = 확정 정화. 보상은 damageEnemy 가 지급한다.
    this.damageEnemy(target, target.hp + 10, false, false, 1);
    this.emitAbility(tower, GWICHEON_ABILITY, origin, at, 1, "가장 오래 버틴 일반 망령 정화 · 보상 지급");
    return true;
  }

  /**
   * [SKILL-V1] 귀천 UI 상태. 자격이 없으면 null — 카드·게이지를 아예 그리지 않는다.
   */
  gwicheonStatus(tower: Tower): { charge: number; required: number } | null {
    if (this.state.mode !== "casual") return null;
    const star = tower.casualStar ?? tower.naturalStar ?? 1;
    if (star < GWICHEON_MIN_STAR) return null;
    const required = gwicheonChargeSeconds(star);
    return { charge: Math.min(required, tower.ascendCharge ?? 0), required };
  }

  private findTarget(tower: Tower): Enemy | undefined {
    const origin = BOARD_CELLS[tower.cell] as Point;
    const definition = definitionForTower(this.catalog, tower.definitionId);
    const range = definition.combat.range + this.towerRangeBonus(tower) + this.idiomBonus("range") + (tower.concentration ?? 0) * 4 + this.combinedUpgradeBonus(tower.wuxing, "range") + this.gateOpeningRangeBonus(tower);
    const candidates = this.targetCandidates;
    candidates.length = 0;
    for (const enemy of this.state.enemies) if (distance(origin, this.enemyPoint(enemy)) <= range) candidates.push(enemy);
    if (candidates.length === 0) return undefined;
    const priority = definition.combat.abilities.targetPriority;
    let best = candidates[0] as Enemy;
    let bestValue = -Infinity;
    for (const enemy of candidates) {
      let value: number;
      if (priority === "strongest") value = enemy.hp + (enemy.boss ? enemy.maxHp : 0);
      else if (priority === "fastest") value = enemy.speed * enemy.slowFactor + enemy.progress * 0.001;
      else if (priority === "armored") value = enemy.armor * 1000 + enemy.hp * 0.01;
      else if (priority === "valuable") value = enemy.reward * 100 + enemy.progress;
      else if (priority === "cluster") {
        let clustered = 0;
        const point = this.enemyPoint(enemy);
        for (const candidate of candidates) if (distance(this.enemyPoint(candidate), point) <= 125) clustered += 1;
        value = clustered * 100 + enemy.progress;
      } else value = enemy.progress;
      if (value > bestValue || (value === bestValue && enemy.progress > best.progress)) {
        best = enemy;
        bestValue = value;
      }
    }
    return best;
  }

  private fireTower(tower: Tower, target: Enemy): void {
    const definition = definitionForTower(this.catalog, tower.definitionId);
    const profile = definition.combat;
    const abilities = profile.abilities;
    const tuning = abilities.tuning;
    const style = ELEMENT_STYLES[tower.wuxing];
    const origin = BOARD_CELLS[tower.cell] as Point;
    const targetPoint = this.enemyPoint(target);
    const synergy = this.combatSynergies.has(tower.wuxing);
    const weakness = target.weakness === tower.wuxing;
    tower.shotCount += 1;
    const concentration = tower.concentration ?? 0;
    const concentrationPath = tower.concentrationPath ?? null;
    const activeSkills = this.towerHasActiveSkills(tower);
    const abilityPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "abilityPower");
    const statusPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "statusPower");
    const semanticEvery = Math.max(7, tuning.semanticEvery - (concentration >= 3 ? 1 : 0));
    const semanticTrigger = activeSkills && tower.shotCount % semanticEvery === 0
      // [SKILL-V1] 파죽(momentum)은 별도 발동 주기가 없는 패시브라 주기 기술에서 뺀다.
      && abilities.semanticFamily !== "momentum"
      && (abilities.semanticFamily !== "weather" || this.state.enemies.length >= 5);
    // At most one active skill may resolve from a tower on the same attack.
    const signature = activeSkills && !semanticTrigger && tower.shotCount % tuning.signatureEvery === 0;
    const lineageTrigger = activeSkills && !semanticTrigger && !signature
      && Boolean(abilities.lineage && tower.shotCount % tuning.lineageEvery === 0);
    const signatureControlBonus = signature && profile.role === "control" ? tuning.roleControlBonus : 0;
    let damage = profile.baseDamage * this.towerPowerMultiplier(tower) * profile.budgetMultiplier;
    damage *= 1 + concentration * (concentrationPath === "potent" ? 0.12 : 0.055);
    damage *= 1 + this.combinedUpgradeBonus(tower.wuxing, "damage");
    damage *= 1 + this.idiomBonus("damage");
    const towerFormationIndex = Math.floor(tower.cell / CELLS_PER_FORMATION);
    damage *= 1 + (this.combatFormationBonuses[towerFormationIndex] ?? 0);
    damage *= FORMATION_ROUTE_COVERAGE_MULTIPLIER[towerFormationIndex] ?? 1;
    // [SKILL-V1] 성어의 가호: 발동 중 성어와 같은 진에 선 자령 전원 공격 증폭.
    damage *= 1 + (this.combatIdiomBlessings[towerFormationIndex] ?? 0);
    // Every elemental start receives the same first-chapter ward. It prevents
    // the free starting formation's map position from deciding a run before
    // the player can buy a second formation, then disappears after wave 10.
    if (this.state.wave <= 10 && towerFormationIndex === this.state.startingFormationIndex) damage *= 1.15;
    // FB7-8성 「극성 개안」: 8★ 자령이 서 있는 오행의 아군 전체 공격 +15%.
    // Set 기반이라 같은 오행 오라는 몇 기가 있어도 최대 1개만 산다.
    if (this.combatPolarisElements.has(tower.wuxing)) damage *= 1 + CASUAL_POLARIS_AURA.damageBonus;
    if (synergy) damage *= 1 + GAME_CONFIG.synergyBonus + (profile.role === "support" ? 0.08 : 0);
    if (weakness) damage *= GAME_CONFIG.weaknessMultiplier;
    // [SKILL-V1] 상극 각인: 낙인이 남은 동안 같은 오행 공격이 주는 피해가 커진다.
    // 약점 배율과 같은 층에서 곱해, 이 공격에서 파생되는 확산·연쇄·독도 함께 강해진다.
    if ((target.brandUntil ?? 0) > this.state.elapsed && target.brandWuxing === tower.wuxing) {
      damage *= 1 + (target.brandPower ?? 0);
    }
    // [SKILL-V1] 파죽: 같은 적 연속 타격마다 +8%씩 중첩, 대상을 바꾸면 초기화.
    if (activeSkills && abilities.semanticFamily === "momentum") {
      const momentumCap = momentumMaxStacks(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : tower.stage);
      if (tower.momentumTargetId === target.id) {
        const previousStacks = tower.momentumStacks ?? 0;
        tower.momentumStacks = Math.min(momentumCap, previousStacks + 1);
        if (tower.momentumStacks === momentumCap && previousStacks < momentumCap) {
          this.emitAbility(tower, abilities.semantic, origin, targetPoint, 1, `파죽 최대 중첩 · 피해 +${Math.round(momentumCap * MOMENTUM_STACK_BONUS * 100)}%`);
        }
      } else {
        tower.momentumTargetId = target.id;
        tower.momentumStacks = 0;
      }
      damage *= 1 + (tower.momentumStacks ?? 0) * MOMENTUM_STACK_BONUS;
    }
    if (tower.wuxing === "火" && (target.boss || target.hp / target.maxHp <= 0.3)) {
      damage *= 1 + this.elementTraitLevel("火", 2) * 0.015;
    }
    if (tower.wuxing === "土" && target.armor > 0) damage *= 1 + this.elementTraitLevel("土", 1) * 0.02;

    const distinctElements = this.combatDistinctElements;
    if (tower.graphRole === "hub") damage *= 1 + distinctElements * tuning.hubDiversityBonus;
    if (tower.graphRole === "finisher" && target.hp / target.maxHp <= tuning.executeThreshold) damage *= tuning.executeMultiplier;
    if (tower.graphRole === "independent" && this.combatCharCounts.get(tower.char) === 1) {
      damage *= tuning.soloMultiplier;
    }
    if (semanticTrigger && (abilities.semanticFamily === "sight" || abilities.semanticFamily === "metalwork" || abilities.semanticFamily === "general")) {
      damage *= tuning.semanticMultiplier + (concentrationPath === "potent" ? concentration * 0.035 : 0);
    }
    if (signature && profile.role !== "rapid") damage *= tuning.signatureMultiplier;

    let critical = false;
    let armorPenetration = 0;

    if (activeSkills && tower.wuxing === "金") {
      armorPenetration = Math.min(0.95, tuning.armorPenetration + signatureControlBonus * 0.5
        + (semanticTrigger && abilities.semanticFamily === "metalwork" ? 0.22 : 0)
        + this.elementTraitLevel("金", 1) * 0.01);
      if (this.rng.chance(tuning.critChance + signatureControlBonus * 0.5 + this.elementTraitLevel("金", 0) * 0.004)) {
        damage *= tuning.critMultiplier + this.elementTraitLevel("金", 2) * 0.02;
        critical = true;
      }
    }

    this.events.push({ type: "shot", from: origin, to: targetPoint, color: style.color, critical, wuxing: tower.wuxing });
    this.damageEnemy(target, damage, critical, weakness, armorPenetration);

    if (activeSkills && tower.wuxing === "火") {
      // 수술 5: 캐주얼에서는 별이 곧 광역의 크기다(표준은 배율 1).
      const splashRadius = (tuning.splashRadius + signatureControlBonus * 80) * (1 + this.elementTraitLevel("火", 1) * 0.02) * this.casualSplashRadiusScale(tower);
      const splashRatio = (tuning.splashRatio + signatureControlBonus * 0.35) * (1 + this.elementTraitLevel("火", 0) * 0.025) * this.casualSplashRatioScale(tower);
      for (const enemy of this.state.enemies
        .filter((candidate) => candidate.id !== target.id && distance(this.enemyPoint(candidate), targetPoint) <= splashRadius)
        .slice(0, 5)) {
        this.damageEnemy(enemy, damage * splashRatio * abilityPower, false, enemy.weakness === tower.wuxing);
      }
    } else if (activeSkills && tower.wuxing === "水" && this.state.enemies.includes(target)) {
      target.slowFactor = Math.min(target.slowFactor, Math.max(0.38, tuning.slowFactor - signatureControlBonus));
      target.slowUntil = this.state.elapsed + tuning.slowDuration * (signatureControlBonus > 0 ? 1.35 : 1) * statusPower
        * (1 + this.elementTraitLevel("水", 1) * 0.025);
      const conductionLevel = this.elementTraitLevel("水", 2);
      const chained = this.state.enemies
        .filter((candidate) => candidate.id !== target.id && distance(this.enemyPoint(candidate), targetPoint) <= 150)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, tuning.chainCount + elementTraitExtraChainTargets(conductionLevel));
      for (const enemy of chained) {
        this.damageEnemy(enemy, damage * tuning.chainRatio * abilityPower * (1 + conductionLevel * 0.02), false, enemy.weakness === tower.wuxing);
      }
    } else if (activeSkills && tower.wuxing === "木" && this.state.enemies.includes(target)) {
      target.poisonDps = Math.max(target.poisonDps, damage * (tuning.poisonRatio + signatureControlBonus * 0.35) * abilityPower);
      target.poisonUntil = this.state.elapsed + tuning.poisonDuration * (signatureControlBonus > 0 ? 1.35 : 1) * statusPower
        * (1 + this.elementTraitLevel("木", 2) * 0.025);
    } else if (activeSkills && tower.wuxing === "土" && this.state.enemies.includes(target)) {
      const stunChance = tuning.stunChance + signatureControlBonus;
      if (this.rng.chance(stunChance)) {
        target.stunnedUntil = Math.max(target.stunnedUntil, this.state.elapsed + tuning.stunDuration * (signatureControlBonus > 0 ? 1.35 : 1) * statusPower);
      }
    }

    if (semanticTrigger) this.resolveSemanticAbility(tower, target, damage, origin, targetPoint);

    if (signature) {
      let roleTargets = 1;
      let roleEffect = "이번 공격 피해 ×" + tuning.signatureMultiplier.toFixed(2);
      if (profile.role === "rapid" && this.state.enemies.includes(target)) {
        this.damageEnemy(target, damage * 0.58 * tuning.signatureMultiplier * abilityPower, false, weakness, armorPenetration * 0.5);
        roleEffect = "같은 적에게 " + String(Math.round(58 * tuning.signatureMultiplier)) + "% 추가타";
      } else if (profile.role === "splash") {
        // 수술 5: 역할 확산도 캐주얼 별 스케일을 함께 탄다.
        const spreadRadius = (tuning.splashRadius + 22) * this.casualSplashRadiusScale(tower);
        const spreadRatio = tuning.roleSplashRatio * this.casualSplashRatioScale(tower);
        const spreadTargets = this.state.enemies
          .filter((candidate) => candidate.id !== target.id && distance(this.enemyPoint(candidate), targetPoint) <= spreadRadius)
          .slice(0, 5);
        for (const enemy of spreadTargets) this.damageEnemy(enemy, damage * spreadRatio * abilityPower, false, enemy.weakness === tower.wuxing);
        roleTargets += spreadTargets.length;
        roleEffect = "주변 " + String(spreadTargets.length) + "체에 " + String(Math.round(spreadRatio * 100)) + "% 확산";
      } else if (profile.role === "control") {
        roleEffect = "오행 효과 강화 · 이번 공격 ×" + tuning.signatureMultiplier.toFixed(2);
      } else if (profile.role === "support") {
        const allies = this.state.towers.filter((candidate) => candidate.id !== tower.id && distance(BOARD_CELLS[candidate.cell] as Point, origin) <= 205);
        for (const ally of allies) ally.cooldownLeft = Math.max(0, ally.cooldownLeft - tuning.supportCooldown);
        roleTargets = Math.max(1, allies.length);
        roleEffect = "주변 " + String(allies.length) + "기 공격 대기 -" + tuning.supportCooldown.toFixed(2) + "초";
      } else if (profile.role === "economy") {
        this.state.gold += tuning.economyGold;
        roleEffect = "엽전 +" + String(tuning.economyGold);
      }
      this.emitAbility(tower, abilities.role, origin, targetPoint, roleTargets, roleEffect);
    }

    if (lineageTrigger && abilities.lineage && abilities.lineageWuxing) {
      const lineageWeakness = target.weakness === abilities.lineageWuxing;
      if (this.state.enemies.includes(target)) this.damageEnemy(target, damage * tuning.lineageRatio * abilityPower, false, lineageWeakness, 0.15);
      this.events.push({ type: "shot", from: origin, to: targetPoint, color: abilities.lineage.color, critical: false, wuxing: abilities.lineageWuxing });
      this.emitAbility(
        tower,
        abilities.lineage,
        origin,
        targetPoint,
        1,
        abilities.lineageWuxing + "행 " + String(Math.round(tuning.lineageRatio * 100)) + "% 추가타"
      );
    }

    if (profile.role === "economy" && this.rng.chance(0.035 + tower.stage * 0.008)) this.state.gold += 1;
    tower.cooldownLeft = this.towerAttackCooldown(tower);
    tower.pulse = 1;
  }

  private resolveSemanticAbility(tower: Tower, target: Enemy, damage: number, origin: Point, targetPoint: Point): void {
    const definition = definitionForTower(this.catalog, tower.definitionId);
    const abilities = definition.combat.abilities;
    const family = abilities.semanticFamily;
    const tuning = abilities.tuning;
    const potency = 1 + (tower.concentrationPath === "potent" ? (tower.concentration ?? 0) * 0.035 : 0);
    const abilityPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "abilityPower");
    const statusPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "statusPower");
    // [SKILL-V1] 서리길은 오행 장판 대신 전용 감속 지대를 깐다(비구름 문법 재사용).
    const zone = family === "frost"
      ? this.deployFrostZone(tower, target)
      : this.deployElementZone(tower, target, damage, potency, abilityPower);
    const activeZone = this.state.abilityZones.find((candidate) => candidate.towerId === tower.id);
    const zoneTargets = activeZone
      ? this.state.enemies.filter((enemy) => distance(this.enemyPoint(enemy), targetPoint) <= activeZone.radius).length
      : 0;
    let targets = 1;
    let effect = abilities.semantic.summary;
    const persistent = true;

    if (family === "gate") {
      let relay: Enemy | undefined;
      let relayDistance = -1;
      for (const candidate of this.state.enemies) {
        if (candidate.id === target.id) continue;
        const candidateDistance = distance(this.enemyPoint(candidate), targetPoint);
        if (candidateDistance > relayDistance) {
          relay = candidate;
          relayDistance = candidateDistance;
        }
      }
      if (relay) {
        const relayPoint = this.enemyPoint(relay);
        this.events.push({ type: "shot", from: targetPoint, to: relayPoint, color: abilities.semantic.color, critical: false, wuxing: tower.wuxing });
        this.damageEnemy(relay, damage * tuning.semanticMultiplier * potency * abilityPower, false, relay.weakness === tower.wuxing, 0.12);
        targets = 2;
        effect = "길 반대편 1체에 " + String(Math.round(tuning.semanticMultiplier * potency * 100)) + "% 전이";
      }
    } else if (family === "weather") {
      targets = Math.max(1, zoneTargets);
      effect = `${zone.label} ${zone.duration.toFixed(1)}초 · 초당 ${Math.round(zone.damagePerSecond)} 피해`;
    } else if (family === "flame") {
      // 수술 5: 잔화 지대도 캐주얼에서는 별을 따라 넓어진다.
      const radius = 115 * this.casualSplashRadiusScale(tower);
      const victims = this.state.enemies
        .filter((candidate) => candidate.id !== target.id && distance(this.enemyPoint(candidate), targetPoint) <= radius)
        .slice(0, 5);
      for (const victim of victims) this.damageEnemy(victim, damage * tuning.semanticMultiplier * potency * abilityPower, false, victim.weakness === tower.wuxing);
      targets += victims.length;
      effect = "밀집 구간 " + String(targets) + "체에 " + String(Math.round(tuning.semanticMultiplier * potency * 100)) + "% 피해";
    } else if (family === "mountain" && this.state.enemies.includes(target)) {
      target.stunnedUntil = Math.max(target.stunnedUntil, this.state.elapsed + 0.55 * potency * statusPower);
      effect = "제자리 봉쇄 · " + (0.55 * potency * statusPower).toFixed(1) + "초";
    } else if (family === "motion" && this.state.enemies.includes(target)) {
      target.slowFactor = Math.min(target.slowFactor, 0.52);
      target.slowUntil = Math.max(target.slowUntil, this.state.elapsed + 1.75 * potency * statusPower);
      effect = "최고속 적 48% 감속 · " + (1.75 * potency * statusPower).toFixed(1) + "초";
    } else if (family === "speech") {
      const formation = Math.floor(tower.cell / CELLS_PER_FORMATION);
      const allies = this.state.towers.filter((candidate) => candidate.id !== tower.id && Math.floor(candidate.cell / CELLS_PER_FORMATION) === formation);
      for (const ally of allies) ally.cooldownLeft = Math.max(0, ally.cooldownLeft - 0.06 * potency);
      targets = Math.max(1, allies.length);
      effect = "같은 진 " + String(allies.length) + "기 공격 대기 감소";
    } else if (family === "growth") {
      const rooted = this.state.enemies
        .filter((candidate) => candidate.id !== target.id && distance(this.enemyPoint(candidate), targetPoint) <= 145)
        .slice(0, 2);
      for (const enemy of rooted) {
        enemy.poisonDps = Math.max(enemy.poisonDps, damage * 0.16 * potency * abilityPower);
        enemy.poisonUntil = Math.max(enemy.poisonUntil, this.state.elapsed + 3 * potency * statusPower);
        enemy.slowFactor = Math.min(enemy.slowFactor, 0.72);
        enemy.slowUntil = Math.max(enemy.slowUntil, this.state.elapsed + 1.1 * potency * statusPower);
      }
      targets += rooted.length;
      effect = "가까운 " + String(rooted.length) + "체에 뿌리독 번식";
    } else if (family === "heart") {
      for (const ally of this.state.towers) ally.cooldownLeft = Math.max(0, ally.cooldownLeft - 0.025 * potency);
      targets = this.state.towers.length;
      effect = "진 전체 " + String(targets) + "기 호흡 가속";
    } else if (family === "wealth") {
      const bonus = 1 + Math.floor((tower.concentration ?? 0) / 2);
      this.state.gold += bonus;
      effect = "현상금 적 추적 · 엽전 +" + String(bonus);
    } else if (family === "sight") {
      effect = "최고 체력 적 간파 · 이번 공격 ×" + tuning.semanticMultiplier.toFixed(2);
    } else if (family === "metalwork") {
      effect = "최고 장갑 적 우선 · 추가 관통 22%";
    } else if (family === "warfare" && this.state.enemies.includes(target)) {
      // [SKILL-V1] 상극 각인: 대상에게 자기 오행의 상극 낙인(4초). 밀거나 되돌리지 않는다.
      const brandPower = warfareBrandPower(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      target.brandWuxing = tower.wuxing;
      target.brandPower = brandPower;
      target.brandUntil = this.state.elapsed + WARFARE_BRAND_DURATION;
      effect = `${tower.wuxing}행 상극 낙인 ${WARFARE_BRAND_DURATION}초 · 같은 오행 피해 +${Math.round(brandPower * 100)}%`;
    } else if (family === "frost") {
      // [SKILL-V1] 서리길: 적중 지점 서리 지대 — 감속만 있고 피해·밀치기는 없다.
      const slowRatio = frostSlowRatio(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      targets = Math.max(1, zoneTargets);
      effect = `서리길 ${zone.duration.toFixed(1)}초 · 밟는 적 ${Math.round(slowRatio * 100)}% 감속`;
    } else {
      effect = "뜻 구현 · 이번 공격 ×" + tuning.semanticMultiplier.toFixed(2);
    }

    // [SKILL-V1] frost 는 장판 자체가 본 효과라 꼬리 문구를 겹쳐 붙이지 않는다.
    if (family !== "weather" && family !== "frost") effect += ` · ${zone.label} ${zone.duration.toFixed(1)}초`;

    this.emitAbility(tower, abilities.semantic, origin, targetPoint, targets, effect, persistent);
  }

  private emitAbility(tower: Tower, ability: AbilitySpec, source: Point, at: Point, targets: number, effect: string, persistent = false): void {
    tower.abilityFlash = 1;
    this.events.push({
      type: "ability",
      at,
      source,
      towerId: tower.id,
      name: ability.name,
      glyph: ability.glyph,
      color: ability.color,
      kind: ability.fx,
      targets,
      effect,
      persistent
    });
  }

  private damageEnemy(enemy: Enemy, rawAmount: number, critical: boolean, weakness: boolean, armorPenetration = 0): void {
    if (!this.state.enemies.includes(enemy)) return;
    const effectiveArmor = enemy.armor * (1 - armorPenetration);
    const amount = rawAmount * (1 - effectiveArmor);
    enemy.hp -= amount;
    enemy.flash = 0.09;
    if (amount >= 1.5) this.events.push({ type: "damage", at: this.enemyPoint(enemy), amount, critical, weakness });
    if (enemy.hp > 0) return;
    const at = this.enemyPoint(enemy);
    this.state.enemies = this.state.enemies.filter((candidate) => candidate.id !== enemy.id);
    if (enemy.boss) this.state.bossDefeated = true;
    this.state.gold += enemy.reward;
    this.state.killCount += 1;
    this.events.push({ type: "kill", at, reward: enemy.reward });
  }

  private finishWave(): void {
    if (this.state.wave >= this.state.maxWaves) {
      const interest = this.payBankInterest();
      this.endRun("victory", `백 번째 봉인을 지켜내고 천자문의 대봉인을 완성했습니다!${interest > 0 ? ` · 은행 이자 +${interest}엽전` : ""}`);
      return;
    }
    const bonus = waveClearReward(this.state.wave);
    this.state.gold += bonus;
    const interest = this.payBankInterest();
    this.state.phase = "prep";
    this.state.prepRemaining = this.state.wave % 10 === 0 ? GAME_CONFIG.bossPrepSeconds : GAME_CONFIG.prepSeconds;
    this.state.lastMessage = String(this.state.wave) + "웨이브 방어 성공 · 보상 " + String(bonus) + "엽전" + (interest > 0 ? " · 은행 이자 +" + String(interest) + "엽전" : "");
    this.events.push({ type: "phase", phase: "prep" });
  }

  private advanceWaveWithSurvivors(): void {
    if (this.state.wave >= this.state.maxWaves) {
      const interest = this.payBankInterest();
      this.endRun("victory", `마지막 우두머리를 쓰러뜨리고 백 번째 봉인을 지켜냈습니다!${interest > 0 ? ` · 은행 이자 +${interest}엽전` : ""}`);
      return;
    }
    const survivors = this.state.enemies.length;
    const previousWave = this.state.wave;
    const interest = this.payBankInterest();
    this.startNextWave();
    this.state.lastMessage = `${previousWave}웨이브 잔존 ${survivors}체 · ${this.currentPlan?.label ?? "다음 웨이브"} 합류${interest > 0 ? ` · 은행 이자 +${interest}엽전` : ""}`;
  }

  private payBankInterest(): number {
    const amount = interestForGold(this.state.gold);
    if (amount <= 0) return 0;
    this.state.gold += amount;
    this.state.interestEarned += amount;
    this.events.push({ type: "interest", amount, gold: this.state.gold });
    return amount;
  }

  startWaveEarly(): ActionResult {
    if (this.state.phase !== "prep") return { ok: false, message: "준비 시간에만 시작할 수 있습니다." };
    if (this.state.summonCount === 0) return { ok: false, message: "첫 자령을 소환하면 오행진이 열리고 웨이브를 시작할 수 있습니다." };
    const bonus = Math.floor(this.state.prepRemaining / 2);
    this.state.gold += bonus;
    this.startNextWave();
    return { ok: true, message: bonus > 0 ? "조기 출전 보너스 " + String(bonus) + "엽전" : "웨이브 시작" };
  }

  private startNextWave(): void {
    const nextWave = this.state.wave + 1;
    this.state.wave = nextWave;
    const plan = wavePlan(nextWave);
    // 수련장은 수량도 함께 눌러 "반드시 이기는 첫 교전"을 보장한다.
    this.currentPlan = this.tutorial
      ? { ...plan, count: Math.max(3, Math.round(plan.count * TUTORIAL_ENEMY_COUNT_SCALE)) }
      : plan;
    this.state.phase = "combat";
    this.state.waveElapsed = 0;
    this.state.spawned = 0;
    this.state.spawnCooldown = 0;
    this.state.nextWaveRemaining = null;
    this.state.bossDefeated = false;
    this.state.lastMessage = this.currentPlan.label + " 출현 · 약점 " + this.currentPlan.weakness;
    this.events.push({
      type: "wave",
      wave: nextWave,
      boss: this.currentPlan.boss,
      archetype: this.currentPlan.archetype,
      weakness: this.currentPlan.weakness
    });
    this.events.push({ type: "phase", phase: "combat" });
  }

  /**
   * `surcharge` 는 상점 상품 카드가 청구하는 목적 정찰료다. 자동 시뮬레이션과
   * 10연 소환은 0을 그대로 써서 기존 기본가 곡선을 유지한다.
   * `guaranteedStar` 는 10연 마지막 한 장이 밴드 상한을 채워 주는 보장 경로다.
   */
  summon(forceIntent = false, surcharge = 0, guaranteedStar: number | null = null): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const cost = summonCost(this.state.summonCount) + Math.max(0, surcharge);
    if (this.state.gold < cost) return { ok: false, message: "엽전이 " + String(cost - this.state.gold) + " 부족합니다." };
    if (this.runSummonPool.length === 0) return { ok: false, message: "이 지역의 활성 소환 풀이 비어 있습니다." };
    const maxStage = this.state.mode === "casual" ? 5 : maxSummonStageForWave(this.state.wave);
    // 캐주얼 소환은 확률 가중이 아니라 후보 풀 자체를 밴드로 잘라 상·하한을 만든다.
    const band = this.summonStarBand(this.state.summonIntent);
    const casualPool = (): HanziDefinition[] => {
      const banded = band === null ? [...this.runSummonPool] : this.starBandCandidates(band.min, band.max);
      if (guaranteedStar === null) return banded;
      const guaranteed = banded.filter((definition) => (casualNaturalStar(definition.char) ?? 1) === guaranteedStar);
      return guaranteed.length > 0 ? guaranteed : banded;
    };
    const summonPool = this.state.mode === "casual"
      ? casualPool()
      : this.runSummonPool.filter((definition) => definition.stage <= maxStage);
    if (summonPool.length === 0) return { ok: false, message: "현재 장에서 소환 가능한 자령이 없습니다." };

    const ownedTowers = [...this.state.towers, ...this.state.inventoryTowers];
    const helpfulChars = this.state.mode === "casual"
      ? new Set([this.state.targetChar])
      : this.evolution.getHelpfulDirectCharacters(ownedTowers, this.state.targetChar);
    const idiomTarget = this.currentIdiomTarget();
    const idiomHelpfulChars = idiomTarget
      ? this.state.mode === "casual"
        ? new Set([...idiomTarget.chars])
        : helpfulDirectCharsForIdiom(this.catalog, ownedTowers, idiomTarget)
      : new Set<string>();
    const connectionBonus = researchConnectionBonus(this.state.researchLevel);
    // The Korean playable-preview pool is much wider than the original
    // prototype pool. Scale focused additions with pool breadth so choosing a
    // Hanja or idiom remains a meaningful player decision among 1,000 entries.
    const focusPoolScale = Math.max(1, Math.min(12.5, summonPool.length / 80));
    const ownedCounts = new Map<string, number>();
    for (const tower of ownedTowers) ownedCounts.set(tower.char, (ownedCounts.get(tower.char) ?? 0) + 1);
    const discovered = new Set(this.state.discoveredChars);
    const deployedChars = new Set(this.state.towers.map((tower) => tower.char));
    // 캐주얼 3체 조합은 같은 오행·같은 별 3기가 한 묶음이다. 이미 1~2기를 쥔
    // 묶음의 글자를 더 자주 흘려 "모으는 중"이라는 감각을 만든다. 3기 이상은
    // 이미 조합할 수 있으므로 보정하지 않는다(잠금 자령도 보유로 센다).
    const pairBoost = this.state.mode === "casual" && TIERED_SUMMON_INTENTS.has(this.state.summonIntent);
    const pairGroupCounts = new Map<string, number>();
    if (pairBoost) {
      for (const tower of ownedTowers) {
        const star = tower.casualStar ?? tower.naturalStar;
        if (star === undefined) continue;
        const key = `${tower.wuxing}:${star}`;
        pairGroupCounts.set(key, (pairGroupCounts.get(key) ?? 0) + 1);
      }
    }
    const weights = summonPool.map((definition) => {
      const pityMultiplier = 1 + this.state.softPity * GAME_CONFIG.softPityStep;
      const ownedCount = ownedCounts.get(definition.char) ?? 0;
      const onboarding = this.state.summonCount < 4;
      const exposureWeight = onboarding
        ? 1
        : discovered.has(definition.char)
          ? GAME_CONFIG.repeatWeightDecay / (1 + ownedCount)
          : GAME_CONFIG.undiscoveredWeight;
      const featuredPoolOnly = !this.catalog.activePool.some((candidate) => candidate.char === definition.char);
      const baseWeight = featuredPoolOnly
        ? onboarding && this.state.mode === "standard" ? 0 : 0.25
        : onboarding && this.state.mode === "standard" ? activePoolBaseWeight(this.state.region, definition.char) : 1;
      const stageWeight = this.state.mode === "casual"
        ? 1
        : onboarding && definition.stage > 1 ? 0 : SUMMON_STAGE_WEIGHTS[definition.stage];
      let weight = baseWeight * exposureWeight;
      if (helpfulChars.has(definition.char)) weight += (GAME_CONFIG.targetWeightBase + connectionBonus * 3.2) * pityMultiplier * focusPoolScale * 0.65;
      if (definition.char === this.state.targetChar) weight += GAME_CONFIG.targetWeightBase * 1.4 * pityMultiplier * focusPoolScale;
      if (idiomHelpfulChars.has(definition.char)) weight += GAME_CONFIG.idiomWeightBase * pityMultiplier * focusPoolScale * 0.7;
      if (this.state.summonIntent === "discovery") weight *= discovered.has(definition.char) ? 0.42 : 3.4;
      else if (this.state.summonIntent === "lineage") weight *= helpfulChars.has(definition.char) || idiomHelpfulChars.has(definition.char) ? 3.2 : 0.72;
      else if (this.state.summonIntent === "concentration") {
        weight *= ownedCount > 0 ? 2.4 + Math.min(2.4, ownedCount * 0.55) + (deployedChars.has(definition.char) ? 1.4 : 0) : 0.48;
      }
      if (pairBoost) {
        const owned = pairGroupCounts.get(`${definition.wuxing}:${casualNaturalStar(definition.char) ?? 1}`) ?? 0;
        if (owned >= 1 && owned <= 2) weight *= CASUAL_PAIR_WEIGHT;
      }
      return weight * stageWeight;
    });
    // 짝 맞추기·목적 가중까지 끝난 뒤에 별 단위 목표 분포로 다시 눌러 준다.
    // 순서가 바뀌면 글자 수가 많은 낮은 별이 밴드 분포를 통째로 삼킨다.
    if (band !== null) this.applyStarBandDecay(summonPool, weights);
    const targetDefinition = this.catalog.definitions.get(this.state.targetChar);
    const targetGuaranteeReady = this.state.summonIntent === "lineage"
      && this.state.lineageTargetProgress >= 29
      && targetDefinition !== undefined
      && targetDefinition.stage <= maxStage;
    const clueGuaranteeReady = this.state.summonIntent === "lineage" && this.state.lineageClueProgress >= 11;
    const weightedCandidates = summonPool.map((definition, index) => ({ definition, weight: weights[index] ?? 0 }));
    const targetCandidates = targetGuaranteeReady
      ? weightedCandidates.filter(({ definition, weight }) => definition.char === this.state.targetChar && weight > 0)
      : [];
    const clueCandidates = clueGuaranteeReady
      ? weightedCandidates.filter(({ definition, weight }) => weight > 0 && (helpfulChars.has(definition.char) || idiomHelpfulChars.has(definition.char) || definition.char === this.state.targetChar))
      : [];
    const intentCandidates = forceIntent && this.state.summonIntent !== "balanced"
      ? weightedCandidates.filter(({ definition, weight }) => weight > 0 && (() => {
        if (this.state.summonIntent === "discovery") return !discovered.has(definition.char);
        if (this.state.summonIntent === "lineage") return helpfulChars.has(definition.char) || idiomHelpfulChars.has(definition.char);
        // 티어 소환은 이미 후보 풀 자체가 잘려 있으므로 추가 필터가 없다.
        if (TIERED_SUMMON_INTENTS.has(this.state.summonIntent)) return true;
        return (ownedCounts.get(definition.char) ?? 0) > 0;
      })())
      : [];
    const forcedCandidates = targetCandidates.length > 0 ? targetCandidates : clueCandidates.length > 0 ? clueCandidates : intentCandidates;
    const pickPool = forcedCandidates.length > 0 ? forcedCandidates.map((entry) => entry.definition) : summonPool;
    const pickWeights = forcedCandidates.length > 0 ? forcedCandidates.map((entry) => entry.weight) : weights;
    const definition = weightedPick(this.rng, pickPool, pickWeights);
    const isFirstSummon = this.state.startingFormationIndex === null;
    let startingFormation = null as (typeof BOARD_FORMATIONS)[number] | null;
    if (isFirstSummon) {
      const formationIndex = BOARD_FORMATIONS.findIndex((formation) => formation.preferredWuxing === definition.wuxing);
      if (formationIndex < 0) return { ok: false, message: `${definition.wuxing}행에 대응하는 오행진을 찾지 못했습니다.` };
      startingFormation = BOARD_FORMATIONS[formationIndex] ?? null;
      this.state.startingFormationIndex = formationIndex;
      this.state.unlockedFormations = [formationIndex];
      this.state.prepRemaining = FIRST_PREP_SECONDS;
    }
    const emptyCell = this.state.autoPlaceSummons ? this.firstEmptyCell() : null;
    const stored = !this.state.autoPlaceSummons || emptyCell === null;
    const cell = stored ? -1 : emptyCell;
    if (cell === null) return { ok: false, message: "소환 위치를 찾지 못했습니다." };
    const goalHelpful = helpfulChars.has(definition.char) || definition.char === this.state.targetChar;
    const idiomHelpful = idiomHelpfulChars.has(definition.char);
    const helpful = goalHelpful || idiomHelpful;
    const helpfulReason = goalHelpful && idiomHelpful ? "both" : goalHelpful ? "goal" : idiomHelpful ? "idiom" : null;
    this.state.gold -= cost;
    this.state.softPity = helpful ? 0 : Math.min(GAME_CONFIG.maxSoftPity, this.state.softPity + 1);
    if (this.state.summonIntent === "lineage") {
      this.state.lineageClueProgress += 1;
      this.state.lineageTargetProgress += 1;
      if (clueGuaranteeReady && helpful) this.state.lineageClueProgress = 0;
      if (definition.char === this.state.targetChar) {
        this.state.lineageClueProgress = 0;
        this.state.lineageTargetProgress = 0;
      }
    }
    const tower = this.createTower(definition, cell);
    if (stored) this.state.inventoryTowers.push(tower);
    else this.state.towers.push(tower);
    this.state.summonCount += 1;
    this.state.selectedTowerId = tower.id;
    this.discover(definition.char);
    const newDiscovery = !discovered.has(definition.char);
    const utility: Extract<GameEvent, { type: "summon" }>["utility"] = newDiscovery
      ? "new"
      : helpful
        ? "synthesis"
        : (ownedCounts.get(definition.char) ?? 0) > 0
          ? "concentration"
          : "replacement";
    const helpfulLabel = helpfulReason === "both" ? " · 목표·사자성어 재료!" : helpfulReason === "goal" ? " · 목표 재료!" : helpfulReason === "idiom" ? " · 사자성어 재료!" : "";
    const placementMessage = definition.char + " · " + definition.combat.roleLabel + (stored ? " 인벤토리 보관" : " 소환") + helpfulLabel;
    this.state.lastMessage = isFirstSummon && startingFormation
      ? `${definition.wuxing} 자령 출현 → ${startingFormation.label} 무료 개방 · ${placementMessage} · 추가 소환 2기를 권장합니다.`
      : placementMessage;
    const eventAt = stored ? (startingFormation?.center ?? { x: 400, y: 300 }) : BOARD_CELLS[cell] as Point;
    this.events.push({ type: "summon", at: eventAt, tower: { ...tower }, stored, helpful, helpfulReason, newDiscovery, utility });
    if (definition.char === this.state.targetChar) this.completeGoal(definition.char);
    if (!stored) this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  summonMany(amount = 10): ActionResult {
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, message: "연속 소환 횟수가 올바르지 않습니다." };
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    if (amount >= 10 && this.state.wave < 10) return { ok: false, message: "10연 소환은 10웨이브를 지키면 개방됩니다." };
    const totalCost = multiSummonCost(this.state.summonCount, amount);
    if (this.state.gold < totalCost) return { ok: false, message: `연속 소환에 엽전 ${totalCost}이 필요합니다.` };
    if (this.runSummonPool.length === 0) return { ok: false, message: "이 지역의 활성 소환 풀이 비어 있습니다." };

    const eventStart = this.events.length;
    // 캐주얼 10연은 밴드 상한(기본 1~3★ → 3★) 1기를 보장한다. 열 장을 뽑고도
    // 상한이 한 번도 안 나왔으면 마지막 한 장의 후보를 상한 별로 좁힌다.
    const band = this.summonStarBand(this.state.summonIntent);
    let bandTopSeen = false;
    for (let index = 0; index < amount; index += 1) {
      const last = index === amount - 1 && amount >= 10;
      const guaranteedStar = last && band !== null && !bandTopSeen ? band.max : null;
      const result = this.summon(last, 0, guaranteedStar);
      if (!result.ok) return result;
      if (band !== null && !bandTopSeen) {
        const drawn = this.events.slice(eventStart).filter((event): event is Extract<GameEvent, { type: "summon" }> => event.type === "summon");
        const star = drawn[drawn.length - 1]?.tower.naturalStar ?? 0;
        if (star >= band.max) bandTopSeen = true;
      }
    }
    const summons = this.events.slice(eventStart).filter((event): event is Extract<GameEvent, { type: "summon" }> => event.type === "summon");
    const helpful = summons.filter((event) => event.helpful).length;
    const discovered = summons.filter((event) => event.newDiscovery).length;
    const storedCount = summons.filter((event) => event.stored).length;
    const placement = storedCount === 0
      ? "전장 자동 배치"
      : storedCount === amount
        ? "인벤토리 보관"
        : `전장 ${amount - storedCount}체 · 인벤토리 ${storedCount}체`;
    this.state.lastMessage = `${amount}연 소환 완료 · 새 한자 ${discovered}종 · 목표·성어 재료 ${helpful}체 · ${placement}`;
    return { ok: true, message: this.state.lastMessage };
  }

  setAutoPlaceSummons(enabled: boolean): ActionResult {
    this.state.autoPlaceSummons = enabled;
    this.state.lastMessage = enabled ? "뽑기 후 자동 배치 켜짐" : "뽑기 후 런 인벤토리 보관";
    return { ok: true, message: this.state.lastMessage };
  }

  setSummonIntent(intent: SummonIntent): ActionResult {
    this.state.summonIntent = intent;
    this.state.lastMessage = `${SUMMON_INTENT_LABELS[intent]} 소환 선택 · 10연 마지막 결과에 목적 보정`;
    return { ok: true, message: this.state.lastMessage };
  }

  /*
   * ── 수련장 각본 지급 훅 ─────────────────────────────────────────
   * 아래 세 tutorialGrant* 는 tutorial 옵션이 켜진 엔진에서만 동작한다.
   * 일반 런에서는 어떤 경로로 불려도 상태를 바꾸지 않는다(치트 차단).
   */

  /** 수련장 각본이 엽전을 지급한다. */
  tutorialGrantGold(amount: number): ActionResult {
    if (!this.tutorial) return { ok: false, message: "수련장에서만 쓸 수 있습니다." };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "지급량이 올바르지 않습니다." };
    this.state.gold += Math.floor(amount);
    this.state.lastMessage = `수련 지원 · 엽전 +${Math.floor(amount)}`;
    return { ok: true, message: this.state.lastMessage };
  }

  /** 수련장 각본이 오행 문기를 지급한다. */
  tutorialGrantEssence(wuxing: Wuxing, amount: number): ActionResult {
    if (!this.tutorial) return { ok: false, message: "수련장에서만 쓸 수 있습니다." };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "지급량이 올바르지 않습니다." };
    this.state.elementEssence[wuxing] += Math.floor(amount);
    this.state.elementEssenceGenerated[wuxing] += Math.floor(amount);
    this.state.lastMessage = `수련 지원 · ${wuxing} 문기 +${Math.floor(amount)}`;
    return { ok: true, message: this.state.lastMessage };
  }

  /**
   * 수련장 각본이 지정 한자 자령 1기를 무료로 지급한다(런 인벤토리 보관).
   * 소환 횟수·가격 곡선은 건드리지 않고, 지급 연출은 일반 소환 이벤트를 탄다.
   */
  tutorialGrantTower(char: string): ActionResult {
    if (!this.tutorial) return { ok: false, message: "수련장에서만 쓸 수 있습니다." };
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const definition = this.catalog.definitions.get(char);
    if (!definition) return { ok: false, message: "이 지역에서 사용할 수 없는 한자입니다." };
    const newDiscovery = !this.state.discoveredChars.includes(char);
    const tower = this.createTower(definition, -1);
    this.state.inventoryTowers.push(tower);
    this.state.selectedTowerId = tower.id;
    this.discover(char);
    const at = (this.state.startingFormationIndex !== null
      ? BOARD_FORMATIONS[this.state.startingFormationIndex]?.center
      : undefined) ?? { x: 400, y: 300 };
    this.state.lastMessage = `수련 지원 · ${char} 자령 지급 (인벤토리 보관)`;
    this.events.push({
      type: "summon",
      at,
      tower: { ...tower },
      stored: true,
      helpful: false,
      helpfulReason: null,
      newDiscovery,
      utility: newDiscovery ? "new" : "concentration"
    });
    return { ok: true, message: this.state.lastMessage };
  }

  /**
   * 상점 상품 카드 한 장 = 소환 1회. 목적은 이 호출 안에서만 유효하며
   * 끝나면 원래 목적으로 되돌린다("탭을 눌러 상태를 바꾼다" 개념 제거).
   */
  summonProduct(intent: SummonIntent): ActionResult {
    if (!this.isSummonProductAvailable(intent)) {
      return {
        ok: false,
        message: isTierSummonIntent(intent)
          ? `${SUMMON_INTENT_LABELS[intent]} 소환은 이 지역·모드에서 열리지 않습니다.`
          : "계보 소환은 자형연성 모드에서만 열립니다."
      };
    }
    const previous = this.state.summonIntent;
    this.state.summonIntent = intent;
    try {
      const result = this.summon(false, SUMMON_SURCHARGE[intent]);
      if (result.ok && intent !== "balanced") {
        this.state.lastMessage = `${SUMMON_INTENT_LABELS[intent]} 소환 · ${result.message}`;
        return { ok: true, message: this.state.lastMessage };
      }
      return result;
    } finally {
      this.state.summonIntent = previous;
    }
  }

  /**
   * 캐주얼 소환의 실효 별 밴드.
   *
   * 티어 소환은 광고한 하한을 그대로 걸면 활성 풀이 좁은 지역(JP·CN)에서 후보가
   * 서너 글자로 줄어 같은 자령만 반복된다. 후보가 `MIN_TIER_POOL_SIZE` 미만이면
   * 하한을 한 단계씩 낮추고, 2★ 에서도 모자라면 밴드가 성립하지 않으므로
   * `null`(상품 미개방)이다. 하한 1인 기본 계열은 언제나 성립한다.
   */
  summonStarBand(intent: SummonIntent): SummonStarBand | null {
    const band = SUMMON_STAR_BANDS[intent];
    if (band === null || this.state.mode !== "casual") return null;
    const [requested, max] = band;
    if (requested <= 1) return { min: requested, max };
    for (let min = requested; min >= 2; min -= 1) {
      if (this.starBandCandidates(min, max).length >= MIN_TIER_POOL_SIZE) return { min, max };
    }
    return null;
  }

  /**
   * 밴드 안 후보. 특정 밴드가 통째로 비는 소형 풀(JP·CN 미리보기)에서는 상한을
   * 먼저 위로 넓히고, 그래도 없으면 하한을 아래로 넓힌다. 마지막에는 전체 풀로
   * 되돌려 소환 자체가 막히는 일이 없게 한다.
   */
  private starBandCandidates(min: number, max: number): HanziDefinition[] {
    const inRange = (low: number, high: number) => this.runSummonPool.filter((definition) => {
      const star = casualNaturalStar(definition.char) ?? 1;
      return star >= low && star <= high;
    });
    const exact = inRange(min, max);
    if (exact.length > 0) return exact;
    for (let high = max + 1; high <= 8; high += 1) {
      const widened = inRange(min, high);
      if (widened.length > 0) return widened;
    }
    for (let low = min - 1; low >= 1; low -= 1) {
      const widened = inRange(low, 8);
      if (widened.length > 0) return widened;
    }
    return [...this.runSummonPool];
  }

  /**
   * 밴드 안 별 분포를 `CASUAL_STAR_DECAY^(별 - 밴드하한)` 으로 눌러 낮은 별을 흔하게 만든다.
   *
   * 별 단위로 먼저 목표 몫을 정하고 같은 별의 글자들이 그 몫을 나눠 갖는다.
   * 글자를 하나씩 곱하기만 하면 1★ 332자와 8★ 18자처럼 칸 크기가 다른 구간에서
   * 감쇠가 글자 수 차이에 묻혀 버린다.
   */
  private applyStarBandDecay(pool: readonly HanziDefinition[], weights: number[]): void {
    const starOf = (definition: HanziDefinition) => casualNaturalStar(definition.char) ?? 1;
    let bandMin = 8;
    for (const definition of pool) bandMin = Math.min(bandMin, starOf(definition));
    const totals = new Map<number, number>();
    pool.forEach((definition, index) => {
      const weight = weights[index] ?? 0;
      if (weight <= 0) return;
      const star = starOf(definition);
      totals.set(star, (totals.get(star) ?? 0) + weight);
    });
    pool.forEach((definition, index) => {
      const weight = weights[index] ?? 0;
      if (weight <= 0) return;
      const star = starOf(definition);
      const total = totals.get(star) ?? 0;
      if (total <= 0) return;
      weights[index] = (weight / total) * Math.pow(CASUAL_STAR_DECAY, star - bandMin);
    });
  }

  /** 모드·지역별 상품 노출. 계보는 자형연성 전용, 티어는 캐주얼 + 충분한 풀 전용. */
  isSummonProductAvailable(intent: SummonIntent): boolean {
    if (isTierSummonIntent(intent)) return this.summonStarBand(intent) !== null;
    if (intent === "lineage") return this.state.mode === "standard";
    return true;
  }

  /**
   * 같은 오행·같은 별 3기를 소모했을 때 무엇을 뽑게 되는지.
   *
   * 1순위는 이번 런의 소환 풀이다 — "내가 뽑을 수 있는 글자"가 결과로 나와야
   * 규칙이 설명 가능하다. 그 오행에 상위 별 글자가 하나도 없으면(JP/CN 미리보기
   * 풀은 30·32자뿐이라 흔히 그렇다) 지역 로스터 전체로 넓혀 승급 경로를 살린다.
   * 두 단계 모두 star+1 → star+2 → … 순으로 가장 가까운 상위 별을 고른다.
   */
  casualResultPool(wuxing: Wuxing, fromStar: CasualStar): CasualResultPool | null {
    if (fromStar >= 8) return null;
    const sources: Array<{ index: Map<string, HanziDefinition[]>; rosterFallback: boolean }> = [
      { index: casualStarIndexFor(this.runSummonPool, this.runSummonPool), rosterFallback: false },
      { index: casualStarIndexFor(this.catalog.definitions, this.catalog.definitions.values()), rosterFallback: true }
    ];
    for (const source of sources) {
      for (let star = (fromStar + 1) as CasualStar; star <= 8; star = (star + 1) as CasualStar) {
        const candidates = source.index.get(`${wuxing}:${star}`);
        if (!candidates || candidates.length === 0) continue;
        return {
          star,
          candidates,
          starFallback: star !== fromStar + 1,
          rosterFallback: source.rosterFallback
        };
      }
    }
    return null;
  }

  casualFusionQuote(materialIds: readonly number[]): CasualFusionQuote {
    const quote: CasualFusionQuote = {
      materialIds: [...materialIds],
      fromStar: null,
      toStar: null,
      wuxing: null,
      poolSize: 0,
      starFallback: false,
      rosterFallback: false,
      blocked: [],
      warnings: []
    };
    if (this.state.mode !== "casual") {
      quote.blocked.push({ towerId: null, text: "별승급 진법에서만 같은 오행 3체 조합을 사용할 수 있습니다." });
      return quote;
    }
    if (materialIds.length !== 3) {
      quote.blocked.push({ towerId: null, text: "같은 오행·같은 별 자령 3기를 정확히 선택하세요." });
      return quote;
    }
    if (new Set(materialIds).size !== 3) {
      quote.blocked.push({ towerId: null, text: "서로 다른 자령 3기를 선택해야 합니다." });
      return quote;
    }
    const all = [...this.state.towers, ...this.state.inventoryTowers];
    const materials = materialIds
      .map((id) => all.find((tower) => tower.id === id))
      .filter((tower): tower is Tower => Boolean(tower));
    for (const id of materialIds) {
      if (!materials.some((tower) => tower.id === id)) quote.blocked.push({ towerId: id, text: `자령 #${id}이 이동했거나 사라졌습니다.` });
    }
    if (materials.length !== 3) return quote;

    const first = materials[0] as Tower;
    const fromStar = first.casualStar ?? first.naturalStar ?? null;
    quote.fromStar = fromStar;
    quote.wuxing = first.wuxing;
    if (fromStar === null || materials.some((tower) => (tower.casualStar ?? tower.naturalStar) === undefined)) {
      quote.blocked.push({ towerId: null, text: "선택한 자령의 별 정보를 확인할 수 없습니다." });
      return quote;
    }
    if (fromStar >= 8) {
      quote.blocked.push({ towerId: first.id, text: "8★ 자령은 더 승급할 수 없습니다." });
      return quote;
    }
    for (const material of materials) {
      if (material.wuxing !== first.wuxing) quote.blocked.push({ towerId: material.id, text: `${material.char}은 ${first.wuxing}행이 아닙니다.` });
      if ((material.casualStar ?? material.naturalStar) !== fromStar) {
        quote.blocked.push({ towerId: material.id, text: `${material.char}의 현재 별이 ${fromStar}★가 아닙니다.` });
      }
    }
    // v3 규칙 2: 보호 자령은 본체 자리가 없어졌으므로 3기 어디에도 못 들어간다.
    const context = this.casualProtectionContext();
    for (const material of materials) {
      const protection = this.casualMaterialProtectionFor(material, context);
      if (protection) {
        quote.blocked.push({ towerId: material.id, text: `${material.char} · ${protection} — 소모할 수 없습니다.`, kind: "protected" });
      }
    }
    if (quote.blocked.length > 0) return quote;

    const pool = this.casualResultPool(first.wuxing, fromStar);
    if (!pool) {
      quote.blocked.push({ towerId: null, text: `이 오행은 ${fromStar}★ 위 글자가 없습니다`, kind: "pool" });
      return quote;
    }
    quote.toStar = pool.star;
    quote.poolSize = pool.candidates.length;
    quote.starFallback = pool.starFallback;
    quote.rosterFallback = pool.rosterFallback;

    const assessmentById = new Map(this.cleanupAssessments().map((assessment) => [assessment.towerId, assessment]));
    const warningKeys = new Set<string>();
    for (const material of materials) {
      const assessment = assessmentById.get(material.id);
      for (const reason of assessment?.protectedReasons ?? []) {
        if (!reason.endsWith("공명 임계치")) continue;
        const key = `${material.id}:${reason}`;
        if (warningKeys.has(key)) continue;
        warningKeys.add(key);
        quote.warnings.push({ towerId: material.id, text: `${material.char} · ${reason}`, kind: "resonance" });
      }
      if (material.cell >= 0) {
        const key = `${material.id}:deployed`;
        if (!warningKeys.has(key)) quote.warnings.push({ towerId: material.id, text: `${material.char} · 현재 전장에 배치됨`, kind: "deployed" });
        warningKeys.add(key);
      }
    }
    return quote;
  }

  /**
   * 지금 발동 중인 사자성어에 참여하고 있는 전장 자령 id 집합.
   *
   * 두 곳이 이 집합을 쓴다.
   *  - 캐주얼 3합·정리 보호: 봉인 성어의 글자를 재료로 태우면 발동이 꺼진다.
   *  - 자동배치 자리 고정: 유지형 규칙에서는 자동배치가 이 넷을 흩뜨리면
   *    제 손으로 보너스를 끄는 셈이라 이동 후보에서 통째로 뺀다.
   * 흩어진 기록(비활성)은 지킬 줄이 없으므로 포함하지 않는다.
   */
  sealedIdiomTowerIds(): Set<number> {
    const sealedCells = new Set(this.activeIdiomSeals().flatMap((seal) => seal.cells));
    if (sealedCells.size === 0) return new Set<number>();
    return new Set(
      this.state.towers.filter((tower) => tower.cell >= 0 && sealedCells.has(tower.cell)).map((tower) => tower.id)
    );
  }

  /**
   * 이 자령을 3체 조합 재료로 쓰면 안 되는 사유. null 이면 재료로 안전하다.
   * 자동 경로의 안전 필터이자 수동 경로에서 "그 자리에서" 보여 줄 사유다.
   */
  casualMaterialProtection(towerId: number): string | null {
    const tower = [...this.state.towers, ...this.state.inventoryTowers].find((candidate) => candidate.id === towerId);
    if (!tower) return null;
    return this.casualMaterialProtectionFor(tower, this.casualProtectionContext());
  }

  /**
   * 보유 자령 전체의 보호 사유를 한 번에. 화면은 매 프레임 목록 전체를 훑으므로
   * 자령마다 casualMaterialProtection 을 부르면 합성식 조회가 그만큼 반복된다.
   * 문맥을 한 번만 만들고 재사용한다.
   */
  casualMaterialProtections(): Map<number, string> {
    const context = this.casualProtectionContext();
    const protections = new Map<number, string>();
    for (const tower of [...this.state.towers, ...this.state.inventoryTowers]) {
      const reason = this.casualMaterialProtectionFor(tower, context);
      if (reason !== null) protections.set(tower.id, reason);
    }
    return protections;
  }

  /*
   * v3 는 3기 전부를 보호 대상에서 빼므로 보호 범위가 곧 "승급이 되느냐"다.
   * v2 범위를 그대로 쓰면 JP/CN 미리보기 소환 풀(30·32자)은 성어 글자와 일반
   * 합성식 부모가 풀 전체를 덮어 한 묶음도 만들 수 없다(실측 0자 여유).
   * 그래서 캐주얼에서는 두 가지를 좁힌다.
   *  - 일반 모드 합성식: 캐주얼에는 합성 자체가 없다(availableEvolutions()=[]).
   *    쓰지도 못할 조합을 이유로 소모를 막는 것은 규칙이 아니라 사고다.
   *  - 미완성 사자성어: 지금 노리는 한 성어(currentIdiomTarget)만 지킨다.
   *    아직 순서가 오지 않은 성어까지 글자 단위로 잠글 이유가 없다.
   * 잠금·농축·목표 글자·봉인 완료 성어는 기획 문서가 못 박은 대로 그대로 둔다.
   */
  private casualProtectionContext(): {
    targetPath: Set<string>;
    unfinishedIdiomChars: Set<string>;
    standardMaterialIds: Set<number>;
    sealedTowerIds: Set<number>;
  } {
    const casual = this.state.mode === "casual";
    const all = [...this.state.towers, ...this.state.inventoryTowers];
    return {
      targetPath: casual ? new Set([this.state.targetChar]) : this.evolution.getTargetPath(this.state.targetChar),
      unfinishedIdiomChars: new Set(
        casual
          ? [...(this.currentIdiomTarget()?.chars ?? "")]
          : this.idioms()
            .filter((idiom) => !this.state.idiomSeals.some((seal) => seal.idiomId === idiom.id))
            .flatMap((idiom) => [...idiom.chars])
      ),
      standardMaterialIds: casual
        ? new Set<number>()
        : new Set(this.evolution.getAvailableRecipes(all, this.state.targetChar, null, "semi").flatMap((option) => option.materialTowerIds)),
      sealedTowerIds: this.sealedIdiomTowerIds()
    };
  }

  private casualMaterialProtectionFor(
    tower: Tower,
    context: ReturnType<GameEngine["casualProtectionContext"]>
  ): string | null {
    if (tower.locked) return "잠금 자령";
    if ((tower.concentration ?? 0) > 0) return `농축 ${tower.concentration}단계 투자`;
    if (context.targetPath.has(tower.char)) return "현재 목표 합성 계보";
    if (context.unfinishedIdiomChars.has(tower.char)) return "미완성 사자성어 재료";
    if (context.sealedTowerIds.has(tower.id)) return "발동 중 사자성어 참여";
    if (context.standardMaterialIds.has(tower.id)) return "일반 모드 합성식 재료";
    return null;
  }

  fuseCasual(materialIds: readonly number[], allowWarnings = false): CasualFusionResult {
    const fail = (message: string): CasualFusionResult =>
      ({ ok: false, message, gained: null, consumedChars: [], fromStar: null, starFallback: false, rosterFallback: false });
    if (!this.isRunActive()) return fail("진행 중인 수비전이 없습니다.");
    const quote = this.casualFusionQuote(materialIds);
    if (quote.blocked.length > 0) return fail(`조합 중단 · ${quote.blocked[0]?.text ?? "조건을 다시 확인하세요."}`);
    if (!allowWarnings && quote.warnings.length > 0) {
      return fail(`확인 필요 · ${quote.warnings[0]?.text ?? "전장 자령이 포함되어 있습니다."}`);
    }
    return this.performCasualFusion(quote);
  }

  casualAutoFusionPlan(wuxing: Wuxing): CasualAutoFusionGroup[] {
    if (this.state.mode !== "casual") return [];
    const context = this.casualProtectionContext();
    // v3: 남는 본체가 없으므로 보호 자령은 후보 목록 자체에서 빠진다.
    const owned = [...this.state.towers, ...this.state.inventoryTowers]
      .filter((tower) => tower.wuxing === wuxing
        && (tower.casualStar ?? tower.naturalStar ?? 8) < 8
        && this.casualMaterialProtectionFor(tower, context) === null);
    const value = (tower: Tower): number => {
      const definition = definitionForTower(this.catalog, tower.definitionId);
      return definition.combat.baseDamage * this.towerPowerMultiplier(tower) * definition.combat.budgetMultiplier / this.towerAttackCooldown(tower);
    };
    const groups: CasualAutoFusionGroup[] = [];
    for (let star = 1 as CasualStar; star <= 7; star = (star + 1) as CasualStar) {
      // 인벤토리 먼저, 그다음 약한 순. 전장의 주력을 마지막까지 남긴다.
      const available = owned
        .filter((tower) => (tower.casualStar ?? tower.naturalStar) === star)
        .sort((left, right) =>
          Number(left.cell >= 0) - Number(right.cell >= 0) || value(left) - value(right) || left.id - right.id);
      while (available.length >= 3) {
        const materials = available.splice(0, 3);
        const ids = materials.map((tower) => tower.id);
        const quote = this.casualFusionQuote(ids);
        if (quote.blocked.length > 0 || quote.toStar === null) break;
        groups.push({
          wuxing,
          materialIds: [ids[0] ?? -1, ids[1] ?? -1, ids[2] ?? -1],
          fromStar: star,
          toStar: quote.toStar,
          poolSize: quote.poolSize,
          starFallback: quote.starFallback,
          rosterFallback: quote.rosterFallback,
          warnings: quote.warnings,
          autoSkipReason: casualAutoSkipReason(quote.warnings)
        });
      }
    }
    return groups;
  }

  autoFuseCasualElement(wuxing: Wuxing, allowWarnings = false): CasualAutoFusionReport {
    return this.autoFuseCasual(wuxing, allowWarnings);
  }

  /**
   * 원클릭 승급. `scope` 가 "all" 이면 오행 전체를 순서대로 처리한다.
   * warning 이 있는 묶음은 예전처럼 전체를 중단시키지 않고 그 묶음만 건너뛰며,
   * 건너뛴 수와 사유를 결과에 담아 화면이 반드시 알릴 수 있게 한다.
   */
  autoFuseCasual(scope: Wuxing | "all", allowWarnings = false, onlyStar: CasualStar | null = null): CasualAutoFusionReport {
    const empty = { fused: 0, consumed: 0, skipped: 0, skipReason: null, gained: [], firstFusion: null } as const;
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다.", ...empty, gained: [] };
    const scopes: Wuxing[] = scope === "all" ? [...WUXING_ORDER] : [scope];
    const planned = scopes
      .flatMap((wuxing) => this.casualAutoFusionPlan(wuxing))
      .filter((group) => onlyStar === null || group.fromStar === onlyStar);
    if (planned.length === 0) {
      const label = scope === "all" ? "보유 자령" : `${scope}행 보유 자령`;
      return { ok: false, message: `${label} 중 소모할 수 있는 같은 별 자령 3기가 없습니다.`, ...empty, gained: [] };
    }
    const runnable = allowWarnings ? planned : planned.filter((group) => group.autoSkipReason === null);
    let skipped = planned.length - runnable.length;
    const skipReason = planned.find((group) => group.autoSkipReason !== null)?.autoSkipReason ?? null;
    if (runnable.length === 0) {
      return {
        ok: false,
        message: `보호로 ${skipped}묶음을 모두 건너뜀 · ${skipReason ?? "소모 후보가 보호 대상입니다."}`,
        ...empty,
        gained: [],
        skipped,
        skipReason
      };
    }

    let fused = 0;
    let fromBoard = 0;
    const gained: CasualFusionGain[] = [];
    let firstFusion: CasualAutoFusionReport["firstFusion"] = null;
    for (const group of runnable) {
      const quote = this.casualFusionQuote(group.materialIds);
      // 앞선 승급이 성어 봉인을 새로 만들면 뒤 묶음이 보호로 막힐 수 있다.
      // 전체를 중단하지 않고 그 묶음만 건너뛴다.
      if (quote.blocked.length > 0) {
        skipped += 1;
        continue;
      }
      const all = [...this.state.towers, ...this.state.inventoryTowers];
      const consumedTowers = group.materialIds
        .map((id) => all.find((tower) => tower.id === id))
        .filter((tower): tower is Tower => tower !== undefined);
      const boardCount = consumedTowers.filter((tower) => tower.cell >= 0).length;
      const result = this.performCasualFusion(quote);
      if (!result.ok || !result.gained) {
        skipped += 1;
        continue;
      }
      fused += 1;
      fromBoard += boardCount;
      gained.push(result.gained);
      if (!firstFusion) {
        firstFusion = {
          wuxing: result.gained.wuxing,
          char: result.gained.char,
          fromStar: group.fromStar,
          toStar: result.gained.star,
          consumedChars: result.consumedChars,
          newDiscovery: result.gained.newDiscovery,
          starFallback: result.starFallback,
          rosterFallback: result.rosterFallback
        };
      }
    }
    if (fused === 0) return { ok: false, message: "조합 대상이 바뀌었습니다. 다시 확인하세요.", ...empty, gained: [], skipped, skipReason };

    const tail = skipped > 0 ? ` · 보호로 ${skipped}그룹 건너뜀` : "";
    if (fused === 1 && firstFusion) {
      this.state.lastMessage = `${casualFusionHeadline(firstFusion)} · 소모: ${firstFusion.consumedChars.join("·")}${tail}`;
    } else {
      const chars = gained.map((entry) => entry.char).join("·");
      const newCount = gained.filter((entry) => entry.newDiscovery).length;
      const detail = firstFusion ? ` · 첫 결과 ${casualFusionHeadline(firstFusion)}` : "";
      const board = fromBoard > 0 ? ` · 전장 ${fromBoard}기 포함` : "";
      this.state.lastMessage = `승급 ${fused}회 · 소모 ${fused * 3}기 · 획득: ${chars}${newCount > 0 ? ` · 첫 발견 ${newCount}` : ""}${detail}${board}${tail}`;
    }
    return { ok: true, message: this.state.lastMessage, fused, consumed: fused * 3, skipped, skipReason, gained, firstFusion };
  }

  private performCasualFusion(quote: CasualFusionQuote): CasualFusionResult {
    const fail = (message: string): CasualFusionResult =>
      ({ ok: false, message, gained: null, consumedChars: [], fromStar: quote.fromStar, starFallback: false, rosterFallback: false });
    if (quote.fromStar === null || quote.toStar === null || quote.wuxing === null) return fail("조합 별 정보를 다시 확인하세요.");
    const all = [...this.state.towers, ...this.state.inventoryTowers];
    const consumed = quote.materialIds
      .map((id) => all.find((tower) => tower.id === id))
      .filter((tower): tower is Tower => Boolean(tower));
    if (consumed.length !== 3) return fail("조합 대상이 바뀌었습니다. 다시 선택하세요.");
    const pool = this.casualResultPool(quote.wuxing, quote.fromStar);
    if (!pool) return fail(`이 오행은 ${quote.fromStar}★ 위 글자가 없습니다`);
    const definition = pool.candidates[Math.floor(this.rng.next() * pool.candidates.length)] ?? pool.candidates[0] as HanziDefinition;

    // 규칙 3: 소모분 중 전장에 서 있던 첫 자령의 자리를 새 자령이 이어받는다.
    const inheritedCell = consumed.find((tower) => tower.cell >= 0)?.cell ?? -1;
    const consumedChars = consumed.map((tower) => tower.char);
    const consumedSnapshots = consumed.map((tower) => ({ ...tower }));
    const consumedIds = new Set(consumed.map((tower) => tower.id));
    const refunds = emptyElementEssence();
    for (const tower of consumed) refunds[tower.wuxing] += concentrationEssenceRefund(tower.concentration ?? 0);
    this.state.towers = this.state.towers.filter((tower) => !consumedIds.has(tower.id));
    this.state.inventoryTowers = this.state.inventoryTowers.filter((tower) => !consumedIds.has(tower.id));
    for (const wuxing of Object.keys(refunds) as Wuxing[]) this.state.elementEssence[wuxing] += refunds[wuxing];

    // 삼체일득 문기. 승급이 분해 대기열을 통째로 먹는 구조라 승급 자체를 문기
    // 입구로 삼는다. 농축 환급과 달리 이것은 새로 생기는 문기이므로 생성량에도
    // 함께 적는다(분해 점수도 같이 올라야 오행 특성이 열린다).
    const fusionEssence = casualFusionEssenceRefund(quote.fromStar);
    if (fusionEssence > 0) {
      this.state.elementEssence[quote.wuxing] += fusionEssence;
      this.state.elementEssenceGenerated[quote.wuxing] += fusionEssence;
      this.state.elementDismantleScore[quote.wuxing] += casualFusionDismantleScore(quote.fromStar);
    }

    const newDiscovery = !this.state.discoveredChars.includes(definition.char);
    const tower = this.createTower(definition, inheritedCell);
    tower.pulse = 1;
    tower.abilityFlash = 1;
    if (inheritedCell >= 0) this.state.towers.push(tower);
    else this.state.inventoryTowers.push(tower);
    this.state.selectedTowerId = tower.id;
    this.state.casualFusionCount += 1;
    this.discover(definition.char);

    const gained: CasualFusionGain = {
      wuxing: tower.wuxing,
      char: tower.char,
      star: pool.star,
      cell: inheritedCell,
      newDiscovery
    };
    const stroke = casualStrokeCount(tower.char);
    const headline = casualFusionHeadline({
      wuxing: quote.wuxing,
      char: tower.char,
      fromStar: quote.fromStar,
      toStar: pool.star,
      newDiscovery,
      starFallback: pool.starFallback,
      rosterFallback: pool.rosterFallback
    });
    this.state.lastMessage = `${headline} · 소모: ${consumedChars.join("·")}${stroke === null ? "" : ` · ${stroke}획`}`;
    this.events.push({
      type: "casualFuse",
      at: inheritedCell >= 0 ? BOARD_CELLS[inheritedCell] as Point : { x: 440, y: 360 },
      tower: { ...tower },
      consumed: consumedSnapshots,
      fromStar: quote.fromStar,
      toStar: pool.star,
      newDiscovery,
      starFallback: pool.starFallback,
      rosterFallback: pool.rosterFallback
    });
    // F2: 별승급의 목표 사다리는 소환만이 아니라 승급으로도 오른다. 목표 글자가
    // 승급 결과로 나왔는데 달성 처리가 안 되면 상위 별 목표는 원리적으로 못 깬다.
    if (definition.char === this.state.targetChar) this.completeGoal(definition.char);
    // 유지형 규칙에서는 소모된 재료가 판을 떠난 것만으로도 봉인이 흩어질 수 있다.
    // 승급 결과가 보관고로 갔더라도(inheritedCell < 0) 판정은 다시 해야 한다.
    if (this.isRunActive()) this.resolveIdiomFormations();
    return {
      ok: true,
      message: this.state.lastMessage,
      gained,
      consumedChars,
      fromStar: quote.fromStar,
      starFallback: pool.starFallback,
      rosterFallback: pool.rosterFallback
    };
  }

  availableEvolutions(): EvolutionOption[] {
    if (this.state.mode === "casual") return [];
    return this.evolution.getAvailableRecipes(
      [...this.state.towers, ...this.state.inventoryTowers],
      this.state.targetChar,
      this.state.selectedTowerId,
      this.state.automationMode
    );
  }

  compositionBranchesForSelected(): CompositionBranchPreview[] {
    if (this.state.mode === "casual") return [];
    const selected = this.selectedTower();
    if (!selected) return [];
    return this.evolution.getDerivativeRecipes(
      selected.char,
      [...this.state.towers, ...this.state.inventoryTowers],
      this.state.targetChar,
      selected.id
    );
  }

  evolve(recipeId: string): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    if (this.state.mode === "casual") return { ok: false, message: "별승급 진법에서는 같은 오행·별 3기를 모아 다음 별 자령을 얻습니다." };
    const option = this.availableEvolutions().find((candidate) => candidate.recipeId === recipeId);
    if (!option) return { ok: false, message: "현재 보유한 자령으로 그 합성을 만들 수 없습니다." };
    const ownedTowers = [...this.state.towers, ...this.state.inventoryTowers];
    const materials = option.materialTowerIds
      .map((id) => ownedTowers.find((tower) => tower.id === id))
      .filter((tower): tower is Tower => Boolean(tower));
    if (materials.length !== option.parents.length) return { ok: false, message: "합성 재료가 바뀌었습니다. 다시 선택하세요." };
    if (materials.some((tower) => tower.locked)) return { ok: false, message: "잠긴 자령은 합성 재료로 사용할 수 없습니다." };
    const boardMaterial = materials.find((tower) => tower.cell >= 0);
    const cell = boardMaterial?.cell ?? -1;
    const concentrationRefunds = emptyElementEssence();
    for (const material of materials) concentrationRefunds[material.wuxing] += concentrationEssenceRefund(material.concentration ?? 0);
    for (const wuxing of Object.keys(concentrationRefunds) as Wuxing[]) this.state.elementEssence[wuxing] += concentrationRefunds[wuxing];
    const removedIds = new Set(option.materialTowerIds);
    this.state.towers = this.state.towers.filter((tower) => !removedIds.has(tower.id));
    this.state.inventoryTowers = this.state.inventoryTowers.filter((tower) => !removedIds.has(tower.id));
    const evolved = this.createTower(option.result, cell);
    if (cell >= 0) this.state.towers.push(evolved);
    else this.state.inventoryTowers.push(evolved);
    this.state.selectedTowerId = evolved.id;
    this.state.evolutionCount += 1;
    this.discover(option.result.char);

    const idiomGold = this.idiomBonus("evolutionGold");
    if (idiomGold > 0) this.state.gold += idiomGold;

    const targetCompleted = option.result.char === this.state.targetChar;
    const refundLabel = (Object.entries(concentrationRefunds) as Array<[Wuxing, number]>).filter(([, amount]) => amount > 0).map(([wuxing, amount]) => `${wuxing}${amount}`).join("·");
    this.state.lastMessage = option.parents.join(" + ") + " → " + option.result.char + " 합성 완성" + (idiomGold > 0 ? " · 온고지신 +" + String(idiomGold) + "엽전" : "") + (refundLabel ? ` · 농축 문기 ${refundLabel} 환급` : "");
    this.events.push({
      type: "evolve",
      at: cell >= 0 ? BOARD_CELLS[cell] as Point : { x: 440, y: 360 },
      tower: { ...evolved },
      parents: [...option.parents],
      targetCompleted
    });
    if (targetCompleted) this.completeGoal(option.result.char);
    this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  private completeGoal(char: string): void {
    if (this.state.goalsCompleted.includes(char)) return;
    this.state.goalsCompleted.push(char);
    const reward = goalRewardForWave(this.state.wave);
    this.state.gold += reward;
    this.state.lineageClueProgress = 0;
    this.state.lineageTargetProgress = 0;
    this.events.push({ type: "goal", char, reward });
    const next = this.goalOrder.find((candidate) => !this.state.goalsCompleted.includes(candidate));
    if (next) {
      this.state.targetChar = next;
      this.state.lastMessage = char + " 목표 달성 · " + String(reward) + "엽전 · 다음 목표 " + next;
    } else {
      this.state.lastMessage = char + " 목표 달성 · 지역 목표를 모두 완성했습니다!";
    }
  }

  goalProgress(): GoalProgress {
    return this.goalProgressFor(this.state.targetChar);
  }

  goalProgressFor(char: string): GoalProgress {
    if (this.state.mode === "casual") {
      const target = this.catalog.definitions.get(char);
      if (!target) return this.evolution.getGoalProgress([...this.state.towers, ...this.state.inventoryTowers], this.state.targetChar);
      const owned = [...this.state.towers, ...this.state.inventoryTowers].filter((tower) => tower.char === char).length;
      return {
        target,
        directMaterials: [{ char, owned, needed: 1 }],
        ownedNodes: owned > 0 ? [char] : [],
        craftableNodes: [],
        progress: Math.min(1, owned)
      };
    }
    return this.evolution.getGoalProgress([...this.state.towers, ...this.state.inventoryTowers], char);
  }

  setAutomationMode(mode: AutomationMode): ActionResult {
    this.state.automationMode = mode;
    this.state.selectedTowerId = mode === "manual" ? this.state.selectedTowerId : null;
    const labels: Record<AutomationMode, string> = { manual: "수동", semi: "반자동", goal: "목표 자동" };
    this.state.lastMessage = "합성 방식 · " + labels[mode];
    return { ok: true, message: this.state.lastMessage };
  }

  setTarget(char: string): ActionResult {
    const definition = this.catalog.definitions.get(char);
    if (!definition) return { ok: false, message: "이 지역에서 사용할 수 없는 한자입니다." };
    if (this.state.targetChar !== char) {
      this.state.lineageClueProgress = Math.floor(this.state.lineageClueProgress / 2);
      this.state.lineageTargetProgress = Math.floor(this.state.lineageTargetProgress / 2);
    }
    this.state.targetChar = char;
    this.runSummonPool = this.buildRunSummonPool();
    this.state.lastMessage = `목표 한자를 ${char}로 변경했습니다. · ${definition.acquisition === "craft" ? "합성 경로 추적" : "직접 소환 추적"}`;
    return { ok: true, message: this.state.lastMessage };
  }

  setIdiomTarget(id: string): ActionResult {
    const idiom = idiomById(this.state.region, id);
    if (!idiom) return { ok: false, message: "이 지역에서 사용할 수 없는 성어입니다." };
    if (this.state.idiomSeals.some((seal) => seal.idiomId === id)) return { ok: false, message: `${idiom.reading}은 이미 봉인했습니다.` };
    const currentIds = this.state.featuredIdiomIds.filter((candidate) => candidate !== id);
    const sealedIds = currentIds.filter((candidate) => this.state.idiomSeals.some((seal) => seal.idiomId === candidate));
    const pendingIds = currentIds.filter((candidate) => !sealedIds.includes(candidate));
    this.state.featuredIdiomIds = [id, ...sealedIds, ...pendingIds].slice(0, 5);
    this.state.lineageClueProgress = Math.floor(this.state.lineageClueProgress / 2);
    this.runSummonPool = this.buildRunSummonPool();
    this.state.lastMessage = `성어 목표를 ${idiom.chars} · ${idiom.reading}으로 변경했습니다.`;
    return { ok: true, message: this.state.lastMessage };
  }

  idiomProgress(id: string): { owned: number; total: number; readiness: number; missingChars: string[] } {
    const idiom = idiomById(this.state.region, id);
    if (!idiom) return { owned: 0, total: 4, readiness: 0, missingChars: [] };
    const counts = new Map<string, number>();
    for (const tower of [...this.state.towers, ...this.state.inventoryTowers]) {
      counts.set(tower.char, (counts.get(tower.char) ?? 0) + 1);
    }
    let owned = 0;
    let readiness = 0;
    const missingChars: string[] = [];
    for (const char of idiom.chars) {
      const exact = counts.get(char) ?? 0;
      if (exact > 0) {
        counts.set(char, exact - 1);
        owned += 1;
        readiness += 1;
      } else {
        missingChars.push(char);
        readiness += this.evolution.getGoalProgress([...this.state.towers, ...this.state.inventoryTowers], char).progress;
      }
    }
    return { owned, total: [...idiom.chars].length, readiness: readiness / Math.max(1, [...idiom.chars].length), missingChars };
  }

  upgradeResearch(): ActionResult {
    if (this.state.researchLevel >= 5) return { ok: false, message: "인연 연구가 최고 단계입니다." };
    const unlockWave = researchUnlockWave(this.state.researchLevel);
    if (this.state.wave < unlockWave) return { ok: false, message: `인연 연구 ${this.state.researchLevel + 1}단계는 ${unlockWave}웨이브에 개방됩니다.` };
    const cost = researchCost(this.state.researchLevel);
    if (this.state.gold < cost) return { ok: false, message: "연구에 엽전 " + String(cost) + "이 필요합니다." };
    this.state.gold -= cost;
    this.state.researchLevel += 1;
    this.state.lastMessage = "인연 연구 " + String(this.state.researchLevel) + "단계 · 목표 재료 가중치 상승";
    return { ok: true, message: this.state.lastMessage };
  }

  selectTower(id: number | null): void {
    const exists = id !== null && [...this.state.towers, ...this.state.inventoryTowers].some((tower) => tower.id === id);
    this.state.selectedTowerId = exists ? id : null;
  }

  private quoteUpgrade(
    fromLevel: number,
    amount: number | "max",
    available: number,
    costAtLevel: (level: number) => number
  ): UpgradeQuote {
    const remaining = Math.max(0, MAX_UPGRADE_LEVEL - fromLevel);
    const requested = amount === "max" ? remaining : Math.max(0, Math.min(remaining, Math.floor(amount)));
    let levels = 0;
    let cost = 0;
    for (let offset = 0; offset < requested; offset += 1) {
      const nextCost = costAtLevel(fromLevel + offset);
      if (amount === "max" && cost + nextCost > available) break;
      cost += nextCost;
      levels += 1;
    }
    return {
      fromLevel,
      toLevel: fromLevel + levels,
      levels,
      cost,
      affordable: levels > 0 && available >= cost
    };
  }

  quoteGlobalUpgrade(stat: UpgradeStat, amount: number | "max" = 1): UpgradeQuote {
    return this.quoteUpgrade(this.state.globalUpgrades[stat], amount, this.state.gold, (level) => globalUpgradeCost(stat, level));
  }

  upgradeGlobal(stat: UpgradeStat, amount: number | "max" = 1): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const meta = UPGRADE_STAT_META[stat];
    const quote = this.quoteGlobalUpgrade(stat, amount);
    if (quote.fromLevel >= MAX_UPGRADE_LEVEL) return { ok: false, message: `공용 ${meta.label} 강화가 최고 단계입니다.` };
    if (quote.levels <= 0 || !quote.affordable) return { ok: false, message: `공용 ${meta.label} 강화에 엽전 ${quote.cost || globalUpgradeCost(stat, quote.fromLevel)}이 필요합니다.` };
    this.state.gold -= quote.cost;
    this.state.globalUpgrades[stat] = quote.toLevel;
    const bonus = this.globalUpgradeBonus(stat);
    this.state.lastMessage = `공용 ${meta.label} ${quote.toLevel}단계 · ${quote.levels}회 투자 · ${this.formatUpgradeBonus(stat, bonus)}`;
    this.events.push({ type: "statUpgrade", scope: "global", wuxing: null, stat, level: quote.toLevel, cost: quote.cost, bonus });
    return { ok: true, message: this.state.lastMessage };
  }

  quoteElementUpgrade(wuxing: Wuxing, stat: UpgradeStat, amount: number | "max" = 1): UpgradeQuote {
    return this.quoteUpgrade(this.state.elementUpgrades[wuxing][stat], amount, this.state.elementEssence[wuxing], elementUpgradeCost);
  }

  upgradeElement(wuxing: Wuxing, stat: UpgradeStat = "damage", amount: number | "max" = 1): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const meta = UPGRADE_STAT_META[stat];
    const quote = this.quoteElementUpgrade(wuxing, stat, amount);
    if (quote.fromLevel >= MAX_UPGRADE_LEVEL) return { ok: false, message: `${wuxing}행 ${meta.label} 강화가 최고 단계입니다.` };
    if (quote.levels <= 0 || !quote.affordable) return { ok: false, message: `${wuxing}행 ${meta.label} 강화에 ${wuxing} 문기 ${quote.cost || elementUpgradeCost(quote.fromLevel)}가 필요합니다.` };
    this.state.elementEssence[wuxing] -= quote.cost;
    this.state.elementEssenceSpent[wuxing] += quote.cost;
    this.state.elementUpgrades[wuxing][stat] = quote.toLevel;
    const bonus = this.elementUpgradeBonus(wuxing, stat);
    this.state.lastMessage = `${wuxing}행 ${meta.label} ${quote.toLevel}단계 · ${quote.levels}회 투자 · ${this.formatUpgradeBonus(stat, bonus)}`;
    this.events.push({ type: "statUpgrade", scope: "element", wuxing, stat, level: quote.toLevel, cost: quote.cost, bonus });
    return { ok: true, message: this.state.lastMessage };
  }

  quoteElementTraitUpgrade(wuxing: Wuxing, traitIndex: number, amount: number | "max" = 1): UpgradeQuote {
    const level = this.elementTraitLevel(wuxing, traitIndex);
    const remaining = Math.max(0, ELEMENT_TRAIT_MAX_LEVEL - level);
    const requested = amount === "max" ? remaining : Math.max(0, Math.min(remaining, Math.floor(amount)));
    let levels = 0;
    let cost = 0;
    for (let offset = 0; offset < requested; offset += 1) {
      const nextCost = elementTraitUpgradeCost(level + offset);
      if (nextCost === null) break;
      if (amount === "max" && cost + nextCost > this.state.elementEssence[wuxing]) break;
      cost += nextCost;
      levels += 1;
    }
    return { fromLevel: level, toLevel: level + levels, levels, cost, affordable: levels > 0 && this.state.elementEssence[wuxing] >= cost };
  }

  upgradeElementTrait(wuxing: Wuxing, traitIndex: number, amount: number | "max" = 1): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const unlockScore = elementTraitUnlockScore(traitIndex);
    if (unlockScore === null) return { ok: false, message: "존재하지 않는 오행 특성입니다." };
    if (this.state.elementDismantleScore[wuxing] < unlockScore) {
      return { ok: false, message: `${wuxing}행 분해 점수 ${unlockScore}에서 개방됩니다. (현재 ${this.state.elementDismantleScore[wuxing]})` };
    }
    const quote = this.quoteElementTraitUpgrade(wuxing, traitIndex, amount);
    if (quote.fromLevel >= ELEMENT_TRAIT_MAX_LEVEL) return { ok: false, message: `${wuxing}행 고유 특성이 최고 단계입니다.` };
    const nextCost = elementTraitUpgradeCost(quote.fromLevel) ?? 0;
    if (quote.levels <= 0 || !quote.affordable) return { ok: false, message: `${wuxing}행 고유 특성 강화에 문기 ${quote.cost || nextCost}가 필요합니다.` };
    this.state.elementEssence[wuxing] -= quote.cost;
    this.state.elementEssenceSpent[wuxing] += quote.cost;
    this.state.elementTraits[wuxing][traitIndex] = quote.toLevel;
    this.state.lastMessage = `${wuxing}행 고유 특성 ${traitIndex + 1} · ${quote.toLevel}/10단계 (${quote.levels}회 투자)`;
    this.events.push({ type: "traitUpgrade", wuxing, traitIndex, level: quote.toLevel, cost: quote.cost });
    return { ok: true, message: this.state.lastMessage };
  }

  elementTraitLevel(wuxing: Wuxing, traitIndex: number): number {
    return this.state.elementTraits[wuxing][traitIndex] ?? 0;
  }

  globalUpgradeBonus(stat: UpgradeStat): number {
    // FB7-강화: 10단계 이정표마다 4단계치(공용 공격력 기준 +5%p)를 더 얹는다.
    return upgradeEffectiveLevels(this.state.globalUpgrades[stat]) * UPGRADE_STAT_META[stat].globalPerLevel;
  }

  elementUpgradeBonus(wuxing: Wuxing, stat: UpgradeStat): number {
    return upgradeEffectiveLevels(this.state.elementUpgrades[wuxing][stat]) * UPGRADE_STAT_META[stat].elementPerLevel;
  }

  combinedUpgradeBonus(wuxing: Wuxing, stat: UpgradeStat): number {
    return this.globalUpgradeBonus(stat) + this.elementUpgradeBonus(wuxing, stat);
  }

  towerAttackCooldown(tower: Tower): number {
    const profile = definitionForTower(this.catalog, tower.definitionId).combat;
    const concentration = tower.concentration ?? 0;
    const concentrationHaste = tower.concentrationPath === "swift" ? concentration * 0.075 : concentration * 0.02;
    const upgradeHaste = this.combinedUpgradeBonus(tower.wuxing, "attackSpeed");
    // 수술 7: 캐주얼 공속 성장 별당 2% → 3%. 별이 오르면 실제로 빨라진다.
    const progressionHaste = this.state.mode === "casual"
      ? ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * CASUAL_STAR_HASTE_PER_STAR
      : (tower.stage - 1) * 0.035;
    return Math.max(0.28, profile.cooldown * (1 - progressionHaste) * (1 - concentrationHaste) / (1 + upgradeHaste));
  }

  towerPowerMultiplier(tower: Tower): number {
    return this.state.mode === "casual"
      ? CASUAL_STAR_POWER[tower.casualStar ?? tower.naturalStar ?? 1]
      : STAGE_MULTIPLIERS[tower.stage];
  }

  /**
   * FB7-8성 「극성 개안」: 이 오행에 8★ 오라가 살아 있는가. 전장(towers)에
   * 8★ 자령이 서 있으면 참이다 — 인벤토리 자령은 오라를 내지 않는다.
   */
  casualPolarisAuraActive(wuxing: Wuxing): boolean {
    return this.state.mode === "casual"
      && this.state.towers.some((tower) => (tower.casualStar ?? tower.naturalStar) === CASUAL_POLARIS_AURA.star && tower.wuxing === wuxing);
  }

  /** 극성 개안이 이 오행의 공격에 곱하는 배율. 오라가 없으면 1이다. */
  casualPolarisDamageMultiplier(wuxing: Wuxing): number {
    return this.casualPolarisAuraActive(wuxing) ? 1 + CASUAL_POLARIS_AURA.damageBonus : 1;
  }

  /**
   * 광역 계열(화행 폭발·역할 확산·잔화 지대)의 반경에 곱하는 캐주얼 별 스케일.
   * 표준 모드는 tuning 이 이미 stage 로 스케일하므로 1이다.
   */
  casualSplashRadiusScale(tower: Tower): number {
    if (this.state.mode !== "casual") return 1;
    return 1 + ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * CASUAL_SPLASH_STAR_SCALE.radiusPerStar;
  }

  /** 광역 계열 확산비(splashRatio·roleSplashRatio)에 곱하는 캐주얼 별 스케일. */
  casualSplashRatioScale(tower: Tower): number {
    if (this.state.mode !== "casual") return 1;
    return 1 + ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * CASUAL_SPLASH_STAR_SCALE.ratioPerStar;
  }

  towerRangeBonus(tower: Tower): number {
    // 수술 7: 저별은 좁게, 별당 성장은 크게(기본 −18 · 별당 +8, 스프레드 56).
    // 예전 +(별-1)×3 은 1★→8★ 차이가 +21 뿐이라 성장감이 없었다.
    return this.state.mode === "casual"
      ? CASUAL_STAR_RANGE.base + ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * CASUAL_STAR_RANGE.perStar
      : (tower.stage - 1) * 7;
  }

  towerHasActiveSkills(tower: Tower): boolean {
    if (this.state.mode === "casual") return (tower.casualStar ?? tower.naturalStar ?? 1) >= 2;
    return hasActiveSkills(definitionForTower(this.catalog, tower.definitionId));
  }

  towerDismantleEssenceValue(tower: Tower): number {
    if (this.state.mode === "standard") return dismantleEssenceValue(tower.stage, tower.concentration ?? 0);
    const base = casualDismantleEssence(tower.casualStar ?? tower.naturalStar ?? 1);
    return base + concentrationEssenceRefund(tower.concentration ?? 0);
  }

  towerDismantleScore(tower: Tower): number {
    if (this.state.mode === "standard") return dismantleScoreForStage(tower.stage);
    return casualDismantleScore(tower.casualStar ?? tower.naturalStar ?? 1);
  }

  towerSellValue(tower: Tower): number {
    if (this.state.mode === "standard") return sellValue(tower.stage);
    return [0, 3, 4, 5, 7, 9, 12, 16, 22][tower.casualStar ?? tower.naturalStar ?? 1] ?? 3;
  }

  elementDamageBonus(wuxing: Wuxing): number {
    return this.elementUpgradeBonus(wuxing, "damage");
  }

  private formatUpgradeBonus(stat: UpgradeStat, bonus: number): string {
    return stat === "range" ? `사거리 +${bonus.toFixed(1)}` : `${UPGRADE_STAT_META[stat].label} +${(bonus * 100).toFixed(1)}%`;
  }

  moveSelectedToCell(cell: number): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "먼저 자령을 선택하세요." };
    if (cell < 0 || cell >= GAME_CONFIG.maxBoardSize) return { ok: false, message: "잘못된 소환진 칸입니다." };
    if (!this.isCellUnlocked(cell)) return { ok: false, message: `${Math.floor(cell / CELLS_PER_FORMATION) + 1}번째 오행진은 아직 봉인되어 있습니다.` };
    const occupant = this.state.towers.find((tower) => tower.cell === cell);
    const inventoryIndex = this.state.inventoryTowers.findIndex((tower) => tower.id === selected.id);
    if (inventoryIndex >= 0) {
      this.state.inventoryTowers.splice(inventoryIndex, 1);
      if (occupant) {
        this.state.towers = this.state.towers.filter((tower) => tower.id !== occupant.id);
        occupant.cell = -1;
        this.state.inventoryTowers.push(occupant);
      } else if (this.state.towers.length >= this.deployedTowerCapacity()) {
        this.state.inventoryTowers.push(selected);
        return { ok: false, message: `현재 개방된 오행진 ${this.deployedTowerCapacity()}칸이 모두 찼습니다. 교체할 칸을 클릭하세요.` };
      }
      selected.cell = cell;
      this.state.towers.push(selected);
      this.state.lastMessage = occupant
        ? `${selected.char} 배치 · ${occupant.char} 인벤토리로 원자 교체`
        : selected.char + " 인벤토리 → " + String(cell + 1) + "번 칸 배치";
      this.resolveIdiomFormations();
      return { ok: true, message: this.state.lastMessage };
    }
    if (occupant) {
      this.selectTower(occupant.id);
      return { ok: true, message: occupant.char + " 선택" };
    }
    selected.cell = cell;
    this.state.lastMessage = selected.char + " 재배치";
    this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  relocateSelectedToCell(cell: number): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "옮길 자령을 선택하세요." };
    if (this.state.inventoryTowers.some((tower) => tower.id === selected.id)) return this.moveSelectedToCell(cell);
    if (cell < 0 || cell >= GAME_CONFIG.maxBoardSize) return { ok: false, message: "잘못된 소환진 칸입니다." };
    if (!this.isCellUnlocked(cell)) return { ok: false, message: "아직 봉인된 오행진입니다." };
    const occupant = this.state.towers.find((tower) => tower.cell === cell);
    if (occupant?.id === selected.id) return { ok: true, message: selected.char + " 선택" };
    if (occupant) {
      const previousCell = selected.cell;
      selected.cell = occupant.cell;
      occupant.cell = previousCell;
      this.state.lastMessage = selected.char + " ↔ " + occupant.char + " 자리 교환";
    } else {
      selected.cell = cell;
      this.state.lastMessage = selected.char + " 재배치";
    }
    this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  autoArrangeTowers(): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    if (this.state.towers.length === 0 && this.state.inventoryTowers.length === 0) return { ok: false, message: "자동배치할 자령이 없습니다." };

    const originalCells = new Map([...this.state.towers, ...this.state.inventoryTowers].map((tower) => [tower.id, tower.cell]));
    const sealedBefore = this.activeIdiomSeals().length;
    const resonanceBefore = BOARD_FORMATIONS.reduce((sum, _, index) => sum + this.formationResonance(index).tier, 0);
    const occupiedCells = new Set(this.state.towers.map((tower) => tower.cell));
    const emptyCells = BOARD_CELLS.map((_, index) => index).filter((cell) => this.isCellUnlocked(cell) && !occupiedCells.has(cell));
    const deployed = this.state.inventoryTowers.splice(0, emptyCells.length);
    for (let index = 0; index < deployed.length; index += 1) {
      const tower = deployed[index] as Tower;
      tower.cell = emptyCells[index] as number;
      this.state.towers.push(tower);
    }

    // 발동 중인 봉인의 네 자령은 자리 고정이다. 새 봉인을 하나 세울 때마다
    // 고정 집합이 늘어나므로 매 바퀴 다시 읽는다.
    let pinned = this.sealedIdiomTowerIds();
    for (let guard = 0; guard < this.idioms().length; guard += 1) {
      const idiom = this.idioms().find((candidate) =>
        !this.isIdiomSealActive(candidate.id)
        && this.towersForIdiom(candidate, pinned) !== null
      );
      if (!idiom) break;
      const chosen = this.towersForIdiom(idiom, pinned);
      if (!chosen) break;
      this.placeIdiomTowers(chosen, pinned);
      if (this.resolveIdiomFormations() === 0) break;
      pinned = this.sealedIdiomTowerIds();
    }

    this.optimizeFormationCells(pinned);
    this.resolveIdiomFormations();

    const sealed = this.activeIdiomSeals().length - sealedBefore;
    const resonanceAfter = BOARD_FORMATIONS.reduce((sum, _, index) => sum + this.formationResonance(index).tier, 0);
    const moved = this.state.towers.filter((tower) => originalCells.get(tower.id) !== tower.cell).length;
    if (sealed === 0 && moved === 0) {
      this.state.lastMessage = "자동배치 · 이미 최적입니다. 다음 성어 재료를 모아 보세요.";
      return { ok: true, message: this.state.lastMessage };
    }
    const idiomLabel = sealed > 0 ? `성어 ${sealed}개 봉인 · ` : "";
    const inventoryLabel = deployed.length > 0 ? `인벤토리 ${deployed.length}기 투입 · ` : "";
    this.state.lastMessage = `자동배치 · ${inventoryLabel}${idiomLabel}오행 공명 ${resonanceBefore}→${resonanceAfter}단계 · ${moved}기 이동`;
    return { ok: true, message: this.state.lastMessage };
  }

  private towersForIdiom(idiom: IdiomDefinition, pinned: ReadonlySet<number> = new Set()): Tower[] | null {
    const used = new Set<number>();
    const chosen: Tower[] = [];
    for (const char of idiom.chars) {
      const tower = this.state.towers
        .filter((candidate) => candidate.char === char && !used.has(candidate.id) && !pinned.has(candidate.id))
        .sort((left, right) => left.cell - right.cell || left.id - right.id)[0];
      if (!tower) return null;
      chosen.push(tower);
      used.add(tower.id);
    }
    return chosen;
  }

  private placeIdiomTowers(chosen: readonly Tower[], pinned: ReadonlySet<number> = new Set()): void {
    const pinnedCells = new Set(this.state.towers.filter((tower) => pinned.has(tower.id)).map((tower) => tower.cell));
    const rowsFor = (startCell: number): number[][] =>
      Array.from({ length: FORMATION_ROWS }, (_, row) =>
        Array.from({ length: FORMATION_COLUMNS }, (_, column) => startCell + row * FORMATION_COLUMNS + column)
      );
    const formation = BOARD_FORMATIONS
      .map((candidate, index) => ({
        candidate,
        index,
        score: chosen.reduce((sum, tower) => {
          const inFormation = tower.cell >= candidate.startCell && tower.cell < candidate.startCell + CELLS_PER_FORMATION;
          return sum + (tower.wuxing === candidate.preferredWuxing ? 4 : 0) + (inFormation ? 1 : 0);
        }, 0)
      }))
      // 이미 발동 중인 봉인이 네 칸을 다 차지한 줄만 있는 진은 쓸 수 없다.
      .filter(({ index, candidate }) =>
        this.isFormationUnlocked(index)
        && rowsFor(candidate.startCell).some((row) => row.every((cell) => !pinnedCells.has(cell)))
      )
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.candidate;
    if (!formation) return;
    // 고정된 자령을 밀어내지 않는 첫 줄에 네 글자를 세운다.
    const cells = rowsFor(formation.startCell).find((row) => row.every((cell) => !pinnedCells.has(cell)));
    if (!cells) return;
    for (let index = 0; index < chosen.length; index += 1) {
      const tower = chosen[index] as Tower;
      const targetCell = cells[index] as number;
      if (tower.cell === targetCell) continue;
      const occupant = this.state.towers.find((candidate) => candidate.cell === targetCell);
      if (occupant && occupant.id !== tower.id) occupant.cell = tower.cell;
      tower.cell = targetCell;
    }
  }

  private optimizeFormationCells(pinned: ReadonlySet<number> = new Set()): void {
    const assignment = new Map<number, number>();
    const availableCells = new Set(BOARD_CELLS.map((_, index) => index).filter((cell) => this.isCellUnlocked(cell)));
    const unassigned = new Set(this.state.towers.map((tower) => tower.id));

    // 발동 중인 봉인의 네 자령은 지금 칸에 못을 박고 시작한다. 공명 최적화가
    // 이 칸들을 비집고 들어오면 자기가 만든 성어를 자기가 흩뜨리게 된다.
    for (const tower of this.state.towers) {
      if (!pinned.has(tower.id) || !availableCells.has(tower.cell)) continue;
      assignment.set(tower.id, tower.cell);
      availableCells.delete(tower.cell);
      unassigned.delete(tower.id);
    }

    for (const [formationIndex, formation] of BOARD_FORMATIONS.entries()) {
      if (!this.isFormationUnlocked(formationIndex)) continue;
      const formationCells = Array.from({ length: CELLS_PER_FORMATION }, (_, offset) => formation.startCell + offset);
      const matching = this.state.towers
        .filter((tower) => tower.wuxing === formation.preferredWuxing)
        .sort((left, right) => {
          const leftDefinition = definitionForTower(this.catalog, left.definitionId);
          const rightDefinition = definitionForTower(this.catalog, right.definitionId);
          const leftPower = leftDefinition.combat.baseDamage * this.towerPowerMultiplier(left) * leftDefinition.combat.budgetMultiplier / this.towerAttackCooldown(left) * (1 + (left.concentration ?? 0) * 0.1);
          const rightPower = rightDefinition.combat.baseDamage * this.towerPowerMultiplier(right) * rightDefinition.combat.budgetMultiplier / this.towerAttackCooldown(right) * (1 + (right.concentration ?? 0) * 0.1);
          return rightPower - leftPower || left.id - right.id;
        })
        .slice(0, CELLS_PER_FORMATION);

      for (const tower of matching) {
        if (!formationCells.includes(tower.cell) || !availableCells.has(tower.cell)) continue;
        assignment.set(tower.id, tower.cell);
        availableCells.delete(tower.cell);
        unassigned.delete(tower.id);
      }
      for (const tower of matching) {
        if (!unassigned.has(tower.id)) continue;
        const cell = formationCells.find((candidate) => availableCells.has(candidate));
        if (cell === undefined) break;
        assignment.set(tower.id, cell);
        availableCells.delete(cell);
        unassigned.delete(tower.id);
      }
    }

    for (const tower of this.state.towers.filter((candidate) => unassigned.has(candidate.id))) {
      const cell = availableCells.has(tower.cell) ? tower.cell : availableCells.values().next().value;
      if (cell === undefined) continue;
      assignment.set(tower.id, cell);
      availableCells.delete(cell);
    }
    for (const tower of this.state.towers) tower.cell = assignment.get(tower.id) ?? tower.cell;
  }

  cleanupAssessments(options: CleanupOptions = {}): CleanupAssessment[] {
    const protectUnique = options.protectUnique ?? true;
    const all = [...this.state.towers, ...this.state.inventoryTowers];
    const counts = new Map<string, number>();
    for (const tower of all) counts.set(tower.char, (counts.get(tower.char) ?? 0) + 1);
    const targetPath = this.state.mode === "casual" ? new Set([this.state.targetChar]) : this.evolution.getTargetPath(this.state.targetChar);
    const unfinishedIdiomChars = new Set(
      this.idioms()
        .filter((idiom) => !this.state.idiomSeals.some((seal) => seal.idiomId === idiom.id))
        .flatMap((idiom) => [...idiom.chars])
    );
    const readyMaterialIds = new Set(this.availableEvolutions().flatMap((option) => option.materialTowerIds));

    return all.map((tower) => {
      const definition = definitionForTower(this.catalog, tower.definitionId);
      const protectedReasons: string[] = [];
      const reasons: string[] = [];
      const count = counts.get(tower.char) ?? 1;
      const stored = tower.cell < 0;
      const concentration = tower.concentration ?? 0;

      if (tower.locked) protectedReasons.push("잠금 자령");
      if (concentration > 0) protectedReasons.push(`농축 ${concentration}단계 투자`);
      const soleCopy = count <= 1;
      if (soleCopy && protectUnique) protectedReasons.push("유일 보유 한자");
      if (targetPath.has(tower.char)) protectedReasons.push("현재 목표 합성 계보");
      if (unfinishedIdiomChars.has(tower.char)) protectedReasons.push("미완성 사자성어 재료");
      if (readyMaterialIds.has(tower.id)) protectedReasons.push("즉시 합성 가능한 재료");

      if (!stored) {
        const formationIndex = Math.floor(tower.cell / CELLS_PER_FORMATION);
        const formation = BOARD_FORMATIONS[formationIndex];
        const resonance = this.formationResonance(formationIndex);
        if (formation?.preferredWuxing === tower.wuxing && [4, 8, 12, 16].includes(resonance.matching)) {
          protectedReasons.push(`${formation.label} ${resonance.matching}기 공명 임계치`);
        }
      }

      if (count > 1) reasons.push(`동일 한자 ${count}기`);
      if (stored) reasons.push("인벤토리 대기");
      if (tower.stage === 1) reasons.push("직접 소환 초형");
      if (!targetPath.has(tower.char) && !unfinishedIdiomChars.has(tower.char)) reasons.push("현재 목표·성어 비연결");
      if (!stored) {
        const formation = BOARD_FORMATIONS[Math.floor(tower.cell / CELLS_PER_FORMATION)];
        if (formation && formation.preferredWuxing !== tower.wuxing) reasons.push(`${formation.label} 비선호 오행`);
      }

      const dps = definition.combat.baseDamage * this.towerPowerMultiplier(tower) * definition.combat.budgetMultiplier / this.towerAttackCooldown(tower);
      const progressionRank = this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : tower.stage;
      const score = dps + progressionRank * 70 + concentration * 90 + (stored ? -35 : 28) - Math.max(0, count - 1) * 22;
      return { towerId: tower.id, protected: protectedReasons.length > 0, score, reasons, protectedReasons, soleCopy };
    });
  }

  cleanupCandidates(limit = 12, inventoryOnly = false, options: CleanupOptions = {}): CleanupAssessment[] {
    return this.cleanupAssessments(options)
      .filter((assessment) => !assessment.protected)
      .filter((assessment) => !inventoryOnly || this.state.inventoryTowers.some((tower) => tower.id === assessment.towerId))
      .sort((left, right) => left.score - right.score || left.towerId - right.towerId)
      .slice(0, Math.max(0, limit));
  }

  quoteDismantle(ids: readonly number[], options: CleanupOptions = {}): DismantleQuote {
    const protectUnique = options.protectUnique ?? true;
    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id)))];
    const assessments = new Map(this.cleanupAssessments(options).map((assessment) => [assessment.towerId, assessment]));
    const allTowers = [...this.state.towers, ...this.state.inventoryTowers];
    const ownedCounts = new Map<string, number>();
    for (const tower of allTowers) ownedCounts.set(tower.char, (ownedCounts.get(tower.char) ?? 0) + 1);
    const gains = emptyElementEssence();
    const scoreGains = emptyElementEssence();
    const eligibleIds: number[] = [];
    const blocked: DismantleQuote["blocked"] = [];
    const preliminary: Tower[] = [];
    for (const towerId of uniqueIds) {
      const tower = this.state.inventoryTowers.find((candidate) => candidate.id === towerId);
      if (!tower) {
        blocked.push({ towerId, reason: "인벤토리 자령만 일괄 분해할 수 있습니다." });
        continue;
      }
      const assessment = assessments.get(towerId);
      if (!assessment || assessment.protected) {
        blocked.push({ towerId, reason: assessment?.protectedReasons.join(" · ") || "보호 상태를 확인할 수 없습니다." });
        continue;
      }
      preliminary.push(tower);
    }
    const selectedCounts = new Map<string, number>();
    for (const tower of preliminary) selectedCounts.set(tower.char, (selectedCounts.get(tower.char) ?? 0) + 1);
    for (const tower of preliminary) {
      // 한 줄씩은 통과해도 묶어서 고르면 마지막 1기까지 사라지는 경우를 막는 2차 검사.
      // 보호를 끈 상태에서는 그것이 사용자의 의사이므로 막지 않는다.
      if (protectUnique && (ownedCounts.get(tower.char) ?? 0) - (selectedCounts.get(tower.char) ?? 0) < 1) {
        blocked.push({ towerId: tower.id, reason: "일괄 처리 후 유일 보유 한자가 사라집니다." });
        continue;
      }
      eligibleIds.push(tower.id);
      gains[tower.wuxing] += this.towerDismantleEssenceValue(tower);
      scoreGains[tower.wuxing] += this.towerDismantleScore(tower);
    }
    return { ids: eligibleIds, gains, scoreGains, blocked };
  }

  dismantleTowers(ids: readonly number[], options: CleanupOptions = {}): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    // Rebuild the quote immediately before mutation so moved, locked, or newly
    // protected material can never be consumed from a stale UI selection.
    const quote = this.quoteDismantle(ids, options);
    if (quote.blocked.length > 0) return { ok: false, message: `분해 중단 · ${quote.blocked[0]?.reason ?? "보호 자령이 포함되었습니다."}` };
    if (quote.ids.length === 0) return { ok: false, message: "분해할 인벤토리 자령을 선택하세요." };
    const selectedIds = new Set(quote.ids);
    const removed = this.state.inventoryTowers.filter((tower) => selectedIds.has(tower.id));
    if (removed.length !== quote.ids.length) return { ok: false, message: "분해 대상 위치가 바뀌었습니다. 다시 선택하세요." };
    this.state.inventoryTowers = this.state.inventoryTowers.filter((tower) => !selectedIds.has(tower.id));
    for (const tower of removed) {
      const essence = this.towerDismantleEssenceValue(tower);
      this.state.elementEssence[tower.wuxing] += essence;
      this.state.elementEssenceGenerated[tower.wuxing] += essence;
      this.state.elementDismantleScore[tower.wuxing] += this.towerDismantleScore(tower);
      this.state.dismantledTowerCount += 1;
      this.events.push({ type: "dismantle", tower: { ...tower }, wuxing: tower.wuxing, essence });
    }
    if (this.state.selectedTowerId !== null && selectedIds.has(this.state.selectedTowerId)) this.state.selectedTowerId = null;
    const gainLabel = (Object.entries(quote.gains) as Array<[Wuxing, number]>)
      .filter(([, amount]) => amount > 0)
      .map(([wuxing, amount]) => `${wuxing}+${amount}`)
      .join(" · ");
    this.state.lastMessage = `${removed.length}기 분해 완료 · ${gainLabel}`;
    // 분해는 보관고만 건드리지만, 보호 규칙이 바뀌는 경로라 판정을 한 번 맞춰 둔다.
    this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  dismantleSelected(options: CleanupOptions = {}): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "분해할 자령을 선택하세요." };
    return this.dismantleTowers([selected.id], options);
  }

  dismantleRecommended(limit = 8, options: CleanupOptions = {}): ActionResult {
    const ids = this.cleanupCandidates(limit, true, options).map((candidate) => candidate.towerId);
    if (ids.length === 0) return { ok: false, message: "보호 규칙을 통과한 인벤토리 정리 후보가 없습니다." };
    return this.dismantleTowers(ids, options);
  }

  concentrationQuote(targetId: number, path: ConcentrationPath): ConcentrationQuote | null {
    const target = [...this.state.towers, ...this.state.inventoryTowers].find((tower) => tower.id === targetId);
    if (!target) return null;
    const currentLevel = target.concentration ?? 0;
    if (currentLevel >= MAX_CONCENTRATION_LEVEL) return null;
    const chosenPath = target.concentrationPath ?? path;
    if (target.concentrationPath && chosenPath !== path) return null;
    const nextLevel = (currentLevel + 1) as ConcentrationLevel;
    const duplicateIds = this.state.inventoryTowers
      .filter((tower) => tower.id !== target.id && tower.char === target.char && !tower.locked)
      .map((tower) => tower.id);
    return {
      targetId,
      path: chosenPath,
      currentLevel,
      nextLevel,
      essenceCost: concentrationEssenceCost(currentLevel),
      duplicateIds,
      current: this.concentrationCombatSnapshot(target, target.concentrationPath ?? path, currentLevel),
      next: this.concentrationCombatSnapshot(target, chosenPath, nextLevel)
    };
  }

  private concentrationCombatSnapshot(tower: Tower, path: ConcentrationPath, level: ConcentrationLevel): ConcentrationCombatSnapshot {
    const profile = definitionForTower(this.catalog, tower.definitionId).combat;
    const damage = profile.baseDamage * this.towerPowerMultiplier(tower) * profile.budgetMultiplier
      * (1 + level * (path === "potent" ? 0.12 : 0.055))
      * (1 + this.combinedUpgradeBonus(tower.wuxing, "damage"));
    const concentrationHaste = level * (path === "swift" ? 0.075 : 0.02);
    const progressionHaste = this.state.mode === "casual"
      ? ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * CASUAL_STAR_HASTE_PER_STAR
      : (tower.stage - 1) * 0.035;
    const cooldown = Math.max(0.28, profile.cooldown * (1 - progressionHaste) * (1 - concentrationHaste)
      / (1 + this.combinedUpgradeBonus(tower.wuxing, "attackSpeed")));
    return {
      damage,
      attacksPerSecond: 1 / cooldown,
      range: profile.range + this.towerRangeBonus(tower) + level * 4 + this.combinedUpgradeBonus(tower.wuxing, "range"),
      abilityEffect: 1 + (path === "potent" ? level * 0.035 : 0)
    };
  }

  concentrateTower(targetId: number, path: ConcentrationPath, payment: ConcentrationPayment): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const target = [...this.state.towers, ...this.state.inventoryTowers].find((tower) => tower.id === targetId);
    if (!target) return { ok: false, message: "농축 대상이 더 이상 존재하지 않습니다." };
    const quote = this.concentrationQuote(targetId, path);
    if (!quote) {
      if ((target.concentration ?? 0) >= MAX_CONCENTRATION_LEVEL) return { ok: false, message: `${target.char} 농축이 최고 단계입니다.` };
      return { ok: false, message: `${target.char} 농축 방향은 ${concentrationPathLabel(target.concentrationPath ?? "swift")}으로 이미 고정되어 있습니다.` };
    }
    let usedDuplicate = false;
    if (payment.kind === "duplicate") {
      const duplicate = this.state.inventoryTowers.find((tower) => tower.id === payment.towerId);
      if (!duplicate || duplicate.id === target.id || duplicate.char !== target.char || duplicate.locked) {
        return { ok: false, message: "선택한 중복 재료가 이동·잠금되었거나 같은 한자가 아닙니다." };
      }
      this.state.inventoryTowers = this.state.inventoryTowers.filter((tower) => tower.id !== duplicate.id);
      usedDuplicate = true;
    } else {
      if (this.state.elementEssence[target.wuxing] < quote.essenceCost) {
        return { ok: false, message: `${target.wuxing} 문기 ${quote.essenceCost}가 필요합니다.` };
      }
      this.state.elementEssence[target.wuxing] -= quote.essenceCost;
      this.state.elementEssenceSpent[target.wuxing] += quote.essenceCost;
    }
    target.concentration = quote.nextLevel;
    target.concentrationPath = quote.path;
    this.state.selectedTowerId = target.id;
    this.state.lastMessage = `${target.char} 濃 ${target.concentration}/3 · ${concentrationPathLabel(quote.path)}`;
    this.events.push({
      type: "concentrate",
      tower: { ...target },
      level: target.concentration,
      path: quote.path,
      usedDuplicate,
      essenceCost: usedDuplicate ? 0 : quote.essenceCost
    });
    return { ok: true, message: this.state.lastMessage };
  }

  concentrateSelected(path?: ConcentrationPath): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "농축할 자령을 선택하세요." };
    // 방향은 역할이 정한다. 인자는 세이브·테스트 호환용 잔재로만 남긴다.
    const chosenPath = selected.concentrationPath ?? path ?? autoConcentrationPath(selected);
    const quote = this.concentrationQuote(selected.id, chosenPath);
    if (!quote) return this.concentrateTower(selected.id, chosenPath, { kind: "essence" });
    const duplicateId = quote.duplicateIds[0];
    return this.concentrateTower(selected.id, chosenPath, duplicateId === undefined ? { kind: "essence" } : { kind: "duplicate", towerId: duplicateId });
  }

  sellSelected(): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "판매할 자령을 선택하세요." };
    if (selected.locked) return { ok: false, message: "잠긴 자령입니다. 잠금을 해제한 뒤 판매하세요." };
    const value = this.towerSellValue(selected);
    const essenceRefund = concentrationEssenceRefund(selected.concentration ?? 0);
    this.state.towers = this.state.towers.filter((tower) => tower.id !== selected.id);
    this.state.inventoryTowers = this.state.inventoryTowers.filter((tower) => tower.id !== selected.id);
    this.state.gold += value;
    this.state.elementEssence[selected.wuxing] += essenceRefund;
    this.state.selectedTowerId = null;
    this.state.lastMessage = selected.char + " 판매 · " + String(value) + "엽전 회수" + (essenceRefund > 0 ? ` · ${selected.wuxing} 문기 ${essenceRefund} 환급` : "");
    // 판 위에서 한 기가 사라지면 그 자리를 쓰던 봉인은 흩어진다.
    this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  selectedTower(): Tower | undefined {
    return this.state.towers.find((tower) => tower.id === this.state.selectedTowerId)
      ?? this.state.inventoryTowers.find((tower) => tower.id === this.state.selectedTowerId);
  }

  selectedTowerIsStored(): boolean {
    return this.state.inventoryTowers.some((tower) => tower.id === this.state.selectedTowerId);
  }

  storeSelectedTower(): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "보관할 자령을 선택하세요." };
    if (this.selectedTowerIsStored()) return { ok: false, message: "이미 런 인벤토리에 있는 자령입니다." };
    this.state.towers = this.state.towers.filter((tower) => tower.id !== selected.id);
    selected.cell = -1;
    this.state.inventoryTowers.push(selected);
    this.state.lastMessage = selected.char + " 런 인벤토리에 보관";
    this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  toggleSelectedLock(): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "잠글 자령을 선택하세요." };
    selected.locked = !selected.locked;
    this.state.lastMessage = `${selected.char} ${selected.locked ? "잠금 · 합성·판매 보호" : "잠금 해제"}`;
    return { ok: true, message: this.state.lastMessage };
  }

  bossTimeRemaining(): number | null {
    if (this.state.phase !== "combat" || !this.currentPlan?.boss || this.state.bossDefeated) return null;
    const limit = bossTimeLimitForWave(this.currentPlan.wave);
    return limit === null ? null : Math.max(0, limit - this.state.waveElapsed);
  }

  idioms(): readonly IdiomDefinition[] {
    return this.state.featuredIdiomIds
      .map((id) => idiomById(this.state.region, id))
      .filter((idiom): idiom is IdiomDefinition => Boolean(idiom));
  }

  allIdioms(): readonly IdiomDefinition[] {
    return idiomsForRegion(this.state.region);
  }

  summonDefinitions(): readonly HanziDefinition[] {
    return this.runSummonPool;
  }

  currentIdiomTarget(): IdiomDefinition | undefined {
    return this.idioms().find((idiom) => !this.state.idiomSeals.some((seal) => seal.idiomId === idiom.id));
  }

  /**
   * 지금 이 순간 줄을 지키고 있는 봉인들. 전투 보너스·발광·자리 고정의 기준이다.
   * 기록(한 번이라도 봉인했는가)은 state.idiomSeals 전체를 그대로 보면 된다.
   */
  activeIdiomSeals(): readonly IdiomSeal[] {
    return this.state.idiomSeals.filter((seal) => seal.active);
  }

  isIdiomSealActive(idiomId: string): boolean {
    return this.state.idiomSeals.some((seal) => seal.idiomId === idiomId && seal.active);
  }

  idiomBonus(kind: IdiomBonusKind): number {
    // 유지형 규칙: 흩어진 봉인은 기록에만 남고 보너스는 내지 않는다.
    const total = this.state.idiomSeals.reduce((sum, seal) => {
      if (!seal.active) return sum;
      const idiom = idiomById(this.state.region, seal.idiomId);
      return sum + (idiom?.bonus.kind === kind ? idiom.bonus.value : 0);
    }, 0);
    const caps: Record<IdiomBonusKind, number> = { damage: 0.15, range: 36, enemySlow: 0.1, evolutionGold: 8 };
    return Math.min(caps[kind], total);
  }

  private buildRunSummonPool(): readonly HanziDefinition[] {
    const target = this.currentIdiomTarget();
    const directChars = idiomDirectPoolChars(this.catalog, target ? [target] : []);
    const definitions = [...this.catalog.activePool];
    const included = new Set(definitions.map((definition) => definition.char));
    for (const char of directChars) {
      const definition = this.catalog.definitions.get(char);
      if (!definition || definition.acquisition !== "direct" || included.has(char)) continue;
      definitions.push(definition);
      included.add(char);
    }
    return definitions;
  }

  /**
   * 봉인 상태를 판 위 배치와 다시 맞춘다. 자령이 놓이고·옮겨지고·사라진 뒤마다 부른다.
   *
   * 유지형 규칙이라 이 함수는 "새로 성립한 성어를 켠다"만이 아니라 세 갈래를 본다.
   *  - 아직 기록이 없는 성어가 줄을 이루면 첫 봉인(rejoined=false).
   *  - 흩어졌던 기록이 다시 줄을 이루면 재봉인(rejoined=true) — 연출만 가볍다.
   *  - 활성 봉인의 줄이 깨졌으면 비활성으로 내리고 idiomBroken 을 띄운다.
   * 돌려주는 수는 이번 호출에서 새로 켜진 봉인 수(첫 봉인 + 재봉인)다.
   */
  resolveIdiomFormations(): number {
    if (!this.isRunActive()) return 0;
    let activated = 0;
    // 목표 다섯 구 + 이미 기록이 남은 구(목표에서 밀려났을 수 있다)를 모두 훑는다.
    const checked = new Set<string>();
    const candidates: IdiomDefinition[] = [...this.idioms()];
    for (const seal of this.state.idiomSeals) {
      if (candidates.some((idiom) => idiom.id === seal.idiomId)) continue;
      const idiom = idiomById(this.state.region, seal.idiomId);
      if (idiom) candidates.push(idiom);
    }
    for (const idiom of candidates) {
      if (checked.has(idiom.id)) continue;
      checked.add(idiom.id);
      const seal = this.state.idiomSeals.find((candidate) => candidate.idiomId === idiom.id);
      // 지키고 있던 네 칸이 그대로면 그 줄을 그대로 쓴다. 판 어딘가에 같은 성어가
      // 또 서 있다고 해서 봉인 칸이 제멋대로 옮겨 다니면 발광이 튄다.
      const holdsCells = seal !== undefined && seal.active && this.idiomHoldsCells(idiom, seal.cells);
      const cells = holdsCells ? [...(seal as IdiomSeal).cells] : findIdiomPath(this.state.towers, idiom);
      if (!seal) {
        if (!cells) continue;
        this.activateIdiom(idiom, cells);
        activated += 1;
      } else if (cells) {
        const rejoined = !seal.active;
        seal.cells = [...cells];
        if (!rejoined) continue;
        seal.active = true;
        seal.completedAt = this.state.elapsed;
        this.announceIdiom(idiom, cells, true);
        activated += 1;
      } else if (seal.active) {
        this.breakIdiomSeal(idiom, seal);
      }
    }
    return activated;
  }

  /** 이 네 칸에 성어의 네 글자가 순서대로 아직 서 있는가. */
  private idiomHoldsCells(idiom: IdiomDefinition, cells: readonly number[]): boolean {
    const characters = [...idiom.chars];
    if (cells.length !== characters.length) return false;
    return characters.every((char, index) =>
      this.state.towers.some((tower) => tower.cell === (cells[index] as number) && tower.char === char)
    );
  }

  private activateIdiom(idiom: IdiomDefinition, cells: readonly number[]): void {
    this.state.idiomSeals.push({ idiomId: idiom.id, cells: [...cells], completedAt: this.state.elapsed, active: true });
    this.announceIdiom(idiom, cells, false);
    this.runSummonPool = this.buildRunSummonPool();
  }

  private announceIdiom(idiom: IdiomDefinition, cells: readonly number[], rejoined: boolean): void {
    this.state.lastMessage = idiom.name + " · " + idiom.reading + (rejoined ? " 재봉인 · " : " 자동 봉인 · ") + idiom.bonus.label;
    this.events.push({
      type: "idiom",
      idiomId: idiom.id,
      chars: idiom.chars,
      reading: idiom.reading,
      meaning: idiom.meaning,
      bonus: idiom.bonus.label,
      color: idiom.color,
      cells: [...cells],
      rejoined
    });
  }

  /** 줄이 흩어졌다. 달성 기록은 그대로 두고 보너스·발광·자리 고정만 걷는다. */
  private breakIdiomSeal(idiom: IdiomDefinition, seal: IdiomSeal): void {
    const cells = [...seal.cells];
    seal.active = false;
    seal.cells = [];
    this.state.lastMessage = idiom.name + " · " + idiom.reading + " 봉인 해제 · 줄이 흩어졌습니다";
    this.events.push({
      type: "idiomBroken",
      idiomId: idiom.id,
      chars: idiom.chars,
      reading: idiom.reading,
      bonus: idiom.bonus.label,
      color: idiom.color,
      cells
    });
  }

  getCurrentPlan(): WavePlan | null {
    return this.currentPlan ? { ...this.currentPlan } : null;
  }

  isSynergyActive(wuxing: Wuxing): boolean {
    const source = generatorOf(wuxing);
    return this.state.towers.some((tower) => tower.wuxing === source);
  }

  activeSynergies(): Wuxing[] {
    const elements = new Set(this.state.towers.map((tower) => tower.wuxing));
    return [...elements].filter((wuxing) => elements.has(generatorOf(wuxing)));
  }

  formationResonance(formationIndex: number): { matching: number; tier: number; damageBonus: number } {
    const formation = BOARD_FORMATIONS[formationIndex];
    if (!formation || !this.isFormationUnlocked(formationIndex)) return { matching: 0, tier: 0, damageBonus: 0 };
    const endCell = formation.startCell + CELLS_PER_FORMATION;
    const matching = this.state.towers.filter((tower) =>
      tower.cell >= formation.startCell && tower.cell < endCell && tower.wuxing === formation.preferredWuxing
    ).length;
    const tier = matching >= 16 ? 4 : matching >= 12 ? 3 : matching >= 8 ? 2 : matching >= 4 ? 1 : 0;
    return { matching, tier, damageBonus: [0, 0.06, 0.12, 0.18, 0.25][tier] ?? 0 };
  }

  consumeEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  private createTower(definition: HanziDefinition, cell: number): Tower {
    const naturalStar = this.state.mode === "casual" ? casualNaturalStar(definition.char) : null;
    if (this.state.mode === "casual" && naturalStar === null) {
      throw new Error(`${definition.char}의 천자문 획수·별 데이터가 없습니다.`);
    }
    return {
      id: this.nextTowerId++,
      definitionId: definition.id,
      char: definition.char,
      wuxing: definition.wuxing,
      stage: definition.stage,
      combatRole: definition.combat.role,
      graphRole: definition.graph.graphRole,
      cell,
      cooldownLeft: this.rng.next() * 0.2,
      pulse: 1,
      shotCount: 0,
      abilityFlash: 0,
      locked: false,
      concentration: 0,
      concentrationPath: null,
      naturalStar: naturalStar ?? undefined,
      casualStar: naturalStar ?? undefined
    };
  }

  private discover(char: string): void {
    if (!this.state.discoveredChars.includes(char)) this.state.discoveredChars.push(char);
  }

  private firstEmptyCell(): number | null {
    const occupied = new Set(this.state.towers.map((tower) => tower.cell));
    for (const cell of SUMMON_CELL_ORDER) {
      if (this.isCellUnlocked(cell) && !occupied.has(cell)) return cell;
    }
    return null;
  }

  isCellUnlocked(cell: number): boolean {
    return isBoardCellUnlocked(cell, this.state.unlockedFormations);
  }

  isFormationUnlocked(formationIndex: number): boolean {
    return isFormationUnlocked(formationIndex, this.state.unlockedFormations);
  }

  nextFormationUnlockCost(): number | null {
    if (this.state.startingFormationIndex === null) return null;
    return nextFormationUnlockCost(this.state.unlockedFormations.length);
  }

  unlockFormation(formationIndex: number): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const formation = BOARD_FORMATIONS[formationIndex];
    if (!formation) return { ok: false, message: "존재하지 않는 오행진입니다." };
    if (this.isFormationUnlocked(formationIndex)) return { ok: false, message: `${formation.label}은 이미 개방되었습니다.` };
    if (this.state.startingFormationIndex === null) return { ok: false, message: "첫 자령을 소환하면 같은 오행진이 무료로 먼저 개방됩니다." };
    const cost = this.nextFormationUnlockCost();
    if (cost === null) return { ok: false, message: "모든 오행진을 개방했습니다." };
    if (this.state.gold < cost) return { ok: false, message: `${formation.label} 해금에 엽전 ${cost}이 필요합니다.` };
    this.state.gold -= cost;
    this.state.unlockedFormations.push(formationIndex);
    this.state.unlockedFormations.sort((left, right) => left - right);
    this.state.lastMessage = `${formation.preferredWuxing}행 ${formation.label} 해금 · 전장 ${this.deployedTowerCapacity()}칸`;
    return { ok: true, message: this.state.lastMessage };
  }

  deployedTowerCapacity(): number {
    return unlockedTowerCapacity(this.state.unlockedFormations);
  }

  private isRunActive(): boolean {
    return this.state.phase === "prep" || this.state.phase === "combat";
  }

  private endRun(phase: "victory" | "defeat", message: string, cause: DefeatCause | null = null): void {
    this.state.phase = phase;
    // FB3: 패배일 때만 원인을 남긴다. 승리는 항상 null 로 되돌린다.
    this.state.defeatCause = phase === "defeat" ? cause : null;
    this.state.lastMessage = message;
    this.events.push({ type: "phase", phase });
  }
}

export function runAutoplay(seed: string, region: RegionCode = "KR", maxSeconds = 5_400, mode: GameMode = "standard"): SimulationResult {
  const engine = new GameEngine(seed, region, mode);
  engine.begin();
  engine.setAutomationMode("semi");
  engine.setSummonIntent("lineage");
  let decisionCooldown = 0;
  let peakTowerCount = 0;
  let lastCleanupWave = -1;
  let lastReplacementWave = -1;
  const checkpoints: SimulationCheckpoint[] = [];
  const captureCheckpoint = (wave: number): void => {
    if (wave <= 0 || wave % 10 !== 0 || checkpoints.some((checkpoint) => checkpoint.wave === wave)) return;
    checkpoints.push({
      wave,
      gold: engine.state.gold,
      formations: engine.state.unlockedFormations.length,
      towers: engine.state.towers.length,
      inventory: engine.state.inventoryTowers.length,
      summons: engine.state.summonCount,
      evolutions: engine.state.evolutionCount,
      casualFusions: engine.state.casualFusionCount,
      discoveries: engine.state.discoveredChars.length,
      goals: engine.state.goalsCompleted.length,
      idioms: engine.state.idiomSeals.length,
      dismantles: engine.state.dismantledTowerCount,
      essenceGenerated: sumElementValues(engine.state.elementEssenceGenerated),
      essenceSpent: sumElementValues(engine.state.elementEssenceSpent)
    });
  };

  while (engine.state.elapsed < maxSeconds && engine.state.phase !== "victory" && engine.state.phase !== "defeat") {
    engine.update(0.1);
    if (engine.state.phase === "prep") captureCheckpoint(engine.state.wave);
    decisionCooldown -= 0.1;
    if (decisionCooldown > 0) continue;
    decisionCooldown = 0.22;

    if (engine.state.summonCount === 0) {
      engine.summon();
      peakTowerCount = Math.max(peakTowerCount, engine.state.towers.length);
      continue;
    }

    if (engine.state.mode === "standard") {
      let evolutionGuard = 0;
      while (evolutionGuard < 8) {
        const option = autoplayEvolutionOption(engine);
        if (!option || !engine.evolve(option.recipeId).ok) break;
        arrangeAvailableAutoplayIdioms(engine);
        evolutionGuard += 1;
      }
    } else {
      for (const wuxing of ["木", "火", "土", "金", "水"] as const) {
        if (engine.casualAutoFusionPlan(wuxing).length > 0) engine.autoFuseCasualElement(wuxing, true);
      }
    }

    let desiredResearch = 0;
    while (desiredResearch < 5 && engine.state.wave >= researchUnlockWave(desiredResearch)) desiredResearch += 1;
    const upgradeCost = researchCost(engine.state.researchLevel);
    if (engine.state.researchLevel < desiredResearch && upgradeCost > 0 && engine.state.gold >= upgradeCost + 24) {
      engine.upgradeResearch();
    }

    autoplayPurchaseUpgrades(engine);

    const formationCost = engine.nextFormationUnlockCost();
    if (formationCost !== null
      && engine.state.towers.length >= engine.deployedTowerCapacity() - 2
      && engine.state.gold >= formationCost + Math.max(20, summonCost(engine.state.summonCount) * 2)) {
      const lockedFormation = BOARD_FORMATIONS
        .map((formation, index) => ({
          index,
          matching: [...engine.state.towers, ...engine.state.inventoryTowers].filter((tower) => tower.wuxing === formation.preferredWuxing).length
        }))
        .filter(({ index }) => !engine.isFormationUnlocked(index))
        .sort((left, right) => right.matching - left.matching || left.index - right.index)[0];
      if (lockedFormation) engine.unlockFormation(lockedFormation.index);
    }

    let attempts = 0;
    while (engine.state.towers.length < engine.deployedTowerCapacity() && engine.state.gold >= summonCost(engine.state.summonCount) && attempts < 12) {
      engine.summon();
      arrangeAvailableAutoplayIdioms(engine);
      attempts += 1;
      const option = engine.state.mode === "standard" ? autoplayEvolutionOption(engine) : undefined;
      if (option) {
        engine.evolve(option.recipeId);
        arrangeAvailableAutoplayIdioms(engine);
      }
    }

    if (engine.state.wave >= 3
      && engine.state.towers.length >= engine.deployedTowerCapacity()
      && lastCleanupWave !== engine.state.wave) {
      const inventoryTarget = Math.min(18, 4 + Math.floor(engine.state.wave / 10));
      const reserve = Math.max(24, engine.nextFormationUnlockCost() ?? 0);
      engine.setSummonIntent("concentration");
      engine.setAutoPlaceSummons(false);
      let surplusAttempts = 0;
      while (engine.state.inventoryTowers.length < inventoryTarget
        && engine.state.gold >= summonCost(engine.state.summonCount) + reserve
        && surplusAttempts < 8) {
        engine.summon(true);
        surplusAttempts += 1;
      }
      engine.setAutoPlaceSummons(true);
      engine.setSummonIntent("lineage");

      const concentrationTarget = [...engine.state.towers]
        .filter((tower) => (tower.concentration ?? 0) < MAX_CONCENTRATION_LEVEL)
        .filter((tower) => engine.state.inventoryTowers.some((candidate) => candidate.char === tower.char && !candidate.locked))
        .sort((left, right) => right.stage - left.stage || left.id - right.id)[0];
      if (concentrationTarget) {
        const duplicate = engine.state.inventoryTowers.find((tower) => tower.char === concentrationTarget.char && !tower.locked);
        if (duplicate) {
          const path = autoConcentrationPath(concentrationTarget);
          engine.concentrateTower(concentrationTarget.id, path, { kind: "duplicate", towerId: duplicate.id });
        }
      }

      const cleanupIds = engine.cleanupCandidates(8, true).map((candidate) => candidate.towerId);
      if (cleanupIds.length > 0) engine.dismantleTowers(cleanupIds);
      lastCleanupWave = engine.state.wave;
      autoplayPurchaseUpgrades(engine);
    }

    if (engine.state.towers.length >= engine.deployedTowerCapacity()
      && engine.availableEvolutions().length === 0
      && lastReplacementWave !== engine.state.wave) {
      const protectedChars = autoplayProtectedChars(engine);
      // 유지형 규칙: 발동 중 봉인의 네 자령을 팔면 봉인이 그 자리에서 꺼진다.
      // 사람 규칙은 그대로 두고(팔 수는 있다) 봇의 후보에서만 뺀다.
      const sealedIds = engine.sealedIdiomTowerIds();
      const disposable = [...engine.state.towers]
        .filter((tower) => !tower.locked && (tower.concentration ?? 0) === 0 && !protectedChars.has(tower.char) && !sealedIds.has(tower.id))
        .sort((left, right) => {
          const leftRank = engine.state.mode === "casual" ? left.casualStar ?? 1 : left.stage;
          const rightRank = engine.state.mode === "casual" ? right.casualStar ?? 1 : right.stage;
          return leftRank - rightRank || left.id - right.id;
        })[0];
      if (disposable) {
        engine.selectTower(disposable.id);
        engine.sellSelected();
        lastReplacementWave = engine.state.wave;
      }
    }

    if (engine.state.phase === "prep" && (engine.state.wave > 0 || engine.state.towers.length >= 5)) engine.startWaveEarly();
    peakTowerCount = Math.max(peakTowerCount, engine.state.towers.length);
  }

  captureCheckpoint(engine.state.wave);

  return {
    seed,
    region,
    mode,
    result: engine.state.phase === "victory" ? "victory" : engine.state.phase === "defeat" ? "defeat" : "timeout",
    wave: engine.state.wave,
    elapsed: engine.state.elapsed,
    summons: engine.state.summonCount,
    peakTowerCount,
    evolutions: engine.state.evolutionCount,
    casualFusions: engine.state.casualFusionCount,
    discoveries: engine.state.discoveredChars.length,
    goals: engine.state.goalsCompleted.length,
    idioms: engine.state.idiomSeals.length,
    researchLevel: engine.state.researchLevel,
    startingFormationIndex: engine.state.startingFormationIndex,
    startingWuxing: engine.state.startingFormationIndex === null
      ? null
      : BOARD_FORMATIONS[engine.state.startingFormationIndex]?.preferredWuxing ?? null,
    dismantles: engine.state.dismantledTowerCount,
    essenceGenerated: sumElementValues(engine.state.elementEssenceGenerated),
    essenceSpent: sumElementValues(engine.state.elementEssenceSpent),
    essenceSpendRate: sumElementValues(engine.state.elementEssenceGenerated) > 0
      ? Math.min(1, sumElementValues(engine.state.elementEssenceSpent) / sumElementValues(engine.state.elementEssenceGenerated))
      : 0,
    elementTraitLevels: {
      木: [...engine.state.elementTraits.木],
      火: [...engine.state.elementTraits.火],
      土: [...engine.state.elementTraits.土],
      金: [...engine.state.elementTraits.金],
      水: [...engine.state.elementTraits.水]
    },
    endReason: engine.state.lastMessage,
    checkpoints
  };
}

function autoplayPurchaseUpgrades(engine: GameEngine): void {
  if (engine.state.towers.length >= 20 || engine.state.wave >= 8) {
    const stat = [...UPGRADE_STAT_ORDER].sort(
      (left, right) => engine.state.globalUpgrades[left] - engine.state.globalUpgrades[right]
    )[0];
    if (stat) {
      const level = engine.state.globalUpgrades[stat];
      const cost = globalUpgradeCost(stat, level);
      const reserve = Math.max(36, summonCost(engine.state.summonCount) * 4);
      if (cost > 0 && engine.state.gold >= cost + reserve) engine.upgradeGlobal(stat);
    }
  }

  const elements: readonly Wuxing[] = ["木", "火", "土", "金", "水"];
  for (const wuxing of elements) {
    const unlockedTrait = [0, 1, 2]
      .filter((traitIndex) => engine.state.elementDismantleScore[wuxing] >= (elementTraitUnlockScore(traitIndex) ?? Infinity))
      .sort((left, right) => engine.elementTraitLevel(wuxing, left) - engine.elementTraitLevel(wuxing, right) || left - right)
      .find((traitIndex) => engine.elementTraitLevel(wuxing, traitIndex) < ELEMENT_TRAIT_MAX_LEVEL);
    if (unlockedTrait !== undefined) {
      const traitCost = elementTraitUpgradeCost(engine.elementTraitLevel(wuxing, unlockedTrait));
      if (traitCost !== null && engine.state.elementEssence[wuxing] >= traitCost) engine.upgradeElementTrait(wuxing, unlockedTrait);
      continue;
    }
    const stat = [...UPGRADE_STAT_ORDER].sort(
      (left, right) => engine.state.elementUpgrades[wuxing][left] - engine.state.elementUpgrades[wuxing][right]
    )[0];
    if (!stat) continue;
    const cost = elementUpgradeCost(engine.state.elementUpgrades[wuxing][stat]);
    if (cost > 0 && engine.state.elementEssence[wuxing] >= cost) engine.upgradeElement(wuxing, stat);
  }
}

function autoplayProtectedChars(engine: GameEngine): Set<string> {
  const protectedChars = engine.evolution.getTargetPath(engine.state.targetChar);
  const idiom = engine.currentIdiomTarget();
  if (!idiom) return protectedChars;
  for (const char of idiom.chars) {
    protectedChars.add(char);
    for (const pathChar of engine.evolution.getTargetPath(char)) protectedChars.add(pathChar);
  }
  return protectedChars;
}

function autoplayEvolutionOption(engine: GameEngine): EvolutionOption | undefined {
  // 유지형 규칙(R18) 이후 봉인은 네 자령이 줄에 서 있는 동안만 산다. 봇이 그
  // 자령을 합성 재료로 태우면 제 손으로 보너스를 끄는 셈이라, 발동 중 봉인의
  // 자령이 낀 합성식은 후보에서 통째로 뺀다. 전부 걸리면 이번 틱은 합성을
  // 쉰다 — 성어 유지가 합성 한 번보다 우선이다. 사람 규칙은 그대로다.
  const sealedIds = engine.sealedIdiomTowerIds();
  const options = engine.availableEvolutions()
    .filter((option) => !option.materialTowerIds.some((id) => sealedIds.has(id)));
  // 아직 줄이 없는(혹은 흩어진) 성어의 글자도 지킨다 — 재봉인 재료다.
  const pendingIdioms = engine.idioms().filter((candidate) => !engine.isIdiomSealActive(candidate.id));
  const idiom = engine.currentIdiomTarget();
  if (pendingIdioms.length === 0) return options.find((candidate) => candidate.onTargetPath) ?? options[0];
  const exactChars = new Set(pendingIdioms.flatMap((candidate) => [...candidate.chars]));
  const idiomPath = new Set<string>();
  for (const char of idiom?.chars ?? "") for (const pathChar of engine.evolution.getTargetPath(char)) idiomPath.add(pathChar);
  const required = new Map<string, number>();
  for (const candidate of pendingIdioms) {
    for (const char of candidate.chars) required.set(char, (required.get(char) ?? 0) + 1);
  }
  const owned = new Map<string, number>();
  for (const tower of engine.state.towers) owned.set(tower.char, (owned.get(tower.char) ?? 0) + 1);
  const preservesPlacedIdiomChars = (option: EvolutionOption): boolean => option.materialTowerIds.every((id) => {
    const material = engine.state.towers.find((tower) => tower.id === id);
    if (!material || !exactChars.has(material.char)) return true;
    return (owned.get(material.char) ?? 0) > (required.get(material.char) ?? 0);
  });
  return options.find((candidate) => exactChars.has(candidate.result.char))
    ?? options.find((candidate) => candidate.onTargetPath && preservesPlacedIdiomChars(candidate))
    ?? options.find((candidate) => idiomPath.has(candidate.result.char) && preservesPlacedIdiomChars(candidate))
    ?? options.find(preservesPlacedIdiomChars)
    ?? options[0];
}

/**
 * 봇이 성어 한 구를 세울 줄. 기본은 예전과 같은 0~3번 칸이고, 그 줄이 이미
 * 발동 중인 봉인에 잡혀 있으면 고정 자령이 없는 다음 가로줄로 비켜난다.
 */
function autoplayIdiomLine(engine: GameEngine, pinnedCells: ReadonlySet<number>): number[] | null {
  // 봇은 예전부터 0~3번 칸에 세웠다. 고정된 자령이 없으면 그 습성을 그대로 둬
  // 이번 변경이 시뮬 지표를 흔드는 원인을 자리 고정 하나로 좁힌다.
  const legacy = Array.from({ length: FORMATION_COLUMNS }, (_, column) => column);
  if (legacy.every((cell) => !pinnedCells.has(cell))) return legacy;
  for (const [formationIndex, formation] of BOARD_FORMATIONS.entries()) {
    if (!engine.isFormationUnlocked(formationIndex)) continue;
    for (let row = 0; row < FORMATION_ROWS; row += 1) {
      const cells = Array.from({ length: FORMATION_COLUMNS }, (_, column) => formation.startCell + row * FORMATION_COLUMNS + column);
      if (cells.every((cell) => !pinnedCells.has(cell))) return cells;
    }
  }
  return null;
}

function arrangeAvailableAutoplayIdioms(engine: GameEngine): void {
  for (let guard = 0; guard < engine.idioms().length; guard += 1) {
    // 유지형 규칙: 이미 발동 중인 봉인의 네 자령은 봇도 건드리지 않는다.
    // 흩어진 기록(비활성 봉인)도 다시 세울 대상이다 — 재봉인하면 보너스가 돌아온다.
    // 첫 성어의 글자가 모자라도 뒤 성어는 세울 수 있으므로 하나씩 전부 시도한다.
    const pinned = engine.sealedIdiomTowerIds();
    const pinnedCells = new Set(engine.state.towers.filter((tower) => pinned.has(tower.id)).map((tower) => tower.cell));
    let arranged = false;
    for (const idiom of engine.idioms()) {
      if (engine.isIdiomSealActive(idiom.id)) continue;
      const chosen: Tower[] = [];
      const usedIds = new Set<number>();
      for (const char of idiom.chars) {
        const tower = engine.state.towers.find((candidate) => candidate.char === char && !usedIds.has(candidate.id) && !pinned.has(candidate.id));
        if (!tower) break;
        chosen.push(tower);
        usedIds.add(tower.id);
      }
      if (chosen.length !== [...idiom.chars].length) continue;
      const line = autoplayIdiomLine(engine, pinnedCells);
      if (!line) return;
      for (let index = 0; index < chosen.length; index += 1) {
        const tower = chosen[index] as Tower;
        const targetCell = line[index] as number;
        const occupant = engine.state.towers.find((candidate) => candidate.cell === targetCell);
        if (occupant && occupant.id !== tower.id) occupant.cell = tower.cell;
        tower.cell = targetCell;
      }
      if (engine.resolveIdiomFormations() === 0) return;
      arranged = true;
      break;
    }
    if (!arranged) return;
  }
}
