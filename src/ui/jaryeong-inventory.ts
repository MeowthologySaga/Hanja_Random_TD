import type { RegionCode } from "../core/types";

export const JARYEONG_INVENTORY_STORAGE_KEY = "hanzi-rtd-jaryeong-inventory-v1";

export interface JaryeongInventoryEntry {
  region: RegionCode;
  char: string;
  summons: number;
  evolutions: number;
  firstObtainedAt: number;
  lastObtainedAt: number;
}

export interface JaryeongInventory {
  version: 1;
  entries: Record<string, JaryeongInventoryEntry>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function emptyInventory(): JaryeongInventory {
  return { version: 1, entries: {} };
}

export function loadJaryeongInventory(storage: StorageLike = window.localStorage): JaryeongInventory {
  try {
    const raw = storage.getItem(JARYEONG_INVENTORY_STORAGE_KEY);
    if (!raw) return emptyInventory();
    const parsed = JSON.parse(raw) as Partial<JaryeongInventory>;
    if (parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== "object") return emptyInventory();
    return { version: 1, entries: { ...parsed.entries } };
  } catch {
    return emptyInventory();
  }
}

export function recordJaryeongAcquisition(
  inventory: JaryeongInventory,
  region: RegionCode,
  char: string,
  kind: "summon" | "evolution",
  now = Date.now()
): JaryeongInventory {
  const key = `${region}:${char}`;
  const previous = inventory.entries[key];
  const next: JaryeongInventoryEntry = previous
    ? { ...previous, lastObtainedAt: now }
    : { region, char, summons: 0, evolutions: 0, firstObtainedAt: now, lastObtainedAt: now };
  if (kind === "summon") next.summons += 1;
  else next.evolutions += 1;
  return { version: 1, entries: { ...inventory.entries, [key]: next } };
}

export function saveJaryeongInventory(inventory: JaryeongInventory, storage: StorageLike = window.localStorage): boolean {
  try {
    storage.setItem(JARYEONG_INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
    return true;
  } catch {
    return false;
  }
}

export function inventoryEntriesForRegion(inventory: JaryeongInventory, region: RegionCode): JaryeongInventoryEntry[] {
  return Object.values(inventory.entries).filter((entry) => entry.region === region);
}
