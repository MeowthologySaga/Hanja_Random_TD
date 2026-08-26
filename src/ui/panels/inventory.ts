/*
 * 판 보관고 패널.
 */
import { CASUAL_STAR_COLORS, CASUAL_STAR_NAMES } from "../../core/casual";
import { GameEngine } from "../../core/game";
import { definitionForTower, ELEMENT_STYLES, STAGE_COLORS, STAGE_NAMES, WUXING_ORDER } from "../../core/hanzi";
import { jaryeongVisualFor } from "../../core/jaryeongs";
import { learningInfoForNotation } from "../../core/learning";
import { type Tower, type Wuxing } from "../../core/types";
import {
  ctx,
  dismantleSelection,
  must,
  RUN_INVENTORY_GRADE_BANDS,
  RUN_INVENTORY_SORTS,
  runInventoryBulkSelection,
  type RunInventoryGradeBandId,
  type RunInventorySort,
  sound
} from "../app-context";
import {
  casualStarOf,
  dismantleBlockNote,
  escapeHtml,
  essenceAmountChip,
  essenceAmountLabel,
  essenceGainsLabel,
  protectionShortLabel,
  visualBackgroundStyle
} from "../format";
import { handleAction, setFocusFrame, setPanelTab, showToast, syncPanel } from "../hud";
import { dismantleOptions } from "./growth";

function runInventorySortLabel(sort: RunInventorySort): string {
  return sort === "recent" ? "획득순" : sort === "element" ? "오행순" : ctx.engine.state.mode === "casual" ? "별순" : "단계순";
}

function runInventoryGrade(tower: Tower): number {
  return ctx.engine.state.mode === "casual" ? casualStarOf(tower) : tower.stage;
}

function runInventoryGradeLabel(): string {
  return ctx.engine.state.mode === "casual" ? "별" : "단계";
}

function runInventoryGradeBandOf(tower: Tower): RunInventoryGradeBandId | null {
  const grade = runInventoryGrade(tower);
  return RUN_INVENTORY_GRADE_BANDS.find((band) => grade >= band.min && grade <= band.max)?.id ?? null;
}

