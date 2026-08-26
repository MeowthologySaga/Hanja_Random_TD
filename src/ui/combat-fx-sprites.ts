import type { Wuxing } from "../core/types";
import { preloadedImage } from "./asset-loader";

const ELEMENT_ASSET_NAMES: Record<Wuxing, string> = {
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water"
};

// aoe-modular-fx-pack-v1: 원근 타원 장판을 방사형 정사각 모듈로 교체.
// 기존 element-zones 자산은 스펙에 따라 덮어쓰지 않고 보존한다.
const ZONE_ASSET_NAMES: Record<Wuxing, string> = {
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water"
};

const images = new Map<string, HTMLImageElement>();

function imageFor(path: string): HTMLImageElement {
  const cached = images.get(path);
  if (cached) return cached;
  const url = `${import.meta.env.BASE_URL}assets/fx/${path}`;
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

export function elementProjectileImage(wuxing: Wuxing): HTMLImageElement {
  return imageFor(`element-projectiles/${ELEMENT_ASSET_NAMES[wuxing]}.png`);
}

export function elementZoneImage(wuxing: Wuxing): HTMLImageElement {
  return imageFor(`aoe-modular-v1/aoe-${ZONE_ASSET_NAMES[wuxing]}-v1.png`);
}

export function preloadCombatFxSprites(): void {
  for (const wuxing of Object.keys(ELEMENT_ASSET_NAMES) as Wuxing[]) {
    elementProjectileImage(wuxing);
    elementZoneImage(wuxing);
  }
}
