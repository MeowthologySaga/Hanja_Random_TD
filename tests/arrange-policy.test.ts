import { describe, expect, it } from "vitest";

import {
  ARRANGE_POLICY_OPTIONS,
  DEFAULT_ARRANGE_POLICY,
  changedArrangeOptions,
  parseArrangePolicy
} from "../src/core/arrange-policy";
import { GameEngine } from "../src/core/game";

describe("자동배치 정책", () => {
  it("아무것도 안 만지면 여태 하던 자동배치 그대로다", () => {
    /*
     * 새 손잡이가 생겼다고 판이 달라지면 안 된다. 시뮬 봇도 정책을 꽂지 않으므로
     * 이 기본값이 곧 게이트가 재는 판이다.
     */
    expect(DEFAULT_ARRANGE_POLICY).toEqual({
      keepLocked: false,
      deployFromInventory: true,
      rearrangeBoard: true,
      idiomFirst: true,
      weaknessFirst: false
    });
    expect(changedArrangeOptions(DEFAULT_ARRANGE_POLICY)).toBe(0);
    expect(new GameEngine("arrange-default", "KR").getArrangePolicy()).toEqual(DEFAULT_ARRANGE_POLICY);
  });

  it("화면에 세우는 다섯 갈래가 정책의 열쇠와 하나씩 맞물린다", () => {
    expect(ARRANGE_POLICY_OPTIONS).toHaveLength(5);
    for (const option of ARRANGE_POLICY_OPTIONS) {
      expect(DEFAULT_ARRANGE_POLICY).toHaveProperty(option.key);
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it("모르는 열쇠는 버리고 빠진 열쇠는 기본값으로 메운다", () => {
    // 갈래가 늘어도 옛 저장본이 그대로 열려야 한다.
    const parsed = parseArrangePolicy(JSON.stringify({ keepLocked: true, 없는열쇠: true, idiomFirst: "네" }));
    expect(parsed.keepLocked).toBe(true);
    expect(parsed.idiomFirst).toBe(DEFAULT_ARRANGE_POLICY.idiomFirst);
    expect(changedArrangeOptions(parsed)).toBe(1);
  });

  it("깨진 글·빈 글은 기본값이 된다", () => {
    expect(parseArrangePolicy(null)).toEqual(DEFAULT_ARRANGE_POLICY);
    expect(parseArrangePolicy("{어긋난 글")).toEqual(DEFAULT_ARRANGE_POLICY);
    expect(parseArrangePolicy("[]")).toEqual(DEFAULT_ARRANGE_POLICY);
  });

  it("「가방에서 꺼내 채우기」를 끄면 가방을 비우지 않는다", () => {
    const engine = new GameEngine("arrange-bag", "KR");
    engine.begin();
    // 소환값이 가파르게 올라 기본 엽전으로는 몇 기 못 뽑는다.
    engine.state.gold = 100_000;
    for (let index = 0; index < 6; index += 1) engine.summon();
    engine.setAutoPlaceSummons(false);
    for (let index = 0; index < 4; index += 1) engine.summon();
    const bagBefore = engine.state.inventoryTowers.length;
    expect(bagBefore).toBeGreaterThan(0);

    engine.setArrangePolicy({ ...DEFAULT_ARRANGE_POLICY, deployFromInventory: false });
    engine.autoArrangeTowers();

    expect(engine.state.inventoryTowers).toHaveLength(bagBefore);
  });

  it("「전장 자령도 옮기기」를 끄면 이미 선 자령이 제자리에 남는다", () => {
    const engine = new GameEngine("arrange-board", "KR");
    engine.begin();
    engine.state.gold = 100_000;
    for (let index = 0; index < 8; index += 1) engine.summon();
    const before = new Map(engine.state.towers.map((tower) => [tower.id, tower.cell]));
    expect(before.size).toBeGreaterThan(0);

    engine.setArrangePolicy({
      ...DEFAULT_ARRANGE_POLICY,
      deployFromInventory: false,
      rearrangeBoard: false,
      idiomFirst: false
    });
    engine.autoArrangeTowers();

    for (const tower of engine.state.towers) {
      expect(tower.cell).toBe(before.get(tower.id));
    }
  });

  it("「잠근 자령은 그 자리에」를 켜면 자물쇠 채운 자령이 안 움직인다", () => {
    const engine = new GameEngine("arrange-locked", "KR");
    engine.begin();
    engine.state.gold = 100_000;
    for (let index = 0; index < 10; index += 1) engine.summon();
    const locked = engine.state.towers[0];
    expect(locked).toBeDefined();
    locked!.locked = true;
    const lockedCell = locked!.cell;

    engine.setArrangePolicy({ ...DEFAULT_ARRANGE_POLICY, keepLocked: true });
    engine.autoArrangeTowers();

    expect(engine.state.towers.find((tower) => tower.id === locked!.id)?.cell).toBe(lockedCell);
  });
});
