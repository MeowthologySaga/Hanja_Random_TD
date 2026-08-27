/*
 * 합성/진화 패널.
 */
import { ELEMENT_STYLES, STAGE_NAMES } from "../../core/hanzi";
import { jaryeongVisualFor } from "../../core/jaryeongs";
import { type CasualStar, type EvolutionOption, type Wuxing } from "../../core/types";
import { ctx, must } from "../app-context";
import { casualStarOf, escapeHtml, visualBackgroundStyle } from "../format";
import { handleAction, setPanelTab, showToast } from "../hud";
import { openCasualManualReview, renderCasualFusion, requestCasualAutoFusionAll, runCasualAutoFusion } from "./casual-fusion";
import { ownedCharCounts, synthesisTreeMarkup } from "./goal";

export function renderEvolutions(): void {
  if (ctx.engine.state.mode === "casual") {
    renderCasualFusion();
    return;
  }
  const options = ctx.engine.availableEvolutions();
  const key = ctx.engine.state.automationMode + "|" + String(ctx.engine.state.selectedTowerId) + "|" + options.map((option) => option.recipeId + ":" + option.materialTowerIds.join(",")).join("|");
  must<HTMLElement>("#evolution-count").textContent = String(options.length);
  must<HTMLElement>("#evolution-count").hidden = false;
  must<HTMLElement>("#evolve-ready-count").textContent = String(options.length);
  const evolveButton = must<HTMLButtonElement>("#evolve-button");
  must<HTMLElement>("#evolve-action-label").textContent = "합성";
  must<HTMLElement>("#evolve-action-detail").textContent = "개 조합 확인";
  must<HTMLElement>("#evolution-tab-label").textContent = "합성";
  must<HTMLElement>("#evolution-kicker").textContent = "조합 서책";
  must<HTMLElement>("#evolution-heading-label").textContent = "현재 가능한 합성";
  must<HTMLElement>("#standard-evolution-modes").hidden = false;
  must<HTMLElement>("#casual-fusion-toolbar").hidden = true;
  must<HTMLElement>("#evolution-options").classList.remove("is-casual");
  const active = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
  evolveButton.disabled = !active || options.length === 0;
  evolveButton.classList.toggle("has-ready", options.length > 0);
  if (key === ctx.evolutionRenderKey) return;
  ctx.evolutionRenderKey = key;
  const container = must<HTMLElement>("#evolution-options");
  if (options.length === 0) {
    const manual = ctx.engine.state.automationMode === "manual";
    container.innerHTML = `<div class="empty-evolution"><b>${manual ? "전장의 한자를 선택하세요" : "재료를 모으는 중"}</b><span>${manual ? "선택한 한자가 들어가는 조합만 표시됩니다." : "목표 재료는 소환 확률이 서서히 보정됩니다."}</span></div>`
      + nextSynthesisStepMarkup();
    return;
  }
  container.innerHTML = `<p class="evolution-warning">행을 누르면 재료 자령을 소모해 바로 합성됩니다</p>` + options.slice(0, 3).map((option, index) => evolutionCard(option, index)).join("");
}

/**
 * [S/P-14] 빈 합성 탭의 「다음 한 걸음」.
 *
 * 26웨이브까지 이 탭에는 "가능한 합성 0 · 재료를 모으는 중"만 있었다.
 * 사실을 말할 뿐 다음 손을 말하지 않으니, 열어 봐도 할 일이 생기지 않는
 * 상자였다. 추적 성어의 부족 글자 중 합성으로 만드는 것을 하나 골라
 * (evolution.getTargetPath 와 같은 부모 재귀를 쓰는) 부품 트리를 펴고,
 * 지금 손에 없는 부품을 이름으로 적는다. 합성할 것이 없으면 소환할 것을
 * 적는다 — 어느 쪽이든 "다음에 무엇을 모으는가"로 끝난다.
 *
 * 그림과 어휘는 목표 서책의 표준 모드 트리를 그대로 빌린다.
 */
