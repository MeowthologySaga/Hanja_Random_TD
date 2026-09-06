/*
 * 집자소 첫걸음 — 처음 들어온 사람에게 자혼 넷을 쥐여 주고 한 구를 새기게 한다(v037).
 *
 * 집자소는 판 밖의 화면이라 코치·수련장 어느 쪽도 이 자리를 말하지 않았다.
 * 「자혼을 모아 나만의 성어를 새긴다」는 규칙은 재료가 손에 있어야 이해된다 —
 * 그래서 첫 방문에 자혼 넷을 준다. 넷은 일부러 **웃긴** 조합이다: 食寐食寐
 * (식매식매 · 먹고 자고 먹고 자고). 나만의 성어는 진지한 고사성어가 아니라
 * **내 말로 뜻을 붙이는 놀이**라는 것을 첫 구가 스스로 보여 준다.
 *
 * 말풍선은 창(dialog) 안에 산다. 창은 최상위 층(top layer)이라 셸의 코치 층이
 * 위에 설 수 없다 — 코치의 시각 언어를 빌리되 배선은 여기서 자기완결한다.
 */
import { gainSoul, soulsHeld, type SoulArchive } from "../../core/soul-archive";
import { must } from "../app-context";
import { showToast } from "../hud";
import { setSoulArchive } from "../souls";

const SOUL_TUTOR_STORAGE_KEY = "hanja-td:soul-tutor-v1";

/** 첫 방문에 쥐여 주는 자혼 — 두 자씩. 먹고 자고 먹고 자고. */
export const STARTER_SOULS: ReadonlyArray<readonly [string, number]> = [["食", 2], ["寐", 2]];

/** 그 넷으로 새길 첫 구의 뜻 — 예시일 뿐, 고쳐 쓰라고 미리 채운다. */
export const STARTER_MEANING = "먹고 자고 먹고 자고 — 주말의 나";

interface SoulTutorView {
  readonly archive: SoulArchive;
  readonly draft: readonly string[];
}

interface SoulTutorStep {
  readonly id: string;
  /** 창 안의 셀렉터. 보이지 않으면 말풍선만 창 가운데 아래에 선다. */
  readonly target: () => string;
  readonly title: string;
  readonly body: string;
  readonly enter?: (view: SoulTutorView) => void;
  readonly satisfied: (view: SoulTutorView) => boolean;
}

let stepIndex = -1;
let idiomBaseline = 0;
let equipBaseline = 0;

