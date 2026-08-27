/*
 * [SKILL-V3] 스킬 3차 세트 단위·통합 테스트.
 *
 *  1. 유폭 낙인(同歸) — 낙인 적립·전파 반경·전파 인원 상한·연쇄 유폭 차단
 *  2. 획수 공명(畫數共鳴) — 같은 진·같은 계급 중첩 상한·진 경계·자동배치 간섭
 *  3. 진흙밭(泥田) — 무효화 대상(장갑·재생) 실재·무효 판정·이동 불간섭
 *  4. 회향(回響) — 3합 여운 지속·전투 전용 시계·공격 가산·모드 경계
 *
 * 기획서(15종) 가운데 남은 항목은 수성(守成) 하나이며, 판정 정의가 서지 않아
 * 구현하지 않았다 — 사유는 트랙 보고에 실측과 함께 남겼다.
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
  ECHO_BASE_SECONDS,
  ECHO_CAP_SECONDS,
  ECHO_DAMAGE_BONUS,
  ECHO_PER_STAR,
  echoSeconds,
  hasActiveSkills,
  MIRE_MIN_ENEMIES,
  MIRE_SUPPRESS_GRACE,
  MIRE_ZONE_SECONDS,
  SEMANTIC_ABILITY_TABLE,
  semanticCharGroup,
  STROKE_RESONANCE_ABILITY,
  STROKE_RESONANCE_HASTE_PER_STACK,
  STROKE_RESONANCE_MAX_STACKS,
  strokeResonanceCooldownScale,
  strokeResonanceStacks,
  WARFARE_BRAND_DURATION
} from "../src/core/abilities";
import { casualNaturalStar } from "../src/core/casual";
import { BOARD_CELLS, CELLS_PER_FORMATION, positionOnPath, wavePlan } from "../src/core/content";
import { GameEngine } from "../src/core/game";
import { getCatalog } from "../src/core/hanzi";
import type { CasualStar, Enemy, EnemyArchetype, GameEvent, HanziDefinition, SemanticFamily, Tower, Wuxing } from "../src/core/types";

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

/** 잠금·목표·성어·일반 합성식 어디에도 걸리지 않는 같은 오행·같은 별 정의들. */
function safeCasualDefinitions(engine: GameEngine, count: number): HanziDefinition[] {
  const parentChars = new Set(engine.catalog.recipes.flatMap((definition) => definition.parents));
  const targetPath = engine.evolution.getTargetPath(engine.state.targetChar);
  const idiomChars = new Set(engine.idioms().flatMap((idiom) => [...idiom.chars]));
  const grouped = new Map<string, HanziDefinition[]>();
  for (const definition of engine.catalog.activePool) {
    const star = casualNaturalStar(definition.char);
    if (star === null || star >= 8) continue;
    if (parentChars.has(definition.char) || targetPath.has(definition.char) || idiomChars.has(definition.char)) continue;
    const key = `${definition.wuxing}:${star}`;
    const group = grouped.get(key) ?? [];
    group.push(definition);
    grouped.set(key, group);
    if (group.length >= count) return group.slice(0, count);
  }
  throw new Error(`No safe casual fixture of size ${count} found`);
}

/** 이 지역 로스터에서 자연 별이 정확히 `star` 인 정의들(획수 공명 무대용). */
function starPool(engine: GameEngine, star: CasualStar): HanziDefinition[] {
  return [...engine.catalog.definitions.values()].filter((definition) => casualNaturalStar(definition.char) === star);
}

function casualTower(definition: HanziDefinition, id: number, cell: number, star: CasualStar): Tower {
  return {
    ...makeTower(definition, id, { cell }),
    concentration: 0,
    concentrationPath: null,
    naturalStar: casualNaturalStar(definition.char) ?? undefined,
    casualStar: star
  };
}

/** 캐주얼 1기 대치 장면 — 회향 여운이 실제 피해에 얹히는지 재기 위한 무대. */
function casualDuel(seed: string, tower: Tower): { engine: GameEngine; enemy: Enemy } {
  const engine = new GameEngine(seed, "KR", "casual");
  engine.begin();
  engine.state.towers = [tower];
  engine.state.summonCount = 1;
  engine.state.startingFormationIndex = 0;
  engine.state.unlockedFormations = [0];
  engine.consumeEvents();
  engine.startWaveEarly();
  const enemy = makeEnemy(-30, "normal", { progress: progressNearCell(tower.cell), weakness: "木" });
  engine.state.enemies = [enemy];
  engine.state.spawned = 9999;
  return { engine, enemy };
}

