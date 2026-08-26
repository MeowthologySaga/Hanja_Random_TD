/*
 * [SKILL-V1] 스킬 1차 세트 5종 단위·통합 테스트.
 *
 *  1. 상극 각인(克印) — 낙인 증폭 계산과 낙인 부여
 *  2. 파죽(破竹) — 연속 타격 중첩과 대상 변경 초기화
 *  3. 성어의 가호 — 발동 중/흩어짐 온오프
 *  4. 귀천(歸天) — 보스·정예 면역과 정상 보상 정화
 *  5. 서리길(霜路) — 감속 캡 60%와 서리 지대 부여
 * 공통 원칙: 어떤 스킬도 적을 뒤로 밀지 않는다(감속·정지·즉시 소멸만).
 */
import { describe, expect, it } from "vitest";
import {
  FROST_SLOW_CAP,
  GWICHEON_ABILITY,
  MOMENTUM_STACK_BONUS,
  SEMANTIC_ABILITY_TABLE,
  WARFARE_BRAND_DURATION,
  frostSlowRatio,
  gwicheonChargeSeconds,
  hasActiveSkills,
  idiomBlessingBonus,
  momentumMaxStacks,
  semanticCharGroup,
  warfareBrandPower
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
  const tower = makeTower(definition, 9300, towerOverrides);
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

describe("[SKILL-V1] 신설 의미 계열 글자군", () => {
  it("warfare·momentum·frost 글자군이 기존 글자군과 겹치지 않는다", () => {
    const families = Object.keys(SEMANTIC_ABILITY_TABLE) as SemanticFamily[];
    expect(families).toContain("warfare");
    expect(families).toContain("momentum");
    expect(families).toContain("frost");
    const groupFamilies = families.filter((family): family is Exclude<SemanticFamily, "general"> => family !== "general");
    for (const family of ["warfare", "momentum", "frost"] as const) {
      const group = semanticCharGroup(family);
      expect(group.size).toBeGreaterThan(0);
      for (const other of groupFamilies) {
        if (other === family) continue;
        for (const char of group) {
          expect(semanticCharGroup(other).has(char), `${char} 는 ${family} 와 ${other} 에 동시에 있으면 안 됩니다`).toBe(false);
        }
      }
    }
    // 進은 motion 소속이므로 momentum 에 없어야 한다.
    expect(semanticCharGroup("momentum").has("進")).toBe(false);
    expect(semanticCharGroup("motion").has("進")).toBe(true);
  });

  it("weather 에서 한기 글자를 뗀 잔여 구성을 보존한다 (weather 7자 · frost 4자)", () => {
    const weather = semanticCharGroup("weather");
    const frost = semanticCharGroup("frost");
    expect([...frost].sort().join("")).toBe([..."霜雪寒冬"].sort().join(""));
    expect(weather.size).toBe(7);
    expect(frost.size).toBe(4);
    for (const char of frost) expect(weather.has(char)).toBe(false);
  });
});

describe("[SKILL-V1] 상극 각인 (克印)", () => {
  it("낙인 증폭 계산 — 기본 18%, 캐주얼 별당 +2%p", () => {
    expect(warfareBrandPower(null)).toBeCloseTo(0.18, 6);
    expect(warfareBrandPower(1)).toBeCloseTo(0.18, 6);
    expect(warfareBrandPower(5)).toBeCloseTo(0.26, 6);
    expect(warfareBrandPower(8)).toBeCloseTo(0.32, 6);
  });

  it("N번째 공격이 적에게 자기 오행의 낙인을 4초 새긴다", () => {
    const definition = familyDefinition("KR", "warfare");
    const engine = new GameEngine("skill-warfare", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    engine.update(0.02);
    expect(tower.shotCount % definition.combat.abilities.tuning.semanticEvery).toBe(0);
    expect(enemy.brandWuxing).toBe(tower.wuxing);
    expect(enemy.brandPower).toBeCloseTo(0.18, 6);
    expect(enemy.brandUntil).toBeGreaterThan(engine.state.elapsed);
    expect((enemy.brandUntil ?? 0) - engine.state.elapsed).toBeLessThanOrEqual(WARFARE_BRAND_DURATION);
    // 절대 원칙: 낙인은 적을 밀지 않는다 — 진행도는 그대로거나 앞으로만 간다.
    expect(enemy.progress).toBeGreaterThanOrEqual(progressNearCell(tower.cell));
  });
});

describe("[SKILL-V1] 파죽 (破竹)", () => {
  it("최대 중첩 = 5 + floor(계급/2)", () => {
    expect(momentumMaxStacks(1)).toBe(5);
    expect(momentumMaxStacks(5)).toBe(7);
    expect(momentumMaxStacks(8)).toBe(9);
    expect(MOMENTUM_STACK_BONUS).toBeCloseTo(0.08, 6);
  });

  it("같은 적 연속 타격에 쌓이고 대상을 바꾸면 초기화된다", () => {
    const definition = familyDefinition("KR", "momentum");
    const engine = new GameEngine("skill-momentum", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition);
    for (let step = 0; step < 60 && (tower.momentumStacks ?? 0) < 2; step += 1) engine.update(0.1);
    expect(tower.momentumTargetId).toBe(enemy.id);
    expect(tower.momentumStacks ?? 0).toBeGreaterThanOrEqual(2);
    // 대상 교체 — 새 적에게 첫 타격은 중첩 0에서 다시 시작한다.
    const replacement = makeEnemy(-4, "normal", { progress: enemy.progress });
    engine.state.enemies = [replacement];
    tower.cooldownLeft = 0;
    engine.update(0.02);
    expect(tower.momentumTargetId).toBe(replacement.id);
    expect(tower.momentumStacks).toBe(0);
  });
});

describe("[SKILL-V1] 성어의 가호", () => {
  it("발동 중 성어가 선 진에만 +10%, 같은 진 추가 성어당 +5%p, 흩어지면 즉시 소멸", () => {
    expect(idiomBlessingBonus(0)).toBe(0);
    expect(idiomBlessingBonus(1)).toBeCloseTo(0.1, 6);
    expect(idiomBlessingBonus(3)).toBeCloseTo(0.2, 6);
    const engine = new GameEngine("skill-blessing", "KR");
    engine.begin();
    expect(engine.idiomBlessingBonusAt(0)).toBe(0);
    engine.state.idiomSeals.push({ idiomId: "test-a", cells: [0, 1, 2, 3], completedAt: 0, active: true });
    expect(engine.idiomBlessingBonusAt(0)).toBeCloseTo(0.1, 6);
    expect(engine.idiomBlessingBonusAt(1)).toBe(0);
    engine.state.idiomSeals.push({ idiomId: "test-b", cells: [4, 5, 6, 7], completedAt: 0, active: true });
    expect(engine.idiomBlessingBonusAt(0)).toBeCloseTo(0.15, 6);
    // 다른 진의 성어는 그 진의 가호로만 선다.
    engine.state.idiomSeals.push({ idiomId: "test-c", cells: [16, 17, 18, 19], completedAt: 0, active: true });
    expect(engine.idiomBlessingBonusAt(0)).toBeCloseTo(0.15, 6);
    expect(engine.idiomBlessingBonusAt(1)).toBeCloseTo(0.1, 6);
    // 줄이 흩어지면(active=false) 가호도 즉시 꺼진다.
    engine.state.idiomSeals[0]!.active = false;
    expect(engine.idiomBlessingBonusAt(0)).toBeCloseTo(0.1, 6);
    engine.state.idiomSeals[1]!.active = false;
    expect(engine.idiomBlessingBonusAt(0)).toBe(0);
  });
});

describe("[SKILL-V1] 귀천 (歸天)", () => {
  it("충전 시간 — 6★ 30초, 별당 −2초", () => {
    expect(gwicheonChargeSeconds(6)).toBe(30);
    expect(gwicheonChargeSeconds(7)).toBe(28);
    expect(gwicheonChargeSeconds(8)).toBe(26);
  });

  it("우두머리·정예는 면역이고 가장 오래 산 일반 적만 고른다", () => {
    const engine = new GameEngine("skill-gwicheon-immune", "KR", "casual");
    engine.begin();
    engine.state.enemies = [
      makeEnemy(-9, "boss"),
      makeEnemy(-8, "armored"),
      makeEnemy(-5, "normal"),
      makeEnemy(-4, "swarm")
    ];
    expect(engine.findGwicheonTarget()?.id).toBe(-5);
    engine.state.enemies = [makeEnemy(-9, "boss"), makeEnemy(-8, "armored")];
    expect(engine.findGwicheonTarget()).toBeUndefined();
  });

  it("충전이 차면 자동 발동해 즉시 소멸시키되 보상은 정상 지급한다", () => {
    const definition = [...getCatalog("KR").definitions.values()].find((candidate) => hasActiveSkills(candidate))!;
    const engine = new GameEngine("skill-gwicheon-cast", "KR", "casual");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      casualStar: 6,
      naturalStar: 6,
      cooldownLeft: 999, // 일반 공격이 정화 판정에 끼어들지 않게 잠근다.
      ascendCharge: gwicheonChargeSeconds(6) - 0.01
    });
    enemy.hp = 40;
    enemy.maxHp = 40;
    const goldBefore = engine.state.gold;
    const killsBefore = engine.state.killCount;
    engine.update(0.05);
    const events = engine.consumeEvents();
    const cast = events.find((event) => event.type === "ability" && event.name === GWICHEON_ABILITY.name);
    expect(cast).toBeDefined();
    // 정화도 처치 경로를 그대로 지나므로 보상 이벤트가 정상 액수로 남는다.
    const kill = events.find((event) => event.type === "kill");
    expect(kill).toMatchObject({ type: "kill", reward: enemy.reward });
    expect(engine.state.enemies.some((candidate) => candidate.id === enemy.id)).toBe(false);
    // 마지막 적 정화로 웨이브가 끝나며 웨이브 보상·이자가 더해질 수 있다 — 하한만 본다.
    expect(engine.state.gold).toBeGreaterThanOrEqual(goldBefore + enemy.reward);
    expect(engine.state.killCount).toBe(killsBefore + 1);
    expect(tower.ascendCharge).toBe(0);
  });
});

