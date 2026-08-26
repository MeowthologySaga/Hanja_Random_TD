import { describe, expect, it } from "vitest";
import {
  CASUAL_STAR_BINS,
  CASUAL_STAR_POWER,
  CASUAL_STROKE_SOURCE,
  casualNaturalStar,
  casualStrokeCount
} from "../src/core/casual";
import { BOARD_FORMATIONS } from "../src/core/content";
import {
  GameEngine,
  casualDismantleEssence,
  casualFusionDismantleScore,
  casualFusionEssenceRefund
} from "../src/core/game";
import {
  CASUAL_STAR_DECAY,
  CASUAL_STAR_TAIL_DECAY,
  casualStarBandShare,
  casualSummonStarDistribution,
  multiSummonCost,
  SUMMON_COST_MULTIPLIER,
  summonCost,
  summonProductCost
} from "../src/core/engine-tuning";
import { MIN_TIER_POOL_SIZE, SUMMON_STAR_BANDS, WUXING_ORDER } from "../src/core/hanzi";
import type { CasualStar, HanziDefinition, RegionCode, Tower, Wuxing } from "../src/core/types";

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

/** 이 지역 소환 풀에서 (오행, 별) 조합의 글자 수. 폴백 시나리오 고정용. */
function poolCount(engine: GameEngine, wuxing: Wuxing, star: CasualStar): number {
  return engine.summonDefinitions().filter((definition) =>
    definition.wuxing === wuxing && casualNaturalStar(definition.char) === star).length;
}

function casualEngine(seed: string, region: RegionCode = "KR"): GameEngine {
  const engine = new GameEngine(seed, region, "casual");
  engine.begin();
  return engine;
}

