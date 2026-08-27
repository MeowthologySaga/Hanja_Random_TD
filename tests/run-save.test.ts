import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/core/game";
import {
  captureRunSave,
  clearRunSave,
  loadRunSave,
  parseRunSave,
  restoreRun,
  RUN_SAVE_STORAGE_KEY,
  RUN_SAVE_VERSION,
  runSaveSummary,
  writeRunSave
} from "../src/core/run-save";
import { SeededRng } from "../src/core/rng";

/** localStorage 대역. 테스트는 브라우저 없이 돈다. */
function fakeStorage(seed: Record<string, string> = {}): Storage & { failWrites?: boolean } {
  const map = new Map(Object.entries(seed));
  const storage = {
    failWrites: false,
    get length(): number {
      return map.size;
    },
    clear: (): void => map.clear(),
    key: (index: number): string | null => [...map.keys()][index] ?? null,
    getItem: (key: string): string | null => map.get(key) ?? null,
    setItem(key: string, value: string): void {
      if (storage.failWrites) throw new DOMException("QuotaExceededError");
      map.set(key, value);
    },
    removeItem: (key: string): void => {
      map.delete(key);
    }
  };
  return storage as unknown as Storage & { failWrites?: boolean };
}

const UI = { talismanFreeSummonTokens: 0 };

const ended = (engine: GameEngine): boolean => engine.state.phase === "victory" || engine.state.phase === "defeat";

const ELEMENTS = ["木", "火", "土", "金", "水"] as const;

/**
 * 한 틱의 조작. 3합 승급·진 해금·소환까지 해야 웨이브를 실제로 "클리어"한다 —
 * 소환만 하는 봇은 적을 다 잡지 못해 잔존 합류로 웨이브가 겹치고, 준비 시간에
 * 닿지 못한 채 보스 제한시간에 진다(저장 지점이 영영 오지 않는다).
 */
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
    const locked = [0, 1, 2, 3, 4].find((index) => !engine.isFormationUnlocked(index));
    if (locked !== undefined) engine.unlockFormation(locked);
  }
  let attempts = 0;
  while (engine.state.towers.length < engine.deployedTowerCapacity() && attempts < 12 && engine.summon().ok) {
    attempts += 1;
  }
  // 첫 웨이브만은 자령 5기를 채우고 나선다 — 한 기로 나가면 적을 다 잡지 못해
  // 잔존 합류(20초)로 웨이브가 끝없이 겹치고 준비 시간이 영영 오지 않는다.
  if (engine.state.phase === "prep" && (engine.state.wave > 0 || engine.state.towers.length >= 5)) {
    engine.startWaveEarly();
  }
}

/**
 * 저장할 수 있는 지점(웨이브를 하나 이상 클리어한 준비 시간)까지 굴린다.
 *
 * 닿지 못하면 던진다 — 조용히 지나가면 아래 검사들이 아무것도 확인하지 않은 채
 * 초록으로 통과한다. 봇이 판을 못 넘기게 된 것도 붙잡아야 할 회귀다.
 */
function runToWaveBoundary(engine: GameEngine, targetWave = 2): void {
  for (let guard = 0; guard < 100_000; guard += 1) {
    engine.update(0.1);
    engine.consumeEvents();
    if (ended(engine)) break;
    if (engine.state.phase === "prep" && engine.state.wave >= targetWave) return;
    decide(engine);
  }
  throw new Error(`웨이브 ${targetWave} 경계에 닿지 못했다 (w${engine.state.wave} ${engine.state.phase})`);
}

function startedEngine(seed: string, options: { tutorial?: boolean; talismanMode?: boolean } = {}): GameEngine {
  const engine = new GameEngine(seed, "KR", "casual", options);
  engine.begin();
  // 시뮬 하네스(autoplay)와 같은 설정. 계보 소환이라야 봇이 웨이브를 실제로
  // 클리어해 준비 시간에 닿는다 — 저장 지점이 생기는 조건이다.
  engine.setAutomationMode("semi");
  engine.setSummonIntent("lineage");
  return engine;
}

describe("SeededRng.restore", () => {
  it("스냅샷 한 숫자로 같은 수열을 이어 낸다", () => {
    const source = new SeededRng("rng-continuity");
    for (let index = 0; index < 37; index += 1) source.next();
    const snapshot = source.snapshot();
    const expected = Array.from({ length: 16 }, () => source.next());

    const restored = new SeededRng("완전히 다른 시드");
    restored.restore(snapshot);
    expect(Array.from({ length: 16 }, () => restored.next())).toEqual(expected);
  });

  it("복원 뒤 snapshot() 은 넣은 값을 그대로 돌려준다", () => {
    const rng = new SeededRng("snapshot-identity");
    rng.restore(0xdeadbeef);
    expect(rng.snapshot()).toBe(0xdeadbeef);
  });
});

