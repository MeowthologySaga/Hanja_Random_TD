import { describe, expect, it } from "vitest";
import { getCatalog } from "../src/core/hanzi";
import {
  UNCOMBINABLE_STAGE_ONE,
  buildSynthesisDepths,
  buildUncombinableStageOneChars,
  synthesisDepthLabel,
  synthesisTierAccessibleLabel,
  synthesisTierFilterLabel,
  synthesisTierKey
} from "../src/ui/codex-synthesis";

describe("codex synthesis depth categories", () => {
  it("numbers uncombined summons as tier 1 and shifts crafted results to tiers 2-5", () => {
    const catalog = getCatalog("CN");
    const depths = buildSynthesisDepths(catalog.definitions.values());
    expect(depths.get("文")).toBe(1);
    expect(depths.get("刀")).toBe(1);
    expect(depths.get("刘")).toBe(2);
    expect(depths.get("浏")).toBe(3);
  });

  it("uses one consistent player-facing tier vocabulary", () => {
    expect(synthesisDepthLabel(1)).toBe("★");
    expect(synthesisDepthLabel(3)).toBe("★★★");
    expect(synthesisDepthLabel(5)).toBe("★★★★★");
    expect(synthesisTierFilterLabel(1)).toBe("★");
    expect(synthesisTierFilterLabel(UNCOMBINABLE_STAGE_ONE)).toBe("★");
    expect(synthesisTierAccessibleLabel(1)).toContain("1단");
    expect(synthesisTierAccessibleLabel(UNCOMBINABLE_STAGE_ONE)).toContain("독립 자령");
  });

  it("separates direct tier-1 leaves that cannot be used in any recipe", () => {
    const catalog = getCatalog("KR");
    const definitions = [...catalog.definitions.values()];
    const depths = buildSynthesisDepths(definitions);
    const leaves = buildUncombinableStageOneChars(definitions);
    expect(leaves.size).toBeGreaterThan(0);
    expect(leaves.has("木")).toBe(false);
    const leaf = definitions.find((definition) => leaves.has(definition.char));
    expect(leaf).toBeDefined();
    expect(synthesisTierKey(leaf!, depths.get(leaf!.char) ?? 1, leaves)).toBe(UNCOMBINABLE_STAGE_ONE);
  });
});
