/*
 * 강화 제련소 패널.
 */
import {
  ELEMENT_TRAIT_MAX_LEVEL,
  ELEMENT_TRAITS,
  elementTraitUnlockScore,
  elementTraitUpgradeCost
} from "../../core/growth";
import {
  ELEMENT_STYLES,
  UPGRADE_MILESTONE_INTERVAL,
  UPGRADE_MILESTONE_LEVEL_BONUS,
  UPGRADE_STAT_META,
  UPGRADE_STAT_ORDER,
  upgradeMilestoneCount,
  WUXING_ORDER
} from "../../core/hanzi";
import { type Tower, type UpgradeStat, type Wuxing } from "../../core/types";
import { ctx, DISMANTLE_UNIQUE_STORAGE_KEY, dismantleSelection, must, reducedMotion, sound } from "../app-context";
import { formatStatBonus, upgradeStateSignature } from "../dialogs/element-upgrade";
import {
  casualStarOf,
  escapeHtml,
  essenceAmountChip,
  essenceGainsLabel,
  spiritPortraitMarkup,
  towerProgressionLabel
} from "../format";
import { handleAction, setPanelTab, showToast } from "../hud";
import { renderRunInventory } from "./inventory";

/** 분해 경로 전용 옵션. 다른 보호(잠금·농축·공명)와 캐주얼 3합은 건드리지 않는다. */
export function dismantleOptions(): { protectUnique: boolean } {
  return { protectUnique: ctx.dismantleProtectsUnique };
}

function growthStateSignature(): string {
  const inventory = ctx.engine.state.inventoryTowers.map((tower) => `${tower.id}:${tower.char}:${tower.wuxing}:${tower.stage}:${tower.casualStar ?? 0}:${tower.locked ? 1 : 0}:${tower.concentration ?? 0}`).join("|");
  const traits = WUXING_ORDER.map((wuxing) => ctx.engine.state.elementTraits[wuxing].join(",")).join("|");
  const scores = WUXING_ORDER.map((wuxing) => ctx.engine.state.elementDismantleScore[wuxing]).join(",");
  const filters = `${must<HTMLSelectElement>("#dismantle-element-filter").value}:${must<HTMLSelectElement>("#dismantle-stage-filter").value}:${must<HTMLSelectElement>("#dismantle-status-filter").value}`;
  return `${ctx.engine.state.mode}:${upgradeStateSignature()}:${inventory}:${traits}:${scores}:${filters}:U${ctx.dismantleProtectsUnique ? 1 : 0}:${[...dismantleSelection].sort((a, b) => a - b).join(",")}:${ctx.growthElement}`;
}

function syncDismantleUniqueControl(): void {
  const button = must<HTMLButtonElement>("#dismantle-unique-toggle");
  button.classList.toggle("is-on", ctx.dismantleProtectsUnique);
  button.setAttribute("aria-checked", String(ctx.dismantleProtectsUnique));
  must<HTMLElement>("#dismantle-unique-toggle i em").textContent = ctx.dismantleProtectsUnique ? "ON" : "OFF";
}

function setDismantleProtectsUnique(enabled: boolean): void {
  ctx.dismantleProtectsUnique = enabled;
  try {
    window.localStorage.setItem(DISMANTLE_UNIQUE_STORAGE_KEY, String(enabled));
  } catch {
    // 저장이 막혀도 이번 세션 선택은 살린다.
  }
  syncDismantleUniqueControl();
  // 선택은 보호 규칙이 바뀐 순간 낡는다 — 비우고 다시 고르게 한다.
  dismantleSelection.clear();
  ctx.growthRenderKey = "";
  renderGrowth();
  renderRunInventory();
  showToast(enabled
    ? "유일 자령 보호 ON · 이 한자를 1기만 가진 자령은 분해 후보에서 빠집니다."
    : "유일 자령 보호 OFF · 유일 자령도 분해할 수 있습니다. 목록의 유일 배지를 확인하세요.");
}

const UPGRADE_UNAVAILABLE_LABEL = "투자 불가";

