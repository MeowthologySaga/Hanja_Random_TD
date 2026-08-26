/*
 * 부적 만들기 — 따라쓰기 채점 v1 (획순 비강제 커버리지).
 *
 * 획순 벡터 데이터 없이 채점한다. 글자를 오프스크린 캔버스에 렌더한 알파
 * 마스크와 사용자가 그린 먹선 알파를 견줘,
 *   ① 정확(inside) — 그린 픽셀 중 글자 근처(가는 4px 격자 + 1칸 팽창,
 *      허용 오차 약 4~8px)에 든 비율. "글자를 무시한 큰 낙서"를 거른다.
 *   ② 덮음(coverage) — 글자 칸(굵은 8px 격자) 중 먹선(1칸 팽창)이 닿은
 *      비율. "반쪽만 쓰고 끝"을 거른다. 손떨림·붓 굵기에는 관대하다.
 * 두 임계를 모두 넘으면 통과다.
 *
 * 임계 튜닝 실측(196×260 부적지 · 186px 글자 · 무작위 24자):
 *   성실한 지터(±5px) 트레이스  정확 0.932~0.986 · 덮음 1.0
 *   굵은 붓(16px) 트레이스      정확 0.901~0.975 · 덮음 1.0
 *   글자 무시 X 낙서            정확 0.312~0.544 · 덮음 0.59~0.714
 * → 정확 0.75 / 덮음 0.45. 덮음은 낙서도 높게 나오므로(대각선이 칸을 많이
 *   스침) 판별은 정확이, 관대함은 덮음이 맡는다. 辧처럼 종이를 거의 채우는
 *   최밀 글자에서 낙서의 정확이 0.6 대까지 오르는 것까지 계산에 넣은 값이다.
 *
 * DOM/캔버스에 기대지 않는 순수 함수만 둔다 — vitest 가 픽셀 배열만으로 검증한다.
 */

export interface TalismanCellGrid {
  readonly columns: number;
  readonly rows: number;
  /** 칸마다 임계를 넘은 픽셀 수. */
  readonly counts: Uint32Array;
}

/**
 * RGBA 픽셀 버퍼(ImageData.data 형태)의 알파 채널을 칸 격자로 접는다.
 * `alphaThreshold` 미만 알파는 안티에일리어싱 부스러기로 보고 버린다.
 */
export function rasterizeImageAlpha(
  data: ArrayLike<number>,
  width: number,
  height: number,
  cellSize: number,
  alphaThreshold = 48
): TalismanCellGrid {
  if (width <= 0 || height <= 0 || cellSize <= 0) throw new Error("Invalid raster dimensions.");
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const counts = new Uint32Array(columns * rows);
  for (let y = 0; y < height; y += 1) {
    const cellRow = Math.floor(y / cellSize) * columns;
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;
      if (alpha < alphaThreshold) continue;
      counts[cellRow + Math.floor(x / cellSize)] += 1;
    }
  }
  return { columns, rows, counts };
}

/** 칸 집합을 8방향 1칸 팽창한 불리언 배열. 손떨림·양자화 오차의 완충이다. */
function dilateCells(grid: TalismanCellGrid): Uint8Array {
  const { columns, rows, counts } = grid;
  const dilated = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (counts[row * columns + column] === 0) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        const neighborRow = row + dy;
        if (neighborRow < 0 || neighborRow >= rows) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const neighborColumn = column + dx;
          if (neighborColumn < 0 || neighborColumn >= columns) continue;
          dilated[neighborRow * columns + neighborColumn] = 1;
        }
      }
    }
  }
  return dilated;
}

export interface TalismanScoreThresholds {
  /** 그린 픽셀 중 글자 근처 비율 하한. */
  readonly inside: number;
  /** 글자 칸 중 먹선이 닿은 비율 하한. */
  readonly coverage: number;
}

/**
 * v1 최종 임계(위 실측 근거).
 * - inside 0.75: 성실한 따라쓰기(굵은 붓 포함) 최저 0.901 과 낙서(최밀 글자
 *   포함) 최고 ~0.68 사이.
 * - coverage 0.45: 기획 제안값 그대로 관대하게(반쪽 쓰기만 거른다).
 */
