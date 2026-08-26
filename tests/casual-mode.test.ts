import { describe, expect, it } from "vitest";
import {
  CASUAL_STAR_BINS,
  CASUAL_STAR_POWER,
  CASUAL_STROKE_SOURCE,
  casualNaturalStar,
  casualStrokeCount
} from "../src/core/casual";
import { BOARD_FORMATIONS } from "../src/core/content";
import { GameEngine } from "../src/core/game";
import { MIN_TIER_POOL_SIZE, SUMMON_SURCHARGE, summonCost, WUXING_ORDER } from "../src/core/hanzi";
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

/** 잠금·목표·성어·일반 합성식 어디에도 걸리지 않는 같은 오행·같은 별 정의들. */
function safeCasualDefinitions(engine: GameEngine, count: number, wuxing?: Wuxing): HanziDefinition[] {
  const parentChars = new Set(engine.catalog.recipes.flatMap((definition) => definition.parents));
  const targetPath = engine.evolution.getTargetPath(engine.state.targetChar);
  const idiomChars = new Set(engine.idioms().flatMap((idiom) => [...idiom.chars]));
  const grouped = new Map<string, HanziDefinition[]>();
  for (const definition of engine.catalog.activePool) {
    const star = casualNaturalStar(definition.char);
    if (star === null || star >= 8) continue;
    if (wuxing !== undefined && definition.wuxing !== wuxing) continue;
    if (parentChars.has(definition.char) || targetPath.has(definition.char) || idiomChars.has(definition.char)) continue;
    const key = `${definition.wuxing}:${star}`;
    const group = grouped.get(key) ?? [];
    group.push(definition);
    grouped.set(key, group);
    if (group.length >= count) return group.slice(0, count);
  }
  throw new Error(`No safe casual fixture of size ${count} found`);
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

  it("supports casual mode in every region via supplement strokes", () => {
    // JP/CN 로스터는 Unihan kTotalStrokes 보충 데이터로 별을 받는다.
    for (const region of ["JP", "CN"] as const) {
      const foreign = new GameEngine(`casual-${region.toLowerCase()}`, region, "casual");
      foreign.setAutoPlaceSummons(false);
      foreign.begin();
      foreign.state.gold = 500;
      for (let index = 0; index < 10; index += 1) expect(foreign.summon()).toMatchObject({ ok: true });
      expect(foreign.state.inventoryTowers).toHaveLength(10);
      expect(foreign.state.inventoryTowers.every((tower) => tower.naturalStar === casualNaturalStar(tower.char))).toBe(true);
      expect(foreign.state.inventoryTowers.every((tower) => (tower.naturalStar ?? 0) >= 1 && (tower.naturalStar ?? 0) <= 8)).toBe(true);
    }
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

  it("keeps sealed-idiom board members out of the auto-fusion material pool", () => {
    // 요구 4-(가): 이미 봉인이 끝난 사자성어에 참여 중인 전장 자령을 재료로
    // 태우면 얻은 봉인이 깨진다. 미완 성어와 똑같이 재료에서 빠져야 한다.
    const engine = new GameEngine("casual-sealed-guard", "KR", "casual");
    engine.begin();
    const definitions = safeCasualDefinitions(engine, 3);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const towers = definitions.map((definition, index) => casualTower(definition, 501 + index, index, star));
    engine.state.towers = towers;
    const wuxing = towers[0]?.wuxing as Wuxing;

    // 봉인 전: 세 자령이 한 묶음으로 잡힌다.
    const before = engine.casualAutoFusionPlan(wuxing);
    expect(before).toHaveLength(1);
    expect(before[0]?.warnings.some((warning) => warning.kind === "deployed")).toBe(true);
    expect(towers.map((tower) => engine.casualMaterialProtection(tower.id))).toEqual([null, null, null]);

    // 1·2번 칸을 쓰는 성어 봉인이 생기면 그 두 자령은 재료 후보에서 빠지고
    // 남은 안전 재료가 1기뿐이라 묶음 자체가 사라진다 — 봉인이 깨지지 않는다.
    engine.state.idiomSeals.push({ idiomId: "sealed-fixture", cells: [1, 2], completedAt: 0 });
    expect(engine.casualMaterialProtection(towers[1]?.id ?? -1)).toBe("봉인 완료 사자성어 참여");
    expect(engine.casualMaterialProtection(towers[2]?.id ?? -1)).toBe("봉인 완료 사자성어 참여");
    expect(engine.casualMaterialProtection(towers[0]?.id ?? -1)).toBeNull();
    expect(engine.casualAutoFusionPlan(wuxing)).toHaveLength(0);
    expect(engine.autoFuseCasual(wuxing, true)).toMatchObject({ ok: false, fused: 0 });
    expect(engine.state.towers).toHaveLength(3);
  });

  it("spends inventory bodies before pulling a deployed defender", () => {
    // 요구 4-(나): 수비 공백 방지. 인벤 2기로 채울 수 있으면 전장은 건드리지 않는다.
    const engine = new GameEngine("casual-stored-first", "KR", "casual");
    engine.begin();
    const definitions = safeCasualDefinitions(engine, 4);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const deployedCore = casualTower(definitions[0] as HanziDefinition, 601, 0, star);
    const deployedSpare = casualTower(definitions[1] as HanziDefinition, 602, 1, star);
    const stored = [2, 3].map((index) => casualTower(definitions[index] as HanziDefinition, 600 + index + 1, -1, star));
    engine.state.towers = [deployedCore, deployedSpare];
    engine.state.inventoryTowers = stored;
    const wuxing = deployedCore.wuxing as Wuxing;

    const plan = engine.casualAutoFusionPlan(wuxing);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.materialIds).toEqual(expect.arrayContaining(stored.map((tower) => tower.id)));
    expect(plan[0]?.materialIds).not.toContain(deployedSpare.id);
    // 인벤만 소모하므로 전장 경고가 없고 원클릭이 그대로 실행된다.
    expect(plan[0]?.autoSkipReason).toBeNull();
    const report = engine.autoFuseCasual(wuxing);
    expect(report).toMatchObject({ ok: true, fused: 1, consumed: 2, skipped: 0 });
    expect(engine.state.towers.map((tower) => tower.id).sort()).toEqual([deployedCore.id, deployedSpare.id].sort());
    expect(engine.state.inventoryTowers).toHaveLength(0);
  });

  it("carries lock, concentration and board cell over to the promoted core", () => {
    // 요구 4-(다): 본체 객체를 그대로 승급시키므로 잠금·농축·배치가 살아 있어야 한다.
    const engine = new GameEngine("casual-core-inherit", "KR", "casual");
    engine.begin();
    const definitions = safeCasualDefinitions(engine, 3);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const core = casualTower(definitions[0] as HanziDefinition, 701, 6, star);
    core.locked = true;
    core.concentration = 2;
    core.concentrationPath = "swift";
    const materials = [1, 2].map((index) => casualTower(definitions[index] as HanziDefinition, 700 + index + 1, -1, star));
    engine.state.towers = [core];
    engine.state.inventoryTowers = materials;
    const wuxing = core.wuxing as Wuxing;

    const plan = engine.casualAutoFusionPlan(wuxing);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.coreId).toBe(core.id);
    const report = engine.autoFuseCasual(wuxing);
    expect(report).toMatchObject({ ok: true, fused: 1 });
    expect(report.firstFusion).toMatchObject({ char: core.char, fromStar: star, toStar: star + 1 });
    const promoted = engine.state.towers.find((tower) => tower.id === core.id);
    expect(promoted?.casualStar).toBe(star + 1);
    expect(promoted?.locked).toBe(true);
    expect(promoted?.concentration).toBe(2);
    expect(promoted?.concentrationPath).toBe("swift");
    expect(promoted?.cell).toBe(6);
  });

  it("skips only the resonance-breaking group instead of aborting the whole one-click run", () => {
    // 오행진 공명 임계치(4·8·12·16기)를 깨는 묶음만 건너뛰고 나머지는 실행한다.
    // 뽑기 후 자동 배치가 기본이라 "전장 배치"는 건너뛰기 사유가 아니다.
    const engine = new GameEngine("casual-skip-group", "KR", "casual");
    engine.begin();
    engine.state.unlockedFormations = [0];
    const north = BOARD_FORMATIONS[0] as { preferredWuxing: Wuxing; startCell: number };
    const resonant = safeCasualDefinitions(engine, 4, north.preferredWuxing);
    const star = casualNaturalStar(resonant[0]?.char ?? "") as CasualStar;
    const boardQuad = resonant.map((definition, index) =>
      casualTower(definition, 801 + index, north.startCell + index, star));
    const otherElement = WUXING_ORDER.find((wuxing) => wuxing !== north.preferredWuxing) as Wuxing;
    const spare = safeCasualDefinitions(engine, 3, otherElement);
    const spareStar = casualNaturalStar(spare[0]?.char ?? "") as CasualStar;
    const inventoryTrio = spare.map((definition, index) => casualTower(definition, 851 + index, -1, spareStar));
    engine.state.towers = boardQuad;
    engine.state.inventoryTowers = inventoryTrio;

    expect(engine.formationResonance(0).matching).toBe(4);
    const resonancePlan = engine.casualAutoFusionPlan(north.preferredWuxing);
    expect(resonancePlan).toHaveLength(1);
    expect(resonancePlan[0]?.autoSkipReason).toContain("공명 임계치");
    expect(engine.casualAutoFusionPlan(otherElement)[0]?.autoSkipReason).toBeNull();

    const report = engine.autoFuseCasual("all");
    expect(report).toMatchObject({ ok: true, fused: 1, consumed: 2, skipped: 1 });
    expect(report.message).toContain("건너뜀");
    // 공명 4기는 그대로 남고 인벤 묶음만 소모됐다.
    expect(engine.formationResonance(0).matching).toBe(4);
    expect(engine.state.inventoryTowers).toHaveLength(1);
  });

  it("guarantees the advertised star floor for tier summons and charges the exact surcharge", () => {
    // 뽑기 별이 완전 무작위면 "같은 오행·같은 별 3기"라는 조합 루프가 성립하지 않는다.
    // 중급·고급은 가중이 아니라 후보 풀 필터이므로 200회 전부 보장을 지켜야 한다.
    for (const [intent, floor] of [["midstar", 2], ["highstar", 3]] as const) {
      const engine = new GameEngine(`casual-tier-${intent}`, "KR", "casual");
      engine.setAutoPlaceSummons(false);
      engine.begin();
      expect(engine.summonTierFloor(intent)).toBe(floor);
      expect(engine.isSummonProductAvailable(intent)).toBe(true);
      for (let index = 0; index < 200; index += 1) {
        // 보상·이자가 섞이지 않게 가격 경계로 청구액을 재단한다.
        const expected = summonCost(engine.state.summonCount) + SUMMON_SURCHARGE[intent];
        engine.state.gold = expected - 1;
        expect(engine.summonProduct(intent)).toMatchObject({ ok: false, message: "엽전이 1 부족합니다." });
        engine.state.gold = expected;
        expect(engine.summonProduct(intent)).toMatchObject({ ok: true });
      }
      expect(engine.state.inventoryTowers).toHaveLength(200);
      expect(engine.state.inventoryTowers.every((tower) => (tower.naturalStar ?? 0) >= floor)).toBe(true);
      // 소환 목적은 카드 한 장 안에서만 유효하다. 상태로 남지 않는다.
      expect(engine.state.summonIntent).toBe("balanced");
    }

    // 기본 소환은 할증이 없고 보장도 없다.
    const base = new GameEngine("casual-tier-base", "KR", "casual");
    base.setAutoPlaceSummons(false);
    base.begin();
    expect(SUMMON_SURCHARGE.balanced).toBe(0);
    expect(base.summonTierFloor("balanced")).toBeNull();
    base.state.gold = summonCost(0) - 1;
    expect(base.summonProduct("balanced")).toMatchObject({ ok: false, message: "엽전이 1 부족합니다." });
    base.state.gold = summonCost(0);
    expect(base.summonProduct("balanced")).toMatchObject({ ok: true });

    // 자형연성은 별 수집이 루프가 아니므로 티어 상품을 열지 않는다.
    const standard = new GameEngine("standard-tier", "KR", "standard");
    standard.begin();
    expect(standard.isSummonProductAvailable("midstar")).toBe(false);
    expect(standard.isSummonProductAvailable("highstar")).toBe(false);
    expect(standard.isSummonProductAvailable("lineage")).toBe(true);
  });

  it("drops the tier product where the regional pool is too thin to honour a guarantee", () => {
    // JP·CN 활성 풀은 30여 자뿐이라 3★ 이상 후보가 한 자릿수다. 보장을 그대로
    // 걸면 같은 글자만 반복되므로 상품 자체를 닫는다(가짜 보장 판매 금지).
    for (const region of ["JP", "CN"] as const) {
      const engine = new GameEngine(`casual-tier-${region}`, region, "casual");
      engine.begin();
      const eligible = (floor: number) =>
        engine.summonDefinitions().filter((definition) => (casualNaturalStar(definition.char) ?? 1) >= floor).length;
      expect(eligible(2)).toBeLessThan(MIN_TIER_POOL_SIZE);
      expect(engine.summonTierFloor("midstar")).toBeNull();
      expect(engine.summonTierFloor("highstar")).toBeNull();
      expect(engine.isSummonProductAvailable("midstar")).toBe(false);
      expect(engine.summonProduct("highstar")).toMatchObject({ ok: false });
    }
    const korea = new GameEngine("casual-tier-kr-pool", "KR", "casual");
    korea.begin();
    const koreanEligible = (floor: number) =>
      korea.summonDefinitions().filter((definition) => (casualNaturalStar(definition.char) ?? 1) >= floor).length;
    expect(koreanEligible(2)).toBeGreaterThanOrEqual(MIN_TIER_POOL_SIZE);
    expect(koreanEligible(3)).toBeGreaterThanOrEqual(MIN_TIER_POOL_SIZE);
  });

  it("favours characters that complete a same-element same-star trio in the making", () => {
    // 짝 가중은 그 묶음이 3기가 되는 순간 꺼진다(이미 조합 가능). 연속 소환으로 재면
    // 두 조건 모두 금세 3기에 도달해 상쇄되므로, 시드마다 첫 1회만 뽑아 단발 확률로 잰다.
    const firstDrawHits = (seeded: boolean, trials: number): number => {
      let hits = 0;
      for (let trial = 0; trial < trials; trial += 1) {
        const engine = new GameEngine(`casual-pair-${trial}`, "KR", "casual");
        engine.setAutoPlaceSummons(false);
        engine.begin();
        const held = engine.catalog.activePool.find((candidate) =>
          candidate.wuxing === "木" && casualNaturalStar(candidate.char) === 2) as HanziDefinition;
        const star = casualNaturalStar(held.char) as CasualStar;
        if (seeded) {
          engine.state.inventoryTowers = [
            casualTower(held, 9_001, -1, star),
            casualTower(held, 9_002, -1, star)
          ];
        }
        engine.state.gold = 1_000;
        expect(engine.summonProduct("balanced")).toMatchObject({ ok: true });
        const drawn = engine.state.inventoryTowers.at(-1);
        if (drawn && drawn.wuxing === "木" && (drawn.naturalStar ?? 0) === star) hits += 1;
      }
      return hits;
    };
    const trials = 300;
    const seeded = firstDrawHits(true, trials);
    const plain = firstDrawHits(false, trials);
    // 설계 배수는 2.2x 이고 다른 가중항이 희석해 실측 1.8x 안팎이 나온다.
    expect(plain).toBeGreaterThan(0);
    expect(seeded).toBeGreaterThan(plain * 1.35);
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
