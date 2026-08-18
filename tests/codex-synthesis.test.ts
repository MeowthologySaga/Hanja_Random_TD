import { describe, expect, it } from "vitest";
import { getCatalog } from "../src/core/hanzi";
import { buildSynthesisDepths, synthesisDepthLabel } from "../src/ui/codex-synthesis";

describe("codex synthesis depth categories", () => {
  it("separates direct summons from sequential one-step and two-step recipes", () => {
    const catalog = getCatalog("CN");
    const depths = buildSynthesisDepths(catalog.definitions.values());
    expect(depths.get("文")).toBe(0);
    expect(depths.get("刀")).toBe(0);
    expect(depths.get("刘")).toBe(1);
    expect(depths.get("浏")).toBe(2);
  });

  it("uses player-facing labels for direct and crafted categories", () => {
    expect(synthesisDepthLabel(0)).toBe("직접 소환");
    expect(synthesisDepthLabel(3)).toBe("3단 합성");
  });
});
