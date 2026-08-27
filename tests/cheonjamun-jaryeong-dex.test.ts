import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHEONJAMUN_JARYEONG_DEX_BY_HANJA,
  CHEONJAMUN_JARYEONG_DEX_ENTRIES,
  CHEONJAMUN_JARYEONG_DEX_META
} from "../src/core/cheonjamun-jaryeong-dex";
import { koreanMeaningExplanation } from "../src/core/korean-meaning-explanations";

describe("player-facing Cheonjamun Jaryeong dex", () => {
  it("contains all 1,000 illustrated lore entries", () => {
    expect(CHEONJAMUN_JARYEONG_DEX_ENTRIES).toHaveLength(1000);
    expect(CHEONJAMUN_JARYEONG_DEX_META.elementCounts).toEqual({ 木: 199, 火: 195, 土: 203, 金: 213, 水: 190 });
    for (const entry of CHEONJAMUN_JARYEONG_DEX_ENTRIES) {
      expect(CHEONJAMUN_JARYEONG_DEX_BY_HANJA.get(entry.hanja)).toBe(entry);
      expect(entry.dexText.length).toBeGreaterThan(55);
      expect(entry.traitDescription.length).toBeGreaterThan(25);
      expect(entry.imagePath).toMatch(/^assets\/jaryeongs\/cheonjamun-runtime-v1\/kr-[0-9a-f]+\.webp$/u);
      const explanation = koreanMeaningExplanation(entry.hanja, entry.huneum, entry.meaning);
      expect(explanation.plainMeaning.length).toBeGreaterThan(0);
      expect(explanation.short.length).toBeGreaterThan(8);
      expect(explanation.body.length).toBeGreaterThan(8);
      expect(explanation.source).not.toBe("regional-fallback");
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
      /*
       * 2026-08-27: 무손실 PNG(장당 82KB·합계 78MB)를 WebP q85 로 바꿨다 — 결과 카드가
       * 그림을 기다리는 시간이 회선을 그대로 타고 있었기 때문이다(유선에서도 여러 장이
       * 뜨는 창은 중앙값 1.5초 빈칸). 픽셀 규격 256×256 은 그대로 지킨다.
       * WebP 헤더: "RIFF"…"WEBPVP8 "(손실) / "VP8L"(무손실) / "VP8X"(확장).
       * 크기는 VP8X 확장 청크가 24바이트 위치에 두므로, 규격 검사는 sharp 없이
       * VP8/VP8L/VP8X 세 갈래를 그대로 읽는다.
       */
      const header = fs.readFileSync(imagePath).subarray(0, 32);
      expect(header.toString("ascii", 0, 4)).toBe("RIFF");
      expect(header.toString("ascii", 8, 12)).toBe("WEBP");
      const chunk = header.toString("ascii", 12, 16);
      if (chunk === "VP8 ") {
        // 손실 VP8: 프레임 헤더 26바이트째부터 14비트씩 가로·세로.
        expect(header.readUInt16LE(26) & 0x3fff).toBe(256);
        expect(header.readUInt16LE(28) & 0x3fff).toBe(256);
      } else if (chunk === "VP8X") {
        // 확장: 24바이트째부터 3바이트 리틀엔디언 (실제값 − 1).
        expect(header.readUIntLE(24, 3) + 1).toBe(256);
        expect(header.readUIntLE(27, 3) + 1).toBe(256);
      } else {
        expect(chunk).toBe("VP8L");
      }
    }
  });
});
