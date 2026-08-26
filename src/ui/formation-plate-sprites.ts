/**
 * 오행진 제단(판) 래스터 로더.
 *
 * 출처: handoff/to-claude/urgent-p0-enemy-altar-pack-v1/assets/altars/
 * 설치: public/assets/ui/formations/v1/
 *
 * 546×546 원본을 정확히 182×182로 축소해 `drawBoard()`의 절차 석판을 대체한다.
 * 확대하지 않으며 9-slice도 쓰지 않는다. 판 바깥 장식은 0px이고 최종 PNG에는
 * 2px 투명 외곽만 있으므로 판 경계 밖으로 돌출하지 않는다.
 *
 * 이 층은 순수 장식이다. 클릭·호버·드래그 판정은 그대로 `BOARD_CELLS`가 맡는다.
 */

import type { Wuxing } from "../core/types";
import { preloadedImage } from "./asset-loader";

export type FormationPlateState = "loading" | "ready" | "error";

/** 화면 표시 크기. 축소만 하고 절대 확대하지 않는다. */
export const FORMATION_PLATE_SIZE = 182;
/** `dx = center.x - 91`, `dy = center.y - 91`. */
export const FORMATION_PLATE_HALF = FORMATION_PLATE_SIZE / 2;
const SOURCE_SIZE = 546;

const WUXING_SLUG: Readonly<Record<Wuxing, string>> = Object.freeze({
  水: "water",
  金: "metal",
  土: "earth",
  木: "wood",
  火: "fire"
});

interface PlateEntry {
  readonly image: HTMLImageElement;
  state: FormationPlateState;
}

const plates = new Map<string, PlateEntry>();

function keyFor(wuxing: Wuxing, unlocked: boolean): string {
  return `${WUXING_SLUG[wuxing]}-${unlocked ? "open" : "locked"}`;
}

function loadPlate(key: string): PlateEntry {
  const path = `${import.meta.env.BASE_URL}assets/ui/formations/v1/formation-altar-${key}-546-v1.png`;
  // 프리로드본이 있으면 절차 석판을 한 프레임도 그리지 않고 바로 판을 쓴다.
  const preloaded = preloadedImage(path);
  if (preloaded) {
    const ready = preloaded.naturalWidth === SOURCE_SIZE && preloaded.naturalHeight === SOURCE_SIZE;
    const cached: PlateEntry = { image: preloaded, state: ready ? "ready" : "error" };
    if (!ready) {
      console.warn(`[formation-plate-sprites] 크기 불일치: ${path} (기대 ${SOURCE_SIZE}×${SOURCE_SIZE}, 실제 ${preloaded.naturalWidth}×${preloaded.naturalHeight})`);
    }
    plates.set(key, cached);
    return cached;
  }
  const image = new Image();
  const entry: PlateEntry = { image, state: "loading" };
  image.decoding = "async";
  image.addEventListener("load", () => {
    if (image.naturalWidth === SOURCE_SIZE && image.naturalHeight === SOURCE_SIZE) {
      entry.state = "ready";
      return;
    }
    entry.state = "error";
    console.warn(`[formation-plate-sprites] 크기 불일치: ${path} (기대 ${SOURCE_SIZE}×${SOURCE_SIZE}, 실제 ${image.naturalWidth}×${image.naturalHeight})`);
  });
  image.addEventListener("error", () => {
    entry.state = "error";
    console.warn(`[formation-plate-sprites] 로드 실패: ${path}`);
  });
  image.src = path;
  plates.set(key, entry);
  return entry;
}

function entryFor(wuxing: Wuxing, unlocked: boolean): PlateEntry {
  const key = keyFor(wuxing, unlocked);
  return plates.get(key) ?? loadPlate(key);
}

export function formationPlateImage(wuxing: Wuxing, unlocked: boolean): HTMLImageElement {
  return entryFor(wuxing, unlocked).image;
}

/** 파일 하나가 실패하면 그 오행·상태만 기존 코드 판으로 되돌아간다. */
export function isFormationPlateReady(wuxing: Wuxing, unlocked: boolean): boolean {
  return entryFor(wuxing, unlocked).state === "ready";
}

export function preloadFormationPlates(): void {
  for (const wuxing of Object.keys(WUXING_SLUG) as Wuxing[]) {
    entryFor(wuxing, true);
    entryFor(wuxing, false);
  }
}

/** 개발 진단용 요약. */
export function formationPlateStateSummary(): string {
  return (Object.keys(WUXING_SLUG) as Wuxing[])
    .map((wuxing) => `${WUXING_SLUG[wuxing]}:${entryFor(wuxing, true).state}/${entryFor(wuxing, false).state}`)
    .join(",");
}
