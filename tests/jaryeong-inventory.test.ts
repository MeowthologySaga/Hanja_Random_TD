import { describe, expect, it } from "vitest";
import {
  JARYEONG_INVENTORY_STORAGE_KEY,
  inventoryEntriesForRegion,
  loadJaryeongInventory,
  recordJaryeongAcquisition,
  saveJaryeongInventory
} from "../src/ui/jaryeong-inventory";

describe("persistent Jaryeong inventory", () => {
  it("records summons and evolutions by regional glyph and reloads them", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    let inventory = loadJaryeongInventory(storage);
    inventory = recordJaryeongAcquisition(inventory, "KR", "木", "summon", 100);
    inventory = recordJaryeongAcquisition(inventory, "KR", "木", "summon", 200);
    inventory = recordJaryeongAcquisition(inventory, "KR", "林", "evolution", 300);
    inventory = recordJaryeongAcquisition(inventory, "JP", "木", "summon", 400);
    expect(saveJaryeongInventory(inventory, storage)).toBe(true);
    expect(values.has(JARYEONG_INVENTORY_STORAGE_KEY)).toBe(true);
    const loaded = loadJaryeongInventory(storage);
    expect(loaded.entries["KR:木"]).toMatchObject({ summons: 2, evolutions: 0, firstObtainedAt: 100, lastObtainedAt: 200 });
    expect(loaded.entries["KR:林"]).toMatchObject({ summons: 0, evolutions: 1 });
    expect(inventoryEntriesForRegion(loaded, "KR")).toHaveLength(2);
    expect(inventoryEntriesForRegion(loaded, "JP")).toHaveLength(1);
  });

  it("falls back to an empty versioned inventory for malformed data", () => {
    const storage = { getItem: () => "not-json", setItem: () => undefined };
    expect(loadJaryeongInventory(storage)).toEqual({ version: 1, entries: {} });
  });
});
