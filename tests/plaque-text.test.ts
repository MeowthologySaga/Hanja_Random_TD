import { describe, expect, it } from "vitest";
import { balancedTextLines, compactReading, compactReadingCandidates, type MeasureText } from "../src/ui/plaque-text";

/**
 * Malgun Gothic 근사 실측기. 한글·한자는 글꼴 크기와 거의 같은 정사각 폭이고,
 * 공백·괄호·말줄임표는 그보다 좁다. 캔버스가 없는 vitest 에서 규칙만 검증한다.
 */
const measure: MeasureText = (value, fontSize) => {
  let width = 0;
  for (const character of value) {
    if (/\s/u.test(character)) width += fontSize * 0.32;
    else if (/[()（）[\]]/u.test(character)) width += fontSize * 0.4;
    else if (character === "…") width += fontSize * 0.9;
    else if (/[가-힣一-鿿]/u.test(character)) width += fontSize;
    else width += fontSize * 0.55;
  }
  return width;
};

/** 84x40 compact 명패의 훈음 칸: 51px 에서 좌우 여백 5px 을 뺀 값. */
const COMPACT_READING_WIDTH = 46;

describe("전장 명패 훈음 2줄 배치", () => {
  it("한 줄에 들어가는 훈음은 나누지 않는다", () => {
    const fitted = balancedTextLines("눈 목", COMPACT_READING_WIDTH, measure, 9);
    expect(fitted.lines).toEqual(["눈 목"]);
    expect(fitted.width).toBeLessThanOrEqual(COMPACT_READING_WIDTH);
  });

  it("긴 훈음은 공백 경계에서 두 줄의 폭이 가장 비슷해지도록 나눈다", () => {
    const fitted = balancedTextLines("수레 가기 힘들 가", COMPACT_READING_WIDTH, measure, 9);
    expect(fitted.lines).toHaveLength(2);
    // 두 줄 모두 공백 경계에서 잘려 글자가 쪼개지지 않는다.
    expect(fitted.lines.join(" ")).toBe("수레 가기 힘들 가");
    const [head, tail] = fitted.lines as [string, string];
    expect(Math.abs(measure(head, 9) - measure(tail, 9))).toBeLessThanOrEqual(9);
    expect(fitted.width).toBeLessThanOrEqual(COMPACT_READING_WIDTH);
  });

  it("공백이 없는 훈음도 글자 경계에서 균형 있게 나눈다", () => {
    const fitted = balancedTextLines("가나다라마바", COMPACT_READING_WIDTH, measure, 9);
    expect(fitted.lines).toEqual(["가나다", "라마바"]);
  });

  it("최장 훈음은 9px 두 줄에 담기고 압축이 필요 없다", () => {
    const reading = compactReading("수레 가기 힘들 가", COMPACT_READING_WIDTH, measure);
    expect(reading.font).toBe(9);
    expect(reading.shortened).toBe(false);
    expect(reading.lines).toHaveLength(2);
    expect(reading.width).toBeLessThanOrEqual(COMPACT_READING_WIDTH);
  });

  it("9px 로 넘치면 8px 로 한 번만 줄인다", () => {
    const reading = compactReading("아름다울 미르", COMPACT_READING_WIDTH, measure);
    expect(reading.font).toBeGreaterThanOrEqual(8);
    expect(reading.width).toBeLessThanOrEqual(COMPACT_READING_WIDTH);
  });

  it("8px 로도 넘치면 괄호 보충 설명을 걷어낸 짧은 훈음을 쓴다", () => {
    const full = "엄쪽(어음을 쪼갠 한 쪽) 권";
    const reading = compactReading(full, COMPACT_READING_WIDTH, measure);
    expect(reading.shortened).toBe(true);
    expect(reading.lines.join("")).not.toContain("(");
    expect(reading.width).toBeLessThanOrEqual(COMPACT_READING_WIDTH);
    // 전체값은 상세 팝오버가 그대로 보여주므로 후보 목록에 남아 있어야 한다.
    expect(compactReadingCandidates(full)[0]).toBe(full);
  });

  it("짧은 훈음 후보는 괄호 제거 → 첫·마지막 토큰 순으로 만든다", () => {
    expect(compactReadingCandidates("엄쪽(어음을 쪼갠 한 쪽) 권")).toEqual([
      "엄쪽(어음을 쪼갠 한 쪽) 권",
      "엄쪽 권",
      "엄쪽(어음을…권"
    ]);
  });

  it("어떤 훈음도 명패 폭을 넘기지 않는다", () => {
    const samples = [
      "눈 목",
      "써 이",
      "익숙할 완",
      "병장기 융",
      "수레 가기 힘들 가",
      "엄쪽(어음을 쪼갠 한 쪽) 권",
      "말미암을 유",
      "그러할 연"
    ];
    for (const sample of samples) {
      const reading = compactReading(sample, COMPACT_READING_WIDTH, measure);
      expect(reading.lines.length).toBeLessThanOrEqual(2);
      expect(reading.width).toBeLessThanOrEqual(COMPACT_READING_WIDTH);
      expect(reading.font).toBeGreaterThanOrEqual(8);
    }
  });
});
