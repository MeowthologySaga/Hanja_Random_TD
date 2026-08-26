import { describe, expect, it } from "vitest";
import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  CELLS_PER_FORMATION,
  ENEMY_PATH_POINTS,
  ENEMY_SPAWN_PROGRESS,
  bossTimeLimitForWave,
  isFormationUnlocked,
  nextFormationUnlockCost,
  positionOnPath,
  spawnProgressForEnemy,
  unlockedTowerCapacity,
  wavePlan
} from "../src/core/content";
import { GAME_CONFIG, getCatalog } from "../src/core/hanzi";
import { SeededRng } from "../src/core/rng";

describe("deterministic random source", () => {
  it("replays the same sequence for the same seed", () => {
    const first = new SeededRng("same-run");
    const second = new SeededRng("same-run");
    expect(Array.from({ length: 20 }, () => first.next())).toEqual(Array.from({ length: 20 }, () => second.next()));
  });

  it("keeps values inside the requested integer range", () => {
    const rng = new SeededRng("integer-range");
    const values = Array.from({ length: 500 }, () => rng.int(3, 7));
    expect(Math.min(...values)).toBe(3);
    expect(Math.max(...values)).toBe(7);
  });
});

describe("regional catalog and wave content", () => {
  it("loads the complete handoff scopes into separate catalogs", () => {
    expect(getCatalog("KR").definitions.size).toBe(1_001);
    expect(getCatalog("JP").definitions.size).toBe(2_136);
    expect(getCatalog("CN").definitions.size).toBe(3_500);
    expect(getCatalog("KR").activePool.length).toBeGreaterThanOrEqual(12);
  });

  it("accelerates circulation only on waves 1-3 to shorten the opening lap", () => {
    // 수술 8 ⓐ: 초반 랩 39.8s → 34.6s. 닫힌 고리라 순환 가속은 난이도를 올리지 않는다.
    expect(wavePlan(1).speed).toBeCloseTo((0.025 + 0.00015) * 1.15, 6);
    expect(wavePlan(2).speed).toBeCloseTo((0.025 + 0.0003) * 1.15, 6);
    // 22웨이브는 일반형 — 가속이 붙지 않는다.
    expect(wavePlan(22).speed).toBeCloseTo(0.025 + 0.0033, 6);
  });

  it("marks every tenth wave through 100 as a boss and rotates enemy types", () => {
    expect(wavePlan(9).boss).toBe(false);
    expect(wavePlan(10).boss).toBe(true);
    expect(wavePlan(19).boss).toBe(false);
    expect(wavePlan(20).boss).toBe(true);
    expect(wavePlan(30).boss).toBe(true);
    expect(wavePlan(100).boss).toBe(true);
    expect(wavePlan(99).boss).toBe(false);
    expect(bossTimeLimitForWave(10)).toBe(72);
    expect(bossTimeLimitForWave(100)).toBe(126);
    expect(wavePlan(3).archetype).toBe("swarm");
    expect(wavePlan(4).archetype).toBe("swift");
    expect(wavePlan(5).archetype).toBe("armored");
    expect(wavePlan(5).label).toContain("정예");
  });

  it("uses one closed route that covers every straight segment of the cross", () => {
    expect(positionOnPath(0)).toMatchObject({ x: 340, y: 260 });
    expect(ENEMY_PATH_POINTS).toHaveLength(17);
    expect(ENEMY_PATH_POINTS.at(-1)).toEqual(ENEMY_PATH_POINTS[0]);
    expect(ENEMY_PATH_POINTS.slice(0, 13)).toEqual([
      { x: 340, y: 260 }, { x: 340, y: 60 }, { x: 540, y: 60 }, { x: 540, y: 260 },
      { x: 740, y: 260 }, { x: 740, y: 460 }, { x: 540, y: 460 }, { x: 540, y: 660 },
      { x: 340, y: 660 }, { x: 340, y: 460 }, { x: 140, y: 460 }, { x: 140, y: 260 },
      { x: 340, y: 260 }
    ]);
    expect(positionOnPath(0.999999).x).toBeCloseTo(340, 1);
    expect(positionOnPath(0.999999).y).toBeCloseTo(260, 1);
    expect(positionOnPath(2.25)).toEqual(positionOnPath(0.25));
    for (let index = 1; index < ENEMY_PATH_POINTS.length; index += 1) {
      const previous = ENEMY_PATH_POINTS[index - 1]!;
      const current = ENEMY_PATH_POINTS[index]!;
      expect(previous.x === current.x || previous.y === current.y).toBe(true);
      expect(Math.hypot(current.x - previous.x, current.y - previous.y)).toBe(200);
    }
  });

  it("distributes four spawn portals across the cardinal sides of the same circuit", () => {
    expect(ENEMY_SPAWN_PROGRESS).toHaveLength(4);
    expect(ENEMY_SPAWN_PROGRESS.map(positionOnPath)).toEqual([
      { x: 440, y: 60 },
      { x: 740, y: 360 },
      { x: 440, y: 660 },
      { x: 140, y: 360 }
    ]);
    expect(Array.from({ length: 8 }, (_, index) => spawnProgressForEnemy(index))).toEqual([
      ...ENEMY_SPAWN_PROGRESS,
      ...ENEMY_SPAWN_PROGRESS
    ]);
  });

  it("provides five straight 4x4 elemental formations and eighty usable cells", () => {
    expect(GAME_CONFIG.maxBoardSize).toBe(80);
    expect(GAME_CONFIG.maxTowerCount).toBe(80);
    expect(BOARD_FORMATIONS).toHaveLength(5);
    expect(BOARD_CELLS).toHaveLength(80);
    expect(new Set(BOARD_CELLS.map((cell) => String(cell.x) + ":" + String(cell.y))).size).toBe(80);
    expect(new Set(BOARD_FORMATIONS.map((formation) => formation.preferredWuxing)).size).toBe(5);
    expect(Object.fromEntries(BOARD_FORMATIONS.map((formation) => [formation.preferredWuxing, formation.color]))).toEqual({
      水: "#60c9ff",
      金: "#d8e2ec",
      土: "#d9a25f",
      木: "#70d684",
      火: "#ff7666"
    });
    expect(BOARD_FORMATIONS.map((formation) => formation.center)).toEqual([
      { x: 440, y: 160 },
      { x: 240, y: 360 },
      { x: 440, y: 360 },
      { x: 640, y: 360 },
      { x: 440, y: 560 }
    ]);
    for (const formation of BOARD_FORMATIONS) {
      const cells = BOARD_CELLS.slice(formation.startCell, formation.startCell + CELLS_PER_FORMATION);
      expect(new Set(cells.map((cell) => cell.x)).size).toBe(4);
      expect(new Set(cells.map((cell) => cell.y)).size).toBe(4);
    }
    const nearest = BOARD_CELLS.flatMap((cell, index) => BOARD_CELLS.slice(index + 1).map((other) => Math.hypot(cell.x - other.x, cell.y - other.y)));
    expect(Math.min(...nearest)).toBeGreaterThanOrEqual(44);
  });

  it("opens the center formation first and prices four player-chosen expansions", () => {
    expect(unlockedTowerCapacity([2])).toBe(16);
    expect(unlockedTowerCapacity([2, 4])).toBe(32);
    expect(unlockedTowerCapacity([0, 2, 4])).toBe(48);
    expect(unlockedTowerCapacity([0, 1, 2, 4])).toBe(64);
    expect(unlockedTowerCapacity([0, 1, 2, 3, 4])).toBe(80);
    expect(isFormationUnlocked(2, [2])).toBe(true);
    expect(isFormationUnlocked(0, [2])).toBe(false);
    expect([1, 2, 3, 4, 5].map(nextFormationUnlockCost)).toEqual([18, 32, 52, 78, null]);
  });
});
