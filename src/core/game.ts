import {
  CHAINSEAL_SEAL_SECONDS,
  CHAINSEAL_STACK_WINDOW,
  CHAINSEAL_STORE_RATIO,
  chainsealMaxStacks,
  FROST_ZONE_DURATION,
  FROST_ZONE_RADIUS,
  frostSlowRatio,
  GWICHEON_ABILITY,
  GWICHEON_MIN_STAR,
  GWICHEON_RUSH_THRESHOLD,
  gwicheonChargeSeconds,
  hasActiveSkills,
  idiomBlessingBonus,
  MOMENTUM_STACK_BONUS,
  momentumMaxStacks,
  REAPER_BOSS_CHIP_RATIO,
  reaperExecuteThreshold,
  WARFARE_BRAND_DURATION,
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
  type CasualFusionGain,
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
  casualAutoSkipReason,
  casualDismantleEssence,
  casualDismantleScore,
  casualFusionDismantleScore,
  casualFusionEssenceRefund,
  casualFusionHeadline,
  casualGoalOrder,
  casualStarIndexFor,
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
  interestForGold,
  MAX_CONCENTRATION_LEVEL,
  MODE_ENEMY_COUNT_SCALE,
  regionEnemyHpMultiplier,
  SUMMON_STAGE_WEIGHTS,
  type SummonStarBand,
  TIERED_SUMMON_INTENTS,
  TUTORIAL_ENEMY_COUNT_SCALE,
  TUTORIAL_ENEMY_HP_SCALE,
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
  CASUAL_STAR_DECAY,
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
  multiSummonCost,
  researchConnectionBonus,
  researchCost,
  researchUnlockWave,
  sellValue,
  STAGE_MULTIPLIERS,
  SUMMON_INTENT_LABELS,
  SUMMON_STAR_BANDS,
  SUMMON_SURCHARGE,
  summonCost,
  UPGRADE_STAT_META,
  upgradeEffectiveLevels,
  WUXING_ORDER
} from "./hanzi";
import {
  featuredIdiomsForRun,
  findIdiomPath,
  helpfulDirectCharsForIdiom,
  idiomById,
  type IdiomDefinition,
  idiomDirectPoolChars,
  idiomsForRegion
} from "./idioms";
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
  type EvolutionOption,
  type GameEvent,
  type GameMode,
  type GameState,
  type GoalProgress,
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
  MAX_CONCENTRATION_LEVEL,
  FIRST_PREP_SECONDS,
  GATE_OPENING_WARD,
  concentrationEssenceCost,
  autoConcentrationPath,
  concentrationPathLabel,
  concentrationEssenceRefund,
  dismantleEssenceValue,
  casualDismantleEssence,
  casualDismantleScore,
  casualFusionEssenceRefund,
  casualFusionDismantleScore,
  TUTORIAL_ENEMY_HP_SCALE,
  TUTORIAL_ENEMY_COUNT_SCALE
} from "./engine-tuning";

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
    const casualBossTrim = isBoss && this.state.mode === "casual" ? CASUAL_BOSS_HP_TRIM : 1;
    const hp = plan.hp * (isBoss || !plan.boss ? 1 : 1 / bossFactor) * hpJitter * casualBossTrim
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
      // [SKILL-V2] 연환 인장(공격마다)도 주기 기술이 아니다.
      && abilities.semanticFamily !== "chainseal"
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
        this.damageEnemy(target, burst, false, weakness, 0.2);
      }
    }

    // [SKILL-V2] 참명: 체력 문턱 이하의 일반 적은 즉시 소멸(보상 정상 지급).
    // 우두머리·정예(철갑)는 면역 — 대신 주기 발동이 현재 체력 3%를 벤다.
    if (activeSkills && abilities.semanticFamily === "reaper" && this.state.enemies.includes(target)
      && !target.boss && target.archetype !== "armored") {
      const threshold = reaperExecuteThreshold(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      if (target.hp / target.maxHp <= threshold) {
        this.emitAbility(tower, abilities.semantic, origin, targetPoint, 1, `참명 · 체력 ${Math.round(threshold * 100)}% 이하 즉시 소멸`);
        this.damageEnemy(target, target.hp + 10, false, false, 1);
      }
    }

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
    } else if (family === "reaper") {
      // [SKILL-V2] 참명 주기: 우두머리·정예 한정 현재 체력 3% 참격(즉시 소멸 면역 보상).
      const threshold = reaperExecuteThreshold(this.state.mode === "casual" ? tower.casualStar ?? tower.naturalStar ?? 1 : null);
      if ((target.boss || target.archetype === "armored") && this.state.enemies.includes(target)) {
        const chip = Math.max(1, target.hp * REAPER_BOSS_CHIP_RATIO);
        this.damageEnemy(target, chip, false, false, 1);
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
    // 모드 수량 계수: 캐주얼은 몸수를 줄이고 체력 계수로 총 내구를 보존한다.
    const modeCount = Math.max(1, Math.round(plan.count * MODE_ENEMY_COUNT_SCALE[this.state.mode]));
    // 수련장은 그 위에서 수량을 한 번 더 눌러 "반드시 이기는 첫 교전"을 보장한다.
    this.currentPlan = this.tutorial
      ? { ...plan, count: Math.max(3, Math.round(modeCount * TUTORIAL_ENEMY_COUNT_SCALE)) }
      : { ...plan, count: modeCount };
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
