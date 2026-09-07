/*
 * 배속은 사람의 설정이지 판의 상태가 아니다 (v042).
 *
 * 여태 배속은 새로고침·새 판마다 1× 로 돌아갔다. 100웨이브 한 판이 사람 손으로는
 * 60분 남짓이라 2×·3× 로 도는 사람이 많은데, 판을 새로 열 때마다 다시 눌러야 했다.
 *
 * 저장은 **런 저장본이 아니라 브라우저**다 — 옛 판을 이어할 때 그때의 배속이
 * 되살아나면 그것은 설정이 아니라 판의 일부가 된다.
 *
 * 저장 서랍을 주입할 수 있게 둔 까닭은 화면 없이 시험하기 위해서다(display-mode ·
 * summon-placement 와 같은 꼴).
 */

export type GameSpeed = 1 | 2 | 3;

export const GAME_SPEED_STORAGE_KEY = "hanja-td:game-speed";

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadGameSpeed(storage: Pick<Storage, "getItem"> | null = defaultStorage()): GameSpeed {
  try {
    const raw = storage?.getItem(GAME_SPEED_STORAGE_KEY);
    // 저장소는 계약을 지키지 않는다 — 타입은 우리 쪽 약속일 뿐이라 값으로 확인한다.
    return raw === "2" ? 2 : raw === "3" ? 3 : 1;
  } catch {
    return 1;
  }
}

export function saveGameSpeed(speed: GameSpeed, storage: Pick<Storage, "setItem"> | null = defaultStorage()): void {
  try {
    storage?.setItem(GAME_SPEED_STORAGE_KEY, String(speed));
  } catch {
    // 사생활 보호 창에서는 이번 세션만 산다 — 판이 멈출 이유는 아니다.
  }
}
