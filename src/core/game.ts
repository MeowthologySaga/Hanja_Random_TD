import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  CELLS_PER_FORMATION,
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
import {
  CASUAL_STAR_POWER,
  casualNaturalStar,
  casualStarAfterFusion,
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
  summonCost,
  WUXING_ORDER
} from "./hanzi";
import { SeededRng } from "./rng";
import type {
  ActionResult,
  AutomationMode,
  CompositionBranchPreview,
  ConcentrationLevel,
  ConcentrationPayment,
  ConcentrationPath,
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
import type { IdiomBonusKind } from "./types";

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
const SUMMON_STAGE_WEIGHTS: Record<Stage, number> = { 1: 1, 2: 0.22, 3: 0.075, 4: 0.025, 5: 0.008 };
const CONCENTRATION_ESSENCE_COSTS = [4, 6, 8] as const;

export function concentrationEssenceCost(currentLevel: number): number {
  return CONCENTRATION_ESSENCE_COSTS[Math.max(0, Math.min(2, currentLevel))] ?? 8;
}

export function concentrationEssenceRefund(level: number): number {
  return Math.floor(CONCENTRATION_ESSENCE_COSTS.slice(0, Math.max(0, Math.min(3, level))).reduce((sum, cost) => sum + cost, 0) * 0.7);
}

export function dismantleEssenceValue(stage: Stage, concentration = 0): number {
  return Math.max(1, stage * stage + concentrationEssenceRefund(concentration));
}

export interface CleanupAssessment {
  towerId: number;
  protected: boolean;
  score: number;
  reasons: string[];
  protectedReasons: string[];
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
  | "deployed"        // 전장에 세워 둔 자령 — 수비 공백이 생긴다
  | "resonance"       // 오행진 공명 임계치가 깨진다
  | "unique"          // 유일 보유 한자 — 3체 조합에서는 정상 동작이다
  | "standard-recipe" // 일반 모드 합성식 재료
  | "protected";      // 그 밖의 보호 사유

export interface CasualFusionIssue {
  towerId: number | null;
  text: string;
  kind?: CasualFusionIssueKind;
}

export interface CasualFusionQuote {
  coreId: number;
  materialIds: number[];
  fromStar: CasualStar | null;
  toStar: CasualStar | null;
  wuxing: Wuxing | null;
  blocked: CasualFusionIssue[];
  warnings: CasualFusionIssue[];
}

export interface CasualAutoFusionGroup {
  coreId: number;
  materialIds: [number, number];
  fromStar: CasualStar;
  toStar: CasualStar;
  warnings: CasualFusionIssue[];
  /** 확인 없이 실행하는 원클릭 경로가 스스로 건너뛸 사유. null 이면 즉시 실행 대상. */
  autoSkipReason: string | null;
}

export interface CasualAutoFusionReport extends ActionResult {
  fused: number;
  consumed: number;
  skipped: number;
  skipReason: string | null;
  firstFusion: {
    wuxing: Wuxing;
    char: string;
    fromStar: CasualStar;
    toStar: CasualStar;
    consumedChars: string[];
  } | null;
}

// 캐주얼 3체 조합은 "서로 다른 한자 2기를 소모해 1기를 올린다"가 규칙 자체다.
// 그래서 `유일 보유 한자` 경고는 이 모드에서 상시 발생하며 자동 실행을 막는
// 근거가 될 수 없다. 잠금·농축·목표 계보·미완 성어·봉인 성어·일반 합성식은
// 애초에 재료 후보에서 빠지므로(casualMaterialProtection) 남지 않는다.
// `전장 배치` 역시 막지 않는다 — 뽑기 후 자동 배치가 기본이라 사실상 모든
// 자령이 전장에 서 있고, 이것을 막으면 [한 번에 승급]이 아무 일도 못 한다.
// 대신 소모 내역과 `전장 N기 소모` 배지로 무엇이 사라지는지 먼저 보여 준다.
// 되돌릴 수 없는 판 손실은 오행진 공명 임계치가 깨지는 경우 하나뿐이다.
const CASUAL_AUTO_SKIP_KINDS = new Set<CasualFusionIssueKind>(["resonance"]);

function casualAutoSkipReason(warnings: readonly CasualFusionIssue[]): string | null {
  return warnings.find((warning) => warning.kind !== undefined && CASUAL_AUTO_SKIP_KINDS.has(warning.kind))?.text ?? null;
}

const REGION_ENEMY_HP_CURVE: Record<RegionCode, { base: number; chapterGrowth: number }> = {
  // Five 4x4 elemental formations expose eighty active tower positions.
  // The 80-slot field produces far more sustained fire than the former 20-slot
  // board. JP/CN recipe graphs complete substantially more evolutions, so their
  // durability rises by chapter instead of front-loading a punishing wave-10
  // multiplier. This preserves the opening tutorial curve and checks late snowball.
  KR: { base: 21.6, chapterGrowth: 0 },
  JP: { base: 23.8, chapterGrowth: 1.04 },
  CN: { base: 24.2, chapterGrowth: 0.97 }
};
const CASUAL_ENEMY_HP_SCALE = 2.2;

// The center formation overlaps more of the loop than the east formation.
// These small route-coverage coefficients make "which element appeared first"
// a build choice rather than a hidden map-position difficulty roll. Once all
// five formations are open their bonuses nearly cancel out.
const FORMATION_ROUTE_COVERAGE_MULTIPLIER = Object.freeze([0.995, 0.995, 0.95, 1.05, 1.01] as const);

function regionEnemyHpMultiplier(region: RegionCode, wave: number, mode: GameMode): number {
  const curve = REGION_ENEMY_HP_CURVE[region];
  const completedChapters = Math.max(0, Math.floor((wave - 1) / 10));
  const regional = curve.base + completedChapters * curve.chapterGrowth;
  return regional * (mode === "casual" ? CASUAL_ENEMY_HP_SCALE : 1);
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
  private combatDistinctElements = 0;

  constructor(seed: string, region: RegionCode = "KR", mode: GameMode = "standard") {
    this.catalog = getCatalog(region);
    this.evolution = new EvolutionService(this.catalog);
    this.rng = new SeededRng(seed);
    const targetChar = this.catalog.goalOrder[0] ?? this.catalog.activePool[0]?.char ?? "";
    this.state = {
      seed,
      region,
      mode,
      phase: "title",
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
    const targetChar = this.catalog.goalOrder[0] ?? this.catalog.activePool[0]?.char ?? "";
    Object.assign(this.state, {
      phase: "prep",
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
      this.endRun("defeat", `적 ${MAX_ENEMIES}체가 전장을 뒤덮었습니다.`);
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
      this.endRun("defeat", `제한시간 ${bossLimit}초 안에 보스를 처치하지 못했습니다.`);
      return;
    }
    const allSpawned = this.state.spawned >= plan.count;
    const deadlineUnlocked = !plan.boss || this.state.bossDefeated;
    if (allSpawned && this.state.enemies.length === 0) {
      this.finishWave();
      return;
    }
    if (allSpawned && deadlineUnlocked) {
      if (this.state.nextWaveRemaining === null) this.state.nextWaveRemaining = WAVE_REINFORCEMENT_DELAY;
      this.state.nextWaveRemaining = Math.max(0, this.state.nextWaveRemaining - delta);
      if (this.state.nextWaveRemaining <= 0) this.advanceWaveWithSurvivors();
    }
  }

  private spawnEnemy(plan: WavePlan): void {
    const isBoss = plan.boss && this.state.spawned === plan.count - 1;
    const bossFactor = bossHpFactorForWave(plan.wave);
    const hpJitter = 0.94 + this.rng.next() * 0.12;
    const hp = plan.hp * (isBoss || !plan.boss ? 1 : 1 / bossFactor) * hpJitter * regionEnemyHpMultiplier(this.state.region, this.state.wave, this.state.mode);
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
    for (const tower of this.state.towers) {
      elements.add(tower.wuxing);
      this.combatCharCounts.set(tower.char, (this.combatCharCounts.get(tower.char) ?? 0) + 1);
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
        const armorPenetration = zone.kind === "caltrops" ? 0.42 : 0;
        this.damageEnemy(enemy, zone.damagePerSecond * delta, false, enemy.weakness === zone.wuxing, armorPenetration);
        if (!this.state.enemies.includes(enemy)) continue;
        if (zone.kind === "roots") {
          enemy.poisonDps = Math.max(enemy.poisonDps, zone.damagePerSecond * 0.24);
          enemy.poisonUntil = Math.max(enemy.poisonUntil, this.state.elapsed + 0.65 * (1 + this.elementTraitLevel("木", 2) * 0.025));
        } else if (zone.kind === "quicksand") {
          enemy.slowFactor = Math.min(enemy.slowFactor, Math.max(0.15, 0.72 - this.elementTraitLevel("土", 0) * 0.01));
          enemy.slowUntil = Math.max(enemy.slowUntil, this.state.elapsed + 0.2);
        } else if (zone.kind === "rain") {
          enemy.slowFactor = Math.min(enemy.slowFactor, 0.64);
          enemy.slowUntil = Math.max(enemy.slowUntil, this.state.elapsed + 0.25 * (1 + this.elementTraitLevel("水", 1) * 0.025));
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

  private updateTowers(delta: number): void {
    for (const tower of this.state.towers) {
      tower.pulse = Math.max(0, tower.pulse - delta * 3);
      tower.abilityFlash = Math.max(0, tower.abilityFlash - delta * 2.4);
      tower.cooldownLeft -= delta;
      if (tower.cooldownLeft > 0) continue;
      const target = this.findTarget(tower);
      if (target) this.fireTower(tower, target);
    }
  }

  private findTarget(tower: Tower): Enemy | undefined {
    const origin = BOARD_CELLS[tower.cell] as Point;
    const definition = definitionForTower(this.catalog, tower.definitionId);
    const range = definition.combat.range + this.towerRangeBonus(tower) + this.idiomBonus("range") + (tower.concentration ?? 0) * 4 + this.combinedUpgradeBonus(tower.wuxing, "range");
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
    // Every elemental start receives the same first-chapter ward. It prevents
    // the free starting formation's map position from deciding a run before
    // the player can buy a second formation, then disappears after wave 10.
    if (this.state.wave <= 10 && towerFormationIndex === this.state.startingFormationIndex) damage *= 1.15;
    if (synergy) damage *= 1 + GAME_CONFIG.synergyBonus + (profile.role === "support" ? 0.08 : 0);
    if (weakness) damage *= GAME_CONFIG.weaknessMultiplier;
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
      const splashRadius = (tuning.splashRadius + signatureControlBonus * 80) * (1 + this.elementTraitLevel("火", 1) * 0.02);
      const splashRatio = (tuning.splashRatio + signatureControlBonus * 0.35) * (1 + this.elementTraitLevel("火", 0) * 0.025);
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
        const spreadTargets = this.state.enemies
          .filter((candidate) => candidate.id !== target.id && distance(this.enemyPoint(candidate), targetPoint) <= tuning.splashRadius + 22)
          .slice(0, 5);
        for (const enemy of spreadTargets) this.damageEnemy(enemy, damage * tuning.roleSplashRatio * abilityPower, false, enemy.weakness === tower.wuxing);
        roleTargets += spreadTargets.length;
        roleEffect = "주변 " + String(spreadTargets.length) + "체에 " + String(Math.round(tuning.roleSplashRatio * 100)) + "% 확산";
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
    const zone = this.deployElementZone(tower, target, damage, potency, abilityPower);
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
      const radius = 115;
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
    } else {
      effect = "뜻 구현 · 이번 공격 ×" + tuning.semanticMultiplier.toFixed(2);
    }

    if (family !== "weather") effect += ` · ${zone.label} ${zone.duration.toFixed(1)}초`;

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
    this.currentPlan = wavePlan(nextWave);
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

  summon(forceIntent = false): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const cost = summonCost(this.state.summonCount);
    if (this.state.gold < cost) return { ok: false, message: "엽전이 " + String(cost - this.state.gold) + " 부족합니다." };
    if (this.runSummonPool.length === 0) return { ok: false, message: "이 지역의 활성 소환 풀이 비어 있습니다." };
    const maxStage = this.state.mode === "casual" ? 5 : maxSummonStageForWave(this.state.wave);
    const summonPool = this.state.mode === "casual"
      ? [...this.runSummonPool]
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
      return weight * stageWeight;
    });
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
    for (let index = 0; index < amount; index += 1) {
      const result = this.summon(index === amount - 1 && amount >= 10);
      if (!result.ok) return result;
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
    const labels: Record<SummonIntent, string> = { balanced: "균형", discovery: "탐색", lineage: "계보", concentration: "중복 수집" };
    this.state.lastMessage = `${labels[intent]} 소환 선택 · 10연 마지막 결과에 목적 보정`;
    return { ok: true, message: this.state.lastMessage };
  }

  casualFusionQuote(coreId: number, materialIds: readonly number[]): CasualFusionQuote {
    const quote: CasualFusionQuote = {
      coreId,
      materialIds: [...materialIds],
      fromStar: null,
      toStar: null,
      wuxing: null,
      blocked: [],
      warnings: []
    };
    if (this.state.mode !== "casual") {
      quote.blocked.push({ towerId: null, text: "캐주얼 8성전에서만 같은 오행 3체 조합을 사용할 수 있습니다." });
      return quote;
    }
    if (materialIds.length !== 2) {
      quote.blocked.push({ towerId: null, text: "본체 1기와 재료 2기를 정확히 선택하세요." });
      return quote;
    }
    const uniqueIds = new Set([coreId, ...materialIds]);
    if (uniqueIds.size !== 3) {
      quote.blocked.push({ towerId: null, text: "서로 다른 자령 3기를 선택해야 합니다." });
      return quote;
    }
    const all = [...this.state.towers, ...this.state.inventoryTowers];
    const core = all.find((tower) => tower.id === coreId);
    const materials = materialIds
      .map((id) => all.find((tower) => tower.id === id))
      .filter((tower): tower is Tower => Boolean(tower));
    if (!core) quote.blocked.push({ towerId: coreId, text: "남길 본체 자령이 이동했거나 사라졌습니다." });
    for (const id of materialIds) {
      if (!materials.some((tower) => tower.id === id)) quote.blocked.push({ towerId: id, text: `재료 #${id}이 이동했거나 사라졌습니다.` });
    }
    if (!core || materials.length !== 2) return quote;

    const fromStar = core.casualStar ?? core.naturalStar ?? null;
    quote.fromStar = fromStar;
    quote.toStar = fromStar === null ? null : casualStarAfterFusion(fromStar);
    quote.wuxing = core.wuxing;
    if (fromStar === null || materials.some((tower) => (tower.casualStar ?? tower.naturalStar) === undefined)) {
      quote.blocked.push({ towerId: null, text: "선택한 자령의 별 정보를 확인할 수 없습니다." });
    } else if (fromStar >= 8) {
      quote.blocked.push({ towerId: core.id, text: `${core.char}은 이미 최고 8★입니다.` });
    }
    for (const material of materials) {
      if (material.locked) quote.blocked.push({ towerId: material.id, text: `${material.char}은 잠겨 있어 재료로 쓸 수 없습니다.` });
      if (material.wuxing !== core.wuxing) quote.blocked.push({ towerId: material.id, text: `${material.char}은 ${core.wuxing}행이 아닙니다.` });
      if ((material.casualStar ?? material.naturalStar) !== fromStar) {
        quote.blocked.push({ towerId: material.id, text: `${material.char}의 현재 별이 본체와 다릅니다.` });
      }
    }
    if (quote.blocked.length > 0) return quote;

    const assessmentById = new Map(this.cleanupAssessments().map((assessment) => [assessment.towerId, assessment]));
    const standardMaterialIds = new Set(
      this.evolution.getAvailableRecipes(all, this.state.targetChar, null, "semi")
        .flatMap((option) => option.materialTowerIds)
    );
    const warningKeys = new Set<string>();
    for (const material of materials) {
      const assessment = assessmentById.get(material.id);
      for (const reason of assessment?.protectedReasons ?? []) {
        if (reason === "잠금 자령") continue;
        const key = `${material.id}:${reason}`;
        if (warningKeys.has(key)) continue;
        warningKeys.add(key);
        const kind: CasualFusionIssueKind = reason.endsWith("공명 임계치")
          ? "resonance"
          : reason === "유일 보유 한자" ? "unique" : "protected";
        quote.warnings.push({ towerId: material.id, text: `${material.char} · ${reason}`, kind });
      }
      if (standardMaterialIds.has(material.id)) {
        const key = `${material.id}:standard-recipe`;
        if (!warningKeys.has(key)) quote.warnings.push({ towerId: material.id, text: `${material.char} · 일반 모드 합성식에 바로 쓸 수 있는 재료`, kind: "standard-recipe" });
        warningKeys.add(key);
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
   * 봉인이 끝난 사자성어에 참여 중인 전장 자령 id 집합.
   * 봉인 성어의 글자를 재료로 태우면 이미 얻은 봉인이 깨지므로, 미완 성어와
   * 똑같이 재료 후보에서 제외해야 한다(요구 4의 "생각 못한 사각").
   */
  private sealedIdiomTowerIds(): Set<number> {
    const sealedCells = new Set(this.state.idiomSeals.flatMap((seal) => seal.cells));
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

  private casualProtectionContext(): {
    targetPath: Set<string>;
    unfinishedIdiomChars: Set<string>;
    standardMaterialIds: Set<number>;
    sealedTowerIds: Set<number>;
  } {
    const all = [...this.state.towers, ...this.state.inventoryTowers];
    return {
      targetPath: this.state.mode === "casual" ? new Set([this.state.targetChar]) : this.evolution.getTargetPath(this.state.targetChar),
      unfinishedIdiomChars: new Set(
        this.idioms()
          .filter((idiom) => !this.state.idiomSeals.some((seal) => seal.idiomId === idiom.id))
          .flatMap((idiom) => [...idiom.chars])
      ),
      standardMaterialIds: new Set(
        this.evolution.getAvailableRecipes(all, this.state.targetChar, null, "semi").flatMap((option) => option.materialTowerIds)
      ),
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
    if (context.sealedTowerIds.has(tower.id)) return "봉인 완료 사자성어 참여";
    if (context.standardMaterialIds.has(tower.id)) return "일반 모드 합성식 재료";
    return null;
  }

  fuseCasual(coreId: number, materialIds: readonly number[], allowWarnings = false): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const quote = this.casualFusionQuote(coreId, materialIds);
    if (quote.blocked.length > 0) return { ok: false, message: `조합 중단 · ${quote.blocked[0]?.text ?? "조건을 다시 확인하세요."}` };
    if (!allowWarnings && quote.warnings.length > 0) {
      return { ok: false, message: `확인 필요 · ${quote.warnings[0]?.text ?? "보호 대상이 포함되어 있습니다."}` };
    }
    return this.performCasualFusion(quote);
  }

  casualAutoFusionPlan(wuxing: Wuxing): CasualAutoFusionGroup[] {
    if (this.state.mode !== "casual") return [];
    const owned = [...this.state.towers, ...this.state.inventoryTowers]
      .filter((tower) => tower.wuxing === wuxing && (tower.casualStar ?? 8) < 8);
    const context = this.casualProtectionContext();
    const isSafeMaterial = (tower: Tower): boolean => this.casualMaterialProtectionFor(tower, context) === null;
    // 본체는 "재료로 쓰면 안 되는 자령"부터 고른다. 보호 대상이 본체 자리에
    // 앉아야 재료 후보가 최대로 남고, 보호 자령이 소모될 길도 함께 사라진다.
    const coreRank = (tower: Tower): number =>
      this.casualMaterialProtectionFor(tower, context) !== null ? 0 : tower.cell >= 0 ? 1 : 2;
    const value = (tower: Tower): number => {
      const definition = definitionForTower(this.catalog, tower.definitionId);
      return definition.combat.baseDamage * this.towerPowerMultiplier(tower) * definition.combat.budgetMultiplier / this.towerAttackCooldown(tower);
    };
    const groups: CasualAutoFusionGroup[] = [];
    for (let star = 1 as CasualStar; star <= 7; star = (star + 1) as CasualStar) {
      const available = owned
        .filter((tower) => (tower.casualStar ?? tower.naturalStar) === star)
        .sort((left, right) => value(right) - value(left) || left.id - right.id);
      while (available.length >= 3) {
        const safeMaterials = available.filter(isSafeMaterial);
        if (safeMaterials.length < 2) break;
        const core = [...available].sort((left, right) =>
          coreRank(left) - coreRank(right) || value(right) - value(left) || left.id - right.id)[0];
        if (!core) break;
        const materialPool = available
          .filter((tower) => tower.id !== core.id && isSafeMaterial(tower))
          .sort((left, right) => Number(left.cell >= 0) - Number(right.cell >= 0) || value(left) - value(right) || right.id - left.id);
        const materials = materialPool.slice(0, 2);
        if (materials.length !== 2) break;
        const quote = this.casualFusionQuote(core.id, materials.map((tower) => tower.id));
        if (quote.blocked.length > 0 || quote.toStar === null) break;
        groups.push({
          coreId: core.id,
          materialIds: [materials[0]?.id ?? -1, materials[1]?.id ?? -1],
          fromStar: star,
          toStar: quote.toStar,
          warnings: quote.warnings,
          autoSkipReason: casualAutoSkipReason(quote.warnings)
        });
        const usedIds = new Set([core.id, ...materials.map((tower) => tower.id)]);
        for (let index = available.length - 1; index >= 0; index -= 1) {
          if (usedIds.has(available[index]?.id ?? -1)) available.splice(index, 1);
        }
      }
    }
    return groups;
  }

  autoFuseCasualElement(wuxing: Wuxing, allowWarnings = false): ActionResult {
    return this.autoFuseCasual(wuxing, allowWarnings);
  }

  /**
   * 원클릭 승급. `scope` 가 "all" 이면 오행 전체를 순서대로 처리한다.
   * warning 이 있는 묶음은 예전처럼 전체를 중단시키지 않고 그 묶음만 건너뛰며,
   * 건너뛴 수와 사유를 결과에 담아 화면이 반드시 알릴 수 있게 한다.
   */
  autoFuseCasual(scope: Wuxing | "all", allowWarnings = false, onlyStar: CasualStar | null = null): CasualAutoFusionReport {
    const empty = { fused: 0, consumed: 0, skipped: 0, skipReason: null, firstFusion: null } as const;
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다.", ...empty };
    const scopes: Wuxing[] = scope === "all" ? [...WUXING_ORDER] : [scope];
    const planned = scopes
      .flatMap((wuxing) => this.casualAutoFusionPlan(wuxing))
      .filter((group) => onlyStar === null || group.fromStar === onlyStar);
    if (planned.length === 0) {
      const label = scope === "all" ? "보유 자령" : `${scope}행 보유 자령`;
      return { ok: false, message: `${label} 중 안전하게 묶을 같은 별 자령 3기가 없습니다.`, ...empty };
    }
    const runnable = allowWarnings ? planned : planned.filter((group) => group.autoSkipReason === null);
    const skipped = planned.length - runnable.length;
    const skipReason = planned.find((group) => group.autoSkipReason !== null)?.autoSkipReason ?? null;
    if (runnable.length === 0) {
      return {
        ok: false,
        message: `보호로 ${skipped}묶음을 모두 건너뜀 · ${skipReason ?? "재료가 보호 대상입니다."}`,
        ...empty,
        skipped,
        skipReason
      };
    }

    const all = [...this.state.towers, ...this.state.inventoryTowers];
    let fused = 0;
    let fromBoard = 0;
    let firstFusion: CasualAutoFusionReport["firstFusion"] = null;
    for (const group of runnable) {
      const quote = this.casualFusionQuote(group.coreId, group.materialIds);
      if (quote.blocked.length > 0) break;
      const core = all.find((tower) => tower.id === group.coreId);
      const consumedTowers = group.materialIds
        .map((id) => all.find((tower) => tower.id === id))
        .filter((tower): tower is Tower => tower !== undefined);
      const result = this.performCasualFusion(quote);
      if (!result.ok) break;
      fused += 1;
      fromBoard += consumedTowers.filter((tower) => tower.cell >= 0).length;
      if (!firstFusion && core) {
        firstFusion = {
          wuxing: core.wuxing,
          char: core.char,
          fromStar: group.fromStar,
          toStar: group.toStar,
          consumedChars: consumedTowers.map((tower) => tower.char)
        };
      }
    }
    if (fused === 0) return { ok: false, message: "조합 대상이 바뀌었습니다. 다시 확인하세요.", ...empty, skipped, skipReason };

    const detail = firstFusion
      ? `${firstFusion.wuxing} ${firstFusion.fromStar}★×3 → ${firstFusion.toStar}★ ${firstFusion.char} · 소모: ${firstFusion.consumedChars.join("·")}`
      : "";
    const head = fused > 1 ? `승급 ${fused}회 · 소모 ${fused * 2}기` : "승급 1회";
    const board = fromBoard > 0 ? ` · 전장 ${fromBoard}기 포함` : "";
    const tail = skipped > 0 ? ` · 보호로 ${skipped}그룹 건너뜀` : "";
    this.state.lastMessage = `${head}${detail ? ` · ${detail}` : ""}${board}${tail}`;
    return { ok: true, message: this.state.lastMessage, fused, consumed: fused * 2, skipped, skipReason, firstFusion };
  }

  private performCasualFusion(quote: CasualFusionQuote): ActionResult {
    if (quote.fromStar === null || quote.toStar === null || quote.wuxing === null) {
      return { ok: false, message: "조합 별 정보를 다시 확인하세요." };
    }
    const all = [...this.state.towers, ...this.state.inventoryTowers];
    const core = all.find((tower) => tower.id === quote.coreId);
    const consumed = quote.materialIds
      .map((id) => all.find((tower) => tower.id === id))
      .filter((tower): tower is Tower => Boolean(tower));
    if (!core || consumed.length !== 2) return { ok: false, message: "조합 대상이 바뀌었습니다. 다시 선택하세요." };
    const consumedIds = new Set(consumed.map((tower) => tower.id));
    const refunds = emptyElementEssence();
    for (const tower of consumed) refunds[tower.wuxing] += concentrationEssenceRefund(tower.concentration ?? 0);
    this.state.towers = this.state.towers.filter((tower) => !consumedIds.has(tower.id));
    this.state.inventoryTowers = this.state.inventoryTowers.filter((tower) => !consumedIds.has(tower.id));
    for (const wuxing of Object.keys(refunds) as Wuxing[]) this.state.elementEssence[wuxing] += refunds[wuxing];
    core.casualStar = quote.toStar;
    core.pulse = 1;
    core.abilityFlash = 1;
    this.state.selectedTowerId = core.id;
    this.state.casualFusionCount += 1;
    const stroke = casualStrokeCount(core.char);
    const natural = core.naturalStar ?? quote.fromStar;
    const baseLabel = stroke === null ? "" : ` · 기본 ${natural}★(${stroke}획)`;
    this.state.lastMessage = `${core.wuxing}행 3체 조합 · ${core.char} ${quote.fromStar}★→${quote.toStar}★${baseLabel}`;
    this.events.push({
      type: "casualFuse",
      at: core.cell >= 0 ? BOARD_CELLS[core.cell] as Point : { x: 440, y: 360 },
      tower: { ...core },
      consumed: consumed.map((tower) => ({ ...tower })),
      fromStar: quote.fromStar,
      toStar: quote.toStar
    });
    return { ok: true, message: this.state.lastMessage };
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
    if (this.state.mode === "casual") return { ok: false, message: "캐주얼 8성전에서는 같은 오행·같은 별 자령 3기를 선택해 조합합니다." };
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
    const next = this.catalog.goalOrder.find((candidate) => !this.state.goalsCompleted.includes(candidate));
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
    return this.state.globalUpgrades[stat] * UPGRADE_STAT_META[stat].globalPerLevel;
  }

  elementUpgradeBonus(wuxing: Wuxing, stat: UpgradeStat): number {
    return this.state.elementUpgrades[wuxing][stat] * UPGRADE_STAT_META[stat].elementPerLevel;
  }

  combinedUpgradeBonus(wuxing: Wuxing, stat: UpgradeStat): number {
    return this.globalUpgradeBonus(stat) + this.elementUpgradeBonus(wuxing, stat);
  }

  towerAttackCooldown(tower: Tower): number {
    const profile = definitionForTower(this.catalog, tower.definitionId).combat;
    const concentration = tower.concentration ?? 0;
    const concentrationHaste = tower.concentrationPath === "swift" ? concentration * 0.075 : concentration * 0.02;
    const upgradeHaste = this.combinedUpgradeBonus(tower.wuxing, "attackSpeed");
    const progressionHaste = this.state.mode === "casual"
      ? ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * 0.02
      : (tower.stage - 1) * 0.035;
    return Math.max(0.28, profile.cooldown * (1 - progressionHaste) * (1 - concentrationHaste) / (1 + upgradeHaste));
  }

  towerPowerMultiplier(tower: Tower): number {
    return this.state.mode === "casual"
      ? CASUAL_STAR_POWER[tower.casualStar ?? tower.naturalStar ?? 1]
      : STAGE_MULTIPLIERS[tower.stage];
  }

  towerRangeBonus(tower: Tower): number {
    return this.state.mode === "casual"
      ? ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * 3
      : (tower.stage - 1) * 7;
  }

  towerHasActiveSkills(tower: Tower): boolean {
    if (this.state.mode === "casual") return (tower.casualStar ?? tower.naturalStar ?? 1) >= 2;
    return hasActiveSkills(definitionForTower(this.catalog, tower.definitionId));
  }

  towerDismantleEssenceValue(tower: Tower): number {
    if (this.state.mode === "standard") return dismantleEssenceValue(tower.stage, tower.concentration ?? 0);
    const base = [0, 1, 1, 2, 3, 5, 7, 10, 14][tower.casualStar ?? tower.naturalStar ?? 1] ?? 1;
    return base + concentrationEssenceRefund(tower.concentration ?? 0);
  }

  towerDismantleScore(tower: Tower): number {
    if (this.state.mode === "standard") return dismantleScoreForStage(tower.stage);
    return [0, 1, 1, 3, 3, 6, 6, 10, 15][tower.casualStar ?? tower.naturalStar ?? 1] ?? 1;
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
    const sealedBefore = this.state.idiomSeals.length;
    const resonanceBefore = BOARD_FORMATIONS.reduce((sum, _, index) => sum + this.formationResonance(index).tier, 0);
    const occupiedCells = new Set(this.state.towers.map((tower) => tower.cell));
    const emptyCells = BOARD_CELLS.map((_, index) => index).filter((cell) => this.isCellUnlocked(cell) && !occupiedCells.has(cell));
    const deployed = this.state.inventoryTowers.splice(0, emptyCells.length);
    for (let index = 0; index < deployed.length; index += 1) {
      const tower = deployed[index] as Tower;
      tower.cell = emptyCells[index] as number;
      this.state.towers.push(tower);
    }

    for (let guard = 0; guard < this.idioms().length; guard += 1) {
      const idiom = this.idioms().find((candidate) =>
        !this.state.idiomSeals.some((seal) => seal.idiomId === candidate.id)
        && this.towersForIdiom(candidate) !== null
      );
      if (!idiom) break;
      const chosen = this.towersForIdiom(idiom);
      if (!chosen) break;
      this.placeIdiomTowers(chosen);
      if (this.resolveIdiomFormations() === 0) break;
    }

    this.optimizeFormationCells();
    this.resolveIdiomFormations();

    const sealed = this.state.idiomSeals.length - sealedBefore;
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

  private towersForIdiom(idiom: IdiomDefinition): Tower[] | null {
    const used = new Set<number>();
    const chosen: Tower[] = [];
    for (const char of idiom.chars) {
      const tower = this.state.towers
        .filter((candidate) => candidate.char === char && !used.has(candidate.id))
        .sort((left, right) => left.cell - right.cell || left.id - right.id)[0];
      if (!tower) return null;
      chosen.push(tower);
      used.add(tower.id);
    }
    return chosen;
  }

  private placeIdiomTowers(chosen: readonly Tower[]): void {
    const formation = BOARD_FORMATIONS
      .map((candidate, index) => ({
        candidate,
        index,
        score: chosen.reduce((sum, tower) => {
          const inFormation = tower.cell >= candidate.startCell && tower.cell < candidate.startCell + CELLS_PER_FORMATION;
          return sum + (tower.wuxing === candidate.preferredWuxing ? 4 : 0) + (inFormation ? 1 : 0);
        }, 0)
      }))
      .filter(({ index }) => this.isFormationUnlocked(index))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.candidate;
    if (!formation) return;
    const cells = Array.from({ length: 4 }, (_, index) => formation.startCell + index);
    for (let index = 0; index < chosen.length; index += 1) {
      const tower = chosen[index] as Tower;
      const targetCell = cells[index] as number;
      if (tower.cell === targetCell) continue;
      const occupant = this.state.towers.find((candidate) => candidate.cell === targetCell);
      if (occupant && occupant.id !== tower.id) occupant.cell = tower.cell;
      tower.cell = targetCell;
    }
  }

  private optimizeFormationCells(): void {
    const assignment = new Map<number, number>();
    const availableCells = new Set(BOARD_CELLS.map((_, index) => index).filter((cell) => this.isCellUnlocked(cell)));
    const unassigned = new Set(this.state.towers.map((tower) => tower.id));

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

  cleanupAssessments(): CleanupAssessment[] {
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
      if (count <= 1) protectedReasons.push("유일 보유 한자");
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
      return { towerId: tower.id, protected: protectedReasons.length > 0, score, reasons, protectedReasons };
    });
  }

  cleanupCandidates(limit = 12, inventoryOnly = false): CleanupAssessment[] {
    return this.cleanupAssessments()
      .filter((assessment) => !assessment.protected)
      .filter((assessment) => !inventoryOnly || this.state.inventoryTowers.some((tower) => tower.id === assessment.towerId))
      .sort((left, right) => left.score - right.score || left.towerId - right.towerId)
      .slice(0, Math.max(0, limit));
  }

  quoteDismantle(ids: readonly number[]): DismantleQuote {
    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id)))];
    const assessments = new Map(this.cleanupAssessments().map((assessment) => [assessment.towerId, assessment]));
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
      if ((ownedCounts.get(tower.char) ?? 0) - (selectedCounts.get(tower.char) ?? 0) < 1) {
        blocked.push({ towerId: tower.id, reason: "일괄 처리 후 유일 보유 한자가 사라집니다." });
        continue;
      }
      eligibleIds.push(tower.id);
      gains[tower.wuxing] += this.towerDismantleEssenceValue(tower);
      scoreGains[tower.wuxing] += this.towerDismantleScore(tower);
    }
    return { ids: eligibleIds, gains, scoreGains, blocked };
  }

  dismantleTowers(ids: readonly number[]): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    // Rebuild the quote immediately before mutation so moved, locked, or newly
    // protected material can never be consumed from a stale UI selection.
    const quote = this.quoteDismantle(ids);
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
    return { ok: true, message: this.state.lastMessage };
  }

  dismantleSelected(): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "분해할 자령을 선택하세요." };
    return this.dismantleTowers([selected.id]);
  }

  dismantleRecommended(limit = 8): ActionResult {
    const ids = this.cleanupCandidates(limit, true).map((candidate) => candidate.towerId);
    if (ids.length === 0) return { ok: false, message: "보호 규칙을 통과한 인벤토리 정리 후보가 없습니다." };
    return this.dismantleTowers(ids);
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
      ? ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * 0.02
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
      return { ok: false, message: "이미 선택한 농축 분기는 변경할 수 없습니다." };
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
    this.state.lastMessage = `${target.char} 濃 ${target.concentration}/3 · ${quote.path === "swift" ? "연속" : "심화"} 농축`;
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
    const chosenPath = selected.concentrationPath ?? path;
    if (!chosenPath) return { ok: false, message: "연속 농축 또는 심화 농축을 선택하세요." };
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

  idiomBonus(kind: IdiomBonusKind): number {
    const total = this.state.idiomSeals.reduce((sum, seal) => {
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

  resolveIdiomFormations(): number {
    if (!this.isRunActive()) return 0;
    let activated = 0;
    for (const idiom of this.idioms()) {
      if (this.state.idiomSeals.some((seal) => seal.idiomId === idiom.id)) continue;
      const cells = findIdiomPath(this.state.towers, idiom);
      if (!cells) continue;
      this.activateIdiom(idiom, cells);
      activated += 1;
    }
    return activated;
  }

  private activateIdiom(idiom: IdiomDefinition, cells: readonly number[]): void {
    this.state.idiomSeals.push({ idiomId: idiom.id, cells: [...cells], completedAt: this.state.elapsed });
    this.state.lastMessage = idiom.name + " · " + idiom.reading + " 자동 봉인 · " + idiom.bonus.label;
    this.events.push({
      type: "idiom",
      idiomId: idiom.id,
      chars: idiom.chars,
      reading: idiom.reading,
      meaning: idiom.meaning,
      bonus: idiom.bonus.label,
      color: idiom.color,
      cells: [...cells]
    });
    this.runSummonPool = this.buildRunSummonPool();
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

  private endRun(phase: "victory" | "defeat", message: string): void {
    this.state.phase = phase;
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
          const path: ConcentrationPath = concentrationTarget.concentrationPath
            ?? (concentrationTarget.combatRole === "rapid" || concentrationTarget.combatRole === "support" ? "swift" : "potent");
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
      const disposable = [...engine.state.towers]
        .filter((tower) => !tower.locked && (tower.concentration ?? 0) === 0 && !protectedChars.has(tower.char))
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
  const options = engine.availableEvolutions();
  const idiom = engine.currentIdiomTarget();
  if (!idiom) return options.find((candidate) => candidate.onTargetPath) ?? options[0];
  const exactChars = new Set(idiom.chars);
  const idiomPath = new Set<string>();
  for (const char of exactChars) for (const pathChar of engine.evolution.getTargetPath(char)) idiomPath.add(pathChar);
  const required = new Map<string, number>();
  for (const char of idiom.chars) required.set(char, (required.get(char) ?? 0) + 1);
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

function arrangeAvailableAutoplayIdioms(engine: GameEngine): void {
  for (let guard = 0; guard < engine.idioms().length; guard += 1) {
    const idiom = engine.currentIdiomTarget();
    if (!idiom) return;
    const chosen: Tower[] = [];
    const usedIds = new Set<number>();
    for (const char of idiom.chars) {
      const tower = engine.state.towers.find((candidate) => candidate.char === char && !usedIds.has(candidate.id));
      if (!tower) return;
      chosen.push(tower);
      usedIds.add(tower.id);
    }
    for (let index = 0; index < chosen.length; index += 1) {
      const tower = chosen[index] as Tower;
      const targetCell = index;
      const occupant = engine.state.towers.find((candidate) => candidate.cell === targetCell);
      if (occupant && occupant.id !== tower.id) occupant.cell = tower.cell;
      tower.cell = targetCell;
    }
    if (engine.resolveIdiomFormations() === 0) return;
  }
}
