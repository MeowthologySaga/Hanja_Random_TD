/*
 * 첫 판 안내 코치.
 */
import { ctx, must, shell } from "./app-context";
import { hideSummonReveal } from "./summon-reveal";

/*
 * 첫 실행 조작 안내.
 *
 * 소환·휠 확대·패닝은 지금까지 패널 바닥의 10px 한 줄에만 적혀 있어서 사실상
 * 아무도 읽지 않았다. 실제 조작 대상 위에 스포트라이트를 씌워 한 번만 짚어 준다.
 * 게임을 막지 않으며, 해당 조작을 실제로 하면 저절로 다음 단계로 넘어간다.
 */
interface CoachStep {
  readonly target: string;
  readonly title: string;
  readonly body: string;
  /** 조작 픽토그램(p0-ui-components-pack-v1). 글보다 먼저 읽히는 그림 한 장. */
  readonly control?: "wheel" | "click" | "drag";
  readonly satisfied: () => boolean;
  /**
   * 대상이 아직 화면에 없을 때 대신 짚을 곳과 문구.
   * 예: 소환 전에는 웨이브 시작 버튼이 display:none 이라 스포트라이트가
   * (-6,-6) 12px 점으로 붕괴하고 말풍선만 고아로 남았다.
   */
  readonly fallback?: {
    readonly target: string;
    readonly title: string;
    readonly body: string;
    readonly control?: "wheel" | "click" | "drag";
  };
}

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";

const COACH_STEPS: readonly CoachStep[] = [
  {
    target: '[data-summon-product="balanced"]',
    title: "먼저 자령(=타워)을 소환하세요",
    body: "엽전을 써서 자령을 뽑습니다. 첫 자령의 오행에 맞는 4×4 진이 무료로 열립니다.",
    control: "click",
    satisfied: () => ctx.engine.state.summonCount >= 1
  },
  {
    target: "#battle-canvas",
    title: "전장을 살펴보세요",
    body: "휠을 굴려 확대·축소하고, 빈 곳을 끌어 화면을 옮깁니다. 자령을 끌면 자리를 맞바꿉니다.",
    control: "wheel",
    // 설계 의도대로 "실제로 해내면 넘어간다" — 확대·축소 1회 또는 팬 1회.
    satisfied: () => ctx.mapCameraGestures > coachGestureBaseline
  },
  {
    target: "#early-button",
    title: "준비되면 웨이브를 시작합니다",
    body: "즉시 시작하면 남은 준비 시간만큼 엽전을 더 받습니다.",
    control: "click",
    satisfied: () => ctx.engine.state.wave >= 1,
    /*
     * [S/P-20] 옛 대체 문구는 1걸음을 그대로 되풀이했다 — 같은 소환 카드를
     * 짚고 "먼저 소환부터"라고 말해서, [다음]을 눌러 3/3 에 다다른 사람은
     * 마지막 걸음에서 첫 걸음을 다시 읽었다. 3걸음이 2걸음이 되는 셈이다.
     *
     * 대신 이 걸음이 원래 가르치려던 것(일찍 시작하면 엽전을 더 받는다)을
     * 지키면서, 단추가 왜 아직 없는지만 덧붙인다. 짚는 곳도 웨이브 카드로
     * 옮긴다 — 소환 카드를 짚으면 손이 다시 소환으로 가기 때문이다.
     * 조작 픽토그램도 뗀다: 지금 여기서 누를 것이 없다.
     */
    fallback: {
      target: ".wave-card",
      title: "웨이브는 첫 자령이 선 뒤에 열립니다",
      body: "지금은 시간이 멈춰 있습니다. 자령이 한 기라도 서면 전장 위에 [시작 보너스]가 나타나고, 일찍 누를수록 남은 준비 시간만큼 엽전을 더 받습니다."
    }
  }
];

let coachIndex = -1;

/** 지금 실제로 짚고 있는 셀렉터. 대체 대상으로 넘어간 것을 알아채는 데 쓴다. */
let coachResolvedTarget = "";

