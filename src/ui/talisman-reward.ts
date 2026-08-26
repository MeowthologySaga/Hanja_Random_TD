/*
 * 부적 보상 수령 연출 — 트랙 C2 ②.
 *
 * "보상 들어오는 효과 좀 강하게 줘봐. 뭐 받았는지 모르겠어"(사용자 실황).
 * 토스트 한 줄로는 무엇을 받았는지 남지 않는다. 그래서 세계관을 그대로 쓴다 —
 * 부적은 봉인구고 자령은 그 안에 깃드는 영이니(GAME_DESIGN.md 「세계관 —
 * 부적과 자령」), **내가 쓴 그 글자의 자령이 부적에 응답해 내려와 보상을 놓고
 * 떠난다**. 스프라이트는 소환 공개 카드가 쓰는 초상 경로(spiritPortraitMarkup
 * → jaryeongVisualFor)를 그대로 재사용한다 — 새 에셋은 없다.
 *
 * 자령은 어디까지나 방문객이다. 엔진 상태는 하나도 건드리지 않으므로 보관고에
 * 남지도, 전력이 되지도 않는다(보상만 지급 — 사용자 결정인 랜덤 보상 원안 유지).
 *
 * 연출 예산은 1.6초 안쪽이고 전투 조작을 막지 않는다(전부 pointer-events:none).
 * 트랙 A 의 `+N 문기` 플로팅(essence-feedback.ts)과 시각 언어를 맞추되 부적
 * 보상은 더 크고 더 오래 머문다.
 *
 * 차분한 화면·OS 동작 줄이기: 이동·바운스·흔들림은 CSS 게이트가 걷어 가고
 * 자령 초상·인장·숫자 카운트업·최근 보상 줄(정보)은 그대로 남는다.
 */
import { ELEMENT_STYLES } from "../core/hanzi";
import { type Wuxing } from "../core/types";
import { calmBattlefield, ctx, shell } from "./app-context";
import { spiritPortraitMarkup } from "./format";

export type TalismanRewardKind = "gold" | "essence" | "token";

export interface TalismanRewardGrant {
  readonly kind: TalismanRewardKind;
  readonly amount: number;
  /** 문기 보상의 오행 — 꾸러미 테두리 색과 도착 칸 선택에 쓴다. */
  readonly wuxing?: Wuxing;
  /** 꾸러미에 박히는 한 글자(엽전 錢 · 문기 오행자 · 무료권 券). */
  readonly glyph: string;
  /** 꾸러미 옆 글줄 — "+22 엽전". */
  readonly label: string;
}

/** 자령이 머무는 총 길이. 540절의 talisman-visit-arc 길이와 맞춘다. */
const VISIT_MS = 1_400;

/** 강림 뒤 보상이 발치에서 튀어나오기까지. */
const GIFT_DELAY_MS = 300;

/** 튀어나오는 구간(팝). */
const GIFT_POP_MS = 170;

/** 자원칸까지 호를 그리는 구간. */
const GIFT_FLIGHT_MS = 520;

/** 가챠 연출 문법 — 여러 개면 이 간격으로 연쇄한다. */
const GIFT_STAGGER_MS = 120;

/** 착탄 뒤 숫자가 굴러가는 길이. */
const GOLD_ROLL_MS = 420;

/** 호의 높이 — 직선 중점에서 이만큼 위로 부푼다. */
const ARC_LIFT = 46;

const GIFT_TINTS: Record<TalismanRewardKind, string> = {
  gold: "#e0b84f",
  essence: "#9fd3c7",
  token: "#d9a3e0"
};

interface ShellPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * 셸은 무대 배율(transform: scale)로 확대돼 있으므로 화면 좌표를 셸 좌표계로
 * 되돌려야 절대 배치가 맞는다(essence-feedback.ts·hint.ts 와 같은 문법).
 */
