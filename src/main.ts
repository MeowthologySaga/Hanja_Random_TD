import "./styles.css";
import "./ui-skin.css";
import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  CELLS_PER_FORMATION,
  ENEMY_PATH_POINTS,
  FORMATION_COLUMNS,
  FORMATION_ROWS,
  ENEMY_SPAWN_PROGRESS,
  MAX_ENEMIES,
  WAVE_REINFORCEMENT_DELAY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  bossTimeLimitForWave,
  positionOnPath,
  wavePlan
} from "./core/content";
import { hasActiveSkills } from "./core/abilities";
import {
  CASUAL_STAR_COLORS,
  CASUAL_STAR_NAMES,
  CASUAL_STAR_POWER,
  casualNaturalStar,
  casualStarRangeLabel,
  casualStrokeCount
} from "./core/casual";
import {
  type CasualAutoFusionGroup,
  type CasualFusionQuote,
  GameEngine,
  FIRST_PREP_SECONDS,
  MAX_CONCENTRATION_LEVEL,
  concentrationEssenceCost,
  interestForGold
} from "./core/game";
import {
  ELEMENT_TRAITS,
  ELEMENT_TRAIT_MAX_LEVEL,
  elementTraitUnlockScore,
  elementTraitUpgradeCost
} from "./core/growth";
import {
  type IdiomDefinition,
  type PartialIdiomChain,
  idiomById,
  idiomNeighborCells,
  partialIdiomChain
} from "./core/idioms";
import {
  enemyJaryeongVisualFor,
  jaryeongAssetPath,
  jaryeongFrameLayout,
  jaryeongVisualFor,
  type JaryeongVisual
} from "./core/jaryeongs";
import {
  CHEONJAMUN_JARYEONG_DEX_BY_HANJA,
  CHEONJAMUN_JARYEONG_DEX_ENTRIES,
  CHEONJAMUN_JARYEONG_DEX_META,
  type CheonjamunJaryeongDexEntry
} from "./core/cheonjamun-jaryeong-dex";
import { CHEONJAMUN_SUPPLEMENTAL_CHARACTERS } from "./core/cheonjamun-roster";
import { koreanMeaningExplanation } from "./core/korean-meaning-explanations";
import { type CompactReading, type MeasureText, compactReading } from "./ui/plaque-text";
import {
  NAMEPLATE_LAYOUT,
  type NameplateKind,
  nameplateImage,
  nameplateReady,
  preloadNameplateSprites
} from "./ui/nameplate-sprites";
import {
  type IdiomOrder,
  idiomOrderSealImage,
  idiomSpriteReady,
  preloadIdiomSprites,
  tintedIdiomRipple
} from "./ui/idiom-sprites";
import { LEARNING_DATA_META, learningInfo } from "./core/learning";
import { radicalGlyph, radicalLearningLabel } from "./core/radicals";
import {
  ELEMENT_STYLES,
  GAME_CONFIG,
  GRAPH_ROLE_LABELS,
  MAX_UPGRADE_LEVEL,
  REGION_META,
  ROLE_LABELS,
  STAGE_COLORS,
  STAGE_MULTIPLIERS,
  STAGE_NAMES,
  UPGRADE_STAT_META,
  UPGRADE_STAT_ORDER,
  WUXING_ORDER,
  definitionForTower,
  elementUpgradeCost,
  globalUpgradeCost,
  multiSummonCost,
  maxSummonStageForWave,
  researchCost,
  researchUnlockWave,
  summonStageUnlockWave,
  SUMMON_SURCHARGE,
  summonCost
} from "./core/hanzi";
import { createRunSeed } from "./core/rng";
import type {
  ActionResult,
  AbilityFxKind,
  AbilitySpec,
  AutomationMode,
  CasualStar,
  CompositionBranchPreview,
  ConcentrationPath,
  Enemy,
  EvolutionOption,
  GameEvent,
  GameMode,
  HanziDefinition,
  Point,
  RegionCode,
  RunPhase,
  SummonIntent,
  Tower,
  UpgradeStat,
  Wuxing
} from "./core/types";
import { SoundManager } from "./ui/audio";
import { abilityZoneSpriteLayout, deterministicZoneRotation } from "./ui/combat-fx-layout";
import { elementProjectileImage, elementZoneImage, preloadCombatFxSprites } from "./ui/combat-fx-sprites";
import {
  ENEMY_FRAME_SIZE,
  FALLBACK_ART_TOP_FACTOR,
  enemyArtTopFactor,
  enemySheetImage,
  enemySheetStateSummary,
  isEnemySheetReady,
  preloadEnemySprites
} from "./ui/enemy-sprites";
import {
  FORMATION_PLATE_HALF,
  FORMATION_PLATE_SIZE,
  formationPlateImage,
  formationPlateStateSummary,
  isFormationPlateReady,
  preloadFormationPlates
} from "./ui/formation-plate-sprites";
import {
  LOCK_SPRITE_SIZE,
  isLockSpriteReady,
  lockSpriteImage,
  preloadLockSprites
} from "./ui/lock-sprites";
import {
  inkArrowImage,
  inkCornerImage,
  inkCrossImage,
  inkStraightImage,
  preloadInkPathSprites,
  type InkCorner,
  type InkDirection
} from "./ui/ink-path-sprites";
import {
  CELL_SOCKET_SIZE,
  cellSocketImage,
  isCellSocketReady,
  preloadP0ComponentSprites
} from "./ui/p0-component-sprites";
import {
  EXIT_SEAL_SIZE,
  IDIOM_SEAL_SIZE,
  STAR_RING_SIZE,
  clampStarLevel,
  exitSealImage,
  idiomCompletionSealImage,
  isReady as isPolishSpriteReady,
  preloadPolishSprites,
  starAscentRingImage
} from "./ui/polish-sprites";
import { loadDisplayMode, saveDisplayMode, type DisplayMode } from "./ui/display-mode";
import { jaryeongSpriteImage } from "./ui/jaryeong-sprites";
import { loadAutoPlaceSummons, saveAutoPlaceSummons } from "./ui/summon-placement";
import { initStage } from "./ui/stage";
import {
  UNCOMBINABLE_STAGE_ONE,
  UNCOMBINABLE_STAGE_ONE_COLOR,
  buildSynthesisDepths,
  buildUncombinableStageOneChars,
  synthesisTierAccessibleLabel,
  synthesisTierFilterLabel,
  synthesisTierKey,
  type SynthesisTierFilter
} from "./ui/codex-synthesis";

// 1280x720 고정 무대를 먼저 켠다. 리사이즈 시 --stage-scale 갱신이
// fitShell() 의 실측보다 앞서야 캔버스 backing store 가 한 박자 늦지 않는다.
initStage();

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app element is missing.");
const initialDisplayMode = loadDisplayMode();
const initialAutoPlaceSummons = loadAutoPlaceSummons();

app.innerHTML = `
  <main class="game-shell" data-phase="title" data-display-mode="${initialDisplayMode}" data-game-mode="standard">
    <section class="battle-stage" aria-label="한자 랜덤 타워 디펜스 전장">
      <canvas id="battle-canvas" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}"></canvas>
      <button id="map-zoom-reset" class="map-zoom-control" type="button" title="지도 확대/축소 초기화">
        <span>지도</span><strong id="map-zoom-value">100%</strong><small>휠 확대·축소</small>
      </button>
      <button id="hanja-emphasis-toggle" class="hanja-emphasis-control is-on" type="button" aria-pressed="true" title="전장 한자 표찰 강조 전환 (Space)">
        <span>한자 강조</span><strong>ON</strong>
      </button>
      <span class="canvas-tip" aria-label="지도 조작 안내">
        <i title="휠: 지도 확대·축소"><em>휠</em>휠 확대·축소</i><i title="빈 곳 끌기: 화면 이동"><em>끌기</em>끌어 화면 이동</i><i title="클릭: 선택·이동"><em>클릭</em>클릭 선택</i><i title="자령 끌기: 자리 교환"><em>자령 끌기</em>자령 끌어 교환</i>
      </span>
      <div class="stage-topbar" aria-live="polite">
        <div class="stage-chip"><span>웨이브</span><strong id="stage-wave">0 / ${GAME_CONFIG.maxWaves}</strong></div>
        <div class="stage-chip stage-chip--region"><span>지역</span><strong id="stage-region">한국</strong></div>
        <div class="stage-chip stage-chip--chapter" title="10웨이브마다 우두머리가 오는 장(章) 진행"><span>장</span><strong id="stage-chapter">1 / 10</strong></div>
        <div class="stage-chip stage-chip--phase"><i id="phase-dot"></i><strong id="stage-phase">준비 전</strong></div>
        <button id="early-button" class="early-start" type="button" data-testid="early-wave">시작 보너스</button>
        <div id="enemy-limit-chip" class="stage-chip"><span>적 한계</span><strong id="stage-enemies">0 / ${MAX_ENEMIES}</strong></div>
      </div>
      <div id="active-idioms" class="active-idioms" aria-label="발동 중 사자성어" aria-live="polite"></div>
      <div class="wave-progress" aria-hidden="true"><i id="wave-progress-fill"></i></div>
      <div id="boss-banner" class="boss-banner" aria-live="assertive"></div>
      <div id="pause-chip" class="pause-chip" role="status" aria-live="polite" hidden><b>⏸ 일시정지</b><span id="pause-reason">창을 닫으면 계속</span></div>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
      <section id="summon-reveal" class="summon-reveal" aria-hidden="true" aria-live="assertive">
        <header><div><span id="summon-reveal-kicker">소환 결과</span><strong id="summon-reveal-title">자령 소환</strong></div><button id="summon-reveal-close" type="button" aria-label="소환 결과 닫기">×</button></header>
        <p id="summon-reveal-summary"></p>
        <div id="summon-reveal-list" class="summon-reveal-list"></div>
        <i id="fusion-vortex" class="fusion-vortex" aria-hidden="true"></i>
      </section>

      <div id="early-hint" class="early-hint" role="status" hidden>다음 웨이브를 일찍 부르면 엽전 보너스!</div>
      <div id="focus-dim" class="focus-dim" hidden></div>
      <section id="growth-frame" class="focus-frame focus-frame--forge" role="dialog" aria-modal="false" aria-labelledby="growth-frame-title" hidden>
        <header class="focus-frame-head">
          <div><strong id="growth-frame-title">강화 제련소</strong><span>안 쓰는 자령을 힘으로</span></div>
          <button id="growth-frame-close" class="focus-frame-close" type="button" data-focus-close="growth" aria-label="강화 제련소 닫기">닫기 ✕</button>
        </header>
        <div id="growth-frame-body" class="focus-frame-body growth-workbench"></div>
      </section>
      <section id="concentration-frame" class="focus-frame focus-frame--workshop" role="dialog" aria-modal="false" aria-labelledby="concentration-frame-title" hidden>
        <header class="focus-frame-head">
          <div><strong id="concentration-frame-title">농축 공방</strong><span>같은 자령을 더 강하게</span></div>
          <button id="concentration-frame-close" class="focus-frame-close" type="button" data-focus-close="concentration" aria-label="농축 공방 닫기">닫기 ✕</button>
        </header>
        <div id="concentration-frame-body" class="focus-frame-body concentration-workbench"></div>
      </section>
    </section>

    <aside class="control-panel" aria-label="합성과 수비 조작 패널">
      <header class="brand-row">
        <div><p class="eyebrow">한자 랜덤 타워 디펜스</p><h1>한자 운명진</h1></div>
        <div class="header-actions">
          <button id="speed-button" class="speed-button" type="button" aria-label="게임 배속 1배" title="게임 배속 전환 (F)">1×</button>
          <button id="settings-button" class="icon-button" type="button" aria-label="화면 설정 열기" title="화면 설정">⚙</button>
          <button id="sound-button" class="icon-button" type="button" aria-label="소리 끄기" title="소리 켜기/끄기 (M)">♪</button>
          <button id="codex-button" class="icon-button icon-button--codex" type="button" aria-label="통합 자령 도감 열기" title="자령 도감 — 배지는 이번 런에서 처음 만난 한자 수입니다 (C)"><b>도감</b><small><em id="discover-count">0</em></small></button>
          <button id="help-button" class="icon-button" type="button" aria-label="도움말 열기">?</button>
        </div>
      </header>

      <section class="resource-grid" aria-label="현재 자원">
        <div><span>엽전 <em id="interest-preview">이자 +2</em></span><strong id="gold-value">${GAME_CONFIG.startingGold}</strong></div>
        <div><span>적 한계</span><strong id="enemy-cap-value">${MAX_ENEMIES}체</strong></div>
        <div title="전장에 배치된 자령 수 / 열린 진의 칸 수"><span>배치</span><strong id="tower-count-value">0 / 16</strong></div>
        <div title="이번 런에 완성한 목표 한자 수 / 목표 개수"><span>목표</span><strong id="goal-count-value">0</strong></div>
      </section>

      <section class="wave-card">
        <div><span id="wave-kicker">첫 웨이브 대기</span><strong id="wave-label">소환진을 준비하세요</strong><small id="wave-briefing">다음 적 정보를 확인하세요.</small></div>
        <div class="weakness-seal"><span>약점</span><b id="wave-weakness">木</b></div>
      </section>

      <div class="context-deck">
        <section id="goal-panel" class="goal-workbench panel-view" data-panel-view="goal" aria-label="목표 선택 서책">
          <header class="goal-workbench-heading">
            <div><span>보유 기준 목표</span><strong>목표 서책</strong></div>
            <div class="goal-mode-tabs" role="tablist" aria-label="목표 종류">
              <button type="button" class="is-active" data-goal-mode="hanzi" role="tab" aria-selected="true">한자 목표</button>
              <button type="button" data-goal-mode="idiom" role="tab" aria-selected="false">성어 목표</button>
            </div>
          </header>

          <section class="goal-card" aria-label="현재 목표 한자">
            <div class="goal-glyph" id="goal-glyph">相</div>
            <div class="goal-copy">
              <div class="section-heading"><span>현재 한자 목표</span><b id="goal-stage">2단계</b></div>
              <strong id="goal-recipe">木 + 目 → 相</strong>
              <span id="goal-reading" class="goal-reading">훈음 · 서로 상</span>
              <div id="goal-materials" class="goal-materials"></div>
              <div class="goal-progress"><i id="goal-progress-fill"></i></div>
            </div>
          </section>

          <section id="idiom-target-card" class="idiom-target-card" aria-label="현재 성어 목표"></section>

          <div class="goal-selector-tools">
            <label><span>目</span><input id="goal-search" type="search" placeholder="원하는 한자·훈음·성어를 검색" autocomplete="off" /></label>
            <div id="goal-owned-summary" class="goal-owned-summary"></div>
          </div>
          <div id="goal-selector-list" class="goal-selector-list" aria-live="polite"></div>
        </section>

        <section id="shop-panel" class="shop-workbench panel-view is-active" data-panel-view="shop" aria-label="자령 상점과 운영 행동">
          <header class="shop-workbench-heading">
            <div><span>소환과 운영</span><strong>봉인 상점</strong></div>
            <p id="summon-pool-summary"><b>천자문 1,000종</b><span>단계별 희귀도 적용</span></p>
          </header>
          <section id="opening-guide" class="opening-guide" aria-label="초반 진행 안내">
            <div data-opening-step="1"><b>① 자령 소환</b><span>첫 자령이 시작 오행을 정합니다.</span></div>
            <i>→</i>
            <div data-opening-step="2"><b>② 첫 진 자동 개방</b><span>추가 소환 2기를 권장합니다.</span></div>
            <i>→</i>
            <div data-opening-step="3"><b>③ 웨이브 시작</b><span>첫 소환 뒤 준비 15초가 흐릅니다.</span></div>
          </section>
          <section class="formation-unlock-bar" aria-label="오행진 엽전 해금">
            <div><b>오행진 해금</b><small id="formation-unlock-summary">첫 소환 오행진 무료 개방</small></div>
            <div id="formation-unlock-list" class="formation-unlock-list"></div>
          </section>
          <section class="action-row" aria-label="핵심 행동">
            <div id="summon-shop" class="summon-shop" role="group" aria-label="소환 상품"></div>
            <button id="evolve-button" class="action-button action-button--evolve" type="button" data-testid="evolve-button">
              <span class="hotkey">2</span><b id="evolve-action-label">합성</b><small><em id="evolve-ready-count">0</em><span id="evolve-action-detail">개 조합 확인</span></small>
            </button>
            <button id="research-button" class="action-button action-button--research" type="button" data-testid="research-button"
              title="인연 연구 — 엽전을 들여 목표 재료가 나올 확률을 올립니다. 최고 5단계 (3키)">
              <span class="hotkey">3</span><b>인연 연구</b><small><em id="research-cost">10W 개방</em> · <i id="research-level">0</i>/5</small>
            </button>
            <button id="auto-arrange-button" class="action-button action-button--auto-arrange" type="button" data-testid="auto-arrange-button" title="발동 가능한 사자성어를 봉인하고 오행진 공명을 최적화합니다">
              <b>자동배치</b><small>성어·오행 최적화</small>
            </button>
            <button id="element-upgrade-button" class="action-button action-button--element-upgrade" type="button" data-testid="element-upgrade-button">
              <b>강화 탭</b><small id="element-upgrade-total">총 0단계</small>
            </button>
          </section>
        </section>

        <section id="selected-card" class="selected-card panel-view" data-panel-view="unit" aria-live="polite">
          <div class="empty-selection"><b>전장의 자령을 선택하세요</b><span>한자의 훈음·부수와 현재 능력 효과를 크게 확인할 수 있습니다.</span></div>
        </section>

        <section class="evolution-workbench panel-view" data-panel-view="evolution" aria-label="한자 합성">
          <div class="evolution-heading">
            <div><span id="evolution-kicker">조합 서책</span><strong><span id="evolution-heading-label">현재 가능한 합성</span> <b id="evolution-count">0</b></strong></div>
            <div id="standard-evolution-modes" class="mode-tabs" role="group" aria-label="합성 방식">
              <button type="button" data-mode="manual">수동</button>
              <button type="button" data-mode="semi" class="is-active">반자동</button>
              <button type="button" data-mode="goal">목표 자동</button>
            </div>
          </div>
          <section id="casual-fusion-toolbar" class="casual-fusion-toolbar" hidden>
            <button id="casual-fuse-all" class="casual-fuse-all" type="button">
              <b>한 번에 승급</b><span id="casual-fuse-all-count">0회 가능</span>
            </button>
            <p id="casual-fuse-all-note" class="casual-fuse-all-note">같은 오행·같은 별 자령 3체를 자동으로 묶습니다. 3기가 모두 사라지고 다음 별 자령 1기를 무작위로 얻습니다.</p>
          </section>
          <div id="evolution-options" class="evolution-options">
            <div class="empty-evolution"><b>재료를 모으는 중</b><span>목표 재료는 소환 확률이 서서히 보정됩니다.</span></div>
          </div>
        </section>

        <div class="combat-readout panel-view" data-panel-view="record" aria-label="전투 발동 기록">
          <div class="record-heading"><span>최근 능력 기록</span><small>무엇이 왜 발동했는지 표시됩니다.</small></div>
          <div id="combo-meter" class="combo-meter"><span>연쇄 봉인</span><b id="combo-count">× 3</b></div>
          <ol id="combat-feed" class="combat-feed"></ol>
        </div>

        <section id="idiom-panel" class="idiom-panel panel-view" data-panel-view="idiom" aria-label="사자성어 진법" aria-live="polite">
          <section class="idiom-rule-guide" aria-label="성어 발동 규칙">
            <div class="idiom-rule-chain" aria-hidden="true">
              <i style="--r:1;--c:1">①</i><b style="--r:1;--c:2">→</b>
              <i style="--r:1;--c:3">②</i><b style="--r:1;--c:4">→</b>
              <i style="--r:1;--c:5">③</i><b class="is-diagonal" style="--r:2;--c:6">↘</b>
              <i style="--r:2;--c:7">④</i>
            </div>
            <p>순서대로 이웃(대각선 가능) · 역순도 인정 · 같은 진 안에서</p>
          </section>
          <div id="idiom-hud" class="idiom-hud">
            <div class="idiom-heading"><span>四字成語 진법</span><b id="idiom-count">0 / 4</b></div>
            <div id="idiom-glyphs" class="idiom-glyphs"></div>
            <strong id="idiom-name">이심전심</strong>
            <p id="idiom-meaning">말하지 않아도 서로 마음이 통함</p>
            <b id="idiom-bonus" class="idiom-bonus">모든 자령 사거리 +28</b>
            <small id="idiom-hint">글자 순서가 맞으면 자동 봉인</small>
          </div>
          <div id="idiom-result" class="idiom-result" aria-label="최근 자동 사자성어 발동">
            <b id="idiom-result-glyph">四</b>
            <span>
              <small>최근 자동 감지</small>
              <strong id="idiom-result-name">네 글자를 순서대로 배치하세요</strong>
              <em id="idiom-result-meaning">배치된 자령을 자동으로 판정합니다.</em>
            </span>
            <mark id="idiom-result-bonus">자동 판정</mark>
          </div>
        </section>

        <section id="run-inventory-panel" class="run-inventory-panel panel-view" data-panel-view="inventory" aria-label="이번 판 자령 인벤토리">
          <div class="run-inventory-heading">
            <div><span>런 인벤토리</span><strong>배치 대기 <b id="run-inventory-heading-count">0개 · 0종</b></strong></div>
            <div class="run-inventory-tools">
              <small id="essence-summary">문기 木0 火0 土0 金0 水0</small>
              <button id="cleanup-recommended-button" type="button">정리 후보 분해</button>
            </div>
          </div>
          <div id="run-inventory-list" class="run-inventory-list">
            <div class="empty-run-inventory"><b>대기 중인 자령이 없습니다</b><span>설정에서 자동 배치를 끄거나 전장 자령을 보관하세요.</span></div>
          </div>
        </section>

        <section id="concentration-panel" class="concentration-workbench panel-view" data-panel-view="concentration" aria-label="자령 농축 공방">
          <header class="workbench-heading">
            <div><span>같은 자령을 더 강하게</span><strong>농축 공방</strong></div>
            <p class="concentration-guide"><i>①</i> 왼쪽에서 자령 선택 <i>②</i> 연속·심화 중 택1 <i>③</i> 재료 지불 → 능력치 영구 상승</p>
          </header>
          <div id="concentration-layout" class="concentration-layout">
            <aside><div class="subheading"><b>① 대상 선택</b><small id="concentration-target-summary">0기</small></div><div id="concentration-target-list" class="concentration-target-list"></div></aside>
            <div id="concentration-detail" class="concentration-detail"></div>
          </div>
          <div class="focus-panel-summary">
            <p id="concentration-panel-summary">농축 가능 0기 · 총 0기</p>
            <button id="concentration-frame-open" class="focus-open-button" type="button">공방 열기</button>
          </div>
        </section>

        <section id="growth-panel" class="growth-workbench panel-view" data-panel-view="growth" aria-label="분해 문기와 오행 강화">
          <header class="workbench-heading">
            <div><span>안 쓰는 자령을 힘으로</span><strong>강화 제련소</strong></div>
            <p id="growth-resource-summary">문기 木0 火0 土0 金0 水0</p>
          </header>
          <div class="growth-layout">
            <section class="dismantle-workbench">
              <div class="subheading"><b>① 분해</b><small>안 쓰는 인벤 자령을 문기(재료)로 바꿉니다</small></div>
              <div class="growth-filters">
                <select id="dismantle-element-filter" aria-label="분해 오행 필터"><option value="all">모든 오행</option><option>木</option><option>火</option><option>土</option><option>金</option><option>水</option></select>
                <select id="dismantle-stage-filter" aria-label="분해 단계 필터"><option value="all">모든 단계</option><option value="1">1성</option><option value="2">2성</option><option value="3">3성</option><option value="4">4성</option><option value="5">5성</option><option value="6">6성</option><option value="7">7성</option><option value="8">8성</option></select>
                <select id="dismantle-status-filter" aria-label="분해 보호 필터"><option value="all">전체 상태</option><option value="eligible">분해 가능</option><option value="protected">보호됨</option></select>
              </div>
              <div class="dismantle-toolbar"><button id="dismantle-recommend-button" type="button">추천 후보 선택</button><button id="dismantle-clear-button" type="button">선택 해제</button></div>
              <div id="growth-dismantle-list" class="growth-dismantle-list"></div>
              <footer class="dismantle-quote"><span id="dismantle-selection-summary">0기 선택</span><strong id="dismantle-gain-summary">예상 문기 없음</strong><button id="dismantle-confirm-button" type="button" disabled>선택 분해</button></footer>
            </section>
            <section class="element-growth-workbench">
              <div class="subheading"><b>② 오행 강화</b><small>문기로 그 오행 자령 전원의 능력치를 올립니다</small></div>
              <div id="growth-element-tabs" class="growth-element-tabs"></div>
              <div id="growth-upgrade-list" class="growth-upgrade-list"></div>
            </section>
          </div>
          <div class="focus-panel-summary">
            <p id="growth-panel-dismantle">분해 가능 0기</p>
            <button id="growth-frame-open" class="focus-open-button" type="button">제련소 열기</button>
          </div>
        </section>
      </div>

      <section id="composition-drawer" class="composition-drawer" aria-label="선택 자령 파생 합성" aria-hidden="true">
        <header class="composition-drawer-heading">
          <div><span>파생 합성</span><strong><b id="composition-source-glyph">-</b> 파생 합성</strong></div>
          <p><em id="composition-ready-count">0</em>개 합성 가능</p>
          <button id="composition-drawer-close" type="button" aria-label="파생 합성 닫기">×</button>
        </header>
        <div id="composition-source" class="composition-source"></div>
        <div id="composition-branches" class="composition-branches"></div>
        <footer><b>컬러</b>: 합성 가능 · <i>회색</i>: 재료 부족 · 전장/인벤 모두 계산</footer>
      </section>

      <nav class="panel-tabs" role="tablist" aria-label="상세 정보">
        <button id="shop-tab" type="button" class="is-active" data-panel-tab="shop" role="tab" aria-selected="true">상점 <small id="shop-pool-count">0</small></button>
        <button type="button" data-panel-tab="unit" role="tab" aria-selected="false">자령</button>
        <button id="run-inventory-tab" type="button" data-panel-tab="inventory" role="tab" aria-selected="false">인벤 <small id="run-inventory-count">0</small></button>
        <i class="tab-divider" aria-hidden="true"></i>
        <button type="button" data-panel-tab="evolution" role="tab" aria-selected="false"><span id="evolution-tab-label">합성</span></button>
        <button id="concentration-tab" type="button" data-panel-tab="concentration" role="tab" aria-selected="false">농축</button>
        <button id="growth-tab" type="button" data-panel-tab="growth" role="tab" aria-selected="false">강화</button>
        <i class="tab-divider" aria-hidden="true"></i>
        <button id="goal-tab" type="button" data-panel-tab="goal" role="tab" aria-selected="false">목표 <small id="goal-tab-progress">0%</small></button>
        <button id="idiom-tab" type="button" data-panel-tab="idiom" role="tab" aria-selected="false">성어 <small id="idiom-tab-count">0/5</small></button>
        <button id="record-tab" type="button" data-panel-tab="record" role="tab" aria-selected="false">기록</button>
      </nav>


      <footer class="panel-footer">
        <span><b id="message-value">지역과 목표 한자를 선택하세요.</b><span id="footer-seed" class="footer-seed"> · 시드 <b id="seed-value">-</b></span></span>
      </footer>
    </aside>

    <div id="coach-layer" class="coach-layer" aria-live="polite" hidden>
      <div id="coach-ring" class="coach-ring" aria-hidden="true"></div>
      <div id="coach-bubble" class="coach-bubble" role="dialog" aria-labelledby="coach-title">
        <p class="coach-step"><span id="coach-index">1</span> / <span id="coach-total">3</span></p>
        <b id="coach-title"></b>
        <p id="coach-body"></p>
        <div class="coach-actions">
          <button id="coach-skip" type="button" class="coach-skip">건너뛰기</button>
          <button id="coach-next" type="button" class="coach-next">다음</button>
        </div>
      </div>
    </div>

    <section id="title-overlay" class="modal-layer modal-layer--visible" aria-labelledby="title-heading">
      <div class="s00-stage" data-screen-id="S00">
        <img class="s00-env s00-env--legacy" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/background/S00-living-codex-empty-1280x720-v1.png" alt="" aria-hidden="true" />
        <div id="s00-parallax" class="s00-parallax" aria-hidden="true">
          <img id="s00-desk" class="s00-env s00-env--desk" src="${import.meta.env.BASE_URL}assets/ui/s00-layers-v1/S00-bg-desk-v2.png" alt="" aria-hidden="true" />
          <img id="s00-book" class="s00-env s00-env--book" src="${import.meta.env.BASE_URL}assets/ui/s00-layers-v1/S00-bg-book-v2.png" alt="" aria-hidden="true" />
          <img id="s00-foreground" class="s00-env s00-env--foreground" src="${import.meta.env.BASE_URL}assets/ui/s00-layers-v1/S00-fg-props-v2.png" alt="" aria-hidden="true" />
        </div>

        <div class="s00-title-plaque">
          <h2 id="title-heading">천자진</h2>
          <span>오행 자령 디펜스</span>
          <small>Thousand Glyphs: Elemental Defense</small>
        </div>

        <nav class="s00-utility" aria-label="보조 메뉴">
          <button id="s00-codex-button" type="button"><i class="s00-skin" aria-hidden="true"></i><b>冊</b><span>도감</span></button>
          <button id="title-settings-button" type="button" aria-label="화면 모드 설정"><i class="s00-skin" aria-hidden="true"></i><b>⚙</b><span>설정</span></button>
          <button id="title-help-button" type="button"><i class="s00-skin" aria-hidden="true"></i><b>?</b><span>도움말</span></button>
        </nav>

        <p class="s00-mode-label">진법 선택</p>
        <div class="s00-modes" role="radiogroup" aria-label="진법 선택">
          <button type="button" class="s00-mode game-mode-option is-selected" data-game-mode-option="standard" role="radio" aria-checked="true"
            aria-label="자형연성 진법. 실제 한자 구성식으로 합성하고 목표 계보를 완성하는 진법">
            <i class="s00-skin" aria-hidden="true"></i><b>자형연성 진법</b><small aria-hidden="true"><span class="s00-mode-sub s00-mode-sub--full">실제 한자 구성식 · 목표 계보</span><span class="s00-mode-sub s00-mode-sub--compact">구성식 합성 · 계보 목표</span></small><em>선택됨</em>
          </button>
          <button type="button" class="s00-mode game-mode-option" data-game-mode-option="casual" role="radio" aria-checked="false"
            aria-label="별승급 진법. 같은 오행·같은 별 3기를 모아 다음 별 자령을 얻는 진법. 최고 8성">
            <i class="s00-skin" aria-hidden="true"></i><b>별승급 진법</b><small aria-hidden="true"><span class="s00-mode-sub s00-mode-sub--full">같은 오행·같은 별 3기 → 다음 별 · 최고 8성</span><span class="s00-mode-sub s00-mode-sub--compact">3합 승급 · 최고 8성</span></small><em>선택됨</em>
          </button>
        </div>

        <div class="s00-showcase" aria-hidden="true">
          <figure style="left:455px;top:116px"><img class="s00-ring" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-wood-v1.png" alt="" /><img class="s00-spirit" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-wood-orchid-frame-v1.png" alt="" /></figure>
          <figure style="left:803px;top:112px"><img class="s00-ring" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-earth-v1.png" alt="" /><img class="s00-spirit" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-earth-pottery-frame-v1.png" alt="" /></figure>
          <figure style="left:368px;top:334px"><img class="s00-ring" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-water-v1.png" alt="" /><img class="s00-spirit" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-water-ice-frame-v1.png" alt="" /></figure>
          <figure style="left:637px;top:336px"><img class="s00-ring" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-fire-v1.png" alt="" /><img class="s00-spirit" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-fire-fox-frame-v1.png" alt="" /></figure>
          <figure style="left:965px;top:333px"><img class="s00-ring" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-metal-v1.png" alt="" /><img class="s00-spirit" src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-metal-mirror-frame-v1.png" alt="" /></figure>
        </div>

        <button id="custom-formation-button" class="s00-custom" type="button"
          title="맞춤 진법 — 한자 범위·읽기 표기·진법 규칙을 한 화면에서" aria-label="맞춤 진법. 한자 범위와 읽기 표기, 진법 규칙을 설정합니다">
          <i class="s00-skin" aria-hidden="true"></i><b>맞춤 진법</b><small>범위 · 표기 · 규칙</small><small class="s00-reason">설정 열기</small>
        </button>

        <div class="s00-regions" role="radiogroup" aria-label="지역 한자 체계">
          <button type="button" class="s00-region region-option is-selected" data-region="KR" role="radio" aria-checked="true">
            <i class="s00-skin" aria-hidden="true"></i><b>한국</b><small class="s00-badge">기본 추천</small>
          </button>
          <button type="button" class="s00-region region-option" data-region="JP" role="radio" aria-checked="false">
            <i class="s00-skin" aria-hidden="true"></i><b>일본</b><small class="s00-badge s00-badge--ea">미리 해보기</small>
          </button>
          <button type="button" class="s00-region region-option" data-region="CN" role="radio" aria-checked="false">
            <i class="s00-skin" aria-hidden="true"></i><b>중국</b><small class="s00-badge s00-badge--ea">미리 해보기</small>
          </button>
        </div>

        <div class="s00-summary" aria-live="polite">
          <strong id="s00-summary-main">한국 · 자형연성 진법</strong>
          <span id="title-note">가장 완성된 콘텐츠</span>
          <span id="title-lead" hidden></span>
        </div>
        <p class="s00-ea-note">일본·중국은 도감·현지화·밸런스 보강 중입니다.</p>

        <label class="s00-seed">런 시드<input id="seed-input" maxlength="24" spellcheck="false" /></label>
        <button id="seed-reroll-button" type="button" aria-label="새 시드 생성" title="새 시드">⟲</button>

        <button id="start-button" class="s00-start" type="button" data-testid="start-run">
          <i class="s00-skin" aria-hidden="true"></i><b>출정</b><small id="s00-start-sub">한국 천자문 1,000</small>
        </button>
      </div>

      <dialog id="p00-dialog" class="p00-dialog" data-popup-id="P00" aria-labelledby="p00-title">
        <div class="p00-frame">
          <p class="s00-mode-label">미리 해보기 안내</p>
          <h3 id="p00-title">일본 한자 체계</h3>
          <p id="p00-body">이 지역은 도감 설명과 읽기, 난이도를 아직 다듬는 중입니다.<br />가장 완성된 체계는 한국 천자문 1,000자입니다.</p>
          <div class="p00-actions">
            <button id="p00-return" type="button" autofocus>한국으로 돌아가기</button>
            <button id="p00-continue" type="button">일본으로 계속</button>
          </div>
        </div>
      </dialog>

      <dialog id="s13-dialog" class="p00-dialog s13-dialog" data-popup-id="S13" aria-labelledby="s13-title">
        <div class="p00-frame s13-frame">
          <p class="s00-mode-label">맞춤 진법</p>
          <h3 id="s13-title">범위 · 표기 · 규칙</h3>

          <div class="s13-group" role="radiogroup" aria-label="한자 범위">
            <span class="s13-group-label">한자 범위</span>
            <div class="s13-options">
              <button type="button" data-s13-region="KR" role="radio"><b>한국</b><small>천자문 1,000</small></button>
              <button type="button" data-s13-region="JP" role="radio"><b>일본</b><small>상용한자 2,136</small></button>
              <button type="button" data-s13-region="CN" role="radio"><b>중국</b><small>규범한자 3,500</small></button>
            </div>
          </div>

          <div class="s13-group" aria-label="읽기 표기">
            <span class="s13-group-label">읽기 · 표기</span>
            <div class="s13-options">
              <button type="button" data-s13-display="spirit" role="radio"><b>자령 모드</b><small>머리 위 훈음 명패</small></button>
              <button type="button" data-s13-display="study" role="radio"><b>공부 모드</b><small>큰 한자와 읽기</small></button>
              <button type="button" id="s13-emphasis" aria-pressed="true"><b>한자 강조</b><small class="s13-state">ON</small></button>
              <button type="button" id="s13-hover-glyph" aria-pressed="true"><b>큰 한자 미리보기</b><small class="s13-state">ON</small></button>
            </div>
          </div>

          <div class="s13-group" aria-label="진법 규칙">
            <span class="s13-group-label">진법 규칙</span>
            <div class="s13-options">
              <button type="button" data-s13-mode="standard" role="radio"><b>자형연성</b><small>실제 구성식 합성</small></button>
              <button type="button" data-s13-mode="casual" role="radio"><b>별승급</b><small>3기 소모 · 다음 별 무작위</small></button>
              <button type="button" id="s13-autoplace" aria-pressed="true"><b>소환 자동 배치</b><small class="s13-state">ON</small></button>
            </div>
          </div>

          <div class="p00-actions"><button id="s13-close" type="button">닫기</button></div>
        </div>
      </dialog>
    </section>

    <section id="end-overlay" class="modal-layer" aria-labelledby="end-heading">
      <div class="end-card">
        <p id="end-kicker" class="eyebrow">봉인 결과</p>
        <h2 id="end-heading">봉인전 종료</h2>
        <p id="end-message"></p>
        <div id="end-stats" class="end-stats"></div>
        <div class="end-actions">
          <button id="retry-button" class="start-button" type="button">같은 시드 재도전</button>
          <button id="new-seed-button" class="secondary-button" type="button">새 시드로 시작</button>
          <button id="return-menu-button" class="secondary-button" type="button">메뉴로 돌아가기</button>
        </div>
      </div>
    </section>

    <dialog id="help-dialog" class="help-dialog">
      <form method="dialog">
        <div class="dialog-heading"><div><p class="eyebrow">놀이 방법</p><h2>봉인술 입문</h2></div><button aria-label="도움말 닫기">×</button></div>
        <div class="help-quickstart"><b>처음이라면</b><span><i>①</i> 소환(1키)으로 자령 뽑기</span><span><i>②</i> 첫 오행진이 무료로 열림</span><span><i>③</i> 시작 버튼으로 웨이브 개시</span><small class="help-glossary">자령=타워 · 엽전=골드 · 문기=오행 재료 · 濃=농축 단계(최고 3) · 봉인=적 처치, 또는 사자성어 발동</small></div>
        <ol>
          <li><b>소환</b><span>지역별 1단계 한자를 품은 자령이 무작위로 나옵니다. 목표에 모자란 재료는 뽑을수록 확률이 올라갑니다.</span></li>
          <li><b>목적 소환</b><span>네 가지 중 하나를 고릅니다. <em>균형</em>은 목표와 성어 재료를 고루 섞고, <em>탐색</em>은 아직 못 본 한자를 우선하며, <em>계보</em>는 목표 계보의 재료만 노리고(12회마다 재료 1기 보장 · 30회 누적 시 확정 지급), <em>중복 수집</em>은 농축과 분해에 쓸 보유 한자를 다시 부릅니다.</span></li>
          <li><b>오행 공명</b><span>같은 진에 그 진의 오행 자령을 4·8·12·16기 모으면 단계가 올라가고, 단계마다 그 진의 피해가 더해집니다. 자동배치가 알려 주는 "오행 공명 N→M단계"가 이 값입니다.</span></li>
          <li><b>인연 연구</b><span>엽전을 들여 목표 재료가 나올 가중치를 올립니다. 최고 5단계이며 각 단계는 정해진 웨이브를 지나야 열립니다(3키).</span></li>
          <li><b>10연 소환</b><span>10웨이브를 지키면 개방됩니다. Q키 또는 10연 버튼으로 현재 소환 비용 10회를 한 번에 지불합니다.</span></li>
          <li><b>합성</b><span>실제 구성식의 재료를 모두 보유하면 조합 서책에 카드가 열립니다. 木+木처럼 같은 글자 두 개도 각각 필요합니다.</span></li>
          <li><b>별승급 진법</b><span>천자문 실제 획수로 기본 별이 정해집니다. 같은 오행·같은 현재 별 자령 3기를 고르면 3기가 모두 사라지고 같은 오행의 다음 별 자령 1기를 무작위로 얻으며 최고 8성입니다. 잠금·농축·목표·사자성어 자령은 소모 대상에서 빠집니다.</span></li>
          <li><b>방식</b><span>반자동은 가능한 조합만 제안합니다. 목표 자동은 목표 경로의 조합만 자동 실행하며, 수동은 선택한 한자가 포함된 조합만 봅니다.</span></li>
          <li><b>사자성어</b><span>이웃한 네 칸에 글자를 올바른 순서로 배치하면 자동 봉인됩니다. 직접 선을 그을 필요가 없으며, 보너스는 그 런 동안 계속 유지됩니다.</span></li>
          <li><b>첫 오행진</b><span>열린 진 없이 상점에서 시작합니다. 첫 소환 자령과 같은 오행진이 무료로 열리고, 나머지는 원하는 순서로 18·32·52·78엽전에 개방합니다.</span></li>
          <li><b>자동배치</b><span>런 인벤토리 자령을 현재 개방된 오행진에 투입하고, 완성 가능한 사자성어와 오행 공명을 함께 정리합니다.</span></li>
          <li><b>은행 이자</b><span>웨이브 종료 시 보유 엽전 20개당 1엽전을 지급하며, 한 번에 최대 20엽전까지만 받을 수 있습니다.</span></li>
          <li><b>훈·독</b><span>기본 자령 모드는 머리 위 한자·훈음을 표시합니다. 한자 강조를 끄면 머리 위 표찰은 숨기고 별만 남깁니다. 설정의 공부 모드는 전장에 큰 한자와 짧은 읽기를 표시하며, 선택 카드와 도감에서는 자세한 훈음·음독·훈독·병음과 뜻을 확인합니다.</span></li>
          <li><b>전투</b><span>웨이브 약점 오행은 피해가 30% 증가합니다. 水→木→火→土→金→水 상생을 함께 배치하면 추가 피해를 줍니다.</span></li>
          <li><b>강화 탭</b><span>인벤토리 자령을 보호 규칙 아래 일괄 분해하고, 공용·오행 5능력치×99단계와 오행별 고유 특성 3종×10단계를 한 화면에서 투자합니다.</span></li>
          <li><b>능력 조합</b><span>모든 한자는 오행 효과·전투 역할·조합망 패시브를 가집니다. 합성 한자는 재료의 오행도 계승해 주기 추가타를 얻습니다.</span></li>
          <li><b>잠금</b><span>선택한 자령을 잠그면 공격·이동은 유지되지만 합성 재료와 판매 대상에서는 제외됩니다.</span></li>
          <li><b>자령 도감</b><span>전체 한자와 천자문 자령을 한 화면에서 봅니다. 별·독립 여부·조합표·쉬운 훈 풀이와 자령 초상화를 함께 확인합니다.</span></li>
          <li><b>런 인벤토리</b><span>동일한 한자는 한 스택으로 묶입니다. 인벤토리 자령을 고른 뒤 빈 칸을 누르면 배치하고, 찬 칸을 누르면 기존 자령을 인벤토리로 보내며 즉시 교체합니다.</span></li>
          <li><b>농축 공방</b><span>같은 한자 중복 1기 또는 같은 오행 문기 4·6·8을 직접 고릅니다. 최초 연속·심화 분기는 영구 고정되며 실행 전 전후 전투 수치를 비교합니다.</span></li>
          <li><b>지도 배율</b><span>기존 260% 크기를 새 100% 기준으로 사용합니다. 휠로 약 28%~200% 확대·축소하고, 빈 칸·길에서 좌클릭 드래그하거나 휠 버튼을 누른 채 드래그하면 지도를 이동합니다. 왼쪽 아래 배율 버튼은 중앙 정렬된 100%로 돌아갑니다.</span></li>
          <li><b>게임 배속</b><span>오른쪽 위 배속 버튼이나 F키로 1×·2×·3×를 순환합니다.</span></li>
          <li><b>게임오버</b><span>적은 경로 끝에서 사라지지 않고 계속 순환합니다. 전장에 ${MAX_ENEMIES}체가 쌓이거나 우두머리를 제한시간 안에 처치하지 못하면 즉시 실패합니다. 제어 능력은 적을 뒤로 밀지 않고 현재 공격권 안에서 감속·봉쇄합니다.</span></li>
        </ol>
        <div class="key-guide"><span><kbd>1</kbd> 소환</span><span><kbd>Q</kbd> 10연</span><span><kbd>2</kbd> 첫 합성</span><span><kbd>3</kbd> 연구</span><span><kbd>Space</kbd> 한자 강조</span><span><kbd>F</kbd> 배속</span><span><kbd>P</kbd> 일시정지</span><span><kbd>C</kbd> 도감</span><span><kbd>M</kbd> 음소거</span></div>
        <p>정예 철갑 강시(방어 높음)·질풍 아귀(빠름)·백귀야행(다수)·회생 요괴(체력 회복)의 특성을 미리 확인하세요. 놓친 적도 사라지지 않고 다음 바퀴를 돌기 때문에 누적 수를 계속 관리해야 합니다.</p>
      </form>
    </dialog>

    <dialog id="settings-dialog" class="settings-dialog">
      <div class="dialog-heading">
        <div><p class="eyebrow">화면 설정</p><h2>전장 표시 모드</h2></div>
        <button id="settings-close" type="button" aria-label="설정 닫기">×</button>
      </div>
      <p class="settings-intro">게임 규칙은 그대로 유지됩니다. 전장 표시와 배경음악·효과음 믹스를 기기에 맞게 저장합니다.</p>
      <div class="display-mode-options" role="radiogroup" aria-label="전장 표시 모드">
        <button type="button" class="display-mode-option" data-display-mode-option="spirit" role="radio" data-testid="spirit-mode">
          <span class="mode-preview mode-preview--spirit" style="background-image:url('${import.meta.env.BASE_URL}assets/jaryeongs/wood-mok/sheet-transparent.png')" aria-hidden="true"></span>
          <span><b>자령 모드</b><em>기본 모드</em><small>기존 자령 이미지와 머리 위 한자·훈음을 함께 표시합니다.</small></span>
        </button>
        <button type="button" class="display-mode-option" data-display-mode-option="study" role="radio" data-testid="study-mode">
          <span class="mode-preview mode-preview--study" aria-hidden="true"><b>木</b><small>나무 목</small></span>
          <span><b>공부 모드</b><em>학습 집중</em><small>기존의 큰 한자 원형과 짧은 읽기를 전장에 직접 표시합니다.</small></span>
        </button>
      </div>
      <button id="auto-place-toggle" class="settings-toggle" type="button" role="switch" aria-checked="true" data-testid="auto-place-toggle">
        <span><b>뽑기 후 자동 배치</b><small>켜면 현재처럼 빈 오행진 칸에 즉시 배치합니다. 끄면 런 인벤토리에서 원하는 칸을 고릅니다.</small></span>
        <i aria-hidden="true"><em>ON</em></i>
      </button>
      <button id="hover-glyph-toggle" class="settings-toggle" type="button" role="switch" aria-checked="true" data-testid="hover-glyph-toggle">
        <span><b>팝오버 큰 한자</b><small>자령에 마우스를 올리면 한자를 크게 보여줍니다.</small></span>
        <i aria-hidden="true"><em>ON</em></i>
      </button>
      <section class="audio-settings" aria-labelledby="audio-settings-title">
        <div class="audio-settings-heading"><b id="audio-settings-title">오디오 믹스</b><small>첫 조작 뒤 재생 · 선택은 브라우저에 저장</small></div>
        <div class="audio-setting-row">
          <span><b>배경음악</b><small>웨이브 구간·우두머리 상태에 따라 3초 크로스페이드</small></span>
          <label for="bgm-volume"><span>음량</span><input id="bgm-volume" type="range" min="0" max="100" step="1" aria-label="배경음악 음량" /><output id="bgm-volume-output" for="bgm-volume">60%</output></label>
          <button id="bgm-mute-button" class="audio-mute-button" type="button" role="switch" aria-checked="true">ON</button>
        </div>
        <div class="audio-setting-row">
          <span><b>효과음</b><small>핵심 행동은 MP3, 잦은 타격·능력은 저자극 합성음</small></span>
          <label for="sfx-volume"><span>음량</span><input id="sfx-volume" type="range" min="0" max="100" step="1" aria-label="효과음 음량" /><output id="sfx-volume-output" for="sfx-volume">72%</output></label>
          <button id="sfx-mute-button" class="audio-mute-button" type="button" role="switch" aria-checked="true">ON</button>
        </div>
      </section>
      <button id="replay-coach-button" class="settings-toggle settings-toggle--action" type="button">
        <span><b>처음 안내 다시 보기</b><small>소환·전장 조작·웨이브 시작을 짚어 주는 3단계 안내를 다시 띄웁니다.</small></span>
        <i aria-hidden="true"><em>보기</em></i>
      </button>
      <p class="settings-source">자령 머리 위에는 짧은 훈음을 표시하고, 자세한 부수 정보는 선택 카드와 도감에서 확인할 수 있습니다.</p>
    </dialog>

    <dialog id="element-upgrade-dialog" class="element-upgrade-dialog">
      <div class="dialog-heading">
        <div><p class="eyebrow">무한 제련</p><h2>공용·오행 능력 강화</h2></div>
        <button id="element-upgrade-close" type="button" aria-label="오행 강화 닫기">×</button>
      </div>
      <p class="element-upgrade-intro">엽전은 모든 자령의 공용 능력치에, 분해 문기는 해당 오행 능력치에 투자합니다. 각 항목은 최고 99단계이며 이번 런 동안 유지됩니다.</p>
      <div class="upgrade-section-heading"><div><b>공용 강화</b><span>엽전 사용 · 모든 자령 적용</span></div><em id="global-upgrade-total">0단계</em></div>
      <div id="global-upgrade-list" class="global-upgrade-list"></div>
      <div class="upgrade-section-heading"><div><b>오행 강화</b><span>각 오행 문기 사용 · 해당 오행만 적용</span></div><em id="element-essence-dialog-summary">木0 火0 土0 金0 水0</em></div>
      <div id="element-upgrade-list" class="element-upgrade-list"></div>
      <p class="element-upgrade-note">공격 속도 보너스는 기본 공격 주기를 나누는 방식으로 적용해 고단계에서도 폭주하지 않습니다. 사거리를 제외한 수치는 누적 보너스입니다.</p>
    </dialog>

    <dialog id="ability-guide-dialog" class="ability-guide-dialog" aria-labelledby="ability-guide-title">
      <div class="dialog-heading">
        <div><p class="eyebrow">자동 발동 기술</p><h2 id="ability-guide-title">자령 기술 안내</h2></div>
        <button id="ability-guide-close" type="button" aria-label="기술 안내 닫기">×</button>
      </div>
      <div id="ability-guide-content" class="ability-guide-content"></div>
    </dialog>

    <dialog id="formation-unlock-dialog" class="p00-dialog formation-unlock-dialog" data-popup-id="F01" aria-labelledby="formation-unlock-title">
      <div class="p00-frame formation-unlock-frame">
        <p class="s00-mode-label">오행진 해금</p>
        <h3 id="formation-unlock-title"><b id="formation-unlock-glyph">火</b><span id="formation-unlock-label">화진 해금</span></h3>
        <p id="formation-unlock-body">18엽전이 필요합니다. 해금하면 4×4 칸이 열립니다.</p>
        <p id="formation-unlock-reason" class="formation-unlock-reason" hidden></p>
        <div class="p00-actions">
          <button id="formation-unlock-confirm" type="button" data-testid="formation-unlock-confirm">해금 · <em id="formation-unlock-price">18</em>엽전</button>
          <button id="formation-unlock-close" type="button">닫기</button>
        </div>
      </div>
    </dialog>

    <dialog id="casual-fusion-confirm-dialog" class="casual-fusion-confirm-dialog" aria-labelledby="casual-fusion-confirm-title">
      <div class="dialog-heading">
        <div><p class="eyebrow">삼체 일득</p><h2 id="casual-fusion-confirm-title">3체 조합 확인</h2></div>
        <button id="casual-fusion-confirm-close" type="button" aria-label="조합 확인 닫기">×</button>
      </div>
      <div id="casual-fusion-confirm-content" class="casual-fusion-confirm-content"></div>
      <div class="casual-fusion-confirm-actions"><button id="casual-fusion-cancel" type="button">취소</button><button id="casual-fusion-execute" type="button">소모 확인 · 조합</button></div>
    </dialog>

    <dialog id="codex-dialog" class="codex-dialog is-jaryeong-dex">
      <div class="dialog-heading codex-heading">
        <div><p id="codex-kicker" class="eyebrow">자령 기록</p><h2><span id="codex-region">한국</span><span id="codex-title-label"> 통합 자령 도감</span></h2></div>
        <button id="codex-close" type="button" aria-label="도감 닫기">×</button>
      </div>
      <div class="codex-toolbar">
        <div class="codex-mode-tabs" role="tablist" aria-label="도감 분류">
          <button type="button" class="is-active" data-codex-mode="hanzi" role="tab" aria-selected="true">자령 도감 <small>${CHEONJAMUN_JARYEONG_DEX_META.total}+</small></button>
          <button type="button" data-codex-mode="recipes" role="tab" aria-selected="false">조합표</button>
          <button type="button" data-codex-mode="idioms" role="tab" aria-selected="false">사자성어</button>
        </div>
        <div id="codex-synthesis-filters" class="codex-synthesis-filters" role="group" aria-label="합성 단계 분류"></div>
        <div class="codex-search-row">
          <input id="codex-search" type="search" maxlength="40" placeholder="한자·훈음·능력 검색" />
          <span id="codex-summary"></span>
        </div>
      </div>
      <div class="codex-layout">
        <div id="codex-list" class="codex-list"></div>
        <aside id="codex-detail" class="codex-detail"></aside>
      </div>
      <p id="codex-note" class="codex-note">훈음의 낯선 옛말은 오늘말 뜻풀이와 용례로 풀어 표시합니다. 별 등급, 독립 자령, 조합 경로는 서로 다른 표식으로 구분합니다.</p>
    </dialog>
  </main>
`;

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("Missing element: " + selector);
  return element;
}

const shell = must<HTMLElement>(".game-shell");
const canvas = must<HTMLCanvasElement>("#battle-canvas");
const canvasContext = canvas.getContext("2d");
if (!canvasContext) throw new Error("Canvas 2D context is unavailable.");
const context: CanvasRenderingContext2D = canvasContext;
const seedInput = must<HTMLInputElement>("#seed-input");
const titleOverlay = must<HTMLElement>("#title-overlay");
/**
 * S00 2D 폴백(`?menu3d=0`)의 3레이어 배경.
 *
 * 출처: handoff/to-claude/s00-layered-bg-pack-v1/assets/
 * 설치: public/assets/ui/s00-layers-v1/
 *
 * 세 장이 전부 도착했을 때만 기존 단일 배경을 끈다. 한 장이라도 실패하면
 * 합성이 어긋난 채 보이느니 원래 한 장짜리 배경을 그대로 쓴다. 다섯 먹 고리는
 * 책 레이어 RGB 에 그대로 있으므로 좌표가 바뀌지 않는다.
 */
(function initS00ParallaxLayers(): void {
  const group = document.querySelector<HTMLElement>("#s00-parallax");
  if (!group) return;
  const layers = Array.from(group.querySelectorAll<HTMLImageElement>("img"));
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
    if (image.complete) {
      settle(image.naturalWidth > 0, image);
      continue;
    }
    image.addEventListener("load", () => settle(true, image), { once: true });
    image.addEventListener("error", () => settle(false, image), { once: true });
  }
})();

const endOverlay = must<HTMLElement>("#end-overlay");
const toast = must<HTMLElement>("#toast");
const bossBanner = must<HTMLElement>("#boss-banner");
const combatFeed = must<HTMLOListElement>("#combat-feed");
const comboMeter = must<HTMLElement>("#combo-meter");
const idiomResult = must<HTMLElement>("#idiom-result");
const idiomTab = must<HTMLButtonElement>("#idiom-tab");
const helpDialog = must<HTMLDialogElement>("#help-dialog");
const settingsDialog = must<HTMLDialogElement>("#settings-dialog");
const elementUpgradeDialog = must<HTMLDialogElement>("#element-upgrade-dialog");
const abilityGuideDialog = must<HTMLDialogElement>("#ability-guide-dialog");
const casualFusionConfirmDialog = must<HTMLDialogElement>("#casual-fusion-confirm-dialog");
const codexDialog = must<HTMLDialogElement>("#codex-dialog");
const summonReveal = must<HTMLElement>("#summon-reveal");
const fusionVortex = must<HTMLElement>("#fusion-vortex");
const sound = new SoundManager();
sound.attachUiSfx(document);
if (import.meta.env.DEV) Object.assign(window, { __HANJA_AUDIO_QA__: sound });
const initialSeed = new URLSearchParams(window.location.search).get("seed")?.slice(0, 24) || createRunSeed();
seedInput.value = initialSeed;
let selectedRegion: RegionCode = "KR";
let pendingRegion: RegionCode | null = null;
let formationUnlockHintShown = false;
let selectedGameMode: GameMode = "standard";

/*
 * 진법 이름은 여기서만 만든다.
 *
 * 같은 모드가 화면마다 '전략 조합전'·'캐주얼 8성전'·'자형연성 진법'·
 * '별승급 진법' 네 이름으로 불려서, 메뉴에서 고른 것과 시작 토스트·
 * 종료 화면에 뜨는 것이 서로 다른 게임처럼 읽혔다. S00 메뉴가 쓰는
 * 이름으로 통일한다.
 */
function gameModeLabel(mode: GameMode): string {
  return mode === "casual" ? "별승급 진법" : "자형연성 진법";
}

let displayMode: DisplayMode = initialDisplayMode;
let engine = new GameEngine(initialSeed, selectedRegion, selectedGameMode);
let mapSynthesisDepths = buildSynthesisDepths(engine.catalog.definitions.values());
let mapUncombinableStageOne = buildUncombinableStageOneChars(engine.catalog.definitions.values());
engine.state.autoPlaceSummons = initialAutoPlaceSummons;
let previousPhase: RunPhase = "title";
let lastFrame = performance.now();
let summonRevealTimer = 0;
let fusionVortexTimer = 0;
let toastAnimation: Animation | null = null;
let waveBannerAnimation: Animation | null = null;
let hoveredRecipeId: string | null = null;
let hoveredCompositionMaterialIds = new Set<number>();
let compositionDrawerOpen = false;
let compositionRenderKey = "";

function setCompositionMaterialHighlight(ids: readonly number[] = []): void {
  hoveredCompositionMaterialIds = new Set(ids);
  canvas.dataset.compositionMaterialCount = String(hoveredCompositionMaterialIds.size);
}
let evolutionRenderKey = "";
let goalRenderKey = "";
let selectedRenderKey = "";
let runInventoryRenderKey = "";
let idiomRenderKey = "";
let elementUpgradeRenderKey = "";
let formationRenderKey = "";
let concentrationRenderKey = "";
let growthRenderKey = "";
let comboTimer = 0;
let comboCount = 0;
let lastKillAt = 0;
const feedCooldowns = new Map<string, number>();
const lastAbilityFxByTower = new Map<number, number>();
let lastGlobalAbilityFxAt = -10;
type PanelTab = "shop" | "unit" | "inventory" | "evolution" | "concentration" | "growth" | "goal" | "idiom" | "record";
type GoalPanelMode = "hanzi" | "idiom";
type CodexMode = "hanzi" | "recipes" | "idioms";
type JaryeongDexFilter = "all" | Wuxing;
let codexMode: CodexMode = "hanzi";
let codexSynthesisDepth: SynthesisTierFilter = "all";
let jaryeongDexFilter: JaryeongDexFilter = "all";
let selectedCodexChar = CHEONJAMUN_JARYEONG_DEX_ENTRIES[0]?.hanja ?? "";
/** 성어 카드에도 한자 카드와 같은 선택 표시를 준다(항목 17). */
let selectedCodexIdiomId = "";
let goalPanelMode: GoalPanelMode = "hanzi";
let goalSearchQuery = "";
let activePanelTab: PanelTab = "shop";
let concentrationTargetId: number | null = null;
let concentrationPath: ConcentrationPath = "swift";
let concentrationPayment: "essence" | number = "essence";
let growthElement: Wuxing = "木";
const dismantleSelection = new Set<number>();
let casualFusionSelection: number[] = [];
let casualManualOpen = false;
type PendingCasualFusion = { kind: "manual"; materialIds: [number, number, number]; quote: CasualFusionQuote };
let pendingCasualFusion: PendingCasualFusion | null = null;
let projectileSpriteDrawTotal = 0;
let abilityZoneSpriteDrawTotal = 0;

interface ProjectileFx {
  from: Point;
  to: Point;
  color: string;
  age: number;
  duration: number;
  critical: boolean;
  wuxing: Wuxing;
}

interface FloatFx {
  at: Point;
  text: string;
  color: string;
  age: number;
  duration: number;
  large: boolean;
}

interface RingFx {
  at: Point;
  color: string;
  age: number;
  duration: number;
}

interface AbilityBurstFx {
  at: Point;
  source: Point;
  glyph: string;
  color: string;
  kind: AbilityFxKind;
  age: number;
  duration: number;
}

interface TowerAbilityPopup {
  text: string;
  color: string;
  age: number;
  duration: number;
}

const projectiles: ProjectileFx[] = [];
const floaters: FloatFx[] = [];
const rings: RingFx[] = [];
const abilityBursts: AbilityBurstFx[] = [];
const projectilePool: ProjectileFx[] = [];
const floaterPool: FloatFx[] = [];
const ringPool: RingFx[] = [];
const abilityBurstPool: AbilityBurstFx[] = [];
const towerAbilityPopups = new Map<number, TowerAbilityPopup>();

/**
 * p1-p2-polish-assets-pack-v1 의 일회성 래스터 연출(별승급 고리·사자성어 봉인).
 * 순수 피드백이라 승급·봉인 규칙이나 수치에는 관여하지 않는다. 에셋이 없으면
 * 이 연출만 건너뛰고 상태 전이는 그대로 진행된다.
 */
interface RasterBurstFx {
  readonly image: HTMLImageElement;
  readonly at: Point;
  readonly size: number;
  age: number;
}
const rasterBursts: RasterBurstFx[] = [];
/** 0~120ms 0.72→1.05, 120~520ms 1.0 으로 안착, 900ms 에 소멸. */
const RASTER_BURST_LIFE = 0.9;

function pushRasterBurst(image: HTMLImageElement, at: Point, size: number): void {
  if (!isPolishSpriteReady(image)) return;
  if (rasterBursts.length >= 8) rasterBursts.shift();
  rasterBursts.push({ image, at: { x: at.x, y: at.y }, size, age: 0 });
}

/**
 * 봉인 발동 파문 — 코덱스 파문 마스크를 성어 색으로 물들여 네 칸에 한 번씩 띄운다.
 * `delay` 로 1번 칸부터 차례로 터뜨려 "이 넷이 이 순서"라는 사실을 한 번 더 말한다.
 */
interface IdiomRippleFx {
  at: Point;
  color: string;
  age: number;
  delay: number;
  duration: number;
}
/** 발동 순간 뜨는 성어 4자 대형 플래시. 카메라가 어디에 있든 보이도록 화면 좌표로 그린다. */
interface IdiomFlashFx {
  chars: string;
  reading: string;
  color: string;
  at: Point;
  age: number;
  duration: number;
}
const idiomRipples: IdiomRippleFx[] = [];
let idiomFlash: IdiomFlashFx | null = null;

function pushPooled<T>(active: T[], pool: T[], item: T, limit: number): void {
  if (active.length >= limit) {
    const recycled = active.shift();
    if (recycled && pool.length < limit) pool.push(recycled);
  }
  active.push(item);
}

function takeProjectile(event: Extract<GameEvent, { type: "shot" }>): ProjectileFx {
  const item = projectilePool.pop() ?? { from: event.from, to: event.to, color: event.color, age: 0, duration: 0.1, critical: false, wuxing: event.wuxing };
  item.from = event.from;
  item.to = event.to;
  item.color = event.color;
  item.age = 0;
  // Combat simulation may run at 2x/3x, but projectile readability is a
  // presentation concern. `frame()` advances these FX with real time, and a
  // slightly longer flight keeps the raster silhouette visible without
  // turning the battlefield into a persistent particle layer.
  item.duration = event.critical ? 0.36 : 0.28;
  item.critical = event.critical;
  item.wuxing = event.wuxing;
  return item;
}

function takeFloater(at: Point, text: string, color: string, duration: number, large: boolean): FloatFx {
  const item = floaterPool.pop() ?? { at, text, color, age: 0, duration, large };
  Object.assign(item, { at, text, color, age: 0, duration, large });
  return item;
}

function takeRing(at: Point, color: string, duration: number): RingFx {
  const item = ringPool.pop() ?? { at, color, age: 0, duration };
  Object.assign(item, { at, color, age: 0, duration });
  return item;
}

function takeAbilityBurst(event: Extract<GameEvent, { type: "ability" }>): AbilityBurstFx {
  const item = abilityBurstPool.pop() ?? { at: event.at, source: event.source, glyph: event.glyph, color: event.color, kind: event.kind, age: 0, duration: 0.42 };
  Object.assign(item, { at: event.at, source: event.source, glyph: event.glyph, color: event.color, kind: event.kind, age: 0, duration: 0.42 });
  return item;
}

function recycleAll<T>(active: T[], pool: T[], limit: number): void {
  while (active.length > 0) {
    const item = active.pop();
    if (item && pool.length < limit) pool.push(item);
  }
}
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let towerDragPointerId: number | null = null;
let towerDragTowerId: number | null = null;
let towerDragStart: Point | null = null;
let towerDragMoved = false;
let mapPanPointerId: number | null = null;
let mapPanStartScreen: Point | null = null;
let mapPanStartOffset: Point | null = null;
let mapPanButton: 0 | 1 | null = null;
let mapPanMoved = false;
let mapPanClickCell = -1;
let hoveredTowerId: number | null = null;
/** 포인터가 올라간 잠긴 오행진. 자물쇠 확대와 캔버스 커서 전환에 쓴다. */
let hoveredLockFormation: number | null = null;
let hanjaEmphasis = true;
// 호버 팝오버 우상단 큰 한자. 기본 ON, 선택은 브라우저에 저장한다.
const HOVER_GLYPH_STORAGE_KEY = "hanja-td:hover-glyph-large";
let hoverGlyphLarge = ((): boolean => {
  try {
    return window.localStorage.getItem(HOVER_GLYPH_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
})();
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

function hideEarlyHint(): void {
  window.clearTimeout(earlyHintTimer);
  const hint = document.querySelector<HTMLElement>("#early-hint");
  if (hint) hint.hidden = true;
}

function maybeShowEarlyHint(): void {
  const hint = document.querySelector<HTMLElement>("#early-hint");
  const button = document.querySelector<HTMLButtonElement>("#early-button");
  if (!hint || !button || !hint.hidden || button.disabled) return;
  // 코치마크가 떠 있는 동안에는 안내를 겹치지 않는다.
  if (!must<HTMLElement>("#coach-layer").hidden) return;
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

const MIN_MAP_ZOOM = 0.72;
const BASE_MAP_ZOOM = 2.6;
const DEFAULT_MAP_ZOOM = 2;
const MAX_MAP_ZOOM = BASE_MAP_ZOOM * 2;
const DEFAULT_MAP_FOCUS: Point = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
function defaultMapOffset(): Point {
  return {
    x: WORLD_WIDTH / 2 - DEFAULT_MAP_FOCUS.x * DEFAULT_MAP_ZOOM,
    y: WORLD_HEIGHT / 2 - DEFAULT_MAP_FOCUS.y * DEFAULT_MAP_ZOOM
  };
}
let mapZoom = DEFAULT_MAP_ZOOM;
let mapOffset: Point = defaultMapOffset();
/** 휠 확대·축소 1회 또는 팬 1회마다 오른다. 코치 2단계 자동 진행의 근거. */
let mapCameraGestures = 0;
type GameSpeed = 1 | 2 | 3;
let gameSpeed: GameSpeed = 1;
const hanjiPaperUrl = `${import.meta.env.BASE_URL}assets/map/hanji-ink-field/hanji-paper-base.png`;
canvas.style.backgroundImage = `radial-gradient(circle at 50% 44%, rgba(255, 252, 235, 0.08), rgba(115, 78, 39, 0.09)), url("${hanjiPaperUrl}")`;
canvas.style.backgroundPosition = "center";
canvas.style.backgroundRepeat = "no-repeat";
canvas.style.backgroundSize = "cover";
canvas.dataset.hitFeedback = "ink-local";
canvas.dataset.formationTileColorMode = "element";
canvas.dataset.formationTilePalette = BOARD_FORMATIONS.map((formation) => `${formation.preferredWuxing}:${formation.color}`).join("|");
preloadCombatFxSprites();
preloadInkPathSprites();
preloadEnemySprites();
preloadFormationPlates();
preloadLockSprites();
preloadP0ComponentSprites();
preloadPolishSprites();
preloadIdiomSprites();
preloadNameplateSprites();

/*
 * 집중 프레임(S06 강화 · S07 농축).
 *
 * 376px 패널 안에 "대상 고르기 + 재료 + 실행"을 전부 밀어 넣은 탓에 글자가
 * 작아지고 과부하가 걸렸다. 작업대 DOM 을 통째로 전장 위 대형 프레임으로
 * **옮긴다**(복제가 아니다 — 기존 id·리스너·렌더러가 그대로 동작한다).
 * 패널에는 요약 몇 줄과 [열기] 버튼만 남는다.
 * 엔진은 계속 돌기 때문에 aria-modal 은 false 다.
 */
type FocusFrameId = "growth" | "concentration";

const FOCUS_FRAME_MOUNTS: ReadonlyArray<{ id: FocusFrameId; source: string; target: string }> = [
  { id: "growth", source: ".growth-layout", target: "#growth-frame-body" },
  { id: "concentration", source: "#concentration-layout", target: "#concentration-frame-body" }
];

let openFocusFrame: FocusFrameId | null = null;

function mountFocusFrames(): void {
  for (const mount of FOCUS_FRAME_MOUNTS) {
    const source = document.querySelector<HTMLElement>(mount.source);
    const target = document.querySelector<HTMLElement>(mount.target);
    if (source && target && source.parentElement !== target) target.append(source);
  }
}

function setFocusFrame(id: FocusFrameId | null): void {
  openFocusFrame = id;
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
    growthRenderKey = "";
    renderGrowth();
  } else if (id === "concentration") {
    concentrationRenderKey = "";
    renderConcentration();
  }
}

function setPanelTab(tab: PanelTab): void {
  if (tab !== activePanelTab) sound.playTabSwitch();
  if (tab !== "unit") closeCompositionDrawer();
  activePanelTab = tab;
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
    const selected = engine.selectedTower();
    if (selected) concentrationTargetId = selected.id;
    concentrationRenderKey = "";
    renderConcentration();
  } else if (tab === "growth") {
    growthRenderKey = "";
    renderGrowth();
  }
  // 탭 진입은 곧 집중 프레임 진입이다. 다른 탭으로 나가면 프레임도 닫힌다.
  setFocusFrame(FOCUS_FRAME_MOUNTS.some((mount) => mount.id === tab) ? (tab as FocusFrameId) : null);
}

mountFocusFrames();
syncEarlyCalmState();

function syncDisplayModeControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-display-mode-option]").forEach((button) => {
    const selected = button.dataset.displayModeOption === displayMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function syncHoverGlyphControl(): void {
  const button = must<HTMLButtonElement>("#hover-glyph-toggle");
  button.classList.toggle("is-on", hoverGlyphLarge);
  button.setAttribute("aria-checked", String(hoverGlyphLarge));
  must<HTMLElement>("#hover-glyph-toggle i em").textContent = hoverGlyphLarge ? "ON" : "OFF";
}

function setHoverGlyphLarge(enabled: boolean): void {
  hoverGlyphLarge = enabled;
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
  const enabled = engine.state.autoPlaceSummons;
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
    const selected = button.dataset.gameModeOption === selectedGameMode;
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
    const selected = region === selectedRegion;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  must<HTMLElement>("#s00-summary-main").textContent = `${REGION_MENU_INFO[selectedRegion].name} · ${gameModeLabel(selectedGameMode)}`;
  const s13 = document.querySelector<HTMLDialogElement>("#s13-dialog");
  if (s13?.open) syncS13();
  must<HTMLElement>("#s00-start-sub").textContent = REGION_MENU_INFO[selectedRegion].pool;
  must<HTMLElement>("#title-lead").innerHTML = selectedGameMode === "casual"
    ? "획수가 희귀도를 정하고, 같은 오행 세 자령을 모두 바쳐 다음 별을 부릅니다.<br />무엇이 나올지는 열어 봐야 압니다 — 8성 대봉인까지 성장시키세요."
    : "운으로 글자를 부르고, 실제 구성 원리로 합성하라.<br />열 개의 장과 백 번의 망령 행렬을 넘어 대봉인을 완성하세요.";
  // 개발용 표현(심사·제출)은 dev 모드에서만 남긴다. 플레이어에게는
  // "무엇이 가장 잘 갖춰져 있는가"만 말한다.
  const devLabels = shell.dataset.devMode === "1";
  must<HTMLElement>("#title-note").textContent = selectedRegion === "KR"
    ? devLabels ? "심사 권장 · 현재 제출 기준 콘텐츠" : "가장 완성된 콘텐츠"
    : "미리 해보기 · 도감·현지화·밸런스 보강 중";
}

function setSelectedGameMode(mode: GameMode): void {
  sound.unlock();
  selectedGameMode = mode;
  syncTitleModeSelection();
  sound.playUiConfirm();
}

function setDisplayMode(mode: DisplayMode, announce = true): void {
  displayMode = mode;
  shell.dataset.displayMode = mode;
  saveDisplayMode(mode);
  syncDisplayModeControls();
  if (announce) {
    sound.playUiConfirm();
    showToast(mode === "spirit" ? "자령 모드 · 한자와 훈음을 머리 위에 표시" : "공부 모드 · 큰 한자와 읽기를 전장에 표시");
  }
}

function resetIdiomResult(): void {
  idiomResult.classList.remove("is-active");
  idiomResult.style.removeProperty("--idiom-result-color");
  must<HTMLElement>("#idiom-result-glyph").textContent = "四";
  must<HTMLElement>("#idiom-result-name").textContent = "네 글자를 순서대로 배치하세요";
  must<HTMLElement>("#idiom-result-meaning").textContent = "배치된 자령을 자동으로 판정합니다.";
  must<HTMLElement>("#idiom-result-bonus").textContent = "자동 판정";
}

function showIdiomResult(reading: string, meaning: string, bonus: string, color: string): void {
  idiomResult.style.setProperty("--idiom-result-color", color);
  must<HTMLElement>("#idiom-result-glyph").textContent = "四";
  must<HTMLElement>("#idiom-result-name").textContent = reading + " 자동 봉인";
  must<HTMLElement>("#idiom-result-meaning").textContent = meaning;
  must<HTMLElement>("#idiom-result-bonus").textContent = bonus;
  idiomResult.classList.remove("is-active");
  void idiomResult.offsetWidth;
  idiomResult.classList.add("is-active");
  idiomTab.classList.remove("has-update");
  void idiomTab.offsetWidth;
  idiomTab.classList.add("has-update");
}

function startRun(useNewSeed = false): void {
  const seed = useNewSeed ? createRunSeed() : seedInput.value.trim() || createRunSeed();
  seedInput.value = seed;
  engine = new GameEngine(seed, selectedRegion, selectedGameMode);
  shell.dataset.gameMode = selectedGameMode;
  mapSynthesisDepths = buildSynthesisDepths(engine.catalog.definitions.values());
  mapUncombinableStageOne = buildUncombinableStageOneChars(engine.catalog.definitions.values());
  engine.state.autoPlaceSummons = loadAutoPlaceSummons();
  engine.begin();
  previousPhase = "prep";
  manualPause = false;
  mapCameraGestures = 0;
  titleOverlay.classList.remove("modal-layer--visible");
  endOverlay.classList.remove("modal-layer--visible");
  sound.unlock();
  sound.playUiConfirm();
  recycleAll(projectiles, projectilePool, 48);
  recycleAll(floaters, floaterPool, 48);
  recycleAll(rings, ringPool, 32);
  recycleAll(abilityBursts, abilityBurstPool, 12);
  idiomRipples.length = 0;
  idiomFlash = null;
  // 새 런은 봉인이 0개라 키도 빈 문자열이 된다. 초기값과 겹치지 않게 표식으로 밀어 둔다.
  activeIdiomsRenderKey = "run-reset";
  projectileSpriteDrawTotal = 0;
  abilityZoneSpriteDrawTotal = 0;
  canvas.dataset.projectileSpriteDrawTotal = "0";
  canvas.dataset.abilityZoneSpriteDrawTotal = "0";
  towerAbilityPopups.clear();
  lastAbilityFxByTower.clear();
  lastGlobalAbilityFxAt = -10;
  combatFeed.replaceChildren();
  feedCooldowns.clear();
  comboCount = 0;
  comboMeter.classList.remove("combo-meter--visible");
  resetIdiomResult();
  hideSummonReveal();
  closeCompositionDrawer();
  concentrationTargetId = null;
  concentrationPath = "swift";
  concentrationPayment = "essence";
  growthElement = "木";
  dismantleSelection.clear();
  casualFusionSelection = [];
  pendingCasualFusion = null;
  if (casualFusionConfirmDialog.open) casualFusionConfirmDialog.close();
  setPanelTab("shop");
  formationUnlockHintShown = false;
  startCoach();
  window.clearTimeout(comboTimer);
  evolutionRenderKey = "";
  goalRenderKey = "";
  selectedRenderKey = "";
  runInventoryRenderKey = "";
  idiomRenderKey = "";
  elementUpgradeRenderKey = "";
  concentrationRenderKey = "";
  growthRenderKey = "";
  towerDragPointerId = null;
  towerDragTowerId = null;
  towerDragStart = null;
  towerDragMoved = false;
  showToast(`${engine.catalog.title} · ${gameModeLabel(engine.state.mode)}을 시작합니다.`);
  syncPanel();
}

function handleAction(result: ActionResult, options: { invalidatePanels?: boolean } = {}): void {
  sound.playActionOutcome(result.ok);
  if (!result.ok || !result.message.includes("자동 봉인")) showToast(result.message, !result.ok);
  if (options.invalidatePanels !== false) {
    evolutionRenderKey = "";
    goalRenderKey = "";
    selectedRenderKey = "";
    runInventoryRenderKey = "";
    concentrationRenderKey = "";
    growthRenderKey = "";
  }
  syncPanel();
}

function showToast(message: string, warning = false): void {
  toast.textContent = message;
  toast.classList.toggle("toast--warning", warning);
  toast.classList.remove("toast--visible");
  toastAnimation?.cancel();
  toastAnimation = toast.animate(reducedMotion
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

function showWaveBanner(): void {
  bossBanner.classList.remove("boss-banner--visible");
  waveBannerAnimation?.cancel();
  waveBannerAnimation = bossBanner.animate(reducedMotion
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
function firstSealCelebration(reading: string): void {
  bossBanner.textContent = `첫 봉인 ${reading}! 발동 중 성어는 전장 왼쪽에 표시됩니다`;
  bossBanner.classList.remove("boss-banner--boss");
  bossBanner.classList.add("boss-banner--idiom");
  showWaveBanner();
}

function addCombatFeed(glyph: string, name: string, detail: string, color: string): void {
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

function showTowerAbilityPopup(towerId: number, glyph: string, name: string, color: string): void {
  const current = towerAbilityPopups.get(towerId);
  // Frequent procs still happen mechanically, but the same tower cannot flood the screen.
  if (current && current.age < 0.8) return;
  towerAbilityPopups.set(towerId, { text: glyph + " " + name, color, age: 0, duration: 0.82 });
}

function hideSummonReveal(): void {
  window.clearTimeout(summonRevealTimer);
  window.clearTimeout(fusionVortexTimer);
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
  window.clearTimeout(fusionVortexTimer);
  fusionVortex.style.setProperty("--vortex-tint", ELEMENT_STYLES[wuxing].color);
  fusionVortex.classList.remove("is-active");
  void fusionVortex.offsetWidth;
  fusionVortex.classList.add("is-active");
  fusionVortexTimer = window.setTimeout(() => fusionVortex.classList.remove("is-active"), 520);
}

/**
 * 3합 획득도 뽑기와 같은 공개 카드로 보여 준다. 무작위 결과라 "무엇이 나왔는지"가
 * 토스트 한 줄로 흘러가면 안 된다.
 */
function showCasualFusionReveal(events: Array<Extract<GameEvent, { type: "casualFuse" }>>): void {
  if (events.length === 0) return;
  window.clearTimeout(summonRevealTimer);
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
    const visual = jaryeongVisualFor(tower.char, tower.wuxing, engine.state.region);
    const learning = learningInfo(engine.state.region, tower.char);
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
  if (events.length === 1) summonRevealTimer = window.setTimeout(hideSummonReveal, 3800);
}

function showSummonReveal(events: Array<Extract<GameEvent, { type: "summon" }>>): void {
  if (events.length === 0) return;
  // 코치가 전장 조작을 안내하는 동안에는 카드가 스포트라이트를 덮고
  // wheel 을 삼키므로 아예 띄우지 않는다.
  if (coachIsPointingAtBoard()) {
    hideSummonReveal();
    return;
  }
  window.clearTimeout(summonRevealTimer);
  window.clearTimeout(fusionVortexTimer);
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
  const firstSummon = engine.state.summonCount === events.length && engine.state.startingFormationIndex !== null;
  const startingFormation = firstSummon ? BOARD_FORMATIONS[engine.state.startingFormationIndex ?? -1] : undefined;
  const openingResult = firstSummon && startingFormation
    ? `<strong>${events[0]?.tower.wuxing ?? "?"} 자령 출현 → ${startingFormation.label} 무료 개방</strong>`
    : "";
  must<HTMLElement>("#summon-reveal-summary").innerHTML = `${openingResult}<b>새 발견 ${newCount}</b><span>${engine.state.mode === "casual" ? "목표·성어" : "합성 재료"} ${helpfulCount}</span><span>중복 ${concentrationCount}</span><em>${placementLabel}</em>`;
  must<HTMLElement>("#summon-reveal-list").innerHTML = events.map((event, index) => {
    const tower = event.tower;
    const definition = definitionForTower(engine.catalog, tower.definitionId);
    const style = ELEMENT_STYLES[tower.wuxing];
    const visual = jaryeongVisualFor(tower.char, tower.wuxing, engine.state.region);
    const learning = learningInfo(engine.state.region, tower.char);
    const helpfulLabel = event.helpfulReason === "both" ? "목표·성어" : event.helpfulReason === "goal" ? "목표 재료" : event.helpfulReason === "idiom" ? "성어 재료" : "";
    const utilityLabel = event.utility === "new" ? "NEW" : event.utility === "synthesis" ? engine.state.mode === "casual" ? "목표" : "합성" : event.utility === "concentration" ? "중복" : "교체 후보";
    const star = casualStarOf(tower);
    return `<article class="summon-result-card ${event.newDiscovery ? "is-new" : ""} ${event.helpful ? "is-helpful" : ""}" style="--summon:${style.color};--summon-star:${CASUAL_STAR_COLORS[star]};--summon-delay:${index * 45}ms">
      <span class="summon-result-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <strong>${tower.char}</strong>
      <b>${escapeHtml(learning.short)}</b>
      <small>${style.name}행 · ${engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]} · ${casualStrokeCount(tower.char) ?? "?"}획` : escapeHtml(definition.combat.roleLabel)}</small>
      <div><em>${utilityLabel}</em>${helpfulLabel ? `<mark>${helpfulLabel}</mark>` : ""}</div>
    </article>`;
  }).join("");
  summonReveal.classList.toggle("is-batch", events.length > 1);
  summonReveal.classList.remove("is-active");
  void summonReveal.offsetWidth;
  summonReveal.classList.add("is-active");
  summonReveal.setAttribute("aria-hidden", "false");
  if (events.length === 1) summonRevealTimer = window.setTimeout(hideSummonReveal, 3800);
}

function formatStatBonus(stat: UpgradeStat, bonus: number): string {
  return stat === "range" ? `+${bonus.toFixed(1)}` : `+${(bonus * 100).toFixed(1)}%`;
}

function totalGlobalUpgradeLevels(): number {
  return UPGRADE_STAT_ORDER.reduce((sum, stat) => sum + engine.state.globalUpgrades[stat], 0);
}

function totalElementUpgradeLevels(): number {
  return WUXING_ORDER.reduce((sum, wuxing) => sum + UPGRADE_STAT_ORDER.reduce((elementSum, stat) => elementSum + engine.state.elementUpgrades[wuxing][stat], 0), 0);
}

function upgradeStateSignature(): string {
  const global = UPGRADE_STAT_ORDER.map((stat) => engine.state.globalUpgrades[stat]).join(",");
  const elements = WUXING_ORDER.map((wuxing) => UPGRADE_STAT_ORDER.map((stat) => engine.state.elementUpgrades[wuxing][stat]).join(",")).join("|");
  const essence = WUXING_ORDER.map((wuxing) => engine.state.elementEssence[wuxing]).join(",");
  return `${engine.state.phase}:${engine.state.gold}:${global}:${elements}:${essence}`;
}

function renderElementUpgrades(): void {
  const active = engine.state.phase === "prep" || engine.state.phase === "combat";
  const globalTotal = totalGlobalUpgradeLevels();
  must<HTMLElement>("#global-upgrade-total").textContent = `${globalTotal}단계`;
  must<HTMLElement>("#element-essence-dialog-summary").textContent = WUXING_ORDER.map((wuxing) => `${wuxing}${engine.state.elementEssence[wuxing]}`).join(" ");
  must<HTMLElement>("#global-upgrade-list").innerHTML = UPGRADE_STAT_ORDER.map((stat) => {
    const meta = UPGRADE_STAT_META[stat];
    const level = engine.state.globalUpgrades[stat];
    const cost = globalUpgradeCost(stat, level);
    const maxed = level >= MAX_UPGRADE_LEVEL;
    const bonus = engine.globalUpgradeBonus(stat);
    return `<article class="stat-upgrade-card is-global">
      <div class="stat-upgrade-glyph">${meta.glyph}</div>
      <div><strong>${meta.label} <em>Lv.${level}</em></strong><span>${meta.description}</span><small>현재 ${formatStatBonus(stat, bonus)} · 단계당 ${formatStatBonus(stat, meta.globalPerLevel)}</small></div>
      <button type="button" data-upgrade-scope="global" data-upgrade-stat="${stat}" ${!active || maxed || engine.state.gold < cost ? "disabled" : ""}><b>${maxed ? "최고" : `${cost}엽전`}</b><small>${maxed ? `Lv.${MAX_UPGRADE_LEVEL}` : `Lv.${level + 1}`}</small></button>
    </article>`;
  }).join("");
  must<HTMLElement>("#element-upgrade-list").innerHTML = WUXING_ORDER.map((wuxing) => {
    const style = ELEMENT_STYLES[wuxing];
    const elementTotal = UPGRADE_STAT_ORDER.reduce((sum, stat) => sum + engine.state.elementUpgrades[wuxing][stat], 0);
    const controls = UPGRADE_STAT_ORDER.map((stat) => {
      const meta = UPGRADE_STAT_META[stat];
      const level = engine.state.elementUpgrades[wuxing][stat];
      const cost = elementUpgradeCost(level);
      const maxed = level >= MAX_UPGRADE_LEVEL;
      const bonus = engine.elementUpgradeBonus(wuxing, stat);
      return `<button type="button" class="element-stat-button" data-upgrade-scope="element" data-upgrade-element="${wuxing}" data-upgrade-stat="${stat}" ${!active || maxed || engine.state.elementEssence[wuxing] < cost ? "disabled" : ""} title="${meta.description}">
        <i>${meta.glyph}</i><span><b>${meta.label} <em>Lv.${level}</em></b><small>${formatStatBonus(stat, bonus)}</small></span><strong>${maxed ? "최고" : `${wuxing}${cost}`}</strong>
      </button>`;
    }).join("");
    return `<article class="element-upgrade-card is-expanded" style="--upgrade:${style.color}">
      <header><div class="element-upgrade-seal"><b>${wuxing}</b><span>${style.name}행</span></div><p><strong>${elementTotal}단계</strong><small>보유 문기 ${engine.state.elementEssence[wuxing]}</small></p></header>
      <div class="element-stat-grid">${controls}</div>
    </article>`;
  }).join("");
  elementUpgradeRenderKey = upgradeStateSignature();
}

function concentrationStateSignature(): string {
  const towers = [...engine.state.towers, ...engine.state.inventoryTowers]
    .map((tower) => `${tower.id}:${tower.char}:${tower.cell}:${tower.locked ? 1 : 0}:${tower.concentration ?? 0}:${tower.concentrationPath ?? "-"}`)
    .join("|");
  return `${engine.state.phase}:${towers}:${WUXING_ORDER.map((wuxing) => engine.state.elementEssence[wuxing]).join(",")}:${concentrationTargetId ?? "-"}:${concentrationPath}:${concentrationPayment}`;
}

function renderConcentration(): void {
  const allTowers = [...engine.state.towers, ...engine.state.inventoryTowers];
  if (concentrationTargetId === null || !allTowers.some((tower) => tower.id === concentrationTargetId)) {
    concentrationTargetId = engine.selectedTower()?.id ?? allTowers[0]?.id ?? null;
  }
  const key = concentrationStateSignature();
  if (key === concentrationRenderKey) return;
  concentrationRenderKey = key;
  const rows = allTowers.map((tower) => {
    const level = tower.concentration ?? 0;
    const duplicateCount = engine.state.inventoryTowers.filter((candidate) => candidate.id !== tower.id && candidate.char === tower.char && !candidate.locked).length;
    const cost = concentrationEssenceCost(level);
    const maxed = level >= MAX_CONCENTRATION_LEVEL;
    const actionable = !maxed && (duplicateCount > 0 || engine.state.elementEssence[tower.wuxing] >= cost);
    return { tower, level, duplicateCount, cost, maxed, actionable, rank: maxed ? 2 : actionable ? 0 : 1 };
  }).sort((left, right) => left.rank - right.rank || right.level - left.level || casualStarOf(right.tower) - casualStarOf(left.tower) || right.tower.stage - left.tower.stage || left.tower.id - right.tower.id);

  must<HTMLElement>("#concentration-target-summary").textContent = `${rows.filter((row) => row.actionable).length}기 가능 · 총 ${rows.length}기`;
  must<HTMLElement>("#concentration-panel-summary").textContent = `농축 가능 ${rows.filter((row) => row.actionable).length}기 · 총 ${rows.length}기`;
  must<HTMLElement>("#concentration-target-list").innerHTML = rows.length > 0 ? rows.map(({ tower, level, duplicateCount, cost, maxed, actionable }) => {
    const stateLabel = maxed ? "최대 단계" : actionable ? "농축 가능" : "재료 부족";
    return `<button type="button" data-concentration-target="${tower.id}" class="${tower.id === concentrationTargetId ? "is-selected" : ""} ${actionable ? "is-ready" : ""}" style="--element:${ELEMENT_STYLES[tower.wuxing].color}">
      <b>${escapeHtml(tower.char)}</b><span><strong>${tower.wuxing}행 · ${towerProgressionLabel(tower)} · 濃 ${level}/3</strong><small>${tower.cell < 0 ? "인벤토리" : `${BOARD_FORMATIONS[Math.floor(tower.cell / CELLS_PER_FORMATION)]?.label ?? "전장"} 배치`} · ${duplicateCount > 0 ? `중복 ${duplicateCount}기` : `문기 ${cost}`}</small></span><em>${stateLabel}</em>
    </button>`;
  }).join("") : `<div class="workbench-empty"><b>농축할 자령이 없습니다</b><span>상점에서 자령을 먼저 소환하세요.</span></div>`;

  const detail = must<HTMLElement>("#concentration-detail");
  const target = allTowers.find((tower) => tower.id === concentrationTargetId);
  if (!target) {
    detail.innerHTML = `<div class="workbench-empty"><b>대상을 선택하세요</b><span>전장과 인벤토리 자령을 모두 확인할 수 있습니다.</span></div>`;
    return;
  }
  const fixedPath = target.concentrationPath ?? null;
  if (fixedPath) concentrationPath = fixedPath;
  const quote = engine.concentrationQuote(target.id, concentrationPath);
  if (quote && typeof concentrationPayment === "number" && !quote.duplicateIds.includes(concentrationPayment)) concentrationPayment = "essence";
  const pathLocked = fixedPath !== null;
  const swiftSelected = concentrationPath === "swift";
  const currentLevel = target.concentration ?? 0;
  if (!quote) {
    detail.innerHTML = `<article class="concentration-max-card" style="--element:${ELEMENT_STYLES[target.wuxing].color}"><b>${escapeHtml(target.char)}</b><div><span>${target.wuxing}행 · ${towerProgressionLabel(target)}</span><strong>濃 ${currentLevel}/3 · ${fixedPath === "potent" ? "심화" : "연속"} 농축 완성</strong><small>더 이상 재료를 소모하지 않습니다.</small></div></article>`;
    return;
  }
  const essenceAvailable = engine.state.elementEssence[target.wuxing] >= quote.essenceCost;
  const duplicatePaymentAvailable = typeof concentrationPayment === "number" && quote.duplicateIds.includes(concentrationPayment);
  const paymentReady = concentrationPayment === "essence" ? essenceAvailable : duplicatePaymentAvailable;
  const paymentRows = quote.duplicateIds.map((id) => {
    const duplicate = engine.state.inventoryTowers.find((tower) => tower.id === id);
    if (!duplicate) return "";
    return `<label class="payment-option ${concentrationPayment === id ? "is-selected" : ""}"><input type="radio" name="concentration-payment" value="${id}" ${concentrationPayment === id ? "checked" : ""}><b>${escapeHtml(duplicate.char)}</b><span>인벤 중복 #${id}</span><small>잠금 없음 · 명시적 소모</small></label>`;
  }).join("");
  detail.innerHTML = `
    <article class="concentration-focus" style="--element:${ELEMENT_STYLES[target.wuxing].color}">
      <header><b>${escapeHtml(target.char)}</b><div><span>${target.wuxing}행 · ${towerProgressionLabel(target)} · ${target.cell < 0 ? "인벤토리" : "전장"}</span><strong>濃 ${quote.currentLevel} → ${quote.nextLevel}</strong><small>${pathLocked ? "선택한 분기는 영구 고정" : "첫 분기 선택 후 변경 불가"}</small></div></header>
      <div class="subheading"><b>② 분기 선택</b><small>${pathLocked ? "이 자령의 분기는 이미 고정됨" : "처음 한 번만 고를 수 있습니다"}</small></div>
      <div class="concentration-paths" role="radiogroup" aria-label="농축 분기">
        <button type="button" data-concentration-path="swift" class="${swiftSelected ? "is-selected" : ""}" ${pathLocked && !swiftSelected ? "disabled" : ""}><b>迅 연속 농축</b><span>단계당 피해 +5.5%</span><span>공격 대기 -7.5% · 사거리 +4</span></button>
        <button type="button" data-concentration-path="potent" class="${!swiftSelected ? "is-selected" : ""}" ${pathLocked && swiftSelected ? "disabled" : ""}><b>深 심화 농축</b><span>단계당 피해 +12%</span><span>대기 -2% · 의미 기술 +3.5% · 사거리 +4</span></button>
      </div>
      <div class="concentration-compare">
        <div><span>공격력</span><b>${Math.round(quote.current.damage)}</b><i>→</i><strong>${Math.round(quote.next.damage)}</strong></div>
        <div><span>초당 공격</span><b>${quote.current.attacksPerSecond.toFixed(1)}</b><i>→</i><strong>${quote.next.attacksPerSecond.toFixed(1)}</strong></div>
        <div><span>사거리</span><b>${Math.round(quote.current.range)}</b><i>→</i><strong>${Math.round(quote.next.range)}</strong></div>
        <div><span>기술 효과</span><b>${Math.round((quote.current.abilityEffect - 1) * 100)}%</b><i>→</i><strong>${Math.round((quote.next.abilityEffect - 1) * 100)}%</strong></div>
      </div>
      <section class="concentration-payment"><div class="subheading"><b>③ 재료 지불</b><small>전장 자령과 잠긴 자령은 후보에서 제외</small></div><div class="payment-grid">
        ${paymentRows}
        <label class="payment-option is-essence ${concentrationPayment === "essence" ? "is-selected" : ""} ${essenceAvailable ? "" : "is-unavailable"}"><input type="radio" name="concentration-payment" value="essence" ${concentrationPayment === "essence" ? "checked" : ""} ${essenceAvailable ? "" : "disabled"}><b>${target.wuxing}</b><span>${target.wuxing} 문기 ${quote.essenceCost}</span><small>보유 ${engine.state.elementEssence[target.wuxing]}</small></label>
      </div></section>
      <button id="concentration-confirm-button" class="workbench-primary" type="button" ${paymentReady ? "" : "disabled"}>${pathLocked ? "다음 단계 농축" : "분기 고정 후 농축"}</button>
    </article>`;
}

function growthStateSignature(): string {
  const inventory = engine.state.inventoryTowers.map((tower) => `${tower.id}:${tower.char}:${tower.wuxing}:${tower.stage}:${tower.casualStar ?? 0}:${tower.locked ? 1 : 0}:${tower.concentration ?? 0}`).join("|");
  const traits = WUXING_ORDER.map((wuxing) => engine.state.elementTraits[wuxing].join(",")).join("|");
  const scores = WUXING_ORDER.map((wuxing) => engine.state.elementDismantleScore[wuxing]).join(",");
  const filters = `${must<HTMLSelectElement>("#dismantle-element-filter").value}:${must<HTMLSelectElement>("#dismantle-stage-filter").value}:${must<HTMLSelectElement>("#dismantle-status-filter").value}`;
  return `${engine.state.mode}:${upgradeStateSignature()}:${inventory}:${traits}:${scores}:${filters}:${[...dismantleSelection].sort((a, b) => a - b).join(",")}:${growthElement}`;
}

const UPGRADE_UNAVAILABLE_LABEL = "투자 불가";

function upgradeAmountLabel(scope: "global" | "element" | "trait", stat: UpgradeStat | null, traitIndex: number | null, amount: number | "max"): string {
  const quote = scope === "global" && stat
    ? engine.quoteGlobalUpgrade(stat, amount)
    : scope === "element" && stat
      ? engine.quoteElementUpgrade(growthElement, stat, amount)
      : engine.quoteElementTraitUpgrade(growthElement, traitIndex ?? 0, amount);
  if (amount !== "max") return `${amount}회 · ${quote.cost}`;
  return quote.levels > 0 ? `최대 +${quote.levels} · ${quote.cost}` : UPGRADE_UNAVAILABLE_LABEL;
}

function renderGrowth(): void {
  const key = growthStateSignature();
  if (key === growthRenderKey) return;
  growthRenderKey = key;
  const active = engine.state.phase === "prep" || engine.state.phase === "combat";
  const assessmentMap = new Map(engine.cleanupAssessments().map((assessment) => [assessment.towerId, assessment]));
  const elementFilter = must<HTMLSelectElement>("#dismantle-element-filter").value;
  const stageFilter = must<HTMLSelectElement>("#dismantle-stage-filter").value;
  const statusFilter = must<HTMLSelectElement>("#dismantle-status-filter").value;
  for (const id of [...dismantleSelection]) if (!engine.state.inventoryTowers.some((tower) => tower.id === id)) dismantleSelection.delete(id);
  const rows = engine.state.inventoryTowers
    .map((tower) => ({ tower, assessment: assessmentMap.get(tower.id) }))
    .filter(({ tower }) => elementFilter === "all" || tower.wuxing === elementFilter)
    .filter(({ tower }) => stageFilter === "all" || String(engine.state.mode === "casual" ? casualStarOf(tower) : tower.stage) === stageFilter)
    .filter(({ assessment }) => statusFilter === "all" || (statusFilter === "eligible" ? !assessment?.protected : assessment?.protected))
    .sort((left, right) => Number(Boolean(left.assessment?.protected)) - Number(Boolean(right.assessment?.protected)) || (engine.state.mode === "casual" ? casualStarOf(left.tower) - casualStarOf(right.tower) : left.tower.stage - right.tower.stage) || left.tower.id - right.tower.id);

  must<HTMLElement>("#growth-resource-summary").textContent = "문기 " + WUXING_ORDER.map((wuxing) => `${wuxing}${engine.state.elementEssence[wuxing]}`).join(" ");
  const dismantleReady = engine.state.inventoryTowers.filter((tower) => !assessmentMap.get(tower.id)?.protected).length;
  must<HTMLElement>("#growth-panel-dismantle").textContent = `분해 가능 ${dismantleReady}기 · 선택 ${dismantleSelection.size}기`;
  must<HTMLElement>("#growth-dismantle-list").innerHTML = rows.length > 0 ? rows.map(({ tower, assessment }) => {
    const protectedReasons = assessment?.protectedReasons ?? ["보호 상태 확인 필요"];
    const protectedState = assessment?.protected ?? true;
    const essence = engine.towerDismantleEssenceValue(tower);
    return `<label class="dismantle-row ${protectedState ? "is-protected" : ""}" style="--element:${ELEMENT_STYLES[tower.wuxing].color}">
      <input type="checkbox" data-dismantle-id="${tower.id}" ${dismantleSelection.has(tower.id) ? "checked" : ""} ${protectedState || !active ? "disabled" : ""}>
      <b>${escapeHtml(tower.char)}</b><span><strong>${tower.wuxing}행 · ${towerProgressionLabel(tower)} · #${tower.id}</strong><small>${protectedState ? protectedReasons.map(escapeHtml).join(" · ") : (assessment?.reasons ?? []).map(escapeHtml).join(" · ") || "분해 가능"}</small></span><em>${protectedState ? "보호" : `${tower.wuxing}+${essence}`}</em>
    </label>`;
  }).join("") : `<div class="workbench-empty"><b>조건에 맞는 인벤토리 자령이 없습니다</b><span>필터를 바꾸거나 소환 자령을 인벤토리에 보관하세요.</span><button type="button" data-goto-inventory>인벤 탭 열기</button></div>`;

  const quote = engine.quoteDismantle([...dismantleSelection]);
  const gainLabel = (Object.entries(quote.gains) as Array<[Wuxing, number]>).filter(([, amount]) => amount > 0).map(([wuxing, amount]) => `${wuxing}+${amount}`).join(" · ");
  const scoreLabel = (Object.entries(quote.scoreGains) as Array<[Wuxing, number]>).filter(([, amount]) => amount > 0).map(([wuxing, amount]) => `${wuxing}점수+${amount}`).join(" · ");
  must<HTMLElement>("#dismantle-selection-summary").textContent = `${dismantleSelection.size}기 선택${quote.blocked.length > 0 ? ` · 보호 충돌 ${quote.blocked.length}` : ""}`;
  must<HTMLElement>("#dismantle-gain-summary").textContent = gainLabel ? `${gainLabel}${scoreLabel ? ` · ${scoreLabel}` : ""}` : "예상 문기 없음";
  must<HTMLButtonElement>("#dismantle-confirm-button").disabled = !active || quote.ids.length === 0 || quote.blocked.length > 0;

  must<HTMLElement>("#growth-element-tabs").innerHTML = WUXING_ORDER.map((wuxing) => `<button type="button" data-growth-element="${wuxing}" class="${growthElement === wuxing ? "is-selected" : ""}" style="--element:${ELEMENT_STYLES[wuxing].color}"><b>${wuxing}</b><span>문기 ${engine.state.elementEssence[wuxing]}</span><small>분해 점수 ${engine.state.elementDismantleScore[wuxing]}</small></button>`).join("");

  const batchButtons = (scope: "global" | "element", stat: UpgradeStat): string => ([1, 5, "max"] as const).map((amount) => {
    const quoteForAmount = scope === "global" ? engine.quoteGlobalUpgrade(stat, amount) : engine.quoteElementUpgrade(growthElement, stat, amount);
    // "투자 불가" 는 비용이 아니라 사유다 — 뒤에 화폐를 붙이면 "투자 불가 엽전" 같은 비문이 된다.
    const label = upgradeAmountLabel(scope, stat, null, amount);
    const currency = label === UPGRADE_UNAVAILABLE_LABEL ? "" : scope === "global" ? " 엽전" : ` ${growthElement}`;
    return `<button type="button" data-growth-upgrade-scope="${scope}" data-growth-stat="${stat}" data-growth-amount="${amount}" ${!active || quoteForAmount.levels <= 0 || !quoteForAmount.affordable ? "disabled" : ""}>${label}${currency}</button>`;
  }).join("");
  const globalRows = UPGRADE_STAT_ORDER.map((stat) => {
    const meta = UPGRADE_STAT_META[stat];
    const level = engine.state.globalUpgrades[stat];
    return `<article class="growth-stat-row"><i>${meta.glyph}</i><div><b>공용 ${meta.label} <em>Lv.${level}/99</em></b><small>${meta.description} · 현재 ${formatStatBonus(stat, engine.globalUpgradeBonus(stat))}</small></div><span>${batchButtons("global", stat)}</span></article>`;
  }).join("");
  const elementRows = UPGRADE_STAT_ORDER.map((stat) => {
    const meta = UPGRADE_STAT_META[stat];
    const level = engine.state.elementUpgrades[growthElement][stat];
    return `<article class="growth-stat-row is-element" style="--element:${ELEMENT_STYLES[growthElement].color}"><i>${meta.glyph}</i><div><b>${growthElement}행 ${meta.label} <em>Lv.${level}/99</em></b><small>현재 ${formatStatBonus(stat, engine.elementUpgradeBonus(growthElement, stat))} · 단계당 ${formatStatBonus(stat, meta.elementPerLevel)}</small></div><span>${batchButtons("element", stat)}</span></article>`;
  }).join("");
  const traitRows = ELEMENT_TRAITS[growthElement].map((trait, traitIndex) => {
    const level = engine.elementTraitLevel(growthElement, traitIndex);
    const unlockScore = elementTraitUnlockScore(traitIndex) ?? 0;
    const unlocked = engine.state.elementDismantleScore[growthElement] >= unlockScore;
    const buttons = ([1, 5, "max"] as const).map((amount) => {
      const traitQuote = engine.quoteElementTraitUpgrade(growthElement, traitIndex, amount);
      const label = upgradeAmountLabel("trait", null, traitIndex, amount);
      return `<button type="button" data-growth-upgrade-scope="trait" data-growth-trait="${traitIndex}" data-growth-amount="${amount}" ${!active || !unlocked || traitQuote.levels <= 0 || !traitQuote.affordable ? "disabled" : ""}>${label}${label === UPGRADE_UNAVAILABLE_LABEL ? "" : ` ${growthElement}`}</button>`;
    }).join("");
    return `<article class="growth-trait-row ${unlocked ? "is-unlocked" : "is-locked"}" style="--element:${ELEMENT_STYLES[growthElement].color}"><div class="trait-seal"><b>${traitIndex + 1}</b><small>${unlocked ? "개방" : `${unlockScore}점`}</small></div><div><strong>${trait.name} <em>Lv.${level}/${ELEMENT_TRAIT_MAX_LEVEL}</em></strong><span>${trait.summary} +${trait.perLevel}${trait.unit}/단계${trait.milestone ? ` · ${trait.milestone}` : ""}</span><small>${unlocked ? `다음 비용 ${elementTraitUpgradeCost(level) ?? "최고"} 문기` : `분해 점수 ${engine.state.elementDismantleScore[growthElement]}/${unlockScore}`}</small></div><nav>${buttons}</nav></article>`;
  }).join("");
  must<HTMLElement>("#growth-upgrade-list").innerHTML = `<section class="growth-upgrade-section"><header><b>공용 능력 강화</b><small>엽전 투자 · 5능력치×99단계</small></header>${globalRows}</section><section class="growth-upgrade-section"><header data-growth-section="${growthElement}"><b>${growthElement}행 능력 강화</b><small>문기 투자 · 1회·5회·최대</small></header>${elementRows}</section><section class="growth-upgrade-section"><header><b>${growthElement}행 고유 특성</b><small>분해 점수 5·15·30 순차 개방</small></header>${traitRows}</section>`;
}

function registerKillCombo(): void {
  const now = performance.now();
  comboCount = now - lastKillAt <= 1450 ? comboCount + 1 : 1;
  lastKillAt = now;
  window.clearTimeout(comboTimer);
  if (comboCount >= 3) {
    must<HTMLElement>("#combo-count").textContent = "× " + String(comboCount);
    comboMeter.classList.remove("combo-meter--visible");
    void comboMeter.offsetWidth;
    comboMeter.classList.add("combo-meter--visible");
  }
  comboTimer = window.setTimeout(() => {
    comboCount = 0;
    comboMeter.classList.remove("combo-meter--visible");
  }, 1750);
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
      addCombatFeed("濃", `${event.tower.char} ${event.path === "swift" ? "연속" : "심화"} 농축`, event.usedDuplicate ? "동일 한자 중복 소비" : `${event.tower.wuxing} 문기 ${event.essenceCost} 소비`, ELEMENT_STYLES[event.tower.wuxing].color);
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
        const evolved = definitionForTower(engine.catalog, event.tower.definitionId);
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
      const towerGap = engine.state.elapsed - (lastAbilityFxByTower.get(event.towerId) ?? -10);
      const globalGap = engine.state.elapsed - lastGlobalAbilityFxAt;
      if (!event.persistent && towerGap >= 0.75 && globalGap >= 0.12) {
        pushPooled(abilityBursts, abilityBurstPool, takeAbilityBurst(event), 12);
        lastAbilityFxByTower.set(event.towerId, engine.state.elapsed);
        lastGlobalAbilityFxAt = engine.state.elapsed;
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
      idiomFlash = { chars: event.chars, reading: event.reading, color: event.color, at: center, age: 0, duration: reducedMotion ? 0.6 : 1.2 };
      showIdiomResult(event.reading, event.meaning, event.bonus, event.color);
      addCombatFeed("四", event.reading, event.bonus, event.color);
      idiomRenderKey = "";
      if (engine.state.idiomSeals.length === 1) firstSealCelebration(event.reading);
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
  const state = engine.state;
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
    <div><span>사자성어 봉인</span><b>${state.idiomSeals.length} / ${engine.idioms().length}</b></div>
    <div><span>은행 이자</span><b>${state.interestEarned}엽전</b></div>
    <div><span>능력 강화</span><b>${totalGlobalUpgradeLevels() + totalElementUpgradeLevels()}단계</b></div>
    <div><span>발견 한자</span><b>${state.discoveredChars.length}</b></div>
    <div><span>경과 시간</span><b>${formatTime(state.elapsed)}</b></div>
  `;
  endOverlay.classList.add("modal-layer--visible");
  saveBestWave(state.wave);
}

function bestWaveKey(): string {
  return `hanzi-random-defense-best-${engine.state.mode}-${engine.state.region}`;
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

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, "0") + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function visualBackgroundStyle(visual: JaryeongVisual): string {
  const framing = jaryeongFrameLayout(visual) === "single"
    ? "background-size:contain;background-position:center"
    : "background-size:200% 200%;background-position:left top";
  return `background-image:url('${import.meta.env.BASE_URL}${jaryeongAssetPath(visual)}');${framing}`;
}

function phaseLabel(phase: RunPhase): string {
  if (phase === "title") return "준비 전";
  if (phase === "prep") return "소환 준비";
  if (phase === "combat") return "교전 중";
  if (phase === "victory") return "봉인 성공";
  return "수비 실패";
}

/**
 * 상점 소환 상품표.
 *
 * 목적 탭 + 단일 버튼은 "지금 어떤 목적인가"를 기억해야 하는 숨은 상태였다.
 * 카드 한 장이 곧 상품 한 개이므로 가격·효과·아이콘이 클릭 지점에 함께 붙는다.
 * 아이콘은 v4-rounds-assets-pack-v1 의 72×72 white-alpha 마스크를 24px 로 쓴다.
 */
interface SummonProductMeta {
  readonly intent: SummonIntent;
  readonly label: string;
  readonly effect: string;
  readonly tint: string;
  readonly icon: string;
}

// 캐주얼 순서는 기본 → 중급 → 고급 → 탐색 → 중복, 자형연성은 기본 → 탐색 → 계보 → 중복.
// 하나의 배열을 모드별로 걸러 두 순서를 동시에 만족시킨다.
// 중급·고급은 별 개수(2개/3개)가 그림 안에 들어 있는 v5 전용 아이콘을 쓴다.
// 두 티어가 같은 별 아이콘을 쓰면 색만이 유일한 구분이 되어 색각 차이에서 무너진다.
const SUMMON_PRODUCTS: readonly SummonProductMeta[] = Object.freeze([
  { intent: "balanced", label: "기본 소환", effect: "전체 풀", tint: "#a8791f", icon: "v4/shop/shop-default-coin-v1" },
  { intent: "midstar", label: "중급 소환", effect: "2★ 이상 확정", tint: "#306f89", icon: "v5/shop/shop-tier-mid-v1" },
  { intent: "highstar", label: "고급 소환", effect: "3★ 이상 확정", tint: "#af3629", icon: "v5/shop/shop-tier-high-v1" },
  { intent: "discovery", label: "탐색 소환", effect: "새 한자 ×3.4", tint: "#3f7d6e", icon: "v4/shop/shop-explore-compass-lantern-v1" },
  { intent: "lineage", label: "계보 소환", effect: "목표·성어 재료 ×3.2", tint: "#3a5794", icon: "v4/shop/shop-lineage-scroll-v1" },
  { intent: "concentration", label: "중복 소환", effect: "보유 중복 ↑ · 농축 재료", tint: "#9a6d16", icon: "v4/shop/shop-duplicate-cards-v1" }
] as const);

/** 세 티어 공통으로 걸리는 캐주얼 짝 맞추기 보정 안내. */
const PAIR_BOOST_NOTE = "짝이 맞는 자령이 더 자주 나옵니다";

const SUMMON_ICON_BASE = `${import.meta.env.BASE_URL}assets/ui/`;
let summonShopRenderKey = "";

function summonCardMarkup(options: {
  key: string;
  label: string;
  effect: string;
  tint: string;
  icon: string;
  price: string;
  disabled: boolean;
  affordable: boolean;
  hotkey?: string;
  wide?: boolean;
  testId?: string;
  title: string;
}): string {
  const classes = ["summon-card"];
  if (options.wide) classes.push("summon-card--wide");
  if (!options.affordable) classes.push("summon-card--short");
  const testId = options.testId ? ` data-testid="${options.testId}"` : "";
  const hotkey = options.hotkey ? `<span class="summon-card-key">${options.hotkey}</span>` : "";
  return `<button type="button" class="${classes.join(" ")}" data-summon-product="${options.key}"${testId}`
    + ` style="--product:${options.tint};--product-icon:url('${SUMMON_ICON_BASE}${options.icon}.png')"`
    + ` title="${escapeHtml(options.title)}" aria-label="${escapeHtml(`${options.label} · ${options.effect} · ${options.price}`)}"`
    + `${options.disabled ? " disabled" : ""}>`
    + `<i class="summon-card-icon" aria-hidden="true"></i>`
    + `<b>${escapeHtml(options.label)}</b><small>${escapeHtml(options.effect)}</small>`
    + `<em>${escapeHtml(options.price)}</em>${hotkey}</button>`;
}

function renderSummonShop(): void {
  const state = engine.state;
  const active = state.phase === "prep" || state.phase === "combat";
  const base = summonCost(state.summonCount);
  const tenCost = multiSummonCost(state.summonCount, 10);
  const multiUnlocked = state.wave >= 10;
  const products = SUMMON_PRODUCTS
    .filter((product) => engine.isSummonProductAvailable(product.intent))
    .map((product) => {
      // 좁은 지역 풀에서는 보장 별이 한 단계 내려간다. 카드 문구도 실효 값을 따른다.
      const floor = engine.summonTierFloor(product.intent);
      return floor === null ? product : { ...product, effect: `${floor}★ 이상 확정` };
    });
  const casualTier = state.mode === "casual";
  const key = `${state.mode}|${base}|${tenCost}|${multiUnlocked ? "10" : "-"}|${state.gold}|${active ? "on" : "off"}`
    + `|${products.map((product) => `${product.intent}:${product.effect}`).join(",")}`;
  if (key === summonShopRenderKey) return;
  summonShopRenderKey = key;
  const cards = products.map((product) => {
    const price = base + SUMMON_SURCHARGE[product.intent];
    const affordable = state.gold >= price;
    const tiered = casualTier && (product.intent === "balanced" || engine.summonTierFloor(product.intent) !== null);
    const effect = tiered && product.intent === "balanced" ? "전체 풀 · 짝 맞춤 보정" : product.effect;
    return summonCardMarkup({
      key: product.intent,
      label: product.label,
      effect,
      tint: product.tint,
      icon: product.icon,
      price: `${price} 엽전`,
      disabled: !active || !affordable,
      affordable: !active || affordable,
      hotkey: product.intent === "balanced" ? "1" : undefined,
      testId: product.intent === "balanced" ? "summon-button" : undefined,
      title: `${product.label} · ${product.effect} · ${price}엽전`
        + (product.intent === "balanced" ? "" : ` (기본 ${base} + 목적 ${SUMMON_SURCHARGE[product.intent]})`)
        + (tiered ? ` · ${PAIR_BOOST_NOTE}` : "")
    });
  });
  cards.push(summonCardMarkup({
    key: "multi",
    label: "10연 소환",
    effect: multiUnlocked ? "기본 확률 10회" : "10웨이브에 개방",
    tint: "#a8791f",
    icon: "v4/shop/shop-ten-pull-coin-bundle-v1",
    price: multiUnlocked ? `${tenCost} 엽전` : "10W 개방",
    disabled: !active || !multiUnlocked || state.gold < tenCost,
    affordable: !active || !multiUnlocked || state.gold >= tenCost,
    hotkey: "Q",
    wide: cards.length % 2 === 1,
    testId: "multi-summon-button",
    title: multiUnlocked ? `10연 소환 · ${tenCost}엽전 · 할증 없음` : "10웨이브를 지키면 열립니다"
  }));
  must<HTMLElement>("#summon-shop").innerHTML = cards.join("");
}

function renderFormationUnlocks(): void {
  const state = engine.state;
  const cost = engine.nextFormationUnlockCost();
  const active = state.phase === "prep" || state.phase === "combat";
  const key = `${state.unlockedFormations.join(",")}|${state.startingFormationIndex ?? "none"}|${state.gold}|${active ? "active" : "inactive"}|${cost ?? "done"}`;
  if (key === formationRenderKey) return;
  formationRenderKey = key;
  const remaining = BOARD_FORMATIONS.length - state.unlockedFormations.length;
  must<HTMLElement>("#formation-unlock-summary").textContent = state.startingFormationIndex === null
    ? "첫 소환 자령의 오행진을 무료로 개방합니다"
    : remaining > 0
      ? `${state.unlockedFormations.length}진 개방 · 다음 ${cost}엽전 · 원하는 오행 선택`
      : "오행진 5개 전부 개방";
  must<HTMLElement>("#formation-unlock-list").innerHTML = BOARD_FORMATIONS.map((formation, index) => {
    const unlocked = engine.isFormationUnlocked(index);
    const affordable = !unlocked && active && cost !== null && state.gold >= cost && state.startingFormationIndex !== null;
    const disabled = unlocked || !active || cost === null || state.gold < cost;
    const status = unlocked
      ? index === state.startingFormationIndex ? "시작 진" : "개방"
      // 5칸 격자는 한 줄이 6~7자를 넘기면 잘린다. 전체 안내는 바 머리글이 맡는다.
      : state.startingFormationIndex === null ? "첫 소환" : `${cost}엽전`;
    return `<button type="button" data-formation-index="${index}" class="${unlocked ? "is-unlocked" : affordable ? "is-affordable" : ""}" style="--formation:${formation.color}" ${disabled ? "disabled" : ""}><b>${formation.preferredWuxing}</b><span>${formation.label}</span><small>${status}</small></button>`;
  }).join("");
  // 처음 하는 사람은 진을 추가 구매할 수 있다는 사실 자체를 모른다.
  // 해금 가능해지는 최초 1회만 짚어 준다.
  if (cost !== null && state.gold >= cost && state.startingFormationIndex !== null && state.unlockedFormations.length < BOARD_FORMATIONS.length && !formationUnlockHintShown) {
    formationUnlockHintShown = true;
    showToast(`엽전 ${cost}으로 새 오행진을 해금할 수 있습니다 — 상점의 오행진 해금에서 원하는 진을 고르세요`);
  }
}

function syncPanel(): void {
  const state = engine.state;
  const plan = engine.getCurrentPlan();
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
  must<HTMLElement>("#enemy-limit-chip").classList.toggle("is-danger", state.enemies.length >= MAX_ENEMIES * 0.75);
  must<HTMLElement>("#gold-value").textContent = String(state.gold);
  must<HTMLElement>("#interest-preview").textContent = "이자 +" + String(interestForGold(state.gold));
  must<HTMLElement>("#enemy-cap-value").textContent = String(MAX_ENEMIES) + "체";
  must<HTMLElement>("#tower-count-value").textContent = String(state.towers.length) + " / " + String(engine.deployedTowerCapacity());
  must<HTMLElement>("#goal-count-value").textContent = String(state.goalsCompleted.length) + " / " + String(engine.catalog.goalOrder.length);
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
  if (elementUpgradeDialog.open && elementUpgradeRenderKey !== nextElementUpgradeRenderKey) renderElementUpgrades();
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
  const bossRemaining = engine.bossTimeRemaining();
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
  if (activePanelTab === "concentration") renderConcentration();
  if (activePanelTab === "growth") renderGrowth();
  renderIdiomHud();
  renderActiveIdioms();
}

function renderGoal(): void {
  const progress = engine.goalProgress();
  const maxSummonStage = maxSummonStageForWave(engine.state.wave);
  const ownedTowers = [...engine.state.towers, ...engine.state.inventoryTowers];
  const ownedCounts = new Map<string, number>();
  for (const tower of ownedTowers) ownedCounts.set(tower.char, (ownedCounts.get(tower.char) ?? 0) + 1);
  const ownedSignature = [...ownedCounts.entries()].sort(([left], [right]) => left.localeCompare(right, "ko")).map(([char, count]) => `${char}:${count}`).join(",");
  const key = [
    goalPanelMode,
    goalSearchQuery,
    engine.state.targetChar,
    progress.directMaterials.map((item) => item.char + ":" + String(item.owned) + "/" + String(item.needed)).join(","),
    engine.state.goalsCompleted.join(""),
    engine.state.featuredIdiomIds.join(","),
    engine.state.idiomSeals.map((seal) => seal.idiomId).join(","),
    maxSummonStage,
    engine.state.lineageClueProgress,
    engine.state.lineageTargetProgress,
    ownedSignature
  ].join("|");
  if (key === goalRenderKey) return;
  goalRenderKey = key;

  const pool = engine.summonDefinitions();
  must<HTMLElement>("#shop-pool-count").textContent = pool.length.toLocaleString("ko-KR");
  const nextStage = maxSummonStage < 5 ? (maxSummonStage + 1) as 2 | 3 | 4 | 5 : null;
  must<HTMLElement>("#summon-pool-summary").innerHTML = engine.state.mode === "casual"
    ? `<b>천자문 ${pool.length.toLocaleString("ko-KR")}종</b><span>전 자령 직접 등장 · 획수별 1★–8★</span>`
    : `<b>천자문 ${pool.length.toLocaleString("ko-KR")}종</b><span>${STAGE_NAMES[maxSummonStage]}까지 등장${nextStage ? ` · ${summonStageUnlockWave(nextStage)}W 다음 단계` : " · 전 단계 개방"}</span>`;

  const goalPanel = must<HTMLElement>("#goal-panel");
  goalPanel.dataset.currentGoalMode = goalPanelMode;
  document.querySelectorAll<HTMLButtonElement>("[data-goal-mode]").forEach((button) => {
    const selected = button.dataset.goalMode === goalPanelMode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  must<HTMLElement>("#goal-glyph").textContent = progress.target.char;
  must<HTMLElement>("#goal-glyph").style.setProperty("--goal-color", ELEMENT_STYLES[progress.target.wuxing].color);
  const targetUnlockWave = summonStageUnlockWave(progress.target.stage);
  const targetDirectLocked = engine.state.mode === "standard" && progress.target.acquisition === "direct" && engine.state.wave < targetUnlockWave;
  const targetNaturalStar = casualNaturalStar(progress.target.char);
  must<HTMLElement>("#goal-stage").textContent = engine.state.mode === "casual"
    ? `${targetNaturalStar ?? 1}★ · ${casualStrokeCount(progress.target.char) ?? "?"}획 · 직접 소환 가능`
    // STAGE_NAMES[2]='결합' 과 역할 이름이 맨몸으로 붙어 '결합 · 재화연성'
    // 처럼 무엇과 무엇인지 알 수 없는 줄이 됐다. 각 조각에 이름표를 준다.
    : `${progress.target.stage}단 ${STAGE_NAMES[progress.target.stage]} · ` + (targetDirectLocked ? `${targetUnlockWave}W 직접 소환 개방` : progress.target.acquisition === "direct" ? "직접 소환 가능" : `역할 ${progress.target.combat.abilities.role.name}`);
  must<HTMLElement>("#goal-recipe").textContent = engine.state.mode === "casual"
    ? `${progress.target.char} 자령을 한 번 소환하면 달성`
    : progress.target.acquisition === "direct"
    ? `${progress.target.char} 자령을 소환하면 달성`
    : progress.target.parents.join(" + ") + " → " + progress.target.char;
  const learning = learningInfo(engine.state.region, progress.target.char);
  must<HTMLElement>("#goal-reading").textContent = learning.readingLabel + " · " + learning.short;
  must<HTMLElement>("#goal-materials").innerHTML = progress.directMaterials.map((material) => {
    const complete = material.owned >= material.needed;
    return `<span class="${complete ? "is-complete" : ""}"><b>${escapeHtml(material.char)}</b> ${material.owned}/${material.needed}</span>`;
  }).join("")
    + `<span class="goal-clue" title="계보 소환 12회마다 재료 1기 보장"><b>단서</b> ${engine.state.lineageClueProgress}/12</span>`
    + `<span class="goal-clue" title="계보 소환 30회 누적 시 목표 한자 확정 지급"><b>확정</b> ${engine.state.lineageTargetProgress}/30</span>`;
  const goalPercent = Math.round(progress.progress * 100);
  must<HTMLElement>("#goal-progress-fill").style.width = String(goalPercent) + "%";

  const idiom = engine.currentIdiomTarget();
  const idiomProgress = idiom ? engine.idiomProgress(idiom.id) : null;
  const idiomCard = must<HTMLElement>("#idiom-target-card");
  if (idiom && idiomProgress) {
    const glyphs = ownedIdiomGlyphMarkup(idiom.chars, ownedCounts);
    idiomCard.style.setProperty("--idiom-accent", idiom.color);
    idiomCard.innerHTML = `
      <div class="idiom-target-glyphs">${glyphs}</div>
      <div class="idiom-target-copy"><span>현재 성어 목표 · ${idiomProgress.owned}/${idiomProgress.total}자 보유</span><strong>${escapeHtml(idiom.reading)}</strong><small>${escapeHtml(idiom.meaning)}</small><em>${escapeHtml(idiom.bonus.label)}</em></div>
      <div class="idiom-target-status"><b>${Math.round(idiomProgress.readiness * 100)}%</b><span>${idiomProgress.missingChars.length > 0 ? `부족 ${idiomProgress.missingChars.map(escapeHtml).join("·")}` : "배치 준비"}</span></div>`;
  } else {
    idiomCard.removeAttribute("style");
    idiomCard.innerHTML = `<div class="goal-selector-empty"><b>이번 판 성어 목표를 모두 봉인했습니다</b><span>성어 목록에서 다음 목표를 선택할 수 있습니다.</span></div>`;
  }

  const modePercent = goalPanelMode === "idiom" && idiomProgress ? Math.round(idiomProgress.readiness * 100) : goalPercent;
  must<HTMLElement>("#goal-tab-progress").textContent = `${modePercent}%`;
  const boardUnique = new Set(engine.state.towers.map((tower) => tower.char)).size;
  const storedUnique = new Set(engine.state.inventoryTowers.map((tower) => tower.char)).size;
  must<HTMLElement>("#goal-owned-summary").innerHTML = `<b>${ownedCounts.size}자 · ${ownedTowers.length}기 보유</b><span>전장 ${boardUnique}자 · 인벤 ${storedUnique}자</span>`;

  const search = must<HTMLInputElement>("#goal-search");
  search.placeholder = goalPanelMode === "hanzi" ? "원하는 한자·훈음·뜻 검색" : "원하는 성어·읽기·뜻 검색";
  const selector = must<HTMLElement>("#goal-selector-list");
  selector.innerHTML = goalPanelMode === "hanzi"
    ? renderHanziGoalChoices(pool, ownedCounts)
    : renderIdiomGoalChoices(engine.allIdioms(), ownedCounts);
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
  const query = goalSearchQuery.trim().toLowerCase();
  const rows = definitions
    .map((definition, order) => {
      const learning = learningInfo(engine.state.region, definition.char);
      const progress = engine.goalProgressFor(definition.char);
      const owned = ownedCounts.get(definition.char) ?? 0;
      const selected = definition.char === engine.state.targetChar;
      const completed = engine.state.goalsCompleted.includes(definition.char);
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
              : engine.state.mode === "casual"
                ? `${casualNaturalStar(definition.char) ?? 1}★ 직접 소환`
                : definition.acquisition === "direct" ? "직접 소환" : `${definition.stage}단 ${STAGE_NAMES[definition.stage]}`;
    const unlockWave = summonStageUnlockWave(definition.stage);
    const directLocked = engine.state.mode === "standard" && definition.acquisition === "direct" && engine.state.wave < unlockWave;
    const naturalStar = casualNaturalStar(definition.char);
    const materialLabel = engine.state.mode === "casual"
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
  const query = goalSearchQuery.trim().toLowerCase();
  const currentId = engine.currentIdiomTarget()?.id;
  const sealedIds = new Set(engine.state.idiomSeals.map((seal) => seal.idiomId));
  const rows = idioms
    .map((idiom, order) => {
      const progress = engine.idiomProgress(idiom.id);
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
      <span class="goal-choice-copy"><strong>${escapeHtml(idiom.reading)}</strong><small>${escapeHtml(idiom.meaning)}</small><em>${escapeHtml(idiom.bonus.label)} · ${progress.missingChars.length > 0 ? `부족 ${progress.missingChars.map(escapeHtml).join("·")}` : "네 글자 보유"}</em></span>
      <mark>${escapeHtml(status)}</mark>
    </button>`;
  }).join("");
}

function renderEvolutions(): void {
  if (engine.state.mode === "casual") {
    renderCasualFusion();
    return;
  }
  const options = engine.availableEvolutions();
  const key = engine.state.automationMode + "|" + String(engine.state.selectedTowerId) + "|" + options.map((option) => option.recipeId + ":" + option.materialTowerIds.join(",")).join("|");
  must<HTMLElement>("#evolution-count").textContent = String(options.length);
  must<HTMLElement>("#evolve-ready-count").textContent = String(options.length);
  const evolveButton = must<HTMLButtonElement>("#evolve-button");
  must<HTMLElement>("#evolve-action-label").textContent = "합성";
  must<HTMLElement>("#evolve-action-detail").textContent = "개 조합 확인";
  must<HTMLElement>("#evolution-tab-label").textContent = "합성";
  must<HTMLElement>("#evolution-kicker").textContent = "조합 서책";
  must<HTMLElement>("#evolution-heading-label").textContent = "현재 가능한 합성";
  must<HTMLElement>("#standard-evolution-modes").hidden = false;
  must<HTMLElement>("#casual-fusion-toolbar").hidden = true;
  must<HTMLElement>("#evolution-options").classList.remove("is-casual");
  const active = engine.state.phase === "prep" || engine.state.phase === "combat";
  evolveButton.disabled = !active || options.length === 0;
  evolveButton.classList.toggle("has-ready", options.length > 0);
  if (key === evolutionRenderKey) return;
  evolutionRenderKey = key;
  const container = must<HTMLElement>("#evolution-options");
  if (options.length === 0) {
    const manual = engine.state.automationMode === "manual";
    container.innerHTML = `<div class="empty-evolution"><b>${manual ? "전장의 한자를 선택하세요" : "재료를 모으는 중"}</b><span>${manual ? "선택한 한자가 들어가는 조합만 표시됩니다." : "목표 재료는 소환 확률이 서서히 보정됩니다."}</span></div>`;
    return;
  }
  container.innerHTML = `<p class="evolution-warning">행을 누르면 재료 자령을 소모해 바로 합성됩니다</p>` + options.slice(0, 3).map((option, index) => evolutionCard(option, index)).join("");
}

function casualStarOf(tower: Tower): CasualStar {
  return tower.casualStar ?? tower.naturalStar ?? 1;
}

function towerProgressionLabel(tower: Tower): string {
  const star = casualStarOf(tower);
  return engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]}` : STAGE_NAMES[tower.stage];
}

function casualFusionTowerMarkup(tower: Tower, selected: boolean, disabled: boolean, badge: string | null = null): string {
  const star = casualStarOf(tower);
  const natural = tower.naturalStar ?? casualNaturalStar(tower.char) ?? star;
  const strokes = casualStrokeCount(tower.char);
  const selectedIndex = casualFusionSelection.indexOf(tower.id);
  const selectedRole = selectedIndex >= 0 ? `소모 ${selectedIndex + 1}` : "";
  const location = tower.cell < 0 ? "인벤" : BOARD_FORMATIONS[Math.floor(tower.cell / CELLS_PER_FORMATION)]?.label ?? "전장";
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, engine.state.region);
  return `<button type="button" class="casual-fusion-tower ${selected ? "is-selected is-material" : ""} ${badge ? "is-short" : ""}" data-casual-fusion-tower="${tower.id}" style="--element:${ELEMENT_STYLES[tower.wuxing].color};--star:${CASUAL_STAR_COLORS[star]}" aria-pressed="${String(selected)}" ${disabled ? "disabled" : ""}>
    <i class="casual-fusion-sprite" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></i>
    <b>${escapeHtml(tower.char)}</b>
    <span><strong>${tower.wuxing}행 · ${star}★ ${CASUAL_STAR_NAMES[star]}</strong><small>${strokes ?? "?"}획 · 기본 ${natural}★ · ${location}${tower.locked ? " · 鎖 잠금" : ""}</small></span>
    <em>${badge ? escapeHtml(badge) : selectedRole || (star >= 8 ? "최고" : "선택")}</em>
  </button>`;
}

function casualFusionSlotMarkup(tower: Tower | undefined, index: number): string {
  const roleLabel = `${["①", "②", "③"][index] ?? "＋"} 소모`;
  if (!tower) {
    return `<button type="button" class="casual-fusion-slot is-material" data-casual-fusion-slot="${index}" disabled style="--element:#526274;--star:#526274" aria-label="${roleLabel} 미선택">
      <span>${roleLabel}</span><b>＋</b><strong>사라집니다</strong><small>같은 오행·같은 별 선택</small>
    </button>`;
  }
  const star = casualStarOf(tower);
  const natural = tower.naturalStar ?? casualNaturalStar(tower.char) ?? star;
  const strokes = casualStrokeCount(tower.char);
  const location = tower.cell < 0 ? "인벤" : BOARD_FORMATIONS[Math.floor(tower.cell / CELLS_PER_FORMATION)]?.label ?? "전장";
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, engine.state.region);
  return `<button type="button" class="casual-fusion-slot is-filled is-material" data-casual-fusion-slot="${index}" style="--element:${ELEMENT_STYLES[tower.wuxing].color};--star:${CASUAL_STAR_COLORS[star]}" aria-label="${roleLabel} ${tower.char} 선택 해제">
    <span>${roleLabel} <em>소모</em></span>
    <i class="casual-fusion-slot-sprite" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></i>
    <b>${escapeHtml(tower.char)}</b>
    <div><strong>${tower.wuxing}행 · 현재 ${star}★</strong><small>자연 ${natural}★ · ${strokes ?? "?"}획</small><small>${location}${tower.locked ? " · 鎖 잠금" : ""}</small></div>
  </button>`;
}

interface CasualFusionBucket {
  wuxing: Wuxing;
  star: CasualStar;
  owned: Tower[];
  groups: CasualAutoFusionGroup[];
  shortReason: string | null;
}

/**
 * 같은 오행·같은 별로 3체 이상 모인 묶음만 카드로 만든다. 승급이 안 되는
 * 묶음(보호 자령이 많아 소모 후보 3기 미달, 또는 상위 별 글자 자체가 없음)도
 * 사유와 함께 남겨야 "왜 안 되지"가 사라진다.
 */
function casualFusionBuckets(
  allTowers: readonly Tower[],
  plans: ReadonlyMap<Wuxing, CasualAutoFusionGroup[]>,
  protections: ReadonlyMap<number, string>
): CasualFusionBucket[] {
  const owned = new Map<string, Tower[]>();
  for (const tower of allTowers) {
    const star = casualStarOf(tower);
    if (star >= 8) continue;
    const key = `${tower.wuxing}:${star}`;
    const list = owned.get(key) ?? [];
    list.push(tower);
    owned.set(key, list);
  }
  const buckets: CasualFusionBucket[] = [];
  for (const wuxing of WUXING_ORDER) {
    for (let star = 1 as CasualStar; star <= 7; star = (star + 1) as CasualStar) {
      const list = owned.get(`${wuxing}:${star}`) ?? [];
      if (list.length < 3) continue;
      const groups = (plans.get(wuxing) ?? []).filter((group) => group.fromStar === star);
      let shortReason: string | null = null;
      if (groups.length === 0) {
        if (engine.casualResultPool(wuxing, star) === null) {
          shortReason = `이 오행은 ${star}★ 위 글자가 없습니다`;
        } else {
          const reasons = list.map((tower) => protections.get(tower.id)).filter((reason): reason is string => reason !== undefined);
          const safe = list.length - reasons.length;
          const top = [...new Set(reasons)].slice(0, 2).join(" · ");
          shortReason = `${top || "보호"} 보호로 소모 후보 ${safe}/3 부족 — 같은 별 ${Math.max(1, 3 - safe)}기를 더 모으세요`;
        }
      }
      buckets.push({ wuxing, star, owned: list, groups, shortReason });
    }
  }
  return buckets;
}

function casualGroupCardMarkup(bucket: CasualFusionBucket, allTowers: readonly Tower[], active: boolean): string {
  const style = `--element:${ELEMENT_STYLES[bucket.wuxing].color};--star:${CASUAL_STAR_COLORS[bucket.star]}`;
  if (bucket.shortReason) {
    const next = Math.min(8, bucket.star + 1) as CasualStar;
    return `<article class="casual-group-card is-blocked" style="${style}">
      <i class="casual-group-glyph" aria-hidden="true">${bucket.wuxing}</i>
      <div class="casual-group-body"><b>${bucket.star}★ ×${bucket.owned.length} → ${next}★ 승급 불가</b><small>${escapeHtml(bucket.shortReason)}</small></div>
      <span class="casual-group-run is-disabled">보호 중</span>
    </article>`;
  }
  const first = bucket.groups[0];
  const toStar = first?.toStar ?? Math.min(8, bucket.star + 1) as CasualStar;
  const headline = `${bucket.star}★ ×${bucket.owned.length} → ${toStar}★ 무작위 ${bucket.groups.length}기`;
  const materials = (first?.materialIds ?? []).map((id) => allTowers.find((tower) => tower.id === id)).filter((tower): tower is Tower => Boolean(tower));
  const boardMaterials = bucket.groups.flatMap((group) => group.materialIds)
    .map((id) => allTowers.find((tower) => tower.id === id))
    .filter((tower): tower is Tower => tower !== undefined && tower.cell >= 0).length;
  const useLine = materials.length > 0 ? `소모 ${materials.map((tower) => escapeHtml(tower.char)).join("·")}` : "소모 자령 확인 중";
  const poolLine = first ? ` · ${toStar}★ 후보 ${first.poolSize}자` : "";
  const more = bucket.groups.length > 1 ? ` · 외 ${bucket.groups.length - 1}묶음` : "";
  const fallback = first?.starFallback ? `<em class="casual-group-badge is-fallback">${bucket.star + 1}★ 없음 → ${toStar}★</em>` : "";
  const roster = first?.rosterFallback ? `<em class="casual-group-badge is-fallback">지역 로스터 보충</em>` : "";
  return `<article class="casual-group-card" style="${style}">
    <i class="casual-group-glyph" aria-hidden="true">${bucket.wuxing}</i>
    <div class="casual-group-body">
      <b>${headline}</b>
      <small>${useLine}${poolLine}${more}</small>
      ${boardMaterials > 0 ? `<em class="casual-group-badge">전장 ${boardMaterials}기 소모</em>` : ""}${fallback}${roster}
    </div>
    <button type="button" class="casual-group-run" data-casual-group="${bucket.wuxing}:${bucket.star}" ${active ? "" : "disabled"}>승급</button>
  </article>`;
}

function renderCasualFusion(): void {
  const allTowers = [...engine.state.towers, ...engine.state.inventoryTowers];
  const ids = new Set(allTowers.map((tower) => tower.id));
  casualFusionSelection = casualFusionSelection.filter((id, index) => ids.has(id) && casualFusionSelection.indexOf(id) === index).slice(0, 3);
  const anchor = allTowers.find((tower) => tower.id === casualFusionSelection[0]);
  if (anchor && casualStarOf(anchor) >= 8) casualFusionSelection = [];
  const selectedTowers = casualFusionSelection.map((id) => allTowers.find((tower) => tower.id === id)).filter((tower): tower is Tower => Boolean(tower));
  const quote = selectedTowers.length === 3 ? engine.casualFusionQuote(casualFusionSelection) : null;
  const active = engine.state.phase === "prep" || engine.state.phase === "combat";
  const plans = new Map(WUXING_ORDER.map((wuxing) => [wuxing, engine.casualAutoFusionPlan(wuxing)] as const));
  const protections = engine.casualMaterialProtections();
  const readyCount = [...plans.values()].reduce((sum, groups) => sum + groups.length, 0);
  const inventorySignature = allTowers.map((tower) => `${tower.id}:${tower.wuxing}:${casualStarOf(tower)}:${tower.cell}:${tower.locked ? 1 : 0}:${tower.concentration ?? 0}`).join("|");
  const key = `${inventorySignature}|S${casualFusionSelection.join(",")}|R${readyCount}`;

  must<HTMLElement>("#evolution-count").textContent = String(readyCount);
  must<HTMLElement>("#evolve-ready-count").textContent = String(readyCount);
  must<HTMLElement>("#evolve-action-label").textContent = "3체 조합";
  must<HTMLElement>("#evolve-action-detail").textContent = "회 가능";
  must<HTMLElement>("#evolution-tab-label").textContent = "3체 조합";
  must<HTMLElement>("#evolution-kicker").textContent = "3체 조합 · 팔성 승급";
  must<HTMLElement>("#evolution-heading-label").textContent = "현재 가능한 조합";
  must<HTMLElement>("#standard-evolution-modes").hidden = true;
  must<HTMLElement>("#casual-fusion-toolbar").hidden = false;
  const evolveButton = must<HTMLButtonElement>("#evolve-button");
  evolveButton.disabled = !active;
  evolveButton.classList.toggle("has-ready", readyCount > 0);
  const container = must<HTMLElement>("#evolution-options");
  container.classList.add("is-casual");
  const buckets = casualFusionBuckets(allTowers, plans, protections);
  const fuseAllButton = must<HTMLButtonElement>("#casual-fuse-all");
  fuseAllButton.disabled = !active || readyCount === 0;
  must<HTMLElement>("#casual-fuse-all-count").textContent = readyCount > 0 ? `${readyCount}회 가능` : "지금은 0회";
  must<HTMLElement>("#casual-fuse-all-note").textContent = readyCount > 0
    ? "3기가 모두 사라지고 같은 오행의 다음 별 자령 1기를 무작위로 얻습니다. 인벤토리 자령을 먼저 씁니다."
    : buckets.some((bucket) => bucket.shortReason !== null)
      ? "3체는 모였지만 소모할 수 없는 자령이 섞여 있습니다. 아래 카드에서 사유를 확인하세요."
      : "같은 오행·같은 별 자령이 3체 모이면 여기서 한 번에 승급합니다.";
  if (key === evolutionRenderKey) return;
  evolutionRenderKey = key;

  const slotMarkup = [0, 1, 2].map((index) => casualFusionSlotMarkup(selectedTowers[index], index)).join("");
  const selectedIds = new Set(casualFusionSelection);
  const candidates = allTowers
    .filter((tower) => {
      if (!anchor || selectedIds.has(tower.id)) return true;
      return tower.wuxing === anchor.wuxing && casualStarOf(tower) === casualStarOf(anchor);
    })
    .sort((left, right) => Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id)) || casualStarOf(right) - casualStarOf(left) || left.wuxing.localeCompare(right.wuxing) || left.id - right.id);
  // 같은 오행·별로 3체가 안 모인 자령은 고르기 전에 흐리게 표시한다.
  const bucketSize = new Map<string, number>();
  for (const tower of allTowers) {
    const key = `${tower.wuxing}:${casualStarOf(tower)}`;
    bucketSize.set(key, (bucketSize.get(key) ?? 0) + 1);
  }
  const candidateMarkup = candidates.length > 0 ? candidates.map((tower) => {
    const selectionIndex = casualFusionSelection.indexOf(tower.id);
    const incompatible = Boolean(anchor) && selectionIndex < 0 && (tower.wuxing !== anchor?.wuxing || casualStarOf(tower) !== casualStarOf(anchor));
    const star = casualStarOf(tower);
    const tooFew = selectionIndex < 0 && star < 8 && (bucketSize.get(`${tower.wuxing}:${star}`) ?? 0) < 3;
    // v3 규칙 2: 보호 자령은 3기 어디에도 못 들어가므로 첫 슬롯부터 사유를 붙여 잠근다.
    const protection = selectionIndex < 0 ? protections.get(tower.id) ?? null : null;
    const noPool = selectionIndex < 0 && star < 8 && engine.casualResultPool(tower.wuxing, star) === null;
    const badge = selectionIndex >= 0 ? null : protection ?? (noPool ? "상위 별 없음" : tooFew ? "3체 미달" : null);
    const disabled = !active
      || casualFusionSelection.length >= 3 && selectionIndex < 0
      || protection !== null
      || noPool
      || selectionIndex < 0 && incompatible
      || !anchor && (star >= 8 || tooFew);
    return casualFusionTowerMarkup(tower, selectionIndex >= 0, disabled, badge);
  }).join("") : `<div class="empty-evolution"><b>소환한 자령이 없습니다</b><span>상점에서 첫 자령을 소환하면 획수에 따른 기본 별이 표시됩니다.</span></div>`;
  const status = quote?.blocked.length
    ? `<p class="casual-fusion-status is-blocked"><b>조합 불가</b><span>${quote.blocked.map((issue) => escapeHtml(issue.text)).join(" · ")}</span></p>`
    : quote
      ? `<p class="casual-fusion-status ${quote.warnings.length > 0 ? "has-warning" : "is-ready"}"><b>${quote.fromStar}★×3 → ${quote.toStar}★ 무작위 1기</b><span>${quote.warnings.length > 0 ? `${quote.warnings.length}개 확인 사항 · 3기가 모두 사라집니다.` : `3기가 모두 사라지고 ${quote.wuxing}행 ${quote.toStar}★ 후보 ${quote.poolSize}자 중 하나를 얻습니다.`}</span></p>`
      : `<p class="casual-fusion-status"><b>${selectedTowers.length}/3 선택</b><span>${selectedTowers.length === 0 ? "소모할 자령부터 선택하세요 — 3기 모두 사라집니다." : "같은 오행·같은 현재 별 자령을 마저 고르세요."}</span></p>`;
  const previewPool = anchor && casualStarOf(anchor) < 8 ? engine.casualResultPool(anchor.wuxing, casualStarOf(anchor)) : null;
  const resultStar = quote?.toStar ?? previewPool?.star ?? null;
  const groupCards = buckets.map((bucket) => casualGroupCardMarkup(bucket, allTowers, active)).join("");
  const emptyState = `<div class="casual-group-empty">
    <b>같은 오행·같은 별 자령이 3체 모이면 여기서 한 번에 승급합니다</b>
    <span>상점에서 소환을 계속하세요.</span>
    <button type="button" id="casual-goto-shop" class="casual-goto-shop">상점으로</button>
  </div>`;
  container.innerHTML = `
    <div class="casual-group-list">${groupCards || emptyState}</div>
    <details class="casual-manual" id="casual-manual-details"${casualManualOpen ? " open" : ""}>
      <summary><b>직접 고르기</b><small>소모할 같은 오행·같은 별 자령 3기를 손으로 지정합니다</small></summary>
      <div class="casual-rarity-rule"><span><b>획수 기본 별</b><small>실제 Unicode kTotalStrokes</small></span>${([1, 2, 3, 4, 5, 6, 7, 8] as CasualStar[]).map((star) => `<i style="--star:${CASUAL_STAR_COLORS[star]}"><b>${star}★</b><small>${casualStarRangeLabel(star)}</small></i>`).join("")}</div>
      <div class="casual-fusion-slots">${slotMarkup}<i aria-hidden="true">→</i><div class="casual-fusion-result is-random" style="--star:${resultStar ? CASUAL_STAR_COLORS[resultStar] : "#526274"}"><span>무작위 획득</span><b>?</b><strong${resultStar ? "" : ` class="is-placeholder"`}>${resultStar ? `${resultStar}★ 무작위 1기` : "별 미정 — 자령을 먼저 선택"}</strong><small>${resultStar ? `피해 ×${CASUAL_STAR_POWER[resultStar].toFixed(2)} · 후보 ${quote?.poolSize ?? previewPool?.candidates.length ?? 0}자` : "소모할 자령 선택 필요"}</small></div></div>
      ${status}
      <button id="casual-fusion-review" class="workbench-primary casual-fusion-review" type="button" ${!quote || quote.blocked.length > 0 ? "disabled" : ""}>소모 목록 확인 후 ${resultStar ?? "?"}★ 무작위 획득</button>
      <div class="casual-candidate-heading"><div><b>보유 자령</b><small>${anchor ? `${anchor.wuxing}행 ${casualStarOf(anchor)}★만 표시` : "3체가 모인 자령만 고를 수 있습니다"}</small></div><em>잠금·농축·목표·성어는 소모 불가</em></div>
      <div class="casual-fusion-candidates">${candidateMarkup}</div>
    </details>`;
}

function casualConfirmTowerRow(tower: Tower): string {
  const star = casualStarOf(tower);
  const strokes = casualStrokeCount(tower.char);
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, engine.state.region);
  return `<article class="casual-confirm-tower is-material" style="--element:${ELEMENT_STYLES[tower.wuxing].color};--star:${CASUAL_STAR_COLORS[star]}"><i class="casual-confirm-sprite" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></i><b>${escapeHtml(tower.char)}</b><span><strong>소모 · 복구 불가</strong><small>${tower.wuxing}행 · ${star}★ · ${strokes ?? "?"}획 · ${tower.cell < 0 ? "인벤" : "전장"}</small></span><em>소모</em></article>`;
}

function openCasualManualReview(): void {
  if (casualFusionSelection.length !== 3) return;
  const [firstId, secondId, thirdId] = casualFusionSelection;
  if (firstId === undefined || secondId === undefined || thirdId === undefined) return;
  const materialIds: [number, number, number] = [firstId, secondId, thirdId];
  const quote = engine.casualFusionQuote(materialIds);
  if (quote.blocked.length > 0 || quote.fromStar === null || quote.toStar === null || quote.wuxing === null) {
    showToast(quote.blocked[0]?.text ?? "조합 조건을 다시 확인하세요.", true);
    return;
  }
  const all = [...engine.state.towers, ...engine.state.inventoryTowers];
  const materials = materialIds.map((id) => all.find((tower) => tower.id === id)).filter((tower): tower is Tower => Boolean(tower));
  if (materials.length !== 3) return;
  pendingCasualFusion = { kind: "manual", materialIds, quote };
  const boardCount = materials.filter((tower) => tower.cell >= 0).length;
  must<HTMLElement>("#casual-fusion-confirm-title").textContent = `${quote.wuxing}행 ${quote.fromStar}★×3 → ${quote.toStar}★ 무작위`;
  const fallbackNote = quote.starFallback
    ? `<p class="casual-confirm-safe">${quote.fromStar + 1}★ ${quote.wuxing}행 글자가 없어 ${quote.toStar}★에서 뽑습니다.</p>`
    : quote.rosterFallback
      ? `<p class="casual-confirm-safe">이번 런 소환 풀에 후보가 없어 지역 로스터에서 보충합니다.</p>`
      : "";
  must<HTMLElement>("#casual-fusion-confirm-content").innerHTML = `
    <section class="casual-confirm-summary"><b>3기가 모두 사라지고 ${quote.toStar}★ 자령 1기를 무작위로 얻습니다</b><span>결과 글자는 공개 순간에 정해지며 되돌릴 수 없습니다.${boardCount > 0 ? ` 전장 ${boardCount}기가 빠지고 첫 자리에 새 자령이 들어섭니다.` : ""}</span><div><i>현재 피해 ×${CASUAL_STAR_POWER[quote.fromStar].toFixed(2)}</i><em>→</em><strong>획득 피해 ×${CASUAL_STAR_POWER[quote.toStar].toFixed(2)}</strong></div></section>
    <div class="casual-confirm-towers">${materials.map((tower) => casualConfirmTowerRow(tower)).join("")}</div>
    <p class="casual-confirm-pool"><b>${quote.wuxing}행 ${quote.toStar}★ 후보 ${quote.poolSize}자</b><span>이 중 하나가 무작위로 나옵니다.</span></p>
    ${fallbackNote}
    ${quote.warnings.length > 0 ? `<section class="casual-confirm-warnings"><b>확인 사항 ${quote.warnings.length}개</b><ul>${quote.warnings.map((warning) => `<li>${escapeHtml(warning.text)}</li>`).join("")}</ul></section>` : `<p class="casual-confirm-safe">잠금·목표·성어·농축 충돌이 없습니다.</p>`}`;
  must<HTMLButtonElement>("#casual-fusion-execute").textContent = `3기 소모 · ${quote.toStar}★ 무작위 획득`;
  casualFusionConfirmDialog.showModal();
}

/**
 * 그룹 카드·[한 번에 승급]의 원클릭 실행. 확인 모달을 거치지 않는 대신
 * 결과(승급 횟수·소모 자령·건너뛴 묶음)를 토스트로 반드시 가시화한다.
 */
function runCasualAutoFusion(scope: Wuxing | "all", star: CasualStar | null): void {
  sound.unlock();
  // 카드 한 장은 사용자가 배지까지 보고 누른 것이므로 전장 재료도 실행한다.
  // [한 번에 승급] 은 전 오행 일괄이라 전장 재료 묶음을 건너뛴다.
  const report = engine.autoFuseCasual(scope, star !== null, star);
  casualFusionSelection = [];
  evolutionRenderKey = "";
  handleAction(report);
  if (report.ok) setPanelTab("evolution");
}

function closeCasualFusionReview(): void {
  pendingCasualFusion = null;
  if (casualFusionConfirmDialog.open) casualFusionConfirmDialog.close();
}

function evolutionCard(option: EvolutionOption, index: number): string {
  const style = ELEMENT_STYLES[option.result.wuxing];
  const visual = jaryeongVisualFor(option.result.char, option.result.wuxing, engine.state.region);
  const abilities = option.result.combat.abilities;
  const abilitySummary = abilities.role.glyph + " " + abilities.role.name + (abilities.lineage ? " · " + abilities.lineage.glyph + " 계승" : "");
  return `
    <button class="evolution-card ${option.onTargetPath ? "is-target" : ""}" type="button" data-recipe="${option.recipeId}" style="--evo:${style.color}" title="합성 시 ${abilities.role.name}${abilities.lineage ? "와 " + abilities.lineage.name : ""} 획득">
      <span class="evolution-index">${index + 1}</span>
      <span class="recipe-parents">${option.parents.map((parent) => "<i>" + parent + "</i>").join("<em>+</em>")}</span>
      <span class="recipe-arrow">→</span>
      <span class="evolution-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <b class="recipe-result">${option.result.char}</b>
      <small>${STAGE_NAMES[option.result.stage]} · <b>${abilitySummary}</b></small>
      ${option.onTargetPath ? '<mark>목표 경로</mark>' : ""}
    </button>
  `;
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
  const tower = engine.selectedTower();
  if (!tower) return;
  const definition = definitionForTower(engine.catalog, tower.definitionId);
  const learning = learningInfo(engine.state.region, tower.char);
  const abilities = definition.combat.abilities;
  const activeSkills = engine.towerHasActiveSkills(tower);
  const skillUnlockLabel = engine.state.mode === "casual" ? "2★ 승급" : "2단 합성";
  const periodicAbilities = activeSkills
    ? [abilities.semantic, abilities.role, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability))
    : [];
  const supportingAbilities = activeSkills ? [abilities.element, abilities.graph] : [abilities.graph];
  const loadout = [...periodicAbilities, ...supportingAbilities];
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
  const holder = card.querySelector<HTMLElement>(".ability-charge");
  if (!engine.towerHasActiveSkills(tower) || holder?.classList.contains("ability-charge--locked")) return;
  const ability = definition.combat.abilities.role;
  const signatureEvery = definition.combat.abilities.tuning.signatureEvery;
  const charge = chargeStep / signatureEvery;
  const remaining = signatureEvery - chargeStep;
  const meter = card.querySelector<HTMLElement>(".ability-charge i");
  const label = card.querySelector<HTMLElement>(".ability-charge small");
  if (meter) meter.style.width = `${Math.round(charge * 100)}%`;
  if (label) label.textContent = `역할 기술 충전 · ${ability.glyph} ${ability.name} ${chargeStep}/${signatureEvery}`;
  if (holder) holder.title = `다음 역할 기술 ${ability.name}까지 ${remaining}회`;
}

function renderSelected(): void {
  const card = must<HTMLElement>("#selected-card");
  const tower = engine.selectedTower();
  const definition = tower ? definitionForTower(engine.catalog, tower.definitionId) : undefined;
  const chargeStep = tower && definition ? tower.shotCount % definition.combat.abilities.tuning.signatureEvery : 0;
  const stored = engine.selectedTowerIsStored();
  const branches = tower ? engine.compositionBranchesForSelected() : [];
  const concentration = tower?.concentration ?? 0;
  const concentrationPath = tower?.concentrationPath ?? null;
  const duplicateCount = tower ? engine.state.inventoryTowers.filter((candidate) => candidate.id !== tower.id && candidate.char === tower.char && !candidate.locked).length : 0;
  const branchKey = branches.map((branch) => `${branch.recipeId}:${branch.ready ? "R" : branch.materials.map((material) => material.location).join(",")}`).join("|");
  const key = tower ? tower.definitionId + "|" + String(tower.id) + "|" + String(tower.locked) + "|" + String(stored) + "|" + String(engine.isSynergyActive(tower.wuxing)) + "|" + branchKey + `|M${engine.state.mode}:S${tower.casualStar ?? 0}|C${concentration}:${concentrationPath ?? "none"}:D${duplicateCount}:E${engine.state.elementEssence[tower.wuxing]}` : "none";
  if (key === selectedRenderKey) {
    if (tower && definition) syncSelectedCharge(card, tower, definition, chargeStep);
    return;
  }
  selectedRenderKey = key;
  if (!tower) {
    card.innerHTML = '<div class="empty-selection"><b>자령을 선택하세요</b><span>한자·부수·공격·오행·조합망 역할을 확인할 수 있습니다.</span></div>';
    return;
  }
  if (!definition) return;
  const style = ELEMENT_STYLES[tower.wuxing];
  const concentrationDamage = 1 + concentration * (concentrationPath === "potent" ? 0.12 : 0.055);
  const damage = Math.round(definition.combat.baseDamage * engine.towerPowerMultiplier(tower) * definition.combat.budgetMultiplier * (1 + engine.idiomBonus("damage")) * (1 + engine.combinedUpgradeBonus(tower.wuxing, "damage")) * concentrationDamage);
  const range = definition.combat.range + engine.towerRangeBonus(tower) + engine.idiomBonus("range") + concentration * 4 + engine.combinedUpgradeBonus(tower.wuxing, "range");
  const attacksPerSecond = 1 / engine.towerAttackCooldown(tower);
  const learning = learningInfo(engine.state.region, tower.char);
  const abilities = definition.combat.abilities;
  const activeSkills = engine.towerHasActiveSkills(tower);
  const periodicAbilities = activeSkills
    ? [abilities.semantic, abilities.role, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability))
    : [];
  const supportingAbilities = activeSkills ? [abilities.element, abilities.graph] : [abilities.graph];
  const abilityLoadout = [...periodicAbilities, ...supportingAbilities];
  const readyBranches = branches.filter((branch) => branch.ready).length;
  const charge = chargeStep / abilities.tuning.signatureEvery;
  const remaining = abilities.tuning.signatureEvery - chargeStep;
  const nextEssenceCost = concentrationEssenceCost(concentration);
  const concentrationStatus = concentration >= MAX_CONCENTRATION_LEVEL
    ? `濃 3/3 완성 · ${concentrationPath === "potent" ? "심화" : "연속"}`
    : duplicateCount > 0 ? `중복 ${duplicateCount}기 사용 가능` : `${tower.wuxing} 문기 ${engine.state.elementEssence[tower.wuxing]}/${nextEssenceCost}`;
  const cleanup = engine.cleanupAssessments().find((assessment) => assessment.towerId === tower.id);
  const cleanupLabel = cleanup?.protected
    ? `보호 · ${cleanup.protectedReasons[0] ?? "전략 재료"}`
    : `정리 후보 · ${cleanup?.reasons[0] ?? "직접 판단"}`;
  const casualStar = casualStarOf(tower);
  const progressionLabel = engine.state.mode === "casual" ? `${casualStar}★ ${CASUAL_STAR_NAMES[casualStar]}` : STAGE_NAMES[tower.stage];
  const progressionColor = engine.state.mode === "casual" ? CASUAL_STAR_COLORS[casualStar] : STAGE_COLORS[tower.stage];
  const skillUnlockLabel = engine.state.mode === "casual" ? "2★ 승급" : "2단 합성";
  card.innerHTML = `
    <div class="selected-glyph" style="--unit:${style.color};--stage:${progressionColor}">${tower.char}${engine.state.mode === "casual" ? `<small>${casualStar}★ · ${casualStrokeCount(tower.char) ?? "?"}획</small>` : concentration > 0 ? `<small>濃 ${concentration}</small>` : ""}</div>
    <div class="selected-copy">
      <div><span>${progressionLabel} · ${style.name}행 · ${ROLE_LABELS[tower.combatRole]}</span><h3>${tower.char} <small>${GRAPH_ROLE_LABELS[tower.graphRole]}</small></h3></div>
      <p class="selected-learning"><i class="selected-radical">${displayMode === "spirit"
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
      <span class="selected-chip cleanup-reason ${cleanup?.protected ? "is-protected" : "is-candidate"}">${escapeHtml(cleanupLabel)}</span>
      <span class="selected-chip selected-chip--essence">${escapeHtml(concentrationStatus)}</span>
    </div>
    <div class="selected-actions">
      <button id="lock-button" class="${tower.locked ? "is-locked" : ""}" type="button" data-testid="lock-tower" title="판매·합성 재료로 쓰이지 않게 보호">${tower.locked ? "鎖 잠금됨" : "잠금"}</button>
      <button id="store-button" type="button" data-testid="store-tower" title="인벤으로 이동 — 전장 자리를 비웁니다" ${stored ? "disabled" : ""}>${stored ? "보관 중" : "보관"}</button>
      <button id="derivative-button" class="${readyBranches > 0 ? "has-ready" : ""}" type="button" data-testid="derivative-composition" title="이 자령이 재료인 파생 조합 목록">${engine.state.mode === "casual" ? casualStar >= 8 ? "8★ 최고 단계" : "3체 조합 ›" : `합성 ${readyBranches}`}</button>
      <button id="open-growth-button" type="button" title="강화 제련소 탭으로 이동">분해 ›</button>
      <button id="open-concentration-button" type="button" title="농축 공방 탭으로 이동" ${concentration >= MAX_CONCENTRATION_LEVEL ? "disabled" : ""}>농축 ›</button>
      <button id="sell-button" type="button" title="엽전을 받고 즉시 제거 — 되돌릴 수 없음" ${tower.locked ? "disabled" : ""}>판매 +${engine.towerSellValue(tower)}</button>
    </div>
    <button type="button" class="selected-ability-summary" data-ability-guide><b>${activeSkills ? `技 기술 ${abilityLoadout.length}개 · 모두 자동 판정` : "技 기술 해금 전"}</b><span>${activeSkills ? `주기 ${periodicAbilities.length} · 공격 연동 1 · 조건 특성 1` : "현재 기본 공격 · 2단 합성 필요"}</span><em>설명 ›</em></button>
    ${activeSkills
      ? `<div class="ability-loadout">
          <div class="ability-overview"><span><b>주기 겹침: 고유 → 역할 → 계승 중 1개 발동</b></span><button type="button" data-ability-guide>전체 설명</button></div>
          <div class="ability-pills">${abilityLoadout.map(selectedAbilityCard).join("")}</div>
        </div>
        <div class="ability-charge" title="다음 역할 기술 ${abilities.role.name}까지 ${remaining}회"><i style="width:${Math.round(charge * 100)}%;--charge:${abilities.role.color}"></i><small>역할 기술 충전 · ${abilities.role.glyph} ${abilities.role.name} ${chargeStep}/${abilities.tuning.signatureEvery}</small></div>`
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
  const visual = jaryeongVisualFor(branch.result.char, branch.result.wuxing, engine.state.region);
  const missing = branch.materials.filter((material) => material.towerId === null).map((material) => material.char);
  return `
    <button class="composition-branch ${branch.ready ? "is-ready" : "is-missing"} ${branch.onTargetPath ? "is-target" : ""}" type="button" data-composition-recipe="${branch.recipeId}" aria-disabled="${String(!branch.ready)}" style="--branch:${style.color}">
      <i class="composition-result-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></i>
      <span class="composition-branch-copy">
        <strong>${branch.parents.join(" + ")} <em>→</em> <b>${branch.result.char}</b></strong>
        <small>${STAGE_NAMES[branch.result.stage]} · ${escapeHtml(learningInfo(engine.state.region, branch.result.char).short)}</small>
        <span class="composition-materials">${branch.materials.map(compositionMaterialChip).join("")}</span>
      </span>
      <mark>${branch.ready ? "합성 가능" : `${missing.join("·") || "재료"} 부족`}</mark>
    </button>
  `;
}

function renderCompositionDrawer(): void {
  const drawer = must<HTMLElement>("#composition-drawer");
  const selected = engine.selectedTower();
  if (!compositionDrawerOpen || !selected) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    setCompositionMaterialHighlight();
    return;
  }
  const definition = definitionForTower(engine.catalog, selected.definitionId);
  const branches = engine.compositionBranchesForSelected();
  const key = `${selected.id}|${selected.locked}|${branches.map((branch) => `${branch.recipeId}:${branch.ready}:${branch.materials.map((material) => `${material.towerId ?? "-"}:${material.location}`).join(",")}`).join("|")}`;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  if (key === compositionRenderKey) return;
  compositionRenderKey = key;
  must<HTMLElement>("#composition-source-glyph").textContent = selected.char;
  must<HTMLElement>("#composition-ready-count").textContent = String(branches.filter((branch) => branch.ready).length);
  must<HTMLElement>("#composition-source").innerHTML = `
    <i class="composition-source-spirit" style="${spriteStyle(definition)}" aria-hidden="true"></i>
    <span><b>${selected.char}</b><strong>${escapeHtml(learningInfo(engine.state.region, selected.char).short)}</strong><small>${selected.cell < 0 ? "런 인벤토리" : "전장 배치"} · 직접 파생 ${branches.length}개</small></span>
  `;
  must<HTMLElement>("#composition-branches").innerHTML = branches.length > 0
    ? branches.map(compositionBranchCard).join("")
    : `<div class="empty-composition"><b>직접 파생 합성이 없습니다</b><span>이 자령은 현재 조합표의 끝 단계입니다.</span></div>`;
}

function openCompositionDrawer(): void {
  if (!engine.selectedTower()) return;
  compositionDrawerOpen = true;
  compositionRenderKey = "";
  renderCompositionDrawer();
}

function closeCompositionDrawer(): void {
  compositionDrawerOpen = false;
  compositionRenderKey = "";
  setCompositionMaterialHighlight();
  const drawer = document.querySelector<HTMLElement>("#composition-drawer");
  drawer?.classList.remove("is-open");
  drawer?.setAttribute("aria-hidden", "true");
}


/*
 * 1회성 성어 코치 — 스펙 6라운드 E1.
 *
 * 발동 규칙은 지금까지 성어 탭 안 10px 한 줄에만 있었고, 재료가 손에 들어온
 * 순간에는 아무 말도 없었다. 추적 중인 성어의 글자를 둘 이상 갖게 된 최초의
 * 순간에 한 번만 규칙을 말하고, 자세한 건 성어 목표 탭에 있다고 가리킨다.
 */
const IDIOM_HINT_STORAGE_KEY = "hanja-td:idiom-hint-v1";
let idiomHintHandled = false;

function idiomHintAlreadySeen(): boolean {
  try {
    return window.localStorage.getItem(IDIOM_HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markIdiomHintSeen(): void {
  try {
    window.localStorage.setItem(IDIOM_HINT_STORAGE_KEY, "1");
  } catch {
    // 저장이 막혀 있어도 이번 판 안내는 정상 동작한다.
  }
}

/**
 * 성어 탭을 세 번 맥동시켜 "더 볼 곳"을 짚는다.
 *
 * 목표 탭 안의 성어 서브탭은 목표 패널을 열어 둔 사람에게만 보이므로, 항상
 * 보이는 성어 패널 탭도 함께 맥동시킨다. 안내가 아무 데도 안 닿으면 무의미하다.
 */
function pulseIdiomGoalTab(): void {
  const tabs = [idiomTab, document.querySelector<HTMLButtonElement>('[data-goal-mode="idiom"]')];
  for (const tab of tabs) {
    if (!tab) continue;
    tab.classList.remove("is-hint-pulsing");
    void tab.offsetWidth;
    tab.classList.add("is-hint-pulsing");
    window.setTimeout(() => tab.classList.remove("is-hint-pulsing"), 2600);
  }
}

function maybeShowIdiomHint(target: IdiomDefinition | undefined): void {
  if (idiomHintHandled || !target) return;
  if (engine.idiomProgress(target.id).owned < 2) return;
  idiomHintHandled = true;
  if (idiomHintAlreadySeen()) return;
  markIdiomHintSeen();
  showToast(`${target.chars} 재료가 모이고 있어요 — 같은 진에서 ①→④ 순서로 이웃하게 놓으면 봉인 발동! (역순도 가능)`);
  // 두 줄짜리 안내라 평소 자리(bottom 45px)에서는 지도·강조 버튼과 겹친다.
  toast.classList.add("toast--idiom-hint");
  window.setTimeout(() => toast.classList.remove("toast--idiom-hint"), 2000);
  pulseIdiomGoalTab();
}

function renderIdiomHud(): void {
  const target = engine.currentIdiomTarget();
  const ownedSignature = engine.state.towers.map((tower) => tower.char).sort().join("");
  const key = engine.state.idiomSeals.map((seal) => seal.idiomId).join(",") + "|" + (target?.id ?? "done") + "|" + ownedSignature;
  if (key === idiomRenderKey) return;
  idiomRenderKey = key;
  maybeShowIdiomHint(target);
  must<HTMLElement>("#idiom-count").textContent = String(engine.state.idiomSeals.length) + " / " + String(engine.idioms().length);
  must<HTMLElement>("#idiom-tab-count").textContent = String(engine.state.idiomSeals.length) + "/" + String(engine.idioms().length);
  const hud = must<HTMLElement>("#idiom-hud");
  if (!target) {
    hud.classList.add("idiom-hud--complete");
    must<HTMLElement>("#idiom-glyphs").innerHTML = engine.idioms().map((idiom) => `<i class="is-owned" style="--idiom:${idiom.color}">四</i>`).join("");
    must<HTMLElement>("#idiom-name").textContent = "사자성어 전서 완성";
    must<HTMLElement>("#idiom-meaning").textContent = "이번 런의 다섯 성구 보너스가 모두 유지됩니다.";
    must<HTMLElement>("#idiom-bonus").textContent = "사거리·피해·합성 보상·감속 활성";
    must<HTMLElement>("#idiom-hint").textContent = "四句成陣 · 모든 봉인 활성";
    return;
  }
  hud.classList.remove("idiom-hud--complete");
  const counts = new Map<string, number>();
  for (const tower of engine.state.towers) counts.set(tower.char, (counts.get(tower.char) ?? 0) + 1);
  const used = new Map<string, number>();
  const glyphs = [...target.chars].map((char, index) => {
    const occurrence = (used.get(char) ?? 0) + 1;
    used.set(char, occurrence);
    const owned = (counts.get(char) ?? 0) >= occurrence;
    return `<i class="${owned ? "is-owned" : ""}" style="--idiom:${target.color}" title="${index + 1}번째 글자">${char}</i>`;
  }).join("");
  must<HTMLElement>("#idiom-glyphs").innerHTML = glyphs;
  must<HTMLElement>("#idiom-name").textContent = target.reading;
  must<HTMLElement>("#idiom-meaning").textContent = target.meaning;
  must<HTMLElement>("#idiom-bonus").textContent = target.bonus.label;
  must<HTMLElement>("#idiom-bonus").style.setProperty("--idiom", target.color);
  const missingCraft = [...new Set(target.chars)]
    .map((char) => engine.catalog.definitions.get(char))
    .find((definition) => definition?.acquisition === "craft" && (counts.get(definition.char) ?? 0) === 0);
  must<HTMLElement>("#idiom-hint").textContent = missingCraft
    ? "먼저 " + missingCraft.char + " = " + missingCraft.parents.join("+") + " 조합"
    : "1→2→3→4 이웃 배치 → 자동 발동";
}

/**
 * 발동 중 성어 스택 — 스펙 6라운드 D.
 *
 * 봉인한 성어의 효과는 런 내내 남는데, 지금까지 그 사실은 성어 탭을 열어야만
 * 보였다. 전장 좌측에 상시 배지로 세워 두고, 배지를 누르면 그 네 칸으로
 * 카메라를 옮겨 "어디에 있는 무엇인지"까지 이어 준다.
 */
let activeIdiomsRenderKey = "init";

/** `모든 자령 사거리 +12` → `사거리 +12`. 12px 배지 한 줄에 담기게 주어를 턴다. */
function shortIdiomBonusLabel(label: string): string {
  return label.replace(/^모든 자령 /, "").replace(/^모든 적 /, "적 ").replace(/^합성할 때마다 /, "합성 ");
}

function renderActiveIdioms(): void {
  const seals = engine.state.idiomSeals;
  const key = seals.map((seal) => seal.idiomId).join(",");
  if (key === activeIdiomsRenderKey) return;
  activeIdiomsRenderKey = key;
  const stack = must<HTMLElement>("#active-idioms");
  // 성어 목표는 다섯이라 그 이상은 생길 수 없지만, 전장을 덮지 않도록 못을 박는다.
  const visible = seals.slice(0, 5);
  stack.innerHTML = visible
    .map((seal) => {
      const idiom = idiomById(engine.state.region, seal.idiomId);
      if (!idiom) return "";
      const bonus = shortIdiomBonusLabel(idiom.bonus.label);
      return `<button type="button" class="active-idiom" data-active-idiom="${escapeHtml(seal.idiomId)}" style="--idiom:${idiom.color}" title="${escapeHtml(idiom.reading)} · ${escapeHtml(idiom.bonus.label)} — 눌러서 봉인 칸으로 이동" aria-label="${escapeHtml(idiom.reading)} 봉인 · ${escapeHtml(idiom.bonus.label)} · 눌러서 해당 네 칸으로 이동"><b>${escapeHtml(idiom.chars)}</b><span>${escapeHtml(bonus)}</span></button>`;
    })
    .join("");
  stack.classList.toggle("is-empty", visible.length === 0);
}

/** 여러 칸의 무게중심으로 카메라를 옮긴다. 발동 성어 배지가 이걸 쓴다. */
function focusMapOnCells(cells: readonly number[]): void {
  const points = cells.map((cell) => BOARD_CELLS[cell]).filter((point): point is Point => Boolean(point));
  if (points.length === 0) return;
  const center = points.reduce(
    (total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }),
    { x: 0, y: 0 }
  );
  mapOffset = { x: WORLD_WIDTH / 2 - center.x * mapZoom, y: WORLD_HEIGHT / 2 - center.y * mapZoom };
  constrainMapCamera();
  syncMapZoomControl();
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
  const learning = learningInfo(engine.state.region, definition.char);
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

function spriteStyle(definition: HanziDefinition): string {
  const visual = jaryeongVisualFor(definition.char, definition.wuxing, engine.state.region);
  return visualBackgroundStyle(visual);
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
  codexMode = mode;
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
      : "네 글자를 순서대로 이웃 배치하면 해당 사자성어의 봉인 효과가 발동합니다.";
  renderCodex(search.value);
}

function jaryeongDexImageUrl(entry: CheonjamunJaryeongDexEntry): string {
  return `${import.meta.env.BASE_URL}${entry.imagePath}`;
}

const CHEONJAMUN_SUPPLEMENTAL_CHARS = new Set(CHEONJAMUN_SUPPLEMENTAL_CHARACTERS.map((entry) => entry.c));

function dexEntryForDefinition(definition: HanziDefinition): CheonjamunJaryeongDexEntry | undefined {
  return engine.state.region === "KR" ? CHEONJAMUN_JARYEONG_DEX_BY_HANJA.get(definition.char) : undefined;
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
  const accessible = escapeHtml(`${definition.char} ${learningInfo(engine.state.region, definition.char).short} 자령 초상화`);
  // 스프라이트는 안쪽 칸에 그린다 — 바깥 칸의 "우물" 배경이 !important 라
  // 같은 요소에 배경으로 얹으면 통째로 지워졌다(烈 빈 초상의 원인).
  return entry
    ? `<img src="${jaryeongDexImageUrl(entry)}" alt="${accessible}" width="104" height="104" loading="lazy">`
    : `<i class="codex-jaryeong-card-portrait" role="img" aria-label="${accessible}"><b class="codex-sprite-fill" style="${spriteStyle(definition)}"></b></i>`;
}

function codexDetailPortrait(definition: HanziDefinition, entry: CheonjamunJaryeongDexEntry | undefined): string {
  const accessible = escapeHtml(`${definition.char} ${learningInfo(engine.state.region, definition.char).short} 자령 초상화`);
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
  if (codexMode === "idioms") {
    filters.hidden = true;
    return;
  }
  filters.hidden = false;
  filters.setAttribute("aria-label", codexMode === "hanzi" ? "오행과 별·독립 분류" : "합성 별 분류");

  const elementCounts = new Map<Wuxing, number>(WUXING_ORDER.map((wuxing) => [wuxing, 0]));
  for (const definition of definitions) elementCounts.set(definition.wuxing, (elementCounts.get(definition.wuxing) ?? 0) + 1);
  const elementControls = codexMode === "hanzi" ? [
    '<span class="codex-filter-label">오행</span>',
    `<button type="button" data-jaryeong-filter="all" class="${jaryeongDexFilter === "all" ? "is-active" : ""}" aria-pressed="${String(jaryeongDexFilter === "all")}">전체 <small>${definitions.length}</small></button>`,
    ...WUXING_ORDER.map((wuxing) => `<button type="button" data-jaryeong-filter="${wuxing}" class="${jaryeongDexFilter === wuxing ? "is-active" : ""}" aria-pressed="${String(jaryeongDexFilter === wuxing)}" style="--filter-element:${ELEMENT_STYLES[wuxing].color}">${wuxing}<small>${elementCounts.get(wuxing) ?? 0}</small></button>`),
    '<i class="codex-filter-divider" aria-hidden="true"></i>',
    '<span class="codex-filter-label">등급</span>'
  ] : [];

  if (engine.state.mode === "casual" && codexMode !== "recipes") {
    const counts = new Map<CasualStar, number>();
    for (const definition of definitions) {
      const star = casualNaturalStar(definition.char) ?? 1;
      counts.set(star, (counts.get(star) ?? 0) + 1);
    }
    if (codexSynthesisDepth !== "all" && (typeof codexSynthesisDepth !== "number" || !counts.has(codexSynthesisDepth as CasualStar))) codexSynthesisDepth = "all";
    filters.innerHTML = [...elementControls,
      `<button type="button" data-synthesis-depth="all" class="${codexSynthesisDepth === "all" ? "is-active" : ""}" aria-pressed="${String(codexSynthesisDepth === "all")}">모든 별 <small>${definitions.length}</small></button>`,
      ...([...counts.entries()].sort(([left], [right]) => left - right).map(([star, count]) => `<button type="button" data-synthesis-depth="${star}" class="${codexSynthesisDepth === star ? "is-active" : ""}" aria-pressed="${String(codexSynthesisDepth === star)}" style="--codex-star:${CASUAL_STAR_COLORS[star]}">${star}★ <small>${count}</small></button>`))
    ].join("");
    return;
  }

  const counts = new Map<number, number>();
  for (const definition of definitions) {
    const depth = depths.get(definition.char) ?? 1;
    counts.set(depth, (counts.get(depth) ?? 0) + 1);
  }
  const independentCount = definitions.filter((definition) => uncombinableStageOne.has(definition.char)).length;
  const validSelection = codexSynthesisDepth === "all"
    || codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE && independentCount > 0
    || typeof codexSynthesisDepth === "number" && counts.has(codexSynthesisDepth);
  if (!validSelection) codexSynthesisDepth = "all";
  const options = [...counts.entries()].sort(([left], [right]) => left - right);
  filters.innerHTML = [...elementControls,
    `<button type="button" data-synthesis-depth="all" class="${codexSynthesisDepth === "all" ? "is-active" : ""}" aria-pressed="${String(codexSynthesisDepth === "all")}">모든 별 <small>${definitions.length}</small></button>`,
    ...options.map(([depth, count]) => `<button type="button" data-synthesis-depth="${depth}" class="${codexSynthesisDepth === depth ? "is-active" : ""}" aria-pressed="${String(codexSynthesisDepth === depth)}">${synthesisTierBadge(depth)} <small>${count}</small></button>`),
    ...(independentCount > 0 ? [`<button type="button" data-synthesis-depth="${UNCOMBINABLE_STAGE_ONE}" class="${codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE ? "is-active" : ""}" aria-pressed="${String(codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE)}">${independentBadge(true)} <small>${independentCount}</small></button>`] : [])
  ].join("");
}

function renderCodex(query = ""): void {
  const normalized = query.trim();
  const list = must<HTMLElement>("#codex-list");
  must<HTMLElement>("#codex-region").textContent = engine.state.region === "KR" ? "한국" : REGION_META[engine.state.region].title;

  if (codexMode === "idioms") {
    renderCodexSynthesisFilters([], new Map(), new Set());
    const activeIds = new Set(engine.idioms().map((idiom) => idiom.id));
    const idioms = engine.allIdioms().filter((idiom) => !normalized || [idiom.chars, idiom.reading, idiom.meaning, idiom.bonus.label].join(" ").includes(normalized));
    must<HTMLElement>("#codex-summary").textContent = `성어 ${idioms.length}/${engine.allIdioms().length} · 이번 런 목표 ${engine.idioms().length}개`;
    list.className = "codex-list codex-list--idioms";
    list.innerHTML = idioms.map((idiom) => {
      const sealed = engine.state.idiomSeals.some((seal) => seal.idiomId === idiom.id);
      const active = activeIds.has(idiom.id);
      const selected = idiom.id === selectedCodexIdiomId;
      return `<button type="button" data-codex-idiom="${idiom.id}" class="codex-idiom-card ${sealed ? "is-discovered" : ""} ${active ? "is-featured" : ""} ${selected ? "is-selected" : ""}" style="--codex:${idiom.color}" aria-current="${String(selected)}"><b>${idiom.chars}</b><span>${idiom.reading}</span><small>${active ? "이번 런 · " : ""}${idiom.bonus.label}</small></button>`;
    }).join("") || '<p class="codex-empty">검색 결과가 없습니다.</p>';
    // 상세에 뜬 성어와 목록의 선택 표시를 항상 같은 것으로 맞춘다.
    const shown = idioms.find((idiom) => idiom.id === selectedCodexIdiomId) ?? idioms[0];
    if (shown && shown.id !== selectedCodexIdiomId) {
      selectedCodexIdiomId = shown.id;
      const card = list.querySelector<HTMLButtonElement>(`[data-codex-idiom="${shown.id}"]`);
      card?.classList.add("is-selected");
      card?.setAttribute("aria-current", "true");
    }
    renderIdiomCodexDetail(shown);
    return;
  }

  const synthesisDepths = buildSynthesisDepths(engine.catalog.definitions.values());
  const uncombinableStageOne = buildUncombinableStageOneChars(engine.catalog.definitions.values());
  let definitions = codexMode === "recipes" ? [...engine.catalog.recipes] : [...engine.catalog.definitions.values()];
  renderCodexSynthesisFilters(definitions, synthesisDepths, uncombinableStageOne);
  if (codexMode === "hanzi" && jaryeongDexFilter !== "all") definitions = definitions.filter((definition) => definition.wuxing === jaryeongDexFilter);
  if (codexSynthesisDepth !== "all") definitions = definitions.filter((definition) => engine.state.mode === "casual" && codexMode !== "recipes"
    ? casualNaturalStar(definition.char) === codexSynthesisDepth
    : codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE
      ? uncombinableStageOne.has(definition.char)
      : (synthesisDepths.get(definition.char) ?? 1) === codexSynthesisDepth
  );
  definitions = definitions.filter((definition) => definitionMatches(definition, normalized));
  definitions.sort((left, right) => {
    if (codexMode === "hanzi" && engine.state.region === "KR") {
      const leftNumber = CHEONJAMUN_JARYEONG_DEX_BY_HANJA.get(left.char)?.number ?? Number.MAX_SAFE_INTEGER;
      const rightNumber = CHEONJAMUN_JARYEONG_DEX_BY_HANJA.get(right.char)?.number ?? Number.MAX_SAFE_INTEGER;
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    }
    return engine.state.mode === "casual" && codexMode !== "recipes"
      ? (casualNaturalStar(left.char) ?? 1) - (casualNaturalStar(right.char) ?? 1) || (casualStrokeCount(left.char) ?? 0) - (casualStrokeCount(right.char) ?? 0) || left.char.localeCompare(right.char, "ko")
      : (synthesisDepths.get(left.char) ?? 0) - (synthesisDepths.get(right.char) ?? 0) || left.stage - right.stage || left.char.localeCompare(right.char, "ko");
  });
  const selectedDefinition = definitions.find((definition) => definition.char === normalized)
    ?? definitions.find((definition) => definition.char === selectedCodexChar)
    ?? definitions[0]
    ?? engine.catalog.definitions.get(engine.state.targetChar);
  selectedCodexChar = selectedDefinition?.char ?? "";
  list.className = codexMode === "recipes" ? "codex-list codex-list--recipes" : "codex-list codex-list--jaryeong";

  if (codexMode === "recipes") {
    const depthSummary = codexSynthesisDepth === "all"
      ? "전체 단계"
      : codexSynthesisDepth === UNCOMBINABLE_STAGE_ONE
        ? "독립 자령"
        : synthesisTierFilterLabel(codexSynthesisDepth);
    must<HTMLElement>("#codex-summary").textContent = `조합 ${definitions.length.toLocaleString("ko-KR")}/${engine.catalog.recipes.length.toLocaleString("ko-KR")}식 · 재료 → 결과 순서 · ${depthSummary}`;
    list.innerHTML = definitions.map((definition) => {
      const depth = synthesisDepths.get(definition.char) ?? 1;
      const selected = definition.char === selectedCodexChar;
      return `<button type="button" data-codex-recipe="${definition.char}" class="codex-recipe-card ${selected ? "is-selected" : ""}" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}" aria-current="${String(selected)}"><span class="codex-recipe-formula">${definition.parents.map((parent) => `<i>${parent}</i>`).join("<em>+</em>")}<em>→</em><b>${definition.char}</b></span><span>${escapeHtml(learningInfo(engine.state.region, definition.char).short)}</span><small>${synthesisTierBadge(depth)} · ${STAGE_NAMES[definition.stage]} · ${hasActiveSkills(definition) ? definition.combat.abilities.role.name : "기본 공격"}</small></button>`;
    }).join("");
  } else {
    const independentShown = definitions.filter((definition) => uncombinableStageOne.has(definition.char)).length;
    const discoveredThisRun = new Set(engine.state.discoveredChars);
    must<HTMLElement>("#codex-summary").textContent = `자령 ${definitions.length.toLocaleString("ko-KR")}/${engine.catalog.definitions.size.toLocaleString("ko-KR")} · 독립 ${independentShown.toLocaleString("ko-KR")} · 이번 런 발견 ${discoveredThisRun.size.toLocaleString("ko-KR")}`;
    list.innerHTML = definitions.map((definition) => {
      const learning = learningInfo(engine.state.region, definition.char);
      const entry = dexEntryForDefinition(definition);
      const depth = synthesisDepths.get(definition.char) ?? 1;
      const independent = uncombinableStageOne.has(definition.char);
      const naturalStar = casualNaturalStar(definition.char) ?? 1;
      const selected = definition.char === selectedCodexChar;
      const explanation = koreanMeaningExplanation(definition.char, learning.short, learning.meaning);
      const numberLabel = codexNumberLabel(definition, entry);
      const found = discoveredThisRun.has(definition.char);
      const progression = engine.state.mode === "casual" ? `<span class="codex-tier-stars">${"★".repeat(naturalStar)}</span>` : synthesisTierBadge(depth);
      return `<button type="button" data-codex-char="${definition.char}" class="codex-jaryeong-card ${selected ? "is-selected" : ""} ${found ? "is-found" : ""}" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}" aria-current="${String(selected)}" aria-label="${escapeHtml(`${numberLabel} ${definition.char} ${learning.short} ${definition.wuxing}행${found ? " · 이번 런 발견" : ""}`)}">
        <span class="codex-jaryeong-number">${numberLabel}</span>
        ${found ? '<mark class="codex-found-mark">이번 런 발견</mark>' : ""}
        ${codexCardPortrait(definition, entry)}
        <span class="codex-jaryeong-copy">
          <span class="codex-jaryeong-identity"><b>${definition.char}</b><strong>${escapeHtml(learning.short)}</strong><i>${definition.wuxing}</i></span>
          <span class="codex-jaryeong-badges">${progression}${engine.state.mode === "standard" ? independentBadge(independent) : ""}<em>${escapeHtml(definition.combat.roleLabel)}</em></span>
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
    const definition = engine.catalog.definitions.get(current);
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

  const learning = learningInfo(engine.state.region, definition.char);
  const explanation = koreanMeaningExplanation(definition.char, learning.short, learning.meaning);
  const entry = dexEntryForDefinition(definition);
  const abilities = definition.combat.abilities;
  const naturalStar = casualNaturalStar(definition.char) ?? 1;
  const activeSkills = engine.state.mode === "casual" ? naturalStar >= 2 : hasActiveSkills(definition);
  const abilityList = activeSkills
    ? [abilities.semantic, abilities.role, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability))
    : [];
  const passiveList = activeSkills ? [abilities.element, abilities.graph] : [abilities.graph];
  const children = engine.catalog.recipes
    .filter((candidate) => candidate.parents.includes(definition.char))
    .sort((left, right) => left.stage - right.stage)
    .slice(0, 12);
  const recipeSteps = recipeStepsFor(definition.char);
  const synthesisDepths = buildSynthesisDepths(engine.catalog.definitions.values());
  const uncombinableStageOne = buildUncombinableStageOneChars(engine.catalog.definitions.values());
  const synthesisDepth = synthesisDepths.get(definition.char) ?? 1;
  const independent = uncombinableStageOne.has(definition.char);
  const synthesisTier = synthesisTierKey(definition, synthesisDepth, uncombinableStageOne);
  const codexPower = engine.state.mode === "casual" ? CASUAL_STAR_POWER[naturalStar] : STAGE_MULTIPLIERS[definition.stage];
  const progression = engine.state.mode === "casual"
    ? `<span class="codex-tier-stars" aria-label="${naturalStar}별">${"★".repeat(naturalStar)}</span>`
    : synthesisTierBadge(synthesisTier);
  const numberLabel = codexNumberLabel(definition, entry);
  const acquisitionLabel = engine.state.mode === "casual"
    ? "전 자령 직접 소환 · 같은 오행/별 3체 조합"
    : directAcquisitionLabel(definition, independent);
  const categoryLabel = entry?.category ?? `${ELEMENT_STYLES[definition.wuxing].name}행 자령`;
  const dexText = entry?.dexText
    ?? `${definition.char}의 뜻과 ${definition.wuxing}행 기운을 전투 역할로 풀어낸 자령입니다. 쉬운 훈 풀이와 조합 경로를 함께 확인하세요.`;
  const progressionDetail = engine.state.mode === "casual"
    ? `${naturalStar}★ · ${casualStrokeCount(definition.char) ?? "?"}획 · ${casualStarRangeLabel(naturalStar)}`
    : `${synthesisDepth}단 · ${STAGE_NAMES[definition.stage]}`;
  const recipeMain = engine.state.mode === "casual"
    ? `<div class="recipe-guide-main"><span><b>${definition.wuxing}</b><small>${naturalStar}★ 소모</small></span><em>+</em><span><b>${definition.wuxing}</b><small>${naturalStar}★ 소모</small></span><em>+</em><span><b>${definition.wuxing}</b><small>${naturalStar}★ 소모</small></span><em>→</em><span class="is-result"><b>${Math.min(8, naturalStar + 1)}★</b><small>무작위 1기</small></span></div><p><b>안전 규칙</b> 3기가 모두 사라지고 같은 오행의 다음 별 글자 하나를 무작위로 얻습니다. 잠금·농축·목표·사자성어 자령은 소모 대상에서 빠지고, 소모할 3기를 카드에 미리 보여 준 뒤 실행합니다.</p>`
    : `<div class="recipe-guide-main">${definition.acquisition === "direct"
      ? `<span class="${independent ? "is-independent" : ""}"><b>${definition.char}</b><small>${independent ? "직접 소환 · 독립" : "직접 소환 · 상위 재료"}</small></span>`
      : `${definition.parents.map((parent) => `<span><b>${parent}</b><small>${escapeHtml(learningInfo(engine.state.region, parent).short)}</small></span>`).join("<em>+</em>")}<em>→</em><span class="is-result"><b>${definition.char}</b><small>${escapeHtml(learning.short)}</small></span>`}</div>
      ${recipeSteps.length ? `<ol>${recipeSteps.map((step, index) => `<li><b>${index + 1}</b><span>${step.parents.join(" + ")} → <strong>${step.char}</strong></span></li>`).join("")}</ol>` : ""}
      <p><b>이 글자로 이어지는 조합</b> ${children.length ? children.map((child) => `<button type="button" data-codex-char="${child.char}">${definition.char} → ${child.char} · ${escapeHtml(learningInfo(engine.state.region, child.char).short)}</button>`).join("") : independent ? "독립 자령이라 상위 조합에 쓰이지 않습니다." : "현재 직접 하위 조합이 없습니다."}</p>`;

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
            ${engine.state.mode === "standard" ? independentBadge(independent) : ""}
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
        ${activeSkills ? "" : `<article class="is-locked" style="--ability:#aeb9cc"><b>合</b><span><strong>${engine.state.mode === "casual" ? "1★ 기본 공격" : independent ? "독립 자령 기본 공격" : "1단 기본 공격"}</strong><small>${independent ? "상위 조합 없음" : "조합으로 기술 해금"}</small><em>${independent ? "별 등급과 독립 여부는 별개의 정보입니다. 이 자령은 1별이면서 상위 조합 재료로 쓰이지 않습니다." : engine.state.mode === "casual" ? "같은 오행·같은 별 자령 두 기를 재료로 써 2★가 되면 의미 기술과 역할 기술이 해금됩니다." : "상위 단계로 합성하면 의미 기술과 역할 기술이 해금됩니다."}</em></span></article>`}
        ${abilityList.map((ability) => `<article style="--ability:${ability.color}"><b>${ability.glyph}</b><span><strong>${escapeHtml(ability.name)}</strong><small>${escapeHtml(`${ability.trigger} · ${ability.summary}`)}</small><em>${escapeHtml(ability.description)}</em></span></article>`).join("")}
        ${passiveList.map((ability) => `<article class="is-passive" style="--ability:${ability.color}"><b>${ability.glyph}</b><span><strong>${escapeHtml(ability.name)}</strong><small>상시 특성 · ${escapeHtml(ability.summary)}</small><em>${escapeHtml(ability.description)}</em></span></article>`).join("")}
      </div>

      <section class="recipe-guide">
        <h4>${engine.state.mode === "casual" ? "캐주얼 3체 조합" : "조합표 · 별과 독립은 별개"}</h4>
        ${recipeMain}
      </section>
      ${shell.dataset.devMode === "1" ? `<p class="combo-key">능력 조합 코드 · ${escapeHtml(abilities.comboKey)}</p>` : ""}
      ${engine.state.mode === "casual" || definition.acquisition === "craft" ? `<button id="set-target-button" type="button" data-target-char="${definition.char}">이 한자를 목표로 지정</button>` : ""}
    </div>
  `;
}
function renderRunInventory(): void {
  const selectedId = engine.state.selectedTowerId;
  const active = engine.state.phase === "prep" || engine.state.phase === "combat";
  const key = engine.state.inventoryTowers.map((tower) => `${tower.id}:${tower.locked}:S${tower.casualStar ?? 0}:C${tower.concentration ?? 0}:${tower.concentrationPath ?? "-"}`).join("|") + `|${selectedId ?? "none"}|${active ? "active" : "inactive"}|${engine.state.mode}`;
  must<HTMLElement>("#run-inventory-count").textContent = String(engine.state.inventoryTowers.length);
  if (key === runInventoryRenderKey) return;
  runInventoryRenderKey = key;
  const list = must<HTMLElement>("#run-inventory-list");
  const grouped = new Map<string, Tower[]>();
  for (const tower of engine.state.inventoryTowers) {
    const groupKey = engine.state.mode === "casual" ? `${tower.char}:${casualStarOf(tower)}` : tower.char;
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), tower]);
  }
  must<HTMLElement>("#run-inventory-heading-count").textContent = `${engine.state.inventoryTowers.length}개 · ${grouped.size}종`;
  const cleanupAssessments = new Map(engine.cleanupAssessments().map((assessment) => [assessment.towerId, assessment]));
  const cleanupCandidates = engine.cleanupCandidates(8, true);
  must<HTMLButtonElement>("#cleanup-recommended-button").disabled = !active || cleanupCandidates.length === 0;
  must<HTMLButtonElement>("#cleanup-recommended-button").textContent = cleanupCandidates.length > 0 ? `정리 후보 ${cleanupCandidates.length}기 분해` : "보호 완료";
  if (engine.state.inventoryTowers.length === 0) {
    list.innerHTML = '<div class="empty-run-inventory"><b>대기 중인 자령이 없습니다</b><span>설정에서 자동 배치를 끄거나 전장 자령을 보관하세요.</span></div>';
    return;
  }
  const selectedTower = engine.state.inventoryTowers.find((tower) => tower.id === selectedId);
  list.innerHTML = [...grouped.values()].sort((left, right) => {
    const leftCandidate = left.some((tower) => cleanupAssessments.get(tower.id)?.protected === false) ? 0 : 1;
    const rightCandidate = right.some((tower) => cleanupAssessments.get(tower.id)?.protected === false) ? 0 : 1;
    return leftCandidate - rightCandidate || right.length - left.length || left[0]!.char.localeCompare(right[0]!.char);
  }).map((stack) => {
    const tower = selectedTower && stack.some((candidate) => candidate.id === selectedTower.id) ? selectedTower : stack.find((candidate) => !candidate.locked) ?? stack[0]!;
    const visual = jaryeongVisualFor(tower.char, tower.wuxing, engine.state.region);
    const learning = learningInfo(engine.state.region, tower.char);
    const selected = tower.id === selectedId;
    const candidates = stack.filter((candidate) => cleanupAssessments.get(candidate.id)?.protected === false).length;
    const concentration = Math.max(...stack.map((candidate) => candidate.concentration ?? 0));
    const star = casualStarOf(tower);
    const progression = engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]}` : STAGE_NAMES[tower.stage];
    const skill = engine.towerHasActiveSkills(tower) ? definitionForTower(engine.catalog, tower.definitionId).combat.abilities.semantic.name : engine.state.mode === "casual" ? "기본 공격·2★ 해금" : "기본 공격·합성 재료";
    return `<button class="run-inventory-card ${selected ? "is-selected" : ""} ${candidates > 0 ? "is-cleanup-candidate" : "is-protected-stack"}" type="button" data-run-inventory-id="${tower.id}" style="--inventory-element:${ELEMENT_STYLES[tower.wuxing].color};--inventory-star:${engine.state.mode === "casual" ? CASUAL_STAR_COLORS[star] : STAGE_COLORS[tower.stage]}">
      <span class="run-inventory-spirit" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></span>
      <b>${tower.char}</b>
      <span><strong>${escapeHtml(learning.short)} <i>×${stack.length}</i></strong><small>${progression} · ${skill}${concentration > 0 ? ` · 濃 ${concentration}` : ""}</small></span>
      <em>${selected ? "찬 칸 교체" : candidates > 0 ? `정리 ${candidates}` : "보호"}</em>
    </button>`;
  }).join("");
}

function renderIdiomCodexDetail(idiom: ReturnType<GameEngine["idioms"]>[number] | undefined): void {
  const detail = must<HTMLElement>("#codex-detail");
  if (!idiom) {
    detail.innerHTML = "<p>사자성어를 선택하세요.</p>";
    return;
  }
  const sealed = engine.state.idiomSeals.some((seal) => seal.idiomId === idiom.id);
  const featured = engine.idioms().some((candidate) => candidate.id === idiom.id);
  const sourceLabel = idiom.source === "cheonjamun" ? `천자문 제${idiom.sourceOrder}구` : "상용 사자성어";
  detail.innerHTML = `
    <div class="idiom-codex-glyphs" style="--codex:${idiom.color}">${[...idiom.chars].map((char, index) => `<span><b>${char}</b><small>${index + 1}</small></span>`).join("")}</div>
    <p class="eyebrow">${sourceLabel} · ${sealed ? "이번 런 발동 완료" : featured ? "이번 런 목표" : "도감 수록"}</p>
    <h3>${idiom.reading}</h3>
    <article class="idiom-strategy" style="--codex:${idiom.color}"><b>${idiom.bonus.label}</b><span>${idiom.meaning}</span><small>${featured ? "네 글자를 1→2→3→4 순서로 이웃한 칸에 배치하면 자동 발동하며, 효과는 해당 런 동안 유지됩니다." : "이번 런 목표에는 포함되지 않았습니다. 다음 시드에서 목표 성구로 등장할 수 있습니다."}</small></article>
    <section class="idiom-material-guide"><h4>필요 한자와 획득법</h4>${[...idiom.chars].map((char) => {
      const definition = engine.catalog.definitions.get(char);
      const learning = learningInfo(engine.state.region, char);
      if (!definition) return "";
      return `<button type="button" data-codex-char="${char}" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}"><b>${char}</b><span>${escapeHtml(learning.short)}</span><small>${definition.acquisition === "direct" ? "직접 소환" : definition.parents.join(" + ") + " → " + char}</small></button>`;
    }).join("")}</section>
  `;
}

function drawWorld(delta: number): void {
  const state = engine.state;
  const selectedTower = engine.selectedTower();
  canvas.dataset.selectedTowerId = selectedTower ? String(selectedTower.id) : "";
  // compact 명패가 훈음을 줄여 적어도 전체값은 접근성 이름과 상세 팝오버에 남는다.
  const selectedReading = selectedTower ? learningInfo(state.region, selectedTower.char).short : "";
  if (canvas.dataset.selectedTowerReading !== selectedReading) {
    canvas.dataset.selectedTowerReading = selectedReading;
    canvas.setAttribute(
      "aria-label",
      selectedTower ? `전장 · 선택 자령 ${selectedTower.char} ${selectedReading}` : "전장 · 선택한 자령 없음"
    );
  }
  canvas.dataset.selectedSynthesisTier = selectedTower ? String(engine.state.mode === "casual" ? casualStarOf(selectedTower) : mapSynthesisDepths.get(selectedTower.char) ?? 1) : "";
  const materialIds = hoveredMaterialIds();
  // 개발 진단: 적·제단 래스터 로드 상태. 프로덕션 화면에는 노출하지 않는다.
  const enemySheets = enemySheetStateSummary();
  if (canvas.dataset.enemySheets !== enemySheets) canvas.dataset.enemySheets = enemySheets;
  const formationPlates = formationPlateStateSummary();
  if (canvas.dataset.formationPlates !== formationPlates) canvas.dataset.formationPlates = formationPlates;
  drawPaperBackdrop();
  context.save();
  context.translate(mapOffset.x, mapOffset.y);
  context.scale(mapZoom, mapZoom);
  drawTrack();
  drawBoard();
  refreshIdiomPlacementGuide();
  drawIdiomPlacementCells();
  drawAbilityZones();
  drawCompositionMaterialLinks();
  drawIdiomSeals();
  drawSelection();
  for (const enemy of state.enemies) {
    const point = positionOnPath(enemy.progress);
    if (isWorldPointVisible(point, enemy.boss ? 90 : 55)) drawEnemy(enemy, point);
  }
  for (const tower of [...state.towers].sort((a, b) => a.cell - b.cell)) {
    if (isWorldPointVisible(BOARD_CELLS[tower.cell] as Point, 65)) drawTower(tower, materialIds);
  }
  // 명패는 자령 본체를 모두 그린 뒤에 흘려야 이웃 자령이 훈음을 덮지 않는다.
  flushTowerPlaques();
  // Keep combat sprites in the foreground so their raster silhouettes are not
  // hidden by the enemy/tower bodies. Their alpha and size remain restrained
  // so the learning labels stay readable.
  updateAndDrawFx(delta);
  context.restore();
  drawIdiomFlash();
  drawHoveredTowerCard();
}

function isWorldPointVisible(point: Point, margin = 0): boolean {
  const x = mapOffset.x + point.x * mapZoom;
  const y = mapOffset.y + point.y * mapZoom;
  const screenMargin = margin * mapZoom;
  return x >= -screenMargin && x <= WORLD_WIDTH + screenMargin && y >= -screenMargin && y <= WORLD_HEIGHT + screenMargin;
}

/** 장판 생성 시각 기록 — 스케일-인 연출과 생성 고리에 쓴다. */
const zoneSpawnTimes = new Map<number, number>();

function drawAbilityZones(): void {
  let spriteDrawnThisFrame = false;
  let verticalZoneCount = 0;
  let cornerZoneCount = 0;
  const liveZoneIds = new Set<number>();
  for (const zone of engine.state.abilityZones) {
    liveZoneIds.add(zone.id);
    const point = positionOnPath(zone.progress);
    if (!isWorldPointVisible(point, zone.radius)) continue;
    const remaining = Math.max(0, zone.expiresAt - engine.state.elapsed);
    const life = Math.min(1, remaining / 1.2);
    const image = elementZoneImage(zone.wuxing);
    const pulse = reducedMotion ? 1 : 1 + Math.sin(engine.state.elapsed * 1.45 + zone.id) * 0.018;
    const layout = abilityZoneSpriteLayout(zone.progress, zone.radius, pulse);

    // 생성 순간: 먹 고리 + 0.35초 스케일-인. "기술이 나갔다"를 읽게 한다.
    let spawnScale = 1;
    let spawnedAt = zoneSpawnTimes.get(zone.id);
    if (spawnedAt === undefined) {
      spawnedAt = engine.state.elapsed;
      zoneSpawnTimes.set(zone.id, spawnedAt);
      pushPooled(rings, ringPool, takeRing(point, zone.color, 0.5), 32);
    }
    if (!reducedMotion) {
      const settle = Math.min(1, (engine.state.elapsed - spawnedAt) / 0.35);
      spawnScale = 0.55 + 0.45 * (1 - (1 - settle) * (1 - settle));
    }
    const verticalWeight = Math.abs(Math.sin(layout.angle));
    if (verticalWeight >= 0.92) verticalZoneCount += 1;
    else if (verticalWeight >= 0.22) cornerZoneCount += 1;
    // aoe-modular-fx-pack-v1: 모듈은 항상 정사각 D×D. 회전은 결정적 ±8°만.
    // pathTriple 은 경로 앞·중앙·뒤 3모듈(각 D=1.2R, 중심 간 0.82D)로 확장한다.
    const pattern = (zone as { areaPattern?: string }).areaPattern === "pathTriple" ? "pathTriple" : "single";
    const centers: Array<{ progress: number; diameter: number; moduleIndex: number }> = [];
    if (pattern === "pathTriple") {
      const moduleDiameter = zone.radius * 1.2 * pulse;
      const progressStep = (moduleDiameter * 0.82) / TOTAL_ENEMY_PATH_LENGTH;
      centers.push(
        { progress: zone.progress - progressStep, diameter: moduleDiameter, moduleIndex: 0 },
        { progress: zone.progress, diameter: moduleDiameter, moduleIndex: 1 },
        { progress: zone.progress + progressStep, diameter: moduleDiameter, moduleIndex: 2 }
      );
    } else {
      // 판정 반경 R 은 아래 붓선 테두리가 담당하므로 그림은 1.6R 로 줄인다.
      centers.push({ progress: zone.progress, diameter: layout.width * 0.8 * spawnScale, moduleIndex: 0 });
    }
    for (const moduleCenter of centers) {
      const at = positionOnPath(moduleCenter.progress);
      context.save();
      context.globalAlpha = 0.58 * life;
      context.translate(at.x, at.y);
      context.rotate(deterministicZoneRotation(zone.id + moduleCenter.moduleIndex));
      if (image.complete && image.naturalWidth > 0) {
        context.drawImage(image, -moduleCenter.diameter / 2, -moduleCenter.diameter / 2, moduleCenter.diameter, moduleCenter.diameter);
        abilityZoneSpriteDrawTotal += 1;
        spriteDrawnThisFrame = true;
      } else {
        context.fillStyle = zone.color;
        context.beginPath();
        context.arc(0, 0, moduleCenter.diameter / 2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
    // 실제 판정 반경 R: 마른 붓 점선. 그림이 작아져도 범위는 정확히 읽힌다.
    context.save();
    context.globalAlpha = 0.4 * life;
    context.strokeStyle = zone.color;
    context.lineWidth = 1.6;
    context.setLineDash([7, 9]);
    context.lineDashOffset = reducedMotion ? 0 : -engine.state.elapsed * 14;
    context.beginPath();
    context.arc(point.x, point.y, zone.radius * spawnScale, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.restore();

    // 판정 안에서 피해를 받는 적 위로 오행색 불티가 튄다.
    if (!reducedMotion) {
      for (const enemy of engine.state.enemies) {
        const enemyPoint = positionOnPath(enemy.progress);
        const dx = enemyPoint.x - point.x;
        const dy = enemyPoint.y - point.y;
        if (dx * dx + dy * dy > zone.radius * zone.radius) continue;
        for (let sparkIndex = 0; sparkIndex < 3; sparkIndex += 1) {
          const phase = ((engine.state.elapsed * 1.7 + enemy.id * 0.41 + sparkIndex * 0.33) % 1 + 1) % 1;
          const sparkX = enemyPoint.x + Math.sin((enemy.id + sparkIndex) * 2.4) * 9;
          const sparkY = enemyPoint.y - 4 - phase * 22;
          context.globalAlpha = (1 - phase) * 0.85 * life;
          context.fillStyle = zone.color;
          context.beginPath();
          context.arc(sparkX, sparkY, 1.7 + (1 - phase) * 1.1, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    }

    context.save();
    context.globalAlpha = 0.88 * life;
    context.fillStyle = zone.kind === "rain" ? "#d9f2ff" : zone.color;
    context.font = '900 10px "Malgun Gothic", sans-serif';
    context.textAlign = "center";
    context.fillText(`${zone.wuxing} ${remaining.toFixed(1)}초`, point.x, point.y + zone.radius + 13);
    context.restore();
  }
  for (const id of zoneSpawnTimes.keys()) {
    if (!liveZoneIds.has(id)) zoneSpawnTimes.delete(id);
  }
  canvas.dataset.abilityZoneCount = String(engine.state.abilityZones.length);
  canvas.dataset.abilityZoneSpriteDraw = String(spriteDrawnThisFrame);
  canvas.dataset.abilityZoneSpriteDrawTotal = String(abilityZoneSpriteDrawTotal);
  canvas.dataset.abilityZoneVerticalCount = String(verticalZoneCount);
  canvas.dataset.abilityZoneCornerCount = String(cornerZoneCount);
}

function drawPaperBackdrop(): void {
  canvas.dataset.mapSurface = "hanji-ink";
  // Keep the paper on the CSS compositor instead of repainting and resampling it every frame.
  // The canvas is cleared to transparency, so only the moving game layers are redrawn.
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

/**
 * 먹물 길.
 *
 * 경로 좌표(`ENEMY_PATH_POINTS` 17점·16구간·전부 200px 축정렬)와 적 이동·충돌
 * 판정은 그대로 두고 표현만 교체한다. 회색 포장체·양쪽 연석·반복 점선·고속도로형
 * 화살표를 없애고, Codex 한지 팩의 붓길 타일을 구간과 꼭짓점에 stamp한다.
 */
/** FX_SPEC 3.3 — 경로 총길이는 상수 복사 대신 선분 합산으로 얻는다. */
const TOTAL_ENEMY_PATH_LENGTH = ENEMY_PATH_POINTS.slice(0, -1).reduce((sum, point, index) => {
  const next = ENEMY_PATH_POINTS[index + 1] as Point;
  return sum + Math.hypot(next.x - point.x, next.y - point.y);
}, 0);

const INK_TILE = 96;
const INK_STRAIGHT_LEN = 110;

/** 꼭짓점에서 열린 두 방향. 네 공유 꼭짓점(내부 사각과 외곽이 만나는 곳)은 교차 타일. */
const INK_VERTEX_KIND: ReadonlyArray<{ at: Point; corner: InkCorner | null }> = [
  { at: { x: 340, y: 60 }, corner: "rd" },
  { at: { x: 540, y: 60 }, corner: "dl" },
  { at: { x: 740, y: 260 }, corner: "dl" },
  { at: { x: 740, y: 460 }, corner: "lu" },
  { at: { x: 540, y: 660 }, corner: "lu" },
  { at: { x: 340, y: 660 }, corner: "ur" },
  { at: { x: 140, y: 460 }, corner: "ur" },
  { at: { x: 140, y: 260 }, corner: "rd" },
  { at: { x: 340, y: 260 }, corner: null },
  { at: { x: 540, y: 260 }, corner: null },
  { at: { x: 540, y: 460 }, corner: null },
  { at: { x: 340, y: 460 }, corner: null }
];

/** 같은 타일이 반복돼 인쇄물처럼 보이지 않도록 구간마다 미세한 알파 편차를 준다. */
function inkTileAlpha(seed: number): number {
  return 0.92 + ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.08;
}

function drawTrack(): void {
  context.save();

  // 1. 먹이 종이에 밴 자국을 먼저 깔아 붓길의 바닥을 만든다.
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  traceEnemyPath();
  context.strokeStyle = "rgba(38, 30, 20, 0.13)";
  context.lineWidth = 74;
  context.stroke();
  context.strokeStyle = "rgba(28, 22, 15, 0.16)";
  context.lineWidth = 58;
  context.stroke();
  context.restore();

  // 2. 구간별 직선 타일.
  for (let index = 0; index < ENEMY_PATH_POINTS.length - 1; index += 1) {
    const from = ENEMY_PATH_POINTS[index] as Point;
    const to = ENEMY_PATH_POINTS[index + 1] as Point;
    const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
    const image = inkStraightImage(horizontal ? "h" : "v");
    if (!image.complete || image.naturalWidth === 0) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.round(length / INK_STRAIGHT_LEN));
    for (let step = 0; step < steps; step += 1) {
      const t = (step + 0.5) / steps;
      const cx = from.x + (to.x - from.x) * t;
      const cy = from.y + (to.y - from.y) * t;
      // 타일 끝을 살짝 겹쳐 이음매가 끊겨 보이지 않게 한다.
      const span = length / steps + 18;
      context.globalAlpha = inkTileAlpha(index * 7 + step);
      if (horizontal) context.drawImage(image, cx - span / 2, cy - INK_TILE / 2, span, INK_TILE);
      else context.drawImage(image, cx - INK_TILE / 2, cy - span / 2, INK_TILE, span);
    }
  }

  // 3. 꼭짓점 타일. 모서리는 먹이 고이고 교차점은 네 방향이 만난다.
  for (const vertex of INK_VERTEX_KIND) {
    const image = vertex.corner === null ? inkCrossImage() : inkCornerImage(vertex.corner);
    if (!image.complete || image.naturalWidth === 0) continue;
    context.globalAlpha = 1;
    context.drawImage(image, vertex.at.x - INK_TILE / 2, vertex.at.y - INK_TILE / 2, INK_TILE, INK_TILE);
  }
  context.globalAlpha = 1;

  // 4. 진행 방향은 모든 구간이 아니라 출구 뒤 첫 직선에만 드문드문 둔다.
  const arrowSpots: ReadonlyArray<{ at: Point; direction: InkDirection }> = [
    { at: { x: 480, y: 60 }, direction: "r" },
    { at: { x: 740, y: 380 }, direction: "d" },
    { at: { x: 400, y: 660 }, direction: "l" },
    { at: { x: 140, y: 340 }, direction: "u" }
  ];
  for (const spot of arrowSpots) {
    const image = inkArrowImage(spot.direction);
    if (!image.complete || image.naturalWidth === 0) continue;
    context.globalAlpha = 0.72;
    context.drawImage(image, spot.at.x - 19, spot.at.y - 12, 38, 24);
  }
  context.globalAlpha = 1;

  // 5. 다음 이동 구간을 읽을 수 있도록 젖은 먹방울이 같은 방향으로 순환한다.
  const currentOffset = reducedMotion ? 0.02 : (engine.state.elapsed * 0.018) % 1;
  canvas.dataset.inkCurrentOffset = currentOffset.toFixed(4);
  for (let index = 0; index < 10; index += 1) {
    const progress = currentOffset + index / 10;
    const point = positionOnPath(progress);
    const before = positionOnPath(progress - 0.0025);
    const after = positionOnPath(progress + 0.0025);
    const angle = Math.atan2(after.y - before.y, after.x - before.x);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);
    context.fillStyle = "rgba(6, 8, 6, 0.3)";
    context.beginPath();
    context.ellipse(-7, 0, 12, 3.8, 0, 0, Math.PI * 2);
    context.fill();
    const bead = context.createRadialGradient(-1.5, -2, 0.6, 0, 0, 6.4);
    bead.addColorStop(0, "rgba(112, 118, 110, 0.9)");
    bead.addColorStop(0.18, "rgba(26, 31, 27, 0.98)");
    bead.addColorStop(0.72, "rgba(4, 6, 5, 0.98)");
    bead.addColorStop(1, "rgba(3, 4, 3, 0.16)");
    context.fillStyle = bead;
    context.beginPath();
    context.arc(0, 0, 6.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(232, 224, 200, 0.28)";
    context.beginPath();
    context.arc(-1.8, -2.1, 1.25, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  drawSpawnPortals();
  context.restore();
}

function traceEnemyPath(): void {
  context.beginPath();
  context.moveTo(ENEMY_PATH_POINTS[0]?.x ?? 0, ENEMY_PATH_POINTS[0]?.y ?? 0);
  for (const point of ENEMY_PATH_POINTS.slice(1)) context.lineTo(point.x, point.y);
}

function drawSpawnPortals(): void {
  const labelOffsets: readonly Point[] = [
    { x: 0, y: -25 },
    { x: 34, y: 3 },
    { x: 0, y: 31 },
    { x: -34, y: 3 }
  ];
  for (let index = 0; index < ENEMY_SPAWN_PROGRESS.length; index += 1) {
    const spawnProgress = ENEMY_SPAWN_PROGRESS[index] as number;
    const point = positionOnPath(spawnProgress);
    const labelOffset = labelOffsets[index] as Point;
    // 이 출구에서 방금 나온 적이 있으면 spawning. 색만으로 알리지 않도록
    // "出" 글자와 "출구 N" 라벨은 두 상태 모두 그대로 남는다.
    const spawning = engine.state.enemies.some((enemy) => {
      const delta = enemy.progress - spawnProgress;
      return delta >= 0 && delta < 0.02;
    });
    const seal = exitSealImage(spawning ? "spawning" : "waiting");
    if (isPolishSpriteReady(seal)) {
      context.drawImage(seal, point.x - EXIT_SEAL_SIZE / 2, point.y - EXIT_SEAL_SIZE / 2, EXIT_SEAL_SIZE, EXIT_SEAL_SIZE);
    } else {
      context.fillStyle = "rgba(151, 47, 36, 0.12)";
      context.strokeStyle = "rgba(145, 39, 31, 0.92)";
      context.lineWidth = 2.4;
      context.beginPath();
      context.arc(point.x, point.y, 14, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.strokeStyle = "rgba(145, 39, 31, 0.58)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(point.x, point.y, 9.5, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "#8e2f27";
      context.font = '900 10px "Batang", serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("出", point.x, point.y + 1);
    }
    context.fillStyle = "#493426";
    context.font = '900 9px "Malgun Gothic", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`출구 ${index + 1}`, point.x + labelOffset.x, point.y + labelOffset.y);
  }
}

/**
 * 오행진을 평평한 색 사각형이 아니라 한지 위에 놓인 석제 제단으로 그린다.
 *
 * 십자 좌표(진 중심, 셀 간격 44, 판 182x182, 셀 38x38)는 `content.ts`가 결정하며
 * 여기서는 절대 바꾸지 않는다. 판 바깥으로 장식을 넓힐 여유가 없으므로
 * (판 모서리 91px, 도로 코어 안쪽 가장자리 84.5px) 깊이는 전부 판 안쪽과
 * 아래로 드리우는 그림자로만 표현한다.
 */
function drawBoard(): void {
  context.save();
  context.textAlign = "center";
  const occupied = new Set(engine.state.towers.map((tower) => tower.cell));
  // 제단 래스터가 준비된 진에서는 코드 석판과 셀 채움을 낮춰 재질을 가리지 않는다.
  const plateRastered: boolean[] = [];

  for (let formationIndex = 0; formationIndex < BOARD_FORMATIONS.length; formationIndex += 1) {
    const formation = BOARD_FORMATIONS[formationIndex] as (typeof BOARD_FORMATIONS)[number];
    const unlocked = engine.isFormationUnlocked(formationIndex);
    const resonance = engine.formationResonance(formationIndex);
    const cx = formation.center.x;
    const cy = formation.center.y;
    // 좌상·우하만 크게 깎은 비대칭 모서리가 웹 카드 대신 인장 실루엣으로 읽히게 한다.
    const plateRadii = [15, 4, 15, 4];
    const plateReady = isFormationPlateReady(formation.preferredWuxing, unlocked);
    plateRastered[formationIndex] = plateReady;

    if (plateReady) {
      // 1'. 접지 그림자는 판 안쪽에 숨긴 사각형이 드리우게 해 래스터 위에 blur를
      //     매 프레임 다시 계산하지 않는다. 판 바깥으로 새 장식이 나가지 않는다.
      context.save();
      context.shadowColor = unlocked ? "rgba(28, 20, 10, 0.62)" : "rgba(12, 11, 10, 0.6)";
      context.shadowBlur = 17;
      context.shadowOffsetY = 7;
      context.fillStyle = "rgba(24, 18, 11, 0.92)";
      context.beginPath();
      context.roundRect(cx - 87, cy - 87, 174, 174, 12);
      context.fill();
      context.restore();

      // 2'. 546×546 원본을 정확히 182×182로 축소해 놓는다. 확대·재착색 없음.
      context.drawImage(
        formationPlateImage(formation.preferredWuxing, unlocked),
        cx - FORMATION_PLATE_HALF,
        cy - FORMATION_PLATE_HALF,
        FORMATION_PLATE_SIZE,
        FORMATION_PLATE_SIZE
      );
    } else {
      // 1. 제단이 도로 위에 떠 있도록 아래로 접지 그림자를 드리운다.
      context.save();
      context.shadowColor = unlocked ? "rgba(28, 20, 10, 0.62)" : "rgba(12, 11, 10, 0.6)";
      context.shadowBlur = 17;
      context.shadowOffsetY = 7;
      const stone = context.createLinearGradient(0, cy - 91, 0, cy + 91);
      if (unlocked) {
        stone.addColorStop(0, "#eae4d4");
        stone.addColorStop(0.42, "#dcd5c2");
        stone.addColorStop(1, "#c4bca8");
      } else {
        stone.addColorStop(0, "#a8a396");
        stone.addColorStop(0.42, "#928d82");
        stone.addColorStop(1, "#77736b");
      }
      context.fillStyle = stone;
      context.beginPath();
      context.roundRect(cx - 91, cy - 91, 182, 182, plateRadii);
      context.fill();
      context.restore();

      // 2. 오행 기운을 돌 표면에 스미게 한다. 채도는 낮게, 중심에서만 번지게.
      context.save();
      context.beginPath();
      context.roundRect(cx - 91, cy - 91, 182, 182, plateRadii);
      context.clip();
      const tint = context.createRadialGradient(cx, cy, 8, cx, cy, 118);
      tint.addColorStop(0, formation.color + (unlocked ? (resonance.tier > 0 ? "5c" : "3a") : "18"));
      tint.addColorStop(1, formation.color + "00");
      context.fillStyle = tint;
      context.fillRect(cx - 91, cy - 91, 182, 182);

      // 3. 상단 광원 베벨. 위 모서리는 밝게, 아래 모서리는 어둡게.
      context.strokeStyle = "rgba(255, 253, 244, 0.85)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(cx - 83, cy - 90);
      context.lineTo(cx + 86, cy - 90);
      context.stroke();
      context.strokeStyle = "rgba(86, 70, 44, 0.4)";
      context.beginPath();
      context.moveTo(cx - 86, cy + 90);
      context.lineTo(cx + 83, cy + 90);
      context.stroke();
      context.restore();

      // 4. 테두리: 바깥 접촉선 + 오행 색 실선.
      context.strokeStyle = "rgba(52, 40, 22, 0.55)";
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(cx - 91, cy - 91, 182, 182, plateRadii);
      context.stroke();
      context.strokeStyle = unlocked ? formation.color + (resonance.tier > 0 ? "e0" : "9e") : "rgba(88, 84, 79, 0.66)";
      context.lineWidth = resonance.tier > 0 ? 2 : 1.4;
      context.beginPath();
      context.roundRect(cx - 88.5, cy - 88.5, 177, 177, [13, 3, 13, 3]);
      context.stroke();
    }

    // 5. 공명 단계는 네 모서리 꺾쇠 길이로 알린다. 색만으로 구분하지 않는다.
    if (unlocked && resonance.tier > 0) {
      const arm = 8 + resonance.tier * 5;
      context.strokeStyle = formation.color;
      context.lineWidth = 2.6;
      context.lineCap = "round";
      context.shadowColor = formation.color;
      context.shadowBlur = 9;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const bx = cx + sx * 84;
        const by = cy + sy * 84;
        context.beginPath();
        context.moveTo(bx - sx * arm, by);
        context.lineTo(bx, by);
        context.lineTo(bx, by - sy * arm);
        context.stroke();
      }
      context.shadowBlur = 0;
      context.lineCap = "butt";
    }

    // 6. 새겨 넣은 오행 글자. 아래쪽 밝은 획을 먼저 깔아 음각으로 보이게 한다.
    context.font = '900 44px "Batang", serif';
    context.fillStyle = "rgba(255, 253, 244, 0.75)";
    context.fillText(formation.preferredWuxing, cx, cy + 17);
    context.fillStyle = unlocked ? formation.color + (resonance.tier > 0 ? "5e" : "44") : "rgba(96, 92, 86, 0.26)";
    context.fillText(formation.preferredWuxing, cx, cy + 16);

    // 7. 진 이름표: 돌에 박힌 작은 명패.
    const bonusLabel = resonance.damageBonus > 0 ? ` · 피해 +${Math.round(resonance.damageBonus * 100)}%` : "";
    const unlockCost = engine.nextFormationUnlockCost();
    const unlockAffordable = !unlocked && unlockCost !== null && engine.state.gold >= unlockCost && engine.state.startingFormationIndex !== null;
    const plateText = unlocked
      ? `${formation.label} ${resonance.matching}/16${bonusLabel}`
      : unlockAffordable
        ? `${formation.label} · ${unlockCost}엽전 해금 가능!`
        : `${formation.label} · ${unlockCost ?? 0}엽전 해금`;
    context.font = '900 10px "Malgun Gothic", sans-serif';
    const nameWidth = context.measureText(plateText).width + 16;
    // 판 위 중앙은 윗줄 자령 명패가 차지한다. 좌상단 모서리에 붙인다.
    const plateLeft = cx - 91;
    context.fillStyle = "rgba(28, 25, 21, 0.94)";
    context.beginPath();
    context.roundRect(plateLeft, cy - 122, nameWidth, 17, [3, 8, 3, 8]);
    context.fill();
    context.strokeStyle = unlocked ? formation.color + "8c" : "rgba(112, 108, 102, 0.55)";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = unlocked ? "#f6ecd2" : unlockAffordable ? "#ffd98a" : "#a8a29a";
    context.textAlign = "left";
    context.fillText(plateText, plateLeft + 8, cy - 113.5);
    context.textAlign = "center";
  }

  // 8. 셀은 돌판에 파인 소켓으로 그린다. 표 칸처럼 보이지 않게 안쪽 그림자를 준다.
  for (let index = 0; index < BOARD_CELLS.length; index += 1) {
    const cell = BOARD_CELLS[index] as Point;
    const unlocked = engine.isCellUnlocked(index);
    const filled = occupied.has(index);
    const formationIndex = Math.floor(index / CELLS_PER_FORMATION);
    const formation = BOARD_FORMATIONS[formationIndex] as (typeof BOARD_FORMATIONS)[number];
    // 제단 래스터에 이미 4×4 소켓이 파여 있으면 코드 채움을 낮춰 재질을 덮지 않는다.
    // 좌표·크기·히트영역·테두리는 그대로다.
    const overPlate = plateRastered[formationIndex] === true;

    // 점유 칸에는 p0-ui-components-pack-v1 의 오행 소켓을 자령 아래 깔아 어느 진에
    // 속한 칸인지 한눈에 남긴다. 빈 칸은 제단 래스터의 소켓 재질을 그대로 쓴다.
    // 원본 114×114 → 38×38 축소만 하며 좌표·히트영역은 손대지 않는다.
    const socketRastered = filled && unlocked && isCellSocketReady(formation.preferredWuxing, true);
    if (socketRastered) {
      context.drawImage(
        cellSocketImage(formation.preferredWuxing, true),
        cell.x - CELL_SOCKET_SIZE / 2,
        cell.y - CELL_SOCKET_SIZE / 2,
        CELL_SOCKET_SIZE,
        CELL_SOCKET_SIZE
      );
    }

    // 소켓 바닥: 위가 어둡고 아래가 밝은 그라디언트가 파인 느낌을 만든다.
    // 래스터 소켓을 깐 칸에서는 재질을 덮지 않도록 코드 채움을 건너뛴다.
    if (!socketRastered) {
      const socket = context.createLinearGradient(0, cell.y - 19, 0, cell.y + 19);
      if (!unlocked) {
        socket.addColorStop(0, overPlate ? "rgba(88, 84, 78, 0.10)" : "rgba(88, 84, 78, 0.42)");
        socket.addColorStop(1, overPlate ? "rgba(132, 127, 118, 0.06)" : "rgba(132, 127, 118, 0.3)");
      } else if (filled) {
        socket.addColorStop(0, formation.color + (overPlate ? "50" : "74"));
        socket.addColorStop(1, formation.color + (overPlate ? "28" : "3e"));
      } else {
        socket.addColorStop(0, formation.color + (overPlate ? "1e" : "4c"));
        socket.addColorStop(1, formation.color + (overPlate ? "10" : "24"));
      }
      context.fillStyle = socket;
      context.beginPath();
      context.roundRect(cell.x - 19, cell.y - 19, 38, 38, 5);
      context.fill();
    }

    // 아래 가장자리에 얇은 빛을 남겨 파인 깊이를 굳힌다.
    // 래스터 판·소켓은 자체 베벨이 있으므로 이 선을 겹쳐 그리지 않는다.
    if (!overPlate && !socketRastered) {
      context.strokeStyle = "rgba(255, 253, 244, 0.7)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cell.x - 14, cell.y + 18.5);
      context.lineTo(cell.x + 14, cell.y + 18.5);
      context.stroke();
    }

    context.strokeStyle = !unlocked
      ? "rgba(104, 99, 92, 0.7)"
      : formation.color + (filled ? "d2" : "7e");
    context.lineWidth = filled ? 1.6 : 1;
    context.beginPath();
    context.roundRect(cell.x - 19, cell.y - 19, 38, 38, 5);
    context.stroke();

    if (!filled) {
      if (unlocked) {
        // 빈 칸은 글자 대신 작은 상감 점으로 표시해 격자 소음을 줄인다.
        context.fillStyle = formation.color + "6a";
        context.beginPath();
        context.arc(cell.x, cell.y, 2.4, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  // 9. 잠긴 진에는 자물쇠를 얹는다. 셀 소켓보다 뒤에 그려야 가려지지 않는다.
  //    잠긴 진 클릭이 곧 해금 시도인데도 시각 단서가 없어 발견되지 않았다.
  drawFormationLocks();
  context.restore();
}

/**
 * 잠긴 오행진 중앙 자물쇠.
 *
 * 스프라이트(120×120 → 40×40)를 우선 쓰고, 로드 실패 시 절차 드로잉으로 되돌린다.
 * 엽전이 충분하면 glow 스프라이트 + 금색 맥동 링을 더해 "눌러도 된다"를 알린다.
 * 모션 감소 설정에서는 정지 이미지만 쓴다.
 */
function drawFormationLocks(): void {
  const unlockCost = engine.nextFormationUnlockCost();
  const purchasable = unlockCost !== null && engine.state.startingFormationIndex !== null;
  const affordable = purchasable && engine.state.gold >= unlockCost;
  const pulse = reducedMotion ? 0 : (performance.now() % 1_600) / 1_600;

  for (let formationIndex = 0; formationIndex < BOARD_FORMATIONS.length; formationIndex += 1) {
    if (engine.isFormationUnlocked(formationIndex)) continue;
    const formation = BOARD_FORMATIONS[formationIndex] as (typeof BOARD_FORMATIONS)[number];
    const cx = formation.center.x;
    const cy = formation.center.y;
    const hovered = hoveredLockFormation === formationIndex;
    const scale = hovered && !reducedMotion ? 1.14 : 1;

    // 살 수 있는 진은 금색 링이 1.6초 주기로 번지며 시선을 끈다.
    if (affordable && !reducedMotion) {
      const radius = 26 + pulse * 20;
      context.save();
      context.globalAlpha = (1 - pulse) * 0.62;
      context.strokeStyle = "#ffd98a";
      context.lineWidth = 2.4;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    const kind = affordable ? "glow" : "closed";
    if (isLockSpriteReady(kind)) {
      const size = LOCK_SPRITE_SIZE * scale;
      context.drawImage(lockSpriteImage(kind), cx - size / 2, cy - size / 2, size, size);
    } else {
      drawProceduralLock(cx, cy, scale, affordable);
    }

    // 색만으로 잠금·해금 가능을 가르지 않는다. 자물쇠 아래에 사유를 남긴다.
    const note = !purchasable
      ? "첫 소환 대기"
      : affordable
        ? `${unlockCost}엽전 해금`
        : `엽전 ${unlockCost - engine.state.gold} 부족`;
    context.save();
    context.font = '900 10px "Malgun Gothic", sans-serif';
    context.textAlign = "center";
    const noteWidth = context.measureText(note).width + 12;
    context.fillStyle = "rgba(28, 25, 21, 0.9)";
    context.beginPath();
    context.roundRect(cx - noteWidth / 2, cy + 24, noteWidth, 15, 4);
    context.fill();
    context.fillStyle = affordable ? "#ffd98a" : "#c8c1b6";
    context.fillText(note, cx, cy + 35);
    context.restore();
  }
}

/** 스프라이트가 없을 때 쓰는 절차 자물쇠(몸통 26×20 + 고리). */
function drawProceduralLock(cx: number, cy: number, scale: number, affordable: boolean): void {
  context.save();
  context.translate(cx, cy);
  context.scale(scale, scale);
  context.strokeStyle = affordable ? "rgba(255, 217, 138, 0.92)" : "rgba(226, 219, 205, 0.72)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, -8, 8, Math.PI, 0);
  context.stroke();
  context.fillStyle = affordable ? "rgba(96, 74, 34, 0.9)" : "rgba(60, 50, 38, 0.85)";
  context.beginPath();
  context.roundRect(-13, -6, 26, 20, 4);
  context.fill();
  context.strokeStyle = affordable ? "rgba(255, 217, 138, 0.92)" : "rgba(226, 219, 205, 0.62)";
  context.lineWidth = 1.4;
  context.stroke();
  context.fillStyle = affordable ? "#ffd98a" : "#d8d1c4";
  context.beginPath();
  context.arc(0, 3, 2.4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/**
 * 추적 중 성어의 배치 안내 — 스펙 6라운드 B.
 * 어떤 자령이 몇 번째 글자인지(순번 배지), 다음 글자를 어디에 놓을 수 있는지
 * (유효 셀)를 한 번만 계산해 두고 명패·보드 오버레이가 함께 읽는다.
 */
interface IdiomPlacementGuide {
  readonly idiom: IdiomDefinition;
  readonly chain: PartialIdiomChain;
  /** 자령 id → 성어에서의 순번(1~4). */
  readonly orders: ReadonlyMap<number, IdiomOrder>;
  /** 다음 글자를 이을 수 있는 빈 칸. */
  readonly nextCells: readonly number[];
}

let idiomPlacementGuide: IdiomPlacementGuide | null = null;
let idiomPlacementGuideKey = "";

function refreshIdiomPlacementGuide(): void {
  const idiom = engine.currentIdiomTarget();
  const key = idiom
    ? `${idiom.id}|${engine.state.towers.map((tower) => `${tower.cell}:${tower.char}`).sort().join(",")}|${engine.state.unlockedFormations.join("")}`
    : "";
  if (key === idiomPlacementGuideKey) return;
  idiomPlacementGuideKey = key;
  if (!idiom) {
    idiomPlacementGuide = null;
    canvas.dataset.idiomTarget = "";
    canvas.dataset.idiomChainCells = "";
    canvas.dataset.idiomNextCells = "";
    canvas.dataset.idiomOrderBadges = "";
    return;
  }
  const characters = [...idiom.chars];
  const chain = partialIdiomChain(engine.state.towers, idiom);
  const orders = new Map<number, IdiomOrder>();
  const takenOrders = new Set<number>();
  const takenTowers = new Set<number>();
  // 사슬에 실제로 쓰인 자령이 순번을 먼저 가져간다(같은 글자 중복 대비).
  for (let index = 0; index < chain.cells.length; index += 1) {
    const order = (chain.reversed ? chain.startOrder - index : chain.startOrder + index) as IdiomOrder;
    const tower = engine.state.towers.find((candidate) => candidate.cell === chain.cells[index]);
    if (!tower) continue;
    orders.set(tower.id, order);
    takenOrders.add(order);
    takenTowers.add(tower.id);
  }
  for (let index = 0; index < characters.length; index += 1) {
    const order = index + 1;
    if (takenOrders.has(order)) continue;
    const tower = engine.state.towers.find(
      (candidate) => candidate.char === characters[index] && !takenTowers.has(candidate.id)
    );
    if (!tower) continue;
    orders.set(tower.id, order as IdiomOrder);
    takenOrders.add(order);
    takenTowers.add(tower.id);
  }

  const nextCells: number[] = [];
  if (chain.anchorCell !== null && !chain.complete) {
    const occupied = new Set(engine.state.towers.map((tower) => tower.cell));
    for (const cell of idiomNeighborCells(chain.anchorCell)) {
      if (occupied.has(cell) || !engine.isCellUnlocked(cell)) continue;
      nextCells.push(cell);
    }
  }
  idiomPlacementGuide = { idiom, chain, orders, nextCells };
  // 배치 안내 상태를 캔버스 데이터셋으로 내보내 캡처·e2e 가 읽을 수 있게 한다.
  canvas.dataset.idiomTarget = idiom.chars;
  canvas.dataset.idiomChainCells = chain.cells.join(",");
  canvas.dataset.idiomChainReversed = String(chain.reversed);
  canvas.dataset.idiomNextOrder = chain.nextOrder === null ? "" : String(chain.nextOrder);
  canvas.dataset.idiomNextCells = nextCells.join(",");
  canvas.dataset.idiomOrderBadges = [...orders]
    .map(([towerId, order]) => `${engine.state.towers.find((tower) => tower.id === towerId)?.cell ?? -1}:${order}`)
    .join(",");
}

/** 순번 인장(60x60 원본 → 표시 20px). 로드 실패 시 인주 원 + 백색 숫자로 대체한다. */
function drawIdiomOrderBadge(centerX: number, centerY: number, size: number, order: IdiomOrder): void {
  const sprite = idiomOrderSealImage(order);
  if (idiomSpriteReady(sprite)) {
    context.drawImage(sprite, centerX - size / 2, centerY - size / 2, size, size);
    return;
  }
  context.save();
  context.fillStyle = "#b6372b";
  context.strokeStyle = "rgba(255, 242, 214, 0.85)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff6e4";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${Math.round(size * 0.62)}px "Malgun Gothic", sans-serif`;
  context.fillText(String(order), centerX, centerY + 0.5);
  context.restore();
}

/**
 * 다음 글자를 놓을 수 있는 빈 칸을 금색 점선 테두리와 순번으로 표시한다.
 * 자령을 끌고 있는 동안에도 같은 표시가 유지된다.
 */
function drawIdiomPlacementCells(): void {
  const guide = idiomPlacementGuide;
  if (!guide || guide.nextCells.length === 0 || guide.chain.nextOrder === null) return;
  const order = guide.chain.nextOrder as IdiomOrder;
  const breath = reducedMotion ? 0.72 : 0.58 + Math.sin(engine.state.elapsed * 3.1) * 0.22;
  context.save();
  context.setLineDash([5, 4]);
  context.lineWidth = 1.8;
  context.strokeStyle = "#ffd479";
  context.shadowColor = "rgba(255, 205, 105, 0.7)";
  context.shadowBlur = 8;
  context.globalAlpha = breath;
  for (const cell of guide.nextCells) {
    const point = BOARD_CELLS[cell] as Point;
    context.beginPath();
    context.roundRect(point.x - 17.5, point.y - 17.5, 35, 35, 5);
    context.stroke();
  }
  context.setLineDash([]);
  context.shadowBlur = 0;
  context.globalAlpha = Math.min(1, breath + 0.24);
  for (const cell of guide.nextCells) {
    const point = BOARD_CELLS[cell] as Point;
    drawIdiomOrderBadge(point.x, point.y, 18, order);
  }
  context.restore();
}

/** 폴리라인 위 비율 t(0~1) 지점. 사슬 빔의 광점이 1→4 방향으로 흐르게 한다. */
function pointAlongPolyline(points: readonly Point[], t: number): Point | null {
  if (points.length < 2) return points[0] ?? null;
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1] as Point;
    const to = points[index] as Point;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return points[0] ?? null;
  let travelled = t * total;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index] as number;
    if (travelled <= length) {
      const from = points[index] as Point;
      const to = points[index + 1] as Point;
      const ratio = length === 0 ? 0 : travelled / length;
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
    travelled -= length;
  }
  return points[points.length - 1] ?? null;
}

/**
 * 발동한 봉인 — 스펙 6라운드 C.
 * 네 칸이 성어 색으로 숨쉬고, 사슬 빔 위를 광점이 1→4 방향으로 흐르며,
 * 칸마다 순번 인장이 박힌다. 모션 감소에서는 펄스 없이 정적 60% 밝기만 쓴다.
 */
function drawIdiomSeals(): void {
  for (const seal of engine.state.idiomSeals) {
    const idiom = idiomById(engine.state.region, seal.idiomId);
    if (!idiom) continue;
    const points = seal.cells.map((cell) => BOARD_CELLS[cell] as Point);
    const breath = reducedMotion ? 0.6 : 0.5 + (Math.sin((engine.state.elapsed / 1.8) * Math.PI * 2) * 0.5 + 0.5) * 0.5;
    context.save();

    // 1. 봉인된 칸 자체가 숨쉬듯 발광한다.
    for (const point of points) {
      context.globalAlpha = breath * 0.55;
      context.fillStyle = idiom.color;
      context.beginPath();
      context.roundRect(point.x - 19, point.y - 19, 38, 38, 5);
      context.fill();
      context.globalAlpha = Math.min(1, breath + 0.25);
      context.strokeStyle = idiom.color;
      context.shadowColor = idiom.color;
      context.shadowBlur = 12 * breath + 4;
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(point.x - 19, point.y - 19, 38, 38, 5);
      context.stroke();
      context.shadowBlur = 0;
    }

    // 2. 사슬 빔. 굵기를 키워 "이 넷이 한 줄"이라는 사실이 멀리서도 읽히게 한다.
    context.globalAlpha = 0.48;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = idiom.color;
    context.shadowColor = idiom.color;
    context.shadowBlur = 18;
    context.lineWidth = 12;
    context.beginPath();
    context.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    context.globalAlpha = 0.82;
    context.strokeStyle = "#fff7dc";
    context.shadowBlur = 0;
    context.lineWidth = 2;
    context.stroke();

    // 3. 광점 1개가 1번 칸에서 4번 칸으로 흐르며 순서 방향을 알린다.
    if (!reducedMotion) {
      const spark = pointAlongPolyline(points, ((engine.state.elapsed + seal.completedAt) / 2.2) % 1);
      if (spark) {
        context.globalAlpha = 0.95;
        context.fillStyle = "#fff9e6";
        context.shadowColor = idiom.color;
        context.shadowBlur = 14;
        context.beginPath();
        context.arc(spark.x, spark.y, 4.5, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }
    }

    // 4. 칸마다 순번 인장을 박아 어느 글자가 몇 번째인지 남긴다.
    context.globalAlpha = 1;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index] as Point;
      context.fillStyle = idiom.color;
      context.beginPath();
      context.arc(point.x, point.y, 5, 0, Math.PI * 2);
      context.fill();
      drawIdiomOrderBadge(point.x - 13, point.y - 13, 16, (index + 1) as IdiomOrder);
    }
    context.restore();
  }
}

/**
 * 발동 순간의 파문 링 — 스펙 6라운드 C3.
 *
 * 코덱스 파문 마스크를 성어 색으로 물들여 봉인된 네 칸에서 1→4 차례로 터뜨린다.
 * 마스크가 아직 안 실렸으면 같은 리듬의 절차 원호로 대신한다. 월드 좌표계에서
 * 부르므로 updateAndDrawFx 안에서만 호출한다.
 */
function drawIdiomRipples(): void {
  const sprite = idiomRipples.length > 0 ? tintedIdiomRipple(idiomRipples[0]?.color ?? "#ffffff") : null;
  for (const ripple of idiomRipples) {
    const live = ripple.age - ripple.delay;
    if (live < 0) continue;
    if (!isWorldPointVisible(ripple.at, 120)) continue;
    const ratio = Math.min(1, live / ripple.duration);
    const size = 46 + ratio * 128;
    context.save();
    context.globalAlpha = (1 - ratio) * (1 - ratio) * 0.9;
    if (sprite) {
      context.drawImage(sprite, ripple.at.x - size / 2, ripple.at.y - size / 2, size, size);
    } else {
      context.strokeStyle = ripple.color;
      context.lineWidth = 5 - ratio * 3.4;
      context.shadowColor = ripple.color;
      context.shadowBlur = 16;
      context.beginPath();
      context.arc(ripple.at.x, ripple.at.y, size / 2, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }
  for (let index = idiomRipples.length - 1; index >= 0; index -= 1) {
    const ripple = idiomRipples[index] as IdiomRippleFx;
    if (ripple.age >= ripple.delay + ripple.duration) idiomRipples.splice(index, 1);
  }
}

/**
 * 성어 4자 대형 플래시 — 스펙 6라운드 C3.
 *
 * 봉인된 네 칸 위에 뜨되, 카메라가 그 칸을 벗어나 있어도 무엇이 발동했는지는
 * 알아야 하므로 화면 좌표로 그리고 전장 안으로 clamp 한다. 그래서 월드 변환을
 * 되돌린 뒤(drawWorld 의 restore 이후)에 호출한다.
 */
function drawIdiomFlash(): void {
  const flash = idiomFlash;
  if (!flash || flash.age >= flash.duration) {
    if (flash) idiomFlash = null;
    if (canvas.dataset.idiomFlash) canvas.dataset.idiomFlash = "";
    return;
  }
  canvas.dataset.idiomFlash = flash.chars;
  const ratio = flash.age / flash.duration;
  // 튀어 오르고(0~18%) 머무르다(~62%) 사라진다.
  const rise = Math.min(1, ratio / 0.18);
  const fade = ratio < 0.62 ? 1 : 1 - (ratio - 0.62) / 0.38;
  const scale = reducedMotion ? 1 : 0.82 + rise * 0.24 - Math.max(0, ratio - 0.62) * 0.16;
  const x = Math.min(WORLD_WIDTH - 150, Math.max(150, mapOffset.x + flash.at.x * mapZoom));
  const y = Math.min(WORLD_HEIGHT - 120, Math.max(120, mapOffset.y + flash.at.y * mapZoom));
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, rise * fade));
  context.translate(x, y);
  context.scale(scale, scale);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 62px "Malgun Gothic", serif';
  // 어떤 배경 위에서도 읽히도록 먹 윤곽 먼저, 성어 색 채움 나중.
  context.lineJoin = "round";
  context.lineWidth = 9;
  context.strokeStyle = "rgba(4, 8, 14, 0.92)";
  context.strokeText(flash.chars, 0, 0);
  context.shadowColor = flash.color;
  context.shadowBlur = 26;
  context.fillStyle = "#fff6dd";
  context.fillText(flash.chars, 0, 0);
  context.shadowBlur = 0;
  context.font = '800 19px "Malgun Gothic", sans-serif';
  context.lineWidth = 6;
  context.strokeText(`${flash.reading} · 봉인`, 0, 50);
  context.fillStyle = flash.color;
  context.fillText(`${flash.reading} · 봉인`, 0, 50);
  context.restore();
}

function hoveredMaterialIds(): Set<number> {
  const ids = new Set(hoveredCompositionMaterialIds);
  if (hoveredRecipeId) {
    const option = engine.availableEvolutions().find((candidate) => candidate.recipeId === hoveredRecipeId);
    for (const id of option?.materialTowerIds ?? []) ids.add(id);
  }
  return ids;
}

function drawCompositionMaterialLinks(): void {
  const materials = engine.state.towers.filter((tower) => hoveredCompositionMaterialIds.has(tower.id));
  if (materials.length === 0) return;
  const points = materials.map((tower) => BOARD_CELLS[tower.cell] as Point);
  context.save();
  context.strokeStyle = "#ffe39a";
  context.fillStyle = "rgba(255, 227, 154, 0.1)";
  context.shadowColor = "#ffcb61";
  context.shadowBlur = 18;
  context.lineWidth = 3;
  context.setLineDash([8, 5]);
  if (points.length > 1) {
    context.beginPath();
    context.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.setLineDash([]);
  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, 26, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  const anchor = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  anchor.x /= points.length;
  anchor.y /= points.length;
  context.shadowBlur = 8;
  context.fillStyle = "#fff4c7";
  context.font = '900 10px "Malgun Gothic", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText("합성 재료", anchor.x, anchor.y - 30);
  context.restore();
}

function drawSelection(): void {
  const selected = engine.selectedTower();
  if (selected && !engine.selectedTowerIsStored()) drawTowerRange(selected, false);
  const hovered = hoveredTowerId === null ? undefined : engine.state.towers.find((tower) => tower.id === hoveredTowerId);
  if (hovered && hovered.id !== selected?.id) drawTowerRange(hovered, true);
}

function drawTowerRange(tower: Tower, hovered: boolean): void {
  const cell = BOARD_CELLS[tower.cell] as Point;
  const definition = definitionForTower(engine.catalog, tower.definitionId);
  const style = ELEMENT_STYLES[tower.wuxing];
  context.save();
  context.strokeStyle = style.color + (hovered ? "8f" : "40");
  context.fillStyle = style.color + (hovered ? "10" : "09");
  context.lineWidth = hovered ? 2.2 : 1.5;
  context.setLineDash(hovered ? [10, 6] : [7, 7]);
  context.beginPath();
  context.arc(cell.x, cell.y, definition.combat.range + engine.towerRangeBonus(tower) + engine.idiomBonus("range") + (tower.concentration ?? 0) * 4 + engine.combinedUpgradeBonus(tower.wuxing, "range"), 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawChargeRing(
  cell: Point,
  radius: number,
  tower: Tower,
  abilities: HanziDefinition["combat"]["abilities"]
): void {
  if (!engine.towerHasActiveSkills(tower)) return;
  const charge = (tower.shotCount % abilities.tuning.signatureEvery) / abilities.tuning.signatureEvery;
  context.strokeStyle = "rgba(255,255,255,0.1)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(cell.x, cell.y, radius, -Math.PI / 2, Math.PI * 1.5);
  context.stroke();
  if (charge > 0) {
    context.strokeStyle = abilities.role.color;
    context.shadowColor = abilities.role.color;
    context.shadowBlur = 9;
    context.beginPath();
    context.arc(cell.x, cell.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
    context.stroke();
    context.shadowBlur = 0;
  }
}

function drawStudyTower(tower: Tower, cell: Point, definition: HanziDefinition, selected: boolean, material: boolean): void {
  const abilities = definition.combat.abilities;
  const style = ELEMENT_STYLES[tower.wuxing];
  const progressionRank = engine.state.mode === "casual" ? casualStarOf(tower) : tower.stage;
  const progressionColor = engine.state.mode === "casual" ? CASUAL_STAR_COLORS[casualStarOf(tower)] : STAGE_COLORS[tower.stage];
  const pulse = 1 + tower.pulse * 0.09;
  const radius = (16 + (progressionRank - 1) * 0.55) * pulse;
  context.shadowColor = material ? "#ffe7a3" : style.glow;
  context.shadowBlur = material ? 28 : selected ? 22 : 10 + progressionRank * 1.5;
  const gradient = context.createRadialGradient(cell.x - 3, cell.y - 4, 2, cell.x, cell.y, radius);
  gradient.addColorStop(0, style.color + "ee");
  gradient.addColorStop(0.28, style.color + "88");
  gradient.addColorStop(1, "#111925");
  context.fillStyle = gradient;
  context.strokeStyle = material ? "#fff0b7" : selected ? "#ffffff" : progressionColor;
  context.lineWidth = material || selected ? 2 : 1 + progressionRank * 0.11;
  context.beginPath();
  context.arc(cell.x, cell.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  drawChargeRing(cell, radius + 3, tower, abilities);
  context.fillStyle = "#fbfdff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 ' + String(17 + Math.min(6, progressionRank)) + 'px "Malgun Gothic", "Noto Sans CJK KR", serif';
  context.fillText(tower.char, cell.x, cell.y - 2);
  context.textBaseline = "alphabetic";
  context.font = '900 8px "Malgun Gothic", sans-serif';
  context.fillStyle = "#efe4c8";
  context.fillText(learningInfo(engine.state.region, tower.char).short, cell.x, cell.y + 24, 40);
}

/**
 * 전장 명패 치수 — layout-audit-response-v1 §2 + v5-compact-tier-assets-pack-v1.
 *
 * 셀 중심 간격은 월드 44px 이고 기본 배율(2.0)에서 화면 88px 이 된다. 명패는
 * 역-스케일로 그려 화면 픽셀 크기가 고정되므로, 104px wide 형은 88px 간격에
 * 16px 씩 겹쳤다. 상시 명패를 84×40 compact 2줄형으로 낮춰 좌우 2px 씩,
 * 합계 4px 의 투명 간격을 만든다. 104×60 detail 형은 선택 상세 팝오버 전용이다.
 * 실제 치수와 코드 텍스트 좌표는 NAMEPLATE_LAYOUT(납품 명세)을 따른다.
 */
const PLAQUE_GLYPH_ONLY_WIDTH = 34;
/** 명패 아래 끝은 기존 wide 형과 같은 높이에 두어 자령 그림을 덮는 정도를 유지한다. */
const PLAQUE_BOTTOM = -28;
/** 셀 중심 간 월드 거리. content.ts 의 FORMATION_SPACING 을 좌표에서 되읽는다. */
const CELL_SPACING = ((BOARD_CELLS[1]?.x ?? 44) - (BOARD_CELLS[0]?.x ?? 0)) || 44;
/** 이웃 명패 사이에 남겨야 하는 최소 투명 간격(화면 px). */
const PLAQUE_MIN_GAP = 4;

const compactReadingCache = new Map<string, CompactReading>();

function plaqueReadingFont(size: number): string {
  return `800 ${size}px "Malgun Gothic", sans-serif`;
}

/** 캔버스 실측을 plaque-text 모듈에 주입한다. 글꼴 상태는 호출 뒤 되돌린다. */
const measurePlaqueText: MeasureText = (value, fontSize) => {
  context.font = plaqueReadingFont(fontSize);
  return context.measureText(value).width;
};

/**
 * compact 명패의 훈음 2줄 배치를 정한다. 매 프레임 자령 수만큼 실측하지 않도록
 * 문자열·폭 조합으로 캐시한다.
 */
function compactReadingFor(full: string, maxWidth: number): CompactReading {
  const key = `${full}|${maxWidth}`;
  const cached = compactReadingCache.get(key);
  if (cached) return cached;
  const previousFont = context.font;
  const resolved = compactReading(full, maxWidth, measurePlaqueText);
  context.font = previousFont;
  compactReadingCache.set(key, resolved);
  return resolved;
}

/** 상시 명패는 glyph-only 34px 이하로는 내려가지 않는다. 폭이 부족하면 통째로 숨기지 않고 한자만 남긴다. */
function plaqueIsGlyphOnly(): boolean {
  return CELL_SPACING * mapZoom < NAMEPLATE_LAYOUT.compact.width + PLAQUE_MIN_GAP;
}

function drawSpiritTowerLabel(tower: Tower, cell: Point, selected: boolean, material: boolean): void {
  const style = ELEMENT_STYLES[tower.wuxing];
  const learning = learningInfo(engine.state.region, tower.char);
  // 한자 강조 OFF 는 명패 래스터와 글자를 통째로 숨긴다. glyph-only 명패도 남기지 않는다.
  if (!hanjaEmphasis) return;

  const glyphOnly = plaqueIsGlyphOnly();
  const layout = NAMEPLATE_LAYOUT.compact;
  const width = glyphOnly ? Math.min(PLAQUE_GLYPH_ONLY_WIDTH, Math.max(20, CELL_SPACING * mapZoom - PLAQUE_MIN_GAP)) : layout.width;
  const height = glyphOnly ? 34 : layout.height;
  const top = PLAQUE_BOTTOM - height + (glyphOnly ? 12 : 0);
  const left = -width / 2;

  context.save();
  context.translate(cell.x, cell.y);
  // Counter-scale the label so Hanja stays readable while the map zooms and pans.
  context.scale(1 / mapZoom, 1 / mapZoom);
  drawPlaqueShell(glyphOnly ? null : "compact", width, height, top, glyphOnly ? width : layout.glyphColumn, style.color, selected || material);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = PLAQUE_INK;
  context.font = plaqueGlyphFont(glyphOnly ? 22 : 24);
  const glyphCenterX = glyphOnly ? 0 : left + layout.glyphCenter.x;
  const glyphCenterY = glyphOnly ? top + height / 2 : top + layout.glyphCenter.y;
  // 안전 영역을 넘으면 22px 로 한 번만 줄인다. 압축은 하지 않는다.
  if (!glyphOnly && context.measureText(tower.char).width > layout.glyphSafe.width) context.font = plaqueGlyphFont(22);
  context.fillText(tower.char, glyphCenterX, glyphCenterY + 1);
  if (!glyphOnly) {
    // 훈음은 오른쪽 텍스트 영역에서 2줄까지 균형 분할한다. maxWidth 압축은 쓰지 않는다.
    const reading = compactReadingFor(learning.short, layout.text.width - 1);
    const readingCenterX = left + layout.text.x + layout.text.width / 2;
    const readingCenterY = top + layout.text.y + layout.text.height / 2;
    context.fillStyle = PLAQUE_INK_SOFT;
    context.font = plaqueReadingFont(reading.font);
    if (reading.lines.length <= 1) context.fillText(reading.lines[0] ?? "", readingCenterX, readingCenterY);
    else {
      context.fillText(reading.lines[0] ?? "", readingCenterX, readingCenterY - 6);
      context.fillText(reading.lines[1] ?? "", readingCenterX, readingCenterY + 6);
    }
    if (reading.shortened) {
      // 줄인 훈음에는 오른쪽 위에 작은 표식을 두어 상세 팝오버를 보게 한다.
      context.fillStyle = "rgba(140, 46, 34, 0.9)";
      context.beginPath();
      context.arc(width / 2 - 6, top + 6, 2, 0, Math.PI * 2);
      context.fill();
    }
  }
  // 추적 중 성어의 글자를 가진 자령에는 명패 좌측에 순번 인장을 얹는다.
  const order = idiomPlacementGuide?.orders.get(tower.id);
  if (order) {
    const badgeSize = glyphOnly ? 14 : 18;
    drawIdiomOrderBadge(left + badgeSize / 2 - 1, top + 1, badgeSize, order);
  }
  context.restore();
}

/** 명패 바탕색 위의 먹글씨. 크림 한지 위에서 대비를 확보한다. */
const PLAQUE_INK = "#231708";
const PLAQUE_INK_SOFT = "#3a2a14";

function plaqueGlyphFont(size: number): string {
  return `900 ${size}px "Malgun Gothic", "Noto Sans CJK KR", serif`;
}

/**
 * 명패 판 — v5 납품 래스터를 1/3 배율로 고정 렌더한다(9-slice·stretch 금지).
 * 로드 전이거나 glyph-only 축소본은 절차 드로잉으로 대체한다.
 */
function drawPlaqueShell(
  kind: NameplateKind | null,
  width: number,
  height: number,
  top: number,
  glyphBox: number,
  elementColor: string,
  emphasised: boolean
): void {
  const left = -width / 2;
  const radii = [3, 11, 3, 11] as const;
  context.save();
  context.shadowColor = emphasised ? "rgba(255, 231, 164, 0.55)" : "rgba(0, 0, 0, 0.5)";
  context.shadowBlur = emphasised ? 12 : 6;
  context.shadowOffsetY = 2;
  if (kind && nameplateReady(kind)) {
    context.drawImage(nameplateImage(kind), left, top, width, height);
  } else {
    // 폴백: 납품 래스터와 같은 한지 바탕 + 옻칠 테두리를 절차로 그린다.
    const paper = context.createLinearGradient(0, top, 0, top + height);
    paper.addColorStop(0, "#e6d7b4");
    paper.addColorStop(1, "#cdba91");
    context.fillStyle = paper;
    context.beginPath();
    context.roundRect(left, top, width, height, [...radii]);
    context.fill();
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.strokeStyle = "#231a10";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(left + 1, top + 1, width - 2, height - 2, [...radii]);
    context.stroke();
    if (glyphBox < width) {
      context.strokeStyle = "rgba(50, 36, 18, 0.45)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left + glyphBox + 0.5, top + 4);
      context.lineTo(left + glyphBox + 0.5, top + height - 4);
      context.stroke();
    }
  }
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  // 한자 칸에 오행 색을 옅게 씌워 명패가 두 구역으로 읽히게 한다.
  if (glyphBox < width) {
    context.save();
    context.beginPath();
    context.roundRect(left + 2, top + 2, width - 4, height - 4, [...radii]);
    context.clip();
    context.globalAlpha = 0.22;
    context.fillStyle = elementColor;
    context.fillRect(left + 2, top + 2, glyphBox - 2, height - 4);
    context.restore();
  }

  // 선택·재료 상태는 색만이 아니라 두꺼운 금테로도 구분한다.
  if (emphasised) {
    context.strokeStyle = "#ffe9b0";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(left + 1, top + 1, width - 2, height - 2, [...radii]);
    context.stroke();
  }

  // 자령을 가리키는 작은 꼬리
  context.fillStyle = emphasised ? "#ffe9b0" : "#2b2014";
  context.beginPath();
  context.moveTo(-4, top + height - 1);
  context.lineTo(4, top + height - 1);
  context.lineTo(0, top + height + 4);
  context.closePath();
  context.fill();
  context.restore();
}

interface PendingPlaque {
  readonly tower: Tower;
  readonly cell: Point;
  readonly selected: boolean;
  readonly material: boolean;
}

/**
 * 명패는 자령 본체 루프 안에서 바로 그리지 않고 모았다가 마지막에 흘린다.
 * 렌더 순서: 일반 y순 → 합성 재료 → 선택 명패 → 선택 상세 팝오버.
 * 이웃 자령의 본체나 명패가 선택 명패의 훈음을 덮지 않게 한다.
 */
const pendingPlaques: PendingPlaque[] = [];

function flushTowerPlaques(): void {
  if (pendingPlaques.length === 0) return;
  const ordered = [...pendingPlaques].sort((left, right) => left.cell.y - right.cell.y);
  for (const entry of ordered) {
    if (entry.material || entry.selected) continue;
    drawSpiritTowerLabel(entry.tower, entry.cell, false, false);
  }
  for (const entry of ordered) {
    if (entry.material && !entry.selected) drawSpiritTowerLabel(entry.tower, entry.cell, false, true);
  }
  for (const entry of ordered) {
    if (entry.selected) drawSpiritTowerLabel(entry.tower, entry.cell, true, entry.material);
  }
  const focused = ordered.find((entry) => entry.selected);
  if (focused) drawTowerDetailPopover(focused.tower, focused.cell);
  pendingPlaques.length = 0;
}

/** 같은 진 안에서 방향으로 이웃한 셀 번호. 진 밖이면 null(가릴 명패가 없음). */
function neighborCellIndex(cell: number, columnStep: number, rowStep: number): number | null {
  if (cell < 0 || cell >= BOARD_CELLS.length) return null;
  const formation = Math.floor(cell / CELLS_PER_FORMATION);
  const local = cell % CELLS_PER_FORMATION;
  const column = local % FORMATION_COLUMNS + columnStep;
  const row = Math.floor(local / FORMATION_COLUMNS) + rowStep;
  if (column < 0 || column >= FORMATION_COLUMNS || row < 0 || row >= FORMATION_ROWS) return null;
  return formation * CELLS_PER_FORMATION + row * FORMATION_COLUMNS + column;
}

/**
 * 선택 자령의 104px 상세 팝오버. compact 가 줄여 적은 훈음의 전체값을 보여준다.
 * 가장 가까운 빈 방향에 띄우고 전장 경계 안으로 clamp 한다.
 */
function drawTowerDetailPopover(tower: Tower, cell: Point): void {
  if (!hanjaEmphasis) return;
  const style = ELEMENT_STYLES[tower.wuxing];
  const learning = learningInfo(engine.state.region, tower.char);
  const layout = NAMEPLATE_LAYOUT.detail;
  const previousFont = context.font;
  context.font = plaqueReadingFont(11);
  let lines = canvasWrappedLines(learning.short, layout.text.width - 2, 3);
  if (lines.length > 3) {
    context.font = plaqueReadingFont(10);
    lines = canvasWrappedLines(learning.short, layout.text.width - 2, 3);
  }
  const readingFont = context.font;
  context.font = previousFont;
  const lineHeight = 13;
  const height = layout.height;

  const occupied = new Set(engine.state.towers.map((candidate) => candidate.cell));
  const free = (columnStep: number, rowStep: number): boolean => {
    const neighbor = neighborCellIndex(tower.cell, columnStep, rowStep);
    return neighbor === null || !occupied.has(neighbor);
  };
  // 가장 가까운 빈 방향: 위 → 오른쪽 → 왼쪽 → 아래. 자기 compact 명패(84px)와
  // 겹치지 않도록 옆으로 낼 때는 두 폭의 절반 합에 6px 여백을 더한다.
  const sideOffset = (NAMEPLATE_LAYOUT.compact.width + layout.width) / 2 + 6;
  const sideTop = PLAQUE_BOTTOM - NAMEPLATE_LAYOUT.compact.height / 2 - height / 2;
  const placements: ReadonlyArray<{ columnStep: number; rowStep: number; offsetX: number; top: number }> = [
    { columnStep: 0, rowStep: -1, offsetX: 0, top: PLAQUE_BOTTOM - NAMEPLATE_LAYOUT.compact.height - 14 - height },
    { columnStep: 1, rowStep: 0, offsetX: sideOffset, top: sideTop },
    { columnStep: -1, rowStep: 0, offsetX: -sideOffset, top: sideTop },
    { columnStep: 0, rowStep: 1, offsetX: 0, top: 36 }
  ];
  const placement = placements.find((candidate) => free(candidate.columnStep, candidate.rowStep)) ?? placements[0] as (typeof placements)[number];
  let offsetX = placement.offsetX;
  let top = placement.top;

  // 전장(캔버스) 경계 안으로 밀어 넣는다. 명패는 역-스케일이라 화면 px 로 계산한다.
  const screenX = mapOffset.x + cell.x * mapZoom;
  const screenY = mapOffset.y + cell.y * mapZoom;
  // 최소 8px viewport inset 을 지킨다.
  const inset = 8;
  offsetX = Math.max(inset + layout.width / 2 - screenX, Math.min(WORLD_WIDTH - inset - layout.width / 2 - screenX, offsetX));
  top = Math.max(46 - screenY, Math.min(WORLD_HEIGHT - inset - height - screenY, top));

  const left = -layout.width / 2;
  context.save();
  context.translate(cell.x, cell.y);
  context.scale(1 / mapZoom, 1 / mapZoom);
  context.translate(offsetX, 0);
  drawPlaqueShell("detail", layout.width, height, top, layout.glyphColumn, style.color, true);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = PLAQUE_INK;
  context.font = plaqueGlyphFont(30);
  if (context.measureText(tower.char).width > layout.glyphSafe.width) context.font = plaqueGlyphFont(26);
  context.fillText(tower.char, left + layout.glyphCenter.x, top + layout.glyphCenter.y + 1);
  context.fillStyle = PLAQUE_INK_SOFT;
  context.font = readingFont;
  const readingCenter = left + layout.text.x + layout.text.width / 2;
  const firstLine = top + layout.text.y + layout.text.height / 2 - (lines.length - 1) * lineHeight / 2;
  for (let index = 0; index < lines.length; index += 1) {
    context.fillText(lines[index] as string, readingCenter, firstLine + index * lineHeight);
  }
  context.restore();
}

function drawSpiritTower(tower: Tower, cell: Point, definition: HanziDefinition, selected: boolean, material: boolean): void {
  const abilities = definition.combat.abilities;
  const style = ELEMENT_STYLES[tower.wuxing];
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, engine.state.region);
  const image = jaryeongSpriteImage(visual);
  const progressionRank = engine.state.mode === "casual" ? casualStarOf(tower) : tower.stage;
  const progressionColor = engine.state.mode === "casual" ? CASUAL_STAR_COLORS[casualStarOf(tower)] : STAGE_COLORS[tower.stage];
  const pulse = 1 + tower.pulse * 0.055;
  const auraRadius = 17 + (progressionRank - 1) * 0.45;

  context.save();
  context.translate(cell.x, cell.y + 15);
  context.scale(1, 0.32);
  const floorAura = context.createRadialGradient(0, 0, 3, 0, 0, auraRadius);
  floorAura.addColorStop(0, style.color + "8f");
  floorAura.addColorStop(0.58, style.color + "31");
  floorAura.addColorStop(1, style.color + "00");
  context.fillStyle = floorAura;
  context.shadowColor = material ? "#fff0b7" : style.glow;
  context.shadowBlur = material ? 15 : selected ? 11 : 6;
  context.beginPath();
  context.arc(0, 0, auraRadius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.strokeStyle = material ? "#fff0b7" : selected ? "#ffffff" : progressionColor;
  context.lineWidth = material || selected ? 3 : 1.5;
  context.shadowColor = material ? "#fff0b7" : style.glow;
  context.shadowBlur = material ? 12 : selected ? 9 : 4;
  context.beginPath();
  context.ellipse(cell.x, cell.y + 15, auraRadius, 6, 0, 0, Math.PI * 2);
  context.stroke();
  context.shadowBlur = 0;
  drawChargeRing({ x: cell.x, y: cell.y + 1 }, 20, tower, abilities);

  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const drawSize = (42 + Math.min(7, progressionRank)) * pulse;
    context.shadowColor = style.glow;
    context.shadowBlur = selected ? 13 : 5;
    if (jaryeongFrameLayout(visual) === "single") {
      context.drawImage(image, cell.x - drawSize / 2, cell.y - drawSize / 2 + 3, drawSize, drawSize);
    } else {
      const frame = tower.abilityFlash > 0.08 ? 2 : reducedMotion ? 0 : Math.floor((engine.state.elapsed + tower.id * 0.31) * 1.15) % 2;
      const frameWidth = image.naturalWidth / 2;
      const frameHeight = image.naturalHeight / 2;
      context.drawImage(
        image,
        frame % 2 * frameWidth,
        Math.floor(frame / 2) * frameHeight,
        frameWidth,
        frameHeight,
        cell.x - drawSize / 2,
        cell.y - drawSize / 2 + 3,
        drawSize,
        drawSize
      );
    }
    context.shadowBlur = 0;
  }

  pendingPlaques.push({ tower, cell, selected, material });
}

function drawTowerAbilityPopup(tower: Tower, cell: Point): void {
  const popup = towerAbilityPopups.get(tower.id);
  if (!popup) return;
  const ratio = Math.min(1, popup.age / popup.duration);
  const alpha = ratio < 0.18 ? ratio / 0.18 : 1 - (ratio - 0.18) / 0.82;
  const y = cell.y - 38 - ratio * 7;
  context.save();
  context.globalAlpha = Math.max(0, alpha);
  context.font = '900 9px "Malgun Gothic", sans-serif';
  const width = Math.min(96, Math.max(52, context.measureText(popup.text).width + 16));
  context.fillStyle = "rgba(3, 8, 15, 0.94)";
  context.strokeStyle = popup.color;
  context.lineWidth = 1.5;
  context.shadowColor = popup.color;
  context.shadowBlur = 10;
  context.beginPath();
  context.roundRect(cell.x - width / 2, y - 9, width, 18, 7);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(popup.text, cell.x, y + 1, width - 10);
  context.restore();
}

function drawTowerTierMarker(tower: Tower, cell: Point): void {
  const casual = engine.state.mode === "casual";
  const tier = casual
    ? casualStarOf(tower)
    : Math.max(1, Math.min(5, mapSynthesisDepths.get(tower.char) ?? 1)) as 1 | 2 | 3 | 4 | 5;
  const uncombinable = !casual && tier === 1 && mapUncombinableStageOne.has(tower.char);
  const color = casual ? CASUAL_STAR_COLORS[tier as CasualStar] : uncombinable ? UNCOMBINABLE_STAGE_ONE_COLOR : STAGE_COLORS[tier as 1 | 2 | 3 | 4 | 5];
  const stars = "★".repeat(tier);
  const y = cell.y + 19;
  context.save();
  context.fillStyle = "rgba(3, 8, 14, 0.96)";
  context.strokeStyle = color;
  context.lineWidth = 1.15;
  context.shadowColor = "rgba(0, 0, 0, 0.7)";
  context.shadowBlur = 4;
  context.beginPath();
  const width = Math.max(18, 6 + stars.length * 4.2);
  context.roundRect(cell.x - width / 2, y - 5, width, 10, 4);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 6px "Malgun Gothic", sans-serif';
  context.fillText(stars, cell.x, y + 0.3, width - 2);
  context.restore();
}

function drawSelectedTowerMarker(cell: Point): void {
  const left = cell.x - 25;
  const right = cell.x + 25;
  const top = cell.y - 27;
  const bottom = cell.y + 25;
  const corner = 8;
  context.save();
  context.fillStyle = "rgba(255, 211, 104, 0.1)";
  context.strokeStyle = "#2a1703";
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(cell.x, cell.y + 15, 24, 9, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.strokeStyle = "#fff3bd";
  context.lineWidth = 2.4;
  context.shadowColor = "#ffc95c";
  context.shadowBlur = 8;
  context.beginPath();
  context.ellipse(cell.x, cell.y + 15, 24, 9, 0, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(left + corner, top); context.lineTo(left, top); context.lineTo(left, top + corner);
  context.moveTo(right - corner, top); context.lineTo(right, top); context.lineTo(right, top + corner);
  context.moveTo(left, bottom - corner); context.lineTo(left, bottom); context.lineTo(left + corner, bottom);
  context.moveTo(right - corner, bottom); context.lineTo(right, bottom); context.lineTo(right, bottom - corner);
  context.stroke();
  context.restore();
}

function drawTower(tower: Tower, materialIds: ReadonlySet<number>): void {
  const cell = BOARD_CELLS[tower.cell] as Point;
  const definition = definitionForTower(engine.catalog, tower.definitionId);
  const selected = tower.id === engine.state.selectedTowerId;
  const material = materialIds.has(tower.id);
  context.save();
  if (displayMode === "study") drawStudyTower(tower, cell, definition, selected, material);
  else drawSpiritTower(tower, cell, definition, selected, material);
  if (selected) drawSelectedTowerMarker(cell);
  drawTowerTierMarker(tower, cell);
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  if ((tower.concentration ?? 0) > 0) {
    context.fillStyle = "rgba(6, 10, 17, 0.94)";
    context.strokeStyle = ELEMENT_STYLES[tower.wuxing].color;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(cell.x + 6, cell.y - 32, 18, 10, 4);
    context.fill();
    context.stroke();
    context.fillStyle = "#fff4cf";
    context.font = '900 6px "Malgun Gothic", serif';
    context.fillText(`濃${tower.concentration}`, cell.x + 15, cell.y - 24.5);
  }
  if (tower.locked) {
    const lockX = cell.x - 15;
    const lockY = cell.y + 17;
    context.fillStyle = "rgba(7, 12, 20, 0.92)";
    context.strokeStyle = "#ffd879";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(lockX, lockY, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#ffd879";
    context.font = '900 6px "Malgun Gothic", serif';
    context.fillText("鎖", lockX, lockY + 2);
  }
  drawTowerAbilityPopup(tower, cell);
  context.restore();
}

function canvasWrappedLines(textValue: string, maxWidth: number, maxLines: number): string[] {
  const words = textValue.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  while (words.length > 0 && lines.length < maxLines) {
    const word = words.shift() as string;
    const candidate = line ? `${line} ${word}` : word;
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length > 0 && lines.length > 0) {
    let last = lines.at(-1) as string;
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function drawHoveredTowerCard(): void {
  canvas.dataset.hoveredTowerMeaning = "";
  canvas.dataset.hoveredTowerPortrait = "";
  const tower = hoveredTowerId === null ? undefined : engine.state.towers.find((candidate) => candidate.id === hoveredTowerId);
  if (!tower || mapPanPointerId !== null || towerDragMoved) return;
  const cell = BOARD_CELLS[tower.cell] as Point;
  const point = { x: mapOffset.x + cell.x * mapZoom, y: mapOffset.y + cell.y * mapZoom };
  if (point.x < -24 || point.x > WORLD_WIDTH + 24 || point.y < -24 || point.y > WORLD_HEIGHT + 24) return;

  const definition = definitionForTower(engine.catalog, tower.definitionId);
  const style = ELEMENT_STYLES[tower.wuxing];
  const learning = learningInfo(engine.state.region, tower.char);
  const explanation = koreanMeaningExplanation(tower.char, learning.short, learning.meaning);
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, engine.state.region);
  const image = jaryeongSpriteImage(visual);
  // 큰 한자는 기존 글줄 상자를 좁히지 않고 오른쪽에 제 칸을 받는다.
  // 훈음은 "엄쪽(어음을 쪼갠 한 쪽) 권" 처럼 14자까지 오는데, 172px 상자를
  // 90px 로 줄이면 maxWidth 압축이 38% 까지 찌그러진다.
  const glyphColumn = hoverGlyphLarge ? 80 : 0;
  const width = 284 + glyphColumn;
  const height = 176;
  const x = point.x + 36 + width > WORLD_WIDTH - 10 ? point.x - width - 36 : point.x + 36;
  const y = Math.min(WORLD_HEIGHT - height - 18, Math.max(72, point.y - height / 2));
  const anchorX = x > point.x ? x : x + width;
  const anchorY = Math.min(y + height - 18, Math.max(y + 18, point.y));
  canvas.dataset.hoveredTowerMeaning = explanation.short;
  canvas.dataset.hoveredTowerPortrait = visual.id;

  context.save();
  context.strokeStyle = style.color + "bb";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(point.x, point.y - 14);
  context.lineTo(anchorX, anchorY);
  context.stroke();
  context.fillStyle = "rgba(4, 10, 18, 0.98)";
  context.strokeStyle = style.color;
  context.lineWidth = 2;
  context.shadowColor = "rgba(0, 0, 0, 0.58)";
  context.shadowBlur = 18;
  context.beginPath();
  context.roundRect(x, y, width, height, 12);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;

  // 우상단 사분면의 빈자리에 한자를 크게. 카드가 어두운 계열이라
  // 스펙의 먹/밝은획을 뒤집어 밝은 글자 + 어두운 아래획(양각)으로 그린다.
  // 세로로는 쉬운 뜻 구분선(y+98) 위에서 끝난다.
  if (hoverGlyphLarge) {
    const glyphX = x + width - glyphColumn / 2 - 6;
    const glyphY = y + 58;
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '900 60px "Batang", "Noto Sans CJK KR", serif';
    context.fillStyle = "rgba(2, 6, 12, 0.85)";
    context.fillText(tower.char, glyphX + 2, glyphY + 2, 72);
    context.fillStyle = "rgba(255, 247, 222, 0.92)";
    context.fillText(tower.char, glyphX, glyphY, 72);
    context.restore();
  }

  const portraitX = x + 10;
  const portraitY = y + 10;
  const portraitSize = 78;
  context.fillStyle = style.color + "20";
  context.beginPath();
  context.roundRect(portraitX, portraitY, portraitSize, portraitSize, 10);
  context.fill();
  context.strokeStyle = style.color + "88";
  context.lineWidth = 1;
  context.stroke();
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const single = jaryeongFrameLayout(visual) === "single";
    const sourceWidth = single ? image.naturalWidth : image.naturalWidth / 2;
    const sourceHeight = single ? image.naturalHeight : image.naturalHeight / 2;
    context.drawImage(image, 0, 0, sourceWidth, sourceHeight, portraitX + 3, portraitY + 3, portraitSize - 6, portraitSize - 6);
  } else {
    context.fillStyle = "#fff9e8";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '900 42px "Malgun Gothic", "Noto Sans CJK KR", serif';
    context.fillText(tower.char, portraitX + portraitSize / 2, portraitY + portraitSize / 2, portraitSize - 12);
  }

  context.fillStyle = "rgba(4, 10, 18, 0.94)";
  context.strokeStyle = style.color;
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(portraitX + portraitSize - 8, portraitY + portraitSize - 8, 13, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff6da";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 15px "Batang", "Malgun Gothic", serif';
  context.fillText(tower.char, portraitX + portraitSize - 8, portraitY + portraitSize - 7);

  const copyX = x + 100;
  const copyWidth = width - 112 - glyphColumn;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#f7edcf";
  context.font = '900 17px "Malgun Gothic", sans-serif';
  context.fillText(learning.short, copyX, y + 28, copyWidth);
  context.fillStyle = style.color;
  context.font = '900 12px "Malgun Gothic", sans-serif';
  context.fillText(`${style.name}행 · ${towerProgressionLabel(tower)}`, copyX, y + 50, copyWidth);
  context.fillStyle = "#b9c8d9";
  context.font = '800 11px "Malgun Gothic", sans-serif';
  context.fillText(definition.combat.effectLabel, copyX, y + 71, copyWidth);

  context.fillStyle = "rgba(218, 229, 241, 0.16)";
  context.fillRect(x + 10, y + 98, width - 20, 1);
  context.fillStyle = style.color;
  context.font = '950 11px "Malgun Gothic", sans-serif';
  context.fillText("쉬운 뜻", x + 12, y + 114);
  context.fillStyle = "#d8e2ed";
  // R7-25: 뜻 11 → 12px, 아래 조작 힌트 9 → 11px. 카드 안에서 가장 오래
  // 읽는 두 줄인데 바닥선 아래에 있었다.
  context.font = '800 12px "Malgun Gothic", sans-serif';
  const meaningLines = canvasWrappedLines(explanation.short, width - 24, 2);
  meaningLines.forEach((line, index) => context.fillText(line, x + 12, y + 131 + index * 14, width - 24));

  context.fillStyle = "rgba(218, 229, 241, 0.13)";
  context.fillRect(x + 10, y + 154, width - 20, 1);
  context.fillStyle = "#a8bcd2";
  context.font = '800 11px "Malgun Gothic", sans-serif';
  context.fillText("클릭: 선택 · 끌기: 교환 · 자세한 뜻은 자령 도감", x + 12, y + 169, width - 24);
  context.restore();
}
function drawEnemy(enemy: Enemy, point = positionOnPath(enemy.progress)): void {
  const colors: Record<Enemy["archetype"], string> = { normal: "#7770d9", swarm: "#bd78e8", swift: "#5bcde1", armored: "#b69b76", regenerator: "#64c489", boss: "#ff627d" };
  const color = colors[enemy.archetype];
  const weaknessColor = ELEMENT_STYLES[enemy.weakness].color;
  const visual = enemyJaryeongVisualFor(enemy.archetype, enemy.id + enemy.wave);
  // 적 전용 1×2 시트를 우선 쓰고, 로드 실패·크기 불일치일 때만 아군 자령 2×2 시트로
  // 되돌아간다. 둘 다 없으면 아래 원형+한자 폴백이 남는다.
  const sheetReady = isEnemySheetReady(enemy.archetype);
  const image = sheetReady ? enemySheetImage(enemy.archetype) : jaryeongSpriteImage(visual);
  const drawSize = enemy.boss ? 70 : enemy.archetype === "swarm" ? 32 : enemy.archetype === "armored" ? 46 : 40;
  // 스프라이트 프레임 위쪽 투명 여백을 보정해 HP 바를 그림 윗변에 붙인다.
  // 전용 시트는 아키타입별 실측 알파 bbox, 폴백은 기존 계수를 쓴다.
  const artTop = drawSize * (sheetReady ? enemyArtTopFactor(enemy.archetype) : FALLBACK_ART_TOP_FACTOR);
  const top = point.y - artTop;
  context.save();
  context.translate(point.x, point.y);
  if (enemy.boss) context.rotate(Math.sin(engine.state.elapsed * 2) * 0.025);

  // 적과 아군 자령은 같은 스프라이트 세트를 공유하므로, 그림 자체로는 구분되지
  // 않는다. 발밑 표식과 테두리 광원으로 위협을 알린다.
  //   아군: 제단 위 정갈한 타원 고리 + 오행 색 광원
  //   적  : 번진 먹자국 + 주홍 톱니 고리 + 붉은 테두리
  context.save();
  context.translate(0, drawSize * 0.31);
  context.scale(1, 0.3);
  const blot = context.createRadialGradient(0, 0, 1, 0, 0, drawSize * 0.46);
  blot.addColorStop(0, "rgba(14, 9, 7, 0.72)");
  blot.addColorStop(0.6, "rgba(20, 12, 9, 0.42)");
  blot.addColorStop(1, "rgba(20, 12, 9, 0)");
  context.fillStyle = blot;
  context.beginPath();
  context.arc(0, 0, drawSize * 0.46, 0, Math.PI * 2);
  context.fill();

  // 약점 오행은 톱니 고리의 색으로만 남긴다.
  const teeth = enemy.boss ? 14 : 9;
  const outer = drawSize * 0.42;
  const inner = drawSize * 0.32;
  context.beginPath();
  for (let index = 0; index < teeth * 2; index += 1) {
    const angle = (index / (teeth * 2)) * Math.PI * 2;
    const radius = index % 2 === 0 ? outer : inner;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.strokeStyle = weaknessColor + "b4";
  context.lineWidth = enemy.boss ? 3.4 : 2.4;
  context.shadowColor = weaknessColor;
  context.shadowBlur = enemy.boss ? 16 : 7;
  context.stroke();
  context.shadowBlur = 0;
  context.restore();

  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const frame = reducedMotion ? 0 : Math.floor((engine.state.elapsed * 2.2 + enemy.id * 0.37)) % 2;
    // 적 전용 시트는 1행 2열이라 세로를 자르지 않는다. 아군 폴백 시트만 2×2다.
    const frameWidth = sheetReady ? ENEMY_FRAME_SIZE : image.naturalWidth / 2;
    const frameHeight = sheetReady ? ENEMY_FRAME_SIZE : image.naturalHeight / 2;
    // 적대 윤곽은 진사(cinnabar) 계열 광원으로만 알린다. 원본을 재착색하지 않는다.
    context.shadowColor = enemy.boss ? "#c4392a" : "#9f2f23";
    context.shadowBlur = enemy.boss ? 16 : 8;
    context.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    context.shadowBlur = 0;

  } else {
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, drawSize * 0.28, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#071019";
    context.font = '900 ' + String(enemy.boss ? 24 : 15) + 'px "Malgun Gothic", serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(visual.hanja, 0, 1);
  }

  if (enemy.flash > 0) {
    const hitStrength = Math.min(1, enemy.flash / 0.09);
    context.globalAlpha = hitStrength * 0.85;
    context.strokeStyle = "#241d16";
    context.lineWidth = 3.4;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.arc(0, 0, drawSize * 0.36 + (1 - hitStrength) * 7, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    // 전장 전체 밝기 필터는 쓰지 않는다. 맞은 개체 가장자리만 짧게 밝힌다.
    context.globalAlpha = hitStrength * 0.5;
    context.strokeStyle = "#fff2d8";
    context.lineWidth = 1.6;
    context.beginPath();
    context.arc(0, 0, drawSize * 0.3, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  const statuses: Array<{ glyph: string; color: string }> = [];
  if (enemy.poisonUntil > engine.state.elapsed) statuses.push({ glyph: "毒", color: ELEMENT_STYLES.木.color });
  if (enemy.slowFactor < 1 && enemy.slowUntil > engine.state.elapsed) statuses.push({ glyph: "凍", color: ELEMENT_STYLES.水.color });
  if (enemy.stunnedUntil > engine.state.elapsed) statuses.push({ glyph: "封", color: ELEMENT_STYLES.土.color });
  if (enemy.armor >= 0.15) statuses.push({ glyph: "甲", color: ELEMENT_STYLES.金.color });
  for (let index = 0; index < statuses.length; index += 1) {
    const status = statuses[index] as { glyph: string; color: string };
    const x = (index - (statuses.length - 1) / 2) * 14;
    context.fillStyle = "rgba(6,10,17,0.88)";
    context.strokeStyle = status.color;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x, -artTop - 14, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = status.color;
    context.font = '900 10px "Malgun Gothic", serif';
    context.fillText(status.glyph, x, -artTop - 13);
  }
  context.restore();
  const width = enemy.boss ? 64 : Math.max(30, drawSize * 0.7);
  context.fillStyle = "rgba(6, 4, 3, 0.86)";
  context.fillRect(point.x - width / 2 - 1, top - 7, width + 2, 6);
  context.fillStyle = "rgba(10, 7, 5, 0.9)";
  context.fillRect(point.x - width / 2, top - 6, width, 4);
  context.fillStyle = enemy.poisonUntil > engine.state.elapsed ? "#62db8a" : color;
  context.fillRect(point.x - width / 2, top - 6, width * Math.max(0, enemy.hp / enemy.maxHp), 4);
  context.fillStyle = weaknessColor;
  context.font = '900 11px "Malgun Gothic", sans-serif';
  context.textAlign = "center";
  context.fillText(enemy.weakness, point.x, point.y + drawSize * 0.4 + 11);
}

function updateAndDrawFx(delta: number): void {
  for (const projectile of projectiles) projectile.age += delta;
  for (const floater of floaters) floater.age += delta;
  for (const ring of rings) ring.age += delta;
  for (let index = rasterBursts.length - 1; index >= 0; index -= 1) {
    const burst = rasterBursts[index] as RasterBurstFx;
    burst.age += delta;
    if (burst.age >= RASTER_BURST_LIFE) {
      rasterBursts.splice(index, 1);
      continue;
    }
    if (!isWorldPointVisible(burst.at, burst.size * 0.6)) continue;
    // reduced motion: 확대·회전 없이 0.25초 정지 후 페이드만.
    const scale = reducedMotion
      ? 1
      : burst.age < 0.12
        ? 0.72 + (burst.age / 0.12) * 0.33
        : burst.age < 0.52
          ? 1.05 - ((burst.age - 0.12) / 0.4) * 0.05
          : 1;
    const fadeFrom = reducedMotion ? 0.25 : 0.52;
    const alpha = burst.age < fadeFrom ? 1 : 1 - (burst.age - fadeFrom) / (RASTER_BURST_LIFE - fadeFrom);
    const drawn = burst.size * scale;
    context.save();
    context.globalAlpha = Math.max(0, alpha);
    context.drawImage(burst.image, burst.at.x - drawn / 2, burst.at.y - drawn / 2, drawn, drawn);
    context.restore();
  }
  for (const burst of abilityBursts) burst.age += delta;
  for (const ripple of idiomRipples) ripple.age += delta;
  if (idiomFlash) idiomFlash.age += delta;
  for (const popup of towerAbilityPopups.values()) popup.age += delta;
  let projectileSpriteDrawnThisFrame = false;
  for (const projectile of projectiles) {
    const ratio = Math.min(1, projectile.age / projectile.duration);
    const x = projectile.from.x + (projectile.to.x - projectile.from.x) * ratio;
    const y = projectile.from.y + (projectile.to.y - projectile.from.y) * ratio;
    if (!isWorldPointVisible({ x, y }, 32)) continue;
    const angle = Math.atan2(projectile.to.y - projectile.from.y, projectile.to.x - projectile.from.x);
    const image = elementProjectileImage(projectile.wuxing);
    const width = projectile.critical ? 54 : 42;
    const height = projectile.critical ? 31 : 24;
    context.save();
    context.globalAlpha = (1 - ratio * 0.32) * 0.95;
    context.strokeStyle = projectile.color;
    context.lineWidth = projectile.critical ? 3.6 : 2.4;
    context.shadowColor = projectile.color;
    context.shadowBlur = projectile.critical ? 12 : 7;
    context.beginPath();
    context.moveTo(projectile.from.x + (x - projectile.from.x) * 0.58, projectile.from.y + (y - projectile.from.y) * 0.58);
    context.lineTo(x, y);
    context.stroke();
    context.translate(x, y);
    context.rotate(angle);
    if (image.complete && image.naturalWidth > 0) {
      context.drawImage(image, -width / 2, -height / 2, width, height);
      projectileSpriteDrawTotal += 1;
      projectileSpriteDrawnThisFrame = true;
    }
    context.restore();
  }
  canvas.dataset.projectileSpriteDraw = String(projectileSpriteDrawnThisFrame);
  canvas.dataset.projectileSpriteDrawTotal = String(projectileSpriteDrawTotal);
  for (const ring of rings) {
    if (!isWorldPointVisible(ring.at, 90)) continue;
    const ratio = Math.min(1, ring.age / ring.duration);
    context.save();
    context.globalAlpha = 1 - ratio;
    context.strokeStyle = ring.color;
    context.lineWidth = 4 - ratio * 2;
    context.shadowColor = ring.color;
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(ring.at.x, ring.at.y, 18 + ratio * 58, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
  for (const burst of abilityBursts) {
    const ratio = Math.min(1, burst.age / burst.duration);
    const sourceBased = ["support", "coin", "resonance", "solo"].includes(burst.kind);
    const point = sourceBased ? burst.source : burst.at;
    if (!isWorldPointVisible(point, 64)) continue;
    context.save();
    context.globalAlpha = (1 - ratio) * 0.42;
    context.strokeStyle = burst.color;
    context.fillStyle = burst.color;
    context.lineWidth = burst.kind === "burst" || burst.kind === "critical" ? 2.4 : 1.4;
    context.setLineDash(burst.kind === "chain" || burst.kind === "lineage" ? [4, 7] : []);
    context.beginPath();
    context.ellipse(point.x, point.y + 8, 13 + ratio * 31, 5 + ratio * 11, 0, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    for (let mark = -1; mark <= 1; mark += 1) {
      const offset = mark * 10;
      context.beginPath();
      context.moveTo(point.x + offset - 5, point.y + 5 + ratio * 6);
      context.quadraticCurveTo(point.x + offset, point.y - 2 - ratio * 5, point.x + offset + 6, point.y + 4 + ratio * 5);
      context.stroke();
    }
    context.globalAlpha = (1 - ratio) * 0.68;
    context.font = '900 13px "Malgun Gothic", serif';
    context.textAlign = "center";
    context.fillText(burst.glyph, point.x, point.y - 12 - ratio * 8);
    context.restore();
  }
  for (const floater of floaters) {
    if (!isWorldPointVisible(floater.at, 60)) continue;
    const ratio = Math.min(1, floater.age / floater.duration);
    context.save();
    context.globalAlpha = 1 - ratio;
    context.fillStyle = floater.color;
    context.textAlign = "center";
    context.font = String(floater.large ? 900 : 800) + " " + String(floater.large ? 23 : 16) + "px sans-serif";
    context.shadowColor = "#050810";
    context.shadowBlur = 5;
    context.fillText(floater.text, floater.at.x, floater.at.y - 25 - ratio * 28);
    context.restore();
  }
  drawIdiomRipples();
  recycleExpired(projectiles, projectilePool, 48);
  recycleExpired(floaters, floaterPool, 48);
  recycleExpired(rings, ringPool, 32);
  recycleExpired(abilityBursts, abilityBurstPool, 12);
  for (const [towerId, popup] of towerAbilityPopups) {
    if (popup.age >= popup.duration || !engine.state.towers.some((tower) => tower.id === towerId)) towerAbilityPopups.delete(towerId);
  }
}

function recycleExpired<T extends { age: number; duration: number }>(items: T[], pool: T[], poolLimit: number): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item || item.age < item.duration) continue;
    const removed = item;
    const last = items.pop();
    if (index < items.length && last) items[index] = last;
    if (pool.length < poolLimit) pool.push(removed);
  }
}

function towerAtCell(cell: number): Tower | undefined {
  return engine.state.towers.find((tower) => tower.cell === cell);
}

function canvasScreenPoint(event: MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * WORLD_WIDTH / rect.width, y: (event.clientY - rect.top) * WORLD_HEIGHT / rect.height };
}

function canvasPoint(event: PointerEvent): Point {
  const point = canvasScreenPoint(event);
  return { x: (point.x - mapOffset.x) / mapZoom, y: (point.y - mapOffset.y) / mapZoom };
}

function constrainMapCamera(): void {
  const scaledWidth = WORLD_WIDTH * mapZoom;
  const scaledHeight = WORLD_HEIGHT * mapZoom;
  mapOffset = {
    x: scaledWidth <= WORLD_WIDTH
      ? (WORLD_WIDTH - scaledWidth) / 2
      : Math.min(0, Math.max(WORLD_WIDTH - scaledWidth, mapOffset.x)),
    y: scaledHeight <= WORLD_HEIGHT
      ? (WORLD_HEIGHT - scaledHeight) / 2
      : Math.min(0, Math.max(WORLD_HEIGHT - scaledHeight, mapOffset.y))
  };
  canvas.dataset.mapOffsetX = mapOffset.x.toFixed(1);
  canvas.dataset.mapOffsetY = mapOffset.y.toFixed(1);
}

function syncMapZoomControl(): void {
  const displayZoom = Math.round(mapZoom / BASE_MAP_ZOOM * 100);
  must<HTMLElement>("#map-zoom-value").textContent = `${displayZoom}%`;
  canvas.dataset.mapZoom = mapZoom.toFixed(2);
  canvas.dataset.mapZoomDisplay = String(displayZoom);
  canvas.dataset.mapOffsetX = mapOffset.x.toFixed(1);
  canvas.dataset.mapOffsetY = mapOffset.y.toFixed(1);
  // 84px compact 명패가 이웃과 4px 이상 떨어질 수 없는 배율에서만 한자만 남긴다.
  canvas.dataset.labelDensity = plaqueIsGlyphOnly() ? "glyph" : "reading";
  canvas.dataset.hanjaEmphasis = String(hanjaEmphasis);
}

function resetMapCamera(): void {
  mapZoom = DEFAULT_MAP_ZOOM;
  mapOffset = defaultMapOffset();
  constrainMapCamera();
  syncMapZoomControl();
}

function setMapZoom(nextZoom: number, anchor: Point = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }): void {
  const worldAtAnchor = {
    x: (anchor.x - mapOffset.x) / mapZoom,
    y: (anchor.y - mapOffset.y) / mapZoom
  };
  mapZoom = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, nextZoom));
  mapOffset = {
    x: anchor.x - worldAtAnchor.x * mapZoom,
    y: anchor.y - worldAtAnchor.y * mapZoom
  };
  constrainMapCamera();
  syncMapZoomControl();
}

function focusMapOnSelectedTower(): void {
  const tower = engine.selectedTower();
  const startingFormation = engine.state.startingFormationIndex === null
    ? undefined
    : BOARD_FORMATIONS[engine.state.startingFormationIndex];
  const cell = tower && tower.cell >= 0
    ? BOARD_CELLS[tower.cell]
    : engine.state.summonCount === 1 ? startingFormation?.center : undefined;
  if (!cell) return;
  mapOffset = {
    x: WORLD_WIDTH / 2 - cell.x * mapZoom,
    y: WORLD_HEIGHT / 2 - cell.y * mapZoom
  };
  constrainMapCamera();
  syncMapZoomControl();
}

/** 새로 열린 진으로 화면을 옮겨 "무엇이 열렸는지"를 눈으로 잇는다. */
function focusMapOnFormation(formationIndex: number): void {
  const center = BOARD_FORMATIONS[formationIndex]?.center;
  if (!center) return;
  mapOffset = {
    x: WORLD_WIDTH / 2 - center.x * mapZoom,
    y: WORLD_HEIGHT / 2 - center.y * mapZoom
  };
  constrainMapCamera();
  syncMapZoomControl();
}

function summonAndFocus(amount = 1, intent: SummonIntent = "balanced"): void {
  sound.unlock();
  const result = amount === 1 ? engine.summonProduct(intent) : engine.summonMany(amount);
  handleAction(result);
  if (result.ok) focusMapOnSelectedTower();
}

function setGameSpeed(speed: GameSpeed): void {
  gameSpeed = speed;
  const button = must<HTMLButtonElement>("#speed-button");
  button.textContent = `${speed}×`;
  button.setAttribute("aria-label", `게임 배속 ${speed}배`);
  button.classList.toggle("is-accelerated", speed > 1);
  shell.dataset.gameSpeed = String(speed);
}

function cycleGameSpeed(): void {
  setGameSpeed(gameSpeed === 1 ? 2 : gameSpeed === 2 ? 3 : 1);
}

function toggleHanjaEmphasis(): void {
  hanjaEmphasis = !hanjaEmphasis;
  const button = must<HTMLButtonElement>("#hanja-emphasis-toggle");
  button.classList.toggle("is-on", hanjaEmphasis);
  button.setAttribute("aria-pressed", String(hanjaEmphasis));
  must<HTMLElement>("#hanja-emphasis-toggle strong").textContent = hanjaEmphasis ? "ON" : "OFF";
  syncMapZoomControl();
  showToast(hanjaEmphasis ? "한자 강조 ON · 큰 한자와 훈독을 고정 크기로 표시" : "한자 강조 OFF · 머리 위 표찰 숨김 · 별 표시는 유지");
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
  if (index < 0 || engine.isFormationUnlocked(index)) return null;
  return index;
}

function beginMapPan(event: PointerEvent, button: 0 | 1, clickCell = -1): void {
  mapPanPointerId = event.pointerId;
  mapPanStartScreen = canvasScreenPoint(event);
  mapPanStartOffset = { ...mapOffset };
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
  if (engine.state.phase === "title" || engine.state.phase === "victory" || engine.state.phase === "defeat") return;
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
    engine.selectTower(occupant.id);
    towerDragPointerId = event.pointerId;
    towerDragTowerId = occupant.id;
    towerDragStart = point;
    towerDragMoved = false;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional; click selection still works without it.
    }
    evolutionRenderKey = "";
    selectedRenderKey = "";
    syncPanel();
  } else {
    // Empty board space keeps its ordinary click action, but becomes camera
    // panning once the pointer moves beyond the drag threshold.
    beginMapPan(event, 0, cell);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId === mapPanPointerId && mapPanStartScreen && mapPanStartOffset) {
    const point = canvasScreenPoint(event);
    const distance = Math.hypot(point.x - mapPanStartScreen.x, point.y - mapPanStartScreen.y);
    if (!mapPanMoved && distance >= 7) {
      mapPanMoved = true;
      mapCameraGestures += 1;
      canvas.classList.add("is-panning");
    }
    if (!mapPanMoved) return;
    mapOffset = {
      x: mapPanStartOffset.x + point.x - mapPanStartScreen.x,
      y: mapPanStartOffset.y + point.y - mapPanStartScreen.y
    };
    constrainMapCamera();
    return;
  }
  const hoverPoint = canvasPoint(event);
  const hoverCell = cellAtPoint(hoverPoint);
  hoveredTowerId = hoverCell >= 0 ? towerAtCell(hoverCell)?.id ?? null : null;
  canvas.dataset.hoveredTowerId = hoveredTowerId === null ? "" : String(hoveredTowerId);
  // 자물쇠 위에서는 확대하고 커서를 손가락으로 바꿔 "눌린다"를 알린다.
  // 잠긴 칸도 같은 팝업으로 이어지므로 커서는 같이 바꾼다.
  const runActive = engine.state.phase === "prep" || engine.state.phase === "combat";
  hoveredLockFormation = runActive ? lockedFormationAtPoint(hoverPoint) : null;
  const overLockedCell = runActive && hoverCell >= 0 && !engine.isCellUnlocked(hoverCell);
  canvas.dataset.lockHover = hoveredLockFormation !== null || overLockedCell ? "1" : "";
  if (event.pointerId !== towerDragPointerId || !towerDragStart) return;
  const point = canvasPoint(event);
  if (Math.hypot(point.x - towerDragStart.x, point.y - towerDragStart.y) >= 10) towerDragMoved = true;
});

function finishTowerDrag(event: PointerEvent, applyMove: boolean): void {
  if (event.pointerId !== towerDragPointerId) return;
  try {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  } catch {
    // The selected tower remains usable if capture was unavailable.
  }
  const draggedTowerId = towerDragTowerId;
  const moved = towerDragMoved;
  towerDragPointerId = null;
  towerDragTowerId = null;
  towerDragStart = null;
  towerDragMoved = false;
  if (!applyMove || !moved || draggedTowerId === null) return;
  const targetCell = cellAtPoint(canvasPoint(event));
  if (targetCell < 0) return;
  engine.selectTower(draggedTowerId);
  sound.expectPlacement();
  handleAction(engine.relocateSelectedToCell(targetCell));
}

function finishMapPan(event: PointerEvent, applyClick: boolean): boolean {
  if (event.pointerId !== mapPanPointerId) return false;
  try {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  } catch {
    // The camera remains at the last valid offset if capture was unavailable.
  }
  const button = mapPanButton;
  const moved = mapPanMoved;
  const clickCell = mapPanClickCell;
  mapPanPointerId = null;
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
      if (!engine.isCellUnlocked(clickCell)) openFormationUnlockDialog(Math.floor(clickCell / CELLS_PER_FORMATION));
      else { sound.expectPlacement(); handleAction(engine.moveSelectedToCell(clickCell)); }
    } else {
      const lockedFormation = lockedFormationAtPoint(canvasPoint(event));
      if (lockedFormation !== null) {
        openFormationUnlockDialog(lockedFormation);
      } else {
        engine.selectTower(null);
        evolutionRenderKey = "";
        selectedRenderKey = "";
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
  if (mapPanPointerId !== null || towerDragPointerId !== null) return;
  hoveredTowerId = null;
  canvas.dataset.hoveredTowerId = "";
  hoveredLockFormation = null;
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
  const before = mapZoom;
  setMapZoom(mapZoom * Math.exp(-event.deltaY * 0.0012), anchor);
  if (mapZoom !== before) mapCameraGestures += 1;
}, { passive: false });
must<HTMLButtonElement>("#map-zoom-reset").addEventListener("click", resetMapCamera);
must<HTMLButtonElement>("#hanja-emphasis-toggle").addEventListener("click", toggleHanjaEmphasis);
// 발동 성어 배지를 누르면 그 성어를 이룬 네 칸으로 카메라가 간다.
must<HTMLElement>("#active-idioms").addEventListener("click", (event) => {
  const idiomId = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-active-idiom]")?.dataset.activeIdiom;
  if (!idiomId) return;
  const seal = engine.state.idiomSeals.find((candidate) => candidate.idiomId === idiomId);
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
  pendingRegion = region;
  const info = REGION_MENU_INFO[region];
  must<HTMLElement>("#p00-title").textContent = `${info.name} 한자 체계`;
  must<HTMLButtonElement>("#p00-continue").textContent = `${info.name}으로 계속`;
  p00Dialog.showModal();
  must<HTMLButtonElement>("#p00-return").focus();
}

function closeP00(confirm: boolean): void {
  if (confirm && pendingRegion) selectedRegion = pendingRegion;
  pendingRegion = null;
  if (p00Dialog.open) p00Dialog.close();
  syncTitleModeSelection();
}

document.querySelectorAll<HTMLButtonElement>(".region-option").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    const region = button.dataset.region as RegionCode;
    // JP/CN 은 pending 만 두고 P00 확인을 거친다. 취소하면 기존 선택이 유지된다.
    if (region === "KR") {
      selectedRegion = "KR";
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
  if (!formation || engine.isFormationUnlocked(formationIndex)) return;
  pendingFormationUnlock = formationIndex;
  const cost = engine.nextFormationUnlockCost();
  const notStarted = engine.state.startingFormationIndex === null;
  const shortfall = cost === null ? 0 : Math.max(0, cost - engine.state.gold);
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
  const result = engine.unlockFormation(formationIndex);
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
    button.classList.toggle("is-selected", region === selectedRegion);
    button.setAttribute("aria-checked", String(region === selectedRegion));
    button.title = REGION_MENU_INFO[region].pool;
  });
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-display]").forEach((button) => {
    const selected = button.dataset.s13Display === displayMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-mode]").forEach((button) => {
    const selected = button.dataset.s13Mode === selectedGameMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  const emphasisButton = must<HTMLButtonElement>("#s13-emphasis");
  emphasisButton.setAttribute("aria-pressed", String(hanjaEmphasis));
  must<HTMLElement>("#s13-emphasis .s13-state").textContent = hanjaEmphasis ? "ON" : "OFF";
  emphasisButton.classList.toggle("is-on", hanjaEmphasis);
  const hoverGlyphButton = must<HTMLButtonElement>("#s13-hover-glyph");
  hoverGlyphButton.setAttribute("aria-pressed", String(hoverGlyphLarge));
  must<HTMLElement>("#s13-hover-glyph .s13-state").textContent = hoverGlyphLarge ? "ON" : "OFF";
  hoverGlyphButton.classList.toggle("is-on", hoverGlyphLarge);
  const autoButton = must<HTMLButtonElement>("#s13-autoplace");
  autoButton.setAttribute("aria-pressed", String(engine.state.autoPlaceSummons));
  must<HTMLElement>("#s13-autoplace .s13-state").textContent = engine.state.autoPlaceSummons ? "ON" : "OFF";
  autoButton.classList.toggle("is-on", engine.state.autoPlaceSummons);
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
      selectedRegion = "KR";
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
    setHoverGlyphLarge(!hoverGlyphLarge);
    sound.playUiConfirm();
    syncS13();
    return;
  }
  if (target.closest("#s13-autoplace")) {
    sound.unlock();
    const enabled = !engine.state.autoPlaceSummons;
    saveAutoPlaceSummons(enabled);
    handleAction(engine.setAutoPlaceSummons(enabled));
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
  button.addEventListener("click", () => handleAction(engine.setAutomationMode(button.dataset.mode as AutomationMode)));
});

must<HTMLElement>("#evolution-options").addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const casualTowerButton = target.closest<HTMLButtonElement>("[data-casual-fusion-tower]");
  if (casualTowerButton) {
    const id = Number(casualTowerButton.dataset.casualFusionTower);
    if (!Number.isInteger(id)) return;
    const index = casualFusionSelection.indexOf(id);
    if (index >= 0) {
      casualFusionSelection = casualFusionSelection.filter((towerId) => towerId !== id);
    } else {
      const tower = [...engine.state.towers, ...engine.state.inventoryTowers].find((candidate) => candidate.id === id);
      const anchor = [...engine.state.towers, ...engine.state.inventoryTowers].find((candidate) => candidate.id === casualFusionSelection[0]);
      if (!tower || casualFusionSelection.length >= 3) return;
      // v3: 보호 자령은 첫 슬롯부터 소모 대상이 될 수 없다. 모달까지 가서야
      // 알게 되는 일이 없도록 그 자리에서 사유를 말한다.
      const protection = engine.casualMaterialProtection(tower.id);
      if (protection) {
        showToast(`${tower.char}은 소모할 수 없습니다 · ${protection}`, true);
        return;
      }
      if (anchor && (tower.wuxing !== anchor.wuxing || casualStarOf(tower) !== casualStarOf(anchor))) {
        showToast(`같은 ${anchor.wuxing}행 ${casualStarOf(anchor)}★ 자령을 선택하세요.`, true);
        return;
      }
      casualFusionSelection.push(id);
    }
    evolutionRenderKey = "";
    renderCasualFusion();
    return;
  }
  const slot = target.closest<HTMLButtonElement>("[data-casual-fusion-slot]");
  if (slot) {
    const index = Number(slot.dataset.casualFusionSlot);
    casualFusionSelection = casualFusionSelection.filter((_, itemIndex) => itemIndex !== index);
    evolutionRenderKey = "";
    renderCasualFusion();
    return;
  }
  if (target.closest("#casual-fusion-review")) {
    openCasualManualReview();
    return;
  }
  const groupButton = target.closest<HTMLButtonElement>("[data-casual-group]");
  if (groupButton?.dataset.casualGroup) {
    const [wuxing, star] = groupButton.dataset.casualGroup.split(":");
    if (wuxing) runCasualAutoFusion(wuxing as Wuxing, Number(star) as CasualStar);
    return;
  }
  if (target.closest("#casual-goto-shop")) {
    setPanelTab("shop");
    return;
  }
  const button = target.closest<HTMLButtonElement>("[data-recipe]");
  if (button?.dataset.recipe) handleAction(engine.evolve(button.dataset.recipe));
});
must<HTMLElement>("#evolution-options").addEventListener("toggle", (event) => {
  const details = event.target as HTMLElement;
  if (details instanceof HTMLDetailsElement && details.id === "casual-manual-details") casualManualOpen = details.open;
}, true);
must<HTMLButtonElement>("#casual-fuse-all").addEventListener("click", () => runCasualAutoFusion("all", null));
must<HTMLElement>("#evolution-options").addEventListener("pointerover", (event) => {
  hoveredRecipeId = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-recipe]")?.dataset.recipe ?? null;
});
must<HTMLElement>("#evolution-options").addEventListener("pointerout", (event) => {
  const related = event.relatedTarget as Node | null;
  if (!related || !must<HTMLElement>("#evolution-options").contains(related)) hoveredRecipeId = null;
});

must<HTMLButtonElement>("#start-button").addEventListener("click", () => startRun(false));
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
// 카드가 곧 상품이다. 목적 상태를 미리 고르는 단계 없이 누른 카드로 즉시 1회 소환한다.
must<HTMLElement>("#summon-shop").addEventListener("click", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-summon-product]");
  if (!card || card.disabled) return;
  const product = card.dataset.summonProduct ?? "balanced";
  if (product === "multi") summonAndFocus(10);
  else summonAndFocus(1, product as SummonIntent);
});
must<HTMLButtonElement>("#summon-reveal-close").addEventListener("click", hideSummonReveal);
document.addEventListener("pointerdown", () => {
  if (summonReveal.classList.contains("is-active")) hideSummonReveal();
});
must<HTMLButtonElement>("#evolve-button").addEventListener("click", () => setPanelTab("evolution"));
must<HTMLButtonElement>("#research-button").addEventListener("click", () => { sound.unlock(); handleAction(engine.upgradeResearch()); });
must<HTMLElement>("#formation-unlock-list").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-formation-index]");
  if (!button) return;
  sound.unlock();
  // 상점 5칸과 전장 자물쇠는 같은 확인 팝업을 거친다.
  openFormationUnlockDialog(Number(button.dataset.formationIndex));
});
must<HTMLButtonElement>("#auto-arrange-button").addEventListener("click", () => { sound.unlock(); handleAction(engine.autoArrangeTowers()); });
must<HTMLButtonElement>("#element-upgrade-button").addEventListener("click", () => setPanelTab("growth"));

// 집중 프레임 여닫기 — dim 클릭 · [닫기] · Esc. 게임은 멈추지 않는다.
must<HTMLElement>("#focus-dim").addEventListener("click", () => setFocusFrame(null));
document.querySelectorAll<HTMLButtonElement>("[data-focus-close]").forEach((button) => {
  button.addEventListener("click", () => setFocusFrame(null));
});
must<HTMLButtonElement>("#growth-frame-open").addEventListener("click", () => setFocusFrame("growth"));
must<HTMLButtonElement>("#concentration-frame-open").addEventListener("click", () => setFocusFrame("concentration"));
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || openFocusFrame === null) return;
  if (helpDialog.open || settingsDialog.open || elementUpgradeDialog.open || abilityGuideDialog.open || casualFusionConfirmDialog.open || codexDialog.open) return;
  event.preventDefault();
  setFocusFrame(null);
});
must<HTMLButtonElement>("#element-upgrade-close").addEventListener("click", () => elementUpgradeDialog.close());
must<HTMLButtonElement>("#ability-guide-close").addEventListener("click", () => abilityGuideDialog.close());
must<HTMLButtonElement>("#casual-fusion-confirm-close").addEventListener("click", closeCasualFusionReview);
must<HTMLButtonElement>("#casual-fusion-cancel").addEventListener("click", closeCasualFusionReview);
must<HTMLButtonElement>("#casual-fusion-execute").addEventListener("click", () => {
  const pending = pendingCasualFusion;
  if (!pending) return;
  sound.unlock();
  const result = engine.fuseCasual(pending.materialIds, true);
  if (result.ok) casualFusionSelection = [];
  closeCasualFusionReview();
  evolutionRenderKey = "";
  handleAction(result);
  if (result.ok) setPanelTab("evolution");
});
elementUpgradeDialog.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-upgrade-scope][data-upgrade-stat]");
  const stat = button?.dataset.upgradeStat as UpgradeStat | undefined;
  const scope = button?.dataset.upgradeScope;
  if (!button || !stat || (scope !== "global" && scope !== "element")) return;
  sound.unlock();
  if (scope === "global") handleAction(engine.upgradeGlobal(stat));
  else {
    const wuxing = button.dataset.upgradeElement as Wuxing | undefined;
    if (!wuxing) return;
    handleAction(engine.upgradeElement(wuxing, stat));
  }
  renderElementUpgrades();
});
must<HTMLButtonElement>("#early-button").addEventListener("click", () => {
  sound.unlock();
  hideEarlyHint();
  const bonus = Math.floor(engine.state.prepRemaining / 2);
  const result = engine.startWaveEarly();
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
must<HTMLButtonElement>("#help-button").addEventListener("click", () => helpDialog.showModal());
must<HTMLButtonElement>("#title-help-button").addEventListener("click", () => helpDialog.showModal());
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

must<HTMLButtonElement>("#composition-drawer-close").addEventListener("click", closeCompositionDrawer);
must<HTMLElement>("#composition-branches").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-composition-recipe]");
  const recipeId = button?.dataset.compositionRecipe;
  if (!recipeId) return;
  const branch = engine.compositionBranchesForSelected().find((candidate) => candidate.recipeId === recipeId);
  if (!branch?.ready) {
    const missing = branch?.materials.filter((material) => material.towerId === null).map((material) => material.char).join("·") || "재료";
    showToast(`${missing} 재료가 부족합니다.`);
    return;
  }
  setCompositionMaterialHighlight();
  handleAction(engine.evolve(recipeId));
});
must<HTMLElement>("#composition-branches").addEventListener("pointerover", (event) => {
  const recipeId = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-composition-recipe]")?.dataset.compositionRecipe;
  if (!recipeId) return;
  const branch = engine.compositionBranchesForSelected().find((candidate) => candidate.recipeId === recipeId);
  setCompositionMaterialHighlight(
    branch?.materials.filter((material) => material.location === "board" && material.towerId !== null).map((material) => material.towerId as number) ?? []
  );
});
must<HTMLElement>("#composition-branches").addEventListener("pointerout", (event) => {
  const related = event.relatedTarget as HTMLElement | null;
  if (!related?.closest("[data-composition-recipe]")) setCompositionMaterialHighlight();
});
must<HTMLElement>("#composition-branches").addEventListener("pointerleave", () => setCompositionMaterialHighlight());
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
  setHoverGlyphLarge(!hoverGlyphLarge);
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
  const enabled = !engine.state.autoPlaceSummons;
  saveAutoPlaceSummons(enabled);
  handleAction(engine.setAutoPlaceSummons(enabled));
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

/*
 * 바깥 클릭으로 닫기.
 *
 * P00·S13 은 진작 되는데 도감·설정·도움말만 안 돼서, 창을 닫으려고
 * 바깥을 눌렀다가 아무 반응이 없으면 갇힌 것처럼 읽혔다. 같은 규칙으로
 * 맞춘다 — 배경(백드롭)을 누르면 event.target 이 dialog 자신이 된다.
 */
for (const dialog of [codexDialog, settingsDialog, helpDialog]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}
document.querySelectorAll<HTMLButtonElement>(".panel-tabs [data-panel-tab]").forEach((button) => {
  button.addEventListener("click", () => setPanelTab(button.dataset.panelTab as PanelTab));
});
document.querySelectorAll<HTMLButtonElement>("[data-goal-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    goalPanelMode = button.dataset.goalMode as GoalPanelMode;
    goalSearchQuery = "";
    must<HTMLInputElement>("#goal-search").value = "";
    goalRenderKey = "";
    renderGoal();
  });
});
must<HTMLInputElement>("#goal-search").addEventListener("input", (event) => {
  goalSearchQuery = (event.target as HTMLInputElement).value;
  goalRenderKey = "";
  renderGoal();
});
must<HTMLElement>("#goal-selector-list").addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const char = target.closest<HTMLButtonElement>("[data-goal-char]")?.dataset.goalChar;
  const idiomId = target.closest<HTMLButtonElement>("[data-goal-idiom]")?.dataset.goalIdiom;
  if (char) {
    handleAction(engine.setTarget(char));
    setPanelTab("goal");
  } else if (idiomId) {
    handleAction(engine.setIdiomTarget(idiomId));
    setPanelTab("goal");
  }
});
must<HTMLElement>("#run-inventory-list").addEventListener("click", (event) => {
  const id = Number((event.target as HTMLElement).closest<HTMLButtonElement>("[data-run-inventory-id]")?.dataset.runInventoryId);
  if (!Number.isInteger(id)) return;
  engine.selectTower(id);
  selectedRenderKey = "";
  runInventoryRenderKey = "";
  showToast("배치할 자령을 선택했습니다. 빈 칸은 배치, 찬 칸은 원자 교체합니다.");
  syncPanel();
});
must<HTMLButtonElement>("#cleanup-recommended-button").addEventListener("click", () => {
  const candidates = engine.cleanupCandidates(8, true);
  if (candidates.length === 0) return;
  dismantleSelection.clear();
  for (const candidate of candidates) dismantleSelection.add(candidate.towerId);
  growthRenderKey = "";
  setPanelTab("growth");
});

must<HTMLElement>("#concentration-layout").addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const targetId = Number(target.closest<HTMLButtonElement>("[data-concentration-target]")?.dataset.concentrationTarget);
  if (Number.isInteger(targetId)) {
    concentrationTargetId = targetId;
    engine.selectTower(targetId);
    concentrationPayment = "essence";
    concentrationRenderKey = "";
    renderConcentration();
    return;
  }
  const path = target.closest<HTMLButtonElement>("[data-concentration-path]")?.dataset.concentrationPath as ConcentrationPath | undefined;
  if (path) {
    concentrationPath = path;
    concentrationPayment = "essence";
    concentrationRenderKey = "";
    renderConcentration();
    return;
  }
  if (!target.closest("#concentration-confirm-button") || concentrationTargetId === null) return;
  const selected = engine.selectedTower();
  if (!selected || selected.id !== concentrationTargetId) return;
  if (!selected.concentrationPath) {
    const label = concentrationPath === "swift" ? "연속 농축" : "심화 농축";
    if (!window.confirm(`${selected.char}의 분기를 ${label}으로 고정할까요? 이후 분기 변경과 재설정은 불가능합니다.`)) return;
  }
  const payment = concentrationPayment === "essence"
    ? { kind: "essence" as const }
    : { kind: "duplicate" as const, towerId: concentrationPayment };
  handleAction(engine.concentrateTower(concentrationTargetId, concentrationPath, payment));
});
must<HTMLElement>("#concentration-layout").addEventListener("change", (event) => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[name="concentration-payment"]');
  if (!input) return;
  concentrationPayment = input.value === "essence" ? "essence" : Number(input.value);
  concentrationRenderKey = "";
  renderConcentration();
});

for (const selector of ["#dismantle-element-filter", "#dismantle-stage-filter", "#dismantle-status-filter"] as const) {
  must<HTMLSelectElement>(selector).addEventListener("change", () => {
    growthRenderKey = "";
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
  growthRenderKey = "";
  renderGrowth();
});
must<HTMLButtonElement>("#dismantle-recommend-button").addEventListener("click", () => {
  dismantleSelection.clear();
  const visibleEligible = [...must<HTMLElement>("#growth-dismantle-list").querySelectorAll<HTMLInputElement>("[data-dismantle-id]:not(:disabled)")];
  for (const input of visibleEligible.slice(0, 12)) dismantleSelection.add(Number(input.dataset.dismantleId));
  growthRenderKey = "";
  renderGrowth();
});
must<HTMLButtonElement>("#dismantle-clear-button").addEventListener("click", () => {
  dismantleSelection.clear();
  growthRenderKey = "";
  renderGrowth();
});
must<HTMLButtonElement>("#dismantle-confirm-button").addEventListener("click", () => {
  const quote = engine.quoteDismantle([...dismantleSelection]);
  if (quote.ids.length === 0 || quote.blocked.length > 0) return;
  const towers = quote.ids.map((id) => engine.state.inventoryTowers.find((tower) => tower.id === id)).filter((tower): tower is Tower => Boolean(tower));
  const towerLabel = towers.map((tower) => `${tower.char}(${tower.wuxing} ${towerProgressionLabel(tower)})`).join(" · ");
  const gainLabel = (Object.entries(quote.gains) as Array<[Wuxing, number]>).filter(([, amount]) => amount > 0).map(([wuxing, amount]) => `${wuxing}+${amount}`).join(" · ");
  if (!window.confirm(`${towers.length}기를 한 번에 분해합니다.\n${towerLabel}\n획득: ${gainLabel}`)) return;
  const result = engine.dismantleTowers(quote.ids);
  if (result.ok) dismantleSelection.clear();
  handleAction(result);
});
must<HTMLElement>("#growth-element-tabs").addEventListener("click", (event) => {
  const wuxing = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-growth-element]")?.dataset.growthElement as Wuxing | undefined;
  if (!wuxing) return;
  growthElement = wuxing;
  growthRenderKey = "";
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
    ? engine.quoteGlobalUpgrade(stat, amount)
    : scope === "element" && stat
      ? engine.quoteElementUpgrade(growthElement, stat, amount)
      : engine.quoteElementTraitUpgrade(growthElement, traitIndex, amount);
  if (amount === "max" && !window.confirm(`실제 누적 비용 ${quote.cost}을 사용해 ${quote.levels}단계 강화할까요? (${quote.fromLevel} → ${quote.toLevel})`)) return;
  const result = scope === "global" && stat
    ? engine.upgradeGlobal(stat, amount)
    : scope === "element" && stat
      ? engine.upgradeElement(growthElement, stat, amount)
      : engine.upgradeElementTrait(growthElement, traitIndex, amount);
  handleAction(result);
});
document.querySelectorAll<HTMLButtonElement>("[data-codex-mode]").forEach((button) => {
  button.addEventListener("click", () => setCodexMode(button.dataset.codexMode as CodexMode));
});
must<HTMLInputElement>("#codex-search").addEventListener("input", (event) => renderCodex((event.target as HTMLInputElement).value));
must<HTMLElement>("#codex-synthesis-filters").addEventListener("click", (event) => {
  const jaryeongFilterValue = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-jaryeong-filter]")?.dataset.jaryeongFilter;
  if (jaryeongFilterValue) {
    jaryeongDexFilter = jaryeongFilterValue as JaryeongDexFilter;
    renderCodex(must<HTMLInputElement>("#codex-search").value);
    return;
  }
  const value = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-synthesis-depth]")?.dataset.synthesisDepth;
  if (!value) return;
  codexSynthesisDepth = value === "all" || value === UNCOMBINABLE_STAGE_ONE ? value : Number(value);
  renderCodex(must<HTMLInputElement>("#codex-search").value);
});
must<HTMLElement>("#codex-list").addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const char = target.closest<HTMLButtonElement>("[data-codex-char]")?.dataset.codexChar
    ?? target.closest<HTMLButtonElement>("[data-codex-recipe]")?.dataset.codexRecipe;
  const idiomId = target.closest<HTMLButtonElement>("[data-codex-idiom]")?.dataset.codexIdiom;
  if (char) {
    selectedCodexChar = char;
    document.querySelectorAll<HTMLButtonElement>("[data-codex-char], [data-codex-recipe]").forEach((button) => {
      const buttonChar = button.dataset.codexChar ?? button.dataset.codexRecipe;
      const selected = buttonChar === char;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-current", String(selected));
    });
    renderCodexDetail(engine.catalog.definitions.get(char));
  }
  else if (idiomId) {
    // 한자 카드와 같은 패턴으로 선택 표시를 준다 — 누른 카드가 어느
    // 것인지 상세만 보고 되짚어야 했다.
    selectedCodexIdiomId = idiomId;
    document.querySelectorAll<HTMLButtonElement>("[data-codex-idiom]").forEach((button) => {
      const selected = button.dataset.codexIdiom === idiomId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-current", String(selected));
    });
    renderIdiomCodexDetail(engine.allIdioms().find((idiom) => idiom.id === idiomId));
  }
});
must<HTMLElement>("#codex-detail").addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const targetChar = target.closest<HTMLButtonElement>("[data-target-char]")?.dataset.targetChar;
  if (targetChar) {
    handleAction(engine.setTarget(targetChar));
    codexDialog.close();
    return;
  }
  const codexChar = target.closest<HTMLButtonElement>("[data-codex-char]")?.dataset.codexChar;
  if (codexChar) {
    selectedCodexChar = codexChar;
    document.querySelectorAll<HTMLButtonElement>("[data-codex-char], [data-codex-recipe]").forEach((button) => {
      const buttonChar = button.dataset.codexChar ?? button.dataset.codexRecipe;
      const selected = buttonChar === codexChar;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-current", String(selected));
    });
    renderCodexDetail(engine.catalog.definitions.get(codexChar));
    must<HTMLElement>("#codex-detail").scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }
});
must<HTMLButtonElement>("#sound-button").addEventListener("click", () => {
  const muted = sound.toggle();
  syncAudioControls();
  if (!muted) sound.playUiConfirm();
  showToast(muted ? "전체 소리 꺼짐" : "전체 소리 켜짐");
});
must<HTMLElement>("#selected-card").addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const abilityId = target.closest<HTMLButtonElement>("[data-ability-id]")?.dataset.abilityId;
  if (abilityId) openAbilityGuide(abilityId);
  else if (target.closest("[data-ability-guide]")) openAbilityGuide();
  else if (target.closest("#derivative-button")) {
    if (engine.state.mode === "casual") {
      const selected = engine.selectedTower();
      const selectable = selected !== undefined
        && casualStarOf(selected) < 8
        && engine.casualMaterialProtection(selected.id) === null;
      casualFusionSelection = selectable && selected ? [selected.id] : [];
      evolutionRenderKey = "";
      setPanelTab("evolution");
    } else openCompositionDrawer();
  }
  else if (target.closest("#lock-button")) handleAction(engine.toggleSelectedLock());
  else if (target.closest("#store-button")) {
    const result = engine.storeSelectedTower();
    if (result.ok) setPanelTab("inventory");
    handleAction(result);
  }
  else if (target.closest("#sell-button")) handleAction(engine.sellSelected());
  else if (target.closest("#open-growth-button")) {
    growthElement = engine.selectedTower()?.wuxing ?? growthElement;
    setPanelTab("growth");
  }
  else if (target.closest("#open-concentration-button")) {
    concentrationTargetId = engine.selectedTower()?.id ?? null;
    setPanelTab("concentration");
  }
});

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || helpDialog.open || settingsDialog.open || elementUpgradeDialog.open || abilityGuideDialog.open || casualFusionConfirmDialog.open || codexDialog.open) return;
  if (event.code === "Digit1") summonAndFocus();
  else if (event.code === "KeyQ") summonAndFocus(10);
  else if (event.code === "Digit2") {
    if (engine.state.mode === "casual") setPanelTab("evolution");
    else {
      const option = engine.availableEvolutions()[0];
      handleAction(option ? engine.evolve(option.recipeId) : { ok: false, message: "현재 가능한 합성이 없습니다." });
    }
  } else if (event.code === "Digit3") handleAction(engine.upgradeResearch());
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

/*
 * 일시정지.
 *
 * 도감·도움말·설정·S13 을 열어 두고 규칙을 읽는 동안에도 전투가 계속
 * 굴러가서, 창을 닫으면 진법이 이미 무너져 있었다. 모달이 열려 있으면
 * `engine.update` 만 건너뛰고 렌더 루프는 그대로 돌린다 — 화면이 얼어붙는
 * 대신 "멈춰 있다"가 그대로 보인다. P 키는 수동 토글이며 같은 칩을 쓴다.
 * 종료 화면은 이미 정지 상태라 무관하다.
 */
let manualPause = false;

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
  if (engine.state.phase !== "prep" && engine.state.phase !== "combat") return;
  manualPause = !manualPause;
  showToast(manualPause ? "일시정지 — P 키로 계속합니다." : "다시 진행합니다.");
}

function frame(now: number): void {
  const frameWorkStartedAt = performance.now();
  const delta = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  const running = engine.state.phase === "prep" || engine.state.phase === "combat";
  const paused = running && (manualPause || modalPauseActive());
  const simulationDelta = paused ? 0 : delta * gameSpeed;
  lastFrame = now;
  syncPauseChip(paused, manualPause);
  if (!paused) engine.update(simulationDelta);
  const audioPlan = engine.getCurrentPlan();
  sound.syncBgm({
    phase: engine.state.phase,
    wave: engine.state.wave,
    boss: engine.state.phase === "combat" && Boolean(audioPlan?.boss)
  }, now);
  const audioDebug = sound.getDebugState();
  shell.dataset.audioBgm = audioDebug.targetBgmId ?? "none";
  shell.dataset.audioPlaying = String(audioDebug.bgmPlaying);
  const frameEvents = engine.consumeEvents();
  const waveStartedThisFrame = frameEvents.some((event) => event.type === "wave");
  for (const event of frameEvents) processEvent(event);
  const summonEvents = frameEvents.filter((event): event is Extract<GameEvent, { type: "summon" }> => event.type === "summon");
  if (summonEvents.length > 0) showSummonReveal(summonEvents);
  else showCasualFusionReveal(frameEvents.filter((event): event is Extract<GameEvent, { type: "casualFuse" }> => event.type === "casualFuse"));
  if (engine.state.phase !== previousPhase) {
    previousPhase = engine.state.phase;
    if (previousPhase === "victory" || previousPhase === "defeat") showEndScreen(previousPhase);
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
    satisfied: () => engine.state.summonCount >= 1
  },
  {
    target: "#battle-canvas",
    title: "전장을 살펴보세요",
    body: "휠을 굴려 확대·축소하고, 빈 곳을 끌어 화면을 옮깁니다. 자령을 끌면 자리를 맞바꿉니다.",
    control: "wheel",
    // 설계 의도대로 "실제로 해내면 넘어간다" — 확대·축소 1회 또는 팬 1회.
    satisfied: () => mapCameraGestures > coachGestureBaseline
  },
  {
    target: "#early-button",
    title: "준비되면 웨이브를 시작합니다",
    body: "즉시 시작하면 남은 준비 시간만큼 엽전을 더 받습니다.",
    control: "click",
    satisfied: () => engine.state.wave >= 1,
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
  coachGestureBaseline = mapCameraGestures;
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
if (new URLSearchParams(window.location.search).get("menu3d") !== "0") {
  const stage = document.querySelector<HTMLElement>(".s00-stage");
  if (stage) {
    stage.classList.add("is-3d");
    void import("./ui/menu3d")
      .then(({ startMenu3d }) => {
        const handle = startMenu3d(stage);
        must<HTMLButtonElement>("#start-button").addEventListener("click", () => handle.dispose(), { once: true });
      })
      .catch(() => {
        stage.classList.remove("is-3d");
      });
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
for (const path of ["/assets/ui/main-menu-b/ui/p00-scroll-frame-v1.png"]) {
  const warm = new Image();
  warm.decoding = "async";
  warm.src = path;
}

syncMapZoomControl();
setGameSpeed(1);
setDisplayMode(initialDisplayMode, false);
syncTitleModeSelection();
syncAudioControls();
drawWorld(0);
syncPanel();
window.requestAnimationFrame(frame);