/** 단계에 들어선 순간의 카메라 조작 횟수. 이보다 늘면 그 단계를 해낸 것이다. */
let coachGestureBaseline = 0;

/**
 * 대상이 화면에 없거나 크기가 0 이면 대체 대상으로 돌린다.
 * 둘 다 없으면 target 을 null 로 돌려 말풍선을 화면 아래 가운데로 보낸다.
 */
function resolveCoachStep(step: CoachStep): { step: CoachStep; target: HTMLElement | null } {
  const laidOut = (selector: string): HTMLElement | null => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width >= 1 && rect.height >= 1 ? element : null;
  };
  const direct = laidOut(step.target);
  if (direct) return { step, target: direct };
  if (step.fallback) {
    const alternate = laidOut(step.fallback.target);
    if (alternate) return { step: { ...step, ...step.fallback }, target: alternate };
  }
  return { step, target: null };
}

function coachAlreadySeen(): boolean {
  try {
    return window.localStorage.getItem(COACH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markCoachSeen(): void {
  try {
    window.localStorage.setItem(COACH_STORAGE_KEY, "1");
  } catch {
    // 저장이 막혀 있어도 이번 판 안내는 정상 동작한다.
  }
}

export function layoutCoach(): void {
  const base = COACH_STEPS[coachIndex];
  if (!base) return;
  const { step, target } = resolveCoachStep(base);
  const ring = must<HTMLElement>("#coach-ring");
  const bubble = must<HTMLElement>("#coach-bubble");
  if (!target) {
    // 짚을 것이 아무것도 없으면 링을 걷고 말풍선만 화면 아래 가운데에 세운다.
    // 예전에는 레이어를 통째로 숨겨서 안내가 소리 없이 사라졌다.
    ring.hidden = true;
    bubble.style.top = `${Math.max(8, shell.offsetHeight - 172)}px`;
    bubble.style.left = `${Math.max(8, (shell.offsetWidth - 258) / 2)}px`;
    return;
  }
  ring.hidden = false;
  // 셸이 transform: scale 로 확대되므로 화면 좌표를 셸 좌표계로 되돌린다.
  const shellRect = shell.getBoundingClientRect();
  const scaleX = shellRect.width / Math.max(1, shell.offsetWidth);
  const scaleY = shellRect.height / Math.max(1, shell.offsetHeight);
  const rect = target.getBoundingClientRect();
  const left = (rect.left - shellRect.left) / scaleX;
  const top = (rect.top - shellRect.top) / scaleY;
  const width = rect.width / scaleX;
  const height = rect.height / scaleY;

  // 전장 전체를 감싸면 스포트라이트가 무의미하므로 가운데 일부만 짚는다.
  const focusWidth = step.target === "#battle-canvas" ? Math.min(width, 300) : width;
  const focusHeight = step.target === "#battle-canvas" ? Math.min(height, 240) : height;
  const focusLeft = left + (width - focusWidth) / 2;
  const focusTop = top + (height - focusHeight) / 2;

  ring.style.left = `${focusLeft - 6}px`;
  ring.style.top = `${focusTop - 6}px`;
  ring.style.width = `${focusWidth + 12}px`;
  ring.style.height = `${focusHeight + 12}px`;

  const bubbleWidth = 258;
  const bubbleHeight = bubble.offsetHeight || 132;
  const below = focusTop + focusHeight + 14;
  // 아래로 놓을 자리를 셸 바닥이 아니라 패널 탭 띠 위까지로 본다. 첫 단계의
  // 대상(자령 소환)은 패널 아래쪽에 있어서, 바닥까지 여유가 있어 보여도
  // 말풍선이 탭 띠를 덮어 다음 조작을 가로막았다. 그때는 위로 뒤집는다.
  const tabs = document.querySelector<HTMLElement>(".panel-tabs");
  const tabsTop = tabs ? (tabs.getBoundingClientRect().top - shellRect.top) / scaleY : shell.offsetHeight;
  const bottomLimit = Math.min(shell.offsetHeight - 8, tabsTop - 6);
  const fitsBelow = below + bubbleHeight <= bottomLimit;
  bubble.style.top = fitsBelow ? `${below}px` : `${Math.max(8, focusTop - bubbleHeight - 14)}px`;
  bubble.style.left = `${Math.max(8, Math.min(shell.offsetWidth - bubbleWidth - 8, focusLeft + focusWidth / 2 - bubbleWidth / 2))}px`;
}

function renderCoach(): void {
  const layer = must<HTMLElement>("#coach-layer");
  const base = COACH_STEPS[coachIndex];
  if (!base) {
    layer.hidden = true;
    return;
  }
  // 대상이 아직 없으면 문구도 대체 문구로 바꿔 읽는다.
  const { step } = resolveCoachStep(base);
  layer.hidden = false;
  must<HTMLElement>("#coach-index").textContent = String(coachIndex + 1);
  must<HTMLElement>("#coach-total").textContent = String(COACH_STEPS.length);
  must<HTMLElement>("#coach-title").textContent = step.title;
  must<HTMLElement>("#coach-body").textContent = step.body;
  must<HTMLElement>("#coach-next").textContent = coachIndex === COACH_STEPS.length - 1 ? "마치기" : "다음";
  // 조작 픽토그램은 장식이므로 aria 트리에 넣지 않고 CSS ::after 로만 얹는다.
  const bubble = must<HTMLElement>("#coach-bubble");
  if (step.control) bubble.dataset.coachControl = step.control;
  else delete bubble.dataset.coachControl;
  layoutCoach();
}

/**
 * 코치가 전장을 짚는 동안에는 소환 결과 카드(660×314)가 링 한가운데를
 * 그대로 덮어 wheel 을 삼킨다 — 안내대로 휠을 굴려도 줌이 변하지 않았다.
 * 해당 단계에 들어서면 카드를 곧바로 접는다.
 */
export function coachIsPointingAtBoard(): boolean {
  return coachIndex >= 0 && COACH_STEPS[coachIndex]?.target === "#battle-canvas";
}

/** 단계에 들어설 때 카메라 조작 기준선을 다시 잡고, 방해물을 치운다. */
function enterCoachStep(): void {
  coachGestureBaseline = ctx.mapCameraGestures;
  coachResolvedTarget = COACH_STEPS[coachIndex] ? resolveCoachStep(COACH_STEPS[coachIndex]).step.target : "";
  if (coachIsPointingAtBoard()) hideSummonReveal();
  renderCoach();
}

function advanceCoach(): void {
  if (coachIndex < 0) return;
  if (coachIndex >= COACH_STEPS.length - 1) {
    endCoach();
    return;
  }
  coachIndex += 1;
  enterCoachStep();
}

function endCoach(): void {
  coachIndex = -1;
  must<HTMLElement>("#coach-layer").hidden = true;
  markCoachSeen();
}

export function startCoach(force = false): void {
  if (!force && coachAlreadySeen()) return;
  coachIndex = 0;
  enterCoachStep();
}

/** 해당 조작을 실제로 해내면 안내가 저절로 넘어간다. */
export function syncCoachProgress(): void {
  if (coachIndex < 0) return;
  const base = COACH_STEPS[coachIndex];
  if (!base) return;
  // 대상이 나타나거나 사라지면(소환 직후의 웨이브 시작 버튼) 문구와
  // 스포트라이트를 그 자리에서 갈아 끼운다.
  const resolved = resolveCoachStep(base).step.target;
  if (resolved !== coachResolvedTarget) {
    coachResolvedTarget = resolved;
    renderCoach();
  }
  if (base.satisfied()) advanceCoach();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireCoach1(): void {
  must<HTMLButtonElement>("#coach-next").addEventListener("click", advanceCoach);
  must<HTMLButtonElement>("#coach-skip").addEventListener("click", endCoach);
}
