import radicalData from "../data/hanzi-radicals.json";

interface RadicalData {
  version: string;
  source: string;
  sha256: string;
  catalogCharacters: number;
  coveredCharacters: number;
  chars: Record<string, number>;
}

const data = radicalData as RadicalData;

export const RADICAL_DATA_META = Object.freeze({
  version: data.version,
  source: data.source,
  sha256: data.sha256,
  catalogCharacters: data.catalogCharacters,
  coveredCharacters: data.coveredCharacters
});

export function radicalNumber(char: string): number | null {
  return data.chars[char] ?? null;
}

export function radicalGlyph(char: string): string {
  const number = radicalNumber(char);
  return number ? String.fromCodePoint(0x2f00 + number - 1) : "—";
}

export function radicalLearningLabel(char: string): string {
  const number = radicalNumber(char);
  return number ? `부수 ${radicalGlyph(char)} · 강희자전 ${number}번` : "부수 미수록";
}
