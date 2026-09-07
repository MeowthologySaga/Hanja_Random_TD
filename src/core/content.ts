import { WUXING_ORDER } from "./hanzi";
import type { EnemyArchetype, GameMode, Point, WavePlan, Wuxing } from "./types";

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
/**
 * 우두머리 시계가 사람에게 말을 거는 문턱(초) — 30 · 15 · 5 (v041).
 *
 * "보스 시간제한 있는 거 모르고 냅두다가 게임오버하는거 봤어"(사용자). 시계가
 * 있다는 사실 자체가 화면 한 곳(패널 12px 줄)에만 있었다.
 */
export const BOSS_CLOCK_STAGES: readonly number[] = Object.freeze([30, 15, 5]);

/**
 * 그 문턱을 처음 지날 때 한 번 하는 말. 문장은 코어가 만든다 — 화면은 고쳐 쓰지 않는다.
 *
 * 30초에서만 「넘기면 무슨 일이 벌어지는가」를 말한다. 15·5초에서는 이미 손이
 * 바쁘므로 짧게만 재촉한다.
 */
export function bossClockNotice(remaining: number, finalWave: boolean): string | null {
  if (remaining <= 5) return "우두머리 5초";
  if (remaining <= 15) return "우두머리 15초 — 화력을 우두머리에 모으세요";
  if (remaining <= 30) {
    return finalWave
      ? "우두머리 30초 — 마지막 우두머리는 제한을 넘기면 그 자리에서 패배합니다"
      : "우두머리 30초 — 못 잡으면 우두머리가 남은 채 다음 웨이브가 겹칩니다";
  }
  return null;
}

/**
 * 제한을 넘긴 순간의 말.
 *
 * 넘겨도 그 자리에서 지지는 않는다(v035 ③) — 대신 우두머리가 남은 채 20초마다
 * 다음 웨이브가 겹쳐 적이 쌓이고, 결국 적 상한에서 진다. 그 연쇄를 어디서도
 * 잇지 않아 「시계 때문에 졌다」는 것을 아무도 몰랐다.
 */
export function bossOvertimeNotice(): string {
  return `제한시간 초과 — 우두머리를 잡을 때까지 ${WAVE_REINFORCEMENT_DELAY}초마다 다음 웨이브가 겹칩니다. 적 ${MAX_ENEMIES}체가 차면 패배합니다.`;
}

/** 마지막 우두머리만은 시계가 문턱이 아니라 벽이다 — 코드 밖 어디에도 없던 규칙. */
export function bossFinalWallNotice(): string {
  return "마지막 우두머리는 제한시간을 넘기면 그 자리에서 패배합니다.";
}

/**
 * 준비 단계에서 「못 치운다」고 말할 문턱 (v042).
 *
 * 이 지수는 절대값에 뜻이 없다 — 사정권 체류(실측 32~100%)·약점 배수·스폰 구간이
 * 다 빠져 있다. 뜻이 있는 것은 **같은 판 안의 크기 비교**뿐이라 문턱을 실측 사다리로
 * 고정한다: W4→W5 준비(KR 표준)에서 3기 2.78 · 4기 2.00 · 5기 1.60 · 6기 1.32,
 * 봇 1장 최대 0.60(9런). 1.8 은 넉 기 이하에서만 서고 다섯 기·봇에서는 잠잠하다.
 */
export const WAVE_READINESS_ALERT = 1.8;

/**
 * 준비 단계의 화력 경고 — 문장은 코어가 만든다.
 *
 * "3기는 있어야 첫 웨이브를 치웁니다"라고 코치가 말하는데, 실측하면 3기로 W5(정예
 * 철갑)에 들어가면 60발을 쏘고 **처치 0**이고 준비 시간이 여덟 웨이브 중 세 번만
 * 돌아온다. 준비를 못 되찾으면 부적을 쓸 창까지 함께 잃는다. 그런데 화면 어디도
 * 손이 아직 자유로울 때(준비 단계) 「부족하다」고 말하지 않았다.
 */
export function waveReadinessNotice(nextWave: number, cost: number): { label: string; title: string } {
  return {
    // 준비 단계는 단추가 셋이라 한 칸의 글 상자가 95px 뿐이다 — 라벨은 그 안에 든다.
    label: `${nextWave}웨이브 못 치움`,
    title: `지금 화력으로는 ${nextWave}웨이브를 ${WAVE_REINFORCEMENT_DELAY}초 안에 못 치웁니다. 못 치우면 다음 웨이브가 겹치고 준비 시간이 돌아오지 않습니다 · 소환 ${cost}엽전`
  };
}

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
  /*
   * 제1장 우두머리만 절반이다.
   *
   * 그때는 진이 하나뿐이라 판이 노선을 다 덮지 못한다 — 우두머리가 열린 진에서
   * 먼 구역으로 돌면 사거리 안에 한 번도 들어오지 않아, 잘 싸우고도 손을 못 대고
   * 지나 보낸다(사용자 제보). 체력을 깎아 "닿는 동안 잡을 수 있는" 양으로 맞춘다.
   * 2장부터는 진이 둘 이상이라 종전 곡선을 그대로 지킨다.
   *
   * 이 계수는 우두머리에게만 붙는다 — 같은 웨이브의 잡졸은 spawnEnemy 가 같은
   * 값으로 도로 나누므로(1 / bossFactor) 체력이 변하지 않는다.
   */
  if (chapter === 1) return (6.5 + 1.25) / 2;
  return 6.5 + chapter * 1.25;
}

