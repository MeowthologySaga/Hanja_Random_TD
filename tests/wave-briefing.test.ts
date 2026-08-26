/*
 * 웨이브 브리핑 두 줄 예산 — 트랙 N 과업 1-3.
 *
 * `#wave-briefing` 은 284px · 12px · 2줄 클램프라, 화면에 실제로 나가는
 * 합성 문자열이 예산(58자)을 넘으면 말줄임 없이 통째로 잘린다. 브라우저를
 * 띄우지 않고도 되돌아오지 못하게 못을 박는다 — 상한은 실측으로 잡았고
 * (`.claude/uiux/track-n/`), 조판이 바뀌면 그때 이 상수를 다시 재야 한다.
 */
import { describe, expect, it } from "vitest";
import { composeWaveBriefing, WAVE_BRIEFING_CHAR_BUDGET, wavePlan } from "../src/core/content";

/** 화면에 나갈 수 있는 모든 조합. 잔존 수는 두 자리(최장)로 잡는다. */
function allVariantsFor(wave: number): string[] {
  const plan = wavePlan(wave);
  const bossLimited = plan.boss;
  const variants = [composeWaveBriefing(plan.briefing, wave, bossLimited, null)];
  variants.push(composeWaveBriefing(plan.briefing, wave, bossLimited, 99));
  return variants;
}

describe("웨이브 브리핑", () => {
  it("1~100 웨이브의 모든 조합이 두 줄 예산 안에 든다", () => {
    const over: Array<{ wave: number; length: number; text: string }> = [];
    for (let wave = 1; wave <= 100; wave += 1) {
      for (const text of allVariantsFor(wave)) {
        if (text.length > WAVE_BRIEFING_CHAR_BUDGET) over.push({ wave, length: text.length, text });
      }
    }
    expect(over).toEqual([]);
  });

  it("우두머리 웨이브는 '우두머리' 를 두 번 말하지 않는다", () => {
    const boss = wavePlan(50);
    expect(boss.boss).toBe(true);
    const text = composeWaveBriefing(boss.briefing, 50, true, null);
    expect(text.match(/우두머리/gu)).toHaveLength(1);
    expect(text).toContain("제5장");
    expect(text).toContain("제한 내 처치 필수");
  });

  it("잔존 합류 꼬리는 잔존이 있을 때만 붙는다", () => {
    const plan = wavePlan(7);
    expect(composeWaveBriefing(plan.briefing, 7, false, null)).not.toContain("잔존");
    expect(composeWaveBriefing(plan.briefing, 7, false, 12)).toContain("잔존 12체 합류");
  });

  /*
   * [S/P-10] 두 줄 클램프는 넘치는 순간 뒤부터 삼킨다. 잔존 수는 이 문장
   * 에서만 알 수 있는 값이고, 장·우두머리 예고는 웨이브 수로 되짚을 수
   * 있다 — 그러니 잔존이 앞, 장이 뒤여야 한다.
   */
  it("잔존 합류는 장·우두머리 예고보다 앞선다", () => {
    for (const wave of [7, 20, 50, 99]) {
      const plan = wavePlan(wave);
      const text = composeWaveBriefing(plan.briefing, wave, plan.boss, 42);
      const chapterMark = `제${Math.max(1, Math.ceil(wave / 10))}장`;
      expect(text).toContain("잔존 42체 합류");
      expect(text).toContain(chapterMark);
      expect(text.indexOf("잔존 42체 합류")).toBeLessThan(text.indexOf(chapterMark));
    }
  });
});
