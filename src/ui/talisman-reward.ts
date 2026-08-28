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
 * 트랙 C3 — 읽을 시간을 준다. "보상 이펙트가 너무 빨라서 뭐 얻었는지 잘
 * 모르겠어"(사용자 실황). 총 길이를 1.4초에서 2.7초로 늘리되, 늘린 몫을
 * 전부 **머무는 시간**에 쓴다: 튀어나온 꾸러미가 자령 발치에서 0.86초 동안
 * 크게 정지한 뒤에야 자원칸으로 날아간다. 여러 개면 등장 간격을 0.12→0.25초로
 * 벌려 하나씩 읽히게 한다. 꾸러미에는 무엇을 받았는지 글자로 박는다
 * ("엽전 +12" · "木 문기 +1" · "무료 소환권 +1") — 숫자만 날아가면 무엇을
 * 받았는지 알 수 없다. 자원칸 카운트업도 0.42→0.76초로 함께 늘렸다.
 *
 * 구간별 예산(보상 1개 · 이동 연출):
 *   0–320   자령 강림          320–580   꾸러미 팝(0.35→1.14배)
 *   580–1440 정지 유지(860ms)  1440–2060 자원칸 비행·착탄
 *   ~1980–2740 엽전 카운트업   ~2700    자령 퇴장
 * 늘어난 뒤에도 전투 조작은 막지 않는다(전부 pointer-events:none).
 *
 * 차분한 화면·OS 동작 줄이기: 이동·바운스·흔들림은 CSS 게이트가 걷어 가고
 * 자령 초상·인장·숫자 카운트업·최근 보상 줄(정보)은 그대로 남는다. 이때는
 * 날아가지 않는 대신 제자리에서 2초 넘게(완전 불투명 ≈2.07초) 버틴다 —
 * 정보는 더 오래 남긴다.
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
  /**
   * 꾸러미 옆 글줄 — "엽전 +12" · "木 문기 +1" · "무료 소환권 +1".
   * 무엇인지가 앞, 수량이 뒤다(트랙 C3). 숫자만 날아가면 무엇을 받았는지
   * 알 수 없다는 사용자 실황의 반영이라, 아이콘 옆에 이름을 반드시 적는다.
   */
  readonly label: string;
}

/** 자령이 머무는 총 길이. 540절의 talisman-visit-arc 길이와 맞춘다. */
const VISIT_MS = 2_700;


/** 강림 뒤 보상이 발치에서 튀어나오기까지. */
const GIFT_DELAY_MS = 320;

/** 튀어나오는 구간(팝). */
const GIFT_POP_MS = 260;

/**
 * 트랙 C3 의 핵심 — 튀어나온 꾸러미가 **크게 정지해 있는** 구간.
 * 여기가 "무엇을 받았는지" 읽히는 유일한 시간이라 보상 하나당 0.8초 이상을
 * 보장한다. 이 구간을 지나야 자원칸으로 날아간다.
 */
const GIFT_HOLD_MS = 860;

/** 자원칸까지 호를 그리는 구간. */
const GIFT_FLIGHT_MS = 620;

/** 가챠 연출 문법 — 여러 개면 이 간격으로 연쇄한다(하나씩 읽히게 벌렸다). */
const GIFT_STAGGER_MS = 250;

/**
 * 차분한 화면·동작 줄이기에서 꾸러미가 제자리에 머무는 길이.
 * 이동이 없어 정보가 오직 이 정지 표시에만 실리므로 이동 연출보다 더 길게
 * 잡는다 — 완전 불투명 구간이 2초를 넘는다(아래 opacity 오프셋 0.04→0.94).
 */
const GIFT_CALM_MS = 2_300;

