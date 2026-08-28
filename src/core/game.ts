import {
  CHAINSEAL_SEAL_SECONDS,
  CHAINSEAL_STACK_WINDOW,
  CHAINSEAL_STORE_RATIO,
  chainsealMaxStacks,
  commandRallySeconds,
  ECHO_DAMAGE_BONUS,
  echoSeconds,
  DEMISE_MAX_TARGETS,
  DEMISE_STORE_RATIO,
  demiseSpreadRadius,
  FROST_ZONE_DURATION,
  FROST_ZONE_RADIUS,
  frostSlowRatio,
  GWICHEON_ABILITY,
  GWICHEON_MIN_STAR,
  GWICHEON_RUSH_THRESHOLD,
  gwicheonChargeSeconds,
  HARVEST_KILLS_PER_ESSENCE,
  hasActiveSkills,
  MIRE_MIN_ENEMIES,
  MIRE_SUPPRESS_GRACE,
  MIRE_ZONE_RADIUS,
  MIRE_ZONE_SECONDS,
  MOMENTUM_STACK_BONUS,
  momentumMaxStacks,
  REAPER_BOSS_CHIP_RATIO,
  REAPER_EXECUTE_COOLDOWN_SECONDS,
  reaperExecuteThreshold,
  SCORCH_DPS_RATIO,
  SCORCH_ZONE_RADIUS,
  scorchZoneSeconds,
  STROKE_RESONANCE_MAX_STACKS,
  strokeResonanceCooldownScale,
  strokeResonanceStacks,
  WARFARE_BRAND_DURATION,
  warfareBrandPower
} from "./abilities";
import {
  CASUAL_POLARIS_AURA,
  CASUAL_SPLASH_STAR_SCALE,
  CASUAL_STAR_HASTE_PER_STAR,
  CASUAL_STAR_POWER,
  CASUAL_STAR_RANGE,
  casualNaturalStar
} from "./casual";
import {
  autoFuseCasual as runAutoFuseCasual,
  casualAutoFusionPlan as buildCasualAutoFusionPlan,
  casualFusionQuote as buildCasualFusionQuote,
  casualMaterialProtection as findCasualMaterialProtection,
  casualMaterialProtections as listCasualMaterialProtections,
  casualResultPool as findCasualResultPool,
  fuseCasual as runFuseCasual,
  type CasualFusionContext
} from "./casual-fusion";
import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  bossHpFactorForWave,
  bossSpawnProgress,
  bossTimeLimitForWave,
  CELLS_PER_FORMATION,
  FORMATION_COLUMNS,
  FORMATION_ROWS,
  INITIAL_UNLOCKED_FORMATIONS,
  isBoardCellUnlocked,
  isFormationUnlocked,
  MAX_ENEMIES,
  nextFormationUnlockCost,
  positionOnPath,
  spawnProgressForEnemy,
  SUMMON_CELL_ORDER,
  unlockedTowerCapacity,
  WAVE_REINFORCEMENT_DELAY,
  waveClearReward,
  wavePlan
} from "./content";
import {
  type CasualAutoFusionGroup,
  type CasualAutoFusionReport,
  type CasualFusionQuote,
  type CasualFusionResult,
  type CasualResultPool,
  type CleanupAssessment,
  type CleanupOptions,
  type ConcentrationCombatSnapshot,
  type ConcentrationQuote,
  type DismantleQuote,
  type GameEngineOptions,
  type UpgradeQuote
} from "./engine-quotes";
import {
  autoConcentrationPath,
  CASUAL_BOSS_HP_TRIM,
  casualDismantleEssence,
  casualDismantleScore,
  casualGoalOrder,
  casualStarBandShare,
  casualSummonStarDistribution,
  concentrationEssenceCost,
  concentrationEssenceRefund,
  concentrationPathLabel,
  dismantleEssenceValue,
  distance,
  ELEMENT_ZONE_SPECS,
  emptyElementEssence,
  emptyElementUpgrades,
  emptyStatUpgrades,
  FIRST_PREP_SECONDS,
  FORMATION_ROUTE_COVERAGE_MULTIPLIER,
  GATE_OPENING_WARD,
  IDIOM_RESEARCH_CONNECTION_SCALE,
  idiomWishCost,
  interestForGold,
  CONCENTRATION_FREEZE_LEVEL,
  MODE_ENEMY_COUNT_SCALE,
  multiSummonCost,
  regionEnemyHpMultiplier,
  SUMMON_STAGE_WEIGHTS,
  summonCost,
  summonSurcharge,
  type SummonStarBand,
  TALISMAN_MODE_ENEMY_HP_SCALE,
  TIERED_SUMMON_INTENTS,
  TUTORIAL_ENEMY_COUNT_SCALE,
  TUTORIAL_ENEMY_HP_SCALE,
  IDIOM_SEAL_ATTACK_CAP,
  IDIOM_SEAL_ATTACK_PER_SEAL,
  WILD_SOUL_DROP_CHANCE,
  weightedPick
} from "./engine-tuning";
import { EvolutionService } from "./evolution";
import {
  dismantleScoreForStage,
  ELEMENT_TRAIT_MAX_LEVEL,
  elementTraitExtraChainTargets,
  elementTraitUnlockScore,
  elementTraitUpgradeCost,
  emptyElementTraitLevels
} from "./growth";
import {
  activePoolBaseWeight,
  CASUAL_PAIR_WEIGHT,
  definitionForTower,
  ELEMENT_STYLES,
  elementUpgradeCost,
  GAME_CONFIG,
  generatorOf,
  getCatalog,
  globalUpgradeCost,
  goalRewardForWave,
  isTierSummonIntent,
  MAX_UPGRADE_LEVEL,
  maxSummonStageForWave,
  MIN_TIER_POOL_SIZE,
  researchConnectionBonus,
  researchCost,
  researchUnlockWave,
  sellValue,
  STAGE_MULTIPLIERS,
  SUMMON_INTENT_LABELS,
  SUMMON_STAR_BANDS,
  UPGRADE_STAT_META,
  upgradeEffectiveLevels
} from "./hanzi";
import {
  featuredIdiomsForRun,
  findIdiomPath,
  helpfulDirectCharsForIdiom,
  idiomById,
  type IdiomDefinition,
  idiomDirectPoolChars,
  idiomsForRegion,
  idiomWishChars
} from "./idioms";
import { defaultNotationForRegion } from "./notation";
import { SeededRng } from "./rng";
import {
  type AbilitySpec,
  type AbilityZone,
  type ActionResult,
  type AutomationMode,
  type CasualStar,
  type CompositionBranchPreview,
  type ConcentrationLevel,
  type ConcentrationPath,
  type ConcentrationPayment,
  type DefeatCause,
  type Enemy,
  type EngineRuntimeSnapshot,
  type EvolutionOption,
  type GameEvent,
  type GameMode,
  type GameState,
  type GoalProgress,
  type NotationCode,
  type HanziCatalog,
  type HanziDefinition,
  type IdiomBonusKind,
  type IdiomSeal,
  type Point,
  type RegionCode,
  type SummonIntent,
  type Tower,
  type UpgradeStat,
  type WavePlan,
  type Wuxing
} from "./types";

// 갈래로 옮겼지만 `core/game` 이 계속 내보내던 공개 표면. 부르는 쪽은 그대로다.
export { runAutoplay } from "./autoplay";
export {
  type CleanupAssessment,
  type CleanupOptions,
  type DismantleQuote,
  type UpgradeQuote,
  type ConcentrationCombatSnapshot,
  type ConcentrationQuote,
  type CasualFusionIssueKind,
  type CasualFusionIssue,
  type CasualResultPool,
  type CasualFusionQuote,
  type CasualAutoFusionGroup,
  type CasualFusionGain,
  type CasualFusionResult,
  type CasualAutoFusionReport,
  type GameEngineOptions
} from "./engine-quotes";
export {
  elementZoneKind,
  type SummonStarBand,
  interestForGold,
  FIRST_PREP_SECONDS,
  GATE_OPENING_WARD,
  IDIOM_RESEARCH_CONNECTION_SCALE,
  concentrationEssenceCost,
  autoConcentrationPath,
  concentrationPathLabel,
  concentrationEssenceRefund,
  IDIOM_WISH_COST_MULTIPLIER,
  idiomWishCost,
  dismantleEssenceValue,
  casualDismantleEssence,
  casualDismantleScore,
  casualFusionEssenceRefund,
  casualFusionDismantleScore,
  TUTORIAL_ENEMY_HP_SCALE,
  TUTORIAL_ENEMY_COUNT_SCALE
} from "./engine-tuning";

/**
 * 목표 서책의 성어 동시 추적 상한 — gripe #3 합의값. 부족 글자 합집합이
 * 소환 가중을 나눠 갖는 구조라, 셋을 넘기면 가중이 묽어져 "고르는 재미"가
 * 사라진다.
 */
export const MAX_TRACKED_IDIOMS = 3;

/**
 * 기존 성어의 전역 보너스 상한. 커스텀만 굴리는 축은 여기에 없다(상한 없음이
 * 아니라 기존 성어가 그 축을 아예 안 굴린다).
 */
const BASE_IDIOM_BONUS_CAPS: Partial<Record<IdiomBonusKind, number>> = {
  damage: 0.15,
  range: 36,
  enemySlow: 0.1,
  evolutionGold: 8
};

/**
 * 커스텀 성어의 전역 보너스 상한. 장착 15구를 한 축에 몰아도 판이 무너지지
 * 않을 선에서 잡았다 — 대략 「좋은 굴림 3~4구」가 천장이다.
 */
const CUSTOM_IDIOM_BONUS_CAPS: Record<IdiomBonusKind, number> = {
  damage: 0.24,
  range: 60,
  enemySlow: 0.16,
  evolutionGold: 20,
  killEssence: 5,
  waveGold: 40,
  weaknessDamage: 0.35,
  formationAttack: 0.4
};

/** 이 판의 지역 성어 명단 자리 수. 장착한 커스텀 성어는 이 위에 얹힌다. */
const FEATURED_IDIOM_SLOTS = 5;

