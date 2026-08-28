/*
 * 커스텀 성어 — 묵편 넷을 새겨 만드는 내 성어.
 *
 * 기존 성어(104구)와 커스텀은 일부러 결이 다르다. 기존 성어는 이미 존재하는
 * 글귀라 "뜻이 곧 규칙"인 특별대우를 받고, 커스텀은 **수치와 무작위**로 선다.
 * 그래야 둘이 서로를 잡아먹지 않는다(2026-08-28 기획 결정).
 *
 * 이 모듈은 순수하다 — 난수도 저장소도 DOM 도 모른다. 굴림은 호출자가 0~1
 * 두 개를 넘겨 주고(축 선택·값 선택), 그래서 시드 재현과 시험이 그대로 된다.
 *
 * 두 보정이 규칙의 전부다.
 *  · 같은 글자가 겹칠수록 약해진다 — 겹치면 줄 맞추기가 쉬워 발동이 헐거워진다.
 *    이심전심에 心 이 둘이라 쉬운 것과 같은 이치다.
 *  · 획이 많은 글자를 모을수록 세진다 — 그 넷을 모으는 것 자체가 비용이다.
 */
import { casualNaturalStar } from "./casual";
import type { IdiomDefinition } from "./idioms";
import { learningInfo } from "./learning";
import type { IdiomBonusKind, RegionCode } from "./types";

/** 커스텀 성어가 굴릴 수 있는 능력 축. 앞 넷은 기존 성어와 같은 종류다. */
export type CustomIdiomBonusKind = IdiomBonusKind;

export interface CustomIdiomBonus {
  readonly kind: CustomIdiomBonusKind;
  readonly value: number;
  readonly label: string;
}

/** 저장되는 커스텀 성어 한 구. 뜻만 사람이 쓰고 나머지는 규칙이 정한다. */
export interface CustomIdiom {
  readonly id: string;
  /** 네 글자. 순서가 곧 줄에 세울 차례다. */
  readonly chars: string;
  /** 음 — 한자 음을 그대로 이어 붙인다. 사람이 고칠 수 없다. */
  readonly reading: string;
  /** 뜻 — 사람이 쓴다. 빈 문자열이면 아직 안 적은 것이다. */
  readonly meaning: string;
  readonly bonus: CustomIdiomBonus;
  readonly createdAt: number;
}

export interface CustomIdiomAxis {
  readonly kind: CustomIdiomBonusKind;
  /** 굴림 가중치. 확률표는 이 값을 정규화해 보여 준다. */
  readonly weight: number;
  /** 보정 전 기본 굴림 범위. */
  readonly min: number;
  readonly max: number;
  /** 이 축이 세상에서 닿을 수 있는 최고값 — 화면의 「이 축의 최고」. */
  readonly peak: number;
  /** 소수 자리(표시·반올림 단위). 0 이면 정수 축이다. */
  readonly decimals: number;
  /** 값만 짧게 적은 표기. 확률표 한 줄이 문장을 두 번 되풀이하지 않게 한다. */
  readonly short: (value: number) => string;
  /** 축 이름(값 없는 말). 확률표는 이름 한 번 + 값 여러 번으로 적는다. */
  readonly name: string;
  readonly label: (value: number) => string;
}

/**
 * 능력 축 표.
 *
 * 앞 넷(피해·사거리·감속·합성 엽전)은 기존 성어와 같은 종류지만 **합산 통이
 * 다르다** — 기존 성어의 전역 보너스는 두 구면 상한에 닿으므로, 커스텀까지
 * 같은 통에 넣으면 애써 만든 성어가 아무 일도 하지 않는다(실측). 엔진은 커스텀
 * 몫을 따로 더한다.
 */
