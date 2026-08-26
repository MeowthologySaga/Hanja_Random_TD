/*
 * 표기(읽기) 축 — 한자 범위(로스터)와 독립인 두 번째 축. (gripe #6, 트랙 D·Q)
 *
 * RegionCode 하나가 [로스터 범위 + 표기 + 자형] 3역할을 겸직하던 것을
 * roster(범위) × notation(표기)로 나눈다. 이 파일은 표기 축의 정본이다:
 *   - 기본값 규칙(로스터의 자국 표기) — 현행 동작과 픽셀 하나 다르지 않다.
 *   - 통합 표기 테이블(unified-readings v2, 4,560자)의 타입과 적재 경로.
 *   - 판정 3종(authentic·derived·substitute)의 정본 — 배지는 이 판정만 본다.
 *
 * ── 적재 방식: 동적 import ──────────────────────────────────────────────
 * 테이블 원본은 1.74 MB(gzip 182 KB)라 주 번들에 정적으로 넣으면 gzip 612 KB
 * → 794 KB 로 부푼다. 그런데 이 테이블이 필요한 순간은 "표기 ≠ 로스터 자국
 * 표기"인 교차 조합뿐이다(자국 표기 3조합은 learning-readings.json 만으로
 * 빈칸 0 — 트랙 Q 실측). 그래서 별도 청크로 떼고 교차 표기를 고르는 순간에만
 * 받는다. 아무것도 안 고른 사람은 이 바이트를 영영 받지 않는다.
 */
import type { IdiomDefinition } from "./idioms";
import type { NotationCode, RegionCode } from "./types";

/**
 * 범위×표기 교차 조합 개방 플래그.
 *
 * true — 통합 표기 테이블 v2 가 `src/data/unified-readings.json` 에 들어왔고
 * 로스터 합집합 4,560자에 대해 KR·JP·CN 잔여 빈칸이 0이다. S13 의 표기 3버튼
 * 그룹이 열리고, 표기 축이 로스터의 자국 표기에서 벗어날 수 있다.
 *
 * 기본값은 그대로 로스터의 자국 표기라 아무것도 고르지 않은 화면은 무변경이다.
 */
export const NOTATION_AXIS_READY = true;

/** 로스터의 자국 표기 — notation 을 따로 고르지 않았을 때의 기본값. */
export function defaultNotationForRegion(region: RegionCode): NotationCode {
  switch (region) {
    case "KR":
      return "kr-hunum";
    case "JP":
      return "jp-onkun";
    case "CN":
      return "cn-pinyin";
  }
}

/** S13 버튼·대체 배지가 함께 쓰는 표기 이름표. */
export const NOTATION_LABELS: Record<NotationCode, { name: string; sample: string }> = {
  "kr-hunum": { name: "한국 훈음", sample: "서로 상" },
  "jp-onkun": { name: "일본 음훈", sample: "ソウ · あい" },
  "cn-pinyin": { name: "중국 병음", sample: "xiāng" }
};

/*
 * ── 통합 표기 테이블 (unified-readings-v2 스키마) ───────────────────────
 * entries[글자] = { kr, jp, cn }. v2 는 세 언어 모두 null 이 없다 — 사전에
 * 없던 자리는 자형 파생(derived) 또는 대체 표기(substitute)로 메웠고, 그
 * 판정이 값과 함께 실려 온다. 배지는 이 판정을 그대로 읽는다.
 */

/**
 * 표기 값의 출처 판정 — 배지 규칙의 유일한 근거.
 *
 * - `authentic`: 해당 언어권 사전에 그 글자로 실린 읽기. 배지 없음.
 * - `derived`: 그 글자가 아니라 원자형(정자·이체자)의 읽기를 물려받았다.
 *   예: 们 ← 們. 「정자 기준」 배지 + 원자형을 함께 보인다.
 * - `substitute`: 그 언어권에 읽기 자체가 없어 다른 문자권의 읽기·뜻을
 *   빌려 왔다. 「대체 표기」 배지 필수. 특히 sourceMeaningLanguage="en" 은
 *   원천 영어 뜻을 번역 없이 보존한 값이라 훈음/음훈으로 읽으면 안 된다.
 */
