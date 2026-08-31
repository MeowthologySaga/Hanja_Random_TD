/*
 * 성어의 뜻에서 나온 힘.
 *
 * 여태 천자문 구의 효과는 `index % 4` 였다 — 「가을에 거두고 겨울에 저장한다」에
 * 사거리가 붙고 「이슬이 맺혀 서리가 된다」에 엽전이 붙었다. 성어를 외우게
 * 하려는 게임에서 뜻과 힘이 따로 노는 것은 가르치는 값을 버리는 짓이다.
 *
 * 이 시험이 지키는 것 셋: 뜻이 실제로 힘을 정하는가, 낱말이 헛짚지 않는가,
 * 그리고 규칙에 안 걸린 구도 **늘 같은 힘**을 받는가(같은 시드가 같은 판을
 * 만들어야 한다).
 */
import { describe, expect, it } from "vitest";
import { CHEONJAMUN_PHRASES } from "../src/data/cheonjamun-phrases";
import { idiomEffectFor, idiomEffectSource } from "../src/core/idiom-effects";
import { idiomsForRegion } from "../src/core/idioms";

describe("뜻이 힘을 정한다", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["秋收冬藏", "가을에 거두고 겨울에 저장한다", "killEssence"],
    ["露結爲霜", "이슬이 맺혀 서리가 된다", "enemySlow"],
    ["金生麗水", "금은 여수에서 난다", "waveGold"],
    ["劍號巨闕", "이름난 칼을 거궐이라 한다", "damage"],
    ["空谷傳聲", "빈 골짜기에는 소리가 멀리 전해진다", "range"],
    ["得能莫忘", "배운 능력을 얻으면 잊지 않는다", "evolutionGold"],
    ["罔談彼短", "남의 단점을 함부로 말하지 않는다", "weaknessDamage"]
  ];

  for (const [chars, meaning, kind] of cases) {
    it(`${chars} — ${meaning}`, () => {
      expect(idiomEffectFor(meaning, chars).kind).toBe(kind);
      expect(idiomEffectSource(meaning)).toBe("rule");
    });
  }
});

describe("낱말이 헛짚지 않는다", () => {
  /*
   * 실제로 걸렸던 오탐이다. 「흔들린다」 안에 「들린다」가, 「소중히」 안에
   * 「중히」가 들어 있어 엉뚱한 힘이 붙었다. 부분 문자열로 찾는 규칙은 이
   * 함정을 늘 안고 있으니 못을 박아 둔다.
   */
  it("「흔들린다」가 「들린다」로 읽히지 않는다", () => {
    expect(idiomEffectFor("외물을 좇으면 뜻이 흔들린다", "逐物意移").kind).toBe("weaknessDamage");
  });

  it("「소중히」가 「중히 여긴다」로 읽히지 않는다", () => {
    expect(idiomEffectFor("이 몸과 머리카락을 소중히 여긴다", "蓋此身髮").kind).not.toBe("waveGold");
  });
});

describe("규칙에 안 걸린 구", () => {
  it("같은 한자면 늘 같은 힘을 받는다", () => {
    const first = idiomEffectFor("어디에도 걸리지 않을 문장", "測試文字");
    const second = idiomEffectFor("전혀 다른 문장이어도", "測試文字");
    expect(second.kind).toBe(first.kind);
  });

  it("네 기본 축 가운데 하나로만 간다", () => {
    const kind = idiomEffectFor("어디에도 걸리지 않을 문장", "測試文字").kind;
    expect(["damage", "range", "enemySlow", "evolutionGold"]).toContain(kind);
  });
});

describe("천자문 명단 전체", () => {
  it("일곱 축을 모두 쓰고, 한 축이 절반을 넘지 않는다", () => {
    const tally = new Map<string, number>();
    for (const phrase of CHEONJAMUN_PHRASES) {
      const kind = idiomEffectFor(phrase.meaning, phrase.chars).kind;
      tally.set(kind, (tally.get(kind) ?? 0) + 1);
    }
    expect(tally.size).toBe(7);
    for (const count of tally.values()) {
      expect(count).toBeLessThan(CHEONJAMUN_PHRASES.length / 2);
    }
  });

  it("진 공격력은 커스텀 성어 전용이라 지역 명단에 나오지 않는다", () => {
    for (const region of ["KR", "JP", "CN"] as const) {
      for (const idiom of idiomsForRegion(region)) {
        expect(idiom.bonus.kind).not.toBe("formationAttack");
      }
    }
  });

  it("모든 구의 문구가 그 축의 값을 그대로 말한다", () => {
    for (const idiom of idiomsForRegion("KR")) {
      expect(idiom.bonus.label.length).toBeGreaterThan(0);
      const digits = idiom.bonus.label.match(/\d+/gu) ?? [];
      expect(digits.length).toBeGreaterThan(0);
    }
  });
});
