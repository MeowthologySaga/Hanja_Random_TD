/**
 * 밸런스 전수조사용 계측 시뮬레이터 (조사 전용, 게임 코드에는 손대지 않는다).
 *
 * `runAutoplay` 와 같은 의사결정 루프를 그대로 복제하되, 모든 엽전·문기 이동을
 * 호출 단위로 계량해 "어디서 벌어 어디에 쓰는가"를 남긴다. 추가로
 *
 *  - `--intent`  : 봇의 기본 소환 목적. 출하 봇은 `lineage` 인데, 캐주얼에서
 *                  `lineage` 는 별 밴드가 `null` 이라 밴드·감쇠를 통째로 우회한다.
 *                  실제 플레이어의 `기본(balanced)` 상품과 분포가 달라진다.
 *  - `--arrange` : 성어 강제 정렬(봇의 순간이동) on/off. off 는 사람이 자동배치
 *                  버튼을 누르지 않았을 때의 발동률 하한이다.
 *  - `--assist`  : off 대신 `autoArrangeTowers()`(실제 게임의 자동배치 버튼)를 쓴다.
 *  - `--tier`    : 캐주얼 티어 소환(중급·고급) 구매를 켠다. 출하 봇은 티어를 전혀
 *                  사지 않으므로 티어 효용이 지표에 잡히지 않는다.
 */
import {
  GameEngine,
  autoConcentrationPath,
  runAutoplay
} from "../src/core/game";
import { BOARD_FORMATIONS } from "../src/core/content";
import {
  ELEMENT_TRAIT_MAX_LEVEL,
  elementTraitUnlockScore,
  elementTraitUpgradeCost
} from "../src/core/growth";
import {
  UPGRADE_STAT_ORDER,
  elementUpgradeCost,
  globalUpgradeCost,
  researchCost,
  researchUnlockWave
} from "../src/core/hanzi";
import { summonCost, summonProductCost } from "../src/core/engine-tuning";
import type { CasualStar, EvolutionOption, GameEvent, GameMode, RegionCode, Tower, Wuxing } from "../src/core/types";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const REGIONS: readonly RegionCode[] = ["KR", "JP", "CN"];
const ELEMENTS: readonly Wuxing[] = ["木", "火", "土", "金", "水"];

type GoldInKey = "kill" | "waveClear" | "earlyStart" | "interest" | "goal" | "evolutionGold" | "sell";
type GoldOutKey = "summon" | "tierSummon" | "research" | "globalUpgrade" | "formation";
type EssenceInKey = "dismantle" | "refund";
type EssenceOutKey = "elementUpgrade" | "trait" | "concentration";

type Ledger<K extends string> = Record<K, number>;

interface ProbeOptions {
  mode: GameMode;
  region: RegionCode;
  intent: "balanced" | "lineage" | "concentration";
  arrange: "bot" | "assist" | "off";
  tier: boolean;
}

export interface ProbeResult {
  seed: string;
  region: RegionCode;
  mode: GameMode;
  result: "victory" | "defeat" | "timeout";
  wave: number;
  elapsedMinutes: number;
  summons: number;
  tierSummons: number;
  dismantles: number;
  fusions: number;
  evolutions: number;
  goals: number;
  idioms: number;
  /** 추적 성어 4자를 동시에 보유한 적이 있는 성어 수(= 이론적 발동 기회). */
  idiomAssembled: number;
  /** 각 성어를 처음으로 모두 갖춘 웨이브. 끝내 못 모으면 빠진다. */
  idiomAssembleWaves: number[];
  /** 4자가 동시에 **전장 위**에 있던 적이 있는 성어 수(= 한 줄 세우기가 실제로 가능한 순간). */
  idiomAssembledOnBoard: number;
  goldIn: Ledger<GoldInKey>;
  goldOut: Ledger<GoldOutKey>;
  essenceIn: Ledger<EssenceInKey>;
  essenceOut: Ledger<EssenceOutKey>;
  essenceGenerated: number;
  essenceSpent: number;
  /** 소환으로 나온 자령의 자연 별 분포(캐주얼). index = 별. */
  summonStars: number[];
  dismantleStars: number[];
  fusionResultStars: number[];
  /** 승급 시도가 도달한 최고 별. */
  peakStar: number;
  elementUpgradeLevels: number;
  traitLevels: number;
  researchLevel: number;
  formations: number;
  startingWuxing: Wuxing | null;
  endReason: string;
}

