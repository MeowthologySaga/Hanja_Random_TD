/*
 * 부적 글자를 이 판에 묶는다 — 가중 추첨과 재회 명단 (v042).
 *
 * 여태 부적 글자는 지역 활성 풀(KR 1,000자)에서 **균등 추첨**이었다. 필터는 「직전
 * 글자 아님」 하나뿐이라, 실측하면 그 글자가
 *  · 지금 전장에 서 있을 확률 8%
 *  · 이 판에서 한 번이라도 만난 글자일 확률 18%(표준)·26%(캐주얼)
 * 였다. 100웨이브를 다 써도 서로 다른 글자 95자 — 거의 전부 「처음 보는 글자를 한 번
 * 베끼고 끝」이다. 학습으로 치면 노출만 있고 재회가 없다.
 *
 * 그래서 지분을 셋으로 나눈다.
 *  · 60% **이 판에 닿은 글자** — 전장·가방의 자령, 이번 웨이브의 야생 글자, 쫓는
 *    성어의 부족 글자, 이 판에서 발견한 글자.
 *  · 25% **재회 명단** — 못 넘긴 글자를 나중에 다시 만난다.
 *  · 15% 현행 균등 — 새 글자를 만나는 길도 남긴다.
 *
 * 바구니를 **우선순위가 아니라 가중 합집합**으로 둔 까닭은 실측이다. 엄격한 순위로
 * 읽으면 60%가 전부 전장으로 가서 100장에 서로 다른 글자가 71.9자까지 좁아진다.
 * 가중 합집합이면 76.6자로 넓이를 되찾으면서 적중률은 그대로다.
 *
 * 이 모듈은 화면도 엔진도 들이지 않는다(talisman-lines·talisman-score 와 같은 갈래).
 * 부적 계열은 시뮬 게이트가 못 보는 자리라(봇이 부적을 한 장도 안 쓴다) 설계와
 * 시험으로 지켜야 하고, 순수 함수라야 그 시험이 선다.
 */

export type PickSource = "board" | "wave" | "idiom" | "discovered" | "revisit" | "pool";

export interface RevisitEntry {
  readonly fails: number;
  readonly lastWave: number;
}

export type RevisitList = ReadonlyMap<string, RevisitEntry>;

export interface PickSources {
  /** 전장과 가방에 선 자령의 글자. */
  readonly board: readonly string[];
  /** 이번 웨이브가 데려온 야생 글자 — 없으면 빈 문자열. */
  readonly waveChar: string;
  /** 쫓는 성어에서 아직 없는 글자. */
  readonly idiomMissing: readonly string[];
  /** 이 판에서 한 번이라도 만난 글자. */
  readonly discovered: readonly string[];
}

/** 바구니 안의 가중 — 손이 닿아 있는 것일수록 무겁다. */
const SOURCE_WEIGHT: Readonly<Record<Exclude<PickSource, "pool" | "revisit">, number>> = Object.freeze({
  board: 6,
  wave: 6,
  idiom: 4,
  discovered: 1
});

/** 「이 판에 닿은 글자」 지분. */
const BOUND_SHARE = 0.6;

/** 재회 지분 — 이 위는 균등이다. */
const REVISIT_SHARE = 0.25;

/**
 * 재회 명단에서 다음 글자 — 가장 오래 못 만난 것부터. 난수를 안 쓴다.
 *
 * 방금 적힌 글자(같은 웨이브)는 건너뛴다. 그 자리에서 되돌려주면 「다시 만난다」가
 * 아니라 「같은 글자를 두 번 준다」다.
 */