/** 자령 한 기를 한 줄로 요약한다 — 카드 title · 행동 바 안내가 같은 문장을 쓴다. */
function runInventoryTowerSummary(tower: Tower): string {
  const learning = learningInfoForNotation(ctx.engine.state.notation, tower.char);
  const star = casualStarOf(tower);
  const progression = ctx.engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]}` : STAGE_NAMES[tower.stage];
  return `${tower.char} ${learning.short} · ${tower.wuxing}행 · ${progression}`;
}

function runInventoryAbilityLine(tower: Tower): string {
  if (!ctx.engine.towerHasActiveSkills(tower)) return ctx.engine.state.mode === "casual" ? "기본 공격 · 2★부터 기술 해금" : "기본 공격 · 합성 재료";
  const ability = definitionForTower(ctx.engine.catalog, tower.definitionId).combat.abilities.semantic;
  return `${ability.name} · ${ability.summary}`;
}

/** [J-1] "木+3" 은 무엇이 3인지 안 말한다 — 단위를 붙인 공용 표기를 쓴다. */
function essenceGainLabel(gains: Record<Wuxing, number>): string {
  return essenceGainsLabel(gains);
}

/*
 * R19 보관고 우측 미니 상세.
 *
 * 격자 카드는 92px 라 훈음 한 줄이 한계다. 고른 자령의 초상·훈음·등급·오행·
 * 능력 한 줄은 이 칸이 받는다 — 프레임을 닫지 않고도 "이게 맞나" 를 확인할 수
 * 있어야 클릭이 곧 배치가 아니게 된 값을 한다.
 * 일괄 모드에서는 개별 자령 대신 담은 바구니의 오행별 회수량을 보여 준다.
 */
function renderRunInventoryDetail(
  selected: Tower | undefined,
  stackSize: number,
  assessment: ReturnType<GameEngine["cleanupAssessments"]>[number] | undefined
): void {
  const detail = must<HTMLElement>("#run-inventory-detail");
  if (ctx.runInventoryBulkMode) {
    const quote = ctx.engine.quoteDismantle([...runInventoryBulkSelection], dismantleOptions());
    const gainLabel = essenceGainLabel(quote.gains);
    detail.innerHTML = `<div class="run-inventory-detail-bulk">
      <span class="run-inventory-detail-eyebrow">일괄 분해 바구니</span>
      <b>${quote.ids.length}기</b>
      <strong>${gainLabel ? escapeHtml(gainLabel) : "담은 자령 없음"}</strong>
      <small>${quote.blocked.length > 0 ? `보호로 빠짐 ${quote.blocked.length}기` : "보호 자령은 애초에 담기지 않습니다"}</small>
      <em>카드를 눌러 담고 · Esc 로 일괄 모드를 끕니다</em>
    </div>`;
    return;
  }
  if (!selected) {
    detail.innerHTML = `<p class="run-inventory-detail-empty"><b>카드를 고르세요</b><span>초상 · 훈음 · 오행 · 능력을 여기서 확인하고<br>아래 줄에서 배치·분해·잠금을 고릅니다</span></p>`;
    return;
  }
  const visual = jaryeongVisualFor(selected.char, selected.wuxing, ctx.engine.state.region);
  const learning = learningInfoForNotation(ctx.engine.state.notation, selected.char);
  const star = casualStarOf(selected);
  const progression = ctx.engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]}` : `${selected.stage}단계 ${STAGE_NAMES[selected.stage]}`;
  const concentration = selected.concentration ?? 0;
  detail.innerHTML = `<div class="run-inventory-detail-card" style="--inventory-element:${ELEMENT_STYLES[selected.wuxing].color};--inventory-star:${ctx.engine.state.mode === "casual" ? CASUAL_STAR_COLORS[star] : STAGE_COLORS[selected.stage]}">
    <span class="run-inventory-detail-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
    <b>${escapeHtml(selected.char)}</b>
    <strong>${escapeHtml(learning.short)}</strong>
    <p><i>${selected.wuxing}행</i><u>${escapeHtml(progression)}</u></p>
    <small>${escapeHtml(runInventoryAbilityLine(selected))}</small>
    <em>보관 ${stackSize}기${concentration > 0 ? ` · 농축 ${concentration}단계` : ""}${selected.locked ? " · 鎖 잠금" : ""}</em>
    ${assessment?.protected
      ? `<em class="detail-protection">${escapeHtml(dismantleBlockNote(assessment.protectedReasons))}</em>`
      : `<em class="detail-yield">분해하면 ${escapeHtml(essenceAmountLabel(selected.wuxing, ctx.engine.towerDismantleEssenceValue(selected)))}</em>`}
  </div>`;
}

/*
 * R19 행동 바.
 *
 * 사용자 원문: "인벤에서 자령 클릭하면 바로 배치모드인데, 분류·분해 등
 * 여러 작업하기 쉽게 개선하자." 클릭이 곧 배치였던 탓에 보관고는 "꺼내는
 * 서랍" 이지 "관리하는 곳" 이 아니었다. 선택(카드)과 행동(이 줄)을 갈라
 * 배치·분해·잠금·농축을 한 자리에 세운다. 고른 것이 없으면 줄 전체를
 * 흐리고 무엇을 해야 하는지만 말한다.
 */
