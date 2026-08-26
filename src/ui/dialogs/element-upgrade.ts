/*
 * 오행 강화 창.
 */
import {
  ELEMENT_STYLES,
  elementUpgradeCost,
  globalUpgradeCost,
  MAX_UPGRADE_LEVEL,
  UPGRADE_STAT_META,
  UPGRADE_STAT_ORDER,
  WUXING_ORDER
} from "../../core/hanzi";
import { type UpgradeStat, type Wuxing } from "../../core/types";
import { ctx, elementUpgradeDialog, must, sound } from "../app-context";
import { handleAction } from "../hud";

export function formatStatBonus(stat: UpgradeStat, bonus: number): string {
  return stat === "range" ? `+${bonus.toFixed(1)}` : `+${(bonus * 100).toFixed(1)}%`;
}

export function totalGlobalUpgradeLevels(): number {
  return UPGRADE_STAT_ORDER.reduce((sum, stat) => sum + ctx.engine.state.globalUpgrades[stat], 0);
}

export function totalElementUpgradeLevels(): number {
  return WUXING_ORDER.reduce((sum, wuxing) => sum + UPGRADE_STAT_ORDER.reduce((elementSum, stat) => elementSum + ctx.engine.state.elementUpgrades[wuxing][stat], 0), 0);
}

export function upgradeStateSignature(): string {
  const global = UPGRADE_STAT_ORDER.map((stat) => ctx.engine.state.globalUpgrades[stat]).join(",");
  const elements = WUXING_ORDER.map((wuxing) => UPGRADE_STAT_ORDER.map((stat) => ctx.engine.state.elementUpgrades[wuxing][stat]).join(",")).join("|");
  const essence = WUXING_ORDER.map((wuxing) => ctx.engine.state.elementEssence[wuxing]).join(",");
  return `${ctx.engine.state.phase}:${ctx.engine.state.gold}:${global}:${elements}:${essence}`;
}

export function renderElementUpgrades(): void {
  const active = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
  const globalTotal = totalGlobalUpgradeLevels();
  must<HTMLElement>("#global-upgrade-total").textContent = `${globalTotal}단계`;
  must<HTMLElement>("#element-essence-dialog-summary").textContent = WUXING_ORDER.map((wuxing) => `${wuxing}${ctx.engine.state.elementEssence[wuxing]}`).join(" ");
  must<HTMLElement>("#global-upgrade-list").innerHTML = UPGRADE_STAT_ORDER.map((stat) => {
    const meta = UPGRADE_STAT_META[stat];
    const level = ctx.engine.state.globalUpgrades[stat];
    const cost = globalUpgradeCost(stat, level);
    const maxed = level >= MAX_UPGRADE_LEVEL;
    const bonus = ctx.engine.globalUpgradeBonus(stat);
    return `<article class="stat-upgrade-card is-global">
      <div class="stat-upgrade-glyph">${meta.glyph}</div>
      <div><strong>${meta.label} <em>Lv.${level}</em></strong><span>${meta.description}</span><small>현재 ${formatStatBonus(stat, bonus)} · 단계당 ${formatStatBonus(stat, meta.globalPerLevel)}</small></div>
      <button type="button" data-upgrade-scope="global" data-upgrade-stat="${stat}" ${!active || maxed || ctx.engine.state.gold < cost ? "disabled" : ""}><b>${maxed ? "최고" : `${cost}엽전`}</b><small>${maxed ? `Lv.${MAX_UPGRADE_LEVEL}` : `Lv.${level + 1}`}</small></button>
    </article>`;
  }).join("");
  must<HTMLElement>("#element-upgrade-list").innerHTML = WUXING_ORDER.map((wuxing) => {
    const style = ELEMENT_STYLES[wuxing];
    const elementTotal = UPGRADE_STAT_ORDER.reduce((sum, stat) => sum + ctx.engine.state.elementUpgrades[wuxing][stat], 0);
    const controls = UPGRADE_STAT_ORDER.map((stat) => {
      const meta = UPGRADE_STAT_META[stat];
      const level = ctx.engine.state.elementUpgrades[wuxing][stat];
      const cost = elementUpgradeCost(level);
      const maxed = level >= MAX_UPGRADE_LEVEL;
      const bonus = ctx.engine.elementUpgradeBonus(wuxing, stat);
      return `<button type="button" class="element-stat-button" data-upgrade-scope="element" data-upgrade-element="${wuxing}" data-upgrade-stat="${stat}" ${!active || maxed || ctx.engine.state.elementEssence[wuxing] < cost ? "disabled" : ""} title="${meta.description}">
        <i>${meta.glyph}</i><span><b>${meta.label} <em>Lv.${level}</em></b><small>${formatStatBonus(stat, bonus)}</small></span><strong>${maxed ? "최고" : `${wuxing}${cost}`}</strong>
      </button>`;
    }).join("");
    return `<article class="element-upgrade-card is-expanded" style="--upgrade:${style.color}">
      <header><div class="element-upgrade-seal"><b>${wuxing}</b><span>${style.name}행</span></div><p><strong>${elementTotal}단계</strong><small>보유 문기 ${ctx.engine.state.elementEssence[wuxing]}</small></p></header>
      <div class="element-stat-grid">${controls}</div>
    </article>`;
  }).join("");
  ctx.elementUpgradeRenderKey = upgradeStateSignature();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireElementUpgrade1(): void {
  must<HTMLButtonElement>("#element-upgrade-close").addEventListener("click", () => elementUpgradeDialog.close());
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireElementUpgrade2(): void {
  elementUpgradeDialog.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-upgrade-scope][data-upgrade-stat]");
    const stat = button?.dataset.upgradeStat as UpgradeStat | undefined;
    const scope = button?.dataset.upgradeScope;
    if (!button || !stat || (scope !== "global" && scope !== "element")) return;
    sound.unlock();
    if (scope === "global") handleAction(ctx.engine.upgradeGlobal(stat));
    else {
      const wuxing = button.dataset.upgradeElement as Wuxing | undefined;
      if (!wuxing) return;
      handleAction(ctx.engine.upgradeElement(wuxing, stat));
    }
    renderElementUpgrades();
  });
}
