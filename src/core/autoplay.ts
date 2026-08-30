/*
 * 시뮬레이션 자동 조작 봇.
 *
 * `GameEngine` 의 공개 API 만 써서 한 판을 끝까지 돌린다. 밸런스 조사와
 * 결정성 회귀에 쓰이며, 게임 실행 경로에는 들어가지 않는다.
 */
import { BOARD_FORMATIONS, FORMATION_COLUMNS, FORMATION_ROWS } from "./content";
import { autoConcentrationPath, MAX_CONCENTRATION_LEVEL, sumElementValues, summonCost } from "./engine-tuning";
import { GameEngine } from "./game";
import { ELEMENT_TRAIT_MAX_LEVEL, elementTraitUnlockScore, elementTraitUpgradeCost } from "./growth";
import {
  elementUpgradeCost,
  globalUpgradeCost,
  researchCost,
  researchUnlockWave,
  UPGRADE_STAT_ORDER
} from "./hanzi";
import {
  type EvolutionOption,
  type GameMode,
  type RegionCode,
  type SimulationCheckpoint,
  type SimulationResult,
  type Tower,
  type Wuxing
} from "./types";

/**
 * [실험 · 트랙 F] 봇 정책 스위치. 기본은 전부 끔 — 게이트 시뮬(--runs=135/45)은
 * 옵션 없이 돌므로 시드 결정성과 기존 수치가 그대로 재현된다.
 */
export interface AutoplayOptions {
  /** 성어 기원 상품을 봇이 사게 한다(승률 비영향 계측용 실험 정책). */
  idiomWish?: boolean;
}

export function runAutoplay(seed: string, region: RegionCode = "KR", maxSeconds = 5_400, mode: GameMode = "standard", options: AutoplayOptions = {}): SimulationResult {
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

    // [실험 · 트랙 F] 성어 기원 구매 정책: 부족 글자가 있고 기본 소환 2회분의
    // 예산 여유가 남을 때만 산다. 틱당 최대 2장 — 소환·강화 예산 잠식을 막는
    // 단순 상한이다. 산 뒤에는 기존 성어 정렬 루틴이 줄 세우기를 이어받는다.
    if (options.idiomWish) {
      for (let wishGuard = 0; wishGuard < 2; wishGuard += 1) {
        const wish = engine.idiomWishQuote();
        if (wish.reason !== null || engine.state.gold < wish.cost + summonCost(engine.state.summonCount) * 2) break;
        if (!engine.summonIdiomWish().ok) break;
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
  // 추적 성어(기본 1구 — 봇은 추적을 넓히지 않으므로 기존 동작과 같다)의
  // 글자와 그 합성 계보를 소모 후보에서 지킨다.
  for (const idiom of engine.trackedIdioms()) {
    for (const char of idiom.chars) {
      protectedChars.add(char);
      for (const pathChar of engine.evolution.getTargetPath(char)) protectedChars.add(pathChar);
    }
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
  // 아직 줄이 없는(혹은 흩어진) 성어의 글자도 지킨다 — 재발동 재료다.
  const pendingIdioms = engine.idioms().filter((candidate) => !engine.isIdiomSealActive(candidate.id));
  if (pendingIdioms.length === 0) return options.find((candidate) => candidate.onTargetPath) ?? options[0];
  const exactChars = new Set(pendingIdioms.flatMap((candidate) => [...candidate.chars]));
  const idiomPath = new Set<string>();
  for (const tracked of engine.trackedIdioms()) {
    for (const char of tracked.chars) for (const pathChar of engine.evolution.getTargetPath(char)) idiomPath.add(pathChar);
  }
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
    // 흩어진 기록(비활성 봉인)도 다시 세울 대상이다 — 재발동하면 보너스가 돌아온다.
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
