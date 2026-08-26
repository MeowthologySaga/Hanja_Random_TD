import { describe, expect, it } from "vitest";
import { CHEONJAMUN_JARYEONG_DEX_ENTRIES } from "../src/core/cheonjamun-jaryeong-dex";
import {
  hasDedicatedKoreanMeaningExplanation,
  KOREAN_EASY_MEANING_META,
  koreanMeaningExplanation
} from "../src/core/korean-meaning-explanations";
import { learningInfo } from "../src/core/learning";

describe("learner-friendly Korean meaning explanations", () => {
  it("clarifies the three ambiguous hun examples called out by the design", () => {
    const hair = koreanMeaningExplanation("髮", "터럭 발", "터럭");
    const use = koreanMeaningExplanation("以", "써 이", "써");
    const poem = koreanMeaningExplanation("詩", "귀글 시", "귀글");

    expect(hair.body).toContain("머리카락");
    expect(use.body).toContain("써서·로써");
    expect(use.example).toContain("以心傳心");
    expect(poem.body).toContain("오늘날");
    expect(poem.body).toContain("시");
  });

  it("provides a dedicated easy explanation for all 1,001 Korean codex characters", () => {
    expect(KOREAN_EASY_MEANING_META).toMatchObject({ total: 1001, unresolved: 0 });
    const targets = [
      ...CHEONJAMUN_JARYEONG_DEX_ENTRIES.map((entry) => ({
        char: entry.hanja,
        huneum: entry.huneum,
        meaning: entry.meaning
      })),
      { char: "烈", huneum: learningInfo("KR", "烈").short, meaning: learningInfo("KR", "烈").meaning }
    ];

    expect(new Set(targets.map((target) => target.char)).size).toBe(1001);
    for (const target of targets) {
      expect(hasDedicatedKoreanMeaningExplanation(target.char), target.char).toBe(true);
      const explanation = koreanMeaningExplanation(target.char, target.huneum, target.meaning);
      expect(explanation.source, target.char).not.toBe("regional-fallback");
      expect(explanation.plainMeaning.length, target.char).toBeGreaterThan(4);
      expect(explanation.short.length, target.char).toBeGreaterThan(8);
      expect(explanation.body.length, target.char).toBeGreaterThan(10);
      expect(explanation.body, target.char).not.toContain("의 뜻으로 쓰는 글자입니다. 훈음");
      expect(explanation.body, target.char).not.toContain("앞부분은 글자의 뜻");
    }
  });

  it("uses the intended sense instead of a same-sounding Korean word", () => {
    expect(koreanMeaningExplanation("宙", "집 주", "집").body).toContain("우주");
    expect(koreanMeaningExplanation("曲", "굽을 곡", "굽을").body).toContain("굽은 모양");
    expect(koreanMeaningExplanation("聞", "들을 문", "들을").body).toContain("귀로");
    expect(koreanMeaningExplanation("問", "물을 문", "물을").body).toContain("묻는");
    expect(koreanMeaningExplanation("工", "장인 공", "장인").body).toContain("물건을 만들");
  });

  it("explains uncommon hun words and commonly used character senses in plain Korean", () => {
    expect(koreanMeaningExplanation("規", "그림쇠 규", "그림쇠").body).toContain("컴퍼스");
    expect(koreanMeaningExplanation("閏", "윤달 윤", "윤달").body).toContain("달력");
    expect(koreanMeaningExplanation("豈", "승전악 개", "승전악").body).toContain("어찌");
    expect(koreanMeaningExplanation("葉", "고을이름 섭", "고을이름").body).toContain("잎");
    expect(koreanMeaningExplanation("烈", "세찰 렬", "세찰").body).toContain("세차고");
  });
});
