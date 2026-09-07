/*
 * 준비 단계의 화력 경고 (v042).
 *
 * 코치가 「자령 3기를 소환하세요 … 3기는 있어야 첫 웨이브를 치웁니다」라고 말하는데,
 * 실측하면 3기로 W5(정예 철갑)에 들어가면 60발을 쏘고 **처치 0**이고 준비 시간이
 * 여덟 웨이브 중 세 번만 돌아온다. 준비를 못 되찾으면 부적을 쓸 창까지 잃는다.
 * 그런데 화면 어디도 **손이 아직 자유로울 때** 「부족하다」고 말하지 않았다.
 *
 * 이 지수는 절대값에 뜻이 없다 — 사정권 체류·약점 배수·스폰 구간이 다 빠져 있다.
 * 뜻이 있는 것은 같은 판 안의 크기 비교이고, 그래서 이 시험이 지키는 것은 **사다리의
 * 방향과 문턱의 자리**다.
 */
import { describe, expect, it } from "vitest";
import { WAVE_READINESS_ALERT } from "../src/core/content";
import { GameEngine } from "../src/core/game";

function engineWith(summons: number): GameEngine {
  const engine = new GameEngine("OPEN-1", "KR", "standard");
  engine.begin();
  for (let index = 0; index < summons; index += 1) {
    engine.state.gold += 200;
    engine.summon();
  }
  return engine;
}

function readinessAt(engine: GameEngine, wave: number): number | null {
  engine.state.wave = wave;
  engine.state.phase = "prep";
  return engine.waveReadiness();
}

describe("준비 화력 지수", () => {
  it("자령이 늘수록 낮아진다 — 사다리의 방향", () => {
    const ladder = [3, 4, 5, 6, 8].map((count) => readinessAt(engineWith(count), 4) ?? 0);
    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index], `${index}번째`).toBeLessThan(ladder[index - 1] as number);
    }
  });

  it("문턱은 넉 기 이하에서만 선다 — 정예 철갑(W5) 앞에서", () => {
    /*
     * W4 준비가 W5(5의 배수 · 정예 철갑)를 내다보는 자리다. 실측 사다리:
     * 3기 2.78 · 4기 2.00 · 5기 1.60 · 6기 1.32. 문턱 1.8 이 4기와 5기 사이를 자른다.
     */
    expect(readinessAt(engineWith(3), 4) ?? 0).toBeGreaterThan(WAVE_READINESS_ALERT);
    expect(readinessAt(engineWith(4), 4) ?? 0).toBeGreaterThan(WAVE_READINESS_ALERT);
    expect(readinessAt(engineWith(5), 4) ?? 0).toBeLessThan(WAVE_READINESS_ALERT);
    expect(readinessAt(engineWith(6), 4) ?? 0).toBeLessThan(WAVE_READINESS_ALERT);
  });

  it("1장 밖에서는 아무 말도 하지 않는다", () => {
    /*
     * 후반의 화력은 기술·장판·확산·별에서 나오는데 이 식은 그것을 하나도 못 본다 —
     * 봇 승리 런에서 이 값이 W84 에 8.5 까지 뜬다. 말할 자격이 없는 구간이다.
     */
    const engine = engineWith(6);
    expect(readinessAt(engine, 10)).toBeNull();
    expect(readinessAt(engine, 40)).toBeNull();
    // 첫 준비(W0)는 코치 1걸음이 이미 「3기」를 말하는 자리다.
    expect(readinessAt(engine, 0)).toBeNull();
  });

  it("교전 중에는 돌려주지 않는다 — 준비 단계의 말이다", () => {
    const engine = engineWith(3);
    engine.state.wave = 4;
    engine.state.phase = "combat";
    expect(engine.waveReadiness()).toBeNull();
  });

  it("자령이 하나도 없으면 셀 것이 없다", () => {
    const engine = new GameEngine("OPEN-1", "KR", "standard");
    engine.begin();
    expect(readinessAt(engine, 4)).toBeNull();
  });

  it("수련장에서는 서지 않는다 — 각본이 클릭을 묶어 둔 자리다", () => {
    const engine = new GameEngine("TUTORIAL", "KR", "casual", { tutorial: true });
    engine.begin();
    engine.state.gold += 200;
    engine.summon();
    expect(readinessAt(engine, 4)).toBeNull();
  });
});
