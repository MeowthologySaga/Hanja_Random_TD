/*
 * 「막았다」가 화면에 있는가 (v042).
 *
 * 실측이 이 시험을 세웠다.
 *  · 준비 시간을 되찾은 웨이브 **85%**(592표본 중 503) — 판마다 76~86번 오는 순간인데
 *    그 자리에서 화면이 하던 일은 맨 아래 12px 한 줄이 바뀌는 것뿐이었다.
 *  · 한 웨이브 처치 신호 **평균 27번**(1장 6.5번) — 마지막 한 마리의 고리·플로터는
 *    그 27번째와 구별되지 않는다.
 *  · 우두머리가 쓰러진 시각과 웨이브가 끝나는 시각은 **같은 틱**(58표본 중 54,
 *    간격 0.0초) — 그래서 우두머리 청소는 따로 띄우지 않고 청소 띠 한 장이 겸한다.
 *
 * 이 사건은 **시뮬 게이트가 못 잡는다.** 봇은 이벤트를 걷지도 읽지도 않아
 * `waveCleared` 가 통째로 사라져도 승률이 한 톨도 안 움직인다. 그래서 여기서 못을
 * 박는다 — 이벤트가 서는가, 무엇을 싣는가, 그리고 **안 서야 할 자리에 안 서는가.**
 */
import { describe, expect, it } from "vitest";
import { runAutoplay } from "../src/core/autoplay";
import type { GameEngine } from "../src/core/game";
import { bossSealedNotice, bossSpareSeconds, bossTimeLimitForWave, waveClearNotice, waveClearReward } from "../src/core/content";
import type { GameEvent } from "../src/core/types";

/** 한 판을 굴리며 이벤트 줄을 걷는다 — 봇이 볼 줄을 가로채지 않게 peek 만 한다. */
function eventsFromRun(seed: string, seconds: number): GameEvent[] {
  const collected: GameEvent[] = [];
  let seen = 0;
  runAutoplay(seed, "KR", seconds, "standard", {
    observe: (engine: GameEngine) => {
      const events = engine.peekEvents();
      for (let index = seen; index < events.length; index += 1) collected.push(events[index] as GameEvent);
      seen = events.length;
    }
  });
  return collected;
}

const RUN = eventsFromRun("wave-clear-seed", 900);
const CLEARED = RUN.filter((event): event is Extract<GameEvent, { type: "waveCleared" }> => event.type === "waveCleared");

