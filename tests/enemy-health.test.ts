/*
 * 체력바의 뒤따르는 띠.
 *
 * 피해 수치를 글자로 띄우던 것을 걷고 그 몫을 체력바로 옮겼다. 앞 띠는 곧바로
 * 줄고 뒤 띠가 잠깐 머물렀다 따라 내려온다 — 얼마나 깎였는지가 두 띠의 간격으로
 * 읽힌다. 이 시험이 지키는 것은 그 「머물렀다 따라옴」과, 판이 새로 설 때 지난
 * 자국이 새 적에게 붙지 않는 것이다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceEnemyHealth,
  enemyHealthTrail,
  healthTrailColor,
  noteEnemyHit,
  resetEnemyHealth
} from "../src/ui/battle/enemy-health";

beforeEach(() => {
  resetEnemyHealth();
});

describe("뒤따르는 띠", () => {
  it("처음 본 적은 곧바로 제 체력에 붙는다", () => {
    advanceEnemyHealth(0);
    expect(enemyHealthTrail(1, 0.7).value).toBe(0.7);
  });

  it("깎인 직후에는 머문다 — 눈이 간격을 짚을 시간을 준다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 1);
    noteEnemyHit(1, "weakness");
    advanceEnemyHealth(0.1);
    // 0.26초 동안은 뒤 띠가 제자리다.
    expect(enemyHealthTrail(1, 0.4).value).toBeCloseTo(1, 5);
  });

  it("머문 뒤에는 따라 내려온다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 1);
    noteEnemyHit(1, "normal");
    advanceEnemyHealth(0.4);
    const first = enemyHealthTrail(1, 0.4).value;
    expect(first).toBeLessThan(1);
    expect(first).toBeGreaterThan(0.4);
    advanceEnemyHealth(1.4);
    // 넉넉히 지나면 앞 띠에 붙는다 — 아래로 지나치지는 않는다.
    expect(enemyHealthTrail(1, 0.4).value).toBe(0.4);
  });

  it("체력이 올라가면 곧바로 따라 올린다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 0.3);
    advanceEnemyHealth(0.1);
    expect(enemyHealthTrail(1, 0.8).value).toBe(0.8);
  });

  it("비율은 0~1 을 벗어나지 않는다", () => {
    advanceEnemyHealth(0);
    expect(enemyHealthTrail(1, 2).value).toBe(1);
    expect(enemyHealthTrail(2, -1).value).toBe(0);
  });
});

describe("타격의 결", () => {
  it("약점·치명은 잉걸색을 덮어쓴다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 1);
    noteEnemyHit(1, "normal");
    noteEnemyHit(1, "weakness");
    advanceEnemyHealth(0.5);
    expect(enemyHealthTrail(1, 0.5).tone).toBe("weakness");
  });

  it("한 번 실린 약점이 뒤따르는 평타에 지워지지 않는다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 1);
    noteEnemyHit(1, "critical");
    noteEnemyHit(1, "normal");
    advanceEnemyHealth(0.5);
    expect(enemyHealthTrail(1, 0.5).tone).toBe("critical");
  });

  it("결마다 색이 다르다 — 수치가 사라진 자리를 색이 대신 말한다", () => {
    const tones = ["normal", "weakness", "critical"] as const;
    const colors = tones.map((tone) => healthTrailColor(tone));
    expect(new Set(colors).size).toBe(3);
  });
});

describe("판이 새로 설 때", () => {
  /*
   * 적 번호는 판마다 처음부터 매겨진다. 시각이 되감겼는데 자국을 안 지우면
   * 지난 판의 띠가 같은 번호를 받은 새 적에게 그대로 붙는다.
   */
  it("시각이 되감기면 지난 자국을 잊는다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(7, 1);
    noteEnemyHit(7, "critical");
    // 잊기 시간(2초) 안에서 확인한다 — 그 너머는 아래 다른 시험의 몫이다.
    advanceEnemyHealth(0.5);
    expect(enemyHealthTrail(7, 0.2).tone).toBe("critical");

    advanceEnemyHealth(0);
    const fresh = enemyHealthTrail(7, 0.2);
    expect(fresh.tone).toBe("normal");
    expect(fresh.value).toBe(0.2);
  });

  it("오래 안 보인 적은 잊는다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(3, 1);
    noteEnemyHit(3, "weakness");
    // 2초 넘게 손대지 않으면 자리를 비운다.
    advanceEnemyHealth(5);
    const revived = enemyHealthTrail(3, 0.9);
    expect(revived.tone).toBe("normal");
    expect(revived.value).toBe(0.9);
  });
});
