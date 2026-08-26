/*
 * 소환·3합 결과 발표막.
 */
import { CASUAL_STAR_COLORS, CASUAL_STAR_NAMES, casualStrokeCount } from "../core/casual";
import { BOARD_FORMATIONS } from "../core/content";
import { definitionForTower, ELEMENT_STYLES } from "../core/hanzi";
import { jaryeongVisualFor } from "../core/jaryeongs";
import { learningInfoForNotation } from "../core/learning";
import { type GameEvent, type Wuxing } from "../core/types";
import { ctx, fusionVortex, must, summonReveal } from "./app-context";
import { coachIsPointingAtBoard } from "./coach";
import { casualStarOf, escapeHtml, visualBackgroundStyle } from "./format";

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
    ? "런 인벤토리 보관"
    : boardCount === events.length
      ? "소모 자리 자동 배치"
      : `전장 ${boardCount} · 인벤 ${events.length - boardCount}`;
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
      <b>${escapeHtml(learning.short)}</b>
      <small>${style.name}행 · ${star}★ ${CASUAL_STAR_NAMES[star]} · ${casualStrokeCount(tower.char) ?? "?"}획</small>
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
  if (events.length === 1) ctx.summonRevealTimer = window.setTimeout(hideSummonReveal, 3800);
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
      ? "런 인벤토리 보관"
      : `전장 ${events.length - storedCount} · 인벤 ${storedCount}`;
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
    return `<article class="summon-result-card ${event.newDiscovery ? "is-new" : ""} ${event.helpful ? "is-helpful" : ""}" style="--summon:${style.color};--summon-star:${CASUAL_STAR_COLORS[star]};--summon-delay:${index * 45}ms">
      <span class="summon-result-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <strong>${tower.char}</strong>
      <b>${escapeHtml(learning.short)}</b>
      <small>${style.name}행 · ${ctx.engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]} · ${casualStrokeCount(tower.char) ?? "?"}획` : escapeHtml(definition.combat.roleLabel)}</small>
      <div><em>${utilityLabel}</em>${helpfulLabel ? `<mark>${helpfulLabel}</mark>` : ""}</div>
    </article>`;
  }).join("");
  summonReveal.classList.toggle("is-batch", events.length > 1);
  summonReveal.classList.remove("is-active");
  void summonReveal.offsetWidth;
  summonReveal.classList.add("is-active");
  summonReveal.setAttribute("aria-hidden", "false");
  if (events.length === 1) ctx.summonRevealTimer = window.setTimeout(hideSummonReveal, 3800);
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireSummonReveal1(): void {
  must<HTMLButtonElement>("#summon-reveal-close").addEventListener("click", hideSummonReveal);
  document.addEventListener("pointerdown", () => {
    if (summonReveal.classList.contains("is-active")) hideSummonReveal();
  });
}
