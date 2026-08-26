/*
 * 스크롤 접힘 신호 — 트랙 R(P-02·P-04·P-05·P-06).
 *
 * 감사 실측: 스크롤 면 6곳에서 스크롤바 폭이 0px 이라 "아래에 더 있다"를 알
 * 길이 없었다. 자령 탭 선택 카드는 능력 카드 4장과 [전체 설명] 버튼이 통째로,
 * 설정 다이얼로그는 효과음 음량 줄 전체가 접힘 아래 숨었다.
 *
 * 원인은 두 겹이다.
 *  1) 렌더러가 오버레이 스크롤바를 쓰면 `overflow:auto` 만으로는 자리(gutter)가
 *     0px 다 — 헤드리스 크롬 실측 0px, 헤드풀 10px. `scrollbar-gutter: stable`
 *     을 걸어야 두 환경 모두에서 폭이 확보된다(thin 10px · auto 15px).
 *  2) 전역 `* { scrollbar-color: ... }` 가 서 있으면 크로미엄은 그 요소의
 *     `::-webkit-scrollbar` 규칙을 통째로 무시한다. `.selected-card::-webkit-
 *     scrollbar{width:7px}` 가 아무 일도 못 하던 이유이며(실측: scrollbar-color
 *     를 auto 로 되돌리면 8px 로 되살아난다), 그래서 폭·색은 표준 속성으로만
 *     정한다. 자세한 규칙은 src/styles/560-track-r.css.
 *
 * 이 파일은 상태만 만든다 — 면마다 `data-scroll-more="1|0"` 과
 * `data-scrollable="1|0"` 을 찍고, 그림은 CSS 가 그린다(하단 페이드 + ▾).
 * 끝까지 내리면 0 이 되어 저절로 걷힌다.
 */

/**
 * 신호를 붙일 스크롤 면. 없거나 접혀 있으면(display:none) 조용히 건너뛴다 —
 * 패널·다이얼로그는 대부분 한 번에 하나만 서므로 매 프레임 6번 조회가 전부다.
 */
const SCROLL_SURFACES: readonly string[] = [
  "#shop-scroll",
  "#selected-card",
  "#evolution-options",
  "#idiom-scroll",
  "#growth-dismantle-list",
  "#settings-dialog"
];

/** 소수점 반올림·서브픽셀 때문에 1px 짜리 유령 접힘이 깜빡이지 않게 둔 여유. */
const REMAINING_EPSILON = 4;

/**
 * 스크롤바 자리(gutter)를 켜는 문턱. 켤 때만 높게 잡아 되먹임을 끊는다 —
 * 자리를 내주면 내용 폭이 10px 줄어 높이가 되레 늘 수 있으므로, 같은 문턱으로
 * 껐다 켰다 하면 한 프레임 걸러 깜빡인다. 끄는 문턱은 0(넘침 없음)이고,
 * 자리를 거두면 폭이 넓어져 높이는 줄기만 하므로 그 방향은 안전하다.
 */
const GUTTER_ON_THRESHOLD = 12;

function syncSurface(element: HTMLElement): void {
  // 접힌 패널은 clientHeight 0 이라 "전부 숨었다"로 오판된다 — 먼저 거른다.
  if (element.offsetParent === null && element.getClientRects().length === 0) {
    if (element.dataset.scrollMore !== undefined) delete element.dataset.scrollMore;
    if (element.dataset.scrollable !== undefined) delete element.dataset.scrollable;
    return;
  }
  const overflow = element.scrollHeight - element.clientHeight;
  const wasScrollable = element.dataset.scrollable === "1";
  const scrollable = wasScrollable ? overflow > 0 : overflow > GUTTER_ON_THRESHOLD;
  const scrollableFlag = scrollable ? "1" : "0";
  if (element.dataset.scrollable !== scrollableFlag) element.dataset.scrollable = scrollableFlag;
  const remaining = overflow - element.scrollTop;
  const more = remaining > REMAINING_EPSILON ? "1" : "0";
  if (element.dataset.scrollMore !== more) element.dataset.scrollMore = more;
}

/** 렌더 루프가 매 프레임 부른다 — 읽기만 하고 배치는 CSS 에 맡긴다. */
export function syncScrollAffordances(): void {
  for (const selector of SCROLL_SURFACES) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) syncSurface(element);
  }
}

/**
 * main.ts 가 원래 순서대로 부르는 배선 묶음. 면마다 공용 클래스를 한 번 붙여
 * CSS 처방 1벌이 셀렉터 나열 없이 걸리게 하고, 첫 판정도 즉시 돌린다.
 */
export function wireScrollAffordance1(): void {
  for (const selector of SCROLL_SURFACES) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.classList.add("scroll-surface");
  }
  syncScrollAffordances();
}
