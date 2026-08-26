/*
 * 캔버스 포인터 입력 — 선택·끌기·화면 이동.
 */
import { BOARD_CELLS, BOARD_FORMATIONS, CELLS_PER_FORMATION, WORLD_HEIGHT, WORLD_WIDTH } from "../../core/content";
import { type Point, type Tower } from "../../core/types";
import { canvas, ctx, must, shell, sound } from "../app-context";
import { openFormationUnlockDialog } from "../dialogs/formation-unlock";
import { handleAction, setPanelTab, syncPanel } from "../hud";
import {
  constrainMapCamera,
  cycleGameSpeed,
  focusMapOnCells,
  resetMapCamera,
  setMapZoom,
  toggleHanjaEmphasis
} from "./camera";

let mapPanStartScreen: Point | null = null;

let mapPanStartOffset: Point | null = null;

let mapPanButton: 0 | 1 | null = null;

let mapPanMoved = false;

let mapPanClickCell = -1;

function towerAtCell(cell: number): Tower | undefined {
  return ctx.engine.state.towers.find((tower) => tower.cell === cell);
}

function canvasScreenPoint(event: MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * WORLD_WIDTH / rect.width, y: (event.clientY - rect.top) * WORLD_HEIGHT / rect.height };
}

function canvasPoint(event: PointerEvent): Point {
  const point = canvasScreenPoint(event);
  return { x: (point.x - ctx.mapOffset.x) / ctx.mapZoom, y: (point.y - ctx.mapOffset.y) / ctx.mapZoom };
}

/** 수련장 soft-lock 이 "이 클릭이 어느 칸인가"를 물을 때 쓰는 공개 판정. */
export function cellAtPointerEvent(event: PointerEvent): number {
  return cellAtPoint(canvasPoint(event));
}

function cellAtPoint(point: Point): number {
  return BOARD_CELLS.findIndex((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 21);
}

/**
 * 잠긴 진 중앙 자물쇠의 히트 영역.
 *
 * 자물쇠는 판 정중앙에 놓이는데 그 지점은 어느 칸의 반경(21px)에도 들지 않는다.
 * 그래서 칸 판정과 별개로 중앙 원을 따로 잡는다. 판 전체를 히트 영역으로 두면
 * 여백을 스칠 때마다 확인 창이 떠 오히려 방해가 되므로 자물쇠 크기(40px)에
 * 맞춘 반경만 받는다.
 */
const LOCK_HIT_RADIUS = 34;

function lockedFormationAtPoint(point: Point): number | null {
  const index = BOARD_FORMATIONS.findIndex((formation) =>
    Math.hypot(formation.center.x - point.x, formation.center.y - point.y) <= LOCK_HIT_RADIUS);
  if (index < 0 || ctx.engine.isFormationUnlocked(index)) return null;
  return index;
}

function beginMapPan(event: PointerEvent, button: 0 | 1, clickCell = -1): void {
  ctx.mapPanPointerId = event.pointerId;
  mapPanStartScreen = canvasScreenPoint(event);
  mapPanStartOffset = { ...ctx.mapOffset };
  mapPanButton = button;
  mapPanMoved = button === 1;
  mapPanClickCell = clickCell;
  if (button === 1) canvas.classList.add("is-panning");
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Panning still works while the pointer remains over the canvas.
  }
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireInput1(): void {
  canvas.addEventListener("pointerdown", (event) => {
    sound.unlock();
    if (ctx.engine.state.phase === "title" || ctx.engine.state.phase === "victory" || ctx.engine.state.phase === "defeat") return;
    if (event.button === 1) {
      event.preventDefault();
      beginMapPan(event, 1);
      return;
    }
    if (event.button !== 0) return;
    const point = canvasPoint(event);
    const cell = cellAtPoint(point);
    const occupant = cell >= 0 ? towerAtCell(cell) : undefined;
    event.preventDefault();
    if (occupant) {
      setPanelTab("unit");
      ctx.engine.selectTower(occupant.id);
      ctx.towerDragPointerId = event.pointerId;
      ctx.towerDragTowerId = occupant.id;
      ctx.towerDragStart = point;
      ctx.towerDragMoved = false;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; click selection still works without it.
      }
      ctx.evolutionRenderKey = "";
      ctx.selectedRenderKey = "";
      syncPanel();
    } else {
      // Empty board space keeps its ordinary click action, but becomes camera
      // panning once the pointer moves beyond the drag threshold.
      beginMapPan(event, 0, cell);
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId === ctx.mapPanPointerId && mapPanStartScreen && mapPanStartOffset) {
      const point = canvasScreenPoint(event);
      const distance = Math.hypot(point.x - mapPanStartScreen.x, point.y - mapPanStartScreen.y);
      if (!mapPanMoved && distance >= 7) {
        mapPanMoved = true;
        ctx.mapCameraGestures += 1;
        canvas.classList.add("is-panning");
      }
      if (!mapPanMoved) return;
      ctx.mapOffset = {
        x: mapPanStartOffset.x + point.x - mapPanStartScreen.x,
        y: mapPanStartOffset.y + point.y - mapPanStartScreen.y
      };
      constrainMapCamera();
      return;
    }
    const hoverPoint = canvasPoint(event);
    const hoverCell = cellAtPoint(hoverPoint);
    ctx.hoveredTowerId = hoverCell >= 0 ? towerAtCell(hoverCell)?.id ?? null : null;
    canvas.dataset.hoveredTowerId = ctx.hoveredTowerId === null ? "" : String(ctx.hoveredTowerId);
    // 자물쇠 위에서는 확대하고 커서를 손가락으로 바꿔 "눌린다"를 알린다.
    // 잠긴 칸도 같은 팝업으로 이어지므로 커서는 같이 바꾼다.
    const runActive = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
    ctx.hoveredLockFormation = runActive ? lockedFormationAtPoint(hoverPoint) : null;
    const overLockedCell = runActive && hoverCell >= 0 && !ctx.engine.isCellUnlocked(hoverCell);
    canvas.dataset.lockHover = ctx.hoveredLockFormation !== null || overLockedCell ? "1" : "";
    if (event.pointerId !== ctx.towerDragPointerId || !ctx.towerDragStart) return;
    const point = canvasPoint(event);
    if (Math.hypot(point.x - ctx.towerDragStart.x, point.y - ctx.towerDragStart.y) >= 10) ctx.towerDragMoved = true;
  });
}

