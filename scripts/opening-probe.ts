/*
 * 개문 실측 — "처음 하는 사람의 손"으로 1~4웨이브가 치워지는가.
 *
 * 게이트 봇(runAutoplay)은 엽전이 생기는 족족 소환하고 매 웨이브 [지금 시작]을
 * 누른다. 처음 하는 사람은 그러지 않는다 — 코치가 말한 만큼(3기) 세우고 손을
 * 놓은 채 본다. 그 판이 어떻게 흐르는지는 봇의 승률로는 보이지 않아서, 이 자가
 * 따로 잰다.
 *
 *   npx tsx scripts/opening-probe.ts [--summons=3,6] [--seeds=OPEN-1,OPEN-2] [--mode=standard] [--table]
 *
 * 웨이브마다 발수·피해·처치·걸린 초·사정권 체류 비율(적이 하나라도 사정권 안에
 * 있던 틱의 비율)·평균 화면 적 수를 찍는다. 준비 단계가 돌아오면 곧바로 다음
 * 웨이브를 연다(손을 안 대고 보는 셈). `--table` 은 wavePlan 의 1~30웨이브
 * 몸수·체력 표를 함께 찍는다.
 *
 * v037 개문 램프(content.ts OPENING_*_RAMP)를 정한 실측이 이것이다: 램프 전에는
 * 42엽전을 다 써 6기를 세워도 1웨이브(8체 × 869HP)를 합류 시계 안에 못 잡았고,
 * 램프 뒤에는 3기가 1·2웨이브를 14초 안에 치운다.
 */
import { BOARD_CELLS, positionOnPath, wavePlan } from "../src/core/content";
import { GameEngine } from "../src/core/game";
import type { GameMode } from "../src/core/types";

function argOf(name: string, fallback: string): string {
  const hit = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

interface WaveSlot {
  shots: number;
  damage: number;
  kills: number;
  ticks: number;
  engaged: number;
  enemies: number;
}

function emptySlot(): WaveSlot {
  return { shots: 0, damage: 0, kills: 0, ticks: 0, engaged: 0, enemies: 0 };
}

function probe(seed: string, mode: GameMode, summons: number, waves: number): void {
  const engine = new GameEngine(seed, "KR", mode);
  engine.begin();
  engine.setAutomationMode("semi");
  for (let index = 0; index < summons; index += 1) {
    if (!engine.summon().ok) break;
  }
  const towers = engine.state.towers.map((tower) => `${tower.char}(${tower.combatRole})`).join(" ");
  engine.startWaveEarly();
  const perWave = new Map<number, WaveSlot>();
  let seenEvents = 0;
  let guard = 0;
  let prepReturns = 0;
  while (engine.state.wave <= waves && guard < 6_000 && engine.state.phase !== "defeat") {
    engine.update(0.1);
    guard += 1;
    const wave = engine.state.wave;
    let slot = perWave.get(wave);
    if (!slot) {
      slot = emptySlot();
      perWave.set(wave, slot);
    }
    const events = engine.peekEvents();
    for (let index = seenEvents; index < events.length; index += 1) {
      const event = events[index];
      if (!event) continue;
      if (event.type === "shot") slot.shots += 1;
      else if (event.type === "damage") slot.damage += event.amount;
      else if (event.type === "kill") slot.kills += 1;
    }
    seenEvents = events.length;
    slot.ticks += 1;
    slot.enemies += engine.state.enemies.length;
    const engaged = engine.state.towers.some((tower) => {
      const origin = BOARD_CELLS[tower.cell];
      if (!origin) return false;
      const range = engine.catalog.definitions.get(tower.char)?.combat.range ?? 240;
      return engine.state.enemies.some((enemy) => {
        const point = positionOnPath(enemy.progress);
        return Math.hypot(point.x - origin.x, point.y - origin.y) <= range;
      });
    });
    if (engaged) slot.engaged += 1;
    if (engine.state.phase === "prep") {
      prepReturns += 1;
      engine.startWaveEarly();
    }
  }
  console.log(`\n${seed} · ${mode} · ${summons}기 소환 → ${towers}`);
  for (const [wave, slot] of perWave) {
    if (wave > waves) continue;
    const seconds = slot.ticks / 10;
    console.log(
      `  W${wave}: ${seconds.toFixed(1)}초 · 발 ${slot.shots} · 피해 ${slot.damage.toFixed(0)} · 처치 ${slot.kills}`
      + ` · 사정권 체류 ${((slot.engaged / Math.max(1, slot.ticks)) * 100).toFixed(0)}% · 화면 적 평균 ${(slot.enemies / Math.max(1, slot.ticks)).toFixed(1)}`
    );
  }
  console.log(`  준비 단계 복귀 ${prepReturns}회 · 끝 ${engine.state.phase} W${engine.state.wave} 잔존 ${engine.state.enemies.length} 엽전 ${engine.state.gold}`);
}

function printTable(): void {
  console.log("\nwavePlan 1~30 (모드 계수 전)");
  for (let wave = 1; wave <= 30; wave += 1) {
    const plan = wavePlan(wave);
    console.log(
      `  W${String(wave).padStart(2)} ${plan.archetype.padEnd(11)} 몸수 ${String(plan.count).padStart(2)} · 체력 ${plan.hp.toFixed(1).padStart(6)}`
      + ` · 총 ${(plan.count * plan.hp).toFixed(0).padStart(5)} · 스폰 ${(plan.count * plan.interval).toFixed(1)}초 · 보상 ${plan.reward}`
    );
  }
}

const mode = argOf("mode", "standard") as GameMode;
const summonsList = argOf("summons", "3,6").split(",").map((entry) => Number(entry)).filter((entry) => entry > 0);
const seeds = argOf("seeds", "OPEN-1,OPEN-2").split(",").filter((entry) => entry.length > 0);
const waves = Number(argOf("waves", "4"));
if (process.argv.includes("--table")) printTable();
for (const summons of summonsList) for (const seed of seeds) probe(seed, mode, summons, waves);
