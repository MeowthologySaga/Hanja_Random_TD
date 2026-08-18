import type { HanziCatalog, IdiomBonusKind, RegionCode, Tower } from "./types";
import { BOARD_CELLS, CELLS_PER_FORMATION, FORMATION_COLUMNS } from "./content";
import { CHEONJAMUN_PHRASES } from "../data/cheonjamun-phrases";
import { SeededRng } from "./rng";

export interface IdiomDefinition {
  id: string;
  chars: string;
  name: string;
  reading: string;
  meaning: string;
  color: string;
  source: "common" | "cheonjamun";
  sourceOrder: number | null;
  bonus: {
    kind: IdiomBonusKind;
    value: number;
    label: string;
  };
}

const COMMON_IDIOMS: Record<RegionCode, readonly IdiomDefinition[]> = {
  KR: [
    createIdiom("heart", "以心傳心", "이심전심", "말하지 않아도 서로 마음이 통함", "#8fe4ff", "range", 28, "모든 자령 사거리 +28"),
    createIdiom("sure-hit", "百發百中", "백발백중", "쏘는 것마다 모두 명중함", "#ffd56a", "damage", 0.12, "모든 자령 피해 +12%"),
    createIdiom("learn-new", "溫故知新", "온고지신", "옛것을 익혀 새것을 깨달음", "#a8ef9a", "evolutionGold", 4, "합성할 때마다 엽전 +4"),
    createIdiom("speechless", "有口無言", "유구무언", "입은 있어도 할 말이 없음", "#d7a4ff", "enemySlow", 0.1, "모든 적 이동 속도 -10%")
  ],
  JP: [
    createIdiom("heart", "以心伝心", "이심전심", "말하지 않아도 서로 마음이 통함", "#8fe4ff", "range", 28, "모든 자령 사거리 +28"),
    createIdiom("sure-hit", "百発百中", "백발백중", "쏘는 것마다 모두 명중함", "#ffd56a", "damage", 0.12, "모든 자령 피해 +12%"),
    createIdiom("learn-new", "温故知新", "온고지신", "옛것을 익혀 새것을 깨달음", "#a8ef9a", "evolutionGold", 4, "합성할 때마다 엽전 +4"),
    createIdiom("speechless", "有口無言", "유구무언", "입은 있어도 할 말이 없음", "#d7a4ff", "enemySlow", 0.1, "모든 적 이동 속도 -10%")
  ],
  CN: [
    createIdiom("heart", "以心传心", "이심전심", "말하지 않아도 서로 마음이 통함", "#8fe4ff", "range", 28, "모든 자령 사거리 +28"),
    createIdiom("sure-hit", "百发百中", "백발백중", "쏘는 것마다 모두 명중함", "#ffd56a", "damage", 0.12, "모든 자령 피해 +12%"),
    createIdiom("learn-new", "温故知新", "온고지신", "옛것을 익혀 새것을 깨달음", "#a8ef9a", "evolutionGold", 4, "합성할 때마다 엽전 +4"),
    createIdiom("speechless", "有口无言", "유구무언", "입은 있어도 할 말이 없음", "#d7a4ff", "enemySlow", 0.1, "모든 적 이동 속도 -10%")
  ]
};

const CHEONJAMUN_EFFECTS: ReadonlyArray<{ kind: IdiomBonusKind; value: number; label: string; color: string }> = [
  { kind: "damage", value: 0.12, label: "모든 자령 피해 +12%", color: "#ffb06b" },
  { kind: "range", value: 12, label: "모든 자령 사거리 +12", color: "#74dcff" },
  { kind: "enemySlow", value: 0.08, label: "모든 적 이동 속도 -8%", color: "#bca1ff" },
  { kind: "evolutionGold", value: 4, label: "합성할 때마다 엽전 +4", color: "#9de58c" }
];

const CHEONJAMUN_IDIOMS: readonly IdiomDefinition[] = CHEONJAMUN_PHRASES.map((phrase, index) => {
  const effect = CHEONJAMUN_EFFECTS[index % CHEONJAMUN_EFFECTS.length] as (typeof CHEONJAMUN_EFFECTS)[number];
  return createIdiom(
    `cheonjamun-${String(index + 1).padStart(3, "0")}`,
    phrase.chars,
    phrase.reading,
    phrase.meaning,
    effect.color,
    effect.kind,
    effect.value,
    effect.label,
    "cheonjamun",
    index + 1
  );
});

const IDIOMS: Record<RegionCode, readonly IdiomDefinition[]> = {
  KR: [...COMMON_IDIOMS.KR, ...CHEONJAMUN_IDIOMS],
  JP: COMMON_IDIOMS.JP,
  CN: COMMON_IDIOMS.CN
};

function createIdiom(
  id: string,
  chars: string,
  reading: string,
  meaning: string,
  color: string,
  kind: IdiomBonusKind,
  value: number,
  label: string,
  source: IdiomDefinition["source"] = "common",
  sourceOrder: number | null = null
): IdiomDefinition {
  return { id, chars, name: chars, reading, meaning, color, source, sourceOrder, bonus: { kind, value, label } };
}

