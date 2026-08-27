/*
 * 컨테이너 안으로만 스크롤한다.
 *
 * `Element.scrollIntoView()` 는 **조상 스크롤 컨테이너를 전부** 움직인다.
 * 그리고 `overflow: hidden` 은 사람의 스크롤만 막을 뿐 프로그램 스크롤은
 * 그대로 먹는다 — 그래서 이 게임처럼 1280x720 무대를 transform 으로 키우는
 * 화면에서는, 프레임 안의 한 줄을 보이게 하려던 호출이 **무대 자체를 밀어
 * 올려** 상단 HUD 가 잘리는 사고로 번질 수 있다(사용자 제보 화면).
 *
 * 그래서 조상은 건드리지 않고, 지정한 컨테이너의 scrollTop 만 계산해 옮긴다.
 */
export function scrollIntoContainer(
  target: HTMLElement | null | undefined,
  container: HTMLElement | null | undefined,
  options: { block?: "start" | "center" | "nearest"; smooth?: boolean } = {}
): void {
  if (!target || !container) return;
  const block = options.block ?? "nearest";
  const targetRect = target.getBoundingClientRect();
  const boxRect = container.getBoundingClientRect();
  if (targetRect.height === 0 && targetRect.width === 0) return;
  const offset = targetRect.top - boxRect.top + container.scrollTop;
  let next = container.scrollTop;
  if (block === "start") {
    next = offset;
  } else if (block === "center") {
    next = offset - (container.clientHeight - targetRect.height) / 2;
  } else {
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (offset < viewTop) next = offset;
    else if (offset + targetRect.height > viewBottom) next = offset + targetRect.height - container.clientHeight;
  }
  const max = Math.max(0, container.scrollHeight - container.clientHeight);
  const clamped = Math.min(max, Math.max(0, Math.round(next)));
  if (clamped === container.scrollTop) return;
  container.scrollTo({ top: clamped, behavior: options.smooth ? "smooth" : "auto" });
}

/**
 * 무대·셸이 어떤 이유로든 밀렸으면 되돌린다.
 *
 * 위 규칙을 지켜도 브라우저 기본 동작(포커스 이동·앵커·IME 등)이 컨테이너를
 * 미는 경로가 남는다. 무대 계열은 스크롤될 이유가 아예 없으므로, 밀리는 즉시
 * 0 으로 되돌려 "화면이 통째로 어긋난" 상태가 유지되지 않게 한다.
 */
export function wireStageScrollGuard1(): void {
  const guarded = ["#stage", "#app", ".game-shell"];
  const reset = (element: Element): void => {
    if (element.scrollTop !== 0) element.scrollTop = 0;
    if (element.scrollLeft !== 0) element.scrollLeft = 0;
  };
  for (const selector of guarded) {
    const element = document.querySelector(selector);
    if (!element) continue;
    element.addEventListener("scroll", () => reset(element), { passive: true });
  }
  document.addEventListener("scroll", () => {
    reset(document.documentElement);
    reset(document.body);
    for (const selector of guarded) {
      const element = document.querySelector(selector);
      if (element) reset(element);
    }
  }, { capture: true, passive: true });
}
