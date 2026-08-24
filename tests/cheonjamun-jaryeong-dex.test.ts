import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHEONJAMUN_JARYEONG_DEX_ENTRIES,
  CHEONJAMUN_JARYEONG_DEX_META
} from "../src/core/cheonjamun-jaryeong-dex";

describe("player-facing Cheonjamun Jaryeong dex", () => {
  it("contains all 1,000 illustrated lore entries", () => {
    expect(CHEONJAMUN_JARYEONG_DEX_ENTRIES).toHaveLength(1000);
    expect(CHEONJAMUN_JARYEONG_DEX_META.elementCounts).toEqual({ 木: 199, 火: 195, 土: 203, 金: 213, 水: 190 });
    for (const entry of CHEONJAMUN_JARYEONG_DEX_ENTRIES) {
      expect(entry.dexText.length).toBeGreaterThan(55);
      expect(entry.traitDescription.length).toBeGreaterThan(25);
      expect(entry.imagePath).toMatch(/^assets\/jaryeongs\/cheonjamun-runtime-v1\/kr-[0-9a-f]+\.png$/u);
    }
  });

  it("does not expose production workflow language to the game", () => {
    const serialized = JSON.stringify(CHEONJAMUN_JARYEONG_DEX_ENTRIES);
    for (const forbidden of ["pending", "QC", "검토", "승인", "재생성", "원본 유지", "production", "integrated"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("has a game-facing image for every entry", () => {
    for (const entry of CHEONJAMUN_JARYEONG_DEX_ENTRIES) {
      const imagePath = path.join(process.cwd(), "public", ...entry.imagePath.split("/"));
      expect(fs.statSync(imagePath).size).toBeGreaterThan(0);
      const header = fs.readFileSync(imagePath).subarray(0, 24);
      expect(header.toString("ascii", 1, 4)).toBe("PNG");
      expect(header.readUInt32BE(16)).toBe(256);
      expect(header.readUInt32BE(20)).toBe(256);
    }
  });
});
