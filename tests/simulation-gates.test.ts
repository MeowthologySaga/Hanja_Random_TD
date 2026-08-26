import { describe, expect, it } from "vitest";
import { victoryHomogeneity } from "../scripts/simulate";

/**
 * 시작 오행 격차 게이트의 표본 설계 회귀.
 *
 * 예전 게이트는 `max-min <= 0.10` 이라는 생값이었다. 시작 오행은 첫 소환이
 * 정하므로 표본이 5갈래로 쪼개지고 배분도 균등하지 않아, 오행이 승패에 전혀
 * 영향을 주지 않아도 45런에서 99.4%가 0.10을 넘겼다. 이 파일은 그 회귀를 막는다.
 */
function samplePartition(runs: number, share: readonly number[], winRate: number, random: () => number): Array<{ label: string; runs: number; victories: number }> {
  const counts = share.map(() => 0);
  const wins = share.map(() => 0);
  for (let index = 0; index < runs; index += 1) {
    const roll = random();
    let bucket = share.length - 1;
    let accumulated = 0;
    for (let candidate = 0; candidate < share.length; candidate += 1) {
      accumulated += share[candidate] as number;
      if (roll <= accumulated) { bucket = candidate; break; }
    }
    counts[bucket] = (counts[bucket] as number) + 1;
    if (random() < winRate) wins[bucket] = (wins[bucket] as number) + 1;
  }
  return share.map((_, index) => ({ label: `g${index}`, runs: counts[index] as number, victories: wins[index] as number }));
}

/** 재현 가능한 난수 — 테스트가 운에 흔들리면 안 된다. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("starting element victory gate", () => {
  it("accepts a genuinely uniform split that the old raw-gap rule would reject", () => {
    // 표준 3지역 270런의 실제 시작 오행 배분과 승률. 생값 격차는 0.169지만
    // χ²(4dof)=5.63 으로 α=0.01 임계 13.277 에 한참 못 미친다.
    const observed = [
      { label: "木", runs: 38, victories: 18 },
      { label: "火", runs: 48, victories: 29 },
      { label: "土", runs: 48, victories: 26 },
      { label: "金", runs: 80, victories: 35 },
      { label: "水", runs: 56, victories: 34 }
    ];
    const check = victoryHomogeneity(observed);
    expect(check.degreesOfFreedom).toBe(4);
    expect(check.critical).toBeCloseTo(13.277, 3);
    expect(check.gap).toBeGreaterThan(0.10);
    expect(check.chiSquare).toBeLessThan(check.critical);
    expect(check.homogeneous).toBe(true);
  });

  it("keeps the false alarm rate near one percent instead of near certainty", () => {
    const share = [38, 48, 48, 80, 56].map((count) => count / 270);
    const random = mulberry32(20260826);
    let rawGapFailures = 0;
    let chiSquareFailures = 0;
    const trials = 600;
    for (let trial = 0; trial < trials; trial += 1) {
      const groups = samplePartition(45, share, 0.52, random);
      const check = victoryHomogeneity(groups);
      if (check.gap > 0.10) rawGapFailures += 1;
      if (!check.homogeneous) chiSquareFailures += 1;
    }
    // 귀무가설(오행 무관)에서도 생값 격차는 거의 언제나 게이트를 깬다.
    expect(rawGapFailures / trials).toBeGreaterThan(0.9);
    // 같은 표본에서 χ² 판정은 드물게만 깨진다.
    expect(chiSquareFailures / trials).toBeLessThan(0.05);
  });

  it("still catches a split that really is skewed", () => {
    const check = victoryHomogeneity([
      { label: "木", runs: 60, victories: 6 },
      { label: "火", runs: 60, victories: 48 },
      { label: "土", runs: 60, victories: 30 },
      { label: "金", runs: 60, victories: 33 },
      { label: "水", runs: 60, victories: 36 }
    ]);
    expect(check.homogeneous).toBe(false);
    expect(check.chiSquare).toBeGreaterThan(check.critical);
  });

  it("treats a single populated group and a shut-out sample as nothing to compare", () => {
    expect(victoryHomogeneity([
      { label: "木", runs: 0, victories: 0 },
      { label: "火", runs: 30, victories: 12 }
    ])).toMatchObject({ degreesOfFreedom: 0, homogeneous: true });
    expect(victoryHomogeneity([
      { label: "木", runs: 20, victories: 0 },
      { label: "火", runs: 20, victories: 0 }
    ])).toMatchObject({ homogeneous: true, chiSquare: 0 });
  });
});
