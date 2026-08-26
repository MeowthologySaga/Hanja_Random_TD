/*
 * 표기(읽기) 축 — 한자 범위(로스터)와 독립인 두 번째 축. (gripe #6, 트랙 D)
 *
 * RegionCode 하나가 [로스터 범위 + 표기 + 자형] 3역할을 겸직하던 것을
 * roster(범위) × notation(표기)로 나눈다. 이 파일은 표기 축의 정본이다:
 *   - 기본값 규칙(로스터의 자국 표기) — 현행 동작과 픽셀 하나 다르지 않다.
 *   - 통합 표기 테이블(unified-readings.json, 요청서 v8)의 타입과 폴백 자리.
 *   - 기능 플래그 NOTATION_AXIS_READY — 테이블이 도착해 커버리지 구멍이
 *     없어지면 이 상수 하나만 true 로 바꿔 교차 조합 UI 를 연다(사용자 결정:
 *     폴백 표시로 미리 열지 않는다).
 */
import type { IdiomDefinition } from "./idioms";
import type { NotationCode, RegionCode } from "./types";

/**
 * 범위×표기 교차 조합 개방 플래그.
 *
 * false 인 동안: S13 의 표기 3버튼 그룹은 hidden, 표기는 언제나 로스터의
 * 자국 표기로 굳는다. `src/data/unified-readings.json` 이 납품되어
 * installUnifiedReadings() 로 물리면 true 로 바꾼다 — 그때까지 이 플래그가
 * 지키는 코드 경로는 전부 도달 불가다.
 */
export const NOTATION_AXIS_READY = false;

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
 * ── 통합 표기 테이블 (요청서 v8 스키마) ─────────────────────────────────
 * entries[글자] = { kr: {reading}, jp: {on[], kun[]}, cn: {pinyin[], …} },
 * 언어권에서 실제로 쓰이지 않는 글자는 null + coverage 집계.
 */

export interface UnifiedReadingEntry {
  kr: { reading: string } | null;
  jp: { on: string[]; kun: string[] } | null;
  cn: {
    pinyin: string[];
    /** 정자 키 항목의 간체형. 1:多 는 배열 + note 로 대표형 명시. */
    simplified?: string | string[];
    /** 간체 키 항목의 정자형. 1:多 는 배열 + note 로 대표형 명시. */
    traditional?: string | string[];
    note?: string;
  } | null;
}

export interface UnifiedReadingsData {
  version: number;
  generatedAt: string;
  coverage: {
    total: number;
    kr: number;
    jp: number;
    cn: number;
    jpNull: string[];
    cnNull: string[];
  };
  entries: Record<string, UnifiedReadingEntry>;
}

/** 납품 전에는 null — crossNotationReading 이 전부 "표기 없음"으로 답한다. */
let unifiedReadings: UnifiedReadingsData | null = null;

/**
 * 통합 표기 테이블을 물리는 자리. 납품이 오면 부팅 경로에서
 * `import unified from "../data/unified-readings.json"` 뒤 한 번 부른다.
 * (테이블 도착 전에는 호출자가 없다.)
 */
export function installUnifiedReadings(data: UnifiedReadingsData): void {
  unifiedReadings = data;
}

/**
 * 교차 조합용 폴백 — 선택한 표기로 이 글자를 읽을 수 있으면 짧은 읽기 문자열,
 * 표기 없음(테이블 미도착·해당 언어권 미수록 null)이면 null.
 *
 * 지금은 테이블이 없어 언제나 null 이다. 호출자는 null 을 받으면 자국 표기로
 * 대체하고 `notationSubstituteHtml`(src/ui/notation-substitute.ts) 배지를 단다.
 */
export function crossNotationReading(notation: NotationCode, char: string): string | null {
  const entry = unifiedReadings?.entries[char];
  if (!entry) return null;
  switch (notation) {
    case "kr-hunum":
      return entry.kr?.reading ?? null;
    case "jp-onkun": {
      const on = entry.jp?.on ?? [];
      const kun = entry.jp?.kun ?? [];
      const joined = [...on.slice(0, 2), ...kun.slice(0, 2)].join("·");
      return joined || null;
    }
    case "cn-pinyin": {
      const joined = (entry.cn?.pinyin ?? []).slice(0, 2).join("·");
      return joined || null;
    }
  }
}

/**
 * 성어 읽기의 표기 스위치.
 *
 * 자국 표기(kr-hunum)와 테이블 미도착 폴백 모두 기존 한국식 독음
 * (idiom.reading)을 그대로 돌려주므로 현행 화면과 문자열이 같다.
 * 테이블이 물리면 교차 표기는 글자별 읽기를 이어 붙인다 — 구(句) 층위
 * 독음이 따로 오면 그때 이 함수만 바꾸면 된다.
 */
export function idiomReadingForNotation(idiom: IdiomDefinition, notation: NotationCode): string {
  if (notation === "kr-hunum") return idiom.reading;
  const parts = [...idiom.chars].map((char) => crossNotationReading(notation, char));
  if (parts.every((part): part is string => part !== null)) {
    return parts.join(notation === "cn-pinyin" ? " " : "·");
  }
  return idiom.reading;
}
