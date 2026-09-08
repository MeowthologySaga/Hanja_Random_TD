/*
 * 이 판이 만난 글자를 판이 끝날 때까지 기억한다 (v042).
 *
 * 실측이 이 모듈을 세웠다. 한 판은 웨이브마다 야생 글자를 하나씩 데려오고 그 글자가
 * 적의 몸에 찍혀 나온다 — 봇 10시드로 재면 판당 **99.2자**(서로 다른 **93.0자**)다.
 * v042 첫 바퀴가 웨이브 배너로 그 글자를 「恥 부끄럼 치」라고 읽어 주기까지 했고,
 * 이 바퀴는 소리로도 읽어 준다. 그런데 **판이 끝나면 그 99자가 통째로 증발했다.**
 *
 * 종료 화면의 `발견 한자`가 그 자리를 못 메운다. `discover()` 를 부르는 곳은
 * 소환·승급·캐주얼 합성·기원 소환 넷뿐이고 **웨이브는 한 번도 안 지난다.** 그리고
 * `state.waveChar` 는 이번 한 글자만 들고 있어 매 웨이브 덮어써진다 — 지나간 92자는
 * 그 자리에서 사라진다. 실측하면 **어느 칸에도 안 나오는 서로 다른 글자가 75.8자**다.
 *
 * 코어 상태에 두지 않는 까닭은 값이 **화면에서만 쓰이기 때문**이다(저장본을 넓히는
 * 것 자체는 안전하다 — v042 3차에서 확인했다). `startNextWave` 는 핫 패스라 화면
 * 전용 목록을 그 안에 얹을 이유가 없고, 잎으로 떼면 창 없는 vitest 가 지킬 수 있다.
 * **봇은 이벤트를 걷지도 화면을 만지지도 않으므로 시뮬 게이트가 이 자리를 못 본다** —
 * 부적 계열과 같은 갈래다.
 */

/** 이 판에서 만난 웨이브 글자 — 만난 순서대로, 처음 나온 웨이브를 함께 적는다. */
const metWaveChars = new Map<string, number>();

/** 새 판은 빈손으로 연다. */
export function resetRunTrace(): void {
  metWaveChars.clear();
}

/**
 * 웨이브가 데려온 글자를 적는다.
 *
 * 같은 글자가 다시 와도 **처음 만난 웨이브를 지키고 덮어쓰지 않는다** — 「언제 처음
 * 만났나」가 회상의 실마리이고, 마지막에 본 웨이브는 그 실마리를 지운다.
 */
export function noteWaveChar(char: string, wave: number): void {
  if (!char || !Number.isFinite(wave) || wave < 1) return;
  if (metWaveChars.has(char)) return;
  metWaveChars.set(char, wave);
}

export interface RunTrace {
  /** 서로 다른 글자 수. */
  readonly distinct: number;
  /** 만난 순서대로의 글자 — 화면이 뒤에서부터 잘라 쓴다. */
  readonly chars: readonly string[];
}

/** 저장본에 실을 꼴 — 글자와 처음 만난 웨이브. */
export interface RunTraceEntry {
  readonly char: string;
  readonly wave: number;
}

export function runTraceEntries(): readonly RunTraceEntry[] {
  return [...metWaveChars].map(([char, wave]) => ({ char, wave }));
}

/**
 * 저장본에서 되살린다 (v042, 반박이 잡은 구멍).
 *
 * 처음에는 새 판에서만 비우고 이어하기는 손대지 않았다. 그런데 이 맵은 모듈 전역이라
 * 부팅 직후 늘 비어 있고 저장본에는 지나간 글자가 한 자도 없어서, **이어한 판의 자취가
 * 「이어한 뒤 만난 글자」**가 됐다. 그 값을 화면은 「이번 판」이라고 불렀다 — 40웨이브에
 * 저장하고 이어서 100웨이브에 이긴 사람에게 「도달 웨이브 100 / 100」 바로 아래에서
 * 「이번 판에서 만난 글자 60자」라고 말하는 셈이다. 자동 저장 지점의 53.7%가 판
 * 중간이라 이건 예외가 아니라 기본값이었다.
 *
 * 같은 카드의 다른 칸은 전부 판 전체를 센다. 한 칸만 조용히 범위가 다르면 그 칸이
 * 거짓말을 한다.
 */
export function seedRunTrace(entries: readonly RunTraceEntry[]): void {
  metWaveChars.clear();
  for (const entry of entries) noteWaveChar(entry.char, entry.wave);
}

export function runTrace(): RunTrace {
  return { distinct: metWaveChars.size, chars: [...metWaveChars.keys()] };
}

/**
 * 종료 화면에 실을 글자 줄 — **끝에서부터** 고른다.
 *
 * 마지막에 만난 글자가 기억에 가장 얕게 남아 있어 되짚을 값이 크고, 판이 짧게 끝난
 * 사람에게는 어차피 전부다. 순서는 만난 순서 그대로 되돌린다 — 뒤집으면 「어디서
 * 멈췄나」를 읽는 방향이 화면과 반대가 된다.
 */
export function runTraceTail(limit: number): readonly string[] {
  const chars = [...metWaveChars.keys()];
  if (limit <= 0) return [];
  return chars.length <= limit ? chars : chars.slice(chars.length - limit);
}