export const TALISMAN_THRESHOLDS: TalismanScoreThresholds = Object.freeze({ inside: 0.75, coverage: 0.45 });

export interface TalismanScoreOptions {
  /** 정확도용 가는 격자 칸(px). 글자 1칸 팽창과 함께 허용 오차를 만든다. */
  readonly fineCellSize?: number;
  /** 덮음용 굵은 격자 칸(px). 먹선 1칸 팽창과 함께 관대함을 만든다. */
  readonly coarseCellSize?: number;
  readonly glyphAlphaThreshold?: number;
  readonly inkAlphaThreshold?: number;
  readonly thresholds?: TalismanScoreThresholds;
}

export interface TalismanScore {
  /** 그린 픽셀 중 글자 근처(가는 격자)에 든 비율. 아무것도 안 그렸으면 0. */
  readonly insideRatio: number;
  /** 글자 칸(굵은 격자) 중 먹선이 닿은 비율. 글자가 없으면 0. */
  readonly coverageRatio: number;
  /** 그려진 총 픽셀 수 — "그리기 시작했는가" 판별용. */
  readonly inkPixels: number;
  /** 굵은 격자에서 글자 마스크가 차지한 칸 수. */
  readonly glyphCells: number;
  readonly pass: boolean;
}

/** 글자 마스크와 먹선의 RGBA 버퍼를 견줘 통과 여부를 정한다. */
export function scoreTalismanDrawing(
  glyphData: ArrayLike<number>,
  inkData: ArrayLike<number>,
  width: number,
  height: number,
  options: TalismanScoreOptions = {}
): TalismanScore {
  const fineCellSize = options.fineCellSize ?? 4;
  const coarseCellSize = options.coarseCellSize ?? 8;
  const glyphAlpha = options.glyphAlphaThreshold ?? 120;
  const inkAlpha = options.inkAlphaThreshold ?? 48;
  const thresholds = options.thresholds ?? TALISMAN_THRESHOLDS;

  // ① 정확 — 가는 격자, 글자 1칸 팽창(허용 오차 약 4~8px).
  const glyphFine = rasterizeImageAlpha(glyphData, width, height, fineCellSize, glyphAlpha);
  const inkFine = rasterizeImageAlpha(inkData, width, height, fineCellSize, inkAlpha);
  const dilatedGlyph = dilateCells(glyphFine);
  let inkPixels = 0;
  let inkPixelsInside = 0;
  for (let index = 0; index < inkFine.counts.length; index += 1) {
    const pixels = inkFine.counts[index] ?? 0;
    if (pixels === 0) continue;
    inkPixels += pixels;
    if (dilatedGlyph[index] === 1) inkPixelsInside += pixels;
  }

  // ② 덮음 — 굵은 격자, 먹선 1칸 팽창.
  const glyphCoarse = rasterizeImageAlpha(glyphData, width, height, coarseCellSize, glyphAlpha);
  const inkCoarse = rasterizeImageAlpha(inkData, width, height, coarseCellSize, inkAlpha);
  const dilatedInk = dilateCells(inkCoarse);
  let glyphCells = 0;
  let coveredGlyphCells = 0;
  for (let index = 0; index < glyphCoarse.counts.length; index += 1) {
    if ((glyphCoarse.counts[index] ?? 0) === 0) continue;
    glyphCells += 1;
    if (dilatedInk[index] === 1) coveredGlyphCells += 1;
  }

  const insideRatio = inkPixels > 0 ? inkPixelsInside / inkPixels : 0;
  const coverageRatio = glyphCells > 0 ? coveredGlyphCells / glyphCells : 0;
  return {
    insideRatio,
    coverageRatio,
    inkPixels,
    glyphCells,
    pass: inkPixels > 0 && glyphCells > 0 && insideRatio >= thresholds.inside && coverageRatio >= thresholds.coverage
  };
}
