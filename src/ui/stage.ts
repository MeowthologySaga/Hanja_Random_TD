/*
 * 고정 설계 해상도 무대 (R8).
 *
 * 이 게임은 처음부터 1280x720 설계였다. 전장 캔버스 880x720, 우측 명령
 * 패널 400px, S00 서재의 3D->DOM 앵커 투영(menu3d.ts)까지 모두 그 좌표계를
 * 가정한다. 그런데 셸이 뷰포트를 따라 늘어나면 px 로 고정된 글자·여백만
 * 그대로 남아 화면마다 다른 그림이 나온다.
 *
 * 그래서 앱 전체를 1280x720 짜리 무대(#stage)에 넣고 무대째로 균일
 * 확대·축소한다. 남는 자리는 레터박스 띠로 두어 "액자에 걸린 한 장면"이
 * 되게 한다. 결과적으로 어떤 창 크기에서도 모두가 같은 화면을 배율만
 * 다르게 본다.
 *
 * 배율은 --stage-scale 로 공개해 ui-skin.css 의 R8 절이 소비한다.
 * <dialog>.showModal() 은 top layer 로 올라가 조상 transform 을 무시하므로
 * 같은 변수로 각 dialog 를 따로 보정한다.
 */

/** 설계 해상도. 이 두 수는 전장·패널·S00 앵커가 공유하는 계약이다. */
export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

let scale = 1;
let applied = false;
let bound = false;

/** 현재 무대 배율(1 = 설계 해상도 그대로). */
export function stageScale(): number {
  return scale;
}

function measure(): number {
  const width = window.innerWidth || STAGE_WIDTH;
  const height = window.innerHeight || STAGE_HEIGHT;
  const raw = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  // 소수 넷째 자리에서 끊어 리사이즈마다 불필요한 재계산이 튀지 않게 한다.
  return Math.round(raw * 10000) / 10000;
}

function apply(): void {
  const next = measure();
  if (applied && next === scale) return;
  scale = next;
  applied = true;
  document.documentElement.style.setProperty("--stage-scale", String(scale));
  // 축소 배율에서는 합성 볼드 세리프·넓은 발광이 다운스케일에 뭉개진다.
  // CSS 가 media query 로는 배율을 읽을 수 없으므로 대역을 데이터로 공개한다.
  document.documentElement.dataset.stageScaleBand = scale < 0.85 ? "small" : "full";
}

/**
 * 무대를 켠다. 창 크기/방향이 바뀔 때마다 배율을 다시 잡는다.
 *
 * 캔버스 backing store 를 다시 잡는 fitShell() 보다 반드시 먼저 등록되어야
 * 한다. 그래야 리사이즈 한 번에 "배율 갱신 -> 실측 -> 재렌더" 순서가 된다.
 */
export function initStage(): void {
  apply();
  if (bound) return;
  bound = true;
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  window.visualViewport?.addEventListener("resize", apply);
}
