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
  commandRallySeconds,
  COMMAND_RALLY_CAP_SECONDS,
  REAPER_BOSS_CHIP_RATIO,
  REAPER_EXECUTE_CAP,
  reaperExecuteThreshold,
  SEMANTIC_ABILITY_TABLE,
  scorchZoneSeconds,
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

describe("[SKILL-V2] 참명 (斬命)", () => {
  it("처형 문턱 — 기본 12%, 캐주얼 별당 +1%p, 상한 15%를 절대 넘지 않는다", () => {
    expect(reaperExecuteThreshold(null)).toBeCloseTo(0.12, 6);
    expect(reaperExecuteThreshold(1)).toBeCloseTo(0.12, 6);
    expect(reaperExecuteThreshold(3)).toBeCloseTo(0.14, 6);
    expect(reaperExecuteThreshold(4)).toBeCloseTo(REAPER_EXECUTE_CAP, 6);
    expect(reaperExecuteThreshold(99)).toBeCloseTo(REAPER_EXECUTE_CAP, 6);
    expect(REAPER_EXECUTE_CAP).toBe(0.15);
  });

  it("문턱 이하의 일반 적은 즉시 소멸하고 보상은 정상 지급된다", () => {
    const definition = familyDefinition("KR", "reaper");
    const engine = new GameEngine("skill-reaper-execute", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition);
    enemy.hp = enemy.maxHp * 0.11; // 문턱 12% 바로 아래.
    const killsBefore = engine.state.killCount;
    const goldBefore = engine.state.gold;
    engine.update(0.02);
    expect(tower.shotCount).toBe(1);
    const events = engine.consumeEvents();
    expect(events.some((event) => event.type === "ability" && event.effect.includes("즉시 소멸"))).toBe(true);
    expect(events.find((event) => event.type === "kill")).toMatchObject({ type: "kill", reward: enemy.reward });
    expect(engine.state.enemies.some((candidate) => candidate.id === enemy.id)).toBe(false);
    expect(engine.state.killCount).toBe(killsBefore + 1);
    expect(engine.state.gold).toBeGreaterThanOrEqual(goldBefore + enemy.reward);
  });

  it("우두머리·정예는 즉시 소멸에 면역이고, 주기 공격이 현재 체력 3%를 벤다", () => {
    const definition = familyDefinition("KR", "reaper");
    const engine = new GameEngine("skill-reaper-immune", "KR");
    // 일반 공격 — 문턱 이하라도 우두머리는 살아남는다.
    const { tower, enemy: boss } = arrangeDuel(engine, definition);
    boss.boss = true;
    boss.archetype = "boss";
    boss.hp = boss.maxHp * 0.05;
    engine.update(0.02);
    expect(engine.state.enemies.some((candidate) => candidate.id === boss.id)).toBe(true);

    // 정예(철갑)도 면역이다.
    const elite = makeEnemy(-4, "armored", { progress: boss.progress, hp: 100000 * 0.05 });
    engine.state.enemies = [elite];
    tower.cooldownLeft = 0;
    engine.update(0.02);
    expect(engine.state.enemies.some((candidate) => candidate.id === elite.id)).toBe(true);

    // 주기 발동 — 우두머리에게 현재 체력 3% 고정 참격이 들어간다.
    const engine2 = new GameEngine("skill-reaper-chip", "KR");
    const { tower: tower2, enemy: boss2 } = arrangeDuel(engine2, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    boss2.boss = true;
    boss2.archetype = "boss";
    const hpBefore = boss2.hp;
    engine2.update(0.02);
    expect(tower2.shotCount % definition.combat.abilities.tuning.semanticEvery).toBe(0);
    const chipEvent = engine2.consumeEvents().some((event) => event.type === "ability" && event.effect.includes("참격"));
    expect(chipEvent).toBe(true);
    // 최소한 참격분(현재 체력 3% 언저리)은 깎였어야 한다.
    expect(hpBefore - boss2.hp).toBeGreaterThanOrEqual(hpBefore * REAPER_BOSS_CHIP_RATIO * 0.9);
    expect(engine2.state.enemies.some((candidate) => candidate.id === boss2.id)).toBe(true);
  });
});

describe("[SKILL-V2] 호령 (號令)", () => {
  it("집중 지속 — 기본 4초, 캐주얼 별당 +0.25초, 상한 6초", () => {
    expect(commandRallySeconds(null)).toBeCloseTo(4, 6);
    expect(commandRallySeconds(1)).toBeCloseTo(4, 6);
    expect(commandRallySeconds(8)).toBeCloseTo(5.75, 6);
    expect(commandRallySeconds(99)).toBeCloseTo(COMMAND_RALLY_CAP_SECONDS, 6);
  });

  it("발동하면 같은 진 자령이 시전자의 대상을 집중 공격한다 — 대상 공유·진 경계·만료", () => {
    const commander = familyDefinition("KR", "command");
    const ally = familyDefinition("KR", "gate", (definition) => definition.combat.abilities.targetPriority === "front");
    const engine = new GameEngine("skill-command-rally", "KR");
    engine.begin();
    const commandTower = makeTower(commander, 9500, {
      cell: 0,
      shotCount: commander.combat.abilities.tuning.semanticEvery - 1
    });
    const allyTower = makeTower(ally, 9501, { cell: 1, cooldownLeft: 999 });
    engine.state.towers = [commandTower, allyTower];
    engine.state.summonCount = 2;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0];
    engine.consumeEvents();
    engine.startWaveEarly();
    const near = progressNearCell(0);
    // strongest(호령 대상)와 front(동료의 평소 대상)를 서로 다른 적으로 갈라 둔다.
    const strongest = makeEnemy(-7, "normal", { progress: near, hp: 100000, maxHp: 100000 });
    const front = makeEnemy(-6, "normal", { progress: Math.min(0.99, near + 0.004), hp: 500, maxHp: 500 });
    engine.state.enemies = [strongest, front];
    engine.state.spawned = 9999;
    engine.update(0.02);
    expect(commandTower.shotCount % commander.combat.abilities.tuning.semanticEvery).toBe(0);
    const rally = engine.commandRallyAt(0);
    expect(rally?.targetId).toBe(strongest.id);
    // 다른 진에는 집중 명령이 없다.
    expect(engine.commandRallyAt(1)).toBeNull();
    // 동료의 다음 공격은 평소 우선순위(front) 대신 공유 대상(strongest)을 노린다.
    // (호령 발동이 깐 오행 장판의 틱 피해가 섞이므로 판정은 탄도 이벤트로 본다.)
    const allyOrigin = BOARD_CELLS[allyTower.cell]!;
    commandTower.cooldownLeft = 999;
    allyTower.cooldownLeft = 0;
    engine.consumeEvents();
    engine.update(0.02);
    const allyShots = engine.consumeEvents().filter(
      (event): event is Extract<import("../src/core/types").GameEvent, { type: "shot" }> =>
        event.type === "shot" && event.from.x === allyOrigin.x && event.from.y === allyOrigin.y
    );
    expect(allyShots.length).toBeGreaterThan(0);
    const strongestPoint = positionOnPath(strongest.progress);
    for (const shot of allyShots) {
      expect(Math.hypot(shot.to.x - strongestPoint.x, shot.to.y - strongestPoint.y)).toBeLessThan(1);
    }
    // 공유 대상이 사라지면(사거리 밖과 같은 경로) 평소 우선순위로 돌아간다.
    engine.state.enemies = [front];
    allyTower.cooldownLeft = 0;
    engine.consumeEvents();
    engine.update(0.02);
    const fallbackShots = engine.consumeEvents().filter(
      (event): event is Extract<import("../src/core/types").GameEvent, { type: "shot" }> =>
        event.type === "shot" && event.from.x === allyOrigin.x && event.from.y === allyOrigin.y
    );
    expect(fallbackShots.length).toBeGreaterThan(0);
    const frontPoint = positionOnPath(front.progress);
    for (const shot of fallbackShots) {
      expect(Math.hypot(shot.to.x - frontPoint.x, shot.to.y - frontPoint.y)).toBeLessThan(1);
    }
    // 지속 시간이 끝나면 명령은 소멸한다.
    engine.state.elapsed += COMMAND_RALLY_CAP_SECONDS + 0.01;
    expect(engine.commandRallyAt(0)).toBeNull();
  });
});