describe("[SKILL-V1] 서리길 (霜路)", () => {
  it("감속률은 기본 25%, 별당 +2%p, 총 감속 60%를 절대 넘지 않는다", () => {
    expect(frostSlowRatio(null)).toBeCloseTo(0.25, 6);
    expect(frostSlowRatio(1)).toBeCloseTo(0.25, 6);
    expect(frostSlowRatio(8)).toBeCloseTo(0.39, 6);
    expect(frostSlowRatio(99)).toBeCloseTo(FROST_SLOW_CAP, 6);
    expect(FROST_SLOW_CAP).toBe(0.6);
  });

  it("N번째 공격 지점에 서리 지대를 깔고 밟는 적을 감속시킨다 — 피해·밀치기 없음", () => {
    const definition = familyDefinition("KR", "frost");
    const engine = new GameEngine("skill-frost", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    const progressBefore = enemy.progress;
    engine.update(0.02);
    const zone = engine.state.abilityZones.find((candidate) => candidate.towerId === tower.id);
    expect(zone?.kind).toBe("frost");
    expect(zone?.damagePerSecond).toBe(0);
    expect(zone?.slowFactor).toBeCloseTo(0.75, 6);
    engine.update(0.1);
    expect(enemy.slowFactor).toBeLessThanOrEqual(0.7500001);
    expect(enemy.slowFactor).toBeGreaterThanOrEqual(0.38);
    // 절대 원칙: 서리길은 적을 뒤로 밀지 않는다.
    expect(enemy.progress).toBeGreaterThanOrEqual(progressBefore);
  });
});
