/**
 * 전장 명패 래스터 로더.
 *
 * 출처: handoff/to-claude/v5-compact-tier-assets-pack-v1/assets/nameplates/
 *  - `nameplate-compact-v1.png`: 252x120 원본 → 84x40 고정 표시(상시 명패).
 *  - `nameplate-detail-v1.png`: 312x180 원본 → 104x60 고정 표시(상세 팝오버).
 *
 * 두 파일 모두 무문자 RGBA 다. 한자·훈음·별·상태는 굽지 않고 코드가 그린다.
 * 9-slice 하지 않고 각각 1/3 배율로만 그린다. 늘여서 서로 대체하지 않는다.
 * 로드 실패 시 호출부가 절차 드로잉(먹칠 판)으로 대체한다.
 */

export type NameplateKind = "compact" | "detail";

/** 표시 치수와 코드 텍스트 좌표(모두 명패 좌상단 기준 display px). */
export const NAMEPLATE_LAYOUT = {
  compact: {
    width: 84,
    height: 40,
    /** 한자 열 폭. 구분선은 래스터에 포함돼 있으므로 코드로 다시 긋지 않는다. */
    glyphColumn: 32,
    glyphCenter: { x: 16, y: 20 },
    glyphSafe: { x: 3, y: 4, width: 27, height: 32 },
    text: { x: 35, y: 4, width: 46, height: 32 }
  },
  detail: {
    width: 104,
    height: 60,
    glyphColumn: 40,
    glyphCenter: { x: 20, y: 30 },
    glyphSafe: { x: 6, y: 8, width: 31, height: 44 },
    text: { x: 44, y: 7, width: 54, height: 46 }
  }
} as const;

const BASE_PATH = `${import.meta.env.BASE_URL}assets/ui/v5/nameplates/`;
const images = new Map<NameplateKind, HTMLImageElement>();

export function nameplateImage(kind: NameplateKind): HTMLImageElement {
  const cached = images.get(kind);
  if (cached) return cached;
  const image = new Image();
  image.decoding = "async";
  image.src = `${BASE_PATH}nameplate-${kind}-v1.png`;
  images.set(kind, image);
  void image.decode().catch(() => undefined);
  return image;
}

export function nameplateReady(kind: NameplateKind): boolean {
  const image = nameplateImage(kind);
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

export function preloadNameplateSprites(): void {
  nameplateImage("compact");
  nameplateImage("detail");
}
