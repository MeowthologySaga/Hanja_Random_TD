/*
 * 표기 정직 배지 — 읽기 값이 "그 글자의 그 언어권 읽기"가 아닐 때 그렇다고
 * 말하는 단 하나의 부품. (gripe #6, 트랙 Q)
 *
 * 통합 표기 테이블 v2 는 교차 조합의 빈칸을 0으로 메웠지만, 메운 방식이
 * 세 갈래다. 갈래를 감추면 사용자가 파생·대체값을 그 언어권의 정통 훈음으로
 * 오인한다 — 특히 대체값 일부는 원천 영어 뜻을 번역 없이 보존한 문자열이라
 * 한국 훈음으로 읽히면 그냥 틀린 학습이 된다. 그래서:
 *
 *   authentic  — 사전에 그 글자로 실린 읽기.        배지 없음.
 *   derived    — 원자형(정자)의 읽기를 물려받았다.   「정자 기준」 + 원자형.
 *   substitute — 다른 문자권 표기를 빌려 왔다.       「대체 표기」 + 근거 종류.
 *
 * 배지가 나오는 자리(선택 카드·소환 공개·도감·가방·성어 읽기 …)는 전부 이
 * 파일의 함수를 거친다. 규칙이 갈라지지 않도록 갈래마다 함수를 두지 않고
 * LearningInfo 하나를 받아 판정을 스스로 읽는다.
 *
 * 스타일은 src/styles/490-notation.css.
 */
import { NOTATION_LABELS, SUBSTITUTE_KIND_LABELS } from "../core/notation";
import type { ReadingProvenance, SubstituteKind } from "../core/notation";
import type { NotationCode } from "../core/types";
// format.ts 가 아니라 잎 모듈에서 받는다 — 이 파일은 DOM 없이도 서야 한다.
import { escapeHtml } from "./escape";

/**
 * 배지가 읽는 최소 모양. LearningInfo(글자 하나)가 구조적으로 이걸 만족하고,
 * 성어처럼 글자 여럿을 합친 읽기는 합산 판정으로 직접 만들어 넘긴다.
 */
export interface NotationMarked {
  provenance: ReadingProvenance;
  derivedFrom?: string;
  substituteKind?: SubstituteKind;
  sourceMeaning?: string;
  sourceMeaningLanguage?: string;
  sourceMeaningDerivedFrom?: string;
}

/** 읽기 문자열까지 함께 가진 모양 — 짧은/긴 조판 함수가 받는다. */
export interface NotationMarkedReading extends NotationMarked {
  short: string;
  reading: string;
}

/** 배지 곁말 — 캔버스·aria-label 처럼 마크업을 못 쓰는 자리가 함께 쓴다. */
export function notationBadgeText(info: NotationMarked): string {
  if (info.provenance === "derived") {
    return info.derivedFrom ? `정자 기준 ${info.derivedFrom}` : "정자 기준";
  }
  if (info.provenance === "substitute") {
    const kind = info.substituteKind ? SUBSTITUTE_KIND_LABELS[info.substituteKind] : "";
    return kind ? `대체 표기 · ${kind}` : "대체 표기";
  }
  return "";
}

/**
 * 배지가 왜 붙었는지 한 문장 — title·aria-label 이 함께 쓴다.
 *
 * scope="idiom" 은 네 글자를 이어 붙인 성어 읽기라 "이 글자"라고 말하면
 * 어느 글자인지 알 수 없다 — 문장을 구(句) 층위로 바꾼다.
 */
export function notationBadgeTitle(
  info: NotationMarked,
  notation: NotationCode,
  scope: "char" | "idiom" = "char"
): string {
  const notationName = NOTATION_LABELS[notation].name;
  const idiom = scope === "idiom";
  if (info.provenance === "derived") {
    if (idiom) return `${notationName} 사전에 없는 자형이 섞여 있어 그 글자는 정자의 읽기를 씁니다`;
    return info.derivedFrom
      ? `${notationName} 사전에 이 자형이 없어 정자 ${info.derivedFrom} 의 읽기를 씁니다`
      : `${notationName} 사전에 이 자형이 없어 정자의 읽기를 씁니다`;
  }
  if (info.provenance === "substitute") {
    const kind = info.substituteKind ? SUBSTITUTE_KIND_LABELS[info.substituteKind] : "타 문자권";
    if (idiom) return `${notationName}에 읽기가 없는 글자가 섞여 있어 그 자리는 원천 표기를 그대로 씁니다`;
    const gloss = info.sourceMeaningLanguage === "en"
      ? " 뜻은 원천 영어 그대로라 훈음이 아닙니다."
      : "";
    return `${kind}라 ${notationName}에 읽기가 없습니다 — 원천 표기를 그대로 보여 줍니다.${gloss}`;
  }
  return "";
}

