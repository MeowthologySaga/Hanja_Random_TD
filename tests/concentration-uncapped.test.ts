import { describe, expect, it } from "vitest";

import { CONCENTRATION_FREEZE_LEVEL, concentrationEssenceCost } from "../src/core/engine-tuning";
import { GameEngine } from "../src/core/game";

describe("농축에는 상한이 없다", () => {
  it("앞 세 단계 값은 예전 그대로다", () => {
    expect([0, 1, 2].map(concentrationEssenceCost)).toEqual([10, 16, 24]);
  });

  it("그 위로는 단계마다 1.5배로 오른다", () => {
    // 무한이되 공짜가 아니라는 것이 상한을 걷는 유일한 조건이다.
    expect(concentrationEssenceCost(3)).toBe(36);
    expect(concentrationEssenceCost(4)).toBe(54);
    expect(concentrationEssenceCost(5)).toBe(81);
    // 열 단계째 한 번이 앞 세 단계 전부(50)의 열 배가 넘는다.
    expect(concentrationEssenceCost(10)).toBeGreaterThan(500);
    for (let level = 1; level < 12; level += 1) {
      expect(concentrationEssenceCost(level)).toBeGreaterThan(concentrationEssenceCost(level - 1));
    }
  });

  it("옛 상한을 넘어서도 견적이 나온다", () => {
    const engine = new GameEngine("concentration-uncapped", "KR");
    engine.begin();
    engine.summon();
    const tower = engine.state.towers[0] ?? engine.state.inventoryTowers[0];
    expect(tower).toBeDefined();

    tower!.concentration = CONCENTRATION_FREEZE_LEVEL;
    const quote = engine.concentrationQuote(tower!.id, "potent");
    expect(quote).not.toBeNull();
    expect(quote?.nextLevel).toBe(CONCENTRATION_FREEZE_LEVEL + 1);
  });

  it("공속은 아무리 올려도 뒤집히지 않는다", () => {
    const engine = new GameEngine("concentration-haste", "KR");
    engine.begin();
    engine.summon();
    const tower = engine.state.towers[0] ?? engine.state.inventoryTowers[0];
    expect(tower).toBeDefined();
    tower!.concentrationPath = "swift";

    /*
     * 선형 0.075/단계였다면 13단계에서 계수가 1.0 을 넘어 대기시간이 음수가 된다.
     * 곱으로 두면 0 에 수렴할 뿐 뒤집히지 않는다.
     */
    let previous = Number.POSITIVE_INFINITY;
    for (const level of [0, 3, 13, 40]) {
      tower!.concentration = level;
      const cooldown = engine.towerAttackCooldown(tower!);
      expect(cooldown).toBeGreaterThan(0);
      expect(cooldown).toBeLessThanOrEqual(previous);
      previous = cooldown;
    }
  });

  it("성어 줄을 지키는 자령은 값을 절반만 낸다", () => {
    const engine = new GameEngine("concentration-seal-discount", "KR");
    engine.begin();
    engine.summon();
    const tower = engine.state.towers[0];
    expect(tower).toBeDefined();

    const full = engine.concentrationQuote(tower!.id, "potent")?.essenceCost;
    expect(full).toBe(10);
    expect(engine.isTowerHoldingIdiom(tower!.id)).toBe(false);

    // 이 자령의 자리를 지키는 봉인을 세운다.
    engine.state.idiomSeals.push({
      idiomId: engine.state.featuredIdiomIds[0] ?? "seal",
      cells: [tower!.cell, tower!.cell + 1, tower!.cell + 2, tower!.cell + 3],
      completedAt: 0,
      active: true
    });

    expect(engine.isTowerHoldingIdiom(tower!.id)).toBe(true);
    expect(engine.concentrationQuote(tower!.id, "potent")?.essenceCost).toBe(5);
  });

  it("흩어진 발동은 감면하지 않는다 — 지금 줄을 지키는 값이다", () => {
    const engine = new GameEngine("concentration-seal-broken", "KR");
    engine.begin();
    engine.summon();
    const tower = engine.state.towers[0];
    expect(tower).toBeDefined();

    engine.state.idiomSeals.push({
      idiomId: "broken",
      cells: [tower!.cell, tower!.cell + 1, tower!.cell + 2, tower!.cell + 3],
      completedAt: 0,
      active: false
    });

    expect(engine.isTowerHoldingIdiom(tower!.id)).toBe(false);
    expect(engine.concentrationQuote(tower!.id, "potent")?.essenceCost).toBe(10);
  });
});
