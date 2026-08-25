import easyMeaningData from "../data/korean-easy-meanings.json";

export type KoreanMeaningExplanationSource = "krdict" | "curated" | "regional-fallback";

export interface KoreanMeaningExplanation {
  plainMeaning: string;
  short: string;
  body: string;
  example?: string;
  source: KoreanMeaningExplanationSource;
}

interface EasyMeaningDataEntry {
  hanja: string;
  plainMeaning: string;
  short: string;
  body: string;
  example?: string;
  source: Exclude<KoreanMeaningExplanationSource, "regional-fallback">;
}

interface EasyMeaningData {
  schema: "korean-easy-meanings-v1";
  edition: string;
  total: number;
  unresolved: unknown[];
  entries: EasyMeaningDataEntry[];
}

const data = easyMeaningData as unknown as EasyMeaningData;
const entries = new Map(data.entries.map((entry) => [entry.hanja, Object.freeze({
  plainMeaning: entry.plainMeaning,
  short: entry.short,
  body: entry.body,
  ...(entry.example ? { example: entry.example } : {}),
  source: entry.source
})] as const));

if (
  data.schema !== "korean-easy-meanings-v1"
  || data.total !== 1001
  || data.entries.length !== data.total
  || entries.size !== data.total
  || data.unresolved.length !== 0
) {
  throw new Error("Invalid Korean easy-meaning data.");
}

export const KOREAN_EASY_MEANING_META = Object.freeze({
  schema: data.schema,
  edition: data.edition,
  total: data.total,
  unresolved: data.unresolved.length
});

export function hasDedicatedKoreanMeaningExplanation(char: string): boolean {
  return entries.has(char);
}

export function koreanMeaningExplanation(char: string, huneum: string, meaning: string): KoreanMeaningExplanation {
  const dedicated = entries.get(char);
  if (dedicated) return dedicated;

  const normalizedMeaning = meaning.trim() || huneum.trim() || "뜻 정보 미수록";
  return {
    plainMeaning: normalizedMeaning,
    short: normalizedMeaning,
    body: normalizedMeaning,
    source: "regional-fallback"
  };
}