export const CUSTOM_IDIOM_AXES: readonly CustomIdiomAxis[] = Object.freeze([
  {
    kind: "damage", weight: 18, min: 0.04, max: 0.11, peak: 0.16, decimals: 3,
    name: "모든 자령 피해",
    short: (value) => `+${Math.round(value * 100)}%`,
    label: (value) => `모든 자령 피해 +${Math.round(value * 100)}%`
  },
  {
    kind: "range", weight: 16, min: 8, max: 22, peak: 32, decimals: 0,
    name: "모든 자령 사거리",
    short: (value) => `+${Math.round(value)}`,
    label: (value) => `모든 자령 사거리 +${Math.round(value)}`
  },
  {
    kind: "enemySlow", weight: 10, min: 0.03, max: 0.08, peak: 0.12, decimals: 3,
    name: "적 이동 속도",
    short: (value) => `−${Math.round(value * 100)}%`,
    label: (value) => `모든 적 이동 속도 −${Math.round(value * 100)}%`
  },
  {
    kind: "evolutionGold", weight: 12, min: 2, max: 6, peak: 9, decimals: 0,
    name: "합성 엽전",
    short: (value) => `+${Math.round(value)}엽전`,
    label: (value) => `합성할 때마다 엽전 +${Math.round(value)}`
  },
  {
    kind: "killEssence", weight: 14, min: 0.4, max: 1.4, peak: 2.5, decimals: 2,
    name: "봉인 문기",
    short: (value) => `+${value.toFixed(2)}문기`,
    label: (value) => `적을 봉인할 때마다 그 오행 문기 +${value.toFixed(2)}`
  },
  {
    kind: "waveGold", weight: 14, min: 4, max: 12, peak: 18, decimals: 0,
    name: "웨이브 엽전",
    short: (value) => `+${Math.round(value)}엽전`,
    label: (value) => `웨이브가 시작될 때 엽전 +${Math.round(value)}`
  },
  {
    kind: "weaknessDamage", weight: 10, min: 0.05, max: 0.14, peak: 0.2, decimals: 3,
    name: "약점 피해",
    short: (value) => `+${Math.round(value * 100)}%`,
    label: (value) => `약점 오행 적에게 피해 +${Math.round(value * 100)}%`
  },
  {
    kind: "formationAttack", weight: 6, min: 0.06, max: 0.16, peak: 0.25, decimals: 3,
    name: "이 진의 공격",
    short: (value) => `+${Math.round(value * 100)}%`,
    label: (value) => `이 성어가 선 진의 자령 공격 +${Math.round(value * 100)}%`
  }
]);

/** 한 사람이 지닐 수 있는 커스텀 성어 수의 상한(장착 기준). */
export const CUSTOM_IDIOM_EQUIP_LIMIT = 15;

/** 성어 한 구를 이루는 글자 수. 네 글자 사언이 이 게임의 규칙이다. */
export const CUSTOM_IDIOM_LENGTH = 4;

/** 네 글자 중 서로 다른 글자의 수. */
export function uniqueCharCount(chars: string): number {
  return new Set([...chars]).size;
}

/**
 * 중복 보정 — 같은 글자가 겹칠수록 능력이 약해진다.
 *
 * 겹친 글자는 줄에 세우기가 그만큼 쉽다. 쉬운 발동에는 낮은 값을 준다.
 */
export function duplicateFactor(chars: string): number {
  const unique = uniqueCharCount(chars);
  if (unique >= 4) return 1;
  if (unique === 3) return 0.8;
  if (unique === 2) return 0.6;
  return 0.35;
}

/** 네 글자의 별 합(각 글자의 획수 등급). 자료 밖 글자는 1★ 로 친다. */
export function starSumOf(chars: string): number {
  let sum = 0;
  for (const char of chars) sum += casualNaturalStar(char) ?? 1;
  return sum;
}

/**
 * 레어도 보정 — 획이 많은 글자를 모을수록 세진다.
 * 별 합 4(1★ 넷) → 0.80, 32(8★ 넷) → 1.50.
 */
export function rarityFactor(starSum: number): number {
  const clamped = Math.max(4, Math.min(32, starSum));
  return 0.8 + ((clamped - 4) / 28) * 0.7;
}

