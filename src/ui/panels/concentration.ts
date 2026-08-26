/*
 * 농축 패널.
 */
import { BOARD_FORMATIONS, CELLS_PER_FORMATION } from "../../core/content";
import {
  autoConcentrationPath,
  concentrationEssenceCost,
  concentrationPathLabel,
  MAX_CONCENTRATION_LEVEL
} from "../../core/game";
import { ELEMENT_STYLES, ROLE_LABELS, WUXING_ORDER } from "../../core/hanzi";
import { type Tower } from "../../core/types";
import { ctx, must } from "../app-context";
import { casualStarOf, escapeHtml, spiritPortraitMarkup, towerProgressionLabel } from "../format";
import { handleAction } from "../hud";

function concentrationStateSignature(): string {
  const towers = [...ctx.engine.state.towers, ...ctx.engine.state.inventoryTowers]
    .map((tower) => `${tower.id}:${tower.char}:${tower.cell}:${tower.locked ? 1 : 0}:${tower.concentration ?? 0}:${tower.concentrationPath ?? "-"}`)
    .join("|");
  return `${ctx.engine.state.phase}:${towers}:${WUXING_ORDER.map((wuxing) => ctx.engine.state.elementEssence[wuxing]).join(",")}:${ctx.concentrationTargetId ?? "-"}:${ctx.concentrationPayment}`;
}

/**
 * "왜 이 농축인가"를 한 줄로 적는다.
 *
 * 분기 선택 카드를 걷어낸 자리에는 설명이 남아야 한다 — 역할이 방향을 정했고,
 * 그 방향이 무엇을 얼마나 올리는지가 비교표 바로 위에서 늘 보인다.
 */
function concentrationIdentityMarkup(tower: Tower): string {
  const path = autoConcentrationPath(tower);
  const gain = path === "swift" ? "+7.5%/濃" : "+12%/濃";
  const detail = path === "swift"
    ? "공격 대기 감소 · 濃당 피해 +5.5% · 사거리 +4"
    : "피해 상승 · 濃당 대기 -2% · 의미 기술 +3.5% · 사거리 +4";
  const roleDefault = tower.combatRole === "rapid" || tower.combatRole === "support" ? "swift" : "potent";
  const legacy = tower.concentrationPath !== null && tower.concentrationPath !== undefined && tower.concentrationPath !== roleDefault;
  return `<p class="concentration-identity">
    <b>${ROLE_LABELS[tower.combatRole]}형 자령 — ${concentrationPathLabel(path)} <i>(${gain})</i></b>
    <small>${detail}</small>
    <small>${legacy ? "이전 런에서 고정된 방향이라 그대로 이어집니다." : "연사·지원은 공속, 나머지는 피해 — 역할이 방향을 정합니다."}</small>
  </p>`;
}

