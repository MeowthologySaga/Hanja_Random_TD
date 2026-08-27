/*
 * 소환·3합 결과 발표막.
 */
import { CASUAL_STAR_COLORS, CASUAL_STAR_NAMES, casualStrokeCount } from "../core/casual";
import { BOARD_FORMATIONS } from "../core/content";
import { definitionForTower, ELEMENT_STYLES } from "../core/hanzi";
import { jaryeongVisualFor } from "../core/jaryeongs";
import { learningInfoForNotation } from "../core/learning";
import { notationShortHtml } from "./notation-substitute";
import { type GameEvent, type Wuxing } from "../core/types";
import { ctx, fusionVortex, must, summonReveal } from "./app-context";
import { coachIsPointingAtBoard } from "./coach";
import { casualStarOf, escapeHtml, visualBackgroundStyle } from "./format";

/**
 * 다장 연출이 스스로 걷히는 시간(ms).
 *
 * [2차 감사] 일괄·10연 연출에는 자동 숨김이 아예 없었다(`events.length === 1`
 * 분기). 연출이 서 있는 동안 전투는 멈춰 있으므로, 클릭할 때까지 정지가
 * 무기한 이어졌다 — 자리를 비우면 판이 그대로 얼어붙는다.
 *
 * 사람이 읽을 시간을 재서 정했다(1280×720, 10연 실측).
 *   · 카드가 다 올라오는 데 0.38s 상승 + 45ms 씩 밀린 등장 → 10장에 785ms.
 *   · 카드 한 장의 글자 수는 평균 19자("戶 지게 호 토행 · 중타격 NEW목표 재료"),
 *     10장 합계 190자에 머리말(제목+요약)이 31자 더 붙는다.
 *   · 격자는 칸마다 같은 자리에 같은 항목이 오므로 한 장을 통째로 읽는 것이
 *     아니라 훑는다. 한 장에 3회 응시(≈200ms)로 600ms 를 잡는다.
 *   · 한 장짜리 연출의 기존 값 3,800ms 는 그대로 두고, 장이 늘 때마다
 *     650ms(응시 600 + 등장 밀림 45, 올림)를 더한다.
 * → 10연 9,650ms · 3합 3장 5,100ms. 상한 12초는 그보다 큰 묶음이 들어와도
 *   판이 오래 얼지 않게 두는 못이다(누르면 언제든 즉시 걷힌다).
 */
export function summonRevealHoldMs(cardCount: number): number {
  const cards = Math.max(1, Math.floor(cardCount));
  return Math.min(12_000, 3_800 + 650 * (cards - 1));
}

export function hideSummonReveal(): void {
  window.clearTimeout(ctx.summonRevealTimer);
  window.clearTimeout(ctx.fusionVortexTimer);
  summonReveal.classList.remove("is-active", "is-batch", "is-fusion");
  fusionVortex.classList.remove("is-active");
  summonReveal.setAttribute("aria-hidden", "true");
}

/**
 * v5 팩의 `fusion-vortex-v1.png` 를 공개 순간에 겹친다. 명세의 100–420ms 구간을
 * CSS 애니메이션으로 맡기고(prefers-reduced-motion 이면 회전 없이 페이드),
 * 파일이 없으면 클래스만 붙었다 떨어지므로 기존 소환 광채로 자연히 폴백된다.
 */
function playFusionVortex(wuxing: Wuxing): void {
  window.clearTimeout(ctx.fusionVortexTimer);
  fusionVortex.style.setProperty("--vortex-tint", ELEMENT_STYLES[wuxing].color);
  fusionVortex.classList.remove("is-active");
  void fusionVortex.offsetWidth;
  fusionVortex.classList.add("is-active");
  ctx.fusionVortexTimer = window.setTimeout(() => fusionVortex.classList.remove("is-active"), 520);
}

/**
 * 3합 획득도 뽑기와 같은 공개 카드로 보여 준다. 무작위 결과라 "무엇이 나왔는지"가
 * 토스트 한 줄로 흘러가면 안 된다.
 */
