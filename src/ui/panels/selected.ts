/*
 * 선택 자령 카드와 구성식 서랍.
 */
import { CASUAL_POLARIS_AURA, CASUAL_STAR_COLORS, CASUAL_STAR_NAMES, casualStrokeCount } from "../../core/casual";
// [SKILL-V1] 귀천 카드·게이지 스펙.
import { GWICHEON_ABILITY } from "../../core/abilities";
import {
  autoConcentrationPath,
  concentrationEssenceCost,
  concentrationEssenceRefund,
  concentrationPathLabel,
  MAX_CONCENTRATION_LEVEL
} from "../../core/game";
import {
  definitionForTower,
  ELEMENT_STYLES,
  GRAPH_ROLE_LABELS,
  ROLE_LABELS,
  STAGE_COLORS,
  STAGE_NAMES
} from "../../core/hanzi";
import { jaryeongVisualFor } from "../../core/jaryeongs";
import { learningInfo } from "../../core/learning";
import { radicalGlyph } from "../../core/radicals";
import { type AbilitySpec, type CompositionBranchPreview, type HanziDefinition, type Tower } from "../../core/types";
import { abilityGuideDialog, canvas, ctx, must } from "../app-context";
import {
  casualStarOf,
  escapeHtml,
  essenceAmountChip,
  essenceAmountLabel,
  goldAmountLabel,
  spriteStyle,
  visualBackgroundStyle
} from "../format";
import { handleAction, setPanelTab, showToast } from "../hud";

function setCompositionMaterialHighlight(ids: readonly number[] = []): void {
  ctx.hoveredCompositionMaterialIds = new Set(ids);
  canvas.dataset.compositionMaterialCount = String(ctx.hoveredCompositionMaterialIds.size);
}

const ABILITY_CATEGORY_LABELS: Record<AbilitySpec["category"], { label: string; mode: string }> = {
  semantic: { label: "고유 기술", mode: "주기 자동" },
  role: { label: "역할 기술", mode: "주기 자동" },
  lineage: { label: "계승 기술", mode: "주기 자동" },
  element: { label: "오행 효과", mode: "공격 연동" },
  graph: { label: "진법 특성", mode: "조건 적용" }
};

function readableAbilityTrigger(trigger: string): string {
  if (trigger === "공격 적중") return "공격 적중마다";
  return trigger.replace(/(\d+번째 공격)$/u, "$1마다");
}

function selectedAbilityCard(ability: AbilitySpec): string {
  const meta = ABILITY_CATEGORY_LABELS[ability.category];
  const behaviorClass = ability.category === "element" ? "is-attack-linked" : ability.category === "graph" ? "is-conditional" : "is-periodic";
  const trigger = readableAbilityTrigger(ability.trigger);
  return `<button type="button" class="ability-card ${behaviorClass}" data-ability-id="${ability.id}" style="--ability:${ability.color}" title="${escapeHtml(`${meta.label} · ${trigger} · ${ability.description}`)}" aria-label="${escapeHtml(`${meta.label} ${ability.name}. ${trigger}. 자세한 설명 열기`)}">
    <i aria-hidden="true">${ability.glyph}</i><span><em>${meta.label} · ${meta.mode}</em><b>${ability.name}</b><small>${escapeHtml(trigger)} · ${escapeHtml(ability.summary)}</small></span>
  </button>`;
}

function abilityGuideArticle(ability: AbilitySpec, focusedAbilityId: string | undefined): string {
  const meta = ABILITY_CATEGORY_LABELS[ability.category];
  const focused = ability.id === focusedAbilityId;
  return `<article class="ability-guide-card ${focused ? "is-focused" : ""}" data-guide-ability-id="${ability.id}" style="--ability:${ability.color}">
    <i aria-hidden="true">${ability.glyph}</i>
    <div><span>${meta.label}</span><h3>${escapeHtml(ability.name)}</h3><em>${meta.mode}</em></div>
    <dl><div><dt>발동</dt><dd>${escapeHtml(readableAbilityTrigger(ability.trigger))}</dd></div><div><dt>효과</dt><dd>${escapeHtml(ability.summary)}</dd></div></dl>
    <p>${escapeHtml(ability.description)}</p>
  </article>`;
}

