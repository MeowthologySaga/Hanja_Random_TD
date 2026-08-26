/*
 * HTML 이스케이프 — 잎 모듈.
 *
 * format.ts 안에 있었지만 그 파일은 app-context 를 통해 DOM(window·stage)을
 * 끌고 온다. 순수 문자열 부품(표기 배지 같은)이 마크업 하나 쓰려고 앱 셸
 * 전체를 부팅해야 했다. 이스케이프만 잎으로 떼어 두면 DOM 없는 곳에서도
 * 쓰고 테스트할 수 있다. format.ts 는 그대로 다시 내보내므로 호출부는
 * 하나도 바뀌지 않는다.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
