import { describe, expect, it } from "vitest";
import {
  AUTO_PLACE_SUMMONS_STORAGE_KEY,
  loadAutoPlaceSummons,
  saveAutoPlaceSummons
} from "../src/ui/summon-placement";

describe("summon placement setting", () => {
  it("defaults to automatic placement and persists both states", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    expect(loadAutoPlaceSummons(storage)).toBe(true);
    saveAutoPlaceSummons(false, storage);
    expect(values.get(AUTO_PLACE_SUMMONS_STORAGE_KEY)).toBe("false");
    expect(loadAutoPlaceSummons(storage)).toBe(false);
    saveAutoPlaceSummons(true, storage);
    expect(loadAutoPlaceSummons(storage)).toBe(true);
  });
});
