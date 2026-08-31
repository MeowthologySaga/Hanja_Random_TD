export const AUTO_PLACE_SUMMONS_STORAGE_KEY = "hanzi-rtd-auto-place-summons";

export function loadAutoPlaceSummons(storage: Pick<Storage, "getItem"> = window.localStorage): boolean {
  try {
    return storage.getItem(AUTO_PLACE_SUMMONS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveAutoPlaceSummons(enabled: boolean, storage: Pick<Storage, "setItem"> = window.localStorage): void {
  try {
    storage.setItem(AUTO_PLACE_SUMMONS_STORAGE_KEY, String(enabled));
  } catch {
    // Storage can be unavailable in private or file-based browser contexts.
  }
}

/*
 * 자동배치 정책도 같은 서랍에 둔다 — 설정이지 런의 일부가 아니다.
 * 런 저장본에 담으면 옛 판을 이어할 때 그때의 정책이 되살아나 지금 고른 것과
 * 어긋난다(run-save.ts 머리말의 「설정은 저장본이 담지 않는다」 규범).
 */
export const ARRANGE_POLICY_STORAGE_KEY = "hanzi-rtd-arrange-policy";

export function loadArrangePolicyRaw(storage: Pick<Storage, "getItem"> = window.localStorage): string | null {
  try {
    return storage.getItem(ARRANGE_POLICY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveArrangePolicyRaw(raw: string, storage: Pick<Storage, "setItem"> = window.localStorage): void {
  try {
    storage.setItem(ARRANGE_POLICY_STORAGE_KEY, raw);
  } catch {
    // 사생활 보호 창·파일 열기에서는 저장이 막힌다. 이번 판만 잃는다.
  }
}
