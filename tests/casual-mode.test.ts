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
    engine.state.idiomSeals.push({ idiomId: "sealed-fixture", cells: [2, 3], completedAt: 0 });

    expect(engine.casualMaterialProtection(locked.id)).toBe("잠금 자령");
    expect(engine.casualMaterialProtection(concentrated.id)).toBe("농축 2단계 투자");
    expect(engine.casualMaterialProtection(towers[2]?.id ?? -1)).toBe("봉인 완료 사자성어 참여");
    expect(engine.casualMaterialProtection(towers[3]?.id ?? -1)).toBe("봉인 완료 사자성어 참여");

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

  it("keeps every casual summon inside its advertised star band and charges the exact surcharge", () => {
    // 뽑기 별이 완전 무작위면 "같은 오행·같은 별 3기"라는 조합 루프가 성립하지 않는다.
    // 밴드는 가중이 아니라 후보 풀 필터이므로 200회 전부 상·하한을 지켜야 한다.
    // 특히 기본 밴드 상한 3★ 가 새는 순간 "뽑기로 상위 별"이 되어 조합이 죽는다.
    for (const [intent, min, max] of [["balanced", 1, 3], ["midstar", 2, 5], ["highstar", 3, 8]] as const) {
      const engine = new GameEngine(`casual-band-${intent}`, "KR", "casual");
      engine.setAutoPlaceSummons(false);
      engine.begin();
      expect(engine.summonStarBand(intent)).toEqual({ min, max });
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
      const stars = engine.state.inventoryTowers.map((tower) => tower.naturalStar ?? 0);
      expect(stars.every((star) => star >= min && star <= max)).toBe(true);
      // 밴드가 실제로 넓게 쓰이는지도 본다(하한 한 칸에 고정되면 밴드가 아니다).
      expect(new Set(stars).size).toBeGreaterThan(1);
      // 소환 목적은 카드 한 장 안에서만 유효하다. 상태로 남지 않는다.
      expect(engine.state.summonIntent).toBe("balanced");
    }
    expect(SUMMON_SURCHARGE.balanced).toBe(0);

    // 자형연성은 별 수집이 루프가 아니므로 티어 상품도 밴드도 없다.
    const standard = new GameEngine("standard-tier", "KR", "standard");
    standard.begin();
    expect(standard.summonStarBand("balanced")).toBeNull();
    expect(standard.summonStarBand("highstar")).toBeNull();
    expect(standard.isSummonProductAvailable("midstar")).toBe(false);
    expect(standard.isSummonProductAvailable("highstar")).toBe(false);
    expect(standard.isSummonProductAvailable("lineage")).toBe(true);
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
        engine.state.gold = summonCost(engine.state.summonCount) + SUMMON_SURCHARGE[intent];
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
    // 기본 밴드에서 4★ 이상은 단 한 번도 나오지 않는다.
    expect([4, 5, 6, 7, 8].reduce((total, star) => total + (base.get(star) ?? 0), 0)).toBe(0);

    const high = sample("highstar", 400);
    expect(high.get(3) ?? 0).toBeGreaterThan(high.get(4) ?? 0);
    expect(high.get(4) ?? 0).toBeGreaterThan(high.get(6) ?? 0);
    // 고급 밴드 최상단(7·8★)은 "가끔 터지는" 자리다. 흔해져도 사라져도 안 된다.
    const top = ((high.get(7) ?? 0) + (high.get(8) ?? 0)) / 400;
    expect(top).toBeGreaterThan(0.02);
    expect(top).toBeLessThan(0.09);
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
      expect(stars.every((star) => star >= 1 && star <= 3)).toBe(true);
      expect(stars.filter((star) => star === 3).length).toBeGreaterThanOrEqual(1);
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
      expect(engine.state.inventoryTowers.every((tower) => (tower.naturalStar ?? 0) <= 3)).toBe(true);
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
    const engine = casualEngine("casual-skill-unlock");
    const definition = safeCasualDefinitions(engine, 1)[0] as HanziDefinition;
    const tower = casualTower(definition, 1201, -1, 1);
    expect(engine.towerHasActiveSkills(tower)).toBe(false);
    tower.casualStar = 2;
    expect(engine.towerHasActiveSkills(tower)).toBe(true);
    tower.casualStar = 8;
    expect(engine.towerPowerMultiplier(tower)).toBe(CASUAL_STAR_POWER[8]);
  });
});
