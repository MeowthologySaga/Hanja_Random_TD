/*
 * 도감 창.
 */
import { hasActiveSkills } from "../../core/abilities";
import {
  CASUAL_STAR_COLORS,
  CASUAL_STAR_POWER,
  casualNaturalStar,
  casualStarRangeLabel,
  casualStrokeCount
} from "../../core/casual";
import {
  CHEONJAMUN_JARYEONG_DEX_BY_HANJA,
  type CheonjamunJaryeongDexEntry
} from "../../core/cheonjamun-jaryeong-dex";
import { CHEONJAMUN_SUPPLEMENTAL_CHARACTERS } from "../../core/cheonjamun-roster";
import { GameEngine } from "../../core/game";
import { ELEMENT_STYLES, REGION_META, STAGE_MULTIPLIERS, STAGE_NAMES, WUXING_ORDER } from "../../core/hanzi";
import { koreanMeaningExplanation } from "../../core/korean-meaning-explanations";
import { LEARNING_DATA_META, learningInfo } from "../../core/learning";
import { radicalLearningLabel } from "../../core/radicals";
import { type AbilitySpec, type CasualStar, type HanziDefinition, type Wuxing } from "../../core/types";
import {
  buildSynthesisDepths,
  buildUncombinableStageOneChars,
  synthesisTierAccessibleLabel,
  type SynthesisTierFilter,
  synthesisTierFilterLabel,
  synthesisTierKey,
  UNCOMBINABLE_STAGE_ONE
} from "../codex-synthesis";
import { codexDialog, type CodexMode, ctx, type JaryeongDexFilter, must, reducedMotion, shell } from "../app-context";
import { escapeHtml, spriteStyle } from "../format";
import { handleAction } from "../hud";

const ROLE_STRATEGY: Record<HanziDefinition["combat"]["role"], string> = {
  rapid: "공격 간격이 짧아 빠른 적과 단일 잔여 적을 정리하기 좋습니다.",
  burst: "충전 뒤 큰 피해를 주므로 우두머리전과 고체력 적에게 집중 배치하세요.",
  splash: "군집을 빠르게 줄입니다. 길이 겹치는 모서리 구간에서 효율이 높습니다.",
  control: "이동 방해로 공격 시간을 벌어줍니다. 화력 자령 앞쪽에 배치하세요.",
  support: "주변 자령의 공격 흐름을 보조합니다. 여러 자령이 닿는 중앙이 유리합니다.",
  economy: "전투 중 엽전을 보충해 소환·연구를 앞당깁니다. 초중반 가치가 높습니다."
};

function definitionMatches(definition: HanziDefinition, normalized: string): boolean {
  if (!normalized) return true;
  const learning = learningInfo(ctx.engine.state.region, definition.char);
  const entry = dexEntryForDefinition(definition);
  const explanation = koreanMeaningExplanation(definition.char, learning.short, learning.meaning);
  const abilities = definition.combat.abilities;
  const searchable = [
    definition.char,
    ...definition.parents,
    learning.short,
    learning.reading,
    learning.meaning,
    definition.combat.roleLabel,
    definition.combat.effectLabel,
    abilities.element.name,
    abilities.role.name,
    abilities.graph.name,
    abilities.lineage?.name ?? "",
    explanation.plainMeaning,
    explanation.short,
    explanation.body,
    explanation.example ?? "",
    entry?.category ?? "",
    entry?.dexText ?? "",
    entry?.habitat ?? "",
    entry?.traitName ?? ""
  ].join(" ").toLowerCase();
  return searchable.includes(normalized.toLowerCase());
}

function synthesisTierBadge(tier: Exclude<SynthesisTierFilter, "all">): string {
  const starTier = tier === UNCOMBINABLE_STAGE_ONE ? 1 : tier;
  const accessible = synthesisTierAccessibleLabel(starTier);
  return `<span class="codex-tier-stars" aria-label="${accessible}" title="${accessible}">${synthesisTierFilterLabel(starTier)}</span>`;
}

function independentBadge(independent: boolean): string {
  return independent ? '<span class="codex-independent-badge" aria-label="상위 조합에 쓰이지 않는 독립 자령" title="상위 조합에 쓰이지 않는 독립 자령">독립</span>' : "";
}

