import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/core/game";
import { getCatalog } from "../src/core/hanzi";
import { idiomDirectPoolChars, idiomsForRegion, validateIdiomCells } from "../src/core/idioms";
import { LEARNING_DATA_META, learningInfo } from "../src/core/learning";
import { CHEONJAMUN_PHRASES } from "../src/data/cheonjamun-phrases";
import krRuntime from "../handoff_source/data/KR_1000.prelim.runtime.json";
import type { RegionCode, Tower } from "../src/core/types";

function towerFor(engine: GameEngine, char: string, cell: number, id: number): Tower {
  const definition = engine.catalog.definitions.get(char);
  if (!definition) throw new Error(`Missing test character ${char}`);
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

describe("four-character idiom formation", () => {
  it("accepts four unique adjacent cells and rejects skips or repeats", () => {
    expect(validateIdiomCells([0, 1, 6, 7])).toBeNull();
    expect(validateIdiomCells([0, 2, 3, 4])).toContain("맞닿은");
    expect(validateIdiomCells([0, 1, 2, 16])).toContain("맞닿은");
    expect(validateIdiomCells([0, 1, 1, 2])).toContain("한 번만");
    expect(validateIdiomCells([0, 1, 2])).toContain("4자");
  });

  it("automatically seals an exact ordered formation once and activates its permanent bonus", () => {
    const engine = new GameEngine("idiom-unit", "KR");
    engine.begin();
    engine.state.towers = [..."以心傳心"].map((char, index) => towerFor(engine, char, index, index + 1));

    expect(engine.resolveIdiomFormations()).toBe(1);
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.idiomBonus("range")).toBe(28);
    expect(engine.resolveIdiomFormations()).toBe(0);
    expect(engine.state.idiomSeals).toHaveLength(1);
  });

  it("does not activate matching characters that are disconnected on the grid", () => {
    const engine = new GameEngine("idiom-order", "KR");
    engine.begin();
    engine.state.towers = [..."以心傳心"].map((char, index) => towerFor(engine, char, [0, 2, 4, 19][index] as number, index + 1));
    expect(engine.resolveIdiomFormations()).toBe(0);
    expect(engine.state.idiomSeals).toHaveLength(0);
  });

  it("rechecks automatically after moving the final character into place", () => {
    const engine = new GameEngine("idiom-move", "KR");
    engine.begin();
    engine.state.unlockedFormations = [0, 2];
    engine.state.towers = [..."以心傳心"].map((char, index) => towerFor(engine, char, [0, 1, 2, 4][index] as number, index + 1));

    expect(engine.resolveIdiomFormations()).toBe(0);
    engine.selectTower(4);
    expect(engine.moveSelectedToCell(3)).toMatchObject({ ok: true });
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.state.lastMessage).toContain("자동 봉인");
  });

  it("rechecks automatically after swapping two occupied cells", () => {
    const engine = new GameEngine("idiom-swap", "KR");
    engine.begin();
    engine.state.unlockedFormations = [0, 2];
    engine.state.towers = [..."心以傳心"].map((char, index) => towerFor(engine, char, index, index + 1));

    engine.selectTower(2);
    expect(engine.relocateSelectedToCell(0)).toMatchObject({ ok: true });
    expect(engine.state.towers.find((tower) => tower.id === 2)?.cell).toBe(0);
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.state.lastMessage).toContain("자동 봉인");
  });

  it("auto-arranges disconnected owned characters to seal an available idiom", () => {
    const engine = new GameEngine("idiom-auto-arrange", "KR");
    engine.begin();
    engine.state.startingFormationIndex = 2;
    engine.state.unlockedFormations = [0, 1, 2, 3, 4];
    engine.state.towers = [..."以心傳心"].map((char, index) => towerFor(engine, char, [0, 18, 37, 71][index] as number, index + 1));

    expect(engine.resolveIdiomFormations()).toBe(0);
    expect(engine.autoArrangeTowers()).toMatchObject({ ok: true });
    expect(engine.state.idiomSeals.some((seal) => seal.idiomId === "heart")).toBe(true);
    expect(engine.state.lastMessage).toContain("성어 1개 봉인");
  });

  it("pulls a missing idiom character out of the run inventory during auto-arrange", () => {
    const engine = new GameEngine("idiom-auto-arrange-inventory", "KR");
    engine.begin();
    engine.state.startingFormationIndex = 2;
    engine.state.unlockedFormations = [0, 1, 2, 3, 4];
    engine.state.towers = [..."以心傳"].map((char, index) => towerFor(engine, char, [0, 18, 37][index] as number, index + 1));
    engine.state.inventoryTowers = [towerFor(engine, "心", -1, 9)];

    expect(engine.autoArrangeTowers()).toMatchObject({ ok: true });
    expect(engine.state.idiomSeals.some((seal) => seal.idiomId === "heart")).toBe(true);
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.lastMessage).toContain("인벤토리 1기 투입");
  });
});

