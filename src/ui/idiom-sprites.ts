/**
 * 성어 연출 스프라이트 로더.
 *
 * 출처: handoff/to-claude/v4-rounds-assets-pack-v1/assets/idiom/ (Codex v4 라운드 팩)
 *  - `idiom-order-seal-1~4-v1.webp`: 60x60 원본을 20x20 으로 줄여 쓰는 순번 인장(RGBA).
 *  - `idiom-seal-ripple-ring-200-v1.webp`: 200x200 white-alpha 마스크. 성어 색으로 tint 한다.
 *
 * 인장은 정답 순서의 시각 보조일 뿐 판정 데이터가 아니다. 로드에 실패하면
 * 호출부가 절차 드로잉(인주 원 + 백색 숫자, 붓 고리)으로 대체한다.
 */

export type IdiomOrder = 1 | 2 | 3 | 4;

const BASE_PATH = `${import.meta.env.BASE_URL}assets/ui/v4/idiom/`;
const images = new Map<string, HTMLImageElement>();

function imageFor(file: string): HTMLImageElement {
  const cached = images.get(file);
  if (cached) return cached;
  const image = new Image();
  image.decoding = "async";
  image.src = `${BASE_PATH}${file}`;
  images.set(file, image);
  void image.decode().catch(() => undefined);
  return image;
}

export function idiomOrderSealImage(order: IdiomOrder): HTMLImageElement {
  return imageFor(`idiom-order-seal-${order}-v1.webp`);
}

export function idiomRippleRingImage(): HTMLImageElement {
  return imageFor("idiom-seal-ripple-ring-200-v1.webp");
}

export function idiomSpriteReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

const tintedRipples = new Map<string, HTMLCanvasElement>();

/** white-alpha 파문 마스크를 성어 색으로 물들인 캔버스. 색마다 한 번만 만든다. */
export function tintedIdiomRipple(color: string): HTMLCanvasElement | null {
  const cached = tintedRipples.get(color);
  if (cached) return cached;
  const source = idiomRippleRingImage();
  if (!idiomSpriteReady(source)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = source.naturalWidth;
  canvas.height = source.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  tintedRipples.set(color, canvas);
  return canvas;
}

export function preloadIdiomSprites(): void {
  for (const order of [1, 2, 3, 4] as const) idiomOrderSealImage(order);
  idiomRippleRingImage();
}
