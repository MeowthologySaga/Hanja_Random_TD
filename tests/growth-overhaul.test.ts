import { describe, expect, it } from "vitest";
import { BOARD_FORMATIONS, CELLS_PER_FORMATION } from "../src/core/content";
import {
  FIRST_PREP_SECONDS,
  GameEngine,
  autoConcentrationPath,
  concentrationEssenceCost,
  concentrationPathLabel,
  dismantleEssenceValue
} from "../src/core/game";
import { ELEMENT_TRAIT_COSTS } from "../src/core/growth";
import { STAGE_MULTIPLIERS, definitionForTower, elementUpgradeCost } from "../src/core/hanzi";
import { summonCost } from "../src/core/engine-tuning";
import type { Enemy, HanziDefinition, Tower } from "../src/core/types";

function towerFor(definition: HanziDefinition, id: number, cell: number, locked = false): Tower {
  return {
    id,
    definitionId: definition.id,
    char: definition.char,
    wuxing: definition.wuxing,
    stage: definition.stage,
    combatRole: definition.combat.role,
    graphRole: definition.graph.graphRole,
    cell,
    cooldownLeft: 0,
    pulse: 0,
    shotCount: 0,
    abilityFlash: 0,
    locked,
    concentration: 0,
    concentrationPath: null
  };
}

function safeDuplicateDefinition(engine: GameEngine): HanziDefinition {
  const protectedChars = engine.evolution.getTargetPath(engine.state.targetChar);
  for (const idiom of engine.idioms()) for (const char of idiom.chars) protectedChars.add(char);
  return engine.catalog.activePool.find((definition) => definition.stage === 1
    && definition.graph.directChildCount === 0
    && !protectedChars.has(definition.char)) as HanziDefinition;
}

describe("first summon formation onboarding", () => {
  it("starts with no formation and freezes both clocks until the first summon", () => {
    const engine = new GameEngine("first-freeze", "KR");
    engine.begin();
    expect(engine.state.unlockedFormations).toEqual([]);
    expect(engine.state.startingFormationIndex).toBeNull();
    expect(engine.state.prepRemaining).toBe(FIRST_PREP_SECONDS);
    for (let index = 0; index < 50; index += 1) engine.update(0.1);
    expect(engine.state.elapsed).toBe(0);
    expect(engine.state.prepRemaining).toBe(FIRST_PREP_SECONDS);
    expect(engine.startWaveEarly()).toMatchObject({ ok: false });
  });

  it("opens and places into the first Jaryeong's matching formation for free", () => {
    const engine = new GameEngine("first-formation", "KR");
    engine.begin();
    const goldBefore = engine.state.gold;
    expect(engine.summon()).toMatchObject({ ok: true });
    const tower = engine.state.towers[0] as Tower;
    const formationIndex = BOARD_FORMATIONS.findIndex((formation) => formation.preferredWuxing === tower.wuxing);
    expect(engine.state.startingFormationIndex).toBe(formationIndex);
    expect(engine.state.unlockedFormations).toEqual([formationIndex]);
    expect(Math.floor(tower.cell / CELLS_PER_FORMATION)).toBe(formationIndex);
    expect(engine.state.gold).toBe(goldBefore - summonCost(0));
    expect(engine.state.prepRemaining).toBe(FIRST_PREP_SECONDS);
    expect(engine.state.lastMessage).toContain(`${tower.wuxing} 자령 출현 → ${BOARD_FORMATIONS[formationIndex]?.label} 무료 개방`);
  });

  it("opens the matching formation but stores the first summon when auto-place is off", () => {
    const engine = new GameEngine("first-inventory", "KR");
    engine.begin();
    engine.setAutoPlaceSummons(false);
    expect(engine.summon()).toMatchObject({ ok: true });
    const tower = engine.state.inventoryTowers[0] as Tower;
    const formationIndex = BOARD_FORMATIONS.findIndex((formation) => formation.preferredWuxing === tower.wuxing);
    expect(engine.state.towers).toHaveLength(0);
    expect(tower.cell).toBe(-1);
    expect(engine.state.unlockedFormations).toEqual([formationIndex]);
  });

  it("charges the four remaining formations in 18, 32, 52, 78 order", () => {
    const engine = new GameEngine("formation-prices", "KR");
    engine.begin();
    engine.summon();
    engine.state.gold = 1_000;
    const costs = [18, 32, 52, 78];
    for (const expected of costs) {
      expect(engine.nextFormationUnlockCost()).toBe(expected);
      const index = BOARD_FORMATIONS.findIndex((_, candidate) => !engine.isFormationUnlocked(candidate));
      const goldBefore = engine.state.gold;
      expect(engine.unlockFormation(index)).toMatchObject({ ok: true });
      expect(engine.state.gold).toBe(goldBefore - expected);
    }
    expect(engine.nextFormationUnlockCost()).toBeNull();
  });
});

