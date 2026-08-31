/*
 * 문기 획득 피드백 — 트랙 A #2.
 *
 * 획득 경로 셋(분해·3체 승급 환급·판매 환급) 중 이벤트에 증가량이 실리는
 * 것은 dismantle 하나뿐이다(casualFuse 는 환급 필드가 없고 판매는 이벤트
 * 자체가 없다). game.ts 는 분할 재생성 중이라 손대지 않으므로, 렌더 틱에서
 * elementEssence 의 오행별 증가를 감지하는 단일 감시자로 세 경로를 모두
 * 받는다. 감지 순간에 (1) 자원칸 근처 오행색 "+N 문기" 플로팅, (2) 자원칸
 * 요약 반짝, (3) 분해 SFX 1회(같은 프레임의 dismantle 이벤트 재생과는
 * SFX 재트리거 간격이 겹침을 걸러 준다)를 세운다.
 */
import { ELEMENT_STYLES, WUXING_ORDER } from "../core/hanzi";
import { type Wuxing } from "../core/types";
import { calmBattlefield, ctx, shell, sound } from "./app-context";

let baseline: Record<Wuxing, number> | null = null;

let flashTimer = 0;

let floaterCount = 0;

const MAX_FLOATERS = 5;

const FLOATER_LIFETIME_MS = 1_700;

const FLASH_MS = 1_100;

/** 현재 오행별 문기 보유량 스냅샷 — 토스트 환급 문구 증강에도 쓴다. */
export function essenceSnapshot(): Record<Wuxing, number> {
  const snapshot = {} as Record<Wuxing, number>;
  for (const wuxing of WUXING_ORDER) snapshot[wuxing] = ctx.engine.state.elementEssence[wuxing];
  return snapshot;
}

/**
 * 스냅샷 대비 늘어난 문기를 " · 木 문기 +2 환급" 꼴로 잇는다. 3체 승급
 * 토스트는 엔진 문장에 환급 언급이 없으므로 UI 가 실측 증가분으로 채운다
 * (농축 투자 환급까지 실제 받은 양 그대로).
 */
export function essenceRefundSuffix(before: Record<Wuxing, number>): string {
  return WUXING_ORDER
    .map((wuxing) => [wuxing, ctx.engine.state.elementEssence[wuxing] - before[wuxing]] as const)
    .filter(([, delta]) => delta > 0)
    .map(([wuxing, delta]) => ` · ${wuxing} 문기 +${delta} 환급`)
    .join("");
}

/** 문기가 적힌 곳 중 지금 화면에 실제로 보이는 것. 상단 자원칸이 첫 자리다. */
function floaterAnchor(): HTMLElement | null {
  for (const selector of ["#essence-total-value", "#essence-summary", "#growth-resource-summary", ".resource-grid"]) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) continue;
    if (typeof element.checkVisibility === "function" && !element.checkVisibility()) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width >= 1 && rect.height >= 1) return element;
  }
  return null;
}

function spawnFloater(wuxing: Wuxing, amount: number, stackIndex: number): void {
  const anchor = floaterAnchor();
  if (!anchor || floaterCount >= MAX_FLOATERS) return;
  // 셸이 transform: scale 로 확대되므로 화면 좌표를 셸 좌표계로 되돌린다(hint.ts 문법).
  const shellRect = shell.getBoundingClientRect();
  const scaleX = shellRect.width / Math.max(1, shell.offsetWidth);
  const scaleY = shellRect.height / Math.max(1, shell.offsetHeight);
  const rect = anchor.getBoundingClientRect();
  const centerX = (rect.left + rect.width / 2 - shellRect.left) / scaleX;
  const top = (rect.top - shellRect.top) / scaleY;
  const floater = document.createElement("span");
  floater.className = `essence-floater${calmBattlefield() ? " is-calm" : ""}`;
  floater.style.setProperty("--element", ELEMENT_STYLES[wuxing].color);
  floater.style.left = `${Math.round(centerX)}px`;
  floater.style.top = `${Math.round(top - 12 - stackIndex * 22)}px`;
  const glyph = document.createElement("i");
  glyph.textContent = wuxing;
  floater.append(glyph, `+${amount} 문기`);
  shell.append(floater);
  floaterCount += 1;
  let removed = false;
  const remove = (): void => {
    if (removed) return;
    removed = true;
    floaterCount -= 1;
    floater.remove();
  };
  floater.addEventListener("animationend", remove);
  window.setTimeout(remove, FLOATER_LIFETIME_MS);
}

function flashSummaries(): void {
  window.clearTimeout(flashTimer);
  const summaries = document.querySelectorAll<HTMLElement>("#essence-total-value, #essence-summary, #growth-resource-summary");
  for (const summary of summaries) {
    summary.classList.remove("is-essence-flash");
    // 연속 획득에도 반짝이 매번 다시 서도록 강제 리플로 후 재부착.
    void summary.offsetWidth;
    summary.classList.add("is-essence-flash");
  }
  flashTimer = window.setTimeout(() => {
    for (const summary of summaries) summary.classList.remove("is-essence-flash");
  }, FLASH_MS);
}

/** 렌더 루프가 이벤트 처리 직후 매 프레임 부른다. */
export function syncEssenceFeedback(): void {
  const phase = ctx.engine.state.phase;
  if (phase !== "prep" && phase !== "combat") {
    // 런 밖(타이틀·종료·재시작)의 상태 교체는 획득이 아니다 — 기준만 맞춘다.
    baseline = null;
    return;
  }
  if (baseline === null) {
    baseline = essenceSnapshot();
    return;
  }
  const gains: Array<[Wuxing, number]> = [];
  for (const wuxing of WUXING_ORDER) {
    const current = ctx.engine.state.elementEssence[wuxing];
    const delta = current - baseline[wuxing];
    if (delta > 0) gains.push([wuxing, delta]);
    baseline[wuxing] = current;
  }
  if (gains.length === 0) return;
  gains.forEach(([wuxing, amount], index) => spawnFloater(wuxing, amount, index));
  flashSummaries();
  // 기존 분해 SFX 재사용 1회 — 같은 프레임의 dismantle 이벤트 소리와는
  // playSfx 의 재트리거 간격(220ms)이 겹침을 걸러 준다.
  sound.playEssenceGain();
}
