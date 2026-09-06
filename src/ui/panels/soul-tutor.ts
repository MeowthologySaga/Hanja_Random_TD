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

/** 창 좌표계로 링과 말풍선을 놓는다. 창은 최상위 층이라 셸의 확대 배율을 안 탄다. */
export function layoutSoulTutor(): void {
  const step = STEPS[stepIndex];
  if (!step) return;
  const box = must<HTMLElement>("#soul-dialog").getBoundingClientRect();
  const target = document.querySelector<HTMLElement>(step.target());
  const rect = target?.getBoundingClientRect();
  const marker = ring();
  const note = bubble();
  const noteWidth = 272;
  if (!rect || rect.width < 1 || rect.height < 1) {
    marker.hidden = true;
    note.style.left = `${Math.max(8, (box.width - noteWidth) / 2)}px`;
    note.style.top = `${Math.max(8, box.height - 180)}px`;
    return;
  }
  const left = rect.left - box.left;
  const top = rect.top - box.top;
  marker.hidden = false;
  marker.style.left = `${left - 6}px`;
  marker.style.top = `${top - 6}px`;
  marker.style.width = `${rect.width + 12}px`;
  marker.style.height = `${rect.height + 12}px`;
  const noteHeight = note.offsetHeight || 140;
  /*
   * 대상 **아래**가 첫 자리다 — 자혼 격자 옆(새김대)은 지금 채워지는 것을
   * 보여야 하는 자리라 가리면 안 된다. 아래에 자리가 없으면 오른쪽, 그마저
   * 없으면 왼쪽으로 물러선다.
   */
  const belowRoom = box.height - (top + rect.height + 14) >= noteHeight + 8;
  const rightRoom = box.width - (left + rect.width + 14) >= noteWidth + 8;
  let noteLeft: number;
  let noteTop: number;
  if (belowRoom) {
    noteLeft = Math.max(8, Math.min(box.width - noteWidth - 8, left + rect.width / 2 - noteWidth / 2));
    noteTop = top + rect.height + 14;
  } else {
    noteLeft = rightRoom ? left + rect.width + 14 : Math.max(8, left - noteWidth - 14);
    noteTop = Math.max(8, Math.min(box.height - noteHeight - 8, top + rect.height / 2 - noteHeight / 2));
  }
  note.style.left = `${noteLeft}px`;
  note.style.top = `${noteTop}px`;
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
}
