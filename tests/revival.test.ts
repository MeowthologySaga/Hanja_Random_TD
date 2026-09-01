/*
 * 부활 — 판당 한 번, 벌은 남긴다(기획안 v035 ⑤).
 *
 * 화면 쪽 흐름(부적지가 종료 화면보다 먼저 선다·시계·포기)은 e2e/revival.spec.ts
 * 가 맡는다. 여기서는 엔진이 지키는 규칙만 못 박는다.
 */
import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/core/game";
import { REVIVAL_BOSS_SECONDS } from "../src/core/engine-tuning";
import { MAX_ENEMIES } from "../src/core/content";
import { captureRunSave, parseRunSave, restoreRun } from "../src/core/run-save";

function combatEngine(seed: string): GameEngine {
  const engine = new GameEngine(seed, "KR", "standard");
  engine.begin();
  engine.summon();
  engine.startWaveEarly();
  for (let step = 0; step < 600 && engine.state.enemies.length === 0; step += 1) engine.update(0.1);
  return engine;
}

/** 전장을 한계까지 채워 그 자리에서 지게 한다. */
function floodToDefeat(engine: GameEngine): void {
  const seed = engine.state.enemies[0]!;
  while (engine.state.enemies.length < MAX_ENEMIES) {
    engine.state.enemies.push({ ...seed, id: 90_000 + engine.state.enemies.length });
  }
  engine.update(0.1);
}

describe("부활 부적", () => {
  it("적 한계로 지면 전장의 적 절반을 봉인하고 이어 간다", () => {
    const engine = combatEngine("revive-flood");
    floodToDefeat(engine);
    expect(engine.state.phase).toBe("defeat");
    expect(engine.canRevive()).toBe(true);

    expect(engine.revive()).toMatchObject({ ok: true });
    expect(engine.state.phase).toBe("combat");
    expect(engine.state.defeatCause).toBeNull();
    expect(engine.state.enemies.length).toBe(MAX_ENEMIES / 2);
  });

  it("봉인한 적에게는 보상이 없다 — 죽는 것이 이득이면 안 된다", () => {
    const engine = combatEngine("revive-no-reward");
    floodToDefeat(engine);
    const goldBefore = engine.state.gold;
    const killsBefore = engine.state.killCount;
    engine.revive();
    expect(engine.state.gold).toBe(goldBefore);
    expect(engine.state.killCount).toBe(killsBefore);
  });

  it("앞선 적부터 걷는다 — 뒤엣것을 걷어 봐야 위험이 안 준다", () => {
    const engine = combatEngine("revive-front");
    floodToDefeat(engine);
    const before = [...engine.state.enemies].sort((left, right) => right.progress - left.progress);
    engine.revive();
    const survivors = new Set(engine.state.enemies.map((enemy) => enemy.id));
    // 앞선 절반은 사라지고 뒤엣 절반은 남는다.
    for (let index = 0; index < MAX_ENEMIES / 2; index += 1) {
      expect(survivors.has(before[index]!.id)).toBe(false);
    }
    for (let index = MAX_ENEMIES / 2; index < before.length; index += 1) {
      expect(survivors.has(before[index]!.id)).toBe(true);
    }
  });

  it("판당 한 번이다", () => {
    const engine = combatEngine("revive-once");
    floodToDefeat(engine);
    expect(engine.revive()).toMatchObject({ ok: true });
    expect(engine.state.revivalUsed).toBe(true);

    floodToDefeat(engine);
    expect(engine.state.phase).toBe("defeat");
    expect(engine.canRevive()).toBe(false);
    expect(engine.revive()).toMatchObject({ ok: false });
  });

  it("수련장에서는 뜨지 않는다 — 각본이 「지면 다시」로 짜여 있다", () => {
    const engine = new GameEngine("revive-tutorial", "KR", "standard", { tutorial: true });
    engine.begin();
    engine.summon();
    engine.startWaveEarly();
    for (let step = 0; step < 600 && engine.state.enemies.length === 0; step += 1) engine.update(0.1);
    floodToDefeat(engine);
    expect(engine.state.phase).toBe("defeat");
    expect(engine.canRevive()).toBe(false);
  });

  it("이어하기로 무를 수 없다 — 쓴 사실이 저장본에 남는다", () => {
    /*
     * 마지막 저장 지점은 진 웨이브 직전이다. 쓴 사실을 안 남기면 이어하기를
     * 되풀이하며 부활을 무한히 쓸 수 있다 — 이어하기가 아니라 무르기가 된다.
     */
    const engine = combatEngine("revive-save");
    floodToDefeat(engine);
    engine.revive();
    engine.state.bossTimeGrant = REVIVAL_BOSS_SECONDS;

    const save = captureRunSave(engine, { talismanFreeSummonTokens: 0 });
    expect(save).not.toBeNull();
    const parsed = parseRunSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    const restored = restoreRun(parsed!);
    expect(restored.state.revivalUsed).toBe(true);
    expect(restored.state.bossTimeGrant).toBe(REVIVAL_BOSS_SECONDS);
    restored.state.phase = "defeat";
    restored.state.defeatCause = "enemy-limit";
    expect(restored.canRevive()).toBe(false);
  });

  it("우두머리 시간초과로 지면 제한시간을 더 얻는다", () => {
    const engine = new GameEngine("revive-boss", "KR", "standard");
    engine.begin();
    engine.summon();
    engine.state.wave = 99;
    engine.startWaveEarly();
    const count = engine.getCurrentPlan()?.count ?? 0;
    for (let step = 0; step < 900 && engine.state.spawned < count; step += 1) engine.update(0.1);
    const limit = engine.bossTimeLimit(100)!;
    engine.state.waveElapsed = limit - 0.05;
    engine.update(0.1);
    expect(engine.state.phase).toBe("defeat");
    expect(engine.state.defeatCause).toBe("boss-timeout");

    expect(engine.revive()).toMatchObject({ ok: true });
    expect(engine.state.phase).toBe("combat");
    expect(engine.bossTimeLimit(100)).toBe(limit + REVIVAL_BOSS_SECONDS);
    // 다시 시계가 흐르므로 남은 시간이 생긴다 — 그 자리에서 또 지지 않는다.
    engine.update(0.1);
    expect(engine.state.phase).toBe("combat");
    expect(engine.bossTimeRemaining()).toBeGreaterThan(0);
  });
});