interface ProbeWorkerData {
  start: number;
  count: number;
  options: ProbeOptions;
}

function readArgument(name: string): string | undefined {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

function readOptions(): ProbeOptions {
  const mode = (readArgument("mode") ?? "standard") as GameMode;
  if (mode !== "standard" && mode !== "casual") throw new Error("--mode must be standard or casual");
  const region = (readArgument("region") ?? "KR").toUpperCase() as RegionCode;
  if (!REGIONS.includes(region)) throw new Error("--region must be KR, JP or CN");
  const intent = (readArgument("intent") ?? "lineage") as ProbeOptions["intent"];
  if (intent !== "balanced" && intent !== "lineage" && intent !== "concentration") {
    throw new Error("--intent must be balanced, lineage or concentration");
  }
  const arrange = (readArgument("arrange") ?? "bot") as ProbeOptions["arrange"];
  if (arrange !== "bot" && arrange !== "assist" && arrange !== "off") {
    throw new Error("--arrange must be bot, assist or off");
  }
  return { mode, region, intent, arrange, tier: (readArgument("tier") ?? "off") === "on" };
}

function readRuns(): number {
  const parsed = Number(readArgument("runs") ?? 45);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3_000) throw new Error("--runs must be 1..3000");
  return parsed;
}

function readWorkers(runs: number): number {
  const parsed = Number(readArgument("workers") ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 16) throw new Error("--workers must be 1..16");
  return Math.min(parsed, runs);
}

function emptyLedger<K extends string>(keys: readonly K[]): Ledger<K> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Ledger<K>;
}

function sumEssence(values: Record<Wuxing, number>): number {
  return ELEMENTS.reduce((total, wuxing) => total + values[wuxing], 0);
}

function towerStar(tower: Tower): number {
  return tower.casualStar ?? tower.naturalStar ?? 0;
}

/** 성어 글자를 중복까지 세어 전부 갖췄는가. */
function ownsIdiomChars(counts: Map<string, number>, chars: string): boolean {
  const need = new Map<string, number>();
  for (const char of chars) need.set(char, (need.get(char) ?? 0) + 1);
  for (const [char, amount] of need) if ((counts.get(char) ?? 0) < amount) return false;
  return true;
}

