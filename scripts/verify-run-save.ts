/*
 * 런 저장·이어하기 결정성 게이트 (트랙 V).
 *
 * 묻는 것은 하나다 — **저장 → 복원 뒤 이어 돌린 판이, 저장 없이 쭉 돌린 판과
 * 같은 상태로 가는가.** 같은 시드·같은 조작이므로 결정적 엔진이라면 두 판은
 * 마지막 한 비트까지 같아야 한다. 어긋난다면 저장본이 무언가를 빠뜨린 것이다.
 *
 * 검사 방법:
 *   ① 시드마다 봇을 굴려 목표 웨이브의 준비 시간(저장 지점)에 세운다.
 *   ② 그 자리의 지문(GameState + 엔진 내부 카운터)을 뜬다.
 *   ③ 같은 지점에서 저장본을 뜨고, JSON 문자열까지 왕복시킨 뒤 복원한다.
 *      복원 직후의 지문이 ②와 같아야 한다.
 *   ④ 두 엔진에 같은 조작을 4,000틱(약 400초, 웨이브 10여 개) 더 먹인다.
 *      마지막 지문이 서로 같아야 한다.
 *
 * `runAutoplay` 를 그대로 쓰지 않는 이유: 그 함수는 판을 끝까지 돌리고 결과만
 * 돌려주므로 중간에서 멈춰 저장할 수가 없다. 아래 `decide()` 는 그 정책에서
 * 이 검사에 필요한 만큼만 추린 것이다(3합 승급·진 해금·소환·조기 출전).
 *
 * 실행: npm run verify:run-save [-- --seeds=A,B --waves=3,12]
 */
import { BOARD_FORMATIONS } from "../src/core/content";
import { summonCost } from "../src/core/engine-tuning";
import { GameEngine } from "../src/core/game";
import { captureRunSave, parseRunSave, restoreRun } from "../src/core/run-save";
import type { Wuxing } from "../src/core/types";

const ELEMENTS: readonly Wuxing[] = ["木", "火", "土", "金", "水"];

const DEFAULT_SEEDS = ["VRS-1", "VRS-2", "VRS-3", "VRS-4", "VRS-5", "VRS-6"];

const DEFAULT_WAVES = [3, 12, 25];

/** 저장 뒤 두 판에 똑같이 먹이는 틱 수. 0.1초 틱이라 400초 남짓이다. */
const CONTINUE_TICKS = 4_000;

function readList(flag: string, fallback: readonly string[]): string[] {
  const raw = process.argv.find((argument) => argument.startsWith(`--${flag}=`))?.split("=")[1];
  if (raw === undefined || raw === "") return [...fallback];
  return raw.split(",").map((token) => token.trim()).filter((token) => token.length > 0);
}

function ended(engine: GameEngine): boolean {
  return engine.state.phase === "victory" || engine.state.phase === "defeat";
}

function fresh(seed: string): GameEngine {
  const engine = new GameEngine(seed, "KR", "casual");
  engine.begin();
  // 시뮬 하네스와 같은 설정. 계보 소환이라야 봇이 웨이브를 실제로 클리어해
  // 준비 시간에 닿는다 — 저장 지점이 생기는 조건이다.
  engine.setAutomationMode("semi");
  engine.setSummonIntent("lineage");
  return engine;
}

/** 한 틱 전진. 웨이브 경계는 이 직후에 잡아야 조작이 끼어들지 않는다. */
function advance(engine: GameEngine): void {
  engine.update(0.1);
  engine.consumeEvents();
}

function decide(engine: GameEngine): void {
  if (engine.state.summonCount === 0) {
    engine.summon();
    return;
  }
  for (const wuxing of ELEMENTS) {
    if (engine.casualAutoFusionPlan(wuxing).length > 0) engine.autoFuseCasualElement(wuxing, true);
  }
  const formationCost = engine.nextFormationUnlockCost();
  if (formationCost !== null
    && engine.state.towers.length >= engine.deployedTowerCapacity() - 2
    && engine.state.gold >= formationCost + 40) {
    const locked = BOARD_FORMATIONS.map((_, index) => index).find((index) => !engine.isFormationUnlocked(index));
    if (locked !== undefined) engine.unlockFormation(locked);
  }
  let attempts = 0;
  while (engine.state.towers.length < engine.deployedTowerCapacity()
    && engine.state.gold >= summonCost(engine.state.summonCount)
    && attempts < 12) {
    engine.summon();
    attempts += 1;
  }
  // 첫 웨이브만은 자령 5기를 채우고 나선다 — 한 기로 나가면 적을 다 잡지 못해
  // 잔존 합류로 웨이브가 끝없이 겹치고 준비 시간이 영영 오지 않는다.
  if (engine.state.phase === "prep" && (engine.state.wave > 0 || engine.state.towers.length >= 5)) {
    engine.startWaveEarly();
  }
}