export function idiomsForRegion(region: RegionCode): readonly IdiomDefinition[] {
  return IDIOMS[region];
}

export function idiomById(region: RegionCode, id: string): IdiomDefinition | undefined {
  return IDIOMS[region].find((idiom) => idiom.id === id);
}

export function featuredIdiomsForRun(region: RegionCode, seed: string, count = 5): readonly IdiomDefinition[] {
  const all = idiomsForRegion(region);
  if (all.length <= count) return all;
  const rng = new SeededRng(`${seed}:featured-idioms`);
  const pinned = region === "KR" ? all.find((idiom) => idiom.id === "heart") : undefined;
  const picked: IdiomDefinition[] = pinned ? [pinned] : [];
  for (const kind of ["damage", "range", "enemySlow", "evolutionGold"] as const) {
    if (picked.some((idiom) => idiom.bonus.kind === kind)) continue;
    const group = all.filter((idiom) => idiom.bonus.kind === kind && !picked.includes(idiom));
    if (group.length > 0 && picked.length < count) picked.push(rng.pick(group));
  }
  const remaining = all.filter((idiom) => !picked.includes(idiom));
  while (picked.length < count && remaining.length > 0) {
    const index = rng.int(0, remaining.length - 1);
    picked.push(remaining.splice(index, 1)[0] as IdiomDefinition);
  }
  return picked;
}

function neighboringCells(first: number, second: number): boolean {
  const firstFormation = Math.floor(first / CELLS_PER_FORMATION);
  const secondFormation = Math.floor(second / CELLS_PER_FORMATION);
  if (firstFormation !== secondFormation) return false;
  const firstLocal = first % CELLS_PER_FORMATION;
  const secondLocal = second % CELLS_PER_FORMATION;
  const rowDistance = Math.abs(Math.floor(firstLocal / FORMATION_COLUMNS) - Math.floor(secondLocal / FORMATION_COLUMNS));
  const columnDistance = Math.abs(firstLocal % FORMATION_COLUMNS - secondLocal % FORMATION_COLUMNS);
  return rowDistance <= 1 && columnDistance <= 1 && rowDistance + columnDistance > 0;
}

export function validateIdiomCells(cells: readonly number[]): string | null {
  if (cells.length !== 4) return "서로 이웃한 한자 4자를 이어 주세요.";
  if (new Set(cells).size !== cells.length) return "같은 칸은 한 번만 지날 수 있습니다.";
  for (const cell of cells) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= BOARD_CELLS.length) return "진법 밖의 칸은 이을 수 없습니다.";
  }
  for (let index = 1; index < cells.length; index += 1) {
    const previous = cells[index - 1] as number;
    const current = cells[index] as number;
    if (!neighboringCells(previous, current)) {
      return "가로·세로·대각선으로 맞닿은 칸만 이을 수 있습니다.";
    }
  }
  return null;
}

export function findIdiomPath(
  towers: readonly Tower[],
  idiom: IdiomDefinition
): number[] | null {
  const characters = [...idiom.chars];
  const candidates = [...towers]
    .filter((tower) => tower.cell >= 0 && tower.cell < BOARD_CELLS.length)
    .sort((left, right) => left.cell - right.cell);

  const search = (characterIndex: number, path: number[]): number[] | null => {
    if (characterIndex >= characters.length) return path;
    const expected = characters[characterIndex];
    const previous = path[path.length - 1];
    for (const tower of candidates) {
      if (tower.char !== expected || path.includes(tower.cell)) continue;
      if (previous !== undefined && !neighboringCells(previous, tower.cell)) continue;
      const result = search(characterIndex + 1, [...path, tower.cell]);
      if (result) return result;
    }
    return null;
  };

  return search(0, []);
}

export function helpfulDirectCharsForIdiom(catalog: HanziCatalog, towers: readonly Tower[], idiom: IdiomDefinition): Set<string> {
  const owned = new Map<string, number>();
  for (const tower of towers) owned.set(tower.char, (owned.get(tower.char) ?? 0) + 1);
  const needed = new Map<string, number>();

  const collect = (char: string): void => {
    const ownedCount = owned.get(char) ?? 0;
    if (ownedCount > 0) {
      owned.set(char, ownedCount - 1);
      return;
    }
    const definition = catalog.definitions.get(char);
    if (!definition || definition.acquisition === "direct" || definition.parents.length === 0) {
      needed.set(char, (needed.get(char) ?? 0) + 1);
      return;
    }
    for (const parent of definition.parents) collect(parent);
  };

  for (const char of idiom.chars) collect(char);
  return new Set([...needed].filter(([char, count]) => (owned.get(char) ?? 0) < count).map(([char]) => char));
}

export function idiomDirectPoolChars(catalog: HanziCatalog, idioms: readonly IdiomDefinition[] = idiomsForRegion(catalog.region)): Set<string> {
  const direct = new Set<string>();
  const collect = (char: string): void => {
    const definition = catalog.definitions.get(char);
    if (!definition) return;
    if (definition.acquisition === "direct") {
      direct.add(char);
      return;
    }
    for (const parent of definition.parents) collect(parent);
  };
  for (const idiom of idioms) for (const char of idiom.chars) collect(char);
  return direct;
}