function probeAutoplay(seed: string, options: ProbeOptions, maxSeconds = 5_400): ProbeResult {
  const engine = new GameEngine(seed, options.region, options.mode);
  engine.begin();
  engine.setAutomationMode("semi");
  engine.setSummonIntent(options.intent);

  const goldIn = emptyLedger<GoldInKey>(["kill", "waveClear", "earlyStart", "interest", "goal", "evolutionGold", "sell"]);
  const goldOut = emptyLedger<GoldOutKey>(["summon", "tierSummon", "research", "globalUpgrade", "formation"]);
  const essenceIn = emptyLedger<EssenceInKey>(["dismantle", "refund"]);
  const essenceOut = emptyLedger<EssenceOutKey>(["elementUpgrade", "trait", "concentration"]);
  const summonStars = Array.from({ length: 9 }, () => 0);
  const dismantleStars = Array.from({ length: 9 }, () => 0);
  const fusionResultStars = Array.from({ length: 9 }, () => 0);
  let tierSummons = 0;
  let peakStar = 0;

  const drainEvents = (): GameEvent[] => engine.consumeEvents();

  /** 명시 호출 하나의 엽전·문기 변화를 이름표에 붙인다. */
  const meter = <T,>(
    label: { goldIn?: GoldInKey; goldOut?: GoldOutKey; essenceIn?: EssenceInKey; essenceOut?: EssenceOutKey },
    action: () => T
  ): T => {
    const goldBefore = engine.state.gold;
    const essenceBefore = sumEssence(engine.state.elementEssence);
    const outcome = action();
    const goldDelta = engine.state.gold - goldBefore;
    const essenceDelta = sumEssence(engine.state.elementEssence) - essenceBefore;
    // 목표 달성 보상은 소환·합성 호출 안에서 터진다. 먼저 떼어 내고 나머지를
    // 그 호출의 이름표에 붙여야 "소환에 얼마 썼나"가 상계되지 않는다.
    const events = drainEvents();
    let attributed = 0;
    for (const event of events) {
      if (event.type === "goal") { goldIn.goal += event.reward; attributed += event.reward; }
      else if (event.type === "interest") { goldIn.interest += event.amount; attributed += event.amount; }
      else if (event.type === "kill") { goldIn.kill += event.reward; attributed += event.reward; }
    }
    const residual = goldDelta - attributed;
    if (residual > 0 && label.goldIn) goldIn[label.goldIn] += residual;
    if (residual < 0 && label.goldOut) goldOut[label.goldOut] += -residual;
    if (essenceDelta > 0) essenceIn[label.essenceIn ?? "refund"] += essenceDelta;
    if (essenceDelta < 0 && label.essenceOut) essenceOut[label.essenceOut] += -essenceDelta;
    for (const event of events) {
      if (event.type === "summon") {
        const star = event.tower.naturalStar ?? 0;
        summonStars[star] = (summonStars[star] ?? 0) + 1;
      } else if (event.type === "dismantle") {
        const star = towerStar(event.tower);
        dismantleStars[star] = (dismantleStars[star] ?? 0) + 1;
      } else if (event.type === "casualFuse") {
        fusionResultStars[event.toStar] = (fusionResultStars[event.toStar] ?? 0) + 1;
        peakStar = Math.max(peakStar, event.toStar);
      }
    }
    return outcome;
  };

  const featured = engine.idioms();
  const assembleWave = new Map<string, number>();
  const assembledOnBoard = new Set<string>();

  let decisionCooldown = 0;
  let lastCleanupWave = -1;
  let lastReplacementWave = -1;

  while (engine.state.elapsed < maxSeconds && engine.state.phase !== "victory" && engine.state.phase !== "defeat") {
    const goldBefore = engine.state.gold;
    engine.update(0.1);
    let accounted = 0;
    for (const event of drainEvents()) {
      if (event.type === "kill") { goldIn.kill += event.reward; accounted += event.reward; }
      else if (event.type === "interest") { goldIn.interest += event.amount; accounted += event.amount; }
      else if (event.type === "goal") { goldIn.goal += event.reward; accounted += event.reward; }
    }
    const residual = engine.state.gold - goldBefore - accounted;
    if (residual > 0) goldIn.waveClear += residual;

    decisionCooldown -= 0.1;
    if (decisionCooldown > 0) continue;
    decisionCooldown = 0.22;

    // 성어 조립 기회: 판 + 인벤토리 보유 글자만 본다(배치는 자유롭게 바꿀 수 있다).
    const owned = new Map<string, number>();
    for (const tower of [...engine.state.towers, ...engine.state.inventoryTowers]) {
      owned.set(tower.char, (owned.get(tower.char) ?? 0) + 1);
    }
    const onBoard = new Map<string, number>();
    for (const tower of engine.state.towers) onBoard.set(tower.char, (onBoard.get(tower.char) ?? 0) + 1);
    for (const idiom of featured) {
      if (!assembleWave.has(idiom.id) && ownsIdiomChars(owned, idiom.chars)) assembleWave.set(idiom.id, engine.state.wave);
      if (!assembledOnBoard.has(idiom.id) && ownsIdiomChars(onBoard, idiom.chars)) assembledOnBoard.add(idiom.id);
    }

    if (engine.state.summonCount === 0) {
      meter({ goldOut: "summon" }, () => engine.summon());
      continue;
    }

    if (engine.state.mode === "standard") {
      let evolutionGuard = 0;
      while (evolutionGuard < 8) {
        const option = probeEvolutionOption(engine);
        if (!option) break;
        const evolved = meter({ goldIn: "evolutionGold" }, () => engine.evolve(option.recipeId).ok);
        if (!evolved) break;
        arrangeIdioms(engine, options.arrange);
        evolutionGuard += 1;
      }
    } else {
      for (const wuxing of ELEMENTS) {
        if (engine.casualAutoFusionPlan(wuxing).length > 0) meter({}, () => engine.autoFuseCasualElement(wuxing, true));
      }
    }

    let desiredResearch = 0;
    while (desiredResearch < 5 && engine.state.wave >= researchUnlockWave(desiredResearch)) desiredResearch += 1;
    const upgradeCost = researchCost(engine.state.researchLevel);
    if (engine.state.researchLevel < desiredResearch && upgradeCost > 0 && engine.state.gold >= upgradeCost + 24) {
      meter({ goldOut: "research" }, () => engine.upgradeResearch());
    }

    probePurchaseUpgrades(engine, meter);

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
      if (lockedFormation) meter({ goldOut: "formation" }, () => engine.unlockFormation(lockedFormation.index));
    }

    let attempts = 0;
    while (engine.state.towers.length < engine.deployedTowerCapacity() && engine.state.gold >= summonCost(engine.state.summonCount) && attempts < 12) {
      const tierIntent = options.tier ? affordableTierIntent(engine) : null;
      if (tierIntent) {
        tierSummons += 1;
        meter({ goldOut: "tierSummon" }, () => engine.summonProduct(tierIntent));
      } else {
        meter({ goldOut: "summon" }, () => engine.summon());
      }
      arrangeIdioms(engine, options.arrange);
      attempts += 1;
      const option = engine.state.mode === "standard" ? probeEvolutionOption(engine) : undefined;
      if (option) {
        meter({ goldIn: "evolutionGold" }, () => engine.evolve(option.recipeId));
        arrangeIdioms(engine, options.arrange);
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
        meter({ goldOut: "summon" }, () => engine.summon(true));
        surplusAttempts += 1;
      }
      engine.setAutoPlaceSummons(true);
      engine.setSummonIntent(options.intent);

      // 농축 상한이 없어졌다 — 중복 재료가 있는 자령이면 몇 단계든 더 올린다.
      const concentrationTarget = [...engine.state.towers]
        .filter((tower) => engine.state.inventoryTowers.some((candidate) => candidate.char === tower.char && !candidate.locked))
        .sort((left, right) => right.stage - left.stage || left.id - right.id)[0];
      if (concentrationTarget) {
        const duplicate = engine.state.inventoryTowers.find((tower) => tower.char === concentrationTarget.char && !tower.locked);
        if (duplicate) {
          const path = autoConcentrationPath(concentrationTarget);
          meter({ essenceOut: "concentration" }, () => engine.concentrateTower(concentrationTarget.id, path, { kind: "duplicate", towerId: duplicate.id }));
        }
      }

      const cleanupIds = engine.cleanupCandidates(8, true).map((candidate) => candidate.towerId);
      if (cleanupIds.length > 0) meter({ essenceIn: "dismantle" }, () => engine.dismantleTowers(cleanupIds));
      lastCleanupWave = engine.state.wave;
      probePurchaseUpgrades(engine, meter);
    }

    if (engine.state.towers.length >= engine.deployedTowerCapacity()
      && engine.availableEvolutions().length === 0
      && lastReplacementWave !== engine.state.wave) {
      const protectedChars = probeProtectedChars(engine);
      const disposable = [...engine.state.towers]
        .filter((tower) => !tower.locked && (tower.concentration ?? 0) === 0 && !protectedChars.has(tower.char))
        .sort((left, right) => {
          const leftRank = engine.state.mode === "casual" ? left.casualStar ?? 1 : left.stage;
          const rightRank = engine.state.mode === "casual" ? right.casualStar ?? 1 : right.stage;
          return leftRank - rightRank || left.id - right.id;
        })[0];
      if (disposable) {
        engine.selectTower(disposable.id);
        meter({ goldIn: "sell" }, () => engine.sellSelected());
        lastReplacementWave = engine.state.wave;
      }
    }

    if (engine.state.phase === "prep" && (engine.state.wave > 0 || engine.state.towers.length >= 5)) {
      meter({ goldIn: "earlyStart" }, () => engine.startWaveEarly());
    }
  }

  for (const tower of [...engine.state.towers, ...engine.state.inventoryTowers]) {
    peakStar = Math.max(peakStar, towerStar(tower));
  }

  return {
    seed,
    region: options.region,
    mode: options.mode,
    result: engine.state.phase === "victory" ? "victory" : engine.state.phase === "defeat" ? "defeat" : "timeout",
    wave: engine.state.wave,
    elapsedMinutes: Number((engine.state.elapsed / 60).toFixed(2)),
    summons: engine.state.summonCount,
    tierSummons,
    dismantles: engine.state.dismantledTowerCount,
    fusions: engine.state.casualFusionCount,
    evolutions: engine.state.evolutionCount,
    goals: engine.state.goalsCompleted.length,
    idioms: engine.state.idiomSeals.length,
    idiomAssembled: assembleWave.size,
    idiomAssembleWaves: [...assembleWave.values()].sort((left, right) => left - right),
    idiomAssembledOnBoard: assembledOnBoard.size,
    goldIn,
    goldOut,
    essenceIn,
    essenceOut,
    essenceGenerated: sumEssence(engine.state.elementEssenceGenerated),
    essenceSpent: sumEssence(engine.state.elementEssenceSpent),
    summonStars,
    dismantleStars,
    fusionResultStars,
    peakStar,
    elementUpgradeLevels: ELEMENTS.reduce((total, wuxing) =>
      total + UPGRADE_STAT_ORDER.reduce((sum, stat) => sum + engine.state.elementUpgrades[wuxing][stat], 0), 0),
    traitLevels: ELEMENTS.reduce((total, wuxing) => total + engine.state.elementTraits[wuxing].reduce((sum, level) => sum + level, 0), 0),
    researchLevel: engine.state.researchLevel,
    formations: engine.state.unlockedFormations.length,
    startingWuxing: engine.state.startingFormationIndex === null
      ? null
      : BOARD_FORMATIONS[engine.state.startingFormationIndex]?.preferredWuxing ?? null,
    endReason: engine.state.lastMessage
  };
}

