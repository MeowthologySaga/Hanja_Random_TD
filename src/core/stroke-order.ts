/*
 * 획순 — 한 획씩 짚어 주기.
 *
 * 이 게임에는 획 **수**만 있었다(Unihan kTotalStrokes). 획이 어디서 시작해
 * 어디로 가는지는 없어서, 따라 쓰기 판은 반투명 글자 한 장을 통째로 보여 주고
 * 아무 데나 그리게 두었다.
 *
 * 자료는 무겁고(추린 뒤에도 gzip 2.3MB) 넉넉잡아 열에 아홉 글자만 덮는다.
 * 그래서 **선택 항목**으로 둔다 — 켠 사람만 받고, 끈 사람의 화면은 한 획도
 * 달라지지 않는다. 자료가 없는 글자는 조용히 예전 방식으로 돌아간다.
 *
 * **빈 한자도 이 자료로 그린다.** 처음에는 중앙선만 받아 바탕체 글자 위에
 * 얹었는데, 자형이 다른 글꼴이라 안내선이 먹에서 평균 2.55px 떠 있었다. 획마다
 * 밀어 붙여 1.32px 까지 줄여 봤지만 讀·德처럼 자형 자체가 다른 글자는 남았다.
 * 글자와 안내선을 **같은 자료**에서 뽑으면 그 어긋남이 원리상 0 이 된다
 * (세 방식 대조판을 보고 내린 결정).
 *
 * 좌표계 주의. 원본(Make Me A Hanzi)은 가로 0..1024, 세로 -124..900 이고
 * **위로 갈수록 세로값이 크다**. 화면은 반대다. 뒤집는 일은 여기 한 곳에서만
 * 한다 — 여러 군데서 뒤집으면 부호를 놓치는 자리가 반드시 생긴다.
 */

/** 원본 자형 상자. 가로 0..1024, 세로 -124..900(위가 큼). */
export const MEDIAN_VIEWBOX = Object.freeze({ left: 0, right: 1024, bottom: -124, top: 900 });

/** 자형 상자 한 변 — 가로세로가 같다(1024 × 1024). */
export const VIEWBOX_SPAN = MEDIAN_VIEWBOX.top - MEDIAN_VIEWBOX.bottom;

/** 한 획의 중앙선 — 원본 좌표계의 점렬. */
export type StrokeMedian = readonly (readonly [number, number])[];

/** 화선지 위의 정사각형 — 자형 상자를 여기에 놓는다. */
export interface PaperBox {
  readonly x: number;
  readonly y: number;
  /** 한 변(px). 자형 상자가 정사각형이라 한 값이면 된다. */
  readonly size: number;
}

/**
 * 붓 글자가 앉을 정사각형.
 *
 * 화선지 어디에 놓을지는 부르는 쪽이 정한다 — 부적 판은 위 훈음 띠와 아래
 * 인장 자리를 남기려고 중심을 살짝 위에 두고, 자혼 판은 종이 한가운데다.
 */
export function paperBoxFor(size: number, centerX: number, centerY: number): PaperBox {
  return { x: centerX - size / 2, y: centerY - size / 2, size };
}

/** 원본 좌표 한 점을 화선지 좌표로. 세로만 뒤집는다. */
export function medianPointToPaper(
  point: readonly [number, number],
  box: PaperBox
): { readonly x: number; readonly y: number } {
  return {
    x: box.x + ((point[0] - MEDIAN_VIEWBOX.left) / VIEWBOX_SPAN) * box.size,
    y: box.y + ((MEDIAN_VIEWBOX.top - point[1]) / VIEWBOX_SPAN) * box.size
  };
}

export function medianToPaper(median: StrokeMedian, box: PaperBox): { x: number; y: number }[] {
  return median.map((point) => medianPointToPaper(point, box));
}