export function pickRevisit(list: RevisitList, wave: number): string | null {
  let best: { char: string; entry: RevisitEntry } | null = null;
  for (const [char, entry] of list) {
    if (entry.lastWave >= wave) continue;
    if (best === null) {
      best = { char, entry };
      continue;
    }
    if (entry.lastWave < best.entry.lastWave) {
      best = { char, entry };
      continue;
    }
    if (entry.lastWave > best.entry.lastWave) continue;
    if (entry.fails > best.entry.fails) {
      best = { char, entry };
      continue;
    }
    // 동률이면 코드포인트 순 — 시험이 흔들리지 않게.
    if (entry.fails === best.entry.fails && char < best.char) best = { char, entry };
  }
  return best?.char ?? null;
}

interface Candidate {
  readonly char: string;
  readonly source: PickSource;
  readonly weight: number;
}

function buildBasket(sources: PickSources): Candidate[] {
  const best = new Map<string, Candidate>();
  const add = (char: string, source: Exclude<PickSource, "pool" | "revisit">): void => {
    if (!char) return;
    const weight = SOURCE_WEIGHT[source];
    const prior = best.get(char);
    // 한 글자가 여러 출처에 걸리면 가장 무거운 것을 쓰고, 그 출처를 꼬리표로 삼는다.
    if (prior && prior.weight >= weight) return;
    best.set(char, { char, source, weight });
  };
  for (const char of sources.board) add(char, "board");
  add(sources.waveChar, "wave");
  for (const char of sources.idiomMissing) add(char, "idiom");
  for (const char of sources.discovered) add(char, "discovered");
  return [...best.values()];
}

function drawWeighted(candidates: readonly Candidate[], random: () => number): Candidate | null {
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) return null;
  let roll = random() * total;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate;
  }
  return candidates[candidates.length - 1] ?? null;
}

/**
 * 이 판에 묶인 가중 추첨.
 *
 * `allowed` 는 획순 자료가 있는 글자만 남기는 재필터다 — **가중 뒤에** 건다.
 * 앞에 걸면 자료 없는 글자(명단의 1.4%) 때문에 바구니가 통째로 흔들린다.
 * `exclude` 는 직전 글자다. 후보가 그것 하나뿐이면 그 하나를 돌려준다.
 */
export function pickWeighted(
  sources: PickSources,
  revisit: RevisitList,
  wave: number,
  pool: readonly string[],
  allowed: (char: string) => boolean,
  exclude: string,
  random: () => number
): { char: string; source: PickSource } | null {
  if (pool.length === 0) return null;
  const poolSet = new Set(pool);
  const usable = (char: string): boolean => poolSet.has(char) && allowed(char) && char !== exclude;

  const basket = buildBasket(sources).filter((candidate) => usable(candidate.char));
  const revisitChar = ((): string | null => {
    const picked = pickRevisit(revisit, wave);
    return picked !== null && usable(picked) ? picked : null;
  })();

  const roll = random();
  if (roll < BOUND_SHARE && basket.length > 0) {
    const picked = drawWeighted(basket, random);
    if (picked) return { char: picked.char, source: picked.source };
  }
  if (roll < BOUND_SHARE + REVISIT_SHARE && revisitChar !== null) {
    return { char: revisitChar, source: "revisit" };
  }
  /*
   * 내려앉기. 재회가 비면 **바구니로** 돌아간다(균등이 아니라) — 실패 기록이 없는
   * 판에서도 「이 판에 닿은 글자」 지분이 60% 아래로 새지 않게 한다.
   */
  if (roll < BOUND_SHARE + REVISIT_SHARE && basket.length > 0) {
    const picked = drawWeighted(basket, random);
    if (picked) return { char: picked.char, source: picked.source };
  }
  const open = pool.filter(usable);
  if (open.length === 0) {
    // 풀이 하나뿐이고 그것이 직전 글자면 그 하나를 다시 준다 — 빈손으로 돌아가지 않는다.
    const fallback = pool.find((char) => allowed(char)) ?? pool[0];
    return fallback ? { char: fallback, source: "pool" } : null;
  }
  const index = Math.min(open.length - 1, Math.floor(random() * open.length));
  return { char: open[index] as string, source: "pool" };
}
