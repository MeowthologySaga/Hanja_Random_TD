/*
 * 부적 모드 경제 — 「적이 5% 강해진다」 회귀 (트랙 C2 ③).
 *
 * 부적 만들기는 사람만 쓰는 수입원이라 그대로 두면 초반 수입이 두 배가 된다
 * (engine-tuning.ts 「부적 모드 경제」의 실측 표). 처음 시도한 「웨이브 정산에서
 * 되갚기」는 번 것을 도로 걷어 가 보상을 가짜로 만들었으므로 폐기했고, 대가는
 * 난이도로 받는다 — 부적 모드를 켠 런에서만 적 체력이 5% 오른다.
 *
 * 여기서 못박는 세 가지:
 *   ① 옵션을 넘기지 않으면 적 체력이 예전과 완전히 같다. 시뮬 봇(runAutoplay)이
 *      바로 이 경로라, 게이트 수치가 흔들리지 않는 근거다.
 *   ② 켜면 정확히 계수만큼만 오른다.
 *   ③ 오르는 것은 체력뿐이다 — 수량·속도는 그대로다.
 */
import { describe, expect, it } from "vitest";
import { TALISMAN_MODE_ENEMY_HP_SCALE } from "../src/core/engine-tuning";
import { GameEngine } from "../src/core/game";

function enableWaveStart(engine: GameEngine): void {
  engine.state.summonCount = Math.max(1, engine.state.summonCount);
  engine.state.startingFormationIndex ??= 2;
  if (engine.state.unlockedFormations.length === 0) engine.state.unlockedFormations = [2];
}

/** 같은 시드로 한 웨이브를 굴려 스폰된 적을 그대로 돌려준다. */
function spawnedEnemies(talismanMode: boolean): Array<{ maxHp: number; speed: number }> {
  const engine = new GameEngine("talisman-hp-scale", "KR", "casual", talismanMode ? { talismanMode: true } : {});
  engine.begin();
  enableWaveStart(engine);
  engine.startWaveEarly();
  // 계획된 몸수가 전부 나올 때까지 굴린다(스폰 간격은 두 런이 같다).
  for (let step = 0; step < 600; step += 1) {
    engine.update(0.1);
    if (engine.state.spawned >= (engine.getCurrentPlan()?.count ?? 0)) break;
  }
  return engine.state.enemies.map((enemy) => ({ maxHp: enemy.maxHp, speed: enemy.speed }));
}

describe("talisman mode difficulty toll", () => {
  it("leaves enemy health untouched when the option is not passed", () => {
    // 시뮬 봇과 기존 단위 테스트가 타는 경로 — 옵션이 없으면 이전과 같다.
    const engine = new GameEngine("talisman-hp-scale", "KR", "casual");
    expect(engine.talismanMode).toBe(false);
  });

  it("raises only enemy health, by exactly the tuned scale", () => {
    const plain = spawnedEnemies(false);
    const talisman = spawnedEnemies(true);

    expect(plain.length).toBeGreaterThan(0);
    // ③ 수량은 그대로다 — 스폰 계획을 건드리지 않았다.
    expect(talisman.length).toBe(plain.length);
    for (let index = 0; index < plain.length; index += 1) {
      const before = plain[index] as { maxHp: number; speed: number };
      const after = talisman[index] as { maxHp: number; speed: number };
      // ② 체력만 정확히 계수배.
      expect(after.maxHp).toBeCloseTo(before.maxHp * TALISMAN_MODE_ENEMY_HP_SCALE, 6);
      // ③ 속도는 그대로다.
      expect(after.speed).toBeCloseTo(before.speed, 6);
    }
  });

  it("keeps the toll small enough to read as a nudge", () => {
    // 5% 는 "티 안 나는 수준"이라는 사용자 판단의 수치다 — 두 자릿수로 올리면
    // 부적을 쓰지 않는 사람에게까지 체감되는 난이도 변경이 된다.
    expect(TALISMAN_MODE_ENEMY_HP_SCALE).toBeGreaterThan(1);
    expect(TALISMAN_MODE_ENEMY_HP_SCALE).toBeLessThanOrEqual(1.1);
  });
});