/** 목표 웨이브를 넘긴 준비 시간까지 굴린다. 그 전에 판이 끝나면 false. */
function runToBoundary(engine: GameEngine, targetWave: number): boolean {
  for (let guard = 0; guard < 200_000; guard += 1) {
    advance(engine);
    if (ended(engine)) return false;
    if (engine.state.phase === "prep" && engine.state.wave >= targetWave) return true;
    decide(engine);
  }
  return false;
}

function runFor(engine: GameEngine, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) {
    if (ended(engine)) return;
    advance(engine);
    if (ended(engine)) return;
    decide(engine);
  }
}

/** 판의 지문 — 상태 전부 + 엔진 내부 카운터(난수기 포함). */
function fingerprint(engine: GameEngine): string {
  return JSON.stringify({ state: engine.state, runtime: engine.captureRuntime() });
}

/** 두 지문이 어디서 갈라졌는지 한 줄씩 짚는다. */
function reportDrift(label: string, left: string, right: string): void {
  const leftValue = JSON.parse(left) as { state: Record<string, unknown>; runtime: unknown };
  const rightValue = JSON.parse(right) as { state: Record<string, unknown>; runtime: unknown };
  for (const key of Object.keys(leftValue.state)) {
    if (JSON.stringify(leftValue.state[key]) !== JSON.stringify(rightValue.state[key])) {
      console.log(`     ${label} state.${key}`);
    }
  }
  if (JSON.stringify(leftValue.runtime) !== JSON.stringify(rightValue.runtime)) {
    console.log(`     ${label} runtime ${JSON.stringify(leftValue.runtime)} vs ${JSON.stringify(rightValue.runtime)}`);
  }
}

const seeds = readList("seeds", DEFAULT_SEEDS);

const waves = readList("waves", DEFAULT_WAVES.map(String)).map(Number);

for (const wave of waves) {
  if (!Number.isInteger(wave) || wave < 1) throw new Error(`--waves 는 1 이상의 정수여야 합니다 (받은 값: ${wave})`);
}

let failures = 0;

let checked = 0;

let peakBytes = 0;

for (const seed of seeds) {
  for (const targetWave of waves) {
    // ① 저장 없이 쭉 — 기준선.
    const straight = fresh(seed);
    if (!runToBoundary(straight, targetWave)) {
      console.log(`${seed}@w${targetWave}: 건너뜀 — 그 웨이브에 닿기 전에 판이 끝났다 (w${straight.state.wave} ${straight.state.phase})`);
      continue;
    }
    const atBoundary = fingerprint(straight);
    runFor(straight, CONTINUE_TICKS);
    const straightEnd = fingerprint(straight);

    // ② 같은 경계에서 저장 → 문자열 왕복 → 복원 → 이어 돌린다.
    const source = fresh(seed);
    runToBoundary(source, targetWave);
    const save = captureRunSave(source, { talismanFreeSummonTokens: 0 }, 1_700_000_000_000);
    if (!save) {
      console.log(`${seed}@w${targetWave}: 실패 — 저장본을 뜨지 못했다`);
      failures += 1;
      continue;
    }
    checked += 1;
    const bytes = new TextEncoder().encode(JSON.stringify(save)).length;
    peakBytes = Math.max(peakBytes, bytes);

    const roundTripped = parseRunSave(JSON.stringify(save));
    if (!roundTripped) {
      console.log(`${seed}@w${targetWave}: 실패 — 왕복 파싱이 저장본을 되살리지 못했다`);
      failures += 1;
      continue;
    }
    const resumed = restoreRun(roundTripped);
    resumed.consumeEvents();

    const boundaryMatch = fingerprint(resumed) === atBoundary;
    if (!boundaryMatch) reportDrift("복원 직후 갈림:", atBoundary, fingerprint(resumed));

    runFor(resumed, CONTINUE_TICKS);
    const resumedEnd = fingerprint(resumed);
    const endMatch = resumedEnd === straightEnd;
    if (!endMatch) reportDrift(`${CONTINUE_TICKS}틱 뒤 갈림:`, straightEnd, resumedEnd);

    if (!boundaryMatch || !endMatch) failures += 1;
    console.log(
      `${seed}@w${targetWave}: 복원직후=${boundaryMatch ? "일치" : "갈림"} 이어돌린뒤=${endMatch ? "일치" : "갈림"}`
      + ` · 저장 ${bytes}B (w${save.state.wave} 자령 ${save.state.towers.length}기 보관 ${save.state.inventoryTowers.length}기)`
      + ` · 최종 w${straight.state.wave}/${resumed.state.wave}`
    );
  }
}

console.log(`\n검증한 경계 ${checked}건 · 최대 저장 크기 ${peakBytes}B (${(peakBytes / 1024).toFixed(1)}KB)`);

if (failures > 0) {
  console.error(`결정성 게이트 실패 ${failures}건`);
  process.exit(1);
}

console.log("결정성 게이트 통과 — 이어 돌린 판이 쭉 돌린 판과 같다.");
