/*
 * 전장 부동 라벨의 무대 경계·겹침 규칙 — [S/P-12].
 *
 * 전장 위 글자(피해 수치, 장판 이름, 명패)는 모두 월드 좌표를 따라다닌다.
 * 카메라가 밀리거나 개체가 가장자리에 서면 그 글자가 무대 밖으로 나가
 * x<0 에서 통째로 잘리거나, 무대 위·아래에 붙박인 UI(상단 웨이브 칩 띠,
 * 좌하단 조작 칩) 밑으로 들어가 읽히지 않았다. 실측 사례:
 *   · `약점 41` 피해 수치가 좌하단 조작 칩과 겹치며 x<0 으로 잘림
 *   · 최상단 줄 자령의 이름표가 상단 웨이브 칩에 가림
 *
 * 규칙은 셋이다.
 *   ① 무대 안전 영역 밖으로는 나가지 않는다(경계 클램프).
 *   ② 그린 라벨은 제 자리를 등록한다(reserve).
 *   ③ 같은 자리에 겹치면 가까운 빈 곳으로 비킨다(피해 수치처럼 여러 개가
 *      한 점에서 뜨는 것).
 *
 * ②·③ 이 갈라져 있는 이유 — 2차 감사 실측.
 *   1차에서는 자리 등록이 회피(③)를 켠 호출부 안에만 있었다. `avoidOverlap:true`
 *   를 넘기는 것은 피해 플로터뿐이라, 명패·능력 배너·오행진 이름표는 자리를
 *   등록하지 않았고 곧 회피 대상도 아니었다. 그 결과 웨이브 60·자령 16기에서
 *     · "약점 171" 이 `巖 바위 암` 명패를
 *     · "225/236" 이 `鍛 파갑 단조` 능력 배너를
 *   통째로 덮었다(피해 수치는 명패보다 뒤에 그려져 위층이다).
 *   그래서 "자리는 등록하되 스스로는 회피하지 않는" 길을 연다. 명패·배너·진
 *   이름표는 제자리에 못 박힌 글자라 밀 수 없지만, 밀 수 있는 피해 수치가
 *   그 위로 사다리를 타면 겹침이 사라진다.
 *
 * 좌표계 주의: 캔버스 뷰포트는 WORLD_WIDTH×WORLD_HEIGHT 화면 px 이고
 * (draw.ts 의 isWorldPointVisible 이 같은 가정을 쓴다), 월드 좌표는 그 위에
 * mapOffset·mapZoom 으로 얹힌다. 클램프 셈은 전부 화면 px 로 한다 —
 * 안전 영역은 배율과 무관하게 화면에 고정된 띠이기 때문이다.
 */
import { WORLD_HEIGHT, WORLD_WIDTH } from "../../core/content";
import { ctx } from "../app-context";

/**
 * 무대 가장자리에서 비워 두는 띠(화면 px).
 *
 * 위 71px — 처음 잴 때 상단 칩 줄만 보고 46+6=52 로 잡았는데, 칩 줄 아래에
 * 웨이브 진행 레일이 한 줄 더 있다. 그 줄을 빼먹은 탓에 최상단 줄 명패가
 * 52~92 에 서서 판의 13px, 한자 잉크의 5px 을 레일에 내주고 "위가 잘린"
 * 것처럼 읽혔다. 그래서 바닥이 더 낮은 레일을 기준으로 65+6 = 71 로 잡는다.
 *
 * 실측(캔버스 논리 880x720 px): `.stage-topbar` 바닥 51~52 ·
 * `.wave-progress` 56~65(x 16~864). 이 수는 해상도를 타지 않는다 —
 * 280-r8-stage.css 가 무대를 1280x720 설계 좌표에 고정하고 `--stage-scale`
 * 로 통째 확대하므로, 1920x1080 이든 세로 태블릿이든 수련장이든 레일은
 * 같은 논리좌표 56~65 에 선다.
 *
 * 아래 44px 은 좌하단 조작 칩 줄(윗변 y≈686)에 같은 여유를 준 값이다.
 * 조판이 바뀌면 이 두 수를 다시 재야 한다 — e2e 가 실제 상자로 지킨다.
 *
 * 이 띠가 덮는 것은 "무대에 붙박인 크롬"뿐이다. 일시정지 칩처럼 떴다
 * 사라지는 오버레이는 여기 들어오지 않는다 — 대신 그쪽이 이 띠 아래
 * 명패 자리를 비켜 서게 했다(660-pause-chip-clear.css).
 */
export const STAGE_SAFE_AREA = Object.freeze({ top: 71, right: 6, bottom: 44, left: 6 });

