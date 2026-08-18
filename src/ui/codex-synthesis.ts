import type { HanziDefinition } from "../core/types";

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
      depths.set(char, 0);
      return 0;
    }
    if (visiting.has(char)) return Math.max(1, definition.stage - 1);
    visiting.add(char);
    const parentDepth = Math.max(0, ...definition.parents.map(visit));
    visiting.delete(char);
    const depth = parentDepth + 1;
    depths.set(char, depth);
    return depth;
  };

  for (const char of byChar.keys()) visit(char);
  return depths;
}

export function synthesisDepthLabel(depth: number): string {
  return depth <= 0 ? "직접 소환" : `${depth}단 합성`;
}
