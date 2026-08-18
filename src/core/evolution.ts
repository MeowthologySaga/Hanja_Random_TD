import type {
  AutomationMode,
  CompositionBranchPreview,
  CompositionMaterialPreview,
  EvolutionOption,
  GoalProgress,
  HanziCatalog,
  HanziDefinition,
  Tower
} from "./types";

function inventorySignature(towers: readonly Tower[]): string {
  return towers
    .map((tower) => `${tower.id}:${tower.char}:${tower.locked ? "L" : "O"}`)
    .sort()
    .join("|");
}

function countsFor(towers: readonly Tower[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tower of towers) counts.set(tower.char, (counts.get(tower.char) ?? 0) + 1);
  return counts;
}

export class EvolutionService {
  private readonly catalog: HanziCatalog;
  private cachedKey = "";
  private cachedOptions: EvolutionOption[] = [];
  private pathCache = new Map<string, Set<string>>();

  constructor(catalog: HanziCatalog) {
    this.catalog = catalog;
  }

  getAvailableRecipes(
    towers: readonly Tower[],
    targetChar: string,
    selectedTowerId: number | null,
    mode: AutomationMode
  ): EvolutionOption[] {
    const key = `${inventorySignature(towers)}::${targetChar}::${selectedTowerId ?? "-"}::${mode}`;
    if (key === this.cachedKey) return this.cachedOptions.map((option) => ({ ...option, materialTowerIds: [...option.materialTowerIds] }));
    if (mode === "manual" && selectedTowerId === null) {
      this.cachedKey = key;
      this.cachedOptions = [];
      return [];
    }
    const selectedOnly = mode === "manual";
    const targetPath = this.getTargetPath(targetChar);
    const options: EvolutionOption[] = [];
    for (const result of this.catalog.recipes) {
      const materialTowerIds = this.selectMaterials(result.parents, towers, selectedTowerId);
      if (!materialTowerIds) continue;
      if (selectedOnly && selectedTowerId !== null && !materialTowerIds.includes(selectedTowerId)) continue;
      options.push({
        recipeId: result.id,
        result,
        parents: [...result.parents],
        materialTowerIds,
        onTargetPath: targetPath.has(result.char)
      });
    }
    options.sort((a, b) => {
      if (a.onTargetPath !== b.onTargetPath) return a.onTargetPath ? -1 : 1;
      if (a.result.stage !== b.result.stage) return b.result.stage - a.result.stage;
      return a.result.char.localeCompare(b.result.char, "ko");
    });
    this.cachedKey = key;
    this.cachedOptions = options;
    return options.map((option) => ({ ...option, materialTowerIds: [...option.materialTowerIds] }));
  }

  getDerivativeRecipes(
    sourceChar: string,
    towers: readonly Tower[],
    targetChar: string,
    selectedTowerId: number | null
  ): CompositionBranchPreview[] {
    const targetPath = this.getTargetPath(targetChar);
    return this.catalog.recipes
      .filter((result) => result.parents.includes(sourceChar))
      .map((result) => {
        const materials = this.inspectMaterials(result.parents, towers, selectedTowerId);
        const materialTowerIds = materials.flatMap((material) => material.towerId === null ? [] : [material.towerId]);
        return {
          recipeId: result.id,
          result,
          parents: [...result.parents],
          materials,
          materialTowerIds,
          ready: materials.every((material) => material.towerId !== null),
          onTargetPath: targetPath.has(result.char)
        };
      })
      .sort((a, b) => {
        if (a.ready !== b.ready) return a.ready ? -1 : 1;
        if (a.onTargetPath !== b.onTargetPath) return a.onTargetPath ? -1 : 1;
        if (a.result.stage !== b.result.stage) return b.result.stage - a.result.stage;
        return a.result.char.localeCompare(b.result.char, "ko");
      });
  }

  getTargetPath(targetChar: string): Set<string> {
    const cached = this.pathCache.get(targetChar);
    if (cached) return new Set(cached);
    const path = new Set<string>();
    const visit = (char: string, visiting: Set<string>): void => {
      if (visiting.has(char) || path.has(char)) return;
      path.add(char);
      const definition = this.catalog.definitions.get(char);
      if (!definition || definition.acquisition === "direct") return;
      visiting.add(char);
      for (const parent of definition.parents) visit(parent, visiting);
      visiting.delete(char);
    };
    visit(targetChar, new Set());
    this.pathCache.set(targetChar, path);
    return new Set(path);
  }

