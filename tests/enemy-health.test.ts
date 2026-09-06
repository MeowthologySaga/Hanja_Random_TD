/*
 * 체력바의 뒤따르는 붉은 띠.
 *
 * 피해 수치를 글자로 띄우던 것을 걷고 그 몫을 체력바로 옮겼다. 앞 띠는 곧바로
 * 줄고 뒤 띠가 잠깐 머물렀다 따라 내려온다 — 얼마나 깎였는지가 두 띠의 간격으로
 * 읽힌다.
 *
 * 이 시험이 지키는 것 셋.
 *  ① 머물렀다 따라옴.
 *  ② **쉬지 않고 맞아도 띠가 멈추지 않는다** — v039 의 요점이다. 타격마다
 *     머무름을 다시 걸면 자령 여럿이 때리는 이 게임에서 붉은 띠가 영영 안
 *     줄어들어, 「깎이는 움직임」이 아니라 그냥 두 색 막대가 된다.
 *  ③ 판이 새로 설 때 지난 자국이 새 적에게 붙지 않는다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceEnemyHealth,
  enemyHealthTrail,
  HEALTH_BAR_COLOR,
  HEALTH_TRAIL_COLOR,
  noteEnemyHit,
  resetEnemyHealth
} from "../src/ui/battle/enemy-health";

beforeEach(() => {
  resetEnemyHealth();
});

/** 두 색의 상대 명도 대비(WCAG) — 눈이 실제로 가를 수 있는지 재는 자. */
function contrast(left: string, right: string): number {
  const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    const linear = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  };
  const high = Math.max(luminance(left), luminance(right));
  const low = Math.min(luminance(left), luminance(right));
  return (high + 0.05) / (low + 0.05);
}

describe("뒤따르는 띠", () => {
  it("처음 본 적은 곧바로 제 체력에 붙는다", () => {
    advanceEnemyHealth(0);
    expect(enemyHealthTrail(1, 0.7)).toBe(0.7);
  });

  it("깎인 직후에는 머문다 — 눈이 간격을 짚을 시간을 준다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 1);
    noteEnemyHit(1);
    advanceEnemyHealth(0.1);
    // 0.16초 동안은 뒤 띠가 제자리다.
    expect(enemyHealthTrail(1, 0.4)).toBeCloseTo(1, 5);
  });

  it("머문 뒤에는 따라 내려온다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 1);
    noteEnemyHit(1);
    advanceEnemyHealth(0.2);
    const first = enemyHealthTrail(1, 0.4);
    expect(first).toBeLessThan(1);
    expect(first).toBeGreaterThan(0.4);
    advanceEnemyHealth(1.4);
    // 넉넉히 지나면 앞 띠에 붙는다 — 아래로 지나치지는 않는다.
    expect(enemyHealthTrail(1, 0.4)).toBe(0.4);
  });

  it("쉬지 않고 맞아도 붉은 띠는 계속 줄어든다", () => {
    /*
     * v039 회귀 방어. 예전에는 타격마다 머무름 시계를 다시 감아서, 자령 여럿이
     * 계속 때리는 실제 판에서 붉은 띠가 **한 번도 안 줄었다.** 사용자가 본 것이
     * 바로 그 멈춘 띠다("빨간 피 부분을 너무 유지하지마").
     *
     * 0.05초마다 한 대씩 1.2초를 때린다 — 그 사이 띠는 앞 띠에 닿아야 한다.
     */
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 1);
    let time = 0;
    let trail = 1;
    for (let hit = 0; hit < 24; hit += 1) {
      time += 0.05;
      advanceEnemyHealth(time);
      noteEnemyHit(1);
      trail = enemyHealthTrail(1, 0.3);
    }
    expect(trail).toBeLessThan(0.5);
  });

  it("체력이 올라가면 곧바로 따라 올린다", () => {
    advanceEnemyHealth(0);
    enemyHealthTrail(1, 0.3);
    advanceEnemyHealth(0.1);
    expect(enemyHealthTrail(1, 0.8)).toBe(0.8);
  });

  it("비율은 0~1 을 벗어나지 않는다", () => {
    advanceEnemyHealth(0);
    expect(enemyHealthTrail(1, 2)).toBe(1);
    expect(enemyHealthTrail(2, -1)).toBe(0);
  });
});

describe("두 피색", () => {
  it("남은 피와 깎인 피가 서로 또렷하게 갈린다", () => {
    /*
     * "두 피색이 대조가 잘되야해. 초록과 연두는 잘 안보여"(사용자).
     * 걷어 낸 짝은 사람 눈에 같은 색이었다 — 회생 적의 초록 막대(#64c489)와
     * 약점 연두 띠(#7ef0be)가 1.54:1, 우두머리 분홍빨강(#ff627d)과 잉걸 띠
     * (#ff7a5c)는 1.12:1. 그래픽 요소의 기준선 3:1 을 못 박는다(지금 4.63:1).
     */
    expect(contrast(HEALTH_BAR_COLOR, HEALTH_TRAIL_COLOR)).toBeGreaterThan(3);
    expect(contrast("#64c489", "#7ef0be")).toBeLessThan(2);
    expect(contrast("#ff627d", "#ff7a5c")).toBeLessThan(2);
  });

  it("어두운 전장 위에서도 남은 피가 선다", () => {
    // 막대 뒤에 깔리는 먹판(rgba(10,7,5,.9)) 대비.
    expect(contrast(HEALTH_BAR_COLOR, "#0a0705")).toBeGreaterThan(10);
  });

  it("깎인 피는 붉은색 하나다 — 결마다 색이 바뀌지 않는다", () => {
    const [red, green, blue] = [1, 3, 5].map((index) => parseInt(HEALTH_TRAIL_COLOR.slice(index, index + 2), 16));
    expect(red).toBeGreaterThan((green ?? 0) * 2);
    expect(red).toBeGreaterThan((blue ?? 0) * 2);
  });
});

describe("판이 새로 설 때", () => {
  it("지난 판의 자국이 새 적에게 붙지 않는다", () => {
    advanceEnemyHealth(10);
    enemyHealthTrail(7, 1);
    noteEnemyHit(7);
    // 시각이 뒤로 가면 판이 새로 선 것이다.
    advanceEnemyHealth(0);
    expect(enemyHealthTrail(7, 0.5)).toBe(0.5);
  });
});
