/*
 * 이벤트 트리거형 1회성 안내 — FB4.
 *
 * 튜토리얼 코치(첫 실행 3단계)는 "조작"만 가르치고 끝난다. 소환 종류·인연
 * 연구·합성(3체 조합)·문기처럼 게임 중반에야 처음 의미를 갖는 기능은, 그
 * 순간에 한 번만 말풍선으로 짚는다. 코치의 시각 언어(말풍선·링)를 빌리되
 * 전체 암전은 걷어 게임을 막지 않으며, 항목별 localStorage 로 재노출을 막는다
 * (COACH_STORAGE_KEY 패턴 — 키는 분리, 항목마다 저장).
 *
 * 동시 노출 규칙: 코치·시작 보너스 안내(#early-hint)·모달·집중 프레임이
 * 떠 있으면 기다리고, 안내끼리도 한 번에 하나만 세운다.
 */
import { researchUnlockWave, WUXING_ORDER } from "../core/hanzi";
import { ctx, must, shell, summonReveal } from "./app-context";

interface OneShotHint {
  readonly id: string;
  /** 링으로 짚을 대상. 화면에 실측 크기로 존재할 때에만 안내가 선다. */
  readonly target: string;
  readonly title: () => string;
  readonly body: () => string;
  /** 발화 조건 — 전역 게이트(코치·모달·페이즈)는 sync 쪽에서 따로 본다. */
  readonly when: () => boolean;
  /**
   * 소환 공개 연출에 붙는 안내만 true. 나머지는 연출이 걷힐 때까지 기다린다 —
   * 연출을 닫는 그 클릭이 방금 선 안내까지 지워 버리는 것을 막는다.
   */
  readonly anchoredToReveal?: boolean;
}

const HINT_STORAGE_PREFIX = "hanja-td:hint:";

const HINT_STORAGE_SUFFIX = ":v1";

/** 저절로 걷히기까지의 시간. 코치와 달리 게임을 막지 않으므로 짧게 잡는다. */
const HINT_AUTO_HIDE_MS = 8000;

function hintStorageKey(id: string): string {
  return HINT_STORAGE_PREFIX + id + HINT_STORAGE_SUFFIX;
}

/** 저장이 막힌 브라우저에서도 한 세션 안 재노출은 확실히 막는다. */
const seenThisSession = new Set<string>();

function hintSeen(id: string): boolean {
  if (seenThisSession.has(id)) return true;
  try {
    return window.localStorage.getItem(hintStorageKey(id)) === "1";
  } catch {
    return false;
  }
}

function markHintSeen(id: string): void {
  seenThisSession.add(id);
  try {
    window.localStorage.setItem(hintStorageKey(id), "1");
  } catch {
    // 저장 불가 시 세션 집합만으로 버틴다.
  }
}

