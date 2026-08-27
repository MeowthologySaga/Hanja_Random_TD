/*
 * 런 저장·이어하기 (트랙 V).
 *
 * ── 왜 상태 스냅샷인가
 *
 * 후보는 둘이었다. ⓐ `GameState` 직렬화, ⓑ 시드 + 행동 로그 재생. 시뮬 해시
 * 동일성이 이미 증명돼 있어 ⓑ 도 성립하지만, 이 엔진에서는 ⓐ 가 명백히 낫다.
 *
 * - 난수기 상태가 uint32 **하나**다(`SeededRng`). 그래서 "지금 이 순간"을
 *   완전히 고정하는 데 숫자 한 개면 된다 — ⓑ 의 유일한 장점(작은 크기)이
 *   ⓐ 에서도 거의 그대로 성립한다.
 * - `GameState` 는 함수도 Map 도 클래스 인스턴스도 없는 순수 데이터다.
 *   JSON 한 번으로 왕복한다.
 * - 실측 저장 크기는 웨이브 72·자령 80기·보관고 30기에서 40.5KB 다(압축 전).
 *   localStorage 5MB 한도의 1% 미만이라 압축도 IndexedDB 도 필요 없다.
 * - ⓑ 는 한 판이 45~50분이라 재생에 실측 수십 초가 들고, 무엇보다 밸런스
 *   수치를 한 줄만 고쳐도 과거 저장본이 다른 판으로 재생된다. 조용히 어긋나는
 *   실패라 가장 나쁘다.
 *
 * ── 무엇을 저장하지 않는가
 *
 * - 수련장(`tutorial`) 런: 각본이 걸음마다 상태를 손대는 연습 판이라 중간에
 *   끊어 이어 붙일 대상이 아니다. 애초에 저장하지 않는다.
 * - 표기 선택·화면 모드·오디오·차분한 화면 등 **설정**: 이미 저마다의 키로
 *   localStorage 에 있고 런보다 오래 산다. 저장본이 다시 담으면 두 벌이 생겨
 *   어긋난다. 다만 `notation` 은 런의 정체성이라 엔진 생성 인자로 함께 담는다.
 * - 부적 종이의 남은 장수·최근 보상 장부: 엔진이 바뀌면 장부가 스스로 지금
 *   웨이브에 맞춰 다시 서게 돼 있다(panels/talisman.ts). 잃는 것은 최대
 *   한 웨이브분 장수뿐이라 저장 형식을 넓히지 않는다. 반면 **무료 소환권**은
 *   플레이어가 실제로 벌어들인 자원이라 함께 담는다.
 * - 카메라·패널 갈피·게임 속도·일시정지: 한 자리에 앉아 있는 동안만 뜻이 있는
 *   화면 상태다.
 */
import { GameEngine } from "./game";
import type { EngineRuntimeSnapshot, GameMode, GameState, NotationCode, RegionCode } from "./types";

/** 저장 슬롯 키. 1슬롯 — 마지막 런 하나만 남는다. */
export const RUN_SAVE_STORAGE_KEY = "hanja-td:run-save-v1";

/**
 * 저장 형식 판. 상태의 뜻이 달라지는 변경(필드 제거·의미 변경·밸런스 축 이동)
 * 마다 올린다. 판이 다른 저장본은 되살리지 않고 조용히 버린다 — 억지로 읽어
 * 어긋난 판을 이어 주느니 새 판이 낫다.
 */
export const RUN_SAVE_VERSION = 1;

/** 이어하기 목패가 읽는 UI 층 자원 — 코어가 모르는 것들만. */
export interface RunSaveUiState {
  /** 부적 보상으로 얻은 기본 소환 무료권(ctx.talismanFreeSummonTokens). */
  talismanFreeSummonTokens: number;
  /** 남은 부적 장수와 그 기준 웨이브 — 없으면 옛 저장본이라 기본값으로 센다. */
  talismanCharges?: number;
  talismanChargeWave?: number;
}

export interface RunSave {
  version: number;
  /** 저장한 순간의 벽시계. 목패의 "언제" 표시에만 쓴다 — 판정에는 쓰지 않는다. */
  savedAt: number;
  seed: string;
  region: RegionCode;
  mode: GameMode;
  notation: NotationCode;
  talismanMode: boolean;
  state: GameState;
  runtime: EngineRuntimeSnapshot;
  ui: RunSaveUiState;
}