function openAbilityGuide(focusedAbilityId?: string): void {
  const tower = ctx.engine.selectedTower();
  if (!tower) return;
  const definition = definitionForTower(ctx.engine.catalog, tower.definitionId);
  const learning = learningInfo(ctx.engine.state.region, tower.char);
  const abilities = definition.combat.abilities;
  const activeSkills = ctx.engine.towerHasActiveSkills(tower);
  const skillUnlockLabel = ctx.engine.state.mode === "casual" ? "2★ 승급" : "2단 합성";
  const periodicAbilities = activeSkills
    ? [abilities.semantic, abilities.role, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability))
    : [];
  // [SKILL-V1] 6★ 이상 캐주얼 자령은 충전 스킬 귀천이 함께 노출된다.
  const gwicheonAbilities = ctx.engine.gwicheonStatus(tower) ? [GWICHEON_ABILITY] : [];
  const supportingAbilities = activeSkills ? [abilities.element, abilities.graph] : [abilities.graph];
  const loadout = [...periodicAbilities, ...gwicheonAbilities, ...supportingAbilities];
  must<HTMLElement>("#ability-guide-title").textContent = `${tower.char} ${learning.short} · 기술 구성`;
  must<HTMLElement>("#ability-guide-content").innerHTML = `
    <section class="ability-guide-rule ${activeSkills ? "" : "is-locked"}">
      <span>${activeSkills ? `기술 ${loadout.length}개 모두 자동 판정` : "1단 재료 자령 · 기술 해금 전"}</span>
      <h3>${activeSkills ? "직접 누르는 기술은 없습니다" : "현재는 기본 공격만 수행합니다"}</h3>
      <p>${activeSkills
        ? `고유·역할·계승 기술의 주기가 같은 공격에 겹치면 <b>고유 → 역할 → 계승</b> 순서로 하나만 발동합니다. 오행 효과와 진법 특성은 각 조건을 만족하면 그 공격에 함께 적용됩니다.`
        : `진법 특성은 조건을 만족하면 자동 적용됩니다. <b>${skillUnlockLabel}</b>부터 고유·역할 기술과 오행 효과가 해금됩니다.`}</p>
      <div><b>주기 자동 ${periodicAbilities.length}</b><b>공격 연동 ${activeSkills ? 1 : 0}</b><b>조건 특성 1</b></div>
    </section>
    <div class="ability-guide-list">
      ${activeSkills ? "" : `<article class="ability-guide-card is-basic ${focusedAbilityId === "basic-attack" ? "is-focused" : ""}" data-guide-ability-id="basic-attack" style="--ability:#aeb9cc"><i aria-hidden="true">合</i><div><span>기본 행동</span><h3>기본 공격</h3><em>자동</em></div><dl><div><dt>발동</dt><dd>적이 사거리 안에 있을 때</dd></div><div><dt>효과</dt><dd>단일 대상 공격</dd></div></dl><p>조합 가능한 1단 자령은 상위 글자의 재료 역할을 하며, 합성 전에는 고유 기술을 사용하지 않습니다.</p></article>`}
      ${loadout.map((ability) => abilityGuideArticle(ability, focusedAbilityId)).join("")}
    </div>`;
  abilityGuideDialog.showModal();
}

function syncSelectedCharge(card: HTMLElement, tower: Tower, definition: HanziDefinition, chargeStep: number): void {
  syncGwicheonCharge(card, tower);
  const holder = card.querySelector<HTMLElement>(".ability-charge:not([data-gwicheon-charge])");
  if (!ctx.engine.towerHasActiveSkills(tower) || holder?.classList.contains("ability-charge--locked")) return;
  const ability = definition.combat.abilities.role;
  const signatureEvery = definition.combat.abilities.tuning.signatureEvery;
  const charge = chargeStep / signatureEvery;
  const remaining = signatureEvery - chargeStep;
  const meter = holder?.querySelector<HTMLElement>("i") ?? null;
  const label = holder?.querySelector<HTMLElement>("small") ?? null;
  if (meter) meter.style.width = `${Math.round(charge * 100)}%`;
  if (label) label.textContent = `역할 기술 충전 · ${ability.glyph} ${ability.name} ${chargeStep}/${signatureEvery}`;
  if (holder) holder.title = `다음 역할 기술 ${ability.name}까지 ${remaining}회`;
}

