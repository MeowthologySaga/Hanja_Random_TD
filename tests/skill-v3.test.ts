/*
 * [SKILL-V3] 스킬 3차 세트 단위·통합 테스트.
 *
 *  1. 유폭 낙인(同歸) — 낙인 적립·전파 반경·전파 인원 상한·연쇄 유폭 차단
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
  WARFARE_BRAND_DURATION
} from "../src/core/abilities";
import { BOARD_CELLS, positionOnPath } from "../src/core/content";
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

  it("적립 비율은 받은 피해에 비례한다 — 낙인이 만료되면 적립도 멈춘다", () => {
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