export function showCasualFusionReveal(events: Array<Extract<GameEvent, { type: "casualFuse" }>>): void {
  if (events.length === 0) return;
  window.clearTimeout(ctx.summonRevealTimer);
  const first = events[0] as Extract<GameEvent, { type: "casualFuse" }>;
  const newCount = events.filter((event) => event.newDiscovery).length;
  const boardCount = events.filter((event) => event.tower.cell >= 0).length;
  const placementLabel = boardCount === 0
    ? "가방 보관"
    : boardCount === events.length
      ? "소모 자리 자동 배치"
      : `전장 ${boardCount} · 가방 ${events.length - boardCount}`;
  must<HTMLElement>("#summon-reveal-kicker").textContent = "3합 승급 결과";
  must<HTMLElement>("#summon-reveal-title").textContent = events.length > 1
    ? `${events.length}회 승급 결과`
    : `${first.tower.char} 자령 획득`;
  const fallbackNote = first.starFallback
    ? `<strong>${first.fromStar + 1}★ 글자가 없어 ${first.toStar}★에서 뽑음</strong>`
    : first.rosterFallback
      ? `<strong>소환 풀에 없어 지역 로스터에서 보충</strong>`
      : "";
  must<HTMLElement>("#summon-reveal-summary").innerHTML = `${fallbackNote}<b>첫 발견 ${newCount}</b><span>소모 ${events.length * 3}기</span><span>${first.tower.wuxing}행 ${first.fromStar}★×3</span><em>${placementLabel}</em>`;
  must<HTMLElement>("#summon-reveal-list").innerHTML = events.map((event, index) => {
    const tower = event.tower;
    const style = ELEMENT_STYLES[tower.wuxing];
    const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
    const learning = learningInfoForNotation(ctx.engine.state.notation, tower.char);
    const star = casualStarOf(tower);
    return `<article class="summon-result-card is-fusion ${event.newDiscovery ? "is-new" : "is-helpful"}" style="--summon:${style.color};--summon-star:${CASUAL_STAR_COLORS[star]};--summon-delay:${index * 45}ms">
      <span class="summon-result-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <strong>${escapeHtml(tower.char)}</strong>
      <b>${notationShortHtml(learning, ctx.engine.state.notation)}</b>
      <!-- 등급 이름(숙련·희귀…)은 별 수와 겹치는 말이라 걷었다. 한 줄에 넣으려고
           욱여넣으면 끝의 **획수**가 잘려 나가는데(실측 14~20px), 획수는 이 게임에서
           별을 정하는 값이라 학습자에게 가장 쓸모 있는 정보다. 이름은 카드 배지에 남는다. -->
      <small title="${style.name}행 · ${star}★ ${CASUAL_STAR_NAMES[star]}">${style.name}행 · ${star}★ · ${casualStrokeCount(tower.char) ?? "?"}획</small>
      <div><em>${event.newDiscovery ? "NEW" : "무작위 획득"}</em><mark>${escapeHtml(event.consumed.map((consumed) => consumed.char).join("·"))} 소모</mark></div>
    </article>`;
  }).join("");
  summonReveal.classList.toggle("is-batch", events.length > 1);
  summonReveal.classList.add("is-fusion");
  summonReveal.classList.remove("is-active");
  void summonReveal.offsetWidth;
  summonReveal.classList.add("is-active");
  summonReveal.setAttribute("aria-hidden", "false");
  playFusionVortex(first.tower.wuxing);
  ctx.summonRevealTimer = window.setTimeout(hideSummonReveal, summonRevealHoldMs(events.length));
}

