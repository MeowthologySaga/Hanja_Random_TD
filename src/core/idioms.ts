import type { GameMode, HanziCatalog, IdiomBonusKind, RegionCode, Tower } from "./types";
import { BOARD_CELLS, CELLS_PER_FORMATION, FORMATION_COLUMNS, FORMATION_ROWS } from "./content";
import { CHEONJAMUN_PHRASES } from "../data/cheonjamun-phrases";
import { idiomEffectFor } from "./idiom-effects";
import { SeededRng } from "./rng";

/**
 * 순번 인장 글리프 ①②③④.
 *
 * 전장 명패에 얹히는 인장(`assets/ui/.../idiom-order-seal-N-v1.webp`), 성어 탭의
 * 규칙 도식, 도감 상세의 번호가 모두 이 순번을 말한다. 설명 문구도 같은 글자로
 * 가리켜야 "화면의 그것"과 이어진다 — 1~4 로 바꿔 쓰면 연결이 끊긴다.
 */
export const IDIOM_ORDER_SEALS = ["①", "②", "③", "④"] as const;

export interface IdiomDefinition {
  id: string;
  chars: string;
  name: string;
  reading: string;
  meaning: string;
  color: string;
  source: "common" | "cheonjamun" | "custom";
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

/*
 * 천자문 구의 힘은 **뜻에서** 나온다.
 *
 * 여태는 `index % 4` 로 피해·사거리·감속·엽전을 돌려 붙였다. 그래서 「가을에
 * 거두고 겨울에 저장한다」에 사거리가 붙고 「이슬이 맺혀 서리가 된다」에 엽전이
 * 붙었다. 성어를 외우게 하려는 게임에서 뜻과 힘이 따로 노는 것은 가르치는 값을
 * 통째로 버리는 짓이라, 규칙을 idiom-effects.ts 로 옮겼다.
 */
const CHEONJAMUN_IDIOMS: readonly IdiomDefinition[] = CHEONJAMUN_PHRASES.map((phrase, index) => {
  const effect = idiomEffectFor(phrase.meaning, phrase.chars);
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

/**
 * 이 판의 성어 명단 — 시드로 섞은 순서.
 *
 * count 를 넘기지 않으면 예전처럼 다섯 구만 고른다(시험·도구용). 엔진은
 * Infinity 를 넘겨 **전부** 받는다 — 성어 발동에는 상한이 없다. 그래도 이
 * 함수가 남는 이유는 **순서** 때문이다: 첫 구가 그 판의 첫 목표가 되므로
 * 순서가 시드로 고정돼야 같은 시드가 같은 판을 만든다.
 */
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

/** 성어 한 구가 차지하는 직선의 길이. 진이 4×4 라서 네 글자가 딱 한 줄이다. */
const IDIOM_LINE_LENGTH = 4;

/**
 * 진 하나(4×4) 안의 직선 10개 — 가로 4줄·세로 4줄·대각 2줄. 진 안 로컬 번호다.
 * 성어는 이 줄 위에 순서대로 놓일 때만 발동한다(꺾인 사슬은 인정하지 않는다).
 */
const FORMATION_LINES: readonly (readonly number[])[] = buildFormationLines();

function buildFormationLines(): readonly (readonly number[])[] {
  const lines: number[][] = [];
  for (let row = 0; row < FORMATION_ROWS; row += 1) {
    lines.push(Array.from({ length: FORMATION_COLUMNS }, (_, column) => row * FORMATION_COLUMNS + column));
  }
  for (let column = 0; column < FORMATION_COLUMNS; column += 1) {
    lines.push(Array.from({ length: FORMATION_ROWS }, (_, row) => row * FORMATION_COLUMNS + column));
  }
  if (FORMATION_ROWS === FORMATION_COLUMNS) {
    lines.push(Array.from({ length: FORMATION_ROWS }, (_, step) => step * FORMATION_COLUMNS + step));
    lines.push(Array.from({ length: FORMATION_ROWS }, (_, step) => step * FORMATION_COLUMNS + (FORMATION_COLUMNS - 1 - step)));
  }
  return lines.filter((line) => line.length === IDIOM_LINE_LENGTH);
}

/**
 * 판 전체의 "읽는 방향" 목록. 진마다 10줄 × 정·역 2방향 = 20개, 진 5개면 100개다.
 * 역방향까지 넣어 두었으므로 이 목록을 앞에서부터 맞춰 보기만 하면 역순 배치가
 * 저절로 인정되고, 맞은 배열은 언제나 글자 순서(첫 칸이 1번 글자)로 나온다.
 */
const IDIOM_LINE_SEQUENCES: readonly (readonly number[])[] = buildIdiomLineSequences();

function buildIdiomLineSequences(): readonly (readonly number[])[] {
  const sequences: number[][] = [];
  const formationCount = Math.floor(BOARD_CELLS.length / CELLS_PER_FORMATION);
  for (let formation = 0; formation < formationCount; formation += 1) {
    for (const line of FORMATION_LINES) {
      const cells = line.map((local) => formation * CELLS_PER_FORMATION + local);
      sequences.push(cells);
      sequences.push([...cells].reverse());
    }
  }
  return sequences;
}

export function validateIdiomCells(cells: readonly number[]): string | null {
  if (cells.length !== IDIOM_LINE_LENGTH) return "한 줄에 놓인 한자 4자를 이어 주세요.";
  if (new Set(cells).size !== cells.length) return "같은 칸은 한 번만 지날 수 있습니다.";
  for (const cell of cells) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= BOARD_CELLS.length) return "진법 밖의 칸은 이을 수 없습니다.";
  }
  const straight = IDIOM_LINE_SEQUENCES.some((sequence) => sequence.every((cell, index) => cell === cells[index]));
  if (!straight) return "같은 진의 가로·세로·대각선 한 줄에 순서대로 놓아야 합니다.";
  return null;
}

/** 칸 번호 → 그 칸에 선 자령의 글자. 진 밖의 자령(인벤토리 등)은 빼 둔다. */
function charactersByCell(towers: readonly Tower[]): Map<number, string> {
  const byCell = new Map<number, string>();
  for (const tower of towers) {
    if (tower.cell < 0 || tower.cell >= BOARD_CELLS.length) continue;
    byCell.set(tower.cell, tower.char);
  }
  return byCell;
}

/**
 * 네 글자가 한 직선 위에 순서대로 선 자리를 찾는다. 가로·세로·대각선 어느
 * 줄이든 좋고, 역방향(4→1)으로 놓아도 인정한다. 돌려주는 셀 배열은 언제나
 * 글자 순서 기준이라 cells[0] 이 1번 글자의 칸이다.
 */
export function findIdiomPath(
  towers: readonly Tower[],
  idiom: IdiomDefinition
): number[] | null {
  const characters = [...idiom.chars];
  if (characters.length !== IDIOM_LINE_LENGTH) return null;
  const byCell = charactersByCell(towers);
  for (const sequence of IDIOM_LINE_SEQUENCES) {
    if (characters.every((char, index) => byCell.get(sequence[index] as number) === char)) return [...sequence];
  }
  return null;
}

export interface PartialIdiomChain {
  /** 줄 위에 이미 선 칸 — 언제나 글자 순서라 cells[0] 이 1번 글자다. */
  readonly cells: readonly number[];
  /** 줄 앞에서부터 이어진 글자 수. 0 이면 이을 수 있는 줄이 아직 없다. */
  readonly length: number;
  /** cells[0] 의 순번(1부터). 직선 규칙에서는 언제나 1이고, 비면 0. */
  readonly startOrder: number;
  /** 예전 꺾인 사슬 시절의 역순 표시. 직선 규칙에서는 언제나 false. */
  readonly reversed: boolean;
  /** 다음에 놓아야 할 글자. 줄이 완성됐으면 null. */
  readonly nextChar: string | null;
  /** 다음 글자의 순번(1부터). 표시용. */
  readonly nextOrder: number | null;
  /** 다음 글자를 이어야 하는 기준 칸(줄에서 마지막으로 채워진 칸). 비면 null. */
  readonly anchorCell: number | null;
  /** 다음 글자를 놓을 빈 칸 — 같은 줄의 바로 다음 자리들. 동률이면 모두 담는다. */
  readonly nextCells: readonly number[];
  readonly complete: boolean;
}

const EMPTY_CHAIN: PartialIdiomChain = {
  cells: [],
  length: 0,
  startOrder: 0,
  reversed: false,
  nextChar: null,
  nextOrder: null,
  anchorCell: null,
  nextCells: [],
  complete: false
};

/**
 * 다음 글자를 어디에 놓아야 하는지 알려 주는 부분 줄. 배치 안내가 쓴다.
 *
 * 판의 방향 100개를 훑어 "0번 자리부터 k−1번 자리까지 올바른 글자가 서 있고
 * k번 자리는 비어 있는" 최장 k 를 찾는다. 다음 자리가 다른 자령에 막힌 줄은
 * 그 줄로 성어를 끝낼 수 없으므로 후보에서 뺀다. 같은 k 를 가진 줄이 여럿이면
 * 빈 칸을 모두 모아 안내한다(가로로도 세로로도 이을 수 있는 상황).
 */
export function partialIdiomChain(towers: readonly Tower[], idiom: IdiomDefinition): PartialIdiomChain {
  const characters = [...idiom.chars];
  if (characters.length !== IDIOM_LINE_LENGTH) return EMPTY_CHAIN;
  const byCell = charactersByCell(towers);

  let bestLength = 0;
  let bestCells: number[] = [];
  const nextCells: number[] = [];
  for (const sequence of IDIOM_LINE_SEQUENCES) {
    let matched = 0;
    while (matched < characters.length && byCell.get(sequence[matched] as number) === characters[matched]) matched += 1;
    if (matched === characters.length) {
      const cells = [...sequence];
      return {
        cells,
        length: matched,
        startOrder: 1,
        reversed: false,
        nextChar: null,
        nextOrder: null,
        anchorCell: cells[matched - 1] as number,
        nextCells: [],
        complete: true
      };
    }
    if (matched === 0) continue;
    const nextCell = sequence[matched] as number;
    if (byCell.has(nextCell)) continue;
    if (matched > bestLength) {
      bestLength = matched;
      bestCells = sequence.slice(0, matched);
      nextCells.length = 0;
    }
    // 동률이라도 1번 글자 칸이 다르면 시각적으로 무관한 딴 사슬이다
    // (다른 진 등) — 점선이 그리로 새면 안내가 흩어진다. 같은 앵커에서
    // 여러 방향으로 자라는 갈림길(가로/세로/대각)은 시작 칸이 같아 통과.
    if (
      matched === bestLength
      && sequence[0] === bestCells[0]
      && !nextCells.includes(nextCell)
    ) nextCells.push(nextCell);
  }
  if (bestLength === 0) return EMPTY_CHAIN;
  return {
    cells: bestCells,
    length: bestLength,
    startOrder: 1,
    reversed: false,
    nextChar: characters[bestLength] as string,
    nextOrder: bestLength + 1,
    anchorCell: bestCells[bestLength - 1] as number,
    nextCells,
    complete: false
  };
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

/**
 * 성어 기원 소환의 후보 글자 — "추적 성어들"의 부족 글자 합집합.
 *
 * [병합 지점] 목표 체계 개편(성어=목표, 복수 추적 3)과 만나는 자리다.
 * 부족 글자 집합 계산은 이 함수 하나에만 있으므로, 개편 트랙과 병합할 때는
 * 호출부(`GameEngine.idiomWishTargets`)가 넘기는 `idioms` 배열을 복수 추적으로
 * 바꾸기만 하면 된다 — 이 함수·상점 카드·소환 본체는 손대지 않는다.
 *
 * 부족 판정은 기존 추적 경로와 같은 문법을 그대로 쓴다(R18 유지형 성어).
 *  - 캐주얼: `idiomProgress` 와 같은 1:1 대응 — 보유 자령을 글자당 하나씩
 *    소비하고 남는 요구 글자가 "부족"이다(같은 글자 2회 요구도 올바로 센다).
 *  - 자형연성: `helpfulDirectCharsForIdiom` — 부족 글자를 합성으로 만들 때
 *    아직 더 필요한 "직접 소환" 재료만 부른다. 합성 전용 글자를 뽑기로
 *    우회시키지 않아야 기존 합성 루프와 전투력 곡선이 그대로 남는다.
 *    (상품 자체는 실측 승률 누출로 별승급 전용이 됐지만, 이 갈래는 목표
 *    개편 트랙이 자형연성 성어 경로를 다시 열 때를 위해 계약으로 남긴다.)
 */
export function idiomWishChars(
  catalog: HanziCatalog,
  towers: readonly Tower[],
  idioms: readonly IdiomDefinition[],
  mode: GameMode
): Set<string> {
  const union = new Set<string>();
  for (const idiom of idioms) {
    if (mode === "casual") {
      const counts = new Map<string, number>();
      for (const tower of towers) counts.set(tower.char, (counts.get(tower.char) ?? 0) + 1);
      for (const char of idiom.chars) {
        const owned = counts.get(char) ?? 0;
        if (owned > 0) counts.set(char, owned - 1);
        else union.add(char);
      }
    } else {
      for (const char of helpfulDirectCharsForIdiom(catalog, towers, idiom)) union.add(char);
    }
  }
  return union;
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