/** 이어하기 목패가 한 줄로 읽는 요약. */
export interface RunSaveSummary {
  seed: string;
  region: RegionCode;
  mode: GameMode;
  wave: number;
  maxWaves: number;
  elapsed: number;
  savedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const REGIONS: readonly RegionCode[] = ["KR", "JP", "CN"];

const MODES: readonly GameMode[] = ["standard", "casual"];

const NOTATIONS: readonly NotationCode[] = ["kr-hunum", "jp-onkun", "cn-pinyin"];

/**
 * 저장본이 이 판·이 모양인지 확인한다. 조금이라도 어긋나면 null 이다.
 *
 * 필드를 하나씩 따지지 않고 "이어하기가 실제로 만지는 축"만 검사한다. 전수
 * 검사는 형식이 자랄 때마다 같이 자라 결국 낡고, 어차피 `adoptRun()` 이 통째로
 * 얹기 때문에 여기서 걸러야 할 것은 **다른 판 · 잘린 파일 · 남의 키**뿐이다.
 */
export function parseRunSave(raw: string | null): RunSave | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== RUN_SAVE_VERSION) return null;
  const { state, runtime, ui } = parsed;
  if (!isRecord(state) || !isRecord(runtime) || !isRecord(ui)) return null;
  if (typeof parsed.seed !== "string" || parsed.seed.length === 0) return null;
  if (!REGIONS.includes(parsed.region as RegionCode)) return null;
  if (!MODES.includes(parsed.mode as GameMode)) return null;
  if (!NOTATIONS.includes(parsed.notation as NotationCode)) return null;
  if (typeof parsed.talismanMode !== "boolean") return null;
  if (typeof parsed.savedAt !== "number" || !Number.isFinite(parsed.savedAt)) return null;
  // 이어 돌릴 수 있는 판인가 — 웨이브가 하나는 지나 있어야 한다. 교전 중
  // 지점도 받는다(잔존 합류로 연쇄되는 판은 준비 단계로 돌아오지 않아,
  // 준비만 받으면 저장이 첫 웨이브에 멈춘다 — captureRunSave 주석 참조).
  if (state.phase !== "prep" && state.phase !== "combat") return null;
  if (typeof state.wave !== "number" || !Number.isInteger(state.wave) || state.wave < 1) return null;
  if (typeof state.maxWaves !== "number" || typeof state.gold !== "number") return null;
  if (typeof state.elapsed !== "number" || !Number.isFinite(state.elapsed)) return null;
  if (!Array.isArray(state.towers) || !Array.isArray(state.inventoryTowers)) return null;
  if (!Array.isArray(state.enemies) || !Array.isArray(state.abilityZones)) return null;
  if (!Array.isArray(state.discoveredChars) || !Array.isArray(state.unlockedFormations)) return null;
  for (const key of ["rngState", "nextTowerId", "nextEnemyId", "nextAbilityZoneId", "autoEvolutionCooldown"]) {
    const value = runtime[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
  }
  if (typeof ui.talismanFreeSummonTokens !== "number" || !Number.isFinite(ui.talismanFreeSummonTokens)) return null;
  // 부적 장부는 나중에 더한 축이라 옛 저장본에는 없다 — 있으면 수만 확인한다.
  for (const key of ["talismanCharges", "talismanChargeWave"]) {
    const value = ui[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) return null;
  }
  // 저장본의 시드·지역·진법과 상태 안의 값이 갈라져 있으면 손댄 파일이다.
  if (state.seed !== parsed.seed || state.region !== parsed.region || state.mode !== parsed.mode) return null;
  return parsed as unknown as RunSave;
}