function shellCenterOf(element: Element): ShellPoint {
  const shellRect = shell.getBoundingClientRect();
  const scaleX = shellRect.width / Math.max(1, shell.offsetWidth);
  const scaleY = shellRect.height / Math.max(1, shell.offsetHeight);
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2 - shellRect.left) / scaleX,
    y: (rect.top + rect.height / 2 - shellRect.top) / scaleY
  };
}

function visible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (typeof element.checkVisibility === "function" && !element.checkVisibility()) return false;
  const rect = element.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1;
}

function firstVisible(selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (visible(element)) return element;
  }
  return null;
}

/** 보상이 꽂힐 자원칸. 지금 화면에 실제로 보이는 것만 고른다. */
function rewardAnchor(kind: TalismanRewardKind): HTMLElement | null {
  if (kind === "gold") return firstVisible(["#gold-value", ".resource-grid"]);
  if (kind === "essence") return firstVisible(["#essence-summary", "#growth-resource-summary", ".resource-grid"]);
  return firstVisible(["#shop-tab", ".resource-grid"]);
}

/* ── 엽전 카운트업 ─────────────────────────────────────────────
   HUD 는 매 프레임 state.gold 를 그대로 찍으므로, 굴러가는 숫자는 그 자리에
   잠깐 끼어드는 표시값으로 만든다. 다른 수입·지출이 끼어들어 실제 보유량이
   목표와 어긋나면 그 즉시 물러나 실값을 보여 준다 — 연출이 진실을 가리지 않는다.
   ────────────────────────────────────────────────────────────── */

interface GoldRoll {
  readonly from: number;
  readonly to: number;
  /** 착탄 시각 — 그전까지는 받기 전 숫자에 머문다. */
  readonly startAt: number;
}

let goldRoll: GoldRoll | null = null;

function startGoldRoll(from: number, to: number, delayMs: number): void {
  if (from === to) return;
  goldRoll = { from, to, startAt: performance.now() + delayMs };
}

/**
 * 지금 프레임에 엽전 칸이 보여 줄 숫자. 굴리는 중이 아니면 null 이고,
 * HUD 는 그때 실제 보유량을 그대로 쓴다.
 */
export function talismanGoldRoll(actual: number): number | null {
  if (!goldRoll) return null;
  if (goldRoll.to !== actual) {
    goldRoll = null;
    return null;
  }
  const progress = (performance.now() - goldRoll.startAt) / GOLD_ROLL_MS;
  if (progress <= 0) return goldRoll.from;
  if (progress >= 1) {
    goldRoll = null;
    return null;
  }
  // smoothstep — 시작과 끝이 부드럽게 붙는다.
  const eased = progress * progress * (3 - 2 * progress);
  return Math.round(goldRoll.from + (goldRoll.to - goldRoll.from) * eased);
}

/* ── 강림·수령 연출 ───────────────────────────────────────────── */

function flashAnchor(anchor: HTMLElement): void {
  anchor.classList.remove("is-talisman-land");
  // 연속 수령에도 매번 다시 튀도록 강제 리플로 후 재부착(트랙 A 문법).
  void anchor.offsetWidth;
  anchor.classList.add("is-talisman-land");
  window.setTimeout(() => anchor.classList.remove("is-talisman-land"), 560);
}