export class GameEngine {
  readonly state: GameState;
  readonly catalog: HanziCatalog;
  readonly evolution: EvolutionService;
  /** 이 런의 목표 사다리. 표준은 지역 목표 그대로, 캐주얼은 풀 안 글자로 좁힌다(F2). */
  readonly goalOrder: readonly string[];
  /** 수련장 여부. 켜져 있을 때만 완화 계수와 tutorialGrant* 지급 훅이 산다. */
  readonly tutorial: boolean;
  /**
   * 부적 만들기를 켠 런인가(트랙 C2 ③). 참이면 적 체력에만
   * TALISMAN_MODE_ENEMY_HP_SCALE 이 곱해진다 — 부적 보상의 대가를 수입 회수가
   * 아니라 난이도로 받는다. 시뮬 봇은 옵션을 넘기지 않으므로 언제나 거짓이고,
   * 따라서 게이트 수치는 이 변경 전과 완전히 같다.
   */
  readonly talismanMode: boolean;
  private rng: SeededRng;
  private events: GameEvent[] = [];
  private nextTowerId = 1;
  private nextEnemyId = 1;
  private nextAbilityZoneId = 1;
  private currentPlan: WavePlan | null = null;
  private autoEvolutionCooldown = 0;
  private runSummonPool: readonly HanziDefinition[] = [];
  /**
   * 이 판에 들고 온 커스텀 성어. 지역 명단에 없는 성어라 엔진이 따로 쥔다.
   * 비어 있으면(시뮬·수련장·저장본 복원 전) 여태와 완전히 같은 판이 된다.
   */
  private readonly customIdioms: readonly IdiomDefinition[];
  /** 처치 문기의 소수점 나머지. 판이 끝나면 사라지는 잔돈이라 상태에 담지 않는다. */
  private killEssenceCarry = 0;
  private readonly enemyPositions = new Map<number, Point>();
  private readonly targetCandidates: Enemy[] = [];
  private readonly combatCharCounts = new Map<string, number>();
  private readonly combatSynergies = new Set<Wuxing>();
  private readonly combatFormationBonuses = [0, 0, 0, 0, 0];
  // [SKILL-V2] 호령: 진별 집중 명령(대상 공유). 4초 남짓의 일시 상태라 세이브 밖이다.
  private readonly commandRallies: Array<{ targetId: number; until: number } | null> = [null, null, null, null, null];
  // [SKILL-V3] 유폭 낙인 재진입 잠금 — 전파 피해가 다시 적립·유폭되지 않게 한다.
  private demiseSpreading = false;
  private combatDistinctElements = 0;
  /** FB7-8성: 이번 틱에 극성 개안 오라가 살아 있는 오행. 오행당 최대 1개. */
  private readonly combatPolarisElements = new Set<Wuxing>();