export type ReadingProvenance = "authentic" | "derived" | "substitute";

/** 대체 표기의 근거 종류. 납품 계약(substituteContract.allowed) 그대로. */
export type SubstituteKind = "kokuji-jp" | "cn-only" | "other" | "glyph-only";

/** 대체 근거를 사람 말로 — 배지 곁말·툴팁이 함께 쓴다. */
export const SUBSTITUTE_KIND_LABELS: Record<SubstituteKind, string> = {
  "kokuji-jp": "일본 고유자",
  "cn-only": "중국 전용자",
  other: "타 문자권 표기",
  "glyph-only": "자형만 전함"
};

interface UnifiedKrReading {
  reading: string;
  derived?: boolean;
  derivedFrom?: string;
  substitute?: SubstituteKind;
  source?: string;
  sourceReading?: string;
  sourceMeaning?: string;
  sourceMeaningLanguage?: string;
  sourceMeaningDerivedFrom?: string;
}

interface UnifiedJpReading {
  on: string[];
  kun: string[];
  /** 대체 항목은 on/kun 이 빈 배열이고 reading 에 대체 문자열이 실린다. */
  reading?: string;
  derived?: boolean;
  derivedFrom?: string;
  substitute?: SubstituteKind;
  source?: string;
  sourceReading?: string;
  sourceMeaning?: string;
  sourceMeaningLanguage?: string;
  sourceMeaningDerivedFrom?: string;
}

interface UnifiedCnReading {
  pinyin: string[];
  /** 정자 키 항목의 간체형. 1:多 는 배열 + note 로 대표형 명시. */
  simplified?: string | string[];
  /** 간체 키 항목의 정자형. 1:多 는 배열 + note 로 대표형 명시. */
  traditional?: string | string[];
  note?: string;
}

export interface UnifiedReadingEntry {
  kr: UnifiedKrReading | null;
  jp: UnifiedJpReading | null;
  cn: UnifiedCnReading | null;
}

export interface UnifiedReadingsData {
  schema?: string;
  version: number;
  generatedAt: string;
  coverage: {
    total: number;
    kr: number;
    jp: number;
    cn: number;
    krNull?: string[];
    jpNull?: string[];
    cnNull?: string[];
  };
  entries: Record<string, UnifiedReadingEntry>;
}

/**
 * 테이블이 붙기 전에는 null — 이때 교차 표기 질의는 전부 null 로 답하고
 * 호출자는 기존 learning-readings.json 값(자국 표기)으로 굴러간다.
 */
let unifiedReadings: UnifiedReadingsData | null = null;

/** 통합 표기 테이블을 물리는 자리. 동적 적재와 테스트가 함께 쓴다. */
export function installUnifiedReadings(data: UnifiedReadingsData): void {
  unifiedReadings = data;
}

/** 테스트가 「미도착」 상태를 되살릴 때. */
export function resetUnifiedReadings(): void {
  unifiedReadings = null;
  loading = null;
}

/** 테이블이 이미 붙어 있는지 — 렌더 경로가 기다릴지 말지 고를 때 본다. */
export function unifiedReadingsInstalled(): boolean {
  return unifiedReadings !== null;
}

let loading: Promise<boolean> | null = null;

/**
 * 통합 표기 테이블을 받아 붙인다(멱등).
 *
 * 별도 청크라 첫 호출에서만 네트워크가 돈다. 교차 표기를 고르는 순간과
 * 교차 표기로 런을 시작하는 순간에 await 로 앞세워, 표기가 바뀐 화면이
 * 그려지기 전에 값이 준비되도록 한다. 실패해도 화면은 자국 표기로 살아
 * 있으므로 false 만 돌려주고 던지지 않는다.
 */
export function ensureUnifiedReadings(): Promise<boolean> {
  if (unifiedReadings) return Promise.resolve(true);
  loading ??= import("../data/unified-readings.json")
    .then((module) => {
      installUnifiedReadings((module.default ?? module) as unknown as UnifiedReadingsData);
      return true;
    })
    .catch(() => {
      loading = null;
      return false;
    });
  return loading;
}

