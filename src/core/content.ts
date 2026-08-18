import { WUXING_ORDER } from "./hanzi";
import type { EnemyArchetype, Point, WavePlan, Wuxing } from "./types";

export const WORLD_WIDTH = 880;
export const WORLD_HEIGHT = 720;
export const MAX_ENEMIES = 40;
export const WAVE_REINFORCEMENT_DELAY = 16;
export const BOSS_TIME_LIMITS: Readonly<Record<number, number>> = Object.freeze({ 10: 60, 20: 85 });
export const FORMATION_COLUMNS = 4;
export const FORMATION_ROWS = 4;
export const CELLS_PER_FORMATION = FORMATION_COLUMNS * FORMATION_ROWS;

export function bossTimeLimitForWave(wave: number): number | null {
  return BOSS_TIME_LIMITS[wave] ?? null;
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
  { id: "north", label: "수진", center: { x: 440, y: 160 }, color: "#76d7ff", preferredWuxing: "水" },
  { id: "west", label: "금진", center: { x: 240, y: 360 }, color: "#f0d58a", preferredWuxing: "金" },
  { id: "center", label: "토진", center: { x: 440, y: 360 }, color: "#ffd068", preferredWuxing: "土" },
  { id: "east", label: "목진", center: { x: 640, y: 360 }, color: "#9be77c", preferredWuxing: "木" },
  { id: "south", label: "화진", center: { x: 440, y: 560 }, color: "#ff9477", preferredWuxing: "火" }
];

export const BOARD_FORMATIONS: readonly BoardFormation[] = FORMATION_DEFINITIONS.map((formation, index) => ({
  ...formation,
  startCell: index * CELLS_PER_FORMATION
}));

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
  armored: "철갑 강시",
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
  if (wave === 10 || wave === 20) return "boss";
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
    boss: wave === 10 ? 7.5 : 11.5
  }[archetype];
  const countFactor = {
    normal: 1,
    swarm: 1.65,
    swift: 1.12,
    armored: 0.82,
    regenerator: 0.92,
    boss: 0.4
  }[archetype];
  const speedFactor = {
    normal: 1,
    swarm: 1.03,
    swift: 1.48,
    armored: 0.78,
    regenerator: 0.92,
    boss: 0.68
  }[archetype];
  const baseCount = 9 + Math.floor(wave * 0.92);
  const baseHp = 34 * Math.pow(1.17, wave - 1);

  return {
    wave,
    count: Math.max(1, Math.round(baseCount * countFactor)),
    hp: baseHp * hpFactor,
    speed: (0.036 + Math.min(0.014, wave * 0.00055)) * speedFactor,
    interval: archetype === "swarm" ? 0.34 : boss ? 0.9 : Math.max(0.4, 0.82 - wave * 0.01),
    reward: boss ? 32 + wave : 2 + Math.floor(wave / 5),
    boss,
    archetype,
    weakness,
    armor: archetype === "armored" ? 0.38 : boss ? 0.16 : 0,
    regen: archetype === "regenerator" ? baseHp * 0.018 : boss ? baseHp * 0.0025 : 0,
    label: ARCHETYPE_LABEL[archetype] + " " + wave,
    briefing: ARCHETYPE_BRIEFING[archetype]
  };
}
