/*
 * 이 판이 만난 글자를 판이 끝날 때까지 기억하는가 (v042).
 *
 * 실측이 이 시험을 세웠다. 한 판은 웨이브마다 야생 글자를 데려오고 그 글자가 적의
 * 몸에 찍혀 나온다 — 봇 10시드로 재면 판당 **99.2자**(서로 다른 **93.0자**). v042 가
 * 그 글자를 배너로 읽어 주고 소리로도 읽어 주게 됐는데, **판이 끝나면 통째로
 * 증발했다.** 종료 화면의 `발견 한자` 는 소환·승급·합성만 세고 웨이브를 한 번도 안
 * 지나므로 그 자리를 못 메운다 — 어느 칸에도 안 나오는 서로 다른 글자가 **75.8자**다.
 *
 * 봇은 이벤트를 걷지도 화면을 만지지도 않는다. 시뮬 게이트가 구조적 사각지대라
 * 이 시험과 e2e 가 전부다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { noteWaveChar, resetRunTrace, runTrace, runTraceEntries, runTraceTail, seedRunTrace } from "../src/ui/run-trace";
import { RUN_TRACE_CHIP_LIMIT, runTraceNotice } from "../src/core/content";

beforeEach(() => resetRunTrace());

describe("만난 글자 기록", () => {
  it("웨이브가 데려온 글자를 순서대로 적는다", () => {
    noteWaveChar("天", 1);
    noteWaveChar("地", 2);
    noteWaveChar("玄", 3);
    expect(runTrace().distinct).toBe(3);
    expect(runTrace().chars).toEqual(["天", "地", "玄"]);
  });

  it("같은 글자가 다시 와도 처음 만난 자리를 지킨다", () => {
    // 「언제 처음 만났나」가 회상의 실마리다 — 마지막에 본 웨이브는 그 실마리를 지운다.
    noteWaveChar("天", 1);
    noteWaveChar("地", 2);
    noteWaveChar("天", 30);
    expect(runTrace().distinct).toBe(2);
    expect(runTrace().chars).toEqual(["天", "地"]);
  });

  it("빈 글자와 잘못된 웨이브는 안 적는다", () => {
    noteWaveChar("", 1);
    noteWaveChar("天", 0);
    noteWaveChar("地", Number.NaN);
    expect(runTrace().distinct).toBe(0);
  });

  it("새 판은 빈손으로 연다", () => {
    noteWaveChar("天", 1);
    resetRunTrace();
    expect(runTrace().distinct).toBe(0);
    expect(runTraceTail(12)).toEqual([]);
  });
});

describe("종료 화면에 실을 꼬리", () => {
  const fill = (count: number): void => {
    for (let index = 0; index < count; index += 1) noteWaveChar(String.fromCodePoint(0x4e00 + index), index + 1);
  };

  it("적게 만났으면 전부 준다", () => {
    fill(5);
    expect(runTraceTail(12)).toHaveLength(5);
  });

  it("많이 만났으면 **끝에서부터** 자른다 — 얕게 남은 쪽이 되짚을 값이 크다", () => {
    fill(93); // 실측 판당 서로 다른 글자 수
    const tail = runTraceTail(12);
    expect(tail).toHaveLength(12);
    expect(tail[tail.length - 1]).toBe(String.fromCodePoint(0x4e00 + 92));
    expect(tail[0]).toBe(String.fromCodePoint(0x4e00 + 81));
  });

  it("자른 뒤에도 만난 순서 그대로다 — 뒤집으면 읽는 방향이 화면과 반대가 된다", () => {
    fill(20);
    const tail = runTraceTail(4);
    expect(tail).toEqual([16, 17, 18, 19].map((index) => String.fromCodePoint(0x4e00 + index)));
  });

  it("0 이하를 물으면 빈손이다", () => {
    fill(5);
    expect(runTraceTail(0)).toEqual([]);
    expect(runTraceTail(-3)).toEqual([]);
  });
});

describe("문장은 코어가 만든다", () => {
  it("다 실었으면 자른 말을 안 한다", () => {
    const text = runTraceNotice(7, 7);
    expect(text).toContain("7자");
    expect(text).not.toContain("마지막");
  });

  it("잘랐으면 몇 자를 보여 주는지 말한다", () => {
    const text = runTraceNotice(93, 12);
    expect(text).toContain("93자");
    expect(text).toContain("마지막 12자");
  });

  it("띠가 서지 않는 판에는 이 문장이 안 불린다 — 계약을 시험이 적어 둔다", () => {
    /*
     * 한 자도 못 만난 판에서는 화면이 띠를 통째로 숨긴다. 그래서 이 함수는
     * `distinct >= 1` 로만 불린다. 처음에는 0인 갈래에 문장을 적어 뒀는데 **화면에
     * 닿을 수 없는 말**이었다 — 아무도 못 볼 문장을 시험이 못 박고 있으면 다음 사람은
     * 그 갈래가 살아 있다고 믿는다. 지금은 계약만 적는다.
     */
    expect(runTraceNotice(1, 1)).toContain("1자");
  });

  it("칩 수는 한 줄 예산 안이다", () => {
    // 카드 안쪽 502px · 칩 26px + 여백 6px → 열여덟까지 든다. 열둘은 그 안이다.
    expect(RUN_TRACE_CHIP_LIMIT).toBeGreaterThan(4);
    expect(RUN_TRACE_CHIP_LIMIT).toBeLessThanOrEqual(18);
  });
});