/** [SKILL-V1] 귀천 게이지 — 초 단위 충전이라 매 프레임 동기화한다. */
function syncGwicheonCharge(card: HTMLElement, tower: Tower): void {
  const holder = card.querySelector<HTMLElement>("[data-gwicheon-charge]");
  if (!holder) return;
  const status = ctx.engine.gwicheonStatus(tower);
  if (!status) return;
  const meter = holder.querySelector<HTMLElement>("i");
  const label = holder.querySelector<HTMLElement>("small");
  if (meter) meter.style.width = `${Math.round((status.charge / status.required) * 100)}%`;
  if (label) label.textContent = `귀천 충전 · ${GWICHEON_ABILITY.glyph} ${Math.floor(status.charge)}/${status.required}초`;
  holder.title = `귀천 자동 발동까지 ${Math.max(0, Math.ceil(status.required - status.charge))}초`;
}

export function renderSelected(): void {
  const card = must<HTMLElement>("#selected-card");
  const tower = ctx.engine.selectedTower();
  const definition = tower ? definitionForTower(ctx.engine.catalog, tower.definitionId) : undefined;
  const chargeStep = tower && definition ? tower.shotCount % definition.combat.abilities.tuning.signatureEvery : 0;
  const stored = ctx.engine.selectedTowerIsStored();
  const branches = tower ? ctx.engine.compositionBranchesForSelected() : [];
  const concentration = tower?.concentration ?? 0;
  const concentrationPath = tower?.concentrationPath ?? null;
  const duplicateCount = tower ? ctx.engine.state.inventoryTowers.filter((candidate) => candidate.id !== tower.id && candidate.char === tower.char && !candidate.locked).length : 0;
  const branchKey = branches.map((branch) => `${branch.recipeId}:${branch.ready ? "R" : branch.materials.map((material) => material.location).join(",")}`).join("|");
  const polarisActive = tower ? ctx.engine.casualPolarisAuraActive(tower.wuxing) : false;
  const key = tower ? tower.definitionId + "|" + String(tower.id) + "|" + String(tower.locked) + "|" + String(stored) + "|" + String(ctx.engine.isSynergyActive(tower.wuxing)) + "|" + branchKey + `|M${ctx.engine.state.mode}:S${tower.casualStar ?? 0}|C${concentration}:${concentrationPath ?? "none"}:D${duplicateCount}:E${ctx.engine.state.elementEssence[tower.wuxing]}|P${polarisActive ? 1 : 0}` : "none";
  if (key === ctx.selectedRenderKey) {
    if (tower && definition) syncSelectedCharge(card, tower, definition, chargeStep);
    return;
  }
  ctx.selectedRenderKey = key;
  if (!tower) {
    card.innerHTML = '<div class="empty-selection"><b>자령을 선택하세요</b><span>한자·부수·공격·오행·조합망 역할을 확인할 수 있습니다.</span></div>';
    return;
  }
  if (!definition) return;
  const style = ELEMENT_STYLES[tower.wuxing];
  const concentrationDamage = 1 + concentration * (concentrationPath === "potent" ? 0.12 : 0.055);
  const damage = Math.round(definition.combat.baseDamage * ctx.engine.towerPowerMultiplier(tower) * definition.combat.budgetMultiplier * (1 + ctx.engine.idiomBonus("damage")) * (1 + ctx.engine.combinedUpgradeBonus(tower.wuxing, "damage")) * concentrationDamage * ctx.engine.casualPolarisDamageMultiplier(tower.wuxing));
  const range = definition.combat.range + ctx.engine.towerRangeBonus(tower) + ctx.engine.idiomBonus("range") + concentration * 4 + ctx.engine.combinedUpgradeBonus(tower.wuxing, "range");
  const attacksPerSecond = 1 / ctx.engine.towerAttackCooldown(tower);
  const learning = learningInfo(ctx.engine.state.region, tower.char);
  const abilities = definition.combat.abilities;
  const activeSkills = ctx.engine.towerHasActiveSkills(tower);
  const periodicAbilities = activeSkills
    ? [abilities.semantic, abilities.role, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability))
    : [];
  // [SKILL-V1] 6★ 이상 캐주얼 자령의 충전 스킬 귀천.
  const gwicheon = ctx.engine.gwicheonStatus(tower);
  const supportingAbilities = activeSkills ? [abilities.element, abilities.graph] : [abilities.graph];
  const abilityLoadout = [...periodicAbilities, ...(gwicheon ? [GWICHEON_ABILITY] : []), ...supportingAbilities];
  const readyBranches = branches.filter((branch) => branch.ready).length;
  const charge = chargeStep / abilities.tuning.signatureEvery;
  const remaining = abilities.tuning.signatureEvery - chargeStep;
  const nextEssenceCost = concentrationEssenceCost(concentration);
  const concentrationStatus = concentration >= MAX_CONCENTRATION_LEVEL
    ? `濃 3/3 완성 · ${concentrationPathLabel(concentrationPath ?? autoConcentrationPath(tower))}`
    : duplicateCount > 0 ? `중복 ${duplicateCount}기 사용 가능` : `${tower.wuxing} 문기 ${ctx.engine.state.elementEssence[tower.wuxing]}/${nextEssenceCost}`;
  const cleanup = ctx.engine.cleanupAssessments().find((assessment) => assessment.towerId === tower.id);
  const cleanupLabel = cleanup?.protected
    ? `보호 · ${cleanup.protectedReasons[0] ?? "전략 재료"}`
    : `정리 후보 · ${cleanup?.reasons[0] ?? "직접 판단"}`;
  // [J-1] 판매는 엽전과 (농축했다면) 환급 문기 두 값을 함께 준다 — 둘 다 단위를 단다.
  const sellGold = ctx.engine.towerSellValue(tower);
  const sellEssence = concentrationEssenceRefund(concentration);
  const dismantleEssence = ctx.engine.towerDismantleEssenceValue(tower);
  const casualStar = casualStarOf(tower);
  const progressionLabel = ctx.engine.state.mode === "casual" ? `${casualStar}★ ${CASUAL_STAR_NAMES[casualStar]}` : STAGE_NAMES[tower.stage];
  const progressionColor = ctx.engine.state.mode === "casual" ? CASUAL_STAR_COLORS[casualStar] : STAGE_COLORS[tower.stage];
  const skillUnlockLabel = ctx.engine.state.mode === "casual" ? "2★ 승급" : "2단 합성";
  card.innerHTML = `
    <div class="selected-glyph" style="--unit:${style.color};--stage:${progressionColor}">${tower.char}${ctx.engine.state.mode === "casual" ? `<small>${casualStar}★ · ${casualStrokeCount(tower.char) ?? "?"}획</small>` : concentration > 0 ? `<small>濃 ${concentration}</small>` : ""}</div>
    <div class="selected-copy">
      <div><span>${progressionLabel} · ${style.name}행 · ${ROLE_LABELS[tower.combatRole]}</span><h3>${tower.char} <small>${GRAPH_ROLE_LABELS[tower.graphRole]}</small></h3></div>
      <p class="selected-learning"><i class="selected-radical">${ctx.displayMode === "spirit"
        ? `<span>${learning.readingLabel}</span><b>${escapeHtml(learning.reading)}</b>`
        : `<span>부수</span><b>${radicalGlyph(tower.char)}</b>`}</i></p>
      <p class="selected-meaning"><span>${learning.meaningSource === "en" ? "뜻(영)" : "뜻"}</span><b>${escapeHtml(learning.meaning)}</b></p>
    </div>
    <div class="selected-stats" aria-label="자령 능력치">
      <div class="selected-stat" data-stat="attack"><span>공격</span><b>${damage}</b></div>
      <div class="selected-stat" data-stat="speed"><span>공속</span><b>${attacksPerSecond.toFixed(2)}/초</b></div>
      <div class="selected-stat" data-stat="range"><span>사거리</span><b>${Math.round(range)}</b></div>
      <div class="selected-stat" data-stat="branch"><span>파생</span><b>${branches.length}</b></div>
    </div>
    <div class="selected-chips">
      ${stored ? '<span class="selected-chip is-stored">배치 대기 · 찬 칸을 누르면 즉시 교체</span>' : ""}
      ${ctx.engine.state.mode === "casual" && casualStar >= CASUAL_POLARIS_AURA.star
        ? `<span class="selected-chip selected-chip--polaris" title="${escapeHtml(CASUAL_POLARIS_AURA.description)}">${CASUAL_POLARIS_AURA.name} · ${CASUAL_POLARIS_AURA.summary} · 오라 중첩 불가</span>`
        : polarisActive && !stored
          ? `<span class="selected-chip selected-chip--polaris" title="${escapeHtml(CASUAL_POLARIS_AURA.description)}">${CASUAL_POLARIS_AURA.name} 오라 적용 중 · 공격 +${Math.round(CASUAL_POLARIS_AURA.damageBonus * 100)}%</span>`
          : ""}
      <span class="selected-chip cleanup-reason ${cleanup?.protected ? "is-protected" : "is-candidate"}">${escapeHtml(cleanupLabel)}</span>
      <span class="selected-chip selected-chip--essence">${escapeHtml(concentrationStatus)}</span>
    </div>
    <div class="selected-actions">
      <button id="lock-button" class="${tower.locked ? "is-locked" : ""}" type="button" data-testid="lock-tower" title="판매·합성 재료로 쓰이지 않게 보호">${tower.locked ? "鎖 잠금됨" : "잠금"}</button>
      <button id="store-button" type="button" data-testid="store-tower" title="인벤으로 이동 — 전장 자리를 비웁니다" ${stored ? "disabled" : ""}>${stored ? "보관 중" : "보관"}</button>
      <button id="derivative-button" class="${readyBranches > 0 ? "has-ready" : ""}" type="button" data-testid="derivative-composition" title="이 자령이 재료인 파생 조합 목록">${ctx.engine.state.mode === "casual" ? casualStar >= 8 ? "8★ 최고 단계" : "3체 조합 ›" : `합성 ${readyBranches}`}</button>
      <button id="open-growth-button" type="button" title="${escapeHtml(`강화 제련소 탭으로 이동 · 분해하면 ${essenceAmountLabel(tower.wuxing, dismantleEssence)} 회수`)}">분해 ›<small class="action-price">${essenceAmountChip(tower.wuxing, dismantleEssence)}</small></button>
      <button id="open-concentration-button" type="button" title="농축 공방 탭으로 이동" ${concentration >= MAX_CONCENTRATION_LEVEL ? "disabled" : ""}>농축 ›</button>
      <button id="sell-button" type="button" title="${escapeHtml(`${goldAmountLabel(sellGold)}${sellEssence > 0 ? ` · ${essenceAmountLabel(tower.wuxing, sellEssence)}` : ""} 를 받고 즉시 제거 — 되돌릴 수 없음`)}" ${tower.locked ? "disabled" : ""}>판매<small class="action-price">${goldAmountLabel(sellGold, true)}${sellEssence > 0 ? ` · ${essenceAmountChip(tower.wuxing, sellEssence)}` : ""}</small></button>
    </div>
    <button type="button" class="selected-ability-summary" data-ability-guide><b>${activeSkills ? `技 기술 ${abilityLoadout.length}개 · 모두 자동 판정` : "技 기술 해금 전"}</b><span>${activeSkills ? `주기 ${periodicAbilities.length} · 공격 연동 1 · 조건 특성 1` : "현재 기본 공격 · 2단 합성 필요"}</span><em>설명 ›</em></button>
    ${activeSkills
      ? `<div class="ability-loadout">
          <div class="ability-overview"><span><b>주기 겹침: 고유 → 역할 → 계승 중 1개 발동</b></span><button type="button" data-ability-guide>전체 설명</button></div>
          <div class="ability-pills">${abilityLoadout.map(selectedAbilityCard).join("")}</div>
        </div>
        <div class="ability-charge" title="다음 역할 기술 ${abilities.role.name}까지 ${remaining}회"><i style="width:${Math.round(charge * 100)}%;--charge:${abilities.role.color}"></i><small>역할 기술 충전 · ${abilities.role.glyph} ${abilities.role.name} ${chargeStep}/${abilities.tuning.signatureEvery}</small></div>
        ${gwicheon ? `<div class="ability-charge" data-gwicheon-charge title="귀천 자동 발동까지 ${Math.max(0, Math.ceil(gwicheon.required - gwicheon.charge))}초"><i style="width:${Math.round((gwicheon.charge / gwicheon.required) * 100)}%;--charge:${GWICHEON_ABILITY.color}"></i><small>귀천 충전 · ${GWICHEON_ABILITY.glyph} ${Math.floor(gwicheon.charge)}/${gwicheon.required}초</small></div>` : ""}`
      : `<div class="ability-loadout is-locked">
          <div class="ability-overview"><span><b>${skillUnlockLabel}부터 고유·역할 기술과 오행 효과 해금</b></span><button type="button" data-ability-guide>규칙 설명</button></div>
          <div class="ability-pills ability-pills--locked"><button type="button" class="ability-card is-basic" data-ability-id="basic-attack" style="--ability:#aeb9cc"><i>合</i><span><em>기본 행동 · 자동</em><b>기본 공격</b><small>단일 대상 · 합성 재료</small></span></button>${supportingAbilities.map(selectedAbilityCard).join("")}</div>
        </div>
        <div class="ability-charge ability-charge--locked"><i style="width:0%;--charge:#aeb9cc"></i><small>${skillUnlockLabel} 시 고유 기술 해금</small></div>`}
  `;
}

