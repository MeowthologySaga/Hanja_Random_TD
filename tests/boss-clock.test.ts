/*
 * 우두머리 시계가 무엇을 말하는가 (v041).
 *
 * "보스 시간제한 있는 거 모르고 냅두다가 게임오버하는거 봤어"(사용자).
 *
 * 문장을 코어가 만드는 까닭은 이 규칙이 **두 갈래**이기 때문이다. 제한을 넘겨도
 * 보통은 그 자리에서 지지 않는다(v035 ③) — 우두머리가 남은 채 20초마다 다음
 * 웨이브가 겹쳐 적이 쌓이고 결국 적 상한에서 진다. 그런데 **마지막 우두머리만은**
 * 넘기는 순간 패배다. 화면 세 곳이 이 두 갈래를 제각각 말하면 그 자체가 거짓말이
 * 되므로, 문장은 한 곳에서만 만든다.
 */
import { describe, expect, it } from "vitest";
import {
  BOSS_CLOCK_STAGES,
  bossClockNotice,
  bossFinalWallNotice,
  bossOvertimeNotice,
  MAX_ENEMIES,
  WAVE_REINFORCEMENT_DELAY
} from "../src/core/content";

describe("우두머리 시계 문구", () => {
  it("문턱 셋에서만 말을 건다", () => {
    expect(BOSS_CLOCK_STAGES).toEqual([30, 15, 5]);
    expect(bossClockNotice(31, false)).toBeNull();
    expect(bossClockNotice(30, false)).not.toBeNull();
    expect(bossClockNotice(15, false)).not.toBeNull();
    expect(bossClockNotice(5, false)).not.toBeNull();
  });

  it("30초에서 넘겼을 때 벌어지는 일을 미리 말한다", () => {
    // 여기가 이번 고침의 요점이다 — 여태 어느 화면도 그 연쇄를 잇지 않았다.
    expect(bossClockNotice(30, false)).toContain("겹칩니다");
  });

  it("마지막 우두머리에서는 다른 말을 한다 — 거기서는 시계가 벽이다", () => {
    const normal = bossClockNotice(30, false) ?? "";
    const final = bossClockNotice(30, true) ?? "";
    expect(final).not.toBe(normal);
    expect(final).toContain("패배");
    expect(bossFinalWallNotice()).toContain("패배");
  });

  it("초과 문구가 주기와 상한을 수치로 적는다", () => {
    const notice = bossOvertimeNotice();
    expect(notice).toContain(`${WAVE_REINFORCEMENT_DELAY}초`);
    expect(notice).toContain(`${MAX_ENEMIES}체`);
  });
});
