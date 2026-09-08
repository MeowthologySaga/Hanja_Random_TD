/*
 * 이어하기가 사람을 **어디에** 내려놓는지 말하는가 (v042).
 *
 * 여태 화면은 늘 「N웨이브 준비 시간부터 이어서 봉인합니다」라고 말했다. 실측하면
 * 자동 저장 지점 1110개 가운데 **53.7%가 교전 중**이고(웨이브 시작 46.8% · 잔존 합류
 * 6.8%), 사람 기준 시간 가중으로는 약 **70%**다 — 그 문장은 열 번에 일곱 번 거짓이었다.
 *
 * 그리고 그 거짓은 값이 비싸다. 되살린 판에서 첫 적이 서기까지 준비 저장은 11.02초,
 * 교전 저장은 **한 프레임(0.017초)**이다. 「준비 시간부터」를 믿고 손을 놓으면 그
 * 한 프레임에 판이 굴러간다.
 *
 * 봇은 이 자리를 못 밟는다(이어하기는 목패 클릭이고 봇은 UI 를 안 만진다). 시뮬
 * 게이트가 구조적 사각지대라 이 시험이 지킨다.
 */
import { describe, expect, it } from "vitest";
import { resumeNotice } from "../src/core/content";

describe("이어하기가 내려놓는 자리", () => {
  it("준비 저장은 준비 시간이라고 말한다", () => {
    const text = resumeNotice(7, "prep", 0);
    expect(text).toContain("7웨이브");
    expect(text).toContain("준비 시간");
    expect(text).not.toContain("멈춰");
  });

  it("교전 저장은 교전이라고 말하고, 판이 멈춰 있음을 알린다", () => {
    const text = resumeNotice(7, "combat", 0);
    expect(text).toContain("교전");
    expect(text).not.toContain("준비 시간");
    // 세워 놓고 서기 때문이다 — 안 말하면 사람이 멈춘 판을 고장으로 읽는다.
    expect(text).toContain("멈춰 있습니다");
  });

  it("잔존이 남은 자리는 **몇 체가 서 있는지** 말한다", () => {
    // 실측 중앙 17체 · 최대 54체. 그 수를 안 말하면 「교전 중」이 얼마나 급한지 모른다.
    const text = resumeNotice(23, "combat", 17);
    expect(text).toContain("17체");
    expect(text).toContain("멈춰 있습니다");
  });

  it("세 자리가 서로 다른 말을 한다", () => {
    const prep = resumeNotice(7, "prep", 0);
    const fresh = resumeNotice(7, "combat", 0);
    const carried = resumeNotice(7, "combat", 17);
    expect(new Set([prep, fresh, carried]).size).toBe(3);
  });

  it("적이 없는 교전 저장이 없는 적을 지어내지 않는다", () => {
    expect(resumeNotice(7, "combat", 0)).not.toContain("0체");
  });
});
