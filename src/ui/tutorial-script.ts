/*
 * 수련장 각본 — 엔진만 아는 순수 도우미.
 *
 * tutorial.ts(화면·잠금·말풍선)가 부르는 계산 조각을 모아 둔다. DOM 을 전혀
 * 만지지 않으므로 단독으로 검증할 수 있고, 화면 쪽이 갈려도 각본 규칙은
 * 여기 한 곳에 남는다. 모든 함수는 tutorial 옵션이 켜진 GameEngine 을 받는다.
 */
import { casualNaturalStar } from "../core/casual";
import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  FORMATION_COLUMNS,
  FORMATION_ROWS
} from "../core/content";
import { type GameEngine } from "../core/game";
import { WUXING_ORDER } from "../core/hanzi";
import { type Tower, type Wuxing } from "../core/types";

/** 수련장 고정 시드. 첫 소환·첫 진·지급 결과가 모든 사용자에게 같아진다. */
export const TUTORIAL_SEED = "TUTORIAL";

/** 7단계에서 확정 체험시키는 성어. KR 추천 성어에 항상 고정 포함된다(이심전심). */
export const TUTORIAL_IDIOM_ID = "heart";

/** 시작 진(첫 소환이 무료 개방한 진)의 오행. 아직 없으면 木. */
export function startingWuxing(engine: GameEngine): Wuxing {
  const index = engine.state.startingFormationIndex;
  if (index !== null) return BOARD_FORMATIONS[index]?.preferredWuxing ?? "木";
  return engine.state.towers[0]?.wuxing ?? "木";
}

/**
 * 각본 지급에서 피해야 하는 글자 — 목표 한자와 추적 중 성어의 네 글자.
 * 이 글자들은 3합 소모 보호에 걸려 "지급했는데 승급이 안 되는" 함정이 된다.
 */
function grantProtectedChars(engine: GameEngine): Set<string> {
  const chars = new Set<string>([engine.state.targetChar]);
  const idiom = engine.currentIdiomTarget();
  if (idiom) for (const char of idiom.chars) chars.add(char);
  return chars;
}

/** 3단계 지원군 — 시작 진 오행의 1★ 글자를 count 개 고른다(보호 글자 제외). */
export function pickSupportChars(engine: GameEngine, count: number): string[] {
  const banned = grantProtectedChars(engine);
  const preferred = startingWuxing(engine);
  const order: Wuxing[] = [preferred, ...WUXING_ORDER.filter((wuxing) => wuxing !== preferred)];
  for (const wuxing of order) {
    const candidates = engine.summonDefinitions()
      .filter((definition) => definition.wuxing === wuxing
        && casualNaturalStar(definition.char) === 1
        && !banned.has(definition.char));
    if (candidates.length === 0) continue;
    return Array.from({ length: count }, (_, index) => (candidates[index % candidates.length]?.char ?? candidates[0]?.char) as string);
  }
  return [];
}

/**
 * 4단계 3합 재료 — 같은 오행·같은 별(1★) 글자 3개.
 * 인벤토리로 지급되므로 [한 번에 승급] 일괄 경로(전장 재료 없음)를 확실히 탄다.
 */
export function pickFusionGrantChars(engine: GameEngine): { wuxing: Wuxing; chars: string[] } | null {
  const banned = grantProtectedChars(engine);
  const preferred = startingWuxing(engine);
  const order: Wuxing[] = [preferred, ...WUXING_ORDER.filter((wuxing) => wuxing !== preferred)];
  for (const wuxing of order) {
    if (engine.casualResultPool(wuxing, 1) === null) continue;
    const candidates = engine.summonDefinitions()
      .filter((definition) => definition.wuxing === wuxing
        && casualNaturalStar(definition.char) === 1
        && !banned.has(definition.char));
    if (candidates.length === 0) continue;
    const chars = Array.from({ length: 3 }, (_, index) => (candidates[index % candidates.length]?.char ?? candidates[0]?.char) as string);
    return { wuxing, chars };
  }
  return null;
}

