/*
 * [SKILL-V3] 스킬 3차 세트 단위·통합 테스트.
 *
 *  1. 유폭 낙인(同歸) — 낙인 적립·전파 반경·전파 인원 상한·연쇄 유폭 차단
 *  2. 획수 공명(畫數共鳴) — 같은 진·같은 계급 중첩 상한·진 경계·자동배치 간섭
 *
 * 공통 원칙: 어떤 스킬도 적을 뒤로 밀지 않는다(감속·제자리 정지·장판만).
 * 그래서 모든 통합 테스트는 효과가 걸린 뒤 `progress` 가 줄지 않았음을 함께 본다.
 */
import { describe, expect, it } from "vitest";
import {
  DEMISE_MAX_TARGETS,
  DEMISE_RADIUS_BASE,
  DEMISE_RADIUS_CAP,
  DEMISE_RADIUS_PER_STAR,
  DEMISE_STORE_RATIO,
  demiseSpreadRadius,
  hasActiveSkills,
  SEMANTIC_ABILITY_TABLE,
  semanticCharGroup,
  STROKE_RESONANCE_ABILITY,
  STROKE_RESONANCE_HASTE_PER_STACK,
  STROKE_RESONANCE_MAX_STACKS,
  strokeResonanceCooldownScale,
  strokeResonanceStacks,
  WARFARE_BRAND_DURATION
} from "../src/core/abilities";
import { BOARD_CELLS, CELLS_PER_FORMATION, positionOnPath } from "../src/core/content";
import { GameEngine } from "../src/core/game";
import { getCatalog } from "../src/core/hanzi";
import type { Enemy, EnemyArchetype, GameEvent, HanziDefinition, SemanticFamily, Tower } from "../src/core/types";

const REGIONS = ["KR", "JP", "CN"] as const;

function makeTower(definition: HanziDefinition, id: number, overrides: Partial<Tower> = {}): Tower {
  return {
    id,
    definitionId: definition.id,
    char: definition.char,
    wuxing: definition.wuxing,
    stage: definition.stage,
    combatRole: definition.combat.role,
    graphRole: definition.graph.graphRole,
    cell: 0,
    cooldownLeft: 0,
    pulse: 0,
    shotCount: 0,
    abilityFlash: 0,
    locked: false,
    ...overrides
  };
}

function makeEnemy(id: number, archetype: EnemyArchetype, overrides: Partial<Enemy> = {}): Enemy {
  return {
    id,
    wave: 1,
    hp: 100000,
    maxHp: 100000,
    speed: 0,
    progress: 0.3,
    reward: 7,
    boss: archetype === "boss",
    archetype,
    weakness: "木",
    armor: 0,
    regenPerSecond: 0,
    slowFactor: 1,
    slowUntil: 0,
    stunnedUntil: 0,
    poisonDps: 0,
    poisonUntil: 0,
    flash: 0,
    ...overrides
  };
}

/** 경로 위에서 이 칸과 가장 가까운 진행도 — 사거리 안에 확실히 세우기 위한 좌표. */
function progressNearCell(cell: number): number {
  const origin = BOARD_CELLS[cell]!;
  let best = 0;
  let bestDistance = Infinity;
  for (let progress = 0; progress < 1; progress += 0.005) {
    const point = positionOnPath(progress);
    const candidate = Math.hypot(origin.x - point.x, origin.y - point.y);
    if (candidate < bestDistance) {
      bestDistance = candidate;
      best = progress;
    }
  }
  return best;
}

/** 기준점에서 경로를 따라 정확히 `pixels` 만큼 떨어진 진행도를 찾는다. */
function progressAtDistance(fromProgress: number, pixels: number): number {
  const origin = positionOnPath(fromProgress);
  let best = fromProgress;
  let bestError = Infinity;
  for (let step = 0.0002; step < 0.5; step += 0.0002) {
    for (const candidate of [fromProgress + step, fromProgress - step]) {
      const point = positionOnPath(candidate);
      const error = Math.abs(Math.hypot(point.x - origin.x, point.y - origin.y) - pixels);
      if (error < bestError) {
        bestError = error;
        best = candidate;
      }
    }
  }
  return best;
}

