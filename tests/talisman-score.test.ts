import { describe, expect, it } from "vitest";
import { rasterizeImageAlpha, scoreTalismanDrawing, TALISMAN_THRESHOLDS } from "../src/ui/panels/talisman-score";

/**
 * 부적 따라쓰기 채점 v1 — 캔버스 없이 픽셀 배열만으로 규칙을 검증한다.
 * 글자 마스크는 십자(十) 모양으로 흉내 낸다: 세로획 + 가로획.
 */
const WIDTH = 100;

const HEIGHT = 100;

function emptyImage(): Uint8ClampedArray {
  return new Uint8ClampedArray(WIDTH * HEIGHT * 4);
}

function fillRect(data: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number, alpha = 255): void {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      data[(y * WIDTH + x) * 4 + 3] = alpha;
    }
  }
}

/** 십자 글자 마스크: 세로획(45..55 × 10..90) + 가로획(10..90 × 45..55). */
function glyphImage(): Uint8ClampedArray {
  const data = emptyImage();
  fillRect(data, 45, 10, 55, 90);
  fillRect(data, 10, 45, 90, 55);
  return data;
}

function score(ink: Uint8ClampedArray): ReturnType<typeof scoreTalismanDrawing> {
  return scoreTalismanDrawing(glyphImage(), ink, WIDTH, HEIGHT);
}

describe("부적 따라쓰기 채점 v1 — 커버리지 판정", () => {
  it("정타: 글자를 그대로 따라 쓰면 통과한다", () => {
    const result = score(glyphImage());
    expect(result.pass).toBe(true);
    expect(result.insideRatio).toBe(1);
    expect(result.coverageRatio).toBe(1);
  });

  it("빈 입력: 아무것도 그리지 않으면 실패한다(0으로 나누기 없음)", () => {
    const result = score(emptyImage());
    expect(result.pass).toBe(false);
    expect(result.inkPixels).toBe(0);
    expect(result.insideRatio).toBe(0);
    expect(result.coverageRatio).toBe(0);
  });

  it("글자 밖 낙서: 구석에만 그리면 정확도 0 으로 실패한다", () => {
    const scribble = emptyImage();
    // 우상단 구석 — 글자에서 멀리 떨어져 있다.
    fillRect(scribble, 75, 0, 95, 8);
    const result = score(scribble);
    expect(result.pass).toBe(false);
    expect(result.insideRatio).toBe(0);
    expect(result.coverageRatio).toBe(0);
  });

  it("부분 커버: 한 획만 반쯤 쓰면 정확도는 높아도 덮음 미달로 실패한다", () => {
    const partial = emptyImage();
    // 가로획의 왼쪽 절반만 따라 쓴 상태.
    fillRect(partial, 10, 45, 45, 55);
    const result = score(partial);
    expect(result.insideRatio).toBeGreaterThanOrEqual(TALISMAN_THRESHOLDS.inside);
    expect(result.coverageRatio).toBeLessThan(TALISMAN_THRESHOLDS.coverage);
    expect(result.pass).toBe(false);
  });

  it("관대함: 손떨림 수준(4px)으로 통째로 밀린 따라쓰기도 통과한다", () => {
    const shifted = emptyImage();
    fillRect(shifted, 49, 14, 59, 94);
    fillRect(shifted, 14, 49, 94, 59);
    const result = score(shifted);
    expect(result.insideRatio).toBeGreaterThanOrEqual(TALISMAN_THRESHOLDS.inside);
    expect(result.coverageRatio).toBeGreaterThanOrEqual(TALISMAN_THRESHOLDS.coverage);
    expect(result.pass).toBe(true);
  });

  it("굵은 붓 관대함: 글자보다 굵게 눌러 써도 덮음이 온전히 인정된다", () => {
    const thick = emptyImage();
    // 붓이 획보다 4px 씩 굵게 퍼진 따라쓰기 — 정확은 다소 깎여도 통과해야 한다.
    fillRect(thick, 41, 6, 59, 94);
    fillRect(thick, 6, 41, 94, 59);
    const result = score(thick);
    expect(result.coverageRatio).toBe(1);
    expect(result.pass).toBe(true);
  });

  it("래스터: 알파 임계 미만 픽셀은 칸에 세지 않는다", () => {
    const faint = emptyImage();
    fillRect(faint, 0, 0, 10, 10, 20); // 임계(기본 48) 미만 — 안티에일리어싱 부스러기 취급.
    fillRect(faint, 50, 50, 55, 55, 200);
    const cells = rasterizeImageAlpha(faint, WIDTH, HEIGHT, 5);
    const total = [...cells.counts].reduce((sum, count) => sum + count, 0);
    expect(total).toBe(25);
  });
});
