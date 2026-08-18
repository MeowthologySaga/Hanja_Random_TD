const images = new Map<string, HTMLImageElement>();

export function jaryeongSpriteImage(id: string): HTMLImageElement {
  const cached = images.get(id);
  if (cached) return cached;
  const image = new Image();
  image.decoding = "async";
  image.src = `${import.meta.env.BASE_URL}assets/jaryeongs/${id}/sheet-transparent.png`;
  images.set(id, image);
  return image;
}