/** 개방된 진들의 직선(가로 4·세로 4·대각 2) 전역 칸 번호 목록. */
export function unlockedStraightLines(engine: GameEngine): number[][] {
  const lines: number[][] = [];
  for (const [formationIndex, formation] of BOARD_FORMATIONS.entries()) {
    if (!engine.isFormationUnlocked(formationIndex)) continue;
    const start = formation.startCell;
    for (let row = 0; row < FORMATION_ROWS; row += 1) {
      lines.push(Array.from({ length: FORMATION_COLUMNS }, (_, column) => start + row * FORMATION_COLUMNS + column));
    }
    for (let column = 0; column < FORMATION_COLUMNS; column += 1) {
      lines.push(Array.from({ length: FORMATION_ROWS }, (_, row) => start + row * FORMATION_COLUMNS + column));
    }
    lines.push(Array.from({ length: FORMATION_ROWS }, (_, step) => start + step * FORMATION_COLUMNS + step));
    lines.push(Array.from({ length: FORMATION_ROWS }, (_, step) => start + step * FORMATION_COLUMNS + (FORMATION_COLUMNS - 1 - step)));
  }
  return lines;
}

/**
 * 7단계 성어 줄 준비 — 가장 비어 있는 직선 하나를 고르고, 그 줄 위의 자령은
 * 다른 빈 칸으로 옮겨 완전히 빈 줄을 만든다. 반환값은 글자 순서 기준 네 칸이다.
 */
export function prepareIdiomLine(engine: GameEngine): number[] | null {
  const lines = unlockedStraightLines(engine);
  if (lines.length === 0) return null;
  const towerAt = (cell: number): Tower | undefined => engine.state.towers.find((tower) => tower.cell === cell);
  const sorted = [...lines].sort((left, right) =>
    left.filter((cell) => towerAt(cell)).length - right.filter((cell) => towerAt(cell)).length);
  const line = sorted[0] as number[];
  const lineSet = new Set(line);
  for (const cell of line) {
    const occupant = towerAt(cell);
    if (!occupant) continue;
    const freeCell = BOARD_CELLS
      .map((_, index) => index)
      .find((candidate) => engine.isCellUnlocked(candidate)
        && !lineSet.has(candidate)
        && !engine.state.towers.some((tower) => tower.cell === candidate));
    if (freeCell === undefined) return null;
    engine.selectTower(occupant.id);
    engine.relocateSelectedToCell(freeCell);
  }
  return line;
}

/** 지급 자령 중 아직 인벤토리에 남아 다음에 놓아야 할 것(지급 순서 기준). */
export function nextPendingGrantId(engine: GameEngine, grantedIds: readonly number[]): number | null {
  for (const id of grantedIds) {
    if (engine.state.inventoryTowers.some((tower) => tower.id === id)) return id;
  }
  return null;
}

/** 진행 감지용 — 오행 강화·특성에 쓴 문기 총량. */
export function totalEssenceSpent(engine: GameEngine): number {
  return WUXING_ORDER.reduce((sum, wuxing) => sum + engine.state.elementEssenceSpent[wuxing], 0);
}

/** 지원군을 시작 진의 빈 칸에 곧바로 세운다. 성공적으로 선 자령 수를 돌려준다. */
export function deployGrantedTower(engine: GameEngine, towerId: number): boolean {
  const cell = BOARD_CELLS
    .map((_, index) => index)
    .find((candidate) => engine.isCellUnlocked(candidate)
      && !engine.state.towers.some((tower) => tower.cell === candidate));
  if (cell === undefined) return false;
  engine.selectTower(towerId);
  return engine.moveSelectedToCell(cell).ok;
}

/** 성어 네 칸의 월드 좌표 경계 상자(링 스포트라이트용). */
export function cellsWorldBounds(cells: readonly number[]): { x: number; y: number; width: number; height: number } | null {
  const points = cells.map((cell) => BOARD_CELLS[cell]).filter((point): point is { x: number; y: number } => Boolean(point));
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - 26;
  const maxX = Math.max(...xs) + 26;
  const minY = Math.min(...ys) - 26;
  const maxY = Math.max(...ys) + 26;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
