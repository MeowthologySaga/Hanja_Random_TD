/*
 * 획순 — 좌표 뒤집기와 「이 획을 그었는가」 판정.
 *
 * 이 판정이 헐거우면 아무렇게나 칠해도 넘어가 가르치는 값이 사라지고,
 * 빡빡하면 성실히 그은 획이 자꾸 퇴짜를 맞아 방해만 된다. 그 두 실패를
 * 각각 못 박아 둔다.
 */
import { describe, expect, it } from "vitest";
import {
  distanceToPolyline,
  inkBounds,
  matchStroke,
  medianBounds,
  medianPointToPaper,
  medianToPaper,
  MEDIAN_VIEWBOX
} from "../src/core/stroke-order";

const BOX = { x: 0, y: 0, width: 200, height: 200 } as const;

describe("좌표 옮기기", () => {
  it("세로를 뒤집는다 — 원본은 위가 크고 화면은 아래가 크다", () => {
    const top = medianPointToPaper([512, MEDIAN_VIEWBOX.top], BOX);
    const bottom = medianPointToPaper([512, MEDIAN_VIEWBOX.bottom], BOX);
    expect(top.y).toBeCloseTo(0, 5);
    expect(bottom.y).toBeCloseTo(200, 5);
    expect(top.x).toBeCloseTo(100, 5);
  });

  it("상자를 옮기면 그만큼 따라간다", () => {
    const moved = medianPointToPaper([0, MEDIAN_VIEWBOX.top], { x: 30, y: 40, width: 200, height: 200 });
    expect(moved.x).toBeCloseTo(30, 5);
    expect(moved.y).toBeCloseTo(40, 5);
  });

  it("점렬을 통째로 옮긴다", () => {
    const paper = medianToPaper([[0, 900], [1024, -124]], BOX);
    expect(paper).toHaveLength(2);
    expect(paper[0]).toEqual({ x: 0, y: 0 });
    expect(paper[1]!.x).toBeCloseTo(200, 5);
    expect(paper[1]!.y).toBeCloseTo(200, 5);
  });

  /*
   * 글꼴이 달라 자형이 어긋나는 것을 잡는 대목이다. 원본 쪽 네모를 「획이
   * 실제로 차지한 범위」로 좁혀 화면의 먹 범위에 맞추면, 자형 상자를 통째로
   * 비례만 맞출 때 생기던 어긋남이 사라진다.
   */
  it("획이 실제로 차지한 범위를 화면 먹 범위에 맞춘다", () => {
    const medians = [[[200, 700], [800, 700]], [[200, 100], [800, 100]]] as const;
    const source = medianBounds(medians)!;
    expect(source).toEqual({ x: 200, y: 100, width: 600, height: 600 });
    const target = { x: 10, y: 20, width: 120, height: 120 };
    const fitted = medianToPaper(medians[0], target, source);
    expect(fitted[0]).toEqual({ x: 10, y: 20 });
    expect(fitted[1]!.x).toBeCloseTo(130, 5);
    expect(fitted[1]!.y).toBeCloseTo(20, 5);
  });

  it("획이 없으면 범위도 없다", () => {
    expect(medianBounds([])).toBeNull();
  });
});

describe("화면 먹 범위", () => {
  /** 4×3 화선지 한가운데 2×1 만 칠한 RGBA. */
  function mask(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(4 * 3 * 4);
    for (const [x, y] of [[1, 1], [2, 1]]) data[(y * 4 + x) * 4 + 3] = 255;
    return data;
  }

  it("칠해진 화소의 네모를 잰다", () => {
    expect(inkBounds(mask(), 4, 3)).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });

  it("빈 화선지는 범위가 없다 — 안내가 서지 않는다", () => {
    expect(inkBounds(new Uint8ClampedArray(4 * 3 * 4), 4, 3)).toBeNull();
  });
});

describe("꺾은선까지의 거리", () => {
  it("선분 위 점은 0이다", () => {
    expect(distanceToPolyline({ x: 5, y: 0 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBeCloseTo(0, 5);
  });

  it("선분 밖으로 벗어난 점은 끝점까지의 거리다", () => {
    expect(distanceToPolyline({ x: 20, y: 0 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBeCloseTo(10, 5);
  });

  it("점이 하나뿐인 꺾은선도 잰다", () => {
    expect(distanceToPolyline({ x: 3, y: 4 }, [{ x: 0, y: 0 }])).toBeCloseTo(5, 5);
  });

  it("빈 꺾은선은 무한대 — 어떤 판정도 통과시키지 않는다", () => {
    expect(distanceToPolyline({ x: 0, y: 0 }, [])).toBe(Number.POSITIVE_INFINITY);
  });
});

/** 가로 한 획을 흉내 낸다. */
function horizontal(from: number, to: number, y = 0, jitter = 0): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const steps = 20;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push({ x: from + (to - from) * t, y: y + (index % 2 === 0 ? jitter : -jitter) });
  }
  return points;
}

describe("이 획을 그었는가", () => {
  /*
   * 실제 화선지에서 한 획은 200~260px 다. 허용 오차 34px 은 그 길이 대비
   * 13% 남짓인데, 시험용 획을 100px 로 잡으면 34% 가 되어 「반만 그은 획」이
   * 통과해 버린다 — 판정이 아니라 시험이 틀리는 자리다.
   */
  const median = horizontal(0, 240);

  it("따라 그으면 통과한다", () => {
    const result = matchStroke(horizontal(0, 240, 0, 6), median);
    expect(result.pass).toBe(true);
    expect(result.coverage).toBeGreaterThan(0.9);
    expect(result.reversed).toBe(false);
  });

  it("반만 그으면 통과하지 않는다 — 짧게 콕 찍는 것을 막는다", () => {
    const result = matchStroke(horizontal(0, 100), median);
    expect(result.pass).toBe(false);
    expect(result.coverage).toBeLessThan(0.62);
  });

  it("엉뚱한 곳에 그으면 통과하지 않는다", () => {
    const result = matchStroke(horizontal(0, 240, 300), median);
    expect(result.pass).toBe(false);
    expect(result.onPathRatio).toBe(0);
  });

  it("가로질러 마구 칠해도 통과하지 않는다 — 덮음만으로는 부족하다", () => {
    const scribble = [
      ...horizontal(0, 240),
      ...horizontal(0, 240, 200),
      ...horizontal(0, 240, 400)
    ];
    const result = matchStroke(scribble, median);
    expect(result.coverage).toBeGreaterThan(0.9);
    expect(result.onPathRatio).toBeLessThan(0.6);
    expect(result.pass).toBe(false);
  });

  it("거꾸로 그은 획은 통과시키되 거꾸로라고 알린다", () => {
    const result = matchStroke(horizontal(240, 0), median);
    expect(result.pass).toBe(true);
    expect(result.reversed).toBe(true);
  });

  it("아무것도 안 그렸으면 통과하지 않는다", () => {
    expect(matchStroke([], median).pass).toBe(false);
    expect(matchStroke(horizontal(0, 240), []).pass).toBe(false);
  });
});
