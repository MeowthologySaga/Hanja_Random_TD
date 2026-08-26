/*
 * 지도 카메라(확대·이동·초점)와 속도·강조 전환.
 */
import { BOARD_CELLS, BOARD_FORMATIONS, WORLD_HEIGHT, WORLD_WIDTH } from "../../core/content";
import { type Point, type SummonIntent } from "../../core/types";
import {
  BASE_MAP_ZOOM,
  canvas,
  ctx,
  DEFAULT_MAP_ZOOM,
  defaultMapOffset,
  type GameSpeed,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  must,
  shell,
  sound
} from "../app-context";
import { handleAction, showToast } from "../hud";
import { plaqueIsGlyphOnly } from "./draw-tower";

/** 여러 칸의 무게중심으로 카메라를 옮긴다. 발동 성어 배지가 이걸 쓴다. */
export function focusMapOnCells(cells: readonly number[]): void {
  const points = cells.map((cell) => BOARD_CELLS[cell]).filter((point): point is Point => Boolean(point));
  if (points.length === 0) return;
  const center = points.reduce(
    (total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }),
    { x: 0, y: 0 }
  );
  ctx.mapOffset = { x: WORLD_WIDTH / 2 - center.x * ctx.mapZoom, y: WORLD_HEIGHT / 2 - center.y * ctx.mapZoom };
  constrainMapCamera();
  syncMapZoomControl();
}

export function constrainMapCamera(): void {
  const scaledWidth = WORLD_WIDTH * ctx.mapZoom;
  const scaledHeight = WORLD_HEIGHT * ctx.mapZoom;
  ctx.mapOffset = {
    x: scaledWidth <= WORLD_WIDTH
      ? (WORLD_WIDTH - scaledWidth) / 2
      : Math.min(0, Math.max(WORLD_WIDTH - scaledWidth, ctx.mapOffset.x)),
    y: scaledHeight <= WORLD_HEIGHT
      ? (WORLD_HEIGHT - scaledHeight) / 2
      : Math.min(0, Math.max(WORLD_HEIGHT - scaledHeight, ctx.mapOffset.y))
  };
  canvas.dataset.mapOffsetX = ctx.mapOffset.x.toFixed(1);
  canvas.dataset.mapOffsetY = ctx.mapOffset.y.toFixed(1);
}

export function syncMapZoomControl(): void {
  const displayZoom = Math.round(ctx.mapZoom / BASE_MAP_ZOOM * 100);
  must<HTMLElement>("#map-zoom-value").textContent = `${displayZoom}%`;
  canvas.dataset.mapZoom = ctx.mapZoom.toFixed(2);
  canvas.dataset.mapZoomDisplay = String(displayZoom);
  canvas.dataset.mapOffsetX = ctx.mapOffset.x.toFixed(1);
  canvas.dataset.mapOffsetY = ctx.mapOffset.y.toFixed(1);
  // 84px compact 명패가 이웃과 4px 이상 떨어질 수 없는 배율에서만 한자만 남긴다.
  canvas.dataset.labelDensity = plaqueIsGlyphOnly() ? "glyph" : "reading";
  canvas.dataset.hanjaEmphasis = String(ctx.hanjaEmphasis);
}

export function resetMapCamera(): void {
  ctx.mapZoom = DEFAULT_MAP_ZOOM;
  ctx.mapOffset = defaultMapOffset();
  constrainMapCamera();
  syncMapZoomControl();
}

export function setMapZoom(nextZoom: number, anchor: Point = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }): void {
  const worldAtAnchor = {
    x: (anchor.x - ctx.mapOffset.x) / ctx.mapZoom,
    y: (anchor.y - ctx.mapOffset.y) / ctx.mapZoom
  };
  ctx.mapZoom = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, nextZoom));
  ctx.mapOffset = {
    x: anchor.x - worldAtAnchor.x * ctx.mapZoom,
    y: anchor.y - worldAtAnchor.y * ctx.mapZoom
  };
  constrainMapCamera();
  syncMapZoomControl();
}

function focusMapOnSelectedTower(): void {
  const tower = ctx.engine.selectedTower();
  const startingFormation = ctx.engine.state.startingFormationIndex === null
    ? undefined
    : BOARD_FORMATIONS[ctx.engine.state.startingFormationIndex];
  const cell = tower && tower.cell >= 0
    ? BOARD_CELLS[tower.cell]
    : ctx.engine.state.summonCount === 1 ? startingFormation?.center : undefined;
  if (!cell) return;
  ctx.mapOffset = {
    x: WORLD_WIDTH / 2 - cell.x * ctx.mapZoom,
    y: WORLD_HEIGHT / 2 - cell.y * ctx.mapZoom
  };
  constrainMapCamera();
  syncMapZoomControl();
}

/** 새로 열린 진으로 화면을 옮겨 "무엇이 열렸는지"를 눈으로 잇는다. */
export function focusMapOnFormation(formationIndex: number): void {
  const center = BOARD_FORMATIONS[formationIndex]?.center;
  if (!center) return;
  ctx.mapOffset = {
    x: WORLD_WIDTH / 2 - center.x * ctx.mapZoom,
    y: WORLD_HEIGHT / 2 - center.y * ctx.mapZoom
  };
  constrainMapCamera();
  syncMapZoomControl();
}

export function summonAndFocus(amount = 1, intent: SummonIntent = "balanced"): void {
  sound.unlock();
  const result = amount === 1 ? ctx.engine.summonProduct(intent) : ctx.engine.summonMany(amount);
  handleAction(result);
  if (result.ok) focusMapOnSelectedTower();
}

/** 성어 기원 카드 전용 — 추적 성어의 부족 글자만 부르는 소환(트랙 F). */
export function summonIdiomWishAndFocus(): void {
  sound.unlock();
  const result = ctx.engine.summonIdiomWish();
  handleAction(result);
  if (result.ok) focusMapOnSelectedTower();
}

export function setGameSpeed(speed: GameSpeed): void {
  ctx.gameSpeed = speed;
  const button = must<HTMLButtonElement>("#speed-button");
  button.textContent = `${speed}×`;
  button.setAttribute("aria-label", `게임 배속 ${speed}배`);
  button.classList.toggle("is-accelerated", speed > 1);
  shell.dataset.gameSpeed = String(speed);
}

export function cycleGameSpeed(): void {
  setGameSpeed(ctx.gameSpeed === 1 ? 2 : ctx.gameSpeed === 2 ? 3 : 1);
}

export function toggleHanjaEmphasis(): void {
  ctx.hanjaEmphasis = !ctx.hanjaEmphasis;
  const button = must<HTMLButtonElement>("#hanja-emphasis-toggle");
  button.classList.toggle("is-on", ctx.hanjaEmphasis);
  button.setAttribute("aria-pressed", String(ctx.hanjaEmphasis));
  must<HTMLElement>("#hanja-emphasis-toggle strong").textContent = ctx.hanjaEmphasis ? "ON" : "OFF";
  syncMapZoomControl();
  showToast(ctx.hanjaEmphasis ? "한자 강조 ON · 큰 한자와 훈독을 고정 크기로 표시" : "한자 강조 OFF · 머리 위 표찰 숨김 · 별 표시는 유지");
}