describe("[SKILL-V3] 신설 글자군", () => {
  it("3차 글자군은 실존 로스터 글자로만 이뤄지고 기존 글자군과 겹치지 않는다", () => {
    const families = Object.keys(SEMANTIC_ABILITY_TABLE) as SemanticFamily[];
    const introduced = ["demise", "mire"] as const;
    for (const family of introduced) expect(families).toContain(family);
    const groupFamilies = families.filter((family): family is Exclude<SemanticFamily, "general"> => family !== "general");
    for (const family of introduced) {
      const group = semanticCharGroup(family);
      expect(group.size).toBeGreaterThan(0);
      for (const char of group) {
        for (const other of groupFamilies) {
          if (other === family) continue;
          expect(semanticCharGroup(other).has(char), `${char} 는 ${family} 와 ${other} 에 동시에 있으면 안 됩니다`).toBe(false);
        }
        const rosters = REGIONS.filter((region) => getCatalog(region).definitions.has(char));
        expect(rosters.length, `${char} 는 어느 지역 로스터에도 없습니다`).toBeGreaterThan(0);
      }
    }
    // 滅은 참명(reaper), 土·地는 mountain 이 선점한 글자다 — 3차가 가져가지 않았다.
    expect(semanticCharGroup("demise").has("滅")).toBe(false);
    expect(semanticCharGroup("mire").has("土")).toBe(false);
    expect(semanticCharGroup("mire").has("地")).toBe(false);
  });

  it("세 지역 모두 3차 계열을 쓰는 활성 자령을 가진다", () => {
    for (const region of REGIONS) {
      expect(familyDefinition(region, "demise").char).toBeTruthy();
      expect(familyDefinition(region, "mire").char).toBeTruthy();
    }
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

describe("[SKILL-V3] 진흙밭 (泥田)", () => {
  it("무효화 대상이 실제로 존재한다 — 정예 철갑의 장갑, 회생 요괴의 재생, 우두머리의 둘 다", () => {
    // 스킬이 지울 수 있는 적 고유 방어 특성은 웨이브 계획에 실제로 실려 있다.
    const armored = [...Array(100).keys()].map((index) => wavePlan(index + 1)).filter((plan) => plan.archetype === "armored");
    const regenerators = [...Array(100).keys()].map((index) => wavePlan(index + 1)).filter((plan) => plan.archetype === "regenerator");
    const bosses = [...Array(100).keys()].map((index) => wavePlan(index + 1)).filter((plan) => plan.boss);
    expect(armored.length).toBeGreaterThan(0);
    expect(regenerators.length).toBeGreaterThan(0);
    expect(bosses.length).toBeGreaterThan(0);
    for (const plan of armored) expect(plan.armor).toBeGreaterThan(0);
    for (const plan of regenerators) expect(plan.regen).toBeGreaterThan(0);
    for (const plan of bosses) {
      expect(plan.armor).toBeGreaterThan(0);
      expect(plan.regen).toBeGreaterThan(0);
    }
    // 반대로 일반·무리·질풍은 지울 특성이 없다 — 진흙밭이 이들에게는 아무 일도 안 한다.
    const plain = [...Array(100).keys()].map((index) => wavePlan(index + 1))
      .filter((plan) => !plan.boss && ["normal", "swarm", "swift"].includes(plan.archetype));
    expect(plain.length).toBeGreaterThan(0);
    for (const plan of plain) {
      expect(plan.armor).toBe(0);
      expect(plan.regen).toBe(0);
    }
  });

  it("길목에 4초 지대를 깔고, 밟는 적의 장갑·재생을 무효로 만든다 — 이동은 그대로다", () => {
    const definition = familyDefinition("KR", "mire");
    const engine = new GameEngine("skill-mire-zone", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    // 충전 조건을 채운다 — 붐빌 때만 깔린다.
    const crowd = Array.from({ length: MIRE_MIN_ENEMIES }, (_, index) =>
      makeEnemy(-200 - index, "normal", { progress: (enemy.progress + 0.35 + index * 0.03) % 1, hp: 50000 })
    );
    // 철갑 + 회생을 한 몸에 지닌 적으로 두 특성을 한 번에 본다.
    enemy.archetype = "armored";
    enemy.armor = 0.4;
    enemy.regenPerSecond = 500;
    enemy.hp = enemy.maxHp * 0.5;
    engine.state.enemies = [enemy, ...crowd];

    engine.update(0.02);
    const zone = engine.state.abilityZones.find((candidate) => candidate.towerId === tower.id);
    expect(zone?.kind).toBe("mire");
    // 진흙밭은 자기 오행 장판을 대체하므로 그 장판의 초당 피해를 그대로 인다.
    expect(zone?.damagePerSecond ?? 0).toBeGreaterThan(0);
    expect((zone?.expiresAt ?? 0) - engine.state.elapsed).toBeCloseTo(MIRE_ZONE_SECONDS, 1);
    // 지대는 자령이 쏜 뒤에 깔리므로 무효 판정은 다음 프레임의 장판 갱신에서 켜진다.
    expect(engine.enemyTraitsSuppressed(enemy)).toBe(false);
    tower.cooldownLeft = 999; // 직접 타격을 잠그고 지대 효과만 본다.
    engine.update(0.02);
    expect(engine.enemyTraitsSuppressed(enemy)).toBe(true);

    // 재생 무효: 초당 재생(500)은 장판 초당 피해(20 남짓)보다 스무 배 넘게 크다.
    // 재생이 살아 있었다면 체력은 반드시 올랐어야 한다 — 내려갔다는 것이 곧
    // 재생이 꺼졌다는 증거다.
    expect(enemy.regenPerSecond).toBeGreaterThan((zone?.damagePerSecond ?? 0) * 5);
    const hpBefore = enemy.hp;
    const progressBefore = enemy.progress;
    const stunnedBefore = enemy.stunnedUntil;
    for (let step = 0; step < 10; step += 1) engine.update(0.05);
    expect(enemy.hp).toBeLessThan(hpBefore);
    expect(engine.enemyTraitsSuppressed(enemy)).toBe(true);
    // 절대 원칙: 진흙밭은 걸음을 건드리지 않는다 — 새로 묶거나 되돌리지 않는다.
    expect(enemy.stunnedUntil).toBe(stunnedBefore);
    expect(enemy.progress).toBeGreaterThanOrEqual(progressBefore);
  });

  it("지대 자체는 이동에 아무 손도 대지 않는다 — 감속·정지·후퇴 0 (절대 원칙)", () => {
    const engine = new GameEngine("skill-mire-motion", "KR");
    engine.begin();
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0];
    engine.startWaveEarly();
    engine.state.towers = []; // 자령이 없는 판 — 오직 지대만 작동한다.
    engine.state.spawned = 9999;
    const walker = makeEnemy(-13, "armored", { armor: 0.45, regenPerSecond: 400, hp: 5000, progress: 0.42, speed: 0.02 });
    const anchor = makeEnemy(-14, "normal", { progress: 0.9 });
    engine.state.enemies = [walker, anchor];
    engine.state.abilityZones = [{
      id: 7001,
      towerId: -1,
      kind: "mire",
      wuxing: "土",
      progress: walker.progress,
      radius: 400, // 걷는 내내 지대를 벗어나지 않게 넉넉히 잡는다.
      damagePerSecond: 0,
      expiresAt: engine.state.elapsed + 60,
      color: "#c2a06a"
    }];

    // 첫 프레임은 적 갱신이 장판 갱신보다 앞서므로 재생이 한 번 들어간다.
    // 무효 판정이 켜진 뒤부터를 잰다.
    engine.update(0.05);
    expect(engine.enemyTraitsSuppressed(walker)).toBe(true);
    const hpBefore = walker.hp;
    const speedBefore = walker.speed;
    let previousProgress = walker.progress;
    for (let step = 0; step < 20; step += 1) {
      engine.update(0.05);
      // 매 프레임 진행도가 앞으로만 간다 — 뒤로 미는 순간이 단 한 번도 없다.
      expect(walker.progress).toBeGreaterThan(previousProgress);
      previousProgress = walker.progress;
      expect(walker.slowFactor).toBe(1);
      expect(walker.stunnedUntil).toBe(0);
    }
    expect(walker.speed).toBe(speedBefore);
    // 지대는 피해도 주지 않는다 — 재생만 멈춘 채 체력이 그대로다.
    expect(engine.enemyTraitsSuppressed(walker)).toBe(true);
    expect(walker.hp).toBeCloseTo(hpBefore, 6);
  });

  it("장갑 무효는 지대 위에서만이고, 벗어나면 유예 뒤 되살아난다 (판정 경계)", () => {
    const engine = new GameEngine("skill-mire-armor", "KR");
    engine.begin();
    const armored = makeEnemy(-9, "armored", { armor: 0.5, hp: 10000, maxHp: 10000 });
    engine.state.enemies = [armored];

    // 무효 전: 장갑 50%가 그대로 산다.
    expect(engine.enemyTraitsSuppressed(armored)).toBe(false);

    // 진흙 위: 무효 판정이 켜진다.
    armored.traitsSuppressedUntil = engine.state.elapsed + MIRE_SUPPRESS_GRACE;
    expect(engine.enemyTraitsSuppressed(armored)).toBe(true);

    // 유예가 지나면 다시 장갑이 산다 — 지대 밖에서는 원래대로다.
    armored.traitsSuppressedUntil = engine.state.elapsed - 0.001;
    expect(engine.enemyTraitsSuppressed(armored)).toBe(false);
  });

  it("무효화된 장갑은 관통과 이중으로 세지 않는다 — 같은 피해가 온전히 들어간다", () => {
    const engine = new GameEngine("skill-mire-damage", "KR");
    engine.begin();
    const plain = makeEnemy(-10, "normal", { armor: 0, hp: 10000, maxHp: 10000 });
    const armoured = makeEnemy(-11, "armored", { armor: 0.5, hp: 10000, maxHp: 10000 });
    const mired = makeEnemy(-12, "armored", { armor: 0.5, hp: 10000, maxHp: 10000 });
    mired.traitsSuppressedUntil = engine.state.elapsed + MIRE_SUPPRESS_GRACE;
    engine.state.enemies = [plain, armoured, mired];
    // 독 피해(장판·출처 없는 경로)로 같은 원피해를 세 적에게 흘린다.
    for (const enemy of engine.state.enemies) {
      enemy.poisonDps = 1000;
      enemy.poisonUntil = engine.state.elapsed + 5;
    }
    engine.update(0.1);
    const plainLoss = plain.maxHp - plain.hp;
    const armouredLoss = armoured.maxHp - armoured.hp;
    const miredLoss = mired.maxHp - mired.hp;
    // 장갑이 살아 있으면 절반만 들어가고, 진흙 위에서는 맨몸과 같다.
    expect(armouredLoss).toBeCloseTo(plainLoss * 0.5, 6);
    expect(miredLoss).toBeCloseTo(plainLoss, 6);
  });

  it("적이 충전 조건보다 적으면 지대를 깔지 않는다 (판정 경계)", () => {
    const definition = familyDefinition("KR", "mire");
    const engine = new GameEngine("skill-mire-threshold", "KR");
    const { tower, enemy } = arrangeDuel(engine, definition, {
      shotCount: definition.combat.abilities.tuning.semanticEvery - 1
    });
    // 적 1기 — 충전 조건(3기) 미달이라 주기가 와도 아무 지대도 생기지 않는다.
    engine.state.enemies = [enemy];
    engine.update(0.02);
    expect(tower.shotCount % definition.combat.abilities.tuning.semanticEvery).toBe(0);
    expect(engine.state.abilityZones).toHaveLength(0);
    expect(engine.enemyTraitsSuppressed(enemy)).toBe(false);
    expect(definition.combat.abilities.semantic.trigger).toContain(`적 ${MIRE_MIN_ENEMIES}기 이상`);
  });
});

describe("[SKILL-V3] 획수 공명 (畫數共鳴)", () => {
  it("중첩은 같은 별 동료 1기당 1이고 4에서 멈춘다 — 중첩 상한", () => {
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

  it("같은 진의 같은 별만 센다 — 다른 진·다른 별·가방·1★는 세지 않는다 (판정 경계)", () => {
    const engine = new GameEngine("skill-resonance-scope", "KR", "casual");
    engine.begin();
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0, 1, 2, 3, 4];
    const pool = starPool(engine, 3);
    const otherStar = starPool(engine, 4);
    const dormant = starPool(engine, 1); // 1★ — 기술이 깨어나지 않은 자령.
    expect(pool.length).toBeGreaterThan(5);

    // 1진(cell 0~15)에 같은 별 3기.
    const trio = pool.slice(0, 3).map((definition, index) => casualTower(definition, 8000 + index, index, 3));
    // 같은 진의 다른 별 1기 — 중첩에 끼지 않는다.
    const mismatched = casualTower(otherStar[0] as HanziDefinition, 8100, 3, 4);
    // 같은 진의 1★ 1기 — 기술이 깨어나지 않아 울리지도, 울려 주지도 않는다.
    const sleeper = casualTower(dormant[0] as HanziDefinition, 8110, 4, 1);
    const sleeperTwin = casualTower(dormant[1] as HanziDefinition, 8111, 5, 1);
    // 다른 진(cell 16~31)의 같은 별 1기 — 진 경계를 넘지 않는다.
    const neighbourFormation = casualTower(pool[3] as HanziDefinition, 8200, CELLS_PER_FORMATION, 3);
    // 가방 자령(cell -1)은 진에 서 있지 않다.
    const stored = casualTower(pool[4] as HanziDefinition, 8300, -1, 3);
    engine.state.towers = [...trio, mismatched, sleeper, sleeperTwin, neighbourFormation];
    engine.state.inventoryTowers = [stored];

    for (const tower of trio) expect(engine.strokeResonanceStacks(tower)).toBe(2);
    expect(engine.strokeResonanceStacks(mismatched)).toBe(0);
    expect(engine.strokeResonanceStacks(sleeper)).toBe(0);
    expect(engine.strokeResonanceStacks(neighbourFormation)).toBe(0);
    expect(engine.strokeResonanceStacks(stored)).toBe(0);
    expect(engine.strokeResonanceStatus(mismatched)).toBeNull();
    expect(engine.strokeResonanceStatus(trio[0] as Tower)).toMatchObject({ stacks: 2, star: 3 });
  });

  it("표준 모드에는 별이 없어 공명이 울리지 않는다 (모드 경계)", () => {
    const standard = new GameEngine("skill-resonance-standard", "KR");
    standard.begin();
    standard.state.summonCount = 1;
    standard.state.startingFormationIndex = 0;
    standard.state.unlockedFormations = [0];
    const pool = [...getCatalog("KR").definitions.values()].filter(hasActiveSkills);
    const anchorStage = (pool[0] as HanziDefinition).stage;
    const sameStage = pool.filter((definition) => definition.stage === anchorStage).slice(0, 5);
    expect(sameStage.length).toBe(5);
    standard.state.towers = sameStage.map((definition, index) => makeTower(definition, 8600 + index, { cell: index }));
    for (const tower of standard.state.towers) {
      expect(standard.strokeResonanceStacks(tower)).toBe(0);
      expect(standard.strokeResonanceStatus(tower)).toBeNull();
    }
  });

  it("중첩만큼 공격 대기가 실제로 줄고, 상한 위로는 더 줄지 않는다", () => {
    const engine = new GameEngine("skill-resonance-cooldown", "KR", "casual");
    engine.begin();
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0];
    const pool = starPool(engine, 3);
    expect(pool.length).toBeGreaterThan(STROKE_RESONANCE_MAX_STACKS + 2);

    const solo = casualTower(pool[0] as HanziDefinition, 8400, 0, 3);
    engine.state.towers = [solo];
    const soloCooldown = engine.towerAttackCooldown(solo);
    expect(engine.strokeResonanceStacks(solo)).toBe(0);

    // 동성 동료를 한 기씩 더한다 — 중첩 1·2·3·4 에서 대기가 계단처럼 줄어든다.
    for (let allies = 1; allies <= STROKE_RESONANCE_MAX_STACKS; allies += 1) {
      engine.state.towers = [
        solo,
        ...pool.slice(1, allies + 1).map((candidate, index) => casualTower(candidate, 8410 + index, index + 1, 3))
      ];
      expect(engine.strokeResonanceStacks(solo)).toBe(allies);
      expect(engine.towerAttackCooldown(solo)).toBeCloseTo(soloCooldown * strokeResonanceCooldownScale(allies), 6);
    }

    // 상한을 넘겨도 더 줄지 않는다.
    const cappedCooldown = engine.towerAttackCooldown(solo);
    engine.state.towers = [
      solo,
      ...pool.slice(1, STROKE_RESONANCE_MAX_STACKS + 3).map((candidate, index) => casualTower(candidate, 8450 + index, index + 1, 3))
    ];
    expect(engine.strokeResonanceStacks(solo)).toBe(STROKE_RESONANCE_MAX_STACKS);
    expect(engine.towerAttackCooldown(solo)).toBeCloseTo(cappedCooldown, 6);
  });

  it("자동배치와 공존한다 — 핀 고정된 봉인 자령도 그대로 세고, 배치 뒤엔 새 칸으로 다시 센다", () => {
    const engine = new GameEngine("skill-resonance-autoarrange", "KR", "casual");
    engine.begin();
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 2;
    engine.state.unlockedFormations = [0, 1, 2, 3, 4];
    engine.state.towers = [..."以心傳心"].map((char, index) => {
      const definition = getCatalog("KR").definitions.get(char) as HanziDefinition;
      // 네 자령을 같은 별로 세워 공명이 실제로 켜지는 판을 만든다.
      return casualTower(definition, 8500 + index, index, 3);
    });
    // 한 줄 봉인이 서면 그 네 자령은 자동배치에서 칸이 고정된다(핀).
    expect(engine.resolveIdiomFormations()).toBe(1);
    const pinned = engine.sealedIdiomTowerIds();
    expect(pinned.size).toBe(4);

    /** 지금 상태에서 손으로 센 같은 진·같은 별 동료 수(상한 4). */
    const expectedStacks = (tower: Tower): number => {
      if (!engine.towerHasActiveSkills(tower)) return 0;
      const formation = Math.floor(tower.cell / CELLS_PER_FORMATION);
      const allies = engine.state.towers.filter((candidate) =>
        candidate.id !== tower.id
        && candidate.cell >= 0
        && Math.floor(candidate.cell / CELLS_PER_FORMATION) === formation
        && engine.towerHasActiveSkills(candidate)
        && (candidate.casualStar ?? candidate.naturalStar ?? 1) === (tower.casualStar ?? tower.naturalStar ?? 1)
      ).length;
      return Math.min(STROKE_RESONANCE_MAX_STACKS, allies);
    };

    // 핀 고정 여부와 무관하게, 진에 서 있으면 그대로 센다.
    for (const tower of engine.state.towers) {
      expect(pinned.has(tower.id)).toBe(true);
      expect(engine.strokeResonanceStacks(tower)).toBe(expectedStacks(tower));
      expect(engine.strokeResonanceStacks(tower)).toBe(3);
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

describe("[SKILL-V3] 회향 (回響)", () => {
  it("여운 지속 — 기본 10초, 결과 별당 +0.5초, 상한 13초", () => {
    expect(echoSeconds(1)).toBeCloseTo(ECHO_BASE_SECONDS, 6);
    expect(echoSeconds(2)).toBeCloseTo(ECHO_BASE_SECONDS + ECHO_PER_STAR, 6);
    expect(echoSeconds(5)).toBeCloseTo(ECHO_BASE_SECONDS + 4 * ECHO_PER_STAR, 6);
    expect(echoSeconds(8)).toBeCloseTo(ECHO_CAP_SECONDS, 6);
    expect(echoSeconds(99)).toBeCloseTo(ECHO_CAP_SECONDS, 6);
  });

  it("3합 승급 결과 자령이 사라진 셋의 여운을 물려받는다", () => {
    const engine = new GameEngine("skill-echo-grant", "KR", "casual");
    engine.begin();
    const definitions = safeCasualDefinitions(engine, 3);
    const star = casualNaturalStar((definitions[0] as HanziDefinition).char) as CasualStar;
    const materials = definitions.map((definition, index) => casualTower(definition, 700 + index, -1, star));
    engine.state.inventoryTowers = materials;
    // 재료에는 여운이 없다.
    for (const material of materials) expect(material.echoRemaining).toBeUndefined();

    const result = engine.fuseCasual(materials.map((tower) => tower.id));
    expect(result).toMatchObject({ ok: true });
    const gained = [...engine.state.towers, ...engine.state.inventoryTowers]
      .find((tower) => !materials.some((material) => material.id === tower.id));
    expect(gained).toBeDefined();
    const resultStar = (gained?.casualStar ?? gained?.naturalStar ?? 1) as CasualStar;
    expect(gained?.echoRemaining).toBeCloseTo(echoSeconds(resultStar), 6);
    expect(engine.state.lastMessage).toContain("회향 여운");
    expect(engine.echoStatus(gained as Tower)).toMatchObject({ bonus: ECHO_DAMAGE_BONUS });
  });

  it("여운 시계는 전투 중에만 흐른다 — 준비 시간에는 줄지 않는다 (판정 경계)", () => {
    const engine = new GameEngine("skill-echo-clock", "KR", "casual");
    engine.begin();
    const definition = safeCasualDefinitions(engine, 1)[0] as HanziDefinition;
    const star = Math.max(2, casualNaturalStar(definition.char) ?? 2) as CasualStar;
    const tower = casualTower(definition, 720, 0, star);
    tower.echoRemaining = echoSeconds(star);
    engine.state.towers = [tower];
    engine.state.summonCount = 1;
    engine.state.startingFormationIndex = 0;
    engine.state.unlockedFormations = [0];

    // 준비 단계 — 런 시계는 흘러도 여운은 그대로다.
    expect(engine.state.phase).toBe("prep");
    const beforePrep = tower.echoRemaining;
    const elapsedBefore = engine.state.elapsed;
    for (let step = 0; step < 5; step += 1) engine.update(0.1);
    expect(engine.state.elapsed).toBeGreaterThan(elapsedBefore);
    expect(tower.echoRemaining).toBe(beforePrep);

    // 전투에 들어서면 그때부터 줄어든다.
    engine.startWaveEarly();
    engine.state.enemies = [];
    engine.state.spawned = 0;
    engine.update(0.1);
    expect(tower.echoRemaining ?? 0).toBeLessThan(beforePrep as number);

    // 다 타면 완전히 사라진다.
    tower.echoRemaining = 0.05;
    engine.update(0.1);
    expect(tower.echoRemaining).toBeUndefined();
    expect(engine.echoStatus(tower)).toBeNull();
  });

  it("여운이 남은 동안 공격이 20% 무거워진다 — 여운이 끝나면 원래대로", () => {
    const base = new GameEngine("skill-echo-fixture", "KR", "casual");
    base.begin();
    // 금(치명타 확률)과 화·수(광역·연쇄)는 한 방 비교를 흐리므로 뺀다.
    const definition = base.catalog.activePool.find((candidate) => {
      const star = casualNaturalStar(candidate.char);
      return star !== null && star >= 2 && !(["金", "火", "水"] as Wuxing[]).includes(candidate.wuxing);
    }) as HanziDefinition;
    expect(definition).toBeDefined();
    const star = casualNaturalStar(definition.char) as CasualStar;

    /** 같은 시드·같은 자령으로 한 방의 피해를 잰다 — 여운만 다르게 준다. */
    const measure = (echo: number): number => {
      const tower = casualTower(definition, 740, 0, star);
      if (echo > 0) tower.echoRemaining = echo;
      const { engine, enemy } = casualDuel("skill-echo-damage", tower);
      const hpBefore = enemy.hp;
      engine.update(0.02);
      expect(tower.shotCount).toBe(1);
      return hpBefore - enemy.hp;
    };

    const plain = measure(0);
    const echoed = measure(echoSeconds(star));
    expect(plain).toBeGreaterThan(0);
    expect(echoed / plain).toBeCloseTo(1 + ECHO_DAMAGE_BONUS, 6);
  });

  it("표준 모드에는 여운이 없다 — 3합 자체가 캐주얼 전용 규칙이다 (모드 경계)", () => {
    const standard = new GameEngine("skill-echo-standard", "KR");
    standard.begin();
    const definition = standard.catalog.activePool[0] as HanziDefinition;
    const tower = makeTower(definition, 760, { cell: 0 });
    tower.echoRemaining = 10; // 값이 남아 있어도 표준에서는 읽지 않는다.
    expect(standard.echoStatus(tower)).toBeNull();
    expect(standard.fuseCasual([1, 2, 3])).toMatchObject({ ok: false });
  });
});