/** 자국 표기 3조합은 테이블 없이도 빈칸 0 — 교차일 때만 받아 온다. */
export function notationNeedsUnifiedTable(region: RegionCode, notation: NotationCode): boolean {
  return notation !== defaultNotationForRegion(region);
}

/** 통합 표기 테이블이 그 글자·표기에 대해 내놓는 값. */
export interface UnifiedReadingLookup {
  /** 짧은 읽기 — 좁은 자리(자령 명패·카드)에 쓴다. */
  short: string;
  /** 긴 읽기 — 도감 상세처럼 넉넉한 자리에 쓴다. */
  full: string;
  provenance: ReadingProvenance;
  /** derived 일 때 읽기를 물려준 원자형. 예: 們 */
  derivedFrom?: string;
  substituteKind?: SubstituteKind;
  /** substitute 일 때 원천 표기(예: gài · てる/ふたつ/リョウ). */
  sourceReading?: string;
  /** substitute 일 때 원천 뜻. 번역하지 않은 원문 그대로다. */
  sourceMeaning?: string;
  /** 원천 뜻의 언어. "en" 이면 훈음이 아니라 영어 뜻이다. */
  sourceMeaningLanguage?: string;
  /** 뜻을 정자·이체자에서 승계했을 때의 그 글자. */
  sourceMeaningDerivedFrom?: string;
}

function provenanceOf(value: { derived?: boolean; substitute?: SubstituteKind }): ReadingProvenance {
  if (value.substitute) return "substitute";
  if (value.derived) return "derived";
  return "authentic";
}

/**
 * 표기 축의 단일 질의 창구 — 글자 하나를 고른 표기로 어떻게 읽는가.
 *
 * 테이블이 아직 안 붙었거나 그 글자가 테이블에 없으면 null. 호출자
 * (learningInfoForNotation)는 null 을 받으면 기존 값으로 굴러간다.
 */
export function unifiedReadingFor(notation: NotationCode, char: string): UnifiedReadingLookup | null {
  const entry = unifiedReadings?.entries[char];
  if (!entry) return null;
  if (notation === "kr-hunum") {
    const kr = entry.kr;
    if (!kr?.reading) return null;
    return {
      short: kr.substitute ? kr.sourceReading || kr.reading : kr.reading,
      full: kr.reading,
      provenance: provenanceOf(kr),
      ...(kr.derivedFrom ? { derivedFrom: kr.derivedFrom } : {}),
      ...(kr.substitute ? { substituteKind: kr.substitute } : {}),
      ...(kr.sourceReading ? { sourceReading: kr.sourceReading } : {}),
      ...(kr.sourceMeaning ? { sourceMeaning: kr.sourceMeaning } : {}),
      ...(kr.sourceMeaningLanguage ? { sourceMeaningLanguage: kr.sourceMeaningLanguage } : {}),
      ...(kr.sourceMeaningDerivedFrom ? { sourceMeaningDerivedFrom: kr.sourceMeaningDerivedFrom } : {})
    };
  }
  if (notation === "jp-onkun") {
    const jp = entry.jp;
    if (!jp) return null;
    const on = jp.on ?? [];
    const kun = jp.kun ?? [];
    const compact = [...on.slice(0, 2), ...kun.slice(0, 2)].join("·");
    // 대체 항목은 on/kun 이 비어 있고 reading 에만 값이 있다.
    if (!compact && !jp.reading) return null;
    const full = compact
      ? [on.length ? `음독 ${on.slice(0, 3).join("·")}` : "", kun.length ? `훈독 ${kun.slice(0, 3).join("·")}` : ""]
        .filter(Boolean)
        .join(" · ")
      : (jp.reading as string);
    return {
      short: compact || jp.sourceReading || (jp.reading as string),
      full,
      provenance: provenanceOf(jp),
      ...(jp.derivedFrom ? { derivedFrom: jp.derivedFrom } : {}),
      ...(jp.substitute ? { substituteKind: jp.substitute } : {}),
      ...(jp.sourceReading ? { sourceReading: jp.sourceReading } : {}),
      ...(jp.sourceMeaning ? { sourceMeaning: jp.sourceMeaning } : {}),
      ...(jp.sourceMeaningLanguage ? { sourceMeaningLanguage: jp.sourceMeaningLanguage } : {}),
      ...(jp.sourceMeaningDerivedFrom ? { sourceMeaningDerivedFrom: jp.sourceMeaningDerivedFrom } : {})
    };
  }
  const cn = entry.cn;
  const pinyin = cn?.pinyin ?? [];
  if (!pinyin.length) return null;
  return { short: pinyin.slice(0, 2).join("·"), full: pinyin.slice(0, 3).join(" · "), provenance: "authentic" };
}