/**
 * 웨이브를 다 잡았을 때의 보상.
 *
 * v037 개문 램프(OPENING_COUNT_RAMP)는 첫 스무 웨이브의 몸수를 줄인다 — 잡을
 * 적이 줄면 처치 엽전(1/체)과 은행 이자가 함께 줄어, 실측에서 135런 승률이
 * 0.667 → 0.578 로 내려앉았다(KR 0.644 → 0.467). 줄어든 몸수만큼을 **방어
 * 보상**으로 돌려준다 — 처치 엽전과 달리 웨이브를 **치웠을 때만** 오므로,
 * 개문을 치우는 사람에게 가고 못 치우는 판에는 안 간다. 표준은 +4 로 승률 0.659 ·
 * 지역 격차 0.022(같은 시드 135런)까지 돌아왔다. 캐주얼은 몸수 계수 0.85 라 잃는
 * 처치 엽전이 적고 3합 경제가 엽전에 더 민감해 +4 에서 0.711(45런, 밴드 초과)로
 * 튀었다 — 절반만 돌려준다.
 */
export const OPENING_CLEAR_BONUS = Object.freeze({
  amount: { standard: 4, casual: 2 } as Record<GameMode, number>,
  waves: 20
} as const);

export function waveClearReward(wave: number, mode: GameMode = "standard"): number {
  const bonus = wave <= OPENING_CLEAR_BONUS.waves ? OPENING_CLEAR_BONUS.amount[mode] : 0;
  return 8 + Math.floor(Math.max(0, wave - 1) / 5) * 2 + bonus;
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

/*
 * 웨이브 브리핑 한 줄.
 *
 * 이 문장은 웨이브 카드의 `#wave-briefing` 에 실리는데, 그 자리는 284px 폭에
 * 12px 두 줄 클램프(절 95)다. 그리고 실제로 화면에 나가는 것은 이 문장
 * **혼자가 아니라** 뒤에 장·우두머리·잔존 꼬리가 붙은 합성 문자열이다
 * (`src/ui/hud.ts` 의 `composeWaveBriefing`). 실측 결과 옛 문장(59~64자)은
 * 꼬리를 붙이면 3~4줄이 되어 "…" 없이 통째로 잘려 나갔다 — 꼬리까지 합쳐
 * 두 줄에 들어가도록 24자 안팎으로 줄인 판이다. 늘릴 때는 반드시 꼬리를
 * 붙인 최장 조합으로 재 보라.
 */
const ARCHETYPE_BRIEFING: Record<EnemyArchetype, string> = {
  normal: "표준 병력 — 오행 약점을 노려 정리하세요.",
  swarm: "체력이 낮고 수가 많습니다 — 광역·연쇄가 유리.",
  swift: "매우 빠릅니다 — 수·토 계열 제어가 중요.",
  armored: "방어력이 높습니다 — 금 계열이 관통합니다.",
  regenerator: "이동 중 회복합니다 — 집중 화력으로 빠르게.",
  boss: "우두머리 — 목표 합성으로 화력을 집중."
};

/**
 * 웨이브 브리핑 두 줄 예산(글자 수) — **조판 실측에서 역산한 지금 문구의 상한**.
 *
 * `#wave-briefing` 은 284px · 12px · 줄높이 15.12px · 2줄 클램프(표시 30px)다.
 * 글자 수는 폭의 근사일 뿐이다 — 전각 한글만 60자면 720px(2.5줄)라 넘친다.
 * 지금 문구는 한글·중점·숫자가 섞여 있어 301개 조합 전수 실측에서 최장 60자가
 * 두 줄에 들어갔고, 그것이 이 상한의 근거다.
 *
 * 그래서 이 상수는 증명이 아니라 **철사줄**이다. 문구를 손대면 두 곳을 함께
 * 봐야 한다 — 이 상수를 지키는 `tests/wave-briefing.test.ts` 와, 진짜 조판을
 * 재는 e2e 「웨이브 브리핑은 어떤 조합에서도 두 줄을 넘지 않는다」.
 */
export const WAVE_BRIEFING_CHAR_BUDGET = 60;

/**
 * 화면에 실제로 나가는 브리핑 한 줄을 만든다.
 *
 * 옛 판은 원문 뒤에 장·제한·잔존 꼬리를 무조건 이어 붙여 최장 92자가 됐고,
 * 실측 39개 조합 중 26개가 두 줄에서 잘렸다. 카드를 키우면 상점 무스크롤
 * 예산이 깨지므로 문구 쪽을 줄였다.
 *
 * 겹치는 말도 턴다 — 우두머리 웨이브에서는 원문이 이미 "우두머리"라고
 * 말하므로 "우두머리 N웨이브" 예고를 빼고 제한시간만 남긴다. 그러지 않으면
 * 「우두머리 · 제한 · 잔존」 세 꼬리가 겹쳐 최장 조합만 예산을 넘는다.
 *
 * [S/P-10] 조각 차례는 "잃어도 되는 것을 뒤로" 다.
 *
 * 두 줄 클램프는 넘치는 순간 말줄임 없이 **뒤부터** 삼킨다. 그런데 잔존
 * 합류 수는 이 문장에서 유일하게 여기서만 알 수 있는 값이다 — 장 번호와
 * 우두머리 웨이브는 위 칩의 웨이브 수만 보면 되짚을 수 있고, 원문은 적
 * 유형별로 고정된 조언이다. 그래서 잔존을 장·우두머리 앞으로 옮겨,
 * 언젠가 조판이 밀리더라도 마지막까지 남는 쪽이 되게 한다.
 * (지금 조판에서는 301개 조합 전수가 두 줄 안이다 — e2e 「keeps every
 * wave briefing inside the two-line clamp」가 실제 높이로 잰다.)
 */
export function composeWaveBriefing(base: string, wave: number, bossLimited: boolean, survivors: number | null): string {
  const chapter = Math.max(1, Math.ceil(wave / 10));
  const parts = [base];
  if (survivors !== null) parts.push(`잔존 ${survivors}체 합류`);
  parts.push(bossLimited ? `제${chapter}장 · 제한 내 처치 필수` : `제${chapter}장 · 우두머리 ${chapter * 10}웨이브`);
  return parts.join(" · ");
}

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
 * 수술 9 「관문 보정」 — 보스는 시작 진의 가장 가까운 관문에서 등장한다.
 *
 * 보스전은 제한시간 안에 처치해야 하는데(타임아웃=패배) 보스 속도는 일반의
 * 0.34배라, 회전 관문 규칙에서는 시작 진이 먼 관문에 걸리면 도달에만
 * 제한시간 대부분을 태웠다(실측: 10웨이브 목진 47.7s/72s · 20웨이브 금진
 * 64.4s/78s). 진별로 "사거리 참조 220 기준 도달이 가장 빠른 관문"을
 * 정적으로 계산해 보스 웨이브에만 그 관문을 쓴다. 도달 최적 관문은 사거리
 * 205~250 전 구간에서 동일했다(수#0·금#3·토#0·목#1·화#2). 보스 속도·경로는
 * 그대로이므로(넉백·후퇴 없음) 위협 상쇄가 필요 없다.
 */
const BOSS_PORTAL_REFERENCE_RANGE = 220;

/**
 * 진 × 관문 도달 걸음 표 — 그 관문에서 나선 보스가 그 진의 사거리 안에 들기까지.
 *
 * 정적으로 한 번만 접는다(경로도 진도 런 중에 안 움직인다).
 */
const BOSS_PORTAL_STEPS: readonly (readonly number[])[] = BOARD_FORMATIONS.map((formation) => {
  const cells = Array.from({ length: CELLS_PER_FORMATION }, (_, offset) => BOARD_CELLS[formation.startCell + offset] as Point);
  const coverageSteps = (portalProgress: number): number => {
    for (let step = 0; step <= 1000; step += 1) {
      const point = positionOnPath(portalProgress + step * 0.001);
      if (cells.some((cell) => Math.hypot(cell.x - point.x, cell.y - point.y) <= BOSS_PORTAL_REFERENCE_RANGE)) return step;
    }
    return Number.POSITIVE_INFINITY;
  };
  return ENEMY_SPAWN_PROGRESS.map(coverageSteps);
});

export const BOSS_PORTAL_INDEX_BY_FORMATION: readonly number[] = BOSS_PORTAL_STEPS.map((steps) =>
  steps
    .map((value, portalIndex) => ({ portalIndex, steps: value }))
    .sort((left, right) => left.steps - right.steps || left.portalIndex - right.portalIndex)[0]?.portalIndex ?? 0
);

/**
 * 여러 진이 섰을 때의 보스 관문 — **가장 먼저 닿는 진** 기준으로 고른다.
 *
 * 수술 9 는 시작 진 하나만 봤다. 그때는 그것이 판의 전부였기 때문이다. 그런데
 * 진이 둘·셋 열린 뒤로도 보스는 여전히 **첫 진**의 최적 관문에서 나왔다 —
 * 그동안 애써 세운 다른 진 쪽으로는 늦게 돌아오거나 아예 스치지 않는다.
 * "보스가 ... 피가 안 다는 모습은 뭔가 답답한데"(v035 ③)의 한 갈래가 여기다.
 *
 * 열린 진 가운데 **하나라도** 가장 빨리 만나는 관문을 고른다. 판을 넓힌 만큼
 * 보스가 일찍 사거리에 들어온다 — 넓힌 보람이 보스전에서도 보이게 하는 것이
 * 요점이다. 동점이면 낮은 관문 번호로 갈라 결과를 결정론으로 묶는다.
 */
export function bossPortalForFormations(formations: readonly number[]): number | null {
  const rows = formations
    .map((formationIndex) => BOSS_PORTAL_STEPS[formationIndex])
    .filter((row): row is readonly number[] => row !== undefined);
  if (rows.length === 0) return null;
  let best = 0;
  let bestSteps = Number.POSITIVE_INFINITY;
  for (let portalIndex = 0; portalIndex < ENEMY_SPAWN_PROGRESS.length; portalIndex += 1) {
    const steps = Math.min(...rows.map((row) => row[portalIndex] ?? Number.POSITIVE_INFINITY));
    if (steps < bestSteps) {
      bestSteps = steps;
      best = portalIndex;
    }
  }
  return bestSteps === Number.POSITIVE_INFINITY ? null : best;
}

/**
 * 보스의 스폰 지점. 열린 진이 있으면 그 가운데 가장 빨리 만나는 관문, 하나도
 * 없으면 기존 회전 규칙 그대로다. 일반 적은 계속 4관문을 순환한다.
 */
export function bossSpawnProgress(openFormations: readonly number[], spawnIndex: number): number {
  const portalIndex = bossPortalForFormations(openFormations);
  return portalIndex === null ? spawnProgressForEnemy(spawnIndex) : (ENEMY_SPAWN_PROGRESS[portalIndex] as number);
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

/**
 * 개문 램프(v037) — 「2~30웨이브가 너무 강하다. 적이 너무 많고 빽빽하다」(사용자).
 *
 * 실측이 가리킨 뿌리는 **1웨이브가 시작 엽전으로 치워지지 않는다**는 것이었다.
 * 42엽전을 다 써 6기를 세워도 1웨이브(8체 × 869HP)를 합류 시계(스폰 뒤 20초)
 * 안에 못 잡고, 3기면 한 마리를 잡는 데 26초가 걸렸다. 그래서 준비 단계가
 * 한 번도 돌아오지 않고 웨이브가 겹겹이 쌓여 5웨이브 진입 때 14~34체가
 * 화면에 서 있었다 — 그것이 「빽빽함」의 정체다. 게이트 봇도 1웨이브를 8체
 * 가운데 6.5체밖에 못 잡고 합류로 넘어갔다(scripts/combat-tempo.ts).
 *
 * 전체 체력 계수(REGION_ENEMY_HP_CURVE)는 100웨이브 승률로 고정된 값이라
 * 건드리지 않고, **첫 서른 웨이브만** 몸수와 체력을 낮은 데서 출발시켜
 * 30웨이브에서 원래 곡선에 합류하게 한다. 1웨이브는 몸수 0.72 × 체력 0.32
 * ≈ 총 내구 0.23 — 3기(초당 93 피해)가 사정권 체류 95%로 20초 안에 치우는
 * 값이다(scripts/opening-probe.ts 로 다시 잰다).
 *
 * 몸수 램프는 20웨이브에, 체력 램프는 30웨이브에 닿는다. 몸수는 화면의
 * 「빽빽함」이자 글자를 읽을 여유이므로 먼저 원래대로 돌리고, 체력은 자령이
 * 진화·강화로 세지는 속도를 따라 천천히 올린다.
 */
export const OPENING_COUNT_RAMP = Object.freeze({ start: 0.66, waves: 20 } as const);
export const OPENING_HP_RAMP = Object.freeze({ start: 0.26, waves: 30 } as const);

function openingRamp(wave: number, ramp: { readonly start: number; readonly waves: number }): number {
  const t = Math.max(0, Math.min(1, (wave - 1) / (ramp.waves - 1)));
  return ramp.start + (1 - ramp.start) * t;
}

export function openingCountRamp(wave: number): number {
  return openingRamp(wave, OPENING_COUNT_RAMP);
}

export function openingHpRamp(wave: number): number {
  return openingRamp(wave, OPENING_HP_RAMP);
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
    count: Math.max(1, Math.round(baseCount * countFactor * openingCountRamp(wave))),
    hp: baseHp * hpFactor * openingHpRamp(wave),
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
