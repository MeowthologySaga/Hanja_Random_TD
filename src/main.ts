import "./styles.css";
import "./ui-skin.css";
import { hasActiveSkills } from "./core/abilities";
import {
  CASUAL_STAR_COLORS,
  CASUAL_STAR_NAMES,
  CASUAL_STAR_POWER,
  casualNaturalStar,
  casualStarRangeLabel,
  casualStrokeCount
} from "./core/casual";
import { CHEONJAMUN_JARYEONG_DEX_BY_HANJA, type CheonjamunJaryeongDexEntry } from "./core/cheonjamun-jaryeong-dex";
import { CHEONJAMUN_SUPPLEMENTAL_CHARACTERS } from "./core/cheonjamun-roster";
import { BOARD_CELLS, BOARD_FORMATIONS, CELLS_PER_FORMATION, WORLD_HEIGHT, WORLD_WIDTH } from "./core/content";
import { concentrationPathLabel, GameEngine } from "./core/game";
import {
  definitionForTower,
  ELEMENT_STYLES,
  REGION_META,
  STAGE_COLORS,
  STAGE_MULTIPLIERS,
  STAGE_NAMES,
  UPGRADE_STAT_META,
  WUXING_ORDER
} from "./core/hanzi";
import { jaryeongVisualFor } from "./core/jaryeongs";
import { koreanMeaningExplanation } from "./core/korean-meaning-explanations";
import { LEARNING_DATA_META, learningInfo } from "./core/learning";
import { radicalLearningLabel } from "./core/radicals";
import { createRunSeed } from "./core/rng";
import {
  type AbilitySpec,
  type AutomationMode,
  type CasualStar,
  type GameEvent,
  type GameMode,
  type HanziDefinition,
  type Point,
  type RegionCode,
  type Tower,
  type Wuxing
} from "./core/types";
import {
  battleAssetProgress,
  dismissBootScreen,
  isBattleAssetsReady,
  preloadP1,
  registerServiceWorker,
  startP2,
  takeOverBootScreen,
  updateBootProgress,
  whenBattleAssetsReady
} from "./ui/asset-loader";
import {
  buildSynthesisDepths,
  buildUncombinableStageOneChars,
  synthesisTierAccessibleLabel,
  type SynthesisTierFilter,
  synthesisTierFilterLabel,
  synthesisTierKey,
  UNCOMBINABLE_STAGE_ONE
} from "./ui/codex-synthesis";
import { preloadCombatFxSprites } from "./ui/combat-fx-sprites";
import { type DisplayMode, saveDisplayMode } from "./ui/display-mode";
import { preloadEnemySprites } from "./ui/enemy-sprites";
import { preloadFormationPlates } from "./ui/formation-plate-sprites";
import { preloadIdiomSprites } from "./ui/idiom-sprites";
import { preloadInkPathSprites } from "./ui/ink-path-sprites";
import { preloadLockSprites } from "./ui/lock-sprites";
import { preloadNameplateSprites } from "./ui/nameplate-sprites";
import { preloadP0ComponentSprites } from "./ui/p0-component-sprites";
import {
  clampStarLevel,
  IDIOM_SEAL_SIZE,
  idiomCompletionSealImage,
  preloadPolishSprites,
  STAR_RING_SIZE,
  starAscentRingImage
} from "./ui/polish-sprites";
import { loadAutoPlaceSummons, saveAutoPlaceSummons } from "./ui/summon-placement";
import {
  abilityGuideDialog,
  bossBanner,
  canvas,
  casualFusionConfirmDialog,
  codexDialog,
  type CodexMode,
  combatFeed,
  comboMeter,
  context,
  ctx,
  dismantleSelection,
  elementUpgradeDialog,
  endOverlay,
  feedCooldowns,
  fusionVortex,
  helpDialog,
  HOVER_GLYPH_STORAGE_KEY,
  initialDisplayMode,
  type JaryeongDexFilter,
  lastAbilityFxByTower,
  must,
  reducedMotion,
  runInventoryBulkSelection,
  s00Mode,
  seedInput,
  settingsDialog,
  shell,
  sound,
  summonReveal,
  titleOverlay
} from "./ui/app-context";
import {
  constrainMapCamera,
  cycleGameSpeed,
  focusMapOnCells,
  focusMapOnFormation,
  resetMapCamera,
  setGameSpeed,
  setMapZoom,
  summonAndFocus,
  syncMapZoomControl,
  toggleHanjaEmphasis
} from "./ui/battle/camera";
import { drawWorld } from "./ui/battle/draw";
import {
  abilityBurstPool,
  abilityBursts,
  floaterPool,
  floaters,
  idiomRipples,
  projectilePool,
  projectiles,
  pushPooled,
  pushRasterBurst,
  recycleAll,
  ringPool,
  rings,
  takeAbilityBurst,
  takeFloater,
  takeProjectile,
  takeRing,
  towerAbilityPopups
} from "./ui/battle/fx";
import { formatStatBonus, totalElementUpgradeLevels, totalGlobalUpgradeLevels } from "./ui/dialogs/element-upgrade";
import { casualStarOf, escapeHtml, formatTime, gameModeLabel, spriteStyle, visualBackgroundStyle } from "./ui/format";
import {
  addCombatFeed,
  firstSealCelebration,
  handleAction,
  registerKillCombo,
  setFocusFrame,
  setPanelTab,
  showToast,
  showTowerAbilityPopup,
  showWaveBanner,
  syncPanel
} from "./ui/hud";
import { resetIdiomResult, showIdiomBrokenResult, showIdiomResult } from "./ui/panels/idiom";
import { closeCompositionDrawer } from "./ui/panels/selected";
import { wireCommon1 } from "./ui/dialogs/common";
import { wireElementUpgrade1, wireElementUpgrade2 } from "./ui/dialogs/element-upgrade";
import { wireHelp1, wireHelp2 } from "./ui/dialogs/help";
import { wireHud1, wireHud2, wireHud3, wireHud4 } from "./ui/hud";
import { wireCasualFusion1 } from "./ui/panels/casual-fusion";
import { wireConcentration1 } from "./ui/panels/concentration";
import { wireEvolution1 } from "./ui/panels/evolution";
import { wireGoal1 } from "./ui/panels/goal";
import { wireGrowth1, wireGrowth2 } from "./ui/panels/growth";
import { wireInventory1 } from "./ui/panels/inventory";
import { wireSelected1, wireSelected2, wireSelected3 } from "./ui/panels/selected";
import { wireShop1 } from "./ui/panels/shop";

/**
 * S00 2D 폴백(`?menu3d=0` · WebGL 초기화 실패)의 3레이어 배경.
 *
 * 출처: handoff/to-claude/s00-layered-bg-pack-v1/assets/
 * 설치: public/assets/ui/s00-layers-v1/
 *
 * 세 장이 전부 도착했을 때만 기존 단일 배경을 끈다. 한 장이라도 실패하면
 * 합성이 어긋난 채 보이느니 원래 한 장짜리 배경을 그대로 쓴다. 다섯 먹 고리는
 * 책 레이어 RGB 에 그대로 있으므로 좌표가 바뀌지 않는다.
 *
 * R11: `src` 대신 `data-src` 로 들고 있다가 2D 로 갈 때만 붙인다. 3D 가 기본인데
 * `display:none` 인 `<img>` 도 브라우저는 그대로 받아 가서, 쓰지도 않을 6.8MB
 * (배경 4장 4.8MB + 쇼케이스 고리·자령 10장 2.0MB)가 매번 S00 텍스처와 대역을
 * 나눠 쓰고 있었다. 3D 에서 고리·자령은 같은 파일을 텍스처로 쓰므로 그림 자체는
 * 그대로 나온다.
 */
function enableS00LayeredBackground(): void {
  const stage = document.querySelector<HTMLElement>(".s00-stage");
  const group = document.querySelector<HTMLElement>("#s00-parallax");
  if (!stage || !group) return;
  const legacy = stage.querySelector<HTMLImageElement>(".s00-env--legacy");
  if (legacy?.dataset.src && !legacy.src) legacy.src = legacy.dataset.src;
  for (const showcase of stage.querySelectorAll<HTMLImageElement>(".s00-showcase img[data-src]")) {
    if (!showcase.src) showcase.src = showcase.dataset.src ?? "";
  }
  const layers = Array.from(group.querySelectorAll<HTMLImageElement>("img"));
  if (layers.length === 0 || layers[0]?.src) return;
  let settled = 0;
  let failed = false;
  const settle = (ok: boolean, image: HTMLImageElement): void => {
    if (!ok) {
      failed = true;
      console.warn(`[s00-layers] 레이어 로드 실패, 단일 배경 유지: ${image.src.split("/").pop() ?? ""}`);
    }
    settled += 1;
    if (settled === layers.length && !failed) group.classList.add("is-ready");
  };
  for (const image of layers) {
    image.addEventListener("load", () => settle(true, image), { once: true });
    image.addEventListener("error", () => settle(false, image), { once: true });
    if (image.dataset.src) image.src = image.dataset.src;
  }
}
let mapPanStartScreen: Point | null = null;
let mapPanStartOffset: Point | null = null;
let mapPanButton: 0 | 1 | null = null;
let mapPanMoved = false;
let mapPanClickCell = -1;
const hanjiPaperUrl = `${import.meta.env.BASE_URL}assets/map/hanji-ink-field/hanji-paper-base.png`;
/**
 * 한지 바탕(2.0MB)은 전장에서만 보인다. 모듈 평가 시점에 붙이면 S00 텍스처와
 * 대역을 다투므로 `bootGame()` 이 1차 프리로드를 마친 뒤에 붙인다.
 */
function attachHanjiPaperBackground(): void {
  canvas.style.backgroundImage = `radial-gradient(circle at 50% 44%, rgba(255, 252, 235, 0.08), rgba(115, 78, 39, 0.09)), url("${hanjiPaperUrl}")`;
}
canvas.style.backgroundPosition = "center";
canvas.style.backgroundRepeat = "no-repeat";
canvas.style.backgroundSize = "cover";
canvas.dataset.hitFeedback = "ink-local";
canvas.dataset.formationTileColorMode = "element";
canvas.dataset.formationTilePalette = BOARD_FORMATIONS.map((formation) => `${formation.preferredWuxing}:${formation.color}`).join("|");
/**
 * 전투 스프라이트 예열은 `bootGame()` 의 2차 프리로드가 끝난 뒤로 옮겼다.
 * 여기서 바로 부르면 60여 장이 모듈 평가 즉시 나가 S00 텍스처를 굶긴다
 * (12Mbps 실측: s00-3d 8장이 15초 뒤에도 미도착). 모듈 캐시는 그때
 * `asset-loader` 가 받아 둔 원본을 그대로 집어 간다.
 * (병합 추가: 자물쇠·성어 인장·명패도 같은 2차 예열에 태운다)
 */
function warmCombatSpriteCaches(): void {
  preloadCombatFxSprites();
  preloadInkPathSprites();
  preloadEnemySprites();
  preloadFormationPlates();
  preloadLockSprites();
  preloadP0ComponentSprites();
  preloadPolishSprites();
  preloadIdiomSprites();
  preloadNameplateSprites();
}
wireHud1();
function syncDisplayModeControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-display-mode-option]").forEach((button) => {
    const selected = button.dataset.displayModeOption === ctx.displayMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}
