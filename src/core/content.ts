import { WUXING_ORDER } from "./hanzi";
import type { EnemyArchetype, Point, WavePlan, Wuxing } from "./types";

export const WORLD_WIDTH = 880;
export const WORLD_HEIGHT = 720;
export const MAX_ENEMIES = 80;
export const WAVE_REINFORCEMENT_DELAY = 20;
export const BOSS_TIME_LIMITS: Readonly<Record<number, number>> = Object.freeze(
  Object.fromEntries(Array.from({ length: 10 }, (_, index) => {
    const chapter = index + 1;
    // The opening formation sits in a different part of the route for each
    // element. A slightly wider first-chapter limit keeps that positional
    // choice from deciding the run before the remaining formations open.
    return [chapter * 10, 72 + (chapter - 1) * 6];
  }))
);
export const FORMATION_COLUMNS = 4;
export const FORMATION_ROWS = 4;
export const CELLS_PER_FORMATION = FORMATION_COLUMNS * FORMATION_ROWS;
// A run begins with every formation sealed. The first successful summon opens
// the matching elemental formation for free.
export const INITIAL_UNLOCKED_FORMATIONS = Object.freeze([] as const);
export const FORMATION_PURCHASE_COSTS = Object.freeze([18, 32, 52, 78] as const);

export function bossTimeLimitForWave(wave: number): number | null {
  return BOSS_TIME_LIMITS[wave] ?? null;
}

export function bossHpFactorForWave(wave: number): number {
  const chapter = Math.max(1, Math.min(10, Math.ceil(wave / 10)));
  return 6.5 + chapter * 1.25;
}

export function waveClearReward(wave: number): number {
  return 8 + Math.floor(Math.max(0, wave - 1) / 5) * 2;
}

export interface BoardFormation {
  id: "north" | "west" | "center" | "east" | "south";
  label: string;
  center: Point;
  color: string;
  preferredWuxing: Wuxing;
  startCell: number;
}

const FORMATION_SPACING = 44;
const FORMATION_DEFINITIONS: readonly Omit<BoardFormation, "startCell">[] = [
  { id: "north", label: "수진", center: { x: 440, y: 160 }, color: "#60c9ff", preferredWuxing: "水" },
  { id: "west", label: "금진", center: { x: 240, y: 360 }, color: "#d8e2ec", preferredWuxing: "金" },
  { id: "center", label: "토진", center: { x: 440, y: 360 }, color: "#d9a25f", preferredWuxing: "土" },
  { id: "east", label: "목진", center: { x: 640, y: 360 }, color: "#70d684", preferredWuxing: "木" },
  { id: "south", label: "화진", center: { x: 440, y: 560 }, color: "#ff7666", preferredWuxing: "火" }
];

export const BOARD_FORMATIONS: readonly BoardFormation[] = FORMATION_DEFINITIONS.map((formation, index) => ({
  ...formation,
  startCell: index * CELLS_PER_FORMATION
}));

export function nextFormationUnlockCost(unlockedFormationCount: number): number | null {
  // The first unlocked formation is always the free, summon-determined start.
  const purchasedCount = Math.max(0, Math.floor(unlockedFormationCount) - 1);
  return FORMATION_PURCHASE_COSTS[purchasedCount] ?? null;
}

export function isFormationUnlocked(formationIndex: number, unlockedFormations: readonly number[]): boolean {
  return unlockedFormations.includes(formationIndex);
}

export function isBoardCellUnlocked(cell: number, unlockedFormations: readonly number[]): boolean {
  if (cell < 0 || cell >= BOARD_CELLS.length) return false;
  return isFormationUnlocked(Math.floor(cell / CELLS_PER_FORMATION), unlockedFormations);
}

export function unlockedTowerCapacity(unlockedFormations: readonly number[]): number {
  return BOARD_FORMATIONS.reduce((total, _, index) => total + (isFormationUnlocked(index, unlockedFormations) ? CELLS_PER_FORMATION : 0), 0);
}

export const BOARD_CELLS: readonly Point[] = BOARD_FORMATIONS.flatMap((formation) =>
  Array.from({ length: CELLS_PER_FORMATION }, (_, localIndex) => ({
    x: formation.center.x + (localIndex % FORMATION_COLUMNS - 1.5) * FORMATION_SPACING,
    y: formation.center.y + (Math.floor(localIndex / FORMATION_COLUMNS) - 1.5) * FORMATION_SPACING
  }))
);

