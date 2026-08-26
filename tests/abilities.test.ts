import { describe, expect, it } from "vitest";
import { ELEMENT_ABILITY_TABLE, GRAPH_ABILITY_TABLE, ROLE_ABILITY_TABLE, SEMANTIC_ABILITY_TABLE, composeAbilityLoadout, hasActiveSkills } from "../src/core/abilities";
import { GameEngine, elementZoneKind } from "../src/core/game";
import { getCatalog } from "../src/core/hanzi";

describe("combinatorial Hanzi ability table", () => {
  it("defines every element, combat role, and graph role axis", () => {
    expect(Object.keys(ELEMENT_ABILITY_TABLE)).toHaveLength(5);
    expect(Object.keys(ROLE_ABILITY_TABLE)).toHaveLength(6);
    expect(Object.keys(GRAPH_ABILITY_TABLE)).toHaveLength(4);
    // [SKILL-V1] warfare·momentum·frost 3계열이 더해져 15가 됐다.
    // [SKILL-V2] chainseal·reaper·command·scorch·harvest 5계열이 더해져 20이 됐다.
    expect(Object.keys(SEMANTIC_ABILITY_TABLE)).toHaveLength(20);
    expect(new Set(Object.values(ELEMENT_ABILITY_TABLE).map((ability) => ability.fx)).size).toBe(5);
    expect(new Set(Object.values(ROLE_ABILITY_TABLE).map((ability) => ability.fx)).size).toBe(6);
    expect(new Set(Object.values(GRAPH_ABILITY_TABLE).map((ability) => ability.fx)).size).toBe(4);
  });

  it("assigns a valid deterministic loadout to all 6,637 regional characters", () => {
    const definitions = (["KR", "JP", "CN"] as const).flatMap((region) => [...getCatalog(region).definitions.values()]);
    expect(definitions).toHaveLength(6_637);
    const comboKeys = new Set<string>();
    const roleIds = new Set<string>();
    for (const definition of definitions) {
      const loadout = definition.combat.abilities;
      expect(loadout.element.category).toBe("element");
      expect(loadout.semantic.category).toBe("semantic");
      expect(loadout.role.category).toBe("role");
      expect(loadout.graph.category).toBe("graph");
      expect(loadout.tuning.signatureEvery).toBeGreaterThanOrEqual(7);
      expect(loadout.tuning.semanticEvery).toBeGreaterThanOrEqual(7);
      expect(loadout.tuning.lineageEvery).toBeGreaterThanOrEqual(10);
      expect(loadout.comboKey).toContain("S" + String(definition.stage));
      if (definition.acquisition === "craft") expect(loadout.lineage?.category).toBe("lineage");
      else expect(loadout.lineage).toBeUndefined();
      comboKeys.add(loadout.comboKey);
      roleIds.add(loadout.role.id);
    }
    expect(comboKeys.size).toBeGreaterThan(100);
    expect(roleIds.size).toBe(6);
  });

  it("gives the active Korean roster multiple meaning-driven target and action families", () => {
    const active = getCatalog("KR").activePool.map((definition) => definition.combat.abilities);
    expect(new Set(active.map((loadout) => loadout.semanticFamily)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(active.map((loadout) => loadout.targetPriority)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(active.map((loadout) => loadout.semantic.id)).size).toBeGreaterThanOrEqual(8);
  });

  it("inherits a distinct parent element when a compound offers one", () => {
    const liuWater = getCatalog("CN").definitions.get("浏");
    expect(liuWater?.parents).toEqual(["水", "刘"]);
    expect(liuWater?.combat.abilities.lineageWuxing).not.toBe("水");
    expect(liuWater?.combat.abilities.lineage?.name).toContain("계승");
  });

  it("composes the same loadout from the same axes", () => {
    const input = {
      char: "森",
      wuxing: "木" as const,
      stage: 3 as const,
      role: "burst" as const,
      graphRole: "finisher" as const,
      parents: ["木", "林"],
      parentWuxing: ["木", "火"] as const
    };
    expect(composeAbilityLoadout({ ...input, parentWuxing: [...input.parentWuxing] })).toEqual(
      composeAbilityLoadout({ ...input, parentWuxing: [...input.parentWuxing] })
    );
  });

  it("emits named ability events during a real wave", () => {
    const engine = new GameEngine("ability-event", "KR");
    engine.begin();
    const definition = [...engine.catalog.definitions.values()].find((candidate) => candidate.stage >= 2 && candidate.combat.abilities.semanticFamily !== "weather")!;
    engine.state.towers = [{
      id: 9001,
      definitionId: definition.id,
      char: definition.char,
      wuxing: definition.wuxing,
      stage: definition.stage,
      combatRole: definition.combat.role,
      graphRole: definition.graph.graphRole,
      cell: 0,
      cooldownLeft: 0,
      pulse: 0,
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1,
      abilityFlash: 0,
      locked: false
    }];
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0];
    engine.consumeEvents();
    engine.startWaveEarly();
    let abilityEvent = engine.consumeEvents().find((event) => event.type === "ability");
    for (let step = 0; step < 600 && !abilityEvent; step += 1) {
      engine.update(0.1);
      abilityEvent = engine.consumeEvents().find((event) => event.type === "ability");
    }
    expect(abilityEvent).toMatchObject({ type: "ability" });
    if (abilityEvent?.type === "ability") {
      expect(abilityEvent.name.length).toBeGreaterThan(1);
      expect(abilityEvent.glyph.length).toBeGreaterThan(0);
      expect(abilityEvent.targets).toBeGreaterThanOrEqual(0);
      expect(abilityEvent.effect.length).toBeGreaterThan(4);
      expect(abilityEvent.effect).not.toBe("능력 발동");
    }
  });

  it("keeps combinable tier-1 materials on basic attacks until they are synthesized", () => {
    const catalog = getCatalog("KR");
    const material = [...catalog.definitions.values()].find((definition) => definition.stage === 1 && definition.graph.directChildCount > 0)!;
    const leaf = [...catalog.definitions.values()].find((definition) => definition.stage === 1 && definition.graph.directChildCount === 0)!;
    expect(hasActiveSkills(material)).toBe(false);
    expect(hasActiveSkills(leaf)).toBe(true);
  });

  it("turns a weather meaning skill into a persistent rain-cloud damage zone", () => {
    const engine = new GameEngine("weather-zone", "KR");
    engine.begin();
    const definition = [...engine.catalog.definitions.values()].find((candidate) => candidate.stage >= 2 && candidate.combat.abilities.semanticFamily === "weather")!;
    engine.state.towers = [{
      id: 9002,
      definitionId: definition.id,
      char: definition.char,
      wuxing: definition.wuxing,
      stage: definition.stage,
      combatRole: definition.combat.role,
      graphRole: definition.graph.graphRole,
      cell: 0,
      cooldownLeft: 0,
      pulse: 0,
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1,
      abilityFlash: 0,
      locked: false
    }];
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0];
    engine.startWaveEarly();
    for (let step = 0; step < 800 && engine.state.abilityZones.length === 0; step += 1) engine.update(0.1);
    expect(engine.state.abilityZones[0]).toMatchObject({ towerId: 9002, kind: elementZoneKind(definition.wuxing) });
    expect(engine.state.abilityZones[0]?.damagePerSecond).toBeGreaterThan(0);
  });

  it("gives every element its own persistent path-zone identity", () => {
    expect((["木", "火", "土", "金", "水"] as const).map(elementZoneKind)).toEqual([
      "roots", "lava", "quicksand", "caltrops", "rain"
    ]);
  });
});