/**
 * 읽기 값 옆에 붙는 배지 마크업. authentic 이면 빈 문자열이라 기존 화면에
 * 아무것도 더하지 않는다(자국 표기 3조합은 전부 authentic).
 */
export function notationBadgeHtml(
  info: NotationMarked,
  notation: NotationCode,
  scope: "char" | "idiom" = "char",
  compact = false
): string {
  if (info.provenance === "authentic") return "";
  const title = escapeHtml(notationBadgeTitle(info, notation, scope));
  // 안쪽 조각까지 전부 span 이다 — b·i·em 은 호스트 화면의 테마 규칙(오행 원
  // 배지·제목 먹색 …)이 !important 로 집어가 배지가 통째로 다른 것이 된다.
  //
  // compact 는 좁은 자리(카드 한 줄)에서 배지가 읽기 자체를 말줄임으로 밀어낼
  // 때 쓴다. 글자 수만 줄이고 title·aria 는 전문을 그대로 들고 있으므로
  // 마우스·보조기술 쪽에서는 잃는 것이 없다.
  if (info.provenance === "derived") {
    const origin = info.derivedFrom
      ? `<span class="notation-mark-glyph">${escapeHtml(info.derivedFrom)}</span>`
      : "";
    const label = compact ? "정자" : "정자 기준";
    return `<span class="notation-mark notation-mark--derived" title="${title}" aria-label="${title}">${label}${origin}</span>`;
  }
  const kind = !compact && info.substituteKind ? SUBSTITUTE_KIND_LABELS[info.substituteKind] : "";
  const kindHtml = kind ? `<span class="notation-mark-kind">${escapeHtml(kind)}</span>` : "";
  const label = compact ? "대체" : "대체 표기";
  return `<span class="notation-mark notation-mark--substitute" title="${title}" aria-label="${title}">${label}${kindHtml}</span>`;
}

/**
 * 원천 뜻 — 대체 표기일 때만, 그리고 넉넉한 자리(도감 상세·성어 상세)에서만.
 *
 * sourceMeaningLanguage="en" 이면 번역하지 않은 영어 원문이라 이탤릭 + lang
 * 로 훈음과 확실히 갈라 놓는다. 훈음 자리에 영어가 그냥 놓이면 오인한다.
 */
export function notationGlossHtml(info: NotationMarked): string {
  if (info.provenance !== "substitute" || !info.sourceMeaning) return "";
  const english = info.sourceMeaningLanguage === "en";
  const inherited = info.sourceMeaningDerivedFrom
    ? `<span class="notation-gloss-origin">${escapeHtml(info.sourceMeaningDerivedFrom)} 승계</span>`
    : "";
  const gloss = escapeHtml(info.sourceMeaning);
  const body = english
    ? `<span class="notation-gloss-text notation-gloss-text--en" lang="en">${gloss}</span>`
    : `<span class="notation-gloss-text">${gloss}</span>`;
  const caption = english ? "원천 뜻(영어 원문)" : "원천 뜻";
  return `<span class="notation-gloss"><span class="notation-gloss-caption">${caption}</span>${body}${inherited}</span>`;
}

/**
 * 짧은 읽기 + 배지 — 카드·목록처럼 좁은 자리의 표준 조판.
 * 값 이스케이프까지 여기서 끝내므로 호출부는 그대로 끼워 넣으면 된다.
 *
 * 배지는 압축형이다. 좁은 칸에서 전문형을 쓰면 배지가 폭을 먹어 정작 읽기가
 * 말줄임으로 잘린다 — 배지 때문에 읽기를 못 읽으면 앞뒤가 바뀐 것이다.
 */
export function notationShortHtml(
  info: NotationMarkedReading,
  notation: NotationCode,
  scope: "char" | "idiom" = "char"
): string {
  return `${escapeHtml(info.short)}${notationBadgeHtml(info, notation, scope, true)}`;
}

/**
 * 짧은 읽기 + 전문형 배지 — 상세 화면의 큰 제목처럼 폭이 넉넉한 자리.
 * 값은 짧게, 배지는 전문으로. 카드와 상세가 같은 값을 다른 성량으로 말한다.
 */
export function notationHeadingHtml(
  info: NotationMarkedReading,
  notation: NotationCode,
  scope: "char" | "idiom" = "char"
): string {
  return `${escapeHtml(info.short)}${notationBadgeHtml(info, notation, scope)}`;
}

/** 긴 읽기 + 배지 + 원천 뜻 — 도감 상세처럼 넉넉한 자리의 표준 조판. */
export function notationReadingHtml(
  info: NotationMarkedReading,
  notation: NotationCode,
  scope: "char" | "idiom" = "char"
): string {
  return `${escapeHtml(info.reading)}${notationBadgeHtml(info, notation, scope)}${notationGlossHtml(info)}`;
}
