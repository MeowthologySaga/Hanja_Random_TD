/*
 * 커스텀 성어의 규칙 — 두 보정과 굴림.
 *
 * 이 모듈은 순수하다(난수·저장소 없음). 그래서 여기서 규칙을 못박아 두면
 * 화면이 어떻게 바뀌든 "겹치면 약해진다 · 획이 많으면 세진다"가 지켜진다.
 */
import { describe, expect, it } from "vitest";
import {
  CUSTOM_IDIOM_AXES,
  CUSTOM_IDIOM_EQUIP_LIMIT,
  customIdiomOdds,
  customIdiomReading,
  duplicateFactor,
  isValidCustomIdiomChars,
  pickAxis,
  rarityFactor,
  rollCustomIdiomBonus,
  starSumOf,
  uniqueCharCount
} from "../src/core/custom-idioms";

describe("커스텀 성어 — 중복 보정", () => {
  it("겹치는 글자가 많을수록 약해진다", () => {
    expect(uniqueCharCount("天地玄黃")).toBe(4);
    expect(uniqueCharCount("以心傳心")).toBe(3);
    expect(duplicateFactor("天地玄黃")).toBe(1);
    expect(duplicateFactor("以心傳心")).toBe(0.8);
    expect(duplicateFactor("心心傳傳")).toBe(0.6);
    expect(duplicateFactor("心心心心")).toBe(0.35);
  });
});

describe("커스텀 성어 — 레어도 보정", () => {
  it("별 합이 클수록 세지고, 양끝에서 멈춘다", () => {
    expect(rarityFactor(4)).toBeCloseTo(0.8, 6);
    expect(rarityFactor(32)).toBeCloseTo(1.5, 6);
    // 표를 벗어난 값도 양끝으로 잘린다.
    expect(rarityFactor(1)).toBeCloseTo(0.8, 6);
    expect(rarityFactor(99)).toBeCloseTo(1.5, 6);
    expect(rarityFactor(18)).toBeGreaterThan(rarityFactor(10));
  });

  it("별 합은 네 글자의 등급을 더한 값이다", () => {
    const sum = starSumOf("天地玄黃");
    expect(sum).toBeGreaterThanOrEqual(4);
    expect(sum).toBeLessThanOrEqual(32);
  });
});

describe("커스텀 성어 — 굴림", () => {
  it("같은 난수면 언제나 같은 결과다", () => {
    const a = rollCustomIdiomBonus("天地玄黃", 0.42, 0.7);
    const b = rollCustomIdiomBonus("天地玄黃", 0.42, 0.7);
    expect(a).toEqual(b);
  });

  it("겹친 글자로 만든 성어는 같은 굴림에서 더 약하다", () => {
    for (const axisRoll of [0.05, 0.3, 0.55, 0.8, 0.95]) {
      const clean = rollCustomIdiomBonus("天地玄黃", axisRoll, 1);
      const dirty = rollCustomIdiomBonus("天天天天", axisRoll, 1);
      expect(dirty.kind).toBe(clean.kind);
      expect(dirty.value).toBeLessThan(clean.value);
    }
  });

  it("어떤 굴림도 그 축의 최고를 넘지 않는다", () => {
    for (let i = 0; i < 200; i += 1) {
      const bonus = rollCustomIdiomBonus("龍龜鑑鐵", i / 200, ((i * 7) % 200) / 200);
      const axis = CUSTOM_IDIOM_AXES.find((entry) => entry.kind === bonus.kind);
      expect(axis).toBeDefined();
      expect(bonus.value).toBeLessThanOrEqual(axis?.peak ?? 0);
      expect(bonus.value).toBeGreaterThan(0);
    }
  });

  it("축 선택은 가중치 순서를 따르고 0·1 끝에서도 축을 준다", () => {
    expect(pickAxis(0).kind).toBe(CUSTOM_IDIOM_AXES[0]?.kind);
    expect(pickAxis(1).kind).toBe(CUSTOM_IDIOM_AXES[CUSTOM_IDIOM_AXES.length - 1]?.kind);
  });
});

describe("커스텀 성어 — 확률표", () => {
  it("확률의 합은 1 이고, 축마다 최고값을 함께 알린다", () => {
    const odds = customIdiomOdds("天地玄黃");
    expect(odds).toHaveLength(CUSTOM_IDIOM_AXES.length);
    const total = odds.reduce((sum, row) => sum + row.chance, 0);
    expect(total).toBeCloseTo(1, 6);
    for (const row of odds) {
      expect(row.min).toBeLessThanOrEqual(row.max);
      expect(row.max).toBeLessThanOrEqual(row.peak);
      expect(row.peakLabel.length).toBeGreaterThan(0);
    }
  });

  it("겹친 조합은 표의 값 범위가 통째로 내려간다", () => {
    const clean = customIdiomOdds("天地玄黃");
    const dirty = customIdiomOdds("天天地地");
    for (let index = 0; index < clean.length; index += 1) {
      expect(dirty[index]?.max ?? 0).toBeLessThan(clean[index]?.max ?? 0);
      // 최고값은 조합과 무관한 세상의 천장이라 같다.
      expect(dirty[index]?.peak).toBe(clean[index]?.peak);
    }
  });
});

describe("커스텀 성어 — 음과 유효성", () => {
  it("음은 훈음의 마지막 토막을 이어 붙인다", () => {
    expect(customIdiomReading("天地玄黃")).toBe("천지현황");
    expect(customIdiomReading("以心傳心")).toBe("이심전심");
  });

  it("네 글자 한자만 조합이 된다", () => {
    expect(isValidCustomIdiomChars("天地玄黃")).toBe(true);
    expect(isValidCustomIdiomChars("天地玄")).toBe(false);
    expect(isValidCustomIdiomChars("天地玄黃宇")).toBe(false);
    expect(isValidCustomIdiomChars("천지현황")).toBe(false);
  });

  it("장착 상한은 15 구다", () => {
    expect(CUSTOM_IDIOM_EQUIP_LIMIT).toBe(15);
  });
});
