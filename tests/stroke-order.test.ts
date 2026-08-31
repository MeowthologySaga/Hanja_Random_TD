/*
 * 획순 — 좌표 뒤집기와 「이 획을 그었는가」 판정.
 *
 * 이 판정이 헐거우면 아무렇게나 칠해도 넘어가 가르치는 값이 사라지고,
 * 빡빡하면 성실히 그은 획이 자꾸 퇴짜를 맞아 방해만 된다. 그 두 실패를
 * 각각 못 박아 둔다.
 *
 * 좌표 쪽에서 지키는 것은 하나다 — **글자와 안내선이 같은 자리에 떨어지는가.**
 * 빈 한자는 캔버스 변환(applyGlyphTransform)으로 그리고 안내선은 점 단위
 * 변환(medianPointToPaper)으로 그리는데, 둘이 어긋나면 이 기능의 존재 이유가
 * 통째로 사라진다.
 */
import { describe, expect, it } from "vitest";
import {
  applyGlyphTransform,
  distanceToPolyline,
  expandMedian,
  matchStroke,
  medianPointToPaper,
  medianToPaper,
  paperBoxFor,
  MEDIAN_VIEWBOX
} from "../src/core/stroke-order";

const BOX = { x: 0, y: 0, size: 200 } as const;

describe("좌표 옮기기", () => {
  it("세로를 뒤집는다 — 원본은 위가 크고 화면은 아래가 크다", () => {
    const top = medianPointToPaper([512, MEDIAN_VIEWBOX.top], BOX);
    const bottom = medianPointToPaper([512, MEDIAN_VIEWBOX.bottom], BOX);
    expect(top.y).toBeCloseTo(0, 5);
    expect(bottom.y).toBeCloseTo(200, 5);
    expect(top.x).toBeCloseTo(100, 5);
  });

  it("상자를 옮기면 그만큼 따라간다", () => {
    const moved = medianPointToPaper([0, MEDIAN_VIEWBOX.top], { x: 30, y: 40, size: 200 });
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

  it("가운데를 주면 그 둘레로 정사각형을 잡는다", () => {
    const box = paperBoxFor(174, 98, 130);
    expect(box).toEqual({ x: 98 - 87, y: 130 - 87, size: 174 });
  });

  /*
   * 이 게임의 핵심 계약이다 — 글자를 그리는 변환과 안내선을 그리는 변환이
   * 같은 점을 같은 자리로 보내야 한다. 캔버스의 변환 행렬을 직접 재서,
   * 한쪽만 고쳤을 때 시험이 터지게 한다.
   */
  it("글자 변환과 안내선 변환이 같은 자리로 떨어진다", () => {
    const box = paperBoxFor(174, 98, 130);
    const calls: Array<[string, number[]]> = [];
    const fake = {
      translate: (x: number, y: number) => calls.push(["translate", [x, y]]),
      scale: (x: number, y: number) => calls.push(["scale", [x, y]])
    } as unknown as CanvasRenderingContext2D;
    applyGlyphTransform(fake, box);

    /** 위 호출들을 그대로 적용해 한 점을 옮겨 본다. */
    const through = (px: number, py: number): { x: number; y: number } => {
      let x = px;
      let y = py;
      for (let index = calls.length - 1; index >= 0; index -= 1) {
        const [kind, args] = calls[index]!;
        if (kind === "translate") {
          x += args[0]!;
          y += args[1]!;
        } else {
          x *= args[0]!;
          y *= args[1]!;
        }
      }
      return { x, y };
    };

    for (const point of [[0, 900], [1024, -124], [512, 388], [304, 757]] as const) {
      const viaGlyph = through(point[0], point[1]);
      const viaMedian = medianPointToPaper(point, box);
      expect(viaGlyph.x).toBeCloseTo(viaMedian.x, 6);
      expect(viaGlyph.y).toBeCloseTo(viaMedian.y, 6);
    }
  });
});

describe("접어 둔 중앙선 되펴기", () => {
  it("상대 좌표를 절대 좌표로 되돌린다", () => {
    expect(expandMedian([10, 20, 5, -5, -3, 8])).toEqual([[10, 20], [15, 15], [12, 23]]);
  });

  it("빈 줄은 빈 점렬이다", () => {
    expect(expandMedian([])).toEqual([]);
  });

  it("짝이 안 맞는 꼬리는 버린다 — 잘린 자료가 좌표를 어긋내지 않게", () => {
    expect(expandMedian([10, 20, 5])).toEqual([[10, 20]]);
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
