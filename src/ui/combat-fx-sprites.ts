import type { Wuxing } from "../core/types";

const ELEMENT_ASSET_NAMES: Record<Wuxing, string> = {
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water"
};

const ZONE_ASSET_NAMES: Record<Wuxing, string> = {
  木: "wood-roots",
  火: "fire-lava",
  土: "earth-quicksand",
  金: "metal-caltrops",
  水: "water-rain"
};

const images = new Map<string, HTMLImageElement>();

function imageFor(path: string): HTMLImageElement {
  const cached = images.get(path);
  if (cached) return cached;
  const image = new Image();
  image.decoding = "async";
  image.src = `${import.meta.env.BASE_URL}assets/fx/${path}`;
  images.set(path, image);
  void image.decode().catch(() => undefined);
  return image;
}

export function elementProjectileImage(wuxing: Wuxing): HTMLImageElement {
  return imageFor(`element-projectiles/${ELEMENT_ASSET_NAMES[wuxing]}.png`);
}

export function elementZoneImage(wuxing: Wuxing): HTMLImageElement {
  return imageFor(`element-zones/${ZONE_ASSET_NAMES[wuxing]}.png`);
}

export function preloadCombatFxSprites(): void {
  for (const wuxing of Object.keys(ELEMENT_ASSET_NAMES) as Wuxing[]) {
    elementProjectileImage(wuxing);
    elementZoneImage(wuxing);
  }
}
