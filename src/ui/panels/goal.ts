/*
 * 목표 서책 — "성어가 곧 목표" (트랙 B, gripe #3).
 *
 * 한자 목표 사다리 UI 는 은퇴했다 — 내부 보상 사다리(completeGoal)는 엔진에
 * 그대로 남아 숨은 지급으로 동작하고, 화면의 목표 축은 성어 하나다.
 * 서책은 성어 카드 격자(좌) + 선택 성어 상세(우) 2단이며, 보관고(R14/R19)
 * 선례대로 #goal-codex-layout 을 통째로 전장 위 집중 프레임에 옮긴다.
 * 패널에는 요약과 [서책 열기]만 남는다.
 *
 * 추적은 최대 3구(체크 토글) — 부족 글자 합집합이 소환·연구 가중을 받는다.
 * 획득 방법 칸은 모드별로 갈린다: 캐주얼 = 소환·연구, 표준 = 합성 하위 트리
 * 자동 전개("이 글자는 이 부품들로").
 */
import { casualNaturalStar, casualStrokeCount } from "../../core/casual";
import { MAX_TRACKED_IDIOMS } from "../../core/game";
import { ELEMENT_STYLES, maxSummonStageForWave, STAGE_NAMES, summonStageUnlockWave } from "../../core/hanzi";
import { type IdiomDefinition } from "../../core/idioms";
import { learningInfoForNotation } from "../../core/learning";
import { notationShortHtml } from "../notation-substitute";
import { ctx, must } from "../app-context";
import { escapeHtml } from "../format";
import { handleAction, setFocusFrame } from "../hud";

/*
 * [S/P-09] 목표 화면은 서로 다른 두 수를 나란히 보여 준다.
 *
 * ① 갈피 배지의 % — engine.idiomProgress().readiness. 가진 글자를 1로 세고,
 *    없는 글자는 그 글자를 만들 합성 진척(0~1)까지 부분 점수로 더한 값이다.
 * ② 카드의 N/4 — 지금 손에 든 글자 수만 센 값.
 *
 * 같은 성어에서 "75%" 와 "2/4" 가 함께 뜨면 둘 중 하나가 틀린 것처럼 읽힌다
 * (75% 를 3/4 로 읽는 오독). 라벨을 「준비도」와 「보유」로 갈라 두고,
 * 셈법은 아래 한 줄이 툴팁으로 말한다.
 */
const READINESS_NOTE = "준비도 — 가진 글자에, 아직 없는 글자의 합성 진척까지 더해 셉니다. 카드의 「N/4자 보유」는 지금 손에 든 글자 수만 세므로 두 수는 다를 수 있습니다.";

const OWNED_NOTE = "지금 손에 든 글자 수입니다. 합성 진척까지 함께 세는 준비도(%)와는 다른 수입니다.";