function nextSynthesisStepMarkup(): string {
  const engine = ctx.engine;
  const owned = ownedCharCounts();
  const towers = [...engine.state.towers, ...engine.state.inventoryTowers];
  const missing: string[] = [];
  for (const idiom of engine.trackedIdioms()) {
    for (const char of engine.idiomProgress(idiom.id).missingChars) {
      if (!missing.includes(char)) missing.push(char);
    }
  }
  if (missing.length === 0) {
    return `<section class="evolution-next-step"><h4>다음 한 걸음</h4>`
      + `<p>추적 성어의 네 글자를 모두 가지고 있습니다 — 같은 진의 한 줄에 ①→④ 순서로 세우면 발동합니다.</p>`
      + `<button type="button" data-goto-goal>목표 서책 열기</button></section>`;
  }
  const crafted = missing.filter((char) => {
    const definition = engine.catalog.definitions.get(char);
    return definition !== undefined && definition.acquisition !== "direct" && definition.parents.length > 0;
  });
  const target = crafted[0];
  if (target === undefined) {
    // 부족 글자가 전부 직접 소환분이면 합성이 아니라 소환이 다음 손이다.
    const summonable = missing.slice(0, 4).map(escapeHtml).join(" · ");
    return `<section class="evolution-next-step"><h4>다음 한 걸음 — 소환</h4>`
      + `<p>부족한 글자 <b>${summonable}</b> 는 합성이 아니라 소환으로 얻습니다. 추적 중이면 소환 확률이 이 글자들 쪽으로 기웁니다.</p>`
      + `<button type="button" data-goto-shop-step>상점 열기</button></section>`;
  }
  const progress = engine.evolution.getGoalProgress(towers, target);
  const shortages = progress.directMaterials
    .filter((material) => material.owned < material.needed)
    .sort((left, right) => (right.needed - right.owned) - (left.needed - left.owned))
    .slice(0, 5)
    .map((material) => `${escapeHtml(material.char)} ${material.needed - material.owned}기`)
    .join(" · ");
  const percent = Math.round(progress.progress * 100);
  return `<section class="evolution-next-step">
    <h4>다음 한 걸음 — <b>${escapeHtml(target)}</b> 합성 ${percent}%</h4>
    <p>${shortages ? `지금 모을 부품 <b>${shortages}</b>` : "부품은 다 모였습니다 — 이 탭의 조합 행이 곧 열립니다."}</p>
    ${synthesisTreeMarkup(target, owned)}
    <button type="button" data-goto-goal>목표 서책에서 전체 보기</button>
  </section>`;
}