function renderRunInventoryActions(
  selected: Tower | undefined,
  assessments: Map<number, ReturnType<GameEngine["cleanupAssessments"]>[number]>,
  active: boolean
): void {
  const bar = must<HTMLElement>("#run-inventory-actions");
  const bulkToggle = must<HTMLButtonElement>("#run-inventory-bulk-toggle");
  bulkToggle.classList.toggle("is-on", ctx.runInventoryBulkMode);
  bulkToggle.setAttribute("aria-pressed", String(ctx.runInventoryBulkMode));
  bulkToggle.textContent = ctx.runInventoryBulkMode ? "일괄 모드 끄기" : "여러 개 선택";
  must<HTMLElement>("#run-inventory-action-single").hidden = ctx.runInventoryBulkMode;
  must<HTMLElement>("#run-inventory-action-bulk").hidden = !ctx.runInventoryBulkMode;

  if (ctx.runInventoryBulkMode) {
    const quote = ctx.engine.quoteDismantle([...runInventoryBulkSelection], dismantleOptions());
    const gainLabel = essenceGainLabel(quote.gains);
    const confirm = must<HTMLButtonElement>("#run-inventory-bulk-dismantle");
    bar.classList.toggle("is-idle", quote.ids.length === 0);
    confirm.disabled = !active || quote.ids.length === 0;
    confirm.textContent = quote.ids.length > 0 ? `선택 ${quote.ids.length}기 분해 · ${gainLabel}` : "선택 0기 분해";
    confirm.title = quote.ids.length > 0 ? `${quote.ids.length}기를 한 번에 분해해 ${gainLabel} 를 회수합니다.` : "분해할 자령을 카드에서 담으세요.";
    must<HTMLButtonElement>("#run-inventory-bulk-clear").disabled = runInventoryBulkSelection.size === 0;
    must<HTMLElement>("#run-inventory-bulk-hint").textContent = quote.ids.length > 0
      ? `담은 ${quote.ids.length}기${quote.blocked.length > 0 ? ` · 보호 제외 ${quote.blocked.length}기` : ""}`
      : "카드를 눌러 담으세요 · 보호 자령은 담기지 않습니다";
    must<HTMLElement>("#run-inventory-dismantle-note").hidden = true;
    return;
  }

  const assessment = selected ? assessments.get(selected.id) : undefined;
  const dismantleReady = Boolean(selected) && assessment?.protected === false;
  bar.classList.toggle("is-idle", !selected);
  must<HTMLElement>("#run-inventory-action-hint").textContent = selected ? `선택 · ${runInventoryTowerSummary(selected)}` : "카드를 고르세요";

  const deploy = must<HTMLButtonElement>("#run-inventory-deploy");
  deploy.disabled = !active || !selected;
  deploy.title = selected ? "가방을 걷고 전장 칸을 고르는 배치 모드로 넘어갑니다 (카드 더블클릭도 같은 길)" : "먼저 카드를 고르세요";

  const dismantle = must<HTMLButtonElement>("#run-inventory-dismantle");
  const essence = selected ? ctx.engine.towerDismantleEssenceValue(selected) : 0;
  dismantle.disabled = !active || !dismantleReady;
  // [J-1] 회수물이 문기라는 사실은 버튼 안에서 오행색으로 먼저 읽혀야 한다.
  dismantle.innerHTML = !selected
    ? "분해"
    : dismantleReady
      ? `분해 · ${essenceAmountChip(selected.wuxing, essence)}`
      : "분해 불가";
  dismantle.title = !selected
    ? "먼저 카드를 고르세요"
    : dismantleReady
      ? `${essenceAmountLabel(selected.wuxing, essence)} 를 회수하고 이 자령을 없앱니다. 되돌릴 수 없습니다.`
      : dismantleBlockNote(assessment?.protectedReasons ?? []);

  /*
   * [J-2] 분해가 막힌 이유를 버튼 바로 아래 한 줄로 편다.
   *
   * 사용자 원문: "잠금 안 했는데 분해 안 되는 애가 있는데 이건 뭐지?"
   * 사유는 여태 title 툴팁에만 있었다 — 마우스를 얹고 기다려야 나오는 곳이라
   * 사실상 없는 정보였다. 비활성 버튼 옆의 침묵을 이 줄이 메운다.
   */
  const note = must<HTMLElement>("#run-inventory-dismantle-note");
  const blocked = Boolean(selected) && !dismantleReady;
  note.hidden = !blocked;
  note.textContent = blocked ? dismantleBlockNote(assessment?.protectedReasons ?? []) : "";

  const lock = must<HTMLButtonElement>("#run-inventory-lock");
  lock.disabled = !selected;
  lock.classList.toggle("is-on", Boolean(selected?.locked));
  lock.textContent = selected?.locked ? "鎖 잠금 해제" : "잠금";
  lock.title = selected?.locked ? "잠금을 풀면 다시 분해·합성 재료로 쓸 수 있습니다" : "판매·합성·분해에 쓰이지 않게 보호합니다";

  const concentrate = must<HTMLButtonElement>("#run-inventory-concentrate");
  concentrate.disabled = !active || !selected;
  concentrate.title = selected ? "농축 공방을 열고 이 자령을 대상으로 지정합니다" : "먼저 카드를 고르세요";
}