describe("captureRunSave", () => {
  it("웨이브를 넘긴 준비 시간에서 저장본을 뜬다", () => {
    const engine = startedEngine("save-capture");
    runToWaveBoundary(engine);
    const save = captureRunSave(engine, UI);
    expect(save).not.toBeNull();
    expect(save?.version).toBe(RUN_SAVE_VERSION);
    expect(save?.state.wave).toBe(engine.state.wave);
    expect(save?.runtime.rngState).toBe(engine.captureRuntime().rngState);
  });

  it("아직 한 웨이브도 넘기지 않은 판은 저장하지 않는다", () => {
    const engine = startedEngine("save-too-early");
    expect(engine.state.wave).toBe(0);
    expect(captureRunSave(engine, UI)).toBeNull();
  });

  it("수련장 런은 저장하지 않는다", () => {
    const engine = startedEngine("save-tutorial", { tutorial: true });
    runToWaveBoundary(engine);
    expect(engine.tutorial).toBe(true);
    expect(captureRunSave(engine, UI)).toBeNull();
  });

  it("저장본은 깊은 복사라 이후 진행을 따라 변하지 않는다", () => {
    const engine = startedEngine("save-detached");
    runToWaveBoundary(engine);
    const save = captureRunSave(engine, UI);
    expect(save).not.toBeNull();
    const goldAtSave = save?.state.gold;
    const towersAtSave = save?.state.towers.length;
    engine.state.gold += 9_999;
    engine.state.towers.pop();
    expect(save?.state.gold).toBe(goldAtSave);
    expect(save?.state.towers.length).toBe(towersAtSave);
  });
});

describe("저장·복원 왕복 동일성", () => {
  it("문자열 왕복 뒤 상태와 엔진 내부 카운터가 저장 시점과 똑같다", () => {
    const engine = startedEngine("save-roundtrip");
    runToWaveBoundary(engine, 3);
    const save = captureRunSave(engine, { talismanFreeSummonTokens: 4 });
    expect(save).not.toBeNull();
    if (!save) return;

    const parsed = parseRunSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    const restored = restoreRun(parsed);
    restored.consumeEvents();
    expect(restored.state).toEqual(engine.state);
    expect(restored.captureRuntime()).toEqual(engine.captureRuntime());
    expect(restored.getCurrentPlan()).toEqual(engine.getCurrentPlan());
    expect(parsed.ui.talismanFreeSummonTokens).toBe(4);
  });

  it("이어 돌린 판은 저장 없이 쭉 돌린 판과 같은 상태로 간다", () => {
    const seed = "save-continuity";
    const straight = startedEngine(seed);
    runToWaveBoundary(straight, 3);

    const save = captureRunSave(straight, UI);
    expect(save).not.toBeNull();
    if (!save) return;
    const resumed = restoreRun(save);
    resumed.consumeEvents();

    // 같은 조작을 두 엔진에 똑같이 먹인다. 결정성이 깨지면 여기서 갈라진다.
    for (let tick = 0; tick < 900; tick += 1) {
      for (const engine of [straight, resumed]) {
        if (ended(engine)) continue;
        engine.update(0.1);
        engine.consumeEvents();
        if (engine.state.phase === "prep") engine.startWaveEarly();
      }
    }
    expect(resumed.state).toEqual(straight.state);
    expect(resumed.captureRuntime()).toEqual(straight.captureRuntime());
  });

  it("부적 모드는 저장본을 따라와 적 체력 계수가 흔들리지 않는다", () => {
    const engine = startedEngine("save-talisman", { talismanMode: true });
    runToWaveBoundary(engine);
    const save = captureRunSave(engine, UI);
    expect(save?.talismanMode).toBe(true);
    if (!save) return;
    expect(restoreRun(save).talismanMode).toBe(true);
  });
});

