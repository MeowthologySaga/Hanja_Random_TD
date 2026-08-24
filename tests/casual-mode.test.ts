import { describe, expect, it } from "vitest";
import {
  CASUAL_STAR_BINS,
  CASUAL_STAR_POWER,
  CASUAL_STROKE_SOURCE,
  casualNaturalStar,
  casualStrokeCount
} from "../src/core/casual";
import { GameEngine } from "../src/core/game";
import type { CasualStar, HanziDefinition, Tower, Wuxing } from "../src/core/types";

function casualTower(definition: HanziDefinition, id: number, cell: number, star = casualNaturalStar(definition.char)): Tower {
  if (star === null) throw new Error(`Missing casual star for ${definition.char}`);
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
    locked: false,
    concentration: 0,
    concentrationPath: null,
    naturalStar: casualNaturalStar(definition.char) ?? undefined,
    casualStar: star
  };
}

function sameElementStarDefinitions(engine: GameEngine, count = 3): HanziDefinition[] {
  const grouped = new Map<string, HanziDefinition[]>();
  for (const definition of engine.catalog.activePool) {
    const star = casualNaturalStar(definition.char);
    if (star === null || star >= 8) continue;
    const key = `${definition.wuxing}:${star}`;
    const group = grouped.get(key) ?? [];
    group.push(definition);
    grouped.set(key, group);
    if (group.length >= count) return group.slice(0, count);
  }
  throw new Error("No casual fusion fixture found");
}