function setCodexMode(mode: CodexMode): void {
  ctx.codexMode = mode;
  codexDialog.classList.add("is-jaryeong-dex");
  document.querySelectorAll<HTMLButtonElement>("[data-codex-mode]").forEach((button) => {
    const selected = button.dataset.codexMode === mode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  const search = must<HTMLInputElement>("#codex-search");
  // 영문 키커는 한국어 화면에서 혼자 읽히지 않는 장식이었다.
  must<HTMLElement>("#codex-kicker").textContent = mode === "hanzi" ? "자령 기록" : mode === "recipes" ? "조합 경로 서고" : "사자성어 봉인 서고";
  must<HTMLElement>("#codex-title-label").textContent = mode === "hanzi" ? " 통합 자령 도감" : mode === "recipes" ? " 조합 도감" : " 사자성어 도감";
  search.placeholder = mode === "recipes" ? "결과·재료·훈음·능력 검색" : mode === "idioms" ? "사자성어·효과 검색" : "한자·훈음·쉬운 뜻·오행 검색";
  must<HTMLElement>("#codex-note").textContent = mode === "hanzi"
    ? `별은 합성 깊이를 뜻합니다 — 별이 많을수록 여러 번 합성해야 닿는 자령입니다. 한국 1,001자는 국립국어원 한국어기초사전과 글자별 교정표를 바탕으로 모두 쉬운 오늘말 풀이를 제공합니다. 훈음·독음 데이터 ${LEARNING_DATA_META.version}.`
    : mode === "recipes"
      ? "별은 합성 깊이를, 독립 표식은 상위 조합 재료로 쓰이지 않는 자령을 뜻합니다. 별과 독립 여부는 별개의 정보입니다."
      : "같은 진의 한 줄 — 가로·세로·대각선 — 에 네 글자를 순서대로 놓으면 해당 사자성어의 봉인 효과가 발동합니다. 역순도 인정합니다.";
  renderCodex(search.value);
}

function jaryeongDexImageUrl(entry: CheonjamunJaryeongDexEntry): string {
  return `${import.meta.env.BASE_URL}${entry.imagePath}`;
}

const CHEONJAMUN_SUPPLEMENTAL_CHARS = new Set(CHEONJAMUN_SUPPLEMENTAL_CHARACTERS.map((entry) => entry.c));

function dexEntryForDefinition(definition: HanziDefinition): CheonjamunJaryeongDexEntry | undefined {
  return ctx.engine.state.region === "KR" ? CHEONJAMUN_JARYEONG_DEX_BY_HANJA.get(definition.char) : undefined;
}

/**
 * 도감 카드·상세의 번호 라벨.
 *
 * 도감 항목이 없으면 무조건 'SYNTHESIS EXTRA' 를 찍고 있었는데, 실제로
 * 걸리는 글자는 烈 하나뿐이고 이 글자는 합성 부산물이 아니라 천자문
 * 글자다(cheonjamun-jaryeongs.json 이 "천자문 164번째 글자이나 기존 KR
 * 런타임에 누락됨"으로 기록해 둔 보충 글자). 합성으로 얻는 글자와
 * 직접 소환하는 글자를 사실대로 갈라 적는다.
 */
function codexNumberLabel(definition: HanziDefinition, entry: CheonjamunJaryeongDexEntry | undefined): string {
  if (entry) return `천자문 제${entry.number}자`;
  if (CHEONJAMUN_SUPPLEMENTAL_CHARS.has(definition.char)) return "천자문 보유 자령";
  return definition.acquisition === "craft" ? "합성 전용 자령" : "추가 수록 자령";
}

function codexCardPortrait(definition: HanziDefinition, entry: CheonjamunJaryeongDexEntry | undefined): string {
  const accessible = escapeHtml(`${definition.char} ${learningInfo(ctx.engine.state.region, definition.char).short} 자령 초상화`);
  // 스프라이트는 안쪽 칸에 그린다 — 바깥 칸의 "우물" 배경이 !important 라
  // 같은 요소에 배경으로 얹으면 통째로 지워졌다(烈 빈 초상의 원인).
  return entry
    ? `<img src="${jaryeongDexImageUrl(entry)}" alt="${accessible}" width="104" height="104" loading="lazy">`
    : `<i class="codex-jaryeong-card-portrait" role="img" aria-label="${accessible}"><b class="codex-sprite-fill" style="${spriteStyle(definition)}"></b></i>`;
}

function codexDetailPortrait(definition: HanziDefinition, entry: CheonjamunJaryeongDexEntry | undefined): string {
  const accessible = escapeHtml(`${definition.char} ${learningInfo(ctx.engine.state.region, definition.char).short} 자령 초상화`);
  return entry
    ? `<img src="${jaryeongDexImageUrl(entry)}" alt="${accessible}" width="214" height="214">`
    : `<i class="codex-jaryeong-detail-sprite" role="img" aria-label="${accessible}"><b class="codex-sprite-fill" style="${spriteStyle(definition)}"></b></i>`;
}

function directAcquisitionLabel(definition: HanziDefinition, independent: boolean): string {
  if (definition.acquisition === "craft") return `${definition.parents.join(" + ")} → ${definition.char}`;
  return independent ? "직접 소환 · 독립" : "직접 소환 · 상위 조합 재료";
}

function renderCodexSynthesisFilters(
  definitions: HanziDefinition[],
  depths: Map<string, number>,
  uncombinableStageOne: ReadonlySet<string>
): void {
  const filters = must<HTMLElement>("#codex-synthesis-filters");
  if (ctx.codexMode === "idioms") {
    filters.hidden = true;
    return;
  }
  filters.hidden = false;
  filters.setAttribute("aria-label", ctx.codexMode === "hanzi" ? "오행과 별·독립 분류" : "합성 별 분류");

  const elementCounts = new Map<Wuxing, number>(WUXING_ORDER.map((wuxing) => [wuxing, 0]));
  for (const definition of definitions) elementCounts.set(definition.wuxing, (elementCounts.get(definition.wuxing) ?? 0) + 1);
  const elementControls = ctx.codexMode === "hanzi" ? [
    '<span class="codex-filter-label">오행</span>',
    `<button type="button" data-jaryeong-filter="all" class="${ctx.jaryeongDexFilter === "all" ? "is-active" : ""}" aria-pressed="${String(ctx.jaryeongDexFilter === "all")}">전체 <small>${definitions.length}</small></button>`,
    ...WUXING_ORDER.map((wuxing) => `<button type="button" data-jaryeong-filter="${wuxing}" class="${ctx.jaryeongDexFilter === wuxing ? "is-active" : ""}" aria-pressed="${String(ctx.jaryeongDexFilter === wuxing)}" style="--filter-element:${ELEMENT_STYLES[wuxing].color}">${wuxing}<small>${elementCounts.get(wuxing) ?? 0}</small></button>`),
    '<i class="codex-filter-divider" aria-hidden="true"></i>',
    '<span class="codex-filter-label">등급</span>'
  ] : [];

  if (ctx.engine.state.mode === "casual" && ctx.codexMode !== "recipes") {
    const counts = new Map<CasualStar, number>();
    for (const definition of definitions) {
      const star = casualNaturalStar(definition.char) ?? 1;
      counts.set(star, (counts.get(star) ?? 0) + 1);
    }
    if (ctx.codexSynthesisDepth !== "all" && (typeof ctx.codexSynthesisDepth !== "number" || !counts.has(ctx.codexSynthesisDepth as CasualStar))) ctx.codexSynthesisDepth = "all";
    filters.innerHTML = [...elementControls,
      `<button type="button" data-synthesis-depth="all" class="${ctx.codexSynthesisDepth === "all" ? "is-active" : ""}" aria-pressed="${String(ctx.codexSynthesisDepth === "all")}">모든 별 <small>${definitions.length}</small></button>`,
      ...([...counts.entries()].sort(([left], [right]) => left - right).map(([star, count]) => `<button type="button" data-synthesis-depth="${star}" class="${ctx.codexSynthesisDepth === star ? "is-active" : ""}" aria-pressed="${String(ctx.codexSynthesisDepth === star)}" style="--codex-star:${CASUAL_STAR_COLORS[star]}">${star}★ <small>${count}</small></button>`))
    ].join("");
    return;
  }

  const counts = new Map<number, number>();
  for (const definition of definitions) {
    const depth = depths.get(definition.char) ?? 1;
    counts.set(depth, (counts.get(depth) ?? 0) + 1);
  }
  const independentCount = definitions.filter((definition) => uncombinableStageOne.has(definition.char)).length;
  const validSelection = ctx.codexSynthesisDepth === "all"
    || ctx.codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE && independentCount > 0
    || typeof ctx.codexSynthesisDepth === "number" && counts.has(ctx.codexSynthesisDepth);
  if (!validSelection) ctx.codexSynthesisDepth = "all";
  const options = [...counts.entries()].sort(([left], [right]) => left - right);
  filters.innerHTML = [...elementControls,
    `<button type="button" data-synthesis-depth="all" class="${ctx.codexSynthesisDepth === "all" ? "is-active" : ""}" aria-pressed="${String(ctx.codexSynthesisDepth === "all")}">모든 별 <small>${definitions.length}</small></button>`,
    ...options.map(([depth, count]) => `<button type="button" data-synthesis-depth="${depth}" class="${ctx.codexSynthesisDepth === depth ? "is-active" : ""}" aria-pressed="${String(ctx.codexSynthesisDepth === depth)}">${synthesisTierBadge(depth)} <small>${count}</small></button>`),
    ...(independentCount > 0 ? [`<button type="button" data-synthesis-depth="${UNCOMBINABLE_STAGE_ONE}" class="${ctx.codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE ? "is-active" : ""}" aria-pressed="${String(ctx.codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE)}">${independentBadge(true)} <small>${independentCount}</small></button>`] : [])
  ].join("");
}

function renderCodex(query = ""): void {
  const normalized = query.trim();
  const list = must<HTMLElement>("#codex-list");
  must<HTMLElement>("#codex-region").textContent = ctx.engine.state.region === "KR" ? "한국" : REGION_META[ctx.engine.state.region].title;

  if (ctx.codexMode === "idioms") {
    renderCodexSynthesisFilters([], new Map(), new Set());
    const activeIds = new Set(ctx.engine.idioms().map((idiom) => idiom.id));
    const idioms = ctx.engine.allIdioms().filter((idiom) => !normalized || [idiom.chars, idiom.reading, idiom.meaning, idiom.bonus.label].join(" ").includes(normalized));
    must<HTMLElement>("#codex-summary").textContent = `성어 ${idioms.length}/${ctx.engine.allIdioms().length} · 이번 런 목표 ${ctx.engine.idioms().length}개`;
    list.className = "codex-list codex-list--idioms";
    list.innerHTML = idioms.map((idiom) => {
      const sealed = ctx.engine.state.idiomSeals.some((seal) => seal.idiomId === idiom.id);
      const active = activeIds.has(idiom.id);
      const selected = idiom.id === ctx.selectedCodexIdiomId;
      return `<button type="button" data-codex-idiom="${idiom.id}" class="codex-idiom-card ${sealed ? "is-discovered" : ""} ${active ? "is-featured" : ""} ${selected ? "is-selected" : ""}" style="--codex:${idiom.color}" aria-current="${String(selected)}"><b>${idiom.chars}</b><span>${idiom.reading}</span><small>${active ? "이번 런 · " : ""}${idiom.bonus.label}</small></button>`;
    }).join("") || '<p class="codex-empty">검색 결과가 없습니다.</p>';
    // 상세에 뜬 성어와 목록의 선택 표시를 항상 같은 것으로 맞춘다.
    const shown = idioms.find((idiom) => idiom.id === ctx.selectedCodexIdiomId) ?? idioms[0];
    if (shown && shown.id !== ctx.selectedCodexIdiomId) {
      ctx.selectedCodexIdiomId = shown.id;
      const card = list.querySelector<HTMLButtonElement>(`[data-codex-idiom="${shown.id}"]`);
      card?.classList.add("is-selected");
      card?.setAttribute("aria-current", "true");
    }
    renderIdiomCodexDetail(shown);
    return;
  }

  const synthesisDepths = buildSynthesisDepths(ctx.engine.catalog.definitions.values());
  const uncombinableStageOne = buildUncombinableStageOneChars(ctx.engine.catalog.definitions.values());
  let definitions = ctx.codexMode === "recipes" ? [...ctx.engine.catalog.recipes] : [...ctx.engine.catalog.definitions.values()];
  renderCodexSynthesisFilters(definitions, synthesisDepths, uncombinableStageOne);
  if (ctx.codexMode === "hanzi" && ctx.jaryeongDexFilter !== "all") definitions = definitions.filter((definition) => definition.wuxing === ctx.jaryeongDexFilter);
  if (ctx.codexSynthesisDepth !== "all") definitions = definitions.filter((definition) => ctx.engine.state.mode === "casual" && ctx.codexMode !== "recipes"
    ? casualNaturalStar(definition.char) === ctx.codexSynthesisDepth
    : ctx.codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE
      ? uncombinableStageOne.has(definition.char)
      : (synthesisDepths.get(definition.char) ?? 1) === ctx.codexSynthesisDepth
  );
  definitions = definitions.filter((definition) => definitionMatches(definition, normalized));
  definitions.sort((left, right) => {
    if (ctx.codexMode === "hanzi" && ctx.engine.state.region === "KR") {
      const leftNumber = CHEONJAMUN_JARYEONG_DEX_BY_HANJA.get(left.char)?.number ?? Number.MAX_SAFE_INTEGER;
      const rightNumber = CHEONJAMUN_JARYEONG_DEX_BY_HANJA.get(right.char)?.number ?? Number.MAX_SAFE_INTEGER;
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    }
    return ctx.engine.state.mode === "casual" && ctx.codexMode !== "recipes"
      ? (casualNaturalStar(left.char) ?? 1) - (casualNaturalStar(right.char) ?? 1) || (casualStrokeCount(left.char) ?? 0) - (casualStrokeCount(right.char) ?? 0) || left.char.localeCompare(right.char, "ko")
      : (synthesisDepths.get(left.char) ?? 0) - (synthesisDepths.get(right.char) ?? 0) || left.stage - right.stage || left.char.localeCompare(right.char, "ko");
  });
  const selectedDefinition = definitions.find((definition) => definition.char === normalized)
    ?? definitions.find((definition) => definition.char === ctx.selectedCodexChar)
    ?? definitions[0]
    ?? ctx.engine.catalog.definitions.get(ctx.engine.state.targetChar);
  ctx.selectedCodexChar = selectedDefinition?.char ?? "";
  list.className = ctx.codexMode === "recipes" ? "codex-list codex-list--recipes" : "codex-list codex-list--jaryeong";

  if (ctx.codexMode === "recipes") {
    const depthSummary = ctx.codexSynthesisDepth === "all"
      ? "전체 단계"
      : ctx.codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE
        ? "독립 자령"
        : synthesisTierFilterLabel(ctx.codexSynthesisDepth);
    must<HTMLElement>("#codex-summary").textContent = `조합 ${definitions.length.toLocaleString("ko-KR")}/${ctx.engine.catalog.recipes.length.toLocaleString("ko-KR")}식 · 재료 → 결과 순서 · ${depthSummary}`;
    list.innerHTML = definitions.map((definition) => {
      const depth = synthesisDepths.get(definition.char) ?? 1;
      const selected = definition.char === ctx.selectedCodexChar;
      return `<button type="button" data-codex-recipe="${definition.char}" class="codex-recipe-card ${selected ? "is-selected" : ""}" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}" aria-current="${String(selected)}"><span class="codex-recipe-formula">${definition.parents.map((parent) => `<i>${parent}</i>`).join("<em>+</em>")}<em>→</em><b>${definition.char}</b></span><span>${escapeHtml(learningInfo(ctx.engine.state.region, definition.char).short)}</span><small>${synthesisTierBadge(depth)} · ${STAGE_NAMES[definition.stage]} · ${hasActiveSkills(definition) ? definition.combat.abilities.role.name : "기본 공격"}</small></button>`;
    }).join("");
  } else {
    const independentShown = definitions.filter((definition) => uncombinableStageOne.has(definition.char)).length;
    const discoveredThisRun = new Set(ctx.engine.state.discoveredChars);
    must<HTMLElement>("#codex-summary").textContent = `자령 ${definitions.length.toLocaleString("ko-KR")}/${ctx.engine.catalog.definitions.size.toLocaleString("ko-KR")} · 독립 ${independentShown.toLocaleString("ko-KR")} · 이번 런 발견 ${discoveredThisRun.size.toLocaleString("ko-KR")}`;
    list.innerHTML = definitions.map((definition) => {
      const learning = learningInfo(ctx.engine.state.region, definition.char);
      const entry = dexEntryForDefinition(definition);
      const depth = synthesisDepths.get(definition.char) ?? 1;
      const independent = uncombinableStageOne.has(definition.char);
      const naturalStar = casualNaturalStar(definition.char) ?? 1;
      const selected = definition.char === ctx.selectedCodexChar;
      const explanation = koreanMeaningExplanation(definition.char, learning.short, learning.meaning);
      const numberLabel = codexNumberLabel(definition, entry);
      const found = discoveredThisRun.has(definition.char);
      const progression = ctx.engine.state.mode === "casual" ? `<span class="codex-tier-stars">${"★".repeat(naturalStar)}</span>` : synthesisTierBadge(depth);
      return `<button type="button" data-codex-char="${definition.char}" class="codex-jaryeong-card ${selected ? "is-selected" : ""} ${found ? "is-found" : ""}" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}" aria-current="${String(selected)}" aria-label="${escapeHtml(`${numberLabel} ${definition.char} ${learning.short} ${definition.wuxing}행${found ? " · 이번 런 발견" : ""}`)}">
        <span class="codex-jaryeong-number">${numberLabel}</span>
        ${found ? '<mark class="codex-found-mark">이번 런 발견</mark>' : ""}
        ${codexCardPortrait(definition, entry)}
        <span class="codex-jaryeong-copy">
          <span class="codex-jaryeong-identity"><b>${definition.char}</b><strong>${escapeHtml(learning.short)}</strong><i>${definition.wuxing}</i></span>
          <span class="codex-jaryeong-badges">${progression}${ctx.engine.state.mode === "standard" ? independentBadge(independent) : ""}<em>${escapeHtml(definition.combat.roleLabel)}</em></span>
          <span class="codex-jaryeong-category">${escapeHtml(entry?.category ?? `${ELEMENT_STYLES[definition.wuxing].name}행 자령`)} · ${escapeHtml(explanation.plainMeaning)}</span>
          <small class="codex-jaryeong-recipe">조합 · ${escapeHtml(directAcquisitionLabel(definition, independent))}</small>
        </span>
      </button>`;
    }).join("");
  }
  if (definitions.length === 0) list.innerHTML = '<p class="codex-empty">검색 결과가 없습니다.</p>';
  renderCodexDetail(selectedDefinition);
}

function recipeStepsFor(char: string): HanziDefinition[] {
  const steps: HanziDefinition[] = [];
  const visited = new Set<string>();
  const visit = (current: string): void => {
    if (visited.has(current)) return;
    visited.add(current);
    const definition = ctx.engine.catalog.definitions.get(current);
    if (!definition) return;
    for (const parent of definition.parents) visit(parent);
    if (definition.acquisition === "craft") steps.push(definition);
  };
  visit(char);
  return steps;
}

function renderCodexDetail(definition: HanziDefinition | undefined): void {
  const detail = must<HTMLElement>("#codex-detail");
  if (!definition) {
    detail.innerHTML = "<p>한자를 선택하세요.</p>";
    return;
  }

  const learning = learningInfo(ctx.engine.state.region, definition.char);
  const explanation = koreanMeaningExplanation(definition.char, learning.short, learning.meaning);
  const entry = dexEntryForDefinition(definition);
  const abilities = definition.combat.abilities;
  const naturalStar = casualNaturalStar(definition.char) ?? 1;
  const activeSkills = ctx.engine.state.mode === "casual" ? naturalStar >= 2 : hasActiveSkills(definition);
  const abilityList = activeSkills
    ? [abilities.semantic, abilities.role, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability))
    : [];
  const passiveList = activeSkills ? [abilities.element, abilities.graph] : [abilities.graph];
  const children = ctx.engine.catalog.recipes
    .filter((candidate) => candidate.parents.includes(definition.char))
    .sort((left, right) => left.stage - right.stage)
    .slice(0, 12);
  const recipeSteps = recipeStepsFor(definition.char);
  const synthesisDepths = buildSynthesisDepths(ctx.engine.catalog.definitions.values());
  const uncombinableStageOne = buildUncombinableStageOneChars(ctx.engine.catalog.definitions.values());
  const synthesisDepth = synthesisDepths.get(definition.char) ?? 1;
  const independent = uncombinableStageOne.has(definition.char);
  const synthesisTier = synthesisTierKey(definition, synthesisDepth, uncombinableStageOne);
  const codexPower = ctx.engine.state.mode === "casual" ? CASUAL_STAR_POWER[naturalStar] : STAGE_MULTIPLIERS[definition.stage];
  const progression = ctx.engine.state.mode === "casual"
    ? `<span class="codex-tier-stars" aria-label="${naturalStar}별">${"★".repeat(naturalStar)}</span>`
    : synthesisTierBadge(synthesisTier);
  const numberLabel = codexNumberLabel(definition, entry);
  const acquisitionLabel = ctx.engine.state.mode === "casual"
    ? "전 자령 직접 소환 · 같은 오행/별 3체 조합"
    : directAcquisitionLabel(definition, independent);
  const categoryLabel = entry?.category ?? `${ELEMENT_STYLES[definition.wuxing].name}행 자령`;
  const dexText = entry?.dexText
    ?? `${definition.char}의 뜻과 ${definition.wuxing}행 기운을 전투 역할로 풀어낸 자령입니다. 쉬운 훈 풀이와 조합 경로를 함께 확인하세요.`;
  const progressionDetail = ctx.engine.state.mode === "casual"
    ? `${naturalStar}★ · ${casualStrokeCount(definition.char) ?? "?"}획 · ${casualStarRangeLabel(naturalStar)}`
    : `${synthesisDepth}단 · ${STAGE_NAMES[definition.stage]}`;
  const recipeMain = ctx.engine.state.mode === "casual"
    ? `<div class="recipe-guide-main"><span><b>${definition.wuxing}</b><small>${naturalStar}★ 소모</small></span><em>+</em><span><b>${definition.wuxing}</b><small>${naturalStar}★ 소모</small></span><em>+</em><span><b>${definition.wuxing}</b><small>${naturalStar}★ 소모</small></span><em>→</em><span class="is-result"><b>${Math.min(8, naturalStar + 1)}★</b><small>무작위 1기</small></span></div><p><b>안전 규칙</b> 3기가 모두 사라지고 같은 오행의 다음 별 글자 하나를 무작위로 얻습니다. 잠금·농축·목표·사자성어 자령은 소모 대상에서 빠지고, 소모할 3기를 카드에 미리 보여 준 뒤 실행합니다.</p>`
    : `<div class="recipe-guide-main">${definition.acquisition === "direct"
      ? `<span class="${independent ? "is-independent" : ""}"><b>${definition.char}</b><small>${independent ? "직접 소환 · 독립" : "직접 소환 · 상위 재료"}</small></span>`
      : `${definition.parents.map((parent) => `<span><b>${parent}</b><small>${escapeHtml(learningInfo(ctx.engine.state.region, parent).short)}</small></span>`).join("<em>+</em>")}<em>→</em><span class="is-result"><b>${definition.char}</b><small>${escapeHtml(learning.short)}</small></span>`}</div>
      ${recipeSteps.length ? `<ol>${recipeSteps.map((step, index) => `<li><b>${index + 1}</b><span>${step.parents.join(" + ")} → <strong>${step.char}</strong></span></li>`).join("")}</ol>` : ""}
      <p><b>이 글자로 이어지는 조합</b> ${children.length ? children.map((child) => `<button type="button" data-codex-char="${child.char}">${definition.char} → ${child.char} · ${escapeHtml(learningInfo(ctx.engine.state.region, child.char).short)}</button>`).join("") : independent ? "독립 자령이라 상위 조합에 쓰이지 않습니다." : "현재 직접 하위 조합이 없습니다."}</p>`;

  detail.innerHTML = `
    <div class="codex-jaryeong-detail" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}">
      <div class="codex-jaryeong-detail-hero">
        <div class="codex-jaryeong-portrait">
          ${codexDetailPortrait(definition, entry)}
          <span aria-label="${definition.wuxing}행">${definition.wuxing}</span>
        </div>
        <div class="codex-jaryeong-identity-panel">
          <p class="eyebrow">${numberLabel}</p>
          <div class="codex-jaryeong-name">
            <strong>${definition.char}</strong>
            <div>
              <h3>${escapeHtml(learning.short)}</h3>
              <p>${escapeHtml(categoryLabel)} · ${escapeHtml(definition.combat.roleLabel)}</p>
            </div>
          </div>
          <div class="codex-progression-badges">
            ${progression}
            ${ctx.engine.state.mode === "standard" ? independentBadge(independent) : ""}
            <span>${escapeHtml(progressionDetail)}</span>
          </div>
          <div class="codex-jaryeong-tags">
            <span>${definition.wuxing}행 · ${ELEMENT_STYLES[definition.wuxing].name}</span>
            <span>${escapeHtml(explanation.plainMeaning)}</span>
            <span>${escapeHtml(definition.combat.effectLabel)}</span>
          </div>
        </div>
      </div>

      <article class="codex-meaning-explanation">
        <span>쉬운 훈 풀이</span>
        <h4>${escapeHtml(learning.short)} <small>${escapeHtml(explanation.plainMeaning)}</small></h4>
        <p>${escapeHtml(explanation.body)}</p>
        ${explanation.example ? `<em>${escapeHtml(explanation.example)}</em>` : ""}
      </article>

      <article class="codex-jaryeong-entry">
        <span>자령 기록</span>
        <p>${escapeHtml(dexText)}</p>
      </article>

      <div class="codex-jaryeong-facts">
        <!-- R7-26: 라벨과 값을 둘 다 상수·요약으로 박아 둬서 JP 훈독(き·こ)이
             도감에서 통째로 사라지고 JP/CN 라벨까지 전부 '훈음'으로 찍혔다.
             learning.ts 가 지역별로 만들어 주는 값을 그대로 쓴다. -->
        <div><span>${escapeHtml(learning.readingLabel)}</span><b>${escapeHtml(learning.reading)}</b></div>
        <div><span>부수</span><b>${radicalLearningLabel(definition.char)}</b></div>
        <div><span>별 등급</span><b>${progression} · ${escapeHtml(progressionDetail)}</b></div>
        <div><span>조합 성격</span><b>${escapeHtml(acquisitionLabel)}</b></div>
      </div>

      <div class="codex-stats">
        <span><small>공격</small><b>${Math.round(definition.combat.baseDamage * codexPower * definition.combat.budgetMultiplier)}</b></span>
        <span><small>사거리</small><b>${definition.combat.range}</b></span>
        <span><small>공속</small><b>${definition.combat.cooldown.toFixed(2)}초</b></span>
        <span><small>하위 조합</small><b>${definition.graph.directChildCount}</b></span>
      </div>
      <article class="strategy-note"><b>전략 운용</b><span>${escapeHtml(`${ROLE_STRATEGY[definition.combat.role]} ${definition.combat.description}`)}</span></article>

      ${entry ? `<article class="codex-jaryeong-trait"><span>고유 특성</span><h4>${escapeHtml(entry.traitName)}</h4><p>${escapeHtml(entry.traitDescription)}</p></article>
      <div class="codex-jaryeong-observation">
        <article><span>서식 환경</span><p>${escapeHtml(entry.habitat)}</p></article>
        <article><span>관찰 기록</span><p>${escapeHtml(entry.observation)}</p></article>
      </div>` : ""}

      <div class="codex-abilities">
        ${activeSkills ? "" : `<article class="is-locked" style="--ability:#aeb9cc"><b>合</b><span><strong>${ctx.engine.state.mode === "casual" ? "1★ 기본 공격" : independent ? "독립 자령 기본 공격" : "1단 기본 공격"}</strong><small>${independent ? "상위 조합 없음" : "조합으로 기술 해금"}</small><em>${independent ? "별 등급과 독립 여부는 별개의 정보입니다. 이 자령은 1별이면서 상위 조합 재료로 쓰이지 않습니다." : ctx.engine.state.mode === "casual" ? "같은 오행·같은 별 자령 두 기를 재료로 써 2★가 되면 의미 기술과 역할 기술이 해금됩니다." : "상위 단계로 합성하면 의미 기술과 역할 기술이 해금됩니다."}</em></span></article>`}
        ${abilityList.map((ability) => `<article style="--ability:${ability.color}"><b>${ability.glyph}</b><span><strong>${escapeHtml(ability.name)}</strong><small>${escapeHtml(`${ability.trigger} · ${ability.summary}`)}</small><em>${escapeHtml(ability.description)}</em></span></article>`).join("")}
        ${passiveList.map((ability) => `<article class="is-passive" style="--ability:${ability.color}"><b>${ability.glyph}</b><span><strong>${escapeHtml(ability.name)}</strong><small>상시 특성 · ${escapeHtml(ability.summary)}</small><em>${escapeHtml(ability.description)}</em></span></article>`).join("")}
      </div>

      <section class="recipe-guide">
        <h4>${ctx.engine.state.mode === "casual" ? "캐주얼 3체 조합" : "조합표 · 별과 독립은 별개"}</h4>
        ${recipeMain}
      </section>
      ${shell.dataset.devMode === "1" ? `<p class="combo-key">능력 조합 코드 · ${escapeHtml(abilities.comboKey)}</p>` : ""}
      ${ctx.engine.state.mode === "casual" || definition.acquisition === "craft" ? `<button id="set-target-button" type="button" data-target-char="${definition.char}">이 한자를 목표로 지정</button>` : ""}
    </div>
  `;
}

function renderIdiomCodexDetail(idiom: ReturnType<GameEngine["idioms"]>[number] | undefined): void {
  const detail = must<HTMLElement>("#codex-detail");
  if (!idiom) {
    detail.innerHTML = "<p>사자성어를 선택하세요.</p>";
    return;
  }
  const sealed = ctx.engine.state.idiomSeals.some((seal) => seal.idiomId === idiom.id);
  const live = ctx.engine.isIdiomSealActive(idiom.id);
  const featured = ctx.engine.idioms().some((candidate) => candidate.id === idiom.id);
  const sourceLabel = idiom.source === "cheonjamun" ? `천자문 제${idiom.sourceOrder}구` : "상용 사자성어";
  const stateLabel = live ? "이번 런 발동 중" : sealed ? "봉인 이력 · 지금은 흩어짐" : featured ? "이번 런 목표" : "도감 수록";
  detail.innerHTML = `
    <div class="idiom-codex-glyphs" style="--codex:${idiom.color}">${[...idiom.chars].map((char, index) => `<span><b>${char}</b><small>${index + 1}</small></span>`).join("")}</div>
    <p class="eyebrow">${sourceLabel} · ${stateLabel}</p>
    <h3>${idiom.reading}</h3>
    <article class="idiom-strategy" style="--codex:${idiom.color}"><b>${idiom.bonus.label}</b><span>${idiom.meaning}</span><small>${featured ? "같은 진의 한 줄(가로·세로·대각선)에 네 글자를 1→2→3→4 순서로 놓으면 자동 발동하며, 효과는 네 자령이 그 줄을 유지하는 동안만 발동합니다. 줄이 흩어지면 달성 기록만 남고, 다시 세우면 재발동합니다. 역순으로 놓아도 인정합니다." : "이번 런 목표에는 포함되지 않았습니다. 다음 시드에서 목표 성구로 등장할 수 있습니다."}</small></article>
    <section class="idiom-material-guide"><h4>필요 한자와 획득법</h4>${[...idiom.chars].map((char) => {
      const definition = ctx.engine.catalog.definitions.get(char);
      const learning = learningInfo(ctx.engine.state.region, char);
      if (!definition) return "";
      return `<button type="button" data-codex-char="${char}" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}"><b>${char}</b><span>${escapeHtml(learning.short)}</span><small>${definition.acquisition === "direct" ? "직접 소환" : definition.parents.join(" + ") + " → " + char}</small></button>`;
    }).join("")}</section>
  `;
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireCodex1(): void {
  must<HTMLButtonElement>("#codex-button").addEventListener("click", () => {
    // 별승급 진법에는 구성식 합성이 없다 — 조합표 분류는 랜덤 규칙과 무관하므로 숨긴다.
    const casualRun = ctx.engine.state.mode === "casual";
    const recipesTab = must<HTMLButtonElement>('[data-codex-mode="recipes"]');
    recipesTab.hidden = casualRun;
    if (casualRun && ctx.codexMode === "recipes") setCodexMode("hanzi");
    const search = must<HTMLInputElement>("#codex-search");
    search.value = "";
    renderCodex("");
    codexDialog.showModal();
    // 포커스를 한 프레임 늦춘다. 단축키로 열었을 때 그 키의 문자가
    // 검색창에 새어 들어가지 않게 하는 두 번째 방어선이다.
    window.requestAnimationFrame(() => {
      search.value = "";
      search.focus();
    });
  });
  must<HTMLButtonElement>("#codex-close").addEventListener("click", () => codexDialog.close());
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireCodex2(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-codex-mode]").forEach((button) => {
    button.addEventListener("click", () => setCodexMode(button.dataset.codexMode as CodexMode));
  });
  must<HTMLInputElement>("#codex-search").addEventListener("input", (event) => renderCodex((event.target as HTMLInputElement).value));
  must<HTMLElement>("#codex-synthesis-filters").addEventListener("click", (event) => {
    const jaryeongFilterValue = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-jaryeong-filter]")?.dataset.jaryeongFilter;
    if (jaryeongFilterValue) {
      ctx.jaryeongDexFilter = jaryeongFilterValue as JaryeongDexFilter;
      renderCodex(must<HTMLInputElement>("#codex-search").value);
      return;
    }
    const value = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-synthesis-depth]")?.dataset.synthesisDepth;
    if (!value) return;
    ctx.codexSynthesisDepth = value === "all" || value === UNCOMBINABLE_STAGE_ONE ? value : Number(value);
    renderCodex(must<HTMLInputElement>("#codex-search").value);
  });
  must<HTMLElement>("#codex-list").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const char = target.closest<HTMLButtonElement>("[data-codex-char]")?.dataset.codexChar
      ?? target.closest<HTMLButtonElement>("[data-codex-recipe]")?.dataset.codexRecipe;
    const idiomId = target.closest<HTMLButtonElement>("[data-codex-idiom]")?.dataset.codexIdiom;
    if (char) {
      ctx.selectedCodexChar = char;
      document.querySelectorAll<HTMLButtonElement>("[data-codex-char], [data-codex-recipe]").forEach((button) => {
        const buttonChar = button.dataset.codexChar ?? button.dataset.codexRecipe;
        const selected = buttonChar === char;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-current", String(selected));
      });
      renderCodexDetail(ctx.engine.catalog.definitions.get(char));
    }
    else if (idiomId) {
      // 한자 카드와 같은 패턴으로 선택 표시를 준다 — 누른 카드가 어느
      // 것인지 상세만 보고 되짚어야 했다.
      ctx.selectedCodexIdiomId = idiomId;
      document.querySelectorAll<HTMLButtonElement>("[data-codex-idiom]").forEach((button) => {
        const selected = button.dataset.codexIdiom === idiomId;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-current", String(selected));
      });
      renderIdiomCodexDetail(ctx.engine.allIdioms().find((idiom) => idiom.id === idiomId));
    }
  });
  must<HTMLElement>("#codex-detail").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const targetChar = target.closest<HTMLButtonElement>("[data-target-char]")?.dataset.targetChar;
    if (targetChar) {
      handleAction(ctx.engine.setTarget(targetChar));
      codexDialog.close();
      return;
    }
    const codexChar = target.closest<HTMLButtonElement>("[data-codex-char]")?.dataset.codexChar;
    if (codexChar) {
      ctx.selectedCodexChar = codexChar;
      document.querySelectorAll<HTMLButtonElement>("[data-codex-char], [data-codex-recipe]").forEach((button) => {
        const buttonChar = button.dataset.codexChar ?? button.dataset.codexRecipe;
        const selected = buttonChar === codexChar;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-current", String(selected));
      });
      renderCodexDetail(ctx.engine.catalog.definitions.get(codexChar));
      must<HTMLElement>("#codex-detail").scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    }
  });
}