function spawnGift(grant: TalismanRewardGrant, origin: ShellPoint, index: number, calm: boolean): void {
  const anchor = rewardAnchor(grant.kind);
  const delay = GIFT_DELAY_MS + index * GIFT_STAGGER_MS;
  const flyer = document.createElement("div");
  flyer.className = "talisman-gift-fly";
  flyer.style.left = `${Math.round(origin.x)}px`;
  flyer.style.top = `${Math.round(origin.y)}px`;
  const tint = grant.kind === "essence" && grant.wuxing ? ELEMENT_STYLES[grant.wuxing].color : GIFT_TINTS[grant.kind];
  flyer.innerHTML = `<span class="talisman-gift" style="--gift:${tint}"><i>${grant.glyph}</i><em>${grant.label}</em></span>`;
  shell.append(flyer);

  const land = (): void => {
    if (anchor) flashAnchor(anchor);
  };

  if (calm || !anchor) {
    // 이동 없이 제자리에서 보여 주기만 한다 — 무엇을 받았는지는 남는다.
    const total = GIFT_POP_MS + GIFT_FLIGHT_MS;
    flyer.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }],
      { duration: total, delay, easing: "linear", fill: "backwards" }
    );
    window.setTimeout(land, delay + GIFT_POP_MS);
    window.setTimeout(() => flyer.remove(), delay + total + 60);
    return;
  }

  const target = shellCenterOf(anchor);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const total = GIFT_POP_MS + GIFT_FLIGHT_MS;
  const popEnd = GIFT_POP_MS / total;
  flyer.animate(
    [
      { offset: 0, transform: "translate(0, 0) scale(0.35)", opacity: 0 },
      { offset: popEnd * 0.55, transform: "translate(0, -6px) scale(1.2)", opacity: 1 },
      { offset: popEnd, transform: "translate(0, 0) scale(1)", opacity: 1 },
      { offset: popEnd + (1 - popEnd) * 0.55, transform: `translate(${Math.round(dx * 0.5)}px, ${Math.round(dy * 0.5 - ARC_LIFT)}px) scale(0.94)`, opacity: 1 },
      { offset: 0.95, transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(0.58)`, opacity: 1 },
      { offset: 1, transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(0.36)`, opacity: 0 }
    ],
    { duration: total, delay, easing: "cubic-bezier(0.35, 0, 0.3, 1)", fill: "backwards" }
  );
  window.setTimeout(land, delay + total * 0.95);
  window.setTimeout(() => flyer.remove(), delay + total + 60);
}

/**
 * 통과한 부적에 자령이 응답한다 — 강림 → 보상 내려놓기 → 인사하듯 퇴장.
 *
 * `goldBefore` 는 보상을 얹기 전 보유량이다. 엽전 보상이 있으면 착탄 순간부터
 * 그 숫자에서 현재 보유량까지 굴러간다.
 */
export function playTalismanRewardVisit(
  char: string,
  wuxing: Wuxing,
  grants: readonly TalismanRewardGrant[],
  goldBefore: number
): void {
  const paper = document.querySelector<HTMLElement>("#talisman-paper");
  if (!paper || !visible(paper)) return;
  const calm = calmBattlefield();
  const center = shellCenterOf(paper);

  const visit = document.createElement("div");
  visit.className = `talisman-visit ${calm ? "is-calm" : "is-motion"}`;
  visit.style.left = `${Math.round(center.x)}px`;
  visit.style.top = `${Math.round(center.y)}px`;
  visit.setAttribute("aria-hidden", "true");
  visit.innerHTML = `${calm ? "" : '<span class="talisman-visit-halo"></span>'}`
    + spiritPortraitMarkup(char, wuxing, "workbench-spirit--talisman")
    + `<b class="talisman-visit-name">${char} 자령</b>`;
  shell.append(visit);
  window.setTimeout(() => visit.remove(), VISIT_MS + 80);

  // 보상은 자령 발치에서 튀어나온다.
  const feet: ShellPoint = { x: center.x, y: center.y + 44 };
  grants.forEach((grant, index) => spawnGift(grant, feet, index, calm));

  const goldGrant = grants.find((grant) => grant.kind === "gold");
  if (!goldGrant) return;
  const landAt = GIFT_DELAY_MS + grants.indexOf(goldGrant) * GIFT_STAGGER_MS + (GIFT_POP_MS + GIFT_FLIGHT_MS) * 0.95;
  startGoldRoll(goldBefore, ctx.engine.state.gold, calm ? 0 : landAt);
}

/** 완성 순간의 타격 — 종이 번쩍·파문과 아주 약한(2px·120ms) 흔들림. */
export function playTalismanImpact(): void {
  const paper = document.querySelector<HTMLElement>("#talisman-paper");
  const panel = document.querySelector<HTMLElement>("#talisman-panel");
  for (const [element, className, ms] of [[paper, "is-burst", 700], [panel, "is-hit", 280]] as const) {
    if (!element) continue;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), ms);
  }
}