function syncHoverGlyphControl(): void {
  const button = must<HTMLButtonElement>("#hover-glyph-toggle");
  button.classList.toggle("is-on", ctx.hoverGlyphLarge);
  button.setAttribute("aria-checked", String(ctx.hoverGlyphLarge));
  must<HTMLElement>("#hover-glyph-toggle i em").textContent = ctx.hoverGlyphLarge ? "ON" : "OFF";
}
function setHoverGlyphLarge(enabled: boolean): void {
  ctx.hoverGlyphLarge = enabled;
  try {
    window.localStorage.setItem(HOVER_GLYPH_STORAGE_KEY, String(enabled));
  } catch {
    // 사생활 보호 모드 등에서 저장이 막혀도 이번 세션 선택은 살린다.
  }
  syncHoverGlyphControl();
  showToast(enabled
    ? "팝오버 큰 한자 ON · 자령에 마우스를 올리면 한자를 크게 보여줍니다"
    : "팝오버 큰 한자 OFF · 팝오버는 기존 글줄만 표시합니다");
}
function syncAutoPlaceControl(): void {
  const button = must<HTMLButtonElement>("#auto-place-toggle");
  const enabled = ctx.engine.state.autoPlaceSummons;
  button.classList.toggle("is-on", enabled);
  button.setAttribute("aria-checked", String(enabled));
  must<HTMLElement>("#auto-place-toggle i em").textContent = enabled ? "ON" : "OFF";
}
function syncAudioControls(): void {
  const settings = sound.audioSettings;
  const bgmVolume = must<HTMLInputElement>("#bgm-volume");
  const sfxVolume = must<HTMLInputElement>("#sfx-volume");
  bgmVolume.value = String(Math.round(settings.bgmVolume * 100));
  sfxVolume.value = String(Math.round(settings.sfxVolume * 100));
  must<HTMLOutputElement>("#bgm-volume-output").value = `${bgmVolume.value}%`;
  must<HTMLOutputElement>("#sfx-volume-output").value = `${sfxVolume.value}%`;

  const bgmButton = must<HTMLButtonElement>("#bgm-mute-button");
  const sfxButton = must<HTMLButtonElement>("#sfx-mute-button");
  bgmButton.textContent = settings.bgmMuted ? "OFF" : "ON";
  sfxButton.textContent = settings.sfxMuted ? "OFF" : "ON";
  bgmButton.classList.toggle("is-on", !settings.bgmMuted);
  sfxButton.classList.toggle("is-on", !settings.sfxMuted);
  bgmButton.setAttribute("aria-checked", String(!settings.bgmMuted));
  sfxButton.setAttribute("aria-checked", String(!settings.sfxMuted));

  const masterButton = must<HTMLButtonElement>("#sound-button");
  masterButton.textContent = settings.masterMuted ? "×" : "♪";
  masterButton.setAttribute("aria-label", settings.masterMuted ? "전체 소리 켜기" : "전체 소리 끄기");
  masterButton.title = settings.masterMuted ? "전체 소리 켜기 (M)" : "전체 소리 끄기 (M)";
  shell.dataset.audioMasterMuted = String(settings.masterMuted);
  shell.dataset.bgmMuted = String(settings.bgmMuted);
  shell.dataset.sfxMuted = String(settings.sfxMuted);
}
function syncTitleModeSelection(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-game-mode-option]").forEach((button) => {
    const selected = button.dataset.gameModeOption === ctx.selectedGameMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  document.querySelectorAll<HTMLButtonElement>(".region-option").forEach((button) => {
    const region = button.dataset.region as RegionCode;
    button.disabled = false;
    button.setAttribute("aria-disabled", "false");
    const info = REGION_MENU_INFO[region];
    button.title = info.pool;
    button.setAttribute("aria-label", `${info.name} · ${info.pool}`);
    const selected = region === ctx.selectedRegion;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  must<HTMLElement>("#s00-summary-main").textContent = `${REGION_MENU_INFO[ctx.selectedRegion].name} · ${gameModeLabel(ctx.selectedGameMode)}`;
  const s13 = document.querySelector<HTMLDialogElement>("#s13-dialog");
  if (s13?.open) syncS13();
  must<HTMLElement>("#s00-start-sub").textContent = REGION_MENU_INFO[ctx.selectedRegion].pool;
  must<HTMLElement>("#title-lead").innerHTML = ctx.selectedGameMode === "casual"
    ? "획수가 희귀도를 정하고, 같은 오행 세 자령을 모두 바쳐 다음 별을 부릅니다.<br />무엇이 나올지는 열어 봐야 압니다 — 8성 대봉인까지 성장시키세요."
    : "운으로 글자를 부르고, 실제 구성 원리로 합성하라.<br />열 개의 장과 백 번의 망령 행렬을 넘어 대봉인을 완성하세요.";
  // 개발용 표현(심사·제출)은 dev 모드에서만 남긴다. 플레이어에게는
  // "무엇이 가장 잘 갖춰져 있는가"만 말한다.
  const devLabels = shell.dataset.devMode === "1";
  must<HTMLElement>("#title-note").textContent = ctx.selectedRegion === "KR"
    ? devLabels ? "심사 권장 · 현재 제출 기준 콘텐츠" : "가장 완성된 콘텐츠"
    : "미리 해보기 · 도감·현지화·밸런스 보강 중";
}
function setSelectedGameMode(mode: GameMode): void {
  sound.unlock();
  ctx.selectedGameMode = mode;
  syncTitleModeSelection();
  sound.playUiConfirm();
}
function setDisplayMode(mode: DisplayMode, announce = true): void {
  ctx.displayMode = mode;
  shell.dataset.displayMode = mode;
  saveDisplayMode(mode);
  syncDisplayModeControls();
  if (announce) {
    sound.playUiConfirm();
    showToast(mode === "spirit" ? "자령 모드 · 한자와 훈음을 머리 위에 표시" : "공부 모드 · 큰 한자와 읽기를 전장에 표시");
  }
}
function startRun(useNewSeed = false): void {
  const seed = useNewSeed ? createRunSeed() : seedInput.value.trim() || createRunSeed();
  seedInput.value = seed;
  ctx.engine = new GameEngine(seed, ctx.selectedRegion, ctx.selectedGameMode);
  shell.dataset.gameMode = ctx.selectedGameMode;
  ctx.mapSynthesisDepths = buildSynthesisDepths(ctx.engine.catalog.definitions.values());
  ctx.mapUncombinableStageOne = buildUncombinableStageOneChars(ctx.engine.catalog.definitions.values());
  ctx.engine.state.autoPlaceSummons = loadAutoPlaceSummons();
  ctx.engine.begin();
  ctx.previousPhase = "prep";
  ctx.manualPause = false;
  ctx.mapCameraGestures = 0;
  titleOverlay.classList.remove("modal-layer--visible");
  endOverlay.classList.remove("modal-layer--visible");
  sound.unlock();
  sound.playUiConfirm();
  recycleAll(projectiles, projectilePool, 48);
  recycleAll(floaters, floaterPool, 48);
  recycleAll(rings, ringPool, 32);
  recycleAll(abilityBursts, abilityBurstPool, 12);
  idiomRipples.length = 0;
  ctx.idiomFlash = null;
  // 새 런은 봉인이 0개라 키도 빈 문자열이 된다. 초기값과 겹치지 않게 표식으로 밀어 둔다.
  ctx.activeIdiomsRenderKey = "run-reset";
  ctx.projectileSpriteDrawTotal = 0;
  ctx.abilityZoneSpriteDrawTotal = 0;
  canvas.dataset.projectileSpriteDrawTotal = "0";
  canvas.dataset.abilityZoneSpriteDrawTotal = "0";
  towerAbilityPopups.clear();
  lastAbilityFxByTower.clear();
  ctx.lastGlobalAbilityFxAt = -10;
  combatFeed.replaceChildren();
  feedCooldowns.clear();
  ctx.comboCount = 0;
  comboMeter.classList.remove("combo-meter--visible");
  resetIdiomResult();
  hideSummonReveal();
  closeCompositionDrawer();
  ctx.concentrationTargetId = null;
  ctx.concentrationPayment = "essence";
  ctx.growthElement = "木";
  dismantleSelection.clear();
  // R19: 보관고 시야·바구니는 한 판짜리다. 새 런은 전체 보기에서 시작한다.
  ctx.runInventoryElementFilter = null;
  ctx.runInventoryGradeFilter = null;
  ctx.runInventoryBulkMode = false;
  runInventoryBulkSelection.clear();
  ctx.casualFusionSelection = [];
  ctx.pendingCasualFusion = null;
  if (casualFusionConfirmDialog.open) casualFusionConfirmDialog.close();
  setPanelTab("shop");
  ctx.formationUnlockHintShown = false;
  startCoach();
  window.clearTimeout(ctx.comboTimer);
  ctx.evolutionRenderKey = "";
  ctx.goalRenderKey = "";
  ctx.selectedRenderKey = "";
  ctx.runInventoryRenderKey = "";
  ctx.idiomRenderKey = "";
  ctx.elementUpgradeRenderKey = "";
  ctx.concentrationRenderKey = "";
  ctx.growthRenderKey = "";
  ctx.towerDragPointerId = null;
  ctx.towerDragTowerId = null;
  ctx.towerDragStart = null;
  ctx.towerDragMoved = false;
  showToast(`${ctx.engine.catalog.title} · ${gameModeLabel(ctx.engine.state.mode)}을 시작합니다.`);
  syncPanel();
}
function hideSummonReveal(): void {
  window.clearTimeout(ctx.summonRevealTimer);
  window.clearTimeout(ctx.fusionVortexTimer);
  summonReveal.classList.remove("is-active", "is-batch", "is-fusion");
  fusionVortex.classList.remove("is-active");
  summonReveal.setAttribute("aria-hidden", "true");
}
/**
 * v5 팩의 `fusion-vortex-v1.png` 를 공개 순간에 겹친다. 명세의 100–420ms 구간을
 * CSS 애니메이션으로 맡기고(prefers-reduced-motion 이면 회전 없이 페이드),
 * 파일이 없으면 클래스만 붙었다 떨어지므로 기존 소환 광채로 자연히 폴백된다.
 */
function playFusionVortex(wuxing: Wuxing): void {
  window.clearTimeout(ctx.fusionVortexTimer);
  fusionVortex.style.setProperty("--vortex-tint", ELEMENT_STYLES[wuxing].color);
  fusionVortex.classList.remove("is-active");
  void fusionVortex.offsetWidth;
  fusionVortex.classList.add("is-active");
  ctx.fusionVortexTimer = window.setTimeout(() => fusionVortex.classList.remove("is-active"), 520);
}
/**
 * 3합 획득도 뽑기와 같은 공개 카드로 보여 준다. 무작위 결과라 "무엇이 나왔는지"가
 * 토스트 한 줄로 흘러가면 안 된다.
 */
function showCasualFusionReveal(events: Array<Extract<GameEvent, { type: "casualFuse" }>>): void {
  if (events.length === 0) return;
  window.clearTimeout(ctx.summonRevealTimer);
  const first = events[0] as Extract<GameEvent, { type: "casualFuse" }>;
  const newCount = events.filter((event) => event.newDiscovery).length;
  const boardCount = events.filter((event) => event.tower.cell >= 0).length;
  const placementLabel = boardCount === 0
    ? "런 인벤토리 보관"
    : boardCount === events.length
      ? "소모 자리 자동 배치"
      : `전장 ${boardCount} · 인벤 ${events.length - boardCount}`;
  must<HTMLElement>("#summon-reveal-kicker").textContent = "3합 승급 결과";
  must<HTMLElement>("#summon-reveal-title").textContent = events.length > 1
    ? `${events.length}회 승급 결과`
    : `${first.tower.char} 자령 획득`;
  const fallbackNote = first.starFallback
    ? `<strong>${first.fromStar + 1}★ 글자가 없어 ${first.toStar}★에서 뽑음</strong>`
    : first.rosterFallback
      ? `<strong>소환 풀에 없어 지역 로스터에서 보충</strong>`
      : "";
  must<HTMLElement>("#summon-reveal-summary").innerHTML = `${fallbackNote}<b>첫 발견 ${newCount}</b><span>소모 ${events.length * 3}기</span><span>${first.tower.wuxing}행 ${first.fromStar}★×3</span><em>${placementLabel}</em>`;
  must<HTMLElement>("#summon-reveal-list").innerHTML = events.map((event, index) => {
    const tower = event.tower;
    const style = ELEMENT_STYLES[tower.wuxing];
    const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
    const learning = learningInfo(ctx.engine.state.region, tower.char);
    const star = casualStarOf(tower);
    return `<article class="summon-result-card is-fusion ${event.newDiscovery ? "is-new" : "is-helpful"}" style="--summon:${style.color};--summon-star:${CASUAL_STAR_COLORS[star]};--summon-delay:${index * 45}ms">
      <span class="summon-result-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <strong>${escapeHtml(tower.char)}</strong>
      <b>${escapeHtml(learning.short)}</b>
      <small>${style.name}행 · ${star}★ ${CASUAL_STAR_NAMES[star]} · ${casualStrokeCount(tower.char) ?? "?"}획</small>
      <div><em>${event.newDiscovery ? "NEW" : "무작위 획득"}</em><mark>${escapeHtml(event.consumed.map((consumed) => consumed.char).join("·"))} 소모</mark></div>
    </article>`;
  }).join("");
  summonReveal.classList.toggle("is-batch", events.length > 1);
  summonReveal.classList.add("is-fusion");
  summonReveal.classList.remove("is-active");
  void summonReveal.offsetWidth;
  summonReveal.classList.add("is-active");
  summonReveal.setAttribute("aria-hidden", "false");
  playFusionVortex(first.tower.wuxing);
  if (events.length === 1) ctx.summonRevealTimer = window.setTimeout(hideSummonReveal, 3800);
}
function showSummonReveal(events: Array<Extract<GameEvent, { type: "summon" }>>): void {
  if (events.length === 0) return;
  // 코치가 전장 조작을 안내하는 동안에는 카드가 스포트라이트를 덮고
  // wheel 을 삼키므로 아예 띄우지 않는다.
  if (coachIsPointingAtBoard()) {
    hideSummonReveal();
    return;
  }
  window.clearTimeout(ctx.summonRevealTimer);
  window.clearTimeout(ctx.fusionVortexTimer);
  fusionVortex.classList.remove("is-active");
  summonReveal.classList.remove("is-fusion");
  must<HTMLElement>("#summon-reveal-kicker").textContent = "소환 결과";
  const newCount = events.filter((event) => event.newDiscovery).length;
  const helpfulCount = events.filter((event) => event.helpful).length;
  const concentrationCount = events.filter((event) => event.utility === "concentration").length;
  const storedCount = events.filter((event) => event.stored).length;
  const placementLabel = storedCount === 0
    ? "전장 자동 배치"
    : storedCount === events.length
      ? "런 인벤토리 보관"
      : `전장 ${events.length - storedCount} · 인벤 ${storedCount}`;
  must<HTMLElement>("#summon-reveal-title").textContent = events.length > 1 ? `${events.length}연 소환 결과` : `${events[0]?.tower.char ?? "?"} 자령 출현`;
  const firstSummon = ctx.engine.state.summonCount === events.length && ctx.engine.state.startingFormationIndex !== null;
  const startingFormation = firstSummon ? BOARD_FORMATIONS[ctx.engine.state.startingFormationIndex ?? -1] : undefined;
  const openingResult = firstSummon && startingFormation
    ? `<strong>${events[0]?.tower.wuxing ?? "?"} 자령 출현 → ${startingFormation.label} 무료 개방</strong>`
    : "";
  must<HTMLElement>("#summon-reveal-summary").innerHTML = `${openingResult}<b>새 발견 ${newCount}</b><span>${ctx.engine.state.mode === "casual" ? "목표·성어" : "합성 재료"} ${helpfulCount}</span><span>중복 ${concentrationCount}</span><em>${placementLabel}</em>`;
  must<HTMLElement>("#summon-reveal-list").innerHTML = events.map((event, index) => {
    const tower = event.tower;
    const definition = definitionForTower(ctx.engine.catalog, tower.definitionId);
    const style = ELEMENT_STYLES[tower.wuxing];
    const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
    const learning = learningInfo(ctx.engine.state.region, tower.char);
    const helpfulLabel = event.helpfulReason === "both" ? "목표·성어" : event.helpfulReason === "goal" ? "목표 재료" : event.helpfulReason === "idiom" ? "성어 재료" : "";
    const utilityLabel = event.utility === "new" ? "NEW" : event.utility === "synthesis" ? ctx.engine.state.mode === "casual" ? "목표" : "합성" : event.utility === "concentration" ? "중복" : "교체 후보";
    const star = casualStarOf(tower);
    return `<article class="summon-result-card ${event.newDiscovery ? "is-new" : ""} ${event.helpful ? "is-helpful" : ""}" style="--summon:${style.color};--summon-star:${CASUAL_STAR_COLORS[star]};--summon-delay:${index * 45}ms">
      <span class="summon-result-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <strong>${tower.char}</strong>
      <b>${escapeHtml(learning.short)}</b>
      <small>${style.name}행 · ${ctx.engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]} · ${casualStrokeCount(tower.char) ?? "?"}획` : escapeHtml(definition.combat.roleLabel)}</small>
      <div><em>${utilityLabel}</em>${helpfulLabel ? `<mark>${helpfulLabel}</mark>` : ""}</div>
    </article>`;
  }).join("");
  summonReveal.classList.toggle("is-batch", events.length > 1);
  summonReveal.classList.remove("is-active");
  void summonReveal.offsetWidth;
  summonReveal.classList.add("is-active");
  summonReveal.setAttribute("aria-hidden", "false");
  if (events.length === 1) ctx.summonRevealTimer = window.setTimeout(hideSummonReveal, 3800);
}
function processEvent(event: GameEvent): void {
  sound.handle(event);
  switch (event.type) {
    case "shot":
      pushPooled(projectiles, projectilePool, takeProjectile(event), 48);
      break;
    case "damage":
      if (event.critical || event.weakness || event.amount >= 50) {
        const prefix = event.critical ? "치명 " : event.weakness ? "약점 " : "";
        pushPooled(floaters, floaterPool, takeFloater(event.at, prefix + String(Math.round(event.amount)), event.critical ? "#ffe06e" : event.weakness ? "#8ff5c6" : "#f6f0ff", 0.64, event.critical), 48);
      }
      break;
    case "kill":
      pushPooled(floaters, floaterPool, takeFloater(event.at, "+" + String(event.reward), "#ffd86d", 0.72, false), 48);
      // 처치 순간에 먹이 튀는 고리를 남겨 "정리됐다"가 화면에서 읽히게 한다.
      pushPooled(rings, ringPool, takeRing(event.at, "#241d16", 0.42), 32);
      registerKillCombo();
      break;
    case "interest":
      showToast("은행 이자 +" + String(event.amount) + "엽전");
      addCombatFeed("財", "은행 이자", `보유 ${event.gold - event.amount}엽전 · 20엽전당 1엽전 · 최대 20`, "#f3d47a");
      break;
    case "summon":
      if (!event.stored) pushPooled(rings, ringPool, takeRing(event.at, ELEMENT_STYLES[event.tower.wuxing].color, 0.52), 32);
      if (event.helpful && !event.stored) {
        const label = event.helpfulReason === "both" ? "목표·성어 +1" : event.helpfulReason === "idiom" ? "성어 +1" : "목표 +1";
        pushPooled(floaters, floaterPool, takeFloater(event.at, label, event.helpfulReason === "idiom" ? "#c9a8ff" : "#ffd979", 0.68, false), 48);
      }
      break;
    case "dismantle":
      addCombatFeed(event.wuxing, `${event.tower.char} 문기 환원`, `${event.wuxing} 문기 +${event.essence}`, ELEMENT_STYLES[event.wuxing].color);
      break;
    case "concentrate":
      if (event.tower.cell >= 0) {
        const at = BOARD_CELLS[event.tower.cell] as Point;
        pushPooled(rings, ringPool, takeRing(at, ELEMENT_STYLES[event.tower.wuxing].color, 0.9), 32);
        pushPooled(floaters, floaterPool, takeFloater(at, `濃 ${event.level}/3`, ELEMENT_STYLES[event.tower.wuxing].color, 1.05, true), 48);
      }
      addCombatFeed("濃", `${event.tower.char} ${concentrationPathLabel(event.path)}`, event.usedDuplicate ? "동일 한자 중복 소비" : `${event.tower.wuxing} 문기 ${event.essenceCost} 소비`, ELEMENT_STYLES[event.tower.wuxing].color);
      break;
    case "statUpgrade": {
      const meta = UPGRADE_STAT_META[event.stat];
      const style = event.wuxing ? ELEMENT_STYLES[event.wuxing] : null;
      const glyph = event.wuxing ?? meta.glyph;
      const title = event.wuxing ? `${style?.name ?? event.wuxing}행 ${meta.label} Lv.${event.level}` : `공용 ${meta.label} Lv.${event.level}`;
      const currency = event.scope === "global" ? `${event.cost}엽전 투자` : `${event.wuxing} 문기 ${event.cost} 투자`;
      addCombatFeed(glyph, title, `${formatStatBonus(event.stat, event.bonus)} · ${currency}`, style?.color ?? "#d5c4ff");
      break;
    }
    case "evolve":
      pushPooled(rings, ringPool, takeRing(event.at, STAGE_COLORS[event.tower.stage], 0.9), 32);
      pushPooled(floaters, floaterPool, takeFloater(event.at, event.parents.join("+") + "→" + event.tower.char, STAGE_COLORS[event.tower.stage], 1.05, true), 48);
      {
        const evolved = definitionForTower(ctx.engine.catalog, event.tower.definitionId);
        const lineage = evolved.combat.abilities.lineage;
        const detail = evolved.combat.abilities.role.name + (lineage ? " · " + lineage.name : "");
        addCombatFeed(event.tower.char, "새 능력 획득", detail, STAGE_COLORS[event.tower.stage]);
      }
      break;
    case "casualFuse": {
      const color = CASUAL_STAR_COLORS[event.toStar];
      pushPooled(rings, ringPool, takeRing(event.at, color, 1.05), 32);
      pushPooled(floaters, floaterPool, takeFloater(event.at, `${event.fromStar}★×3→${event.toStar}★`, color, 1.15, true), 48);
      // 고리는 "결과" 별 등급으로 고른다. 소모한 자령 등급이 아니다.
      pushRasterBurst(starAscentRingImage(clampStarLevel(event.toStar)), event.at, STAR_RING_SIZE);
      addCombatFeed(event.tower.char, `${event.tower.wuxing}행 3합 획득`, `${event.consumed.map((tower) => tower.char).join("+")} 소모 · ${event.toStar}★ ${event.newDiscovery ? "첫 발견" : "무작위 획득"}`, color);
      break;
    }
    case "ability": {
      const towerGap = ctx.engine.state.elapsed - (lastAbilityFxByTower.get(event.towerId) ?? -10);
      const globalGap = ctx.engine.state.elapsed - ctx.lastGlobalAbilityFxAt;
      if (!event.persistent && towerGap >= 0.75 && globalGap >= 0.12) {
        pushPooled(abilityBursts, abilityBurstPool, takeAbilityBurst(event), 12);
        lastAbilityFxByTower.set(event.towerId, ctx.engine.state.elapsed);
        ctx.lastGlobalAbilityFxAt = ctx.engine.state.elapsed;
      }
      const detail = event.effect;
      showTowerAbilityPopup(event.towerId, event.glyph, event.name, event.color);
      addCombatFeed(event.glyph, event.name, detail, event.color);
      break;
    }
    case "goal":
      showToast(event.char + " 봉인 목표 완성 · +" + String(event.reward) + "엽전");
      break;
    case "idiom": {
      const points = event.cells.map((cell) => BOARD_CELLS[cell] as Point);
      const center = points.reduce((total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }), { x: 0, y: 0 });
      if (event.rejoined) {
        // 재발동은 첫 봉인보다 가볍게 — 파문·인장·대형 플래시 없이 발광과 스택 복귀만.
        ctx.idiomRenderKey = "";
        showIdiomResult(event.reading, event.meaning, event.bonus, event.color, true);
        addCombatFeed("四", event.reading + " 재봉인", event.bonus, event.color);
        showToast(`『${event.reading}』 봉인 재발동 — 줄이 다시 섰습니다`);
        break;
      }
      for (const point of points) pushPooled(rings, ringPool, takeRing(point, event.color, 1.05), 32);
      // 코덱스 봉인 인장(래스터) + 네 칸 파문 + 4자 플래시를 함께 띄운다.
      pushRasterBurst(idiomCompletionSealImage(), center, IDIOM_SEAL_SIZE);
      // 봉인된 네 칸에서 1→4 순서로 성어 색 파문이 퍼지고, 그 위에 4자가 크게 뜬다.
      idiomRipples.length = 0;
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index] as Point;
        idiomRipples.push({
          at: point,
          color: event.color,
          age: 0,
          delay: reducedMotion ? 0 : index * 0.09,
          duration: reducedMotion ? 0.34 : 0.66
        });
      }
      // 대형 플래시가 `이심전심 · 봉인` 을 이미 크게 말한다. 같은 자리에 뜨던
      // `이심전심 자동 봉인!` 플로터까지 겹치면 배너·플래시·플로터가 한 문장을
      // 세 번 반복해 정작 어느 칸이 봉인됐는지가 안 보인다.
      ctx.idiomFlash = { chars: event.chars, reading: event.reading, color: event.color, at: center, age: 0, duration: reducedMotion ? 0.6 : 1.2 };
      showIdiomResult(event.reading, event.meaning, event.bonus, event.color);
      addCombatFeed("四", event.reading, event.bonus, event.color);
      ctx.idiomRenderKey = "";
      if (ctx.engine.state.idiomSeals.length === 1) firstSealCelebration(event.reading);
      break;
    }
    case "idiomBroken": {
      // 유지형 규칙의 반대편. 발광·스택은 활성 목록을 보고 알아서 꺼지므로
      // 여기서는 "왜 꺼졌는지"만 말한다.
      showToast(`『${event.reading}』 봉인 해제 — 줄이 흩어졌습니다`);
      showIdiomBrokenResult(event.reading, event.bonus);
      addCombatFeed("四", event.reading + " 해제", "줄이 흩어졌습니다", "#9d8f78");
      ctx.idiomRenderKey = "";
      break;
    }
    case "wave":
      bossBanner.textContent = event.boss
        ? "⚠ 우두머리 " + String(event.wave) + " · 약점 " + event.weakness + " ⚠"
        : "웨이브 " + String(event.wave) + " · 약점 " + event.weakness;
      bossBanner.classList.toggle("boss-banner--boss", event.boss);
      bossBanner.classList.remove("boss-banner--idiom");
      showWaveBanner();
      break;
    case "phase":
      break;
  }
}
function showEndScreen(phase: "victory" | "defeat"): void {
  // 강화·농축 프레임을 연 채 패배하면 종료 화면 뒤에 프레임이 남아,
  // 재도전 직후 전장이 어두운 유리 아래 갇힌다.
  setFocusFrame(null);
  const state = ctx.engine.state;
  const victory = phase === "victory";
  // 최고 기록은 이번 판을 저장하기 "전"에 읽어야 갱신 여부를 알 수 있다.
  const previousBest = loadBestWave();
  const renewed = state.wave > previousBest;
  const bestWave = Math.max(previousBest, state.wave);
  must<HTMLElement>("#end-kicker").textContent = victory ? "봉인 완수" : "수비 실패";
  must<HTMLElement>("#end-heading").textContent = victory ? "천자문 대봉인 완성" : "수비에 실패했습니다";
  must<HTMLElement>("#end-message").textContent = state.lastMessage;
  must<HTMLElement>("#end-stats").innerHTML = `
    <div><span>진법</span><b>${gameModeLabel(state.mode)}</b></div>
    <div><span>도달 웨이브</span><b>${state.wave} / ${state.maxWaves}</b></div>
    <div${renewed ? ' class="is-record"' : ""}><span>최고 기록</span><b>${bestWave}웨이브${renewed ? "<em>갱신!</em>" : ""}</b></div>
    <div><span>처치한 적</span><b>${state.killCount}</b></div>
    <div><span>${state.mode === "casual" ? "3체 조합" : "한자 합성"}</span><b>${state.mode === "casual" ? state.casualFusionCount : state.evolutionCount}</b></div>
    <div><span>목표 완성</span><b>${state.goalsCompleted.length}</b></div>
    <div><span>사자성어 봉인</span><b>${state.idiomSeals.length} / ${ctx.engine.idioms().length}</b></div>
    <div><span>은행 이자</span><b>${state.interestEarned}엽전</b></div>
    <div><span>능력 강화</span><b>${totalGlobalUpgradeLevels() + totalElementUpgradeLevels()}단계</b></div>
    <div><span>발견 한자</span><b>${state.discoveredChars.length}</b></div>
    <div><span>경과 시간</span><b>${formatTime(state.elapsed)}</b></div>
  `;
  endOverlay.classList.add("modal-layer--visible");
  saveBestWave(state.wave);
}
function bestWaveKey(): string {
  return `hanzi-random-defense-best-${ctx.engine.state.mode}-${ctx.engine.state.region}`;
}
/** 저장만 하고 아무도 읽지 않던 값을 종료 화면이 드디어 읽는다. */
function loadBestWave(): number {
  try {
    return Number(window.localStorage.getItem(bestWaveKey()) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function saveBestWave(wave: number): void {
  try {
    const key = bestWaveKey();
    const previous = Number(window.localStorage.getItem(key) ?? 0);
    if (wave > previous) window.localStorage.setItem(key, String(wave));
  } catch {
    // 로컬 저장이 막혀도 현재 런은 정상 진행됩니다.
  }
}
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
function towerAtCell(cell: number): Tower | undefined {
  return ctx.engine.state.towers.find((tower) => tower.cell === cell);
}
function canvasScreenPoint(event: MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * WORLD_WIDTH / rect.width, y: (event.clientY - rect.top) * WORLD_HEIGHT / rect.height };
}
function canvasPoint(event: PointerEvent): Point {
  const point = canvasScreenPoint(event);
  return { x: (point.x - ctx.mapOffset.x) / ctx.mapZoom, y: (point.y - ctx.mapOffset.y) / ctx.mapZoom };
}
function cellAtPoint(point: Point): number {
  return BOARD_CELLS.findIndex((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 21);
}
/**
 * 잠긴 진 중앙 자물쇠의 히트 영역.
 *
 * 자물쇠는 판 정중앙에 놓이는데 그 지점은 어느 칸의 반경(21px)에도 들지 않는다.
 * 그래서 칸 판정과 별개로 중앙 원을 따로 잡는다. 판 전체를 히트 영역으로 두면
 * 여백을 스칠 때마다 확인 창이 떠 오히려 방해가 되므로 자물쇠 크기(40px)에
 * 맞춘 반경만 받는다.
 */
const LOCK_HIT_RADIUS = 34;
function lockedFormationAtPoint(point: Point): number | null {
  const index = BOARD_FORMATIONS.findIndex((formation) =>
    Math.hypot(formation.center.x - point.x, formation.center.y - point.y) <= LOCK_HIT_RADIUS);
  if (index < 0 || ctx.engine.isFormationUnlocked(index)) return null;
  return index;
}
function beginMapPan(event: PointerEvent, button: 0 | 1, clickCell = -1): void {
  ctx.mapPanPointerId = event.pointerId;
  mapPanStartScreen = canvasScreenPoint(event);
  mapPanStartOffset = { ...ctx.mapOffset };
  mapPanButton = button;
  mapPanMoved = button === 1;
  mapPanClickCell = clickCell;
  if (button === 1) canvas.classList.add("is-panning");
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Panning still works while the pointer remains over the canvas.
  }
}
canvas.addEventListener("pointerdown", (event) => {
  sound.unlock();
  if (ctx.engine.state.phase === "title" || ctx.engine.state.phase === "victory" || ctx.engine.state.phase === "defeat") return;
  if (event.button === 1) {
    event.preventDefault();
    beginMapPan(event, 1);
    return;
  }
  if (event.button !== 0) return;
  const point = canvasPoint(event);
  const cell = cellAtPoint(point);
  const occupant = cell >= 0 ? towerAtCell(cell) : undefined;
  event.preventDefault();
  if (occupant) {
    setPanelTab("unit");
    ctx.engine.selectTower(occupant.id);
    ctx.towerDragPointerId = event.pointerId;
    ctx.towerDragTowerId = occupant.id;
    ctx.towerDragStart = point;
    ctx.towerDragMoved = false;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional; click selection still works without it.
    }
    ctx.evolutionRenderKey = "";
    ctx.selectedRenderKey = "";
    syncPanel();
  } else {
    // Empty board space keeps its ordinary click action, but becomes camera
    // panning once the pointer moves beyond the drag threshold.
    beginMapPan(event, 0, cell);
  }
});
canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId === ctx.mapPanPointerId && mapPanStartScreen && mapPanStartOffset) {
    const point = canvasScreenPoint(event);
    const distance = Math.hypot(point.x - mapPanStartScreen.x, point.y - mapPanStartScreen.y);
    if (!mapPanMoved && distance >= 7) {
      mapPanMoved = true;
      ctx.mapCameraGestures += 1;
      canvas.classList.add("is-panning");
    }
    if (!mapPanMoved) return;
    ctx.mapOffset = {
      x: mapPanStartOffset.x + point.x - mapPanStartScreen.x,
      y: mapPanStartOffset.y + point.y - mapPanStartScreen.y
    };
    constrainMapCamera();
    return;
  }
  const hoverPoint = canvasPoint(event);
  const hoverCell = cellAtPoint(hoverPoint);
  ctx.hoveredTowerId = hoverCell >= 0 ? towerAtCell(hoverCell)?.id ?? null : null;
  canvas.dataset.hoveredTowerId = ctx.hoveredTowerId === null ? "" : String(ctx.hoveredTowerId);
  // 자물쇠 위에서는 확대하고 커서를 손가락으로 바꿔 "눌린다"를 알린다.
  // 잠긴 칸도 같은 팝업으로 이어지므로 커서는 같이 바꾼다.
  const runActive = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
  ctx.hoveredLockFormation = runActive ? lockedFormationAtPoint(hoverPoint) : null;
  const overLockedCell = runActive && hoverCell >= 0 && !ctx.engine.isCellUnlocked(hoverCell);
  canvas.dataset.lockHover = ctx.hoveredLockFormation !== null || overLockedCell ? "1" : "";
  if (event.pointerId !== ctx.towerDragPointerId || !ctx.towerDragStart) return;
  const point = canvasPoint(event);
  if (Math.hypot(point.x - ctx.towerDragStart.x, point.y - ctx.towerDragStart.y) >= 10) ctx.towerDragMoved = true;
});
function finishTowerDrag(event: PointerEvent, applyMove: boolean): void {
  if (event.pointerId !== ctx.towerDragPointerId) return;
  try {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  } catch {
    // The selected tower remains usable if capture was unavailable.
  }
  const draggedTowerId = ctx.towerDragTowerId;
  const moved = ctx.towerDragMoved;
  ctx.towerDragPointerId = null;
  ctx.towerDragTowerId = null;
  ctx.towerDragStart = null;
  ctx.towerDragMoved = false;
  if (!applyMove || !moved || draggedTowerId === null) return;
  const targetCell = cellAtPoint(canvasPoint(event));
  if (targetCell < 0) return;
  ctx.engine.selectTower(draggedTowerId);
  sound.expectPlacement();
  handleAction(ctx.engine.relocateSelectedToCell(targetCell));
}
function finishMapPan(event: PointerEvent, applyClick: boolean): boolean {
  if (event.pointerId !== ctx.mapPanPointerId) return false;
  try {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  } catch {
    // The camera remains at the last valid offset if capture was unavailable.
  }
  const button = mapPanButton;
  const moved = mapPanMoved;
  const clickCell = mapPanClickCell;
  ctx.mapPanPointerId = null;
  mapPanStartScreen = null;
  mapPanStartOffset = null;
  mapPanButton = null;
  mapPanMoved = false;
  mapPanClickCell = -1;
  canvas.classList.remove("is-panning");
  if (applyClick && button === 0 && !moved) {
    // 잠긴 칸과 판 중앙 자물쇠는 같은 확인 팝업으로 모은다. 예전에는 클릭 즉시
    // 엽전이 빠져나가 무슨 일이 벌어졌는지 알 수 없었다.
    if (clickCell >= 0) {
      if (!ctx.engine.isCellUnlocked(clickCell)) openFormationUnlockDialog(Math.floor(clickCell / CELLS_PER_FORMATION));
      else { sound.expectPlacement(); handleAction(ctx.engine.moveSelectedToCell(clickCell)); }
    } else {
      const lockedFormation = lockedFormationAtPoint(canvasPoint(event));
      if (lockedFormation !== null) {
        openFormationUnlockDialog(lockedFormation);
      } else {
        ctx.engine.selectTower(null);
        ctx.evolutionRenderKey = "";
        ctx.selectedRenderKey = "";
        syncPanel();
      }
    }
  }
  return true;
}
canvas.addEventListener("pointerup", (event) => {
  if (!finishMapPan(event, true)) finishTowerDrag(event, true);
});
canvas.addEventListener("pointerleave", () => {
  if (ctx.mapPanPointerId !== null || ctx.towerDragPointerId !== null) return;
  ctx.hoveredTowerId = null;
  canvas.dataset.hoveredTowerId = "";
  ctx.hoveredLockFormation = null;
  canvas.dataset.lockHover = "";
});
canvas.addEventListener("pointercancel", (event) => {
  if (!finishMapPan(event, false)) finishTowerDrag(event, false);
});
// 게임 화면에서는 텍스트 드래그 선택·이미지 끌기·우클릭 메뉴를 막는다.
// 입력창은 예외로 두어 시드 입력과 검색은 그대로 쓸 수 있다.
shell.addEventListener("contextmenu", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea")) return;
  event.preventDefault();
});
shell.addEventListener("dragstart", (event) => event.preventDefault());
document.addEventListener("selectstart", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea")) return;
  event.preventDefault();
});
canvas.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const anchor = canvasScreenPoint(event);
  const before = ctx.mapZoom;
  setMapZoom(ctx.mapZoom * Math.exp(-event.deltaY * 0.0012), anchor);
  if (ctx.mapZoom !== before) ctx.mapCameraGestures += 1;
}, { passive: false });
must<HTMLButtonElement>("#map-zoom-reset").addEventListener("click", resetMapCamera);
must<HTMLButtonElement>("#hanja-emphasis-toggle").addEventListener("click", toggleHanjaEmphasis);
// 발동 성어 배지를 누르면 그 성어를 이룬 네 칸으로 카메라가 간다.
must<HTMLElement>("#active-idioms").addEventListener("click", (event) => {
  const idiomId = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-active-idiom]")?.dataset.activeIdiom;
  if (!idiomId) return;
  const seal = ctx.engine.state.idiomSeals.find((candidate) => candidate.idiomId === idiomId);
  if (seal) focusMapOnCells(seal.cells);
});
must<HTMLButtonElement>("#speed-button").addEventListener("click", cycleGameSpeed);
const REGION_MENU_INFO: Record<RegionCode, { name: string; pool: string }> = {
  KR: { name: "한국", pool: "한국 천자문 1,000" },
  JP: { name: "일본", pool: "일본 상용한자 2,136" },
  CN: { name: "중국", pool: "중국 규범한자 3,500" }
};
const p00Dialog = must<HTMLDialogElement>("#p00-dialog");
function openP00(region: RegionCode): void {
  ctx.pendingRegion = region;
  const info = REGION_MENU_INFO[region];
  must<HTMLElement>("#p00-title").textContent = `${info.name} 한자 체계`;
  must<HTMLButtonElement>("#p00-continue").textContent = `${info.name}으로 계속`;
  p00Dialog.showModal();
  must<HTMLButtonElement>("#p00-return").focus();
}
function closeP00(confirm: boolean): void {
  if (confirm && ctx.pendingRegion) ctx.selectedRegion = ctx.pendingRegion;
  ctx.pendingRegion = null;
  if (p00Dialog.open) p00Dialog.close();
  syncTitleModeSelection();
}
document.querySelectorAll<HTMLButtonElement>(".region-option").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    const region = button.dataset.region as RegionCode;
    // JP/CN 은 pending 만 두고 P00 확인을 거친다. 취소하면 기존 선택이 유지된다.
    if (region === "KR") {
      ctx.selectedRegion = "KR";
      syncTitleModeSelection();
      return;
    }
    openP00(region);
  });
});
must<HTMLButtonElement>("#p00-return").addEventListener("click", () => closeP00(false));
must<HTMLButtonElement>("#p00-continue").addEventListener("click", () => closeP00(true));
p00Dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeP00(false);
});
p00Dialog.addEventListener("click", (event) => {
  if (event.target === p00Dialog) closeP00(false);
});
// ── S13 맞춤 진법: 한자 범위 x 읽기·표기 x 진법 규칙을 한 화면에서 ──
// 세 번째 엔진 모드가 아니라 기존 설정들의 진입점이다(코덱스 스펙).
// JP/CN 범위 선택도 P00 확인을 우회하지 않는다.
/* ── 오행진 해금 확인 ─────────────────────────────────────────
   예전에는 잠긴 칸을 누르는 즉시 엽전이 빠져나갔다. 실수로 눌러도 되돌릴 수
   없었고, 무엇을 얼마에 샀는지도 남지 않았다. 전장 자물쇠와 상점 5칸 모두
   이 팝업 한 곳으로 모아 값과 결과를 먼저 보여 준다.
   ──────────────────────────────────────────────────────────── */
const formationUnlockDialog = must<HTMLDialogElement>("#formation-unlock-dialog");
let pendingFormationUnlock: number | null = null;
function openFormationUnlockDialog(formationIndex: number): void {
  const formation = BOARD_FORMATIONS[formationIndex];
  if (!formation || ctx.engine.isFormationUnlocked(formationIndex)) return;
  pendingFormationUnlock = formationIndex;
  const cost = ctx.engine.nextFormationUnlockCost();
  const notStarted = ctx.engine.state.startingFormationIndex === null;
  const shortfall = cost === null ? 0 : Math.max(0, cost - ctx.engine.state.gold);
  must<HTMLElement>("#formation-unlock-glyph").textContent = formation.preferredWuxing;
  must<HTMLElement>("#formation-unlock-glyph").style.setProperty("--formation", formation.color);
  must<HTMLElement>("#formation-unlock-label").textContent = `${formation.label} 해금`;
  must<HTMLElement>("#formation-unlock-body").textContent = cost === null
    ? "모든 오행진을 이미 개방했습니다."
    : `${cost}엽전이 필요합니다. 해금하면 ${formation.label}의 4×4 칸이 열립니다.`;
  const reason = must<HTMLElement>("#formation-unlock-reason");
  const blocked = notStarted || cost === null || shortfall > 0;
  reason.hidden = !blocked;
  reason.textContent = notStarted
    ? "첫 자령을 소환하면 같은 오행진이 무료로 먼저 열립니다."
    : cost === null
      ? "더 살 진이 없습니다."
      : `엽전 ${shortfall} 부족`;
  must<HTMLElement>("#formation-unlock-price").textContent = String(cost ?? 0);
  must<HTMLButtonElement>("#formation-unlock-confirm").disabled = blocked;
  if (!formationUnlockDialog.open) formationUnlockDialog.showModal();
}
function closeFormationUnlockDialog(): void {
  pendingFormationUnlock = null;
  if (formationUnlockDialog.open) formationUnlockDialog.close();
}
must<HTMLButtonElement>("#formation-unlock-confirm").addEventListener("click", () => {
  if (pendingFormationUnlock === null) return;
  const formationIndex = pendingFormationUnlock;
  sound.unlock();
  const result = ctx.engine.unlockFormation(formationIndex);
  closeFormationUnlockDialog();
  handleAction(result);
  // 성공하면 기존 개방 링 연출을 그대로 재사용해 어디가 열렸는지 눈으로 잇는다.
  if (result.ok) focusMapOnFormation(formationIndex);
});
must<HTMLButtonElement>("#formation-unlock-close").addEventListener("click", closeFormationUnlockDialog);
formationUnlockDialog.addEventListener("click", (event) => {
  if (event.target === formationUnlockDialog) closeFormationUnlockDialog();
});
formationUnlockDialog.addEventListener("close", () => { pendingFormationUnlock = null; });
const s13Dialog = must<HTMLDialogElement>("#s13-dialog");
function syncS13(): void {
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-region]").forEach((button) => {
    const region = button.dataset.s13Region as RegionCode;
    button.disabled = false;
    button.classList.toggle("is-selected", region === ctx.selectedRegion);
    button.setAttribute("aria-checked", String(region === ctx.selectedRegion));
    button.title = REGION_MENU_INFO[region].pool;
  });
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-display]").forEach((button) => {
    const selected = button.dataset.s13Display === ctx.displayMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-mode]").forEach((button) => {
    const selected = button.dataset.s13Mode === ctx.selectedGameMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  const emphasisButton = must<HTMLButtonElement>("#s13-emphasis");
  emphasisButton.setAttribute("aria-pressed", String(ctx.hanjaEmphasis));
  must<HTMLElement>("#s13-emphasis .s13-state").textContent = ctx.hanjaEmphasis ? "ON" : "OFF";
  emphasisButton.classList.toggle("is-on", ctx.hanjaEmphasis);
  const hoverGlyphButton = must<HTMLButtonElement>("#s13-hover-glyph");
  hoverGlyphButton.setAttribute("aria-pressed", String(ctx.hoverGlyphLarge));
  must<HTMLElement>("#s13-hover-glyph .s13-state").textContent = ctx.hoverGlyphLarge ? "ON" : "OFF";
  hoverGlyphButton.classList.toggle("is-on", ctx.hoverGlyphLarge);
  const autoButton = must<HTMLButtonElement>("#s13-autoplace");
  autoButton.setAttribute("aria-pressed", String(ctx.engine.state.autoPlaceSummons));
  must<HTMLElement>("#s13-autoplace .s13-state").textContent = ctx.engine.state.autoPlaceSummons ? "ON" : "OFF";
  autoButton.classList.toggle("is-on", ctx.engine.state.autoPlaceSummons);
}
must<HTMLButtonElement>("#custom-formation-button").addEventListener("click", () => {
  sound.playUiConfirm();
  syncS13();
  s13Dialog.showModal();
});
must<HTMLButtonElement>("#s13-close").addEventListener("click", () => s13Dialog.close());
s13Dialog.addEventListener("click", (event) => {
  if (event.target === s13Dialog) {
    s13Dialog.close();
    return;
  }
  const target = event.target as HTMLElement;
  const regionButton = target.closest<HTMLButtonElement>("[data-s13-region]");
  if (regionButton && !regionButton.disabled) {
    const region = regionButton.dataset.s13Region as RegionCode;
    if (region === "KR") {
      ctx.selectedRegion = "KR";
      syncTitleModeSelection();
    } else {
      // 미리 해보기 확인(P00)을 우회하지 않는다.
      s13Dialog.close();
      openP00(region);
    }
    return;
  }
  const displayButton = target.closest<HTMLButtonElement>("[data-s13-display]");
  if (displayButton) {
    setDisplayMode(displayButton.dataset.s13Display as DisplayMode);
    syncS13();
    return;
  }
  const modeButton = target.closest<HTMLButtonElement>("[data-s13-mode]");
  if (modeButton) {
    setSelectedGameMode(modeButton.dataset.s13Mode as GameMode);
    return;
  }
  if (target.closest("#s13-emphasis")) {
    toggleHanjaEmphasis();
    syncS13();
    return;
  }
  if (target.closest("#s13-hover-glyph")) {
    sound.unlock();
    setHoverGlyphLarge(!ctx.hoverGlyphLarge);
    sound.playUiConfirm();
    syncS13();
    return;
  }
  if (target.closest("#s13-autoplace")) {
    sound.unlock();
    const enabled = !ctx.engine.state.autoPlaceSummons;
    saveAutoPlaceSummons(enabled);
    handleAction(ctx.engine.setAutoPlaceSummons(enabled));
    syncAutoPlaceControl();
    sound.playUiConfirm();
    syncS13();
  }
});
must<HTMLButtonElement>("#seed-reroll-button").addEventListener("click", () => {
  seedInput.value = createRunSeed();
  sound.playUiConfirm();
});
must<HTMLButtonElement>("#s00-codex-button").addEventListener("click", () => {
  must<HTMLButtonElement>("#codex-button").click();
});
document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => handleAction(ctx.engine.setAutomationMode(button.dataset.mode as AutomationMode)));
});
wireEvolution1();
/**
 * 출정 게이트 (R11).
 *
 * 2차 프리로드가 끝나 있으면 한 프레임도 늦추지 않고 그대로 들어간다. 아직이면
 * 출정 버튼 자체에 소형 진행 띠를 띄우고 `BATTLE_GATE_CAP_MS` 까지만 기다린다.
 * 목적은 대기가 아니라 전장 첫 2초의 적·제단 팝인을 없애는 것이다.
 */
let enteringRun = false;
async function enterRun(button: HTMLButtonElement): Promise<void> {
  if (enteringRun) return;
  if (isBattleAssetsReady()) {
    startRun(false);
    return;
  }
  enteringRun = true;
  button.dataset.loading = "1";
  let ticking = 0;
  const tick = (): void => {
    const { done, total } = battleAssetProgress();
    button.style.setProperty("--p2-progress", total === 0 ? "1" : (done / total).toFixed(3));
    ticking = window.requestAnimationFrame(tick);
  };
  tick();
  await whenBattleAssetsReady();
  window.cancelAnimationFrame(ticking);
  delete button.dataset.loading;
  button.style.removeProperty("--p2-progress");
  enteringRun = false;
  startRun(false);
}
const startButton = must<HTMLButtonElement>("#start-button");
startButton.addEventListener("click", () => void enterRun(startButton));
must<HTMLButtonElement>("#retry-button").addEventListener("click", () => startRun(false));
must<HTMLButtonElement>("#new-seed-button").addEventListener("click", () => startRun(true));
/*
 * 종료 화면 막다른 길.
 *
 * 재도전·새 시드뿐이라 지역·진법을 바꾸러 메뉴로 갈 길이 없었고 Esc 도
 * 먹지 않았다. 3D 리그·엔진·카메라·패널이 한 판 분량의 상태를 물고 있어
 * 오버레이만 되돌리면 남은 찌꺼기가 다음 판까지 따라온다. 새로고침이
 * 가장 견고하다 — 최고 기록·안내 본 여부·오디오 설정은 전부
 * localStorage 라 그대로 살아남는다.
 */
function returnToMenu(): void {
  window.location.reload();
}
must<HTMLButtonElement>("#return-menu-button").addEventListener("click", returnToMenu);
window.addEventListener("keydown", (event) => {
  if (event.code !== "Escape") return;
  if (!endOverlay.classList.contains("modal-layer--visible")) return;
  if (document.querySelector("dialog[open]")) return;
  event.preventDefault();
  returnToMenu();
});
wireShop1();
must<HTMLButtonElement>("#summon-reveal-close").addEventListener("click", hideSummonReveal);
document.addEventListener("pointerdown", () => {
  if (summonReveal.classList.contains("is-active")) hideSummonReveal();
});
wireHud2();
wireElementUpgrade1();
wireSelected1();
wireCasualFusion1();
wireElementUpgrade2();
wireHud3();
wireHelp1();
wireHelp2();
must<HTMLButtonElement>("#settings-button").addEventListener("click", () => {
  sound.unlock();
  syncDisplayModeControls();
  syncAutoPlaceControl();
  syncHoverGlyphControl();
  syncAudioControls();
  settingsDialog.showModal();
});
// 저장된 선택이 OFF 면 첫 그림부터 반영되도록 초기 1회 맞춘다.
syncHoverGlyphControl();
wireGrowth1();
wireSelected2();
must<HTMLButtonElement>("#title-settings-button").addEventListener("click", () => {
  sound.unlock();
  syncDisplayModeControls();
  syncAutoPlaceControl();
  syncHoverGlyphControl();
  syncAudioControls();
  settingsDialog.showModal();
});
must<HTMLButtonElement>("#hover-glyph-toggle").addEventListener("click", () => {
  sound.unlock();
  setHoverGlyphLarge(!ctx.hoverGlyphLarge);
  sound.playUiConfirm();
});
must<HTMLButtonElement>("#settings-close").addEventListener("click", () => settingsDialog.close());
must<HTMLButtonElement>("#replay-coach-button").addEventListener("click", () => {
  // 한 번 본 뒤에는 다시 볼 길이 없었다. 설정에서 강제로 되돌린다.
  settingsDialog.close();
  startCoach(true);
});
document.querySelectorAll<HTMLButtonElement>("[data-display-mode-option]").forEach((button) => {
  button.addEventListener("click", () => {
    setDisplayMode(button.dataset.displayModeOption as DisplayMode);
    settingsDialog.close();
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-game-mode-option]").forEach((button) => {
  button.addEventListener("click", () => setSelectedGameMode(button.dataset.gameModeOption as GameMode));
});
must<HTMLButtonElement>("#auto-place-toggle").addEventListener("click", () => {
  sound.unlock();
  const enabled = !ctx.engine.state.autoPlaceSummons;
  saveAutoPlaceSummons(enabled);
  handleAction(ctx.engine.setAutoPlaceSummons(enabled));
  syncAutoPlaceControl();
  sound.playUiConfirm();
});
must<HTMLInputElement>("#bgm-volume").addEventListener("input", (event) => {
  sound.setBgmVolume(Number((event.target as HTMLInputElement).value) / 100);
  syncAudioControls();
});
must<HTMLInputElement>("#sfx-volume").addEventListener("input", (event) => {
  sound.setSfxVolume(Number((event.target as HTMLInputElement).value) / 100);
  syncAudioControls();
});
must<HTMLInputElement>("#sfx-volume").addEventListener("change", () => sound.playUiConfirm());
must<HTMLButtonElement>("#bgm-mute-button").addEventListener("click", () => {
  sound.unlock();
  const muted = sound.toggleBgmMuted();
  syncAudioControls();
  showToast(muted ? "배경음악 꺼짐" : "배경음악 켜짐");
});
must<HTMLButtonElement>("#sfx-mute-button").addEventListener("click", () => {
  sound.unlock();
  const muted = sound.toggleSfxMuted();
  syncAudioControls();
  if (!muted) sound.playUiConfirm();
  showToast(muted ? "효과음 꺼짐" : "효과음 켜짐");
});
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
wireCommon1();
wireHud4();
wireGoal1();
wireInventory1();
wireConcentration1();
wireGrowth2();
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
must<HTMLButtonElement>("#sound-button").addEventListener("click", () => {
  const muted = sound.toggle();
  syncAudioControls();
  if (!muted) sound.playUiConfirm();
  showToast(muted ? "전체 소리 꺼짐" : "전체 소리 켜짐");
});
wireSelected3();
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || helpDialog.open || settingsDialog.open || elementUpgradeDialog.open || abilityGuideDialog.open || casualFusionConfirmDialog.open || codexDialog.open) return;
  if (event.code === "Digit1") summonAndFocus();
  else if (event.code === "KeyQ") summonAndFocus(10);
  else if (event.code === "Digit2") {
    if (ctx.engine.state.mode === "casual") setPanelTab("evolution");
    else {
      const option = ctx.engine.availableEvolutions()[0];
      handleAction(option ? ctx.engine.evolve(option.recipeId) : { ok: false, message: "현재 가능한 합성이 없습니다." });
    }
  } else if (event.code === "Digit3") handleAction(ctx.engine.upgradeResearch());
  else if (event.code === "Space") {
    event.preventDefault();
    toggleHanjaEmphasis();
  } else if (event.code === "KeyC") {
    // 도감은 열자마자 검색창에 포커스를 준다. 기본 동작을 막지 않으면
    // 방금 누른 'c' 가 그대로 검색어로 들어가 빈 목록(0/1,001)으로 열렸다.
    event.preventDefault();
    must<HTMLButtonElement>("#codex-button").click();
  }
  else if (event.code === "KeyM") must<HTMLButtonElement>("#sound-button").click();
  else if (event.code === "KeyF") cycleGameSpeed();
  else if (event.code === "KeyP") toggleManualPause();
});
/** 열려 있는 모달 다이얼로그가 하나라도 있으면 전투를 세운다. */
function modalPauseActive(): boolean {
  return document.querySelector("dialog[open]") !== null;
}
function syncPauseChip(paused: boolean, manual: boolean): void {
  const chip = must<HTMLElement>("#pause-chip");
  if (chip.hidden !== !paused) chip.hidden = !paused;
  if (!paused) return;
  const reason = manual ? "P 키로 계속" : "창을 닫으면 계속";
  const label = must<HTMLElement>("#pause-reason");
  if (label.textContent !== reason) label.textContent = reason;
}
function toggleManualPause(): void {
  if (ctx.engine.state.phase !== "prep" && ctx.engine.state.phase !== "combat") return;
  ctx.manualPause = !ctx.manualPause;
  showToast(ctx.manualPause ? "일시정지 — P 키로 계속합니다." : "다시 진행합니다.");
}
function frame(now: number): void {
  const frameWorkStartedAt = performance.now();
  const delta = Math.min(0.1, Math.max(0, (now - ctx.lastFrame) / 1000));
  const running = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
  const paused = running && (ctx.manualPause || modalPauseActive());
  const simulationDelta = paused ? 0 : delta * ctx.gameSpeed;
  ctx.lastFrame = now;
  syncPauseChip(paused, ctx.manualPause);
  if (!paused) ctx.engine.update(simulationDelta);
  const audioPlan = ctx.engine.getCurrentPlan();
  sound.syncBgm({
    phase: ctx.engine.state.phase,
    wave: ctx.engine.state.wave,
    boss: ctx.engine.state.phase === "combat" && Boolean(audioPlan?.boss)
  }, now);
  const audioDebug = sound.getDebugState();
  shell.dataset.audioBgm = audioDebug.targetBgmId ?? "none";
  shell.dataset.audioPlaying = String(audioDebug.bgmPlaying);
  const frameEvents = ctx.engine.consumeEvents();
  const waveStartedThisFrame = frameEvents.some((event) => event.type === "wave");
  for (const event of frameEvents) processEvent(event);
  const summonEvents = frameEvents.filter((event): event is Extract<GameEvent, { type: "summon" }> => event.type === "summon");
  if (summonEvents.length > 0) showSummonReveal(summonEvents);
  else showCasualFusionReveal(frameEvents.filter((event): event is Extract<GameEvent, { type: "casualFuse" }> => event.type === "casualFuse"));
  if (ctx.engine.state.phase !== ctx.previousPhase) {
    ctx.previousPhase = ctx.engine.state.phase;
    if (ctx.previousPhase === "victory" || ctx.previousPhase === "defeat") showEndScreen(ctx.previousPhase);
  }
  // Simulation respects the selected speed, while visual feedback keeps a
  // stable real-time duration so 2x/3x does not make projectiles and skill
  // labels flash for only a few frames.
  // 일시정지 중에는 이펙트도 0 으로 굴려 "적은 멈췄는데 탄만 난다"를 막는다.
  drawWorld(paused ? 0 : delta);
  syncPanel();
  syncCoachProgress();
  if (waveStartedThisFrame) canvas.dataset.waveStartWorkMs = (performance.now() - frameWorkStartedAt).toFixed(2);
  window.requestAnimationFrame(frame);
}
/*
 * 첫 실행 조작 안내.
 *
 * 소환·휠 확대·패닝은 지금까지 패널 바닥의 10px 한 줄에만 적혀 있어서 사실상
 * 아무도 읽지 않았다. 실제 조작 대상 위에 스포트라이트를 씌워 한 번만 짚어 준다.
 * 게임을 막지 않으며, 해당 조작을 실제로 하면 저절로 다음 단계로 넘어간다.
 */
interface CoachStep {
  readonly target: string;
  readonly title: string;
  readonly body: string;
  /** 조작 픽토그램(p0-ui-components-pack-v1). 글보다 먼저 읽히는 그림 한 장. */
  readonly control?: "wheel" | "click" | "drag";
  readonly satisfied: () => boolean;
  /**
   * 대상이 아직 화면에 없을 때 대신 짚을 곳과 문구.
   * 예: 소환 전에는 웨이브 시작 버튼이 display:none 이라 스포트라이트가
   * (-6,-6) 12px 점으로 붕괴하고 말풍선만 고아로 남았다.
   */
  readonly fallback?: {
    readonly target: string;
    readonly title: string;
    readonly body: string;
    readonly control?: "wheel" | "click" | "drag";
  };
}
const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";
const COACH_STEPS: readonly CoachStep[] = [
  {
    target: '[data-summon-product="balanced"]',
    title: "먼저 자령(=타워)을 소환하세요",
    body: "엽전을 써서 자령을 뽑습니다. 첫 자령의 오행에 맞는 4×4 진이 무료로 열립니다.",
    control: "click",
    satisfied: () => ctx.engine.state.summonCount >= 1
  },
  {
    target: "#battle-canvas",
    title: "전장을 살펴보세요",
    body: "휠을 굴려 확대·축소하고, 빈 곳을 끌어 화면을 옮깁니다. 자령을 끌면 자리를 맞바꿉니다.",
    control: "wheel",
    // 설계 의도대로 "실제로 해내면 넘어간다" — 확대·축소 1회 또는 팬 1회.
    satisfied: () => ctx.mapCameraGestures > coachGestureBaseline
  },
  {
    target: "#early-button",
    title: "준비되면 웨이브를 시작합니다",
    body: "즉시 시작하면 남은 준비 시간만큼 엽전을 더 받습니다.",
    control: "click",
    satisfied: () => ctx.engine.state.wave >= 1,
    fallback: {
      target: '[data-summon-product="balanced"]',
      title: "먼저 소환부터",
      body: "상점의 소환으로 자령을 뽑으세요. 한 기라도 서면 전장 위에 웨이브 시작 버튼이 나타납니다.",
      control: "click"
    }
  }
];
let coachIndex = -1;
/** 지금 실제로 짚고 있는 셀렉터. 대체 대상으로 넘어간 것을 알아채는 데 쓴다. */
let coachResolvedTarget = "";
/** 단계에 들어선 순간의 카메라 조작 횟수. 이보다 늘면 그 단계를 해낸 것이다. */
let coachGestureBaseline = 0;
/**
 * 대상이 화면에 없거나 크기가 0 이면 대체 대상으로 돌린다.
 * 둘 다 없으면 target 을 null 로 돌려 말풍선을 화면 아래 가운데로 보낸다.
 */
function resolveCoachStep(step: CoachStep): { step: CoachStep; target: HTMLElement | null } {
  const laidOut = (selector: string): HTMLElement | null => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width >= 1 && rect.height >= 1 ? element : null;
  };
  const direct = laidOut(step.target);
  if (direct) return { step, target: direct };
  if (step.fallback) {
    const alternate = laidOut(step.fallback.target);
    if (alternate) return { step: { ...step, ...step.fallback }, target: alternate };
  }
  return { step, target: null };
}
function coachAlreadySeen(): boolean {
  try {
    return window.localStorage.getItem(COACH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function markCoachSeen(): void {
  try {
    window.localStorage.setItem(COACH_STORAGE_KEY, "1");
  } catch {
    // 저장이 막혀 있어도 이번 판 안내는 정상 동작한다.
  }
}
function layoutCoach(): void {
  const base = COACH_STEPS[coachIndex];
  if (!base) return;
  const { step, target } = resolveCoachStep(base);
  const ring = must<HTMLElement>("#coach-ring");
  const bubble = must<HTMLElement>("#coach-bubble");
  if (!target) {
    // 짚을 것이 아무것도 없으면 링을 걷고 말풍선만 화면 아래 가운데에 세운다.
    // 예전에는 레이어를 통째로 숨겨서 안내가 소리 없이 사라졌다.
    ring.hidden = true;
    bubble.style.top = `${Math.max(8, shell.offsetHeight - 172)}px`;
    bubble.style.left = `${Math.max(8, (shell.offsetWidth - 258) / 2)}px`;
    return;
  }
  ring.hidden = false;
  // 셸이 transform: scale 로 확대되므로 화면 좌표를 셸 좌표계로 되돌린다.
  const shellRect = shell.getBoundingClientRect();
  const scaleX = shellRect.width / Math.max(1, shell.offsetWidth);
  const scaleY = shellRect.height / Math.max(1, shell.offsetHeight);
  const rect = target.getBoundingClientRect();
  const left = (rect.left - shellRect.left) / scaleX;
  const top = (rect.top - shellRect.top) / scaleY;
  const width = rect.width / scaleX;
  const height = rect.height / scaleY;

  // 전장 전체를 감싸면 스포트라이트가 무의미하므로 가운데 일부만 짚는다.
  const focusWidth = step.target === "#battle-canvas" ? Math.min(width, 300) : width;
  const focusHeight = step.target === "#battle-canvas" ? Math.min(height, 240) : height;
  const focusLeft = left + (width - focusWidth) / 2;
  const focusTop = top + (height - focusHeight) / 2;

  ring.style.left = `${focusLeft - 6}px`;
  ring.style.top = `${focusTop - 6}px`;
  ring.style.width = `${focusWidth + 12}px`;
  ring.style.height = `${focusHeight + 12}px`;

  const bubbleWidth = 258;
  const bubbleHeight = bubble.offsetHeight || 132;
  const below = focusTop + focusHeight + 14;
  // 아래로 놓을 자리를 셸 바닥이 아니라 패널 탭 띠 위까지로 본다. 첫 단계의
  // 대상(자령 소환)은 패널 아래쪽에 있어서, 바닥까지 여유가 있어 보여도
  // 말풍선이 탭 띠를 덮어 다음 조작을 가로막았다. 그때는 위로 뒤집는다.
  const tabs = document.querySelector<HTMLElement>(".panel-tabs");
  const tabsTop = tabs ? (tabs.getBoundingClientRect().top - shellRect.top) / scaleY : shell.offsetHeight;
  const bottomLimit = Math.min(shell.offsetHeight - 8, tabsTop - 6);
  const fitsBelow = below + bubbleHeight <= bottomLimit;
  bubble.style.top = fitsBelow ? `${below}px` : `${Math.max(8, focusTop - bubbleHeight - 14)}px`;
  bubble.style.left = `${Math.max(8, Math.min(shell.offsetWidth - bubbleWidth - 8, focusLeft + focusWidth / 2 - bubbleWidth / 2))}px`;
}
function renderCoach(): void {
  const layer = must<HTMLElement>("#coach-layer");
  const base = COACH_STEPS[coachIndex];
  if (!base) {
    layer.hidden = true;
    return;
  }
  // 대상이 아직 없으면 문구도 대체 문구로 바꿔 읽는다.
  const { step } = resolveCoachStep(base);
  layer.hidden = false;
  must<HTMLElement>("#coach-index").textContent = String(coachIndex + 1);
  must<HTMLElement>("#coach-total").textContent = String(COACH_STEPS.length);
  must<HTMLElement>("#coach-title").textContent = step.title;
  must<HTMLElement>("#coach-body").textContent = step.body;
  must<HTMLElement>("#coach-next").textContent = coachIndex === COACH_STEPS.length - 1 ? "마치기" : "다음";
  // 조작 픽토그램은 장식이므로 aria 트리에 넣지 않고 CSS ::after 로만 얹는다.
  const bubble = must<HTMLElement>("#coach-bubble");
  if (step.control) bubble.dataset.coachControl = step.control;
  else delete bubble.dataset.coachControl;
  layoutCoach();
}
/**
 * 코치가 전장을 짚는 동안에는 소환 결과 카드(660×314)가 링 한가운데를
 * 그대로 덮어 wheel 을 삼킨다 — 안내대로 휠을 굴려도 줌이 변하지 않았다.
 * 해당 단계에 들어서면 카드를 곧바로 접는다.
 */
function coachIsPointingAtBoard(): boolean {
  return coachIndex >= 0 && COACH_STEPS[coachIndex]?.target === "#battle-canvas";
}
/** 단계에 들어설 때 카메라 조작 기준선을 다시 잡고, 방해물을 치운다. */
function enterCoachStep(): void {
  coachGestureBaseline = ctx.mapCameraGestures;
  coachResolvedTarget = COACH_STEPS[coachIndex] ? resolveCoachStep(COACH_STEPS[coachIndex]).step.target : "";
  if (coachIsPointingAtBoard()) hideSummonReveal();
  renderCoach();
}
function advanceCoach(): void {
  if (coachIndex < 0) return;
  if (coachIndex >= COACH_STEPS.length - 1) {
    endCoach();
    return;
  }
  coachIndex += 1;
  enterCoachStep();
}
function endCoach(): void {
  coachIndex = -1;
  must<HTMLElement>("#coach-layer").hidden = true;
  markCoachSeen();
}
function startCoach(force = false): void {
  if (!force && coachAlreadySeen()) return;
  coachIndex = 0;
  enterCoachStep();
}
/** 해당 조작을 실제로 해내면 안내가 저절로 넘어간다. */
function syncCoachProgress(): void {
  if (coachIndex < 0) return;
  const base = COACH_STEPS[coachIndex];
  if (!base) return;
  // 대상이 나타나거나 사라지면(소환 직후의 웨이브 시작 버튼) 문구와
  // 스포트라이트를 그 자리에서 갈아 끼운다.
  const resolved = resolveCoachStep(base).step.target;
  if (resolved !== coachResolvedTarget) {
    coachResolvedTarget = resolved;
    renderCoach();
  }
  if (base.satisfied()) advanceCoach();
}
/*
 * S00 2.5D 리그.
 *
 * 진짜 3D 엔진 없이, 포인터 시차와 원근 기울임만으로 "그림 속 책상 위에
 * 자령이 서 있는" 깊이감을 만든다. 좌표는 CSS 변수로만 전달하므로
 * 버튼 히트 영역은 움직이지 않고, prefers-reduced-motion 이면 껐다.
 */
// 3D 서재가 기본 메인 메뉴다. ?menu3d=0 으로 2D 그림 배경으로 되돌릴 수
// 있고, WebGL 초기화가 실패하면 자동으로 2D 로 폴백한다.
// R11: 1차 프리로드가 끝난 뒤에 세운다. 텍스처가 이미 캐시에 있으므로
// `startMenu3d` 안의 재질 교체가 동기로 끝나고 절차 재질이 화면에 남지 않는다.
async function mountS00(): Promise<void> {
  const stage = document.querySelector<HTMLElement>(".s00-stage");
  if (!stage) return;
  if (s00Mode === "2d") {
    enableS00LayeredBackground();
    return;
  }
  stage.classList.add("is-3d");
  try {
    const { startMenu3d } = await import("./ui/menu3d");
    const handle = startMenu3d(stage);
    must<HTMLButtonElement>("#start-button").addEventListener("click", () => handle.dispose(), { once: true });
  } catch (error) {
    // WebGL 이 없으면 2D 배경으로 되돌린다. 이때 비로소 레이어를 내려받는다.
    // 조용히 삼키면 3D 가 왜 안 뜨는지 알 길이 없어 이유는 남긴다.
    console.warn("[menu3d] 3D 서재 초기화 실패, 2D 배경으로 되돌린다:", error instanceof Error ? error.message : error);
    stage.classList.remove("is-3d");
    enableS00LayeredBackground();
  }
}
const s00Stage = document.querySelector<HTMLElement>(".s00-stage");
if (s00Stage && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let parallaxRaf = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  const applyParallax = (): void => {
    parallaxRaf = 0;
    // 살짝 늦게 따라와야 손맛이 아니라 "무거운 장면"으로 느껴진다.
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    s00Stage.style.setProperty("--plx", currentX.toFixed(4));
    s00Stage.style.setProperty("--ply", currentY.toFixed(4));
    if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.002) {
      parallaxRaf = window.requestAnimationFrame(applyParallax);
    }
  };
  s00Stage.addEventListener("pointermove", (event) => {
    const rect = s00Stage.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    if (!parallaxRaf) parallaxRaf = window.requestAnimationFrame(applyParallax);
  });
  s00Stage.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
    if (!parallaxRaf) parallaxRaf = window.requestAnimationFrame(applyParallax);
  });
}
/*
 * 개발자 모드.
 *
 * 런 시드는 재현·디버그 도구라 일반 화면에서 치운다. 백틱(`)을 다른 키
 * 없이 5번 연속 누르면 토글되고, 시드 입력·재생성·푸터 시드가 나타난다.
 * ?seed= URL 파라미터는 게이트와 무관하게 항상 동작한다(테스트 계약).
 */
let devKeyStreak = 0;
let devKeyTimer = 0;
function setDevMode(enabled: boolean): void {
  shell.dataset.devMode = enabled ? "1" : "0";
  // 같은 시드 재도전은 재현·디버그용 — 일반 플레이어에겐 시드 개념을 노출하지 않는다.
  must<HTMLButtonElement>("#retry-button").hidden = !enabled;
  if (enabled) {
    seedInput.focus();
    seedInput.select();
  }
}
window.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  if (target && target.closest("input, textarea")) return;
  if (event.code === "Backquote") {
    devKeyStreak += 1;
    window.clearTimeout(devKeyTimer);
    devKeyTimer = window.setTimeout(() => {
      devKeyStreak = 0;
    }, 1200);
    if (devKeyStreak >= 5) {
      devKeyStreak = 0;
      // 켜는 순간 시드 입력칸에 포커스가 가므로, 이 백틱 자체가 선택된
      // 시드 문자열을 "`" 로 덮어써 버린다. 입력만 막는다.
      event.preventDefault();
      setDevMode(shell.dataset.devMode !== "1");
    }
    return;
  }
  devKeyStreak = 0;
});
must<HTMLButtonElement>("#coach-next").addEventListener("click", advanceCoach);
must<HTMLButtonElement>("#coach-skip").addEventListener("click", endCoach);
function fitShell(): void {
  shell.style.setProperty("--viewport-height", String(window.innerHeight) + "px");
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  // rect 는 고정 무대의 transform 이 반영된 실측값이라 displayScale 이 곧
  // 무대 배율이다. backing store 는 devicePixelRatio x 무대배율로 커져
  // 확대판에서도 흐려지지 않는다. 축소(<1)일 때는 1.0 을 밑돌지 않게 막아
  // 설계 해상도만큼은 지키고, 상한 2.5 로 고배율에서의 과다 렌더를 끊는다
  // (menu3d 의 setPixelRatio 와 같은 상한이다).
  const displayScale = rect.width / WORLD_WIDTH;
  const pixelScale = Math.min(2.5, Math.max(1, displayScale * (window.devicePixelRatio || 1)));
  const backingWidth = Math.round(WORLD_WIDTH * pixelScale);
  const backingHeight = Math.round(WORLD_HEIGHT * pixelScale);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
}
fitShell();
window.addEventListener("resize", () => {
  fitShell();
  layoutCoach();
});
/*
 * 첫 오픈에만 늦게 오는 그림 미리 받기.
 *
 * P00·S13 의 두루마리 프레임은 그 창을 처음 열 때에야 요청이 나가서,
 * 도착 전까지 먹 글자와 버튼만 메뉴 위에 둥둥 떠 보였다. CSS 가 쓰는
 * 것과 같은 경로로 미리 받아 둔다(R7-30 의 한지 바탕과 짝).
 */
