/*
 * 전장 캔버스 그리기 — 바탕·길·판·성어 겹칩·적.
 */
import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  CELLS_PER_FORMATION,
  ENEMY_PATH_POINTS,
  ENEMY_SPAWN_PROGRESS,
  positionOnPath,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "../../core/content";
import { definitionForTower, ELEMENT_STYLES } from "../../core/hanzi";
import { idiomById, partialIdiomChain } from "../../core/idioms";
import { enemyJaryeongVisualFor } from "../../core/jaryeongs";
import { learningInfo } from "../../core/learning";
import { type Enemy, type Point, type Tower } from "../../core/types";
import { abilityZoneSpriteLayout, deterministicZoneRotation } from "../combat-fx-layout";
import { elementZoneImage } from "../combat-fx-sprites";
import {
  ENEMY_FRAME_SIZE,
  enemyArtTopFactor,
  enemySheetImage,
  enemySheetStateSummary,
  FALLBACK_ART_TOP_FACTOR,
  isEnemySheetReady
} from "../enemy-sprites";
import {
  FORMATION_PLATE_HALF,
  FORMATION_PLATE_SIZE,
  formationPlateImage,
  formationPlateStateSummary,
  isFormationPlateReady
} from "../formation-plate-sprites";
import { type IdiomOrder, idiomOrderSealImage, idiomSpriteReady, tintedIdiomRipple } from "../idiom-sprites";
import {
  inkArrowImage,
  type InkCorner,
  inkCornerImage,
  inkCrossImage,
  type InkDirection,
  inkStraightImage
} from "../ink-path-sprites";
import { jaryeongSpriteImage } from "../jaryeong-sprites";
import { isLockSpriteReady, LOCK_SPRITE_SIZE, lockSpriteImage } from "../lock-sprites";
import { CELL_SOCKET_SIZE, cellSocketImage, isCellSocketReady } from "../p0-component-sprites";
import { EXIT_SEAL_SIZE, exitSealImage, isReady as isPolishSpriteReady } from "../polish-sprites";
import { calmBattlefield, canvas, context, ctx, reducedMotion } from "../app-context";
import { casualStarOf } from "../format";
import { drawHoveredTowerCard, drawTower, flushTowerPlaques } from "./draw-tower";
import { type IdiomRippleFx, idiomRipples, pushPooled, ringPool, rings, takeRing, updateAndDrawFx } from "./fx";

export function drawWorld(delta: number): void {
  const state = ctx.engine.state;
  const selectedTower = ctx.engine.selectedTower();
  canvas.dataset.selectedTowerId = selectedTower ? String(selectedTower.id) : "";
  // compact 명패가 훈음을 줄여 적어도 전체값은 접근성 이름과 상세 팝오버에 남는다.
  const selectedReading = selectedTower ? learningInfo(state.region, selectedTower.char).short : "";
  if (canvas.dataset.selectedTowerReading !== selectedReading) {
    canvas.dataset.selectedTowerReading = selectedReading;
    canvas.setAttribute(
      "aria-label",
      selectedTower ? `전장 · 선택 자령 ${selectedTower.char} ${selectedReading}` : "전장 · 선택한 자령 없음"
    );
  }
  canvas.dataset.selectedSynthesisTier = selectedTower ? String(ctx.engine.state.mode === "casual" ? casualStarOf(selectedTower) : ctx.mapSynthesisDepths.get(selectedTower.char) ?? 1) : "";
  const materialIds = hoveredMaterialIds();
  // 개발 진단: 적·제단 래스터 로드 상태. 프로덕션 화면에는 노출하지 않는다.
  const enemySheets = enemySheetStateSummary();
  if (canvas.dataset.enemySheets !== enemySheets) canvas.dataset.enemySheets = enemySheets;
  const formationPlates = formationPlateStateSummary();
  if (canvas.dataset.formationPlates !== formationPlates) canvas.dataset.formationPlates = formationPlates;
  drawPaperBackdrop();
  context.save();
  context.translate(ctx.mapOffset.x, ctx.mapOffset.y);
  context.scale(ctx.mapZoom, ctx.mapZoom);
  drawTrack();
  drawBoard();
  refreshSealedIdiomTowerMarks();
  refreshIdiomPlacementGuide();
  drawIdiomPlacementCells();
  drawAbilityZones();
  drawCompositionMaterialLinks();
  drawIdiomSeals();
  drawSelection();
  for (const enemy of state.enemies) {
    const point = positionOnPath(enemy.progress);
    if (isWorldPointVisible(point, enemy.boss ? 90 : 55)) drawEnemy(enemy, point);
  }
  for (const tower of [...state.towers].sort((a, b) => a.cell - b.cell)) {
    if (isWorldPointVisible(BOARD_CELLS[tower.cell] as Point, 65)) drawTower(tower, materialIds);
  }
  // 명패는 자령 본체를 모두 그린 뒤에 흘려야 이웃 자령이 훈음을 덮지 않는다.
  flushTowerPlaques();
  // Keep combat sprites in the foreground so their raster silhouettes are not
  // hidden by the enemy/tower bodies. Their alpha and size remain restrained
  // so the learning labels stay readable.
  updateAndDrawFx(delta);
  context.restore();
  drawIdiomFlash();
  drawHoveredTowerCard();
}

export function isWorldPointVisible(point: Point, margin = 0): boolean {
  const x = ctx.mapOffset.x + point.x * ctx.mapZoom;
  const y = ctx.mapOffset.y + point.y * ctx.mapZoom;
  const screenMargin = margin * ctx.mapZoom;
  return x >= -screenMargin && x <= WORLD_WIDTH + screenMargin && y >= -screenMargin && y <= WORLD_HEIGHT + screenMargin;
}

/** 장판 생성 시각 기록 — 스케일-인 연출과 생성 고리에 쓴다. */
const zoneSpawnTimes = new Map<number, number>();

