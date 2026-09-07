/*
 * 부적 보상은 엽전과 문기가 **같은 규칙**을 쓴다 (v041).
 *
 * "부적의 문기 보상이 다른것에 비해 양이 적은 것 같아. 농축되면서 보상이 올라야
 * 되는데 변화가 없는 느낌이야"(사용자). 실제로 문기만 배수를 안 타고 있었다 —
 * 획수(rewardScale 0.7~2.4)도, 농축(REWARD_DENSITY 2.7)도.
 *
 * 그 자리는 부적 장수를 셋에서 하나로 줄인 개편이 남긴 자국이다. 그때 농축을
 * 1.35 에서 2.7 로 올려 **엽전** 총량은 지켰는데, 문기 줄은 「12획 이상이면 2」라는
 * 옛 셈 그대로 남아 총량이 조용히 3분의 1이 됐다.
 *
 * 이 시험이 지키는 것 셋.
 *  ① 두 보상이 같은 두 배수를 탄다.
 *  ② 획이 많은 글자가 더 받는다 — 어려운 글자를 쓸 이유가 보상에 남는다.
 *  ③ **총량이 3장 시절을 넘지 않는다.** 이 되돌림에는 상한이 있다.
 */
import { describe, expect, it } from "vitest";
import { casualStrokeCount } from "../src/core/casual";
import { getCatalog } from "../src/core/hanzi";

/** talisman.ts 와 같은 상수·같은 셈 — 화면 모듈은 DOM 을 요구하므로 여기 옮겨 잰다. */
const REWARD_DENSITY = 2.7;
const REWARD_GOLD_MIN = 6;
const REWARD_GOLD_MAX = 14;
const REWARD_ESSENCE_WEIGHT = 0.3;

function rewardScale(strokes: number): number {
  return Math.max(0.7, Math.min(2.4, 1 + (strokes - 6) * 0.06));
}

function essenceAmount(strokes: number): number {
  return Math.max(1, Math.round(rewardScale(strokes) * REWARD_DENSITY));
}

/** 걷어 낸 옛 셈 — 총량을 견주는 기준으로만 남긴다. */
function legacyEssenceAmount(strokes: number): number {
  return strokes >= 12 ? 2 : 1;
}

describe("부적 문기 보상", () => {
  it("획수를 따라 같은 계단으로 오른다", () => {
    expect(essenceAmount(1)).toBe(2);
    expect(essenceAmount(6)).toBe(3);
    expect(essenceAmount(12)).toBe(4);
    expect(essenceAmount(20)).toBe(5);
    expect(essenceAmount(29)).toBe(6);
  });

  it("획이 많은 글자가 언제나 적지 않게 받는다", () => {
    for (let strokes = 1; strokes < 34; strokes += 1) {
      expect(essenceAmount(strokes + 1), `${strokes}획`).toBeGreaterThanOrEqual(essenceAmount(strokes));
    }
  });

  it("엽전과 같은 두 배수(획수·농축)를 탄다", () => {
    // 같은 글자에서 두 보상의 배수 비가 같다 — 규칙이 하나라는 뜻이다.
    const gold = (strokes: number): number => Math.round(((REWARD_GOLD_MIN + REWARD_GOLD_MAX) / 2) * rewardScale(strokes) * REWARD_DENSITY);
    const goldRatio = gold(29) / gold(1);
    const essenceRatio = essenceAmount(29) / essenceAmount(1);
    expect(Math.abs(goldRatio - essenceRatio)).toBeLessThan(0.6);
  });

  it("총량은 부적 3장 시절을 넘지 않는다", () => {
    /*
     * 상한의 근거. 3장 시절에는 농축이 1.35 였고 한 장에 (옛 셈) 1~2 문기였다.
     * 100웨이브 × 3장 과 100웨이브 × 1장(지금 셈)을 KR 활성 풀 전수로 견준다.
     */
    const catalog = getCatalog("KR");
    const strokes = catalog.activePool.map((definition) => casualStrokeCount(definition.char) ?? 6);
    const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
    const legacyTotal = mean(strokes.map(legacyEssenceAmount)) * REWARD_ESSENCE_WEIGHT * 3 * 100;
    const nowTotal = mean(strokes.map(essenceAmount)) * REWARD_ESSENCE_WEIGHT * 1 * 100;
    expect(nowTotal).toBeGreaterThan(legacyTotal * 0.6);
    expect(nowTotal, "3장 시절 총량이 상한이다").toBeLessThan(legacyTotal);
  });
});