/*
 * R14 보관고 → R19 관리 허브.
 *
 * 목록 DOM(#run-inventory-layout)은 집중 프레임 본문에 얹혀 있다. 카드는
 * 격자 한 칸(약 92x110)이라 한 눈에 들어오는 정보만 남긴다 — 초상 · 한자 ·
 * 훈음 · 오행 점 · 별. 나머지(기술 이름·농축 단계)는 우측 미니 상세가 받는다.
 * 같은 한자 묶음(캐주얼은 한자+별)은 계속 한 장으로 겹쳐 ×N 으로 센다.
 * R19: 카드 클릭은 고르기까지고, 실제 행동은 아래 고정 줄이 맡는다.
 */
export function renderRunInventory(): void {
  const active = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
  // 담아 둔 자령이 분해·배치·합성으로 사라지면 바구니도 같이 비운다.
  for (const id of [...runInventoryBulkSelection]) {
    if (!ctx.engine.state.inventoryTowers.some((tower) => tower.id === id)) runInventoryBulkSelection.delete(id);
  }
  const selectedId = ctx.engine.state.selectedTowerId;
  const key = ctx.engine.state.inventoryTowers.map((tower) => `${tower.id}:${tower.locked}:S${tower.casualStar ?? 0}:C${tower.concentration ?? 0}:${tower.concentrationPath ?? "-"}`).join("|")
    + `|${selectedId ?? "none"}|${active ? "active" : "inactive"}|${ctx.engine.state.mode}|${ctx.runInventoryElementFilter ?? "all"}|${ctx.runInventoryGradeFilter ?? "all"}|${ctx.runInventorySort}`
    + `|U${ctx.dismantleProtectsUnique ? 1 : 0}|B${ctx.runInventoryBulkMode ? 1 : 0}:${[...runInventoryBulkSelection].sort((left, right) => left - right).join(",")}`;
  must<HTMLElement>("#run-inventory-count").textContent = String(ctx.engine.state.inventoryTowers.length);
  if (key === ctx.runInventoryRenderKey) return;
  ctx.runInventoryRenderKey = key;
  const list = must<HTMLElement>("#run-inventory-list");
  const grouped = new Map<string, Tower[]>();
  for (const tower of ctx.engine.state.inventoryTowers) {
    const groupKey = ctx.engine.state.mode === "casual" ? `${tower.char}:${casualStarOf(tower)}` : tower.char;
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), tower]);
  }
  must<HTMLElement>("#run-inventory-heading-count").textContent = `${ctx.engine.state.inventoryTowers.length}기 · ${grouped.size}종`;
  // 강화 제련소의 [유일 자령 보호] 토글과 같은 규칙으로 읽어야 한 화면 안에서
  // "여기선 보호, 저기선 분해 가능" 같은 어긋남이 생기지 않는다.
  const cleanupAssessments = new Map(ctx.engine.cleanupAssessments(dismantleOptions()).map((assessment) => [assessment.towerId, assessment]));
  const cleanupCandidates = ctx.engine.cleanupCandidates(8, true);
  must<HTMLButtonElement>("#cleanup-recommended-button").disabled = !active || cleanupCandidates.length === 0;
  must<HTMLButtonElement>("#cleanup-recommended-button").textContent = cleanupCandidates.length > 0 ? `정리 후보 ${cleanupCandidates.length}기 분해` : "보호 완료";
  const elementCounts = new Map<Wuxing, number>(WUXING_ORDER.map((wuxing) => [wuxing, 0]));
  for (const tower of ctx.engine.state.inventoryTowers) elementCounts.set(tower.wuxing, (elementCounts.get(tower.wuxing) ?? 0) + 1);
  must<HTMLElement>("#run-inventory-element-filters").innerHTML = WUXING_ORDER.map((wuxing) => {
    const on = ctx.runInventoryElementFilter === wuxing;
    return `<button type="button" data-inventory-element="${wuxing}" class="${on ? "is-active" : ""}" aria-pressed="${String(on)}" title="${wuxing}행만 보기 (다시 누르면 전체)" style="--filter-element:${ELEMENT_STYLES[wuxing].color}">${wuxing}<small>${elementCounts.get(wuxing) ?? 0}</small></button>`;
  }).join("");
  const gradeCounts = new Map<RunInventoryGradeBandId, number>(RUN_INVENTORY_GRADE_BANDS.map((band) => [band.id, 0]));
  for (const tower of ctx.engine.state.inventoryTowers) {
    const band = runInventoryGradeBandOf(tower);
    if (band) gradeCounts.set(band, (gradeCounts.get(band) ?? 0) + 1);
  }
  const gradeLabel = runInventoryGradeLabel();
  must<HTMLElement>("#run-inventory-grade-filters").innerHTML = [
    `<button type="button" data-inventory-grade="all" class="${ctx.runInventoryGradeFilter === null ? "is-active" : ""}" aria-pressed="${String(ctx.runInventoryGradeFilter === null)}" title="모든 ${gradeLabel} 보기">전체<small>${ctx.engine.state.inventoryTowers.length}</small></button>`,
    ...RUN_INVENTORY_GRADE_BANDS.map((band) => {
      const on = ctx.runInventoryGradeFilter === band.id;
      return `<button type="button" data-inventory-grade="${band.id}" class="${on ? "is-active" : ""}" aria-pressed="${String(on)}" title="${gradeLabel} ${band.label} 만 보기 (다시 누르면 전체)">${band.label}<small>${gradeCounts.get(band.id) ?? 0}</small></button>`;
    })
  ].join("");
  const sortButton = must<HTMLButtonElement>("#run-inventory-sort");
  sortButton.textContent = runInventorySortLabel(ctx.runInventorySort);
  sortButton.title = `정렬 · ${runInventorySortLabel(ctx.runInventorySort)} (눌러 전환)`;
  const selectedTower = ctx.engine.state.inventoryTowers.find((tower) => tower.id === selectedId);
  const selectedStackSize = selectedTower
    ? ctx.engine.state.inventoryTowers.filter((tower) => tower.char === selectedTower.char && (ctx.engine.state.mode !== "casual" || casualStarOf(tower) === casualStarOf(selectedTower))).length
    : 0;
  renderRunInventoryDetail(selectedTower, selectedStackSize, selectedTower ? cleanupAssessments.get(selectedTower.id) : undefined);
  renderRunInventoryActions(selectedTower, cleanupAssessments, active);
  if (ctx.engine.state.inventoryTowers.length === 0) {
    list.innerHTML = '<div class="empty-run-inventory"><b>보관 중인 자령이 없습니다</b><span>상점에서 소환하세요</span><button type="button" data-inventory-goto-shop>상점으로</button></div>';
    return;
  }
  const visible = [...grouped.values()]
    .filter((stack) => ctx.runInventoryElementFilter === null || stack[0]!.wuxing === ctx.runInventoryElementFilter)
    .filter((stack) => ctx.runInventoryGradeFilter === null || runInventoryGradeBandOf(stack[0]!) === ctx.runInventoryGradeFilter);
  if (visible.length === 0) {
    const gradeBand = RUN_INVENTORY_GRADE_BANDS.find((band) => band.id === ctx.runInventoryGradeFilter);
    const missing = [ctx.runInventoryElementFilter ? `${ctx.runInventoryElementFilter}행` : "", gradeBand ? `${gradeLabel} ${gradeBand.label}` : ""].filter(Boolean).join(" · ");
    list.innerHTML = `<div class="empty-run-inventory"><b>${escapeHtml(missing)} 자령이 없습니다</b><span>칩을 다시 눌러 전체를 보세요</span></div>`;
    return;
  }
  const rank = (stack: Tower[]): number => Math.max(...stack.map((tower) => tower.id));
  list.innerHTML = visible.sort((left, right) => {
    if (ctx.runInventorySort === "element") {
      const gap = WUXING_ORDER.indexOf(left[0]!.wuxing) - WUXING_ORDER.indexOf(right[0]!.wuxing);
      if (gap !== 0) return gap;
    } else if (ctx.runInventorySort === "star") {
      const gap = runInventoryGrade(right[0]!) - runInventoryGrade(left[0]!);
      if (gap !== 0) return gap;
    }
    return rank(right) - rank(left);
  }).map((stack) => {
    const tower = selectedTower && stack.some((candidate) => candidate.id === selectedTower.id) ? selectedTower : stack.find((candidate) => !candidate.locked) ?? stack[0]!;
    const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
    const learning = learningInfoForNotation(ctx.engine.state.notation, tower.char);
    const selected = tower.id === selectedId && !ctx.runInventoryBulkMode;
    const eligible = stack.filter((candidate) => cleanupAssessments.get(candidate.id)?.protected === false);
    const checked = eligible.filter((candidate) => runInventoryBulkSelection.has(candidate.id)).length;
    const concentration = Math.max(...stack.map((candidate) => candidate.concentration ?? 0));
    const star = casualStarOf(tower);
    const progression = ctx.engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]}` : STAGE_NAMES[tower.stage];
    const skill = ctx.engine.towerHasActiveSkills(tower) ? definitionForTower(ctx.engine.catalog, tower.definitionId).combat.abilities.semantic.name : ctx.engine.state.mode === "casual" ? "기본 공격·2★ 해금" : "기본 공격·합성 재료";
    /*
     * [J-3] 잠금은 여태 격자에서 보이지 않았다.
     *
     * 사용자 원문: "인벤토리 내에서 잠금 표시한 게 티가 안 난다." 대표 자령을
     * 고를 때 잠기지 않은 것을 먼저 집으므로(위 `stack.find`), 묶음에 한 기라도
     * 안 잠긴 게 있으면 자물쇠는 화면에서 통째로 사라졌다. 묶음 단위로 세어
     * 전부 잠김 / 일부 잠김을 갈라 배지와 링으로 말한다.
     */
    const lockedCount = stack.filter((candidate) => candidate.locked).length;
    const allLocked = lockedCount > 0 && lockedCount === stack.length;
    // [J-2] 보호 사유를 92px 카드가 감당할 두 글자로 줄여 꼬리표에 싣는다.
    const stackReasons = stack.flatMap((candidate) => cleanupAssessments.get(candidate.id)?.protectedReasons ?? []);
    const protectionTag = protectionShortLabel(stackReasons);
    const detail = `${tower.char} ${learning.short} · ${tower.wuxing}행 · ${progression} · ${skill}${concentration > 0 ? ` · 농축 ${concentration}` : ""} · 보관 ${stack.length}기${lockedCount > 0 ? ` · 鎖 잠금 ${lockedCount}기` : ""}`;
    const hint = ctx.runInventoryBulkMode
      ? eligible.length === 0 ? `보호 중(${protectionTag}) — 담을 수 없습니다` : checked > 0 ? `담김 ${checked}기 · 눌러 빼기` : `눌러 ${eligible.length}기 담기`
      : eligible.length === 0 ? `${dismantleBlockNote(stackReasons)} · 클릭 = 고르기` : "클릭 = 고르기 · 더블클릭 = 바로 배치";
    const stateClass = ctx.runInventoryBulkMode
      ? `is-bulk ${eligible.length === 0 ? "is-bulk-blocked" : ""} ${checked > 0 ? "is-checked" : ""} ${allLocked ? "is-locked" : lockedCount > 0 ? "is-part-locked" : ""}`
      : `${selected ? "is-selected" : ""} ${eligible.length > 0 ? "is-cleanup-candidate" : "is-protected-stack"} ${allLocked ? "is-locked" : lockedCount > 0 ? "is-part-locked" : ""}`;
    return `<button class="run-inventory-card ${stateClass}" type="button" data-run-inventory-id="${tower.id}" data-run-inventory-eligible="${eligible.map((candidate) => candidate.id).join(",")}" ${ctx.runInventoryBulkMode ? `aria-pressed="${String(checked > 0)}"` : ""} title="${escapeHtml(`${detail} · ${hint}`)}" aria-label="${escapeHtml(`${detail} · ${hint}`)}" style="--inventory-element:${ELEMENT_STYLES[tower.wuxing].color};--inventory-star:${ctx.engine.state.mode === "casual" ? CASUAL_STAR_COLORS[star] : STAGE_COLORS[tower.stage]}">
      <span class="run-inventory-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <b>${tower.char}</b>
      <span><strong>${escapeHtml(learning.short)}</strong><small>${ctx.engine.state.mode === "casual" ? CASUAL_STAR_NAMES[star] : progression}</small></span>
      <i class="run-inventory-dot" aria-hidden="true">${tower.wuxing}</i>
      ${stack.length > 1 ? `<mark class="run-inventory-stack">×${stack.length}</mark>` : ""}
      ${ctx.engine.state.mode === "casual" ? `<u class="run-inventory-star">${star}★</u>` : ""}
      ${ctx.runInventoryBulkMode ? `<span class="run-inventory-check" aria-hidden="true">${eligible.length === 0 ? "보호" : checked > 0 ? `✓${checked}` : ""}</span>` : ""}
      <em>${selected ? "선택됨" : eligible.length > 0 ? "정리" : protectionTag}</em>
      ${lockedCount > 0 ? `<span class="run-inventory-lock" aria-hidden="true">鎖${allLocked ? "" : lockedCount}</span>` : ""}
    </button>`;
  }).join("");
}

/**
 * 보관고에서 고른 자령을 전장 배치 모드로 넘긴다.
 *
 * 프레임은 전장을 덮으므로 여기서 걷어야 다음 클릭이 칸에 닿는다. 선택은
 * 그대로 남으므로 곧바로 배치할 수 있다(다시 열기 = 가방 탭 또는 [가방 열기]).
 */
function deployRunInventorySelection(): void {
  const selected = ctx.engine.state.inventoryTowers.find((tower) => tower.id === ctx.engine.state.selectedTowerId);
  if (!selected) return;
  if (ctx.openFocusFrame === "inventory") setFocusFrame(null);
  showToast("전장 빈 칸을 눌러 배치 · 찬 칸은 교체됩니다");
  syncPanel();
}

export function setRunInventoryBulkMode(enabled: boolean): void {
  ctx.runInventoryBulkMode = enabled;
  // 모드를 끄면 바구니도 함께 비운다 — 보이지 않는 선택이 남아 있으면
  // 다음에 켰을 때 "누가 담았지" 가 된다.
  if (!enabled) runInventoryBulkSelection.clear();
  ctx.runInventoryRenderKey = "";
  renderRunInventory();
}

/** 카드 한 장은 같은 한자 묶음이다. 담기·빼기도 묶음 단위로 한 번에 움직인다. */
function toggleRunInventoryBulkStack(card: HTMLElement): void {
  const eligible = (card.dataset.runInventoryEligible ?? "").split(",").filter(Boolean).map(Number);
  if (eligible.length === 0) {
    // [J-2] "확인하세요" 가 아니라 사유 그 자체를 말한다.
    const id = Number(card.dataset.runInventoryId);
    const reasons = ctx.engine.cleanupAssessments(dismantleOptions()).find((assessment) => assessment.towerId === id)?.protectedReasons ?? [];
    showToast(dismantleBlockNote(reasons), true);
    return;
  }
  const allIn = eligible.every((id) => runInventoryBulkSelection.has(id));
  for (const id of eligible) {
    if (allIn) runInventoryBulkSelection.delete(id);
    else runInventoryBulkSelection.add(id);
  }
  ctx.runInventoryRenderKey = "";
  renderRunInventory();
}

/*
 * 더블클릭 지름길은 click 두 번으로 직접 센다.
 *
 * 네이티브 dblclick 을 쓸 수 없다 — 첫 클릭이 선택을 바꾸면 격자를 통째로 다시
 * 그리므로 두 클릭의 대상 노드가 달라지고 브라우저는 dblclick 을 내지 않는다.
 * 같은 카드를 400ms 안에 두 번 누른 것으로 판정한다.
 */
let runInventoryLastClickId = -1;

let runInventoryLastClickAt = 0;

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireInventory1(): void {
  must<HTMLElement>("#run-inventory-list").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-inventory-goto-shop]")) {
      setPanelTab("shop");
      return;
    }
    const card = target.closest<HTMLButtonElement>("[data-run-inventory-id]");
    if (!card) return;
    const id = Number(card.dataset.runInventoryId);
    if (!Number.isInteger(id)) return;
    if (ctx.runInventoryBulkMode) {
      toggleRunInventoryBulkStack(card);
      return;
    }
    const now = performance.now();
    const doubled = runInventoryLastClickId === id && now - runInventoryLastClickAt < 400;
    runInventoryLastClickId = id;
    runInventoryLastClickAt = now;
    // R19: 클릭은 고르기까지다. 배치·분해·잠금·농축은 아래 행동 바가 맡는다.
    ctx.engine.selectTower(id);
    ctx.selectedRenderKey = "";
    ctx.runInventoryRenderKey = "";
    // 숙련자 지름길 — R14 까지의 "클릭 = 즉시 배치" 를 더블클릭으로 옮겨 둔다.
    if (doubled) {
      runInventoryLastClickId = -1;
      deployRunInventorySelection();
      return;
    }
    syncPanel();
  });
  must<HTMLElement>("#run-inventory-layout").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const element = target.closest<HTMLButtonElement>("[data-inventory-element]")?.dataset.inventoryElement as Wuxing | undefined;
    if (element) {
      ctx.runInventoryElementFilter = ctx.runInventoryElementFilter === element ? null : element;
      ctx.runInventoryRenderKey = "";
      renderRunInventory();
      return;
    }
    const grade = target.closest<HTMLButtonElement>("[data-inventory-grade]")?.dataset.inventoryGrade;
    if (grade) {
      const band = grade === "all" ? null : (grade as RunInventoryGradeBandId);
      ctx.runInventoryGradeFilter = ctx.runInventoryGradeFilter === band ? null : band;
      ctx.runInventoryRenderKey = "";
      renderRunInventory();
      return;
    }
    if (target.closest("#run-inventory-sort")) {
      ctx.runInventorySort = RUN_INVENTORY_SORTS[(RUN_INVENTORY_SORTS.indexOf(ctx.runInventorySort) + 1) % RUN_INVENTORY_SORTS.length]!;
      ctx.runInventoryRenderKey = "";
      renderRunInventory();
      return;
    }
    if (target.closest("#run-inventory-bulk-toggle")) {
      sound.unlock();
      setRunInventoryBulkMode(!ctx.runInventoryBulkMode);
      showToast(ctx.runInventoryBulkMode
        ? "일괄 모드 · 카드를 눌러 담고 아래에서 한 번에 분해합니다 (Esc 로 해제)"
        : "일괄 모드 해제 · 카드 클릭이 다시 고르기가 됩니다");
      return;
    }
    if (target.closest("#run-inventory-deploy")) {
      sound.unlock();
      deployRunInventorySelection();
      return;
    }
    if (target.closest("#run-inventory-dismantle")) {
      const selected = ctx.engine.state.inventoryTowers.find((tower) => tower.id === ctx.engine.state.selectedTowerId);
      if (!selected) return;
      handleAction(ctx.engine.dismantleTowers([selected.id], dismantleOptions()));
      return;
    }
    if (target.closest("#run-inventory-lock")) {
      handleAction(ctx.engine.toggleSelectedLock());
      return;
    }
    if (target.closest("#run-inventory-concentrate")) {
      const selected = ctx.engine.state.inventoryTowers.find((tower) => tower.id === ctx.engine.state.selectedTowerId);
      if (!selected) return;
      // 농축 공방의 대상 지정 경로를 그대로 빌린다(패널 탭 전환이 프레임까지 연다).
      ctx.concentrationTargetId = selected.id;
      ctx.concentrationPayment = "essence";
      setPanelTab("concentration");
      return;
    }
    if (target.closest("#run-inventory-bulk-clear")) {
      runInventoryBulkSelection.clear();
      ctx.runInventoryRenderKey = "";
      renderRunInventory();
      return;
    }
    if (target.closest("#run-inventory-bulk-dismantle")) {
      const quote = ctx.engine.quoteDismantle([...runInventoryBulkSelection], dismantleOptions());
      if (quote.ids.length === 0) return;
      const gainLabel = essenceGainLabel(quote.gains);
      // 되돌릴 수 없는 일괄 처리다 — 제련소 [선택 분해] 와 같은 확인을 세운다.
      if (!window.confirm(`${quote.ids.length}기를 한 번에 분해합니다.\n획득: ${gainLabel}`)) return;
      const result = ctx.engine.dismantleTowers(quote.ids, dismantleOptions());
      if (result.ok) runInventoryBulkSelection.clear();
      handleAction(result);
    }
  });
  must<HTMLButtonElement>("#run-inventory-frame-open").addEventListener("click", () => setFocusFrame("inventory"));
  must<HTMLButtonElement>("#cleanup-recommended-button").addEventListener("click", () => {
    const candidates = ctx.engine.cleanupCandidates(8, true);
    if (candidates.length === 0) return;
    dismantleSelection.clear();
    for (const candidate of candidates) dismantleSelection.add(candidate.towerId);
    ctx.growthRenderKey = "";
    setPanelTab("growth");
  });
}
