/*
 * 화선지의 먹을 **획 목록**으로 들고 있는다.
 *
 * 여태 먹은 캔버스 한 장이었다. 획이라는 단위가 없으니 지우는 것도 통째로밖에
 * 못 했고, 한 획을 삐끗하면 처음부터 다시 써야 했다("전체지우기 밖에 없는것도
 * 문제" — 사용자).
 *
 * 목록으로 들면 셋이 한꺼번에 풀린다.
 *  · **되돌리기** — 마지막 하나를 빼고 다시 칠한다.
 *  · **자동 정리** — 방금 손으로 그은 획을 정본 획으로 갈아 끼운다.
 *  · **실패 걷기** — 잠깐 비춘 뒤 빼낸다.
 *
 * 끌고 있는 붓(`live`)은 목록에 넣지 않는다. 화면에는 점이 찍히는 대로 바로
 * 이어 그리고(부드러움), 목록에는 붓을 뗄 때 한 번에 넣는다.
 */

export interface InkPoint {
  readonly x: number;
  readonly y: number;
}

/** 손으로 그은 획, 또는 「정본 자형의 N번째 획」. */
export type InkStroke =
  | { readonly kind: "hand"; readonly points: readonly InkPoint[] }
  | { readonly kind: "glyph"; readonly index: number };

export class InkBoard {
  private items: InkStroke[] = [];
  private live: InkPoint[] = [];
  private active = false;

  get list(): readonly InkStroke[] {
    return this.items;
  }

  get liveStroke(): readonly InkPoint[] {
    return this.live;
  }

  get isDrawing(): boolean {
    return this.active;
  }

  get count(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0 && this.live.length === 0;
  }

  begin(point: InkPoint): void {
    this.active = true;
    this.live = [point];
  }

  extend(point: InkPoint): void {
    if (this.active) this.live.push(point);
  }

  /**
   * 붓을 뗀다 — 끌던 것을 목록에 넣고 그 점렬을 돌려준다.
   * 아무것도 안 그었으면 null.
   */
  commit(): readonly InkPoint[] | null {
    if (!this.active) return null;
    this.active = false;
    const points = this.live;
    this.live = [];
    if (points.length === 0) return null;
    this.items.push({ kind: "hand", points });
    return points;
  }

  /** 방금 넣은 손 획을 정본 획으로 갈아 끼운다(안내 모드의 자동 정리). */
  replaceLastWithGlyph(index: number): void {
    if (this.items.length === 0) return;
    this.items[this.items.length - 1] = { kind: "glyph", index };
  }

  /** 마지막 획을 뺀다. 뺐으면 그 획을 돌려준다. */
  undo(): InkStroke | undefined {
    return this.items.pop();
  }

  clear(): void {
    this.items = [];
    this.live = [];
    this.active = false;
  }
}

export interface InkPaintOptions {
  readonly brush: number;
  readonly style: string;
  /** 마지막 획만 이 색으로 — 판정에 떨어진 붓질을 잠깐 비출 때. */
  readonly warnStyle?: string;
  readonly warnLast?: boolean;
  /** 정본 획을 그리는 몫. 자형 자료를 쥔 쪽(StrokeGuide)이 넘긴다. */
  readonly drawGlyphStroke?: (context: CanvasRenderingContext2D, index: number, style: string) => void;
}

/**
 * 목록을 통째로 다시 칠한다.
 *
 * 캔버스를 지우고 처음부터 그리므로, 획을 빼거나 갈아 끼운 것이 그대로 비친다.
 * 화선지가 196×260 이라 다 그려도 한 번에 5만 화소 남짓이다 — 붓을 뗄 때만
 * 부르므로 매 프레임 비용이 아니다.
 */
export function paintInk(
  context: CanvasRenderingContext2D,
  board: InkBoard,
  width: number,
  height: number,
  options: InkPaintOptions
): void {
  context.clearRect(0, 0, width, height);
  const last = board.list.length - 1;
  board.list.forEach((stroke, index) => {
    const warn = options.warnLast === true && index === last && options.warnStyle !== undefined;
    const style = warn ? options.warnStyle! : options.style;
    if (stroke.kind === "glyph") {
      options.drawGlyphStroke?.(context, stroke.index, style);
      return;
    }
    paintHandStroke(context, stroke.points, options.brush, style);
  });
  if (board.liveStroke.length > 0) paintHandStroke(context, board.liveStroke, options.brush, options.style);
}

/** 손으로 그은 한 획 — 점을 이어 둥근 붓으로 긋는다. */
export function paintHandStroke(
  context: CanvasRenderingContext2D,
  points: readonly InkPoint[],
  brush: number,
  style: string
): void {
  if (points.length === 0) return;
  context.save();
  context.strokeStyle = style;
  context.lineWidth = brush;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  const first = points[0]!;
  context.moveTo(first.x, first.y);
  if (points.length === 1) {
    // 제자리 클릭도 점 하나로 남게 미세 오프셋을 준다.
    context.lineTo(first.x + 0.01, first.y + 0.01);
  } else {
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index]!;
      context.lineTo(point.x, point.y);
    }
  }
  context.stroke();
  context.restore();
}
