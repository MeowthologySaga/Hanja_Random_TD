import runtimeData from "../data/cheonjamun-runtime-jaryeongs.json";
import type { Wuxing } from "./types";

export interface CheonjamunRuntimeJaryeongEntry {
  id: string;
  hanja: string;
  huneum: string;
  meaning: string;
  wuxing: Wuxing;
  sequence: number;
  assetPath: string;
  frameLayout: "single";
  sourceKind: string;
  structureGate: string;
  qc: string;
  integrationStatus: "playable-preview";
}

interface CheonjamunRuntimeData {
  schema: "cheonjamun-runtime-jaryeongs-v1";
  scope: "KR_1000";
  total: 1000;
  approved: 0;
  integrationPolicy: "playable-preview-with-source-qc-preserved";
  entries: CheonjamunRuntimeJaryeongEntry[];
}

const data = runtimeData as unknown as CheonjamunRuntimeData;

if (
  data.schema !== "cheonjamun-runtime-jaryeongs-v1"
  || data.scope !== "KR_1000"
  || data.total !== 1000
  || data.approved !== 0
  || data.entries.length !== data.total
  || new Set(data.entries.map((entry) => entry.id)).size !== data.total
  || new Set(data.entries.map((entry) => entry.hanja)).size !== data.total
) {
  throw new Error("Invalid Cheonjamun runtime Jaryeong data.");
}

export const CHEONJAMUN_RUNTIME_JARYEONGS: readonly CheonjamunRuntimeJaryeongEntry[] = Object.freeze(
  data.entries.map((entry) => Object.freeze({ ...entry })),
);

export const CHEONJAMUN_RUNTIME_JARYEONG_CHARS = new Set(
  CHEONJAMUN_RUNTIME_JARYEONGS.map((entry) => entry.hanja),
);

export const CHEONJAMUN_RUNTIME_WUXING_BY_CHAR = new Map(
  CHEONJAMUN_RUNTIME_JARYEONGS.map((entry) => [entry.hanja, entry.wuxing] as const),
);

export const CHEONJAMUN_RUNTIME_META = Object.freeze({
  schema: data.schema,
  scope: data.scope,
  total: data.total,
  approved: data.approved,
  integrationPolicy: data.integrationPolicy,
});
