/*
 * 획순 — 한 획씩 짚어 주기.
 *
 * 이 게임에는 획 **수**만 있었다(Unihan kTotalStrokes). 획이 어디서 시작해
 * 어디로 가는지는 없어서, 따라 쓰기 판은 반투명 글자 한 장을 통째로 보여 주고
 * 아무 데나 그리게 두었다.
 *
 * 획순 자료는 무겁고(추린 뒤에도 2.5MB) 넉넉잡아 열에 아홉 글자만 덮는다.
 * 그래서 **선택 항목**으로 둔다 — 켠 사람만 받고, 끈 사람의 화면은 한 획도
 * 달라지지 않는다. 자료가 없는 글자는 조용히 예전 방식으로 돌아간다.
 *
 * 좌표계 주의. 원본(Make Me A Hanzi)은 가로 0..1024, 세로 -124..900 이고
 * **위로 갈수록 세로값이 크다**. 화면은 반대다. 뒤집는 일은 여기 한 곳에서만
 * 한다 — 여러 군데서 뒤집으면 부호를 놓치는 자리가 반드시 생긴다.
 */

/** 원본 자형 상자. 가로 0..1024, 세로 -124..900(위가 큼). */
export const MEDIAN_VIEWBOX = Object.freeze({ left: 0, right: 1024, bottom: -124, top: 900 });

/** 한 획의 중앙선 — 원본 좌표계의 점렬. */
export type StrokeMedian = readonly (readonly [number, number])[];

export interface StrokeMedianData {
  readonly schema: "hanzi-stroke-medians-v1";
  readonly medians: Readonly<Record<string, readonly StrokeMedian[]>>;
}

/** 화선지 위의 네모 — 획순 중앙선을 여기에 맞춰 앉힌다. */
export interface PaperBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 원본 좌표 한 점을 화선지 좌표로 옮긴다.
 *
 * `source` 는 자를 원본 쪽 네모, `target` 은 화선지 쪽 네모다. 둘을 따로
 * 받는 이유는 아래 `fitMediansToInk` 때문이다 — 글꼴이 달라 자형이 어긋날 때
 * 원본 쪽 네모를 「이 글자의 획이 실제로 차지한 범위」로 좁혀 맞춘다.
 */
export function medianPointToPaper(
  point: readonly [number, number],
  target: PaperBox,
  source: PaperBox = FULL_VIEWBOX
): { readonly x: number; readonly y: number } {
  return {
    x: target.x + ((point[0] - source.x) / source.width) * target.width,
    // 세로만 뒤집는다 — 원본은 위가 크고 화면은 아래가 크다.
    y: target.y + ((source.y + source.height - point[1]) / source.height) * target.height
  };
}

/** 자형 상자 전체를 원본 쪽 네모로 쓴 값(세로는 아래가 bottom). */
export const FULL_VIEWBOX: PaperBox = Object.freeze({
  x: MEDIAN_VIEWBOX.left,
  y: MEDIAN_VIEWBOX.bottom,
  width: MEDIAN_VIEWBOX.right - MEDIAN_VIEWBOX.left,
  height: MEDIAN_VIEWBOX.top - MEDIAN_VIEWBOX.bottom
});

export function medianToPaper(
  median: StrokeMedian,
  target: PaperBox,
  source: PaperBox = FULL_VIEWBOX
): { x: number; y: number }[] {
  return median.map((point) => medianPointToPaper(point, target, source));
}

/** 획들이 실제로 차지한 원본 쪽 범위. */
export function medianBounds(medians: readonly StrokeMedian[]): PaperBox | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const stroke of medians) {
    for (const [x, y] of stroke) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (minX > maxX) return null;
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/**
 * 화면에 그려진 먹의 실제 범위(알파 > 0 인 화소의 네모).
 *
 * 안내선이 글자 위에 정확히 앉으려면 이게 있어야 한다. 우리 화면은 바탕체로
 * 글자를 그리는데 획순 자료는 다른 글꼴에서 왔다 — 같은 邑 이라도 아래 巴 가
 * 더 넓게 벌어지는 식으로 자형이 다르다. 자형 상자를 통째로 비례만 맞추면
 * 안내선이 먹에서 20px 씩 떠 버린다(실측). 각 글자의 먹 범위끼리 맞추면
 * 그 어긋남이 대부분 사라진다.
 */
export function inkBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
  alphaThreshold = 24
): PaperBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= alphaThreshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/* ── 그린 획이 이 획인가 ─────────────────────────────────────── */

export interface StrokeMatchOptions {
  /**
   * 중앙선에서 이만큼(px) 벗어나도 그 획으로 친다.
   *
   * 손가락·마우스로 8~10px 붓을 끄는 일이라 넉넉해야 한다. 좁히면 성실히
   * 그은 획이 자꾸 퇴짜를 맞아, 가르치려던 획순이 오히려 방해가 된다.
   */
  readonly tolerance?: number;
  /** 중앙선 길이 가운데 이만큼은 지나야 한 획을 그었다고 본다. */
  readonly minCoverage?: number;
}