function allTowers(engine: GameEngine): Tower[] {
  return [...engine.state.towers, ...engine.state.inventoryTowers];
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

  it("consumes all three bodies and grants one random same-element unit at the next star", () => {
    // v3 core: 보유 수 -3/+1 · 결과 오행 일치 · 결과 별 = star+1.
    const engine = casualEngine("casual-v3-core");
    const definitions = safeCasualDefinitions(engine, 3);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const wuxing = definitions[0]?.wuxing as Wuxing;
    const towers = definitions.map((definition, index) => casualTower(definition, 101 + index, -1, star));
    engine.state.inventoryTowers = towers;
    const consumedIds = towers.map((tower) => tower.id);

    const quote = engine.casualFusionQuote(consumedIds);
    expect(quote.blocked).toEqual([]);
    expect(quote.fromStar).toBe(star);
    expect(quote.toStar).toBe(star + 1);
    expect(quote.poolSize).toBeGreaterThan(0);
    expect(quote.starFallback).toBe(false);
    expect(quote.rosterFallback).toBe(false);

    const result = engine.fuseCasual(consumedIds);
    expect(result).toMatchObject({ ok: true });
    expect(result.consumedChars).toEqual(towers.map((tower) => tower.char));
    expect(allTowers(engine)).toHaveLength(1);
    const gained = allTowers(engine)[0] as Tower;
    expect(consumedIds).not.toContain(gained.id);
    expect(gained.wuxing).toBe(wuxing);
    expect(gained.casualStar).toBe(star + 1);
    expect(gained.naturalStar).toBe(casualNaturalStar(gained.char));
    expect(result.gained).toMatchObject({ char: gained.char, star: star + 1, wuxing });
    expect(engine.state.discoveredChars).toContain(gained.char);
    expect(engine.state.casualFusionCount).toBe(1);
    expect(engine.state.lastMessage).toContain(`${star}★×3 → ${star + 1}★`);
    const event = engine.consumeEvents().find((entry) => entry.type === "casualFuse");
    expect(event).toBeDefined();
    if (event?.type === "casualFuse") {
      expect(event.consumed).toHaveLength(3);
      expect(event.tower.char).toBe(gained.char);
      expect(event.toStar).toBe(star + 1);
    }
  });

  it("returns one body's worth of essence and dismantle score for every three-body fusion", () => {
    // 별승급에서 문기의 유일한 입구는 분해였는데, 3체 승급이 잉여 자령을 전부
    // 먹어 분해 대기열이 비어 있었다(실측 분해 4기·문기 6/런, 오행 특성 0단계).
    // 승급 자체가 문기 입구가 되어야 두 루프가 재료를 놓고 싸우지 않는다.
    const engine = casualEngine("casual-fusion-essence");
    const definitions = safeCasualDefinitions(engine, 3);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const wuxing = definitions[0]?.wuxing as Wuxing;
    const towers = definitions.map((definition, index) => casualTower(definition, 401 + index, -1, star));
    engine.state.inventoryTowers = towers;

    const expectedEssence = casualFusionEssenceRefund(star);
    const expectedScore = casualFusionDismantleScore(star);
    expect(expectedEssence).toBe(casualDismantleEssence(star));
    expect(expectedEssence).toBeGreaterThan(0);

    expect(engine.fuseCasual(towers.map((tower) => tower.id))).toMatchObject({ ok: true });
    expect(engine.state.elementEssence[wuxing]).toBe(expectedEssence);
    // 새로 생기는 문기이므로 생성 누계에도 들어가야 소비율 지표가 어긋나지 않는다.
    expect(engine.state.elementEssenceGenerated[wuxing]).toBe(expectedEssence);
    expect(engine.state.elementDismantleScore[wuxing]).toBe(expectedScore);
    // 다른 오행은 손대지 않는다.
    for (const other of WUXING_ORDER.filter((candidate) => candidate !== wuxing)) {
      expect(engine.state.elementEssence[other]).toBe(0);
      expect(engine.state.elementDismantleScore[other]).toBe(0);
    }

    // 자형연성에는 이 입구가 없다 — 3체 조합 자체가 없기 때문이다.
    const standard = new GameEngine("standard-fusion-essence", "KR", "standard");
    standard.begin();
    expect(standard.fuseCasual([1, 2, 3])).toMatchObject({ ok: false });
  });

  it("inherits the first consumed board cell and otherwise stays in the inventory", () => {
    const engine = casualEngine("casual-v3-cell");
    const definitions = safeCasualDefinitions(engine, 6);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const stored = casualTower(definitions[0] as HanziDefinition, 201, -1, star);
    const onSix = casualTower(definitions[1] as HanziDefinition, 202, 6, star);
    const onTwo = casualTower(definitions[2] as HanziDefinition, 203, 2, star);
    engine.state.towers = [onSix, onTwo];
    engine.state.inventoryTowers = [stored];
    // 인벤 → 6칸 → 2칸 순으로 넘기면 "소모분의 기존 셀 중 첫 번째"는 6이다.
    expect(engine.fuseCasual([stored.id, onSix.id, onTwo.id], true)).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(1);
    expect(engine.state.inventoryTowers).toHaveLength(0);
    expect(engine.state.towers[0]?.cell).toBe(6);

    const inventoryOnly = definitions.slice(3).map((definition, index) => casualTower(definition, 301 + index, -1, star));
    engine.state.towers = [];
    engine.state.inventoryTowers = inventoryOnly;
    expect(engine.fuseCasual(inventoryOnly.map((tower) => tower.id))).toMatchObject({ ok: true });
    expect(engine.state.towers).toHaveLength(0);
    expect(engine.state.inventoryTowers).toHaveLength(1);
    expect(engine.state.inventoryTowers[0]?.cell).toBe(-1);
  });

  it("blocks mismatched stars or elements and never consumes them", () => {
    const engine = casualEngine("casual-blocks");
    const definitions = safeCasualDefinitions(engine, 3);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const towers = definitions.map((definition, index) => casualTower(definition, 401 + index, -1, star));
    engine.state.inventoryTowers = towers;
    const ids = towers.map((tower) => tower.id);

    expect(engine.fuseCasual(ids.slice(0, 2), true)).toMatchObject({ ok: false, message: expect.stringContaining("3기") });
    expect(engine.fuseCasual([ids[0] as number, ids[0] as number, ids[1] as number], true))
      .toMatchObject({ ok: false, message: expect.stringContaining("서로 다른") });
    (towers[2] as Tower).casualStar = (star === 7 ? 6 : star + 1) as CasualStar;
    expect(engine.fuseCasual(ids, true)).toMatchObject({ ok: false, message: expect.stringContaining("★가 아닙니다") });
    expect(allTowers(engine)).toHaveLength(3);
  });

  it("keeps every protected body out of all three consumption slots", () => {
    // v3 규칙 2: 남는 본체가 없으므로 잠금·농축·봉인 성어·목표 경로 자령은
    // 세 자리 중 어디에도 들어갈 수 없다. v2 의 "본체 승계" 는 폐기됐다.
    const engine = casualEngine("casual-v3-protection");
    const definitions = safeCasualDefinitions(engine, 4);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const towers = definitions.map((definition, index) => casualTower(definition, 501 + index, index, star));
    engine.state.towers = towers;
    const wuxing = towers[0]?.wuxing as Wuxing;
    expect(towers.map((tower) => engine.casualMaterialProtection(tower.id))).toEqual([null, null, null, null]);
    expect(engine.casualAutoFusionPlan(wuxing)).toHaveLength(1);

    const locked = towers[0] as Tower;
    const concentrated = towers[1] as Tower;
    locked.locked = true;
    concentrated.concentration = 2;
    concentrated.concentrationPath = "swift";
    // 2·3번 칸을 쓰는 성어 봉인은 그 자리 자령을 그대로 묶어 둔다.
    engine.state.idiomSeals.push({ idiomId: "sealed-fixture", cells: [2, 3], completedAt: 0, active: true });

    expect(engine.casualMaterialProtection(locked.id)).toBe("잠금 자령");
    expect(engine.casualMaterialProtection(concentrated.id)).toBe("농축 2단계 투자");
    expect(engine.casualMaterialProtection(towers[2]?.id ?? -1)).toBe("발동 중 사자성어 참여");
    expect(engine.casualMaterialProtection(towers[3]?.id ?? -1)).toBe("발동 중 사자성어 참여");

    // 보호 자령은 첫 자리에 넣어도 차단된다 — v2 처럼 본체로 도피할 자리가 없다.
    const quote = engine.casualFusionQuote([locked.id, concentrated.id, towers[2]?.id ?? -1]);
    expect(quote.blocked).toHaveLength(3);
    expect(quote.blocked.every((issue) => issue.kind === "protected")).toBe(true);
    expect(quote.blocked[0]?.text).toContain("잠금 자령");
    expect(engine.fuseCasual([locked.id, concentrated.id, towers[2]?.id ?? -1], true)).toMatchObject({ ok: false });
    expect(engine.casualAutoFusionPlan(wuxing)).toHaveLength(0);
    expect(engine.autoFuseCasual(wuxing, true)).toMatchObject({ ok: false, fused: 0 });
    expect(engine.state.towers).toHaveLength(4);
  });

  it("leaves every region enough unprotected bodies to form a group", () => {
    // v3 는 3기 전부를 보호에서 빼므로 보호 범위가 곧 "이 지역에서 승급이 되느냐"다.
    // 일반 모드 합성식·아직 순서가 오지 않은 성어까지 잠그면 JP/CN 미리보기
    // 소환 풀(30·32자)은 여유 글자가 0자가 되어 한 묶음도 만들 수 없다.
    for (const region of ["KR", "JP", "CN"] as const) {
      const engine = new GameEngine(`casual-reach-${region.toLowerCase()}`, region, "casual");
      engine.begin();
      const pool = engine.summonDefinitions();
      engine.state.towers = [];
      engine.state.inventoryTowers = pool
        .filter((definition) => (casualNaturalStar(definition.char) ?? 8) < 8)
        .map((definition, index) => casualTower(definition, 20_000 + index, -1));
      const protections = engine.casualMaterialProtections();
      expect([...protections.values()]).not.toContain("일반 모드 합성식 재료");
      const buckets = new Map<string, number>();
      for (const tower of engine.state.inventoryTowers) {
        if (protections.has(tower.id)) continue;
        const key = `${tower.wuxing}:${tower.casualStar}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      const reachable = [...buckets.values()].filter((count) => count >= 3);
      expect(reachable.length, `${region} 소환 풀에 3기를 채울 (오행,별) 칸이 없다`).toBeGreaterThan(0);
    }
  });

  it("reproduces the same random results for the same seed", () => {
    const run = (): string[] => {
      const engine = casualEngine("casual-v3-seeded");
      const definitions = safeCasualDefinitions(engine, 9);
      const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
      engine.state.inventoryTowers = definitions.map((definition, index) => casualTower(definition, 601 + index, -1, star));
      const report = engine.autoFuseCasual(definitions[0]?.wuxing as Wuxing);
      expect(report).toMatchObject({ ok: true, fused: 3, consumed: 9 });
      return report.gained.map((entry) => entry.char);
    };
    const first = run();
    expect(first).toHaveLength(3);
    expect(run()).toEqual(first);
  });

  it("skips empty star buckets and reports the fallback it used", () => {
    // JP 미리보기 소환 풀은 金 1★ 8자 · 2★ 0자 · 3★ 1자다. 2★가 비었으므로
    // 사다리가 3★로 건너뛰고 그 사실을 결과 문구에 그대로 남겨야 한다.
    const engine = casualEngine("casual-v3-fallback", "JP");
    expect(poolCount(engine, "金", 1)).toBeGreaterThanOrEqual(3);
    expect(poolCount(engine, "金", 2)).toBe(0);
    expect(poolCount(engine, "金", 3)).toBeGreaterThan(0);

    const pool = engine.casualResultPool("金", 1);
    expect(pool).toMatchObject({ star: 3, starFallback: true, rosterFallback: false });

    const definitions = engine.summonDefinitions()
      .filter((definition) => definition.wuxing === "金" && casualNaturalStar(definition.char) === 1)
      .slice(0, 3);
    const towers = definitions.map((definition, index) => casualTower(definition, 701 + index, -1, 1));
    engine.state.inventoryTowers = towers;
    const result = engine.fuseCasual(towers.map((tower) => tower.id), true);
    expect(result).toMatchObject({ ok: true, starFallback: true });
    expect(result.gained?.star).toBe(3);
    expect(result.message).toContain("2★ 글자가 없어");
    expect(engine.state.inventoryTowers).toHaveLength(1);
  });

  it("widens to the regional roster when the run summon pool has no higher star at all", () => {
    // JP 木 미리보기 풀은 1★ 4자뿐이라 사다리 전체가 비어 있다. 지역 로스터로
    // 넓히지 않으면 그 오행은 영원히 승급 불가가 된다.
    const engine = casualEngine("casual-v3-roster", "JP");
    for (let star = 2 as CasualStar; star <= 8; star = (star + 1) as CasualStar) {
      expect(poolCount(engine, "木", star)).toBe(0);
    }
    const pool = engine.casualResultPool("木", 1);
    expect(pool).toMatchObject({ star: 2, starFallback: false, rosterFallback: true });
    expect(pool?.candidates.every((definition) => definition.wuxing === "木")).toBe(true);
    expect(pool?.candidates.every((definition) => casualNaturalStar(definition.char) === 2)).toBe(true);

    const definitions = engine.summonDefinitions()
      .filter((definition) => definition.wuxing === "木" && casualNaturalStar(definition.char) === 1)
      .slice(0, 3);
    const towers = definitions.map((definition, index) => casualTower(definition, 801 + index, -1, 1));
    engine.state.inventoryTowers = towers;
    const result = engine.fuseCasual(towers.map((tower) => tower.id), true);
    expect(result).toMatchObject({ ok: true, rosterFallback: true });
    expect(result.gained?.star).toBe(2);
    expect(result.message).toContain("지역 로스터");
  });

  it("caps promotion at eight stars", () => {
    const engine = casualEngine("casual-v3-cap");
    const definitions = safeCasualDefinitions(engine, 3, "木");
    const towers = definitions.map((definition, index) => casualTower(definition, 901 + index, -1, 7));
    engine.state.inventoryTowers = towers;
    expect(engine.casualResultPool("木", 7)).toMatchObject({ star: 8 });
    expect(engine.fuseCasual(towers.map((tower) => tower.id))).toMatchObject({ ok: true });
    const promoted = engine.state.inventoryTowers[0] as Tower;
    expect(promoted.casualStar).toBe(8);

    const capped = definitions.map((definition, index) => casualTower(definition, 951 + index, -1, 8));
    engine.state.inventoryTowers = capped;
    expect(engine.casualResultPool("木", 8)).toBeNull();
    expect(engine.casualAutoFusionPlan("木")).toHaveLength(0);
    expect(engine.casualFusionQuote(capped.map((tower) => tower.id)).blocked[0]?.text).toContain("8★");
  });

  it("spends inventory bodies before pulling a deployed defender", () => {
    // 수비 공백 방지. 인벤 3기로 채울 수 있으면 전장은 건드리지 않는다.
    const engine = casualEngine("casual-stored-first");
    const definitions = safeCasualDefinitions(engine, 5);
    const star = casualNaturalStar(definitions[0]?.char ?? "") as CasualStar;
    const deployed = [0, 1].map((index) => casualTower(definitions[index] as HanziDefinition, 1001 + index, index, star));
    const stored = [2, 3, 4].map((index) => casualTower(definitions[index] as HanziDefinition, 1001 + index, -1, star));
    engine.state.towers = deployed;
    engine.state.inventoryTowers = stored;
    const wuxing = deployed[0]?.wuxing as Wuxing;

    const plan = engine.casualAutoFusionPlan(wuxing);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.materialIds).toEqual(expect.arrayContaining(stored.map((tower) => tower.id)));
    expect(plan[0]?.materialIds).not.toContain(deployed[0]?.id);
    // 인벤만 소모하므로 전장 경고가 없고 원클릭이 그대로 실행된다.
    expect(plan[0]?.autoSkipReason).toBeNull();
    const report = engine.autoFuseCasual(wuxing);
    expect(report).toMatchObject({ ok: true, fused: 1, consumed: 3, skipped: 0 });
    expect(report.gained).toHaveLength(1);
    expect(engine.state.towers.map((tower) => tower.id).sort()).toEqual(deployed.map((tower) => tower.id).sort());
    expect(engine.state.inventoryTowers).toHaveLength(1);
    expect(engine.state.inventoryTowers[0]?.cell).toBe(-1);
  });

  it("skips only the resonance-breaking group instead of aborting the whole one-click run", () => {
    // 오행진 공명 임계치(4·8·12·16기)를 깨는 묶음만 건너뛰고 나머지는 실행한다.
    // 뽑기 후 자동 배치가 기본이라 "전장 배치"는 건너뛰기 사유가 아니다.
    const engine = casualEngine("casual-skip-group");
    engine.state.unlockedFormations = [0];
    const north = BOARD_FORMATIONS[0] as { preferredWuxing: Wuxing; startCell: number };
    const resonant = safeCasualDefinitions(engine, 4, north.preferredWuxing);
    const star = casualNaturalStar(resonant[0]?.char ?? "") as CasualStar;
    const boardQuad = resonant.map((definition, index) =>
      casualTower(definition, 1101 + index, north.startCell + index, star));
    const otherElement = WUXING_ORDER.find((wuxing) => wuxing !== north.preferredWuxing) as Wuxing;
    const spare = safeCasualDefinitions(engine, 3, otherElement);
    const spareStar = casualNaturalStar(spare[0]?.char ?? "") as CasualStar;
    const inventoryTrio = spare.map((definition, index) => casualTower(definition, 1151 + index, -1, spareStar));
    engine.state.towers = boardQuad;
    engine.state.inventoryTowers = inventoryTrio;

    expect(engine.formationResonance(0).matching).toBe(4);
    const resonancePlan = engine.casualAutoFusionPlan(north.preferredWuxing);
    expect(resonancePlan).toHaveLength(1);
    expect(resonancePlan[0]?.autoSkipReason).toContain("공명 임계치");
    expect(engine.casualAutoFusionPlan(otherElement)[0]?.autoSkipReason).toBeNull();

    const report = engine.autoFuseCasual("all");
    expect(report).toMatchObject({ ok: true, fused: 1, consumed: 3, skipped: 1 });
    expect(report.message).toContain("건너뜀");
    // 공명 4기는 그대로 남고 인벤 묶음만 소모됐다.
    expect(engine.formationResonance(0).matching).toBe(4);
    expect(engine.state.inventoryTowers).toHaveLength(1);
  });

  it("keeps the hard band floor, mostly stays in band, and charges the exact surcharge", () => {
    // 뽑기 별이 완전 무작위면 "같은 오행·같은 별 3기"라는 조합 루프가 성립하지 않는다.
    // 하한은 하드 필터다 — 티어 "N★ 확정" 광고의 근거이므로 200회 전부 지켜야 한다.
    // 상한은 소프트다(원 기획 #10) — 상한 위 별도 가파른 꼬리 확률로 나오되,
    // 압도적 다수는 밴드 안이어야 "주로 min~max★" 광고가 참이다.
    for (const [intent, min, max] of [["balanced", 1, 3], ["midstar", 2, 5], ["highstar", 3, 8]] as const) {
      const engine = new GameEngine(`casual-band-${intent}`, "KR", "casual");
      engine.setAutoPlaceSummons(false);
      engine.begin();
      expect(engine.summonStarBand(intent)).toEqual({ min, max });
      expect(engine.isSummonProductAvailable(intent)).toBe(true);
      for (let index = 0; index < 200; index += 1) {
        // 보상·이자가 섞이지 않게 가격 경계로 청구액을 재단한다.
        const expected = summonProductCost(engine.state.summonCount, intent);
        engine.state.gold = expected - 1;
        expect(engine.summonProduct(intent)).toMatchObject({ ok: false, message: "엽전이 1 부족합니다." });
        engine.state.gold = expected;
        expect(engine.summonProduct(intent)).toMatchObject({ ok: true });
      }
      expect(engine.state.inventoryTowers).toHaveLength(200);
      const stars = engine.state.inventoryTowers.map((tower) => tower.naturalStar ?? 0);
      expect(stars.every((star) => star >= min)).toBe(true);
      // 꼬리 총 확률은 2% 남짓 — 200회에서 상한 위가 8% 를 넘으면 꼬리가 아니라 구멍이다.
      expect(stars.filter((star) => star > max).length).toBeLessThanOrEqual(16);
      // 밴드가 실제로 넓게 쓰이는지도 본다(하한 한 칸에 고정되면 밴드가 아니다).
      expect(new Set(stars).size).toBeGreaterThan(1);
      // 소환 목적은 카드 한 장 안에서만 유효하다. 상태로 남지 않는다.
      expect(engine.state.summonIntent).toBe("balanced");
    }
    expect(SUMMON_COST_MULTIPLIER.balanced).toBe(1);

    // 자형연성은 별 수집이 루프가 아니므로 티어 상품도 밴드도 없다.
    const standard = new GameEngine("standard-tier", "KR", "standard");
    standard.begin();
    expect(standard.summonStarBand("balanced")).toBeNull();
    expect(standard.summonStarBand("highstar")).toBeNull();
    expect(standard.isSummonProductAvailable("midstar")).toBe(false);
    expect(standard.isSummonProductAvailable("highstar")).toBe(false);
    expect(standard.isSummonProductAvailable("lineage")).toBe(true);
  });

  it("prices every summon product as a ratio of the base so the per-coin ranking never flips", () => {
    // gripe #9. 정찰료가 정액(+5/+12)이던 시절, 기본가가 7→24 로 오르는 동안
    // 정찰료만 굳어 있어서 엽전당 전투력이 뒤집혔다(기본 0.052 < 고급 0.074).
    // 정률로 바꾼 뒤에도 뒤집히지 않는다는 것을 계수에서 직접 재현한다.
    const bandPower = (intent: "balanced" | "midstar" | "highstar"): number => {
      const band = SUMMON_STAR_BANDS[intent];
      if (band === null) throw new Error(`밴드 없는 상품: ${intent}`);
      const [min, max] = band;
      let weightSum = 0;
      let powerSum = 0;
      for (let star = min; star <= max; star += 1) {
        const weight = Math.pow(CASUAL_STAR_DECAY, star - min);
        weightSum += weight;
        powerSum += weight * CASUAL_STAR_POWER[star as CasualStar];
      }
      return powerSum / weightSum;
    };

    // 초반 가격은 정액 시절과 한 푼도 다르지 않아야 한다 — 계수는 그 조건으로 골랐다.
    expect([0, 12, 204].map((count) => summonCost(count))).toEqual([7, 8, 24]);
    const priceRow = (count: number) =>
      (["balanced", "discovery", "lineage", "concentration", "midstar", "highstar"] as const)
        .map((intent) => summonProductCost(count, intent));
    expect(priceRow(0)).toEqual([7, 9, 10, 9, 12, 19]);
    expect(priceRow(204)).toEqual([24, 31, 35, 31, 41, 65]);

    for (let count = 0; count <= 240; count += 12) {
      const base = summonCost(count);
      const [balanced, discovery, lineage, concentration, midstar, highstar] = priceRow(count);
      // 가격 사다리는 기본가 전 구간에서 엄격히 단조롭다.
      expect(balanced).toBe(base);
      expect(discovery).toBe(concentration);
      expect(discovery as number).toBeGreaterThan(balanced as number);
      expect(lineage as number).toBeGreaterThan(discovery as number);
      expect(midstar as number).toBeGreaterThan(lineage as number);
      expect(highstar as number).toBeGreaterThan(midstar as number);
      // 가격은 언제나 [기본가 × 배수]에서 반올림 한 칸 이내다(= 정액 정찰료로 되돌아가면 깨진다).
      for (const intent of ["discovery", "lineage", "concentration", "midstar", "highstar"] as const) {
        expect(Math.abs(summonProductCost(count, intent) - base * SUMMON_COST_MULTIPLIER[intent])).toBeLessThanOrEqual(0.5 + 1e-9);
      }
      // 엽전당 전투력 순위: 기본(화력) > 중급 > 고급(별 프리미엄). 전 구간 고정.
      const perCoin = (intent: "balanced" | "midstar" | "highstar") => bandPower(intent) / summonProductCost(count, intent);
      expect(perCoin("balanced")).toBeGreaterThan(perCoin("midstar"));
      expect(perCoin("midstar")).toBeGreaterThan(perCoin("highstar"));
    }

    // 10연은 균형가 열 장 값 그대로다 — 할인도 할증도 없다.
    for (const count of [0, 96, 204]) {
      const straight = Array.from({ length: 10 }, (_, index) => summonProductCost(count + index, "balanced"))
        .reduce((total, cost) => total + cost, 0);
      expect(multiSummonCost(count, 10)).toBe(straight);
    }
  });

  it("slopes the in-band distribution so the band floor is common and the ceiling is rare", () => {
    // 밴드만 걸고 균등하게 뽑으면 글자 수가 가장 많은 별(1★ 332자)이 그대로 이기거나,
    // 반대로 상단이 흔해져 조합 루프가 무너진다. 별 단위 목표 분포로 눌러
    // "하한이 가장 흔하고 한 칸 오를 때마다 드물어진다"를 실측으로 지킨다.
    const sample = (intent: "balanced" | "highstar", trials: number): Map<number, number> => {
      const engine = new GameEngine(`casual-slope-${intent}`, "KR", "casual");
      engine.setAutoPlaceSummons(false);
      engine.begin();
      const counts = new Map<number, number>();
      for (let index = 0; index < trials; index += 1) {
        engine.state.gold = summonProductCost(engine.state.summonCount, intent);
        expect(engine.summonProduct(intent)).toMatchObject({ ok: true });
        const drawn = engine.state.inventoryTowers[engine.state.inventoryTowers.length - 1];
        const star = drawn?.naturalStar ?? 0;
        counts.set(star, (counts.get(star) ?? 0) + 1);
      }
      return counts;
    };

    const base = sample("balanced", 400);
    expect(base.get(1) ?? 0).toBeGreaterThan(base.get(2) ?? 0);
    expect(base.get(2) ?? 0).toBeGreaterThan(base.get(3) ?? 0);
    // 상한 3★ 위는 잭팟 꼬리다(총 ~2.2%). 400회 기준 0~30회 사이 — 사라지면
    // 하드 필터로의 회귀, 흔해지면 "확 떨어짐"의 소실이다.
    const baseTail = [4, 5, 6, 7, 8].reduce((total, star) => total + (base.get(star) ?? 0), 0);
    expect(baseTail).toBeLessThanOrEqual(30);
    // 400회에서 3★(16%)는 수십 회 나온다 — 꼬리(2%)가 그보다 흔할 수는 없다.
    expect(baseTail).toBeLessThan(base.get(3) ?? 0);

    const high = sample("highstar", 400);
    expect(high.get(3) ?? 0).toBeGreaterThan(high.get(4) ?? 0);
    expect(high.get(4) ?? 0).toBeGreaterThan(high.get(6) ?? 0);
    // 고급 밴드 최상단(7·8★)은 "가끔 터지는" 자리다. 흔해져도 사라져도 안 된다.
    const top = ((high.get(7) ?? 0) + (high.get(8) ?? 0)) / 400;
    expect(top).toBeGreaterThan(0.02);
    expect(top).toBeLessThan(0.09);
  });

  it("extends a steep jackpot tail above the soft band ceiling", () => {
    // 원 기획 #10 복원: "아주 낮은 확률로 그 위 별도 나온다 — 오를수록 확 떨어짐".
    // summonStarDistribution 은 확률 공개 UI 의 단일 원천이므로 수학 자체를 고정한다.
    const engine = new GameEngine("casual-tail", "KR", "casual");
    engine.begin();
    const distribution = engine.summonStarDistribution("balanced");
    expect(distribution).not.toBeNull();
    const shares = new Map((distribution ?? []).map((row) => [row.star, row.share]));
    expect([...shares.values()].reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
    // 밴드 안은 기존 감쇠 그대로.
    expect((shares.get(2) ?? 0) / (shares.get(1) ?? 1)).toBeCloseTo(CASUAL_STAR_DECAY, 10);
    expect((shares.get(3) ?? 0) / (shares.get(2) ?? 1)).toBeCloseTo(CASUAL_STAR_DECAY, 10);
    // 상한을 넘는 순간 훨씬 가파른 꼬리로 꺾여 8★까지 이어진다.
    expect(CASUAL_STAR_TAIL_DECAY).toBeLessThan(CASUAL_STAR_DECAY / 2);
    expect((shares.get(4) ?? 0) / (shares.get(3) ?? 1)).toBeCloseTo(CASUAL_STAR_TAIL_DECAY, 10);
    expect((shares.get(5) ?? 0) / (shares.get(4) ?? 1)).toBeCloseTo(CASUAL_STAR_TAIL_DECAY, 10);
    // 목표 감각: 기본 소환 4★+ 는 2% 안팎, 5★ 0.2%대, 8★은 로또(0.001% 미만).
    const tail = ([4, 5, 6, 7, 8] as CasualStar[]).reduce((sum, star) => sum + (shares.get(star) ?? 0), 0);
    expect(tail).toBeGreaterThan(0.01);
    expect(tail).toBeLessThan(0.03);
    expect(shares.get(5) ?? 0).toBeGreaterThan(0.001);
    expect(shares.get(5) ?? 0).toBeLessThan(0.004);
    expect(shares.get(8) ?? 0).toBeGreaterThan(0);
    expect(shares.get(8) ?? 0).toBeLessThan(0.00001);

    // 하한은 하드 그대로 — 티어 분포는 하한 밑이 정확히 0이다.
    const midstar = engine.summonStarDistribution("midstar") ?? [];
    expect(midstar.find((row) => row.star === 1)?.share).toBe(0);
    expect(midstar.find((row) => row.star === 6)?.share ?? 0).toBeGreaterThan(0);
    const highstar = engine.summonStarDistribution("highstar") ?? [];
    expect(highstar.filter((row) => row.star <= 2).every((row) => row.share === 0)).toBe(true);
    // 고급 밴드는 상한이 8★ 이라 꼬리 구간이 없고 기존 분포 그대로다.
    expect((highstar.find((row) => row.star === 8)?.share ?? 0) / (highstar.find((row) => row.star === 7)?.share ?? 1))
      .toBeCloseTo(CASUAL_STAR_DECAY, 10);

    // 자형연성은 밴드도 분포도 없다.
    const standard = new GameEngine("standard-tail", "KR", "standard");
    standard.begin();
    expect(standard.summonStarDistribution("balanced")).toBeNull();

    // 순수 계산 검증 — 후보에 없는 별은 0 이 되고 남은 별로 재정규화된다.
    const partial = casualSummonStarDistribution({ min: 1, max: 3 }, new Set([1, 2, 3, 4]));
    expect(partial.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 10);
    expect(partial.find((row) => row.star === 5)?.share).toBe(0);
    expect(casualStarBandShare(0, { min: 1, max: 3 })).toBe(0);
  });

  it("guarantees one band-ceiling summon in every casual ten-pull", () => {
    // 기본 밴드 상한 3★ 는 자연 확률이 1/6 남짓이라 열 장이 통째로 비는 판이 나온다.
    // 마지막 한 장의 후보를 상한 별로 좁혀 "10연 = 3★ 1기"를 문구 그대로 지킨다.
    for (let run = 0; run < 40; run += 1) {
      const engine = new GameEngine(`casual-ten-${run}`, "KR", "casual");
      engine.setAutoPlaceSummons(false);
      engine.begin();
      engine.state.wave = 12;
      engine.state.gold = 100_000;
      expect(engine.summonMany(10)).toMatchObject({ ok: true });
      const stars = engine.state.inventoryTowers.map((tower) => tower.naturalStar ?? 0);
      expect(stars).toHaveLength(10);
      // 하한은 하드, 상한은 소프트 — 보장은 "상한 이상 1기"로 읽는다(잭팟도 인정).
      expect(stars.every((star) => star >= 1)).toBe(true);
      expect(stars.filter((star) => star >= 3).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("drops the tier product where the regional pool is too thin to honour a band", () => {
    // JP·CN 활성 풀은 30여 자뿐이라 2★ 이상 후보가 한 자릿수다. 하한을 그대로
    // 걸면 같은 글자만 반복되므로 상품 자체를 닫는다(가짜 보장 판매 금지).
    // 하한 1인 기본 밴드는 남아 있어야 소환 자체가 막히지 않는다.
    for (const region of ["JP", "CN"] as const) {
      const engine = new GameEngine(`casual-tier-${region}`, region, "casual");
      engine.setAutoPlaceSummons(false);
      engine.begin();
      const eligible = (floor: number) =>
        engine.summonDefinitions().filter((definition) => (casualNaturalStar(definition.char) ?? 1) >= floor).length;
      expect(eligible(2)).toBeLessThan(MIN_TIER_POOL_SIZE);
      expect(engine.summonStarBand("midstar")).toBeNull();
      expect(engine.summonStarBand("highstar")).toBeNull();
      expect(engine.isSummonProductAvailable("midstar")).toBe(false);
      expect(engine.summonProduct("highstar")).toMatchObject({ ok: false });
      expect(engine.summonStarBand("balanced")).toEqual({ min: 1, max: 3 });
      for (let index = 0; index < 40; index += 1) {
        engine.state.gold = summonCost(engine.state.summonCount);
        expect(engine.summonProduct("balanced")).toMatchObject({ ok: true });
      }
      // 소형 풀에서도 "주로 1~3★"는 유효하다 — 꼬리(≈2%)가 있으니 상한 위를
      // 전면 금지하지는 않되, 40회 중 4회를 넘으면 밴드가 무너진 것이다.
      const smallPoolStars = engine.state.inventoryTowers.map((tower) => tower.naturalStar ?? 0);
      expect(smallPoolStars.every((star) => star >= 1)).toBe(true);
      expect(smallPoolStars.filter((star) => star > 3).length).toBeLessThanOrEqual(4);
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
    // 300 표본은 소프트 밴드 도입으로 뽑기 열이 재배열되자 우연히 문턱을 스쳤다.
    // (3,000 표본 실측 1.69x — 배수 자체는 건재.) 표본을 늘려 우연을 걷어낸다.
    const trials = 900;
    const seeded = firstDrawHits(true, trials);
    const plain = firstDrawHits(false, trials);
    // 설계 배수는 2.2x 이고 다른 가중항이 희석해 실측 1.7x 안팎이 나온다.
    expect(plain).toBeGreaterThan(0);
    expect(seeded).toBeGreaterThan(plain * 1.35);
  });

  it("provides monotonic star power and unlocks active skills from 2-star onward", () => {
    const multipliers = Object.values(CASUAL_STAR_POWER);
    expect(multipliers.every((value, index) => index === 0 || value > (multipliers[index - 1] ?? 0))).toBe(true);
    const engine = casualEngine("casual-skill-unlock");
    const definition = safeCasualDefinitions(engine, 1)[0] as HanziDefinition;
    const tower = casualTower(definition, 1201, -1, 1);
    expect(engine.towerHasActiveSkills(tower)).toBe(false);
    tower.casualStar = 2;
    expect(engine.towerHasActiveSkills(tower)).toBe(true);
    tower.casualStar = 8;
    expect(engine.towerPowerMultiplier(tower)).toBe(CASUAL_STAR_POWER[8]);
  });

  it("grants the deployed 8-star polaris aura to its element only, without stacking", () => {
    // FB7-8성 「극성 개안」: 전장의 8★ 자령이 같은 오행 전체 공격을 15% 올린다.
    const engine = casualEngine("casual-polaris-aura");
    const definitions = safeCasualDefinitions(engine, 2);
    const wuxing = definitions[0]?.wuxing as Wuxing;
    const other = WUXING_ORDER.find((candidate) => candidate !== wuxing) as Wuxing;
    expect(engine.casualPolarisAuraActive(wuxing)).toBe(false);
    expect(engine.casualPolarisDamageMultiplier(wuxing)).toBe(1);

    // 인벤토리의 8★ 는 오라를 내지 않는다.
    const stored = casualTower(definitions[0] as HanziDefinition, 1301, -1, 8);
    engine.state.inventoryTowers = [stored];
    expect(engine.casualPolarisAuraActive(wuxing)).toBe(false);

    // 전장에 서면 그 오행만 켜지고, 두 기가 있어도 배율은 그대로다(중첩 불가).
    const deployed = casualTower(definitions[0] as HanziDefinition, 1302, 0, 8);
    engine.state.towers = [deployed];
    expect(engine.casualPolarisAuraActive(wuxing)).toBe(true);
    expect(engine.casualPolarisAuraActive(other)).toBe(false);
    expect(engine.casualPolarisDamageMultiplier(wuxing)).toBeCloseTo(1.15, 5);
    engine.state.towers.push(casualTower(definitions[1] as HanziDefinition, 1303, 1, 8));
    expect(engine.casualPolarisDamageMultiplier(wuxing)).toBeCloseTo(1.15, 5);

    // 표준 모드에는 이 오라가 없다.
    const standard = new GameEngine("standard-no-polaris", "KR");
    standard.begin();
    expect(standard.casualPolarisDamageMultiplier(wuxing)).toBe(1);
  });

  it("widens splash radius and ratio with the casual star while standard stays stage-scaled", () => {
    // 수술 5(사용자 지시): 광역 계열이 별과 무관하게 일정하던 것을 바로잡는다.
    const engine = casualEngine("casual-splash-scale");
    const definition = safeCasualDefinitions(engine, 1)[0] as HanziDefinition;
    const low = casualTower(definition, 1401, 0, 1);
    const high = casualTower(definition, 1402, 1, 8);
    expect(engine.casualSplashRadiusScale(low)).toBe(1);
    expect(engine.casualSplashRatioScale(low)).toBe(1);
    expect(engine.casualSplashRadiusScale(high)).toBeCloseTo(1.49, 5);
    expect(engine.casualSplashRatioScale(high)).toBeCloseTo(1.28, 5);

    const standard = new GameEngine("standard-splash-scale", "KR");
    standard.begin();
    expect(standard.casualSplashRadiusScale(high)).toBe(1);
    expect(standard.casualSplashRatioScale(high)).toBe(1);
  });

  it("narrows low-star reach and steepens per-star range and haste growth", () => {
    // 수술 7(사용자 지시): "등급별 강해지는 느낌" — 저별 사거리를 낮추고 별당 성장을 키운다.
    const engine = casualEngine("casual-star-range");
    const definition = safeCasualDefinitions(engine, 1)[0] as HanziDefinition;
    const low = casualTower(definition, 1601, 0, 1);
    const high = casualTower(definition, 1602, 1, 8);
    expect(engine.towerRangeBonus(low)).toBe(-18);
    expect(engine.towerRangeBonus(high)).toBe(38);
    // 1★ 실효 사거리도 경로에는 닿아야 한다(전 역할 최저 기본 226 기준 208).
    expect(definition.combat.range + engine.towerRangeBonus(low)).toBeGreaterThanOrEqual(190);
    // 공속: 별당 3% — 8★ 는 1★ 보다 뚜렷이 빠르다.
    expect(engine.towerAttackCooldown(high)).toBeLessThan(engine.towerAttackCooldown(low) * 0.85);

    const standard = new GameEngine("standard-star-range", "KR");
    standard.begin();
    expect(standard.towerRangeBonus({ ...low, stage: 1 })).toBe(0);
    expect(standard.towerRangeBonus({ ...low, stage: 5 })).toBe(28);
  });

  it("keeps every casual goal inside the summonable pool in all regions (F2)", () => {
    // F2: JP/CN 목표(林·森 등)가 미리보기 소환 풀 밖이라 달성 불가였다.
    for (const region of ["KR", "JP", "CN"] as const) {
      const engine = casualEngine(`casual-goal-pool-${region}`, region);
      const pool = new Set(engine.summonDefinitions().map((definition) => definition.char));
      expect(engine.goalOrder.length).toBeGreaterThan(0);
      expect(engine.goalOrder.length).toBe(engine.catalog.goalOrder.length);
      for (const char of engine.goalOrder) expect(pool.has(char)).toBe(true);
      expect(engine.state.targetChar).toBe(engine.goalOrder[0]);
    }
    // 표준 모드 목표는 그대로다.
    const standard = new GameEngine("standard-goal-pool", "JP");
    standard.begin();
    expect(standard.goalOrder).toEqual(standard.catalog.goalOrder);
  });

  it("completes the casual goal when the target char arrives through a fusion (F2)", () => {
    // JP 캐주얼의 첫 목표 故 는 火 1★→2★ 결과 풀의 유일 후보라 승급 결과가 보장된다.
    const engine = casualEngine("casual-goal-fusion", "JP");
    expect(engine.state.targetChar).toBe("故");
    const pool = engine.casualResultPool("火", 1);
    expect(pool?.candidates.map((definition) => definition.char)).toEqual(["故"]);

    const protectedChars = new Set([engine.state.targetChar, ...(engine.currentIdiomTarget()?.chars ?? "")]);
    const material = engine.catalog.activePool.find((definition) =>
      definition.wuxing === "火" && casualNaturalStar(definition.char) === 1 && !protectedChars.has(definition.char));
    expect(material).toBeDefined();
    engine.state.towers = [];
    engine.state.inventoryTowers = [1501, 1502, 1503].map((id) => casualTower(material as HanziDefinition, id, -1, 1));
    const result = engine.fuseCasual([1501, 1502, 1503], true);
    expect(result.ok).toBe(true);
    expect(result.gained?.char).toBe("故");
    expect(engine.state.goalsCompleted).toContain("故");
    expect(engine.state.targetChar).toBe(engine.goalOrder[1]);
  });
});
