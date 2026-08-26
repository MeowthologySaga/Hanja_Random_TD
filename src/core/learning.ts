import learningData from "../data/learning-readings.json";
import koreanHuneumOverrides from "../data/korean-huneum-overrides.json";
import { defaultNotationForRegion, unifiedReadingFor } from "./notation";
import type { ReadingProvenance, SubstituteKind } from "./notation";
import type { NotationCode, RegionCode } from "./types";

interface LearningEntry {
  h?: string;
  kh?: string;
  jo?: string;
  jk?: string;
  m?: string;
  d?: string;
}

interface LearningData {
  version: string;
  source: string;
  catalogCharacters: number;
  coveredCharacters: number;
  koreanHuneumCharacters: number;
  chars: Record<string, LearningEntry>;
}

export interface LearningInfo {
  short: string;
  readingLabel: string;
  reading: string;
  meaning: string;
  meaningSource: "ko" | "en" | "none";
  /**
   * 이 읽기가 어디서 왔는지 — 배지 규칙의 유일한 근거. (트랙 Q)
   *
   * 기존 learning-readings.json 이 답한 값은 언제나 "authentic" 이라
   * 자국 표기 3조합의 화면에는 배지가 하나도 늘지 않는다. derived·substitute
   * 는 통합 표기 테이블이 교차 조합의 빈칸을 메울 때만 붙는다.
   */
  provenance: ReadingProvenance;
  /** derived 일 때 읽기를 물려준 원자형. 예: 们 → 們 */
  derivedFrom?: string;
  /** substitute 일 때 대체 근거 종류. */
  substituteKind?: SubstituteKind;
  /** substitute 일 때 원천 표기(예: gài). */
  sourceReading?: string;
  /** substitute 일 때 원천 뜻 — 번역하지 않은 원문 그대로다. */
  sourceMeaning?: string;
  /** 원천 뜻의 언어. "en" 이면 훈음이 아니라 영어 뜻이므로 따로 조판한다. */
  sourceMeaningLanguage?: string;
  /** 뜻을 정자·이체자에서 승계했을 때의 그 글자. */
  sourceMeaningDerivedFrom?: string;
}

const data = learningData as LearningData;

const KOREAN_GLOSSES = koreanHuneumOverrides as Record<string, string>;

function compact(values: string | undefined, limit = 3): string {
  if (!values) return "";
  return values.split(/\s+/u).filter(Boolean).slice(0, limit).join("·");
}

function firstKoreanReading(char: string, entry: LearningEntry | undefined): string {
  const curated = KOREAN_GLOSSES[char] ?? entry?.kh;
  if (curated) return curated;
  const reading = compact(entry?.h, 2);
  return reading ? `음 ${reading}` : "읽기 미수록";
}

const READING_LABELS: Record<NotationCode, string> = {
  "kr-hunum": "훈음",
  "jp-onkun": "음독·훈독",
  "cn-pinyin": "병음"
};

/**
 * 표기 축 스위치 — 읽기 라벨 렌더 경로의 단일 관문. (gripe #6, 트랙 Q)
 *
 * region 이 아니라 notation 으로 갈린다. 뜻(훈)은 학습 언어가 한국어라
 * 표기와 무관하게 한국어 우선 그대로다.
 *
 * ── 순서가 곧 무변경 보증이다 ──────────────────────────────────────────
 * 먼저 기존 learning-readings.json 을 묻고, 그 답이 실제 값이면 통합 표기
 * 테이블을 아예 보지 않는다(판정도 authentic 으로 굳는다). 자국 표기 3조합
 * (KR×훈음·JP×음훈·CN×병음)은 이 1차 답만으로 빈칸이 0이므로 — 트랙 Q 실측:
 * 1,000·2,136·3,500자 전수 미수록 0 — 아무것도 고르지 않은 사람의 화면은
 * 테이블이 붙든 말든 글자 하나까지 그대로다.
 *
 * 통합 표기 테이블은 1차가 "미수록"이라고 답한 자리, 즉 교차 조합의 구멍
 * 에서만 말을 한다. 그 값에는 판정(authentic·derived·substitute)이 함께
 * 실려 오고, 배지는 그 판정만 본다.
 */
export function learningInfoForNotation(notation: NotationCode, char: string): LearningInfo {
  const entry = data.chars[char];
  const curated = KOREAN_GLOSSES[char] ?? entry?.kh;
  const koreanMeaning = curated?.split(" ").slice(0, -1).join(" ") ?? "";
  const meaning = koreanMeaning || entry?.d || "뜻 정보 미수록";
  const meaningSource: LearningInfo["meaningSource"] = koreanMeaning ? "ko" : entry?.d ? "en" : "none";
  const readingLabel = READING_LABELS[notation];

  let short: string;
  let reading: string;
  if (notation === "kr-hunum") {
    const value = firstKoreanReading(char, entry);
    short = value;
    reading = value;
  } else if (notation === "jp-onkun") {
    const on = compact(entry?.jo, 3);
    const kun = compact(entry?.jk, 3);
    short = on || kun || "읽기 미수록";
    reading = [on ? `음독 ${on}` : "", kun ? `훈독 ${kun}` : ""].filter(Boolean).join(" · ") || "읽기 미수록";
  } else {
    const mandarin = compact(entry?.m, 2);
    short = mandarin || "병음 미수록";
    reading = mandarin || "병음 미수록";
  }

  if (!short.includes("미수록")) {
    return { short, readingLabel, reading, meaning, meaningSource, provenance: "authentic" };
  }

  // 여기부터가 교차 조합의 구멍. 테이블이 아직 안 붙었으면 예전처럼 "미수록".
  const filled = unifiedReadingFor(notation, char);
  if (!filled) return { short, readingLabel, reading, meaning, meaningSource, provenance: "authentic" };
  return {
    short: filled.short,
    readingLabel,
    reading: filled.full,
    meaning,
    meaningSource,
    provenance: filled.provenance,
    ...(filled.derivedFrom ? { derivedFrom: filled.derivedFrom } : {}),
    ...(filled.substituteKind ? { substituteKind: filled.substituteKind } : {}),
    ...(filled.sourceReading ? { sourceReading: filled.sourceReading } : {}),
    ...(filled.sourceMeaning ? { sourceMeaning: filled.sourceMeaning } : {}),
    ...(filled.sourceMeaningLanguage ? { sourceMeaningLanguage: filled.sourceMeaningLanguage } : {}),
    ...(filled.sourceMeaningDerivedFrom ? { sourceMeaningDerivedFrom: filled.sourceMeaningDerivedFrom } : {})
  };
}

/** 지역 → 자국 표기 경유의 옛 표면. 테스트·스크립트 호환용으로 남긴다. */
export function learningInfo(region: RegionCode, char: string): LearningInfo {
  return learningInfoForNotation(defaultNotationForRegion(region), char);
}

export const LEARNING_DATA_META = {
  version: data.version,
  source: data.source,
  catalogCharacters: data.catalogCharacters,
  coveredCharacters: data.coveredCharacters,
  koreanHuneumCharacters: data.koreanHuneumCharacters
} as const;