/** 착탄 뒤 숫자가 굴러가는 길이. 느려진 연출에 맞춰 함께 늘렸다. */
const GOLD_ROLL_MS = 760;

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
  window.setTimeout(() => anchor.classList.remove("is-talisman-land"), 700);
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
    // 이동 없이 제자리에서 보여 주기만 한다 — 대신 2초 넘게 버틴다(정보를
    // 이 정지 표시 하나로만 전하므로 이동 연출보다 오래 남긴다).
    flyer.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.04 }, { opacity: 1, offset: 0.94 }, { opacity: 0 }],
      { duration: GIFT_CALM_MS, delay, easing: "linear", fill: "backwards" }
    );
    window.setTimeout(land, delay + GIFT_POP_MS);
    window.setTimeout(() => flyer.remove(), delay + GIFT_CALM_MS + 60);
    return;
  }

  const target = shellCenterOf(anchor);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const total = GIFT_POP_MS + GIFT_HOLD_MS + GIFT_FLIGHT_MS;
  const popEnd = GIFT_POP_MS / total;
  const holdEnd = (GIFT_POP_MS + GIFT_HOLD_MS) / total;
  // 구간마다 결이 다르므로(팝은 튕기고, 유지는 멈추고, 비행은 미끄러진다)
  // 전체 easing 은 linear 로 두고 키프레임마다 따로 준다.
  flyer.animate(
    [
      { offset: 0, transform: "translate(0, 0) scale(0.35)", opacity: 0, easing: "cubic-bezier(0.2, 1.5, 0.4, 1)" },
      { offset: popEnd * 0.6, transform: "translate(0, -9px) scale(1.3)", opacity: 1, easing: "ease-out" },
      // 여기서부터 GIFT_HOLD_MS 동안 크게 멈춰 선다 — 읽는 구간이다.
      { offset: popEnd, transform: "translate(0, -4px) scale(1.14)", opacity: 1, easing: "linear" },
      { offset: holdEnd, transform: "translate(0, -4px) scale(1.14)", opacity: 1, easing: "cubic-bezier(0.35, 0, 0.3, 1)" },
      { offset: holdEnd + (1 - holdEnd) * 0.55, transform: `translate(${Math.round(dx * 0.5)}px, ${Math.round(dy * 0.5 - ARC_LIFT)}px) scale(0.94)`, opacity: 1 },
      { offset: 0.96, transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(0.58)`, opacity: 1 },
      { offset: 1, transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(0.36)`, opacity: 0 }
    ],
    { duration: total, delay, easing: "linear", fill: "backwards" }
  );
  window.setTimeout(land, delay + GIFT_POP_MS + GIFT_HOLD_MS + GIFT_FLIGHT_MS * 0.96);
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
  goldBefore: number,
  line = ""
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
  /*
   * 말은 자령 **머리 위**에 둔다. 발치(+88px)는 보상 꾸러미의 자리이고,
   * 이름표 아래끝이 이미 중심에서 +51.5px 라 여유가 9px 뿐이다 — 말줄을
   * 아래에 붙이면 격자가 위아래로 함께 자라 꾸러미를 덮는다(실측).
   *
   * 말은 토스트가 읽어 주는 것과 **같은 줄**이어야 한다. 이 연출은 통째로
   * aria-hidden 이라 스크린리더에는 닿지 않는다 — 접근성 채널은 토스트뿐이다.
   */
  visit.innerHTML = `${calm ? "" : '<span class="talisman-visit-halo"></span>'}`
    + (line === "" ? "" : `<q class="talisman-visit-line">${line}</q>`)
    + spiritPortraitMarkup(char, wuxing, "workbench-spirit--talisman")
    + `<b class="talisman-visit-name">${char} 자령</b>`;
  shell.append(visit);
  window.setTimeout(() => visit.remove(), VISIT_MS + 80);

  // 보상은 자령 발치에서 튀어나온다 — 초상(84px)과 이름표 아래다. 꾸러미가
  // 정지해 머무는 구간이 길어졌으므로(트랙 C3) 이 여유가 부족하면 이름표를
  // 그대로 덮어 버린다 — 꾸러미를 키운 만큼 발치도 함께 내렸다(실측 68→88).
  // 이름표 아래끝이 중심에서 +51.5px, 유지 구간의 꾸러미 윗변이 발치에서
  // -27px 이라 +88 이면 9px 이 남는다.
  const feet: ShellPoint = { x: center.x, y: center.y + 88 };
  grants.forEach((grant, index) => spawnGift(grant, feet, index, calm));

  const goldGrant = grants.find((grant) => grant.kind === "gold");
  if (!goldGrant) return;
  const landAt = GIFT_DELAY_MS + grants.indexOf(goldGrant) * GIFT_STAGGER_MS
    + GIFT_POP_MS + GIFT_HOLD_MS + GIFT_FLIGHT_MS * 0.96;
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