export interface StrokeMatch {
  /** 그린 점 가운데 중앙선 근처에 든 비율. */
  readonly onPathRatio: number;
  /** 중앙선 표본 가운데 그린 선이 닿은 비율. */
  readonly coverage: number;
  /** 시작점이 중앙선의 **끝**에 더 가까웠는가 — 거꾸로 그은 획. */
  readonly reversed: boolean;
  readonly pass: boolean;
}

const DEFAULTS = { tolerance: 34, minCoverage: 0.62 } as const;

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 점 하나에서 꺾은선까지의 최단 거리. */
export function distanceToPolyline(
  point: { readonly x: number; readonly y: number },
  polyline: readonly { readonly x: number; readonly y: number }[]
): number {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  const first = polyline[0]!;
  if (polyline.length === 1) return Math.hypot(point.x - first.x, point.y - first.y);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index += 1) {
    const a = polyline[index - 1]!;
    const b = polyline[index]!;
    best = Math.min(best, distanceToSegment(point.x, point.y, a.x, a.y, b.x, b.y));
    if (best === 0) return 0;
  }
  return best;
}

/**
 * 방금 뗀 한 획이 이 중앙선을 따라간 것인지 판정한다.
 *
 * 두 가지를 함께 본다. **벗어나지 않았는가**(그린 점이 중앙선 근처인가)와
 * **끝까지 갔는가**(중앙선 전체에 닿았는가). 앞만 보면 짧게 콕 찍어도
 * 통과하고, 뒤만 보면 획을 가로질러 마구 칠해도 통과한다.
 *
 * 거꾸로 그은 획은 통과시키되 `reversed` 로 알린다 — 막아서 다시 그리게
 * 하기보다 "이 획은 위에서 아래로"라고 일러 주는 편이 가르치는 데 낫다.
 */
export function matchStroke(
  drawn: readonly { readonly x: number; readonly y: number }[],
  median: readonly { readonly x: number; readonly y: number }[],
  options: StrokeMatchOptions = {}
): StrokeMatch {
  const tolerance = options.tolerance ?? DEFAULTS.tolerance;
  const minCoverage = options.minCoverage ?? DEFAULTS.minCoverage;
  if (drawn.length === 0 || median.length === 0) {
    return { onPathRatio: 0, coverage: 0, reversed: false, pass: false };
  }

  let onPath = 0;
  for (const point of drawn) {
    if (distanceToPolyline(point, median) <= tolerance) onPath += 1;
  }
  const onPathRatio = onPath / drawn.length;

  let touched = 0;
  for (const point of median) {
    if (distanceToPolyline(point, drawn) <= tolerance) touched += 1;
  }
  const coverage = touched / median.length;

  const start = drawn[0]!;
  const head = median[0]!;
  const tail = median[median.length - 1]!;
  const reversed =
    Math.hypot(start.x - tail.x, start.y - tail.y) < Math.hypot(start.x - head.x, start.y - head.y);

  return {
    onPathRatio,
    coverage,
    reversed,
    // 벗어남은 덮음보다 조금 헐겁게 본다 — 붓이 삐져나가는 건 흔하다.
    pass: onPathRatio >= 0.6 && coverage >= minCoverage
  };
}

/* ── 자료 불러오기 ───────────────────────────────────────────── */

let cache: Readonly<Record<string, readonly StrokeMedian[]>> | null = null;
let pending: Promise<Readonly<Record<string, readonly StrokeMedian[]>> | null> | null = null;

/**
 * 획순 자료를 받아 둔다 — 처음 필요할 때 한 번만.
 *
 * 2.5MB 라 켜지 않은 사람에게 지울 이유가 없다. 실패하면 null 을 남기고
 * 조용히 예전 방식으로 돌아간다 — 부적을 쓰는 도중에 오류 창이 뜨는 것보다
 * 낫다.
 */
export function loadStrokeMedians(
  fetchImpl: typeof fetch = fetch
): Promise<Readonly<Record<string, readonly StrokeMedian[]>> | null> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetchImpl("data/hanzi-stroke-medians-v1.json")
    .then((response) => (response.ok ? response.json() : null))
    .then((data: StrokeMedianData | null) => {
      if (!data || data.schema !== "hanzi-stroke-medians-v1") return null;
      cache = data.medians;
      return cache;
    })
    .catch(() => null);
  return pending;
}

/** 받아 둔 자료에서 한 글자의 획을 꺼낸다. 아직 안 받았으면 null. */
export function strokeMediansFor(char: string): readonly StrokeMedian[] | null {
  return cache?.[char] ?? null;
}

/** 시험용 — 받아 둔 자료를 지운다. */
export function resetStrokeMedians(): void {
  cache = null;
  pending = null;
}