/** 지금 이 엔진의 런을 저장본으로 뜬다. 저장할 수 없는 판이면 null. */
export function captureRunSave(engine: GameEngine, ui: RunSaveUiState, now = Date.now()): RunSave | null {
  const state = engine.state;
  // 수련장은 저장 대상이 아니다(맨 위 주석). 아직 시작하지 않았거나 끝난 판도 마찬가지.
  if (engine.tutorial) return null;
  // 준비 단계만 저장하던 규칙은 이 게임에서 치명적이었다 — 잔존 적이 다음
  // 웨이브로 합류하면(advanceWaveWithSurvivors) 판은 준비 단계로 돌아오지 않고
  // 웨이브만 계속 넘어간다. 그래서 잘 굴러가는 판일수록 저장이 초반 웨이브에
  // 멈춰, 이어하기가 "엽전·부적이 리셋된 판"처럼 보였다(사용자 제보).
  // 적은 상태 본체에 담긴 순수 자료라 교전 중 지점도 그대로 되살릴 수 있다.
  if (state.wave < 1) return null;
  if (state.phase !== "prep" && state.phase !== "combat") return null;
  return {
    version: RUN_SAVE_VERSION,
    savedAt: now,
    seed: state.seed,
    region: state.region,
    mode: state.mode,
    notation: state.notation,
    talismanMode: engine.talismanMode,
    // JSON 왕복으로 깊은 복사를 겸한다 — 저장 뒤에도 판은 계속 굴러가므로
    // 참조를 그대로 들고 있으면 저장본이 뒤늦게 따라 변한다.
    state: JSON.parse(JSON.stringify(state)) as GameState,
    runtime: engine.captureRuntime(),
    ui: {
      talismanFreeSummonTokens: ui.talismanFreeSummonTokens,
      ...(ui.talismanCharges === undefined ? {} : { talismanCharges: ui.talismanCharges }),
      ...(ui.talismanChargeWave === undefined ? {} : { talismanChargeWave: ui.talismanChargeWave })
    }
  };
}

/**
 * 저장본에서 엔진을 되살린다.
 *
 * 생성자에 시드·지역·진법·표기·부적 모드를 그대로 넘겨 도감·합성표·목표
 * 사다리까지 저장 당시와 같게 세운 뒤, `adoptRun()` 으로 상태와 내부 카운터를
 * 얹는다. `begin()` 은 부르지 않는다 — 그건 처음부터 다시 시작하는 문이다.
 */
export function restoreRun(save: RunSave): GameEngine {
  const engine = new GameEngine(save.seed, save.region, save.mode, {
    notation: save.notation,
    talismanMode: save.talismanMode
  });
  engine.adoptRun(save.state, save.runtime);
  return engine;
}

export function runSaveSummary(save: RunSave): RunSaveSummary {
  return {
    seed: save.seed,
    region: save.region,
    mode: save.mode,
    wave: save.state.wave,
    maxWaves: save.state.maxWaves,
    elapsed: save.state.elapsed,
    savedAt: save.savedAt
  };
}

type ReadableStorage = Pick<Storage, "getItem">;

type WritableStorage = Pick<Storage, "setItem">;

type ClearableStorage = Pick<Storage, "removeItem">;

/** 저장된 런을 읽는다. 없거나·판이 다르거나·파손이면 null(조용히 새 판으로). */
export function loadRunSave(storage: ReadableStorage = window.localStorage): RunSave | null {
  try {
    return parseRunSave(storage.getItem(RUN_SAVE_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * 저장본을 슬롯에 쓴다. 성공하면 true.
 *
 * 실패는 삼킨다 — 시크릿 창·용량 초과에서도 진행 중인 판은 멈추지 않아야 한다.
 * 다만 용량 초과로 절반만 쓰인 슬롯이 남으면 다음 방문에 파손 저장본이 되므로
 * 실패하면 슬롯을 비운다.
 */
export function writeRunSave(save: RunSave, storage: WritableStorage & ClearableStorage = window.localStorage): boolean {
  try {
    storage.setItem(RUN_SAVE_STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    try {
      storage.removeItem(RUN_SAVE_STORAGE_KEY);
    } catch {
      // 지우기까지 막힌 저장소면 더 할 일이 없다.
    }
    return false;
  }
}

export function clearRunSave(storage: ClearableStorage = window.localStorage): void {
  try {
    storage.removeItem(RUN_SAVE_STORAGE_KEY);
  } catch {
    // 로컬 저장이 막혀도 현재 런은 정상 진행됩니다.
  }
}