/** 위에서부터 우선순위. 공개 연출 힌트는 연출이 떠 있는 동안만 유효해서 첫째다. */
const ONE_SHOT_HINTS: readonly OneShotHint[] = [
  {
    id: "stroke-star",
    target: "#summon-reveal-list",
    title: () => "획이 많은 한자일수록 별이 높습니다",
    body: () => "별은 뽑기 운이 아니라 실제 획수로 정해집니다. 카드의 획수 표기와 ★을 비교해 보세요. 구간표는 도움말 · 소환 갈피에 있습니다.",
    when: () => ctx.engine.state.mode === "casual"
      && summonReveal.classList.contains("is-active")
      && !summonReveal.classList.contains("is-fusion"),
    anchoredToReveal: true
  },
  {
    id: "midstar-open",
    target: '[data-summon-product="midstar"]',
    title: () => "별 확률이 다른 소환이 열렸습니다",
    body: () => {
      const band = ctx.engine.summonStarBand("midstar");
      const [min, max] = band === null ? [2, 5] : [band.min, band.max];
      return `중급 소환은 ${min}★부터 확정, 주로 ${min}~${max}★입니다. 기본 소환보다 비싼 대신 낮은 별 구간을 건너뜁니다. 확률은 카드에 마우스를 올리면 보입니다.`;
    },
    when: () => ctx.engine.isSummonProductAvailable("midstar")
  },
  {
    id: "research-open",
    target: "#research-button",
    title: () => "인연 연구가 열렸습니다",
    body: () => "인연 연구: 엽전을 들여 목표 재료가 더 잘 나옵니다. 최고 5단계이며 단계마다 개방 웨이브가 있습니다.",
    when: () => ctx.engine.state.mode === "standard"
      && ctx.engine.state.researchLevel === 0
      && ctx.engine.state.wave >= researchUnlockWave(0)
  },
  {
    id: "first-fuse",
    target: '.panel-tabs [data-panel-tab="evolution"]',
    title: () => ctx.engine.state.mode === "casual" ? "3체가 모였습니다 — 승급 가능" : "첫 합성이 가능합니다",
    body: () => ctx.engine.state.mode === "casual"
      ? "같은 오행·같은 별 자령 3기가 모였습니다. [3체 조합] 탭에서 3기를 소모해 다음 별 자령 1기를 얻으세요."
      : "재료가 모두 모인 조합이 있습니다. [합성] 탭에서 한자를 합쳐 상위 단계 자령을 만드세요.",
    // 합성 준비 수는 HUD 가 매 프레임 갱신하는 배지를 그대로 읽는다
    // (표준: 가능한 조합 수 · 캐주얼: 승급 대기 묶음 수) — 코어 재계산 없음.
    when: () => Number(must<HTMLElement>("#evolve-ready-count").textContent ?? "0") > 0
  },
  {
    id: "essence",
    target: "#growth-tab",
    title: () => "문기를 얻었습니다",
    body: () => "문기는 자령 분해와 3체 승급이 남깁니다. 강화 제련소에서 오행별로 씁니다 — [강화] 탭에서 분해·오행 강화·고유 특성에 투자하세요.",
    when: () => WUXING_ORDER.some((wuxing) => ctx.engine.state.elementEssence[wuxing] > 0)
  },
  {
    id: "talisman",
    target: "#talisman-tab",
    title: () => "부적 만들기가 켜져 있습니다",
    body: () => "한자를 따라 쓰고 [부적 완성]을 누르면 그 글자의 자령이 보상을 두고 갑니다. 부적은 웨이브마다 3장씩 더해지고 안 쓴 장수는 그대로 쌓이니 서두르지 않아도 됩니다. 그 대신 이 모드에서는 적이 5% 강해져요 — 원치 않으면 설정에서 끌 수 있습니다.",
    // 기본 켜짐(트랙 C2)이라 대부분의 사람은 이 탭을 처음 본다. 탭이 실제로
    // 서 있는 순간 딱 한 번만 짚는다. 수련장은 자체 각본이 화면을 이끌므로 비킨다.
    when: () => ctx.talismanMode && shell.dataset.tutorial !== "1"
  }
];

let activeHint: OneShotHint | null = null;

let hintTimer = 0;

/**
 * 대상이 스크롤 접힘 아래에 있어 안 보일 때 한 번만 굴려 꺼낸다(항목당 1회).
 * 상점 패널은 고정 바(자동배치) 아래로 내용이 지나가는 스크롤 면이라,
 * 인연 연구 버튼처럼 아래쪽 행동 줄은 화면 밖에서 의미를 갖게 될 수 있다.
 */
const hintScrolledOnce = new Set<string>();

/**
 * 화면에 실측 크기로 존재하는 대상만 짚는다(코치 resolveCoachStep 과 동일 기준).
 * 소환 공개 연출은 visibility:hidden 으로 닫히므로 rect 만으로는 모자라
 * checkVisibility 로 보이는지까지 본다.
 */
function laidOut(selector: string): HTMLElement | null {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  if (typeof element.checkVisibility === "function" && !element.checkVisibility()) return null;
  const rect = element.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1 ? element : null;
}

/**
 * 대상의 가운데가 실제로 눌리는 상태인지. 고정 바(자동배치)나 탭 띠에 덮여
 * 보이지 않는 버튼을 링으로 짚으면 "빈 곳을 가리키는 안내"가 된다.
 * 링은 pointer-events:none 이라 판정을 방해하지 않는다. 노출 시점에만 본다 —
 * 노출 뒤에는 말풍선 자신이 대상을 스칠 수 있어 이 판정을 다시 하지 않는다.
 */
function visiblyHittable(target: HTMLElement): boolean {
  const rect = target.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return hit !== null && (hit === target || target.contains(hit));
}

/** 다른 말풍선·모달이 떠 있으면 기다린다 — 화면에 안내는 항상 1개다. */
function hintBlockedByOthers(hint: OneShotHint): boolean {
  if (!must<HTMLElement>("#coach-layer").hidden) return true;
  const early = document.querySelector<HTMLElement>("#early-hint");
  if (early && !early.hidden) return true;
  if (document.querySelector("dialog[open]") !== null) return true;
  if (ctx.openFocusFrame !== null) return true;
  if (!hint.anchoredToReveal && summonReveal.classList.contains("is-active")) return true;
  return false;
}

