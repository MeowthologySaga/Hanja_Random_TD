import { describe, expect, it } from "vitest";

import { pickTalismanVisitLine } from "../src/ui/talisman-lines";

/*
 * 자령의 말은 순수 규칙이라 화면 없이 잰다 — talisman-lines.ts 는 DOM 도
 * 엔진도 모른다. 연출 파일에 두었을 때는 app-context 가 딸려 와 import 만으로
 * window 를 읽어 시험이 서지 않았다.
 */
describe("부적 자령의 말", () => {
  it("보상 종류마다 제 갈래의 말을 한다", () => {
    for (const kind of ["gold", "essence", "token"] as const) {
      const line = pickTalismanVisitLine(kind);
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it("직전 여섯 줄은 다시 나오지 않는다", () => {
    // 한 갈래(엽전 10줄)만 계속 뽑아 회피 창이 실제로 도는지 본다.
    const seen: string[] = [];
    for (let index = 0; index < 40; index += 1) {
      const line = pickTalismanVisitLine("gold");
      // 직전 여섯 줄 안에 같은 말이 다시 나오면 회피가 깨진 것이다.
      expect(seen.slice(-6)).not.toContain(line);
      seen.push(line);
    }
  });

  it("스물아홉 줄이 모두 쓰인다", () => {
    const collected = new Set<string>();
    // 갈래를 섞어 충분히 돌리면 스물아홉 줄이 전부 한 번씩은 나온다.
    for (let index = 0; index < 4_000; index += 1) {
      collected.add(pickTalismanVisitLine((["gold", "essence", "token"] as const)[index % 3]!));
    }
    expect(collected.size).toBe(29);
  });
});