export function renderGoal(): void {
  const engine = ctx.engine;
  const pool = engine.summonDefinitions();
  must<HTMLElement>("#shop-pool-count").textContent = pool.length.toLocaleString("ko-KR");
  const maxSummonStage = maxSummonStageForWave(engine.state.wave);
  const nextStage = maxSummonStage < 5 ? (maxSummonStage + 1) as 2 | 3 | 4 | 5 : null;
  must<HTMLElement>("#summon-pool-summary").innerHTML = engine.state.mode === "casual"
    ? `<b>천자문 ${pool.length.toLocaleString("ko-KR")}종</b><span>전 자령 직접 등장 · 획수별 1★–8★</span>`
    : `<b>천자문 ${pool.length.toLocaleString("ko-KR")}종</b><span>${STAGE_NAMES[maxSummonStage]}까지 등장${nextStage ? ` · ${summonStageUnlockWave(nextStage)}W 다음 단계` : " · 전 단계 개방"}</span>`;

  const ownedTowers = [...engine.state.towers, ...engine.state.inventoryTowers];
  const ownedCounts = new Map<string, number>();
  for (const tower of ownedTowers) ownedCounts.set(tower.char, (ownedCounts.get(tower.char) ?? 0) + 1);
  const ownedSignature = [...ownedCounts.entries()].sort(([left], [right]) => left.localeCompare(right, "ko")).map(([char, count]) => `${char}:${count}`).join(",");

  const tracked = engine.trackedIdioms();
  const trackedIds = tracked.map((idiom) => idiom.id);
  const sealSignature = engine.state.idiomSeals.map((seal) => `${seal.idiomId}:${seal.active ? "on" : "off"}`).join(",");
  const selectedId = resolveSelectedIdiomId(trackedIds);
  const key = [
    ctx.goalSearchQuery,
    selectedId,
    trackedIds.join(","),
    sealSignature,
    maxSummonStage,
    ownedSignature
  ].join("|");
  if (key === ctx.goalRenderKey) return;
  ctx.goalRenderKey = key;

  const seals = engine.state.idiomSeals.length;
  const bestReadiness = tracked.reduce((best, idiom) => Math.max(best, engine.idiomProgress(idiom.id).readiness), 0);
  const percent = Math.round(bestReadiness * 100);
  // [S/P-09] 이 %(준비도)와 카드의 "N/4자"(보유)는 서로 다른 셈이다.
  // 라벨을 갈라 두고, 계산법은 툴팁 한 줄이 말한다.
  const badge = must<HTMLElement>("#goal-tab-progress");
  badge.textContent = `준비 ${percent}%`;
  badge.title = READINESS_NOTE;
  // 갈피 이름은 "목표" + 이 배지다 — 여기에 "성어"를 넣으면 옆 「성어」 갈피와
  // 접근명이 겹친다(실증: 역할 선택이 두 갈피에 걸렸다).
  badge.setAttribute("aria-label", `준비도 ${percent}%`);
  must<HTMLElement>("#goal-owned-summary").innerHTML = `<b>추적 ${tracked.length}/${MAX_TRACKED_IDIOMS}구</b><span>발동 ${seals}구</span>`;
  const summary = must<HTMLElement>("#goal-panel-summary");
  summary.innerHTML = `추적 중 성어 <b>${tracked.length}구</b> · 최고 준비도 <b>${percent}%</b>`;
  summary.title = READINESS_NOTE;

  must<HTMLElement>("#goal-selector-list").innerHTML = renderIdiomCards(ownedCounts, trackedIds, selectedId);
  must<HTMLElement>("#goal-codex-detail").innerHTML = renderIdiomDetail(selectedId, ownedCounts, trackedIds);
}

/** 상세로 펼칠 성어 — 직접 고른 것이 없으면 1순위 추적 성어를 따른다. */
function resolveSelectedIdiomId(trackedIds: readonly string[]): string {
  const all = ctx.engine.allIdioms();
  if (ctx.goalSelectedIdiomId && all.some((idiom) => idiom.id === ctx.goalSelectedIdiomId)) return ctx.goalSelectedIdiomId;
  return trackedIds[0] ?? all[0]?.id ?? "";
}

/** 성어 4자를 보유 표시와 함께 — 같은 글자 두 번이면 보유분도 두 번 세지 않는다. */
function ownedIdiomGlyphMarkup(chars: string, ownedCounts: ReadonlyMap<string, number>): string {
  const available = new Map(ownedCounts);
  return [...chars].map((char, index) => {
    const count = available.get(char) ?? 0;
    if (count > 0) available.set(char, count - 1);
    return `<i class="${count > 0 ? "is-owned" : ""}" title="${index + 1}번째 글자">${escapeHtml(char)}</i>`;
  }).join("");
}