export function renderConcentration(): void {
  const allTowers = [...ctx.engine.state.towers, ...ctx.engine.state.inventoryTowers];
  if (ctx.concentrationTargetId === null || !allTowers.some((tower) => tower.id === ctx.concentrationTargetId)) {
    ctx.concentrationTargetId = ctx.engine.selectedTower()?.id ?? allTowers[0]?.id ?? null;
  }
  const key = concentrationStateSignature();
  if (key === ctx.concentrationRenderKey) return;
  ctx.concentrationRenderKey = key;
  const rows = allTowers.map((tower) => {
    const level = tower.concentration ?? 0;
    const duplicateCount = ctx.engine.state.inventoryTowers.filter((candidate) => candidate.id !== tower.id && candidate.char === tower.char && !candidate.locked).length;
    const cost = concentrationEssenceCost(level);
    const maxed = level >= MAX_CONCENTRATION_LEVEL;
    const actionable = !maxed && (duplicateCount > 0 || ctx.engine.state.elementEssence[tower.wuxing] >= cost);
    return { tower, level, duplicateCount, cost, maxed, actionable, rank: maxed ? 2 : actionable ? 0 : 1 };
  }).sort((left, right) => left.rank - right.rank || right.level - left.level || casualStarOf(right.tower) - casualStarOf(left.tower) || right.tower.stage - left.tower.stage || left.tower.id - right.tower.id);

  must<HTMLElement>("#concentration-target-summary").textContent = `${rows.filter((row) => row.actionable).length}기 가능 · 총 ${rows.length}기`;
  must<HTMLElement>("#concentration-panel-summary").textContent = `농축 가능 ${rows.filter((row) => row.actionable).length}기 · 총 ${rows.length}기`;
  must<HTMLElement>("#concentration-target-list").innerHTML = rows.length > 0 ? rows.map(({ tower, level, duplicateCount, cost, maxed, actionable }) => {
    const stateLabel = maxed ? "최대 단계" : actionable ? "농축 가능" : "재료 부족";
    return `<button type="button" data-concentration-target="${tower.id}" class="${tower.id === ctx.concentrationTargetId ? "is-selected" : ""} ${actionable ? "is-ready" : ""}" style="--element:${ELEMENT_STYLES[tower.wuxing].color}">
      ${spiritPortraitMarkup(tower.char, tower.wuxing, "workbench-spirit--target")}<b>${escapeHtml(tower.char)}</b><span><strong>${tower.wuxing}행 · ${towerProgressionLabel(tower)} · 濃 ${level}/3</strong><small>${tower.cell < 0 ? "인벤토리" : `${BOARD_FORMATIONS[Math.floor(tower.cell / CELLS_PER_FORMATION)]?.label ?? "전장"} 배치`} · ${duplicateCount > 0 ? `중복 ${duplicateCount}기` : `문기 ${cost}`}</small></span><em>${stateLabel}</em>
    </button>`;
  }).join("") : `<div class="workbench-empty"><b>농축할 자령이 없습니다</b><span>상점에서 자령을 먼저 소환하세요.</span></div>`;

  const detail = must<HTMLElement>("#concentration-detail");
  const target = allTowers.find((tower) => tower.id === ctx.concentrationTargetId);
  if (!target) {
    detail.innerHTML = `<div class="workbench-empty"><b>대상을 선택하세요</b><span>전장과 인벤토리 자령을 모두 확인할 수 있습니다.</span></div>`;
    return;
  }
  // 방향은 사람이 고르지 않는다 — 역할이 정하고, 이미 박힌 자령은 그대로 간다.
  const path = autoConcentrationPath(target);
  const quote = ctx.engine.concentrationQuote(target.id, path);
  if (quote && typeof ctx.concentrationPayment === "number" && !quote.duplicateIds.includes(ctx.concentrationPayment)) ctx.concentrationPayment = "essence";
  const currentLevel = target.concentration ?? 0;
  if (!quote) {
    detail.innerHTML = `<article class="concentration-max-card" style="--element:${ELEMENT_STYLES[target.wuxing].color}"><b>${escapeHtml(target.char)}</b><div><span>${target.wuxing}행 · ${towerProgressionLabel(target)}</span><strong>濃 ${currentLevel}/3 · ${concentrationPathLabel(path)} 완성</strong><small>더 이상 재료를 소모하지 않습니다.</small></div></article>`;
    return;
  }
  const essenceAvailable = ctx.engine.state.elementEssence[target.wuxing] >= quote.essenceCost;
  const duplicatePaymentAvailable = typeof ctx.concentrationPayment === "number" && quote.duplicateIds.includes(ctx.concentrationPayment);
  const paymentReady = ctx.concentrationPayment === "essence" ? essenceAvailable : duplicatePaymentAvailable;
  const paymentRows = quote.duplicateIds.map((id) => {
    const duplicate = ctx.engine.state.inventoryTowers.find((tower) => tower.id === id);
    if (!duplicate) return "";
    return `<label class="payment-option ${ctx.concentrationPayment === id ? "is-selected" : ""}"><input type="radio" name="concentration-payment" value="${id}" ${ctx.concentrationPayment === id ? "checked" : ""}><b>${escapeHtml(duplicate.char)}</b><span>인벤 중복 #${id}</span><small>잠금 없음 · 명시적 소모</small></label>`;
  }).join("");
  detail.innerHTML = `
    <article class="concentration-focus" style="--element:${ELEMENT_STYLES[target.wuxing].color}">
      <header>${spiritPortraitMarkup(target.char, target.wuxing, "workbench-spirit--focus")}<b>${escapeHtml(target.char)}</b><div><span>${target.wuxing}행 · ${towerProgressionLabel(target)} · ${target.cell < 0 ? "인벤토리" : "전장"}</span><strong>濃 ${quote.currentLevel} → ${quote.nextLevel}</strong><small>${ROLE_LABELS[target.combatRole]} · ${concentrationPathLabel(path)}</small></div></header>
      ${concentrationIdentityMarkup(target)}
      <div class="concentration-compare">
        <div><span>공격력</span><b>${Math.round(quote.current.damage)}</b><i>→</i><strong>${Math.round(quote.next.damage)}</strong></div>
        <div><span>초당 공격</span><b>${quote.current.attacksPerSecond.toFixed(1)}</b><i>→</i><strong>${quote.next.attacksPerSecond.toFixed(1)}</strong></div>
        <div><span>사거리</span><b>${Math.round(quote.current.range)}</b><i>→</i><strong>${Math.round(quote.next.range)}</strong></div>
        <div><span>기술 효과</span><b>${Math.round((quote.current.abilityEffect - 1) * 100)}%</b><i>→</i><strong>${Math.round((quote.next.abilityEffect - 1) * 100)}%</strong></div>
      </div>
      <section class="concentration-payment"><div class="subheading"><b>② 재료 지불</b><small>전장 자령과 잠긴 자령은 후보에서 제외</small></div><div class="payment-grid">
        ${paymentRows}
        <label class="payment-option is-essence ${ctx.concentrationPayment === "essence" ? "is-selected" : ""} ${essenceAvailable ? "" : "is-unavailable"}"><input type="radio" name="concentration-payment" value="essence" ${ctx.concentrationPayment === "essence" ? "checked" : ""} ${essenceAvailable ? "" : "disabled"}><b>${target.wuxing}</b><span>${target.wuxing} 문기 ${quote.essenceCost}</span><small>보유 ${ctx.engine.state.elementEssence[target.wuxing]}</small></label>
      </div></section>
      <button id="concentration-confirm-button" class="workbench-primary" type="button" ${paymentReady ? "" : "disabled"}>濃 ${quote.currentLevel} → ${quote.nextLevel} 농축 실행</button>
    </article>`;
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireConcentration1(): void {
  must<HTMLElement>("#concentration-layout").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const targetId = Number(target.closest<HTMLButtonElement>("[data-concentration-target]")?.dataset.concentrationTarget);
    if (Number.isInteger(targetId)) {
      ctx.concentrationTargetId = targetId;
      ctx.engine.selectTower(targetId);
      ctx.concentrationPayment = "essence";
      ctx.concentrationRenderKey = "";
      renderConcentration();
      return;
    }
    if (!target.closest("#concentration-confirm-button") || ctx.concentrationTargetId === null) return;
    const selected = ctx.engine.selectedTower();
    if (!selected || selected.id !== ctx.concentrationTargetId) return;
    // 되돌릴 수 없는 선택지가 사라졌으므로 확인 대화상자도 함께 걷는다.
    const concentrationPath = autoConcentrationPath(selected);
    const payment = ctx.concentrationPayment === "essence"
      ? { kind: "essence" as const }
      : { kind: "duplicate" as const, towerId: ctx.concentrationPayment };
    handleAction(ctx.engine.concentrateTower(ctx.concentrationTargetId, concentrationPath, payment));
  });
  must<HTMLElement>("#concentration-layout").addEventListener("change", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[name="concentration-payment"]');
    if (!input) return;
    ctx.concentrationPayment = input.value === "essence" ? "essence" : Number(input.value);
    ctx.concentrationRenderKey = "";
    renderConcentration();
  });
}