function compositionMaterialChip(material: CompositionBranchPreview["materials"][number]): string {
  const locationLabel = material.location === "board"
    ? "전장"
    : material.location === "inventory"
      ? "인벤"
      : material.location === "locked" ? "잠금" : "0/1";
  return `<span class="composition-material is-${material.location}"><b>${material.char}</b>${locationLabel}</span>`;
}

function compositionBranchCard(branch: CompositionBranchPreview): string {
  const style = ELEMENT_STYLES[branch.result.wuxing];
  const visual = jaryeongVisualFor(branch.result.char, branch.result.wuxing, ctx.engine.state.region);
  const missing = branch.materials.filter((material) => material.towerId === null).map((material) => material.char);
  return `
    <button class="composition-branch ${branch.ready ? "is-ready" : "is-missing"} ${branch.onTargetPath ? "is-target" : ""}" type="button" data-composition-recipe="${branch.recipeId}" aria-disabled="${String(!branch.ready)}" style="--branch:${style.color}">
      <i class="composition-result-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></i>
      <span class="composition-branch-copy">
        <strong>${branch.parents.join(" + ")} <em>→</em> <b>${branch.result.char}</b></strong>
        <small>${STAGE_NAMES[branch.result.stage]} · ${escapeHtml(learningInfo(ctx.engine.state.region, branch.result.char).short)}</small>
        <span class="composition-materials">${branch.materials.map(compositionMaterialChip).join("")}</span>
      </span>
      <mark>${branch.ready ? "합성 가능" : `${missing.join("·") || "재료"} 부족`}</mark>
    </button>
  `;
}

