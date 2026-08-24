import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHEONJAMUN_JARYEONG_META,
  CHEONJAMUN_JARYEONG_ROSTER,
  CHEONJAMUN_SUPPLEMENTAL_CHARACTERS
} from "../src/core/cheonjamun-roster";
import { activePoolBaseWeight, getCatalog } from "../src/core/hanzi";
import {
  CHEONJAMUN_JARYEONG_VISUALS,
  CHEONJAMUN_RUNTIME_JARYEONG_VISUALS,
  CN3500_GENERATED_JARYEONG_VISUALS,
  JARYEONG_VISUALS,
  jaryeongVisualFor
} from "../src/core/jaryeongs";
import { CHEONJAMUN_RUNTIME_JARYEONGS, CHEONJAMUN_RUNTIME_META } from "../src/core/cheonjamun-runtime";
import { learningInfo } from "../src/core/learning";

describe("Thousand Character Classic Jaryeong import", () => {
  it("keeps all fifty approved sprites unique and exactly mapped", () => {
    expect(CHEONJAMUN_JARYEONG_ROSTER).toHaveLength(50);
    expect(CHEONJAMUN_JARYEONG_VISUALS).toHaveLength(50);
    expect(JARYEONG_VISUALS).toHaveLength(1106);
    expect(new Set(CHEONJAMUN_JARYEONG_ROSTER.map((entry) => entry.id)).size).toBe(50);
    expect(new Set(CHEONJAMUN_JARYEONG_ROSTER.map((entry) => entry.hanja)).size).toBe(50);
    for (const entry of CHEONJAMUN_JARYEONG_ROSTER) {
      expect(jaryeongVisualFor(entry.hanja, entry.wuxing).id).toBe(entry.id);
    }
  });

  it("registers all one thousand Cheonjamun sprites as playable previews without promoting QC", () => {
    expect(CHEONJAMUN_RUNTIME_META).toMatchObject({ total: 1000, approved: 0, integrationPolicy: "playable-preview-with-source-qc-preserved" });
    expect(CHEONJAMUN_RUNTIME_JARYEONGS).toHaveLength(1000);
    expect(CHEONJAMUN_RUNTIME_JARYEONG_VISUALS).toHaveLength(1000);
    expect(new Set(CHEONJAMUN_RUNTIME_JARYEONG_VISUALS.map((entry) => entry.id)).size).toBe(1000);
    expect(new Set(CHEONJAMUN_RUNTIME_JARYEONG_VISUALS.map((entry) => entry.hanja)).size).toBe(1000);
    const heaven = CHEONJAMUN_RUNTIME_JARYEONGS.find((entry) => entry.hanja === "天");
    expect(heaven).toBeDefined();
    expect(jaryeongVisualFor("天", heaven!.wuxing, "KR").id).toBe("kr-5929");
    for (const entry of CHEONJAMUN_RUNTIME_JARYEONGS) {
      expect(fs.existsSync(path.join(process.cwd(), "public", ...entry.assetPath.split("/")))).toBe(true);
    }
  });

  it("maps only QC-passed CN batch sprites in the CN namespace", () => {
    expect(CN3500_GENERATED_JARYEONG_VISUALS).toHaveLength(26);
    expect(new Set(CN3500_GENERATED_JARYEONG_VISUALS.map((entry) => entry.id)).size).toBe(26);
    expect(jaryeongVisualFor("一", "金", "CN").id).toBe("cn-4e00");
    expect(jaryeongVisualFor("卜", "金", "CN").id).toBe("cn-535c");
    expect(jaryeongVisualFor("一", "金", "KR").id).not.toBe("cn-4e00");
    expect(jaryeongVisualFor("厂", "土", "CN").id).toBe("cn-5382");
    expect(jaryeongVisualFor("七", "金", "CN").id).toBe("cn-4e03");
    expect(jaryeongVisualFor("力", "火", "CN").id).toBe("cn-529b");
    expect(jaryeongVisualFor("力", "火", "KR").id).not.toBe("cn-529b");
    expect(jaryeongVisualFor("三", "金", "CN").id).toBe("cn-4e09");
    expect(jaryeongVisualFor("于", "金", "CN").id).not.toBe("cn-4e8e");
    expect(jaryeongVisualFor("士", "金", "CN").id).not.toBe("cn-58eb");
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

  it("keeps the legacy 烈 supplement readable but outside the exact thousand-character summon pool", () => {
    const catalog = getCatalog("KR");
    expect(CHEONJAMUN_SUPPLEMENTAL_CHARACTERS).toHaveLength(1);
    expect(catalog.definitions.get("烈")).toMatchObject({ char: "烈", stage: 1, acquisition: "direct", wuxing: "火" });
    expect(catalog.activePool.some((entry) => entry.char === "烈")).toBe(false);
    expect(learningInfo("KR", "烈")).toMatchObject({ short: "세찰 렬", meaning: "세찰" });
  });

  it("keeps the opening pool restrained before diversity weighting takes over", () => {
    const catalog = getCatalog("KR");
    expect(catalog.activePool).toHaveLength(1000);
    expect(activePoolBaseWeight("KR", "木")).toBe(1);
    expect(activePoolBaseWeight("KR", "天")).toBe(0.32);
  });

  it("records the seven accepted source-edge warnings separately from runtime output QC", () => {
    expect(CHEONJAMUN_JARYEONG_META.sourceEdgeWarnings).toBe(7);
    expect(CHEONJAMUN_JARYEONG_ROSTER.every((entry) => entry.qc === "pass" || entry.qc === "pass-with-source-edge-warning")).toBe(true);
  });
});
