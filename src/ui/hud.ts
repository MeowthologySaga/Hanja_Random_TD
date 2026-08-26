/*
 * 상단 띠·패널 탭·집중 프레임·토스트·전투 기록 등 상시 HUD.
 */
import { bossTimeLimitForWave, MAX_ENEMIES, WAVE_REINFORCEMENT_DELAY, wavePlan } from "../core/content";
import { FIRST_PREP_SECONDS, type GameEngine, interestForGold } from "../core/game";
import {
  ELEMENT_STYLES,
  GAME_CONFIG,
  REGION_META,
  researchCost,
  researchUnlockWave,
  WUXING_ORDER
} from "../core/hanzi";
import { type ActionResult } from "../core/types";
import {
  abilityGuideDialog,
  bossBanner,
  casualFusionConfirmDialog,
  codexDialog,
  combatFeed,
  comboMeter,
  ctx,
  elementUpgradeDialog,
  feedCooldowns,
  type FocusFrameId,
  helpDialog,
  must,
  type PanelTab,
  reducedMotion,
  settingsDialog,
  shell,
  sound,
  toast
} from "./app-context";
import { towerAbilityPopups } from "./battle/fx";
import {
  renderElementUpgrades,
  totalElementUpgradeLevels,
  totalGlobalUpgradeLevels,
  upgradeStateSignature
} from "./dialogs/element-upgrade";
import { formatTime, phaseLabel } from "./format";
import { renderConcentration } from "./panels/concentration";
import { renderEvolutions } from "./panels/evolution";
import { renderGoal } from "./panels/goal";
import { renderGrowth } from "./panels/growth";
import { renderActiveIdioms, renderIdiomHud } from "./panels/idiom";
import { renderRunInventory, setRunInventoryBulkMode } from "./panels/inventory";
import { closeCompositionDrawer, renderCompositionDrawer, renderSelected } from "./panels/selected";
import { renderFormationUnlocks, renderSummonShop } from "./panels/shop";

/*
 * 시작 보너스 버튼 주목성.
 *
 * 맥동은 "아직 한 번도 안 써 본 사람"에게만 필요하다. 두 번 눌러 본
 * 뒤에는 잔잔한 금테만 남긴다(과자극 방지). 안내 말풍선은 첫 런에서
 * 조기 시작이 처음 가능해지는 순간 딱 한 번 뜬다.
 */
const EARLY_USED_STORAGE_KEY = "hanja-td:early-used";

const EARLY_HINT_STORAGE_KEY = "hanja-td:early-hint-v1";

const EARLY_CALM_THRESHOLD = 2;