// Fill one complete four-character row at a time, then move to the next elemental
// formation. This preserves readable idiom rows while distributing each 20 summons.
export const SUMMON_CELL_ORDER: readonly number[] = Array.from({ length: FORMATION_ROWS }, (_, row) =>
  BOARD_FORMATIONS.flatMap((formation) =>
    Array.from({ length: FORMATION_COLUMNS }, (_, column) => formation.startCell + row * FORMATION_COLUMNS + column)
  )
).flat();

// One regular Eulerian circuit: clockwise around the outer Greek-cross outline,
// then clockwise around the nested center square. Every edge is used exactly once.
export const ENEMY_PATH_POINTS: readonly Point[] = [
  { x: 340, y: 260 },
  { x: 340, y: 60 },
  { x: 540, y: 60 },
  { x: 540, y: 260 },
  { x: 740, y: 260 },
  { x: 740, y: 460 },
  { x: 540, y: 460 },
  { x: 540, y: 660 },
  { x: 340, y: 660 },
  { x: 340, y: 460 },
  { x: 140, y: 460 },
  { x: 140, y: 260 },
  { x: 340, y: 260 },
  { x: 540, y: 260 },
  { x: 540, y: 460 },
  { x: 340, y: 460 },
  { x: 340, y: 260 }
];

// Four cardinal portals share the same closed circuit. New enemies rotate
// north -> east -> south -> west so every side of the formation is pressured.
export const ENEMY_SPAWN_PROGRESS: readonly number[] = [0.09375, 0.28125, 0.46875, 0.65625];

export function spawnProgressForEnemy(spawnIndex: number): number {
  const normalizedIndex = Math.max(0, Math.floor(spawnIndex));
  return ENEMY_SPAWN_PROGRESS[normalizedIndex % ENEMY_SPAWN_PROGRESS.length] as number;
}

const PATH_LENGTHS = ENEMY_PATH_POINTS.slice(0, -1).map((point, index) => {
  const next = ENEMY_PATH_POINTS[index + 1] as Point;
  return Math.hypot(next.x - point.x, next.y - point.y);
});
const TOTAL_PATH_LENGTH = PATH_LENGTHS.reduce((sum, length) => sum + length, 0);

const ARCHETYPE_LABEL: Record<EnemyArchetype, string> = {
  normal: "망령 행렬",
  swarm: "백귀야행",
  swift: "질풍 아귀",
  armored: "정예 철갑 강시",
  regenerator: "회생 요괴",
  boss: "봉인 파괴자"
};

const ARCHETYPE_BRIEFING: Record<EnemyArchetype, string> = {
  normal: "표준 병력. 오행 약점을 노려 효율적으로 정리하세요.",
  swarm: "체력은 낮지만 수가 많습니다. 화·수 계열 광역과 연쇄가 유리합니다.",
  swift: "빠르게 방어진을 통과합니다. 수·토 계열의 제어가 중요합니다.",
  armored: "높은 방어력으로 피해를 줄입니다. 금 계열이 방어를 관통합니다.",
  regenerator: "이동 중 생명력을 회복합니다. 집중 화력으로 빠르게 처치하세요.",
  boss: "강력한 우두머리입니다. 목표 합성을 완성해 화력을 집중하세요."
};

function archetypeForWave(wave: number): EnemyArchetype {
  if (wave > 0 && wave % 10 === 0) return "boss";
  if (wave % 5 === 0) return "armored";
  if (wave % 4 === 0) return "swift";
  if (wave % 3 === 0) return "swarm";
  if (wave >= 7 && wave % 2 === 1) return "regenerator";
  return "normal";
}

export function positionOnPath(progress: number): Point {
  const loopProgress = ((progress % 1) + 1) % 1;
  let distance = loopProgress * TOTAL_PATH_LENGTH;
  for (let index = 0; index < PATH_LENGTHS.length; index += 1) {
    const segmentLength = PATH_LENGTHS[index] as number;
    if (distance <= segmentLength) {
      const from = ENEMY_PATH_POINTS[index] as Point;
      const to = ENEMY_PATH_POINTS[index + 1] as Point;
      const ratio = distance / segmentLength;
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio
      };
    }
    distance -= segmentLength;
  }
  return { ...(ENEMY_PATH_POINTS[ENEMY_PATH_POINTS.length - 1] as Point) };
}

