/*
 * 획순 안내 — 따라 쓰기 판 위에 한 획씩 짚어 준다.
 *
 * **선택 항목**이다. 꺼져 있으면 이 파일의 코드는 한 줄도 화면에 닿지 않고,
 * 판은 여태 그대로 바탕체 글자 한 장을 통째로 보여 준다. 켠 사람만 획을
 * 순서대로 안내받는다("원하는사람만 하게 할거야" — 사용자).
 *
 * 켠 사람의 판에서는 **빈 한자까지 획순 자료로 그린다.** 바탕체 위에 얹으면
 * 자형이 달라 안내선이 뜬다(실측 평균 2.55px, 400자 중 44자는 4px 초과).
 * 같은 자료에서 글자와 안내선을 함께 뽑으면 그 어긋남이 원리상 0 이다. 대신
 * 글자 모양이 바탕체에서 해서체로 바뀌므로 **채점 마스크도 같은 글자**로
 * 만들어야 한다 — 보고 그린 것과 채점하는 것이 다르면 성실히 쓴 사람이
 * 퇴짜를 맞는다.
 *
 * 자료가 없는 글자(명단의 5.6%)는 조용히 예전 방식으로 돌아간다. 안내가 못
 * 서는 것과 판이 망가지는 것은 다른 일이다.
 */
import {
  applyGlyphTransform,
  matchStroke,
  medianToPaper,
  strokeGlyphFor,
  type PaperBox,
  type StrokeGlyph
} from "../../core/stroke-order";

export interface StrokeGuideResult {
  /** 이번 획을 제대로 그어 다음으로 넘어갔는가. */
  readonly advanced: boolean;
  /** 방향이 거꾸로였는가 — 넘어가되 일러 준다. */
  readonly reversed: boolean;
  /** 마지막 획까지 끝냈는가. */
  readonly done: boolean;
}

const DONE_STYLE = "rgba(122, 90, 42, 0.42)";
const CURRENT_STYLE = "rgba(159, 47, 35, 0.92)";
const START_STYLE = "rgba(159, 47, 35, 1)";

/**
 * 한 글자의 획순 상태.
 *
 * 「지금 몇 번째 획인가」와 「이번 붓질의 점들」만 들고 있다. 통과 판정(부적
 * 완성)은 건드리지 않는다 — 안내는 안내고, 통과는 여태 쓰던 마스크 채점이
 * 그대로 정한다.
 */
export class StrokeGuide {
  private glyph: StrokeGlyph | null = null;
  private box: PaperBox | null = null;
  private paths: { x: number; y: number }[][] = [];
  private index = 0;
  private pen: { x: number; y: number }[] = [];

  /** 이 글자에 획순 자료가 있는가 — 있으면 글자도 이 자료로 그린다. */
  get available(): boolean {
    return this.paths.length > 0;
  }

  get current(): number {
    return this.index;
  }

  get total(): number {
    return this.paths.length;
  }

  get finished(): boolean {
    return this.paths.length > 0 && this.index >= this.paths.length;
  }

  /** 글자를 갈아 끼운다. 자료가 없으면 `available` 이 false 로 남는다. */
  begin(char: string, box: PaperBox): void {
    this.glyph = char ? strokeGlyphFor(char) : null;
    this.box = box;
    this.paths = this.glyph ? this.glyph.medians.map((median) => medianToPaper(median, box)) : [];
    this.index = 0;
    this.pen = [];
  }

  /** 지금 그을 획의 화면 좌표. 없으면 빈 배열. */
  currentPath(): readonly { x: number; y: number }[] {
    return this.paths[this.index] ?? [];
  }

  /** 한 획 뒤로 물린다 — [되돌리기] 와 짝이다. */
  stepBack(): void {
    if (this.index > 0) this.index -= 1;
    this.pen = [];
  }

  /** 처음 획으로 되감는다 — [지우기] 와 짝이다. */
  reset(): void {
    this.index = 0;
    this.pen = [];
  }

  penDown(point: { x: number; y: number }): void {
    this.pen = [point];
  }

  penMove(point: { x: number; y: number }): void {
    if (this.pen.length > 0) this.pen.push(point);
  }

  /**
   * 붓을 뗀다. 이번 붓질이 지금 획을 따라갔으면 다음 획으로 넘긴다.
   *
   * 틀렸다고 먹선을 지우지는 않는다. 지워 버리면 「내가 뭘 그렸는지」가
   * 사라져 왜 안 넘어갔는지 알 길이 없다 — 안내만 제자리에 두고 다시 그을
   * 기회를 준다.
   */
  penUp(): StrokeGuideResult | null {
    const drawn = this.pen;
    this.pen = [];
    const target = this.paths[this.index];
    if (!target || drawn.length === 0) return null;
    const match = matchStroke(drawn, target);
    if (!match.pass) return { advanced: false, reversed: match.reversed, done: false };
    this.index += 1;
    return { advanced: true, reversed: match.reversed, done: this.index >= this.paths.length };
  }

