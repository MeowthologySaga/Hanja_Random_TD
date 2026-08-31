/*
 * 농축 패널.
 */
import { BOARD_FORMATIONS, CELLS_PER_FORMATION } from "../../core/content";
import {
  autoConcentrationPath,
  concentrationEssenceCost,
  concentrationPathLabel,
} from "../../core/game";
import { ELEMENT_STYLES, ROLE_LABELS, WUXING_ORDER } from "../../core/hanzi";
import { type Tower } from "../../core/types";
import { ctx, must } from "../app-context";
import { casualStarOf, escapeHtml, spiritPortraitMarkup, towerProgressionLabel } from "../format";
import { handleAction } from "../hud";

// 사용자가 라디오로 지불을 직접 골랐는지. 안 골랐으면 렌더가 중복 우선으로
// 기본값을 되정한다. 이 패널만 쓰는 상태라 ctx 로 올리지 않는다.
let concentrationPaymentChosen = false;

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
    // 화면이 적는 값도 감면을 반영해야 한다 — 목록에 원가를 적고 상세에서
    // 반값을 적으면 사람이 두 수를 보고 어느 쪽이 참인지 모른다.
    const holding = ctx.engine.isTowerHoldingIdiom(tower.id);
    const cost = holding ? Math.max(1, Math.ceil(concentrationEssenceCost(level) / 2)) : concentrationEssenceCost(level);
    // 농축에는 상한이 없다 — 「완성」이라는 상태 자체가 사라졌다. 남은 구분은
    // 지금 재료가 되느냐뿐이다.
    const actionable = duplicateCount > 0 || ctx.engine.state.elementEssence[tower.wuxing] >= cost;
    return { tower, level, duplicateCount, cost, holding, actionable, rank: actionable ? 0 : 1 };
  }).sort((left, right) => left.rank - right.rank || right.level - left.level || casualStarOf(right.tower) - casualStarOf(left.tower) || right.tower.stage - left.tower.stage || left.tower.id - right.tower.id);

  must<HTMLElement>("#concentration-target-summary").textContent = `${rows.filter((row) => row.actionable).length}기 가능 · 총 ${rows.length}기`;
  must<HTMLElement>("#concentration-panel-summary").textContent = `농축 가능 ${rows.filter((row) => row.actionable).length}기 · 총 ${rows.length}기`;
  must<HTMLElement>("#concentration-target-list").innerHTML = rows.length > 0 ? rows.map(({ tower, level, duplicateCount, cost, holding, actionable }) => {
    const stateLabel = actionable ? "농축 가능" : "재료 부족";
    return `<button type="button" data-concentration-target="${tower.id}" class="${tower.id === ctx.concentrationTargetId ? "is-selected" : ""} ${actionable ? "is-ready" : ""}" style="--element:${ELEMENT_STYLES[tower.wuxing].color}">
      ${spiritPortraitMarkup(tower.char, tower.wuxing, "workbench-spirit--target")}<b>${escapeHtml(tower.char)}</b><span><strong>${tower.wuxing}행 · ${towerProgressionLabel(tower)} · 濃 ${level}</strong><small>${tower.cell < 0 ? "가방" : `${BOARD_FORMATIONS[Math.floor(tower.cell / CELLS_PER_FORMATION)]?.label ?? "전장"} 배치`} · ${duplicateCount > 0 ? `중복 ${duplicateCount}기` : `문기 ${cost}${holding ? " (성어 감면)" : ""}`}</small></span><em>${stateLabel}</em>
    </button>`;
  }).join("") : `<div class="workbench-empty"><b>농축할 자령이 없습니다</b><span>상점에서 자령을 먼저 소환하세요.</span></div>`;

  const detail = must<HTMLElement>("#concentration-detail");
  const target = allTowers.find((tower) => tower.id === ctx.concentrationTargetId);
  if (!target) {
    detail.innerHTML = `<div class="workbench-empty"><b>대상을 선택하세요</b><span>전장과 가방 자령을 모두 확인할 수 있습니다.</span></div>`;
    return;
  }
  // 방향은 사람이 고르지 않는다 — 역할이 정하고, 이미 박힌 자령은 그대로 간다.
  const path = autoConcentrationPath(target);
  const quote = ctx.engine.concentrationQuote(target.id, path);
  // 중복 재료가 이 화면의 존재 이유다(중복 소환 카드가 여기로 흘러온다).
  // 사용자가 문기를 직접 고르지 않았다면 언제나 중복이 기본 선택이고,
  // 고른 중복이 사라졌을 때도 다음 중복으로 넘어간다.
  if (quote) {
    const chosenDuplicateGone = typeof ctx.concentrationPayment === "number" && !quote.duplicateIds.includes(ctx.concentrationPayment);
    if (chosenDuplicateGone) concentrationPaymentChosen = false;
    if (!concentrationPaymentChosen || chosenDuplicateGone) ctx.concentrationPayment = quote.duplicateIds[0] ?? "essence";
  }
  const currentLevel = target.concentration ?? 0;
  if (!quote) {
    // 상한이 없으니 견적이 없다는 것은 방향이 어긋났다는 뜻뿐이다.
    detail.innerHTML = `<article class="concentration-max-card" style="--element:${ELEMENT_STYLES[target.wuxing].color}"><b>${escapeHtml(target.char)}</b><div><span>${target.wuxing}행 · ${towerProgressionLabel(target)}</span><strong>濃 ${currentLevel} · ${concentrationPathLabel(path)} 고정</strong><small>이 자령의 농축 방향은 이미 정해져 있습니다.</small></div></article>`;
    return;
  }
  const essenceAvailable = ctx.engine.state.elementEssence[target.wuxing] >= quote.essenceCost;
  const duplicatePaymentAvailable = typeof ctx.concentrationPayment === "number" && quote.duplicateIds.includes(ctx.concentrationPayment);
  const paymentReady = ctx.concentrationPayment === "essence" ? essenceAvailable : duplicatePaymentAvailable;
  const paymentRows = quote.duplicateIds.map((id) => {
    const duplicate = ctx.engine.state.inventoryTowers.find((tower) => tower.id === id);
    if (!duplicate) return "";
    return `<label class="payment-option ${ctx.concentrationPayment === id ? "is-selected" : ""}"><input type="radio" name="concentration-payment" value="${id}" ${ctx.concentrationPayment === id ? "checked" : ""}><b>${escapeHtml(duplicate.char)}</b><span>같은 한자 중복 소모</span><small>기본 재료 · 중복 소환으로 수급</small></label>`;
  }).join("");
  detail.innerHTML = `
    <article class="concentration-focus" style="--element:${ELEMENT_STYLES[target.wuxing].color}">
      <header>${spiritPortraitMarkup(target.char, target.wuxing, "workbench-spirit--focus")}<b>${escapeHtml(target.char)}</b><div><span>${target.wuxing}행 · ${towerProgressionLabel(target)} · ${target.cell < 0 ? "가방" : "전장"}</span><strong>濃 ${quote.currentLevel} → ${quote.nextLevel}</strong><small>${ROLE_LABELS[target.combatRole]} · ${concentrationPathLabel(path)}</small></div></header>
      ${concentrationIdentityMarkup(target)}
      <div class="concentration-compare">
        <div><span>공격력</span><b>${Math.round(quote.current.damage)}</b><i>→</i><strong>${Math.round(quote.next.damage)}</strong></div>
        <div><span>초당 공격</span><b>${quote.current.attacksPerSecond.toFixed(1)}</b><i>→</i><strong>${quote.next.attacksPerSecond.toFixed(1)}</strong></div>
        <div><span>사거리</span><b>${Math.round(quote.current.range)}</b><i>→</i><strong>${Math.round(quote.next.range)}</strong></div>
        <div><span>기술 효과</span><b>${Math.round((quote.current.abilityEffect - 1) * 100)}%</b><i>→</i><strong>${Math.round((quote.next.abilityEffect - 1) * 100)}%</strong></div>
      </div>
      <section class="concentration-payment"><div class="subheading"><b>② 재료 지불</b><small>같은 한자 중복이 기본 재료 — 문기는 비싼 대체</small></div><div class="payment-grid">
        ${paymentRows}
        <label class="payment-option is-essence ${ctx.concentrationPayment === "essence" ? "is-selected" : ""} ${essenceAvailable ? "" : "is-unavailable"}"><input type="radio" name="concentration-payment" value="essence" ${ctx.concentrationPayment === "essence" ? "checked" : ""} ${essenceAvailable ? "" : "disabled"}><b>${target.wuxing}</b><span>${target.wuxing} 문기 ${quote.essenceCost}</span><small>비싼 대체 지불 · 보유 ${ctx.engine.state.elementEssence[target.wuxing]}</small></label>
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
      // 기본 지불은 렌더가 중복 우선으로 다시 정한다.
      concentrationPaymentChosen = false;
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
    concentrationPaymentChosen = true;
    ctx.concentrationRenderKey = "";
    renderConcentration();
  });
}