export interface CustomIdiomOdds {
  readonly kind: CustomIdiomBonusKind;
  /** 축 이름(값 없는 말). */
  readonly name: string;
  /** 이 축이 나올 확률(0~1). */
  readonly chance: number;
  /** 이 조합에서 실제로 나올 수 있는 값의 범위. */
  readonly min: number;
  readonly max: number;
  /** 이 축이 세상에서 닿는 최고값 — 더 좋은 재료로 다시 만들 이유를 남긴다. */
  readonly peak: number;
  readonly minLabel: string;
  readonly maxLabel: string;
  readonly peakLabel: string;
  /** 값만 짧게 — 확률표 한 줄에 범위와 천장을 함께 적을 때 쓴다. */
  readonly minShort: string;
  readonly maxShort: string;
  readonly peakShort: string;
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function applyFactors(axis: CustomIdiomAxis, base: number, factor: number): number {
  return roundTo(Math.min(axis.peak, base * factor), axis.decimals);
}

/**
 * 조합 확률표 — 태우기 **전에** 보여 준다.
 *
 * 이 게임은 소환 확률을 이미 공개한다(도움말 확률표). 묵편 넷은 되돌릴 수 없으니
 * 같은 규범을 따른다. 「이 축의 최고」까지 함께 적어 지금 조합의 천장이 어디인지
 * 눈으로 재게 한다.
 */
export function customIdiomOdds(chars: string): readonly CustomIdiomOdds[] {
  const factor = duplicateFactor(chars) * rarityFactor(starSumOf(chars));
  const total = CUSTOM_IDIOM_AXES.reduce((sum, axis) => sum + axis.weight, 0);
  return CUSTOM_IDIOM_AXES.map((axis) => {
    const min = applyFactors(axis, axis.min, factor);
    const max = applyFactors(axis, axis.max, factor);
    return {
      kind: axis.kind,
      name: axis.name,
      chance: axis.weight / total,
      min,
      max,
      peak: axis.peak,
      minLabel: axis.label(min),
      maxLabel: axis.label(max),
      peakLabel: axis.label(axis.peak),
      minShort: axis.short(min),
      maxShort: axis.short(max),
      peakShort: axis.short(axis.peak)
    };
  });
}

/**
 * 축 하나를 고른다. `pick` 은 0~1, 가중치 순서대로 자른다.
 * 순수 함수라 같은 값이면 언제나 같은 축이 나온다.
 */
export function pickAxis(pick: number): CustomIdiomAxis {
  const total = CUSTOM_IDIOM_AXES.reduce((sum, axis) => sum + axis.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, pick)) * total;
  for (const axis of CUSTOM_IDIOM_AXES) {
    cursor -= axis.weight;
    if (cursor < 0) return axis;
  }
  return CUSTOM_IDIOM_AXES[CUSTOM_IDIOM_AXES.length - 1] as CustomIdiomAxis;
}

/** 굴림 결과. 호출자가 난수 둘(축 선택·값 선택)을 준다. */
export function rollCustomIdiomBonus(chars: string, axisRoll: number, valueRoll: number): CustomIdiomBonus {
  const axis = pickAxis(axisRoll);
  const factor = duplicateFactor(chars) * rarityFactor(starSumOf(chars));
  const spread = Math.max(0, Math.min(1, valueRoll));
  const base = axis.min + (axis.max - axis.min) * spread;
  const value = applyFactors(axis, base, factor);
  return { kind: axis.kind, value, label: axis.label(value) };
}

/**
 * 음 — 한자 음을 그대로 이어 붙인다.
 *
 * 훈음("하늘 천")의 마지막 토막이 음이다. 사람이 고칠 수 없는 것이 규칙이다 —
 * 말장난을 하고 싶으면 글자를 그렇게 고르면 된다. 읽기가 자료에 없는 글자는
 * 그 자리에 글자를 그대로 둔다(빈칸보다 낫다).
 */
export function customIdiomReading(chars: string, region: RegionCode = "KR"): string {
  return [...chars]
    .map((char) => {
      const reading = learningInfo(region, char).reading;
      if (!reading || reading.includes("미수록")) return char;
      const parts = reading.split(/\s+/u).filter(Boolean);
      return parts[parts.length - 1] ?? char;
    })
    .join("");
}

/** 네 글자인지, 모두 한자인지. 조합 버튼이 이걸 묻는다. */
export function isValidCustomIdiomChars(chars: string): boolean {
  const glyphs = [...chars];
  if (glyphs.length !== CUSTOM_IDIOM_LENGTH) return false;
  return glyphs.every((glyph) => /\p{Script=Han}/u.test(glyph));
}

/** 커스텀 성어가 판에 설 때 쓰는 빛깔. 묵편의 보랏빛 그대로다. */
export const CUSTOM_IDIOM_COLOR = "#c9a8ff";

/**
 * 새긴 성어를 엔진이 아는 성어 정의로 옮긴다.
 *
 * 엔진에게 커스텀은 특별한 물건이 아니다 — 줄 세우기·발동·해제가 전부 같은
 * 길을 탄다. 다른 것은 `source: "custom"` 하나뿐이고, 그 표식으로 합산 통과
 * 화면 표시만 갈린다.
 */
export function customIdiomToDefinition(idiom: CustomIdiom): IdiomDefinition {
  return {
    id: idiom.id,
    chars: idiom.chars,
    name: idiom.reading,
    reading: idiom.reading,
    // 뜻을 안 적었으면 빈 자리를 남기지 않고 재료를 적어 준다.
    meaning: idiom.meaning || `${[...idiom.chars].join("·")} — 묵편으로 새긴 성어`,
    color: CUSTOM_IDIOM_COLOR,
    source: "custom",
    sourceOrder: null,
    bonus: { kind: idiom.bonus.kind, value: idiom.bonus.value, label: idiom.bonus.label }
  };
}
