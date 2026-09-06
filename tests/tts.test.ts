/*
 * 읽기 소리가 **무엇을 어느 말로** 말하는가 (v038).
 *
 * 목소리는 시험이 들을 수 없다. 그래서 소리를 내기 직전의 판단 — 어떤 글을
 * 어떤 언어로 넘길지 — 만 순수 함수로 떼어 두고, 그 함수를 여기서 못 박는다.
 */
import { describe, expect, it } from "vitest";
import { readingUtterance } from "../src/ui/tts";

describe("부적 완성 읽기 소리", () => {
  it("한국 훈음은 훈과 음을 그대로 한국어로 읽는다", () => {
    expect(readingUtterance("身", "kr-hunum", "몸 신")).toEqual({ text: "몸 신", lang: "ko-KR", char: "身" });
  });

  it("일본 음훈은 일본어로 읽고, 가운뎃점은 쉼으로 바꾼다", () => {
    /*
     * 「シン·ケン」을 그대로 넘기면 목소리가 가운뎃점을 「나카구로」라고 읽어
     * 버린다. 쉼표는 그 자리에서 잠깐 쉬는 것으로 발음된다.
     */
    expect(readingUtterance("身", "jp-onkun", "シン·ケン·カン")).toEqual({
      text: "シン, ケン, カン",
      lang: "ja-JP",
      char: "身"
    });
  });

  it("중국 병음은 로마자가 아니라 **그 한자를 중국어 목소리로** 읽는다", () => {
    /*
     * 사용자가 원한 것은 "shēn" 이라는 철자가 아니라 그 소리다. 성조 기호가
     * 붙은 로마자를 그대로 넘기면 목소리에 따라 "에스-에이치-이-엔"이나 엉뚱한
     * 영어 발음이 난다. 한자를 zh-CN 목소리에 넘기면 그 목소리가 곧 병음이
     * 적어 둔 그 소리를 낸다.
     */
    expect(readingUtterance("身", "cn-pinyin", "shēn")).toEqual({ text: "身", lang: "zh-CN", char: "身" });
  });

  it("읽을 것이 없으면 말하지 않는다", () => {
    expect(readingUtterance("身", "kr-hunum", "   ")).toBeNull();
    expect(readingUtterance("身", "kr-hunum", "")).toBeNull();
  });

  it("잇단 공백은 한 칸으로 줄인다 — 목소리가 끊겨 들린다", () => {
    expect(readingUtterance("天", "kr-hunum", "하늘   천")?.text).toBe("하늘 천");
  });
});
