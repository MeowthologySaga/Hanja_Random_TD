import { describe, expect, it } from "vitest";
import { GameEngine, runAutoplay } from "../src/core/game";
import { getCatalog } from "../src/core/hanzi";
import { type IdiomDefinition, idiomDirectPoolChars, idiomsForRegion, partialIdiomChain, validateIdiomCells } from "../src/core/idioms";
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
  it("accepts four cells on one straight line and rejects bends, skips or repeats", () => {
    expect(validateIdiomCells([0, 1, 2, 3])).toBeNull();
    expect(validateIdiomCells([0, 4, 8, 12])).toBeNull();
    expect(validateIdiomCells([0, 5, 10, 15])).toBeNull();
    expect(validateIdiomCells([3, 2, 1, 0])).toBeNull();
    // 꺾인 사슬은 이웃 규칙에서는 통했지만 직선 규칙에서는 막힌다.
    expect(validateIdiomCells([0, 1, 6, 7])).toContain("한 줄");
    expect(validateIdiomCells([0, 2, 3, 4])).toContain("한 줄");
    expect(validateIdiomCells([0, 1, 2, 16])).toContain("한 줄");
    expect(validateIdiomCells([0, 1, 1, 2])).toContain("한 번만");
    expect(validateIdiomCells([0, 1, 2])).toContain("4자");
  });

  it("automatically seals an exact ordered row once and activates its bonus while the line holds", () => {
    const engine = new GameEngine("idiom-unit", "KR");
    engine.begin();
    engine.state.towers = [..."以心傳心"].map((char, index) => towerFor(engine, char, index, index + 1));

    expect(engine.resolveIdiomFormations()).toBe(1);
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.state.idiomSeals[0]?.cells).toEqual([0, 1, 2, 3]);
    expect(engine.state.idiomSeals[0]?.active).toBe(true);
    expect(engine.idiomBonus("range")).toBe(28);
    expect(engine.resolveIdiomFormations()).toBe(0);
    expect(engine.state.idiomSeals).toHaveLength(1);
  });

  it("seals a column line and stores the cells in character order", () => {
    const engine = new GameEngine("idiom-column", "KR");
    engine.begin();
    // 진 0 의 첫 세로줄 — 0·4·8·12.
    engine.state.towers = [..."以心傳心"].map((char, index) => towerFor(engine, char, [0, 4, 8, 12][index] as number, index + 1));

    expect(engine.resolveIdiomFormations()).toBe(1);
    expect(engine.state.idiomSeals[0]?.cells).toEqual([0, 4, 8, 12]);
    expect(engine.idiomBonus("range")).toBe(28);
  });

  it("seals both diagonals of a formation", () => {
    const main = new GameEngine("idiom-diagonal", "KR");
    main.begin();
    main.state.towers = [..."以心傳心"].map((char, index) => towerFor(main, char, [0, 5, 10, 15][index] as number, index + 1));
    expect(main.resolveIdiomFormations()).toBe(1);
    expect(main.state.idiomSeals[0]?.cells).toEqual([0, 5, 10, 15]);

    const anti = new GameEngine("idiom-antidiagonal", "KR");
    anti.begin();
    anti.state.towers = [..."以心傳心"].map((char, index) => towerFor(anti, char, [3, 6, 9, 12][index] as number, index + 1));
    expect(anti.resolveIdiomFormations()).toBe(1);
    expect(anti.state.idiomSeals[0]?.cells).toEqual([3, 6, 9, 12]);
  });

  it("does not seal a bent chain that the old adjacency rule accepted", () => {
    const engine = new GameEngine("idiom-bent", "KR");
    engine.begin();
    // 0→1 로 가다 5 에서 아래로 꺾이는 사슬. 8방 인접 시절에는 발동했지만
    // 이제는 한 직선이 아니라 발동하지 않는다.
    engine.state.towers = [..."以心傳心"].map((char, index) => towerFor(engine, char, [0, 1, 5, 6][index] as number, index + 1));
    expect(engine.resolveIdiomFormations()).toBe(0);
    expect(engine.state.idiomSeals).toHaveLength(0);

    // 계단식 대각 꺾임(0→5→6→11)도 마찬가지다.
    const stair = new GameEngine("idiom-stair", "KR");
    stair.begin();
    stair.state.towers = [..."以心傳心"].map((char, index) => towerFor(stair, char, [0, 5, 6, 11][index] as number, index + 1));
    expect(stair.resolveIdiomFormations()).toBe(0);
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

  it("seals a line laid out in reverse order and stores cells in character order", () => {
    const engine = new GameEngine("idiom-reverse", "KR");
    engine.begin();
    // 心傳心以 순으로 놓았지만 4→1 로 읽으면 以心傳心 이다.
    engine.state.towers = [..."心傳心以"].map((char, index) => towerFor(engine, char, index, index + 1));

    expect(engine.resolveIdiomFormations()).toBe(1);
    const seal = engine.state.idiomSeals.find((candidate) => candidate.idiomId === "heart");
    expect(seal).toBeDefined();
    // 저장된 칸은 언제나 글자 순서 기준이라 [0] 이 1번 글자 以 의 칸이다.
    expect(seal?.cells).toEqual([3, 2, 1, 0]);
    expect(engine.state.towers.find((tower) => tower.cell === (seal?.cells[0] as number))?.char).toBe("以");
    expect(engine.idiomBonus("range")).toBe(28);
  });

  it("accepts a reverse layout on a column too", () => {
    const engine = new GameEngine("idiom-reverse-column", "KR");
    engine.begin();
    engine.state.towers = [..."心傳心以"].map((char, index) => towerFor(engine, char, [0, 4, 8, 12][index] as number, index + 1));

    expect(engine.resolveIdiomFormations()).toBe(1);
    expect(engine.state.idiomSeals.find((seal) => seal.idiomId === "heart")?.cells).toEqual([12, 8, 4, 0]);
  });

  it("keeps rejecting reverse layouts that are not on one line", () => {
    const engine = new GameEngine("idiom-reverse-gap", "KR");
    engine.begin();
    engine.state.towers = [..."心傳心以"].map((char, index) => towerFor(engine, char, [0, 2, 4, 19][index] as number, index + 1));
    expect(engine.resolveIdiomFormations()).toBe(0);
  });

  it("points at the next cell on the same line as the partial run", () => {
    const engine = new GameEngine("idiom-partial", "KR");
    engine.begin();
    const idiom = idiomsForRegion("KR").find((candidate) => candidate.id === "heart") as IdiomDefinition;

    expect(partialIdiomChain([], idiom)).toMatchObject({ length: 0, nextChar: null, anchorCell: null });
    expect(partialIdiomChain([], idiom).nextCells).toEqual([]);

    // 以心 두 글자가 첫 가로줄에 서 있으면 3번 글자 傳 자리는 같은 줄의 2번 칸뿐이다.
    engine.state.towers = [..."以心"].map((char, index) => towerFor(engine, char, index, index + 1));
    const partial = partialIdiomChain(engine.state.towers, idiom);
    expect(partial).toMatchObject({ length: 2, nextChar: "傳", nextOrder: 3, anchorCell: 1, reversed: false, complete: false });
    expect(partial.cells).toEqual([0, 1]);
    expect(partial.nextCells).toEqual([2]);

    // 같은 줄이 아니면 1번 글자 하나만 걸려, 그 글자가 시작할 수 있는 줄들을 모두 안내한다.
    engine.state.towers = [..."以心"].map((char, index) => towerFor(engine, char, [0, 19][index] as number, index + 1));
    const broken = partialIdiomChain(engine.state.towers, idiom);
    expect(broken).toMatchObject({ length: 1, nextChar: "心", nextOrder: 2, anchorCell: 0 });
    // 0번 칸에서 뻗는 줄은 가로(1)·세로(4)·대각(5) 셋이다.
    expect([...broken.nextCells].sort((left, right) => left - right)).toEqual([1, 4, 5]);
  });

  it("guides both lines when the first character can grow either way", () => {
    const engine = new GameEngine("idiom-partial-fork", "KR");
    engine.begin();
    const idiom = idiomsForRegion("KR").find((candidate) => candidate.id === "heart") as IdiomDefinition;
    // 以 는 0번, 心 은 가로(1번)와 세로(4번) 양쪽에 하나씩 — 두 줄 다 2자까지 이어졌다.
    engine.state.towers = [
      towerFor(engine, "以", 0, 1),
      towerFor(engine, "心", 1, 2),
      towerFor(engine, "心", 4, 3)
    ];
    const partial = partialIdiomChain(engine.state.towers, idiom);
    expect(partial).toMatchObject({ length: 2, nextChar: "傳", nextOrder: 3 });
    expect([...partial.nextCells].sort((left, right) => left - right)).toEqual([2, 8]);
  });

  it("drops a line whose next cell is already blocked by another tower", () => {
    const engine = new GameEngine("idiom-partial-blocked", "KR");
    engine.begin();
    const idiom = idiomsForRegion("KR").find((candidate) => candidate.id === "heart") as IdiomDefinition;
    // 以心 은 가로줄에 이어져 있지만 3번 글자 자리(2번 칸)를 다른 자령이 막았다.
    // 그 줄로는 성어를 끝낼 수 없으므로 1자 기준으로 다시 안내한다.
    engine.state.towers = [
      towerFor(engine, "以", 0, 1),
      towerFor(engine, "心", 1, 2),
      towerFor(engine, "木", 2, 3)
    ];
    const partial = partialIdiomChain(engine.state.towers, idiom);
    expect(partial).toMatchObject({ length: 1, nextChar: "心", nextOrder: 2, anchorCell: 0 });
    expect([...partial.nextCells].sort((left, right) => left - right)).toEqual([4, 5]);
  });

  it("stays silent when only a middle character sits on the board", () => {
    const engine = new GameEngine("idiom-partial-middle", "KR");
    engine.begin();
    const idiom = idiomsForRegion("KR").find((candidate) => candidate.id === "heart") as IdiomDefinition;
    // 직선 규칙에서는 1번 글자가 줄 머리에 서야 안내가 자란다. 3번 글자 傳 하나로는
    // 어느 줄을 노리는지 정해지지 않는다.
    engine.state.towers = [towerFor(engine, "傳", 5, 1)];
    expect(partialIdiomChain(engine.state.towers, idiom)).toMatchObject({ length: 0, nextChar: null, anchorCell: null });
  });

  it("marks a complete chain as complete in either direction", () => {
    const engine = new GameEngine("idiom-partial-complete", "KR");
    engine.begin();
    const idiom = idiomsForRegion("KR").find((candidate) => candidate.id === "heart") as IdiomDefinition;
    engine.state.towers = [..."心傳心以"].map((char, index) => towerFor(engine, char, index, index + 1));
    expect(partialIdiomChain(engine.state.towers, idiom)).toMatchObject({ length: 4, complete: true, nextChar: null, nextOrder: null });
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

/**
 * R18 유지형 성어 — 효과는 네 자령이 그 줄을 지키는 동안만 산다.
 * 기록(달성)과 활성(전투 보너스)이 어떻게 갈라지는지를 경로별로 못 박는다.
 */
describe("sustained idiom seals", () => {
  /** 진 0 의 첫 가로줄에 以心傳心 을 세우고 봉인까지 마친 판. */
  function sealedEngine(seed: string): GameEngine {
    const engine = new GameEngine(seed, "KR");
    engine.begin();
    engine.state.unlockedFormations = [0, 1, 2, 3, 4];
    engine.state.towers = [..."以心傳心"].map((char, index) => towerFor(engine, char, index, index + 1));
    expect(engine.resolveIdiomFormations()).toBe(1);
    expect(engine.idiomBonus("range")).toBe(28);
    engine.consumeEvents();
    return engine;
  }

  function brokenEvent(engine: GameEngine): Extract<ReturnType<GameEngine["consumeEvents"]>[number], { type: "idiomBroken" }> | undefined {
    return engine.consumeEvents().find((event): event is Extract<typeof event, { type: "idiomBroken" }> => event.type === "idiomBroken");
  }

  it("drops the bonus the moment one sealed spirit leaves its cell, but keeps the record", () => {
    const engine = sealedEngine("idiom-hold-move");
    engine.selectTower(4);
    expect(engine.relocateSelectedToCell(20)).toMatchObject({ ok: true });

    // 기록은 그대로 하나. 활성만 꺼진다.
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.state.idiomSeals[0]?.active).toBe(false);
    expect(engine.state.idiomSeals[0]?.cells).toEqual([]);
    expect(engine.activeIdiomSeals()).toHaveLength(0);
    expect(engine.isIdiomSealActive("heart")).toBe(false);
    expect(engine.idiomBonus("range")).toBe(0);
    expect(engine.state.lastMessage).toContain("봉인 해제");

    const broken = brokenEvent(engine);
    expect(broken).toBeDefined();
    expect(broken?.idiomId).toBe("heart");
    expect(broken?.reading).toBe("이심전심");
    expect(broken?.cells).toEqual([0, 1, 2, 3]);
  });

  it("re-arms the same idiom when the line is rebuilt, flagged as a rejoin", () => {
    const engine = sealedEngine("idiom-hold-rejoin");
    engine.selectTower(4);
    engine.relocateSelectedToCell(20);
    expect(engine.idiomBonus("range")).toBe(0);
    engine.consumeEvents();

    engine.selectTower(4);
    expect(engine.relocateSelectedToCell(3)).toMatchObject({ ok: true });
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.state.idiomSeals[0]?.active).toBe(true);
    expect(engine.state.idiomSeals[0]?.cells).toEqual([0, 1, 2, 3]);
    expect(engine.idiomBonus("range")).toBe(28);

    const rejoin = engine.consumeEvents().find((event) => event.type === "idiom");
    expect(rejoin).toBeDefined();
    if (rejoin?.type === "idiom") {
      expect(rejoin.rejoined).toBe(true);
      expect(rejoin.cells).toEqual([0, 1, 2, 3]);
    }
    expect(engine.state.lastMessage).toContain("재봉인");
  });

  it("breaks the seal when a sealed spirit is stored, and keeps it broken after dismantling it", () => {
    const engine = sealedEngine("idiom-hold-store");
    engine.selectTower(2);
    expect(engine.storeSelectedTower()).toMatchObject({ ok: true });
    expect(engine.isIdiomSealActive("heart")).toBe(false);
    expect(engine.idiomBonus("range")).toBe(0);
    expect(brokenEvent(engine)).toBeDefined();

    // 분해까지 마쳐도 달성 기록은 그대로 남고 활성은 꺼진 채다.
    const stored = engine.state.inventoryTowers[0] as Tower;
    expect(engine.dismantleTowers([stored.id], { protectUnique: false })).toMatchObject({ ok: true });
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.isIdiomSealActive("heart")).toBe(false);
    expect(engine.idiomBonus("range")).toBe(0);
  });

  it("breaks the seal when a sealed spirit is sold off the board", () => {
    const engine = sealedEngine("idiom-hold-sell");
    engine.selectTower(1);
    expect(engine.sellSelected()).toMatchObject({ ok: true });
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.isIdiomSealActive("heart")).toBe(false);
    expect(engine.idiomBonus("range")).toBe(0);
    expect(brokenEvent(engine)).toBeDefined();
  });

  it("keeps the achievement record so the run target moves on even while the line is scattered", () => {
    const engine = sealedEngine("idiom-hold-record");
    const nextTarget = engine.currentIdiomTarget();
    expect(nextTarget?.id).not.toBe("heart");

    engine.selectTower(4);
    engine.relocateSelectedToCell(20);
    // 흩어져도 "이미 봉인해 본 성어"라 목표는 되돌아오지 않고, 통계 수치도 1 그대로다.
    expect(engine.currentIdiomTarget()?.id).toBe(nextTarget?.id);
    expect(engine.state.idiomSeals).toHaveLength(1);
    expect(engine.setIdiomTarget("heart")).toMatchObject({ ok: false });
  });

  it("keeps auto-arrange from scattering the four spirits of an active seal", () => {
    const engine = sealedEngine("idiom-hold-autoarrange");
    // 공명 최적화가 탐낼 만한 자령을 잔뜩 붙여 둔다.
    const filler = engine.catalog.activePool
      .filter((definition) => ![..."以心傳心"].includes(definition.char))
      .slice(0, 24);
    engine.state.towers.push(...filler.map((definition, index) => towerFor(engine, definition.char, 16 + index, 100 + index)));

    const sealedIds = engine.sealedIdiomTowerIds();
    expect([...sealedIds].sort((left, right) => left - right)).toEqual([1, 2, 3, 4]);
    const before = new Map(engine.state.towers.map((tower) => [tower.id, tower.cell]));

    for (let round = 0; round < 3; round += 1) expect(engine.autoArrangeTowers()).toMatchObject({ ok: true });

    for (const id of sealedIds) {
      expect(engine.state.towers.find((tower) => tower.id === id)?.cell).toBe(before.get(id));
    }
    expect(engine.isIdiomSealActive("heart")).toBe(true);
    expect(engine.idiomBonus("range")).toBe(28);
    expect(engine.consumeEvents().some((event) => event.type === "idiomBroken")).toBe(false);
  });

  it("still lets the autoplay bot finish a run with pinned seals in play", () => {
    for (const region of ["KR", "JP"] as const) {
      const result = runAutoplay(`idiom-hold-bot-${region}`, region, 5_400);
      expect(result.result).not.toBe("timeout");
      // 자리 고정이 봇의 자동배치를 잠가 버리면 초반 웨이브에서 멈춘다.
      expect(result.wave).toBeGreaterThan(20);
    }
  }, 30_000);
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
    engine.state.idiomSeals = [...damage, ...slow].map((idiom, index) => ({ idiomId: idiom.id, cells: [0, 1, 2, 3], completedAt: index, active: true }));
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