describe("safe dismantle, concentration, and element growth", () => {
  it("quotes and executes an inventory-only batch with protection, essence, and score", () => {
    const engine = new GameEngine("batch-dismantle", "KR");
    engine.begin();
    const definition = safeDuplicateDefinition(engine);
    const board = towerFor(definition, 100, 0);
    const eligible = towerFor(definition, 101, -1);
    const locked = towerFor(definition, 102, -1, true);
    engine.state.towers = [board];
    engine.state.inventoryTowers = [eligible, locked];

    const blocked = engine.quoteDismantle([eligible.id, locked.id]);
    expect(blocked.blocked).toHaveLength(1);
    expect(engine.dismantleTowers([eligible.id, locked.id])).toMatchObject({ ok: false });
    expect(engine.state.inventoryTowers).toHaveLength(2);

    const quote = engine.quoteDismantle([eligible.id]);
    expect(quote.gains[definition.wuxing]).toBe(dismantleEssenceValue(definition.stage));
    expect(quote.scoreGains[definition.wuxing]).toBe(1);
    expect(engine.dismantleTowers([eligible.id])).toMatchObject({ ok: true });
    expect(engine.state.elementEssence[definition.wuxing]).toBe(1);
    expect(engine.state.elementDismantleScore[definition.wuxing]).toBe(1);
    expect(engine.state.dismantledTowerCount).toBe(1);
    expect(engine.state.inventoryTowers.map((tower) => tower.id)).toEqual([locked.id]);
  });

  it("keeps sole-copy protection on by default and releases it only for the dismantle path", () => {
    const engine = new GameEngine("sole-copy-toggle", "KR");
    engine.begin();
    const definition = safeDuplicateDefinition(engine);
    const sole = towerFor(definition, 400, -1);
    engine.state.towers = [];
    engine.state.inventoryTowers = [sole];

    const guarded = engine.cleanupAssessments().find((assessment) => assessment.towerId === sole.id);
    expect(guarded?.soleCopy).toBe(true);
    expect(guarded?.protected).toBe(true);
    expect(guarded?.protectedReasons).toContain("유일 보유 한자");
    expect(engine.cleanupCandidates(8, true).map((candidate) => candidate.towerId)).not.toContain(sole.id);
    expect(engine.quoteDismantle([sole.id]).blocked).toHaveLength(1);
    expect(engine.dismantleTowers([sole.id])).toMatchObject({ ok: false });
    expect(engine.state.inventoryTowers).toHaveLength(1);

    const released = { protectUnique: false };
    const open = engine.cleanupAssessments(released).find((assessment) => assessment.towerId === sole.id);
    // 배지 근거는 남고 보호만 풀린다.
    expect(open?.soleCopy).toBe(true);
    expect(open?.protected).toBe(false);
    expect(open?.protectedReasons).not.toContain("유일 보유 한자");
    expect(engine.cleanupCandidates(8, true, released).map((candidate) => candidate.towerId)).toContain(sole.id);
    expect(engine.quoteDismantle([sole.id], released).blocked).toHaveLength(0);
    expect(engine.dismantleTowers([sole.id], released)).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.elementEssence[definition.wuxing]).toBe(dismantleEssenceValue(definition.stage));
  });

  it("still blocks locked and concentrated towers when sole-copy protection is off", () => {
    const engine = new GameEngine("sole-copy-other-guards", "KR");
    engine.begin();
    const definition = safeDuplicateDefinition(engine);
    const locked = towerFor(definition, 410, -1, true);
    const concentrated = { ...towerFor(definition, 411, -1), concentration: 1 as const, concentrationPath: "swift" as const };
    engine.state.towers = [];
    engine.state.inventoryTowers = [locked, concentrated];

    const released = { protectUnique: false };
    const assessments = new Map(engine.cleanupAssessments(released).map((assessment) => [assessment.towerId, assessment]));
    expect(assessments.get(locked.id)?.protectedReasons).toContain("잠금 자령");
    expect(assessments.get(concentrated.id)?.protectedReasons).toContain("농축 1단계 투자");
    expect(engine.dismantleTowers([locked.id, concentrated.id], released)).toMatchObject({ ok: false });
    expect(engine.state.inventoryTowers).toHaveLength(2);
  });

  it("requires an explicit duplicate or essence payment and permanently fixes the first path", () => {
    const engine = new GameEngine("explicit-concentration", "KR");
    engine.begin();
    const definition = safeDuplicateDefinition(engine);
    const target = towerFor(definition, 200, 0);
    const duplicate = towerFor(definition, 201, -1);
    const lockedDuplicate = towerFor(definition, 202, -1, true);
    const deployedDuplicate = towerFor(definition, 203, 1);
    engine.state.towers = [target, deployedDuplicate];
    engine.state.inventoryTowers = [duplicate, lockedDuplicate];

    const quote = engine.concentrationQuote(target.id, "swift");
    expect(quote?.duplicateIds).toEqual([duplicate.id]);
    expect(quote?.next.damage).toBeGreaterThan(quote?.current.damage ?? Infinity);
    expect(quote?.next.attacksPerSecond).toBeGreaterThan(quote?.current.attacksPerSecond ?? Infinity);
    expect(quote?.next.range).toBeGreaterThan(quote?.current.range ?? Infinity);
    expect(engine.concentrateTower(target.id, "swift", { kind: "duplicate", towerId: deployedDuplicate.id })).toMatchObject({ ok: false });
    expect(engine.concentrateTower(target.id, "swift", { kind: "duplicate", towerId: duplicate.id })).toMatchObject({ ok: true });
    expect(target.concentrationPath).toBe("swift");
    expect(target.concentration).toBe(1);
    expect(engine.state.inventoryTowers.map((tower) => tower.id)).toEqual([lockedDuplicate.id]);
    engine.state.elementEssence[target.wuxing] = concentrationEssenceCost(1);
    expect(engine.concentrateTower(target.id, "potent", { kind: "essence" })).toMatchObject({ ok: false });
    expect(engine.concentrateTower(target.id, "swift", { kind: "essence" })).toMatchObject({ ok: true });
    expect(target.concentration).toBe(2);
  });

  it("derives the concentration direction from the combat role instead of asking", () => {
    const engine = new GameEngine("auto-concentration-path", "KR");
    engine.begin();
    const definition = safeDuplicateDefinition(engine);

    // 초당 타수로 먹고사는 역할은 공속(swift).
    for (const role of ["rapid", "support"] as const) {
      const tower = { ...towerFor(definition, 300, 0), combatRole: role };
      expect(autoConcentrationPath(tower)).toBe("swift");
    }
    // 한 방으로 먹고사는 나머지는 피해(potent).
    for (const role of ["burst", "splash", "control", "economy"] as const) {
      const tower = { ...towerFor(definition, 301, 0), combatRole: role };
      expect(autoConcentrationPath(tower)).toBe("potent");
    }
    // 이미 박힌 방향은 역할과 어긋나도 유지된다(기존 세이브 일관성).
    expect(autoConcentrationPath({ combatRole: "rapid", concentrationPath: "potent" })).toBe("potent");
    expect(concentrationPathLabel("swift")).toBe("공속 농축");
    expect(concentrationPathLabel("potent")).toBe("피해 농축");
  });

  it("concentrates a selected tower on its role direction with no branch prompt", () => {
    const engine = new GameEngine("role-concentration", "KR");
    engine.begin();
    const definition = safeDuplicateDefinition(engine);
    const rapid = { ...towerFor(definition, 310, 0), combatRole: "rapid" as const };
    const burst = { ...towerFor(definition, 311, 1), combatRole: "burst" as const };
    engine.state.towers = [rapid, burst];
    engine.state.inventoryTowers = [];
    engine.state.elementEssence[definition.wuxing] = concentrationEssenceCost(0) * 2;

    engine.selectTower(rapid.id);
    expect(engine.concentrateSelected()).toMatchObject({ ok: true });
    expect(rapid.concentrationPath).toBe("swift");
    expect(engine.state.lastMessage).toContain("공속 농축");

    engine.selectTower(burst.id);
    expect(engine.concentrateSelected()).toMatchObject({ ok: true });
    expect(burst.concentrationPath).toBe("potent");
    expect(engine.state.lastMessage).toContain("피해 농축");
  });

  it("quotes the true cumulative cost up to level 99 and spends it in one transaction", () => {
    const engine = new GameEngine("max-upgrade", "KR");
    engine.begin();
    engine.state.elementEssence.木 = 1_000_000;
    const expectedCost = Array.from({ length: 99 }, (_, level) => elementUpgradeCost(level)).reduce((sum, cost) => sum + cost, 0);
    const quote = engine.quoteElementUpgrade("木", "damage", "max");
    expect(quote).toMatchObject({ fromLevel: 0, toLevel: 99, levels: 99, cost: expectedCost, affordable: true });
    expect(engine.upgradeElement("木", "damage", "max")).toMatchObject({ ok: true });
    expect(engine.state.elementUpgrades.木.damage).toBe(99);
    expect(engine.state.elementEssenceSpent.木).toBe(expectedCost);
  });

  it("unlocks traits by dismantle score, caps them at ten, and applies the live zone effect", () => {
    const engine = new GameEngine("trait-growth", "KR");
    engine.begin();
    engine.state.elementEssence.水 = 1_000;
    expect(engine.upgradeElementTrait("水", 0)).toMatchObject({ ok: false });
    engine.state.elementDismantleScore.水 = 5;
    const expectedCost = ELEMENT_TRAIT_COSTS.reduce((sum, cost) => sum + cost, 0);
    expect(engine.quoteElementTraitUpgrade("水", 0, "max")).toMatchObject({ levels: 10, cost: expectedCost });
    expect(engine.upgradeElementTrait("水", 0, "max")).toMatchObject({ ok: true });
    expect(engine.elementTraitLevel("水", 0)).toBe(10);
    expect(engine.upgradeElementTrait("水", 0)).toMatchObject({ ok: false });

    const definition = engine.catalog.activePool.find((candidate) => candidate.wuxing === "水") as HanziDefinition;
    const tower = towerFor(definition, 300, 0);
    const enemy: Enemy = {
      id: 1, wave: 1, char: "天", hp: 100, maxHp: 100, speed: 1, progress: 0.3, reward: 1, boss: false,
      archetype: "normal", weakness: "木", armor: 0, regenPerSecond: 0, slowFactor: 1, slowUntil: 0,
      stunnedUntil: 0, poisonDps: 0, poisonUntil: 0, flash: 0
    };
    const invokeZone = (engine as unknown as { deployElementZone: (source: Tower, target: Enemy, damage: number, potency: number, abilityPower: number) => unknown }).deployElementZone.bind(engine);
    engine.state.elementTraits.水[0] = 0;
    invokeZone(tower, enemy, 100, 1, 1);
    const baseRadius = engine.state.abilityZones[0]?.radius ?? 0;
    engine.state.abilityZones = [];
    engine.state.elementTraits.水[0] = 10;
    invokeZone(tower, enemy, 100, 1, 1);
    expect(engine.state.abilityZones[0]?.radius).toBeCloseTo(baseRadius * 1.2, 5);
    expect(definitionForTower(engine.catalog, tower.definitionId).combat.baseDamage * STAGE_MULTIPLIERS[tower.stage]).toBeGreaterThan(0);
  });
});