export function renderCompositionDrawer(): void {
  const drawer = must<HTMLElement>("#composition-drawer");
  const selected = ctx.engine.selectedTower();
  if (!ctx.compositionDrawerOpen || !selected) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    setCompositionMaterialHighlight();
    return;
  }
  const definition = definitionForTower(ctx.engine.catalog, selected.definitionId);
  const branches = ctx.engine.compositionBranchesForSelected();
  const key = `${selected.id}|${selected.locked}|${branches.map((branch) => `${branch.recipeId}:${branch.ready}:${branch.materials.map((material) => `${material.towerId ?? "-"}:${material.location}`).join(",")}`).join("|")}`;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  if (key === ctx.compositionRenderKey) return;
  ctx.compositionRenderKey = key;
  must<HTMLElement>("#composition-source-glyph").textContent = selected.char;
  must<HTMLElement>("#composition-ready-count").textContent = String(branches.filter((branch) => branch.ready).length);
  must<HTMLElement>("#composition-source").innerHTML = `
    <i class="composition-source-spirit" style="${spriteStyle(definition)}" aria-hidden="true"></i>
    <span><b>${selected.char}</b><strong>${escapeHtml(learningInfo(ctx.engine.state.region, selected.char).short)}</strong><small>${selected.cell < 0 ? "런 인벤토리" : "전장 배치"} · 직접 파생 ${branches.length}개</small></span>
  `;
  must<HTMLElement>("#composition-branches").innerHTML = branches.length > 0
    ? branches.map(compositionBranchCard).join("")
    : `<div class="empty-composition"><b>직접 파생 합성이 없습니다</b><span>이 자령은 현재 조합표의 끝 단계입니다.</span></div>`;
}

