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
import type { LearningInfo } from "../core/learning";
import { NOTATION_LABELS, SUBSTITUTE_KIND_LABELS } from "../core/notation";
import type { NotationCode } from "../core/types";
import { escapeHtml } from "./format";

/** 배지 곁말 — 캔버스·aria-label 처럼 마크업을 못 쓰는 자리가 함께 쓴다. */
export function notationBadgeText(info: LearningInfo): string {
  if (info.provenance === "derived") {
    return info.derivedFrom ? `정자 기준 ${info.derivedFrom}` : "정자 기준";
  }
  if (info.provenance === "substitute") {
    const kind = info.substituteKind ? SUBSTITUTE_KIND_LABELS[info.substituteKind] : "";
    return kind ? `대체 표기 · ${kind}` : "대체 표기";
  }
  return "";
}

/** 배지가 왜 붙었는지 한 문장 — title·aria-label 이 함께 쓴다. */
export function notationBadgeTitle(info: LearningInfo, notation: NotationCode): string {
  const notationName = NOTATION_LABELS[notation].name;
  if (info.provenance === "derived") {
    return info.derivedFrom
      ? `${notationName} 사전에 이 자형이 없어 정자 ${info.derivedFrom} 의 읽기를 씁니다`
      : `${notationName} 사전에 이 자형이 없어 정자의 읽기를 씁니다`;
  }
  if (info.provenance === "substitute") {
    const kind = info.substituteKind ? SUBSTITUTE_KIND_LABELS[info.substituteKind] : "타 문자권";
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
export function notationBadgeHtml(info: LearningInfo, notation: NotationCode): string {
  if (info.provenance === "authentic") return "";
  const title = escapeHtml(notationBadgeTitle(info, notation));
  if (info.provenance === "derived") {
    const origin = info.derivedFrom
      ? `<b class="notation-mark-glyph">${escapeHtml(info.derivedFrom)}</b>`
      : "";
    return `<span class="notation-mark notation-mark--derived" title="${title}" aria-label="${title}">정자 기준${origin}</span>`;
  }
  const kind = info.substituteKind ? SUBSTITUTE_KIND_LABELS[info.substituteKind] : "";
  const kindHtml = kind ? `<i class="notation-mark-kind">${escapeHtml(kind)}</i>` : "";
  return `<span class="notation-mark notation-mark--substitute" title="${title}" aria-label="${title}">대체 표기${kindHtml}</span>`;
}

/**
 * 원천 뜻 — 대체 표기일 때만, 그리고 넉넉한 자리(도감 상세·성어 상세)에서만.
 *
 * sourceMeaningLanguage="en" 이면 번역하지 않은 영어 원문이라 이탤릭 + lang
 * 로 훈음과 확실히 갈라 놓는다. 훈음 자리에 영어가 그냥 놓이면 오인한다.
 */
export function notationGlossHtml(info: LearningInfo): string {
  if (info.provenance !== "substitute" || !info.sourceMeaning) return "";
  const english = info.sourceMeaningLanguage === "en";
  const inherited = info.sourceMeaningDerivedFrom
    ? `<small class="notation-gloss-origin">${escapeHtml(info.sourceMeaningDerivedFrom)} 승계</small>`
    : "";
  const gloss = escapeHtml(info.sourceMeaning);
  const body = english
    ? `<i class="notation-gloss-text" lang="en">${gloss}</i>`
    : `<span class="notation-gloss-text">${gloss}</span>`;
  const caption = english ? "원천 뜻(영어 원문)" : "원천 뜻";
  return `<span class="notation-gloss"><small class="notation-gloss-caption">${caption}</small>${body}${inherited}</span>`;
}

/**
 * 짧은 읽기 + 배지 — 카드·목록처럼 좁은 자리의 표준 조판.
 * 값 이스케이프까지 여기서 끝내므로 호출부는 그대로 끼워 넣으면 된다.
 */
export function notationShortHtml(info: LearningInfo, notation: NotationCode): string {
  return `${escapeHtml(info.short)}${notationBadgeHtml(info, notation)}`;
}

/** 긴 읽기 + 배지 + 원천 뜻 — 도감 상세처럼 넉넉한 자리의 표준 조판. */
export function notationReadingHtml(info: LearningInfo, notation: NotationCode): string {
  return `${escapeHtml(info.reading)}${notationBadgeHtml(info, notation)}${notationGlossHtml(info)}`;
}