function renderIdiomCards(ownedCounts: ReadonlyMap<string, number>, trackedIds: readonly string[], selectedId: string): string {
  const engine = ctx.engine;
  const query = ctx.goalSearchQuery.trim().toLowerCase();
  const sealedIds = new Set(engine.state.idiomSeals.map((seal) => seal.idiomId));
  const rows = engine.allIdioms()
    .map((idiom, order) => {
      const progress = engine.idiomProgress(idiom.id);
      const trackedIndex = trackedIds.indexOf(idiom.id);
      const sealed = sealedIds.has(idiom.id);
      const live = engine.isIdiomSealActive(idiom.id);
      const searchText = `${idiom.chars} ${idiom.name} ${idiom.reading} ${idiom.meaning}`.toLowerCase();
      const score = (trackedIndex >= 0 ? 100_000 - trackedIndex : 0)
        + (sealed ? -10_000 : 0)
        + progress.owned * 2_000
        + progress.readiness * 1_000
        - order / 10_000;
      return { idiom, progress, trackedIndex, sealed, live, searchText, score };
    })
    .filter((row) => !query || row.searchText.includes(query))
    .sort((left, right) => right.score - left.score)
    .slice(0, query ? 72 : 28);

  if (rows.length === 0) return `<div class="goal-selector-empty"><b>검색 결과가 없습니다</b><span>네 글자나 성어 읽기를 다시 입력해 보세요.</span></div>`;
  return rows.map(({ idiom, progress, trackedIndex, sealed, live }) => {
    const isTracked = trackedIndex >= 0;
    const selected = idiom.id === selectedId;
    const ownedPercent = Math.round(progress.owned / Math.max(1, progress.total) * 100);
    const status = sealed
      ? live ? "발동 중" : "발동 이력 · 흩어짐"
      : isTracked
        ? `추적 ${trackedIndex + 1}순위`
        : progress.owned === progress.total ? "배치 준비" : `${progress.owned}/${progress.total}자`;
    const classes = [
      "goal-idiom-card",
      selected ? "is-selected" : "",
      isTracked ? "is-tracked" : "",
      sealed ? "is-sealed" : "",
      !sealed && progress.owned === progress.total ? "is-ready" : ""
    ].filter(Boolean).join(" ");
    return `<div class="${classes}" data-goal-idiom="${escapeHtml(idiom.id)}" role="button" tabindex="0" aria-pressed="${String(selected)}" style="--goal-accent:${idiom.color}">
      <span class="goal-idiom-glyphs">${ownedIdiomGlyphMarkup(idiom.chars, ownedCounts)}</span>
      <span class="goal-idiom-copy"><strong>${escapeHtml(idiom.reading)}</strong><small>${escapeHtml(idiom.meaning)}</small></span>
      <span class="goal-idiom-progress" title="${OWNED_NOTE}" aria-label="보유 ${progress.owned}/${progress.total}자"><i style="width:${ownedPercent}%"></i><em>${progress.owned}/${progress.total}자 보유</em></span>
      <button type="button" class="goal-idiom-track" data-goal-track="${escapeHtml(idiom.id)}" aria-pressed="${String(isTracked)}" ${sealed ? "disabled" : ""}>${sealed ? "발동 완료" : isTracked ? "추적 중 ✓" : "추적"}</button>
      <mark>${escapeHtml(status)}</mark>
    </div>`;
  }).join("");
}

function renderIdiomDetail(selectedId: string, ownedCounts: ReadonlyMap<string, number>, trackedIds: readonly string[]): string {
  const engine = ctx.engine;
  const idiom = engine.allIdioms().find((candidate) => candidate.id === selectedId);
  if (!idiom) return `<div class="goal-selector-empty"><b>성어를 선택하세요</b><span>왼쪽 카드에서 목표로 삼을 성어를 고릅니다.</span></div>`;
  const sealed = engine.state.idiomSeals.some((seal) => seal.idiomId === idiom.id);
  const live = engine.isIdiomSealActive(idiom.id);
  const trackedIndex = trackedIds.indexOf(idiom.id);
  const sourceLabel = idiom.source === "cheonjamun" ? `천자문 제${idiom.sourceOrder}구` : "상용 사자성어";
  const stateLabel = live ? "발동 중" : sealed ? "발동 이력 · 지금은 흩어짐" : trackedIndex >= 0 ? `추적 ${trackedIndex + 1}순위` : "서책 수록";
  const trackButton = sealed
    ? `<button type="button" class="goal-detail-track is-sealed" disabled>발동 완료 — 목표에서 은퇴</button>`
    : trackedIndex >= 0
      ? `<button type="button" class="goal-detail-track is-on" data-goal-track="${escapeHtml(idiom.id)}" aria-pressed="true">추적 해제</button>`
      : `<button type="button" class="goal-detail-track" data-goal-track="${escapeHtml(idiom.id)}" aria-pressed="false">이 성어 추적 (${trackedIds.length}/${MAX_TRACKED_IDIOMS})</button>`;

  return `<div class="goal-detail" style="--goal-accent:${idiom.color}">
    <div class="goal-detail-glyphs">${ownedIdiomGlyphMarkup(idiom.chars, ownedCounts)}</div>
    <p class="goal-detail-kicker">${escapeHtml(sourceLabel)} · ${escapeHtml(stateLabel)}</p>
    <h3 class="goal-detail-reading">${escapeHtml(idiom.reading)}</h3>
    <p class="goal-detail-meaning">${escapeHtml(idiom.meaning)}</p>
    <article class="goal-detail-bonus"><b>${escapeHtml(idiom.bonus.label)}</b><span>같은 진의 한 줄(가로·세로·대각선)에 ①→④ 순서로 놓으면 자동 발동 — 효과는 줄을 지키는 동안만 삽니다.</span></article>
    ${trackButton}
    ${renderMissingSection(idiom, ownedCounts)}
  </div>`;
}

