/*
 * 같은 일에는 한 이름만 (v042).
 *
 * 판이 무너진 사유를 종료 화면은 「수비 실패」, 도움말은 「게임오버」라고 불렀다.
 * 지는 방식이 셋(적 한계 · 우두머리 제한시간 · 그 밖)이라 이름이 갈리면 화면끼리
 * 「내가 왜 졌는지」를 다르게 말하게 된다.
 *
 * 이 시험은 낱말이 한 곳에서만 나오는지 본다 — 화면 모듈이 제 문자열을 다시 박으면
 * 여기서 잡힌다. 주석은 사고 기록이라 남겨 두므로(사용자 인용이 그 안에 있다) 검사
 * 전에 걷어 낸다.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOSS_TIMEOUT_LABEL, DEFEAT_LABEL, OVERRUN_LABEL } from "../src/ui/glossary";

const SCREEN_FILES = ["src/ui/templates.ts", "src/ui/hud.ts", "src/ui/dialogs/end.ts"];

/** 주석(블록·줄·HTML)을 걷어 낸 소스 — 화면에 나가는 글자만 남는다. */
function screenText(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

describe("화면 낱말", () => {
  it("패배를 부르는 이름 셋이 서로 다르다", () => {
    expect(new Set([DEFEAT_LABEL, OVERRUN_LABEL, BOSS_TIMEOUT_LABEL]).size).toBe(3);
  });

  it("「게임오버」라는 다른 이름이 화면에 남아 있지 않다", () => {
    for (const path of SCREEN_FILES) {
      expect(screenText(path).includes("게임오버"), `${path} 에 남아 있다`).toBe(false);
    }
  });

  it("도움말이 없는 자물쇠를 말하지 않는다", () => {
    // 10연의 웨이브 자물쇠는 걷혔다(값이 문지기다) — 도움말만 옛 규칙을 남기고 있었다.
    const source = screenText("src/ui/templates.ts");
    expect(source).not.toContain("10웨이브를 지키면");
    expect(source).toContain("웨이브 자물쇠는 없고");
  });

  it("도움말이 [시작] 단추의 자리를 바르게 말한다", () => {
    // v036 에서 단추가 전장에서 오른쪽 패널로 옮겨 갔다.
    const source = screenText("src/ui/templates.ts");
    expect(source).not.toContain("전장 위 <em>시작</em>");
    expect(source).toContain("오른쪽 패널 웨이브 카드의 <em>시작</em>");
  });

  it("도움말이 획순을 「자유」라고 말하지 않는다", () => {
    // 획순 안내가 기본 켜짐이 된 뒤로 거짓이다.
    expect(screenText("src/ui/templates.ts")).not.toContain("획순은 자유");
  });
});