for (const path of ["assets/ui/main-menu-b/ui/p00-scroll-frame-v1.png"]) {
  const warm = new Image();
  warm.decoding = "async";
  // 하위 경로 배포(GitHub Pages)에서 루트 절대 경로는 404 가 된다 — 문서 기준으로.
  warm.src = new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).toString();
}
syncMapZoomControl();
setGameSpeed(1);
setDisplayMode(initialDisplayMode, false);
syncTitleModeSelection();
syncAudioControls();
syncPanel();
/*
 * R11 부팅 순서.
 *
 *   1) 1차(P1) 프리로드 — S00 이 완성된 모습으로 뜨는 데 필요한 것만. 이 동안
 *      `index.html` 인라인 막이 화면을 덮고 진행률을 보여 준다.
 *   2) S00 을 세운다. 텍스처는 이미 캐시에 있으므로 첫 프레임부터 실물이다.
 *   3) 막을 걷고 전장 루프를 돌린다. 전장 첫 draw 가 여기서 처음 일어나므로
 *      제단·먹길 스프라이트 요청도 P1 을 방해하지 않는다.
 *   4) 2차(P2) 프리로드를 뒤에서 시작한다. 출정 클릭이 더 빠르면
 *      `whenBattleAssetsReady()` 가 잠깐만 붙잡는다.
 */
async function bootGame(): Promise<void> {
  // 번들이 살아 있음이 증명됐다. 인라인 안전장치를 거두고 막의 수명을 넘겨받는다.
  takeOverBootScreen();
  // 첫 방문에도 워커가 곧바로 페이지를 물어 P1·P2 응답을 캐시에 담게 한다.
  registerServiceWorker();
  await preloadP1(s00Mode, updateBootProgress);
  await mountS00();
  dismissBootScreen();
  attachHanjiPaperBackground();
  drawWorld(0);
  window.requestAnimationFrame(frame);
  await startP2();
  warmCombatSpriteCaches();
}
void bootGame();