function evolutionCard(option: EvolutionOption, index: number): string {
  const style = ELEMENT_STYLES[option.result.wuxing];
  const visual = jaryeongVisualFor(option.result.char, option.result.wuxing, ctx.engine.state.region);
  const abilities = option.result.combat.abilities;
  const abilitySummary = abilities.role.glyph + " " + abilities.role.name + (abilities.lineage ? " · " + abilities.lineage.glyph + " 계승" : "");
  return `
    <button class="evolution-card ${option.onTargetPath ? "is-target" : ""}" type="button" data-recipe="${option.recipeId}" style="--evo:${style.color}" title="합성 시 ${abilities.role.name}${abilities.lineage ? "와 " + abilities.lineage.name : ""} 획득">
      <span class="evolution-index">${index + 1}</span>
      <span class="recipe-parents">${option.parents.map((parent) => "<i>" + parent + "</i>").join("<em>+</em>")}</span>
      <span class="recipe-arrow">→</span>
      <span class="evolution-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <b class="recipe-result">${option.result.char}</b>
      <small>${STAGE_NAMES[option.result.stage]} · <b>${abilitySummary}</b></small>
      ${option.onTargetPath ? '<mark>목표 경로</mark>' : ""}
    </button>
  `;
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireEvolution1(): void {
  must<HTMLElement>("#evolution-options").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const casualTowerButton = target.closest<HTMLButtonElement>("[data-casual-fusion-tower]");
    if (casualTowerButton) {
      const id = Number(casualTowerButton.dataset.casualFusionTower);
      if (!Number.isInteger(id)) return;
      const index = ctx.casualFusionSelection.indexOf(id);
      if (index >= 0) {
        ctx.casualFusionSelection = ctx.casualFusionSelection.filter((towerId) => towerId !== id);
      } else {
        const tower = [...ctx.engine.state.towers, ...ctx.engine.state.inventoryTowers].find((candidate) => candidate.id === id);
        const anchor = [...ctx.engine.state.towers, ...ctx.engine.state.inventoryTowers].find((candidate) => candidate.id === ctx.casualFusionSelection[0]);
        if (!tower || ctx.casualFusionSelection.length >= 3) return;
        // v3: 보호 자령은 첫 슬롯부터 소모 대상이 될 수 없다. 모달까지 가서야
        // 알게 되는 일이 없도록 그 자리에서 사유를 말한다.
        const protection = ctx.engine.casualMaterialProtection(tower.id);
        if (protection) {
          showToast(`${tower.char}은 소모할 수 없습니다 · ${protection}`, true);
          return;
        }
        if (anchor && (tower.wuxing !== anchor.wuxing || casualStarOf(tower) !== casualStarOf(anchor))) {
          showToast(`같은 ${anchor.wuxing}행 ${casualStarOf(anchor)}★ 자령을 선택하세요.`, true);
          return;
        }
        ctx.casualFusionSelection.push(id);
      }
      ctx.evolutionRenderKey = "";
      renderCasualFusion();
      return;
    }
    const slot = target.closest<HTMLButtonElement>("[data-casual-fusion-slot]");
    if (slot) {
      const index = Number(slot.dataset.casualFusionSlot);
      ctx.casualFusionSelection = ctx.casualFusionSelection.filter((_, itemIndex) => itemIndex !== index);
      ctx.evolutionRenderKey = "";
      renderCasualFusion();
      return;
    }
    if (target.closest("#casual-fusion-review")) {
      openCasualManualReview();
      return;
    }
    const groupButton = target.closest<HTMLButtonElement>("[data-casual-group]");
    if (groupButton?.dataset.casualGroup) {
      const [wuxing, star] = groupButton.dataset.casualGroup.split(":");
      if (wuxing) runCasualAutoFusion(wuxing as Wuxing, Number(star) as CasualStar);
      return;
    }
    if (target.closest("#casual-goto-shop") || target.closest("[data-goto-shop-step]")) {
      setPanelTab("shop");
      return;
    }
    // [S/P-14] 빈 상태의 「다음 한 걸음」에서 목표 서책으로 건너간다.
    if (target.closest("[data-goto-goal]")) {
      setPanelTab("goal");
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-recipe]");
    if (button?.dataset.recipe) handleAction(ctx.engine.evolve(button.dataset.recipe));
  });
  must<HTMLElement>("#evolution-options").addEventListener("toggle", (event) => {
    const details = event.target as HTMLElement;
    if (details instanceof HTMLDetailsElement && details.id === "casual-manual-details") ctx.casualManualOpen = details.open;
  }, true);
  must<HTMLButtonElement>("#casual-fuse-all").addEventListener("click", () => requestCasualAutoFusionAll());
  must<HTMLElement>("#evolution-options").addEventListener("pointerover", (event) => {
    ctx.hoveredRecipeId = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-recipe]")?.dataset.recipe ?? null;
  });
  must<HTMLElement>("#evolution-options").addEventListener("pointerout", (event) => {
    const related = event.relatedTarget as Node | null;
    if (!related || !must<HTMLElement>("#evolution-options").contains(related)) ctx.hoveredRecipeId = null;
  });
}
