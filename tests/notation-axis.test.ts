/*
 * 표기(읽기) 축 — 범위×표기 교차 조합. (gripe #6, 트랙 Q)
 *
 * 이 파일이 지키는 것은 셋이다.
 *   1. 판정 3종(authentic·derived·substitute)이 값과 배지로 정확히 갈린다.
 *   2. 아무것도 고르지 않은 사람의 화면은 테이블이 붙어도 글자 하나까지 같다.
 *   3. 9조합(로스터 3 × 표기 3) 어디에도 "미수록" 빈칸이 없다.
 *
 * 순서가 중요하다 — 무변경은 "테이블 설치 전"과 "설치 후"를 견줘야 말이
 * 되므로 설치 전 값을 먼저 떠 놓고 설치한다.
 */
import { beforeAll, describe, expect, it } from "vitest";
import krRuntime from "../handoff_source/data/KR_1000.prelim.runtime.json";
import jpRuntime from "../handoff_source/data/JP_2136.prelim.runtime.json";
import cnRuntime from "../handoff_source/data/CN_3500.prelim.runtime.json";
import unifiedReadings from "../src/data/unified-readings.json";
import { learningInfoForNotation, type LearningInfo } from "../src/core/learning";
import {
  defaultNotationForRegion,
  installUnifiedReadings,
  NOTATION_AXIS_READY,
  notationNeedsUnifiedTable,
  type UnifiedReadingsData
} from "../src/core/notation";
import { notationBadgeHtml, notationBadgeText, notationGlossHtml } from "../src/ui/notation-substitute";
import type { NotationCode, RegionCode } from "../src/core/types";

const ROSTERS: Record<RegionCode, readonly string[]> = {
  KR: krRuntime.chars.map((entry) => entry.c),
  JP: jpRuntime.chars.map((entry) => entry.c),
  CN: cnRuntime.chars.map((entry) => entry.c)
};
const NOTATIONS: readonly NotationCode[] = ["kr-hunum", "jp-onkun", "cn-pinyin"];
const REGIONS: readonly RegionCode[] = ["KR", "JP", "CN"];

/** 한 글자의 화면 출력 전부를 한 문자열로 — 무변경 비교의 지문. */
function fingerprint(info: LearningInfo): string {
  return [info.short, info.readingLabel, info.reading, info.meaning, info.meaningSource, info.provenance].join("␟");
}

/** 설치 전에 떠 두는 자국 표기 3조합의 지문. */
const baseline = new Map<string, string>();

beforeAll(() => {
  for (const region of REGIONS) {
    const notation = defaultNotationForRegion(region);
    for (const char of ROSTERS[region]) {
      baseline.set(`${region}␟${char}`, fingerprint(learningInfoForNotation(notation, char)));
    }
  }
  installUnifiedReadings(unifiedReadings as unknown as UnifiedReadingsData);
});

describe("표기 축 개통", () => {
  it("플래그가 열려 있다", () => {
    expect(NOTATION_AXIS_READY).toBe(true);
  });

  it("기본 표기는 로스터의 자국 표기다", () => {
    expect(defaultNotationForRegion("KR")).toBe("kr-hunum");
    expect(defaultNotationForRegion("JP")).toBe("jp-onkun");
    expect(defaultNotationForRegion("CN")).toBe("cn-pinyin");
  });

  it("자국 표기 조합은 통합 표기 테이블을 받을 필요가 없다", () => {
    for (const region of REGIONS) {
      expect(notationNeedsUnifiedTable(region, defaultNotationForRegion(region))).toBe(false);
      for (const notation of NOTATIONS) {
        if (notation === defaultNotationForRegion(region)) continue;
        expect(notationNeedsUnifiedTable(region, notation)).toBe(true);
      }
    }
  });
});

describe("기본값 무변경 — 아무것도 고르지 않은 화면", () => {
  it.each(REGIONS)("%s 로스터를 자국 표기로 읽으면 테이블 설치 전후가 같다", (region) => {
    const notation = defaultNotationForRegion(region);
    const changed: string[] = [];
    for (const char of ROSTERS[region]) {
      const after = fingerprint(learningInfoForNotation(notation, char));
      if (baseline.get(`${region}␟${char}`) !== after) changed.push(char);
    }
    expect(changed).toEqual([]);
  });

  it.each(REGIONS)("%s 로스터를 자국 표기로 읽으면 배지가 하나도 붙지 않는다", (region) => {
    const notation = defaultNotationForRegion(region);
    const badged = ROSTERS[region].filter((char) => {
      const info = learningInfoForNotation(notation, char);
      return info.provenance !== "authentic" || notationBadgeHtml(info, notation) !== "";
    });
    expect(badged).toEqual([]);
  });
});

describe("9조합 빈칸 0", () => {
  for (const region of REGIONS) {
    for (const notation of NOTATIONS) {
      it(`${region} 로스터 × ${notation} 에 미수록이 없다`, () => {
        const blank = ROSTERS[region].filter((char) => {
          const info = learningInfoForNotation(notation, char);
          return info.short.includes("미수록") || info.short.trim() === "" || info.reading.trim() === "";
        });
        expect(blank).toEqual([]);
      });
    }
  }
});