/** 부족 글자 칸 — 캐주얼은 소환·연구 안내, 표준은 합성 하위 트리 전개. */
function renderMissingSection(idiom: IdiomDefinition, ownedCounts: ReadonlyMap<string, number>): string {
  const engine = ctx.engine;
  const missing = engine.idiomProgress(idiom.id).missingChars;
  if (missing.length === 0) {
    return `<section class="goal-detail-missing"><h4>부족 글자 없음</h4><p class="goal-missing-done">네 글자를 모두 보유했습니다 — 한 줄로 세우기만 하면 됩니다. 자동배치가 가능한 줄을 찾아 줍니다.</p></section>`;
  }
  const casual = engine.state.mode === "casual";
  const heading = casual
    ? `부족 ${missing.length}자 · 소환·연구로 모읍니다`
    : `부족 ${missing.length}자 · 부품을 모아 합성합니다`;
  const note = casual
    ? `<p class="goal-missing-note">추적 중이면 이 글자들이 더 자주 나오고, 인연 연구가 그 가중을 키웁니다.</p>`
    : `<p class="goal-missing-note">직접 소환 부품은 추적·연구 가중을 받고, 합성 글자는 아래 부품 트리로 만듭니다.</p>`;
  const items = [...new Set(missing)].map((char) => renderMissingChar(char, ownedCounts)).join("");
  return `<section class="goal-detail-missing"><h4>${escapeHtml(heading)}</h4>${note}<div class="goal-missing-list">${items}</div></section>`;
}

function renderMissingChar(char: string, ownedCounts: ReadonlyMap<string, number>): string {
  const engine = ctx.engine;
  const definition = engine.catalog.definitions.get(char);
  // 표기 축을 따른다 — 로스터 밖 글자도 고른 표기로 읽고 판정 배지를 함께 단다.
  const learning = learningInfoForNotation(engine.state.notation, char);
  if (!definition) {
    return `<div class="goal-missing-item"><b class="goal-missing-glyph">${escapeHtml(char)}</b><span class="goal-missing-copy"><strong>${notationShortHtml(learning, engine.state.notation)}</strong><small>${escapeHtml(learning.readingLabel)}</small><em>이 지역 로스터 밖의 글자입니다</em></span></div>`;
  }
  const accent = ELEMENT_STYLES[definition.wuxing].color;
  let acquisition: string;
  let tree = "";
  if (engine.state.mode === "casual") {
    const star = casualNaturalStar(char) ?? 1;
    acquisition = `${star}★ · ${casualStrokeCount(char) ?? "?"}획 · 소환으로 직접 등장`;
  } else if (definition.acquisition === "direct") {
    const unlockWave = summonStageUnlockWave(definition.stage);
    const locked = engine.state.wave < unlockWave;
    acquisition = locked ? `직접 소환 · ${unlockWave}W 개방` : "직접 소환 가능";
  } else {
    acquisition = `${definition.stage}단 ${STAGE_NAMES[definition.stage]} · ${definition.parents.join(" + ")} → ${char}`;
    tree = synthesisTreeMarkup(char, ownedCounts);
  }
  return `<div class="goal-missing-item" style="--goal-accent:${accent}">
    <b class="goal-missing-glyph">${escapeHtml(char)}</b>
    <span class="goal-missing-copy"><strong>${notationShortHtml(learning, engine.state.notation)}</strong><small>${escapeHtml(learning.readingLabel)}</small><em>${escapeHtml(acquisition)}</em></span>
    ${tree}
  </div>`;
}

