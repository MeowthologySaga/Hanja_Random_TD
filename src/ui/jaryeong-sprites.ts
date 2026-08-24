import { jaryeongAssetPath, type JaryeongVisual } from "../core/jaryeongs";

const images = new Map<string, HTMLImageElement>();

export function jaryeongSpriteImage(visual: JaryeongVisual): HTMLImageElement {
  const path = jaryeongAssetPath(visual);
  const key = `${visual.id}:${path}`;
  const cached = images.get(key);
  if (cached) return cached;
  const image = new Image();
  image.decoding = "async";
  image.src = `${import.meta.env.BASE_URL}${path}`;
  images.set(key, image);
  return image;
}
