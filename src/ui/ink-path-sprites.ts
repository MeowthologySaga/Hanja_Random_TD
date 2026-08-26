/**
 * 먹물 길 스프라이트 로더.
 *
 * 출처: handoff/to-claude/hanji-ui-pack-v1/sprites/path/ (Codex 한지·먹 UI 팩 v1)
 * 경로 좌표와 적 이동·충돌 판정은 `content.ts`가 그대로 결정하고, 여기서는
 * 표현만 포장도로에서 번지는 붓길로 교체한다.
 */

import { preloadedImage } from "./asset-loader";

export type InkPathKind = "straight-h" | "straight-v" | "cross" | "corner" | "portal" | "arrow";
export type InkDirection = "r" | "d" | "l" | "u";
/** 열린 두 방향. `rd`는 오른쪽+아래가 열린 모서리다. */
export type InkCorner = "rd" | "dl" | "lu" | "ur";

const images = new Map<string, HTMLImageElement>();

function imageFor(file: string): HTMLImageElement {
  const cached = images.get(file);
  if (cached) return cached;
  const url = `${import.meta.env.BASE_URL}assets/ui/path/${file}`;
  const preloaded = preloadedImage(url);
  if (preloaded) {
    images.set(file, preloaded);
    return preloaded;
  }
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  images.set(file, image);
  void image.decode().catch(() => undefined);
  return image;
}

export function inkStraightImage(axis: "h" | "v"): HTMLImageElement {
  return imageFor(`ink-path-straight-${axis}-v1.png`);
}

export function inkCornerImage(corner: InkCorner): HTMLImageElement {
  return imageFor(`ink-path-corner-${corner}-v1.png`);
}

export function inkCrossImage(): HTMLImageElement {
  return imageFor("ink-path-cross-v1.png");
}

export function inkPortalImage(direction: InkDirection): HTMLImageElement {
  return imageFor(`ink-path-portal-${direction}-v1.png`);
}

export function inkArrowImage(direction: InkDirection): HTMLImageElement {
  return imageFor(`ink-path-arrow-${direction}-v1.png`);
}

export function preloadInkPathSprites(): void {
  inkStraightImage("h");
  inkStraightImage("v");
  inkCrossImage();
  for (const corner of ["rd", "dl", "lu", "ur"] as const) inkCornerImage(corner);
  for (const direction of ["r", "d", "l", "u"] as const) {
    inkPortalImage(direction);
    inkArrowImage(direction);
  }
}
