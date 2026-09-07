/*
 * 자령 유래 배본 (v041).
 *
 * "검수에서 걸린 스프라이트 예를 들어 올래 같은애는 도감에 유래를 잘 설명한다면
 * 유저가 억지라고 생각 하지 않을 것 같아"(사용자).
 *
 * 유래는 **사실이어야 한다** — 지어내면 한자를 가르치겠다는 게임의 신뢰가 통째로
 * 깨진다. 그래서 적재 시점 검증이 형식을 강제하고, 이 시험이 그 검증이 살아 있는지
 * 본다. 특히 설이 갈리는 글자는 본문 스스로 그 사실을 밝혀야 한다.
 */
import { describe, expect, it } from "vitest";
import { allJaryeongOrigins, jaryeongOrigin, JARYEONG_ORIGIN_META } from "../src/core/jaryeong-origins";

describe("자령 유래", () => {
  it("배본이 실려 있고 글자로 찾힌다", () => {
    expect(JARYEONG_ORIGIN_META.total).toBeGreaterThan(0);
    expect(allJaryeongOrigins()).toHaveLength(JARYEONG_ORIGIN_META.total);
    expect(jaryeongOrigin("來")?.hook).toBe("보리에서 온 글자");
    expect(jaryeongOrigin("天")).toBeUndefined();
  });

  it("본문은 그림을 가리키며 끝난다 — 어원 지식이 아니라 그림의 변론이다", () => {
    for (const origin of allJaryeongOrigins()) {
      expect(origin.body, origin.hanja).toMatch(/자령|그림|까닭|것이다|탓이다|모습이다|장면/);
    }
  });

  it("설이 갈리는 글자는 스스로 그렇게 말한다", () => {
    for (const origin of allJaryeongOrigins()) {
      if (origin.certainty === "갈림") expect(origin.body, origin.hanja).toContain("설도 있다");
    }
    expect(allJaryeongOrigins().some((origin) => origin.certainty === "갈림")).toBe(true);
  });

  it("근거 칸에 작업 상태 낱말을 쓰지 않는다", () => {
    // 도감은 플레이어가 읽는 자리다 — QC·검토 같은 우리 쪽 말이 새면 안 된다.
    for (const origin of allJaryeongOrigins()) {
      expect(origin.ground, origin.hanja).not.toMatch(/QC|검토|승인|재생성|pending/iu);
      expect(origin.body, origin.hanja).not.toMatch(/QC|검토|승인|재생성|pending/iu);
    }
  });
});
