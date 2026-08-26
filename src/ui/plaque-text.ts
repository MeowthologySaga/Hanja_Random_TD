/**
 * 전장 명패 훈음 배치 계산 (layout-audit-response-v1 §2).
 *
 * 84x40 compact 명패의 오른쪽 51px 칸에 훈음을 최대 2줄로 넣는다. 캔버스가 없는
 * 환경에서도 규칙을 검증할 수 있도록 실측 함수(measure)를 주입받는 순수 모듈로 둔다.
 *
 * 규칙
 *  - fillText maxWidth 압축은 쓰지 않는다. 넘치면 줄을 나누거나 글자를 줄인다.
 *  - 공백 토큰 경계를 우선해 두 줄의 실측 폭이 가장 비슷해지는 지점에서 자른다.
 *  - 공백이 없으면 글자 경계에서 같은 방식으로 나눈다.
 *  - 9px 로 안 되면 8px 로 한 번만 줄이고, 그래도 넘치면 짧은 훈음만 남긴다.
 */

/** 지정한 글꼴 크기에서 문자열의 실측 폭(px)을 돌려준다. */
export type MeasureText = (value: string, fontSize: number) => number;

export interface BalancedLines {
  readonly lines: readonly string[];
  /** 두 줄 중 넓은 쪽의 실측 폭. */
  readonly width: number;
}

export interface CompactReading extends BalancedLines {
  readonly font: number;
  /** compact 에 전체 훈음을 담지 못해 줄여 적었는지 — 상세 팝오버로 안내한다. */
  readonly shortened: boolean;
}

/** compact 명패가 쓰는 글꼴 크기 후보. 8px 아래로는 내려가지 않는다. */
export const COMPACT_READING_FONTS: readonly number[] = [9, 8];

export function balancedTextLines(value: string, maxWidth: number, measure: MeasureText, fontSize: number): BalancedLines {
  const single = measure(value, fontSize);
  if (single <= maxWidth) return { lines: [value], width: single };

  const boundaries: number[] = [];
  for (let index = 1; index < value.length; index += 1) {
    const previous = value[index - 1] as string;
    const current = value[index] as string;
    if (/\s/u.test(previous) && !/\s/u.test(current)) boundaries.push(index);
  }
  if (boundaries.length === 0) {
    for (let index = 1; index < value.length; index += 1) boundaries.push(index);
  }

  let best: { lines: string[]; width: number; balance: number } | null = null;
  for (const boundary of boundaries) {
    const head = value.slice(0, boundary).trimEnd();
    const tail = value.slice(boundary).trimStart();
    if (!head || !tail) continue;
    const width = Math.max(measure(head, fontSize), measure(tail, fontSize));
    const balance = Math.abs(measure(head, fontSize) - measure(tail, fontSize));
    const fits = width <= maxWidth;
    const bestFits = best !== null && best.width <= maxWidth;
    if (best === null || (fits && !bestFits) || (fits === bestFits && (fits ? balance < best.balance : width < best.width))) {
      best = { lines: [head, tail], width, balance };
    }
  }
  return best ? { lines: best.lines, width: best.width } : { lines: [value], width: single };
}

/**
 * 괄호 보충 설명을 걷어낸 값 → `첫 토큰…마지막 토큰` 순으로 짧은 훈음 후보를 만든다.
 * 전체값을 통째로 버리지 않고, 담을 수 있는 가장 긴 후보부터 시도하기 위한 목록이다.
 */
export function compactReadingCandidates(full: string): string[] {
  const stripped = full.replace(/[（([][^）)\]]*[）)\]]/gu, " ").replace(/\s+/gu, " ").trim();
  const tokens = full.split(/\s+/u).filter(Boolean);
  const ellipsed = tokens.length >= 2 ? `${tokens[0] as string}…${tokens.at(-1) as string}` : "";
  const candidates = [full];
  if (stripped && !candidates.includes(stripped)) candidates.push(stripped);
  if (ellipsed && !candidates.includes(ellipsed)) candidates.push(ellipsed);
  return candidates;
}

export function compactReading(full: string, maxWidth: number, measure: MeasureText): CompactReading {
  for (const candidate of compactReadingCandidates(full)) {
    for (const font of COMPACT_READING_FONTS) {
      const fitted = balancedTextLines(candidate, maxWidth, measure, font);
      if (fitted.width <= maxWidth) {
        return { lines: fitted.lines, width: fitted.width, font, shortened: candidate !== full };
      }
    }
  }
  const last = compactReadingCandidates(full).at(-1) as string;
  const fitted = balancedTextLines(last, maxWidth, measure, 8);
  return { lines: fitted.lines, width: fitted.width, font: 8, shortened: true };
}
