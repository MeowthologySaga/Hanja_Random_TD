import { describe, expect, it } from "vitest";
import { casualNaturalStar } from "../src/core/casual";
import { IDIOM_WISH_COST_MULTIPLIER, idiomWishCost } from "../src/core/engine-tuning";
import { GameEngine } from "../src/core/game";
import { summonCost } from "../src/core/hanzi";
import { helpfulDirectCharsForIdiom, idiomById, idiomWishChars } from "../src/core/idioms";
import type { GameEvent, GameMode, HanziDefinition, Tower } from "../src/core/types";

/**
 * 트랙 F — 성어 기원 소환(전투력 비연동 성어 획득 경로).
 *
 * 검증 축 세 가지: ① 부족 글자 풀 산출(1:1 대응·추적 성어 합집합),
 * ② 부족 글자 0(추적 없음/완성)일 때 비활성 + 사유, ③ 결과는 항상 1★(캐주얼).
 * 이 상품은 summon() 의 가중·밴드·연민 경로를 전혀 타지 않으므로, 여기서
 * 실패하면 상품 자체의 회귀지 기존 소환 밸런스의 회귀가 아니다.
 */

function engineOf(seed: string, mode: GameMode): GameEngine {
  const engine = new GameEngine(seed, "KR", mode);
  engine.begin();
  return engine;
}

function towerOf(engine: GameEngine, char: string, id: number): Tower {
  const definition = engine.catalog.definitions.get(char);
  if (!definition) throw new Error(`Missing definition for ${char}`);
  return {
    id,
    definitionId: definition.id,
    char: definition.char,
    wuxing: definition.wuxing,
    stage: definition.stage,
    combatRole: definition.combat.role,
    graphRole: definition.graph.graphRole,
    cell: -1,
    cooldownLeft: 0,
    pulse: 0,
    shotCount: 0,
    abilityFlash: 0,
    locked: false,
    concentration: 0,
    concentrationPath: null,
    naturalStar: casualNaturalStar(char) ?? undefined,
    casualStar: casualNaturalStar(char) ?? undefined
  };
}

function wishPoolChars(engine: GameEngine): string[] {
  return engine.idiomWishPool().map((definition: HanziDefinition) => definition.char).sort();
}