  constructor(seed: string, region: RegionCode = "KR", mode: GameMode = "standard", options: GameEngineOptions = {}) {
    this.tutorial = options.tutorial === true;
    this.talismanMode = options.talismanMode === true;
    this.customIdioms = options.customIdioms ?? [];
    this.catalog = getCatalog(region);
    this.evolution = new EvolutionService(this.catalog);
    this.rng = new SeededRng(seed);
    this.goalOrder = mode === "casual" ? casualGoalOrder(this.catalog) : this.catalog.goalOrder;
    const targetChar = this.goalOrder[0] ?? this.catalog.activePool[0]?.char ?? "";
    /*
     * 이 판의 성어 명단 = 지역에서 고른 다섯 구 + 장착한 커스텀 전부.
     *
     * 커스텀은 "뽑히길 바라는" 것이 아니라 사람이 골라 장착한 것이라 무조건
     * 들어간다. 다섯이라는 수는 애초에 화면 자리 때문이었고, 그 제한은 걷혔다.
     */
    const featuredIdiomIds = [
      ...featuredIdiomsForRun(region, seed, FEATURED_IDIOM_SLOTS).map((idiom) => idiom.id),
      ...(options.customIdioms ?? []).map((idiom) => idiom.id)
    ];
    this.state = {
      seed,
      region,
      // 표기 축(gripe #6). 옵션이 없으면 로스터의 자국 표기 — 현행과 동일 동작.
      notation: options.notation ?? defaultNotationForRegion(region),
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
      featuredIdiomIds,
      // 기존의 "현재 성어 목표" 를 그대로 승계 — 첫 목표 성어 1개 추적으로 시작한다.
      trackedIdiomIds: featuredIdiomIds.slice(0, 1),
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
    // [SKILL-V2] 호령 집중 명령은 런을 넘기지 않는다.
    this.commandRallies.fill(null);
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
      trackedIdiomIds: this.state.featuredIdiomIds.slice(0, 1),
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

    // [SKILL-V3] 회향 여운은 전투 중에만 흐른다. 전장과 가방을 모두 태워
    // "가방에 넣어 두면 여운이 얼어붙는" 우회를 막는다.
    for (const tower of this.state.towers) this.decayEcho(tower, delta);
    for (const tower of this.state.inventoryTowers) this.decayEcho(tower, delta);
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

  /**
   * 야생 자령이 이고 나올 글자 하나.
   *
   * 이 판의 소환 풀에서 고른다 — 판마다 등장 한자가 다르므로 적도 그 범위를
   * 따라야 "오늘 만난 글자"라는 말이 성립한다. 풀이 비면 빈 문자열이고,
   * 그때는 화면이 글자를 그리지 않는다(빈칸이 낫지 잘못된 글자는 안 된다).
   */
  private rollWildChar(): string {
    const pool = this.runSummonPool;
    if (pool.length === 0) return "";
    const index = Math.floor(this.rng.next() * pool.length);
    return pool[Math.min(pool.length - 1, index)]?.char ?? "";
  }

  private spawnEnemy(plan: WavePlan): void {
    const isBoss = plan.boss && this.state.spawned === plan.count - 1;
    const bossFactor = bossHpFactorForWave(plan.wave);
    const hpJitter = 0.94 + this.rng.next() * 0.12;
    const casualBossTrim = isBoss && this.state.mode === "casual" ? CASUAL_BOSS_HP_TRIM : 1;
    const hp = plan.hp * (isBoss || !plan.boss ? 1 : 1 / bossFactor) * hpJitter * casualBossTrim
      * regionEnemyHpMultiplier(this.state.region, this.state.wave, this.state.mode)
      * (this.tutorial ? TUTORIAL_ENEMY_HP_SCALE : 1)
      // 부적 모드의 대가는 여기 하나뿐이다 — 수량·속도·보스 트림은 그대로다.
      * (this.talismanMode ? TALISMAN_MODE_ENEMY_HP_SCALE : 1);
    const archetype = isBoss ? "boss" : plan.boss ? "normal" : plan.archetype;
    this.state.enemies.push({
      id: this.nextEnemyId++,
      wave: plan.wave,
      // 야생 자령이 이고 나오는 글자 — 이 판 소환 풀에서 고른다. 봉인하면 그
      // 글자의 묵편이 남으므로, 오늘 만난 글자가 내일의 재료가 된다.
      char: this.rollWildChar(),
      hp,
      maxHp: hp,
      // Bosses keep circulating; the explicit boss clock is their deadline.
      speed: plan.speed * (isBoss ? 0.34 : 0.92 + this.rng.next() * 0.16),
      // 수술 9: 보스만 시작 진의 최적 관문에서 등장한다 — 느린 보스가 제한시간을
      // 이동에 다 태우는 시작 진 복불복을 걷는다. 일반 적은 4관문 순환 그대로.
      progress: isBoss
        ? bossSpawnProgress(this.state.startingFormationIndex, this.state.spawned)
        : spawnProgressForEnemy(this.state.spawned),
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
      // [SKILL-V3] 진흙밭을 밟는 동안에는 재생 특성이 무효다.
      if (enemy.regenPerSecond > 0 && !this.enemyTraitsSuppressed(enemy)) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenPerSecond * delta);
      }
      if (enemy.poisonUntil > this.state.elapsed && enemy.poisonDps > 0) {
        this.damageEnemy(enemy, enemy.poisonDps * delta, false, false);
        if (!this.state.enemies.includes(enemy)) continue;
      }
      if (enemy.slowUntil <= this.state.elapsed) enemy.slowFactor = 1;
      if (enemy.stunnedUntil > this.state.elapsed) continue;
      enemy.progress += enemy.speed * enemy.slowFactor * (1 - this.totalIdiomBonus("enemySlow")) * delta;
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
    /*
     * 커스텀 성어의 「이 성어가 선 진의 자령 공격 +N%」.
     *
     * 걷어낸 「가호」와 겉모습이 닮았지만 다른 물건이다. 가호는 모든 성어에
     * 조용히 붙어 아무도 몰랐고, 이건 사람이 직접 굴려 뽑은 축이라 카드에
     * 그 문장이 적혀 있다. 보이는 힘은 남기고 숨은 힘만 걷는다는 결정 그대로다.
     *
     * 봉인의 네 자리는 한 진(4×4) 안의 한 줄이라 첫 자리만 보면 진이 정해진다.
     */
    if (this.customIdioms.length > 0) {
      const perFormation = [0, 0, 0, 0, 0];
      for (const seal of this.state.idiomSeals) {
        if (!seal.active) continue;
        const idiom = this.lookupIdiom(seal.idiomId);
        if (!idiom || idiom.source !== "custom" || idiom.bonus.kind !== "formationAttack") continue;
        const first = seal.cells[0];
        if (first === undefined || first < 0) continue;
        const index = Math.floor(first / CELLS_PER_FORMATION);
        if (index < 0 || index >= perFormation.length) continue;
        perFormation[index] = (perFormation[index] ?? 0) + idiom.bonus.value;
      }
      for (let index = 0; index < this.combatFormationBonuses.length; index += 1) {
        const custom = Math.min(CUSTOM_IDIOM_BONUS_CAPS.formationAttack, perFormation[index] ?? 0);
        if (custom > 0) this.combatFormationBonuses[index] = (this.combatFormationBonuses[index] ?? 0) + custom;
      }
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
        } else if (zone.kind === "mire") {
          // [SKILL-V3] 진흙밭: 장갑·재생만 무효로 만든다. slowFactor·stunnedUntil·
          // progress 는 손대지 않는다 — 걸음은 조금도 달라지지 않는다.
          enemy.traitsSuppressedUntil = Math.max(enemy.traitsSuppressedUntil ?? 0, this.state.elapsed + MIRE_SUPPRESS_GRACE);
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

  /**
   * [SKILL-V3] 진흙밭(mire) 지대 — 서리길과 같은 "피해 0" 장판 문법을 빌린다.
   *
   * 피해 0, 감속 0, 밀치기 0. 밟는 동안 장갑·재생 **특성만** 무효가 된다.
   * 무효화 대상이 실제로 존재함은 웨이브 계획에서 확인했다 — 정예 철갑
   * (armor 0.28~0.48)·회생 요괴(regen)·우두머리(둘 다)다.
   */
  private deployMireZone(tower: Tower, target: Enemy, damage: number, potency: number, abilityPower: number): { label: string; duration: number; damagePerSecond: number } {
    const existing = this.state.abilityZones.find((zone) => zone.towerId === tower.id);
    // 진흙밭은 자기 오행 장판을 **대체하지 않는다** — 같은 초당 피해를 그대로
    // 이고, 지속을 기획값 4초로 줄이는 대신 장갑·재생 무효를 얹는다. 초안처럼
    // 피해 0으로 두었더니 진흙밭 자령이 원래 쓰던 오행 장판(비구름·유사 등)을
    // 잃어 순수 하향이 됐고, 그 글자를 많이 가진 KR 로스터의 표준 135런 승률이
    // 0.556→0.444 로 떨어져 지역 격차 게이트를 깼다.
    const spec = ELEMENT_ZONE_SPECS[tower.wuxing];
    const zone: AbilityZone = {
      id: existing?.id ?? this.nextAbilityZoneId++,
      towerId: tower.id,
      kind: "mire",
      wuxing: tower.wuxing,
      progress: target.progress,
      radius: MIRE_ZONE_RADIUS * this.casualSplashRadiusScale(tower),
      damagePerSecond: damage * spec.damageRatio * potency * abilityPower,
      expiresAt: this.state.elapsed + MIRE_ZONE_SECONDS,
      color: "#c2a06a"
    };
    if (existing) Object.assign(existing, zone);
    else this.state.abilityZones.push(zone);
    if (this.state.abilityZones.length > 20) this.state.abilityZones.shift();
    return { label: "진흙밭", duration: MIRE_ZONE_SECONDS, damagePerSecond: zone.damagePerSecond };
  }

  /** [SKILL-V3] 이 적의 장갑·재생 특성이 지금 무효인가(진흙밭을 밟는 중인가). */
  enemyTraitsSuppressed(enemy: Enemy): boolean {
    return (enemy.traitsSuppressedUntil ?? 0) > this.state.elapsed;
  }

  /** [SKILL-V3] 회향 여운 감쇠. 전투 갱신에서만 부른다. */
  private decayEcho(tower: Tower, delta: number): void {
    const remaining = tower.echoRemaining ?? 0;
    if (remaining <= 0) return;
    const next = remaining - delta;
    if (next > 0) tower.echoRemaining = next;
    else tower.echoRemaining = undefined;
  }

  /**
   * [SKILL-V3] 회향 UI 상태. 여운이 없으면 null — 칩·카드를 아예 그리지 않는다.
   * 3합이 캐주얼 전용 규칙이므로 표준 모드에서는 언제나 null이다.
   */
  echoStatus(tower: Tower): { remaining: number; total: number; bonus: number } | null {
    const remaining = tower.echoRemaining ?? 0;
    if (this.state.mode !== "casual" || remaining <= 0) return null;
    return {
      remaining,
      total: echoSeconds(tower.casualStar ?? tower.naturalStar ?? 1),
      bonus: ECHO_DAMAGE_BONUS
    };
  }

  /**
   * [SKILL-V2] 소흔(scorch) 잔불 — 잔화 지대 문법을 빌린 처치 지점 지속 피해 지대.
   * 트리거만 처치일 뿐 판정·연출은 기존 장판과 같다. 자령당 1개(최근 처치 자리).
   */
  private deployEmberZone(tower: Tower, victim: Enemy): void {
    const definition = definitionForTower(this.catalog, tower.definitionId);
    const star = this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null;
    const duration = scorchZoneSeconds(star);
    const abilityPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "abilityPower");
    const damagePerSecond = definition.combat.baseDamage * this.towerPowerMultiplier(tower)
      * definition.combat.budgetMultiplier * SCORCH_DPS_RATIO * abilityPower;
    const existing = this.state.abilityZones.find((zone) => zone.towerId === tower.id);
    const zone: AbilityZone = {
      id: existing?.id ?? this.nextAbilityZoneId++,
      towerId: tower.id,
      kind: "ember",
      wuxing: tower.wuxing,
      progress: victim.progress,
      radius: SCORCH_ZONE_RADIUS * this.casualSplashRadiusScale(tower),
      damagePerSecond,
      expiresAt: this.state.elapsed + duration,
      color: "#ff9a52"
    };
    if (existing) Object.assign(existing, zone);
    else this.state.abilityZones.push(zone);
    if (this.state.abilityZones.length > 20) this.state.abilityZones.shift();
    const origin = BOARD_CELLS[tower.cell] as Point;
    this.emitAbility(
      tower,
      definition.combat.abilities.semantic,
      origin,
      positionOnPath(victim.progress),
      1,
      `잔불 ${duration.toFixed(1)}초 · 초당 ${Math.round(damagePerSecond)} 피해`,
      true
    );
  }

  /**
   * [SKILL-V2] 채기(harvest) — N번째 처치마다 자기 오행 문기 +1.
   * 문기 인플레 방지를 위해 주기는 상수 하나로 관리하고 시뮬 게이트로 검증한다.
   */
  private harvestEssence(tower: Tower, at: Point): void {
    tower.harvestKills = (tower.harvestKills ?? 0) + 1;
    if (tower.harvestKills % HARVEST_KILLS_PER_ESSENCE !== 0) return;
    this.state.elementEssence[tower.wuxing] += 1;
    this.state.elementEssenceGenerated[tower.wuxing] += 1;
    const definition = definitionForTower(this.catalog, tower.definitionId);
    const origin = BOARD_CELLS[tower.cell] as Point;
    this.emitAbility(tower, definition.combat.abilities.semantic, origin, at, 1, `${tower.wuxing} 문기 +1 · ${HARVEST_KILLS_PER_ESSENCE}처치 수확`);
  }

  /**
   * [SKILL-V2] 소흔·채기의 처치 훅. 직접 타격 계열(기본 공격·확산·연쇄·기술
   * 추가타)에만 출처 자령이 붙는다 — 독·장판 틱 처치는 출처 없이 그대로 둔다
   * (보수적 선택: 간접 처치까지 세면 수확·잔불이 눈덩이처럼 커진다).
   */
  private handleTowerKill(tower: Tower, victim: Enemy, at: Point): void {
    if (!this.towerHasActiveSkills(tower)) return;
    const family = definitionForTower(this.catalog, tower.definitionId).combat.abilities.semanticFamily;
    if (family === "scorch") this.deployEmberZone(tower, victim);
    else if (family === "harvest") this.harvestEssence(tower, at);
  }

  /** [SKILL-V2] 호령 — 이 진에 살아 있는 집중 명령. 없거나 끝났으면 null. */
  commandRallyAt(formationIndex: number): { targetId: number; until: number } | null {
    const rally = this.commandRallies[formationIndex];
    if (!rally || rally.until <= this.state.elapsed) return null;
    return rally;
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
    this.damageEnemy(target, target.hp + 10, false, false, 1, tower);
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
    const range = definition.combat.range + this.towerRangeBonus(tower) + this.totalIdiomBonus("range") + (tower.concentration ?? 0) * 4 + this.combinedUpgradeBonus(tower.wuxing, "range") + this.gateOpeningRangeBonus(tower);
    const candidates = this.targetCandidates;
    candidates.length = 0;
    for (const enemy of this.state.enemies) if (distance(origin, this.enemyPoint(enemy)) <= range) candidates.push(enemy);
    if (candidates.length === 0) return undefined;
    // [SKILL-V2] 호령: 집중 명령이 살아 있으면 같은 진의 자령은 그 대상을 우선한다.
    // 사거리 밖이면 따르지 않고(candidates 에 없음) 평소 우선순위로 돌아간다.
    const rally = this.commandRallyAt(Math.floor(tower.cell / CELLS_PER_FORMATION));
    if (rally) {
      const focus = candidates.find((enemy) => enemy.id === rally.targetId);
      if (focus) return focus;
    }
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
      // [SKILL-V2] 연환 인장(공격마다)·소흔(처치)·채기(처치)도 주기 기술이 아니다.
      // 참명·호령은 주기 발동이 남는다(참명 주기는 우두머리 참격 전용).
      && abilities.semanticFamily !== "chainseal"
      && abilities.semanticFamily !== "scorch"
      && abilities.semanticFamily !== "harvest"
      && (abilities.semanticFamily !== "weather" || this.state.enemies.length >= 5)
      // [SKILL-V3] 진흙밭은 길이 붐빌 때만 깐다 — 비구름 강하와 같은 충전 조건.
      && (abilities.semanticFamily !== "mire" || this.state.enemies.length >= MIRE_MIN_ENEMIES);
    // At most one active skill may resolve from a tower on the same attack.
    const signature = activeSkills && !semanticTrigger && tower.shotCount % tuning.signatureEvery === 0;
    const lineageTrigger = activeSkills && !semanticTrigger && !signature
      && Boolean(abilities.lineage && tower.shotCount % tuning.lineageEvery === 0);
    const signatureControlBonus = signature && profile.role === "control" ? tuning.roleControlBonus : 0;
    let damage = profile.baseDamage * this.towerPowerMultiplier(tower) * profile.budgetMultiplier;
    damage *= 1 + concentration * (concentrationPath === "potent" ? 0.12 : 0.055);
    damage *= 1 + this.combinedUpgradeBonus(tower.wuxing, "damage");
    damage *= 1 + this.totalIdiomBonus("damage");
    // 봉인한 성어 수만큼 판 전체가 세진다. 걷어낸 「가호」(진 단위 증폭)의 몫을
    // 기획 결정대로 **판 전체** 축 하나로 돌려준 것이다 — 실측에서 가호를 걷자
    // 성어를 실제로 발동하는 지역(JP·CN, 발동 중앙값 4구)이 그대로 주저앉았다.
    damage *= 1 + this.idiomSealAttackBonus();
    const towerFormationIndex = Math.floor(tower.cell / CELLS_PER_FORMATION);
    damage *= 1 + (this.combatFormationBonuses[towerFormationIndex] ?? 0);
    damage *= FORMATION_ROUTE_COVERAGE_MULTIPLIER[towerFormationIndex] ?? 1;
    // Every elemental start receives the same first-chapter ward. It prevents
    // the free starting formation's map position from deciding a run before
    // the player can buy a second formation, then disappears after wave 10.
    if (this.state.wave <= 10 && towerFormationIndex === this.state.startingFormationIndex) damage *= 1.15;
    // [SKILL-V3] 회향: 3합으로 사라진 셋이 남긴 여운. 남아 있는 동안만 곱한다.
    if (this.state.mode === "casual" && (tower.echoRemaining ?? 0) > 0) damage *= 1 + ECHO_DAMAGE_BONUS;
    // FB7-8성 「극성 개안」: 8★ 자령이 서 있는 오행의 아군 전체 공격 +15%.
    // Set 기반이라 같은 오행 오라는 몇 기가 있어도 최대 1개만 산다.
    if (this.combatPolarisElements.has(tower.wuxing)) damage *= 1 + CASUAL_POLARIS_AURA.damageBonus;
    if (synergy) damage *= 1 + GAME_CONFIG.synergyBonus + (profile.role === "support" ? 0.08 : 0);
    // 커스텀 성어의 「약점 오행 적에게 피해 +N%」는 약점 배수 위에 곱한다 —
    // 약점을 찔렀을 때만 붙는 힘이라야 축의 이름과 실제가 같다.
    if (weakness) damage *= GAME_CONFIG.weaknessMultiplier * (1 + this.customIdiomBonus("weaknessDamage"));
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
    this.damageEnemy(target, damage, critical, weakness, armorPenetration, tower);

    // [SKILL-V2] 연환 인장: 공격마다 인장을 겹치고 상한에서 누적 피해 폭발 +
    // 1.2초 제자리 봉인. 스택·적립은 적에게 남으므로 여러 연환 자령이 나눠 쌓는다.
    if (activeSkills && abilities.semanticFamily === "chainseal" && this.state.enemies.includes(target)) {
      if ((target.sealUntil ?? 0) <= this.state.elapsed) {
        target.sealStacks = 0;
        target.sealStored = 0;
      }
      const sealCap = chainsealMaxStacks(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : tower.stage);
      target.sealStacks = (target.sealStacks ?? 0) + 1;
      target.sealStored = (target.sealStored ?? 0) + damage * CHAINSEAL_STORE_RATIO;
      target.sealUntil = this.state.elapsed + CHAINSEAL_STACK_WINDOW;
      if (target.sealStacks >= sealCap) {
        const burst = target.sealStored;
        target.sealStacks = 0;
        target.sealStored = 0;
        target.sealUntil = 0;
        // 절대 원칙: 봉인은 제자리 정지다 — 진행도를 되돌리지 않는다.
        target.stunnedUntil = Math.max(target.stunnedUntil, this.state.elapsed + CHAINSEAL_SEAL_SECONDS);
        this.emitAbility(tower, abilities.semantic, origin, targetPoint, 1, `연환 폭발 ${Math.round(burst)} 피해 · ${CHAINSEAL_SEAL_SECONDS}초 제자리 봉인`);
        this.damageEnemy(target, burst, false, weakness, 0.2, tower);
      }
    }

    // [SKILL-V2] 참명: 체력 문턱 이하의 일반 적은 즉시 소멸(보상 정상 지급).
    // 우두머리·정예(철갑)는 면역 — 대신 주기 발동이 현재 체력 3%를 벤다.
    // 참격 후에는 숨 고르기(자령당 최소 간격)가 붙는다 — 문턱은 기획 고정이라
    // 빈도로만 세기를 조절한다.
    if (activeSkills && abilities.semanticFamily === "reaper" && this.state.enemies.includes(target)
      && !target.boss && target.archetype !== "armored"
      && (tower.reaperReadyAt ?? 0) <= this.state.elapsed) {
      const threshold = reaperExecuteThreshold(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      if (target.hp / target.maxHp <= threshold) {
        tower.reaperReadyAt = this.state.elapsed + REAPER_EXECUTE_COOLDOWN_SECONDS;
        this.emitAbility(tower, abilities.semantic, origin, targetPoint, 1, `참명 · 체력 ${Math.round(threshold * 100)}% 이하 즉시 소멸`);
        this.damageEnemy(target, target.hp + 10, false, false, 1, tower);
      }
    }

    if (activeSkills && tower.wuxing === "火") {
      // 수술 5: 캐주얼에서는 별이 곧 광역의 크기다(표준은 배율 1).
      const splashRadius = (tuning.splashRadius + signatureControlBonus * 80) * (1 + this.elementTraitLevel("火", 1) * 0.02) * this.casualSplashRadiusScale(tower);
      const splashRatio = (tuning.splashRatio + signatureControlBonus * 0.35) * (1 + this.elementTraitLevel("火", 0) * 0.025) * this.casualSplashRatioScale(tower);
      for (const enemy of this.state.enemies
        .filter((candidate) => candidate.id !== target.id && distance(this.enemyPoint(candidate), targetPoint) <= splashRadius)
        .slice(0, 5)) {
        this.damageEnemy(enemy, damage * splashRatio * abilityPower, false, enemy.weakness === tower.wuxing, 0, tower);
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
        this.damageEnemy(enemy, damage * tuning.chainRatio * abilityPower * (1 + conductionLevel * 0.02), false, enemy.weakness === tower.wuxing, 0, tower);
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
        this.damageEnemy(target, damage * 0.58 * tuning.signatureMultiplier * abilityPower, false, weakness, armorPenetration * 0.5, tower);
        roleEffect = "같은 적에게 " + String(Math.round(58 * tuning.signatureMultiplier)) + "% 추가타";
      } else if (profile.role === "splash") {
        // 수술 5: 역할 확산도 캐주얼 별 스케일을 함께 탄다.
        const spreadRadius = (tuning.splashRadius + 22) * this.casualSplashRadiusScale(tower);
        const spreadRatio = tuning.roleSplashRatio * this.casualSplashRatioScale(tower);
        const spreadTargets = this.state.enemies
          .filter((candidate) => candidate.id !== target.id && distance(this.enemyPoint(candidate), targetPoint) <= spreadRadius)
          .slice(0, 5);
        for (const enemy of spreadTargets) this.damageEnemy(enemy, damage * spreadRatio * abilityPower, false, enemy.weakness === tower.wuxing, 0, tower);
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
      if (this.state.enemies.includes(target)) this.damageEnemy(target, damage * tuning.lineageRatio * abilityPower, false, lineageWeakness, 0.15, tower);
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
    // [SKILL-V3] 진흙밭도 같은 자리를 쓴다 — 피해 없는 전용 지대다.
    const zone = family === "frost"
      ? this.deployFrostZone(tower, target)
      : family === "mire"
        ? this.deployMireZone(tower, target, damage, potency, abilityPower)
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
        this.damageEnemy(relay, damage * tuning.semanticMultiplier * potency * abilityPower, false, relay.weakness === tower.wuxing, 0.12, tower);
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
      for (const victim of victims) this.damageEnemy(victim, damage * tuning.semanticMultiplier * potency * abilityPower, false, victim.weakness === tower.wuxing, 0, tower);
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
      // 조폐 차단: 농축 가산은 옛 상한(동결선)에서 멈춘다. 안 그러면 농축이
      // 제 값을 스스로 벌어 무한히 자라는 고리가 된다.
      const bonus = 1 + Math.floor(Math.min(CONCENTRATION_FREEZE_LEVEL, tower.concentration ?? 0) / 2);
      this.state.gold += bonus;
      effect = "현상금 적 추적 · 엽전 +" + String(bonus);
    } else if (family === "sight") {
      effect = "최고 체력 적 간파 · 이번 공격 ×" + tuning.semanticMultiplier.toFixed(2);
    } else if (family === "metalwork") {
      effect = "최고 장갑 적 우선 · 추가 관통 22%";
    } else if (family === "command") {
      // [SKILL-V2] 호령: 같은 진 전원이 시전자의 대상을 집중 공격(대상 공유만, AI 단순).
      const rallySeconds = commandRallySeconds(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      const formation = Math.floor(tower.cell / CELLS_PER_FORMATION);
      this.commandRallies[formation] = { targetId: target.id, until: this.state.elapsed + rallySeconds };
      const allies = this.state.towers.filter((candidate) => candidate.id !== tower.id && Math.floor(candidate.cell / CELLS_PER_FORMATION) === formation);
      targets = Math.max(1, allies.length);
      effect = `같은 진 ${allies.length}기 집중 호령 · ${rallySeconds.toFixed(1)}초 · 사거리 밖 제외`;
    } else if (family === "reaper") {
      // [SKILL-V2] 참명 주기: 우두머리·정예 한정 현재 체력 3% 참격(즉시 소멸 면역 보상).
      const threshold = reaperExecuteThreshold(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      if ((target.boss || target.archetype === "armored") && this.state.enemies.includes(target)) {
        const chip = Math.max(1, target.hp * REAPER_BOSS_CHIP_RATIO);
        this.damageEnemy(target, chip, false, false, 1, tower);
        effect = `우두머리·정예 참격 · 현재 체력 ${Math.round(REAPER_BOSS_CHIP_RATIO * 100)}% 고정 피해`;
      } else {
        effect = `참명 대기 · 체력 ${Math.round(threshold * 100)}% 이하 즉시 소멸`;
      }
    } else if (family === "warfare" && this.state.enemies.includes(target)) {
      // [SKILL-V1] 상극 각인: 대상에게 자기 오행의 상극 낙인(4초). 밀거나 되돌리지 않는다.
      const brandPower = warfareBrandPower(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      target.brandWuxing = tower.wuxing;
      target.brandPower = brandPower;
      target.brandUntil = this.state.elapsed + WARFARE_BRAND_DURATION;
      // [SKILL-V3] 상극 각인은 유폭이 없는 순수 증폭 낙인이다 — 한 적에게 낙인
      // 자리는 하나뿐이므로 덧쓸 때 유폭 반경과 적립분을 함께 지운다.
      target.brandBlastRadius = 0;
      target.brandStored = 0;
      effect = `${tower.wuxing}행 상극 낙인 ${WARFARE_BRAND_DURATION}초 · 같은 오행 피해 +${Math.round(brandPower * 100)}%`;
    } else if (family === "demise" && this.state.enemies.includes(target)) {
      // [SKILL-V3] 유폭 낙인: 상극 각인과 같은 낙인 자료를 그대로 쓰되 유폭
      // 표식을 세운다. 낙인이 사는 동안 받은 피해의 일부가 적립되고, 낙인을
      // 진 채 쓰러지면 그 적립분이 반경 안으로 번진다(밀치기 없음).
      const star = this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null;
      const brandPower = warfareBrandPower(star);
      target.brandWuxing = tower.wuxing;
      target.brandPower = brandPower;
      target.brandUntil = this.state.elapsed + WARFARE_BRAND_DURATION;
      target.brandBlastRadius = demiseSpreadRadius(star);
      target.brandStored = 0;
      effect = `${tower.wuxing}행 유폭 낙인 ${WARFARE_BRAND_DURATION}초 · 처치 시 반경 ${Math.round(demiseSpreadRadius(star))} 안 ${DEMISE_MAX_TARGETS}체 유폭`;
    } else if (family === "frost") {
      // [SKILL-V1] 서리길: 적중 지점 서리 지대 — 감속만 있고 피해·밀치기는 없다.
      const slowRatio = frostSlowRatio(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      targets = Math.max(1, zoneTargets);
      effect = `서리길 ${zone.duration.toFixed(1)}초 · 밟는 적 ${Math.round(slowRatio * 100)}% 감속`;
    } else if (family === "mire") {
      // [SKILL-V3] 진흙밭: 밟는 동안 장갑·재생만 무효 — 걸음에는 손대지 않는다.
      targets = Math.max(1, zoneTargets);
      effect = `진흙밭 ${zone.duration.toFixed(1)}초 · 초당 ${Math.round(zone.damagePerSecond)} 피해 · 밟는 적 장갑·재생 무효 (이동 그대로)`;
    } else {
      effect = "뜻 구현 · 이번 공격 ×" + tuning.semanticMultiplier.toFixed(2);
    }

    // [SKILL-V1] frost 는 장판 자체가 본 효과라 꼬리 문구를 겹쳐 붙이지 않는다.
    // [SKILL-V3] mire 도 같은 이유로 뺀다.
    if (family !== "weather" && family !== "frost" && family !== "mire") effect += ` · ${zone.label} ${zone.duration.toFixed(1)}초`;

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

  private damageEnemy(enemy: Enemy, rawAmount: number, critical: boolean, weakness: boolean, armorPenetration = 0, source?: Tower): void {
    if (!this.state.enemies.includes(enemy)) return;
    // [SKILL-V3] 진흙밭을 밟는 동안에는 장갑 특성이 무효다 — 관통 계산 이전에
    // 장갑 자체가 0이 되므로 관통 수치와 곱해 이중으로 세지 않는다.
    const effectiveArmor = this.enemyTraitsSuppressed(enemy) ? 0 : enemy.armor * (1 - armorPenetration);
    const amount = rawAmount * (1 - effectiveArmor);
    enemy.hp -= amount;
    enemy.flash = 0.09;
    // [SKILL-V3] 유폭 낙인: 낙인이 살아 있는 동안 받은 피해의 일부를 적립한다.
    // 전파 피해 자체는 적립되지 않는다(재진입 잠금) — 연쇄 유폭을 막는다.
    if (!this.demiseSpreading && (enemy.brandBlastRadius ?? 0) > 0 && (enemy.brandUntil ?? 0) > this.state.elapsed) {
      enemy.brandStored = (enemy.brandStored ?? 0) + amount * DEMISE_STORE_RATIO;
    }
    if (amount >= 1.5) this.events.push({ type: "damage", at: this.enemyPoint(enemy), amount, critical, weakness });
    if (enemy.hp > 0) return;
    const at = this.enemyPoint(enemy);
    this.state.enemies = this.state.enemies.filter((candidate) => candidate.id !== enemy.id);
    if (enemy.boss) this.state.bossDefeated = true;
    this.state.gold += enemy.reward;
    this.state.killCount += 1;
    this.events.push({ type: "kill", at, reward: enemy.reward });
    // 봉인한 야생 자령이 남기는 혼 — 우두머리는 반드시, 그 밖은 낮은 확률로.
    // 저장은 판 밖의 일이라 엔진은 사실만 알리고 보관은 UI 가 한다.
    /*
     * 커스텀 성어의 「적을 봉인할 때마다 그 오행 문기 +N」.
     *
     * 쌓이는 곳은 **그 적의 약점 오행**이다 — 그 적을 이긴 기운이 남는다는
     * 뜻이고, 웨이브마다 약점이 바뀌므로 다섯 오행에 고루 돈다. 소수점은
     * 누적분에 담아 두고 1 이 될 때 넘긴다(0.4 짜리가 버려지지 않게).
     */
    const essenceGain = this.customIdiomBonus("killEssence");
    if (essenceGain > 0) {
      this.killEssenceCarry += essenceGain;
      const whole = Math.floor(this.killEssenceCarry);
      if (whole > 0) {
        this.killEssenceCarry -= whole;
        this.state.elementEssence[enemy.weakness] += whole;
        this.state.elementEssenceGenerated[enemy.weakness] += whole;
      }
    }
    if (enemy.char && (enemy.boss || this.rng.next() < WILD_SOUL_DROP_CHANCE)) {
      this.events.push({ type: "soul", at, char: enemy.char, boss: enemy.boss });
    }
    // [SKILL-V2] 소흔·채기 처치 훅 — 출처 자령이 있는 직접 처치만 센다.
    if (source) this.handleTowerKill(source, enemy, at);
    // [SKILL-V3] 유폭 낙인 전파는 처치 훅 뒤에 온다 — 소흔의 잔불이 먼저 깔린 뒤
    // 유폭이 터져야 "쓰러진 자리에 남은 것"의 순서가 화면과 맞는다.
    this.detonateDemiseBrand(enemy, at, source);
  }

  /**
   * [SKILL-V3] 유폭 낙인 전파 — 낙인을 진 채 쓰러진 자리에서 적립분이 번진다.
   *
   * 절대 원칙: 번지는 것은 피해뿐이다. 감속·정지·밀치기를 일절 걸지 않으므로
   * 주변 적의 경로와 진행도는 조금도 흔들리지 않는다.
   * 재진입 잠금(`demiseSpreading`)이 전파 피해의 재적립과 연쇄 유폭을 막는다.
   */
  private detonateDemiseBrand(victim: Enemy, at: Point, source?: Tower): void {
    const stored = victim.brandStored ?? 0;
    const radius = victim.brandBlastRadius ?? 0;
    if (this.demiseSpreading || stored <= 0 || radius <= 0 || (victim.brandUntil ?? 0) <= this.state.elapsed) return;
    victim.brandStored = 0;
    victim.brandBlastRadius = 0;
    const neighbours = this.state.enemies
      .filter((candidate) => candidate.id !== victim.id && distance(this.enemyPoint(candidate), at) <= radius)
      .slice(0, DEMISE_MAX_TARGETS);
    if (neighbours.length === 0) return;
    this.demiseSpreading = true;
    try {
      for (const neighbour of neighbours) {
        this.damageEnemy(neighbour, stored, false, neighbour.weakness === victim.brandWuxing, 0.15, source);
      }
    } finally {
      this.demiseSpreading = false;
    }
    if (!source) return;
    const definition = definitionForTower(this.catalog, source.definitionId);
    this.emitAbility(
      source,
      definition.combat.abilities.semantic,
      BOARD_CELLS[source.cell] as Point,
      at,
      neighbours.length,
      `유폭 ${Math.round(stored)} 피해 · 반경 ${Math.round(radius)} 안 ${neighbours.length}체`
    );
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

  /**
   * 이 런에서 N 번째 웨이브의 편성. 웨이브 번호·진법·수련장 여부만 보는 순수
   * 함수라 같은 인자면 언제나 같은 결과다 — 그래서 `adoptRun()` 이 저장된
   * 웨이브 번호만으로 편성을 다시 세울 수 있고, WavePlan 을 저장하지 않는다.
   */
  private planForWave(wave: number): WavePlan {
    const plan = wavePlan(wave);
    // 모드 수량 계수: 캐주얼은 몸수를 줄이고 체력 계수로 총 내구를 보존한다.
    const modeCount = Math.max(1, Math.round(plan.count * MODE_ENEMY_COUNT_SCALE[this.state.mode]));
    // 수련장은 그 위에서 수량을 한 번 더 눌러 "반드시 이기는 첫 교전"을 보장한다.
    return this.tutorial
      ? { ...plan, count: Math.max(3, Math.round(modeCount * TUTORIAL_ENEMY_COUNT_SCALE)) }
      : { ...plan, count: modeCount };
  }

  private startNextWave(): void {
    const nextWave = this.state.wave + 1;
    this.state.wave = nextWave;
    // 커스텀 성어의 「웨이브가 시작될 때 엽전 +N」. 웨이브가 서는 이 한 지점에서만
    // 준다 — 미리 시작하든 기다리든 같은 값이라 조기 출전과 셈이 겹치지 않는다.
    const waveGold = Math.floor(this.customIdiomBonus("waveGold"));
    if (waveGold > 0) this.state.gold += waveGold;
    this.currentPlan = this.planForWave(nextWave);
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
    // 캐주얼 소환의 밴드 하한은 후보 풀 하드 컷("N★ 확정" 보장)이고, 상한은
    // 컷이 아니다 — 후보는 8★까지 열어 두고 applyStarBandDecay 의 꼬리 감쇠가
    // 상한 위 별을 잭팟 확률로 누른다(원 기획 #10).
    const band = this.summonStarBand(this.state.summonIntent);
    const casualPool = (): HanziDefinition[] => {
      const banded = band === null ? [...this.runSummonPool] : this.starBandCandidates(band.min, 8);
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
    // gripe #3 전면 통합: 성어 가중은 추적 성어(최대 3)들의 부족 글자 합집합.
    const idiomHelpfulChars = this.trackedIdiomMissingChars(ownedTowers);
    const connectionBonus = researchConnectionBonus(this.state.researchLevel);
    // 연구를 실제로 산 만큼만 성어 부족 글자에 얹는다(0단계 기저 0.12 는 제외)
    // — 연구 전 소환 분포가 통합 이전과 동일하게 유지된다.
    const idiomConnectionBonus = connectionBonus - researchConnectionBonus(0);
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
      // 인연 연구가 성어 부족 글자에도 향한다 — "성어가 곧 목표"의 가중 절반.
      if (idiomHelpfulChars.has(definition.char)) weight += (GAME_CONFIG.idiomWeightBase + idiomConnectionBonus * IDIOM_RESEARCH_CONNECTION_SCALE) * pityMultiplier * focusPoolScale * 0.7;
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
    if (band !== null) this.applyStarBandDecay(summonPool, weights, band);
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
    // 잭팟 = 소프트 상한 위 별. 하한 보장과 달리 광고하지 않는 행운이므로 따로 외친다.
    const drawnStar = casualNaturalStar(definition.char) ?? 1;
    const jackpot = band !== null && drawnStar > band.max;
    const jackpotLabel = jackpot ? ` · 상한 돌파 ${drawnStar}★!` : "";
    const placementMessage = definition.char + " · " + definition.combat.roleLabel + (stored ? " 가방 보관" : " 소환") + helpfulLabel + jackpotLabel;
    this.state.lastMessage = isFirstSummon && startingFormation
      ? `${definition.wuxing} 자령 출현 → ${startingFormation.label} 무료 개방 · ${placementMessage} · 추가 소환 2기를 권장합니다.`
      : placementMessage;
    const eventAt = stored ? (startingFormation?.center ?? { x: 400, y: 300 }) : BOARD_CELLS[cell] as Point;
    this.events.push({ type: "summon", at: eventAt, tower: { ...tower }, stored, helpful, helpfulReason, newDiscovery, utility, jackpot });
    if (definition.char === this.state.targetChar) this.completeGoal(definition.char);
    if (!stored) this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  summonMany(amount = 10): ActionResult {
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, message: "연속 소환 횟수가 올바르지 않습니다." };
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const totalCost = multiSummonCost(this.state.summonCount, amount);
    if (this.state.gold < totalCost) return { ok: false, message: `연속 소환에 엽전 ${totalCost}이 필요합니다.` };
    if (this.runSummonPool.length === 0) return { ok: false, message: "이 지역의 활성 소환 풀이 비어 있습니다." };

    const eventStart = this.events.length;
    // 캐주얼 10연은 밴드 상한 이상(기본 밴드면 3★+, 잭팟 포함) 1기를 보장한다. 열 장을 뽑고도
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
        ? "가방 보관"
        : `전장 ${amount - storedCount}체 · 가방 ${storedCount}체`;
    this.state.lastMessage = `${amount}연 소환 완료 · 새 한자 ${discovered}종 · 목표·성어 재료 ${helpful}체 · ${placement}`;
    return { ok: true, message: this.state.lastMessage };
  }

  /**
   * 읽기 표기 축을 런 도중에 바꾼다. (gripe #6, 트랙 Q)
   *
   * 표기는 화면 설정이라 전투 판정에 하나도 닿지 않는다 — learningInfo 계열은
   * ui/ 밖에서 호출되지 않으므로 시드·난수·수치가 흔들릴 여지가 없다.
   * 그래서 다음 런을 기다리지 않고 즉시 갈아 끼운다.
   */
  setNotation(notation: NotationCode): ActionResult {
    this.state.notation = notation;
    this.state.lastMessage = `읽기 표기 · ${notation === "kr-hunum" ? "한국 훈음" : notation === "jp-onkun" ? "일본 음훈" : "중국 병음"}`;
    return { ok: true, message: this.state.lastMessage };
  }

  setAutoPlaceSummons(enabled: boolean): ActionResult {
    this.state.autoPlaceSummons = enabled;
    this.state.lastMessage = enabled ? "뽑기 후 자동 배치 켜짐" : "뽑기 후 가방 보관";
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
    this.state.lastMessage = `수련 지원 · ${char} 자령 지급 (가방 보관)`;
    this.events.push({
      type: "summon",
      at,
      tower: { ...tower },
      stored: true,
      helpful: false,
      helpfulReason: null,
      newDiscovery,
      utility: newDiscovery ? "new" : "concentration",
      jackpot: false
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
      const result = this.summon(false, summonSurcharge(this.state.summonCount, intent));
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
   * 별 분포를 `casualStarBandShare` 의 목표 몫으로 눌러 낮은 별을 흔하게 만든다 —
   * 밴드 안은 `CASUAL_STAR_DECAY^(별-하한)`, 상한 위는 `CASUAL_STAR_TAIL_DECAY`
   * 의 가파른 잭팟 꼬리다.
   *
   * 별 단위로 먼저 목표 몫을 정하고 같은 별의 글자들이 그 몫을 나눠 갖는다.
   * 글자를 하나씩 곱하기만 하면 1★ 332자와 8★ 18자처럼 칸 크기가 다른 구간에서
   * 감쇠가 글자 수 차이에 묻혀 버린다. 하한은 요청 밴드가 아니라 실제 풀의
   * 최저 별을 쓴다 — 소형 풀에서 starBandCandidates 가 하한을 넓혔을 수 있다.
   */
  private applyStarBandDecay(pool: readonly HanziDefinition[], weights: number[], band: SummonStarBand): void {
    const starOf = (definition: HanziDefinition) => casualNaturalStar(definition.char) ?? 1;
    let bandMin = 8;
    for (const definition of pool) bandMin = Math.min(bandMin, starOf(definition));
    const effectiveBand: SummonStarBand = { min: bandMin, max: band.max };
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
      weights[index] = (weight / total) * casualStarBandShare(star, effectiveBand);
    });
  }

  /**
   * 확률 공개 UI 용 — 이 지역·모드에서 해당 소환 카드가 실제로 쓰는 별 분포
   * (1~8★, 합 1). `applyStarBandDecay` 와 같은 실효 밴드·후보 별만 쓰므로
   * 화면의 표가 곧 실측 분포다. 밴드가 없는 소환(자형연성·계보)은 null.
   */
  summonStarDistribution(intent: SummonIntent): ReadonlyArray<{ star: CasualStar; share: number }> | null {
    const band = this.summonStarBand(intent);
    if (band === null) return null;
    const pool = this.starBandCandidates(band.min, 8);
    let bandMin = 8;
    const present = new Set<number>();
    for (const definition of pool) {
      const star = casualNaturalStar(definition.char) ?? 1;
      present.add(star);
      bandMin = Math.min(bandMin, star);
    }
    return casualSummonStarDistribution({ min: bandMin, max: band.max }, present);
  }

  /** 모드·지역별 상품 노출. 계보는 자형연성 전용, 티어는 캐주얼 + 충분한 풀 전용. */
  isSummonProductAvailable(intent: SummonIntent): boolean {
    if (isTierSummonIntent(intent)) return this.summonStarBand(intent) !== null;
    if (intent === "lineage") return this.state.mode === "standard";
    return true;
  }

  /**
   * 캐주얼 승급 구현은 별도 모듈에 두되 GameEngine 공개 표면은 유지한다.
   * private 상태를 통째로 노출하지 않고 필요한 동작만 콜백으로 전달한다.
   */
  private casualFusionContext(): CasualFusionContext {
    return {
      state: this.state,
      catalog: this.catalog,
      runSummonPool: () => this.runSummonPool,
      random: () => this.rng.next(),
      getTargetPath: (targetChar) => this.evolution.getTargetPath(targetChar),
      standardMaterialIds: (towers, targetChar) =>
        this.evolution.getAvailableRecipes(towers, targetChar, null, "semi").flatMap((option) => option.materialTowerIds),
      trackedIdioms: () => this.trackedIdioms(),
      idioms: () => this.idioms(),
      sealedIdiomTowerIds: () => this.sealedIdiomTowerIds(),
      cleanupAssessments: () => this.cleanupAssessments(),
      towerPowerMultiplier: (tower) => this.towerPowerMultiplier(tower),
      towerAttackCooldown: (tower) => this.towerAttackCooldown(tower),
      createTower: (definition, cell) => this.createTower(definition, cell),
      discover: (char) => this.discover(char),
      completeGoal: (char) => this.completeGoal(char),
      resolveIdiomFormations: () => { this.resolveIdiomFormations(); },
      isRunActive: () => this.isRunActive(),
      emit: (event) => { this.events.push(event); }
    };
  }

  casualResultPool(wuxing: Wuxing, fromStar: CasualStar): CasualResultPool | null {
    return findCasualResultPool(this.casualFusionContext(), wuxing, fromStar);
  }

  casualFusionQuote(materialIds: readonly number[]): CasualFusionQuote {
    return buildCasualFusionQuote(this.casualFusionContext(), materialIds);
  }

  /** 지금 발동 중인 사자성어에 참여하는 전장 자령 id 집합. */
  sealedIdiomTowerIds(): Set<number> {
    const sealedCells = new Set(this.activeIdiomSeals().flatMap((seal) => seal.cells));
    if (sealedCells.size === 0) return new Set<number>();
    return new Set(
      this.state.towers.filter((tower) => tower.cell >= 0 && sealedCells.has(tower.cell)).map((tower) => tower.id)
    );
  }

  casualMaterialProtection(towerId: number): string | null {
    return findCasualMaterialProtection(this.casualFusionContext(), towerId);
  }

  casualMaterialProtections(): Map<number, string> {
    return listCasualMaterialProtections(this.casualFusionContext());
  }

  fuseCasual(materialIds: readonly number[], allowWarnings = false): CasualFusionResult {
    return runFuseCasual(this.casualFusionContext(), materialIds, allowWarnings);
  }

  casualAutoFusionPlan(wuxing: Wuxing): CasualAutoFusionGroup[] {
    return buildCasualAutoFusionPlan(this.casualFusionContext(), wuxing);
  }

  autoFuseCasualElement(wuxing: Wuxing, allowWarnings = false): CasualAutoFusionReport {
    return this.autoFuseCasual(wuxing, allowWarnings);
  }

  autoFuseCasual(scope: Wuxing | "all", allowWarnings = false, onlyStar: CasualStar | null = null): CasualAutoFusionReport {
    return runAutoFuseCasual(this.casualFusionContext(), scope, allowWarnings, onlyStar);
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

    const idiomGold = this.totalIdiomBonus("evolutionGold");
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

  /**
   * 성어를 이번 런 명단에 편입시킨다. 추적(발동 판정·자동배치 후보)의 전제
   * 조건이라 setIdiomTarget/setIdiomTracking 이 함께 쓴다.
   *
   * 명단은 지역 성어 다섯 자리 + 장착한 커스텀 전부다. 커스텀은 뽑힌 것이
   * 아니라 사람이 골라 장착한 것이라 **자리 다툼에 끼지 않는다** — 다섯 자리는
   * 지역 성어끼리만 겨루고, 장착분은 언제나 그 뒤에 그대로 붙는다.
   * (자리 수만 늘려서는 부족했다. 새 구가 들어오는 순간 늘어난 자리도 함께
   *  차서, 맨 뒤에 있던 장착 커스텀이 그대로 밀려났다.)
   */
  private ensureFeaturedIdiom(id: string): void {
    const equipped = new Set(this.customIdioms.map((idiom) => idiom.id));
    const rest = this.state.featuredIdiomIds
      .filter((candidate) => candidate !== id && !equipped.has(candidate));
    const sealedIds = rest.filter((candidate) => this.state.idiomSeals.some((seal) => seal.idiomId === candidate));
    const trackedIds = rest.filter((candidate) => !sealedIds.includes(candidate) && this.state.trackedIdiomIds.includes(candidate));
    const pendingIds = rest.filter((candidate) => !sealedIds.includes(candidate) && !trackedIds.includes(candidate));
    /*
     * 자리 정리 우선순위: 새 추적 > 기존 추적 > 봉인 이력 > 나머지.
     * 봉인 이력이 자리에서 밀려도 발동·해제 판정은 idiomSeals 목록이 따로
     * 지키므로(resolveIdiomFormations) 효과는 끊기지 않는다 — 반대로 추적 중인
     * 구가 밀리면 봉인 자체가 성립하지 않으니 추적이 앞선다.
     */
    const region = [id, ...trackedIds, ...sealedIds, ...pendingIds].slice(0, FEATURED_IDIOM_SLOTS);
    // 장착분은 명단 순서를 흔들지 않도록 늘 뒤에 붙인다(id 가 장착분이면 여기서
    // 한 번만 실린다 — 위 filter 가 앞 목록에서 걷어 낸다).
    this.state.featuredIdiomIds = [
      ...region.filter((candidate) => !equipped.has(candidate)),
      ...this.customIdioms.map((idiom) => idiom.id)
    ];
  }

  /** 이 성어를 1순위 추적 목표로 세운다(수련장·"목표로 지정" 경로). */
  setIdiomTarget(id: string): ActionResult {
    const idiom = this.lookupIdiom(id);
    if (!idiom) return { ok: false, message: "이 지역에서 사용할 수 없는 성어입니다." };
    if (this.state.idiomSeals.some((seal) => seal.idiomId === id)) return { ok: false, message: `${idiom.reading}은 이미 발동했습니다.` };
    const current = this.trackedIdioms().map((entry) => entry.id).filter((candidate) => candidate !== id);
    this.state.trackedIdiomIds = [id, ...current].slice(0, MAX_TRACKED_IDIOMS);
    this.ensureFeaturedIdiom(id);
    this.state.lineageClueProgress = Math.floor(this.state.lineageClueProgress / 2);
    this.runSummonPool = this.buildRunSummonPool();
    this.state.lastMessage = `성어 목표를 ${idiom.chars} · ${idiom.reading}으로 변경했습니다.`;
    return { ok: true, message: this.state.lastMessage };
  }

  /**
   * 목표 서책의 추적 체크 토글. 최대 3개·최소 1개 — "성어가 곧 목표"라
   * 추적이 완전히 비는 상태는 두지 않는다(비면 어차피 첫 미봉인 목표 성어가
   * 승계된다). 승계로만 존재하던 기본 추적도 토글 순간 상태로 굳힌다.
   */
  setIdiomTracking(id: string, tracked: boolean): ActionResult {
    const idiom = this.lookupIdiom(id);
    if (!idiom) return { ok: false, message: "이 지역에서 사용할 수 없는 성어입니다." };
    if (this.state.idiomSeals.some((seal) => seal.idiomId === id)) return { ok: false, message: `${idiom.reading}은 이미 봉인했습니다.` };
    const current = this.trackedIdioms().map((entry) => entry.id);
    if (tracked) {
      if (current.includes(id)) return { ok: true, message: `${idiom.reading}은 이미 추적 중입니다.` };
      if (current.length >= MAX_TRACKED_IDIOMS) {
        return { ok: false, message: `추적은 최대 ${MAX_TRACKED_IDIOMS}개까지입니다. 다른 성어의 추적을 먼저 해제하세요.` };
      }
      this.state.trackedIdiomIds = [...current, id];
      this.ensureFeaturedIdiom(id);
      this.runSummonPool = this.buildRunSummonPool();
      this.state.lastMessage = `${idiom.chars} · ${idiom.reading} 추적 시작 — 부족 글자에 소환·연구 가중이 붙습니다.`;
      return { ok: true, message: this.state.lastMessage };
    }
    if (!current.includes(id)) return { ok: true, message: `${idiom.reading}은 추적 중이 아닙니다.` };
    if (current.length <= 1) return { ok: false, message: "성어 목표는 최소 1개를 추적해야 합니다. 다른 성어를 먼저 추적하세요." };
    this.state.trackedIdiomIds = current.filter((candidate) => candidate !== id);
    this.runSummonPool = this.buildRunSummonPool();
    this.state.lastMessage = `${idiom.chars} · ${idiom.reading} 추적 해제`;
    return { ok: true, message: this.state.lastMessage };
  }

  /**
   * 추적 중 성어 정의 목록. 봉인 완료·미존재 id 는 걸러 내고, 목록이 비면
   * 예전 currentIdiomTarget 규칙 그대로 첫 미봉인 목표 성어 하나를 승계한다
   * — 봇과 기존 화면이 이 승계에 기대므로 기본 동작이 바뀌지 않는다.
   */
  trackedIdioms(): readonly IdiomDefinition[] {
    const sealedIds = new Set(this.state.idiomSeals.map((seal) => seal.idiomId));
    const resolved = this.state.trackedIdiomIds
      .map((id) => this.lookupIdiom(id))
      .filter((idiom): idiom is IdiomDefinition => idiom !== undefined && !sealedIds.has(idiom.id));
    if (resolved.length > 0) return resolved;
    const inherited = this.idioms().find((idiom) => !sealedIds.has(idiom.id));
    return inherited ? [inherited] : [];
  }

  /**
   * 추적 성어들의 부족 글자 합집합 — 소환 가중과 인연 연구 가중이 함께 향하는
   * 곳이다. 캐주얼은 아직 보유하지 못한 글자 그 자체, 표준은 그 글자의 합성
   * 계보에서 지금 부족한 직접 소환 재료를 센다.
   */
  trackedIdiomMissingChars(owned?: readonly Tower[]): Set<string> {
    const towers = owned ?? [...this.state.towers, ...this.state.inventoryTowers];
    const chars = new Set<string>();
    for (const idiom of this.trackedIdioms()) {
      if (this.state.mode === "casual") {
        for (const char of this.idiomProgress(idiom.id).missingChars) chars.add(char);
      } else {
        for (const char of helpfulDirectCharsForIdiom(this.catalog, towers, idiom)) chars.add(char);
      }
    }
    return chars;
  }

  idiomProgress(id: string): { owned: number; total: number; readiness: number; missingChars: string[] } {
    const idiom = this.lookupIdiom(id);
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
    /*
     * 농축 공속은 단계마다 **곱으로** 줄인다(선형이 아니다).
     *
     * 상한이 열리면서 선형 0.075/단계는 13단계에서 1.0 을 넘어 대기시간이
     * 음수가 된다 — 하한 0.28 이 가려 줄 뿐 사실상 즉시 발사다. 곱으로 두면
     * 아무리 올려도 0 에 수렴할 뿐 뒤집히지 않고, 앞 세 단계는 예전 값과
     * 거의 같다(3단계 0.792 vs 옛 0.775).
     */
    const hastePerLevel = tower.concentrationPath === "swift" ? 0.075 : 0.02;
    const concentrationHaste = 1 - (1 - hastePerLevel) ** concentration;
    const upgradeHaste = this.combinedUpgradeBonus(tower.wuxing, "attackSpeed");
    // 수술 7: 캐주얼 공속 성장 별당 2% → 3%. 별이 오르면 실제로 빨라진다.
    const progressionHaste = this.state.mode === "casual"
      ? ((tower.casualStar ?? tower.naturalStar ?? 1) - 1) * CASUAL_STAR_HASTE_PER_STAR
      : (tower.stage - 1) * 0.035;
    // [SKILL-V3] 획수 공명: 같은 진에 선 동급 자령 1기당 공격 대기 −4%(4중첩 상한).
    const resonanceScale = strokeResonanceCooldownScale(this.strokeResonanceStacks(tower));
    return Math.max(0.28, profile.cooldown * (1 - progressionHaste) * (1 - concentrationHaste) * resonanceScale / (1 + upgradeHaste));
  }

  /** [SKILL-V3] 이 자령의 별. 별승급 진법에서만 뜻이 있다. */
  towerStarRank(tower: Tower): number {
    return tower.casualStar ?? tower.naturalStar ?? 1;
  }

  /**
   * [SKILL-V3] 획수 공명 중첩 — 같은 진에 선 **자기와 같은 별** 동료 수(자신 제외),
   * 4중첩 상한. 별승급(캐주얼) 전용이다 — 표준 모드에는 별이 없다.
   *
   * 가방(inventoryTowers)은 세지 않는다 — `state.towers` 만이 진에 서 있는 자령이다.
   * 기술이 깨어나지 않은 자령(1★)은 울리지도, 울려 주지도 않는다.
   * 발동 중 성어로 칸이 고정된(핀) 자령도 진에 서 있는 한 그대로 센다. 자동배치는
   * 오행과 실화력만 보고 자리를 정하므로 이 축을 최적화하지 않는다 — 공명은
   * 자동배치가 만들어 주는 보너스가 아니라, 배치를 손보는 사람이 노려서 얻는
   * 보너스다(그래서 자동배치와 서로 간섭하지 않는다).
   */
  strokeResonanceStacks(tower: Tower): number {
    if (this.state.mode !== "casual" || tower.cell < 0 || !this.towerHasActiveSkills(tower)) return 0;
    const formationIndex = Math.floor(tower.cell / CELLS_PER_FORMATION);
    const star = this.towerStarRank(tower);
    let allies = 0;
    for (const candidate of this.state.towers) {
      if (candidate.id === tower.id || candidate.cell < 0) continue;
      if (Math.floor(candidate.cell / CELLS_PER_FORMATION) !== formationIndex) continue;
      if (this.towerStarRank(candidate) !== star) continue;
      // 기술이 깨어나지 않은 자령은 공명을 보태지 않는다.
      if (!this.towerHasActiveSkills(candidate)) continue;
      allies += 1;
      if (allies >= STROKE_RESONANCE_MAX_STACKS) break;
    }
    return strokeResonanceStacks(allies);
  }

  /** [SKILL-V3] 획수 공명 UI 상태. 중첩이 없으면 null — 칩을 아예 그리지 않는다. */
  strokeResonanceStatus(tower: Tower): { stacks: number; star: number; haste: number } | null {
    const stacks = this.strokeResonanceStacks(tower);
    if (stacks <= 0) return null;
    return { stacks, star: this.towerStarRank(tower), haste: 1 - strokeResonanceCooldownScale(stacks) };
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
        ? `${selected.char} 배치 · ${occupant.char} 가방으로 원자 교체`
        : selected.char + " 가방 → " + String(cell + 1) + "번 칸 배치";
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
    const idiomLabel = sealed > 0 ? `성어 ${sealed}개 발동 · ` : "";
    const inventoryLabel = deployed.length > 0 ? `가방 ${deployed.length}기 투입 · ` : "";
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
      if (stored) reasons.push("가방 대기");
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
        blocked.push({ towerId, reason: "가방 자령만 일괄 분해할 수 있습니다." });
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
    if (quote.ids.length === 0) return { ok: false, message: "분해할 가방 자령을 선택하세요." };
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
    if (ids.length === 0) return { ok: false, message: "보호 규칙을 통과한 가방 정리 후보가 없습니다." };
    return this.dismantleTowers(ids, options);
  }

  /**
   * 성어 줄을 지키고 있는 자령인가.
   *
   * 봉인의 네 자리 중 하나에 서 있으면 그렇다. 흩어진 봉인(active=false)은
   * 세지 않는다 — 지금 줄을 지키는 값을 치르는 것이기 때문이다.
   */
  isTowerHoldingIdiom(towerId: number): boolean {
    const tower = this.state.towers.find((candidate) => candidate.id === towerId);
    if (!tower || tower.cell < 0) return false;
    return this.state.idiomSeals.some((seal) => seal.active && seal.cells.includes(tower.cell));
  }

  /**
   * 이 자령의 다음 농축 값.
   *
   * 성어 줄을 지키는 자령은 **절반**만 낸다. 요구의 원래 뜻이 여기 있다 —
   * "레어도 낮은 한자를 성어 줄에 세우면 손해"라는 감각을 지우려는 것이다.
   * 줄을 채우려 고른 약한 글자일수록 농축이 필요한데, 값까지 같으면 성어를
   * 세우는 선택이 벌처럼 느껴진다.
   */
  private concentrationEssenceCostFor(target: Tower, currentLevel: number): number {
    const base = concentrationEssenceCost(currentLevel);
    return this.isTowerHoldingIdiom(target.id) ? Math.max(1, Math.ceil(base / 2)) : base;
  }

  concentrationQuote(targetId: number, path: ConcentrationPath): ConcentrationQuote | null {
    const target = [...this.state.towers, ...this.state.inventoryTowers].find((tower) => tower.id === targetId);
    if (!target) return null;
    const currentLevel = target.concentration ?? 0;
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
      essenceCost: this.concentrationEssenceCostFor(target, currentLevel),
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
    const concentrationHaste = 1 - (1 - (path === "swift" ? 0.075 : 0.02)) ** level;
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
    this.state.lastMessage = `${target.char} 濃 ${target.concentration} · ${concentrationPathLabel(quote.path)}`;
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
    if (this.selectedTowerIsStored()) return { ok: false, message: "이미 가방에 있는 자령입니다." };
    this.state.towers = this.state.towers.filter((tower) => tower.id !== selected.id);
    selected.cell = -1;
    this.state.inventoryTowers.push(selected);
    this.state.lastMessage = selected.char + " 가방에 보관";
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
      .map((id) => this.lookupIdiom(id))
      .filter((idiom): idiom is IdiomDefinition => Boolean(idiom));
  }

  allIdioms(): readonly IdiomDefinition[] {
    return this.customIdioms.length === 0
      ? idiomsForRegion(this.state.region)
      : [...idiomsForRegion(this.state.region), ...this.customIdioms];
  }

  summonDefinitions(): readonly HanziDefinition[] {
    return this.runSummonPool;
  }

  /** 1순위 추적 성어. 배치 안내·성어 HUD·계보 소환 표시가 이 한 구를 본다. */
  currentIdiomTarget(): IdiomDefinition | undefined {
    return this.trackedIdioms()[0];
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

  /**
   * 발동 중인 성어 수가 주는 판 전체 공격 증폭.
   *
   * 성어 한 구마다 IDIOM_SEAL_ATTACK_PER_SEAL 씩, 상한까지. 진을 가리지 않으므로
   * "성어를 어느 진에 몰아 세울까"가 아니라 "몇 구를 세웠나"만 본다 —
   * 화면에 이미 「성어 발동 N구」가 있으니 사람이 셀 수 있는 수와 힘이 같아진다.
   */
  idiomSealAttackBonus(): number {
    let seals = 0;
    for (const seal of this.state.idiomSeals) if (seal.active) seals += 1;
    return Math.min(IDIOM_SEAL_ATTACK_CAP, seals * IDIOM_SEAL_ATTACK_PER_SEAL);
  }

  /**
   * 기존 성어(104구)의 전역 보너스. 커스텀 성어는 여기 섞이지 않는다 —
   * 이 통은 두 구면 상한에 닿으므로, 커스텀까지 같은 통에 넣으면 애써 새긴
   * 성어가 아무 일도 하지 않는다(custom-idioms.ts 머리말).
   */
  idiomBonus(kind: IdiomBonusKind): number {
    // 유지형 규칙: 흩어진 봉인은 기록에만 남고 보너스는 내지 않는다.
    const total = this.state.idiomSeals.reduce((sum, seal) => {
      if (!seal.active) return sum;
      const idiom = this.lookupIdiom(seal.idiomId);
      if (!idiom || idiom.source === "custom") return sum;
      return sum + (idiom.bonus.kind === kind ? idiom.bonus.value : 0);
    }, 0);
    const cap = BASE_IDIOM_BONUS_CAPS[kind];
    return cap === undefined ? total : Math.min(cap, total);
  }

  /**
   * 커스텀 성어(묵편으로 새긴 것)의 전역 보너스 — 통이 따로다.
   *
   * 장착 상한이 15구라 통이 넉넉해야 "열다섯을 모은 보람"이 생긴다. 대신
   * 상한을 둬서 한 축에 몰아 넣어도 판이 무너지지 않게 막는다.
   */
  customIdiomBonus(kind: IdiomBonusKind): number {
    if (this.customIdioms.length === 0) return 0;
    let total = 0;
    for (const seal of this.state.idiomSeals) {
      if (!seal.active) continue;
      const idiom = this.lookupIdiom(seal.idiomId);
      if (!idiom || idiom.source !== "custom") continue;
      if (idiom.bonus.kind === kind) total += idiom.bonus.value;
    }
    return Math.min(CUSTOM_IDIOM_BONUS_CAPS[kind], total);
  }

  /** 두 통을 합친 값. 같은 축을 쓰는 자리는 이걸 본다. */
  totalIdiomBonus(kind: IdiomBonusKind): number {
    return this.idiomBonus(kind) + this.customIdiomBonus(kind);
  }

  /**
   * 커스텀 성어까지 포함한 성어 조회.
   *
   * 커스텀은 지역 명단에 없다 — 사람이 새긴 것이라 판마다 다르다. 그래서
   * 장착분을 먼저 보고, 없으면 지역 명단에서 찾는다.
   */
  private lookupIdiom(id: string): IdiomDefinition | undefined {
    for (const idiom of this.customIdioms) if (idiom.id === id) return idiom;
    return idiomById(this.state.region, id);
  }

  private buildRunSummonPool(): readonly HanziDefinition[] {
    const directChars = idiomDirectPoolChars(this.catalog, this.trackedIdioms());
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
   * [병합 지점] 성어 기원 소환이 살피는 "추적 성어" 목록.
   *
   * 지금은 단일 추적(currentIdiomTarget) 하나다. 목표 체계가 "성어=목표,
   * 복수 추적 3"으로 개편되면 이 메서드가 추적 배열을 돌려주도록만 바꾸면 된다 —
   * 부족 글자 합집합(idiomWishChars)·상점 카드·소환 본체는 그대로 붙는다.
   */
  idiomWishTargets(): readonly IdiomDefinition[] {
    // 목표 서책 개편: 추적 성어(최대 3)의 합집합이 기원 풀이다.
    const tracked = this.trackedIdioms();
    if (tracked.length > 0) return tracked;
    const target = this.currentIdiomTarget();
    return target ? [target] : [];
  }

  /** 성어 기원 소환 후보 — 추적 성어들의 부족 글자 정의. 비어 있으면 상품 비활성. */
  idiomWishPool(): readonly HanziDefinition[] {
    const chars = idiomWishChars(
      this.catalog,
      [...this.state.towers, ...this.state.inventoryTowers],
      this.idiomWishTargets(),
      this.state.mode
    );
    const pool: HanziDefinition[] = [];
    for (const char of chars) {
      const definition = this.catalog.definitions.get(char);
      if (!definition) continue;
      // 캐주얼은 별 데이터가 없는 글자로 자령을 만들 수 없다(createTower 방어와 짝).
      if (this.state.mode === "casual" && casualNaturalStar(char) === null) continue;
      pool.push(definition);
    }
    return pool;
  }

  /**
   * 성어 기원 카드 한 장이 필요로 하는 전부 — 후보·가격·비활성 사유.
   *
   * 별승급(캐주얼) 전용이다. 자형연성에서는 부족 글자가 곧 합성 재료라
   * "반드시 유용한 소환"이 진화 루프(전투력)로 직결된다 — 45런 짝시드 실험
   * 2회에서 승률 +24.5pp/+11.1pp(합산 0.556→0.733)가 재현됐고 성어 봉인은
   * 오히려 줄었다(0.16→0.13, 0.27→0.16). 성어 가중 3배 기각과 같은 결이라
   * 자형연성은 기존 계보 소환(확률 가중)에 남긴다.
   */
  idiomWishQuote(): { pool: readonly HanziDefinition[]; cost: number; reason: string | null } {
    const pool = this.idiomWishPool();
    const cost = idiomWishCost(summonCost(this.state.summonCount));
    const reason = this.state.mode !== "casual"
      ? "별승급 진법 전용 — 자형연성은 계보 소환이 성어 재료를 맡습니다"
      : this.state.summonCount === 0
        ? "첫 소환으로 오행진을 먼저 여세요"
        : this.idiomWishTargets().length === 0
          ? "추적 성어가 없습니다"
          : pool.length === 0
            ? "부족 글자가 없습니다 — 성어 재료 완성"
            : null;
    return { pool, cost, reason };
  }

  /**
   * 성어 기원 소환 — 부적에 기원을 적어 올려 추적 성어의 부족 글자를 부른다.
   *
   * 일반 소환(summon)과 완전히 분리된 구매 경로다: 확률 가중·별 밴드·소프트
   * 연민·계보 진행도를 전혀 건드리지 않고 RNG 도 구매한 순간에만 쓴다 —
   * 상품을 사지 않는 런(자동 시뮬 포함)의 시드 결정성은 그대로다. 결과 자령은
   * 캐주얼에서 항상 1★로 태어나 전투력 유입을 최소화한다. "성어 가중"을
   * 올리면 승률까지 오르던 과거 기각안과 달리, 이 경로는 성어 완성만 판다.
   */
  summonIdiomWish(): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const { pool, cost, reason } = this.idiomWishQuote();
    if (reason !== null) return { ok: false, message: `성어 기원 · ${reason}` };
    if (this.state.gold < cost) return { ok: false, message: "엽전이 " + String(cost - this.state.gold) + " 부족합니다." };
    const emptyCell = this.state.autoPlaceSummons ? this.firstEmptyCell() : null;
    const stored = !this.state.autoPlaceSummons || emptyCell === null;
    const cell = stored ? -1 : emptyCell;
    if (cell === null) return { ok: false, message: "소환 위치를 찾지 못했습니다." };
    const definition = this.rng.pick(pool);
    this.state.gold -= cost;
    const tower = this.createTower(definition, cell);
    if (this.state.mode === "casual") {
      // 기원으로 태어난 자령은 언제나 1★ 그릇이다 — 성어 줄을 채우는 것이
      // 목적이지 전투력이 목적이 아니다(획수 별과 무관하게 고정).
      tower.naturalStar = 1;
      tower.casualStar = 1;
    }
    if (stored) this.state.inventoryTowers.push(tower);
    else this.state.towers.push(tower);
    this.state.summonCount += 1;
    this.state.selectedTowerId = tower.id;
    const newDiscovery = !this.state.discoveredChars.includes(definition.char);
    this.discover(definition.char);
    this.state.lastMessage = `성어 기원 · ${definition.char} · ${definition.combat.roleLabel}`
      + `${this.state.mode === "casual" ? " · 1★" : ""}${stored ? " 인벤토리 보관" : " 소환"} · 사자성어 재료!`;
    const eventAt = stored
      ? ((this.state.startingFormationIndex !== null ? BOARD_FORMATIONS[this.state.startingFormationIndex]?.center : undefined) ?? { x: 400, y: 300 })
      : BOARD_CELLS[cell] as Point;
    this.events.push({
      type: "summon",
      at: eventAt,
      tower: { ...tower },
      stored,
      helpful: true,
      helpfulReason: "idiom",
      newDiscovery,
      utility: newDiscovery ? "new" : "synthesis",
      // 기원 소환은 결과가 항상 1★이라 잭팟 꼬리가 없다.
      jackpot: false
    });
    if (definition.char === this.state.targetChar) this.completeGoal(definition.char);
    if (!stored) this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
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
      const idiom = this.lookupIdiom(seal.idiomId);
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
    // 봉인한 성어는 목표에서 은퇴한다. 목록이 비면 trackedIdioms() 가
    // 다음 미봉인 목표 성어를 승계하므로 진행이 끊기지 않는다.
    this.state.trackedIdiomIds = this.state.trackedIdiomIds.filter((id) => id !== idiom.id);
    this.announceIdiom(idiom, cells, false);
    this.runSummonPool = this.buildRunSummonPool();
  }

  private announceIdiom(idiom: IdiomDefinition, cells: readonly number[], rejoined: boolean): void {
    this.state.lastMessage = idiom.name + " · " + idiom.reading + (rejoined ? " 재발동 · " : " 자동 발동 · ") + idiom.bonus.label;
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
    this.state.lastMessage = idiom.name + " · " + idiom.reading + " 발동 해제 · 줄이 흩어졌습니다";
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

  /**
   * [트랙 V] `GameState` 밖에 있는 엔진 내부 상태 — 런 저장이 함께 담아야
   * 이어 돌린 판이 쭉 돌린 판과 같아진다.
   *
   * 여기 없는 나머지 private 필드는 전부 (a) 저장 시점(웨이브 경계)에 비어
   * 있거나 (b) 매 전투 틱마다 통째로 다시 계산되는 캐시다. 자세한 목록은
   * `adoptRun()` 주석에 적어 두었다.
   */
  captureRuntime(): EngineRuntimeSnapshot {
    return {
      rngState: this.rng.snapshot(),
      nextTowerId: this.nextTowerId,
      nextEnemyId: this.nextEnemyId,
      nextAbilityZoneId: this.nextAbilityZoneId,
      autoEvolutionCooldown: this.autoEvolutionCooldown
    };
  }

  /**
   * [트랙 V] 저장된 런을 이 엔진에 얹는다. `begin()` 의 자리를 대신하므로
   * 생성 직후에 한 번만 부른다 — 시드·지역·진법·표기·부적 모드는 생성자가
   * 이미 같은 값으로 받았다는 전제다(run-save.ts 의 `restoreRun` 이 지킨다).
   *
   * 되살리지 않고 다시 계산하는 것들:
   * - `currentPlan`: 웨이브 번호에서 순수 함수로 나온다(`planForWave`).
   * - `runSummonPool`: 복원된 추적 성어 목록에서 다시 세운다.
   * - `enemyPositions`·`targetCandidates`·`combat*` 캐시: 전투 틱마다
   *   `refreshCombatCache()` 가 통째로 덮어쓴다.
   * - `commandRallies`(호령 4초 명령): 웨이브 경계에는 이미 만료다.
   * - `events`: 소비되지 않은 연출 큐. 화면이 없는 저장본에 의미가 없다.
   */
  adoptRun(state: GameState, runtime: EngineRuntimeSnapshot): void {
    Object.assign(this.state, state);
    this.rng.restore(runtime.rngState);
    this.nextTowerId = runtime.nextTowerId;
    this.nextEnemyId = runtime.nextEnemyId;
    this.nextAbilityZoneId = runtime.nextAbilityZoneId;
    this.autoEvolutionCooldown = runtime.autoEvolutionCooldown;
    this.currentPlan = this.state.wave > 0 ? this.planForWave(this.state.wave) : null;
    this.commandRallies.fill(null);
    this.enemyPositions.clear();
    this.combatCharCounts.clear();
    this.combatSynergies.clear();
    this.combatPolarisElements.clear();
    this.targetCandidates.length = 0;
    this.combatFormationBonuses.fill(0);
    this.combatDistinctElements = 0;
    this.runSummonPool = this.buildRunSummonPool();
    this.events = [{ type: "phase", phase: this.state.phase }];
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
