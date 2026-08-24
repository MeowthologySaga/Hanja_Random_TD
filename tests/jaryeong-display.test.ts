import { describe, expect, it } from "vitest";
import { enemyJaryeongVisualFor, jaryeongVisualFor } from "../src/core/jaryeongs";
import { RADICAL_DATA_META, radicalGlyph, radicalNumber } from "../src/core/radicals";
import { DISPLAY_MODE_STORAGE_KEY, loadDisplayMode, saveDisplayMode } from "../src/ui/display-mode";

describe("Jaryeong battlefield visuals", () => {
  it("uses the existing exact-match creature before element fallback", () => {
    expect(jaryeongVisualFor("木", "木").id).toBe("wood-mok");
    expect(jaryeongVisualFor("日", "火").id).toBe("fire-sun");
    expect(jaryeongVisualFor("雨", "水").id).toBe("water-rain");
  });

  it("uses the exact new Cheonjamun sprite where one is available", () => {
    const first = jaryeongVisualFor("相", "木");
    const second = jaryeongVisualFor("相", "木");
    expect(first).toEqual(second);
    expect(first.id).toBe("kr-76f8");
    expect(first.frameLayout).toBe("single");
    expect(jaryeongVisualFor("矢", "金").id).not.toBe("metal-chain");
  });

  it("maps every enemy archetype to a stable Jaryeong sprite", () => {
    const archetypes = ["normal", "swarm", "swift", "armored", "regenerator", "boss"] as const;
    for (const archetype of archetypes) {
      const first = enemyJaryeongVisualFor(archetype, 7);
      expect(enemyJaryeongVisualFor(archetype, 7)).toEqual(first);
      expect(first.id).toMatch(/^(wood|fire|earth|metal|water)-/u);
    }
    expect(enemyJaryeongVisualFor("swift", 0).id).toBe("fire-soar");
    expect(enemyJaryeongVisualFor("armored", 0).id).toBe("earth-heavy");
    expect(enemyJaryeongVisualFor("boss", 0).id).toBe("earth-giant");
  });
});

describe("radical learning data", () => {
  it("covers the complete regional catalog with official radical numbers", () => {
    expect(RADICAL_DATA_META.coveredCharacters).toBe(4560);
    expect(RADICAL_DATA_META.coveredCharacters).toBe(RADICAL_DATA_META.catalogCharacters);
    expect(radicalNumber("木")).toBe(75);
    expect(radicalGlyph("木")).toBe(String.fromCodePoint(0x2f4a));
    expect(radicalNumber("相")).toBe(109);
  });
});

describe("display mode preference", () => {
  it("defaults to spirit mode and persists study mode", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    expect(loadDisplayMode(storage)).toBe("spirit");
    saveDisplayMode("study", storage);
    expect(values.get(DISPLAY_MODE_STORAGE_KEY)).toBe("study");
    expect(loadDisplayMode(storage)).toBe("study");
  });
});
