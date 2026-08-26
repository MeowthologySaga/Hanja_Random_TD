import { describe, expect, it } from "vitest";
import {
  GameEngine,
  TUTORIAL_ENEMY_COUNT_SCALE,
  TUTORIAL_ENEMY_HP_SCALE
} from "../src/core/game";
import { wavePlan } from "../src/core/content";

const SEED = "TUTORIAL-HOOK-TEST";

function beginEngine(tutorial: boolean): GameEngine {
  const engine = new GameEngine(SEED, "KR", "casual", { tutorial });
  engine.begin();
  return engine;
}

describe("수련장 엔진 훅", () => {
  it("일반 런에서는 tutorialGrant* 가 상태를 바꾸지 않는다", () => {
    const engine = beginEngine(false);
    const gold = engine.state.gold;
    expect(engine.tutorialGrantGold(50).ok).toBe(false);
    expect(engine.tutorialGrantEssence("木", 10).ok).toBe(false);
    expect(engine.tutorialGrantTower("木").ok).toBe(false);
    expect(engine.state.gold).toBe(gold);
    expect(engine.state.elementEssence.木).toBe(0);
    expect(engine.state.inventoryTowers).toHaveLength(0);
  });

  it("수련장에서는 엽전·문기·지정 자령이 지급된다", () => {
    const engine = beginEngine(true);
    const gold = engine.state.gold;
    expect(engine.tutorialGrantGold(50).ok).toBe(true);
    expect(engine.state.gold).toBe(gold + 50);
    expect(engine.tutorialGrantEssence("火", 12).ok).toBe(true);
    expect(engine.state.elementEssence.火).toBe(12);
    const summonCountBefore = engine.state.summonCount;
    expect(engine.tutorialGrantTower("木").ok).toBe(true);
    expect(engine.state.inventoryTowers).toHaveLength(1);
    expect(engine.state.inventoryTowers[0]?.char).toBe("木");
    // 지급은 소환 횟수(가격 곡선)를 올리지 않고, 발견·선택만 남긴다.
    expect(engine.state.summonCount).toBe(summonCountBefore);
    expect(engine.state.discoveredChars).toContain("木");
    expect(engine.state.selectedTowerId).toBe(engine.state.inventoryTowers[0]?.id);
    // 지급 연출은 일반 소환 이벤트(인벤토리 보관)를 탄다.
    const summonEvents = engine.consumeEvents().filter((event) => event.type === "summon");
    expect(summonEvents).toHaveLength(1);
  });

  it("없는 한자를 지급하면 거부한다", () => {
    const engine = beginEngine(true);
    expect(engine.tutorialGrantTower("〇").ok).toBe(false);
    expect(engine.state.inventoryTowers).toHaveLength(0);
  });

  it("수련장 웨이브는 잔존 합류 없이 전멸해야만 끝난다", () => {
    const engine = beginEngine(true);
    expect(engine.summon().ok).toBe(true);
    expect(engine.startWaveEarly().ok).toBe(true);
    // 잔존 합류 시계(20초)를 훌쩍 넘겨도 다음 웨이브가 겹쳐 오지 않는다.
    for (let frame = 0; frame < 450; frame += 1) engine.update(0.1);
    expect(engine.state.wave).toBe(1);
    expect(engine.state.nextWaveRemaining).toBeNull();
  });

  it("수련장 웨이브는 수량·체력이 완화 계수만큼 줄어든다", () => {
    const run = (tutorial: boolean): GameEngine => {
      const engine = beginEngine(tutorial);
      // 동일한 호출 순서를 지켜 두 엔진의 난수 소비를 맞춘다.
      expect(engine.summon().ok).toBe(true);
      expect(engine.startWaveEarly().ok).toBe(true);
      for (let frame = 0; frame < 40 && engine.state.enemies.length === 0; frame += 1) engine.update(0.1);
      return engine;
    };
    const normal = run(false);
    const relaxed = run(true);
    const plan = wavePlan(1);
    expect(normal.getCurrentPlan()?.count).toBe(plan.count);
    expect(relaxed.getCurrentPlan()?.count).toBe(Math.max(3, Math.round(plan.count * TUTORIAL_ENEMY_COUNT_SCALE)));
    const normalHp = normal.state.enemies[0]?.maxHp ?? 0;
    const relaxedHp = relaxed.state.enemies[0]?.maxHp ?? 0;
    expect(normalHp).toBeGreaterThan(0);
    expect(relaxedHp).toBeCloseTo(normalHp * TUTORIAL_ENEMY_HP_SCALE, 6);
  });
});