describe("[SKILL-V2] 소흔 (燒痕)", () => {
  it("잔불 지속 — 기본 2.5초, 캐주얼 별당 +0.2초", () => {
    expect(scorchZoneSeconds(null)).toBeCloseTo(2.5, 6);
    expect(scorchZoneSeconds(1)).toBeCloseTo(2.5, 6);
    expect(scorchZoneSeconds(8)).toBeCloseTo(3.9, 6);
  });

  it("처치한 자리에 잔불이 남고 밟는 적이 초당 피해를 입는다 — 트리거는 처치뿐", () => {
    const definition = familyDefinition("KR", "scorch");
    const engine = new GameEngine("skill-scorch-ember", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition);
    // 처치 전에는 잔불이 없다 — 주기 발동으로는 생기지 않는다.
    for (let step = 0; step < 10; step += 1) {
      tower.cooldownLeft = 0;
      engine.update(0.02);
    }
    expect(engine.state.abilityZones).toHaveLength(0);
    // 마지막 적 처치로 웨이브가 끝나 combat 이 닫히지 않게, 멀리 닻 적을 세워 둔다.
    const anchor = makeEnemy(-3, "normal", { progress: (progressNearCell(tower.cell) + 0.5) % 1 });
    engine.state.enemies = [enemy, anchor];
    // 처치 순간 잔불이 깔린다.
    enemy.hp = 1;
    tower.cooldownLeft = 0;
    engine.update(0.02);
    expect(engine.state.enemies.some((candidate) => candidate.id === enemy.id)).toBe(false);
    const zone = engine.state.abilityZones.find((candidate) => candidate.towerId === tower.id);
    expect(zone?.kind).toBe("ember");
    expect(zone?.damagePerSecond ?? 0).toBeGreaterThan(0);
    expect((zone?.expiresAt ?? 0) - engine.state.elapsed).toBeCloseTo(scorchZoneSeconds(null), 1);
    // 잔불 위에 선 다음 적은 초당 피해를 입는다 — 뒤로 밀리지는 않는다.
    const follower = makeEnemy(-4, "normal", { progress: zone!.progress });
    engine.state.enemies = [follower, anchor];
    tower.cooldownLeft = 999; // 직접 타격을 잠그고 잔불 피해만 본다.
    const hpBefore = follower.hp;
    const progressBefore = follower.progress;
    for (let step = 0; step < 10; step += 1) engine.update(0.05);
    expect(follower.hp).toBeLessThan(hpBefore);
    expect(follower.progress).toBeGreaterThanOrEqual(progressBefore);
  });
});
