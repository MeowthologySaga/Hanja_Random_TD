/*
 * 부적 모드 경제 — 「번 만큼 되갚는다」 회귀 (트랙 C2 ③).
 *
 * 부적 만들기는 사람만 쓰는 수입원이라 그대로 두면 초반 수입이 두 배가 된다
 * (engine-tuning.ts 「부적 모드 경제」의 실측 표). 처방은 장부다 — 보상을 줄 때
 * 엽전 환산액을 빚으로 적고 웨이브 정산에서 조금씩 되갚는다.
 *
 * 여기서 못박는 두 가지:
 *   ① 빚이 없으면(= 부적을 쓰지 않았으면) 정산 경로가 통째로 예전과 같다.
 *      시뮬 봇과 기존 게이트 수치가 흔들리지 않는 근거다.
 *   ② 빚이 있으면 정산의 일부로만 물리고 남은 것은 다음 웨이브로 넘어간다 —
 *      "방어 성공 · 보상 0엽전"이 뜨지 않게.
 */
import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/core/game";
import { TALISMAN_ESSENCE_GOLD_VALUE, TALISMAN_REBATE_WAVE_SHARE } from "../src/core/engine-tuning";

function enableWaveStart(engine: GameEngine): void {
  engine.state.summonCount = Math.max(1, engine.state.summonCount);
  engine.state.startingFormationIndex ??= 2;
  if (engine.state.unlockedFormations.length === 0) engine.state.unlockedFormations = [2];
}

/** 적을 전부 치운 채 한 틱을 굴려 웨이브 정산을 부른다(game.test.ts 문법). */
function settleWave(engine: GameEngine, gold: number): void {
  enableWaveStart(engine);
  engine.startWaveEarly();
  engine.state.gold = gold;
  engine.state.spawned = engine.getCurrentPlan()?.count ?? 0;
  engine.state.enemies = [];
  engine.update(0.01);
}

describe("talisman income rebate", () => {
  it("leaves the settlement untouched when no talisman reward was taken", () => {
    const engine = new GameEngine("talisman-rebate-none", "KR");
    engine.begin();
    settleWave(engine, 95);

    // 기존 회귀(game.test.ts 「adds the clear reward before …」)와 같은 값이다.
    expect(engine.talismanDebt).toBe(0);
    expect(engine.state.gold).toBe(108);
    expect(engine.state.lastMessage).toContain("보상 8엽전 · 은행 이자 +5엽전");
    expect(engine.state.lastMessage).not.toContain("부적 상환");
  });

  it("repays part of the settlement and carries the rest to the next wave", () => {
    const engine = new GameEngine("talisman-rebate-partial", "KR");
    engine.begin();
    engine.talismanDebt = 30;
    settleWave(engine, 95);

    // 정산은 보상 8 + 이자 5 = 13. 그중 60%(내림) 인 7 만 물린다.
    const settlement = 8 + 5;
    const paid = Math.floor(settlement * TALISMAN_REBATE_WAVE_SHARE);
    expect(paid).toBe(7);
    expect(engine.state.gold).toBe(108 - paid);
    expect(engine.talismanDebt).toBe(30 - paid);
    expect(engine.state.lastMessage).toContain(`부적 상환 -${paid}엽전`);
    // 갚아도 정산은 남는다 — 되갚기가 벌처럼 보이지 않아야 한다.
    expect(engine.state.gold).toBeGreaterThan(95);
  });

  it("clears a small debt in one settlement and stops charging afterwards", () => {
    const engine = new GameEngine("talisman-rebate-small", "KR");
    engine.begin();
    engine.talismanDebt = 3;
    settleWave(engine, 95);
    expect(engine.talismanDebt).toBe(0);
    expect(engine.state.gold).toBe(105);
    expect(engine.state.lastMessage).toContain("부적 상환 -3엽전");

    // 다음 웨이브는 빚이 없으니 통째로 예전 정산이다.
    const goldBefore = engine.state.gold;
    settleWave(engine, goldBefore);
    expect(engine.state.lastMessage).not.toContain("부적 상환");
    expect(engine.state.gold).toBeGreaterThan(goldBefore);
  });

  it("pays the whole debt off across waves so the run total matches a plain run", () => {
    const plain = new GameEngine("talisman-rebate-total", "KR");
    plain.begin();
    const marked = new GameEngine("talisman-rebate-total", "KR");
    marked.begin();
    // 부적으로 앞당겨 받은 40 엽전을 미리 손에 쥔 채 출발한다.
    const borrowed = 40;
    marked.talismanDebt = borrowed;

    let plainGold = 200;
    let markedGold = 200 + borrowed;
    for (let wave = 0; wave < 12; wave += 1) {
      settleWave(plain, plainGold);
      plainGold = plain.state.gold;
      settleWave(marked, markedGold);
      markedGold = marked.state.gold;
    }

    expect(marked.talismanDebt).toBe(0);
    // 빚을 다 갚고 나면 두 런의 보유량이 사실상 같아진다 — 부적은 수입을
    // 늘리지 않고 시점만 앞당긴다. 남는 차이는 갚기 전까지 그 돈이 은행에
    // 얹혀 붙은 이자뿐이다(40 엽전을 몇 웨이브 들고 있던 값). 앞당겨 받은
    // 돈이 그동안 이자를 낳는 것은 규칙대로이므로 없애지 않고 상한만 못박는다.
    const carryInterest = markedGold - plainGold;
    expect(carryInterest).toBeGreaterThanOrEqual(0);
    expect(carryInterest).toBeLessThanOrEqual(Math.ceil(borrowed * 0.15));
  });

  it("prices the non-gold rewards so the ledger can convert them", () => {
    // 문기는 엽전으로 살 수 없어 정가가 없다 — 상환 환산액은 상수 하나로 모은다.
    expect(TALISMAN_ESSENCE_GOLD_VALUE).toBeGreaterThan(0);
    expect(TALISMAN_REBATE_WAVE_SHARE).toBeGreaterThan(0);
    expect(TALISMAN_REBATE_WAVE_SHARE).toBeLessThan(1);
  });
});
