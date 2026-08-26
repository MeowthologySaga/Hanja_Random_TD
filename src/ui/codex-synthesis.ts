import type { HanziDefinition } from "../core/types";

export const UNCOMBINABLE_STAGE_ONE = "stage1-uncombinable" as const;
export type SynthesisTierFilter = number | "all" | typeof UNCOMBINABLE_STAGE_ONE;
export const UNCOMBINABLE_STAGE_ONE_COLOR = "#63e6b5";

function clampTier(value: number): number {
  return Math.max(1, Math.min(5, Math.floor(value)));
}

export function buildSynthesisDepths(definitions: Iterable<HanziDefinition>): Map<string, number> {
  const byChar = new Map<string, HanziDefinition>();
  for (const definition of definitions) byChar.set(definition.char, definition);

  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (char: string): number => {
    const cached = depths.get(char);
    if (cached !== undefined) return cached;
    const definition = byChar.get(char);
    if (!definition || definition.acquisition === "direct" || definition.parents.length === 0) {
      depths.set(char, 1);
      return 1;
    }
    if (visiting.has(char)) return clampTier(definition.stage);
    visiting.add(char);
    const parentDepth = Math.max(1, ...definition.parents.map(visit));
    visiting.delete(char);
    const depth = clampTier(parentDepth + 1);
    depths.set(char, depth);
    return depth;
  };

  for (const char of byChar.keys()) visit(char);
  return depths;
}

export function synthesisDepthLabel(depth: number): string {
  return "★".repeat(clampTier(depth));
}

export function buildUncombinableStageOneChars(definitions: Iterable<HanziDefinition>): Set<string> {
  const entries = [...definitions];
  const usedAsMaterial = new Set(entries.flatMap((definition) => definition.parents));
  return new Set(entries
    .filter((definition) => definition.acquisition === "direct" && definition.parents.length === 0 && !usedAsMaterial.has(definition.char))
    .map((definition) => definition.char));
}

export function synthesisTierKey(
  definition: HanziDefinition,
  depth: number,
  uncombinableStageOne: ReadonlySet<string>
): number | typeof UNCOMBINABLE_STAGE_ONE {
  return depth === 1 && uncombinableStageOne.has(definition.char) ? UNCOMBINABLE_STAGE_ONE : clampTier(depth);
}

export function synthesisTierFilterLabel(filter: Exclude<SynthesisTierFilter, "all">): string {
  return synthesisDepthLabel(filter === UNCOMBINABLE_STAGE_ONE ? 1 : filter);
}

export function synthesisTierAccessibleLabel(
  filter: Exclude<SynthesisTierFilter, "all">,
  uncombinableStageOne = false
): string {
  if (filter === UNCOMBINABLE_STAGE_ONE || uncombinableStageOne) return "★ · 1단 · 독립 자령";
  return `${synthesisDepthLabel(filter)} · ${filter}단`;
}
