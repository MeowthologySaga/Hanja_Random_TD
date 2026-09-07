/*
 * 부적 글자를 이 판에 묶는다 (v042).
 *
 * 여태 활성 풀(KR 1,000자)에서 균등 추첨이었다. 실측하면 그 글자가 지금 전장에 서
 * 있을 확률 8%, 이 판에서 만난 글자일 확률 18%(표준)·26%(캐주얼)였다 — 100웨이브를
 * 다 써도 거의 전부 「처음 보는 글자를 한 번 베끼고 끝」이다. 학습으로 치면 노출만
 * 있고 회상도 재회도 없다.
 *
 * **부적 계열은 시뮬 게이트가 못 본다**(봇이 부적을 한 장도 안 쓴다). 그래서 규칙을
 * 창 없는 잎 모듈로 떼고 이 시험이 그 규칙을 지킨다.
 */
import { describe, expect, it } from "vitest";
import { pickRevisit, pickWeighted, type RevisitEntry } from "../src/ui/panels/talisman-revisit";

const ALL = (): boolean => true;

function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] as number;
}

describe("재회 명단", () => {
  it("가장 오래 못 만난 글자부터 돌려준다", () => {
    const list = new Map<string, RevisitEntry>([
      ["火", { fails: 1, lastWave: 8 }],
      ["水", { fails: 1, lastWave: 3 }],
      ["木", { fails: 1, lastWave: 5 }]
    ]);
    expect(pickRevisit(list, 10)).toBe("水");
  });

  it("방금 적힌 글자는 건너뛴다 — 같은 글자를 두 번 주는 것은 재회가 아니다", () => {
    const list = new Map<string, RevisitEntry>([["火", { fails: 2, lastWave: 7 }]]);
    expect(pickRevisit(list, 7)).toBeNull();
    expect(pickRevisit(list, 8)).toBe("火");
  });

  it("같은 웨이브면 더 많이 실패한 쪽", () => {
    const list = new Map<string, RevisitEntry>([
      ["火", { fails: 1, lastWave: 4 }],
      ["水", { fails: 3, lastWave: 4 }]
    ]);
    expect(pickRevisit(list, 9)).toBe("水");
  });
});

describe("이 판에 묶인 추첨", () => {
  const pool = ["天", "地", "玄", "黃", "火", "水", "木", "金", "土"];
  const sources = { board: ["火", "水"], waveChar: "木", idiomMissing: ["金"], discovered: ["土", "天"] };

  it("60% 아래 굴림은 이 판에 닿은 글자에서 나온다", () => {
    // 첫 굴림 0.1(바구니) · 둘째 굴림은 가중 추첨 안에서 쓰인다.
    const picked = pickWeighted(sources, new Map(), 5, pool, ALL, "", sequence([0.1, 0.01]));
    expect(picked).not.toBeNull();
    expect(["火", "水", "木", "金", "土", "天"]).toContain(picked?.char);
    expect(["board", "wave", "idiom", "discovered"]).toContain(picked?.source);
  });

  it("60~85% 굴림은 재회 명단으로 간다", () => {
    const revisit = new Map<string, RevisitEntry>([["玄", { fails: 2, lastWave: 2 }]]);
    const picked = pickWeighted(sources, revisit, 6, pool, ALL, "", sequence([0.7]));
    expect(picked).toEqual({ char: "玄", source: "revisit" });
  });

  it("재회가 비면 균등이 아니라 바구니로 되돌아간다", () => {
    // 실패 기록이 없는 판에서도 「이 판에 닿은 글자」 지분이 60% 밑으로 새면 안 된다.
    const picked = pickWeighted(sources, new Map(), 6, pool, ALL, "", sequence([0.7, 0.01]));
    expect(picked?.source).not.toBe("pool");
  });

  it("85% 위 굴림은 새 글자를 만나는 길이다", () => {
    const picked = pickWeighted(sources, new Map(), 6, pool, ALL, "", sequence([0.95, 0.0]));
    expect(picked?.source).toBe("pool");
  });

  it("직전 글자는 안 나온다", () => {
    const single = { board: ["火"], waveChar: "", idiomMissing: [], discovered: [] };
    const picked = pickWeighted(single, new Map(), 3, pool, ALL, "火", sequence([0.1, 0.0]));
    expect(picked?.char).not.toBe("火");
  });

  it("획순 자료 필터는 가중 뒤에 걸린다 — 바구니가 통째로 막히면 균등으로 내려앉는다", () => {
    const guided = (char: string): boolean => char === "天" || char === "地";
    const picked = pickWeighted(sources, new Map(), 3, pool, guided, "", sequence([0.1, 0.0]));
    expect(["天", "地"]).toContain(picked?.char);
  });

  it("한 글자가 여러 출처에 걸리면 더 무거운 쪽이 꼬리표가 된다", () => {
    // 전장(6) 과 발견(1) 에 함께 든 글자는 「전장」으로 읽힌다.
    const both = { board: ["火"], waveChar: "", idiomMissing: [], discovered: ["火"] };
    const picked = pickWeighted(both, new Map(), 3, pool, ALL, "", sequence([0.1, 0.0]));
    expect(picked).toEqual({ char: "火", source: "board" });
  });

  it("전장 글자가 발견 글자보다 자주 나온다 — 가중이 실제로 걸린다", () => {
    const many = { board: ["火"], waveChar: "", idiomMissing: [], discovered: ["天", "地", "玄", "黃"] };
    let board = 0;
    let discovered = 0;
    for (let seed = 0; seed < 600; seed += 1) {
      const random = sequence([0.1, (seed % 100) / 100]);
      const picked = pickWeighted(many, new Map(), 3, pool, ALL, "", random);
      if (picked?.source === "board") board += 1;
      if (picked?.source === "discovered") discovered += 1;
    }
    // 전장 하나(가중 6)와 발견 넷(가중 1×4=4) — 전장 쪽이 더 자주 나와야 한다.
    expect(board).toBeGreaterThan(discovered);
  });

  it("풀이 비면 아무것도 돌려주지 않는다", () => {
    expect(pickWeighted(sources, new Map(), 3, [], ALL, "", sequence([0.5]))).toBeNull();
  });

  it("풀이 하나뿐이고 그것이 직전 글자여도 빈손으로 돌아가지 않는다", () => {
    const picked = pickWeighted({ board: [], waveChar: "", idiomMissing: [], discovered: [] }, new Map(), 3, ["火"], ALL, "火", sequence([0.95]));
    expect(picked?.char).toBe("火");
  });
});
