import { describe, expect, it } from "vitest";
import {
  CHEONJAMUN_JARYEONG_META,
  CHEONJAMUN_JARYEONG_ROSTER,
  CHEONJAMUN_SUPPLEMENTAL_CHARACTERS
} from "../src/core/cheonjamun-roster";
import { activePoolBaseWeight, getCatalog } from "../src/core/hanzi";
import { CHEONJAMUN_JARYEONG_VISUALS, JARYEONG_VISUALS, jaryeongVisualFor } from "../src/core/jaryeongs";
import { learningInfo } from "../src/core/learning";

describe("Thousand Character Classic Jaryeong import", () => {
  it("keeps all fifty approved sprites unique and exactly mapped", () => {
    expect(CHEONJAMUN_JARYEONG_ROSTER).toHaveLength(50);
    expect(CHEONJAMUN_JARYEONG_VISUALS).toHaveLength(50);
    expect(JARYEONG_VISUALS).toHaveLength(80);
    expect(new Set(CHEONJAMUN_JARYEONG_ROSTER.map((entry) => entry.id)).size).toBe(50);
    expect(new Set(CHEONJAMUN_JARYEONG_ROSTER.map((entry) => entry.hanja)).size).toBe(50);
    for (const entry of CHEONJAMUN_JARYEONG_ROSTER) {
      expect(jaryeongVisualFor(entry.hanja, entry.wuxing).id).toBe(entry.id);
    }
  });

  it("applies eighteen semantic type overlays without editing the baseline runtime", () => {
    const catalog = getCatalog("KR");
    expect(CHEONJAMUN_JARYEONG_META.semanticOverrides).toBe(18);
    for (const entry of CHEONJAMUN_JARYEONG_ROSTER) {
      expect(catalog.definitions.get(entry.hanja)?.wuxing).toBe(entry.wuxing);
    }
    expect(catalog.definitions.get("珠")?.wuxing).toBe("金");
    expect(catalog.definitions.get("黃")?.wuxing).toBe("土");
  });

  it("adds missing 烈 as a learnable direct fire character", () => {
    const catalog = getCatalog("KR");
    expect(CHEONJAMUN_SUPPLEMENTAL_CHARACTERS).toHaveLength(1);
    expect(catalog.definitions.get("烈")).toMatchObject({ char: "烈", stage: 1, acquisition: "direct", wuxing: "火" });
    expect(catalog.activePool.some((entry) => entry.char === "烈")).toBe(true);
    expect(learningInfo("KR", "烈")).toMatchObject({ short: "세찰 렬", meaning: "세찰" });
  });

  it("keeps the opening pool restrained before diversity weighting takes over", () => {
    const catalog = getCatalog("KR");
    expect(catalog.activePool.length).toBeGreaterThan(31);
    expect(activePoolBaseWeight("KR", "木")).toBe(1);
    expect(activePoolBaseWeight("KR", "烈")).toBe(0.32);
  });

  it("records the seven accepted source-edge warnings separately from runtime output QC", () => {
    expect(CHEONJAMUN_JARYEONG_META.sourceEdgeWarnings).toBe(7);
    expect(CHEONJAMUN_JARYEONG_ROSTER.every((entry) => entry.qc === "pass" || entry.qc === "pass-with-source-edge-warning")).toBe(true);
  });
});
