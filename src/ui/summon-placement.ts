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