/**
 * 라벨의 갈래. 회피 규칙에는 쓰지 않고, 자리 다툼을 사람이 읽을 수 있게
 * 갈라 두는 이름표다 — e2e 가 "피해 수치 × 그 밖의 라벨" 겹침만 센다.
 */
export type StageLabelKind = "plaque" | "ability" | "zone" | "damage";

export interface StageLabelBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly kind: StageLabelKind;
}

/** 이번 프레임에 이미 자리를 잡은 라벨들(화면 px). 겹침 회피가 참고한다. */
const occupied: StageLabelBox[] = [];

/**
 * 한 프레임에 자리를 기억할 라벨 수 상한 — 난전에서 비교 비용이 터지지 않게.
 *
 * 명패까지 등록하게 되면서 상한이 곧 예산이 됐다. 명패는 피해 수치보다 먼저
 * 등록되므로(draw.ts: flushTowerPlaques → updateAndDrawFx) 상한이 낮으면
 * 명패가 예산을 다 먹고 피해 수치가 자기들끼리 다시 쌓인다. 판 전체를 덮는
 * 자령 상한은 80기(진 5 × 16칸)이고 능력 배너가 그만큼 더 뜰 수 있으니,
 * 그 위에 피해 수치 몫을 얹어 200 으로 잡는다.
 */
const MAX_TRACKED = 200;

/** 프레임 시작마다 부른다. 지난 프레임의 자리는 지금 프레임과 무관하다. */
export function resetStageLabels(): void {
  occupied.length = 0;
}

/** QA·e2e 읽기 — 방금 그린 프레임이 잡은 라벨 자리들(화면 px). */
export function stageLabelBoxes(): readonly StageLabelBox[] {
  return occupied;
}

/**
 * 화면 px 상자를 자리로만 등록한다 — 스스로는 밀지 않는다.
 *
 * 명패처럼 역-스케일 안에서 이미 화면 px 로 그려진 라벨의 통로다. 월드 좌표를
 * 되돌려 넘기면 배율 나눗셈이 두 번 끼어 상자가 어긋난다.
 */
export function reserveScreenBox(left: number, top: number, width: number, height: number, kind: StageLabelKind): void {
  if (occupied.length >= MAX_TRACKED) return;
  occupied.push({ left, top, right: left + width, bottom: top + height, kind });
}

