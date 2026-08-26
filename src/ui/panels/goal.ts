/*
 * 목표 선택 패널.
 */
import { casualNaturalStar, casualStrokeCount } from "../../core/casual";
import { ELEMENT_STYLES, maxSummonStageForWave, STAGE_NAMES, summonStageUnlockWave } from "../../core/hanzi";
import { type IdiomDefinition } from "../../core/idioms";
import { learningInfoForNotation } from "../../core/learning";
import { idiomReadingForNotation } from "../../core/notation";
import { type HanziDefinition } from "../../core/types";
import { ctx, type GoalPanelMode, must } from "../app-context";
import { escapeHtml, spriteStyle } from "../format";
import { handleAction, setPanelTab } from "../hud";

export function renderGoal(): void {
  const progress = ctx.engine.goalProgress();
  const maxSummonStage = maxSummonStageForWave(ctx.engine.state.wave);
  const ownedTowers = [...ctx.engine.state.towers, ...ctx.engine.state.inventoryTowers];
  const ownedCounts = new Map<string, number>();
  for (const tower of ownedTowers) ownedCounts.set(tower.char, (ownedCounts.get(tower.char) ?? 0) + 1);
  const ownedSignature = [...ownedCounts.entries()].sort(([left], [right]) => left.localeCompare(right, "ko")).map(([char, count]) => `${char}:${count}`).join(",");
  const key = [
    ctx.goalPanelMode,
    ctx.goalSearchQuery,
    ctx.engine.state.targetChar,
    progress.directMaterials.map((item) => item.char + ":" + String(item.owned) + "/" + String(item.needed)).join(","),
    ctx.engine.state.goalsCompleted.join(""),
    ctx.engine.state.featuredIdiomIds.join(","),
    ctx.engine.state.idiomSeals.map((seal) => seal.idiomId).join(","),
    maxSummonStage,
    ctx.engine.state.lineageClueProgress,
    ctx.engine.state.lineageTargetProgress,
    ownedSignature
  ].join("|");
  if (key === ctx.goalRenderKey) return;
  ctx.goalRenderKey = key;

  const pool = ctx.engine.summonDefinitions();
  must<HTMLElement>("#shop-pool-count").textContent = pool.length.toLocaleString("ko-KR");
  const nextStage = maxSummonStage < 5 ? (maxSummonStage + 1) as 2 | 3 | 4 | 5 : null;
  must<HTMLElement>("#summon-pool-summary").innerHTML = ctx.engine.state.mode === "casual"
    ? `<b>천자문 ${pool.length.toLocaleString("ko-KR")}종</b><span>전 자령 직접 등장 · 획수별 1★–8★</span>`
    : `<b>천자문 ${pool.length.toLocaleString("ko-KR")}종</b><span>${STAGE_NAMES[maxSummonStage]}까지 등장${nextStage ? ` · ${summonStageUnlockWave(nextStage)}W 다음 단계` : " · 전 단계 개방"}</span>`;

  const goalPanel = must<HTMLElement>("#goal-panel");
  goalPanel.dataset.currentGoalMode = ctx.goalPanelMode;
  document.querySelectorAll<HTMLButtonElement>("[data-goal-mode]").forEach((button) => {
    const selected = button.dataset.goalMode === ctx.goalPanelMode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  must<HTMLElement>("#goal-glyph").textContent = progress.target.char;
  must<HTMLElement>("#goal-glyph").style.setProperty("--goal-color", ELEMENT_STYLES[progress.target.wuxing].color);
  const targetUnlockWave = summonStageUnlockWave(progress.target.stage);
  const targetDirectLocked = ctx.engine.state.mode === "standard" && progress.target.acquisition === "direct" && ctx.engine.state.wave < targetUnlockWave;
  const targetNaturalStar = casualNaturalStar(progress.target.char);
  must<HTMLElement>("#goal-stage").textContent = ctx.engine.state.mode === "casual"
    ? `${targetNaturalStar ?? 1}★ · ${casualStrokeCount(progress.target.char) ?? "?"}획 · 직접 소환 가능`
    // STAGE_NAMES[2]='결합' 과 역할 이름이 맨몸으로 붙어 '결합 · 재화연성'
    // 처럼 무엇과 무엇인지 알 수 없는 줄이 됐다. 각 조각에 이름표를 준다.
    : `${progress.target.stage}단 ${STAGE_NAMES[progress.target.stage]} · ` + (targetDirectLocked ? `${targetUnlockWave}W 직접 소환 개방` : progress.target.acquisition === "direct" ? "직접 소환 가능" : `역할 ${progress.target.combat.abilities.role.name}`);
  must<HTMLElement>("#goal-recipe").textContent = ctx.engine.state.mode === "casual"
    ? `${progress.target.char} 자령을 한 번 소환하면 달성`
    : progress.target.acquisition === "direct"
    ? `${progress.target.char} 자령을 소환하면 달성`
    : progress.target.parents.join(" + ") + " → " + progress.target.char;
  const learning = learningInfoForNotation(ctx.engine.state.notation, progress.target.char);
  must<HTMLElement>("#goal-reading").textContent = learning.readingLabel + " · " + learning.short;
  must<HTMLElement>("#goal-materials").innerHTML = progress.directMaterials.map((material) => {
    const complete = material.owned >= material.needed;
    return `<span class="${complete ? "is-complete" : ""}"><b>${escapeHtml(material.char)}</b> ${material.owned}/${material.needed}</span>`;
  }).join("")
    + `<span class="goal-clue" title="계보 소환 12회마다 재료 1기 보장"><b>단서</b> ${ctx.engine.state.lineageClueProgress}/12</span>`
    + `<span class="goal-clue" title="계보 소환 30회 누적 시 목표 한자 확정 지급"><b>확정</b> ${ctx.engine.state.lineageTargetProgress}/30</span>`;
  const goalPercent = Math.round(progress.progress * 100);
  must<HTMLElement>("#goal-progress-fill").style.width = String(goalPercent) + "%";

  const idiom = ctx.engine.currentIdiomTarget();
  const idiomProgress = idiom ? ctx.engine.idiomProgress(idiom.id) : null;
  const idiomCard = must<HTMLElement>("#idiom-target-card");
  if (idiom && idiomProgress) {
    const glyphs = ownedIdiomGlyphMarkup(idiom.chars, ownedCounts);
    idiomCard.style.setProperty("--idiom-accent", idiom.color);
    idiomCard.innerHTML = `
      <div class="idiom-target-glyphs">${glyphs}</div>
      <div class="idiom-target-copy"><span>현재 성어 목표 · ${idiomProgress.owned}/${idiomProgress.total}자 보유</span><strong>${escapeHtml(idiomReadingForNotation(idiom, ctx.engine.state.notation))}</strong><small>${escapeHtml(idiom.meaning)}</small><em>${escapeHtml(idiom.bonus.label)}</em></div>
      <div class="idiom-target-status"><b>${Math.round(idiomProgress.readiness * 100)}%</b><span>${idiomProgress.missingChars.length > 0 ? `부족 ${idiomProgress.missingChars.map(escapeHtml).join("·")}` : "배치 준비"}</span></div>`;
  } else {
    idiomCard.removeAttribute("style");
    idiomCard.innerHTML = `<div class="goal-selector-empty"><b>이번 판 성어 목표를 모두 봉인했습니다</b><span>성어 목록에서 다음 목표를 선택할 수 있습니다.</span></div>`;
  }

  const modePercent = ctx.goalPanelMode === "idiom" && idiomProgress ? Math.round(idiomProgress.readiness * 100) : goalPercent;
  must<HTMLElement>("#goal-tab-progress").textContent = `${modePercent}%`;
  const boardUnique = new Set(ctx.engine.state.towers.map((tower) => tower.char)).size;
  const storedUnique = new Set(ctx.engine.state.inventoryTowers.map((tower) => tower.char)).size;
  must<HTMLElement>("#goal-owned-summary").innerHTML = `<b>${ownedCounts.size}자 · ${ownedTowers.length}기 보유</b><span>전장 ${boardUnique}자 · 인벤 ${storedUnique}자</span>`;

  const search = must<HTMLInputElement>("#goal-search");
  search.placeholder = ctx.goalPanelMode === "hanzi" ? "원하는 한자·훈음·뜻 검색" : "원하는 성어·읽기·뜻 검색";
  const selector = must<HTMLElement>("#goal-selector-list");
  selector.innerHTML = ctx.goalPanelMode === "hanzi"
    ? renderHanziGoalChoices(pool, ownedCounts)
    : renderIdiomGoalChoices(ctx.engine.allIdioms(), ownedCounts);
}

function ownedIdiomGlyphMarkup(chars: string, ownedCounts: ReadonlyMap<string, number>): string {
  const available = new Map(ownedCounts);
  return [...chars].map((char) => {
    const count = available.get(char) ?? 0;
    if (count > 0) available.set(char, count - 1);
    return `<i class="${count > 0 ? "is-owned" : ""}">${escapeHtml(char)}</i>`;
  }).join("");
}

function renderHanziGoalChoices(definitions: readonly HanziDefinition[], ownedCounts: ReadonlyMap<string, number>): string {
  const query = ctx.goalSearchQuery.trim().toLowerCase();
  const rows = definitions
    .map((definition, order) => {
      const learning = learningInfoForNotation(ctx.engine.state.notation, definition.char);
      const progress = ctx.engine.goalProgressFor(definition.char);
      const owned = ownedCounts.get(definition.char) ?? 0;
      const selected = definition.char === ctx.engine.state.targetChar;
      const completed = ctx.engine.state.goalsCompleted.includes(definition.char);
      const searchText = `${definition.char} ${learning.readingLabel} ${learning.short} ${definition.parents.join(" ")}`.toLowerCase();
      const score = (selected ? 100_000 : 0)
        + (completed ? -10_000 : 0)
        + (owned > 0 ? -1_000 : 0)
        + (definition.acquisition === "craft" && progress.progress >= 1 ? 2_000 : 0)
        + progress.progress * 1_000
        + (6 - definition.stage) * 12
        - order / 10_000;
      return { definition, learning, progress, owned, selected, completed, searchText, score };
    })
    .filter((row) => !query || row.searchText.includes(query))
    .sort((left, right) => right.score - left.score)
    .slice(0, query ? 72 : 28);

  if (rows.length === 0) return `<div class="goal-selector-empty"><b>검색 결과가 없습니다</b><span>한자 한 글자나 훈음을 다시 입력해 보세요.</span></div>`;
  return rows.map(({ definition, learning, progress, owned, selected, completed }) => {
    const percent = Math.round(progress.progress * 100);
    const missing = progress.directMaterials.filter((material) => material.owned < material.needed);
    const status = selected
      ? "추적 중"
      : completed
        ? "달성 기록"
        : owned > 0
          ? `보유 ${owned}기`
          : definition.acquisition === "craft" && percent >= 100
            ? "재료 완성"
            : percent > 0
              ? `재료 ${percent}%`
              : ctx.engine.state.mode === "casual"
                ? `${casualNaturalStar(definition.char) ?? 1}★ 직접 소환`
                : definition.acquisition === "direct" ? "직접 소환" : `${definition.stage}단 ${STAGE_NAMES[definition.stage]}`;
    const unlockWave = summonStageUnlockWave(definition.stage);
    const directLocked = ctx.engine.state.mode === "standard" && definition.acquisition === "direct" && ctx.engine.state.wave < unlockWave;
    const naturalStar = casualNaturalStar(definition.char);
    const materialLabel = ctx.engine.state.mode === "casual"
      ? `직접 등장 · ${naturalStar ?? 1}★ · ${casualStrokeCount(definition.char) ?? "?"}획`
      : definition.acquisition === "direct"
      ? directLocked ? `${unlockWave}웨이브부터 직접 등장` : "현재 소환 풀에서 직접 등장"
      : missing.length === 0
        ? "필요 재료를 모두 보유"
        : `부족 ${missing.slice(0, 5).map((material) => `${material.char}${material.needed - material.owned}`).join(" · ")}`;
    const classes = [selected ? "is-current" : "", owned > 0 ? "is-owned" : "", completed ? "is-complete" : "", percent >= 100 ? "is-ready" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="goal-choice-card ${classes}" data-goal-char="${escapeHtml(definition.char)}" style="--goal-accent:${ELEMENT_STYLES[definition.wuxing].color}" aria-pressed="${String(selected)}">
      <span class="goal-choice-spirit" style="${spriteStyle(definition)}" aria-hidden="true"></span>
      <b class="goal-choice-glyph">${escapeHtml(definition.char)}</b>
      <span class="goal-choice-copy"><strong>${escapeHtml(learning.short)}</strong><small>${escapeHtml(learning.readingLabel)}</small><em>${escapeHtml(materialLabel)}</em></span>
      <mark>${escapeHtml(status)}</mark>
    </button>`;
  }).join("");
}

function renderIdiomGoalChoices(idioms: readonly IdiomDefinition[], ownedCounts: ReadonlyMap<string, number>): string {
  const query = ctx.goalSearchQuery.trim().toLowerCase();
  const currentId = ctx.engine.currentIdiomTarget()?.id;
  const sealedIds = new Set(ctx.engine.state.idiomSeals.map((seal) => seal.idiomId));
  const rows = idioms
    .map((idiom, order) => {
      const progress = ctx.engine.idiomProgress(idiom.id);
      const selected = idiom.id === currentId;
      const sealed = sealedIds.has(idiom.id);
      const searchText = `${idiom.chars} ${idiom.name} ${idiom.reading} ${idiom.meaning}`.toLowerCase();
      const score = (selected ? 100_000 : 0) + (sealed ? -10_000 : 0) + progress.owned * 2_000 + progress.readiness * 1_000 - order / 10_000;
      return { idiom, progress, selected, sealed, searchText, score };
    })
    .filter((row) => !query || row.searchText.includes(query))
    .sort((left, right) => right.score - left.score)
    .slice(0, query ? 72 : 28);

  if (rows.length === 0) return `<div class="goal-selector-empty"><b>검색 결과가 없습니다</b><span>네 글자나 성어 읽기를 다시 입력해 보세요.</span></div>`;
  return rows.map(({ idiom, progress, selected, sealed }) => {
    const classes = [selected ? "is-current" : "", sealed ? "is-complete" : "", progress.owned === progress.total ? "is-ready" : ""].filter(Boolean).join(" ");
    const glyphs = ownedIdiomGlyphMarkup(idiom.chars, ownedCounts);
    const status = selected ? "추적 중" : sealed ? "봉인 완료" : progress.owned === progress.total ? "배치 준비" : `${progress.owned}/${progress.total}자`;
    return `<button type="button" class="goal-choice-card goal-choice-card--idiom ${classes}" data-goal-idiom="${escapeHtml(idiom.id)}" style="--goal-accent:${idiom.color}" aria-pressed="${String(selected)}" ${sealed ? "disabled" : ""}>
      <span class="goal-choice-idiom-glyphs">${glyphs}</span>
      <span class="goal-choice-copy"><strong>${escapeHtml(idiomReadingForNotation(idiom, ctx.engine.state.notation))}</strong><small>${escapeHtml(idiom.meaning)}</small><em>${escapeHtml(idiom.bonus.label)} · ${progress.missingChars.length > 0 ? `부족 ${progress.missingChars.map(escapeHtml).join("·")}` : "네 글자 보유"}</em></span>
      <mark>${escapeHtml(status)}</mark>
    </button>`;
  }).join("");
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireGoal1(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-goal-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      ctx.goalPanelMode = button.dataset.goalMode as GoalPanelMode;
      ctx.goalSearchQuery = "";
      must<HTMLInputElement>("#goal-search").value = "";
      ctx.goalRenderKey = "";
      renderGoal();
    });
  });
  must<HTMLInputElement>("#goal-search").addEventListener("input", (event) => {
    ctx.goalSearchQuery = (event.target as HTMLInputElement).value;
    ctx.goalRenderKey = "";
    renderGoal();
  });
  must<HTMLElement>("#goal-selector-list").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const char = target.closest<HTMLButtonElement>("[data-goal-char]")?.dataset.goalChar;
    const idiomId = target.closest<HTMLButtonElement>("[data-goal-idiom]")?.dataset.goalIdiom;
    if (char) {
      handleAction(ctx.engine.setTarget(char));
      setPanelTab("goal");
    } else if (idiomId) {
      handleAction(ctx.engine.setIdiomTarget(idiomId));
      setPanelTab("goal");
    }
  });
}
