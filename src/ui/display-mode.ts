export type DisplayMode = "spirit" | "study";

export const DISPLAY_MODE_STORAGE_KEY = "hanzi-rtd-display-mode";

export function loadDisplayMode(storage: Pick<Storage, "getItem"> = window.localStorage): DisplayMode {
  try {
    return storage.getItem(DISPLAY_MODE_STORAGE_KEY) === "study" ? "study" : "spirit";
  } catch {
    return "spirit";
  }
}

export function saveDisplayMode(mode: DisplayMode, storage: Pick<Storage, "setItem"> = window.localStorage): void {
  try {
    storage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private or file-based browser contexts.
  }
}
