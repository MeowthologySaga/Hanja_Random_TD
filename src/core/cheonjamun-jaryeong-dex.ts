import dexData from "../data/cheonjamun-jaryeong-dex-v1.json";
import type { Wuxing } from "./types";

export interface CheonjamunJaryeongDexEntry {
  id: string;
  number: number;
  hanja: string;
  huneum: string;
  meaning: string;
  wuxing: Wuxing;
  elementName: string;
  category: string;
  imagePath: string;
  dexText: string;
  habitat: string;
  temperament: string;
  observation: string;
  traitName: string;
  traitDescription: string;
  appearance: string;
}

interface CheonjamunJaryeongDexData {
  schema: "cheonjamun-jaryeong-dex-v1";
  edition: string;
  total: number;
  elementCounts: Record<Wuxing, number>;
  entries: CheonjamunJaryeongDexEntry[];
}

const data = dexData as unknown as CheonjamunJaryeongDexData;

if (
  data.schema !== "cheonjamun-jaryeong-dex-v1"
  || data.total !== 1000
  || data.entries.length !== data.total
  || new Set(data.entries.map((entry) => entry.id)).size !== data.total
  || new Set(data.entries.map((entry) => entry.hanja)).size !== data.total
) {
  throw new Error("Invalid Cheonjamun Jaryeong dex data.");
}

export const CHEONJAMUN_JARYEONG_DEX_ENTRIES: readonly CheonjamunJaryeongDexEntry[] = Object.freeze(
  data.entries.map((entry) => Object.freeze({ ...entry })),
);

export const CHEONJAMUN_JARYEONG_DEX_BY_ID = new Map(
  CHEONJAMUN_JARYEONG_DEX_ENTRIES.map((entry) => [entry.id, entry] as const),
);

export const CHEONJAMUN_JARYEONG_DEX_META = Object.freeze({
  schema: data.schema,
  edition: data.edition,
  total: data.total,
  elementCounts: Object.freeze({ ...data.elementCounts }),
});
