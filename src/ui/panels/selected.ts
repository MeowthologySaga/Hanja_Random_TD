/*
 * 선택 자령 카드와 구성식 서랍.
 */
import { CASUAL_POLARIS_AURA, CASUAL_STAR_COLORS, CASUAL_STAR_NAMES, casualStrokeCount } from "../../core/casual";
// [SKILL-V1] 귀천 카드·게이지 스펙. [SKILL-V3] 획수 공명 카드·칩 스펙.
import { GWICHEON_ABILITY, STROKE_RESONANCE_ABILITY, STROKE_RESONANCE_MAX_STACKS } from "../../core/abilities";
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
import { learningInfoForNotation } from "../../core/learning";
import { notationBadgeText, notationReadingHtml, notationShortHtml } from "../notation-substitute";
import { radicalGlyph } from "../../core/radicals";
import { type AbilitySpec, type CompositionBranchPreview, type HanziDefinition, type Tower } from "../../core/types";
import { abilityGuideDialog, canvas, ctx, must } from "../app-context";
import {
  casualStarOf,
  dismantleBlockChip,
  dismantleBlockNote,
  dismantleUnlockable,
  escapeHtml,
  essenceAmountChip,
  essenceAmountLabel,
  goldAmountLabel,
  protectionShortLabel,
  spriteStyle,
  visualBackgroundStyle
} from "../format";
import { openConfirm } from "../dialogs/confirm";
import { handleAction, setPanelTab, showToast } from "../hud";
import { dismantleOptions } from "./growth";

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
  const learning = learningInfoForNotation(ctx.engine.state.notation, tower.char);
  const abilities = definition.combat.abilities;
  const activeSkills = ctx.engine.towerHasActiveSkills(tower);
  const skillUnlockLabel = ctx.engine.state.mode === "casual" ? "2★ 승급" : "2단 합성";
  const periodicAbilities = activeSkills
    ? [abilities.semantic, abilities.role, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability))
    : [];
  // [SKILL-V1] 6★ 이상 캐주얼 자령은 충전 스킬 귀천이 함께 노출된다.
  const gwicheonAbilities = ctx.engine.gwicheonStatus(tower) ? [GWICHEON_ABILITY] : [];
  // [SKILL-V3] 획수 공명은 같은 진 동급 동료가 있을 때만 설명 목록에 오른다.
  const resonanceAbilities = ctx.engine.strokeResonanceStatus(tower) ? [STROKE_RESONANCE_ABILITY] : [];
  const supportingAbilities = activeSkills ? [abilities.element, abilities.graph, ...resonanceAbilities] : [abilities.graph];
  const loadout = [...periodicAbilities, ...gwicheonAbilities, ...supportingAbilities];
  // 배지 마크업을 못 쓰는 textContent 자리 — 곁말을 괄호로 달아 판정을 잃지 않는다.
  const readingMark = notationBadgeText(learning);
  must<HTMLElement>("#ability-guide-title").textContent = `${tower.char} ${learning.short}${readingMark ? ` (${readingMark})` : ""} · 기술 구성`;
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
  // [SKILL-V3] 획수 공명 중첩은 자리를 옮기면 바뀐다 — 다시 그리기 열쇠에 넣지
  // 않으면 칩과 공속 표기가 옛 중첩에 머문다.
  const resonanceStacks = tower ? ctx.engine.strokeResonanceStacks(tower) : 0;
  const key = tower ? tower.definitionId + "|" + String(tower.id) + "|" + String(tower.locked) + "|" + String(stored) + "|" + String(ctx.engine.isSynergyActive(tower.wuxing)) + "|" + branchKey + `|M${ctx.engine.state.mode}:S${tower.casualStar ?? 0}|C${concentration}:${concentrationPath ?? "none"}:D${duplicateCount}:E${ctx.engine.state.elementEssence[tower.wuxing]}|P${polarisActive ? 1 : 0}|R${resonanceStacks}|U${ctx.dismantleProtectsUnique ? 1 : 0}` : "none";
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
  const learning = learningInfoForNotation(ctx.engine.state.notation, tower.char);
  const abilities = definition.combat.abilities;
  const activeSkills = ctx.engine.towerHasActiveSkills(tower);
  const periodicAbilities = activeSkills
    ? [abilities.semantic, abilities.role, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability))
    : [];
  // [SKILL-V1] 6★ 이상 캐주얼 자령의 충전 스킬 귀천.
  const gwicheon = ctx.engine.gwicheonStatus(tower);
  // [SKILL-V3] 획수 공명 — 같은 진에 선 동급 동료가 있을 때만 칸을 차지한다.
  const strokeResonance = ctx.engine.strokeResonanceStatus(tower);
  const supportingAbilities = activeSkills
    ? [abilities.element, abilities.graph, ...(strokeResonance ? [STROKE_RESONANCE_ABILITY] : [])]
    : [abilities.graph];
  const abilityLoadout = [...periodicAbilities, ...(gwicheon ? [GWICHEON_ABILITY] : []), ...supportingAbilities];
  const readyBranches = branches.filter((branch) => branch.ready).length;
  const charge = chargeStep / abilities.tuning.signatureEvery;
  const remaining = abilities.tuning.signatureEvery - chargeStep;
  const nextEssenceCost = concentrationEssenceCost(concentration);
  const concentrationStatus = concentration >= MAX_CONCENTRATION_LEVEL
    ? `濃 3/3 완성 · ${concentrationPathLabel(concentrationPath ?? autoConcentrationPath(tower))}`
    : duplicateCount > 0 ? `중복 ${duplicateCount}기 사용 가능` : `${tower.wuxing} 문기 ${ctx.engine.state.elementEssence[tower.wuxing]}/${nextEssenceCost}`;
  // [J-2] 보호 판정은 분해 경로와 같은 옵션(유일 자령 보호 토글)으로 읽어야
  // 한 화면 안에서 "여기선 보호, 저기선 분해 가능" 같은 어긋남이 안 생긴다.
  const cleanup = ctx.engine.cleanupAssessments(dismantleOptions()).find((assessment) => assessment.towerId === tower.id);
  // [J-2] 보호 칩이 곧 사유 라벨이다. 버튼 아래 별도 줄로 두면 376px 카드의
  // 스크롤 아래로 밀려 "화면에 드러낸다" 는 목적을 잃는다. 반대로 칩이 한 줄
  // 늘어나도 [판매] 가 첫 화면 밖으로 밀리므로, 칩은 사유만 한 줄로 싣고
  // 푸는 법은 [분해 불가] 버튼의 아랫줄이 맡는다.
  const cleanupLabel = cleanup?.protected
    ? dismantleBlockChip(cleanup.protectedReasons)
    : `정리 후보 · ${cleanup?.reasons[0] ?? "직접 판단"}`;
  // [J-1] 판매는 엽전과 (농축했다면) 환급 문기 두 값을 함께 준다 — 둘 다 단위를 단다.
  const sellGold = ctx.engine.towerSellValue(tower);
  const sellEssence = concentrationEssenceRefund(concentration);
  // 트랙 A #7: 전장 배치 상태 그대로 확인 1회 → 즉시 분해. 보호에 걸리면
  // 버튼을 잠그고 사유를 title 로 남긴다.
  const dismantleEssence = ctx.engine.towerDismantleEssenceValue(tower);
  const dismantleBlocked = cleanup?.protected !== false;
  const casualStar = casualStarOf(tower);
  const progressionLabel = ctx.engine.state.mode === "casual" ? `${casualStar}★ ${CASUAL_STAR_NAMES[casualStar]}` : STAGE_NAMES[tower.stage];
  const progressionColor = ctx.engine.state.mode === "casual" ? CASUAL_STAR_COLORS[casualStar] : STAGE_COLORS[tower.stage];
  const skillUnlockLabel = ctx.engine.state.mode === "casual" ? "2★ 승급" : "2단 합성";
  card.innerHTML = `
    <div class="selected-glyph" style="--unit:${style.color};--stage:${progressionColor}">${tower.char}${ctx.engine.state.mode === "casual" ? `<small>${casualStar}★ · ${casualStrokeCount(tower.char) ?? "?"}획</small>` : concentration > 0 ? `<small>濃 ${concentration}</small>` : ""}</div>
    <div class="selected-copy">
      <div><span>${progressionLabel} · ${style.name}행 · ${ROLE_LABELS[tower.combatRole]}</span><h3>${tower.char} <small>${GRAPH_ROLE_LABELS[tower.graphRole]}</small></h3></div>
      <p class="selected-learning"><i class="selected-radical">${ctx.displayMode === "spirit"
        ? `<span>${learning.readingLabel}</span><b>${notationReadingHtml(learning, ctx.engine.state.notation)}</b>`
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
      ${strokeResonance
        ? `<span class="selected-chip selected-chip--resonance" title="${escapeHtml(STROKE_RESONANCE_ABILITY.description)}">${STROKE_RESONANCE_ABILITY.glyph} ${STROKE_RESONANCE_ABILITY.name} ${strokeResonance.stacks}/${STROKE_RESONANCE_MAX_STACKS} · 공속 +${Math.round(strokeResonance.haste * 100)}%</span>`
        : ""}
      <span class="selected-chip cleanup-reason ${cleanup?.protected ? "is-protected" : "is-candidate"}">${escapeHtml(cleanupLabel)}</span>
      <span class="selected-chip selected-chip--essence">${escapeHtml(concentrationStatus)}</span>
    </div>
    <div class="selected-actions">
      <button id="lock-button" class="${tower.locked ? "is-locked" : ""}" type="button" data-testid="lock-tower" title="판매·합성 재료로 쓰이지 않게 보호">${tower.locked ? "鎖 잠금됨" : "잠금"}</button>
      <button id="store-button" type="button" data-testid="store-tower" title="가방으로 이동 — 전장 자리를 비웁니다" ${stored ? "disabled" : ""}>${stored ? "보관 중" : "보관"}</button>
      <button id="derivative-button" class="${readyBranches > 0 ? "has-ready" : ""}" type="button" data-testid="derivative-composition" title="이 자령이 재료인 파생 조합 목록">${ctx.engine.state.mode === "casual" ? casualStar >= 8 ? "8★ 최고 단계" : "3체 조합 ›" : `합성 ${readyBranches}`}</button>
      <button id="dismantle-button" type="button" data-testid="dismantle-tower" class="${dismantleBlocked ? "is-blocked" : ""}" title="${escapeHtml(dismantleBlocked ? dismantleBlockNote(cleanup?.protectedReasons ?? []) : `${tower.char}를 분해해 ${essenceAmountLabel(tower.wuxing, dismantleEssence)} 회수 — 확인 한 번 뒤 즉시 분해, 되돌릴 수 없습니다`)}" ${dismantleBlocked ? "disabled" : ""}>${dismantleBlocked
        ? `분해 불가<small class="action-price">${escapeHtml(dismantleUnlockable(cleanup?.protectedReasons ?? []) ? "제련소에서 보호 끄기 ›" : `${protectionShortLabel(cleanup?.protectedReasons ?? [])} 보호`)}</small>`
        : `분해<small class="action-price">${essenceAmountChip(tower.wuxing, dismantleEssence)}</small>`}</button>
      <button id="open-concentration-button" type="button" title="농축 공방 탭으로 이동" ${concentration >= MAX_CONCENTRATION_LEVEL ? "disabled" : ""}>농축 ›</button>
      <button id="sell-button" type="button" title="${escapeHtml(`${goldAmountLabel(sellGold)}${sellEssence > 0 ? ` · ${essenceAmountLabel(tower.wuxing, sellEssence)}` : ""} 를 받고 즉시 제거 — 되돌릴 수 없음`)}" ${tower.locked ? "disabled" : ""}>판매<small class="action-price">${goldAmountLabel(sellGold, true)}${sellEssence > 0 ? ` · ${essenceAmountChip(tower.wuxing, sellEssence)}` : ""}</small></button>
    </div>
    <button type="button" class="selected-ability-summary" data-ability-guide><b>${activeSkills ? `技 기술 ${abilityLoadout.length}개 · 모두 자동 판정` : "技 기술 해금 전"}</b><span>${activeSkills ? `주기 ${periodicAbilities.length} · 공격 연동 1 · 조건 적용 1` : "현재 기본 공격 · 2단 합성 필요"}</span><em>설명 ›</em></button>
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
      ? "가방"
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
        <small>${STAGE_NAMES[branch.result.stage]} · ${notationShortHtml(learningInfoForNotation(ctx.engine.state.notation, branch.result.char), ctx.engine.state.notation)}</small>
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
    <span><b>${selected.char}</b><strong>${notationShortHtml(learningInfoForNotation(ctx.engine.state.notation, selected.char), ctx.engine.state.notation)}</strong><small>${selected.cell < 0 ? "가방" : "전장 배치"} · 직접 파생 ${branches.length}개</small></span>
  `;
  must<HTMLElement>("#composition-branches").innerHTML = branches.length > 0
    ? branches.map(compositionBranchCard).join("")
    : `<div class="empty-composition"><b>직접 파생 합성이 없습니다</b><span>이 자령은 현재 조합표의 끝 단계입니다.</span></div>`;
}