  getGoalProgress(towers: readonly Tower[], targetChar: string): GoalProgress {
    const target = this.catalog.definitions.get(targetChar);
    if (!target) throw new Error(`Unknown goal character: ${targetChar}`);
    const fullRequirements = new Map<string, number>();
    this.collectDirectMaterials(targetChar, fullRequirements, new Set());
    const availableInventory = countsFor(towers);
    const missing = new Map<string, number>();
    const ownedNodes = new Set<string>();
    const findMissing = (char: string, visiting: Set<string>): void => {
      const owned = availableInventory.get(char) ?? 0;
      if (owned > 0) {
        availableInventory.set(char, owned - 1);
        ownedNodes.add(char);
        return;
      }
      const definition = this.catalog.definitions.get(char);
      if (!definition || definition.acquisition === "direct" || definition.parents.length === 0 || visiting.has(char)) {
        missing.set(char, (missing.get(char) ?? 0) + 1);
        return;
      }
      visiting.add(char);
      for (const parent of definition.parents) findMissing(parent, visiting);
      visiting.delete(char);
    };
    findMissing(targetChar, new Set());
    const directMaterials = [...fullRequirements.entries()].map(([char, needed]) => ({
      char,
      needed,
      owned: Math.max(0, needed - (missing.get(char) ?? 0))
    }));
    const total = directMaterials.reduce((sum, material) => sum + material.needed, 0);
    const owned = directMaterials.reduce((sum, material) => sum + material.owned, 0);
    const craftableNodes = this.getAvailableRecipes(towers, targetChar, null, "semi")
      .filter((option) => option.onTargetPath)
      .map((option) => option.result.char);
    return {
      target,
      directMaterials,
      ownedNodes: [...ownedNodes],
      craftableNodes: [...new Set(craftableNodes)],
      progress: total === 0 ? 1 : owned / total
    };
  }

  getHelpfulDirectCharacters(towers: readonly Tower[], targetChar: string): Set<string> {
    const helpful = new Set<string>();
    const progress = this.getGoalProgress(towers, targetChar);
    for (const material of progress.directMaterials) {
      if (material.owned < material.needed) helpful.add(material.char);
    }
    const counts = countsFor(towers);
    for (const recipe of this.catalog.recipes) {
      let missing = 0;
      const needed = new Map<string, number>();
      for (const parent of recipe.parents) needed.set(parent, (needed.get(parent) ?? 0) + 1);
      for (const [parent, count] of needed) missing += Math.max(0, count - (counts.get(parent) ?? 0));
      if (missing !== 1) continue;
      for (const [parent, count] of needed) {
        if ((counts.get(parent) ?? 0) < count) {
          const definition = this.catalog.definitions.get(parent);
          if (definition?.acquisition === "direct") helpful.add(parent);
        }
      }
    }
    return helpful;
  }

  isOnTargetPath(char: string, targetChar: string): boolean {
    return this.getTargetPath(targetChar).has(char);
  }

  definition(char: string): HanziDefinition | undefined {
    return this.catalog.definitions.get(char);
  }

  private selectMaterials(parents: readonly string[], towers: readonly Tower[], selectedTowerId: number | null): number[] | null {
    const materials = this.inspectMaterials(parents, towers, selectedTowerId);
    if (materials.some((material) => material.towerId === null)) return null;
    return materials.map((material) => material.towerId as number);
  }

  private inspectMaterials(
    parents: readonly string[],
    towers: readonly Tower[],
    selectedTowerId: number | null
  ): CompositionMaterialPreview[] {
    const used = new Set<number>();
    return parents.map((parent) => {
      const candidates = towers
        .filter((candidate) => candidate.char === parent && !candidate.locked && !used.has(candidate.id))
        .sort((a, b) => {
          if (a.id === selectedTowerId) return -1;
          if (b.id === selectedTowerId) return 1;
          const aStored = a.cell < 0;
          const bStored = b.cell < 0;
          if (aStored !== bStored) return aStored ? 1 : -1;
          return a.cell - b.cell || a.id - b.id;
        });
      const tower = candidates[0];
      if (tower) {
        used.add(tower.id);
        return { char: parent, towerId: tower.id, location: tower.cell < 0 ? "inventory" : "board" };
      }
      const locked = towers.some((candidate) => candidate.char === parent && candidate.locked && !used.has(candidate.id));
      return { char: parent, towerId: null, location: locked ? "locked" : "missing" };
    });
  }

  private collectDirectMaterials(char: string, output: Map<string, number>, visiting: Set<string>): void {
    const definition = this.catalog.definitions.get(char);
    if (!definition || definition.acquisition === "direct" || definition.parents.length === 0 || visiting.has(char)) {
      output.set(char, (output.get(char) ?? 0) + 1);
      return;
    }
    visiting.add(char);
    for (const parent of definition.parents) this.collectDirectMaterials(parent, output, visiting);
    visiting.delete(char);
  }
}