/** 캐주얼 티어 소환을 살 여유가 있는가. 고급 우선, 다음이 중급. */
function affordableTierIntent(engine: GameEngine): "midstar" | "highstar" | null {
  if (engine.state.mode !== "casual") return null;
  const reserve = 12;
  for (const intent of ["highstar", "midstar"] as const) {
    if (!engine.isSummonProductAvailable(intent)) continue;
    if (engine.state.gold >= summonProductCost(engine.state.summonCount, intent) + reserve) return intent;
  }
  return null;
}

function arrangeIdioms(engine: GameEngine, mode: ProbeOptions["arrange"]): void {
  if (mode === "off") return;
  if (mode === "assist") {
    engine.autoArrangeTowers();
    return;
  }
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

function probeProtectedChars(engine: GameEngine): Set<string> {
  const protectedChars = engine.evolution.getTargetPath(engine.state.targetChar);
  const idiom = engine.currentIdiomTarget();
  if (!idiom) return protectedChars;
  for (const char of idiom.chars) {
    protectedChars.add(char);
    for (const pathChar of engine.evolution.getTargetPath(char)) protectedChars.add(pathChar);
  }
  return protectedChars;
}

function probeEvolutionOption(engine: GameEngine): EvolutionOption | undefined {
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

type Meter = <T>(
  label: { goldIn?: GoldInKey; goldOut?: GoldOutKey; essenceIn?: EssenceInKey; essenceOut?: EssenceOutKey },
  action: () => T
) => T;

function probePurchaseUpgrades(engine: GameEngine, meter: Meter): void {
  if (engine.state.towers.length >= 20 || engine.state.wave >= 8) {
    const stat = [...UPGRADE_STAT_ORDER].sort(
      (left, right) => engine.state.globalUpgrades[left] - engine.state.globalUpgrades[right]
    )[0];
    if (stat) {
      const level = engine.state.globalUpgrades[stat];
      const cost = globalUpgradeCost(stat, level);
      const reserve = Math.max(36, summonCost(engine.state.summonCount) * 4);
      if (cost > 0 && engine.state.gold >= cost + reserve) meter({ goldOut: "globalUpgrade" }, () => engine.upgradeGlobal(stat));
    }
  }

  for (const wuxing of ELEMENTS) {
    const unlockedTrait = [0, 1, 2]
      .filter((traitIndex) => engine.state.elementDismantleScore[wuxing] >= (elementTraitUnlockScore(traitIndex) ?? Infinity))
      .sort((left, right) => engine.elementTraitLevel(wuxing, left) - engine.elementTraitLevel(wuxing, right) || left - right)
      .find((traitIndex) => engine.elementTraitLevel(wuxing, traitIndex) < ELEMENT_TRAIT_MAX_LEVEL);
    if (unlockedTrait !== undefined) {
      const traitCost = elementTraitUpgradeCost(engine.elementTraitLevel(wuxing, unlockedTrait));
      if (traitCost !== null && engine.state.elementEssence[wuxing] >= traitCost) {
        meter({ essenceOut: "trait" }, () => engine.upgradeElementTrait(wuxing, unlockedTrait));
      }
      continue;
    }
    const stat = [...UPGRADE_STAT_ORDER].sort(
      (left, right) => engine.state.elementUpgrades[wuxing][left] - engine.state.elementUpgrades[wuxing][right]
    )[0];
    if (!stat) continue;
    const cost = elementUpgradeCost(engine.state.elementUpgrades[wuxing][stat]);
    if (cost > 0 && engine.state.elementEssence[wuxing] >= cost) {
      meter({ essenceOut: "elementUpgrade" }, () => engine.upgradeElement(wuxing, stat));
    }
  }
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function ledgerMeans<K extends string>(results: ProbeResult[], pick: (result: ProbeResult) => Ledger<K>): Record<K, number> {
  const keys = Object.keys(pick(results[0] as ProbeResult) ?? {}) as K[];
  return Object.fromEntries(keys.map((key) => [key, mean(results.map((result) => pick(result)[key]))])) as Record<K, number>;
}

function summarize(results: ProbeResult[]): Record<string, unknown> {
  const victories = results.filter((result) => result.result === "victory").length;
  const starTotals = (pick: (result: ProbeResult) => number[]): number[] =>
    Array.from({ length: 9 }, (_, star) => mean(results.map((result) => pick(result)[star] ?? 0)));
  return {
    runs: results.length,
    victoryRate: Number((victories / Math.max(1, results.length)).toFixed(3)),
    wave: { p10: percentile(results.map((result) => result.wave), 0.1), median: percentile(results.map((result) => result.wave), 0.5) },
    elapsedMinutesMedian: percentile(results.map((result) => result.elapsedMinutes), 0.5),
    summons: mean(results.map((result) => result.summons)),
    tierSummons: mean(results.map((result) => result.tierSummons)),
    dismantles: mean(results.map((result) => result.dismantles)),
    fusions: mean(results.map((result) => result.fusions)),
    evolutions: mean(results.map((result) => result.evolutions)),
    goals: mean(results.map((result) => result.goals)),
    idioms: { mean: mean(results.map((result) => result.idioms)), median: percentile(results.map((result) => result.idioms), 0.5) },
    idiomAssembled: {
      mean: mean(results.map((result) => result.idiomAssembled)),
      median: percentile(results.map((result) => result.idiomAssembled), 0.5),
      firstWaveMedian: percentile(results.flatMap((result) => result.idiomAssembleWaves), 0.5),
      onBoardMean: mean(results.map((result) => result.idiomAssembledOnBoard))
    },
    goldIn: ledgerMeans(results, (result) => result.goldIn),
    goldOut: ledgerMeans(results, (result) => result.goldOut),
    essenceIn: ledgerMeans(results, (result) => result.essenceIn),
    essenceOut: ledgerMeans(results, (result) => result.essenceOut),
    essence: {
      generatedMedian: percentile(results.map((result) => result.essenceGenerated), 0.5),
      spentMedian: percentile(results.map((result) => result.essenceSpent), 0.5)
    },
    summonStars: starTotals((result) => result.summonStars),
    dismantleStars: starTotals((result) => result.dismantleStars),
    fusionResultStars: starTotals((result) => result.fusionResultStars),
    peakStar: { median: percentile(results.map((result) => result.peakStar), 0.5), max: Math.max(0, ...results.map((result) => result.peakStar)) },
    elementUpgradeLevels: mean(results.map((result) => result.elementUpgradeLevels)),
    traitLevels: mean(results.map((result) => result.traitLevels)),
    researchLevel: mean(results.map((result) => result.researchLevel)),
    formations: mean(results.map((result) => result.formations))
  };
}

function runRange(start: number, count: number, options: ProbeOptions): ProbeResult[] {
  return Array.from({ length: count }, (_, offset) => {
    const index = start + offset;
    return probeAutoplay(`balance-${options.mode}-${options.region}-${String(index + 1).padStart(4, "0")}`, options);
  });
}

async function runParallel(runs: number, workers: number, options: ProbeOptions): Promise<ProbeResult[]> {
  const base = Math.floor(runs / workers);
  let remainder = runs % workers;
  let start = 0;
  const jobs: Array<Promise<ProbeResult[]>> = [];
  for (let index = 0; index < workers; index += 1) {
    const count = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    const payload: ProbeWorkerData = { start, count, options };
    start += count;
    jobs.push(new Promise((resolve_, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: payload });
      worker.once("message", (result: ProbeResult[]) => resolve_(result));
      worker.once("error", reject);
      worker.once("exit", (code) => { if (code !== 0) reject(new Error(`probe worker exited with ${code}`)); });
    }));
  }
  return (await Promise.all(jobs)).flat();
}

async function main(): Promise<void> {
  const options = readOptions();
  const runs = readRuns();
  const workers = readWorkers(runs);
  const results = workers === 1 ? runRange(0, runs, options) : await runParallel(runs, workers, options);
  const report = { options, runs, aggregate: summarize(results) };
  const serialized = JSON.stringify(report, null, 2) + "\n";
  const outArgument = readArgument("out");
  if (outArgument) {
    const root = fileURLToPath(new URL("../", import.meta.url));
    writeFileSync(isAbsolute(outArgument) ? outArgument : resolve(root, outArgument), serialized, "utf8");
  }
  process.stdout.write(serialized);
}

if (isMainThread) {
  await main();
} else {
  const payload = workerData as ProbeWorkerData;
  parentPort?.postMessage(runRange(payload.start, payload.count, payload.options));
}

// 참조 유지: 계측본이 출하 루프와 같은 엔진을 쓰는지 확인할 때 쓴다.
export { runAutoplay };
export type { CasualStar };