function readEarlyUsedCount(): number {
  try {
    return Number.parseInt(window.localStorage.getItem(EARLY_USED_STORAGE_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function syncEarlyCalmState(): void {
  shell.dataset.earlyCalm = readEarlyUsedCount() >= EARLY_CALM_THRESHOLD ? "1" : "0";
}

function noteEarlyStartUsed(): void {
  const next = readEarlyUsedCount() + 1;
  try {
    window.localStorage.setItem(EARLY_USED_STORAGE_KEY, String(next));
  } catch {
    // 저장이 막혀 있어도 이번 세션 동작에는 영향이 없다.
  }
  syncEarlyCalmState();
}

let earlyHintTimer = 0;

/**
 * 이 안내가 나설 수 있게 된 시각. 소환 클릭은 공개 연출보다 한 프레임 먼저
 * syncPanel 을 부르므로(handleAction 경유), 자리가 비었다고 그 즉시 나서면
 * 연출과 연출에 붙는 1회성 안내(FB4)를 밀어낸다 — 잠깐 비워 두고 나선다.
 */
let earlyHintEligibleSince = 0;

const EARLY_HINT_DWELL_MS = 900;

function hideEarlyHint(): void {
  window.clearTimeout(earlyHintTimer);
  const hint = document.querySelector<HTMLElement>("#early-hint");
  if (hint) hint.hidden = true;
}

function maybeShowEarlyHint(): void {
  const hint = document.querySelector<HTMLElement>("#early-hint");
  const button = document.querySelector<HTMLButtonElement>("#early-button");
  if (!hint || !button || !hint.hidden || button.disabled) return;
  // 코치마크·1회성 안내가 떠 있는 동안에는 안내를 겹치지 않는다.
  // 소환 공개 연출이 화면을 덮는 동안도 물러난다 — 연출에 붙는 획수→별
  // 안내(FB4)가 먼저 서고, 이 안내는 연출이 걷힌 뒤에 나온다.
  if (
    !must<HTMLElement>("#coach-layer").hidden
    || !must<HTMLElement>("#hint-layer").hidden
    || must<HTMLElement>("#summon-reveal").classList.contains("is-active")
  ) {
    earlyHintEligibleSince = 0;
    return;
  }
  // 자리가 잠깐 유지된 뒤에야 나선다 — 같은 클릭 프레임의 경쟁을 막는다.
  if (earlyHintEligibleSince === 0) {
    earlyHintEligibleSince = performance.now();
    return;
  }
  if (performance.now() - earlyHintEligibleSince < EARLY_HINT_DWELL_MS) return;
  try {
    if (window.localStorage.getItem(EARLY_HINT_STORAGE_KEY) === "1") return;
    window.localStorage.setItem(EARLY_HINT_STORAGE_KEY, "1");
  } catch {
    return;
  }
  const stage = must<HTMLElement>(".battle-stage").getBoundingClientRect();
  const rect = button.getBoundingClientRect();
  const scale = stage.width / Math.max(1, must<HTMLElement>(".battle-stage").offsetWidth);
  hint.style.left = `${(rect.left - stage.left) / scale}px`;
  hint.style.top = `${(rect.bottom - stage.top) / scale + 10}px`;
  hint.hidden = false;
  earlyHintTimer = window.setTimeout(hideEarlyHint, 5000);
}

/*
 * [FB3] 적 한계 3단 경고.
 *
 * 1단(75%): 런당 딱 한 번, 토스트 + 경고음으로 "무엇이 게임오버인지"를
 *   말로 알린다. 재도전은 새 GameEngine 인스턴스라 엔진 참조 비교만으로
 *   런 단위 리셋이 성립한다(별도 초기화 배선 불필요).
 * 2단(90%): 칩에 is-critical — 확대·빨강 맥동·수치 강조(CSS [FB3-] 절).
 *   90% 미만으로 내려가면 클래스가 벗겨져 원상 복구된다.
 * 3단(패배): 종료 화면이 state.defeatCause 로 사유를 명시한다(end.ts).
 */
const ENEMY_LIMIT_WARN_RATIO = 0.75;

const ENEMY_LIMIT_CRITICAL_RATIO = 0.9;

let enemyLimitWarnedEngine: GameEngine | null = null;

function syncEnemyLimitWarning(count: number): void {
  const chip = must<HTMLElement>("#enemy-limit-chip");
  const ratio = count / MAX_ENEMIES;
  chip.classList.toggle("is-danger", ratio >= ENEMY_LIMIT_WARN_RATIO);
  chip.classList.toggle("is-critical", ratio >= ENEMY_LIMIT_CRITICAL_RATIO);
  if (ratio < ENEMY_LIMIT_WARN_RATIO || enemyLimitWarnedEngine === ctx.engine) return;
  enemyLimitWarnedEngine = ctx.engine;
  showToast(`적이 최대 ${MAX_ENEMIES}체를 넘으면 봉인이 무너집니다`, true);
  sound.playEnemyLimitWarning();
}

const FOCUS_FRAME_MOUNTS: ReadonlyArray<{ id: FocusFrameId; source: string; target: string }> = [
  { id: "growth", source: ".growth-layout", target: "#growth-frame-body" },
  { id: "concentration", source: "#concentration-layout", target: "#concentration-frame-body" },
  // R14: 보관고. 많이 뽑는 구조라 376px 패널의 1열 목록으로는 스크롤이 끝없이
  // 길어졌다. 목록 DOM 을 통째로 전장 위 격자 프레임으로 옮긴다.
  { id: "inventory", source: "#run-inventory-layout", target: "#inventory-frame-body" }
];

function mountFocusFrames(): void {
  for (const mount of FOCUS_FRAME_MOUNTS) {
    const source = document.querySelector<HTMLElement>(mount.source);
    const target = document.querySelector<HTMLElement>(mount.target);
    if (source && target && source.parentElement !== target) target.append(source);
  }
}

export function setFocusFrame(id: FocusFrameId | null): void {
  ctx.openFocusFrame = id;
  // 1회성 안내 말풍선(z 22)이 프레임(z 20) 위로 뜨지 않게 먼저 걷는다.
  if (id !== null) hideEarlyHint();
  for (const mount of FOCUS_FRAME_MOUNTS) {
    const frame = must<HTMLElement>(`#${mount.id}-frame`);
    const open = mount.id === id;
    frame.hidden = !open;
    frame.classList.toggle("is-open", open);
  }
  must<HTMLElement>("#focus-dim").hidden = id === null;
  shell.dataset.focusFrame = id ?? "none";
  if (id === "growth") {
    ctx.growthRenderKey = "";
    renderGrowth();
  } else if (id === "concentration") {
    ctx.concentrationRenderKey = "";
    renderConcentration();
  } else if (id === "inventory") {
    ctx.runInventoryRenderKey = "";
    renderRunInventory();
  }
}

export function setPanelTab(tab: PanelTab): void {
  if (tab !== ctx.activePanelTab) sound.playTabSwitch();
  if (tab !== "unit") closeCompositionDrawer();
  ctx.activePanelTab = tab;
  shell.dataset.panelTab = tab;
  document.querySelectorAll<HTMLElement>("[data-panel-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.panelView === tab);
  });
  // 셸에도 같은 이름의 data 속성을 심어 두기 때문에(테스트 계약) 전수
  // 셀렉터로 훑으면 <main> 까지 탭으로 오인해 is-active·aria-selected 를
  // 뒤집어썼다. 탭 줄 안으로 범위를 좁힌다.
  document.querySelectorAll<HTMLButtonElement>(".panel-tabs [data-panel-tab]").forEach((button) => {
    const selected = button.dataset.panelTab === tab;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  if (tab === "concentration") {
    const selected = ctx.engine.selectedTower();
    if (selected) ctx.concentrationTargetId = selected.id;
    ctx.concentrationRenderKey = "";
    renderConcentration();
  } else if (tab === "growth") {
    ctx.growthRenderKey = "";
    renderGrowth();
  }
  // 탭 진입은 곧 집중 프레임 진입이다. 다른 탭으로 나가면 프레임도 닫힌다.
  setFocusFrame(FOCUS_FRAME_MOUNTS.some((mount) => mount.id === tab) ? (tab as FocusFrameId) : null);
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHud1(): void {
  mountFocusFrames();
  syncEarlyCalmState();
}

export function handleAction(result: ActionResult, options: { invalidatePanels?: boolean } = {}): void {
  sound.playActionOutcome(result.ok);
  if (!result.ok || !result.message.includes("자동 봉인")) showToast(result.message, !result.ok);
  if (options.invalidatePanels !== false) {
    ctx.evolutionRenderKey = "";
    ctx.goalRenderKey = "";
    ctx.selectedRenderKey = "";
    ctx.runInventoryRenderKey = "";
    ctx.concentrationRenderKey = "";
    ctx.growthRenderKey = "";
  }
  syncPanel();
}

export function showToast(message: string, warning = false): void {
  toast.textContent = message;
  toast.classList.toggle("toast--warning", warning);
  toast.classList.remove("toast--visible");
  ctx.toastAnimation?.cancel();
  ctx.toastAnimation = toast.animate(reducedMotion
    ? [
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.78 },
        { opacity: 0 }
      ]
    : [
        { opacity: 0, transform: "translate(-50%, 12px)" },
        { opacity: 1, transform: "translate(-50%, 0)", offset: 0.12 },
        { opacity: 1, transform: "translate(-50%, 0)", offset: 0.78 },
        { opacity: 0, transform: "translate(-50%, -5px)" }
      ], { duration: 1900, easing: "ease" });
}

export function showWaveBanner(): void {
  bossBanner.classList.remove("boss-banner--visible");
  ctx.waveBannerAnimation?.cancel();
  ctx.waveBannerAnimation = bossBanner.animate(reducedMotion
    ? [
        { opacity: 0 },
        { opacity: 1, offset: 0.18 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0 }
      ]
    : [
        { opacity: 0, transform: "translate(-50%, -12px) scale(0.96)" },
        { opacity: 1, transform: "translate(-50%, 0) scale(1)", offset: 0.18 },
        { opacity: 1, transform: "translate(-50%, 0) scale(1)", offset: 0.7 },
        { opacity: 0, transform: "translate(-50%, 6px) scale(1.02)" }
      ], { duration: 1200, easing: "ease" });
}

/**
 * 첫 봉인 축하 — 스펙 6라운드 E3.
 *
 * 첫 봉인은 "뭔가 터졌다"로만 남고 그 효과가 어디에 남는지는 알려 주지 않았다.
 * 웨이브 배너를 한 번 빌려 전장 왼쪽 스택을 가리킨다. 런마다 처음 한 번뿐이다.
 */
export function firstSealCelebration(reading: string): void {
  bossBanner.textContent = `첫 봉인 ${reading}! 발동 중 성어는 전장 왼쪽에 표시됩니다`;
  bossBanner.classList.remove("boss-banner--boss");
  bossBanner.classList.add("boss-banner--idiom");
  showWaveBanner();
}

export function addCombatFeed(glyph: string, name: string, detail: string, color: string): void {
  const now = performance.now();
  const key = glyph + name;
  if (now - (feedCooldowns.get(key) ?? -10_000) < 1100) return;
  feedCooldowns.set(key, now);
  const item = document.createElement("li");
  item.style.setProperty("--feed-color", color);
  const seal = document.createElement("b");
  seal.textContent = glyph;
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = name;
  const description = document.createElement("small");
  description.textContent = detail;
  copy.append(title, description);
  item.append(seal, copy);
  combatFeed.prepend(item);
  while (combatFeed.children.length > 4) combatFeed.lastElementChild?.remove();
}

export function showTowerAbilityPopup(towerId: number, glyph: string, name: string, color: string): void {
  const current = towerAbilityPopups.get(towerId);
  // Frequent procs still happen mechanically, but the same tower cannot flood the screen.
  if (current && current.age < 0.8) return;
  towerAbilityPopups.set(towerId, { text: glyph + " " + name, color, age: 0, duration: 0.82 });
}

export function registerKillCombo(): void {
  const now = performance.now();
  ctx.comboCount = now - ctx.lastKillAt <= 1450 ? ctx.comboCount + 1 : 1;
  ctx.lastKillAt = now;
  window.clearTimeout(ctx.comboTimer);
  if (ctx.comboCount >= 3) {
    must<HTMLElement>("#combo-count").textContent = "× " + String(ctx.comboCount);
    comboMeter.classList.remove("combo-meter--visible");
    void comboMeter.offsetWidth;
    comboMeter.classList.add("combo-meter--visible");
  }
  ctx.comboTimer = window.setTimeout(() => {
    ctx.comboCount = 0;
    comboMeter.classList.remove("combo-meter--visible");
  }, 1750);
}

export function syncPanel(): void {
  const state = ctx.engine.state;
  const plan = ctx.engine.getCurrentPlan();
  const preview = state.phase === "prep" ? wavePlan(Math.min(state.maxWaves, state.wave + 1)) : plan;
  shell.dataset.phase = state.phase;
  shell.dataset.gameMode = state.mode;
  must<HTMLElement>("#stage-wave").textContent = String(state.wave) + " / " + String(state.maxWaves);
  const displayWave = Math.max(1, Math.min(state.maxWaves, state.phase === "prep" ? state.wave + 1 : state.wave));
  const chapter = Math.ceil(displayWave / 10);
  must<HTMLElement>("#stage-chapter").textContent = `${chapter} / 10`;
  must<HTMLElement>("#stage-region").textContent = `${REGION_META[state.region].title.split(" · ")[0] ?? state.region}${state.mode === "casual" ? " · 8성" : ""}`;
  must<HTMLElement>("#stage-phase").textContent = phaseLabel(state.phase);
  must<HTMLElement>("#stage-enemies").textContent = String(state.enemies.length) + " / " + String(MAX_ENEMIES);
  syncEnemyLimitWarning(state.enemies.length);
  must<HTMLElement>("#gold-value").textContent = String(state.gold);
  must<HTMLElement>("#interest-preview").textContent = "이자 +" + String(interestForGold(state.gold));
  must<HTMLElement>("#enemy-cap-value").textContent = String(MAX_ENEMIES) + "체";
  must<HTMLElement>("#tower-count-value").textContent = String(state.towers.length) + " / " + String(ctx.engine.deployedTowerCapacity());
  must<HTMLElement>("#goal-count-value").textContent = String(state.goalsCompleted.length) + " / " + String(ctx.engine.goalOrder.length);
  must<HTMLElement>("#seed-value").textContent = state.seed;
  must<HTMLElement>("#message-value").textContent = state.lastMessage;
  renderFormationUnlocks();
  renderSummonShop();
  must<HTMLElement>("#research-level").textContent = String(state.researchLevel);
  const nextResearchWave = researchUnlockWave(state.researchLevel);
  const researchUnlocked = state.researchLevel < 5 && state.wave >= nextResearchWave;
  must<HTMLElement>("#research-cost").textContent = state.researchLevel >= 5 ? "최고" : researchUnlocked ? `${researchCost(state.researchLevel)} 엽전` : `${nextResearchWave}W 개방`;
  // 발견 수는 런-로컬이다(항목 27). 새로고침하면 0 으로 돌아가는 것이
  // 버그로 읽히지 않도록 배지가 무엇을 세는지 라벨로 못박는다.
  const discovered = must<HTMLElement>("#discover-count");
  discovered.textContent = String(state.discoveredChars.length);
  discovered.setAttribute("aria-label", `이번 런 발견 ${state.discoveredChars.length}자`);
  must<HTMLElement>("#essence-summary").textContent = "문기 " + WUXING_ORDER.map((wuxing) => `${wuxing}${state.elementEssence[wuxing]}`).join(" ");
  const active = state.phase === "prep" || state.phase === "combat";
  must<HTMLButtonElement>("#research-button").disabled = !active || !researchUnlocked || state.gold < researchCost(state.researchLevel);
  must<HTMLButtonElement>("#auto-arrange-button").disabled = !active || state.towers.length === 0;
  must<HTMLButtonElement>("#element-upgrade-button").disabled = !active;
  must<HTMLElement>("#element-upgrade-total").textContent = `총 ${totalGlobalUpgradeLevels() + totalElementUpgradeLevels()}단계`;
  const nextElementUpgradeRenderKey = upgradeStateSignature();
  if (elementUpgradeDialog.open && ctx.elementUpgradeRenderKey !== nextElementUpgradeRenderKey) renderElementUpgrades();
  const earlyButton = must<HTMLButtonElement>("#early-button");
  earlyButton.disabled = state.phase !== "prep" || state.summonCount === 0;
  earlyButton.textContent = state.phase === "prep"
    ? state.summonCount === 0 ? "첫 소환 필요" : "시작 +" + String(Math.floor(state.prepRemaining / 2)) + "엽전"
    : "교전 중";
  if (earlyButton.disabled) hideEarlyHint();
  else maybeShowEarlyHint();
  const openingGuide = must<HTMLElement>("#opening-guide");
  openingGuide.classList.toggle("is-collapsed", state.wave >= 1);
  const openingStep = state.summonCount === 0 ? 1 : state.summonCount < 3 ? 2 : 3;
  openingGuide.querySelectorAll<HTMLElement>("[data-opening-step]").forEach((step) => {
    const index = Number(step.dataset.openingStep);
    step.classList.toggle("is-current", state.wave === 0 && index === openingStep);
    step.classList.toggle("is-complete", state.wave > 0 || index < openingStep);
  });
  const bossRemaining = ctx.engine.bossTimeRemaining();
  const nextWaveRemaining = state.phase === "combat" ? state.nextWaveRemaining : null;
  const previewBossLimit = preview?.boss ? bossTimeLimitForWave(preview.wave) : null;
  must<HTMLElement>(".wave-card").classList.toggle("is-boss", bossRemaining !== null || previewBossLimit !== null);
  must<HTMLElement>("#wave-kicker").textContent = state.phase === "prep"
    ? state.summonCount === 0 ? "첫 소환 전 · 시간 정지" : previewBossLimit !== null ? "우두머리전 · 제한 " + String(previewBossLimit) + "초" : "준비 " + state.prepRemaining.toFixed(1) + "초"
    : bossRemaining !== null
      ? "우두머리 제한 " + bossRemaining.toFixed(1) + "초"
      : nextWaveRemaining !== null
        ? "다음 웨이브 " + nextWaveRemaining.toFixed(1) + "초"
        : state.phase === "combat" ? formatTime(state.waveElapsed) + " 경과" : "봉인전 종료";
  must<HTMLElement>("#wave-label").textContent = state.phase === "prep"
    ? state.summonCount === 0 ? "① 상점에서 첫 자령을 소환하세요" : String(state.wave + 1) + "웨이브 · " + (preview?.label ?? "")
    : plan?.label ?? state.lastMessage;
  must<HTMLElement>("#wave-briefing").textContent = state.summonCount === 0
    ? "첫 자령의 오행에 맞는 4×4 진이 무료로 열립니다. 소환 전에는 준비 시간과 런 시간이 흐르지 않습니다."
    : preview
    ? preview.briefing
      + ` · 제${Math.ceil(preview.wave / 10)}장 · 다음 장 우두머리 ${Math.ceil(preview.wave / 10) * 10}웨이브`
      + (previewBossLimit !== null ? " · 제한시간 내 우두머리 처치 필수" : "")
      + (nextWaveRemaining !== null ? ` · 잔존 ${state.enemies.length}체와 함께 다음 웨이브가 합류합니다.` : "")
    : "적 " + String(MAX_ENEMIES) + "체 도달 시 즉시 게임오버";
  const weakness = preview?.weakness ?? "木";
  const weaknessElement = must<HTMLElement>("#wave-weakness");
  weaknessElement.textContent = weakness;
  weaknessElement.style.color = ELEMENT_STYLES[weakness].color;
  const progress = plan && state.phase === "combat"
    ? nextWaveRemaining !== null
      ? 1 - nextWaveRemaining / WAVE_REINFORCEMENT_DELAY
      : Math.min(1, state.spawned / Math.max(1, plan.count))
    : state.phase === "prep" ? 1 - state.prepRemaining / (state.wave === 0 ? FIRST_PREP_SECONDS : state.wave % 10 === 0 ? GAME_CONFIG.bossPrepSeconds : GAME_CONFIG.prepSeconds) : 0;
  must<HTMLElement>("#wave-progress-fill").style.width = String(Math.max(0, progress) * 100) + "%";
  must<HTMLElement>("#phase-dot").className = state.phase === "combat" ? "phase-dot--combat" : state.phase === "prep" ? "phase-dot--prep" : "";
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.mode === state.automationMode));
  renderGoal();
  renderEvolutions();
  renderSelected();
  renderCompositionDrawer();
  renderRunInventory();
  if (ctx.activePanelTab === "concentration") renderConcentration();
  if (ctx.activePanelTab === "growth") renderGrowth();
  renderIdiomHud();
  renderActiveIdioms();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHud2(): void {
  must<HTMLButtonElement>("#evolve-button").addEventListener("click", () => setPanelTab("evolution"));
  must<HTMLButtonElement>("#research-button").addEventListener("click", () => { sound.unlock(); handleAction(ctx.engine.upgradeResearch()); });
  must<HTMLButtonElement>("#auto-arrange-button").addEventListener("click", () => { sound.unlock(); handleAction(ctx.engine.autoArrangeTowers()); });
  must<HTMLButtonElement>("#element-upgrade-button").addEventListener("click", () => setPanelTab("growth"));
  // 집중 프레임 여닫기 — dim 클릭 · [닫기] · Esc. 게임은 멈추지 않는다.
  must<HTMLElement>("#focus-dim").addEventListener("click", () => setFocusFrame(null));
  document.querySelectorAll<HTMLButtonElement>("[data-focus-close]").forEach((button) => {
    button.addEventListener("click", () => setFocusFrame(null));
  });
  must<HTMLButtonElement>("#growth-frame-open").addEventListener("click", () => setFocusFrame("growth"));
  must<HTMLButtonElement>("#concentration-frame-open").addEventListener("click", () => setFocusFrame("concentration"));
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || ctx.openFocusFrame === null) return;
    if (helpDialog.open || settingsDialog.open || elementUpgradeDialog.open || abilityGuideDialog.open || casualFusionConfirmDialog.open || codexDialog.open) return;
    event.preventDefault();
    // R19: 보관고 일괄 모드는 프레임보다 안쪽 층위다 — Esc 는 안쪽부터 걷는다.
    if (ctx.openFocusFrame === "inventory" && ctx.runInventoryBulkMode) {
      setRunInventoryBulkMode(false);
      showToast("일괄 모드 해제 · 카드 클릭이 다시 고르기가 됩니다");
      return;
    }
    setFocusFrame(null);
  });
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHud3(): void {
  must<HTMLButtonElement>("#early-button").addEventListener("click", () => {
    sound.unlock();
    hideEarlyHint();
    const bonus = Math.floor(ctx.engine.state.prepRemaining / 2);
    const result = ctx.engine.startWaveEarly();
    handleAction(result, { invalidatePanels: false });
    if (result.ok) {
      noteEarlyStartUsed();
      // 이득이 "일어났다"가 눈에 남게: 버튼 자리에서 엽전 팝이 떠오른다.
      const button = must<HTMLButtonElement>("#early-button");
      const pop = document.createElement("span");
      pop.className = "early-bonus-pop";
      pop.textContent = bonus > 0 ? `+${bonus} 엽전` : "웨이브 시작!";
      const rect = button.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const scale = shellRect.width / Math.max(1, shell.offsetWidth);
      pop.style.left = `${(rect.left - shellRect.left) / scale + rect.width / scale / 2}px`;
      pop.style.top = `${(rect.top - shellRect.top) / scale}px`;
      shell.appendChild(pop);
      window.setTimeout(() => pop.remove(), 1400);
    }
  });
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHud4(): void {
  document.querySelectorAll<HTMLButtonElement>(".panel-tabs [data-panel-tab]").forEach((button) => {
    button.addEventListener("click", () => setPanelTab(button.dataset.panelTab as PanelTab));
  });
}
