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
 * 규칙은 둘이다.
 *   ① 무대 안전 영역 밖으로는 나가지 않는다(경계 클램프).
 *   ② 같은 자리에 겹치면 위로 민다(피해 수치처럼 여러 개가 한 점에서 뜨는 것).
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
 * 위 52px 은 상단 칩 줄(웨이브·지역·장·적 한계, 바닥 y≈46)에 6px 을 더한 값,
 * 아래 44px 은 좌하단 조작 칩 줄(윗변 y≈686)에 같은 여유를 준 값이다.
 * 조판이 바뀌면 이 두 수를 다시 재야 한다 — e2e 가 실제 상자로 지킨다.
 */
export const STAGE_SAFE_AREA = Object.freeze({ top: 52, right: 6, bottom: 44, left: 6 });

interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 이번 프레임에 이미 자리를 잡은 라벨들(화면 px). 겹침 회피가 참고한다. */
const occupied: ScreenBox[] = [];

/** 한 프레임에 자리를 기억할 라벨 수 상한 — 난전에서 비교 비용이 터지지 않게. */
const MAX_TRACKED = 48;

/** 프레임 시작마다 부른다. 지난 프레임의 자리는 지금 프레임과 무관하다. */
export function resetStageLabels(): void {
  occupied.length = 0;
}

function overlaps(left: ScreenBox, right: ScreenBox): boolean {
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

/**
 * 월드 좌표의 라벨 중심을 받아, 무대 안에서 실제로 그릴 월드 좌표를 돌려준다.
 *
 * halfWidth·halfHeight 는 월드 단위(그리는 쪽의 좌표계)로 준다 — 라벨은
 * 변환 안에서 그려지므로 글꼴 크기도 월드 단위다.
 */
export function placeStageLabel(
  worldX: number,
  worldY: number,
  halfWidth: number,
  halfHeight: number,
  options: { avoidOverlap?: boolean } = {}
): { x: number; y: number } {
  const zoom = ctx.mapZoom;
  const width = halfWidth * 2 * zoom;
  const height = halfHeight * 2 * zoom;
  const centerX = ctx.mapOffset.x + worldX * zoom;
  const centerY = ctx.mapOffset.y + worldY * zoom;
  const first = clampScreenBox(centerX - width / 2, centerY - height / 2, width, height);
  let box: ScreenBox = {
    left: centerX - width / 2 + first.dx,
    top: centerY - height / 2 + first.dy,
    right: centerX + width / 2 + first.dx,
    bottom: centerY + height / 2 + first.dy
  };
  if (options.avoidOverlap) {
    // 위로 한 칸씩 민다. 안전 영역 천장에 닿으면 더 밀지 않고 그 자리에 둔다
    // (겹쳐 읽히는 편이, 무대 밖으로 나가 아예 안 보이는 것보다 낫다).
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (!occupied.some((other) => overlaps(box, other))) break;
      const lift = height + 3;
      const nudge = clampScreenBox(box.left, box.top - lift, width, height);
      const next: ScreenBox = {
        left: box.left + nudge.dx,
        top: box.top - lift + nudge.dy,
        right: box.right + nudge.dx,
        bottom: box.bottom - lift + nudge.dy
      };
      if (next.top >= box.top) break;
      box = next;
    }
    if (occupied.length < MAX_TRACKED) occupied.push(box);
  }
  return {
    x: ((box.left + box.right) / 2 - ctx.mapOffset.x) / zoom,
    y: ((box.top + box.bottom) / 2 - ctx.mapOffset.y) / zoom
  };
}
