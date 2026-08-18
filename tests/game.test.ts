import { describe, expect, it } from "vitest";
import { MAX_ENEMIES, WAVE_REINFORCEMENT_DELAY } from "../src/core/content";
import { GameEngine, dismantleEssenceValue, interestForGold, runAutoplay } from "../src/core/game";
import { elementUpgradeCost, getCatalog, multiSummonCost } from "../src/core/hanzi";
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

describe("regional recipe defense run", () => {
  it("calculates one coin of bank interest for every ten held coins", () => {
    expect(interestForGold(0)).toBe(0);
    expect(interestForGold(9)).toBe(0);
    expect(interestForGold(10)).toBe(1);
    expect(interestForGold(19)).toBe(1);
    expect(interestForGold(100)).toBe(10);
  });

  it("calculates and performs an atomic ten-summon using the current escalating costs", () => {
    expect(multiSummonCost(0, 10)).toBe(60);
    expect(multiSummonCost(18, 10)).toBe(68);
    const engine = new GameEngine("ten-summon", "KR");
    engine.begin();
    expect(engine.summonMany(10)).toMatchObject({ ok: true });
    expect(engine.state.gold).toBe(4);
    expect(engine.state.summonCount).toBe(10);
    expect(engine.state.towers).toHaveLength(10);
    expect(engine.consumeEvents().filter((event) => event.type === "summon")).toHaveLength(10);

    const poor = new GameEngine("ten-summon-poor", "KR");
    poor.begin();
    poor.state.gold = 59;
    expect(poor.summonMany(10)).toMatchObject({ ok: false, message: "연속 소환에 엽전 60이 필요합니다." });
    expect(poor.state.towers).toHaveLength(0);
    expect(poor.state.summonCount).toBe(0);

    const manual = new GameEngine("ten-summon-inventory", "KR");
    manual.setAutoPlaceSummons(false);
    manual.begin();
    expect(manual.summonMany(10)).toMatchObject({ ok: true });
    expect(manual.state.towers).toHaveLength(0);
    expect(manual.state.inventoryTowers).toHaveLength(10);
  });

  it("upgrades each element independently up to five levels", () => {
    expect([0, 1, 2, 3, 4].map(elementUpgradeCost)).toEqual([24, 42, 60, 78, 96]);
    const engine = new GameEngine("element-upgrades", "KR");
    engine.begin();
    engine.state.gold = 1_000;
    expect(engine.upgradeElement("木")).toMatchObject({ ok: true });
    expect(engine.state.elementUpgrades).toMatchObject({ "木": 1, "火": 0, "土": 0, "金": 0, "水": 0 });
    expect(engine.elementDamageBonus("木")).toBeCloseTo(0.08);
    expect(engine.state.gold).toBe(976);
    expect(engine.consumeEvents()).toContainEqual({ type: "elementUpgrade", wuxing: "木", level: 1, cost: 24, damageBonus: 0.08 });
    for (let level = 1; level < 5; level += 1) expect(engine.upgradeElement("木").ok).toBe(true);
    expect(engine.elementDamageBonus("木")).toBeCloseTo(0.4);
    expect(engine.upgradeElement("木")).toMatchObject({ ok: false, message: "木행 강화가 최고 단계입니다." });
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
    expect(engine.state.selectedTowerId).toBeNull();

    const storedId = engine.state.inventoryTowers[0]?.id ?? -1;
    engine.selectTower(storedId);
    expect(engine.moveSelectedToCell(37)).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.towers).toHaveLength(1);
    expect(engine.state.towers[0]).toMatchObject({ id: storedId, cell: 37 });
  });

  it("atomically swaps a stored unit into an occupied board cell", () => {
    const engine = new GameEngine("inventory-atomic-swap", "KR");
    engine.begin();
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

  it("fills all eighty formation cells while prioritizing unseen Hanja", () => {
    const engine = new GameEngine("full-board-diversity", "KR");
    engine.begin();
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
    engine.startWaveEarly();
    engine.state.spawned = engine.getCurrentPlan()?.count ?? 0;
    engine.state.enemies = Array.from({ length: MAX_ENEMIES }, (_, index) => enemy(index + 1));
    engine.update(0.01);
    expect(engine.state.phase).toBe("defeat");
    expect(engine.state.lastMessage).toContain(String(MAX_ENEMIES));
  });

  it("keeps surviving enemies on the same route for another lap", () => {
    const engine = new GameEngine("circulation-case", "KR");
    engine.begin();
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
    expect(engine.state.gold).toBe(104);
    expect(engine.state.interestEarned).toBe(9);
    expect(engine.state.lastMessage).toContain("은행 이자 +9엽전");
    expect(engine.consumeEvents()).toContainEqual({ type: "interest", amount: 9, gold: 104 });
    expect(WAVE_REINFORCEMENT_DELAY).toBe(16);
  });

  it("adds the clear reward before calculating end-of-wave bank interest", () => {
    const engine = new GameEngine("clear-interest", "KR");
    engine.begin();
    engine.startWaveEarly();
    engine.state.gold = 95;
    engine.state.spawned = engine.getCurrentPlan()?.count ?? 0;
    engine.state.enemies = [];

    engine.update(0.01);

    expect(engine.state.phase).toBe("prep");
    expect(engine.state.gold).toBe(119);
    expect(engine.state.interestEarned).toBe(10);
    expect(engine.state.lastMessage).toContain("보상 14엽전 · 은행 이자 +10엽전");
    expect(engine.consumeEvents()).toContainEqual({ type: "interest", amount: 10, gold: 119 });
  });

  it("ends a boss wave when the boss timer expires", () => {
    const engine = new GameEngine("boss-timeout", "KR");
    engine.begin();
    engine.state.wave = 9;
    expect(engine.startWaveEarly()).toMatchObject({ ok: true });
    expect(engine.bossTimeRemaining()).toBe(60);
    engine.state.waveElapsed = 59.95;
    engine.update(0.1);
    expect(engine.state.phase).toBe("defeat");
    expect(engine.state.lastMessage).toContain("60초");
  });

  it("starts the next wave and grants the early-start bonus", () => {
    const engine = new GameEngine("early-case", "JP");
    engine.begin();
    const before = engine.state.gold;
    expect(engine.startWaveEarly().ok).toBe(true);
    expect(engine.state.phase).toBe("combat");
    expect(engine.state.wave).toBe(1);
    expect(engine.state.gold).toBe(before + 4);
    expect(engine.state.interestEarned).toBe(0);
  });

  it("settles automated runs in every region without an infinite loop", () => {
    for (const region of ["KR", "JP", "CN"] as const) {
      const result = runAutoplay("smoke-" + region, region, 1_200);
      expect(result.result).not.toBe("timeout");
      expect(result.region).toBe(region);
    }
  });
});