/**
 * Returns the smoothed travel direction at a point on the closed enemy path.
 * Sampling on both sides keeps long effects aligned with straight lanes while
 * turning them diagonally through corners instead of snapping past the track.
 */
export function directionOnPath(progress: number, smoothingDistance = 36): Point {
  const distance = Math.max(1, Math.min(TOTAL_PATH_LENGTH / 8, Math.abs(smoothingDistance)));
  const progressOffset = distance / TOTAL_PATH_LENGTH;
  const before = positionOnPath(progress - progressOffset);
  const after = positionOnPath(progress + progressOffset);
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const length = Math.hypot(dx, dy);
  if (length > 0.0001) return { x: dx / length, y: dy / length };

  const fallbackBefore = positionOnPath(progress - 0.0001);
  const fallbackAfter = positionOnPath(progress + 0.0001);
  const fallbackX = fallbackAfter.x - fallbackBefore.x;
  const fallbackY = fallbackAfter.y - fallbackBefore.y;
  const fallbackLength = Math.hypot(fallbackX, fallbackY);
  return fallbackLength > 0.0001
    ? { x: fallbackX / fallbackLength, y: fallbackY / fallbackLength }
    : { x: 1, y: 0 };
}

/**
 * 수술 8 ⓐ: 초반 순환 가속.
 *
 * 첫 소환의 무작위 오행이 첫 개방 진을 정하므로, 경로에서 먼 진이 걸리면
 * 적이 한 바퀴(웨이브 1 기준 39.8초) 도는 동안 기다리는 시간이 길다.
 * 1~3웨이브 한정으로 순환 속도를 15% 올려 랩을 34.6초로 줄인다. 경로가
 * 닫힌 고리라 적이 새지 않으므로 빠른 순환은 오히려 타워 사정권을 더 자주
 * 지나가게 해 난이도를 올리지 않는다.
 */
export const EARLY_LAP_WAVES = 3;
export const EARLY_LAP_SPEED_MULTIPLIER = 1.15;

export function wavePlan(wave: number): WavePlan {
  const archetype = archetypeForWave(wave);
  const boss = archetype === "boss";
  const weakness = WUXING_ORDER[(wave - 1) % WUXING_ORDER.length] as WavePlan["weakness"];
  const hpFactor = {
    normal: 1,
    swarm: 0.62,
    swift: 0.82,
    armored: 1.25,
    regenerator: 1.08,
    boss: bossHpFactorForWave(wave)
  }[archetype];
  const countFactor = {
    normal: 1,
    swarm: 1.45,
    swift: 1.05,
    armored: 0.82,
    regenerator: 0.9,
    boss: 0.28 + Math.min(0.1, Math.ceil(wave / 10) * 0.01)
  }[archetype];
  const speedFactor = {
    normal: 1,
    swarm: 1.03,
    swift: 1.48,
    armored: 0.78,
    regenerator: 0.92,
    boss: 0.68
  }[archetype];
  const baseCount = 8 + Math.floor(wave * 0.42);
  const baseHp = 34 * Math.pow(1.03, wave - 1);
  const chapter = Math.max(1, Math.min(10, Math.ceil(wave / 10)));

  return {
    wave,
    count: Math.max(1, Math.round(baseCount * countFactor)),
    hp: baseHp * hpFactor,
    speed: (0.025 + Math.min(0.015, wave * 0.00015)) * speedFactor * (wave <= EARLY_LAP_WAVES ? EARLY_LAP_SPEED_MULTIPLIER : 1),
    interval: archetype === "swarm" ? 0.38 : boss ? 0.72 : Math.max(0.42, 0.9 - wave * 0.0048),
    reward: boss ? 24 + chapter * 6 : 1 + Math.floor((wave - 1) / 25),
    boss,
    archetype,
    weakness,
    armor: archetype === "armored" ? Math.min(0.48, 0.28 + chapter * 0.018) : boss ? 0.1 + chapter * 0.012 : 0,
    regen: archetype === "regenerator" ? baseHp * 0.026 : boss ? baseHp * 0.004 : 0,
    label: ARCHETYPE_LABEL[archetype] + " " + wave,
    briefing: ARCHETYPE_BRIEFING[archetype]
  };
}