describe("casual eight-star mode", () => {
  it("maps all 1000 Cheonjamun glyphs into a strictly descending stroke pyramid", () => {
    expect(CASUAL_STROKE_SOURCE.total).toBe(1000);
    expect(CASUAL_STAR_BINS.map((bin) => bin.count)).toEqual([332, 252, 167, 105, 68, 33, 25, 18]);
    expect(CASUAL_STAR_BINS.every((bin, index, bins) => index === 0 || bin.count < (bins[index - 1]?.count ?? Infinity))).toBe(true);
    expect(casualStrokeCount("鬱")).toBe(29);
    expect(casualNaturalStar("鬱")).toBe(8);
    expect(casualStrokeCount("天")).toBe(4);
    expect(casualNaturalStar("天")).toBe(1);
  });

  it("keeps casual mode KR-only and summons from the full natural-star pool", () => {
    expect(() => new GameEngine("casual-jp", "JP", "casual")).toThrow(/한국/);
    const engine = new GameEngine("casual-summons", "KR", "casual");
    engine.setAutoPlaceSummons(false);
    engine.begin();
    engine.state.gold = 2_000;
    for (let index = 0; index < 40; index += 1) expect(engine.summon()).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers).toHaveLength(40);
    expect(engine.state.inventoryTowers.every((tower) => tower.naturalStar === casualNaturalStar(tower.char))).toBe(true);
    expect(engine.state.inventoryTowers.every((tower) => tower.casualStar === tower.naturalStar)).toBe(true);
    expect(engine.availableEvolutions()).toEqual([]);
  });

  it("retains the selected core, consumes exactly two matching materials, and raises one star", () => {
    const engine = new GameEngine("casual-manual-fusion", "KR", "casual");
    engine.begin();
    const [coreDefinition, firstMaterialDefinition, secondMaterialDefinition] = sameElementStarDefinitions(engine);
    const fromStar = casualNaturalStar(coreDefinition?.char ?? "") as CasualStar;
    const core = casualTower(coreDefinition as HanziDefinition, 101, 0, fromStar);
    const firstMaterial = casualTower(firstMaterialDefinition as HanziDefinition, 102, -1, fromStar);
    const secondMaterial = casualTower(secondMaterialDefinition as HanziDefinition, 103, -1, fromStar);
    core.locked = true;
    engine.state.towers = [core];
    engine.state.inventoryTowers = [firstMaterial, secondMaterial];

    const quote = engine.casualFusionQuote(core.id, [firstMaterial.id, secondMaterial.id]);
    expect(quote.blocked).toEqual([]);
    expect(quote.warnings.length).toBeGreaterThan(0);
    expect(engine.fuseCasual(core.id, [firstMaterial.id, secondMaterial.id])).toMatchObject({ ok: false, message: expect.stringContaining("확인") });
    expect(engine.fuseCasual(core.id, [firstMaterial.id, secondMaterial.id], true)).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(1);
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.towers[0]?.id).toBe(core.id);
    expect(engine.state.towers[0]?.locked).toBe(true);
    expect(engine.state.towers[0]?.casualStar).toBe(fromStar + 1);
    expect(engine.state.casualFusionCount).toBe(1);
    expect(engine.consumeEvents().some((event) => event.type === "casualFuse")).toBe(true);
  });

  it("blocks mismatched or locked materials and never consumes them", () => {
    const engine = new GameEngine("casual-blocks", "KR", "casual");
    engine.begin();
    const [first, second, third] = sameElementStarDefinitions(engine);
    const star = casualNaturalStar(first?.char ?? "") as CasualStar;
    const core = casualTower(first as HanziDefinition, 201, -1, star);
    const locked = casualTower(second as HanziDefinition, 202, -1, star);
    const other = casualTower(third as HanziDefinition, 203, -1, star);
    locked.locked = true;
    engine.state.inventoryTowers = [core, locked, other];
    expect(engine.fuseCasual(core.id, [locked.id, other.id], true)).toMatchObject({ ok: false, message: expect.stringContaining("잠겨") });
    expect(engine.state.inventoryTowers).toHaveLength(3);
    other.casualStar = (star === 7 ? 6 : star + 1) as CasualStar;
    locked.locked = false;
    expect(engine.fuseCasual(core.id, [locked.id, other.id], true)).toMatchObject({ ok: false, message: expect.stringContaining("별") });
    expect(engine.state.inventoryTowers).toHaveLength(3);
  });

  it("uses a locked keeper as the auto-fusion core while materials remain explicit in the preview", () => {
    const engine = new GameEngine("casual-element-auto", "KR", "casual");
    engine.begin();
    const parentChars = new Set(engine.catalog.recipes.flatMap((definition) => definition.parents));
    const targetPath = engine.evolution.getTargetPath(engine.state.targetChar);
    const idiomChars = new Set(engine.idioms().flatMap((idiom) => [...idiom.chars]));
    const grouped = new Map<string, HanziDefinition[]>();
    for (const definition of engine.catalog.activePool) {
      const star = casualNaturalStar(definition.char);
      if (star === null || star >= 8 || parentChars.has(definition.char) || targetPath.has(definition.char) || idiomChars.has(definition.char)) continue;
      const key = `${definition.wuxing}:${star}`;
      const group = grouped.get(key) ?? [];
      group.push(definition);
      grouped.set(key, group);
    }
    const definitions = [...grouped.values()].find((group) => group.length >= 3)?.slice(0, 3);
    if (!definitions) throw new Error("No safe auto-fusion fixture found");
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const towers = definitions.map((definition, index) => casualTower(definition, 301 + index, -1, star));
    const keeper = towers[0] as Tower;
    keeper.locked = true;
    engine.state.inventoryTowers = towers;
    const wuxing = keeper.wuxing as Wuxing;

    const plan = engine.casualAutoFusionPlan(wuxing);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.coreId).toBe(keeper.id);
    expect(plan[0]?.materialIds).toHaveLength(2);
    expect(plan[0]?.materialIds).not.toContain(keeper.id);
    expect(engine.autoFuseCasualElement(wuxing, true)).toMatchObject({ ok: true });
    expect(engine.state.inventoryTowers).toHaveLength(1);
    expect(engine.state.inventoryTowers[0]?.id).toBe(keeper.id);
    expect(engine.state.inventoryTowers[0]?.locked).toBe(true);
    expect(engine.state.inventoryTowers[0]?.casualStar).toBe(star + 1);
  });

  it("provides monotonic star power and unlocks active skills from 2-star onward", () => {
    const multipliers = Object.values(CASUAL_STAR_POWER);
    expect(multipliers.every((value, index) => index === 0 || value > (multipliers[index - 1] ?? 0))).toBe(true);
    const engine = new GameEngine("casual-skill-unlock", "KR", "casual");
    engine.begin();
    const definition = sameElementStarDefinitions(engine)[0] as HanziDefinition;
    const tower = casualTower(definition, 401, -1, 1);
    expect(engine.towerHasActiveSkills(tower)).toBe(false);
    tower.casualStar = 2;
    expect(engine.towerHasActiveSkills(tower)).toBe(true);
    tower.casualStar = 8;
    expect(engine.towerPowerMultiplier(tower)).toBe(CASUAL_STAR_POWER[8]);
  });
});
