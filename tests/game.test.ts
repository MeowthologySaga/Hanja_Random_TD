import { describe, expect, it } from "vitest";
import { MAX_ENEMIES, WAVE_REINFORCEMENT_DELAY } from "../src/core/content";
import { GameEngine, dismantleEssenceValue, interestForGold, runAutoplay } from "../src/core/game";
import {
  elementUpgradeCost,
  getCatalog,
  globalUpgradeCost,
  maxSummonStageForWave,
  researchUnlockWave,
  summonStageUnlockWave
} from "../src/core/hanzi";
import { multiSummonCost } from "../src/core/engine-tuning";
import type { Enemy, RegionCode, Tower } from "../src/core/types";

function tower(region: RegionCode, char: string, id: number, cell: number): Tower {
  const definition = getCatalog(region).definitions.get(char);
  if (!definition) throw new Error("Missing test character " + region + ":" + char);
  return {
    id,
    definitionId: definition.id,
    char,
    wuxing: definition.wuxing,
    stage: definition.stage,
    combatRole: definition.combat.role,
    graphRole: definition.graph.graphRole,
    cell,
    cooldownLeft: 0,
    pulse: 0,
    shotCount: 0,
    abilityFlash: 0,
    locked: false
  };
}

function enemy(id: number): Enemy {
  return {
    id,
    wave: 1,
    char: "天",
    hp: 10,
    maxHp: 10,
    speed: 0,
    progress: 0,
    reward: 1,
    boss: false,
    archetype: "normal",
    weakness: "木",
    armor: 0,
    regenPerSecond: 0,
    slowFactor: 1,
    slowUntil: 0,
    stunnedUntil: 0,
    poisonDps: 0,
    poisonUntil: 0,
    flash: 0
  };
}

function unlockFormations(engine: GameEngine, ...indices: number[]): void {
  engine.state.summonCount = Math.max(1, engine.state.summonCount);
  engine.state.startingFormationIndex ??= 2;
  engine.state.unlockedFormations = [...new Set([2, ...indices])].sort((left, right) => left - right);
}

function enableWaveStart(engine: GameEngine): void {
  engine.state.summonCount = Math.max(1, engine.state.summonCount);
  engine.state.startingFormationIndex ??= 2;
  if (engine.state.unlockedFormations.length === 0) engine.state.unlockedFormations = [2];
}

