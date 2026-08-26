/*
 * 전장 캔버스 그리기 — 자령 본체·명패·팝오버.
 */
import { CASUAL_STAR_COLORS } from "../../core/casual";
import {
  BOARD_CELLS,
  CELLS_PER_FORMATION,
  FORMATION_COLUMNS,
  FORMATION_ROWS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "../../core/content";
import { definitionForTower, ELEMENT_STYLES, STAGE_COLORS } from "../../core/hanzi";
import { jaryeongFrameLayout, jaryeongVisualFor } from "../../core/jaryeongs";
import { koreanMeaningExplanation } from "../../core/korean-meaning-explanations";
import { learningInfo } from "../../core/learning";
import { type CasualStar, type HanziDefinition, type Point, type Tower } from "../../core/types";
import { UNCOMBINABLE_STAGE_ONE_COLOR } from "../codex-synthesis";
import { jaryeongSpriteImage } from "../jaryeong-sprites";
import { NAMEPLATE_LAYOUT, nameplateImage, type NameplateKind, nameplateReady } from "../nameplate-sprites";
import { compactReading, type CompactReading, type MeasureText } from "../plaque-text";
import { canvas, context, ctx, reducedMotion } from "../app-context";
import { casualStarOf, towerProgressionLabel } from "../format";
import { drawIdiomOrderBadge } from "./draw";
import { towerAbilityPopups } from "./fx";

function drawChargeRing(
  cell: Point,
  radius: number,
  tower: Tower,
  abilities: HanziDefinition["combat"]["abilities"]
): void {
  if (!ctx.engine.towerHasActiveSkills(tower)) return;
  const charge = (tower.shotCount % abilities.tuning.signatureEvery) / abilities.tuning.signatureEvery;
  context.strokeStyle = "rgba(255,255,255,0.1)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(cell.x, cell.y, radius, -Math.PI / 2, Math.PI * 1.5);
  context.stroke();
  if (charge > 0) {
    context.strokeStyle = abilities.role.color;
    context.shadowColor = abilities.role.color;
    context.shadowBlur = 9;
    context.beginPath();
    context.arc(cell.x, cell.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
    context.stroke();
    context.shadowBlur = 0;
  }
}

function drawStudyTower(tower: Tower, cell: Point, definition: HanziDefinition, selected: boolean, material: boolean): void {
  const abilities = definition.combat.abilities;
  const style = ELEMENT_STYLES[tower.wuxing];
  const progressionRank = ctx.engine.state.mode === "casual" ? casualStarOf(tower) : tower.stage;
  const progressionColor = ctx.engine.state.mode === "casual" ? CASUAL_STAR_COLORS[casualStarOf(tower)] : STAGE_COLORS[tower.stage];
  const pulse = 1 + tower.pulse * 0.09;
  const radius = (16 + (progressionRank - 1) * 0.55) * pulse;
  context.shadowColor = material ? "#ffe7a3" : style.glow;
  context.shadowBlur = material ? 28 : selected ? 22 : 10 + progressionRank * 1.5;
  const gradient = context.createRadialGradient(cell.x - 3, cell.y - 4, 2, cell.x, cell.y, radius);
  gradient.addColorStop(0, style.color + "ee");
  gradient.addColorStop(0.28, style.color + "88");
  gradient.addColorStop(1, "#111925");
  context.fillStyle = gradient;
  context.strokeStyle = material ? "#fff0b7" : selected ? "#ffffff" : progressionColor;
  context.lineWidth = material || selected ? 2 : 1 + progressionRank * 0.11;
  context.beginPath();
  context.arc(cell.x, cell.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  drawChargeRing(cell, radius + 3, tower, abilities);
  context.fillStyle = "#fbfdff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 ' + String(17 + Math.min(6, progressionRank)) + 'px "Malgun Gothic", "Noto Sans CJK KR", serif';
  context.fillText(tower.char, cell.x, cell.y - 2);
  context.textBaseline = "alphabetic";
  context.font = '900 8px "Malgun Gothic", sans-serif';
  context.fillStyle = "#efe4c8";
  context.fillText(learningInfo(ctx.engine.state.region, tower.char).short, cell.x, cell.y + 24, 40);
}

/**
 * 전장 명패 치수 — layout-audit-response-v1 §2 + v5-compact-tier-assets-pack-v1.
 *
 * 셀 중심 간격은 월드 44px 이고 기본 배율(2.0)에서 화면 88px 이 된다. 명패는
 * 역-스케일로 그려 화면 픽셀 크기가 고정되므로, 104px wide 형은 88px 간격에
 * 16px 씩 겹쳤다. 상시 명패를 84×40 compact 2줄형으로 낮춰 좌우 2px 씩,
 * 합계 4px 의 투명 간격을 만든다. 104×60 detail 형은 선택 상세 팝오버 전용이다.
 * 실제 치수와 코드 텍스트 좌표는 NAMEPLATE_LAYOUT(납품 명세)을 따른다.
 */
const PLAQUE_GLYPH_ONLY_WIDTH = 34;

/** 명패 아래 끝은 기존 wide 형과 같은 높이에 두어 자령 그림을 덮는 정도를 유지한다. */
const PLAQUE_BOTTOM = -28;

/** 셀 중심 간 월드 거리. content.ts 의 FORMATION_SPACING 을 좌표에서 되읽는다. */
const CELL_SPACING = ((BOARD_CELLS[1]?.x ?? 44) - (BOARD_CELLS[0]?.x ?? 0)) || 44;

/** 이웃 명패 사이에 남겨야 하는 최소 투명 간격(화면 px). */
const PLAQUE_MIN_GAP = 4;

const compactReadingCache = new Map<string, CompactReading>();

function plaqueReadingFont(size: number): string {
  return `800 ${size}px "Malgun Gothic", sans-serif`;
}

/** 캔버스 실측을 plaque-text 모듈에 주입한다. 글꼴 상태는 호출 뒤 되돌린다. */
const measurePlaqueText: MeasureText = (value, fontSize) => {
  context.font = plaqueReadingFont(fontSize);
  return context.measureText(value).width;
};

/**
 * compact 명패의 훈음 2줄 배치를 정한다. 매 프레임 자령 수만큼 실측하지 않도록
 * 문자열·폭 조합으로 캐시한다.
 */
function compactReadingFor(full: string, maxWidth: number): CompactReading {
  const key = `${full}|${maxWidth}`;
  const cached = compactReadingCache.get(key);
  if (cached) return cached;
  const previousFont = context.font;
  const resolved = compactReading(full, maxWidth, measurePlaqueText);
  context.font = previousFont;
  compactReadingCache.set(key, resolved);
  return resolved;
}

/** 상시 명패는 glyph-only 34px 이하로는 내려가지 않는다. 폭이 부족하면 통째로 숨기지 않고 한자만 남긴다. */
export function plaqueIsGlyphOnly(): boolean {
  return CELL_SPACING * ctx.mapZoom < NAMEPLATE_LAYOUT.compact.width + PLAQUE_MIN_GAP;
}

function drawSpiritTowerLabel(tower: Tower, cell: Point, selected: boolean, material: boolean): void {
  const style = ELEMENT_STYLES[tower.wuxing];
  const learning = learningInfo(ctx.engine.state.region, tower.char);
  // 한자 강조 OFF 는 명패 래스터와 글자를 통째로 숨긴다. glyph-only 명패도 남기지 않는다.
  if (!ctx.hanjaEmphasis) return;

  const glyphOnly = plaqueIsGlyphOnly();
  const layout = NAMEPLATE_LAYOUT.compact;
  const width = glyphOnly ? Math.min(PLAQUE_GLYPH_ONLY_WIDTH, Math.max(20, CELL_SPACING * ctx.mapZoom - PLAQUE_MIN_GAP)) : layout.width;
  const height = glyphOnly ? 34 : layout.height;
  const top = PLAQUE_BOTTOM - height + (glyphOnly ? 12 : 0);
  const left = -width / 2;

  context.save();
  context.translate(cell.x, cell.y);
  // Counter-scale the label so Hanja stays readable while the map zooms and pans.
  context.scale(1 / ctx.mapZoom, 1 / ctx.mapZoom);
  drawPlaqueShell(glyphOnly ? null : "compact", width, height, top, glyphOnly ? width : layout.glyphColumn, style.color, selected || material);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = PLAQUE_INK;
  context.font = plaqueGlyphFont(glyphOnly ? 22 : 24);
  const glyphCenterX = glyphOnly ? 0 : left + layout.glyphCenter.x;
  const glyphCenterY = glyphOnly ? top + height / 2 : top + layout.glyphCenter.y;
  // 안전 영역을 넘으면 22px 로 한 번만 줄인다. 압축은 하지 않는다.
  if (!glyphOnly && context.measureText(tower.char).width > layout.glyphSafe.width) context.font = plaqueGlyphFont(22);
  context.fillText(tower.char, glyphCenterX, glyphCenterY + 1);
  if (!glyphOnly) {
    // 훈음은 오른쪽 텍스트 영역에서 2줄까지 균형 분할한다. maxWidth 압축은 쓰지 않는다.
    const reading = compactReadingFor(learning.short, layout.text.width - 1);
    const readingCenterX = left + layout.text.x + layout.text.width / 2;
    const readingCenterY = top + layout.text.y + layout.text.height / 2;
    context.fillStyle = PLAQUE_INK_SOFT;
    context.font = plaqueReadingFont(reading.font);
    if (reading.lines.length <= 1) context.fillText(reading.lines[0] ?? "", readingCenterX, readingCenterY);
    else {
      context.fillText(reading.lines[0] ?? "", readingCenterX, readingCenterY - 6);
      context.fillText(reading.lines[1] ?? "", readingCenterX, readingCenterY + 6);
    }
    if (reading.shortened) {
      // 줄인 훈음에는 오른쪽 위에 작은 표식을 두어 상세 팝오버를 보게 한다.
      context.fillStyle = "rgba(140, 46, 34, 0.9)";
      context.beginPath();
      context.arc(width / 2 - 6, top + 6, 2, 0, Math.PI * 2);
      context.fill();
    }
  }
  // 추적 중 성어의 글자를 가진 자령에는 명패 좌측에 순번 인장을 얹는다.
  const order = ctx.idiomPlacementGuide?.orders.get(tower.id);
  if (order) {
    const badgeSize = glyphOnly ? 14 : 18;
    drawIdiomOrderBadge(left + badgeSize / 2 - 1, top + 1, badgeSize, order);
  }
  // R18: 발동 중인 봉인의 네 자령은 자동배치가 건드리지 못한다. 명패 오른쪽 위에
  // 기존 잠금 어휘(鎖)를 성어색으로 얹어 "이 자리는 묶여 있다"를 한 글자로 말한다.
  const sealColor = ctx.sealedIdiomTowerMarks.get(tower.id);
  if (sealColor) drawIdiomSealLockMark(width / 2 - (glyphOnly ? 5 : 6), top + (glyphOnly ? 5 : 6), glyphOnly ? 4.5 : 5.5, sealColor);
  context.restore();
}

/** 명패 위 금쇄 표식 — 잠금 배지와 같은 어휘, 색만 그 성어의 색이다. */
function drawIdiomSealLockMark(centerX: number, centerY: number, radius: number, color: string): void {
  context.save();
  context.fillStyle = "rgba(12, 9, 5, 0.9)";
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.shadowColor = color;
  context.shadowBlur = 5;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${Math.round(radius * 1.3)}px "Malgun Gothic", serif`;
  context.fillText("鎖", centerX, centerY + 0.5);
  context.restore();
}

/** 명패 바탕색 위의 먹글씨. 크림 한지 위에서 대비를 확보한다. */
const PLAQUE_INK = "#231708";

const PLAQUE_INK_SOFT = "#3a2a14";

function plaqueGlyphFont(size: number): string {
  return `900 ${size}px "Malgun Gothic", "Noto Sans CJK KR", serif`;
}

/**
 * 명패 판 — v5 납품 래스터를 1/3 배율로 고정 렌더한다(9-slice·stretch 금지).
 * 로드 전이거나 glyph-only 축소본은 절차 드로잉으로 대체한다.
 */
function drawPlaqueShell(
  kind: NameplateKind | null,
  width: number,
  height: number,
  top: number,
  glyphBox: number,
  elementColor: string,
  emphasised: boolean
): void {
  const left = -width / 2;
  const radii = [3, 11, 3, 11] as const;
  context.save();
  context.shadowColor = emphasised ? "rgba(255, 231, 164, 0.55)" : "rgba(0, 0, 0, 0.5)";
  context.shadowBlur = emphasised ? 12 : 6;
  context.shadowOffsetY = 2;
  if (kind && nameplateReady(kind)) {
    context.drawImage(nameplateImage(kind), left, top, width, height);
  } else {
    // 폴백: 납품 래스터와 같은 한지 바탕 + 옻칠 테두리를 절차로 그린다.
    const paper = context.createLinearGradient(0, top, 0, top + height);
    paper.addColorStop(0, "#e6d7b4");
    paper.addColorStop(1, "#cdba91");
    context.fillStyle = paper;
    context.beginPath();
    context.roundRect(left, top, width, height, [...radii]);
    context.fill();
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.strokeStyle = "#231a10";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(left + 1, top + 1, width - 2, height - 2, [...radii]);
    context.stroke();
    if (glyphBox < width) {
      context.strokeStyle = "rgba(50, 36, 18, 0.45)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left + glyphBox + 0.5, top + 4);
      context.lineTo(left + glyphBox + 0.5, top + height - 4);
      context.stroke();
    }
  }
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  // 한자 칸에 오행 색을 옅게 씌워 명패가 두 구역으로 읽히게 한다.
  if (glyphBox < width) {
    context.save();
    context.beginPath();
    context.roundRect(left + 2, top + 2, width - 4, height - 4, [...radii]);
    context.clip();
    context.globalAlpha = 0.22;
    context.fillStyle = elementColor;
    context.fillRect(left + 2, top + 2, glyphBox - 2, height - 4);
    context.restore();
  }

  // 선택·재료 상태는 색만이 아니라 두꺼운 금테로도 구분한다.
  if (emphasised) {
    context.strokeStyle = "#ffe9b0";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(left + 1, top + 1, width - 2, height - 2, [...radii]);
    context.stroke();
  }

  // 자령을 가리키는 작은 꼬리
  context.fillStyle = emphasised ? "#ffe9b0" : "#2b2014";
  context.beginPath();
  context.moveTo(-4, top + height - 1);
  context.lineTo(4, top + height - 1);
  context.lineTo(0, top + height + 4);
  context.closePath();
  context.fill();
  context.restore();
}

interface PendingPlaque {
  readonly tower: Tower;
  readonly cell: Point;
  readonly selected: boolean;
  readonly material: boolean;
}

/**
 * 명패는 자령 본체 루프 안에서 바로 그리지 않고 모았다가 마지막에 흘린다.
 * 렌더 순서: 일반 y순 → 합성 재료 → 선택 명패 → 선택 상세 팝오버.
 * 이웃 자령의 본체나 명패가 선택 명패의 훈음을 덮지 않게 한다.
 */
const pendingPlaques: PendingPlaque[] = [];

export function flushTowerPlaques(): void {
  if (pendingPlaques.length === 0) return;
  const ordered = [...pendingPlaques].sort((left, right) => left.cell.y - right.cell.y);
  for (const entry of ordered) {
    if (entry.material || entry.selected) continue;
    drawSpiritTowerLabel(entry.tower, entry.cell, false, false);
  }
  for (const entry of ordered) {
    if (entry.material && !entry.selected) drawSpiritTowerLabel(entry.tower, entry.cell, false, true);
  }
  for (const entry of ordered) {
    if (entry.selected) drawSpiritTowerLabel(entry.tower, entry.cell, true, entry.material);
  }
  const focused = ordered.find((entry) => entry.selected);
  if (focused) drawTowerDetailPopover(focused.tower, focused.cell);
  pendingPlaques.length = 0;
}

/** 같은 진 안에서 방향으로 이웃한 셀 번호. 진 밖이면 null(가릴 명패가 없음). */
function neighborCellIndex(cell: number, columnStep: number, rowStep: number): number | null {
  if (cell < 0 || cell >= BOARD_CELLS.length) return null;
  const formation = Math.floor(cell / CELLS_PER_FORMATION);
  const local = cell % CELLS_PER_FORMATION;
  const column = local % FORMATION_COLUMNS + columnStep;
  const row = Math.floor(local / FORMATION_COLUMNS) + rowStep;
  if (column < 0 || column >= FORMATION_COLUMNS || row < 0 || row >= FORMATION_ROWS) return null;
  return formation * CELLS_PER_FORMATION + row * FORMATION_COLUMNS + column;
}

/**
 * 선택 자령의 104px 상세 팝오버. compact 가 줄여 적은 훈음의 전체값을 보여준다.
 * 가장 가까운 빈 방향에 띄우고 전장 경계 안으로 clamp 한다.
 */
function drawTowerDetailPopover(tower: Tower, cell: Point): void {
  if (!ctx.hanjaEmphasis) return;
  const style = ELEMENT_STYLES[tower.wuxing];
  const learning = learningInfo(ctx.engine.state.region, tower.char);
  const layout = NAMEPLATE_LAYOUT.detail;
  const previousFont = context.font;
  context.font = plaqueReadingFont(11);
  let lines = canvasWrappedLines(learning.short, layout.text.width - 2, 3);
  if (lines.length > 3) {
    context.font = plaqueReadingFont(10);
    lines = canvasWrappedLines(learning.short, layout.text.width - 2, 3);
  }
  const readingFont = context.font;
  context.font = previousFont;
  const lineHeight = 13;
  const height = layout.height;

  const occupied = new Set(ctx.engine.state.towers.map((candidate) => candidate.cell));
  const free = (columnStep: number, rowStep: number): boolean => {
    const neighbor = neighborCellIndex(tower.cell, columnStep, rowStep);
    return neighbor === null || !occupied.has(neighbor);
  };
  // 가장 가까운 빈 방향: 위 → 오른쪽 → 왼쪽 → 아래. 자기 compact 명패(84px)와
  // 겹치지 않도록 옆으로 낼 때는 두 폭의 절반 합에 6px 여백을 더한다.
  const sideOffset = (NAMEPLATE_LAYOUT.compact.width + layout.width) / 2 + 6;
  const sideTop = PLAQUE_BOTTOM - NAMEPLATE_LAYOUT.compact.height / 2 - height / 2;
  const placements: ReadonlyArray<{ columnStep: number; rowStep: number; offsetX: number; top: number }> = [
    { columnStep: 0, rowStep: -1, offsetX: 0, top: PLAQUE_BOTTOM - NAMEPLATE_LAYOUT.compact.height - 14 - height },
    { columnStep: 1, rowStep: 0, offsetX: sideOffset, top: sideTop },
    { columnStep: -1, rowStep: 0, offsetX: -sideOffset, top: sideTop },
    { columnStep: 0, rowStep: 1, offsetX: 0, top: 36 }
  ];
  const placement = placements.find((candidate) => free(candidate.columnStep, candidate.rowStep)) ?? placements[0] as (typeof placements)[number];
  let offsetX = placement.offsetX;
  let top = placement.top;

  // 전장(캔버스) 경계 안으로 밀어 넣는다. 명패는 역-스케일이라 화면 px 로 계산한다.
  const screenX = ctx.mapOffset.x + cell.x * ctx.mapZoom;
  const screenY = ctx.mapOffset.y + cell.y * ctx.mapZoom;
  // 최소 8px viewport inset 을 지킨다.
  const inset = 8;
  offsetX = Math.max(inset + layout.width / 2 - screenX, Math.min(WORLD_WIDTH - inset - layout.width / 2 - screenX, offsetX));
  top = Math.max(46 - screenY, Math.min(WORLD_HEIGHT - inset - height - screenY, top));

  const left = -layout.width / 2;
  context.save();
  context.translate(cell.x, cell.y);
  context.scale(1 / ctx.mapZoom, 1 / ctx.mapZoom);
  context.translate(offsetX, 0);
  drawPlaqueShell("detail", layout.width, height, top, layout.glyphColumn, style.color, true);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = PLAQUE_INK;
  context.font = plaqueGlyphFont(30);
  if (context.measureText(tower.char).width > layout.glyphSafe.width) context.font = plaqueGlyphFont(26);
  context.fillText(tower.char, left + layout.glyphCenter.x, top + layout.glyphCenter.y + 1);
  context.fillStyle = PLAQUE_INK_SOFT;
  context.font = readingFont;
  const readingCenter = left + layout.text.x + layout.text.width / 2;
  const firstLine = top + layout.text.y + layout.text.height / 2 - (lines.length - 1) * lineHeight / 2;
  for (let index = 0; index < lines.length; index += 1) {
    context.fillText(lines[index] as string, readingCenter, firstLine + index * lineHeight);
  }
  context.restore();
}

function drawSpiritTower(tower: Tower, cell: Point, definition: HanziDefinition, selected: boolean, material: boolean): void {
  const abilities = definition.combat.abilities;
  const style = ELEMENT_STYLES[tower.wuxing];
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
  const image = jaryeongSpriteImage(visual);
  const progressionRank = ctx.engine.state.mode === "casual" ? casualStarOf(tower) : tower.stage;
  const progressionColor = ctx.engine.state.mode === "casual" ? CASUAL_STAR_COLORS[casualStarOf(tower)] : STAGE_COLORS[tower.stage];
  const pulse = 1 + tower.pulse * 0.055;
  const auraRadius = 17 + (progressionRank - 1) * 0.45;

  context.save();
  context.translate(cell.x, cell.y + 15);
  context.scale(1, 0.32);
  const floorAura = context.createRadialGradient(0, 0, 3, 0, 0, auraRadius);
  floorAura.addColorStop(0, style.color + "8f");
  floorAura.addColorStop(0.58, style.color + "31");
  floorAura.addColorStop(1, style.color + "00");
  context.fillStyle = floorAura;
  context.shadowColor = material ? "#fff0b7" : style.glow;
  context.shadowBlur = material ? 15 : selected ? 11 : 6;
  context.beginPath();
  context.arc(0, 0, auraRadius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.strokeStyle = material ? "#fff0b7" : selected ? "#ffffff" : progressionColor;
  context.lineWidth = material || selected ? 3 : 1.5;
  context.shadowColor = material ? "#fff0b7" : style.glow;
  context.shadowBlur = material ? 12 : selected ? 9 : 4;
  context.beginPath();
  context.ellipse(cell.x, cell.y + 15, auraRadius, 6, 0, 0, Math.PI * 2);
  context.stroke();
  context.shadowBlur = 0;
  drawChargeRing({ x: cell.x, y: cell.y + 1 }, 20, tower, abilities);

  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const drawSize = (42 + Math.min(7, progressionRank)) * pulse;
    context.shadowColor = style.glow;
    context.shadowBlur = selected ? 13 : 5;
    if (jaryeongFrameLayout(visual) === "single") {
      context.drawImage(image, cell.x - drawSize / 2, cell.y - drawSize / 2 + 3, drawSize, drawSize);
    } else {
      const frame = tower.abilityFlash > 0.08 ? 2 : reducedMotion ? 0 : Math.floor((ctx.engine.state.elapsed + tower.id * 0.31) * 1.15) % 2;
      const frameWidth = image.naturalWidth / 2;
      const frameHeight = image.naturalHeight / 2;
      context.drawImage(
        image,
        frame % 2 * frameWidth,
        Math.floor(frame / 2) * frameHeight,
        frameWidth,
        frameHeight,
        cell.x - drawSize / 2,
        cell.y - drawSize / 2 + 3,
        drawSize,
        drawSize
      );
    }
    context.shadowBlur = 0;
  }

  pendingPlaques.push({ tower, cell, selected, material });
}

function drawTowerAbilityPopup(tower: Tower, cell: Point): void {
  const popup = towerAbilityPopups.get(tower.id);
  if (!popup) return;
  const ratio = Math.min(1, popup.age / popup.duration);
  const alpha = ratio < 0.18 ? ratio / 0.18 : 1 - (ratio - 0.18) / 0.82;
  const y = cell.y - 38 - ratio * 7;
  context.save();
  context.globalAlpha = Math.max(0, alpha);
  context.font = '900 9px "Malgun Gothic", sans-serif';
  const width = Math.min(96, Math.max(52, context.measureText(popup.text).width + 16));
  context.fillStyle = "rgba(3, 8, 15, 0.94)";
  context.strokeStyle = popup.color;
  context.lineWidth = 1.5;
  context.shadowColor = popup.color;
  context.shadowBlur = 10;
  context.beginPath();
  context.roundRect(cell.x - width / 2, y - 9, width, 18, 7);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(popup.text, cell.x, y + 1, width - 10);
  context.restore();
}

function drawTowerTierMarker(tower: Tower, cell: Point): void {
  const casual = ctx.engine.state.mode === "casual";
  const tier = casual
    ? casualStarOf(tower)
    : Math.max(1, Math.min(5, ctx.mapSynthesisDepths.get(tower.char) ?? 1)) as 1 | 2 | 3 | 4 | 5;
  const uncombinable = !casual && tier === 1 && ctx.mapUncombinableStageOne.has(tower.char);
  const color = casual ? CASUAL_STAR_COLORS[tier as CasualStar] : uncombinable ? UNCOMBINABLE_STAGE_ONE_COLOR : STAGE_COLORS[tier as 1 | 2 | 3 | 4 | 5];
  const stars = "★".repeat(tier);
  const y = cell.y + 19;
  context.save();
  context.fillStyle = "rgba(3, 8, 14, 0.96)";
  context.strokeStyle = color;
  context.lineWidth = 1.15;
  context.shadowColor = "rgba(0, 0, 0, 0.7)";
  context.shadowBlur = 4;
  context.beginPath();
  const width = Math.max(18, 6 + stars.length * 4.2);
  context.roundRect(cell.x - width / 2, y - 5, width, 10, 4);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 6px "Malgun Gothic", sans-serif';
  context.fillText(stars, cell.x, y + 0.3, width - 2);
  context.restore();
}

function drawSelectedTowerMarker(cell: Point): void {
  const left = cell.x - 25;
  const right = cell.x + 25;
  const top = cell.y - 27;
  const bottom = cell.y + 25;
  const corner = 8;
  context.save();
  context.fillStyle = "rgba(255, 211, 104, 0.1)";
  context.strokeStyle = "#2a1703";
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(cell.x, cell.y + 15, 24, 9, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.strokeStyle = "#fff3bd";
  context.lineWidth = 2.4;
  context.shadowColor = "#ffc95c";
  context.shadowBlur = 8;
  context.beginPath();
  context.ellipse(cell.x, cell.y + 15, 24, 9, 0, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(left + corner, top); context.lineTo(left, top); context.lineTo(left, top + corner);
  context.moveTo(right - corner, top); context.lineTo(right, top); context.lineTo(right, top + corner);
  context.moveTo(left, bottom - corner); context.lineTo(left, bottom); context.lineTo(left + corner, bottom);
  context.moveTo(right - corner, bottom); context.lineTo(right, bottom); context.lineTo(right, bottom - corner);
  context.stroke();
  context.restore();
}

export function drawTower(tower: Tower, materialIds: ReadonlySet<number>): void {
  const cell = BOARD_CELLS[tower.cell] as Point;
  const definition = definitionForTower(ctx.engine.catalog, tower.definitionId);
  const selected = tower.id === ctx.engine.state.selectedTowerId;
  const material = materialIds.has(tower.id);
  context.save();
  if (ctx.displayMode === "study") drawStudyTower(tower, cell, definition, selected, material);
  else drawSpiritTower(tower, cell, definition, selected, material);
  if (selected) drawSelectedTowerMarker(cell);
  drawTowerTierMarker(tower, cell);
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  if ((tower.concentration ?? 0) > 0) {
    context.fillStyle = "rgba(6, 10, 17, 0.94)";
    context.strokeStyle = ELEMENT_STYLES[tower.wuxing].color;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(cell.x + 6, cell.y - 32, 18, 10, 4);
    context.fill();
    context.stroke();
    context.fillStyle = "#fff4cf";
    context.font = '900 6px "Malgun Gothic", serif';
    context.fillText(`濃${tower.concentration}`, cell.x + 15, cell.y - 24.5);
  }
  if (tower.locked) {
    const lockX = cell.x - 15;
    const lockY = cell.y + 17;
    context.fillStyle = "rgba(7, 12, 20, 0.92)";
    context.strokeStyle = "#ffd879";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(lockX, lockY, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#ffd879";
    context.font = '900 6px "Malgun Gothic", serif';
    context.fillText("鎖", lockX, lockY + 2);
  }
  drawTowerAbilityPopup(tower, cell);
  context.restore();
}

function canvasWrappedLines(textValue: string, maxWidth: number, maxLines: number): string[] {
  const words = textValue.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  while (words.length > 0 && lines.length < maxLines) {
    const word = words.shift() as string;
    const candidate = line ? `${line} ${word}` : word;
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length > 0 && lines.length > 0) {
    let last = lines.at(-1) as string;
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

export function drawHoveredTowerCard(): void {
  canvas.dataset.hoveredTowerMeaning = "";
  canvas.dataset.hoveredTowerPortrait = "";
  const tower = ctx.hoveredTowerId === null ? undefined : ctx.engine.state.towers.find((candidate) => candidate.id === ctx.hoveredTowerId);
  if (!tower || ctx.mapPanPointerId !== null || ctx.towerDragMoved) return;
  const cell = BOARD_CELLS[tower.cell] as Point;
  const point = { x: ctx.mapOffset.x + cell.x * ctx.mapZoom, y: ctx.mapOffset.y + cell.y * ctx.mapZoom };
  if (point.x < -24 || point.x > WORLD_WIDTH + 24 || point.y < -24 || point.y > WORLD_HEIGHT + 24) return;

  const definition = definitionForTower(ctx.engine.catalog, tower.definitionId);
  const style = ELEMENT_STYLES[tower.wuxing];
  const learning = learningInfo(ctx.engine.state.region, tower.char);
  const explanation = koreanMeaningExplanation(tower.char, learning.short, learning.meaning);
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
  const image = jaryeongSpriteImage(visual);
  // 큰 한자는 기존 글줄 상자를 좁히지 않고 오른쪽에 제 칸을 받는다.
  // 훈음은 "엄쪽(어음을 쪼갠 한 쪽) 권" 처럼 14자까지 오는데, 172px 상자를
  // 90px 로 줄이면 maxWidth 압축이 38% 까지 찌그러진다.
  const glyphColumn = ctx.hoverGlyphLarge ? 80 : 0;
  const width = 284 + glyphColumn;
  const height = 176;
  const x = point.x + 36 + width > WORLD_WIDTH - 10 ? point.x - width - 36 : point.x + 36;
  const y = Math.min(WORLD_HEIGHT - height - 18, Math.max(72, point.y - height / 2));
  const anchorX = x > point.x ? x : x + width;
  const anchorY = Math.min(y + height - 18, Math.max(y + 18, point.y));
  canvas.dataset.hoveredTowerMeaning = explanation.short;
  canvas.dataset.hoveredTowerPortrait = visual.id;

  context.save();
  context.strokeStyle = style.color + "bb";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(point.x, point.y - 14);
  context.lineTo(anchorX, anchorY);
  context.stroke();
  context.fillStyle = "rgba(4, 10, 18, 0.98)";
  context.strokeStyle = style.color;
  context.lineWidth = 2;
  context.shadowColor = "rgba(0, 0, 0, 0.58)";
  context.shadowBlur = 18;
  context.beginPath();
  context.roundRect(x, y, width, height, 12);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;

  // 우상단 사분면의 빈자리에 한자를 크게. 카드가 어두운 계열이라
  // 스펙의 먹/밝은획을 뒤집어 밝은 글자 + 어두운 아래획(양각)으로 그린다.
  // 세로로는 쉬운 뜻 구분선(y+98) 위에서 끝난다.
  if (ctx.hoverGlyphLarge) {
    const glyphX = x + width - glyphColumn / 2 - 6;
    const glyphY = y + 58;
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '900 60px "Batang", "Noto Sans CJK KR", serif';
    context.fillStyle = "rgba(2, 6, 12, 0.85)";
    context.fillText(tower.char, glyphX + 2, glyphY + 2, 72);
    context.fillStyle = "rgba(255, 247, 222, 0.92)";
    context.fillText(tower.char, glyphX, glyphY, 72);
    context.restore();
  }

  const portraitX = x + 10;
  const portraitY = y + 10;
  const portraitSize = 78;
  context.fillStyle = style.color + "20";
  context.beginPath();
  context.roundRect(portraitX, portraitY, portraitSize, portraitSize, 10);
  context.fill();
  context.strokeStyle = style.color + "88";
  context.lineWidth = 1;
  context.stroke();
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const single = jaryeongFrameLayout(visual) === "single";
    const sourceWidth = single ? image.naturalWidth : image.naturalWidth / 2;
    const sourceHeight = single ? image.naturalHeight : image.naturalHeight / 2;
    context.drawImage(image, 0, 0, sourceWidth, sourceHeight, portraitX + 3, portraitY + 3, portraitSize - 6, portraitSize - 6);
  } else {
    context.fillStyle = "#fff9e8";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '900 42px "Malgun Gothic", "Noto Sans CJK KR", serif';
    context.fillText(tower.char, portraitX + portraitSize / 2, portraitY + portraitSize / 2, portraitSize - 12);
  }

  context.fillStyle = "rgba(4, 10, 18, 0.94)";
  context.strokeStyle = style.color;
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(portraitX + portraitSize - 8, portraitY + portraitSize - 8, 13, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff6da";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 15px "Batang", "Malgun Gothic", serif';
  context.fillText(tower.char, portraitX + portraitSize - 8, portraitY + portraitSize - 7);

  const copyX = x + 100;
  const copyWidth = width - 112 - glyphColumn;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#f7edcf";
  context.font = '900 17px "Malgun Gothic", sans-serif';
  context.fillText(learning.short, copyX, y + 28, copyWidth);
  context.fillStyle = style.color;
  context.font = '900 12px "Malgun Gothic", sans-serif';
  context.fillText(`${style.name}행 · ${towerProgressionLabel(tower)}`, copyX, y + 50, copyWidth);
  context.fillStyle = "#b9c8d9";
  context.font = '800 11px "Malgun Gothic", sans-serif';
  context.fillText(definition.combat.effectLabel, copyX, y + 71, copyWidth);

  context.fillStyle = "rgba(218, 229, 241, 0.16)";
  context.fillRect(x + 10, y + 98, width - 20, 1);
  context.fillStyle = style.color;
  context.font = '950 11px "Malgun Gothic", sans-serif';
  context.fillText("쉬운 뜻", x + 12, y + 114);
  context.fillStyle = "#d8e2ed";
  // R7-25: 뜻 11 → 12px, 아래 조작 힌트 9 → 11px. 카드 안에서 가장 오래
  // 읽는 두 줄인데 바닥선 아래에 있었다.
  context.font = '800 12px "Malgun Gothic", sans-serif';
  const meaningLines = canvasWrappedLines(explanation.short, width - 24, 2);
  meaningLines.forEach((line, index) => context.fillText(line, x + 12, y + 131 + index * 14, width - 24));

  context.fillStyle = "rgba(218, 229, 241, 0.13)";
  context.fillRect(x + 10, y + 154, width - 20, 1);
  context.fillStyle = "#a8bcd2";
  context.font = '800 11px "Malgun Gothic", sans-serif';
  context.fillText("클릭: 선택 · 끌기: 교환 · 자세한 뜻은 자령 도감", x + 12, y + 169, width - 24);
  context.restore();
}
