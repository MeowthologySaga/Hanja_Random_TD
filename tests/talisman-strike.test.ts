/*
 * 부적 보상 가운데 **화면에서 벌어지는 것** 셋.
 *
 * 여태 보상은 엽전·문기·소환권뿐이라 쓴 보람이 숫자로만 남았다(기획안 v035 ①).
 * 이 셋은 전장을 건드리므로 엔진에 문이 필요했고, 그 문이 제 몫만 하는지를
 * 여기서 지킨다 — 특히 **정상 피해 경로를 탄다**는 것. 화면이 hp 를 직접 깎으면
 * 0 이 된 적이 살아남거나 처치 보상이 새므로, 그 경계를 못 박아 둔다.
 */
import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/core/game";

function engineInCombat(): GameEngine {
  const engine = new GameEngine("talisman-strike-seed", "KR", "standard");
  engine.begin();
  /*
   * 자령을 한 기 세워야 시계가 돈다 — 첫 소환 전에는 준비 시간도 안 흐른다
   * (update 가 그 자리에서 돌아선다). 「진짜 계획 상태」라는 규칙의 반영이다.
   */
  engine.summon();
  for (let step = 0; step < 600 && engine.state.phase !== "combat"; step += 1) engine.update(0.1);
  for (let step = 0; step < 600 && engine.state.enemies.length === 0; step += 1) engine.update(0.1);
  return engine;
}

describe("자령 강림 · 일격", () => {
  it("전장의 적을 모두 친다", () => {
    const engine = engineInCombat();
    expect(engine.state.enemies.length).toBeGreaterThan(0);
    const before = engine.state.enemies.map((enemy) => ({ id: enemy.id, hp: enemy.hp }));
    const struck = engine.talismanStrike(0.09, 6, "木");
    expect(struck).toBe(before.length);
    for (const past of before) {
      const now = engine.state.enemies.find((enemy) => enemy.id === past.id);
      // 죽었으면 목록에서 빠진다 — 남아 있다면 체력이 줄어 있어야 한다.
      if (now) expect(now.hp).toBeLessThan(past.hp);
    }
  });

  it("처치하면 정상 경로를 그대로 탄다 — 목록에서 빠지고 엽전이 는다", () => {
    const engine = engineInCombat();
    const goldBefore = engine.state.gold;
    const killsBefore = engine.state.killCount;
    // 한 방에 죽을 만큼 크게 친다.
    engine.talismanStrike(5, 9_999, "木");
    expect(engine.state.enemies.length).toBe(0);
    expect(engine.state.killCount).toBeGreaterThan(killsBefore);
    expect(engine.state.gold).toBeGreaterThan(goldBefore);
  });

  it("적이 없으면 아무 일도 없다", () => {
    const engine = new GameEngine("talisman-strike-empty", "KR", "standard");
    engine.begin();
    expect(engine.talismanStrike(0.5, 10, "木")).toBe(0);
  });
});

describe("봉인의 손", () => {
  it("앞선 적부터 묶는다", () => {
    const engine = engineInCombat();
    const ordered = [...engine.state.enemies].sort((left, right) => right.progress - left.progress);
    const bound = engine.talismanBind(2, 2);
    expect(bound).toBe(Math.min(2, ordered.length));
    for (let index = 0; index < bound; index += 1) {
      expect(ordered[index]!.stunnedUntil).toBeGreaterThan(engine.state.elapsed);
    }
    // 뒤에 오는 적은 건드리지 않는다 — 묶어 봐야 위험이 줄지 않는다.
    for (let index = bound; index < ordered.length; index += 1) {
      expect(ordered[index]!.stunnedUntil).toBeLessThanOrEqual(engine.state.elapsed);
    }
  });

  it("이미 더 오래 묶여 있으면 줄이지 않는다", () => {
    const engine = engineInCombat();
    const target = [...engine.state.enemies].sort((left, right) => right.progress - left.progress)[0]!;
    target.stunnedUntil = engine.state.elapsed + 30;
    engine.talismanBind(1, 2);
    expect(target.stunnedUntil).toBeCloseTo(engine.state.elapsed + 30, 5);
  });
});

describe("문기의 숨", () => {
  it("준비 중에는 시간을 늘린다", () => {
    const engine = new GameEngine("talisman-breath", "KR", "standard");
    engine.begin();
    expect(engine.state.phase).toBe("prep");
    const before = engine.state.prepRemaining;
    expect(engine.talismanBreath(3)).toBe(true);
    expect(engine.state.prepRemaining).toBeCloseTo(before + 3, 5);
  });

  it("교전 중에는 아무 일도 하지 않는다", () => {
    /*
     * 교전 중에 늘려 둬도 다음 웨이브가 설 때 startNextWave 가 다시 앉히므로
     * 아무 일도 안 일어난다. 「했다」고 말하고 안 하는 보상은 없어야 한다.
     */
    const engine = engineInCombat();
    expect(engine.state.phase).toBe("combat");
    const before = engine.state.prepRemaining;
    expect(engine.talismanBreath(3)).toBe(false);
    expect(engine.state.prepRemaining).toBe(before);
  });
});