function upgradeAmountLabel(scope: "global" | "element" | "trait", stat: UpgradeStat | null, traitIndex: number | null, amount: number | "max"): string {
  const quote = scope === "global" && stat
    ? ctx.engine.quoteGlobalUpgrade(stat, amount)
    : scope === "element" && stat
      ? ctx.engine.quoteElementUpgrade(ctx.growthElement, stat, amount)
      : ctx.engine.quoteElementTraitUpgrade(ctx.growthElement, traitIndex ?? 0, amount);
  if (amount !== "max") return `${amount}회 · ${quote.cost}`;
  return quote.levels > 0 ? `최대 +${quote.levels} · ${quote.cost}` : UPGRADE_UNAVAILABLE_LABEL;
}

export function renderGrowth(): void {
  const key = growthStateSignature();
  if (key === ctx.growthRenderKey) return;
  ctx.growthRenderKey = key;
  const active = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
  const assessmentMap = new Map(ctx.engine.cleanupAssessments(dismantleOptions()).map((assessment) => [assessment.towerId, assessment]));
  const elementFilter = must<HTMLSelectElement>("#dismantle-element-filter").value;
  const stageFilter = must<HTMLSelectElement>("#dismantle-stage-filter").value;
  const statusFilter = must<HTMLSelectElement>("#dismantle-status-filter").value;
  for (const id of [...dismantleSelection]) if (!ctx.engine.state.inventoryTowers.some((tower) => tower.id === id)) dismantleSelection.delete(id);
  const rows = ctx.engine.state.inventoryTowers
    .map((tower) => ({ tower, assessment: assessmentMap.get(tower.id) }))
    .filter(({ tower }) => elementFilter === "all" || tower.wuxing === elementFilter)
    .filter(({ tower }) => stageFilter === "all" || String(ctx.engine.state.mode === "casual" ? casualStarOf(tower) : tower.stage) === stageFilter)
    .filter(({ assessment }) => statusFilter === "all" || (statusFilter === "eligible" ? !assessment?.protected : assessment?.protected))
    .sort((left, right) => Number(Boolean(left.assessment?.protected)) - Number(Boolean(right.assessment?.protected)) || (ctx.engine.state.mode === "casual" ? casualStarOf(left.tower) - casualStarOf(right.tower) : left.tower.stage - right.tower.stage) || left.tower.id - right.tower.id);

  must<HTMLElement>("#growth-resource-summary").textContent = "문기 " + WUXING_ORDER.map((wuxing) => `${wuxing}${ctx.engine.state.elementEssence[wuxing]}`).join(" ");
  const dismantleReady = ctx.engine.state.inventoryTowers.filter((tower) => !assessmentMap.get(tower.id)?.protected).length;
  must<HTMLElement>("#growth-panel-dismantle").textContent = `분해 가능 ${dismantleReady}기 · 선택 ${dismantleSelection.size}기`;
  must<HTMLElement>("#growth-dismantle-list").innerHTML = rows.length > 0 ? rows.map(({ tower, assessment }) => {
    const protectedReasons = assessment?.protectedReasons ?? ["보호 상태 확인 필요"];
    const protectedState = assessment?.protected ?? true;
    const essence = ctx.engine.towerDismantleEssenceValue(tower);
    // 보호를 껐어도 "이 한자는 이 1기뿐"이라는 사실은 남겨 실수를 막는다.
    const soleBadge = assessment?.soleCopy && !protectedState ? `<i class="dismantle-sole-badge">유일</i>` : "";
    return `<label class="dismantle-row ${protectedState ? "is-protected" : ""} ${soleBadge ? "is-sole" : ""}" style="--element:${ELEMENT_STYLES[tower.wuxing].color}">
      <input type="checkbox" data-dismantle-id="${tower.id}" ${dismantleSelection.has(tower.id) ? "checked" : ""} ${protectedState || !active ? "disabled" : ""}>
      ${spiritPortraitMarkup(tower.char, tower.wuxing, "workbench-spirit--dismantle")}<b>${escapeHtml(tower.char)}</b><span><strong>${soleBadge}${tower.wuxing}행 · ${towerProgressionLabel(tower)} · #${tower.id}</strong><small>${protectedState ? `분해 불가 — ${protectedReasons.map(escapeHtml).join(" · ")}` : (assessment?.reasons ?? []).map(escapeHtml).join(" · ") || "분해 가능"}</small></span><em>${protectedState ? "보호" : essenceAmountChip(tower.wuxing, essence)}</em>
    </label>`;
  }).join("") : `<div class="workbench-empty"><b>조건에 맞는 가방 자령이 없습니다</b><span>필터를 바꾸거나 소환 자령을 가방에 보관하세요.</span><button type="button" data-goto-inventory>가방 탭 열기</button></div>`;

  const quote = ctx.engine.quoteDismantle([...dismantleSelection], dismantleOptions());
  // [J-1] "木+3" 은 무엇이 3인지 안 말한다 — 문기·분해 점수 각각에 단위를 붙인다.
  const gainLabel = essenceGainsLabel(quote.gains);
  const scoreLabel = (Object.entries(quote.scoreGains) as Array<[Wuxing, number]>).filter(([, amount]) => amount > 0).map(([wuxing, amount]) => `${wuxing} 분해 점수 +${amount}`).join(" · ");
  must<HTMLElement>("#dismantle-selection-summary").textContent = `${dismantleSelection.size}기 선택${quote.blocked.length > 0 ? ` · 보호 충돌 ${quote.blocked.length}` : ""}`;
  must<HTMLElement>("#dismantle-gain-summary").textContent = gainLabel ? `${gainLabel}${scoreLabel ? ` · ${scoreLabel}` : ""}` : "예상 문기 없음";
  must<HTMLButtonElement>("#dismantle-confirm-button").disabled = !active || quote.ids.length === 0 || quote.blocked.length > 0;

  must<HTMLElement>("#growth-element-tabs").innerHTML = WUXING_ORDER.map((wuxing) => `<button type="button" data-growth-element="${wuxing}" class="${ctx.growthElement === wuxing ? "is-selected" : ""}" style="--element:${ELEMENT_STYLES[wuxing].color}"><b>${wuxing}</b><span>문기 ${ctx.engine.state.elementEssence[wuxing]}</span><small>분해 점수 ${ctx.engine.state.elementDismantleScore[wuxing]}</small></button>`).join("");

  const batchButtons = (scope: "global" | "element", stat: UpgradeStat): string => ([1, 5, "max"] as const).map((amount) => {
    const quoteForAmount = scope === "global" ? ctx.engine.quoteGlobalUpgrade(stat, amount) : ctx.engine.quoteElementUpgrade(ctx.growthElement, stat, amount);
    // "투자 불가" 는 비용이 아니라 사유다 — 뒤에 화폐를 붙이면 "투자 불가 엽전" 같은 비문이 된다.
    const label = upgradeAmountLabel(scope, stat, null, amount);
    // [J-1] 오행 강화가 먹는 것은 그 오행의 문기다 — 글자 하나만 두면 무엇인지 모른다.
    const currency = label === UPGRADE_UNAVAILABLE_LABEL ? "" : scope === "global" ? " 엽전" : ` ${ctx.growthElement} 문기`;
    // FB7-강화: 이번 투자가 10단계 이정표를 지나면 버튼에 里 표식을 얹는다.
    const crossesMilestone = quoteForAmount.levels > 0 && upgradeMilestoneCount(quoteForAmount.toLevel) > upgradeMilestoneCount(quoteForAmount.fromLevel);
    return `<button type="button" data-growth-upgrade-scope="${scope}" data-growth-stat="${stat}" data-growth-amount="${amount}" ${!active || quoteForAmount.levels <= 0 || !quoteForAmount.affordable ? "disabled" : ""}>${label}${currency}${crossesMilestone ? ` <i class="growth-milestone-flag" title="10단계 이정표 도달 · 추가 보너스">里</i>` : ""}</button>`;
  }).join("");
  // FB7-강화: 10단계 이정표마다 4단계치 보너스가 더 붙는다. 행마다 이정표
  // 누적과 다음 이정표까지 남은 단계를 함께 적어 "후반에도 오를 이유"를 보인다.
  const milestoneNote = (stat: UpgradeStat, level: number, perLevel: number): string => {
    const milestones = upgradeMilestoneCount(level);
    const toNext = UPGRADE_MILESTONE_INTERVAL - (level % UPGRADE_MILESTONE_INTERVAL);
    const bonusLabel = formatStatBonus(stat, perLevel * UPGRADE_MILESTONE_LEVEL_BONUS);
    return `이정표 ${UPGRADE_MILESTONE_INTERVAL}단계마다 ${bonusLabel}${milestones > 0 ? ` · 달성 ${milestones}회` : ""}${level < 99 ? ` · 다음까지 ${toNext}단계` : ""}`;
  };
  const globalRows = UPGRADE_STAT_ORDER.map((stat) => {
    const meta = UPGRADE_STAT_META[stat];
    const level = ctx.engine.state.globalUpgrades[stat];
    return `<article class="growth-stat-row"><i>${meta.glyph}</i><div><b>공용 ${meta.label} <em>Lv.${level}/99</em></b><small>${meta.description} · 현재 ${formatStatBonus(stat, ctx.engine.globalUpgradeBonus(stat))} · ${milestoneNote(stat, level, meta.globalPerLevel)}</small></div><span>${batchButtons("global", stat)}</span></article>`;
  }).join("");
  const elementRows = UPGRADE_STAT_ORDER.map((stat) => {
    const meta = UPGRADE_STAT_META[stat];
    const level = ctx.engine.state.elementUpgrades[ctx.growthElement][stat];
    return `<article class="growth-stat-row is-element" style="--element:${ELEMENT_STYLES[ctx.growthElement].color}"><i>${meta.glyph}</i><div><b>${ctx.growthElement}행 ${meta.label} <em>Lv.${level}/99</em></b><small>현재 ${formatStatBonus(stat, ctx.engine.elementUpgradeBonus(ctx.growthElement, stat))} · 단계당 ${formatStatBonus(stat, meta.elementPerLevel)} · ${milestoneNote(stat, level, meta.elementPerLevel)}</small></div><span>${batchButtons("element", stat)}</span></article>`;
  }).join("");
  const traitRows = ELEMENT_TRAITS[ctx.growthElement].map((trait, traitIndex) => {
    const level = ctx.engine.elementTraitLevel(ctx.growthElement, traitIndex);
    const unlockScore = elementTraitUnlockScore(traitIndex) ?? 0;
    const unlocked = ctx.engine.state.elementDismantleScore[ctx.growthElement] >= unlockScore;
    const buttons = ([1, 5, "max"] as const).map((amount) => {
      const traitQuote = ctx.engine.quoteElementTraitUpgrade(ctx.growthElement, traitIndex, amount);
      const label = upgradeAmountLabel("trait", null, traitIndex, amount);
      return `<button type="button" data-growth-upgrade-scope="trait" data-growth-trait="${traitIndex}" data-growth-amount="${amount}" ${!active || !unlocked || traitQuote.levels <= 0 || !traitQuote.affordable ? "disabled" : ""}>${label}${label === UPGRADE_UNAVAILABLE_LABEL ? "" : ` ${ctx.growthElement} 문기`}</button>`;
    }).join("");
    return `<article class="growth-trait-row ${unlocked ? "is-unlocked" : "is-locked"}" style="--element:${ELEMENT_STYLES[ctx.growthElement].color}"><div class="trait-seal"><b>${traitIndex + 1}</b><small>${unlocked ? "개방" : `${unlockScore}점`}</small></div><div><strong>${trait.name} <em>Lv.${level}/${ELEMENT_TRAIT_MAX_LEVEL}</em></strong><span>${trait.summary} +${trait.perLevel}${trait.unit}/단계${trait.milestone ? ` · ${trait.milestone}` : ""}</span><small>${unlocked ? `다음 비용 ${elementTraitUpgradeCost(level) ?? "최고"} 문기` : `분해 점수 ${ctx.engine.state.elementDismantleScore[ctx.growthElement]}/${unlockScore}`}</small></div><nav>${buttons}</nav></article>`;
  }).join("");
  must<HTMLElement>("#growth-upgrade-list").innerHTML = `<section class="growth-upgrade-section"><header><b>공용 능력 강화</b><small>엽전 투자 · 5능력치×99단계</small></header>${globalRows}</section><section class="growth-upgrade-section"><header data-growth-section="${ctx.growthElement}"><b>${ctx.growthElement}행 능력 강화</b><small>문기 투자 · 1회·5회·최대</small></header>${elementRows}</section><section class="growth-upgrade-section"><header><b>${ctx.growthElement}행 고유 특성</b><small>분해 점수 5·15·30 순차 개방</small></header>${traitRows}</section>`;
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireGrowth1(): void {
  syncDismantleUniqueControl();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireGrowth2(): void {
  for (const selector of ["#dismantle-element-filter", "#dismantle-stage-filter", "#dismantle-status-filter"] as const) {
    must<HTMLSelectElement>(selector).addEventListener("change", () => {
      ctx.growthRenderKey = "";
      renderGrowth();
    });
  }
  must<HTMLElement>("#growth-dismantle-list").addEventListener("click", (event) => {
    if (!(event.target as HTMLElement).closest("[data-goto-inventory]")) return;
    setPanelTab("inventory");
  });
  must<HTMLElement>("#growth-dismantle-list").addEventListener("change", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-dismantle-id]");
    if (!input) return;
    const id = Number(input.dataset.dismantleId);
    if (!Number.isInteger(id)) return;
    if (input.checked) dismantleSelection.add(id);
    else dismantleSelection.delete(id);
    ctx.growthRenderKey = "";
    renderGrowth();
  });
  must<HTMLButtonElement>("#dismantle-recommend-button").addEventListener("click", () => {
    dismantleSelection.clear();
    const visibleEligible = [...must<HTMLElement>("#growth-dismantle-list").querySelectorAll<HTMLInputElement>("[data-dismantle-id]:not(:disabled)")];
    for (const input of visibleEligible.slice(0, 12)) dismantleSelection.add(Number(input.dataset.dismantleId));
    ctx.growthRenderKey = "";
    renderGrowth();
  });
  must<HTMLButtonElement>("#dismantle-clear-button").addEventListener("click", () => {
    dismantleSelection.clear();
    ctx.growthRenderKey = "";
    renderGrowth();
  });
  must<HTMLButtonElement>("#dismantle-unique-toggle").addEventListener("click", () => {
    sound.unlock();
    setDismantleProtectsUnique(!ctx.dismantleProtectsUnique);
    sound.playUiConfirm();
  });
  must<HTMLButtonElement>("#dismantle-confirm-button").addEventListener("click", () => {
    const quote = ctx.engine.quoteDismantle([...dismantleSelection], dismantleOptions());
    if (quote.ids.length === 0 || quote.blocked.length > 0) return;
    const towers = quote.ids.map((id) => ctx.engine.state.inventoryTowers.find((tower) => tower.id === id)).filter((tower): tower is Tower => Boolean(tower));
    const towerLabel = towers.map((tower) => `${tower.char}(${tower.wuxing} ${towerProgressionLabel(tower)})`).join(" · ");
    const gainLabel = essenceGainsLabel(quote.gains);
    if (!window.confirm(`${towers.length}기를 한 번에 분해합니다.\n${towerLabel}\n획득: ${gainLabel}`)) return;
    const result = ctx.engine.dismantleTowers(quote.ids, dismantleOptions());
    if (result.ok) dismantleSelection.clear();
    handleAction(result);
  });
  must<HTMLElement>("#growth-element-tabs").addEventListener("click", (event) => {
    const wuxing = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-growth-element]")?.dataset.growthElement as Wuxing | undefined;
    if (!wuxing) return;
    ctx.growthElement = wuxing;
    ctx.growthRenderKey = "";
    renderGrowth();
    // 탭만 바뀌고 화면은 그대로라 "눌렀는데 아무 일도 없다"로 읽혔다 — 해당 오행 섹션으로 데려간다.
    must<HTMLElement>("#growth-upgrade-list")
      .querySelector<HTMLElement>(`[data-growth-section='${wuxing}']`)
      ?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
  });
  must<HTMLElement>("#growth-upgrade-list").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-growth-upgrade-scope]");
    if (!button) return;
    const scope = button.dataset.growthUpgradeScope;
    const amountRaw = button.dataset.growthAmount ?? "1";
    const amount: number | "max" = amountRaw === "max" ? "max" : Number(amountRaw);
    const stat = button.dataset.growthStat as UpgradeStat | undefined;
    const traitIndex = Number(button.dataset.growthTrait);
    const quote = scope === "global" && stat
      ? ctx.engine.quoteGlobalUpgrade(stat, amount)
      : scope === "element" && stat
        ? ctx.engine.quoteElementUpgrade(ctx.growthElement, stat, amount)
        : ctx.engine.quoteElementTraitUpgrade(ctx.growthElement, traitIndex, amount);
    if (amount === "max" && !window.confirm(`실제 누적 비용 ${quote.cost}을 사용해 ${quote.levels}단계 강화할까요? (${quote.fromLevel} → ${quote.toLevel})`)) return;
    const result = scope === "global" && stat
      ? ctx.engine.upgradeGlobal(stat, amount)
      : scope === "element" && stat
        ? ctx.engine.upgradeElement(ctx.growthElement, stat, amount)
        : ctx.engine.upgradeElementTrait(ctx.growthElement, traitIndex, amount);
    handleAction(result);
  });
}
