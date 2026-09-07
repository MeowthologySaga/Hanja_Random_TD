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
    /*
     * 11초짜리 시계에서 곧바로 눌러도, 값이 매겨지는 창은 예전 8초다.
     *
     * 액수가 4 에서 3 으로 내려온 것은 v041 이다 — 예전 +4 는 `paid` 가 정확히
     * 8일 때만 나왔고, 시계가 한 틱만 흘러도 사라지는 허깨비였다(사람도 봇도
     * 실제로는 3을 받았다). 받을 수 없는 숫자를 먼저 보여 주고 내리는 것이
     * "빨리 지나가서 손해보는 느낌"의 정체였다.
     */
    const bonus = pressStart(waitingEngine(3, GAME_CONFIG.prepSeconds));
    expect(bonus).toBe(3);
  });

  it("보스 앞뒤의 긴 준비도 마찬가지다", () => {
    // 15초로 늘었지만 값이 매겨지는 창은 예전 12초다(허깨비 한 칸을 걷어 5).
    const bonus = pressStart(waitingEngine(10, GAME_CONFIG.bossPrepSeconds));
    expect(bonus).toBe(5);
  });

  it("늘어난 꼬리에서는 값이 이미 0 이다", () => {
    /*
     * 꼬리(11 - 8 = 3초)만 남기고 눌러 본다. 부적을 마저 쓰라고 남긴 시간이라
     * 값이 안 붙는 것이 맞다 — 예전 8초 시계에서도 그 무렵이면 0 이었다.
     */
    expect(pressStart(waitingEngine(3, 3))).toBe(0);
    expect(pressStart(waitingEngine(3, 1))).toBe(0);
  });

  it("계단은 2초씩 머물고, 꼭대기와 바닥은 예전 그대로다", () => {
    /*
     * v041 에서 계단을 **뒤로** 세게 바꿨다(floor → ceil, 꼭대기는 눌러 둠).
     *
     * 예전 셈은 꼭대기가 한 프레임이었다 — 준비가 시작되고 0.5초 만에 +4 가 +3 이
     * 됐다("+3보너스 빨리 지나가서 손해보는 느낌이야" — 사용자). 실제로 손해는
     * 아니지만 화면을 보자마자 숫자가 내려앉으니 늦게 눌러 손해 봤다고 읽힌다.
     *
     * 이 시험이 지키는 것 넷.
     *  ① **꼭대기 액수가 안 올랐다** — 창을 가득 채운 순간은 예전과 같은 4다.
     *    시뮬 봇은 준비가 열리자마자 누르므로(늘 상한) 이 한 줄이 게이트 수치가
     *    그대로임을 보증한다. 여기가 오르면 승률 밴드가 곧바로 깨진다(v035 ②).
     *  ② **꼬리는 여전히 0** — 늘린 시계가 경제로 새지 않는다.
     *  ③ 사람이 받는 액수는 예전보다 **줄지 않는다**.
     *  ④ 같은 액수가 **2초씩** 머문다 — 이것이 이번에 고친 것이다.
     */
    const byWhen = new Map<number, number>();
    for (let spent = 0; spent <= GAME_CONFIG.prepSeconds; spent += 1) {
      const past = Math.floor(Math.max(0, 8 - spent) / 2);
      const now = pressStart(waitingEngine(3, GAME_CONFIG.prepSeconds - spent));
      byWhen.set(spent, now);
      // 어느 시점에도 예전보다 후해지지 않는다 — 후해지면 봇 수입이 올라 밴드가 깨진다.
      expect(now, `${spent}초 지난 시점`).toBeLessThanOrEqual(past);
    }
    expect(byWhen.get(0), "꼭대기는 실제로 받을 수 있는 액수다").toBe(3);
    expect(byWhen.get(8), "창을 다 쓴 뒤").toBe(0);
    expect(byWhen.get(GAME_CONFIG.prepSeconds), "꼬리").toBe(0);
    // 꼭대기 3은 3초, 그 아래는 2초씩 머문다 — 화면의 숫자가 곧 받는 액수다.
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((spent) => byWhen.get(spent))).toEqual([3, 3, 3, 2, 2, 1, 1, 0, 0]);
  });

  it("남은 몫은 다음 계단까지의 비율로 나온다", () => {
    // 화면이 그리는 「심지」의 길이 — 셈은 엔진 한 곳에 둔다.
    const engine = waitingEngine(3, GAME_CONFIG.prepSeconds);
    expect(engine.earlyStartStepRatio()).toBeCloseTo(1, 5);
    engine.state.prepRemaining = GAME_CONFIG.prepSeconds - 1;
    expect(engine.earlyStartStepRatio()).toBeCloseTo(0.5, 5);
    engine.state.prepRemaining = 4;
    // 값이 0 이면 남은 몫도 없다 — 심지가 눕는다.
    expect(engine.earlyStartBonus()).toBe(0);
    expect(engine.earlyStartStepRatio()).toBe(0);
  });

  it("문기의 숨이 얹은 시간에는 값이 안 붙는다", () => {
    /*
     * 부적 보상이 준비 시간을 늘려 주는데 그 시간에까지 값이 붙으면 한 장으로
     * 두 번 받는 셈이 된다.
     */
    const engine = waitingEngine(3, GAME_CONFIG.prepSeconds);
    expect(engine.talismanBreath(6)).toBe(true);
    expect(pressStart(engine)).toBe(3);
  });
});