function overlaps(left: StageLabelBox, right: StageLabelBox): boolean {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

/**
 * 화면 좌표 상자를 안전 영역 안으로 밀 거리.
 *
 * 상자가 안전 영역보다 크면(과확대 등) 밀 곳이 없다 — 그때는 왼쪽·위를 맞춰
 * 적어도 글자의 앞머리가 보이게 한다.
 */
export function clampScreenBox(left: number, top: number, width: number, height: number): { dx: number; dy: number } {
  const minLeft = STAGE_SAFE_AREA.left;
  const maxRight = WORLD_WIDTH - STAGE_SAFE_AREA.right;
  const minTop = STAGE_SAFE_AREA.top;
  const maxBottom = WORLD_HEIGHT - STAGE_SAFE_AREA.bottom;
  let dx = 0;
  if (left + width > maxRight) dx = maxRight - width - left;
  if (left + dx < minLeft) dx = minLeft - left;
  let dy = 0;
  if (top + height > maxBottom) dy = maxBottom - height - top;
  if (top + dy < minTop) dy = minTop - top;
  return { dx, dy };
}

/** 상자를 (dx, dy) 만큼 옮긴 새 상자 — 안전 영역 클램프까지 함께 태운다. */
function shiftBox(box: StageLabelBox, dx: number, dy: number, width: number, height: number): StageLabelBox {
  const nudge = clampScreenBox(box.left + dx, box.top + dy, width, height);
  return {
    left: box.left + dx + nudge.dx,
    top: box.top + dy + nudge.dy,
    right: box.right + dx + nudge.dx,
    bottom: box.bottom + dy + nudge.dy,
    kind: box.kind
  };
}

/**
 * 이 상자를 막는 것 하나. 여러 개가 막으면 가는 방향의 가장 먼 것을 고른다 —
 * 위로 갈 때는 윗변이 가장 높은 것, 아래로 갈 때는 밑변이 가장 낮은 것.
 * 한 걸음에 무리 전체를 넘어야 사다리가 제자리걸음하지 않는다.
 */
function blockerOf(box: StageLabelBox, sign: -1 | 1): StageLabelBox | null {
  let best: StageLabelBox | null = null;
  for (const other of occupied) {
    if (!overlaps(box, other)) continue;
    if (best === null) best = other;
    else if (sign < 0 ? other.top < best.top : other.bottom > best.bottom) best = other;
  }
  return best;
}

/**
 * 이미 잡힌 자리를 피해 빈 곳으로 미끄러뜨린다.
 *
 * [2차 감사 후속] 옛 규칙은 "제 높이 + 3px" 라는 고정 칸으로 위로만 밀었다.
 * 피해 수치끼리만 다툴 때는 그 칸이 곧 서로의 간격이라 맞아떨어졌지만,
 * 명패까지 자리를 차지하게 되자 두 가지가 한꺼번에 무너졌다(웨이브 60 ·
 * 자령 16기 · 240프레임 실측).
 *   ① 고정 칸이 빈틈을 넘겨 짚는다. 기본 배율 2.0 에서 명패는 40px 높이로
 *      88px 간격에 서서 48px 빈틈을 남기고 피해 수치는 39.7px 이다 —
 *      들어갈 자리가 있는데 43px 씩 밀다 보니 다음 명패에 다시 얹혔다.
 *   ② 위로만 밀면 4줄짜리 진의 명패 벽을 통째로 넘어야 해서, 수치가 제 적을
 *      250px 두고 천장(안전 영역 상단 52px)에 몰려 서로 겹쳤다.
 * 그래서 ① 막은 상자의 변에 딱 붙을 만큼만 옮기고, ② 위·아래 중 덜 움직이는
 * 쪽을 첫 걸음에 골라 그 방향으로만 사다리를 탄다(왔다 갔다 하지 않게).
 * 고른 쪽이 안전 영역 벽에 막혀 끝내 못 비키면 반대쪽을 한 번 더 시도하고,
 * 그래도 못 가면 그 자리에 둔다 — 겹쳐 읽히는 편이, 무대 밖으로 나가
 * 아예 안 보이는 것보다 낫다.
 */
function slideClear(start: StageLabelBox, width: number, height: number): StageLabelBox {
  const first = blockerOf(start, -1);
  if (first === null) return start;
  const up = start.bottom - first.top + 3;
  const down = first.bottom - start.top + 3;
  const preferred: -1 | 1 = up <= down ? -1 : 1;
  const climbed = climb(start, preferred, width, height);
  if (blockerOf(climbed, preferred) === null) return climbed;
  const other: -1 | 1 = preferred < 0 ? 1 : -1;
  const fallback = climb(start, other, width, height);
  return blockerOf(fallback, other) === null ? fallback : climbed;
}

/** 한 방향으로만 사다리를 탄다. sign -1 은 위, +1 은 아래. */
function climb(start: StageLabelBox, sign: -1 | 1, width: number, height: number): StageLabelBox {
  let box = start;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const blocker = blockerOf(box, sign);
    if (blocker === null) break;
    const step = sign < 0 ? box.bottom - blocker.top + 3 : blocker.bottom - box.top + 3;
    if (step <= 0) break;
    const next = shiftBox(box, 0, sign * step, width, height);
    // 클램프에 막혀 제자리면 더 갈 곳이 없다.
    if (sign < 0 ? next.top >= box.top : next.top <= box.top) break;
    box = next;
  }
  return box;
}

/**
 * 월드 좌표의 라벨 중심을 받아, 무대 안에서 실제로 그릴 월드 좌표를 돌려준다.
 *
 * halfWidth·halfHeight 는 월드 단위(그리는 쪽의 좌표계)로 준다 — 라벨은
 * 변환 안에서 그려지므로 글꼴 크기도 월드 단위다.
 *
 * 자리 등록은 언제나 한다(reserve). `avoidOverlap` 은 "먼저 등록된 자리를
 * 피해 위로 올라탈지"만 정한다.
 */
export function placeStageLabel(
  worldX: number,
  worldY: number,
  halfWidth: number,
  halfHeight: number,
  options: { avoidOverlap?: boolean; kind?: StageLabelKind } = {}
): { x: number; y: number } {
  const zoom = ctx.mapZoom;
  const width = halfWidth * 2 * zoom;
  const height = halfHeight * 2 * zoom;
  const centerX = ctx.mapOffset.x + worldX * zoom;
  const centerY = ctx.mapOffset.y + worldY * zoom;
  const kind = options.kind ?? "damage";
  const first = clampScreenBox(centerX - width / 2, centerY - height / 2, width, height);
  let box: StageLabelBox = {
    left: centerX - width / 2 + first.dx,
    top: centerY - height / 2 + first.dy,
    right: centerX + width / 2 + first.dx,
    bottom: centerY + height / 2 + first.dy,
    kind
  };
  if (options.avoidOverlap) box = slideClear(box, width, height);
  if (occupied.length < MAX_TRACKED) occupied.push(box);
  return {
    x: ((box.left + box.right) / 2 - ctx.mapOffset.x) / zoom,
    y: ((box.top + box.bottom) / 2 - ctx.mapOffset.y) / zoom
  };
}
