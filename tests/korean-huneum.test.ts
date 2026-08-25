import { describe, expect, it } from "vitest";
import { CHEONJAMUN_JARYEONG_DEX_ENTRIES } from "../src/core/cheonjamun-jaryeong-dex";
import { CHEONJAMUN_RUNTIME_JARYEONGS } from "../src/core/cheonjamun-runtime";
import { learningInfo } from "../src/core/learning";

const LEARNER_HUNEUM = /^[가-힣]+(?: [가-힣]+){1,3}$/u;
const EDITORIAL_GLOSS = /[\p{Script=Han}A-Za-z0-9]|同字|俗字|本字|略字|異體|譌字/u;

describe("Korean learner huneum audit", () => {
  it("keeps all 1,000 Cheonjamun labels complete and learner-facing", () => {
    expect(CHEONJAMUN_RUNTIME_JARYEONGS).toHaveLength(1000);
    expect(CHEONJAMUN_JARYEONG_DEX_ENTRIES).toHaveLength(1000);

    const dexByHanja = new Map(CHEONJAMUN_JARYEONG_DEX_ENTRIES.map((entry) => [entry.hanja, entry]));
    for (const entry of CHEONJAMUN_RUNTIME_JARYEONGS) {
      const learning = learningInfo("KR", entry.hanja);
      const dex = dexByHanja.get(entry.hanja);
      expect(learning.short, entry.hanja).toMatch(LEARNER_HUNEUM);
      expect(learning.short, entry.hanja).not.toMatch(EDITORIAL_GLOSS);
      expect(entry.huneum, entry.hanja).toBe(learning.short);
      expect(entry.meaning, entry.hanja).toBe(learning.meaning);
      expect(dex?.huneum, entry.hanja).toBe(learning.short);
      expect(dex?.meaning, entry.hanja).toBe(learning.meaning);
    }
  });

  it("replaces the known dictionary-editorial and mismatched examples", () => {
    expect(learningInfo("KR", "燭")).toMatchObject({ short: "촛불 촉", meaning: "촛불" });
    expect(learningInfo("KR", "食")).toMatchObject({ short: "먹을 식", meaning: "먹을" });
    expect(learningInfo("KR", "迴").short).toBe("돌 회");
    expect(learningInfo("KR", "晉").short).toBe("나아갈 진");
    expect(learningInfo("KR", "恆").short).toBe("항상 항");
    expect(learningInfo("KR", "雁").short).toBe("기러기 안");
    expect(learningInfo("KR", "皃").short).toBe("모양 모");
    expect(learningInfo("KR", "即").short).toBe("곧 즉");
    expect(learningInfo("KR", "並").short).toBe("나란할 병");
    expect(learningInfo("KR", "秊").short).toBe("해 년");
  });
});
