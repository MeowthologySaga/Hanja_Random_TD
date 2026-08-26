import learningData from "../data/learning-readings.json";
import koreanHuneumOverrides from "../data/korean-huneum-overrides.json";
import { defaultNotationForRegion } from "./notation";
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

/**
 * 표기 축 스위치 — 읽기 라벨 렌더 경로의 단일 관문. (gripe #6)
 *
 * region 이 아니라 notation 으로 갈린다. 뜻(훈)은 학습 언어가 한국어라
 * 표기와 무관하게 한국어 우선 그대로다. 교차 조합에서 표기가 그 글자를
 * 커버하지 못하는 구멍은 여기가 아니라 crossNotationReading(core/notation.ts)
 * 폴백이 맡는다 — 통합 표기 테이블 도착 전에는 기본값(자국 표기)만 들어와
 * 기존 learningInfo 와 출력이 글자 하나까지 같다.
 */
export function learningInfoForNotation(notation: NotationCode, char: string): LearningInfo {
  const entry = data.chars[char];
  const curated = KOREAN_GLOSSES[char] ?? entry?.kh;
  const koreanMeaning = curated?.split(" ").slice(0, -1).join(" ") ?? "";
  if (notation === "kr-hunum") {
    const reading = firstKoreanReading(char, entry);
    return {
      short: reading,
      readingLabel: "훈음",
      reading,
      meaning: koreanMeaning || entry?.d || "뜻 정보 미수록",
      meaningSource: koreanMeaning ? "ko" : entry?.d ? "en" : "none"
    };
  }
  if (notation === "jp-onkun") {
    const on = compact(entry?.jo, 3);
    const kun = compact(entry?.jk, 3);
    const reading = [on ? `음독 ${on}` : "", kun ? `훈독 ${kun}` : ""].filter(Boolean).join(" · ") || "읽기 미수록";
    return {
      short: on || kun || "읽기 미수록",
      readingLabel: "음독·훈독",
      reading,
      meaning: koreanMeaning || entry?.d || "뜻 정보 미수록",
      meaningSource: koreanMeaning ? "ko" : entry?.d ? "en" : "none"
    };
  }
  const mandarin = compact(entry?.m, 2);
  return {
    short: mandarin || "병음 미수록",
    readingLabel: "병음",
    reading: mandarin || "병음 미수록",
    meaning: koreanMeaning || entry?.d || "뜻 정보 미수록",
    meaningSource: koreanMeaning ? "ko" : entry?.d ? "en" : "none"
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