function layoutHint(target: HTMLElement): void {
  const ring = must<HTMLElement>("#hint-ring");
  const bubble = must<HTMLElement>("#hint-bubble");
  // 셸이 transform: scale 로 확대되므로 화면 좌표를 셸 좌표계로 되돌린다.
  const shellRect = shell.getBoundingClientRect();
  const scaleX = shellRect.width / Math.max(1, shell.offsetWidth);
  const scaleY = shellRect.height / Math.max(1, shell.offsetHeight);
  const rect = target.getBoundingClientRect();
  const left = (rect.left - shellRect.left) / scaleX;
  const top = (rect.top - shellRect.top) / scaleY;
  const width = rect.width / scaleX;
  const height = rect.height / scaleY;
  ring.style.left = `${left - 6}px`;
  ring.style.top = `${top - 6}px`;
  ring.style.width = `${width + 12}px`;
  ring.style.height = `${height + 12}px`;
  const bubbleWidth = 258;
  const bubbleHeight = bubble.offsetHeight || 118;
  const below = top + height + 12;
  // 코치와 같은 교훈 — 말풍선이 패널 탭 띠를 덮으면 다음 조작을 막는다.
  // 단, 대상 자체가 탭이면 그 경계는 무의미하므로 셸 바닥만 지킨다.
  const tabs = document.querySelector<HTMLElement>(".panel-tabs");
  const tabsTop = tabs ? (tabs.getBoundingClientRect().top - shellRect.top) / scaleY : shell.offsetHeight;
  const bottomLimit = target.closest(".panel-tabs")
    ? shell.offsetHeight - 8
    : Math.min(shell.offsetHeight - 8, tabsTop - 6);
  const fitsBelow = below + bubbleHeight <= bottomLimit;
  bubble.style.top = fitsBelow ? `${below}px` : `${Math.max(8, top - bubbleHeight - 12)}px`;
  bubble.style.left = `${Math.max(8, Math.min(shell.offsetWidth - bubbleWidth - 8, left + width / 2 - bubbleWidth / 2))}px`;
}

export function hideOneShotHint(): void {
  window.clearTimeout(hintTimer);
  activeHint = null;
  must<HTMLElement>("#hint-layer").hidden = true;
}

function showOneShotHint(hint: OneShotHint, target: HTMLElement): void {
  activeHint = hint;
  // 뜨는 순간을 1회로 센다 — 걷히는 경로(확인·바깥 클릭·시간·대상 소멸)가 여럿이라
  // 닫힘에 걸면 한 경로라도 빠질 때 안내가 무한 반복된다.
  markHintSeen(hint.id);
  must<HTMLElement>("#hint-title").textContent = hint.title();
  must<HTMLElement>("#hint-body").textContent = hint.body();
  must<HTMLElement>("#hint-layer").hidden = false;
  layoutHint(target);
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(hideOneShotHint, HINT_AUTO_HIDE_MS);
}

/** 렌더 루프가 매 프레임 부른다 — 이미 노출된 엔진 상태만 관찰한다. */
export function syncOneShotHints(): void {
  const phase = ctx.engine.state.phase;
  const running = phase === "prep" || phase === "combat";
  if (activeHint !== null) {
    // 대상이 사라지거나(소환 공개 연출 닫힘), 조건이 이미 해소됐거나(연구 실행),
    // 코치·모달이 끼어들면 즉시 걷는다.
    const alive = running && !hintBlockedByOthers(activeHint) && activeHint.when();
    const target = alive ? laidOut(activeHint.target) : null;
    if (!target) {
      hideOneShotHint();
      return;
    }
    // 패널 재렌더로 대상이 움직여도 링과 말풍선이 따라붙는다.
    layoutHint(target);
    return;
  }
  if (!running) return;
  for (const hint of ONE_SHOT_HINTS) {
    if (hintSeen(hint.id) || hintBlockedByOthers(hint) || !hint.when()) continue;
    const target = laidOut(hint.target);
    if (!target) continue;
    if (!visiblyHittable(target)) {
      // 가려져 있으면 한 번만 스크롤로 꺼내고, 다음 프레임에 다시 판정한다.
      // center 인 이유: nearest 는 고정 바 밑단까지만 굴려 그대로 가려진다.
      if (!hintScrolledOnce.has(hint.id)) {
        hintScrolledOnce.add(hint.id);
        target.scrollIntoView({ block: "center" });
      }
      continue;
    }
    showOneShotHint(hint, target);
    return;
  }
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHint1(): void {
  must<HTMLButtonElement>("#hint-dismiss").addEventListener("click", hideOneShotHint);
  // 말풍선 밖 아무 곳이나 누르면 걷힌다 — 클릭 자체는 삼키지 않으므로
  // 링이 짚은 버튼을 곧장 눌러도 그 조작이 그대로 통한다.
  document.addEventListener("pointerdown", (event) => {
    if (must<HTMLElement>("#hint-layer").hidden) return;
    const pressed = event.target as HTMLElement | null;
    if (pressed?.closest("#hint-bubble")) return;
    hideOneShotHint();
  }, true);
}