function familyDefinition(
  region: (typeof REGIONS)[number],
  family: SemanticFamily,
  filter: (definition: HanziDefinition) => boolean = () => true
): HanziDefinition {
  const found = [...getCatalog(region).definitions.values()].find(
    (definition) => definition.combat.abilities.semanticFamily === family && hasActiveSkills(definition) && filter(definition)
  );
  expect(found, `${region} 로스터에 ${family} 활성 기술 자령이 있어야 합니다`).toBeDefined();
  return found as HanziDefinition;
}

/** 전투 1기 대치 장면 — 지정 자령 1기와 조작용 적 1기만 남긴다. */
function arrangeDuel(engine: GameEngine, definition: HanziDefinition, towerOverrides: Partial<Tower> = {}): { tower: Tower; enemy: Enemy } {
  engine.begin();
  const tower = makeTower(definition, 9400, towerOverrides);
  engine.state.towers = [tower];
  engine.state.summonCount = 1;
  engine.state.startingFormationIndex = 0;
  engine.state.unlockedFormations = [0];
  engine.consumeEvents();
  engine.startWaveEarly();
  const enemy = makeEnemy(-5, "normal", { progress: progressNearCell(tower.cell) });
  engine.state.enemies = [enemy];
  engine.state.spawned = 9999; // 계획 스폰 차단 — 대치 구도를 유지한다.
  return { tower, enemy };
}

function abilityEvents(engine: GameEngine): Array<Extract<GameEvent, { type: "ability" }>> {
  return engine.consumeEvents().filter((event): event is Extract<GameEvent, { type: "ability" }> => event.type === "ability");
}

/**
 * 광역이 섞이지 않는 유폭 자령. 화(확산)·수(연쇄)는 이웃까지 때려서
 * "유폭으로만 아팠는가"를 가릴 수 없게 만든다 — 단일 대상 오행만 고른다.
 */
function soloDemiseDefinition(region: (typeof REGIONS)[number]): HanziDefinition {
  return familyDefinition(region, "demise", (definition) => definition.wuxing !== "火" && definition.wuxing !== "水");
}

describe("[SKILL-V3] 신설 글자군", () => {
  it("demise 글자군은 실존 로스터 글자로만 이뤄지고 기존 글자군과 겹치지 않는다", () => {
    const families = Object.keys(SEMANTIC_ABILITY_TABLE) as SemanticFamily[];
    expect(families).toContain("demise");
    const others = families.filter((family): family is Exclude<SemanticFamily, "general"> => family !== "general" && family !== "demise");
    const group = semanticCharGroup("demise");
    expect(group.size).toBeGreaterThan(0);
    for (const char of group) {
      for (const other of others) {
        expect(semanticCharGroup(other).has(char), `${char} 는 demise 와 ${other} 에 동시에 있으면 안 됩니다`).toBe(false);
      }
      const rosters = REGIONS.filter((region) => getCatalog(region).definitions.has(char));
      expect(rosters.length, `${char} 는 어느 지역 로스터에도 없습니다`).toBeGreaterThan(0);
    }
    // 滅은 참명(reaper)이 선점한 글자다 — 유폭이 가져가지 않았다.
    expect(semanticCharGroup("reaper").has("滅")).toBe(true);
    expect(group.has("滅")).toBe(false);
  });

  it("세 지역 모두 유폭 낙인을 쓰는 활성 자령을 가진다", () => {
    for (const region of REGIONS) expect(familyDefinition(region, "demise").char).toBeTruthy();
  });
});

