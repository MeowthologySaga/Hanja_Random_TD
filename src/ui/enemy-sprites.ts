/**
 * 적 전용 스프라이트 시트 로더.
 *
 * 출처: handoff/to-claude/urgent-p0-enemy-altar-pack-v1/assets/enemies/
 * 설치: public/assets/enemies/p0-v1/
 *
 * 아군 자령 시트는 2×2(4프레임) 레이아웃이라 `jaryeong-sprites.ts` 캐시를 그대로
 * 쓰면 세로 절반이 잘린다. 적 시트는 1행 2열 512×256이므로 별도 캐시를 둔다.
 * 로드에 실패하면 호출부가 기존 아군 자령 시트로 되돌아간다.
 */

import type { EnemyArchetype } from "../core/types";

export type EnemySpriteState = "loading" | "ready" | "error";

/** 시트 한 프레임의 정사각 크기. 소스 사각형은 `(frame * 256, 0, 256, 256)`이다. */
export const ENEMY_FRAME_SIZE = 256;
const SHEET_WIDTH = ENEMY_FRAME_SIZE * 2;
const SHEET_HEIGHT = ENEMY_FRAME_SIZE;

const ENEMY_SHEET_FILES: Readonly<Record<EnemyArchetype, string>> = Object.freeze({
  normal: "enemy-ghost-procession-idle-2frame-v1.png",
  swarm: "enemy-hundred-demons-idle-2frame-v1.png",
  swift: "enemy-gale-hungry-ghost-idle-2frame-v1.png",
  armored: "enemy-armored-jiangshi-idle-2frame-v1.png",
  regenerator: "enemy-regenerating-yokai-idle-2frame-v1.png",
  boss: "enemy-seal-breaker-boss-idle-2frame-v1.png"
});

/**
 * 프레임 위쪽 투명 여백의 실측 비율(알파 bbox / 256).
 *
 * 측정 기준: 알파 ≥ 140 픽셀이 한 행에 6개 이상 나타나는 첫 행, 두 프레임 중 더
 * 높이 솟은 쪽. 알파 1 이상까지 세면 눈에 보이지 않는 연기 꼬리까지 잡혀 HP 바가
 * 그림에서 떠 보이므로, 실제로 읽히는 획이 시작하는 행을 앵커로 쓴다.
 *
 * 알파1 bbox 대비: normal 0.188→0.199 / swarm 0.078→0.133 / swift 0.211→0.238 /
 * armored 0.078→0.094 / regenerator 0.211→0.223 / boss 0.254→0.266
 */
const ENEMY_ART_TOP_MARGIN: Readonly<Record<EnemyArchetype, number>> = Object.freeze({
  normal: 0.199,
  swarm: 0.133,
  swift: 0.238,
  armored: 0.094,
  regenerator: 0.223,
  boss: 0.266
});

/** 아군 자령 시트로 폴백했을 때 쓰던 기존 계수. */
export const FALLBACK_ART_TOP_FACTOR = 0.3;

/**
 * 표시 크기에 곱해 스프라이트 윗변까지의 거리를 얻는 계수.
 * 프레임은 중심 정렬로 그리므로 윗변은 `중심 - drawSize × (0.5 - 여백비율)`이다.
 */
export function enemyArtTopFactor(archetype: EnemyArchetype): number {
  return 0.5 - ENEMY_ART_TOP_MARGIN[archetype];
}

interface SheetEntry {
  readonly image: HTMLImageElement;
  state: EnemySpriteState;
}

const sheets = new Map<EnemyArchetype, SheetEntry>();

function loadSheet(archetype: EnemyArchetype): SheetEntry {
  const file = ENEMY_SHEET_FILES[archetype];
  const path = `${import.meta.env.BASE_URL}assets/enemies/p0-v1/${file}`;
  const image = new Image();
  const entry: SheetEntry = { image, state: "loading" };
  image.decoding = "async";
  image.addEventListener("load", () => {
    if (image.naturalWidth === SHEET_WIDTH && image.naturalHeight === SHEET_HEIGHT) {
      entry.state = "ready";
      return;
    }
    // 잘못된 natural size는 성공으로 치지 않는다. 잘려 그리느니 폴백이 낫다.
    entry.state = "error";
    console.warn(`[enemy-sprites] 크기 불일치: ${path} (기대 ${SHEET_WIDTH}×${SHEET_HEIGHT}, 실제 ${image.naturalWidth}×${image.naturalHeight})`);
  });
  image.addEventListener("error", () => {
    entry.state = "error";
    console.warn(`[enemy-sprites] 로드 실패: ${path}`);
  });
  image.src = path;
  sheets.set(archetype, entry);
  return entry;
}

function entryFor(archetype: EnemyArchetype): SheetEntry {
  return sheets.get(archetype) ?? loadSheet(archetype);
}

export function enemySheetImage(archetype: EnemyArchetype): HTMLImageElement {
  return entryFor(archetype).image;
}

export function enemySheetState(archetype: EnemyArchetype): EnemySpriteState {
  return entryFor(archetype).state;
}

/** 한 아키타입이 실패해도 나머지 다섯은 전용 시트를 계속 쓴다. */
export function isEnemySheetReady(archetype: EnemyArchetype): boolean {
  return entryFor(archetype).state === "ready";
}

export function preloadEnemySprites(): void {
  for (const archetype of Object.keys(ENEMY_SHEET_FILES) as EnemyArchetype[]) entryFor(archetype);
}

/** 개발 진단용. 프로덕션 화면에는 노출하지 않고 `canvas.dataset`에만 남긴다. */
export function enemySheetStateSummary(): string {
  return (Object.keys(ENEMY_SHEET_FILES) as EnemyArchetype[])
    .map((archetype) => `${archetype}:${entryFor(archetype).state}`)
    .join(",");
}
