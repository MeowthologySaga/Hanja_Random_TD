/*
 * 읽기 표기 선택의 저장소. (gripe #6, 트랙 Q)
 *
 * 표기는 진법 설정이 아니라 화면 설정이라 런을 넘어 남는다 — 표기 모드를
 * 고른 사람이 다음 판에서 다시 고르게 하면 그건 고른 게 아니다.
 *
 * null 은 "고르지 않음"이고, 그때 표기는 로스터의 자국 표기를 따라간다.
 * 저장된 값이 없으면 계속 null 이므로 아무것도 고른 적 없는 사람은 이
 * 파일이 있으나 없으나 같은 화면을 본다.
 */
import type { NotationCode } from "../core/types";

export const NOTATION_STORAGE_KEY = "hanzi-rtd-notation";

const CODES: readonly NotationCode[] = ["kr-hunum", "jp-onkun", "cn-pinyin"];

export function loadNotationPreference(storage: Pick<Storage, "getItem"> = window.localStorage): NotationCode | null {
  try {
    const stored = storage.getItem(NOTATION_STORAGE_KEY);
    return CODES.find((code) => code === stored) ?? null;
  } catch {
    return null;
  }
}

export function saveNotationPreference(
  notation: NotationCode | null,
  storage: Pick<Storage, "setItem" | "removeItem"> = window.localStorage
): void {
  try {
    if (notation === null) storage.removeItem(NOTATION_STORAGE_KEY);
    else storage.setItem(NOTATION_STORAGE_KEY, notation);
  } catch {
    // Storage can be unavailable in private or file-based browser contexts.
  }
}