/**
 * 트랙 A #7: 전장 자령 즉석 분해.
 *
 * 엔진의 dismantleTowers 는 인벤토리 전용이라("인벤토리 자령만"), 전장 자령은
 * 기존 공개 API 둘을 이어 붙인다 — storeSelectedTower(전장 → 인벤) 뒤
 * dismantleTowers 1기. 엔진은 손대지 않는다. 확인은 제련소 [선택 분해]와
 * 같은 공용 서책 창 1회다([S/P-08] 이전에는 window.confirm 이었다). 보호
 * 셈법은 렌더가 이미 잠갔지만, 상태가 그 사이 바뀌었을 수 있으므로 실패
 * 문장은 그대로 토스트로 올린다(그 경우 자령은 인벤토리에 남는다 —
 * 사라지지는 않는다).
 */
function dismantleSelectedInPlace(): void {
  const tower = ctx.engine.selectedTower();
  if (!tower) return;
  const essence = ctx.engine.towerDismantleEssenceValue(tower);
  openConfirm({
    eyebrow: "선택 자령",
    title: `${tower.char} 1기를 분해할까요?`,
    lines: [
      `획득 <b>${escapeHtml(tower.wuxing)} 문기 +${essence}</b>`,
      "되돌릴 수 없습니다."
    ],
    confirmLabel: `${tower.char} 분해`
  }, () => {
    if (tower.cell >= 0) {
      const storeResult = ctx.engine.storeSelectedTower();
      if (!storeResult.ok) {
        handleAction(storeResult);
        return;
      }
    }
    handleAction(ctx.engine.dismantleTowers([tower.id], { protectUnique: ctx.dismantleProtectsUnique }));
  });
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
    else if (target.closest("#dismantle-button")) dismantleSelectedInPlace();
    else if (target.closest("#open-concentration-button")) {
      ctx.concentrationTargetId = ctx.engine.selectedTower()?.id ?? null;
      setPanelTab("concentration");
    }
  });
}