function openCompositionDrawer(): void {
  if (!ctx.engine.selectedTower()) return;
  ctx.compositionDrawerOpen = true;
  ctx.compositionRenderKey = "";
  renderCompositionDrawer();
}

export function closeCompositionDrawer(): void {
  ctx.compositionDrawerOpen = false;
  ctx.compositionRenderKey = "";
  setCompositionMaterialHighlight();
  const drawer = document.querySelector<HTMLElement>("#composition-drawer");
  drawer?.classList.remove("is-open");
  drawer?.setAttribute("aria-hidden", "true");
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireSelected1(): void {
  must<HTMLButtonElement>("#ability-guide-close").addEventListener("click", () => abilityGuideDialog.close());
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireSelected2(): void {
  must<HTMLButtonElement>("#composition-drawer-close").addEventListener("click", closeCompositionDrawer);
  must<HTMLElement>("#composition-branches").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-composition-recipe]");
    const recipeId = button?.dataset.compositionRecipe;
    if (!recipeId) return;
    const branch = ctx.engine.compositionBranchesForSelected().find((candidate) => candidate.recipeId === recipeId);
    if (!branch?.ready) {
      const missing = branch?.materials.filter((material) => material.towerId === null).map((material) => material.char).join("·") || "재료";
      showToast(`${missing} 재료가 부족합니다.`);
      return;
    }
    setCompositionMaterialHighlight();
    handleAction(ctx.engine.evolve(recipeId));
  });
  must<HTMLElement>("#composition-branches").addEventListener("pointerover", (event) => {
    const recipeId = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-composition-recipe]")?.dataset.compositionRecipe;
    if (!recipeId) return;
    const branch = ctx.engine.compositionBranchesForSelected().find((candidate) => candidate.recipeId === recipeId);
    setCompositionMaterialHighlight(
      branch?.materials.filter((material) => material.location === "board" && material.towerId !== null).map((material) => material.towerId as number) ?? []
    );
  });
  must<HTMLElement>("#composition-branches").addEventListener("pointerout", (event) => {
    const related = event.relatedTarget as HTMLElement | null;
    if (!related?.closest("[data-composition-recipe]")) setCompositionMaterialHighlight();
  });
  must<HTMLElement>("#composition-branches").addEventListener("pointerleave", () => setCompositionMaterialHighlight());
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireSelected3(): void {
  must<HTMLElement>("#selected-card").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const abilityId = target.closest<HTMLButtonElement>("[data-ability-id]")?.dataset.abilityId;
    if (abilityId) openAbilityGuide(abilityId);
    else if (target.closest("[data-ability-guide]")) openAbilityGuide();
    else if (target.closest("#derivative-button")) {
      if (ctx.engine.state.mode === "casual") {
        const selected = ctx.engine.selectedTower();
        const selectable = selected !== undefined
          && casualStarOf(selected) < 8
          && ctx.engine.casualMaterialProtection(selected.id) === null;
        ctx.casualFusionSelection = selectable && selected ? [selected.id] : [];
        ctx.evolutionRenderKey = "";
        setPanelTab("evolution");
      } else openCompositionDrawer();
    }
    else if (target.closest("#lock-button")) handleAction(ctx.engine.toggleSelectedLock());
    else if (target.closest("#store-button")) {
      const result = ctx.engine.storeSelectedTower();
      if (result.ok) setPanelTab("inventory");
      handleAction(result);
    }
    else if (target.closest("#sell-button")) handleAction(ctx.engine.sellSelected());
    else if (target.closest("#open-growth-button")) {
      ctx.growthElement = ctx.engine.selectedTower()?.wuxing ?? ctx.growthElement;
      setPanelTab("growth");
    }
    else if (target.closest("#open-concentration-button")) {
      ctx.concentrationTargetId = ctx.engine.selectedTower()?.id ?? null;
      setPanelTab("concentration");
    }
  });
}