/** 지금 가진(전장 + 가방) 한자별 개수. 부품 트리가 "이미 있는 것"을 표시할 때 쓴다. */
export function ownedCharCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tower of [...ctx.engine.state.towers, ...ctx.engine.state.inventoryTowers]) {
    counts.set(tower.char, (counts.get(tower.char) ?? 0) + 1);
  }
  return counts;
}

/**
 * 표준 모드 합성 하위 트리 — "이 글자는 이 부품들로" (evolution.getTargetPath
 * 와 같은 부모 재귀·같은 방문 집합 규칙, 화면용 행 전개판).
 * 보유한 부품은 더 쪼개지 않는다 — 이미 손에 있으니 만들 필요가 없다.
 *
 * [S/P-14] 합성 탭의 빈 상태도 이 트리를 그대로 빌린다 — 같은 그림이
 * 두 곳에서 같은 뜻으로 읽히게. 그래서 export 다.
 */
export function synthesisTreeMarkup(char: string, ownedCounts: ReadonlyMap<string, number>): string {
  const engine = ctx.engine;
  const rows: string[] = [];
  const visited = new Set<string>();
  const expand = (target: string): void => {
    if (visited.has(target) || rows.length >= 8) return;
    visited.add(target);
    const definition = engine.catalog.definitions.get(target);
    if (!definition || definition.acquisition === "direct" || definition.parents.length === 0) return;
    const parts = definition.parents.map((parent) => {
      const owned = (ownedCounts.get(parent) ?? 0) > 0;
      const parentDefinition = engine.catalog.definitions.get(parent);
      const direct = !parentDefinition || parentDefinition.acquisition === "direct" || parentDefinition.parents.length === 0;
      return `<span class="${[owned ? "is-owned" : "", direct ? "is-direct" : ""].filter(Boolean).join(" ")}">${escapeHtml(parent)}</span>`;
    }).join("<em>+</em>");
    rows.push(`<div class="goal-tree-row"><b>${escapeHtml(target)}</b><i>←</i>${parts}</div>`);
    for (const parent of definition.parents) {
      if ((ownedCounts.get(parent) ?? 0) > 0) continue;
      expand(parent);
    }
  };
  expand(char);
  if (rows.length === 0) return "";
  return `<div class="goal-tree" aria-label="${escapeHtml(char)} 합성 부품 트리">${rows.join("")}</div>`;
}

function handleCodexClick(event: Event): void {
  const target = event.target as HTMLElement;
  const trackId = target.closest<HTMLButtonElement>("[data-goal-track]")?.dataset.goalTrack;
  if (trackId) {
    const tracked = ctx.engine.trackedIdioms().some((idiom) => idiom.id === trackId);
    ctx.goalSelectedIdiomId = trackId;
    handleAction(ctx.engine.setIdiomTracking(trackId, !tracked));
    return;
  }
  const idiomId = target.closest<HTMLElement>("[data-goal-idiom]")?.dataset.goalIdiom;
  if (idiomId) {
    ctx.goalSelectedIdiomId = idiomId;
    ctx.goalRenderKey = "";
    renderGoal();
  }
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireGoal1(): void {
  must<HTMLInputElement>("#goal-search").addEventListener("input", (event) => {
    ctx.goalSearchQuery = (event.target as HTMLInputElement).value;
    ctx.goalRenderKey = "";
    renderGoal();
  });
  const list = must<HTMLElement>("#goal-selector-list");
  list.addEventListener("click", handleCodexClick);
  // 카드가 div[role=button]이라 키보드 선택을 직접 잇는다.
  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-goal-idiom]");
    if (!card) return;
    event.preventDefault();
    ctx.goalSelectedIdiomId = card.dataset.goalIdiom ?? "";
    ctx.goalRenderKey = "";
    renderGoal();
  });
  must<HTMLElement>("#goal-codex-detail").addEventListener("click", handleCodexClick);
  must<HTMLButtonElement>("#goal-frame-open").addEventListener("click", () => setFocusFrame("goal"));
}