describe("parseRunSave 무결성", () => {
  const validSave = (): string => {
    const engine = startedEngine("save-integrity");
    runToWaveBoundary(engine);
    const save = captureRunSave(engine, UI);
    return save ? JSON.stringify(save) : "";
  };

  it("판이 다르면 조용히 무시한다", () => {
    const raw = validSave();
    if (!raw) return;
    const bumped = { ...(JSON.parse(raw) as Record<string, unknown>), version: RUN_SAVE_VERSION + 1 };
    expect(parseRunSave(JSON.stringify(bumped))).toBeNull();
    const dropped = { ...(JSON.parse(raw) as Record<string, unknown>), version: undefined };
    expect(parseRunSave(JSON.stringify(dropped))).toBeNull();
  });

  it("잘리거나 JSON 이 아닌 값은 무시한다", () => {
    const raw = validSave();
    if (!raw) return;
    expect(parseRunSave(raw.slice(0, Math.floor(raw.length / 2)))).toBeNull();
    expect(parseRunSave("not json at all")).toBeNull();
    expect(parseRunSave("null")).toBeNull();
    expect(parseRunSave("[]")).toBeNull();
    expect(parseRunSave("")).toBeNull();
    expect(parseRunSave(null)).toBeNull();
  });

  it("필수 축이 빠지거나 값이 어긋나면 무시한다", () => {
    const raw = validSave();
    if (!raw) return;
    const base = JSON.parse(raw) as Record<string, unknown>;
    const broken: Array<Record<string, unknown>> = [
      { ...base, region: "XX" },
      { ...base, mode: "sandbox" },
      { ...base, notation: "kr" },
      { ...base, seed: "" },
      { ...base, talismanMode: "yes" },
      { ...base, savedAt: "어제" },
      { ...base, runtime: {} },
      { ...base, ui: {} },
      // 교전 중 저장은 이제 정상이다(잔존 합류로 연쇄되는 판을 담기 위함) —
      // 대신 판이 끝난 상태는 여전히 거른다.
      { ...base, state: { ...(base.state as Record<string, unknown>), phase: "defeat" } },
      { ...base, state: { ...(base.state as Record<string, unknown>), wave: 0 } },
      { ...base, state: { ...(base.state as Record<string, unknown>), towers: "여럿" } },
      // 시드만 바꿔치기한 파일 — 상태 안의 시드와 갈라진다.
      { ...base, seed: "손댄-시드" }
    ];
    for (const candidate of broken) expect(parseRunSave(JSON.stringify(candidate))).toBeNull();
    // 교전 중 지점은 받아야 한다 — 저장이 첫 웨이브에 멈추던 사고의 수정분.
    const inCombat = { ...base, state: { ...(base.state as Record<string, unknown>), phase: "combat" } };
    expect(parseRunSave(JSON.stringify(inCombat))).not.toBeNull();
    // 원본은 여전히 살아 있어야 한다 — 위 검사가 과하게 잡는 게 아님을 못박는다.
    expect(parseRunSave(raw)).not.toBeNull();
  });

  it("난수기 상태가 숫자가 아니면 무시한다", () => {
    const raw = validSave();
    if (!raw) return;
    const base = JSON.parse(raw) as Record<string, unknown>;
    const runtime = base.runtime as Record<string, unknown>;
    expect(parseRunSave(JSON.stringify({ ...base, runtime: { ...runtime, rngState: "0" } }))).toBeNull();
    expect(parseRunSave(JSON.stringify({ ...base, runtime: { ...runtime, nextTowerId: Number.NaN } }))).toBeNull();
  });
});

describe("저장소 어댑터", () => {
  it("쓰고·읽고·지운다", () => {
    const storage = fakeStorage();
    const engine = startedEngine("save-storage");
    runToWaveBoundary(engine);
    const save = captureRunSave(engine, UI);
    if (!save) return;
    expect(writeRunSave(save, storage)).toBe(true);
    expect(loadRunSave(storage)?.state.wave).toBe(save.state.wave);
    clearRunSave(storage);
    expect(loadRunSave(storage)).toBeNull();
  });

  it("용량이 막히면 false 를 돌려주고 슬롯을 비운다", () => {
    const storage = fakeStorage();
    const engine = startedEngine("save-quota");
    runToWaveBoundary(engine);
    const save = captureRunSave(engine, UI);
    if (!save) return;
    expect(writeRunSave(save, storage)).toBe(true);
    storage.failWrites = true;
    expect(writeRunSave(save, storage)).toBe(false);
    // 절반만 쓰인 슬롯이 다음 방문의 파손 저장본이 되지 않도록 비워 둔다.
    expect(storage.getItem(RUN_SAVE_STORAGE_KEY)).toBeNull();
  });

  it("남이 써 둔 쓰레기가 슬롯에 있어도 새 판으로 조용히 넘어간다", () => {
    const storage = fakeStorage({ [RUN_SAVE_STORAGE_KEY]: "{\"version\":1,\"state\":" });
    expect(loadRunSave(storage)).toBeNull();
  });
});

describe("runSaveSummary", () => {
  it("목패가 읽는 축을 그대로 돌려준다", () => {
    const engine = startedEngine("save-summary");
    runToWaveBoundary(engine);
    const save = captureRunSave(engine, UI, 1_700_000_000_000);
    if (!save) return;
    const summary = runSaveSummary(save);
    expect(summary).toEqual({
      seed: engine.state.seed,
      region: "KR",
      mode: "casual",
      wave: engine.state.wave,
      maxWaves: engine.state.maxWaves,
      elapsed: engine.state.elapsed,
      savedAt: 1_700_000_000_000
    });
  });
});
