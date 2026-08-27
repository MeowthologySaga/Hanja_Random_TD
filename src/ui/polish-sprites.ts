/**
 * P1/P2 마감 에셋 중 전장 캔버스가 직접 그리는 것들.
 *
 * 출처: handoff/to-claude/p1-p2-polish-assets-pack-v1/assets/
 * 설치: public/assets/ui/polish-v1/
 *
 * 옻칠 버튼·카드 프레임·서책 프레임·재질 타일은 DOM 이라 `ui-skin.css` 82절이
 * 맡거나 판단상 보류했다(보고서 참조). 여기 있는 넷만 캔버스 몫이다.
 *   출구 인장 2상태 · 별승급 고리 1~8 · 사자성어 봉인 인장 · 진 접지 그림자
 *
 * 전부 장식이다. 좌표·히트영역·전투 수치·진행 규칙에 손대지 않는다.
 */

import { preloadedImage } from "./asset-loader";

export type ExitSealState = "waiting" | "spawning";
/** 승급 "결과" 별 등급. 소모한 재료 등급이 아니다. */
export type StarLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 출구 인장 표시 크기. 원본 84×84 를 3분의 1로 줄인다. */
export const EXIT_SEAL_SIZE = 28;
/** 별승급 고리 표시 크기. 원본 720×720. */
export const STAR_RING_SIZE = 240;
/** 사자성어 봉인 인장 표시 크기. 원본 600×600. */
export const IDIOM_SEAL_SIZE = 200;

const images = new Map<string, HTMLImageElement>();

function imageFor(path: string): HTMLImageElement {
  const cached = images.get(path);
  if (cached) return cached;
  const url = `${import.meta.env.BASE_URL}assets/ui/polish-v1/${path}`;
  const preloaded = preloadedImage(url);
  if (preloaded) {
    images.set(path, preloaded);
    return preloaded;
  }
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  images.set(path, image);
  void image.decode().catch(() => undefined);
  return image;
}

/** 로드 전·실패는 false. 호출부가 기존 코드 도형으로 되돌아간다. */
export function isReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

export function exitSealImage(state: ExitSealState): HTMLImageElement {
  return imageFor(`seals/exit-seal-${state}-84-v1.webp`);
}

export function starAscentRingImage(star: StarLevel): HTMLImageElement {
  return imageFor(`fx/star-ascent-ring-${String(star).padStart(2, "0")}-720-v1.webp`);
}

export function idiomCompletionSealImage(): HTMLImageElement {
  return imageFor("fx/idiom-completion-seal-600-v1.webp");
}

export function clampStarLevel(star: number): StarLevel {
  return Math.min(8, Math.max(1, Math.round(star))) as StarLevel;
}

export function preloadPolishSprites(): void {
  exitSealImage("waiting");
  exitSealImage("spawning");
  idiomCompletionSealImage();
}