/*
 * 이어한 판도 **판 전체**를 센다 (v042, 반박이 잡은 구멍).
 *
 * 처음에는 새 판에서만 비우고 이어하기는 손대지 않았다. 이 맵은 모듈 전역이라 부팅
 * 직후 늘 비어 있고 저장본에는 지나간 글자가 한 자도 없어서, **이어한 판의 자취가
 * 「이어한 뒤 만난 글자」**가 됐다. 40웨이브에 저장하고 이어서 100웨이브에 이긴 사람에게
 * 「도달 웨이브 100 / 100」 바로 아래에서 「이번 판에서 만난 글자 60자」라고 말하는
 * 셈이다 — 같은 카드 안에서 두 칸이 서로 다른 판을 센다.
 *
 * 자동 저장 지점의 53.7%가 판 중간이라 이건 예외가 아니라 기본값이었다.
 */
describe("이어한 판의 자취", () => {
  it("저장본에서 되살리면 그 앞의 글자가 살아난다", () => {
    seedRunTrace([
      { char: "天", wave: 1 },
      { char: "地", wave: 2 }
    ]);
    noteWaveChar("玄", 41);
    expect(runTrace().distinct).toBe(3);
    expect(runTrace().chars).toEqual(["天", "地", "玄"]);
  });

  it("되살리기가 먼저 비운다 — 앞 판의 글자가 새 판에 새지 않는다", () => {
    noteWaveChar("黃", 1);
    seedRunTrace([{ char: "天", wave: 1 }]);
    expect(runTrace().chars).toEqual(["天"]);
  });

  it("칸이 없는 옛 저장본은 빈손으로 이어간다 — 지어내지 않는다", () => {
    noteWaveChar("黃", 1);
    seedRunTrace([]);
    expect(runTrace().distinct).toBe(0);
  });

  it("뜨고 다시 부으면 처음 만난 웨이브가 그대로다", () => {
    noteWaveChar("天", 3);
    noteWaveChar("地", 17);
    const carried = runTraceEntries();
    expect(carried).toEqual([{ char: "天", wave: 3 }, { char: "地", wave: 17 }]);
    seedRunTrace(carried);
    // 되살린 뒤 같은 글자가 늦은 웨이브에 또 와도 처음 자리를 안 덮는다.
    noteWaveChar("天", 88);
    expect(runTraceEntries()).toEqual([{ char: "天", wave: 3 }, { char: "地", wave: 17 }]);
  });
});
