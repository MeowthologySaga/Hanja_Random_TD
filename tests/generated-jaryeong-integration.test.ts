import { describe, expect, it } from "vitest";
import {
  expectedAssetId,
  mergeGeneratedData,
  splitLearningReading,
  validatePassEntries
} from "../scripts/integrate-generated-jaryeongs";

const layout = { rows: 2, cols: 2, frameSize: 320, sheetSize: 640 };

describe("generated Jaryeong integration", () => {
  it("derives stable Unicode ids and Korean learning labels", () => {
    expect(expectedAssetId("厂")).toBe("cn-5382");
    expect(expectedAssetId("力")).toBe("cn-529b");
    expect(splitLearningReading("어진사람 인")).toEqual({ reading: "인", meaning: "어진사람" });
    expect(splitLearningReading("우")).toEqual({ reading: "우", meaning: "우" });
  });

  it("keeps only QC-passed entries and validates authoritative CN fields", () => {
    const result = validatePassEntries({
      namespace: "CN_3500",
      batchId: "cn3500-batch-test",
      processedLayout: layout,
      entries: [
        {
          id: "cn-5382",
          hanja: "厂",
          reading: "언덕 엄",
          wuxing: "土",
          sourceType: "D",
          sourceStage: 1,
          sourceParents: [],
          sourceReadingFlag: 0,
          sheetPath: "processed/cn-5382/sheet-transparent.png",
          qc: "pass"
        },
        {
          id: "cn-4e03",
          hanja: "七",
          reading: "일곱 칠",
          wuxing: "金",
          sourceType: "D",
          sourceStage: 1,
          sourceParents: [],
          sourceReadingFlag: 1,
          qc: "fail"
        }
      ]
    }, {
      chars: [
        { c: "厂", s: 1, e: "土", a: "D", p: [], r: 0 },
        { c: "七", s: 1, e: "金", a: "D", p: [], r: 1 }
      ]
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "cn-5382",
      reading: "엄",
      meaning: "언덕",
      sourceBatch: "cn3500-batch-test",
      sourceIndex: 0
    });
  });

  it("migrates the one-batch schema and merges idempotently in source order", () => {
    const addition = {
      id: "cn-5382",
      hanja: "厂",
      reading: "엄",
      meaning: "언덕",
      wuxing: "土" as const,
      qc: "pass" as const,
      sourceBatch: "cn3500-batch-002",
      sourceIndex: 5,
      sourceType: "D",
      sourceStage: 1,
      sourceParents: []
    };
    const current = {
      version: "1.0.0",
      namespace: "CN_3500" as const,
      sourceBatch: "cn3500-batch-001",
      layout,
      entries: [{
        id: "cn-4e00",
        hanja: "一",
        reading: "일",
        meaning: "한·하나",
        wuxing: "金" as const,
        qc: "pass" as const,
        sourceBatch: "cn3500-batch-001",
        sourceIndex: 0,
        sourceType: "D",
        sourceStage: 1,
        sourceParents: []
      }]
    };

    const merged = mergeGeneratedData(current, [addition, addition]);
    expect(merged.sourceBatches).toEqual(["cn3500-batch-001", "cn3500-batch-002"]);
    expect(merged.entries.map((entry) => entry.id)).toEqual(["cn-4e00", "cn-5382"]);
  });

  it("rejects an authoritative wuxing mismatch before any file write", () => {
    expect(() => validatePassEntries({
      namespace: "CN_3500",
      batchId: "bad",
      layout,
      entries: [{
        id: "cn-5382",
        hanja: "厂",
        reading: "언덕 엄",
        wuxing: "金",
        sourceType: "D",
        sourceStage: 1,
        sourceParents: [],
        qc: "pass"
      }]
    }, { chars: [{ c: "厂", s: 1, e: "土", a: "D", p: [], r: 0 }] })).toThrow(/wuxing mismatch/);
  });
});
