/**
 * 잠긴 오행진 자물쇠 래스터 로더.
 *
 * 출처: handoff/to-claude/v4-rounds-assets-pack-v1/assets/locks/
 * 설치: public/assets/ui/v4/locks/
 *
 * 120×120 원본을 정확히 40×40 으로 축소해 `drawBoard()`에서 잠긴 진 중앙에 얹는다.
 * 확대하지 않는다. 파일이 없거나 크기가 다르면 `isLockSpriteReady()`가 false 를
 * 돌려주고 호출부는 절차 드로잉으로 되돌아간다.
 *
 * 이 층은 순수 장식이다. 클릭 판정은 그대로 진 판 히트영역이 맡는다.
 */

export type LockSpriteState = "loading" | "ready" | "error";

/** 화면 표시 크기. 축소만 하고 절대 확대하지 않는다. */
export const LOCK_SPRITE_SIZE = 40;
const SOURCE_SIZE = 120;

/** `closed` = 잠김, `glow` = 엽전이 충분해 지금 해금할 수 있음. */
export type LockSpriteKind = "closed" | "glow";

interface LockEntry {
  readonly image: HTMLImageElement;
  state: LockSpriteState;
}

const locks = new Map<LockSpriteKind, LockEntry>();

function loadLock(kind: LockSpriteKind): LockEntry {
  const path = `${import.meta.env.BASE_URL}assets/ui/v4/locks/lock-${kind === "closed" ? "closed" : "glow"}-v1.png`;
  const image = new Image();
  const entry: LockEntry = { image, state: "loading" };
  image.decoding = "async";
  image.addEventListener("load", () => {
    if (image.naturalWidth === SOURCE_SIZE && image.naturalHeight === SOURCE_SIZE) {
      entry.state = "ready";
      return;
    }
    entry.state = "error";
    console.warn(`[lock-sprites] 크기 불일치: ${path} (기대 ${SOURCE_SIZE}×${SOURCE_SIZE}, 실제 ${image.naturalWidth}×${image.naturalHeight})`);
  });
  image.addEventListener("error", () => {
    entry.state = "error";
    console.warn(`[lock-sprites] 로드 실패: ${path}`);
  });
  image.src = path;
  locks.set(kind, entry);
  return entry;
}

function entryFor(kind: LockSpriteKind): LockEntry {
  return locks.get(kind) ?? loadLock(kind);
}

export function lockSpriteImage(kind: LockSpriteKind): HTMLImageElement {
  return entryFor(kind).image;
}

/** 한 파일이 실패하면 그 상태만 절차 자물쇠로 되돌아간다. */
export function isLockSpriteReady(kind: LockSpriteKind): boolean {
  return entryFor(kind).state === "ready";
}

export function preloadLockSprites(): void {
  entryFor("closed");
  entryFor("glow");
}

/** 개발 진단용 요약. */
export function lockSpriteStateSummary(): string {
  return `closed:${entryFor("closed").state},glow:${entryFor("glow").state}`;
}
