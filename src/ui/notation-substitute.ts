/*
 * 표기 대체 배지 — 교차 조합(로스터 ≠ 표기 문자권) 준비 부품. (gripe #6)
 *
 * 선택한 표기가 어떤 글자를 커버하지 못하면(crossNotationReading → null)
 * 자국 표기로 대신 보여 주면서 "대체 표기"임을 이 배지로 알린다.
 *
 * 지금은 도달 불가 코드 경로다: NOTATION_AXIS_READY=false 라 표기 축이
 * 로스터 기본값에서 벗어날 수 없고, 통합 표기 테이블(요청서 v8)도 아직
 * 물리지 않아 폴백 자체가 일어나지 않는다. 테이블 도착 후 읽기 라벨
 * 렌더 경로(learningInfoForNotation 호출부)가 null 폴백을 받을 때 이
 * 마크업을 짧은 읽기 옆에 덧붙인다. 스타일은 src/styles/490-notation.css.
 */
import { NOTATION_LABELS } from "../core/notation";
import type { NotationCode } from "../core/types";
import { escapeHtml } from "./format";

/**
 * "선택한 표기 미수록 → 자국 표기로 대체 중" 배지 마크업.
 *
 * @param wanted 사용자가 고른(그러나 이 글자를 커버하지 못한) 표기.
 * @param substitute 실제로 대신 쓰인 표기(보통 로스터의 자국 표기).
 */
export function notationSubstituteHtml(wanted: NotationCode, substitute: NotationCode): string {
  const wantedName = NOTATION_LABELS[wanted].name;
  const substituteName = NOTATION_LABELS[substitute].name;
  const title = `${wantedName} 미수록 — ${substituteName}으로 대체 표기 중`;
  return `<span class="notation-substitute" role="img" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">대체</span>`;
}