describe("regional idiom reachability and learning labels", () => {
  for (const region of ["KR", "JP", "CN"] as const satisfies readonly RegionCode[]) {
    it(`${region} keeps every featured idiom reachable from its run summon pool`, () => {
      const catalog = getCatalog(region);
      const engine = new GameEngine(`featured-${region}`, region);
      const active = new Set(engine.summonDefinitions().map((definition) => definition.char));
      expect(engine.idioms()).toHaveLength(region === "KR" ? 5 : 4);
      for (const idiom of idiomsForRegion(region)) {
        expect([...idiom.chars]).toHaveLength(4);
        for (const char of idiom.chars) expect(catalog.definitions.has(char)).toBe(true);
      }
      const current = engine.currentIdiomTarget();
      expect(current).toBeDefined();
      for (const char of idiomDirectPoolChars(catalog, current ? [current] : [])) expect(active.has(char)).toBe(true);
    });
  }

  it("registers one hundred exact Cheonjamun clauses and keeps the four common idioms", () => {
    const corpus = (krRuntime as { chars: Array<{ c: string }> }).chars.map((entry) => entry.c).join("");
    expect(CHEONJAMUN_PHRASES).toHaveLength(100);
    expect(CHEONJAMUN_PHRASES.every((phrase) => phrase.reading.length === 4 && phrase.meaning.length > 0)).toBe(true);
    expect(CHEONJAMUN_PHRASES.map((phrase) => phrase.chars).join("")).toBe(corpus.slice(0, 400));
    expect(new Set(CHEONJAMUN_PHRASES.flatMap((phrase) => [...phrase.chars])).size).toBe(400);
    expect(idiomsForRegion("KR")).toHaveLength(104);
    expect(idiomsForRegion("KR").filter((idiom) => idiom.source === "cheonjamun")).toHaveLength(100);
    expect(idiomsForRegion("KR").find((idiom) => idiom.chars === "辰宿列張")?.reading).toBe("진수열장");
  });

  it("selects a deterministic five-clause run set with all four effect families", () => {
    const first = new GameEngine("featured-balance", "KR");
    const replay = new GameEngine("featured-balance", "KR");
    expect(first.idioms().map((idiom) => idiom.id)).toEqual(replay.idioms().map((idiom) => idiom.id));
    expect(first.idioms()).toHaveLength(5);
    expect(new Set(first.idioms().map((idiom) => idiom.bonus.kind))).toHaveLength(4);
    expect(first.idioms()[0]?.id).toBe("heart");
  });

  it("caps stacked clause effects so duplicate families cannot break combat balance", () => {
    const engine = new GameEngine("idiom-cap", "KR");
    const damage = engine.allIdioms().filter((idiom) => idiom.bonus.kind === "damage").slice(0, 2);
    const slow = engine.allIdioms().filter((idiom) => idiom.bonus.kind === "enemySlow").slice(0, 2);
    engine.state.idiomSeals = [...damage, ...slow].map((idiom, index) => ({ idiomId: idiom.id, cells: [0, 1, 2, 3], completedAt: index }));
    expect(engine.idiomBonus("damage")).toBe(0.15);
    expect(engine.idiomBonus("enemySlow")).toBe(0.1);
  });

  it("covers every unique catalog glyph with the configured reading data", () => {
    expect(LEARNING_DATA_META.coveredCharacters).toBe(LEARNING_DATA_META.catalogCharacters);
    expect(LEARNING_DATA_META.coveredCharacters).toBeGreaterThan(4_500);
    expect(learningInfo("KR", "木")).toMatchObject({ readingLabel: "훈음", short: "나무 목", meaning: "나무" });
    expect(learningInfo("JP", "木").reading).toContain("음독");
    expect(learningInfo("JP", "木").reading).toContain("훈독");
    expect(learningInfo("CN", "木").reading).toBe("mù");
  });

  it("does not leave a Korean catalog character without a visible hun-eum label", () => {
    for (const char of getCatalog("KR").definitions.keys()) {
      expect(learningInfo("KR", char).reading, char).not.toContain("미수록");
    }
  });
});