export function showSummonReveal(events: Array<Extract<GameEvent, { type: "summon" }>>): void {
  if (events.length === 0) return;
  // 코치가 전장 조작을 안내하는 동안에는 카드가 스포트라이트를 덮고
  // wheel 을 삼키므로 아예 띄우지 않는다.
  if (coachIsPointingAtBoard()) {
    hideSummonReveal();
    return;
  }
  window.clearTimeout(ctx.summonRevealTimer);
  window.clearTimeout(ctx.fusionVortexTimer);
  fusionVortex.classList.remove("is-active");
  summonReveal.classList.remove("is-fusion");
  must<HTMLElement>("#summon-reveal-kicker").textContent = "소환 결과";
  const newCount = events.filter((event) => event.newDiscovery).length;
  const helpfulCount = events.filter((event) => event.helpful).length;
  const concentrationCount = events.filter((event) => event.utility === "concentration").length;
  const storedCount = events.filter((event) => event.stored).length;
  const placementLabel = storedCount === 0
    ? "전장 자동 배치"
    : storedCount === events.length
      ? "가방 보관"
      : `전장 ${events.length - storedCount} · 가방 ${storedCount}`;
  must<HTMLElement>("#summon-reveal-title").textContent = events.length > 1 ? `${events.length}연 소환 결과` : `${events[0]?.tower.char ?? "?"} 자령 출현`;
  const firstSummon = ctx.engine.state.summonCount === events.length && ctx.engine.state.startingFormationIndex !== null;
  const startingFormation = firstSummon ? BOARD_FORMATIONS[ctx.engine.state.startingFormationIndex ?? -1] : undefined;
  const openingResult = firstSummon && startingFormation
    ? `<strong>${events[0]?.tower.wuxing ?? "?"} 자령 출현 → ${startingFormation.label} 무료 개방</strong>`
    : "";
  must<HTMLElement>("#summon-reveal-summary").innerHTML = `${openingResult}<b>새 발견 ${newCount}</b><span>${ctx.engine.state.mode === "casual" ? "목표·성어" : "합성 재료"} ${helpfulCount}</span><span>중복 ${concentrationCount}</span><em>${placementLabel}</em>`;
  must<HTMLElement>("#summon-reveal-list").innerHTML = events.map((event, index) => {
    const tower = event.tower;
    const definition = definitionForTower(ctx.engine.catalog, tower.definitionId);
    const style = ELEMENT_STYLES[tower.wuxing];
    const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
    const learning = learningInfoForNotation(ctx.engine.state.notation, tower.char);
    const helpfulLabel = event.helpfulReason === "both" ? "목표·성어" : event.helpfulReason === "goal" ? "목표 재료" : event.helpfulReason === "idiom" ? "성어 재료" : "";
    const utilityLabel = event.utility === "new" ? "NEW" : event.utility === "synthesis" ? ctx.engine.state.mode === "casual" ? "목표" : "합성" : event.utility === "concentration" ? "중복" : "교체 후보";
    const star = casualStarOf(tower);
    // 잭팟(소프트 상한 위 별)은 카드 한 장에 별색 강조 1개만 얹는다 — calm-screen 존중.
    return `<article class="summon-result-card ${event.newDiscovery ? "is-new" : ""} ${event.helpful ? "is-helpful" : ""} ${event.jackpot ? "is-jackpot" : ""}" style="--summon:${style.color};--summon-star:${CASUAL_STAR_COLORS[star]};--summon-delay:${index * 45}ms">
      <span class="summon-result-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <strong>${tower.char}</strong>
      <b>${notationShortHtml(learning, ctx.engine.state.notation)}</b>
      <small title="${style.name}행 · ${star}★ ${CASUAL_STAR_NAMES[star]}">${style.name}행 · ${ctx.engine.state.mode === "casual" ? `${star}★ · ${casualStrokeCount(tower.char) ?? "?"}획` : escapeHtml(definition.combat.roleLabel)}</small>
      <div><em>${utilityLabel}</em>${event.jackpot ? `<mark class="summon-jackpot">상한 돌파</mark>` : ""}${helpfulLabel ? `<mark>${helpfulLabel}</mark>` : ""}</div>
    </article>`;
  }).join("");
  summonReveal.classList.toggle("is-batch", events.length > 1);
  summonReveal.classList.remove("is-active");
  void summonReveal.offsetWidth;
  summonReveal.classList.add("is-active");
  summonReveal.setAttribute("aria-hidden", "false");
  ctx.summonRevealTimer = window.setTimeout(hideSummonReveal, summonRevealHoldMs(events.length));
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireSummonReveal1(): void {
  must<HTMLButtonElement>("#summon-reveal-close").addEventListener("click", hideSummonReveal);
  document.addEventListener("pointerdown", () => {
    if (summonReveal.classList.contains("is-active")) hideSummonReveal();
  });
  /*
   * [2차 감사] 연출은 `<dialog>` 가 아니라 화면을 덮는 `<section>` 이라
   * Esc 를 받는 이가 아무도 없었다 — 설정·도움말·도감·S13 은 다 닫히는데
   * 이것만 안 닫혔다. 게다가 전투를 멈춰 세우고 있으므로 "닫는 법을 모르겠다"
   * 가 곧 "판이 멈춰 있다"가 된다.
   *
   * 캡처 단계에서 받아 전파를 끊는다. 집중 프레임의 Esc(ui/hud.ts)는 window
   * 버블 단계라, 끊지 않으면 한 번의 Esc 가 연출과 프레임을 함께 걷는다.
   * 열려 있는 창(dialog)은 연출보다 안쪽 층위(top layer)이므로 양보한다 —
   * 그 창의 Esc 를 가로채면 창이 안 닫힌다.
   */
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (!summonReveal.classList.contains("is-active")) return;
    if (document.querySelector("dialog[open]") !== null) return;
    event.preventDefault();
    event.stopPropagation();
    hideSummonReveal();
  }, { capture: true });
}
