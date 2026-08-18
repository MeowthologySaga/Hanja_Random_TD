import rosterData from "../data/cheonjamun-jaryeongs.json";
import type { Wuxing } from "./types";

export interface CheonjamunJaryeongEntry {
  id: string;
  hanja: string;
  reading: string;
  meaning: string;
  wuxing: Wuxing;
  baselineWuxing: Wuxing | null;
  sequence: number;
  source: "handoff-processed" | "user-approved-raw";
  qc: "pass" | "pass-with-source-edge-warning";
}

export interface SupplementalRuntimeCharacter {
  c: string;
  s: number;
  e: Wuxing;
  a: "D" | "C";
  p: string[];
  r: number;
  reason: string;
}

interface CheonjamunRosterData {
  version: string;
  sourceArchive: string;
  scope: string;
  typePolicy: string;
  supplementalCharacters: SupplementalRuntimeCharacter[];
  entries: CheonjamunJaryeongEntry[];
}

const data = rosterData as CheonjamunRosterData;

export const CHEONJAMUN_JARYEONG_ROSTER: readonly CheonjamunJaryeongEntry[] = Object.freeze(
  data.entries.map((entry) => Object.freeze({ ...entry }))
);

export const CHEONJAMUN_SUPPLEMENTAL_CHARACTERS: readonly SupplementalRuntimeCharacter[] = Object.freeze(
  data.supplementalCharacters.map((entry) => Object.freeze({ ...entry, p: [...entry.p] }))
);

export const CHEONJAMUN_JARYEONG_META = Object.freeze({
  version: data.version,
  sourceArchive: data.sourceArchive,
  scope: data.scope,
  typePolicy: data.typePolicy,
  entries: CHEONJAMUN_JARYEONG_ROSTER.length,
  semanticOverrides: CHEONJAMUN_JARYEONG_ROSTER.filter((entry) => entry.baselineWuxing !== null && entry.baselineWuxing !== entry.wuxing).length,
  supplementalCharacters: CHEONJAMUN_SUPPLEMENTAL_CHARACTERS.length,
  sourceEdgeWarnings: CHEONJAMUN_JARYEONG_ROSTER.filter((entry) => entry.qc === "pass-with-source-edge-warning").length
});

export const CHEONJAMUN_JARYEONG_CHARS = new Set(CHEONJAMUN_JARYEONG_ROSTER.map((entry) => entry.hanja));
export const CHEONJAMUN_WUXING_BY_CHAR = new Map(CHEONJAMUN_JARYEONG_ROSTER.map((entry) => [entry.hanja, entry.wuxing] as const));
