/*
 * 합성/진화 패널.
 */
import { ELEMENT_STYLES, STAGE_NAMES } from "../../core/hanzi";
import { jaryeongVisualFor } from "../../core/jaryeongs";
import { type CasualStar, type EvolutionOption, type Wuxing } from "../../core/types";
import { ctx, must } from "../app-context";
import { casualStarOf, visualBackgroundStyle } from "../format";
import { handleAction, setPanelTab, showToast } from "../hud";
import { openCasualManualReview, renderCasualFusion, runCasualAutoFusion } from "./casual-fusion";

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
    container.innerHTML = `<div class="empty-evolution"><b>${manual ? "전장의 한자를 선택하세요" : "재료를 모으는 중"}</b><span>${manual ? "선택한 한자가 들어가는 조합만 표시됩니다." : "목표 재료는 소환 확률이 서서히 보정됩니다."}</span></div>`;
    return;
  }
  container.innerHTML = `<p class="evolution-warning">행을 누르면 재료 자령을 소모해 바로 합성됩니다</p>` + options.slice(0, 3).map((option, index) => evolutionCard(option, index)).join("");
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
    if (target.closest("#casual-goto-shop")) {
      setPanelTab("shop");
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-recipe]");
    if (button?.dataset.recipe) handleAction(ctx.engine.evolve(button.dataset.recipe));
  });
  must<HTMLElement>("#evolution-options").addEventListener("toggle", (event) => {
    const details = event.target as HTMLElement;
    if (details instanceof HTMLDetailsElement && details.id === "casual-manual-details") ctx.casualManualOpen = details.open;
  }, true);
  must<HTMLButtonElement>("#casual-fuse-all").addEventListener("click", () => runCasualAutoFusion("all", null));
  must<HTMLElement>("#evolution-options").addEventListener("pointerover", (event) => {
    ctx.hoveredRecipeId = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-recipe]")?.dataset.recipe ?? null;
  });
  must<HTMLElement>("#evolution-options").addEventListener("pointerout", (event) => {
    const related = event.relatedTarget as Node | null;
    if (!related || !must<HTMLElement>("#evolution-options").contains(related)) ctx.hoveredRecipeId = null;
  });
}
