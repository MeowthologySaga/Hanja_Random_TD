/*
 * 판이 예외로 멈춘 자리에서 무엇을 말하는가 (v042).
 *
 * 실측이 이 시험을 세웠다. 프레임이 던지면 재스케줄이 그 줄 뒤에 있어(game-loop 의
 * 마지막 문장) 다음 프레임이 영영 안 걸린다 — 2.5초 동안 프레임 스케줄이 4119 에서
 * 한 번도 안 늘었고 판은 71.8초에 섰는데, **화면 신호가 하나도 없었다.**
 *
 * 문장은 코어가 만든다(v041 우두머리 시계 · v042 waveClearNotice 선례). 그리고 이
 * 문장은 **거짓말이 되기 쉬운 자리**다 — 수련장과 첫 웨이브 이전은 저장할 지점이
 * 없어서(captureRunSave 가 null) 「이어하기」를 권하면 없는 길을 가리킨다.
 *
 * 봇은 이 자리를 못 밟는다(ctx·프레임 루프를 아예 안 지난다). 시뮬 게이트가 구조적
 * 사각지대라 이 시험이 지킨다.
 */
import { describe, expect, it } from "vitest";
import { RUN_INTERRUPT_LIMIT, runInterruptedNotice } from "../src/core/content";

describe("멈춘 판의 말", () => {
  it("저장된 판은 이어할 수 있다고 말한다", () => {
    const notice = runInterruptedNotice(true);
    expect(notice.heading.length).toBeGreaterThan(0);
    expect(notice.body).toContain("이어하기");
    expect(notice.body).toContain("저장");
  });

  it("저장할 지점이 없는 판에 이어하기를 권하지 않는다", () => {
    // 수련장·첫 웨이브 이전이 여기 걸린다. 없는 길을 가리키면 그 자체가 거짓말이다.
    const notice = runInterruptedNotice(false);
    expect(notice.body).not.toContain("이어하기");
    expect(notice.body).toContain("처음부터");
  });

  it("두 갈래가 서로 다른 말을 한다", () => {
    expect(runInterruptedNotice(true).body).not.toBe(runInterruptedNotice(false).body);
  });

  it("둘 다 무엇을 하면 되는지로 끝난다 — 진단이 아니라 다음 걸음이다", () => {
    for (const saved of [true, false]) {
      expect(runInterruptedNotice(saved).body).toContain("새로고침");
    }
  });

  it("멈추는 문턱은 한 번의 딸꾹질과 고장을 가른다", () => {
    /*
     * 1 이면 한 번뿐인 딸꾹질에도 판이 끝난다. 무한이면 반쪽 상태 위에서 계속 굴러
     * 이벤트가 영영 처리 안 되고 웨이브 저장도 건너뛴다. 결정적 결함에서는 초당
     * 77.5프레임이 도니(실측) 셋이면 0.04초 안에 판정이 난다.
     */
    expect(RUN_INTERRUPT_LIMIT).toBeGreaterThan(1);
    expect(RUN_INTERRUPT_LIMIT).toBeLessThanOrEqual(5);
  });
});