describe("판정 3종 렌더", () => {
  it("사전 수록은 판정이 authentic 이고 배지가 없다", () => {
    const info = learningInfoForNotation("kr-hunum", "木");
    expect(info).toMatchObject({ short: "나무 목", provenance: "authentic" });
    expect(notationBadgeHtml(info, "kr-hunum")).toBe("");
    expect(notationBadgeText(info)).toBe("");
    expect(notationGlossHtml(info)).toBe("");
  });

  it("자형 파생은 정자의 독음을 쓰고 「정자 기준」 배지에 원자형을 단다", () => {
    const info = learningInfoForNotation("kr-hunum", "们");
    expect(info).toMatchObject({ short: "들 문", provenance: "derived", derivedFrom: "們" });
    const badge = notationBadgeHtml(info, "kr-hunum");
    expect(badge).toContain("notation-mark--derived");
    expect(badge).toContain("정자 기준");
    expect(badge).toContain("們");
    expect(notationBadgeText(info)).toBe("정자 기준 們");
    // 파생값은 사전 독음이라 원천 뜻 조판이 붙지 않는다.
    expect(notationGlossHtml(info)).toBe("");
  });

  it("일본 음훈에서도 같은 글자가 정자 파생으로 갈린다", () => {
    const info = learningInfoForNotation("jp-onkun", "们");
    expect(info).toMatchObject({ provenance: "derived", derivedFrom: "們" });
    expect(info.reading).toContain("음독");
    expect(notationBadgeHtml(info, "jp-onkun")).toContain("notation-mark--derived");
  });

  it("대체 표기는 회색 배지 + 근거 종류를 달고 영어 뜻을 이탤릭으로 가른다", () => {
    const info = learningInfoForNotation("kr-hunum", "丐");
    expect(info).toMatchObject({
      provenance: "substitute",
      substituteKind: "cn-only",
      sourceReading: "gài",
      sourceMeaning: "beggar; beg; give",
      sourceMeaningLanguage: "en"
    });
    const badge = notationBadgeHtml(info, "kr-hunum");
    expect(badge).toContain("notation-mark--substitute");
    expect(badge).toContain("대체 표기");
    expect(badge).toContain("중국 전용자");
    expect(notationBadgeText(info)).toBe("대체 표기 · 중국 전용자");
    const gloss = notationGlossHtml(info);
    // 영어 원문은 세리프 이탤릭 + lang 으로 훈음과 활자를 갈라 놓는다.
    expect(gloss).toContain('class="notation-gloss-text notation-gloss-text--en" lang="en"');
    expect(gloss).toContain("beggar; beg; give");
    expect(gloss).toContain("원천 뜻(영어 원문)");
  });

  it("대체값에는 훈음·음독 이름표를 달지 않는다", () => {
    // 이름표가 "훈음"이면 이름표 자체가 거짓말이 된다.
    expect(learningInfoForNotation("kr-hunum", "丐").readingLabel).toBe("빌린 표기");
    expect(learningInfoForNotation("jp-onkun", "啪").readingLabel).toBe("빌린 표기");
    // 파생값은 정자의 진짜 훈음이므로 이름표를 지킨다.
    expect(learningInfoForNotation("kr-hunum", "们").readingLabel).toBe("훈음");
    expect(learningInfoForNotation("jp-onkun", "们").readingLabel).toBe("음독·훈독");
  });

  it("대체 표기의 짧은 읽기는 영어 뜻이 아니라 원천 표기다", () => {
    // 좁은 자리(명패·카드)에 영어 뜻이 훈음처럼 앉으면 그게 오인이다.
    const info = learningInfoForNotation("kr-hunum", "丐");
    expect(info.short).toBe("gài");
    expect(info.short).not.toContain("beggar");
    // 넉넉한 자리에서는 원천 뜻까지 그대로 보인다.
    expect(info.reading).toContain("beggar; beg; give");
  });

  it("일본 음훈의 대체 표기 4건도 같은 규칙을 탄다", () => {
    const info = learningInfoForNotation("jp-onkun", "啪");
    expect(info).toMatchObject({ provenance: "substitute", substituteKind: "cn-only", sourceMeaningLanguage: "en" });
    expect(notationBadgeHtml(info, "jp-onkun")).toContain("notation-mark--substitute");
  });

  it("배지 곁말은 판정마다 하나뿐이라 자리마다 갈라지지 않는다", () => {
    const authentic = learningInfoForNotation("kr-hunum", "木");
    const derived = learningInfoForNotation("kr-hunum", "们");
    const substitute = learningInfoForNotation("kr-hunum", "丐");
    expect([authentic, derived, substitute].map(notationBadgeText)).toEqual([
      "",
      "정자 기준 們",
      "대체 표기 · 중국 전용자"
    ]);
  });
});

describe("대체 표기의 정직성", () => {
  it("영어 뜻을 값으로 가진 대체 항목은 전부 배지를 받는다", () => {
    // 코덱스 경고: sourceMeaningLanguage="en" 을 한국 훈음으로 오인하면 안 된다.
    const entries = (unifiedReadings as unknown as UnifiedReadingsData).entries;
    const english = Object.keys(entries).filter((char) => entries[char]?.kr?.sourceMeaningLanguage === "en");
    expect(english.length).toBe(281);
    const unbadged = english.filter((char) => {
      const info = learningInfoForNotation("kr-hunum", char);
      // 기존 학습 자료가 이미 답한 글자는 테이블을 보지 않으므로 대상이 아니다.
      return info.provenance === "substitute" && notationBadgeHtml(info, "kr-hunum") === "";
    });
    expect(unbadged).toEqual([]);
  });

  it("배지가 붙은 값은 예외 없이 판정이 authentic 이 아니다", () => {
    for (const region of REGIONS) {
      for (const notation of NOTATIONS) {
        for (const char of ROSTERS[region]) {
          const info = learningInfoForNotation(notation, char);
          const badged = notationBadgeHtml(info, notation) !== "";
          expect(badged, `${char}/${notation}`).toBe(info.provenance !== "authentic");
        }
      }
    }
  });
});