/**
 * 자형 상자를 화선지 정사각형에 앉히는 캔버스 변환.
 *
 * 세로 배율이 음수인 것은 뒤집기 때문이고, 이어 붙는 `translate(0, -top)` 은
 * 뒤집은 뒤 상자의 윗변(y = 900)이 상자 위쪽에 오게 하는 몫이다. 위
 * `medianPointToPaper` 와 **같은 자리**로 떨어져야 한다 — 하나는 글자를,
 * 하나는 안내선을 그리는데 둘이 어긋나면 이 기능의 존재 이유가 사라진다.
 */
export function applyGlyphTransform(context: CanvasRenderingContext2D, box: PaperBox): void {
  const scale = box.size / VIEWBOX_SPAN;
  context.translate(box.x, box.y);
  context.scale(scale, -scale);
  context.translate(0, -MEDIAN_VIEWBOX.top);
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

/** 한 글자의 자형 — 획 윤곽선(SVG 경로)과 중앙선. 둘의 길이는 같다. */
export interface StrokeGlyph {
  readonly outlines: readonly string[];
  readonly medians: readonly StrokeMedian[];
}

interface GlyphFile {
  readonly schema: "hanzi-stroke-glyphs-v1";
  readonly strokes: Readonly<Record<string, readonly string[]>>;
  readonly medians: Readonly<Record<string, readonly number[][]>>;
}

/**
 * 중앙선을 되편다 — 저장본은 상대 좌표 한 줄이다.
 *
 * 무게를 줄이려고 `[[x,y],[x,y]…]` 를 `[dx,dy,dx,dy…]` 로 접어 두었다
 * (scripts/build-stroke-glyphs.mjs). 되편 값은 원본과 같은 절대 좌표다.
 */
export function expandMedian(flat: readonly number[]): StrokeMedian {
  const points: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (let index = 0; index + 1 < flat.length; index += 2) {
    x += flat[index]!;
    y += flat[index + 1]!;
    points.push([x, y]);
  }
  return points;
}

let cache: Map<string, StrokeGlyph> | null = null;
let pending: Promise<Map<string, StrokeGlyph> | null> | null = null;

/**
 * 획순 자형을 받아 둔다 — 처음 필요할 때 한 번만.
 *
 * gzip 2.3MB 라 켜지 않은 사람에게 지울 이유가 없다. 실패하면 null 을 남기고
 * 조용히 예전 방식으로 돌아간다 — 부적을 쓰는 도중에 오류 창이 뜨는 것보다
 * 안내가 안 서는 편이 낫다.
 */
export function loadStrokeGlyphs(fetchImpl: typeof fetch = fetch): Promise<Map<string, StrokeGlyph> | null> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetchImpl("data/hanzi-stroke-glyphs-v1.json")
    .then((response) => (response.ok ? response.json() : null))
    .then((data: GlyphFile | null) => {
      if (!data || data.schema !== "hanzi-stroke-glyphs-v1") return null;
      const map = new Map<string, StrokeGlyph>();
      for (const [char, outlines] of Object.entries(data.strokes)) {
        const flat = data.medians[char];
        // 윤곽선과 중앙선의 개수가 어긋난 글자는 버린다 — 「몇 번째 획」이
        // 어긋나면 안내가 거짓말을 한다. 빌드 스크립트가 이미 걸러 두지만,
        // 자료를 갈아 끼울 때를 대비해 여기서도 지킨다.
        if (!flat || flat.length !== outlines.length) continue;
        map.set(char, { outlines, medians: flat.map(expandMedian) });
      }
      cache = map;
      return cache;
    })
    .catch(() => null);
  return pending;
}

/** 받아 둔 자료에서 한 글자의 자형을 꺼낸다. 아직 안 받았으면 null. */
export function strokeGlyphFor(char: string): StrokeGlyph | null {
  return cache?.get(char) ?? null;
}

/** 시험용 — 받아 둔 자료를 지운다. */
export function resetStrokeGlyphs(): void {
  cache = null;
  pending = null;
}