/**
 * 교차 조합용 짧은 읽기 문자열. 판정이 필요 없는 옛 호출자를 위한 얇은 겉면.
 */
export function crossNotationReading(notation: NotationCode, char: string): string | null {
  return unifiedReadingFor(notation, char)?.short ?? null;
}

/**
 * 성어 읽기의 표기 스위치.
 *
 * 자국 표기(kr-hunum)와 테이블 미도착 폴백 모두 기존 한국식 독음
 * (idiom.reading)을 그대로 돌려주므로 현행 화면과 문자열이 같다.
 * 테이블이 물리면 교차 표기는 글자별 읽기를 이어 붙인다 — 구(句) 층위
 * 독음이 따로 오면 그때 이 함수만 바꾸면 된다.
 */
export function idiomReadingForNotation(
  idiom: IdiomDefinition,
  notation: NotationCode,
  region?: RegionCode
): string {
  return idiomReadingInfoForNotation(idiom, notation, region).reading;
}

/** 성어 읽기 + 네 글자를 합산한 판정. 배지는 이 합산 판정을 읽는다. */
export interface IdiomReadingInfo {
  reading: string;
  provenance: ReadingProvenance;
  /** 합산이 substitute 일 때, 대체된 글자 중 첫 근거 종류. */
  substituteKind?: SubstituteKind;
}

/**
 * 성어 읽기의 표기 스위치 + 판정 합산.
 *
 * ── 테이블은 빈칸만 메운다, 있는 값을 덮지 않는다 ────────────────────────
 * idiom.reading 은 구(句) 층위로 손질된 독음이고, 글자별 읽기를 이어 붙인
 * 것보다 언제나 낫다. 그래서 자국 표기 조합(region 의 기본 표기)에서는
 * 테이블이 붙어 있든 말든 손질된 값을 그대로 쓴다 — region 을 받는 이유가
 * 이것이다. 표기를 한 번 바꿨다 되돌린 사람의 화면이 처음과 달라지는 일이
 * 없도록, 무변경을 적재 시점의 우연이 아니라 구조로 못 박는다.
 *
 * 교차 표기에서만 글자별 읽기를 이어 붙인다. 네 글자 중 하나라도 대체 표기면
 * 이어 붙인 구 전체가 대체 표기 취급이다(가장 약한 고리를 따른다) —
 * 한 글자만 빌려 왔는데 구 전체를 정통 독음으로 보이면 그게 오인이다.
 */
export function idiomReadingInfoForNotation(
  idiom: IdiomDefinition,
  notation: NotationCode,
  region?: RegionCode
): IdiomReadingInfo {
  if (notation === "kr-hunum") return { reading: idiom.reading, provenance: "authentic" };
  if (region && notation === defaultNotationForRegion(region)) {
    return { reading: idiom.reading, provenance: "authentic" };
  }
  const parts = [...idiom.chars].map((char) => unifiedReadingFor(notation, char));
  if (!parts.every((part): part is UnifiedReadingLookup => part !== null)) {
    return { reading: idiom.reading, provenance: "authentic" };
  }
  const reading = parts.map((part) => part.short).join(notation === "cn-pinyin" ? " " : "·");
  const substituted = parts.find((part) => part.provenance === "substitute");
  if (substituted) {
    return {
      reading,
      provenance: "substitute",
      ...(substituted.substituteKind ? { substituteKind: substituted.substituteKind } : {})
    };
  }
  if (parts.some((part) => part.provenance === "derived")) return { reading, provenance: "derived" };
  return { reading, provenance: "authentic" };
}