function drawAbilityZones(): void {
  let spriteDrawnThisFrame = false;
  let verticalZoneCount = 0;
  let cornerZoneCount = 0;
  const liveZoneIds = new Set<number>();
  for (const zone of ctx.engine.state.abilityZones) {
    liveZoneIds.add(zone.id);
    const point = positionOnPath(zone.progress);
    if (!isWorldPointVisible(point, zone.radius)) continue;
    const remaining = Math.max(0, zone.expiresAt - ctx.engine.state.elapsed);
    const life = Math.min(1, remaining / 1.2);
    const image = elementZoneImage(zone.wuxing);
    // FB6: 진폭 0.018 → 0.013 (-28%). 차분한 화면에서는 맥동 자체를 멈춘다.
    const pulse = calmBattlefield() ? 1 : 1 + Math.sin(ctx.engine.state.elapsed * 1.45 + zone.id) * 0.013;
    const layout = abilityZoneSpriteLayout(zone.progress, zone.radius, pulse);

    // 생성 순간: 먹 고리 + 0.35초 스케일-인. "기술이 나갔다"를 읽게 한다.
    let spawnScale = 1;
    let spawnedAt = zoneSpawnTimes.get(zone.id);
    if (spawnedAt === undefined) {
      spawnedAt = ctx.engine.state.elapsed;
      zoneSpawnTimes.set(zone.id, spawnedAt);
      pushPooled(rings, ringPool, takeRing(point, zone.color, 0.5), 32);
    }
    if (!reducedMotion) {
      const settle = Math.min(1, (ctx.engine.state.elapsed - spawnedAt) / 0.35);
      spawnScale = 0.55 + 0.45 * (1 - (1 - settle) * (1 - settle));
    }
    const verticalWeight = Math.abs(Math.sin(layout.angle));
    if (verticalWeight >= 0.92) verticalZoneCount += 1;
    else if (verticalWeight >= 0.22) cornerZoneCount += 1;
    // aoe-modular-fx-pack-v1: 모듈은 항상 정사각 D×D. 회전은 결정적 ±8°만.
    // pathTriple 은 경로 앞·중앙·뒤 3모듈(각 D=1.2R, 중심 간 0.82D)로 확장한다.
    const pattern = (zone as { areaPattern?: string }).areaPattern === "pathTriple" ? "pathTriple" : "single";
    const centers: Array<{ progress: number; diameter: number; moduleIndex: number }> = [];
    if (pattern === "pathTriple") {
      const moduleDiameter = zone.radius * 1.2 * pulse;
      const progressStep = (moduleDiameter * 0.82) / TOTAL_ENEMY_PATH_LENGTH;
      centers.push(
        { progress: zone.progress - progressStep, diameter: moduleDiameter, moduleIndex: 0 },
        { progress: zone.progress, diameter: moduleDiameter, moduleIndex: 1 },
        { progress: zone.progress + progressStep, diameter: moduleDiameter, moduleIndex: 2 }
      );
    } else {
      // 판정 반경 R 은 아래 붓선 테두리가 담당하므로 그림은 1.6R 로 줄인다.
      centers.push({ progress: zone.progress, diameter: layout.width * 0.8 * spawnScale, moduleIndex: 0 });
    }
    for (const moduleCenter of centers) {
      const at = positionOnPath(moduleCenter.progress);
      context.save();
      context.globalAlpha = 0.58 * life;
      context.translate(at.x, at.y);
      context.rotate(deterministicZoneRotation(zone.id + moduleCenter.moduleIndex));
      if (image.complete && image.naturalWidth > 0) {
        context.drawImage(image, -moduleCenter.diameter / 2, -moduleCenter.diameter / 2, moduleCenter.diameter, moduleCenter.diameter);
        ctx.abilityZoneSpriteDrawTotal += 1;
        spriteDrawnThisFrame = true;
      } else {
        context.fillStyle = zone.color;
        context.beginPath();
        context.arc(0, 0, moduleCenter.diameter / 2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
    // 실제 판정 반경 R: 마른 붓 점선. 그림이 작아져도 범위는 정확히 읽힌다.
    context.save();
    context.globalAlpha = 0.4 * life;
    context.strokeStyle = zone.color;
    context.lineWidth = 1.6;
    context.setLineDash([7, 9]);
    context.lineDashOffset = calmBattlefield() ? 0 : -ctx.engine.state.elapsed * 14;
    context.beginPath();
    context.arc(point.x, point.y, zone.radius * spawnScale, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.restore();

    // 판정 안에서 피해를 받는 적 위로 오행색 불티가 튄다.
    if (!calmBattlefield()) {
      for (const enemy of ctx.engine.state.enemies) {
        const enemyPoint = positionOnPath(enemy.progress);
        const dx = enemyPoint.x - point.x;
        const dy = enemyPoint.y - point.y;
        if (dx * dx + dy * dy > zone.radius * zone.radius) continue;
        for (let sparkIndex = 0; sparkIndex < 3; sparkIndex += 1) {
          const phase = ((ctx.engine.state.elapsed * 1.7 + enemy.id * 0.41 + sparkIndex * 0.33) % 1 + 1) % 1;
          const sparkX = enemyPoint.x + Math.sin((enemy.id + sparkIndex) * 2.4) * 9;
          const sparkY = enemyPoint.y - 4 - phase * 22;
          context.globalAlpha = (1 - phase) * 0.85 * life;
          context.fillStyle = zone.color;
          context.beginPath();
          context.arc(sparkX, sparkY, 1.7 + (1 - phase) * 1.1, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    }

    context.save();
    context.globalAlpha = 0.88 * life;
    // [SKILL-V1] 서리길은 오행 대신 霜 표기 — 감속 지대임을 이름으로 말한다.
    // [SKILL-V2] 소흔의 잔불도 燼 표기 — 처치 지점에 남은 불씨임을 이름으로 말한다.
    context.fillStyle = zone.kind === "rain" || zone.kind === "frost" ? "#d9f2ff" : zone.color;
    context.font = '900 10px "Malgun Gothic", sans-serif';
    context.textAlign = "center";
    context.fillText(`${zone.kind === "frost" ? "霜 서리길" : zone.kind === "ember" ? "燼 잔불" : zone.wuxing} ${remaining.toFixed(1)}초`, point.x, point.y + zone.radius + 13);
    context.restore();
  }
  for (const id of zoneSpawnTimes.keys()) {
    if (!liveZoneIds.has(id)) zoneSpawnTimes.delete(id);
  }
  canvas.dataset.abilityZoneCount = String(ctx.engine.state.abilityZones.length);
  canvas.dataset.abilityZoneSpriteDraw = String(spriteDrawnThisFrame);
  canvas.dataset.abilityZoneSpriteDrawTotal = String(ctx.abilityZoneSpriteDrawTotal);
  canvas.dataset.abilityZoneVerticalCount = String(verticalZoneCount);
  canvas.dataset.abilityZoneCornerCount = String(cornerZoneCount);
}

function drawPaperBackdrop(): void {
  canvas.dataset.mapSurface = "hanji-ink";
  // Keep the paper on the CSS compositor instead of repainting and resampling it every frame.
  // The canvas is cleared to transparency, so only the moving game layers are redrawn.
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

/**
 * 먹물 길.
 *
 * 경로 좌표(`ENEMY_PATH_POINTS` 17점·16구간·전부 200px 축정렬)와 적 이동·충돌
 * 판정은 그대로 두고 표현만 교체한다. 회색 포장체·양쪽 연석·반복 점선·고속도로형
 * 화살표를 없애고, Codex 한지 팩의 붓길 타일을 구간과 꼭짓점에 stamp한다.
 */
/** FX_SPEC 3.3 — 경로 총길이는 상수 복사 대신 선분 합산으로 얻는다. */
const TOTAL_ENEMY_PATH_LENGTH = ENEMY_PATH_POINTS.slice(0, -1).reduce((sum, point, index) => {
  const next = ENEMY_PATH_POINTS[index + 1] as Point;
  return sum + Math.hypot(next.x - point.x, next.y - point.y);
}, 0);

const INK_TILE = 96;

const INK_STRAIGHT_LEN = 110;

/** 꼭짓점에서 열린 두 방향. 네 공유 꼭짓점(내부 사각과 외곽이 만나는 곳)은 교차 타일. */
const INK_VERTEX_KIND: ReadonlyArray<{ at: Point; corner: InkCorner | null }> = [
  { at: { x: 340, y: 60 }, corner: "rd" },
  { at: { x: 540, y: 60 }, corner: "dl" },
  { at: { x: 740, y: 260 }, corner: "dl" },
  { at: { x: 740, y: 460 }, corner: "lu" },
  { at: { x: 540, y: 660 }, corner: "lu" },
  { at: { x: 340, y: 660 }, corner: "ur" },
  { at: { x: 140, y: 460 }, corner: "ur" },
  { at: { x: 140, y: 260 }, corner: "rd" },
  { at: { x: 340, y: 260 }, corner: null },
  { at: { x: 540, y: 260 }, corner: null },
  { at: { x: 540, y: 460 }, corner: null },
  { at: { x: 340, y: 460 }, corner: null }
];

/** 같은 타일이 반복돼 인쇄물처럼 보이지 않도록 구간마다 미세한 알파 편차를 준다. */
function inkTileAlpha(seed: number): number {
  return 0.92 + ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.08;
}

function drawTrack(): void {
  context.save();

  // 1. 먹이 종이에 밴 자국을 먼저 깔아 붓길의 바닥을 만든다.
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  traceEnemyPath();
  context.strokeStyle = "rgba(38, 30, 20, 0.13)";
  context.lineWidth = 74;
  context.stroke();
  context.strokeStyle = "rgba(28, 22, 15, 0.16)";
  context.lineWidth = 58;
  context.stroke();
  context.restore();

  // 2. 구간별 직선 타일.
  for (let index = 0; index < ENEMY_PATH_POINTS.length - 1; index += 1) {
    const from = ENEMY_PATH_POINTS[index] as Point;
    const to = ENEMY_PATH_POINTS[index + 1] as Point;
    const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
    const image = inkStraightImage(horizontal ? "h" : "v");
    if (!image.complete || image.naturalWidth === 0) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.round(length / INK_STRAIGHT_LEN));
    for (let step = 0; step < steps; step += 1) {
      const t = (step + 0.5) / steps;
      const cx = from.x + (to.x - from.x) * t;
      const cy = from.y + (to.y - from.y) * t;
      // 타일 끝을 살짝 겹쳐 이음매가 끊겨 보이지 않게 한다.
      const span = length / steps + 18;
      context.globalAlpha = inkTileAlpha(index * 7 + step);
      if (horizontal) context.drawImage(image, cx - span / 2, cy - INK_TILE / 2, span, INK_TILE);
      else context.drawImage(image, cx - INK_TILE / 2, cy - span / 2, INK_TILE, span);
    }
  }

  // 3. 꼭짓점 타일. 모서리는 먹이 고이고 교차점은 네 방향이 만난다.
  for (const vertex of INK_VERTEX_KIND) {
    const image = vertex.corner === null ? inkCrossImage() : inkCornerImage(vertex.corner);
    if (!image.complete || image.naturalWidth === 0) continue;
    context.globalAlpha = 1;
    context.drawImage(image, vertex.at.x - INK_TILE / 2, vertex.at.y - INK_TILE / 2, INK_TILE, INK_TILE);
  }
  context.globalAlpha = 1;

  // 4. 진행 방향은 모든 구간이 아니라 출구 뒤 첫 직선에만 드문드문 둔다.
  const arrowSpots: ReadonlyArray<{ at: Point; direction: InkDirection }> = [
    { at: { x: 480, y: 60 }, direction: "r" },
    { at: { x: 740, y: 380 }, direction: "d" },
    { at: { x: 400, y: 660 }, direction: "l" },
    { at: { x: 140, y: 340 }, direction: "u" }
  ];
  for (const spot of arrowSpots) {
    const image = inkArrowImage(spot.direction);
    if (!image.complete || image.naturalWidth === 0) continue;
    context.globalAlpha = 0.72;
    context.drawImage(image, spot.at.x - 19, spot.at.y - 12, 38, 24);
  }
  context.globalAlpha = 1;

  // 5. 다음 이동 구간을 읽을 수 있도록 젖은 먹방울이 같은 방향으로 순환한다.
  //    FB6: 차분한 화면에서는 먹물 흐름을 멈추고 정지 배치만 남긴다.
  const currentOffset = calmBattlefield() ? 0.02 : (ctx.engine.state.elapsed * 0.018) % 1;
  canvas.dataset.inkCurrentOffset = currentOffset.toFixed(4);
  for (let index = 0; index < 10; index += 1) {
    const progress = currentOffset + index / 10;
    const point = positionOnPath(progress);
    const before = positionOnPath(progress - 0.0025);
    const after = positionOnPath(progress + 0.0025);
    const angle = Math.atan2(after.y - before.y, after.x - before.x);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);
    context.fillStyle = "rgba(6, 8, 6, 0.3)";
    context.beginPath();
    context.ellipse(-7, 0, 12, 3.8, 0, 0, Math.PI * 2);
    context.fill();
    const bead = context.createRadialGradient(-1.5, -2, 0.6, 0, 0, 6.4);
    bead.addColorStop(0, "rgba(112, 118, 110, 0.9)");
    bead.addColorStop(0.18, "rgba(26, 31, 27, 0.98)");
    bead.addColorStop(0.72, "rgba(4, 6, 5, 0.98)");
    bead.addColorStop(1, "rgba(3, 4, 3, 0.16)");
    context.fillStyle = bead;
    context.beginPath();
    context.arc(0, 0, 6.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(232, 224, 200, 0.28)";
    context.beginPath();
    context.arc(-1.8, -2.1, 1.25, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  drawSpawnPortals();
  context.restore();
}

function traceEnemyPath(): void {
  context.beginPath();
  context.moveTo(ENEMY_PATH_POINTS[0]?.x ?? 0, ENEMY_PATH_POINTS[0]?.y ?? 0);
  for (const point of ENEMY_PATH_POINTS.slice(1)) context.lineTo(point.x, point.y);
}

function drawSpawnPortals(): void {
  const labelOffsets: readonly Point[] = [
    { x: 0, y: -25 },
    { x: 34, y: 3 },
    { x: 0, y: 31 },
    { x: -34, y: 3 }
  ];
  for (let index = 0; index < ENEMY_SPAWN_PROGRESS.length; index += 1) {
    const spawnProgress = ENEMY_SPAWN_PROGRESS[index] as number;
    const point = positionOnPath(spawnProgress);
    const labelOffset = labelOffsets[index] as Point;
    // 이 출구에서 방금 나온 적이 있으면 spawning. 색만으로 알리지 않도록
    // "出" 글자와 "출구 N" 라벨은 두 상태 모두 그대로 남는다.
    const spawning = ctx.engine.state.enemies.some((enemy) => {
      const delta = enemy.progress - spawnProgress;
      return delta >= 0 && delta < 0.02;
    });
    const seal = exitSealImage(spawning ? "spawning" : "waiting");
    if (isPolishSpriteReady(seal)) {
      context.drawImage(seal, point.x - EXIT_SEAL_SIZE / 2, point.y - EXIT_SEAL_SIZE / 2, EXIT_SEAL_SIZE, EXIT_SEAL_SIZE);
    } else {
      context.fillStyle = "rgba(151, 47, 36, 0.12)";
      context.strokeStyle = "rgba(145, 39, 31, 0.92)";
      context.lineWidth = 2.4;
      context.beginPath();
      context.arc(point.x, point.y, 14, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.strokeStyle = "rgba(145, 39, 31, 0.58)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(point.x, point.y, 9.5, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "#8e2f27";
      context.font = '900 10px "Batang", serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("出", point.x, point.y + 1);
    }
    context.fillStyle = "#493426";
    context.font = '900 9px "Malgun Gothic", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`출구 ${index + 1}`, point.x + labelOffset.x, point.y + labelOffset.y);
  }
}

/**
 * 오행진을 평평한 색 사각형이 아니라 한지 위에 놓인 석제 제단으로 그린다.
 *
 * 십자 좌표(진 중심, 셀 간격 44, 판 182x182, 셀 38x38)는 `content.ts`가 결정하며
 * 여기서는 절대 바꾸지 않는다. 판 바깥으로 장식을 넓힐 여유가 없으므로
 * (판 모서리 91px, 도로 코어 안쪽 가장자리 84.5px) 깊이는 전부 판 안쪽과
 * 아래로 드리우는 그림자로만 표현한다.
 */
function drawBoard(): void {
  context.save();
  context.textAlign = "center";
  const occupied = new Set(ctx.engine.state.towers.map((tower) => tower.cell));
  // 제단 래스터가 준비된 진에서는 코드 석판과 셀 채움을 낮춰 재질을 가리지 않는다.
  const plateRastered: boolean[] = [];

  for (let formationIndex = 0; formationIndex < BOARD_FORMATIONS.length; formationIndex += 1) {
    const formation = BOARD_FORMATIONS[formationIndex] as (typeof BOARD_FORMATIONS)[number];
    const unlocked = ctx.engine.isFormationUnlocked(formationIndex);
    const resonance = ctx.engine.formationResonance(formationIndex);
    const cx = formation.center.x;
    const cy = formation.center.y;
    // 좌상·우하만 크게 깎은 비대칭 모서리가 웹 카드 대신 인장 실루엣으로 읽히게 한다.
    const plateRadii = [15, 4, 15, 4];
    const plateReady = isFormationPlateReady(formation.preferredWuxing, unlocked);
    plateRastered[formationIndex] = plateReady;

    if (plateReady) {
      // 1'. 접지 그림자는 판 안쪽에 숨긴 사각형이 드리우게 해 래스터 위에 blur를
      //     매 프레임 다시 계산하지 않는다. 판 바깥으로 새 장식이 나가지 않는다.
      context.save();
      context.shadowColor = unlocked ? "rgba(28, 20, 10, 0.62)" : "rgba(12, 11, 10, 0.6)";
      context.shadowBlur = 17;
      context.shadowOffsetY = 7;
      context.fillStyle = "rgba(24, 18, 11, 0.92)";
      context.beginPath();
      context.roundRect(cx - 87, cy - 87, 174, 174, 12);
      context.fill();
      context.restore();

      // 2'. 546×546 원본을 정확히 182×182로 축소해 놓는다. 확대·재착색 없음.
      context.drawImage(
        formationPlateImage(formation.preferredWuxing, unlocked),
        cx - FORMATION_PLATE_HALF,
        cy - FORMATION_PLATE_HALF,
        FORMATION_PLATE_SIZE,
        FORMATION_PLATE_SIZE
      );
    } else {
      // 1. 제단이 도로 위에 떠 있도록 아래로 접지 그림자를 드리운다.
      context.save();
      context.shadowColor = unlocked ? "rgba(28, 20, 10, 0.62)" : "rgba(12, 11, 10, 0.6)";
      context.shadowBlur = 17;
      context.shadowOffsetY = 7;
      const stone = context.createLinearGradient(0, cy - 91, 0, cy + 91);
      if (unlocked) {
        stone.addColorStop(0, "#eae4d4");
        stone.addColorStop(0.42, "#dcd5c2");
        stone.addColorStop(1, "#c4bca8");
      } else {
        stone.addColorStop(0, "#a8a396");
        stone.addColorStop(0.42, "#928d82");
        stone.addColorStop(1, "#77736b");
      }
      context.fillStyle = stone;
      context.beginPath();
      context.roundRect(cx - 91, cy - 91, 182, 182, plateRadii);
      context.fill();
      context.restore();

      // 2. 오행 기운을 돌 표면에 스미게 한다. 채도는 낮게, 중심에서만 번지게.
      context.save();
      context.beginPath();
      context.roundRect(cx - 91, cy - 91, 182, 182, plateRadii);
      context.clip();
      const tint = context.createRadialGradient(cx, cy, 8, cx, cy, 118);
      tint.addColorStop(0, formation.color + (unlocked ? (resonance.tier > 0 ? "5c" : "3a") : "18"));
      tint.addColorStop(1, formation.color + "00");
      context.fillStyle = tint;
      context.fillRect(cx - 91, cy - 91, 182, 182);

      // 3. 상단 광원 베벨. 위 모서리는 밝게, 아래 모서리는 어둡게.
      context.strokeStyle = "rgba(255, 253, 244, 0.85)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(cx - 83, cy - 90);
      context.lineTo(cx + 86, cy - 90);
      context.stroke();
      context.strokeStyle = "rgba(86, 70, 44, 0.4)";
      context.beginPath();
      context.moveTo(cx - 86, cy + 90);
      context.lineTo(cx + 83, cy + 90);
      context.stroke();
      context.restore();

      // 4. 테두리: 바깥 접촉선 + 오행 색 실선.
      context.strokeStyle = "rgba(52, 40, 22, 0.55)";
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(cx - 91, cy - 91, 182, 182, plateRadii);
      context.stroke();
      context.strokeStyle = unlocked ? formation.color + (resonance.tier > 0 ? "e0" : "9e") : "rgba(88, 84, 79, 0.66)";
      context.lineWidth = resonance.tier > 0 ? 2 : 1.4;
      context.beginPath();
      context.roundRect(cx - 88.5, cy - 88.5, 177, 177, [13, 3, 13, 3]);
      context.stroke();
    }

    // 5. 공명 단계는 네 모서리 꺾쇠 길이로 알린다. 색만으로 구분하지 않는다.
    if (unlocked && resonance.tier > 0) {
      const arm = 8 + resonance.tier * 5;
      context.strokeStyle = formation.color;
      context.lineWidth = 2.6;
      context.lineCap = "round";
      context.shadowColor = formation.color;
      // FB6: 공명 꺾쇠 발광 9 → 7 (-22%).
      context.shadowBlur = 7;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const bx = cx + sx * 84;
        const by = cy + sy * 84;
        context.beginPath();
        context.moveTo(bx - sx * arm, by);
        context.lineTo(bx, by);
        context.lineTo(bx, by - sy * arm);
        context.stroke();
      }
      context.shadowBlur = 0;
      context.lineCap = "butt";
    }

    // 6. 새겨 넣은 오행 글자. 아래쪽 밝은 획을 먼저 깔아 음각으로 보이게 한다.
    context.font = '900 44px "Batang", serif';
    context.fillStyle = "rgba(255, 253, 244, 0.75)";
    context.fillText(formation.preferredWuxing, cx, cy + 17);
    context.fillStyle = unlocked ? formation.color + (resonance.tier > 0 ? "5e" : "44") : "rgba(96, 92, 86, 0.26)";
    context.fillText(formation.preferredWuxing, cx, cy + 16);

    // 7. 진 이름표: 돌에 박힌 작은 명패.
    const bonusLabel = resonance.damageBonus > 0 ? ` · 피해 +${Math.round(resonance.damageBonus * 100)}%` : "";
    const unlockCost = ctx.engine.nextFormationUnlockCost();
    const unlockAffordable = !unlocked && unlockCost !== null && ctx.engine.state.gold >= unlockCost && ctx.engine.state.startingFormationIndex !== null;
    const plateText = unlocked
      ? `${formation.label} ${resonance.matching}/16${bonusLabel}`
      : unlockAffordable
        ? `${formation.label} · ${unlockCost}엽전 해금 가능!`
        : `${formation.label} · ${unlockCost ?? 0}엽전 해금`;
    context.font = '900 10px "Malgun Gothic", sans-serif';
    const nameWidth = context.measureText(plateText).width + 16;
    // 판 위 중앙은 윗줄 자령 명패가 차지한다. 좌상단 모서리에 붙인다.
    const plateLeft = cx - 91;
    context.fillStyle = "rgba(28, 25, 21, 0.94)";
    context.beginPath();
    context.roundRect(plateLeft, cy - 122, nameWidth, 17, [3, 8, 3, 8]);
    context.fill();
    context.strokeStyle = unlocked ? formation.color + "8c" : "rgba(112, 108, 102, 0.55)";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = unlocked ? "#f6ecd2" : unlockAffordable ? "#ffd98a" : "#a8a29a";
    context.textAlign = "left";
    context.fillText(plateText, plateLeft + 8, cy - 113.5);
    context.textAlign = "center";
  }

  // 8. 셀은 돌판에 파인 소켓으로 그린다. 표 칸처럼 보이지 않게 안쪽 그림자를 준다.
  for (let index = 0; index < BOARD_CELLS.length; index += 1) {
    const cell = BOARD_CELLS[index] as Point;
    const unlocked = ctx.engine.isCellUnlocked(index);
    const filled = occupied.has(index);
    const formationIndex = Math.floor(index / CELLS_PER_FORMATION);
    const formation = BOARD_FORMATIONS[formationIndex] as (typeof BOARD_FORMATIONS)[number];
    // 제단 래스터에 이미 4×4 소켓이 파여 있으면 코드 채움을 낮춰 재질을 덮지 않는다.
    // 좌표·크기·히트영역·테두리는 그대로다.
    const overPlate = plateRastered[formationIndex] === true;

    // 점유 칸에는 p0-ui-components-pack-v1 의 오행 소켓을 자령 아래 깔아 어느 진에
    // 속한 칸인지 한눈에 남긴다. 빈 칸은 제단 래스터의 소켓 재질을 그대로 쓴다.
    // 원본 114×114 → 38×38 축소만 하며 좌표·히트영역은 손대지 않는다.
    const socketRastered = filled && unlocked && isCellSocketReady(formation.preferredWuxing, true);
    if (socketRastered) {
      context.drawImage(
        cellSocketImage(formation.preferredWuxing, true),
        cell.x - CELL_SOCKET_SIZE / 2,
        cell.y - CELL_SOCKET_SIZE / 2,
        CELL_SOCKET_SIZE,
        CELL_SOCKET_SIZE
      );
    }

    // 소켓 바닥: 위가 어둡고 아래가 밝은 그라디언트가 파인 느낌을 만든다.
    // 래스터 소켓을 깐 칸에서는 재질을 덮지 않도록 코드 채움을 건너뛴다.
    if (!socketRastered) {
      const socket = context.createLinearGradient(0, cell.y - 19, 0, cell.y + 19);
      if (!unlocked) {
        socket.addColorStop(0, overPlate ? "rgba(88, 84, 78, 0.10)" : "rgba(88, 84, 78, 0.42)");
        socket.addColorStop(1, overPlate ? "rgba(132, 127, 118, 0.06)" : "rgba(132, 127, 118, 0.3)");
      } else if (filled) {
        socket.addColorStop(0, formation.color + (overPlate ? "50" : "74"));
        socket.addColorStop(1, formation.color + (overPlate ? "28" : "3e"));
      } else {
        socket.addColorStop(0, formation.color + (overPlate ? "1e" : "4c"));
        socket.addColorStop(1, formation.color + (overPlate ? "10" : "24"));
      }
      context.fillStyle = socket;
      context.beginPath();
      context.roundRect(cell.x - 19, cell.y - 19, 38, 38, 5);
      context.fill();
    }

    // 아래 가장자리에 얇은 빛을 남겨 파인 깊이를 굳힌다.
    // 래스터 판·소켓은 자체 베벨이 있으므로 이 선을 겹쳐 그리지 않는다.
    if (!overPlate && !socketRastered) {
      context.strokeStyle = "rgba(255, 253, 244, 0.7)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cell.x - 14, cell.y + 18.5);
      context.lineTo(cell.x + 14, cell.y + 18.5);
      context.stroke();
    }

    context.strokeStyle = !unlocked
      ? "rgba(104, 99, 92, 0.7)"
      : formation.color + (filled ? "d2" : "7e");
    context.lineWidth = filled ? 1.6 : 1;
    context.beginPath();
    context.roundRect(cell.x - 19, cell.y - 19, 38, 38, 5);
    context.stroke();

    if (!filled) {
      if (unlocked) {
        // 빈 칸은 글자 대신 작은 상감 점으로 표시해 격자 소음을 줄인다.
        context.fillStyle = formation.color + "6a";
        context.beginPath();
        context.arc(cell.x, cell.y, 2.4, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  // 9. 잠긴 진에는 자물쇠를 얹는다. 셀 소켓보다 뒤에 그려야 가려지지 않는다.
  //    잠긴 진 클릭이 곧 해금 시도인데도 시각 단서가 없어 발견되지 않았다.
  drawFormationLocks();
  context.restore();
}

/**
 * 잠긴 오행진 중앙 자물쇠.
 *
 * 스프라이트(120×120 → 40×40)를 우선 쓰고, 로드 실패 시 절차 드로잉으로 되돌린다.
 * 엽전이 충분하면 glow 스프라이트 + 금색 맥동 링을 더해 "눌러도 된다"를 알린다.
 * 모션 감소 설정에서는 정지 이미지만 쓴다.
 */
function drawFormationLocks(): void {
  const unlockCost = ctx.engine.nextFormationUnlockCost();
  const purchasable = unlockCost !== null && ctx.engine.state.startingFormationIndex !== null;
  const affordable = purchasable && ctx.engine.state.gold >= unlockCost;
  const pulse = calmBattlefield() ? 0 : (performance.now() % 1_600) / 1_600;

  for (let formationIndex = 0; formationIndex < BOARD_FORMATIONS.length; formationIndex += 1) {
    if (ctx.engine.isFormationUnlocked(formationIndex)) continue;
    const formation = BOARD_FORMATIONS[formationIndex] as (typeof BOARD_FORMATIONS)[number];
    const cx = formation.center.x;
    const cy = formation.center.y;
    const hovered = ctx.hoveredLockFormation === formationIndex;
    const scale = hovered && !reducedMotion ? 1.14 : 1;

    // 살 수 있는 진은 금색 링이 1.6초 주기로 번지며 시선을 끈다.
    // FB6: 반경 성장 20 → 15, 시작 알파 0.62 → 0.46 (-25%).
    if (affordable && !calmBattlefield()) {
      const radius = 26 + pulse * 15;
      context.save();
      context.globalAlpha = (1 - pulse) * 0.46;
      context.strokeStyle = "#ffd98a";
      context.lineWidth = 2.4;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    const kind = affordable ? "glow" : "closed";
    if (isLockSpriteReady(kind)) {
      const size = LOCK_SPRITE_SIZE * scale;
      context.drawImage(lockSpriteImage(kind), cx - size / 2, cy - size / 2, size, size);
    } else {
      drawProceduralLock(cx, cy, scale, affordable);
    }

    // 색만으로 잠금·해금 가능을 가르지 않는다. 자물쇠 아래에 사유를 남긴다.
    const note = !purchasable
      ? "첫 소환 대기"
      : affordable
        ? `${unlockCost}엽전 해금`
        : `엽전 ${unlockCost - ctx.engine.state.gold} 부족`;
    context.save();
    context.font = '900 10px "Malgun Gothic", sans-serif';
    context.textAlign = "center";
    const noteWidth = context.measureText(note).width + 12;
    context.fillStyle = "rgba(28, 25, 21, 0.9)";
    context.beginPath();
    context.roundRect(cx - noteWidth / 2, cy + 24, noteWidth, 15, 4);
    context.fill();
    context.fillStyle = affordable ? "#ffd98a" : "#c8c1b6";
    context.fillText(note, cx, cy + 35);
    context.restore();
  }
}

/** 스프라이트가 없을 때 쓰는 절차 자물쇠(몸통 26×20 + 고리). */
function drawProceduralLock(cx: number, cy: number, scale: number, affordable: boolean): void {
  context.save();
  context.translate(cx, cy);
  context.scale(scale, scale);
  context.strokeStyle = affordable ? "rgba(255, 217, 138, 0.92)" : "rgba(226, 219, 205, 0.72)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, -8, 8, Math.PI, 0);
  context.stroke();
  context.fillStyle = affordable ? "rgba(96, 74, 34, 0.9)" : "rgba(60, 50, 38, 0.85)";
  context.beginPath();
  context.roundRect(-13, -6, 26, 20, 4);
  context.fill();
  context.strokeStyle = affordable ? "rgba(255, 217, 138, 0.92)" : "rgba(226, 219, 205, 0.62)";
  context.lineWidth = 1.4;
  context.stroke();
  context.fillStyle = affordable ? "#ffd98a" : "#d8d1c4";
  context.beginPath();
  context.arc(0, 3, 2.4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

let idiomPlacementGuideKey = "";

function refreshSealedIdiomTowerMarks(): void {
  const marks = new Map<number, string>();
  const signatures: string[] = [];
  for (const seal of ctx.engine.activeIdiomSeals()) {
    const idiom = idiomById(ctx.engine.state.region, seal.idiomId);
    if (!idiom) continue;
    signatures.push(seal.cells.join("-"));
    for (const cell of seal.cells) {
      const tower = ctx.engine.state.towers.find((candidate) => candidate.cell === cell);
      if (tower) marks.set(tower.id, idiom.color);
    }
  }
  ctx.sealedIdiomTowerMarks = marks;
  // 발동 중인 봉인이 지금 어느 칸을 잡고 있는지 — 진단·e2e 가 읽는 갈피.
  const signature = signatures.join(" ");
  if (canvas.dataset.idiomSealCells !== signature) canvas.dataset.idiomSealCells = signature;
}

function refreshIdiomPlacementGuide(): void {
  const idiom = ctx.engine.currentIdiomTarget();
  const key = idiom
    ? `${idiom.id}|${ctx.engine.state.towers.map((tower) => `${tower.cell}:${tower.char}`).sort().join(",")}|${ctx.engine.state.unlockedFormations.join("")}`
    : "";
  if (key === idiomPlacementGuideKey) return;
  idiomPlacementGuideKey = key;
  if (!idiom) {
    ctx.idiomPlacementGuide = null;
    canvas.dataset.idiomTarget = "";
    canvas.dataset.idiomChainCells = "";
    canvas.dataset.idiomNextCells = "";
    canvas.dataset.idiomOrderBadges = "";
    return;
  }
  const characters = [...idiom.chars];
  const chain = partialIdiomChain(ctx.engine.state.towers, idiom);
  const orders = new Map<number, IdiomOrder>();
  const takenOrders = new Set<number>();
  const takenTowers = new Set<number>();
  // 사슬에 실제로 쓰인 자령이 순번을 먼저 가져간다(같은 글자 중복 대비).
  for (let index = 0; index < chain.cells.length; index += 1) {
    const order = (chain.reversed ? chain.startOrder - index : chain.startOrder + index) as IdiomOrder;
    const tower = ctx.engine.state.towers.find((candidate) => candidate.cell === chain.cells[index]);
    if (!tower) continue;
    orders.set(tower.id, order);
    takenOrders.add(order);
    takenTowers.add(tower.id);
  }
  for (let index = 0; index < characters.length; index += 1) {
    const order = index + 1;
    if (takenOrders.has(order)) continue;
    const tower = ctx.engine.state.towers.find(
      (candidate) => candidate.char === characters[index] && !takenTowers.has(candidate.id)
    );
    if (!tower) continue;
    orders.set(tower.id, order as IdiomOrder);
    takenOrders.add(order);
    takenTowers.add(tower.id);
  }

  // 직선 규칙에서는 다음 자리가 줄 위에 정해져 있다. 코어가 짚어 준 칸만 쓴다.
  const nextCells = chain.complete ? [] : chain.nextCells.filter((cell) => ctx.engine.isCellUnlocked(cell));
  ctx.idiomPlacementGuide = { idiom, chain, orders, nextCells };
  // 배치 안내 상태를 캔버스 데이터셋으로 내보내 캡처·e2e 가 읽을 수 있게 한다.
  canvas.dataset.idiomTarget = idiom.chars;
  canvas.dataset.idiomChainCells = chain.cells.join(",");
  canvas.dataset.idiomChainReversed = String(chain.reversed);
  canvas.dataset.idiomNextOrder = chain.nextOrder === null ? "" : String(chain.nextOrder);
  canvas.dataset.idiomNextCells = nextCells.join(",");
  canvas.dataset.idiomOrderBadges = [...orders]
    .map(([towerId, order]) => `${ctx.engine.state.towers.find((tower) => tower.id === towerId)?.cell ?? -1}:${order}`)
    .join(",");
}

/**
 * 순번 인장(60x60 원본 → 표시 20px). 로드 실패 시 인주 원 + 백색 숫자로 대체한다.
 * [SKILL-V2] 연환 인장이 같은 문법을 빌린다 — 스프라이트는 1~4까지라 5 이상은
 * 언제나 절차 인장(인주 원 + 숫자)으로 그린다.
 */
export function drawIdiomOrderBadge(centerX: number, centerY: number, size: number, order: IdiomOrder | number): void {
  const sprite = order >= 1 && order <= 4 ? idiomOrderSealImage(order as IdiomOrder) : null;
  if (sprite && idiomSpriteReady(sprite)) {
    context.drawImage(sprite, centerX - size / 2, centerY - size / 2, size, size);
    return;
  }
  context.save();
  context.fillStyle = "#b6372b";
  context.strokeStyle = "rgba(255, 242, 214, 0.85)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff6e4";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${Math.round(size * 0.62)}px "Malgun Gothic", sans-serif`;
  context.fillText(String(order), centerX, centerY + 0.5);
  context.restore();
}

/**
 * 다음 글자를 놓을 수 있는 빈 칸을 금색 점선 테두리와 순번으로 표시한다.
 * 자령을 끌고 있는 동안에도 같은 표시가 유지된다.
 */
function drawIdiomPlacementCells(): void {
  const guide = ctx.idiomPlacementGuide;
  if (!guide || guide.nextCells.length === 0 || guide.chain.nextOrder === null) return;
  const order = guide.chain.nextOrder as IdiomOrder;
  // FB6: 숨쉬기 진폭 0.22 → 0.16 (-27%), 발광 blur 8 → 6 (-25%).
  const breath = calmBattlefield() ? 0.72 : 0.58 + Math.sin(ctx.engine.state.elapsed * 3.1) * 0.16;
  context.save();
  context.setLineDash([5, 4]);
  context.lineWidth = 1.8;
  context.strokeStyle = "#ffd479";
  context.shadowColor = "rgba(255, 205, 105, 0.7)";
  context.shadowBlur = 6;
  context.globalAlpha = breath;
  for (const cell of guide.nextCells) {
    const point = BOARD_CELLS[cell] as Point;
    context.beginPath();
    context.roundRect(point.x - 17.5, point.y - 17.5, 35, 35, 5);
    context.stroke();
  }
  context.setLineDash([]);
  context.shadowBlur = 0;
  context.globalAlpha = Math.min(1, breath + 0.24);
  for (const cell of guide.nextCells) {
    const point = BOARD_CELLS[cell] as Point;
    drawIdiomOrderBadge(point.x, point.y, 18, order);
  }
  context.restore();
}

/** 폴리라인 위 비율 t(0~1) 지점. 사슬 빔의 광점이 1→4 방향으로 흐르게 한다. */
function pointAlongPolyline(points: readonly Point[], t: number): Point | null {
  if (points.length < 2) return points[0] ?? null;
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1] as Point;
    const to = points[index] as Point;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return points[0] ?? null;
  let travelled = t * total;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index] as number;
    if (travelled <= length) {
      const from = points[index] as Point;
      const to = points[index + 1] as Point;
      const ratio = length === 0 ? 0 : travelled / length;
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
    travelled -= length;
  }
  return points[points.length - 1] ?? null;
}

/**
 * 발동한 봉인 — 스펙 6라운드 C.
 * 네 칸이 성어 색으로 숨쉬고, 사슬 빔 위를 광점이 1→4 방향으로 흐르며,
 * 칸마다 순번 인장이 박힌다. 모션 감소에서는 펄스 없이 정적 60% 밝기만 쓴다.
 */
function drawIdiomSeals(): void {
  // R18: 줄이 흩어진 봉인은 지킬 칸이 없다. 발광은 발동 중인 봉인만 낸다.
  for (const seal of ctx.engine.activeIdiomSeals()) {
    const idiom = idiomById(ctx.engine.state.region, seal.idiomId);
    if (!idiom) continue;
    const points = seal.cells.map((cell) => BOARD_CELLS[cell] as Point);
    // FB6: 숨쉬기 진폭 0.5 → 0.36 (-28%). 차분한 화면에서는 정지 0.6.
    const breath = calmBattlefield() ? 0.6 : 0.5 + (Math.sin((ctx.engine.state.elapsed / 1.8) * Math.PI * 2) * 0.5 + 0.5) * 0.36;
    context.save();

    // 1. 봉인된 칸 자체가 숨쉬듯 발광한다.
    for (const point of points) {
      context.globalAlpha = breath * 0.55;
      context.fillStyle = idiom.color;
      context.beginPath();
      context.roundRect(point.x - 19, point.y - 19, 38, 38, 5);
      context.fill();
      context.globalAlpha = Math.min(1, breath + 0.25);
      context.strokeStyle = idiom.color;
      context.shadowColor = idiom.color;
      // FB6: 발광 12·4 → 9·3 (-25%).
      context.shadowBlur = 9 * breath + 3;
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(point.x - 19, point.y - 19, 38, 38, 5);
      context.stroke();
      context.shadowBlur = 0;
    }

    // 2. 사슬 빔. 굵기를 키워 "이 넷이 한 줄"이라는 사실이 멀리서도 읽히게 한다.
    context.globalAlpha = 0.48;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = idiom.color;
    context.shadowColor = idiom.color;
    // FB6: 사슬 빔 발광 18 → 13 (-28%).
    context.shadowBlur = 13;
    context.lineWidth = 12;
    context.beginPath();
    context.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    context.globalAlpha = 0.82;
    context.strokeStyle = "#fff7dc";
    context.shadowBlur = 0;
    context.lineWidth = 2;
    context.stroke();

    // 3. 광점 1개가 1번 칸에서 4번 칸으로 흐르며 순서 방향을 알린다.
    if (!calmBattlefield()) {
      const spark = pointAlongPolyline(points, ((ctx.engine.state.elapsed + seal.completedAt) / 2.2) % 1);
      if (spark) {
        context.globalAlpha = 0.95;
        context.fillStyle = "#fff9e6";
        context.shadowColor = idiom.color;
        context.shadowBlur = 14;
        context.beginPath();
        context.arc(spark.x, spark.y, 4.5, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }
    }

    // 4. 칸마다 순번 인장을 박아 어느 글자가 몇 번째인지 남긴다.
    context.globalAlpha = 1;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index] as Point;
      context.fillStyle = idiom.color;
      context.beginPath();
      context.arc(point.x, point.y, 5, 0, Math.PI * 2);
      context.fill();
      drawIdiomOrderBadge(point.x - 13, point.y - 13, 16, (index + 1) as IdiomOrder);
    }
    context.restore();
  }
}

/**
 * 발동 순간의 파문 링 — 스펙 6라운드 C3.
 *
 * 코덱스 파문 마스크를 성어 색으로 물들여 봉인된 네 칸에서 1→4 차례로 터뜨린다.
 * 마스크가 아직 안 실렸으면 같은 리듬의 절차 원호로 대신한다. 월드 좌표계에서
 * 부르므로 updateAndDrawFx 안에서만 호출한다.
 */
export function drawIdiomRipples(): void {
  // FB6: 차분한 화면에서는 파문 플래시를 그리지 않는다(수명 관리는 아래에서 계속).
  const sprite = idiomRipples.length > 0 ? tintedIdiomRipple(idiomRipples[0]?.color ?? "#ffffff") : null;
  for (const ripple of idiomRipples) {
    if (calmBattlefield()) break;
    const live = ripple.age - ripple.delay;
    if (live < 0) continue;
    if (!isWorldPointVisible(ripple.at, 120)) continue;
    const ratio = Math.min(1, live / ripple.duration);
    const size = 46 + ratio * 128;
    context.save();
    context.globalAlpha = (1 - ratio) * (1 - ratio) * 0.9;
    if (sprite) {
      context.drawImage(sprite, ripple.at.x - size / 2, ripple.at.y - size / 2, size, size);
    } else {
      context.strokeStyle = ripple.color;
      context.lineWidth = 5 - ratio * 3.4;
      context.shadowColor = ripple.color;
      // FB6: 파문 폴백 발광 16 → 12 (-25%).
      context.shadowBlur = 12;
      context.beginPath();
      context.arc(ripple.at.x, ripple.at.y, size / 2, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }
  for (let index = idiomRipples.length - 1; index >= 0; index -= 1) {
    const ripple = idiomRipples[index] as IdiomRippleFx;
    if (ripple.age >= ripple.delay + ripple.duration) idiomRipples.splice(index, 1);
  }
}

/**
 * 성어 4자 대형 플래시 — 스펙 6라운드 C3.
 *
 * 봉인된 네 칸 위에 뜨되, 카메라가 그 칸을 벗어나 있어도 무엇이 발동했는지는
 * 알아야 하므로 화면 좌표로 그리고 전장 안으로 clamp 한다. 그래서 월드 변환을
 * 되돌린 뒤(drawWorld 의 restore 이후)에 호출한다.
 */
function drawIdiomFlash(): void {
  const flash = ctx.idiomFlash;
  if (!flash || flash.age >= flash.duration) {
    if (flash) ctx.idiomFlash = null;
    if (canvas.dataset.idiomFlash) canvas.dataset.idiomFlash = "";
    return;
  }
  canvas.dataset.idiomFlash = flash.chars;
  const ratio = flash.age / flash.duration;
  // 튀어 오르고(0~18%) 머무르다(~62%) 사라진다.
  const rise = Math.min(1, ratio / 0.18);
  const fade = ratio < 0.62 ? 1 : 1 - (ratio - 0.62) / 0.38;
  // FB6: 차분한 화면에서는 튀어 오르는 플래시 없이 정지 표기만 남긴다.
  const scale = calmBattlefield() ? 1 : 0.82 + rise * 0.24 - Math.max(0, ratio - 0.62) * 0.16;
  const x = Math.min(WORLD_WIDTH - 150, Math.max(150, ctx.mapOffset.x + flash.at.x * ctx.mapZoom));
  const y = Math.min(WORLD_HEIGHT - 120, Math.max(120, ctx.mapOffset.y + flash.at.y * ctx.mapZoom));
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, rise * fade));
  context.translate(x, y);
  context.scale(scale, scale);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 62px "Malgun Gothic", serif';
  // 어떤 배경 위에서도 읽히도록 먹 윤곽 먼저, 성어 색 채움 나중.
  context.lineJoin = "round";
  context.lineWidth = 9;
  context.strokeStyle = "rgba(4, 8, 14, 0.92)";
  context.strokeText(flash.chars, 0, 0);
  context.shadowColor = flash.color;
  // FB6: 플래시 발광 26 → 19 (-27%).
  context.shadowBlur = 19;
  context.fillStyle = "#fff6dd";
  context.fillText(flash.chars, 0, 0);
  context.shadowBlur = 0;
  context.font = '800 19px "Malgun Gothic", sans-serif';
  context.lineWidth = 6;
  context.strokeText(`${flash.reading} · 봉인`, 0, 50);
  context.fillStyle = flash.color;
  context.fillText(`${flash.reading} · 봉인`, 0, 50);
  context.restore();
}

function hoveredMaterialIds(): Set<number> {
  const ids = new Set(ctx.hoveredCompositionMaterialIds);
  if (ctx.hoveredRecipeId) {
    const option = ctx.engine.availableEvolutions().find((candidate) => candidate.recipeId === ctx.hoveredRecipeId);
    for (const id of option?.materialTowerIds ?? []) ids.add(id);
  }
  return ids;
}

function drawCompositionMaterialLinks(): void {
  const materials = ctx.engine.state.towers.filter((tower) => ctx.hoveredCompositionMaterialIds.has(tower.id));
  if (materials.length === 0) return;
  const points = materials.map((tower) => BOARD_CELLS[tower.cell] as Point);
  context.save();
  context.strokeStyle = "#ffe39a";
  context.fillStyle = "rgba(255, 227, 154, 0.1)";
  context.shadowColor = "#ffcb61";
  context.shadowBlur = 18;
  context.lineWidth = 3;
  context.setLineDash([8, 5]);
  if (points.length > 1) {
    context.beginPath();
    context.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.setLineDash([]);
  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, 26, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  const anchor = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  anchor.x /= points.length;
  anchor.y /= points.length;
  context.shadowBlur = 8;
  context.fillStyle = "#fff4c7";
  context.font = '900 10px "Malgun Gothic", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText("합성 재료", anchor.x, anchor.y - 30);
  context.restore();
}

function drawSelection(): void {
  const selected = ctx.engine.selectedTower();
  if (selected && !ctx.engine.selectedTowerIsStored()) drawTowerRange(selected, false);
  const hovered = ctx.hoveredTowerId === null ? undefined : ctx.engine.state.towers.find((tower) => tower.id === ctx.hoveredTowerId);
  if (hovered && hovered.id !== selected?.id) drawTowerRange(hovered, true);
}

function drawTowerRange(tower: Tower, hovered: boolean): void {
  const cell = BOARD_CELLS[tower.cell] as Point;
  const definition = definitionForTower(ctx.engine.catalog, tower.definitionId);
  const style = ELEMENT_STYLES[tower.wuxing];
  context.save();
  context.strokeStyle = style.color + (hovered ? "8f" : "40");
  context.fillStyle = style.color + (hovered ? "10" : "09");
  context.lineWidth = hovered ? 2.2 : 1.5;
  context.setLineDash(hovered ? [10, 6] : [7, 7]);
  context.beginPath();
  context.arc(cell.x, cell.y, definition.combat.range + ctx.engine.towerRangeBonus(tower) + ctx.engine.idiomBonus("range") + (tower.concentration ?? 0) * 4 + ctx.engine.combinedUpgradeBonus(tower.wuxing, "range"), 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawEnemy(enemy: Enemy, point = positionOnPath(enemy.progress)): void {
  const colors: Record<Enemy["archetype"], string> = { normal: "#7770d9", swarm: "#bd78e8", swift: "#5bcde1", armored: "#b69b76", regenerator: "#64c489", boss: "#ff627d" };
  const color = colors[enemy.archetype];
  const weaknessColor = ELEMENT_STYLES[enemy.weakness].color;
  const visual = enemyJaryeongVisualFor(enemy.archetype, enemy.id + enemy.wave);
  // 적 전용 1×2 시트를 우선 쓰고, 로드 실패·크기 불일치일 때만 아군 자령 2×2 시트로
  // 되돌아간다. 둘 다 없으면 아래 원형+한자 폴백이 남는다.
  const sheetReady = isEnemySheetReady(enemy.archetype);
  const image = sheetReady ? enemySheetImage(enemy.archetype) : jaryeongSpriteImage(visual);
  const drawSize = enemy.boss ? 70 : enemy.archetype === "swarm" ? 32 : enemy.archetype === "armored" ? 46 : 40;
  // 스프라이트 프레임 위쪽 투명 여백을 보정해 HP 바를 그림 윗변에 붙인다.
  // 전용 시트는 아키타입별 실측 알파 bbox, 폴백은 기존 계수를 쓴다.
  const artTop = drawSize * (sheetReady ? enemyArtTopFactor(enemy.archetype) : FALLBACK_ART_TOP_FACTOR);
  const top = point.y - artTop;
  context.save();
  context.translate(point.x, point.y);
  // FB6: 우두머리 흔들림도 상시 맥동이라 차분한 화면에서는 멈춘다.
  if (enemy.boss && !calmBattlefield()) context.rotate(Math.sin(ctx.engine.state.elapsed * 2) * 0.025);

  // 적과 아군 자령은 같은 스프라이트 세트를 공유하므로, 그림 자체로는 구분되지
  // 않는다. 발밑 표식과 테두리 광원으로 위협을 알린다.
  //   아군: 제단 위 정갈한 타원 고리 + 오행 색 광원
  //   적  : 번진 먹자국 + 주홍 톱니 고리 + 붉은 테두리
  context.save();
  context.translate(0, drawSize * 0.31);
  context.scale(1, 0.3);
  const blot = context.createRadialGradient(0, 0, 1, 0, 0, drawSize * 0.46);
  blot.addColorStop(0, "rgba(14, 9, 7, 0.72)");
  blot.addColorStop(0.6, "rgba(20, 12, 9, 0.42)");
  blot.addColorStop(1, "rgba(20, 12, 9, 0)");
  context.fillStyle = blot;
  context.beginPath();
  context.arc(0, 0, drawSize * 0.46, 0, Math.PI * 2);
  context.fill();

  // 약점 오행은 톱니 고리의 색으로만 남긴다.
  const teeth = enemy.boss ? 14 : 9;
  const outer = drawSize * 0.42;
  const inner = drawSize * 0.32;
  context.beginPath();
  for (let index = 0; index < teeth * 2; index += 1) {
    const angle = (index / (teeth * 2)) * Math.PI * 2;
    const radius = index % 2 === 0 ? outer : inner;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.strokeStyle = weaknessColor + "b4";
  context.lineWidth = enemy.boss ? 3.4 : 2.4;
  context.shadowColor = weaknessColor;
  // FB6: 톱니 고리 발광 16/7 → 12/5 (-25~29%).
  context.shadowBlur = enemy.boss ? 12 : 5;
  context.stroke();
  context.shadowBlur = 0;
  context.restore();

  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const frame = reducedMotion ? 0 : Math.floor((ctx.engine.state.elapsed * 2.2 + enemy.id * 0.37)) % 2;
    // 적 전용 시트는 1행 2열이라 세로를 자르지 않는다. 아군 폴백 시트만 2×2다.
    const frameWidth = sheetReady ? ENEMY_FRAME_SIZE : image.naturalWidth / 2;
    const frameHeight = sheetReady ? ENEMY_FRAME_SIZE : image.naturalHeight / 2;
    // 적대 윤곽은 진사(cinnabar) 계열 광원으로만 알린다. 원본을 재착색하지 않는다.
    context.shadowColor = enemy.boss ? "#c4392a" : "#9f2f23";
    // FB6: 주홍 윤곽 발광 16/8 → 12/6 (-25%).
    context.shadowBlur = enemy.boss ? 12 : 6;
    context.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    context.shadowBlur = 0;

  } else {
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, drawSize * 0.28, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#071019";
    context.font = '900 ' + String(enemy.boss ? 24 : 15) + 'px "Malgun Gothic", serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(visual.hanja, 0, 1);
  }

  if (enemy.flash > 0) {
    const hitStrength = Math.min(1, enemy.flash / 0.09);
    context.globalAlpha = hitStrength * 0.85;
    context.strokeStyle = "#241d16";
    context.lineWidth = 3.4;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.arc(0, 0, drawSize * 0.36 + (1 - hitStrength) * 7, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    // 전장 전체 밝기 필터는 쓰지 않는다. 맞은 개체 가장자리만 짧게 밝힌다.
    context.globalAlpha = hitStrength * 0.5;
    context.strokeStyle = "#fff2d8";
    context.lineWidth = 1.6;
    context.beginPath();
    context.arc(0, 0, drawSize * 0.3, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  // [SKILL-V2] 연환 인장: 성어 순번 인장의 시각 문법 재사용 — 쌓인 만큼 1·2·3…
  // 인장이 줄지어 붙는다. 5겹째(스프라이트는 4까지)는 절차 인장 폴백이 그린다.
  const sealStacks = (enemy.sealUntil ?? 0) > ctx.engine.state.elapsed ? Math.min(5, enemy.sealStacks ?? 0) : 0;
  if (sealStacks > 0) {
    for (let index = 0; index < sealStacks; index += 1) {
      const x = (index - (sealStacks - 1) / 2) * 13;
      drawIdiomOrderBadge(x, -artTop - 29, 12, index + 1);
    }
  }
  const statuses: Array<{ glyph: string; color: string }> = [];
  if (enemy.poisonUntil > ctx.engine.state.elapsed) statuses.push({ glyph: "毒", color: ELEMENT_STYLES.木.color });
  if (enemy.slowFactor < 1 && enemy.slowUntil > ctx.engine.state.elapsed) statuses.push({ glyph: "凍", color: ELEMENT_STYLES.水.color });
  if (enemy.stunnedUntil > ctx.engine.state.elapsed) statuses.push({ glyph: "封", color: ELEMENT_STYLES.土.color });
  // [SKILL-V1] 상극 각인: 낙인 오행 색의 克 표식. 남은 시간 동안만 보인다.
  if ((enemy.brandUntil ?? 0) > ctx.engine.state.elapsed && enemy.brandWuxing) statuses.push({ glyph: "克", color: ELEMENT_STYLES[enemy.brandWuxing].color });
  if (enemy.armor >= 0.15) statuses.push({ glyph: "甲", color: ELEMENT_STYLES.金.color });
  for (let index = 0; index < statuses.length; index += 1) {
    const status = statuses[index] as { glyph: string; color: string };
    const x = (index - (statuses.length - 1) / 2) * 14;
    context.fillStyle = "rgba(6,10,17,0.88)";
    context.strokeStyle = status.color;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x, -artTop - 14, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = status.color;
    context.font = '900 10px "Malgun Gothic", serif';
    context.fillText(status.glyph, x, -artTop - 13);
  }
  context.restore();
  const width = enemy.boss ? 64 : Math.max(30, drawSize * 0.7);
  context.fillStyle = "rgba(6, 4, 3, 0.86)";
  context.fillRect(point.x - width / 2 - 1, top - 7, width + 2, 6);
  context.fillStyle = "rgba(10, 7, 5, 0.9)";
  context.fillRect(point.x - width / 2, top - 6, width, 4);
  context.fillStyle = enemy.poisonUntil > ctx.engine.state.elapsed ? "#62db8a" : color;
  context.fillRect(point.x - width / 2, top - 6, width * Math.max(0, enemy.hp / enemy.maxHp), 4);
  context.fillStyle = weaknessColor;
  context.font = '900 11px "Malgun Gothic", sans-serif';
  context.textAlign = "center";
  context.fillText(enemy.weakness, point.x, point.y + drawSize * 0.4 + 11);
}