describe("regional recipe defense run", () => {
  it("calculates capped five-percent bank interest", () => {
    expect(interestForGold(0)).toBe(0);
    expect(interestForGold(19)).toBe(0);
    expect(interestForGold(20)).toBe(1);
    expect(interestForGold(100)).toBe(5);
    expect(interestForGold(1_000)).toBe(20);
  });

  it("calculates and performs an atomic ten-summon using the current escalating costs", () => {
    expect(multiSummonCost(0, 10)).toBe(70);
    expect(multiSummonCost(18, 10)).toBe(84);
    const engine = new GameEngine("ten-summon", "KR");
    engine.begin();
    engine.state.wave = 10;
    engine.state.gold = 70;
    expect(engine.summonMany(10)).toMatchObject({ ok: true });
    expect(engine.state.gold).toBe(0);
    expect(engine.state.summonCount).toBe(10);
    expect(engine.state.towers).toHaveLength(10);
    expect(engine.consumeEvents().filter((event) => event.type === "summon")).toHaveLength(10);

    const poor = new GameEngine("ten-summon-poor", "KR");
    poor.begin();
    poor.state.wave = 10;
    poor.state.gold = 69;
    expect(poor.summonMany(10)).toMatchObject({ ok: false, message: "연속 소환에 엽전 70이 필요합니다." });
    expect(poor.state.towers).toHaveLength(0);
    expect(poor.state.summonCount).toBe(0);

    const manual = new GameEngine("ten-summon-inventory", "KR");
    manual.setAutoPlaceSummons(false);
    manual.begin();
    manual.state.wave = 10;
    manual.state.gold = 70;
    expect(manual.summonMany(10)).toMatchObject({ ok: true });
    expect(manual.state.towers).toHaveLength(0);
    expect(manual.state.inventoryTowers).toHaveLength(10);

    /*
     * 10연의 웨이브 자물쇠는 걷었다 — 값이 이미 문지기다(시작 42엽전 · 10연 70).
     * 첫 웨이브에도 값만 치르면 통하고, 막히는 사유는 엽전 부족 하나뿐이다.
     */
    const early = new GameEngine("ten-summon-early", "KR");
    early.begin();
    early.state.gold = 70;
    expect(early.state.wave).toBeLessThan(10);
    expect(early.summonMany(10)).toMatchObject({ ok: true });

    const broke = new GameEngine("ten-summon-broke", "KR");
    broke.begin();
    broke.state.gold = 0;
    expect(broke.summonMany(10)).toMatchObject({ ok: false, message: expect.stringContaining("엽전") });
  });

  it("opens summon stages and lineage research only at their 100-wave milestones", () => {
    expect([0, 9, 10, 29, 30, 49, 50, 69, 70, 100].map(maxSummonStageForWave)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(([1, 2, 3, 4, 5] as const).map(summonStageUnlockWave)).toEqual([0, 10, 30, 50, 70]);
    expect([0, 1, 2, 3, 4].map(researchUnlockWave)).toEqual([10, 25, 45, 65, 85]);

    const engine = new GameEngine("research-milestones", "KR");
    engine.begin();
    engine.state.gold = 1_000;
    expect(engine.upgradeResearch()).toMatchObject({ ok: false, message: expect.stringContaining("10웨이브") });
    engine.state.wave = 10;
    expect(engine.upgradeResearch()).toMatchObject({ ok: true });
    expect(engine.state.researchLevel).toBe(1);
    expect(engine.upgradeResearch()).toMatchObject({ ok: false, message: expect.stringContaining("25웨이브") });
  });

  it("lets the player buy any sealed elemental formation with escalating coins", () => {
    const engine = new GameEngine("formation-shop", "KR");
    engine.begin();
    expect(engine.state.unlockedFormations).toEqual([]);
    expect(engine.unlockFormation(4)).toMatchObject({ ok: false, message: expect.stringContaining("첫 자령") });
    expect(engine.summon()).toMatchObject({ ok: true });
    expect(engine.deployedTowerCapacity()).toBe(16);
    expect(engine.nextFormationUnlockCost()).toBe(18);
    const lockedIndex = [4, 3, 2, 1, 0].find((index) => !engine.isFormationUnlocked(index)) as number;
    const lockedLabel = ["수진", "금진", "토진", "목진", "화진"][lockedIndex];
    expect(engine.unlockFormation(lockedIndex)).toMatchObject({ ok: true, message: expect.stringContaining(`${lockedLabel} 해금`) });
    expect(engine.state.gold).toBe(17);
    expect(engine.state.unlockedFormations).toHaveLength(2);
    expect(engine.deployedTowerCapacity()).toBe(32);
    expect(engine.nextFormationUnlockCost()).toBe(32);
    const nextLockedIndex = [0, 1, 2, 3, 4].find((index) => !engine.isFormationUnlocked(index)) as number;
    expect(engine.unlockFormation(nextLockedIndex)).toMatchObject({ ok: false, message: expect.stringContaining("32") });
    engine.state.gold = 32;
    expect(engine.unlockFormation(nextLockedIndex)).toMatchObject({ ok: true });
    expect(engine.deployedTowerCapacity()).toBe(48);
  });

  it("guarantees a lineage clue on pull 12 and the chosen direct target on pull 30", () => {
    const clue = new GameEngine("lineage-clue-guarantee", "KR");
    clue.setAutoPlaceSummons(false);
    clue.begin();
    clue.state.gold = 1_000;
    clue.setTarget("林");
    clue.setSummonIntent("lineage");
    clue.state.lineageClueProgress = 11;
    expect(clue.summon()).toMatchObject({ ok: true });
    expect(clue.state.inventoryTowers.at(-1)?.char).toBe("木");
    expect(clue.state.lineageClueProgress).toBe(0);

    const exact = new GameEngine("lineage-target-guarantee", "KR");
    exact.setAutoPlaceSummons(false);
    exact.begin();
    exact.state.gold = 1_000;
    exact.setTarget("天");
    exact.setSummonIntent("lineage");
    exact.state.lineageTargetProgress = 29;
    expect(exact.summon()).toMatchObject({ ok: true });
    expect(exact.state.inventoryTowers.at(-1)?.char).toBe("天");
    expect(exact.state.lineageClueProgress).toBe(0);
    expect(exact.state.lineageTargetProgress).toBe(0);
  });

  it("splits repeatable gold and elemental essence upgrades by stat", () => {
    // FB7-강화: 전역 비용 2차항 완화(/12 → /20). 4단계부터 1엽전씩 싸진다.
    expect([0, 1, 2, 3, 4].map((level) => globalUpgradeCost("damage", level))).toEqual([16, 19, 22, 25, 28]);
    expect([0, 1, 5, 6, 12].map(elementUpgradeCost)).toEqual([1, 1, 1, 2, 3]);
    const engine = new GameEngine("element-upgrades", "KR");
    engine.begin();
    engine.state.gold = 1_000;
    engine.state.elementEssence["木"] = 20;
    expect(engine.upgradeGlobal("damage")).toMatchObject({ ok: true });
    expect(engine.state.globalUpgrades.damage).toBe(1);
    expect(engine.globalUpgradeBonus("damage")).toBeCloseTo(0.0125);
    expect(engine.state.gold).toBe(984);
    expect(engine.upgradeElement("木", "attackSpeed")).toMatchObject({ ok: true });
    expect(engine.state.elementUpgrades["木"].attackSpeed).toBe(1);
    expect(engine.state.elementUpgrades["火"].attackSpeed).toBe(0);
    expect(engine.elementUpgradeBonus("木", "attackSpeed")).toBeCloseTo(0.008);
    expect(engine.state.elementEssence["木"]).toBe(19);
    expect(engine.consumeEvents()).toContainEqual({ type: "statUpgrade", scope: "element", wuxing: "木", stat: "attackSpeed", level: 1, cost: 1, bonus: 0.008 });
    engine.state.elementUpgrades["木"].attackSpeed = 99;
    expect(engine.upgradeElement("木", "attackSpeed")).toMatchObject({ ok: false, message: "木행 공격 속도 강화가 최고 단계입니다." });
  });

  it("uses the expanded eighty-enemy loss limit", () => {
    expect(MAX_ENEMIES).toBe(80);
  });

  it("grants the gate-opening range ward to the starting formation for waves 1-3 only", () => {
    // 수술 8 ⓑ: 무작위 첫 진이 경로에서 멀어도 "다 돌 때까지 기다림"이 없게 한다.
    const engine = new GameEngine("gate-opening", "KR");
    engine.begin();
    expect(engine.summon()).toMatchObject({ ok: true });
    const tower = engine.state.towers[0] as Tower;
    expect(engine.gateOpeningRangeBonus(tower)).toBe(45);
    // 다른 진의 자령과 인벤토리 자령은 받지 못한다.
    const foreignCell = ((engine.state.startingFormationIndex ?? 0) + 1) % 5 * 16;
    expect(engine.gateOpeningRangeBonus({ ...tower, cell: foreignCell })).toBe(0);
    expect(engine.gateOpeningRangeBonus({ ...tower, cell: -1 })).toBe(0);
    // 4웨이브부터는 사라진다.
    engine.state.wave = 4;
    expect(engine.gateOpeningRangeBonus(tower)).toBe(0);
  });

  it("replays the same weighted summon sequence from the same seed", () => {
    const first = new GameEngine("replay-77", "KR");
    const second = new GameEngine("replay-77", "KR");
    first.begin();
    second.begin();
    for (let index = 0; index < 6; index += 1) {
      expect(first.summon().ok).toBe(true);
      expect(second.summon().ok).toBe(true);
    }
    expect(first.state.towers.map(({ char, cell }) => ({ char, cell }))).toEqual(
      second.state.towers.map(({ char, cell }) => ({ char, cell }))
    );
  });

  it("opens the complete thousand-character Korean pool while keeping onboarding summons at stage one", () => {
    const engine = new GameEngine("cheonjamun-1000-pool", "KR");
    const pool = engine.summonDefinitions();
    expect(pool).toHaveLength(1000);
    expect(new Set(pool.map((definition) => definition.char)).size).toBe(1000);
    expect(pool.map((definition) => definition.char)).toEqual(expect.arrayContaining(["天", "地", "玄", "黃"]));
    engine.begin();
    for (let index = 0; index < 4; index += 1) expect(engine.summon()).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(4);
    expect(engine.state.towers.every((unit) => unit.stage === 1)).toBe(true);
  });

  it("tracks a chosen direct Hanja or idiom and can force a newly integrated Hanja from the pool", () => {
    const engine = new GameEngine("owned-aware-targets", "KR");
    engine.setAutoPlaceSummons(false);
    engine.begin();
    expect(engine.setTarget("天")).toMatchObject({ ok: true });
    expect(engine.state.targetChar).toBe("天");
    engine.state.discoveredChars = engine.summonDefinitions().filter((definition) => definition.char !== "天").map((definition) => definition.char);
    expect(engine.setSummonIntent("discovery")).toMatchObject({ ok: true });
    expect(engine.summon(true)).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers.at(-1)?.char).toBe("天");
    expect(engine.state.goalsCompleted).toContain("天");

    const currentId = engine.currentIdiomTarget()?.id;
    const desired = engine.allIdioms().find((idiom) => idiom.id !== currentId);
    expect(desired).toBeDefined();
    expect(engine.setIdiomTarget(desired!.id)).toMatchObject({ ok: true });
    expect(engine.currentIdiomTarget()?.id).toBe(desired!.id);
    expect(engine.idiomProgress(desired!.id)).toMatchObject({ total: 4 });
  });

  // 트랙 B(gripe #3): 목표 서책 전면 통합 — 성어 복수 추적.
  it("tracks up to three idioms at once and refuses to drop the last one (Track B)", () => {
    const engine = new GameEngine("idiom-multi-tracking", "KR");
    engine.begin();
    // 승계: 시작 추적은 기존 "현재 성어 목표"였던 첫 목표 성어 1구다.
    expect(engine.trackedIdioms().map((idiom) => idiom.id)).toEqual([engine.state.featuredIdiomIds[0]]);
    const first = engine.state.featuredIdiomIds[0] as string;
    const extras = engine.allIdioms().filter((idiom) => idiom.id !== first).slice(0, 3);
    expect(engine.setIdiomTracking(extras[0]!.id, true)).toMatchObject({ ok: true });
    expect(engine.setIdiomTracking(extras[1]!.id, true)).toMatchObject({ ok: true });
    expect(engine.trackedIdioms()).toHaveLength(3);
    expect(engine.setIdiomTracking(extras[2]!.id, true)).toMatchObject({ ok: false, message: expect.stringContaining("최대 3") });
    // 추적한 성어는 발동 판정 대상인 이번 런 목표 다섯 구에도 편입된다.
    expect(engine.state.featuredIdiomIds).toContain(extras[0]!.id);
    expect(engine.state.featuredIdiomIds).toContain(extras[1]!.id);
    // 최소 1개 유지 — 마지막 한 구는 해제할 수 없다.
    expect(engine.setIdiomTracking(extras[1]!.id, false)).toMatchObject({ ok: true });
    expect(engine.setIdiomTracking(extras[0]!.id, false)).toMatchObject({ ok: true });
    expect(engine.trackedIdioms().map((idiom) => idiom.id)).toEqual([first]);
    expect(engine.setIdiomTracking(first, false)).toMatchObject({ ok: false, message: expect.stringContaining("최소 1개") });
  });

  it("retires sealed idioms from tracking and inherits the next featured goal (Track B)", () => {
    const engine = new GameEngine("idiom-tracking-inherit", "KR");
    engine.begin();
    const [first, second] = engine.state.featuredIdiomIds;
    engine.state.idiomSeals.push({ idiomId: first as string, cells: [0, 1, 2, 3], completedAt: 0, active: true });
    // 추적 목록의 봉인 구는 걸러지고, 비면 다음 미봉인 목표 성어가 승계된다.
    expect(engine.trackedIdioms().map((idiom) => idiom.id)).toEqual([second]);
    expect(engine.currentIdiomTarget()?.id).toBe(second);
    // 발동한 성어는 다시 추적할 수 없다.
    expect(engine.setIdiomTracking(first as string, true)).toMatchObject({ ok: false, message: expect.stringContaining("발동") });
  });

  it("feeds the union of tracked idioms' missing characters into forced lineage summons (Track B)", () => {
    const engine = new GameEngine("idiom-union-weighting", "KR", "casual");
    engine.setAutoPlaceSummons(false);
    engine.begin();
    const heaven = engine.allIdioms().find((idiom) => idiom.chars === "天地玄黃");
    expect(heaven).toBeDefined();
    expect(engine.setIdiomTracking(heaven!.id, true)).toMatchObject({ ok: true });
    const missing = engine.trackedIdiomMissingChars();
    for (const char of "天地玄黃") expect(missing.has(char)).toBe(true);
    // 보유하면 부족 글자에서 빠진다 — 연구·소환 가중은 아직 없는 글자로만 향한다.
    engine.state.inventoryTowers.push(tower("KR", "天", 9_101, -1));
    expect(engine.trackedIdiomMissingChars().has("天")).toBe(false);
    // 강제 계보 소환은 목표 한자와 추적 성어 부족 글자의 합집합 안에서만 낸다.
    const union = new Set([...engine.trackedIdiomMissingChars(), engine.state.targetChar]);
    engine.state.gold = 1_000;
    expect(engine.setSummonIntent("lineage")).toMatchObject({ ok: true });
    expect(engine.summon(true)).toMatchObject({ ok: true });
    expect(union.has(engine.state.inventoryTowers.at(-1)?.char ?? "")).toBe(true);
  });

  it("makes a chosen Hanja materially more likely in the thousand-character pool", () => {
    let balancedHeaven = 0;
    let focusedHeaven = 0;
    for (let index = 0; index < 80; index += 1) {
      const seed = `target-weight-${index}`;
      const balanced = new GameEngine(seed, "KR");
      balanced.begin();
      expect(balanced.summon()).toMatchObject({ ok: true });
      if (balanced.state.towers[0]?.char === "天") balancedHeaven += 1;

      const focused = new GameEngine(seed, "KR");
      focused.begin();
      focused.setTarget("天");
      focused.setSummonIntent("lineage");
      expect(focused.summon()).toMatchObject({ ok: true });
      if (focused.state.towers[0]?.char === "天") focusedHeaven += 1;
    }
    expect(focusedHeaven).toBeGreaterThanOrEqual(12);
    expect(focusedHeaven).toBeGreaterThan(balancedHeaven + 10);
  });

  it("preserves duplicate parents and consumes two different 木 towers", () => {
    const engine = new GameEngine("duplicate-parent", "KR");
    engine.begin();
    engine.setTarget("林");
    engine.state.towers = [tower("KR", "木", 101, 0), tower("KR", "木", 102, 4), tower("KR", "目", 103, 8)];
    const option = engine.availableEvolutions().find((candidate) => candidate.result.char === "林");
    expect(option?.parents).toEqual(["木", "木"]);
    expect(new Set(option?.materialTowerIds).size).toBe(2);
    expect(engine.evolve(option?.recipeId ?? "")).toMatchObject({ ok: true });
    expect(engine.state.towers.map((unit) => unit.char).sort()).toEqual(["林", "目"]);
  });

  it("builds the CN critical regression chain 文+刀→刘 and 水+刘→浏", () => {
    const engine = new GameEngine("cn-regression", "CN");
    engine.begin();
    engine.state.towers = [tower("CN", "文", 201, 0), tower("CN", "刀", 202, 1), tower("CN", "水", 203, 2)];
    const liu = engine.availableEvolutions().find((candidate) => candidate.result.char === "刘");
    expect(liu?.parents).toEqual(["文", "刀"]);
    expect(engine.evolve(liu?.recipeId ?? "").ok).toBe(true);
    const liuResult = engine.state.towers.find((unit) => unit.char === "刘");
    expect(liuResult).toMatchObject({ definitionId: "CN:刘", stage: 2 });
    const liuWater = engine.availableEvolutions().find((candidate) => candidate.result.char === "浏");
    expect(liuWater?.parents).toEqual(["水", "刘"]);
    expect(engine.evolve(liuWater?.recipeId ?? "").ok).toBe(true);
    expect(engine.state.towers.find((unit) => unit.char === "浏")).toMatchObject({ definitionId: "CN:浏", stage: 3, wuxing: "水" });
  });

  it("keeps regional glyph identities separate", () => {
    expect(getCatalog("KR").definitions.get("木")?.id).toBe("KR:木");
    expect(getCatalog("JP").definitions.get("木")?.id).toBe("JP:木");
    expect(getCatalog("CN").definitions.get("木")?.id).toBe("CN:木");
    expect(getCatalog("CN").definitions.get("刘")?.id).toBe("CN:刘");
    expect(getCatalog("KR").definitions.get("木")?.id).not.toBe(getCatalog("CN").definitions.get("木")?.id);
  });

  it("uses occupied cells for selection and empty cells for movement", () => {
    const engine = new GameEngine("move-case", "KR");
    engine.begin();
    unlockFormations(engine, 0);
    engine.state.towers = [tower("KR", "木", 7, 0), tower("KR", "目", 8, 1)];
    engine.selectTower(7);
    expect(engine.moveSelectedToCell(5)).toMatchObject({ ok: true });
    expect(engine.state.towers.find((unit) => unit.id === 7)?.cell).toBe(5);
    expect(engine.moveSelectedToCell(1)).toMatchObject({ ok: true });
    expect(engine.state.selectedTowerId).toBe(8);
  });

  it("keeps automatic placement on by default", () => {
    const engine = new GameEngine("auto-place-default", "KR");
    engine.begin();
    expect(engine.state.autoPlaceSummons).toBe(true);
    expect(engine.summon()).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(1);
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.towers[0]?.cell).toBeGreaterThanOrEqual(0);
  });

  it("stores manual summons and deploys the selected inventory unit into an exact empty cell", () => {
    const engine = new GameEngine("manual-place", "KR");
    engine.setAutoPlaceSummons(false);
    engine.begin();
    expect(engine.summon()).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(0);
    expect(engine.state.inventoryTowers).toHaveLength(1);
    expect(engine.state.inventoryTowers[0]?.cell).toBe(-1);
    expect(engine.state.selectedTowerId).toBe(engine.state.inventoryTowers[0]?.id);

    const storedId = engine.state.inventoryTowers[0]?.id ?? -1;
    engine.selectTower(storedId);
    const targetCell = (engine.state.startingFormationIndex ?? 0) * 16 + 5;
    expect(engine.moveSelectedToCell(targetCell)).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.towers).toHaveLength(1);
    expect(engine.state.towers[0]).toMatchObject({ id: storedId, cell: targetCell });
  });

  it("atomically swaps a stored unit into an occupied board cell", () => {
    const engine = new GameEngine("inventory-atomic-swap", "KR");
    engine.begin();
    unlockFormations(engine, 0);
    engine.state.towers = [tower("KR", "木", 601, 0)];
    engine.state.inventoryTowers = [tower("KR", "目", 602, -1)];
    engine.selectTower(602);

    expect(engine.moveSelectedToCell(0)).toMatchObject({ ok: true });
    expect(engine.state.towers).toContainEqual(expect.objectContaining({ id: 602, char: "目", cell: 0 }));
    expect(engine.state.inventoryTowers).toContainEqual(expect.objectContaining({ id: 601, char: "木", cell: -1 }));
  });

  it("keeps accepting post-cap summons beyond the former 80-slot bench limit", () => {
    const engine = new GameEngine("unbounded-stacked-bench", "KR");
    engine.setAutoPlaceSummons(false);
    engine.begin();
    engine.state.wave = 100;
    engine.state.gold = 1_000_000;
    expect(engine.summonMany(90)).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers).toHaveLength(90);
  });

  it("guarantees a remaining undiscovered character for a forced discovery pull", () => {
    const engine = new GameEngine("discovery-intent", "KR");
    engine.setAutoPlaceSummons(false);
    engine.begin();
    engine.state.gold = 1_000;
    const pool = engine.summonDefinitions();
    const finalUnknown = pool.at(-1)?.char;
    expect(finalUnknown).toBeDefined();
    engine.state.discoveredChars = pool.slice(0, -1).map((definition) => definition.char);
    engine.setSummonIntent("discovery");
    expect(engine.summon(true)).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers.at(-1)?.char).toBe(finalUnknown);
  });

  it("concentrates with an exact inventory duplicate before spending element essence", () => {
    const engine = new GameEngine("exact-concentration", "KR");
    engine.begin();
    engine.state.towers = [tower("KR", "木", 701, 0)];
    engine.state.inventoryTowers = [tower("KR", "木", 702, -1)];
    engine.selectTower(701);

    expect(engine.concentrateSelected("swift")).toMatchObject({ ok: true });
    expect(engine.state.towers[0]).toMatchObject({ concentration: 1, concentrationPath: "swift" });
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.elementEssence.木).toBe(0);
  });

  it("dismantles weak units into their element essence and protects resonance thresholds", () => {
    const engine = new GameEngine("cleanup-protection", "KR");
    engine.begin();
    unlockFormations(engine, 0);
    engine.state.towers = Array.from({ length: 4 }, (_, index) => tower("KR", "雨", 800 + index, index));
    const assessments = engine.cleanupAssessments();
    expect(assessments.every((assessment) => assessment.protectedReasons.some((reason) => reason.includes("공명 임계치")))).toBe(true);

    engine.state.inventoryTowers = [tower("KR", "火", 900, -1), tower("KR", "火", 901, -1)];
    engine.selectTower(901);
    expect(engine.dismantleSelected()).toMatchObject({ ok: true });
    expect(engine.state.elementEssence.火).toBe(dismantleEssenceValue(engine.catalog.definitions.get("火")!.stage));
    expect(engine.state.inventoryTowers).toHaveLength(1);
  });

  it("returns a deployed unit to the run inventory without granting board effects", () => {
    const engine = new GameEngine("return-to-inventory", "KR");
    engine.begin();
    engine.state.towers = [tower("KR", "木", 501, 0)];
    engine.selectTower(501);
    expect(engine.storeSelectedTower()).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(0);
    expect(engine.state.inventoryTowers).toHaveLength(1);
    expect(engine.state.inventoryTowers[0]).toMatchObject({ id: 501, cell: -1 });
    expect(engine.formationResonance(0).matching).toBe(0);
  });

  it("automatically stores summons when the board is full even with automatic placement on", () => {
    const engine = new GameEngine("full-board-manual", "KR");
    engine.begin();
    engine.state.gold = 1_000_000;
    const base = engine.catalog.activePool[0];
    expect(base).toBeDefined();
    engine.state.towers = Array.from({ length: 80 }, (_, index) => tower("KR", base!.char, 900 + index, index));
    expect(engine.summon()).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(80);
    expect(engine.state.inventoryTowers).toHaveLength(1);
  });

  it("fills the remaining board cells before sending ten-summon overflow to inventory", () => {
    const engine = new GameEngine("full-board-ten-overflow", "KR");
    engine.begin();
    engine.state.wave = 100;
    unlockFormations(engine, 0, 1, 3, 4);
    engine.state.gold = 1_000_000;
    const base = engine.catalog.activePool[0];
    expect(base).toBeDefined();
    engine.state.towers = Array.from({ length: 78 }, (_, index) => tower("KR", base!.char, 1_100 + index, index));
    engine.consumeEvents();

    expect(engine.summonMany(10)).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(80);
    expect(engine.state.inventoryTowers).toHaveLength(8);
    const summonEvents = engine.consumeEvents().filter((event) => event.type === "summon");
    expect(summonEvents).toHaveLength(10);
    expect(summonEvents.filter((event) => event.stored)).toHaveLength(8);
  });

  it("protects locked towers from evolution and return", () => {
    const engine = new GameEngine("lock-case", "KR");
    engine.begin();
    engine.setTarget("林");
    engine.state.towers = [tower("KR", "木", 301, 0), tower("KR", "木", 302, 1), tower("KR", "木", 303, 2)];
    engine.selectTower(301);
    expect(engine.toggleSelectedLock()).toMatchObject({ ok: true });
    expect(engine.state.towers[0]?.locked).toBe(true);
    expect(engine.sellSelected()).toMatchObject({ ok: false });
    const option = engine.availableEvolutions().find((candidate) => candidate.result.char === "林");
    expect(option?.materialTowerIds.sort()).toEqual([302, 303]);
    expect(engine.evolve(option?.recipeId ?? "")).toMatchObject({ ok: true });
    expect(engine.state.towers.some((unit) => unit.id === 301 && unit.locked)).toBe(true);
  });

  it("previews derivative synthesis with board and inventory material locations", () => {
    const engine = new GameEngine("derivative-preview", "KR");
    engine.begin();
    engine.setTarget("林");
    engine.state.towers = [tower("KR", "木", 401, 7)];
    engine.state.inventoryTowers = [tower("KR", "木", 402, -1)];
    engine.selectTower(401);

    const branch = engine.compositionBranchesForSelected().find((candidate) => candidate.result.char === "林");
    expect(branch).toMatchObject({ parents: ["木", "木"], ready: true });
    expect(branch?.materials.map((material) => material.location)).toEqual(["board", "inventory"]);
    expect(branch?.materialTowerIds).toEqual([401, 402]);
  });

  it("consumes inventory materials for synthesis and keeps the result at a board material cell", () => {
    const engine = new GameEngine("mixed-synthesis", "KR");
    engine.begin();
    engine.setTarget("林");
    engine.state.towers = [tower("KR", "木", 411, 12)];
    engine.state.inventoryTowers = [tower("KR", "木", 412, -1)];
    engine.selectTower(411);

    const recipe = engine.compositionBranchesForSelected().find((candidate) => candidate.result.char === "林");
    expect(engine.evolve(recipe?.recipeId ?? "")).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.towers).toHaveLength(1);
    expect(engine.state.towers[0]).toMatchObject({ char: "林", cell: 12 });
  });

  it("stores a synthesis result when every material came from inventory", () => {
    const engine = new GameEngine("inventory-synthesis", "KR");
    engine.begin();
    engine.setTarget("林");
    engine.state.towers = [];
    engine.state.inventoryTowers = [tower("KR", "木", 421, -1), tower("KR", "木", 422, -1)];
    engine.selectTower(421);

    const recipe = engine.compositionBranchesForSelected().find((candidate) => candidate.result.char === "林");
    expect(engine.evolve(recipe?.recipeId ?? "")).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(0);
    expect(engine.state.inventoryTowers).toHaveLength(1);
    expect(engine.state.inventoryTowers[0]).toMatchObject({ char: "林", cell: -1 });
  });

  it("raises each elemental formation bonus at 4, 8, 12, and 16 matching towers", () => {
    const engine = new GameEngine("formation-resonance", "KR");
    engine.begin();
    engine.state.wave = 100;
    unlockFormations(engine, 0, 1, 3, 4);
    const water = engine.catalog.activePool.find((definition) => definition.wuxing === "水");
    expect(water).toBeDefined();
    engine.state.towers = Array.from({ length: 16 }, (_, index) => tower("KR", water!.char, 700 + index, index));
    expect(engine.formationResonance(0)).toEqual({ matching: 16, tier: 4, damageBonus: 0.25 });
    engine.state.towers.length = 8;
    expect(engine.formationResonance(0)).toEqual({ matching: 8, tier: 2, damageBonus: 0.12 });
    engine.state.towers.length = 4;
    expect(engine.formationResonance(0)).toEqual({ matching: 4, tier: 1, damageBonus: 0.06 });
  });

  it("auto-arranges deployed towers into their matching elemental formations", () => {
    const engine = new GameEngine("auto-arrange-elements", "KR");
    engine.begin();
    engine.state.wave = 100;
    unlockFormations(engine, 0, 1, 3, 4);
    const water = engine.catalog.activePool.find((definition) => definition.wuxing === "水");
    const fire = engine.catalog.activePool.find((definition) => definition.wuxing === "火");
    expect(water).toBeDefined();
    expect(fire).toBeDefined();
    engine.state.towers = [
      ...Array.from({ length: 4 }, (_, index) => tower("KR", water!.char, 1_100 + index, 64 + index)),
      ...Array.from({ length: 4 }, (_, index) => tower("KR", fire!.char, 1_200 + index, index))
    ];

    expect(engine.autoArrangeTowers()).toMatchObject({ ok: true });
    expect(engine.formationResonance(0)).toMatchObject({ matching: 4, tier: 1 });
    expect(engine.formationResonance(4)).toMatchObject({ matching: 4, tier: 1 });
    expect(new Set(engine.state.towers.map((unit) => unit.cell)).size).toBe(engine.state.towers.length);
    expect(engine.state.lastMessage).toContain("오행 공명 0→2단계");
  });

  it("deploys run-inventory towers into empty cells before auto-arranging the board", () => {
    const engine = new GameEngine("auto-arrange-inventory", "KR");
    engine.begin();
    unlockFormations(engine);
    engine.state.towers = [tower("KR", "木", 1_300, 0)];
    engine.state.inventoryTowers = [
      tower("KR", "目", 1_301, -1),
      tower("KR", "火", 1_302, -1),
      tower("KR", "水", 1_303, -1)
    ];

    expect(engine.autoArrangeTowers()).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(4);
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.towers.every((unit) => unit.cell >= 0)).toBe(true);
    expect(new Set(engine.state.towers.map((unit) => unit.cell)).size).toBe(4);
    expect(engine.state.lastMessage).toContain("가방 3기 투입");
  });

  it("can auto-arrange directly from an inventory-only board state", () => {
    const engine = new GameEngine("auto-arrange-inventory-only", "KR");
    engine.begin();
    unlockFormations(engine);
    engine.state.inventoryTowers = [tower("KR", "木", 1_310, -1), tower("KR", "目", 1_311, -1)];

    expect(engine.autoArrangeTowers()).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(2);
    expect(engine.state.inventoryTowers).toHaveLength(0);
  });

  it("fills all eighty formation cells while prioritizing unseen Hanja", () => {
    const engine = new GameEngine("full-board-diversity", "KR");
    engine.begin();
    engine.state.wave = 100;
    unlockFormations(engine, 0, 1, 3, 4);
    engine.state.gold = 1_000_000;
    for (let index = 0; index < 80; index += 1) expect(engine.summon().ok).toBe(true);

    expect(engine.state.towers).toHaveLength(80);
    expect(new Set(engine.state.towers.map((unit) => unit.cell)).size).toBe(80);
    expect(engine.state.discoveredChars.length).toBeGreaterThanOrEqual(50);
    expect(engine.summon()).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers).toHaveLength(1);
  });

  it("ends the run when the active enemy limit is reached", () => {
    const engine = new GameEngine("enemy-cap", "KR");
    engine.begin();
    enableWaveStart(engine);
    engine.startWaveEarly();
    engine.state.spawned = engine.getCurrentPlan()?.count ?? 0;
    engine.state.enemies = Array.from({ length: MAX_ENEMIES }, (_, index) => enemy(index + 1));
    engine.update(0.01);
    expect(engine.state.phase).toBe("defeat");
    expect(engine.state.lastMessage).toContain(String(MAX_ENEMIES));
    // FB3: 종료 화면이 문자열이 아니라 이 원인 값으로 사유를 표기한다.
    expect(engine.state.defeatCause).toBe("enemy-limit");
  });

  it("keeps surviving enemies on the same route for another lap", () => {
    const engine = new GameEngine("circulation-case", "KR");
    engine.begin();
    enableWaveStart(engine);
    engine.startWaveEarly();
    const loopingEnemy = enemy(900);
    loopingEnemy.progress = 0.99;
    loopingEnemy.speed = 1;
    loopingEnemy.hp = loopingEnemy.maxHp = 1_000_000;
    engine.state.spawned = engine.getCurrentPlan()?.count ?? 0;
    engine.state.enemies = [loopingEnemy];

    engine.update(0.1);
    expect(engine.state.phase).toBe("combat");
    expect(engine.state.enemies).toHaveLength(1);
    expect(engine.state.enemies[0]?.progress).toBeGreaterThan(1);
  });

  it("starts the next wave on schedule while surviving enemies keep circulating", () => {
    const engine = new GameEngine("reinforcement-pressure", "KR");
    engine.begin();
    enableWaveStart(engine);
    engine.startWaveEarly();
    const survivor = enemy(901);
    survivor.hp = survivor.maxHp = 1_000_000;
    engine.state.spawned = engine.getCurrentPlan()?.count ?? 0;
    engine.state.enemies = [survivor];
    engine.state.nextWaveRemaining = 0.05;
    engine.state.gold = 95;

    engine.update(0.1);

    expect(engine.state.phase).toBe("combat");
    expect(engine.state.wave).toBe(2);
    expect(engine.state.enemies).toContain(survivor);
    expect(engine.state.nextWaveRemaining).toBeNull();
    expect(engine.state.lastMessage).toContain("잔존 1체");
    expect(engine.state.gold).toBe(99);
    expect(engine.state.interestEarned).toBe(4);
    expect(engine.state.lastMessage).toContain("은행 이자 +4엽전");
    expect(engine.consumeEvents()).toContainEqual({ type: "interest", amount: 4, gold: 99 });
    expect(WAVE_REINFORCEMENT_DELAY).toBe(20);
  });

  it("adds the clear reward before calculating end-of-wave bank interest", () => {
    const engine = new GameEngine("clear-interest", "KR");
    engine.begin();
    enableWaveStart(engine);
    engine.startWaveEarly();
    engine.state.gold = 95;
    engine.state.spawned = engine.getCurrentPlan()?.count ?? 0;
    engine.state.enemies = [];

    engine.update(0.01);

    expect(engine.state.phase).toBe("prep");
    expect(engine.state.gold).toBe(108);
    expect(engine.state.interestEarned).toBe(5);
    expect(engine.state.lastMessage).toContain("보상 8엽전 · 은행 이자 +5엽전");
    expect(engine.consumeEvents()).toContainEqual({ type: "interest", amount: 5, gold: 108 });
  });

  it("ends a boss wave when the boss timer expires", () => {
    const engine = new GameEngine("boss-timeout", "KR");
    engine.begin();
    enableWaveStart(engine);
    engine.state.wave = 9;
    expect(engine.startWaveEarly()).toMatchObject({ ok: true });
    expect(engine.bossTimeRemaining()).toBe(72);
    engine.state.waveElapsed = 71.95;
    engine.update(0.1);
    expect(engine.state.phase).toBe("defeat");
    expect(engine.state.lastMessage).toContain("72초");
    expect(engine.state.defeatCause).toBe("boss-timeout");
  });

  it("ends with the Cheonjamun great seal only after clearing wave 100", () => {
    const engine = new GameEngine("hundred-wave-ending", "KR");
    engine.begin();
    enableWaveStart(engine);
    engine.state.wave = 99;
    expect(engine.startWaveEarly()).toMatchObject({ ok: true });
    expect(engine.state.wave).toBe(100);
    expect(engine.getCurrentPlan()?.boss).toBe(true);
    engine.state.spawned = engine.getCurrentPlan()?.count ?? 0;
    engine.state.enemies = [];
    engine.state.bossDefeated = true;
    engine.update(0.01);
    expect(engine.state.phase).toBe("victory");
    expect(engine.state.lastMessage).toContain("백 번째 봉인");
    expect(engine.state.lastMessage).toContain("천자문");
  });

  it("starts the next wave and grants the early-start bonus", () => {
    const engine = new GameEngine("early-case", "JP");
    engine.begin();
    enableWaveStart(engine);
    const before = engine.state.gold;
    expect(engine.startWaveEarly().ok).toBe(true);
    expect(engine.state.phase).toBe("combat");
    expect(engine.state.wave).toBe(1);
    expect(engine.state.gold).toBe(before + 7);
    expect(engine.state.interestEarned).toBe(0);
  });

  // 3지역 x 5,400틱 자동주행 — 유휴 8~9초, 부하 시 16초+. 10초 상한이 빠듯했다.
  it("settles automated runs in every region without an infinite loop", () => {
    for (const region of ["KR", "JP", "CN"] as const) {
      const result = runAutoplay("smoke-" + region, region, 5_400);
      expect(result.result).not.toBe("timeout");
      expect(result.region).toBe(region);
    }
  }, 30_000);
});
