/*
 * 교전 템포 실측 — "전반적으로 템포가 빠르다"(사용자)를 숫자로 잡는 자.
 *
 * 승률·런 길이 게이트는 **결과**만 본다. 사람이 느끼는 템포는 결과가 아니라
 * 한 마리가 얼마나 버티는가, 한 마리를 잡는 데 몇 발이 드는가, 화면에 적이
 * 얼마나 서 있는가에서 온다. 그 셋을 잰다.
 *
 *   npx tsx scripts/combat-tempo.ts [--waves=15] [--seeds=6] [--mode=standard]
 *
 * 판은 **게이트가 쓰는 그 봇**(runAutoplay)이 굴린다. 밖에서 흉내 낸 판으로
 * 재 보았더니 자령을 덜 세워 적이 90초씩 살아남았다 — 그건 이 게임의 템포가
 * 아니라 그 흉내의 템포였다. 관측자는 봇의 판단에 관여하지 않으므로 게이트
 * 시드 결정성도 그대로다.
 *
 * 밸런스를 손본 뒤 같은 명령으로 다시 재어 **전후를 견준다.** 승률이 그대로여도
 * 이 표가 느려졌으면 템포는 느려진 것이고, 그것이 이 손질의 목표다.
 */
import { runAutoplay } from "../src/core/autoplay";
import type { GameEngine } from "../src/core/game";
import type { GameMode, RegionCode } from "../src/core/types";

interface WaveSlot {
  lifetimes: number[];
  shots: number;
  seconds: number;
  enemySum: number;
  ticks: number;
}

function argOf(name: string, fallback: string): string {
  const hit = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

function emptySlot(): WaveSlot {
  return { lifetimes: [], shots: 0, seconds: 0, enemySum: 0, ticks: 0 };
}

/** 한 판을 끝까지 굴리며 웨이브마다 템포 표본을 남긴다. */
function measureRun(seed: string, region: RegionCode, mode: GameMode, waves: number): Map<number, WaveSlot> {
  const perWave = new Map<number, WaveSlot>();
  const born = new Map<number, number>();
  let alive = new Set<number>();
  /*
   * 이벤트 줄에서 어디까지 세었는지.
   *
   * 봇은 이벤트를 걷지 않아 줄이 판 내내 쌓이기만 한다. 매 틱 전체를 세면 같은
   * 발사를 수만 번 다시 세게 된다(실측: 발/봉인 25,740).
   */
  let seenEvents = 0;

  const observe = (engine: GameEngine, delta: number): void => {
    const wave = engine.state.wave;
    if (wave < 1 || wave > waves || engine.state.phase !== "combat") {
      // 준비 시간은 템포의 대상이 아니다 — 사람이 부적을 쓰거나 배치를 손보는 시간이다.
      // 다만 커서는 따라가 둬야 교전 첫 틱이 준비 중 이벤트까지 삼키지 않는다.
      seenEvents = engine.peekEvents().length;
      return;
    }
    let slot = perWave.get(wave);
    if (!slot) {
      slot = emptySlot();
      perWave.set(wave, slot);
    }
    slot.seconds += delta;
    slot.ticks += 1;
    slot.enemySum += engine.state.enemies.length;

    const now = new Set<number>();
    for (const enemy of engine.state.enemies) {
      now.add(enemy.id);
      if (!born.has(enemy.id)) born.set(enemy.id, engine.state.elapsed);
    }
    // 지난 틱에 있다가 사라진 적 = 이 틱에 봉인된 적.
    for (const id of alive) {
      if (now.has(id)) continue;
      const birth = born.get(id);
      if (birth !== undefined) slot.lifetimes.push(engine.state.elapsed - birth);
      born.delete(id);
    }
    alive = now;
    /*
     * 발사 이벤트는 세되 **소비하지는 않는다.**
     *
     * consumeEvents() 를 부르면 봇이 볼 이벤트를 가로채는 셈이라 판이 달라진다.
     * 봇은 이벤트를 안 쓰지만, 계측이 판을 바꾸지 않는다는 규칙은 지킨다.
     */
    const events = engine.peekEvents();
    for (let index = seenEvents; index < events.length; index += 1) {
      if (events[index]?.type === "shot") slot.shots += 1;
    }
    seenEvents = events.length;
  };

  runAutoplay(seed, region, 5_400, mode, { observe });
  return perWave;
}

const waves = Number(argOf("waves", "15"));
const seeds = Number(argOf("seeds", "6"));
const mode = argOf("mode", "standard") as GameMode;
const region = argOf("region", "KR") as RegionCode;

const runs = Array.from({ length: seeds }, (_, index) => measureRun(`tempo-${index}`, region, mode, waves));

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const rows = Array.from({ length: waves }, (_, offset) => {
  const wave = offset + 1;
  const slots = runs.map((run) => run.get(wave)).filter((slot): slot is WaveSlot => slot !== undefined);
  const lifetimes = slots.map((slot) => mean(slot.lifetimes)).filter((value) => value > 0);
  const perKill = slots
    .filter((slot) => slot.lifetimes.length > 0)
    .map((slot) => slot.shots / slot.lifetimes.length);
  return {
    wave,
    /** 한 마리가 화면에 서 있던 평균 시간(초). */
    lifetime: +mean(lifetimes).toFixed(2),
    /** 한 마리를 봉인하는 데 든 평균 발수. */
    shotsPerKill: +mean(perKill).toFixed(1),
    /** 웨이브 교전이 흐른 시간(초). */
    seconds: +mean(slots.map((slot) => slot.seconds)).toFixed(1),
    /** 화면에 서 있던 적의 평균 수. */
    enemies: +mean(slots.map((slot) => (slot.ticks === 0 ? 0 : slot.enemySum / slot.ticks))).toFixed(1),
    kills: +mean(slots.map((slot) => slot.lifetimes.length)).toFixed(1)
  };
});

console.log(JSON.stringify({
  mode,
  region,
  seeds,
  waves,
  rows,
  overall: {
    lifetime: +mean(rows.map((row) => row.lifetime)).toFixed(2),
    shotsPerKill: +mean(rows.map((row) => row.shotsPerKill)).toFixed(1),
    enemies: +mean(rows.map((row) => row.enemies)).toFixed(1),
    secondsPerWave: +mean(rows.map((row) => row.seconds)).toFixed(1)
  }
}, null, 1));