  /**
   * 빈 한자를 획순 자료의 글꼴로 그린다.
   *
   * 자료가 없으면 false 를 돌려주고 아무것도 그리지 않는다 — 부르는 쪽이
   * 예전대로 바탕체로 그리면 된다. 채점 마스크도 이 함수로 그려야 화면과
   * 채점이 같은 글자를 본다.
   */
  paintGlyph(context: CanvasRenderingContext2D, style: string): boolean {
    if (!this.glyph || !this.box) return false;
    context.save();
    applyGlyphTransform(context, this.box);
    context.fillStyle = style;
    /*
     * 획을 하나씩 칠하지 않고 **한 번에** 칠한다.
     *
     * 반투명(0.2)으로 하나씩 칠하면 교차부에서 알파가 겹쳐 쌓여, 획이 만나는
     * 자리가 최대 2.4배 진해진다(실측: 天 최대 123 대 51). 글자가 얼룩덜룩해
     * 보이는 원인이었다. 경로를 합쳐 한 번 칠하면 농도가 고르다.
     */
    const path = new Path2D();
    for (const outline of this.glyph.outlines) path.addPath(new Path2D(outline));
    context.fill(path);
    context.restore();
    return true;
  }

  /**
   * 정본 자형의 한 획만 칠한다 — 안내 모드의 「자동 정리」가 쓴다.
   *
   * 사람이 그은 삐뚤한 붓질을 이 모양으로 갈아 끼우면, 종이가 붓글씨처럼
   * 쌓이고 지저분해지지 않는다.
   */
  paintStroke(context: CanvasRenderingContext2D, index: number, style: string): boolean {
    const outline = this.glyph?.outlines[index];
    if (!outline || !this.box) return false;
    context.save();
    applyGlyphTransform(context, this.box);
    context.fillStyle = style;
    context.fill(new Path2D(outline));
    context.restore();
    return true;
  }

  /**
   * 안내 캔버스에 덧그린다 — 이미 그은 획은 가라앉히고, 이번 획만 세운다.
   *
   * 글자는 부르는 쪽이 먼저 그려 둔다. 순서를 바꾸면 안내가 글자 밑에 깔린다.
   */
  paint(context: CanvasRenderingContext2D): void {
    if (this.paths.length === 0) return;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let stroke = 0; stroke < this.index; stroke += 1) {
      const path = this.paths[stroke];
      if (!path || path.length === 0) continue;
      context.strokeStyle = DONE_STYLE;
      context.lineWidth = 3;
      context.setLineDash([]);
      tracePath(context, path);
    }

    const current = this.paths[this.index];
    if (current && current.length > 0) {
      context.strokeStyle = CURRENT_STYLE;
      context.lineWidth = 4;
      // 점선이라 「따라 그으라」는 뜻이 글 없이 읽힌다.
      context.setLineDash([7, 5]);
      tracePath(context, current);
      context.setLineDash([]);

      // 시작점 — 획은 어디서 붓을 대는지가 절반이다.
      const head = current[0]!;
      context.fillStyle = START_STYLE;
      context.beginPath();
      context.arc(head.x, head.y, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fbf3e0";
      context.font = '700 8px "Malgun Gothic", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(this.index + 1), head.x, head.y + 0.5);

      // 끝점 화살 — 가는 방향까지 보여야 거꾸로 긋지 않는다.
      const tail = current[current.length - 1]!;
      const before = current[Math.max(0, current.length - 2)]!;
      drawArrow(context, before, tail);
    }
    context.restore();
  }
}

function tracePath(context: CanvasRenderingContext2D, path: readonly { x: number; y: number }[]): void {
  context.beginPath();
  const first = path[0]!;
  context.moveTo(first.x, first.y);
  for (let index = 1; index < path.length; index += 1) {
    const point = path[index]!;
    context.lineTo(point.x, point.y);
  }
  context.stroke();
}

function drawArrow(
  context: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number }
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const wing = 6;
  context.fillStyle = CURRENT_STYLE;
  context.beginPath();
  context.moveTo(to.x, to.y);
  context.lineTo(to.x - wing * Math.cos(angle - 0.45), to.y - wing * Math.sin(angle - 0.45));
  context.lineTo(to.x - wing * Math.cos(angle + 0.45), to.y - wing * Math.sin(angle + 0.45));
  context.closePath();
  context.fill();
}
