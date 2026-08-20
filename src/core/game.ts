import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  CELLS_PER_FORMATION,
  MAX_ENEMIES,
  SUMMON_CELL_ORDER,
  WAVE_REINFORCEMENT_DELAY,
  bossTimeLimitForWave,
  positionOnPath,
  spawnProgressForEnemy,
  wavePlan
} from "./content";
import { EvolutionService } from "./evolution";
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
  multiSummonCost,
  researchConnectionBonus,
  researchCost,
  sellValue,
  summonCost
} from "./hanzi";
import { SeededRng } from "./rng";
import type {
  ActionResult,
  AutomationMode,
  CompositionBranchPreview,
  ConcentrationLevel,
  ConcentrationPath,
  Enemy,
  EvolutionOption,
  GameEvent,
  GameState,
  GoalProgress,
  HanziCatalog,
  HanziDefinition,
  AbilitySpec,
  Point,
  RegionCode,
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

export function interestForGold(gold: number): number {
  return Math.max(0, Math.floor(gold / 10));
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

export const MAX_CONCENTRATION_LEVEL: ConcentrationLevel = 3;
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

const REGION_ENEMY_HP: Record<RegionCode, number> = {
  // Five 4x4 elemental formations expose eighty active tower positions.
  // The 80-slot field produces far more sustained fire than the former 20-slot
  // board. Regional durability is calibrated to a 60-67% skilled-autoplay win
  // band while accounting for how early each recipe graph activates its seals.
  KR: 22,
  JP: 24.5,
  CN: 26.5
};

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
  private currentPlan: WavePlan | null = null;
  private autoEvolutionCooldown = 0;
  private runSummonPool: readonly HanziDefinition[] = [];

  constructor(seed: string, region: RegionCode = "KR") {
    this.catalog = getCatalog(region);
    this.evolution = new EvolutionService(this.catalog);
    this.rng = new SeededRng(seed);
    const targetChar = this.catalog.goalOrder[0] ?? this.catalog.activePool[0]?.char ?? "";
    this.state = {
      seed,
      region,
      phase: "title",
      wave: 0,
      maxWaves: GAME_CONFIG.maxWaves,
      gold: 64,
      researchLevel: 0,
      globalUpgrades: emptyStatUpgrades(),
      elementUpgrades: emptyElementUpgrades(),
      summonCount: 0,
      killCount: 0,
      evolutionCount: 0,
      interestEarned: 0,
      elementEssence: emptyElementEssence(),
      prepRemaining: GAME_CONFIG.prepSeconds,
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
      lastMessage: "지역과 목표 한자를 선택하세요.",
      autoPlaceSummons: true,
      summonIntent: "balanced",
      towers: [],
      inventoryTowers: [],
      enemies: []
    };
    this.runSummonPool = this.buildRunSummonPool();
  }

  begin(): void {
    this.rng = new SeededRng(this.state.seed);
    this.nextTowerId = 1;
    this.nextEnemyId = 1;
    this.currentPlan = null;
    this.autoEvolutionCooldown = 0;
    const targetChar = this.catalog.goalOrder[0] ?? this.catalog.activePool[0]?.char ?? "";
    Object.assign(this.state, {
      phase: "prep",
      wave: 0,
      gold: 64,
      researchLevel: 0,
      globalUpgrades: emptyStatUpgrades(),
      elementUpgrades: emptyElementUpgrades(),
      summonCount: 0,
      killCount: 0,
      evolutionCount: 0,
      interestEarned: 0,
      elementEssence: emptyElementEssence(),
      prepRemaining: GAME_CONFIG.prepSeconds,
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
      lastMessage: "첫 망령이 오기 전에 목표 재료를 소환하세요.",
      autoPlaceSummons: this.state.autoPlaceSummons,
      summonIntent: this.state.summonIntent,
      towers: [],
      inventoryTowers: [],
      enemies: []
    });
    this.runSummonPool = this.buildRunSummonPool();
    this.events = [{ type: "phase", phase: "prep" }];
  }

  update(rawDelta: number): void {
    if (this.state.phase === "title" || this.state.phase === "victory" || this.state.phase === "defeat") return;
    const delta = Math.min(0.1, Math.max(0, rawDelta));
    this.state.elapsed += delta;
    this.autoEvolutionCooldown -= delta;
    if (this.state.automationMode === "goal" && this.autoEvolutionCooldown <= 0) {
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
    const bossFactor = plan.wave === 10 ? 7.5 : 11.5;
    const hpJitter = 0.94 + this.rng.next() * 0.12;
    const hp = plan.hp * (isBoss || !plan.boss ? 1 : 1 / bossFactor) * hpJitter * REGION_ENEMY_HP[this.state.region];
    const archetype = isBoss ? "boss" : plan.boss ? "normal" : plan.archetype;
    this.state.enemies.push({
      id: this.nextEnemyId++,
      wave: plan.wave,
      hp,
      maxHp: hp,
      // Bosses keep circulating; the explicit boss clock is their deadline.
      speed: plan.speed * (isBoss ? 0.34 : 0.92 + this.rng.next() * 0.16),
      progress: spawnProgressForEnemy(this.state.spawned),
      reward: isBoss ? plan.reward : Math.max(1, Math.floor(plan.reward / (plan.boss ? 4 : 1))),
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
    for (const enemy of [...this.state.enemies]) {
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
    const range = definition.combat.range + (tower.stage - 1) * 7 + this.idiomBonus("range") + (tower.concentration ?? 0) * 4 + this.combinedUpgradeBonus(tower.wuxing, "range");
    const candidates = this.state.enemies.filter((enemy) => distance(origin, positionOnPath(enemy.progress)) <= range);
    const priority = definition.combat.abilities.targetPriority;
    const clusterSize = (enemy: Enemy): number => candidates.filter((candidate) =>
      distance(positionOnPath(candidate.progress), positionOnPath(enemy.progress)) <= 125
    ).length;
    return candidates.sort((left, right) => {
      const value = (enemy: Enemy): number => {
        if (priority === "strongest") return enemy.hp + (enemy.boss ? enemy.maxHp : 0);
        if (priority === "fastest") return enemy.speed * enemy.slowFactor + enemy.progress * 0.001;
        if (priority === "armored") return enemy.armor * 1000 + enemy.hp * 0.01;
        if (priority === "cluster") return clusterSize(enemy) * 100 + enemy.progress;
        if (priority === "valuable") return enemy.reward * 100 + enemy.progress;
        return enemy.progress;
      };
      return value(right) - value(left) || right.progress - left.progress;
    })[0];
  }

  private fireTower(tower: Tower, target: Enemy): void {
    const definition = definitionForTower(this.catalog, tower.definitionId);
    const profile = definition.combat;
    const abilities = profile.abilities;
    const tuning = abilities.tuning;
    const style = ELEMENT_STYLES[tower.wuxing];
    const origin = BOARD_CELLS[tower.cell] as Point;
    const targetPoint = positionOnPath(target.progress);
    const synergy = this.isSynergyActive(tower.wuxing);
    const weakness = target.weakness === tower.wuxing;
    tower.shotCount += 1;
    const concentration = tower.concentration ?? 0;
    const concentrationPath = tower.concentrationPath ?? null;
    const abilityPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "abilityPower");
    const statusPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "statusPower");
    const semanticEvery = Math.max(3, tuning.semanticEvery - (concentration >= 3 ? 1 : 0));
    const semanticTrigger = tower.shotCount % semanticEvery === 0
      && (abilities.semanticFamily !== "weather" || this.state.enemies.length >= 5);
    const signature = tower.shotCount % tuning.signatureEvery === 0;
    const lineageTrigger = Boolean(abilities.lineage && tower.shotCount % tuning.lineageEvery === 0);
    const signatureControlBonus = signature && profile.role === "control" ? tuning.roleControlBonus : 0;
    let damage = profile.baseDamage * STAGE_MULTIPLIERS[tower.stage] * profile.budgetMultiplier;
    damage *= 1 + concentration * (concentrationPath === "potent" ? 0.12 : 0.055);
    damage *= 1 + this.combinedUpgradeBonus(tower.wuxing, "damage");
    damage *= 1 + this.idiomBonus("damage");
    damage *= 1 + this.formationDamageBonus(tower.cell);
    if (synergy) damage *= 1 + GAME_CONFIG.synergyBonus + (profile.role === "support" ? 0.08 : 0);
    if (weakness) damage *= GAME_CONFIG.weaknessMultiplier;

    const distinctElements = new Set(this.state.towers.map((candidate) => candidate.wuxing)).size;
    if (tower.graphRole === "hub") damage *= 1 + distinctElements * tuning.hubDiversityBonus;
    if (tower.graphRole === "finisher" && target.hp / target.maxHp <= tuning.executeThreshold) damage *= tuning.executeMultiplier;
    if (tower.graphRole === "independent" && this.state.towers.filter((candidate) => candidate.char === tower.char).length === 1) {
      damage *= tuning.soloMultiplier;
    }
    if (semanticTrigger && (abilities.semanticFamily === "sight" || abilities.semanticFamily === "metalwork" || abilities.semanticFamily === "general")) {
      damage *= tuning.semanticMultiplier + (concentrationPath === "potent" ? concentration * 0.035 : 0);
    }
    if (signature && profile.role !== "rapid") damage *= tuning.signatureMultiplier;

    let critical = false;
    let armorPenetration = 0;

    if (tower.wuxing === "金") {
      armorPenetration = Math.min(0.95, tuning.armorPenetration + signatureControlBonus * 0.5 + (semanticTrigger && abilities.semanticFamily === "metalwork" ? 0.22 : 0));
      if (this.rng.chance(tuning.critChance + signatureControlBonus * 0.5)) {
        damage *= tuning.critMultiplier;
        critical = true;
      }
    }

    this.events.push({ type: "shot", from: origin, to: targetPoint, color: style.color, critical });
    this.damageEnemy(target, damage, critical, weakness, armorPenetration);

    let elementTargets = 1;
    if (tower.wuxing === "火") {
      const splashRadius = tuning.splashRadius + signatureControlBonus * 80;
      const splashRatio = tuning.splashRatio + signatureControlBonus * 0.35;
      for (const enemy of this.state.enemies
        .filter((candidate) => candidate.id !== target.id && distance(positionOnPath(candidate.progress), targetPoint) <= splashRadius)
        .slice(0, 5)) {
        this.damageEnemy(enemy, damage * splashRatio * abilityPower, false, enemy.weakness === tower.wuxing);
        elementTargets += 1;
      }
    } else if (tower.wuxing === "水" && this.state.enemies.includes(target)) {
      target.slowFactor = Math.min(target.slowFactor, Math.max(0.38, tuning.slowFactor - signatureControlBonus));
      target.slowUntil = this.state.elapsed + tuning.slowDuration * (signatureControlBonus > 0 ? 1.35 : 1) * statusPower;
      const chained = this.state.enemies
        .filter((candidate) => candidate.id !== target.id && distance(positionOnPath(candidate.progress), targetPoint) <= 150)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, tuning.chainCount);
      for (const enemy of chained) {
        this.damageEnemy(enemy, damage * tuning.chainRatio * abilityPower, false, enemy.weakness === tower.wuxing);
        elementTargets += 1;
      }
    } else if (tower.wuxing === "木" && this.state.enemies.includes(target)) {
      target.poisonDps = Math.max(target.poisonDps, damage * (tuning.poisonRatio + signatureControlBonus * 0.35) * abilityPower);
      target.poisonUntil = this.state.elapsed + tuning.poisonDuration * (signatureControlBonus > 0 ? 1.35 : 1) * statusPower;
    } else if (tower.wuxing === "土" && this.state.enemies.includes(target)) {
      const stunChance = tuning.stunChance + signatureControlBonus;
      if (this.rng.chance(stunChance)) {
        target.stunnedUntil = Math.max(target.stunnedUntil, this.state.elapsed + tuning.stunDuration * (signatureControlBonus > 0 ? 1.35 : 1) * statusPower);
      } else {
        elementTargets = 0;
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
          .filter((candidate) => candidate.id !== target.id && distance(positionOnPath(candidate.progress), targetPoint) <= tuning.splashRadius + 22)
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
      this.events.push({ type: "shot", from: origin, to: targetPoint, color: abilities.lineage.color, critical: false });
      this.emitAbility(
        tower,
        abilities.lineage,
        origin,
        targetPoint,
        1,
        abilities.lineageWuxing + "행 " + String(Math.round(tuning.lineageRatio * 100)) + "% 추가타"
      );
    }

    const elementProc = tower.wuxing === "金" ? critical : tower.wuxing === "土" ? elementTargets > 0 : true;
    if (elementProc && (tower.shotCount === 1 || signature || lineageTrigger)) {
      const elementEffect = tower.wuxing === "木"
        ? "독 " + String(Math.round((tuning.poisonRatio + signatureControlBonus * 0.35) * 100)) + "%/초 · " + (tuning.poisonDuration * (signatureControlBonus > 0 ? 1.35 : 1)).toFixed(1) + "초"
        : tower.wuxing === "火"
          ? "주변 " + String(Math.max(0, elementTargets - 1)) + "체에 " + String(Math.round((tuning.splashRatio + signatureControlBonus * 0.35) * 100)) + "% 피해"
          : tower.wuxing === "土"
            ? "이동 봉쇄 " + (tuning.stunDuration * (signatureControlBonus > 0 ? 1.35 : 1)).toFixed(1) + "초"
            : tower.wuxing === "金"
              ? "치명 ×" + tuning.critMultiplier.toFixed(2) + " · 장갑 " + String(Math.round(armorPenetration * 100)) + "% 관통"
              : "감속 " + String(Math.round((1 - Math.max(0.38, tuning.slowFactor - signatureControlBonus)) * 100)) + "% · 연쇄 " + String(Math.max(0, elementTargets - 1)) + "체";
      this.emitAbility(tower, abilities.element, origin, targetPoint, elementTargets, elementEffect);
    }
    if (signature || tower.shotCount === 1) {
      const graphActive = tower.graphRole === "finisher"
        ? target.hp / target.maxHp <= tuning.executeThreshold
        : tower.graphRole === "independent"
          ? this.state.towers.filter((candidate) => candidate.char === tower.char).length === 1
          : true;
      if (graphActive) {
        const graphEffect = tower.graphRole === "hub"
          ? "오행 " + String(distinctElements) + "종 · 피해 +" + String(Math.round(distinctElements * tuning.hubDiversityBonus * 100)) + "%"
          : tower.graphRole === "bridge"
            ? "부모 계승 " + String(tuning.lineageEvery) + "회마다 발동"
            : tower.graphRole === "finisher"
              ? "체력 35% 이하 · 피해 +" + String(Math.round((tuning.executeMultiplier - 1) * 100)) + "%"
              : "같은 글자 1기 · 피해 +" + String(Math.round((tuning.soloMultiplier - 1) * 100)) + "%";
        this.emitAbility(tower, abilities.graph, origin, targetPoint, 1, graphEffect);
      }
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
    const potency = 1 + (tower.concentrationPath === "potent" ? (tower.concentration ?? 0) * 0.08 : 0);
    const abilityPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "abilityPower");
    const statusPower = 1 + this.combinedUpgradeBonus(tower.wuxing, "statusPower");
    let targets = 1;
    let effect = abilities.semantic.summary;

    if (family === "gate") {
      const relay = this.state.enemies
        .filter((candidate) => candidate.id !== target.id)
        .sort((left, right) => distance(positionOnPath(right.progress), targetPoint) - distance(positionOnPath(left.progress), targetPoint))[0];
      if (relay) {
        const relayPoint = positionOnPath(relay.progress);
        this.events.push({ type: "shot", from: targetPoint, to: relayPoint, color: abilities.semantic.color, critical: false });
        this.damageEnemy(relay, damage * tuning.semanticMultiplier * potency * abilityPower, false, relay.weakness === tower.wuxing, 0.12);
        targets = 2;
        effect = "길 반대편 1체에 " + String(Math.round(tuning.semanticMultiplier * potency * 100)) + "% 전이";
      }
    } else if (family === "weather" || family === "flame") {
      const radius = family === "weather" ? 175 : 115;
      const victims = this.state.enemies
        .filter((candidate) => candidate.id !== target.id && distance(positionOnPath(candidate.progress), targetPoint) <= radius)
        .slice(0, family === "weather" ? 7 : 5);
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
        .filter((candidate) => candidate.id !== target.id && distance(positionOnPath(candidate.progress), targetPoint) <= 145)
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

    this.emitAbility(tower, abilities.semantic, origin, targetPoint, targets, effect);
  }

  private emitAbility(tower: Tower, ability: AbilitySpec, source: Point, at: Point, targets: number, effect: string): void {
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
      effect
    });
  }

  private damageEnemy(enemy: Enemy, rawAmount: number, critical: boolean, weakness: boolean, armorPenetration = 0): void {
    if (!this.state.enemies.includes(enemy)) return;
    const effectiveArmor = enemy.armor * (1 - armorPenetration);
    const amount = rawAmount * (1 - effectiveArmor);
    enemy.hp -= amount;
    enemy.flash = 0.09;
    if (amount >= 1.5) this.events.push({ type: "damage", at: positionOnPath(enemy.progress), amount, critical, weakness });
    if (enemy.hp > 0) return;
    const at = positionOnPath(enemy.progress);
    this.state.enemies = this.state.enemies.filter((candidate) => candidate.id !== enemy.id);
    if (enemy.boss) this.state.bossDefeated = true;
    this.state.gold += enemy.reward;
    this.state.killCount += 1;
    this.events.push({ type: "kill", at, reward: enemy.reward });
  }

  private finishWave(): void {
    if (this.state.wave >= this.state.maxWaves) {
      const interest = this.payBankInterest();
      this.endRun("victory", `스무 번째 봉인을 지켜냈습니다!${interest > 0 ? ` · 은행 이자 +${interest}엽전` : ""}`);
      return;
    }
    const bonus = 12 + this.state.wave * 2;
    this.state.gold += bonus;
    const interest = this.payBankInterest();
    this.state.phase = "prep";
    this.state.prepRemaining = GAME_CONFIG.prepSeconds;
    this.state.lastMessage = String(this.state.wave) + "웨이브 방어 성공 · 보상 " + String(bonus) + "엽전" + (interest > 0 ? " · 은행 이자 +" + String(interest) + "엽전" : "");
    this.events.push({ type: "phase", phase: "prep" });
  }

  private advanceWaveWithSurvivors(): void {
    if (this.state.wave >= this.state.maxWaves) {
      const interest = this.payBankInterest();
      this.endRun("victory", `마지막 우두머리를 쓰러뜨리고 스무 번째 봉인을 지켜냈습니다!${interest > 0 ? ` · 은행 이자 +${interest}엽전` : ""}`);
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
    const emptyCell = this.state.autoPlaceSummons ? this.firstEmptyCell() : null;
    const stored = !this.state.autoPlaceSummons || emptyCell === null;
    const cost = summonCost(this.state.summonCount);
    if (this.state.gold < cost) return { ok: false, message: "엽전이 " + String(cost - this.state.gold) + " 부족합니다." };
    const cell = stored ? -1 : emptyCell;
    if (cell === null) return { ok: false, message: "소환 위치를 찾지 못했습니다." };
    if (this.runSummonPool.length === 0) return { ok: false, message: "이 지역의 활성 소환 풀이 비어 있습니다." };

    const ownedTowers = [...this.state.towers, ...this.state.inventoryTowers];
    const helpfulChars = this.evolution.getHelpfulDirectCharacters(ownedTowers, this.state.targetChar);
    const idiomTarget = this.currentIdiomTarget();
    const idiomHelpfulChars = idiomTarget
      ? helpfulDirectCharsForIdiom(this.catalog, ownedTowers, idiomTarget)
      : new Set<string>();
    const connectionBonus = researchConnectionBonus(this.state.researchLevel);
    const ownedCounts = new Map<string, number>();
    for (const tower of ownedTowers) ownedCounts.set(tower.char, (ownedCounts.get(tower.char) ?? 0) + 1);
    const discovered = new Set(this.state.discoveredChars);
    const deployedChars = new Set(this.state.towers.map((tower) => tower.char));
    const weights = this.runSummonPool.map((definition) => {
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
        ? onboarding ? 0 : 0.25
        : onboarding ? activePoolBaseWeight(this.state.region, definition.char) : 1;
      let weight = baseWeight * exposureWeight;
      if (helpfulChars.has(definition.char)) weight += (GAME_CONFIG.targetWeightBase + connectionBonus * 3.2) * pityMultiplier;
      if (idiomHelpfulChars.has(definition.char)) weight += GAME_CONFIG.idiomWeightBase * pityMultiplier;
      if (this.state.summonIntent === "discovery") weight *= discovered.has(definition.char) ? 0.42 : 3.4;
      else if (this.state.summonIntent === "lineage") weight *= helpfulChars.has(definition.char) || idiomHelpfulChars.has(definition.char) ? 3.2 : 0.72;
      else if (this.state.summonIntent === "concentration") {
        weight *= ownedCount > 0 ? 2.4 + Math.min(2.4, ownedCount * 0.55) + (deployedChars.has(definition.char) ? 1.4 : 0) : 0.48;
      }
      return weight;
    });
    const forcedCandidates = forceIntent && this.state.summonIntent !== "balanced"
      ? this.runSummonPool.map((definition, index) => ({ definition, weight: weights[index] ?? 0 })).filter(({ definition }) => {
        if (this.state.summonIntent === "discovery") return !discovered.has(definition.char);
        if (this.state.summonIntent === "lineage") return helpfulChars.has(definition.char) || idiomHelpfulChars.has(definition.char);
        return (ownedCounts.get(definition.char) ?? 0) > 0;
      })
      : [];
    const pickPool = forcedCandidates.length > 0 ? forcedCandidates.map((entry) => entry.definition) : this.runSummonPool;
    const pickWeights = forcedCandidates.length > 0 ? forcedCandidates.map((entry) => entry.weight) : weights;
    const definition = weightedPick(this.rng, pickPool, pickWeights);
    const goalHelpful = helpfulChars.has(definition.char);
    const idiomHelpful = idiomHelpfulChars.has(definition.char);
    const helpful = goalHelpful || idiomHelpful;
    const helpfulReason = goalHelpful && idiomHelpful ? "both" : goalHelpful ? "goal" : idiomHelpful ? "idiom" : null;
    this.state.gold -= cost;
    this.state.softPity = helpful ? 0 : Math.min(GAME_CONFIG.maxSoftPity, this.state.softPity + 1);
    const tower = this.createTower(definition, cell);
    if (stored) this.state.inventoryTowers.push(tower);
    else this.state.towers.push(tower);
    this.state.summonCount += 1;
    this.state.selectedTowerId = stored ? null : tower.id;
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
    this.state.lastMessage = definition.char + " · " + definition.combat.roleLabel + (stored ? " 인벤토리 보관" : " 소환") + helpfulLabel;
    const eventAt = stored ? { x: 400, y: 300 } : BOARD_CELLS[cell] as Point;
    this.events.push({ type: "summon", at: eventAt, tower: { ...tower }, stored, helpful, helpfulReason, newDiscovery, utility });
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
    const labels: Record<SummonIntent, string> = { balanced: "균형", discovery: "탐색", lineage: "계보", concentration: "농축" };
    this.state.lastMessage = `${labels[intent]} 소환 선택 · 10연 마지막 결과에 목적 보정`;
    return { ok: true, message: this.state.lastMessage };
  }

  availableEvolutions(): EvolutionOption[] {
    return this.evolution.getAvailableRecipes(
      [...this.state.towers, ...this.state.inventoryTowers],
      this.state.targetChar,
      this.state.selectedTowerId,
      this.state.automationMode
    );
  }

  compositionBranchesForSelected(): CompositionBranchPreview[] {
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
    this.state.gold += GAME_CONFIG.goalReward;
    this.events.push({ type: "goal", char, reward: GAME_CONFIG.goalReward });
    const next = this.catalog.goalOrder.find((candidate) => !this.state.goalsCompleted.includes(candidate));
    if (next) {
      this.state.targetChar = next;
      this.state.lastMessage = char + " 목표 달성 · " + String(GAME_CONFIG.goalReward) + "엽전 · 다음 목표 " + next;
    } else {
      this.state.lastMessage = char + " 목표 달성 · 지역 목표를 모두 완성했습니다!";
    }
  }

  goalProgress(): GoalProgress {
    return this.evolution.getGoalProgress([...this.state.towers, ...this.state.inventoryTowers], this.state.targetChar);
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
    if (!definition || definition.acquisition !== "craft") return { ok: false, message: "조합 가능한 한자만 목표로 지정할 수 있습니다." };
    this.state.targetChar = char;
    this.state.lastMessage = "목표 한자를 " + char + "로 변경했습니다.";
    return { ok: true, message: this.state.lastMessage };
  }

  upgradeResearch(): ActionResult {
    if (this.state.researchLevel >= 5) return { ok: false, message: "인연 연구가 최고 단계입니다." };
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

  upgradeGlobal(stat: UpgradeStat): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const level = this.state.globalUpgrades[stat];
    const meta = UPGRADE_STAT_META[stat];
    if (level >= MAX_UPGRADE_LEVEL) return { ok: false, message: `공용 ${meta.label} 강화가 최고 단계입니다.` };
    const cost = globalUpgradeCost(stat, level);
    if (this.state.gold < cost) return { ok: false, message: `공용 ${meta.label} 강화에 엽전 ${cost}이 필요합니다.` };
    const nextLevel = level + 1;
    this.state.gold -= cost;
    this.state.globalUpgrades[stat] = nextLevel;
    const bonus = this.globalUpgradeBonus(stat);
    this.state.lastMessage = `공용 ${meta.label} ${nextLevel}단계 · ${this.formatUpgradeBonus(stat, bonus)}`;
    this.events.push({ type: "statUpgrade", scope: "global", wuxing: null, stat, level: nextLevel, cost, bonus });
    return { ok: true, message: this.state.lastMessage };
  }

  upgradeElement(wuxing: Wuxing, stat: UpgradeStat = "damage"): ActionResult {
    if (!this.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다." };
    const level = this.state.elementUpgrades[wuxing][stat];
    const meta = UPGRADE_STAT_META[stat];
    if (level >= MAX_UPGRADE_LEVEL) return { ok: false, message: `${wuxing}행 ${meta.label} 강화가 최고 단계입니다.` };
    const cost = elementUpgradeCost(level);
    if (this.state.elementEssence[wuxing] < cost) return { ok: false, message: `${wuxing}행 ${meta.label} 강화에 ${wuxing} 문기 ${cost}가 필요합니다.` };
    const nextLevel = level + 1;
    this.state.elementEssence[wuxing] -= cost;
    this.state.elementUpgrades[wuxing][stat] = nextLevel;
    const bonus = this.elementUpgradeBonus(wuxing, stat);
    this.state.lastMessage = `${wuxing}행 ${meta.label} ${nextLevel}단계 · ${this.formatUpgradeBonus(stat, bonus)}`;
    this.events.push({ type: "statUpgrade", scope: "element", wuxing, stat, level: nextLevel, cost, bonus });
    return { ok: true, message: this.state.lastMessage };
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
    return Math.max(0.28, profile.cooldown * (1 - (tower.stage - 1) * 0.035) * (1 - concentrationHaste) / (1 + upgradeHaste));
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
    const occupant = this.state.towers.find((tower) => tower.cell === cell);
    const inventoryIndex = this.state.inventoryTowers.findIndex((tower) => tower.id === selected.id);
    if (inventoryIndex >= 0) {
      this.state.inventoryTowers.splice(inventoryIndex, 1);
      if (occupant) {
        this.state.towers = this.state.towers.filter((tower) => tower.id !== occupant.id);
        occupant.cell = -1;
        this.state.inventoryTowers.push(occupant);
      } else if (this.state.towers.length >= GAME_CONFIG.maxTowerCount) {
        this.state.inventoryTowers.push(selected);
        return { ok: false, message: "다섯 오행진 80칸이 모두 찼습니다. 교체할 칸을 클릭하세요." };
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
    if (this.state.towers.length === 0) return { ok: false, message: "자동배치할 전장 자령이 없습니다." };

    const originalCells = new Map(this.state.towers.map((tower) => [tower.id, tower.cell]));
    const sealedBefore = this.state.idiomSeals.length;
    const resonanceBefore = BOARD_FORMATIONS.reduce((sum, _, index) => sum + this.formationResonance(index).tier, 0);

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
      this.state.lastMessage = "이미 최적 배치입니다. 다음 성어 재료를 모아 보세요.";
      return { ok: true, message: this.state.lastMessage };
    }
    const idiomLabel = sealed > 0 ? `성어 ${sealed}개 봉인 · ` : "";
    this.state.lastMessage = `자동배치 · ${idiomLabel}오행 공명 ${resonanceBefore}→${resonanceAfter}단계 · ${moved}기 이동`;
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
    const availableCells = new Set(BOARD_CELLS.map((_, index) => index));
    const unassigned = new Set(this.state.towers.map((tower) => tower.id));

    for (const formation of BOARD_FORMATIONS) {
      const formationCells = Array.from({ length: CELLS_PER_FORMATION }, (_, offset) => formation.startCell + offset);
      const matching = this.state.towers
        .filter((tower) => tower.wuxing === formation.preferredWuxing)
        .sort((left, right) => {
          const leftDefinition = definitionForTower(this.catalog, left.definitionId);
          const rightDefinition = definitionForTower(this.catalog, right.definitionId);
          const leftPower = leftDefinition.combat.baseDamage * STAGE_MULTIPLIERS[left.stage] * leftDefinition.combat.budgetMultiplier / leftDefinition.combat.cooldown * (1 + (left.concentration ?? 0) * 0.1);
          const rightPower = rightDefinition.combat.baseDamage * STAGE_MULTIPLIERS[right.stage] * rightDefinition.combat.budgetMultiplier / rightDefinition.combat.cooldown * (1 + (right.concentration ?? 0) * 0.1);
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
    const targetPath = this.evolution.getTargetPath(this.state.targetChar);
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

      const dps = definition.combat.baseDamage * STAGE_MULTIPLIERS[tower.stage] * definition.combat.budgetMultiplier / definition.combat.cooldown;
      const score = dps + tower.stage * 70 + concentration * 90 + (stored ? -35 : 28) - Math.max(0, count - 1) * 22;
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

  dismantleSelected(): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "분해할 자령을 선택하세요." };
    if (selected.locked) return { ok: false, message: "잠긴 자령입니다. 잠금을 해제한 뒤 분해하세요." };
    const essence = dismantleEssenceValue(selected.stage, selected.concentration ?? 0);
    this.state.towers = this.state.towers.filter((tower) => tower.id !== selected.id);
    this.state.inventoryTowers = this.state.inventoryTowers.filter((tower) => tower.id !== selected.id);
    this.state.elementEssence[selected.wuxing] += essence;
    this.state.selectedTowerId = null;
    this.state.lastMessage = `${selected.char} 분해 · ${selected.wuxing} 문기 +${essence}`;
    this.events.push({ type: "dismantle", tower: { ...selected }, wuxing: selected.wuxing, essence });
    this.resolveIdiomFormations();
    return { ok: true, message: this.state.lastMessage };
  }

  dismantleRecommended(limit = 8): ActionResult {
    const candidates = this.cleanupCandidates(limit, true);
    if (candidates.length === 0) return { ok: false, message: "보호 규칙을 통과한 인벤토리 정리 후보가 없습니다." };
    const gains = emptyElementEssence();
    const removed: string[] = [];
    for (const candidate of candidates) {
      const tower = this.state.inventoryTowers.find((entry) => entry.id === candidate.towerId);
      if (!tower) continue;
      const essence = dismantleEssenceValue(tower.stage, tower.concentration ?? 0);
      gains[tower.wuxing] += essence;
      this.state.elementEssence[tower.wuxing] += essence;
      this.state.inventoryTowers = this.state.inventoryTowers.filter((entry) => entry.id !== tower.id);
      removed.push(tower.char);
      this.events.push({ type: "dismantle", tower: { ...tower }, wuxing: tower.wuxing, essence });
    }
    if (this.state.selectedTowerId !== null && ![...this.state.towers, ...this.state.inventoryTowers].some((tower) => tower.id === this.state.selectedTowerId)) {
      this.state.selectedTowerId = null;
    }
    const gainLabel = Object.entries(gains).filter(([, amount]) => amount > 0).map(([wuxing, amount]) => `${wuxing}+${amount}`).join(" · ");
    this.state.lastMessage = `정리 후보 ${removed.length}기 분해 · ${gainLabel}`;
    return { ok: true, message: this.state.lastMessage };
  }

  concentrateSelected(path?: ConcentrationPath): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "농축할 자령을 선택하세요." };
    const currentLevel = selected.concentration ?? 0;
    if (currentLevel >= MAX_CONCENTRATION_LEVEL) return { ok: false, message: `${selected.char} 농축이 최고 단계입니다.` };
    const chosenPath = selected.concentrationPath ?? path;
    if (!chosenPath) return { ok: false, message: "연속 농축 또는 심화 농축을 선택하세요." };
    if (selected.concentrationPath && path && selected.concentrationPath !== path) return { ok: false, message: "이미 선택한 농축 분기는 변경할 수 없습니다." };

    const duplicate = this.state.inventoryTowers.find((tower) => tower.id !== selected.id && tower.char === selected.char && !tower.locked);
    const essenceCost = concentrationEssenceCost(currentLevel);
    if (!duplicate && this.state.elementEssence[selected.wuxing] < essenceCost) {
      return { ok: false, message: `${selected.char} 중복 또는 ${selected.wuxing} 문기 ${essenceCost}가 필요합니다.` };
    }

    if (duplicate) this.state.inventoryTowers = this.state.inventoryTowers.filter((tower) => tower.id !== duplicate.id);
    else this.state.elementEssence[selected.wuxing] -= essenceCost;
    selected.concentration = (currentLevel + 1) as ConcentrationLevel;
    selected.concentrationPath = chosenPath;
    this.state.lastMessage = `${selected.char} 濃 ${selected.concentration}/3 · ${chosenPath === "swift" ? "연속" : "심화"} 농축`;
    this.events.push({
      type: "concentrate",
      tower: { ...selected },
      level: selected.concentration,
      path: chosenPath,
      usedDuplicate: Boolean(duplicate),
      essenceCost: duplicate ? 0 : essenceCost
    });
    return { ok: true, message: this.state.lastMessage };
  }

  sellSelected(): ActionResult {
    const selected = this.selectedTower();
    if (!selected) return { ok: false, message: "판매할 자령을 선택하세요." };
    if (selected.locked) return { ok: false, message: "잠긴 자령입니다. 잠금을 해제한 뒤 판매하세요." };
    const value = sellValue(selected.stage);
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
    const ids = new Set(this.state.featuredIdiomIds);
    return idiomsForRegion(this.state.region).filter((idiom) => ids.has(idiom.id));
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
    if (!formation) return { matching: 0, tier: 0, damageBonus: 0 };
    const endCell = formation.startCell + CELLS_PER_FORMATION;
    const matching = this.state.towers.filter((tower) =>
      tower.cell >= formation.startCell && tower.cell < endCell && tower.wuxing === formation.preferredWuxing
    ).length;
    const tier = matching >= 16 ? 4 : matching >= 12 ? 3 : matching >= 8 ? 2 : matching >= 4 ? 1 : 0;
    return { matching, tier, damageBonus: [0, 0.06, 0.12, 0.18, 0.25][tier] ?? 0 };
  }

  private formationDamageBonus(cell: number): number {
    return this.formationResonance(Math.floor(cell / CELLS_PER_FORMATION)).damageBonus;
  }

  consumeEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  private createTower(definition: HanziDefinition, cell: number): Tower {
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
      concentrationPath: null
    };
  }

  private discover(char: string): void {
    if (!this.state.discoveredChars.includes(char)) this.state.discoveredChars.push(char);
  }

  private firstEmptyCell(): number | null {
    const occupied = new Set(this.state.towers.map((tower) => tower.cell));
    for (const cell of SUMMON_CELL_ORDER) {
      if (!occupied.has(cell)) return cell;
    }
    return null;
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

export function runAutoplay(seed: string, region: RegionCode = "KR", maxSeconds = 1_200): SimulationResult {
  const engine = new GameEngine(seed, region);
  engine.begin();
  engine.setAutomationMode("semi");
  let decisionCooldown = 0;
  let peakTowerCount = 0;

  while (engine.state.elapsed < maxSeconds && engine.state.phase !== "victory" && engine.state.phase !== "defeat") {
    engine.update(0.1);
    decisionCooldown -= 0.1;
    if (decisionCooldown > 0) continue;
    decisionCooldown = 0.22;

    let evolutionGuard = 0;
    while (evolutionGuard < 8) {
      const option = autoplayEvolutionOption(engine);
      if (!option || !engine.evolve(option.recipeId).ok) break;
      arrangeAvailableAutoplayIdioms(engine);
      evolutionGuard += 1;
    }

    const desiredResearch = engine.state.wave >= 15 ? 4 : engine.state.wave >= 10 ? 3 : engine.state.wave >= 6 ? 2 : engine.state.wave >= 3 ? 1 : 0;
    const upgradeCost = researchCost(engine.state.researchLevel);
    if (engine.state.researchLevel < desiredResearch && upgradeCost > 0 && engine.state.gold >= upgradeCost + 24) {
      engine.upgradeResearch();
    }

    autoplayPurchaseUpgrades(engine);

    let attempts = 0;
    while (engine.state.towers.length < GAME_CONFIG.maxTowerCount && engine.state.gold >= summonCost(engine.state.summonCount) && attempts < 12) {
      engine.summon();
      arrangeAvailableAutoplayIdioms(engine);
      attempts += 1;
      const option = autoplayEvolutionOption(engine);
      if (option) {
        engine.evolve(option.recipeId);
        arrangeAvailableAutoplayIdioms(engine);
      }
    }

    if (engine.state.towers.length >= GAME_CONFIG.maxTowerCount && engine.availableEvolutions().length === 0) {
      const path = autoplayProtectedChars(engine);
      const disposable = [...engine.state.towers]
        .filter((tower) => !path.has(tower.char))
        .sort((a, b) => a.stage - b.stage)[0];
      if (disposable) {
        engine.selectTower(disposable.id);
        engine.dismantleSelected();
        autoplayPurchaseUpgrades(engine);
      }
    }

    if (engine.state.phase === "prep" && (engine.state.wave > 0 || engine.state.towers.length >= 5)) engine.startWaveEarly();
    peakTowerCount = Math.max(peakTowerCount, engine.state.towers.length);
  }

  return {
    seed,
    region,
    result: engine.state.phase === "victory" ? "victory" : engine.state.phase === "defeat" ? "defeat" : "timeout",
    wave: engine.state.wave,
    elapsed: engine.state.elapsed,
    summons: engine.state.summonCount,
    peakTowerCount,
    evolutions: engine.state.evolutionCount,
    discoveries: engine.state.discoveredChars.length,
    goals: engine.state.goalsCompleted.length,
    idioms: engine.state.idiomSeals.length,
    researchLevel: engine.state.researchLevel,
    endReason: engine.state.lastMessage
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