function tutorSeen(): boolean {
  try {
    return window.localStorage.getItem(SOUL_TUTOR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markTutorSeen(): void {
  try {
    window.localStorage.setItem(SOUL_TUTOR_STORAGE_KEY, "1");
  } catch {
    // 저장이 막혀 있어도 이번 방문의 안내는 정상이다.
  }
}

function totalSouls(archive: SoulArchive): number {
  return Object.values(archive.souls).reduce((sum, count) => sum + count, 0);
}

const EQUIP_CARD_TOGGLE = '[data-soul-view="equip"]:not([hidden]) [data-soul-equip]';

const STEPS: readonly SoulTutorStep[] = [
  {
    id: "pick",
    target: () => "#soul-grid",
    title: "자혼 넷을 드렸어요 — 눌러서 올려 보세요",
    body: "자혼은 봉인한 적이 남기는 글자예요. 넷을 이으면 나만의 사자성어가 됩니다. 진지할 필요 없어요 — 食·寐 두 자씩이면 「먹고 자고 먹고 자고」.",
    satisfied: (view) => view.draft.length >= 4
  },
  {
    /*
     * 뜻 걸음을 따로 두지 않는다 — 예시를 미리 채우면 그 걸음은 서자마자 끝나
     * 아무도 못 읽는다. 뜻이 「내 말」이라는 것은 새기기 걸음이 함께 말한다.
     */
    id: "forge",
    target: () => "#soul-forge-button",
    title: "음은 저절로, 뜻은 내 말로 — [새기기]",
    body: "음은 한자 음 그대로 붙고(식매식매) 뜻만 직접 적어요. 예시 뜻을 채워 뒀으니 고쳐 써도 좋아요. 효과는 굴려서 정해지고 확률표에 미리 보여요 — 태운 자혼은 돌아오지 않아요.",
    enter: (view) => {
      idiomBaseline = view.archive.idioms.length;
      const input = must<HTMLInputElement>("#soul-meaning-input");
      if (input.value.trim() === "") input.value = STARTER_MEANING;
    },
    satisfied: (view) => view.archive.idioms.length > idiomBaseline
  },
  {
    id: "equip",
    target: () => (document.querySelector(EQUIP_CARD_TOGGLE) ? EQUIP_CARD_TOGGLE : '[data-soul-tab="equip"]'),
    title: "장착해야 다음 판에 함께 서요",
    body: "[장착] 갈피에서 이 성어를 켜 두면 새 판이 시작될 때 효과가 붙어요. 열다섯 구까지 고를 수 있어요.",
    enter: (view) => {
      equipBaseline = view.archive.equipped.length;
    },
    satisfied: (view) => view.archive.equipped.length > equipBaseline
  }
];

/**
 * 첫 방문이면 자혼 넷을 쥐여 준다 — 이미 넷 이상 지녔으면(지난 판의 수확) 안 준다.
 * 부르는 쪽: openSoulArchive. 안내 자체는 syncSoulTutor 가 그리기마다 맞춘다.
 */
export function grantStarterSouls(archive: SoulArchive): SoulArchive {
  if (tutorSeen() || totalSouls(archive) >= 4) return archive;
  let next = archive;
  for (const [char, count] of STARTER_SOULS) {
    const held = soulsHeld(next, char);
    if (held >= count) continue;
    next = gainSoul(next, char, count - held);
  }
  if (next !== archive) {
    setSoulArchive(next);
    showToast("첫 자혼 넷을 드렸어요 — 食·寐 두 자씩. 이어서 한 구 새겨 보세요");
  }
  return next;
}

function bubble(): HTMLElement {
  return must<HTMLElement>("#soul-tutor");
}

function ring(): HTMLElement {
  return must<HTMLElement>("#soul-tutor-ring");
}

function endTutor(): void {
  stepIndex = -1;
  markTutorSeen();
  bubble().hidden = true;
  ring().hidden = true;
}

function enterStep(view: SoulTutorView): void {
  const step = STEPS[stepIndex];
  if (!step) {
    endTutor();
    return;
  }
  step.enter?.(view);
  must<HTMLElement>("#soul-tutor-step").textContent = `${stepIndex + 1} / ${STEPS.length}`;
  must<HTMLElement>("#soul-tutor-title").textContent = step.title;
  must<HTMLElement>("#soul-tutor-body").textContent = step.body;
  const note = bubble();
  note.hidden = false;
  note.dataset.soulTutorStep = step.id;
  layoutSoulTutor();
}

/** 말풍선 폭(px) — 830-soul-tutor.css 의 width 와 같아야 한다. */
const BUBBLE_WIDTH = 272;

/**
 * 창의 **제 좌표계**와 화면 좌표계의 환율.
 *
 * 셸은 `transform: scale(var(--stage-scale))` 로 창 크기에 맞춰 늘고 준다
 * (280-r8-stage.css). getBoundingClientRect() 는 그 배율이 **곱해진** 값을
 * 주는데, 창 안에서 position:absolute 로 놓을 때 쓰는 단위는 배율이 **곱해지지
 * 않은** 제 좌표계다. 이 환율을 안 나누면 배율만큼 어긋난다 —
 * 배율 1.25 짜리 큰 창에서 말풍선이 664px 짜리 창의 830px 자리에 놓여 아래가
 * 잘려 나갔다(사용자 제보: 「집자소 ui버그」). 코치(coach.ts)는 같은 환율을
 * 이미 이렇게 나눈다.
 */
function dialogFrame(): { rect: DOMRect; scale: number; width: number; height: number } {
  const dialogElement = must<HTMLElement>("#soul-dialog");
  const rect = dialogElement.getBoundingClientRect();
  const scale = rect.width > 0 && dialogElement.offsetWidth > 0 ? rect.width / dialogElement.offsetWidth : 1;
  return { rect, scale, width: dialogElement.offsetWidth, height: dialogElement.offsetHeight };
}

/** 화면 좌표 상자를 창의 제 좌표계로 옮긴다. */
function toDialogSpace(rect: DOMRect, frame: ReturnType<typeof dialogFrame>): { left: number; top: number; width: number; height: number } {
  return {
    left: (rect.left - frame.rect.left) / frame.scale,
    top: (rect.top - frame.rect.top) / frame.scale,
    width: rect.width / frame.scale,
    height: rect.height / frame.scale
  };
}

/**
 * 링이 감쌀 상자 — 대상과 **그 대상을 자르는 스크롤 칸**의 교집합.
 *
 * 자혼 격자(#soul-grid)는 수백 종을 이고 있어 제 높이가 900px 를 넘지만,
 * 실제로 보이는 것은 452px 짜리 칸(.soul-col)이 잘라 낸 부분뿐이다. 대상의
 * 온 높이에 링을 두르면 창 밖까지 뻗은 금테가 그려진다(실측: 격자 550 ·
 * 링 327 로 어긋남). 보이는 데까지만 두른다.
 */
function visibleTargetRect(target: HTMLElement): DOMRect | null {
  const rect = target.getBoundingClientRect();
  const clip = target.closest<HTMLElement>(".soul-col, .soul-view, .soul-dialog");
  if (!clip) return rect;
  const bounds = clip.getBoundingClientRect();
  const left = Math.max(rect.left, bounds.left);
  const right = Math.min(rect.right, bounds.right);
  const top = Math.max(rect.top, bounds.top);
  const bottom = Math.min(rect.bottom, bounds.bottom);
  if (right - left < 1 || bottom - top < 1) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}

/** 창 좌표계로 링과 말풍선을 놓는다. 둘 다 창 안을 벗어나지 않는다. */
export function layoutSoulTutor(): void {
  const step = STEPS[stepIndex];
  if (!step) return;
  const frame = dialogFrame();
  const target = document.querySelector<HTMLElement>(step.target());
  const visible = target ? visibleTargetRect(target) : null;
  const marker = ring();
  const note = bubble();
  const noteHeight = note.offsetHeight || 140;
  // 창 안에 반드시 남기는 자리 — 어느 갈래로 가든 마지막에 이 두 죔쇠를 통과한다.
  const clampLeft = (value: number): number => Math.max(8, Math.min(frame.width - BUBBLE_WIDTH - 8, value));
  const clampTop = (value: number): number => Math.max(8, Math.min(frame.height - noteHeight - 8, value));

  if (!visible) {
    // 짚을 것이 없으면 링을 걷고 말풍선만 창 아래 가운데에 세운다.
    marker.hidden = true;
    note.style.left = `${clampLeft((frame.width - BUBBLE_WIDTH) / 2)}px`;
    note.style.top = `${clampTop(frame.height - noteHeight - 24)}px`;
    return;
  }

  const box = toDialogSpace(visible, frame);
  /*
   * 링은 대상보다 6px 씩 넓게 두르는데, 대상이 창 가장자리에 닿아 있으면 그
   * 여백이 창 밖으로 삐져나간다(실측: 배율 1.35 에서 아래로 3px). 창 안으로
   * 물린다 — 금테 한 줄이 종이 밖에 걸리는 것도 사용자 눈에는 깨진 화면이다.
   */
  const ringLeft = Math.max(0, box.left - 6);
  const ringTop = Math.max(0, box.top - 6);
  const ringRight = Math.min(frame.width, box.left + box.width + 6);
  const ringBottom = Math.min(frame.height, box.top + box.height + 6);
  marker.hidden = false;
  marker.style.left = `${ringLeft}px`;
  marker.style.top = `${ringTop}px`;
  marker.style.width = `${Math.max(0, ringRight - ringLeft)}px`;
  marker.style.height = `${Math.max(0, ringBottom - ringTop)}px`;

  /*
   * 대상 **아래**가 첫 자리다 — 자혼 격자 옆(새김대)은 지금 채워지는 것을
   * 보여야 하는 자리라 가리면 안 된다. 아래에 자리가 없으면 오른쪽, 그마저
   * 없으면 왼쪽으로 물러선다.
   */
  const belowRoom = frame.height - (box.top + box.height + 14) >= noteHeight + 8;
  const rightRoom = frame.width - (box.left + box.width + 14) >= BUBBLE_WIDTH + 8;
  const noteLeft = belowRoom
    ? box.left + box.width / 2 - BUBBLE_WIDTH / 2
    : rightRoom ? box.left + box.width + 14 : box.left - BUBBLE_WIDTH - 14;
  const noteTop = belowRoom
    ? box.top + box.height + 14
    : box.top + box.height / 2 - noteHeight / 2;
  note.style.left = `${clampLeft(noteLeft)}px`;
  note.style.top = `${clampTop(noteTop)}px`;
}

/**
 * 그리기마다 불린다 — 지금 걸음이 끝났으면 다음 걸음으로, 자리가 바뀌었으면
 * 링을 옮긴다. 첫 방문이 아니면 아무 일도 하지 않는다.
 */
export function syncSoulTutor(view: SoulTutorView): void {
  if (stepIndex < 0) {
    if (tutorSeen()) return;
    // 재료가 없으면 가르칠 것이 없다 — 자혼 넷이 손에 있을 때만 선다.
    if (totalSouls(view.archive) < 4 && view.archive.idioms.length === 0) return;
    stepIndex = 0;
    enterStep(view);
    return;
  }
  let guard = 0;
  while (STEPS[stepIndex]?.satisfied(view) && guard < STEPS.length) {
    stepIndex += 1;
    guard += 1;
    if (stepIndex >= STEPS.length) {
      endTutor();
      showToast("집자소 첫걸음 끝 — 자혼은 우두머리를 봉인하면 반드시, 그 밖의 적도 드물게 남깁니다");
      return;
    }
    enterStep(view);
  }
  layoutSoulTutor();
}

/** 창이 닫힐 때 — 안내는 다음에 열면 그 걸음부터 다시 선다(기록은 마쳐야 남는다). */
export function hideSoulTutor(): void {
  bubble().hidden = true;
  ring().hidden = true;
}

export function bindSoulTutor(): void {
  must<HTMLButtonElement>("#soul-tutor-skip").addEventListener("click", endTutor);
  window.addEventListener("resize", layoutSoulTutor);
  /*
   * 자혼 칸을 굴리면 링도 따라와야 한다 — 안 그러면 짚던 것은 위로 사라지고
   * 금테만 허공에 남는다. 스크롤은 거품이 일지 않으므로 잡기 단계에서 듣는다.
   */
  must<HTMLElement>("#soul-dialog").addEventListener("scroll", () => layoutSoulTutor(), { capture: true });
}
