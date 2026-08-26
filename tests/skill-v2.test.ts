/*
 * [SKILL-V2] 스킬 2차 세트 5종 단위·통합 테스트.
 *
 *  1. 연환 인장(連環) — 스택 적립·시간 만료 리셋·상한 폭발 + 제자리 봉인
 *  2. 참명(斬命) — 처형 문턱 상한 15%·일반 적 즉시 소멸·보스/정예 면역·참격
 *  3. 호령(號令) — 같은 진 집중 대상 공유·진 경계·만료
 *  4. 소흔(燒痕) — 처치 지점 잔불 지속·초당 피해
 *  5. 채기(采氣) — N번째 처치 문기 주기
 * 공통 원칙: 어떤 스킬도 적을 뒤로 밀지 않는다(감속·정지·즉시 소멸만).
 */
import { describe, expect, it } from "vitest";
import {
  CHAINSEAL_SEAL_SECONDS,
  chainsealMaxStacks,
  SEMANTIC_ABILITY_TABLE,
  hasActiveSkills,
  semanticCharGroup
} from "../src/core/abilities";
import { BOARD_CELLS, positionOnPath } from "../src/core/content";
import { GameEngine } from "../src/core/game";
import { getCatalog } from "../src/core/hanzi";
import type { Enemy, EnemyArchetype, HanziDefinition, SemanticFamily, Tower } from "../src/core/types";

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

function familyDefinition(region: "KR" | "JP" | "CN", family: SemanticFamily, filter: (definition: HanziDefinition) => boolean = () => true): HanziDefinition {
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

describe("[SKILL-V2] 신설 의미 계열 글자군", () => {
  it("chainseal·reaper·command·scorch·harvest 글자군이 기존 글자군과 겹치지 않는다", () => {
    const families = Object.keys(SEMANTIC_ABILITY_TABLE) as SemanticFamily[];
    for (const family of ["chainseal", "reaper", "command", "scorch", "harvest"] as const) {
      expect(families).toContain(family);
    }
    const groupFamilies = families.filter((family): family is Exclude<SemanticFamily, "general"> => family !== "general");
    for (const family of ["chainseal", "reaper", "command", "scorch", "harvest"] as const) {
      const group = semanticCharGroup(family);
      expect(group.size).toBeGreaterThan(0);
      for (const other of groupFamilies) {
        if (other === family) continue;
        for (const char of group) {
          expect(semanticCharGroup(other).has(char), `${char} 는 ${family} 와 ${other} 에 동시에 있으면 안 됩니다`).toBe(false);
        }
      }
    }
    // 連은 momentum 소속을 유지한다 — chainseal 은 環結絲 계열로만 구성했다.
    expect(semanticCharGroup("momentum").has("連")).toBe(true);
    expect(semanticCharGroup("chainseal").has("連")).toBe(false);
  });
});

describe("[SKILL-V2] 연환 인장 (連環)", () => {
  it("최대 스택 = 3 + floor(계급/3)", () => {
    expect(chainsealMaxStacks(1)).toBe(3);
    expect(chainsealMaxStacks(3)).toBe(4);
    expect(chainsealMaxStacks(5)).toBe(4);
    expect(chainsealMaxStacks(8)).toBe(5);
  });

  it("공격마다 스택이 쌓이고 시간 창이 지나면 처음부터 다시 쌓인다 — 스택 리셋", () => {
    const definition = familyDefinition("KR", "chainseal");
    const engine = new GameEngine("skill-chainseal-reset", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition);
    engine.update(0.02);
    expect(tower.shotCount).toBe(1);
    expect(enemy.sealStacks).toBe(1);
    expect(enemy.sealStored ?? 0).toBeGreaterThan(0);
    // 시간 창 만료를 흉내 낸다 — 다음 적중은 1스택부터 다시 시작해야 한다.
    enemy.sealUntil = engine.state.elapsed - 0.01;
    tower.cooldownLeft = 0;
    engine.update(0.02);
    expect(enemy.sealStacks).toBe(1);
  });

  it("상한 도달 시 누적 피해가 터지고 1.2초 제자리 봉인이 걸린다 — 밀치기 없음", () => {
    const definition = familyDefinition("KR", "chainseal");
    const engine = new GameEngine("skill-chainseal-burst", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition);
    const cap = chainsealMaxStacks(tower.stage);
    const progressBefore = enemy.progress;
    let burstEvent: Extract<import("../src/core/types").GameEvent, { type: "ability" }> | undefined;
    for (let step = 0; step < 200 && !burstEvent; step += 1) {
      tower.cooldownLeft = 0;
      engine.update(0.02);
      burstEvent = engine.consumeEvents().find(
        (event): event is Extract<import("../src/core/types").GameEvent, { type: "ability" }> =>
          event.type === "ability" && event.effect.includes("연환 폭발")
      );
    }
    expect(burstEvent).toBeDefined();
    expect(tower.shotCount).toBeGreaterThanOrEqual(cap);
    // 폭발 후 스택은 0으로 리셋되고 적은 제자리에 봉인된다.
    expect(enemy.sealStacks).toBe(0);
    expect(enemy.sealStored ?? 0).toBe(0);
    expect(enemy.stunnedUntil).toBeGreaterThan(engine.state.elapsed);
    expect(enemy.stunnedUntil - engine.state.elapsed).toBeLessThanOrEqual(CHAINSEAL_SEAL_SECONDS + 0.0001);
    // 절대 원칙: 봉인은 정지일 뿐, 진행도를 되돌리지 않는다.
    expect(enemy.progress).toBeGreaterThanOrEqual(progressBefore);
  });
});