describe("idiom wish summon (성어 기원)", () => {
  it("computes the missing-char pool with one-to-one matching in casual mode", () => {
    const engine = engineOf("wish-pool", "casual");
    expect(engine.setIdiomTarget("heart")).toMatchObject({ ok: true }); // 以心傳心 — 心 2회 요구
    expect(engine.currentIdiomTarget()?.id).toBe("heart");
    // 아무것도 없으면 성어의 서로 다른 글자 전부가 부족이다(집합이라 心은 한 번).
    expect(wishPoolChars(engine)).toEqual(["以", "傳", "心"].sort());
    // 心 1기 보유 — 요구는 2회이므로 心은 여전히 부족하다(1:1 대응).
    engine.state.inventoryTowers = [towerOf(engine, "心", 901)];
    expect(wishPoolChars(engine)).toEqual(["以", "傳", "心"].sort());
    // 心 2기 — 心 충족, 以·傳만 남는다.
    engine.state.inventoryTowers = [towerOf(engine, "心", 901), towerOf(engine, "心", 902)];
    expect(wishPoolChars(engine)).toEqual(["以", "傳"].sort());
  });

  it("unions missing chars across every tracked idiom (merge point for multi-tracking)", () => {
    const engine = engineOf("wish-union", "casual");
    const heart = idiomById("KR", "heart");
    const sureHit = idiomById("KR", "sure-hit"); // 百發百中 — 百 2회 요구
    if (!heart || !sureHit) throw new Error("Missing KR idiom fixtures");
    const owned = [towerOf(engine, "心", 901), towerOf(engine, "心", 902), towerOf(engine, "百", 903)];
    const union = idiomWishChars(engine.catalog, owned, [heart, sureHit], "casual");
    // heart 는 以·傳, sure-hit 는 百(1/2)·發·中 이 부족 — 합집합.
    expect([...union].sort()).toEqual(["中", "以", "傳", "發", "百"].sort());
  });

  it("disables the product with a reason when nothing is missing or nothing is tracked", () => {
    const engine = engineOf("wish-disabled", "casual");
    engine.state.summonCount = 1; // 첫 소환 가드 통과
    expect(engine.setIdiomTarget("heart")).toMatchObject({ ok: true });
    // 네 글자를 전부 갖추면 "완성" 사유로 비활성.
    engine.state.inventoryTowers = [
      towerOf(engine, "以", 901),
      towerOf(engine, "心", 902),
      towerOf(engine, "傳", 903),
      towerOf(engine, "心", 904)
    ];
    expect(engine.idiomWishPool()).toHaveLength(0);
    expect(engine.idiomWishQuote().reason).toContain("부족 글자가 없습니다");
    engine.state.gold = 999;
    expect(engine.summonIdiomWish()).toMatchObject({ ok: false });
    // 추적 성어가 아예 없으면(전부 봉인 기록) 그 사유로 비활성.
    engine.state.inventoryTowers = [];
    engine.state.idiomSeals = engine.idioms().map((idiom) => ({ idiomId: idiom.id, cells: [], completedAt: 0, active: false }));
    expect(engine.currentIdiomTarget()).toBeUndefined();
    expect(engine.idiomWishQuote().reason).toContain("추적 성어가 없습니다");
    expect(engine.summonIdiomWish()).toMatchObject({ ok: false });
    // 첫 소환 전에는 오행진이 없어 가드 사유로 비활성.
    const fresh = engineOf("wish-guard", "casual");
    fresh.state.gold = 999;
    expect(fresh.idiomWishQuote().reason).toContain("첫 소환");
    expect(fresh.summonIdiomWish()).toMatchObject({ ok: false });
  });

  it("always births a 1-star spirit in casual mode and charges the tuned multiple", () => {
    const engine = engineOf("wish-star", "casual");
    expect(engine.setIdiomTarget("heart")).toMatchObject({ ok: true });
    engine.state.summonCount = 3;
    // 以·心·心 을 쥐어 부족 글자를 傳 하나로 좁힌다 — 결과가 결정된다.
    engine.state.inventoryTowers = [towerOf(engine, "以", 901), towerOf(engine, "心", 902), towerOf(engine, "心", 903)];
    expect(wishPoolChars(engine)).toEqual(["傳"]);
    // 傳(13획)은 자연 별이 1★ 보다 높아야 "고정"이 실제로 검증된다.
    expect(casualNaturalStar("傳") ?? 0).toBeGreaterThan(1);
    engine.state.gold = 500;
    const cost = idiomWishCost(summonCost(engine.state.summonCount));
    const result = engine.summonIdiomWish();
    expect(result).toMatchObject({ ok: true });
    expect(engine.state.gold).toBe(500 - cost);
    const summoned = [...engine.state.towers, ...engine.state.inventoryTowers].find((tower) => tower.char === "傳");
    expect(summoned).toBeDefined();
    expect(summoned?.casualStar).toBe(1);
    expect(summoned?.naturalStar).toBe(1);
    // 발표막·광채가 "성어 재료"로 읽도록 소환 이벤트에 idiom 사유가 실린다.
    const summonEvents = engine.consumeEvents().filter(
      (event): event is Extract<GameEvent, { type: "summon" }> => event.type === "summon"
    );
    expect(summonEvents.at(-1)).toMatchObject({ helpful: true, helpfulReason: "idiom" });
    expect(summonEvents.at(-1)?.tower.casualStar).toBe(1);
    // 부족 글자가 다 찼으니 다음 구매는 사유와 함께 막힌다.
    engine.state.gold = 500;
    expect(engine.summonIdiomWish()).toMatchObject({ ok: false });
  });

  it("stays casual-only: standard mode keeps the pool contract but refuses the purchase", () => {
    // 실측(짝시드 90런): 자형연성에서 이 상품은 승률 0.556→0.733 으로 새고
    // 성어 봉인은 오히려 줄었다 — 부족 글자가 곧 합성 재료라 "반드시 유용한
    // 소환"이 진화 루프(전투력)로 직결된다. 그래서 상품은 별승급 전용이다.
    const engine = engineOf("wish-standard", "standard");
    expect(engine.setIdiomTarget("heart")).toMatchObject({ ok: true });
    engine.state.summonCount = 1;
    const target = engine.currentIdiomTarget();
    if (!target) throw new Error("Missing tracked idiom");
    // 부족 글자 계약(합집합 함수)의 자형연성 갈래는 목표 개편 트랙을 위해
    // 유지된다 — 기존 추적 경로(helpfulDirectCharsForIdiom)와 동일해야 한다.
    const expected = helpfulDirectCharsForIdiom(engine.catalog, [], target);
    const chars = idiomWishChars(engine.catalog, [], [target], "standard");
    expect([...chars].sort()).toEqual([...expected].sort());
    expect(chars.size).toBeGreaterThan(0);
    // 상품 자체는 잠긴다: 사유가 붙고 구매는 엽전이 충분해도 거절된다.
    engine.state.gold = 500;
    expect(engine.idiomWishQuote().reason).toContain("별승급");
    expect(engine.summonIdiomWish()).toMatchObject({ ok: false });
    expect(engine.state.gold).toBe(500);
  });

  it("prices the wish inside the agreed 2.5x-3x band of the base summon curve", () => {
    expect(IDIOM_WISH_COST_MULTIPLIER).toBeGreaterThanOrEqual(2.5);
    expect(IDIOM_WISH_COST_MULTIPLIER).toBeLessThanOrEqual(3);
    expect(idiomWishCost(7)).toBe(19); // 초반 기본가 7 기준
    expect(idiomWishCost(24)).toBe(66); // 후반 기본가 24 기준
    for (let base = 7; base <= 24; base += 1) {
      const ratio = idiomWishCost(base) / base;
      expect(ratio).toBeGreaterThanOrEqual(2.5);
      expect(ratio).toBeLessThanOrEqual(3);
    }
  });
});