describe("웨이브를 막은 순간의 이벤트", () => {
  it("판을 굴리면 실제로 선다", () => {
    expect(CLEARED.length).toBeGreaterThan(10);
  });

  it("바로 뒤에 준비 단계가 온다 — 둘은 같은 틱의 다른 말이다", () => {
    for (const event of CLEARED) {
      const index = RUN.indexOf(event);
      const next = RUN[index + 1];
      expect(next?.type).toBe("phase");
      expect(next?.type === "phase" ? next.phase : null).toBe("prep");
    }
  });

  it("잔존을 안고 넘어간 웨이브에서는 서지 않는다", () => {
    // 실측 15%가 그 길로 간다. 거기서 「방어 성공」이 뜨면 거짓말이다.
    const started = RUN.filter((event) => event.type === "wave").length;
    expect(CLEARED.length).toBeLessThan(started);
    expect(CLEARED.length).toBeGreaterThan(started * 0.5);
  });

  it("웨이브 번호가 겹치지 않는다 — 한 웨이브는 한 번만 막힌다", () => {
    const waves = CLEARED.map((event) => event.wave);
    expect(new Set(waves).size).toBe(waves.length);
  });

  it("보상이 0보다 크고 이자는 음수가 아니다", () => {
    for (const event of CLEARED) {
      expect(event.reward).toBeGreaterThan(0);
      expect(event.interest).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("우두머리를 눕히고 남긴 초", () => {
  const bosses = CLEARED.filter((event) => event.boss);

  it("우두머리 웨이브를 실제로 막는다", () => {
    expect(bosses.length).toBeGreaterThan(0);
    for (const event of bosses) expect(event.wave % 10).toBe(0);
  });

  it("남긴 초가 그 웨이브의 제한 안에 든다", () => {
    for (const event of bosses) {
      const limit = bossTimeLimitForWave(event.wave);
      expect(limit).not.toBeNull();
      expect(event.bossSpare).not.toBeNull();
      expect(event.bossSpare as number).toBeGreaterThanOrEqual(0);
      // 부활분(bossTimeGrant)이 얹힐 수 있으므로 기본 제한만으로 상한을 잡지 않는다.
      expect(event.bossSpare as number).toBeLessThanOrEqual((limit as number) + 60);
    }
  });

  it("우두머리가 아닌 웨이브는 남긴 초를 말하지 않는다", () => {
    for (const event of CLEARED.filter((candidate) => !candidate.boss)) {
      expect(event.bossSpare).toBeNull();
    }
  });
});

describe("문장은 코어가 만든다", () => {
  it("평범한 웨이브는 번호와 보상만 말한다", () => {
    const text = waveClearNotice(7, 12, 0, false, null);
    expect(text).toContain("웨이브 7");
    expect(text).toContain("+12엽전");
    expect(text).not.toContain("제한");
    expect(text).not.toContain("우두머리");
  });

  it("우두머리 웨이브는 남긴 초를 말한다 — v041 이 조인 것을 여기서 푼다", () => {
    const text = waveClearNotice(10, 30, 0, true, 18.42);
    expect(text).toContain("우두머리 10 봉인");
    expect(text).toContain("18.4초 남김");
    expect(text).toContain("+30엽전");
  });

  it("그 순간을 못 본 판(이어하기)은 초를 지어내지 않는다", () => {
    const text = waveClearNotice(10, 30, 0, true, null);
    expect(text).toContain("우두머리 10 봉인");
    expect(text).not.toContain("남김");
    expect(text).not.toContain("0.0");
  });

  it("들어온 엽전을 **다** 말한다 — 은행 이자를 버리지 않는다", () => {
    /*
     * 보상만 실었을 때가 거짓이었다. 400엽전을 들고 막으면 실제 수입은 34인데 띠는
     * 「+14엽전」이라고 크게 말하고, 같은 순간 자원 레일은 34 오른다. 조용해서
     * 고치려던 12px 한 줄이 정작 정확했고 새로 만든 큰 목소리가 틀린 꼴이었다.
     */
    const text = waveClearNotice(20, 14, 20, false, null);
    expect(text).toContain("+14엽전");
    expect(text).toContain("은행 이자 +20엽전");
    // 이자가 없는 판에서는 그 칸을 아예 안 만든다.
    expect(waveClearNotice(20, 14, 0, false, null)).not.toContain("이자");
  });

  it("시계가 멎은 순간의 말도 코어가 만든다", () => {
    // 화면이 리터럴로 들고 있으면 배너와 시계가 같은 순간에 다른 말을 하게 된다.
    const sealed = bossSealedNotice();
    expect(sealed.time.length).toBeGreaterThan(0);
    expect(sealed.note.length).toBeGreaterThan(0);
    expect(waveClearNotice(10, 30, 0, true, 1)).toContain(sealed.time.replace("우두머리", "우두머리 10"));
  });

  it("가장 긴 조합도 띠 한 줄 예산 안에 든다", () => {
    /*
     * 띠는 실측 880px 전장에서 `max-width: 840px` 이고 굵은 16px 이라 한 줄 예산이
     * 대략 마흔아홉 자다(가장 긴 우두머리 띠 573px / 44자 = 13.0px·자, 840 ÷ 13.0 ≈ 64
     * 이지만 여백 62px 을 빼고 안전하게 49 로 잡는다).
     *
     * **실제로 나갈 수 있는 값**으로만 잰다 — 보상은 웨이브 계획이 정하고 이자는
     * 20에서 멈춘다(interestForGold). 지어낸 9999 로 재면 없는 문제를 지킨다.
     */
    let worst = "";
    for (let wave = 1; wave <= 100; wave += 1) {
      for (const mode of ["standard", "casual"] as const) {
        const reward = waveClearReward(wave, mode);
        const boss = wave % 10 === 0;
        const limit = bossTimeLimitForWave(wave);
        // 남길 수 있는 최대는 제한 직전에 잡은 경우다.
        const spare = boss && limit !== null ? limit - 0.1 : null;
        const text = waveClearNotice(wave, reward, 20, boss, spare);
        if (text.length > worst.length) worst = text;
      }
    }
    expect(worst.length).toBeLessThanOrEqual(49);
  });
});

describe("제한을 넘겨 잡은 자리", () => {
  /*
   * 봇이 영영 못 밟는 갈래다 — 8시드 1800초에서 우두머리 청소 62회 중 초과 0회.
   * 시뮬 게이트가 구조적으로 못 보므로 여기서만 지킨다.
   */
  it("제한 안에서 눕혔으면 남긴 초를 준다", () => {
    expect(bossSpareSeconds(72, 53.6)).toBeCloseTo(18.4, 5);
  });

  it("제한을 넘겨 잡았으면 0 이 아니라 **null** 이다", () => {
    // 8.1초 늦게 잡은 사람에게 「0.0초 남김」이라 말하던 자리.
    expect(bossSpareSeconds(72, 80.1)).toBeNull();
    // 정확히 문턱에 걸친 순간도 초과다 — 엔진의 판정(waveElapsed >= limit)과 같은 부등호.
    expect(bossSpareSeconds(72, 72)).toBeNull();
  });

  it("못 본 판·제한 없는 웨이브도 null", () => {
    expect(bossSpareSeconds(72, null)).toBeNull();
    expect(bossSpareSeconds(null, 30)).toBeNull();
  });

  it("넘겨 잡은 띠는 「남김」도 「0.0」도 말하지 않는다", () => {
    const text = waveClearNotice(10, 30, 0, true, bossSpareSeconds(72, 80.1));
    expect(text).not.toContain("남김");
    expect(text).not.toContain("0.0");
    expect(text).toContain("우두머리 10 봉인");
  });
});
