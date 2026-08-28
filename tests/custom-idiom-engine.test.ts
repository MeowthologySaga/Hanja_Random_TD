import { describe, expect, it } from "vitest";

import { customIdiomToDefinition, type CustomIdiom } from "../src/core/custom-idioms";
import { GameEngine } from "../src/core/game";
import type { IdiomBonusKind } from "../src/core/types";

function customIdiom(id: string, kind: IdiomBonusKind, value: number, chars = "天地玄黃"): CustomIdiom {
  return {
    id,
    chars,
    reading: "천지현황",
    meaning: "시험용",
    bonus: { kind, value, label: `시험 ${kind}` },
    createdAt: 0
  };
}

function engineWith(...idioms: CustomIdiom[]): GameEngine {
  return new GameEngine("custom-idiom-seed", "KR", "standard", {
    customIdioms: idioms.map(customIdiomToDefinition)
  });
}

/** 봉인 하나를 세운다. 네 자리는 한 진 안의 한 줄이라 첫 자리가 진을 정한다. */
function seal(engine: GameEngine, idiomId: string, firstCell: number): void {
  engine.state.idiomSeals.push({
    idiomId,
    cells: [firstCell, firstCell + 1, firstCell + 2, firstCell + 3],
    completedAt: 0,
    active: true
  });
}

/**
 * 첫 웨이브를 세우고 그때 들어온 엽전을 잰다.
 *
 * `update()` 를 태우지 않는다 — 갱신은 줄이 흩어진 봉인을 정리하므로, 손으로
 * 세운 시험용 봉인이 그 자리에서 꺼진다. 재려는 것은 웨이브가 설 때의 지급
 * 하나이므로 웨이브만 세운다.
 */
function waveGoldDelta(engine: GameEngine, sealIdiomId?: string): number {
  engine.summon();
  // 봉인은 소환 **뒤**에 세운다 — 소환이 성어 발동을 다시 셈하면서 손으로
  // 세운 시험용 봉인을 그 자리에서 정리하기 때문이다.
  if (sealIdiomId) seal(engine, sealIdiomId, 0);
  // 조기 출전 보너스는 남은 준비 시간의 절반이다. 0 으로 밀어 두면 웨이브가
  // 설 때 들어오는 몫만 남는다.
  engine.state.prepRemaining = 0;
  const before = engine.state.gold;
  engine.startWaveEarly();
  return engine.state.gold - before;
}

describe("커스텀 성어가 판에 들어간다", () => {
  it("넘기지 않으면 여태와 똑같은 판이다", () => {
    const plain = new GameEngine("custom-idiom-seed", "KR", "standard");
    const withOption = new GameEngine("custom-idiom-seed", "KR", "standard", { customIdioms: [] });

    expect(withOption.state.featuredIdiomIds).toEqual(plain.state.featuredIdiomIds);
    expect(withOption.allIdioms().length).toBe(plain.allIdioms().length);
  });

  it("장착한 성어는 뽑히지 않고 무조건 이 판의 명단에 든다", () => {
    const engine = engineWith(customIdiom("mine-1", "damage", 0.1), customIdiom("mine-2", "range", 12));

    expect(engine.state.featuredIdiomIds).toContain("mine-1");
    expect(engine.state.featuredIdiomIds).toContain("mine-2");
    expect(engine.idioms().map((idiom) => idiom.id)).toEqual(expect.arrayContaining(["mine-1", "mine-2"]));
    expect(engine.allIdioms().some((idiom) => idiom.source === "custom")).toBe(true);
  });

  it("지역 명단에 없는 성어도 조회·진척이 된다", () => {
    const engine = engineWith(customIdiom("mine-1", "damage", 0.1));
    const progress = engine.idiomProgress("mine-1");

    expect(progress.total).toBe(4);
    expect(progress.missingChars.length).toBeGreaterThan(0);
  });

  it("합산 통이 따로다 — 커스텀은 기존 성어의 상한을 먹지 않는다", () => {
    const engine = engineWith(customIdiom("mine-1", "damage", 0.1));
    seal(engine, "mine-1", 0);

    // 기존 성어 통은 그대로 0 이고, 커스텀 몫만 따로 선다.
    expect(engine.idiomBonus("damage")).toBe(0);
    expect(engine.customIdiomBonus("damage")).toBeCloseTo(0.1, 6);
    expect(engine.totalIdiomBonus("damage")).toBeCloseTo(0.1, 6);
  });

  it("한 축에 몰아도 상한에서 멈춘다", () => {
    const many = Array.from({ length: 15 }, (_, index) => customIdiom(`mine-${index}`, "damage", 0.1));
    const engine = engineWith(...many);
    for (const idiom of many) seal(engine, idiom.id, 0);

    expect(engine.customIdiomBonus("damage")).toBeLessThanOrEqual(0.24);
    expect(engine.customIdiomBonus("damage")).toBeGreaterThan(0.2);
  });

  it("발동하지 않은 봉인은 힘을 내지 않는다", () => {
    const engine = engineWith(customIdiom("mine-1", "waveGold", 9));
    engine.state.idiomSeals.push({ idiomId: "mine-1", cells: [0, 1, 2, 3], completedAt: 0, active: false });

    expect(engine.customIdiomBonus("waveGold")).toBe(0);
  });

  it("기존 성어만 굴리는 축은 커스텀 통에서 0 이다", () => {
    const engine = engineWith(customIdiom("mine-1", "damage", 0.1));
    seal(engine, "mine-1", 0);

    expect(engine.customIdiomBonus("killEssence")).toBe(0);
    expect(engine.customIdiomBonus("formationAttack")).toBe(0);
  });

  it("웨이브가 서면 「웨이브 엽전」이 들어온다", () => {
    const engine = engineWith(customIdiom("mine-1", "waveGold", 9));
    engine.begin();

    const delta = waveGoldDelta(engine, "mine-1");

    expect(engine.state.wave).toBe(1);
    expect(delta).toBe(9);
  });

  it("커스텀이 없으면 웨이브 엽전도 없다 — 시뮬 게이트가 흔들리지 않는다", () => {
    const engine = new GameEngine("custom-idiom-seed", "KR", "standard");
    engine.begin();

    const delta = waveGoldDelta(engine);

    expect(engine.state.wave).toBe(1);
    expect(delta).toBe(0);
  });
});

describe("장착한 커스텀 성어는 명단에서 밀려나지 않는다", () => {
  it("아무 성어나 추적해도 장착분이 명단에 남는다", () => {
    const mine = [
      customIdiom("mine-1", "damage", 0.1),
      customIdiom("mine-2", "range", 12),
      customIdiom("mine-3", "waveGold", 7)
    ];
    const engine = engineWith(...mine);
    engine.begin();

    /*
     * 명단 자리를 다섯으로 고정해 두면, 지역 성어 하나를 추적하는 순간
     * 커스텀 셋이 뒤로 밀려 판에서 사라졌다. 자리 수는 다섯 + 장착 수다.
     */
    const outsider = engine
      .allIdioms()
      .find((idiom) => idiom.source !== "custom" && !engine.state.featuredIdiomIds.includes(idiom.id));
    expect(outsider).toBeDefined();
    engine.setIdiomTarget(outsider!.id);

    for (const idiom of mine) {
      expect(engine.state.featuredIdiomIds).toContain(idiom.id);
    }
    expect(engine.state.featuredIdiomIds).toContain(outsider!.id);
  });
});
