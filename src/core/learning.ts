import learningData from "../data/learning-readings.json";
import koreanHuneumOverrides from "../data/korean-huneum-overrides.json";
import type { RegionCode } from "./types";

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

export function learningInfo(region: RegionCode, char: string): LearningInfo {
  const entry = data.chars[char];
  const curated = KOREAN_GLOSSES[char] ?? entry?.kh;
  const koreanMeaning = curated?.split(" ").slice(0, -1).join(" ") ?? "";
  if (region === "KR") {
    const reading = firstKoreanReading(char, entry);
    return {
      short: reading,
      readingLabel: "훈음",
      reading,
      meaning: koreanMeaning || entry?.d || "뜻 정보 미수록",
      meaningSource: koreanMeaning ? "ko" : entry?.d ? "en" : "none"
    };
  }
  if (region === "JP") {
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

export const LEARNING_DATA_META = {
  version: data.version,
  source: data.source,
  catalogCharacters: data.catalogCharacters,
  coveredCharacters: data.coveredCharacters,
  koreanHuneumCharacters: data.koreanHuneumCharacters
} as const;
