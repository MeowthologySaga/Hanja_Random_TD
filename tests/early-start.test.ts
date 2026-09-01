/*
 * 조기 출전 보너스는 준비 시계 길이를 타면 안 된다.
 *
 * v035 ② 에서 준비 시간을 8초에서 11초로 늘렸다. 예전 셈(남은 시간 ÷ 2)을
 * 그대로 두었더니 상한이 같이 올라 135판 승률이 0.556 → 0.63 으로 뛰었다
 * (밴드 상한 0.60). 자동 판정이 매 웨이브 곧바로 [지금 시작]을 눌러 늘어난
 * 몫을 온전히 챙기기 때문이다.
 *
 * 그래서 값이 매겨지는 창을 예전 시계에 묶고, 늘어난 만큼은 준비의 **꼬리**에
 * 값 없이 붙였다. 이 시험은 그 성질을 못 박는다 — 다음에 누가 템포를 또
 * 손보더라도, 시계를 늘린 것이 경제를 늘리는 일로 새지 않게.
 */
import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/core/game";
import { GAME_CONFIG } from "../src/core/hanzi";

/** 웨이브 사이 준비 시간에 선 판 — 실제 교전을 다 돌리지 않고 그 자리만 만든다. */
function waitingEngine(wave: number, remaining: number): GameEngine {
  const engine = new GameEngine("early-start-seed", "KR", "standard");
  engine.begin();
  engine.summon();
  engine.state.wave = wave;
  engine.state.phase = "prep";
  engine.state.prepRemaining = remaining;
  return engine;
}

/** [지금 시작]을 눌러 받은 엽전. */
function pressStart(engine: GameEngine): number {
  const before = engine.state.gold;
  expect(engine.startWaveEarly()).toMatchObject({ ok: true });
  return engine.state.gold - before;
}

describe("조기 출전 보너스", () => {
  it("준비 시계를 늘려도 곧바로 누른 값은 그대로다", () => {
    // 11초짜리 시계에서 곧바로 눌러도, 값이 매겨지는 창은 예전 8초다.
    const bonus = pressStart(waitingEngine(3, GAME_CONFIG.prepSeconds));
    expect(bonus).toBe(4);
  });

  it("보스 앞뒤의 긴 준비도 마찬가지다", () => {
    // 15초로 늘었지만 값이 매겨지는 창은 예전 12초라 여섯 냥 그대로다.
    const bonus = pressStart(waitingEngine(10, GAME_CONFIG.bossPrepSeconds));
    expect(bonus).toBe(6);
  });

  it("늘어난 꼬리에서는 값이 이미 0 이다", () => {
    /*
     * 꼬리(11 - 8 = 3초)만 남기고 눌러 본다. 부적을 마저 쓰라고 남긴 시간이라
     * 값이 안 붙는 것이 맞다 — 예전 8초 시계에서도 그 무렵이면 0 이었다.
     */
    expect(pressStart(waitingEngine(3, 3))).toBe(0);
    expect(pressStart(waitingEngine(3, 1))).toBe(0);
  });

  it("같은 시각에 누르면 예전과 같은 액수가 나온다", () => {
    /*
     * 예전 셈은 「남은 8초 시계 ÷ 2」였다. 지금은 시계가 11초이므로 같은 시각
     * t 의 남은 시간은 11 - t 다. 두 셈이 t 마다 같은 값을 내야 한다.
     */
    for (let spent = 0; spent <= GAME_CONFIG.prepSeconds; spent += 1) {
      const past = Math.floor(Math.max(0, 8 - spent) / 2);
      const now = pressStart(waitingEngine(3, GAME_CONFIG.prepSeconds - spent));
      expect(now, `${spent}초 지난 시점`).toBe(past);
    }
  });

  it("문기의 숨이 얹은 시간에는 값이 안 붙는다", () => {
    /*
     * 부적 보상이 준비 시간을 늘려 주는데 그 시간에까지 값이 붙으면 한 장으로
     * 두 번 받는 셈이 된다.
     */
    const engine = waitingEngine(3, GAME_CONFIG.prepSeconds);
    expect(engine.talismanBreath(6)).toBe(true);
    expect(pressStart(engine)).toBe(4);
  });
});