describe("[SKILL-V3] 유폭 낙인 (同歸)", () => {
  it("전파 반경 — 기본 100, 캐주얼 별당 +6, 상한 150을 넘지 않는다", () => {
    expect(demiseSpreadRadius(null)).toBe(DEMISE_RADIUS_BASE);
    expect(demiseSpreadRadius(1)).toBe(DEMISE_RADIUS_BASE);
    expect(demiseSpreadRadius(4)).toBe(DEMISE_RADIUS_BASE + 3 * DEMISE_RADIUS_PER_STAR);
    expect(demiseSpreadRadius(8)).toBe(DEMISE_RADIUS_BASE + 7 * DEMISE_RADIUS_PER_STAR);
    expect(demiseSpreadRadius(999)).toBe(DEMISE_RADIUS_CAP);
  });

  it("낙인을 새기면 상극 각인과 같은 낙인 자료를 쓰되 유폭 반경이 함께 새겨진다", () => {
    const definition = familyDefinition("KR", "demise");
    const engine = new GameEngine("skill-demise-brand", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    engine.update(0.02);
    expect(tower.shotCount % definition.combat.abilities.tuning.semanticEvery).toBe(0);
    expect(enemy.brandWuxing).toBe(tower.wuxing);
    expect(enemy.brandUntil ?? 0).toBeCloseTo(engine.state.elapsed + WARFARE_BRAND_DURATION, 2);
    expect(enemy.brandPower ?? 0).toBeGreaterThan(0);
    expect(enemy.brandBlastRadius ?? 0).toBe(demiseSpreadRadius(null));
    // 낙인은 그 공격의 피해가 이미 들어간 뒤에 새겨진다 — 적립은 다음 피해부터다.
    expect(enemy.brandStored ?? 0).toBe(0);
    tower.cooldownLeft = 0;
    engine.update(0.02);
    expect(enemy.brandStored ?? 0).toBeGreaterThan(0);
  });

  it("상극 각인이 덧쓰면 유폭 반경과 적립분이 함께 지워진다 — 낙인 자리는 하나다", () => {
    const definition = familyDefinition("KR", "warfare");
    const engine = new GameEngine("skill-demise-overwrite", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    enemy.brandBlastRadius = 140;
    enemy.brandStored = 5000;
    engine.update(0.02);
    expect(enemy.brandWuxing).toBe(tower.wuxing);
    expect(enemy.brandBlastRadius).toBe(0);
    expect(enemy.brandStored).toBe(0);
  });

  it("낙인을 진 채 쓰러지면 반경 안 적에게만 적립분이 번진다 — 반경 밖은 무사하다", () => {
    const definition = soloDemiseDefinition("KR");
    const engine = new GameEngine("skill-demise-spread", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    const radius = demiseSpreadRadius(null);
    // 유폭 자령은 `strongest` 를 노린다 — 낙인 대상이 항상 유일한 최강자가 되게
    // 이웃 체력을 낮춰 둔다. 그래야 어느 적이 낙인을 졌는지가 흔들리지 않는다.
    const near = makeEnemy(-6, "normal", { progress: progressAtDistance(enemy.progress, radius * 0.5), hp: 50000 });
    const far = makeEnemy(-7, "normal", { progress: progressAtDistance(enemy.progress, radius * 2.4), hp: 50000 });
    // 닻 적 — 마지막 적 처치로 웨이브가 닫히지 않게 사거리 밖에 세운다.
    const anchor = makeEnemy(-8, "normal", { progress: (enemy.progress + 0.5) % 1, hp: 50000 });
    engine.state.enemies = [enemy, near, far, anchor];
    engine.update(0.02);
    expect(enemy.brandBlastRadius ?? 0).toBeGreaterThan(0);
    // 낙인은 적립을 다음 피해부터 담는다 — 한 대 더 때려 적립분을 만든다.
    engine.state.abilityZones = [];
    tower.cooldownLeft = 0;
    engine.update(0.02);
    const stored = enemy.brandStored ?? 0;
    expect(stored).toBeGreaterThan(0);

    engine.consumeEvents();
    engine.state.abilityZones = [];
    // 낙인이 살아 있는 동안 쓰러뜨린다. 이웃 체력을 더 낮춰 낙인 대상이
    // 마지막까지 유일한 최강자 — 곧 이번 공격의 대상 — 이게 한다.
    near.hp = 1;
    far.hp = 1;
    enemy.hp = 5;
    const nearHpBefore = near.hp;
    const farHpBefore = far.hp;
    const nearProgressBefore = near.progress;
    tower.cooldownLeft = 0;
    engine.update(0.02);
    expect(engine.state.enemies.some((candidate) => candidate.id === enemy.id)).toBe(false);

    const blast = abilityEvents(engine).find((event) => event.effect.includes("유폭"));
    expect(blast).toBeDefined();
    expect(nearHpBefore - near.hp).toBeGreaterThanOrEqual(stored * 0.5);
    // 반경 밖의 적은 직접 타격 범위 밖에 두었으므로 유폭으로는 상하지 않는다.
    expect(far.hp).toBe(farHpBefore);
    // 절대 원칙: 유폭은 피해만 번진다 — 주변 적을 뒤로 밀지 않는다.
    expect(near.progress).toBeGreaterThanOrEqual(nearProgressBefore);
  });

  it("전파 인원은 상한을 넘지 않고, 전파 피해는 다시 적립되지 않는다 — 연쇄 유폭 차단", () => {
    const definition = soloDemiseDefinition("KR");
    const engine = new GameEngine("skill-demise-cap", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    const radius = demiseSpreadRadius(null);
    // 반경 안에 상한보다 많은 이웃을 세운다. 체력을 낮춰 낙인 대상이 유일한
    // 최강자(= `strongest` 우선순위의 대상)로 고정되게 한다.
    const crowd = Array.from({ length: DEMISE_MAX_TARGETS + 3 }, (_, index) =>
      makeEnemy(-100 - index, "normal", { progress: progressAtDistance(enemy.progress, radius * (0.2 + index * 0.05)), hp: 50000 })
    );
    engine.state.enemies = [enemy, ...crowd];
    engine.update(0.02);
    engine.state.abilityZones = []; // 장판 틱을 배제한다.
    tower.cooldownLeft = 0;
    engine.update(0.02);
    const stored = enemy.brandStored ?? 0;
    expect(stored).toBeGreaterThan(0);

    // 이웃들에게도 유폭 낙인을 새겨 둔다 — 연쇄가 일어나면 여기서 드러난다.
    for (const neighbour of crowd) {
      neighbour.brandWuxing = tower.wuxing;
      neighbour.brandPower = 0.1;
      neighbour.brandUntil = engine.state.elapsed + WARFARE_BRAND_DURATION;
      neighbour.brandBlastRadius = radius;
      neighbour.brandStored = 0;
    }
    engine.consumeEvents();
    engine.state.abilityZones = [];
    for (const neighbour of crowd) neighbour.hp = 1;
    enemy.hp = 5;
    tower.cooldownLeft = 0;
    engine.update(0.02);
    const blast = abilityEvents(engine).find((event) => event.effect.includes("유폭"));
    expect(blast).toBeDefined();
    // 반경 안에 상한보다 많이 서 있어도 전파는 상한에서 끊긴다.
    expect(crowd.length).toBeGreaterThan(DEMISE_MAX_TARGETS);
    expect(blast!.targets).toBe(DEMISE_MAX_TARGETS);
    // 전파 피해는 이웃의 낙인에 적립되지 않는다 — 연쇄 유폭이 없다.
    for (const neighbour of crowd) expect(neighbour.brandStored ?? 0).toBe(0);
  });

  it("적립 비율은 받은 피해에 비례한다 — 낙인이 만료되면 적립도 멈춘다 (경계)", () => {
    const definition = soloDemiseDefinition("KR");
    const engine = new GameEngine("skill-demise-store", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    engine.update(0.02);
    const hpBefore = enemy.hp;
    tower.cooldownLeft = 0;
    engine.update(0.02);
    const storedAfterHit = enemy.brandStored ?? 0;
    expect(storedAfterHit).toBeGreaterThan(0);
    // 낙인이 사는 동안 받은 피해의 DEMISE_STORE_RATIO 만큼이 적립된다.
    expect(storedAfterHit).toBeCloseTo((hpBefore - enemy.hp) * DEMISE_STORE_RATIO, 4);

    // 낙인이 만료되면 더는 적립되지 않는다.
    enemy.brandUntil = engine.state.elapsed - 0.01;
    tower.cooldownLeft = 0;
    engine.update(0.02);
    expect(enemy.brandStored ?? 0).toBeCloseTo(storedAfterHit, 6);
  });
});

describe("[SKILL-V3] 획수 공명 (畫數共鳴)", () => {
  it("중첩은 같은 계급 동료 1기당 1이고 4에서 멈춘다 — 중첩 상한", () => {
    expect(strokeResonanceStacks(0)).toBe(0);
    expect(strokeResonanceStacks(1)).toBe(1);
    expect(strokeResonanceStacks(STROKE_RESONANCE_MAX_STACKS)).toBe(STROKE_RESONANCE_MAX_STACKS);
    expect(strokeResonanceStacks(STROKE_RESONANCE_MAX_STACKS + 9)).toBe(STROKE_RESONANCE_MAX_STACKS);
    expect(strokeResonanceStacks(-3)).toBe(0);
    expect(strokeResonanceCooldownScale(0)).toBeCloseTo(1, 6);
    expect(strokeResonanceCooldownScale(1)).toBeCloseTo(1 - STROKE_RESONANCE_HASTE_PER_STACK, 6);
    expect(strokeResonanceCooldownScale(99)).toBeCloseTo(1 - STROKE_RESONANCE_MAX_STACKS * STROKE_RESONANCE_HASTE_PER_STACK, 6);
    expect(STROKE_RESONANCE_ABILITY.category).toBe("graph");
  });

  it("같은 진의 같은 계급만 센다 — 다른 진·다른 계급·가방은 세지 않는다 (판정 경계)", () => {
    const engine = new GameEngine("skill-resonance-scope", "KR");
    engine.begin();
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0, 1, 2, 3, 4];
    const pool = [...getCatalog("KR").definitions.values()].filter(hasActiveSkills);
    const anchorStage = (pool[0] as HanziDefinition).stage;
    const sameRank = pool.filter((definition) => definition.stage === anchorStage);
    const otherRank = pool.find((definition) => definition.stage !== anchorStage);
    expect(sameRank.length).toBeGreaterThan(5);
    expect(otherRank).toBeDefined();

    // 1진(cell 0~15)에 같은 계급 3기.
    const trio = sameRank.slice(0, 3).map((definition, index) => makeTower(definition, 8000 + index, { cell: index }));
    // 같은 진의 다른 계급 1기 — 중첩에 끼지 않는다.
    const mismatched = makeTower(otherRank as HanziDefinition, 8100, { cell: 3 });
    // 다른 진(cell 16~31)의 같은 계급 1기 — 진 경계를 넘지 않는다.
    const neighbourFormation = makeTower(sameRank[3] as HanziDefinition, 8200, { cell: CELLS_PER_FORMATION });
    // 가방 자령(cell -1)은 진에 서 있지 않다.
    const stored = makeTower(sameRank[4] as HanziDefinition, 8300, { cell: -1 });
    engine.state.towers = [...trio, mismatched, neighbourFormation];
    engine.state.inventoryTowers = [stored];

    for (const tower of trio) expect(engine.strokeResonanceStacks(tower)).toBe(2);
    expect(engine.strokeResonanceStacks(mismatched)).toBe(0);
    expect(engine.strokeResonanceStacks(neighbourFormation)).toBe(0);
    expect(engine.strokeResonanceStacks(stored)).toBe(0);
    expect(engine.strokeResonanceStatus(mismatched)).toBeNull();
    expect(engine.strokeResonanceStatus(trio[0] as Tower)).toMatchObject({ stacks: 2 });
  });

  it("중첩만큼 공격 대기가 실제로 줄고, 상한 위로는 더 줄지 않는다", () => {
    const engine = new GameEngine("skill-resonance-cooldown", "KR");
    engine.begin();
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0];
    const pool = [...getCatalog("KR").definitions.values()].filter(hasActiveSkills);
    const definition = pool[0] as HanziDefinition;
    const sameRank = pool.filter((candidate) => candidate.stage === definition.stage);
    expect(sameRank.length).toBeGreaterThan(STROKE_RESONANCE_MAX_STACKS + 2);

    const solo = makeTower(definition, 8400, { cell: 0 });
    engine.state.towers = [solo];
    const soloCooldown = engine.towerAttackCooldown(solo);
    expect(engine.strokeResonanceStacks(solo)).toBe(0);

    // 동급 동료를 한 기씩 더한다 — 중첩 1·2·3·4 에서 대기가 계단처럼 줄어든다.
    for (let allies = 1; allies <= STROKE_RESONANCE_MAX_STACKS; allies += 1) {
      engine.state.towers = [
        solo,
        ...sameRank.slice(1, allies + 1).map((candidate, index) => makeTower(candidate, 8410 + index, { cell: index + 1 }))
      ];
      expect(engine.strokeResonanceStacks(solo)).toBe(allies);
      expect(engine.towerAttackCooldown(solo)).toBeCloseTo(soloCooldown * strokeResonanceCooldownScale(allies), 6);
    }

    // 상한을 넘겨도 더 줄지 않는다.
    const cappedCooldown = engine.towerAttackCooldown(solo);
    engine.state.towers = [
      solo,
      ...sameRank.slice(1, STROKE_RESONANCE_MAX_STACKS + 3).map((candidate, index) => makeTower(candidate, 8450 + index, { cell: index + 1 }))
    ];
    expect(engine.strokeResonanceStacks(solo)).toBe(STROKE_RESONANCE_MAX_STACKS);
    expect(engine.towerAttackCooldown(solo)).toBeCloseTo(cappedCooldown, 6);
  });

  it("자동배치와 공존한다 — 핀 고정된 봉인 자령도 그대로 세고, 배치 뒤엔 새 칸으로 다시 센다", () => {
    const engine = new GameEngine("skill-resonance-autoarrange", "KR");
    engine.begin();
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 2;
    engine.state.unlockedFormations = [0, 1, 2, 3, 4];
    engine.state.towers = [..."以心傳心"].map((char, index) => {
      const definition = getCatalog("KR").definitions.get(char) as HanziDefinition;
      return makeTower(definition, 8500 + index, { cell: index });
    });
    // 한 줄 봉인이 서면 그 네 자령은 자동배치에서 칸이 고정된다(핀).
    expect(engine.resolveIdiomFormations()).toBe(1);
    const pinned = engine.sealedIdiomTowerIds();
    expect(pinned.size).toBe(4);

    /** 지금 상태에서 손으로 센 같은 진·같은 계급 동료 수(상한 4). */
    const expectedStacks = (tower: Tower): number => {
      if (!engine.towerHasActiveSkills(tower)) return 0;
      const formation = Math.floor(tower.cell / CELLS_PER_FORMATION);
      const allies = engine.state.towers.filter((candidate) =>
        candidate.id !== tower.id
        && candidate.cell >= 0
        && Math.floor(candidate.cell / CELLS_PER_FORMATION) === formation
        && candidate.stage === tower.stage
      ).length;
      return Math.min(STROKE_RESONANCE_MAX_STACKS, allies);
    };

    // 핀 고정 여부와 무관하게, 진에 서 있으면 그대로 센다.
    for (const tower of engine.state.towers) {
      expect(pinned.has(tower.id)).toBe(true);
      expect(engine.strokeResonanceStacks(tower)).toBe(expectedStacks(tower));
    }

    const cellsBefore = new Map(engine.state.towers.map((tower) => [tower.id, tower.cell] as const));
    expect(engine.autoArrangeTowers()).toMatchObject({ ok: true });
    // 발동 중 봉인의 네 칸은 자동배치가 건드리지 않는다.
    for (const tower of engine.state.towers) expect(tower.cell).toBe(cellsBefore.get(tower.id));
    // 자동배치 뒤에도 공명은 "지금 칸" 기준으로 다시 계산된다.
    for (const tower of engine.state.towers) {
      expect(engine.strokeResonanceStacks(tower)).toBe(expectedStacks(tower));
    }
  });
});