function finishTowerDrag(event: PointerEvent, applyMove: boolean): void {
  if (event.pointerId !== ctx.towerDragPointerId) return;
  try {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  } catch {
    // The selected tower remains usable if capture was unavailable.
  }
  const draggedTowerId = ctx.towerDragTowerId;
  const moved = ctx.towerDragMoved;
  ctx.towerDragPointerId = null;
  ctx.towerDragTowerId = null;
  ctx.towerDragStart = null;
  ctx.towerDragMoved = false;
  if (!applyMove || !moved || draggedTowerId === null) return;
  const targetCell = cellAtPoint(canvasPoint(event));
  if (targetCell < 0) return;
  ctx.engine.selectTower(draggedTowerId);
  sound.expectPlacement();
  handleAction(ctx.engine.relocateSelectedToCell(targetCell));
}

function finishMapPan(event: PointerEvent, applyClick: boolean): boolean {
  if (event.pointerId !== ctx.mapPanPointerId) return false;
  try {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  } catch {
    // The camera remains at the last valid offset if capture was unavailable.
  }
  const button = mapPanButton;
  const moved = mapPanMoved;
  const clickCell = mapPanClickCell;
  ctx.mapPanPointerId = null;
  mapPanStartScreen = null;
  mapPanStartOffset = null;
  mapPanButton = null;
  mapPanMoved = false;
  mapPanClickCell = -1;
  canvas.classList.remove("is-panning");
  if (applyClick && button === 0 && !moved) {
    // 잠긴 칸과 판 중앙 자물쇠는 같은 확인 팝업으로 모은다. 예전에는 클릭 즉시
    // 엽전이 빠져나가 무슨 일이 벌어졌는지 알 수 없었다.
    if (clickCell >= 0) {
      if (!ctx.engine.isCellUnlocked(clickCell)) openFormationUnlockDialog(Math.floor(clickCell / CELLS_PER_FORMATION));
      else { sound.expectPlacement(); handleAction(ctx.engine.moveSelectedToCell(clickCell)); }
    } else {
      const lockedFormation = lockedFormationAtPoint(canvasPoint(event));
      if (lockedFormation !== null) {
        openFormationUnlockDialog(lockedFormation);
      } else {
        ctx.engine.selectTower(null);
        ctx.evolutionRenderKey = "";
        ctx.selectedRenderKey = "";
        syncPanel();
      }
    }
  }
  return true;
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireInput2(): void {
  canvas.addEventListener("pointerup", (event) => {
    if (!finishMapPan(event, true)) finishTowerDrag(event, true);
  });
  canvas.addEventListener("pointerleave", () => {
    if (ctx.mapPanPointerId !== null || ctx.towerDragPointerId !== null) return;
    ctx.hoveredTowerId = null;
    canvas.dataset.hoveredTowerId = "";
    ctx.hoveredLockFormation = null;
    canvas.dataset.lockHover = "";
  });
  canvas.addEventListener("pointercancel", (event) => {
    if (!finishMapPan(event, false)) finishTowerDrag(event, false);
  });
  // 게임 화면에서는 텍스트 드래그 선택·이미지 끌기·우클릭 메뉴를 막는다.
  // 입력창은 예외로 두어 시드 입력과 검색은 그대로 쓸 수 있다.
  shell.addEventListener("contextmenu", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea")) return;
    event.preventDefault();
  });
  shell.addEventListener("dragstart", (event) => event.preventDefault());
  document.addEventListener("selectstart", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea")) return;
    event.preventDefault();
  });
  canvas.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const anchor = canvasScreenPoint(event);
    const before = ctx.mapZoom;
    setMapZoom(ctx.mapZoom * Math.exp(-event.deltaY * 0.0012), anchor);
    if (ctx.mapZoom !== before) ctx.mapCameraGestures += 1;
  }, { passive: false });
  must<HTMLButtonElement>("#map-zoom-reset").addEventListener("click", resetMapCamera);
  must<HTMLButtonElement>("#hanja-emphasis-toggle").addEventListener("click", toggleHanjaEmphasis);
  // 발동 성어 배지를 누르면 그 성어를 이룬 네 칸으로 카메라가 간다.
  must<HTMLElement>("#active-idioms").addEventListener("click", (event) => {
    const idiomId = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-active-idiom]")?.dataset.activeIdiom;
    if (!idiomId) return;
    const seal = ctx.engine.state.idiomSeals.find((candidate) => candidate.idiomId === idiomId);
    if (seal) focusMapOnCells(seal.cells);
  });
  must<HTMLButtonElement>("#speed-button").addEventListener("click", cycleGameSpeed);
}
