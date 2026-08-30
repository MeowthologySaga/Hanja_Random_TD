/*
 * 획순 안내 — 따라 쓰기 판 위에 한 획씩 짚어 준다.
 *
 * **선택 항목**이다. 꺼져 있으면 이 파일의 코드는 한 줄도 화면에 닿지 않고,
 * 판은 여태 그대로 반투명 글자 한 장을 통째로 보여 준다. 켠 사람만 획을
 * 순서대로 안내받는다("원하는사람만 하게 할거야" — 사용자).
 *
 * 자료가 없는 글자(명단의 5.6%)도 조용히 예전 방식으로 돌아간다. 안내가 못
 * 서는 것과 판이 망가지는 것은 다른 일이다.
 */
import {
  inkBounds,
  matchStroke,
  medianBounds,
  medianToPaper,
  strokeMediansFor,
  type StrokeMedian
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
 * 「지금 몇 번째 획인가」와 「이번 붓질의 점들」만 들고 있다. 채점(부적 완성
 * 판정)은 건드리지 않는다 — 안내는 안내고, 통과는 여태 쓰던 마스크 채점이
 * 그대로 정한다.
 */
export class StrokeGuide {
  private medians: readonly StrokeMedian[] = [];
  private paths: { x: number; y: number }[][] = [];
  private index = 0;
  private pen: { x: number; y: number }[] = [];

  /** 이 글자에 획순 자료가 있는가. */
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

  /**
   * 글자를 갈아 끼운다. 자료가 없으면 `available` 이 false 로 남는다.
   *
   * 안내선은 **화면에 그려진 먹의 범위**에 맞춰 앉힌다. 자형 상자를 통째로
   * 비례만 맞추면 안 된다 — 우리 화면은 바탕체로 그리는데 획순 자료는 다른
   * 글꼴에서 왔고, 같은 邑 이라도 아래 巴 가 더 넓게 벌어지는 식으로 자형이
   * 다르다. 그대로 얹었더니 안내선이 먹에서 20px 씩 떠 있었다(실측).
   *
   * `mask` 는 그 글자를 검게 그려 둔 RGBA 다 — 부적 판이 채점용으로 이미
   * 만들어 두는 것을 그대로 쓴다.
   */
  begin(char: string, mask: ArrayLike<number> | null, width: number, height: number): void {
    this.medians = char ? strokeMediansFor(char) ?? [] : [];
    this.index = 0;
    this.pen = [];
    const source = medianBounds(this.medians);
    const target = mask ? inkBounds(mask, width, height) : null;
    if (!source || !target) {
      this.paths = [];
      return;
    }
    this.paths = this.medians.map((median) => medianToPaper(median, target, source));
  }

  /** 지금 그을 획의 화면 좌표. 없으면 빈 배열. */
  currentPath(): readonly { x: number; y: number }[] {
    return this.paths[this.index] ?? [];
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
   * 안내 캔버스에 덧그린다 — 이미 그은 획은 가라앉히고, 이번 획만 세운다.
   *
   * 반투명 글자 한 장 위에 「지금 여기」를 얹는 것이라, 글자 자체는 부르는
   * 쪽이 먼저 그려 둔다. 순서를 바꾸면 안내가 글자 밑에 깔린다.
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

