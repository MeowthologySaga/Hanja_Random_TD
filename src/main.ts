import "./styles.css";
import {
  BOARD_CELLS,
  BOARD_FORMATIONS,
  ENEMY_PATH_POINTS,
  ENEMY_SPAWN_PROGRESS,
  MAX_ENEMIES,
  WAVE_REINFORCEMENT_DELAY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  bossTimeLimitForWave,
  positionOnPath,
  wavePlan
} from "./core/content";
import {
  GameEngine,
  MAX_CONCENTRATION_LEVEL,
  concentrationEssenceCost,
  dismantleEssenceValue,
  interestForGold
} from "./core/game";
import { idiomById } from "./core/idioms";
import { enemyJaryeongVisualFor, jaryeongVisualFor } from "./core/jaryeongs";
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
  researchCost,
  sellValue,
  summonCost
} from "./core/hanzi";
import { createRunSeed } from "./core/rng";
import type {
  ActionResult,
  AbilityFxKind,
  AbilitySpec,
  AutomationMode,
  CompositionBranchPreview,
  ConcentrationPath,
  Enemy,
  EvolutionOption,
  GameEvent,
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
import { loadDisplayMode, saveDisplayMode, type DisplayMode } from "./ui/display-mode";
import { jaryeongSpriteImage } from "./ui/jaryeong-sprites";
import { loadAutoPlaceSummons, saveAutoPlaceSummons } from "./ui/summon-placement";
import {
  inventoryEntriesForRegion,
  loadJaryeongInventory,
  recordJaryeongAcquisition,
  saveJaryeongInventory
} from "./ui/jaryeong-inventory";
import { buildSynthesisDepths, synthesisDepthLabel } from "./ui/codex-synthesis";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app element is missing.");
const initialDisplayMode = loadDisplayMode();
const initialAutoPlaceSummons = loadAutoPlaceSummons();

app.innerHTML = `
  <main class="game-shell" data-phase="title" data-display-mode="${initialDisplayMode}">
    <section class="battle-stage" aria-label="한자 랜덤 타워 디펜스 전장">
      <canvas id="battle-canvas" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}"></canvas>
      <button id="map-zoom-reset" class="map-zoom-control" type="button" title="지도 확대/축소 초기화">
        <span>지도</span><strong id="map-zoom-value">100%</strong><small>휠 확대·축소</small>
      </button>
      <button id="hanja-emphasis-toggle" class="hanja-emphasis-control is-on" type="button" aria-pressed="true" title="전장 한자 표찰 강조 전환">
        <span>한자 강조</span><strong>ON</strong>
      </button>
      <div class="stage-topbar" aria-live="polite">
        <div class="stage-chip"><span>웨이브</span><strong id="stage-wave">0 / 20</strong></div>
        <div class="stage-chip stage-chip--region"><span>지역</span><strong id="stage-region">한국</strong></div>
        <div class="stage-chip stage-chip--phase"><i id="phase-dot"></i><strong id="stage-phase">준비 전</strong></div>
        <div id="enemy-limit-chip" class="stage-chip"><span>적 한계</span><strong id="stage-enemies">0 / ${MAX_ENEMIES}</strong></div>
      </div>
      <div class="wave-progress" aria-hidden="true"><i id="wave-progress-fill"></i></div>
      <div id="boss-banner" class="boss-banner" aria-live="assertive"></div>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
      <section id="summon-reveal" class="summon-reveal" aria-hidden="true" aria-live="assertive">
        <header><div><span>SUMMON RESULT</span><strong id="summon-reveal-title">자령 소환</strong></div><button id="summon-reveal-close" type="button" aria-label="소환 결과 닫기">×</button></header>
        <p id="summon-reveal-summary"></p>
        <div id="summon-reveal-list" class="summon-reveal-list"></div>
      </section>
    </section>

    <aside class="control-panel" aria-label="합성과 수비 조작 패널">
      <header class="brand-row">
        <div><p class="eyebrow">HANZI RANDOM TOWER DEFENSE</p><h1>한자 운명진</h1></div>
        <div class="header-actions">
          <button id="speed-button" class="speed-button" type="button" aria-label="게임 배속 1배" title="게임 배속 전환 (F)">1×</button>
          <button id="settings-button" class="icon-button" type="button" aria-label="화면 설정 열기" title="화면 설정">⚙</button>
          <button id="sound-button" class="icon-button" type="button" aria-label="소리 끄기" title="소리 켜기/끄기 (M)">♪</button>
          <button id="help-button" class="icon-button" type="button" aria-label="도움말 열기">?</button>
        </div>
      </header>

      <section class="resource-grid" aria-label="현재 자원">
        <div><span>엽전 <em id="interest-preview">이자 +6</em></span><strong id="gold-value">64</strong></div>
        <div><span>적 한계</span><strong id="enemy-cap-value">${MAX_ENEMIES}체</strong></div>
        <div><span>진법</span><strong id="tower-count-value">0 / 80</strong></div>
        <div><span>완성</span><strong id="goal-count-value">0</strong></div>
      </section>

      <section class="wave-card">
        <div><span id="wave-kicker">첫 웨이브 대기</span><strong id="wave-label">소환진을 준비하세요</strong><small id="wave-briefing">다음 적 정보를 확인하세요.</small></div>
        <div class="weakness-seal"><span>약점</span><b id="wave-weakness">木</b></div>
        <button id="early-button" class="small-button" type="button" data-testid="early-wave">즉시 시작</button>
      </section>

      <section class="goal-card" aria-label="목표 한자">
        <div class="goal-glyph" id="goal-glyph">相</div>
        <div class="goal-copy">
          <div class="section-heading"><span>현재 봉인 목표</span><b id="goal-stage">2단계</b></div>
          <strong id="goal-recipe">木 + 目 → 相</strong>
          <span id="goal-reading" class="goal-reading">훈음 · 서로 상</span>
          <div id="goal-materials" class="goal-materials"></div>
          <div class="goal-progress"><i id="goal-progress-fill"></i></div>
        </div>
      </section>

      <section class="action-row" aria-label="핵심 행동">
        <div class="summon-action-group">
          <div id="summon-intent-tabs" class="summon-intent-tabs" role="group" aria-label="소환 목적">
            <button type="button" data-summon-intent="balanced" class="is-active" title="기본 확률">균형</button>
            <button type="button" data-summon-intent="discovery" title="처음 보는 한자 가중">탐색</button>
            <button type="button" data-summon-intent="lineage" title="목표 합성과 성어 재료 가중">계보</button>
            <button type="button" data-summon-intent="concentration" title="보유 자령 중복 가중">농축</button>
          </div>
          <button id="summon-button" class="action-button action-button--summon" type="button" data-testid="summon-button">
            <span class="hotkey">1</span><b>자령 소환</b><small><em id="summon-cost">9</em> 엽전</small>
          </button>
          <button id="multi-summon-button" class="action-button action-button--multi-summon" type="button" data-testid="multi-summon-button">
            <span class="hotkey">Q</span><b>10연 소환</b><small><em id="multi-summon-cost">60</em> 엽전</small>
          </button>
        </div>
        <button id="evolve-button" class="action-button action-button--evolve" type="button" data-testid="evolve-button">
          <span class="hotkey">2</span><b>합성</b><small><em id="evolve-ready-count">0</em>개 조합 확인</small>
        </button>
        <button id="research-button" class="action-button action-button--research" type="button" data-testid="research-button">
          <span class="hotkey">3</span><b>인연 연구</b><small><em id="research-cost">32</em> 엽전 · <i id="research-level">0</i>/5</small>
        </button>
        <button id="auto-arrange-button" class="action-button action-button--auto-arrange" type="button" data-testid="auto-arrange-button" title="발동 가능한 사자성어를 봉인하고 오행진 공명을 최적화합니다">
          <b>자동배치</b><small>성어·오행 최적화</small>
        </button>
        <button id="element-upgrade-button" class="action-button action-button--element-upgrade" type="button" data-testid="element-upgrade-button">
          <b>능력 강화</b><small id="element-upgrade-total">총 0단계</small>
        </button>
      </section>

      <div class="context-deck">
        <section id="selected-card" class="selected-card panel-view is-active" data-panel-view="unit" aria-live="polite">
          <div class="empty-selection"><b>전장의 자령을 선택하세요</b><span>한자의 훈음·부수와 현재 능력 효과를 크게 확인할 수 있습니다.</span></div>
        </section>

        <section class="evolution-workbench panel-view" data-panel-view="evolution" aria-label="한자 합성">
          <div class="evolution-heading">
            <div><span>조합 서책</span><strong>현재 가능한 합성 <b id="evolution-count">0</b></strong></div>
            <div class="mode-tabs" role="group" aria-label="합성 방식">
              <button type="button" data-mode="manual">수동</button>
              <button type="button" data-mode="semi" class="is-active">반자동</button>
              <button type="button" data-mode="goal">목표 자동</button>
            </div>
          </div>
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
            <div><span>RUN INVENTORY · STACKED</span><strong>배치 대기 <b id="run-inventory-heading-count">0개 · 0종</b></strong></div>
            <div class="run-inventory-tools">
              <small id="essence-summary">문기 木0 火0 土0 金0 水0</small>
              <button id="cleanup-recommended-button" type="button">정리 후보 분해</button>
            </div>
          </div>
          <div id="run-inventory-list" class="run-inventory-list">
            <div class="empty-run-inventory"><b>대기 중인 자령이 없습니다</b><span>설정에서 자동 배치를 끄거나 전장 자령을 보관하세요.</span></div>
          </div>
        </section>
      </div>

      <section id="composition-drawer" class="composition-drawer" aria-label="선택 자령 파생 합성" aria-hidden="true">
        <header class="composition-drawer-heading">
          <div><span>DERIVATIVE COMPOSITION</span><strong><b id="composition-source-glyph">-</b> 파생 합성</strong></div>
          <p><em id="composition-ready-count">0</em>개 합성 가능</p>
          <button id="composition-drawer-close" type="button" aria-label="파생 합성 닫기">×</button>
        </header>
        <div id="composition-source" class="composition-source"></div>
        <div id="composition-branches" class="composition-branches"></div>
        <footer><b>컬러</b>: 합성 가능 · <i>회색</i>: 재료 부족 · 전장/인벤 모두 계산</footer>
      </section>

      <nav class="panel-tabs" role="tablist" aria-label="상세 정보">
        <button type="button" class="is-active" data-panel-tab="unit" role="tab" aria-selected="true">자령</button>
        <button id="run-inventory-tab" type="button" data-panel-tab="inventory" role="tab" aria-selected="false">인벤 <small id="run-inventory-count">0</small></button>
        <button type="button" data-panel-tab="evolution" role="tab" aria-selected="false">합성</button>
        <button id="idiom-tab" type="button" data-panel-tab="idiom" role="tab" aria-selected="false">성어 <small id="idiom-tab-count">0/5</small></button>
        <button id="codex-button" type="button" aria-label="한자 도감과 보유 자령 열기"><b>도감</b><small><em id="discover-count">0</em></small></button>
        <button type="button" data-panel-tab="record" role="tab" aria-selected="false">기록</button>
      </nav>

      <section id="synergy-strip" class="synergy-strip" aria-label="오행 상생"></section>

      <footer class="panel-footer">
        <span class="canvas-tip">클릭: 선택·이동 · 자령 끌기: 교환 · 빈 곳 좌클릭/휠 클릭 드래그: 패닝 · 휠: 확대 · 성어 자동 판정</span>
        <span><b id="message-value">지역과 목표 한자를 선택하세요.</b> · 시드 <b id="seed-value">-</b></span>
      </footer>
    </aside>

    <section id="title-overlay" class="modal-layer modal-layer--visible" aria-labelledby="title-heading">
      <div class="title-card">
        <p class="eyebrow">REGIONAL HANZI COMPOSITION DEFENSE</p>
        <div class="title-seal" aria-hidden="true"><i>木</i><i>林</i><i>森</i></div>
        <h2 id="title-heading">한자 운명진</h2>
        <p class="title-lead">운으로 글자를 부르고, 실제 구성 원리로 합성하라.<br />스무 번의 망령 행렬을 막아 봉인을 완성하세요.</p>
        <div class="region-picker" role="radiogroup" aria-label="지역 한자 체계">
          <button type="button" class="region-option is-selected" data-region="KR" role="radio" aria-checked="true"><b>韓</b><span>한국</span><small>천자문 1000</small></button>
          <button type="button" class="region-option" data-region="JP" role="radio" aria-checked="false"><b>日</b><span>일본</span><small>상용한자 2136</small></button>
          <button type="button" class="region-option" data-region="CN" role="radio" aria-checked="false"><b>中</b><span>중국</span><small>규범한자 3500</small></button>
        </div>
        <label class="seed-field">런 시드<input id="seed-input" maxlength="24" spellcheck="false" /></label>
        <button id="start-button" class="start-button" type="button" data-testid="start-run">봉인전 시작</button>
        <div class="title-link-row"><button id="title-settings-button" class="title-help-button" type="button">화면 모드 설정</button><button id="title-help-button" class="title-help-button" type="button">게임 방법 보기</button></div>
        <p class="title-note">지역별 조합식 6,637자를 포함한 독립 로컬 프로토타입</p>
      </div>
    </section>

    <section id="end-overlay" class="modal-layer" aria-labelledby="end-heading">
      <div class="end-card">
        <p id="end-kicker" class="eyebrow">RUN COMPLETE</p>
        <h2 id="end-heading">봉인전 종료</h2>
        <p id="end-message"></p>
        <div id="end-stats" class="end-stats"></div>
        <div class="end-actions">
          <button id="retry-button" class="start-button" type="button">같은 시드 재도전</button>
          <button id="new-seed-button" class="secondary-button" type="button">새 시드로 시작</button>
        </div>
      </div>
    </section>

    <dialog id="help-dialog" class="help-dialog">
      <form method="dialog">
        <div class="dialog-heading"><div><p class="eyebrow">HOW TO PLAY</p><h2>봉인술 입문</h2></div><button aria-label="도움말 닫기">×</button></div>
        <ol>
          <li><b>소환</b><span>지역별 1단계 한자를 품은 자령이 무작위로 나옵니다. 목표의 부족한 재료는 소프트 천장으로 조금씩 유리해집니다.</span></li>
          <li><b>목적 소환</b><span>균형·탐색·계보·농축 중 원하는 목적을 고릅니다. 10연 마지막 결과는 가능한 경우 선택 목적에 맞는 한자를 보장합니다.</span></li>
          <li><b>10연 소환</b><span>Q키 또는 10연 버튼으로 현재 소환 비용 10회를 한 번에 지불합니다. 결과판에서 새 발견·합성·농축·교체 후보를 즉시 분류합니다.</span></li>
          <li><b>합성</b><span>실제 구성식의 재료를 모두 보유하면 조합 서책에 카드가 열립니다. 木+木처럼 같은 글자 두 개도 각각 필요합니다.</span></li>
          <li><b>방식</b><span>반자동은 가능한 조합만 제안합니다. 목표 자동은 목표 경로의 조합만 자동 실행하며, 수동은 선택한 한자가 포함된 조합만 봅니다.</span></li>
          <li><b>사자성어</b><span>이웃한 네 칸에 글자를 올바른 순서로 배치하면 자동 봉인됩니다. 직접 선을 그을 필요가 없으며, 보너스는 그 런 동안 계속 유지됩니다.</span></li>
          <li><b>자동배치</b><span>전장 자령만 재배치해 지금 완성할 수 있는 사자성어를 먼저 봉인한 뒤, 남은 배치를 다섯 오행진 공명 단계가 가장 높아지도록 정리합니다. 런 인벤토리 자령은 꺼내지 않습니다.</span></li>
          <li><b>은행 이자</b><span>웨이브가 끝나거나 잔존 적을 둔 채 다음 웨이브가 합류할 때, 현재 보유 엽전 10개당 1엽전을 한 번 지급합니다. 기본 웨이브 보상을 받은 뒤 이자를 계산합니다.</span></li>
          <li><b>훈·독</b><span>기본 자령 모드는 머리 위 한자·훈음을 표시합니다. 설정의 공부 모드는 전장에 큰 한자와 짧은 읽기를 표시하며, 선택 카드와 도감에서는 자세한 훈음·음독·훈독·병음과 뜻을 확인합니다.</span></li>
          <li><b>전투</b><span>웨이브 약점 오행은 피해가 30% 증가합니다. 水→木→火→土→金→水 상생을 함께 배치하면 추가 피해를 줍니다.</span></li>
          <li><b>능력 강화</b><span>엽전으로 모든 자령의 공격력·공격 속도·사거리·능력 위력·효과 지속을, 분해 문기로 해당 오행의 같은 다섯 능력치를 각각 99단계까지 강화합니다.</span></li>
          <li><b>능력 조합</b><span>모든 한자는 오행 효과·전투 역할·조합망 패시브를 가집니다. 합성 한자는 재료의 오행도 계승해 주기 추가타를 얻습니다.</span></li>
          <li><b>잠금</b><span>선택한 자령을 잠그면 공격·이동은 유지되지만 합성 재료와 판매 대상에서는 제외됩니다.</span></li>
          <li><b>보유 자령</b><span>소환·합성으로 획득한 자령은 지역별 횟수와 함께 브라우저에 자동 저장됩니다. 도감의 보유 자령 탭에서 확인합니다.</span></li>
          <li><b>런 인벤토리</b><span>동일한 한자는 한 스택으로 묶입니다. 인벤토리 자령을 고른 뒤 빈 칸을 누르면 배치하고, 찬 칸을 누르면 기존 자령을 인벤토리로 보내며 즉시 교체합니다.</span></li>
          <li><b>정리와 농축</b><span>판매는 엽전을, 분해는 해당 오행 문기를 줍니다. 동일 한자 중복 또는 오행 문기로 최대 濃 3까지 연속·심화 농축할 수 있습니다. 자동 정리는 잠금·유일 보유·성어·합성·오행진 임계치를 보호합니다.</span></li>
          <li><b>지도 배율</b><span>기존 260% 크기를 새 100% 기준으로 사용합니다. 휠로 약 28%~200% 확대·축소하고, 빈 칸·길에서 좌클릭 드래그하거나 휠 버튼을 누른 채 드래그하면 지도를 이동합니다. 왼쪽 아래 배율 버튼은 중앙 정렬된 100%로 돌아갑니다.</span></li>
          <li><b>게임 배속</b><span>오른쪽 위 배속 버튼이나 F키로 1×·2×·3×를 순환합니다.</span></li>
          <li><b>게임오버</b><span>적은 경로 끝에서 사라지지 않고 계속 순환합니다. 전장에 ${MAX_ENEMIES}체가 쌓이거나 보스를 제한시간 안에 처치하지 못하면 즉시 실패합니다. 제어 능력은 적을 뒤로 밀지 않고 현재 공격권 안에서 감속·봉쇄합니다.</span></li>
        </ol>
        <div class="key-guide"><span><kbd>1</kbd> 소환</span><span><kbd>Q</kbd> 10연</span><span><kbd>2</kbd> 첫 합성</span><span><kbd>3</kbd> 연구</span><span><kbd>Space</kbd> 출전</span><span><kbd>F</kbd> 배속</span><span><kbd>C</kbd> 도감</span><span><kbd>M</kbd> 음소거</span></div>
        <p>장갑·질풍·군집·회생 적의 특성을 미리 확인하세요. 놓친 적도 사라지지 않고 다음 바퀴를 돌기 때문에 누적 수를 계속 관리해야 합니다.</p>
      </form>
    </dialog>

    <dialog id="settings-dialog" class="settings-dialog">
      <div class="dialog-heading">
        <div><p class="eyebrow">DISPLAY SETTINGS</p><h2>전장 표시 모드</h2></div>
        <button id="settings-close" type="button" aria-label="설정 닫기">×</button>
      </div>
      <p class="settings-intro">게임 규칙은 그대로 유지되고 전장 자령의 표시 방식만 바뀝니다.</p>
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
      <p class="settings-source">자령 머리 위에는 짧은 훈음을 표시하고, 자세한 부수 정보는 선택 카드와 도감에서 확인할 수 있습니다.</p>
    </dialog>

    <dialog id="element-upgrade-dialog" class="element-upgrade-dialog">
      <div class="dialog-heading">
        <div><p class="eyebrow">ENDLESS STAT FORGE</p><h2>공용·오행 능력 강화</h2></div>
        <button id="element-upgrade-close" type="button" aria-label="오행 강화 닫기">×</button>
      </div>
      <p class="element-upgrade-intro">엽전은 모든 자령의 공용 능력치에, 분해 문기는 해당 오행 능력치에 투자합니다. 각 항목은 최고 99단계이며 이번 런 동안 유지됩니다.</p>
      <div class="upgrade-section-heading"><div><b>공용 강화</b><span>엽전 사용 · 모든 자령 적용</span></div><em id="global-upgrade-total">0단계</em></div>
      <div id="global-upgrade-list" class="global-upgrade-list"></div>
      <div class="upgrade-section-heading"><div><b>오행 강화</b><span>각 오행 문기 사용 · 해당 오행만 적용</span></div><em id="element-essence-dialog-summary">木0 火0 土0 金0 水0</em></div>
      <div id="element-upgrade-list" class="element-upgrade-list"></div>
      <p class="element-upgrade-note">공격 속도 보너스는 기본 공격 주기를 나누는 방식으로 적용해 고단계에서도 폭주하지 않습니다. 사거리를 제외한 수치는 누적 보너스입니다.</p>
    </dialog>

    <dialog id="codex-dialog" class="codex-dialog">
      <div class="dialog-heading codex-heading">
        <div><p class="eyebrow">REGIONAL CHARACTER CODEX</p><h2><span id="codex-region">한국</span> 한자 도감</h2></div>
        <button id="codex-close" type="button" aria-label="도감 닫기">×</button>
      </div>
      <div class="codex-toolbar">
        <div class="codex-mode-tabs" role="tablist" aria-label="도감 분류">
          <button type="button" class="is-active" data-codex-mode="hanzi" role="tab" aria-selected="true">전체 한자</button>
          <button type="button" data-codex-mode="inventory" role="tab" aria-selected="false">보유 자령 <small id="inventory-count">0</small></button>
          <button type="button" data-codex-mode="recipes" role="tab" aria-selected="false">조합표</button>
          <button type="button" data-codex-mode="idioms" role="tab" aria-selected="false">사자성어</button>
        </div>
        <div id="codex-synthesis-filters" class="codex-synthesis-filters" role="group" aria-label="합성 단계 분류"></div>
        <div class="codex-search-row">
          <input id="codex-search" type="search" maxlength="12" placeholder="한자·훈음·능력 검색" />
          <span id="codex-summary"></span>
        </div>
      </div>
      <div class="codex-layout">
        <div id="codex-list" class="codex-list"></div>
        <aside id="codex-detail" class="codex-detail"></aside>
      </div>
      <p class="codex-note">지역 독음은 Unicode Unihan ${LEARNING_DATA_META.version}, 한국어 훈음은 libhangul 사전 기반입니다. 한국어 훈이 없는 글자는 뜻(영)을 구분해 표시하며, 검토 표시는 후속 교정 대상입니다.</p>
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
const codexDialog = must<HTMLDialogElement>("#codex-dialog");
const summonReveal = must<HTMLElement>("#summon-reveal");
const sound = new SoundManager();
const initialSeed = new URLSearchParams(window.location.search).get("seed")?.slice(0, 24) || createRunSeed();
seedInput.value = initialSeed;
let selectedRegion: RegionCode = "KR";
let displayMode: DisplayMode = initialDisplayMode;
let engine = new GameEngine(initialSeed, selectedRegion);
engine.state.autoPlaceSummons = initialAutoPlaceSummons;
let jaryeongInventory = loadJaryeongInventory();
let inventoryRevision = 0;
let previousPhase: RunPhase = "title";
let lastFrame = performance.now();
let toastTimer = 0;
let summonRevealTimer = 0;
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
let comboTimer = 0;
let comboCount = 0;
let lastKillAt = 0;
const feedCooldowns = new Map<string, number>();
type PanelTab = "unit" | "inventory" | "evolution" | "idiom" | "record";
type CodexMode = "hanzi" | "inventory" | "recipes" | "idioms";
let codexMode: CodexMode = "hanzi";
let codexSynthesisDepth: number | "all" = "all";

interface ProjectileFx {
  from: Point;
  to: Point;
  color: string;
  age: number;
  duration: number;
  critical: boolean;
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
const towerAbilityPopups = new Map<number, TowerAbilityPopup>();
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
let hanjaEmphasis = true;
const MIN_MAP_ZOOM = 0.72;
const BASE_MAP_ZOOM = 2.6;
const DEFAULT_MAP_ZOOM = BASE_MAP_ZOOM;
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
type GameSpeed = 1 | 2 | 3;
let gameSpeed: GameSpeed = 1;
const hanjiPaperUrl = `${import.meta.env.BASE_URL}assets/map/hanji-ink-field/hanji-paper-base.png`;
canvas.style.backgroundImage = `radial-gradient(circle at 50% 44%, rgba(255, 252, 235, 0.08), rgba(115, 78, 39, 0.09)), url("${hanjiPaperUrl}")`;
canvas.style.backgroundPosition = "center";
canvas.style.backgroundRepeat = "no-repeat";
canvas.style.backgroundSize = "cover";
canvas.dataset.hitFeedback = "ink-local";
const INK_ELEMENT_COLORS: Record<Wuxing, string> = {
  "木": "#315d37",
  "火": "#9b3829",
  "土": "#6b5131",
  "金": "#766126",
  "水": "#285d73"
};

function setPanelTab(tab: PanelTab): void {
  if (tab !== "unit") closeCompositionDrawer();
  document.querySelectorAll<HTMLElement>("[data-panel-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.panelView === tab);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-panel-tab]").forEach((button) => {
    const selected = button.dataset.panelTab === tab;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
}

function syncDisplayModeControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-display-mode-option]").forEach((button) => {
    const selected = button.dataset.displayModeOption === displayMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function syncAutoPlaceControl(): void {
  const button = must<HTMLButtonElement>("#auto-place-toggle");
  const enabled = engine.state.autoPlaceSummons;
  button.classList.toggle("is-on", enabled);
  button.setAttribute("aria-checked", String(enabled));
  must<HTMLElement>("#auto-place-toggle i em").textContent = enabled ? "ON" : "OFF";
}

function setDisplayMode(mode: DisplayMode, announce = true): void {
  displayMode = mode;
  shell.dataset.displayMode = mode;
  saveDisplayMode(mode);
  syncDisplayModeControls();
  if (announce) showToast(mode === "spirit" ? "자령 모드 · 한자와 훈음을 머리 위에 표시" : "공부 모드 · 큰 한자와 읽기를 전장에 표시");
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
  engine = new GameEngine(seed, selectedRegion);
  engine.state.autoPlaceSummons = loadAutoPlaceSummons();
  engine.begin();
  previousPhase = "prep";
  titleOverlay.classList.remove("modal-layer--visible");
  endOverlay.classList.remove("modal-layer--visible");
  sound.unlock();
  projectiles.length = 0;
  floaters.length = 0;
  rings.length = 0;
  abilityBursts.length = 0;
  towerAbilityPopups.clear();
  combatFeed.replaceChildren();
  feedCooldowns.clear();
  comboCount = 0;
  comboMeter.classList.remove("combo-meter--visible");
  resetIdiomResult();
  hideSummonReveal();
  closeCompositionDrawer();
  setPanelTab("unit");
  window.clearTimeout(comboTimer);
  evolutionRenderKey = "";
  goalRenderKey = "";
  selectedRenderKey = "";
  runInventoryRenderKey = "";
  idiomRenderKey = "";
  elementUpgradeRenderKey = "";
  towerDragPointerId = null;
  towerDragTowerId = null;
  towerDragStart = null;
  towerDragMoved = false;
  showToast(engine.catalog.title + " 봉인전을 시작합니다.");
  syncPanel();
}

function handleAction(result: ActionResult): void {
  if (!result.ok || !result.message.includes("자동 봉인")) showToast(result.message, !result.ok);
  evolutionRenderKey = "";
  goalRenderKey = "";
  selectedRenderKey = "";
  runInventoryRenderKey = "";
  syncPanel();
}

function showToast(message: string, warning = false): void {
  toast.textContent = message;
  toast.classList.toggle("toast--warning", warning);
  toast.classList.remove("toast--visible");
  void toast.offsetWidth;
  toast.classList.add("toast--visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("toast--visible"), 1900);
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
  if (current && current.age < 0.45) return;
  towerAbilityPopups.set(towerId, { text: glyph + " " + name, color, age: 0, duration: 0.82 });
}

function hideSummonReveal(): void {
  window.clearTimeout(summonRevealTimer);
  summonReveal.classList.remove("is-active", "is-batch");
  summonReveal.setAttribute("aria-hidden", "true");
}

function showSummonReveal(events: Array<Extract<GameEvent, { type: "summon" }>>): void {
  if (events.length === 0) return;
  window.clearTimeout(summonRevealTimer);
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
  must<HTMLElement>("#summon-reveal-summary").innerHTML = `<b>새 발견 ${newCount}</b><span>합성 재료 ${helpfulCount}</span><span>농축 재료 ${concentrationCount}</span><em>${placementLabel}</em>`;
  must<HTMLElement>("#summon-reveal-list").innerHTML = events.map((event, index) => {
    const tower = event.tower;
    const definition = definitionForTower(engine.catalog, tower.definitionId);
    const style = ELEMENT_STYLES[tower.wuxing];
    const visual = jaryeongVisualFor(tower.char, tower.wuxing);
    const learning = learningInfo(engine.state.region, tower.char);
    const helpfulLabel = event.helpfulReason === "both" ? "목표·성어" : event.helpfulReason === "goal" ? "목표 재료" : event.helpfulReason === "idiom" ? "성어 재료" : "";
    const utilityLabel = event.utility === "new" ? "NEW" : event.utility === "synthesis" ? "합성" : event.utility === "concentration" ? "농축" : "교체 후보";
    return `<article class="summon-result-card ${event.newDiscovery ? "is-new" : ""} ${event.helpful ? "is-helpful" : ""}" style="--summon:${style.color};--summon-delay:${index * 45}ms">
      <span class="summon-result-spirit" style="background-image:url('${import.meta.env.BASE_URL}assets/jaryeongs/${visual.id}/sheet-transparent.png')" aria-hidden="true"></span>
      <strong>${tower.char}</strong>
      <b>${escapeHtml(learning.short)}</b>
      <small>${style.name}행 · ${escapeHtml(definition.combat.roleLabel)}</small>
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

function rememberJaryeong(char: string, kind: "summon" | "evolution"): void {
  jaryeongInventory = recordJaryeongAcquisition(jaryeongInventory, engine.state.region, char, kind);
  saveJaryeongInventory(jaryeongInventory);
  inventoryRevision += 1;
  if (codexDialog.open && codexMode === "inventory") {
    renderCodex(must<HTMLInputElement>("#codex-search").value);
  }
}

function processEvent(event: GameEvent): void {
  sound.handle(event);
  switch (event.type) {
    case "shot":
      projectiles.push({ ...event, age: 0, duration: event.critical ? 0.18 : 0.12 });
      if (projectiles.length > 90) projectiles.shift();
      break;
    case "damage":
      if (event.critical || event.weakness || event.amount >= 50) {
        const prefix = event.critical ? "치명 " : event.weakness ? "약점 " : "";
        floaters.push({ at: event.at, text: prefix + String(Math.round(event.amount)), color: event.critical ? "#ffe06e" : event.weakness ? "#8ff5c6" : "#f6f0ff", age: 0, duration: 0.64, large: event.critical });
      }
      break;
    case "kill":
      floaters.push({ at: event.at, text: "+" + String(event.reward), color: "#ffd86d", age: 0, duration: 0.72, large: false });
      registerKillCombo();
      break;
    case "interest":
      showToast("은행 이자 +" + String(event.amount) + "엽전");
      addCombatFeed("財", "은행 이자", `보유 ${event.gold - event.amount}엽전 · 10엽전당 1엽전`, "#f3d47a");
      break;
    case "summon":
      rememberJaryeong(event.tower.char, "summon");
      if (!event.stored) rings.push({ at: event.at, color: ELEMENT_STYLES[event.tower.wuxing].color, age: 0, duration: 0.52 });
      if (event.helpful && !event.stored) {
        const label = event.helpfulReason === "both" ? "목표·성어 +1" : event.helpfulReason === "idiom" ? "성어 +1" : "목표 +1";
        floaters.push({ at: event.at, text: label, color: event.helpfulReason === "idiom" ? "#c9a8ff" : "#ffd979", age: 0, duration: 0.68, large: false });
      }
      break;
    case "dismantle":
      addCombatFeed(event.wuxing, `${event.tower.char} 문기 환원`, `${event.wuxing} 문기 +${event.essence}`, ELEMENT_STYLES[event.wuxing].color);
      break;
    case "concentrate":
      if (event.tower.cell >= 0) {
        const at = BOARD_CELLS[event.tower.cell] as Point;
        rings.push({ at, color: ELEMENT_STYLES[event.tower.wuxing].color, age: 0, duration: 0.9 });
        floaters.push({ at, text: `濃 ${event.level}/3`, color: ELEMENT_STYLES[event.tower.wuxing].color, age: 0, duration: 1.05, large: true });
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
      rememberJaryeong(event.tower.char, "evolution");
      rings.push({ at: event.at, color: STAGE_COLORS[event.tower.stage], age: 0, duration: 0.9 });
      floaters.push({ at: event.at, text: event.parents.join("+") + "→" + event.tower.char, color: STAGE_COLORS[event.tower.stage], age: 0, duration: 1.05, large: true });
      {
        const evolved = definitionForTower(engine.catalog, event.tower.definitionId);
        const lineage = evolved.combat.abilities.lineage;
        const detail = evolved.combat.abilities.role.name + (lineage ? " · " + lineage.name : "");
        addCombatFeed(event.tower.char, "새 능력 획득", detail, STAGE_COLORS[event.tower.stage]);
      }
      break;
    case "ability": {
      abilityBursts.push({ at: event.at, source: event.source, glyph: event.glyph, color: event.color, kind: event.kind, age: 0, duration: 0.58 });
      if (abilityBursts.length > 48) abilityBursts.shift();
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
      for (const point of points) rings.push({ at: point, color: event.color, age: 0, duration: 1.05 });
      const flourishAt = { x: center.x, y: Math.min(WORLD_HEIGHT - 100, center.y + 115) };
      floaters.push({ at: flourishAt, text: event.reading + " 자동 봉인!", color: event.color, age: 0, duration: 1.25, large: true });
      showIdiomResult(event.reading, event.meaning, event.bonus, event.color);
      addCombatFeed("四", event.reading, event.bonus, event.color);
      idiomRenderKey = "";
      break;
    }
    case "wave":
      bossBanner.textContent = event.boss
        ? "⚠ 우두머리 " + String(event.wave) + " · 약점 " + event.weakness + " ⚠"
        : "웨이브 " + String(event.wave) + " · 약점 " + event.weakness;
      bossBanner.classList.toggle("boss-banner--boss", event.boss);
      bossBanner.classList.remove("boss-banner--visible");
      void bossBanner.offsetWidth;
      bossBanner.classList.add("boss-banner--visible");
      window.setTimeout(() => bossBanner.classList.remove("boss-banner--visible"), event.boss ? 2200 : 1200);
      break;
    case "phase":
      break;
  }
}

function showEndScreen(phase: "victory" | "defeat"): void {
  const state = engine.state;
  const victory = phase === "victory";
  must<HTMLElement>("#end-kicker").textContent = victory ? "SEAL COMPLETE" : "DEFENSE FAILED";
  must<HTMLElement>("#end-heading").textContent = victory ? "스무 봉인 완성" : "수비에 실패했습니다";
  must<HTMLElement>("#end-message").textContent = state.lastMessage;
  must<HTMLElement>("#end-stats").innerHTML = `
    <div><span>도달 웨이브</span><b>${state.wave} / ${state.maxWaves}</b></div>
    <div><span>처치한 망령</span><b>${state.killCount}</b></div>
    <div><span>한자 합성</span><b>${state.evolutionCount}</b></div>
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

function saveBestWave(wave: number): void {
  try {
    const key = "hanzi-random-defense-best-" + engine.state.region;
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

function phaseLabel(phase: RunPhase): string {
  if (phase === "title") return "준비 전";
  if (phase === "prep") return "소환 준비";
  if (phase === "combat") return "교전 중";
  if (phase === "victory") return "봉인 성공";
  return "수비 실패";
}

function syncPanel(): void {
  const state = engine.state;
  const plan = engine.getCurrentPlan();
  const preview = state.phase === "prep" ? wavePlan(Math.min(state.maxWaves, state.wave + 1)) : plan;
  shell.dataset.phase = state.phase;
  must<HTMLElement>("#stage-wave").textContent = String(state.wave) + " / " + String(state.maxWaves);
  must<HTMLElement>("#stage-region").textContent = REGION_META[state.region].title.split(" · ")[0] ?? state.region;
  must<HTMLElement>("#stage-phase").textContent = phaseLabel(state.phase);
  must<HTMLElement>("#stage-enemies").textContent = String(state.enemies.length) + " / " + String(MAX_ENEMIES);
  must<HTMLElement>("#enemy-limit-chip").classList.toggle("is-danger", state.enemies.length >= MAX_ENEMIES * 0.75);
  must<HTMLElement>("#gold-value").textContent = String(state.gold);
  must<HTMLElement>("#interest-preview").textContent = "이자 +" + String(interestForGold(state.gold));
  must<HTMLElement>("#enemy-cap-value").textContent = String(MAX_ENEMIES) + "체";
  must<HTMLElement>("#tower-count-value").textContent = String(state.towers.length) + " / " + String(GAME_CONFIG.maxTowerCount);
  must<HTMLElement>("#goal-count-value").textContent = String(state.goalsCompleted.length) + " / " + String(engine.catalog.goalOrder.length);
  must<HTMLElement>("#seed-value").textContent = state.seed;
  must<HTMLElement>("#message-value").textContent = state.lastMessage;
  must<HTMLElement>("#summon-cost").textContent = String(summonCost(state.summonCount));
  const tenSummonCost = multiSummonCost(state.summonCount, 10);
  must<HTMLElement>("#multi-summon-cost").textContent = String(tenSummonCost);
  must<HTMLElement>("#research-level").textContent = String(state.researchLevel);
  must<HTMLElement>("#research-cost").textContent = state.researchLevel >= 5 ? "최고" : String(researchCost(state.researchLevel));
  must<HTMLElement>("#discover-count").textContent = String(state.discoveredChars.length);
  must<HTMLElement>("#essence-summary").textContent = "문기 " + WUXING_ORDER.map((wuxing) => `${wuxing}${state.elementEssence[wuxing]}`).join(" ");
  document.querySelectorAll<HTMLButtonElement>("[data-summon-intent]").forEach((button) => {
    const selected = button.dataset.summonIntent === state.summonIntent;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  const active = state.phase === "prep" || state.phase === "combat";
  must<HTMLButtonElement>("#summon-button").disabled = !active || state.gold < summonCost(state.summonCount);
  must<HTMLButtonElement>("#multi-summon-button").disabled = !active || state.gold < tenSummonCost;
  must<HTMLButtonElement>("#research-button").disabled = !active || state.researchLevel >= 5 || state.gold < researchCost(state.researchLevel);
  must<HTMLButtonElement>("#auto-arrange-button").disabled = !active || state.towers.length === 0;
  must<HTMLButtonElement>("#element-upgrade-button").disabled = !active;
  must<HTMLElement>("#element-upgrade-total").textContent = `총 ${totalGlobalUpgradeLevels() + totalElementUpgradeLevels()}단계`;
  const nextElementUpgradeRenderKey = upgradeStateSignature();
  if (elementUpgradeDialog.open && elementUpgradeRenderKey !== nextElementUpgradeRenderKey) renderElementUpgrades();
  const earlyButton = must<HTMLButtonElement>("#early-button");
  earlyButton.disabled = state.phase !== "prep";
  earlyButton.textContent = state.phase === "prep" ? "즉시 +" + String(Math.floor(state.prepRemaining / 2)) : "교전 중";
  const bossRemaining = engine.bossTimeRemaining();
  const nextWaveRemaining = state.phase === "combat" ? state.nextWaveRemaining : null;
  const previewBossLimit = preview?.boss ? bossTimeLimitForWave(preview.wave) : null;
  must<HTMLElement>(".wave-card").classList.toggle("is-boss", bossRemaining !== null || previewBossLimit !== null);
  must<HTMLElement>("#wave-kicker").textContent = state.phase === "prep"
    ? previewBossLimit !== null ? "보스전 · 제한 " + String(previewBossLimit) + "초" : "준비 " + state.prepRemaining.toFixed(1) + "초"
    : bossRemaining !== null
      ? "보스 제한 " + bossRemaining.toFixed(1) + "초"
      : nextWaveRemaining !== null
        ? "다음 웨이브 " + nextWaveRemaining.toFixed(1) + "초"
        : state.phase === "combat" ? formatTime(state.waveElapsed) + " 경과" : "봉인전 종료";
  must<HTMLElement>("#wave-label").textContent = state.phase === "prep" ? String(state.wave + 1) + "웨이브 · " + (preview?.label ?? "") : plan?.label ?? state.lastMessage;
  must<HTMLElement>("#wave-briefing").textContent = preview
    ? preview.briefing
      + (previewBossLimit !== null ? " · 제한시간 내 보스 처치 필수" : "")
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
    : state.phase === "prep" ? 1 - state.prepRemaining / GAME_CONFIG.prepSeconds : 0;
  must<HTMLElement>("#wave-progress-fill").style.width = String(Math.max(0, progress) * 100) + "%";
  must<HTMLElement>("#phase-dot").className = state.phase === "combat" ? "phase-dot--combat" : state.phase === "prep" ? "phase-dot--prep" : "";
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.mode === state.automationMode));
  renderGoal();
  renderEvolutions();
  renderSelected();
  renderCompositionDrawer();
  renderRunInventory();
  renderSynergies();
  renderIdiomHud();
}

function renderGoal(): void {
  const progress = engine.goalProgress();
  const key = engine.state.targetChar + "|" + progress.directMaterials.map((item) => item.char + ":" + String(item.owned) + "/" + String(item.needed)).join(",") + "|" + String(engine.state.goalsCompleted.length);
  if (key === goalRenderKey) return;
  goalRenderKey = key;
  must<HTMLElement>("#goal-glyph").textContent = progress.target.char;
  must<HTMLElement>("#goal-glyph").style.setProperty("--goal-color", ELEMENT_STYLES[progress.target.wuxing].color);
  must<HTMLElement>("#goal-stage").textContent = STAGE_NAMES[progress.target.stage] + " · " + progress.target.combat.abilities.role.name;
  must<HTMLElement>("#goal-recipe").textContent = progress.target.parents.join(" + ") + " → " + progress.target.char;
  const learning = learningInfo(engine.state.region, progress.target.char);
  must<HTMLElement>("#goal-reading").textContent = learning.readingLabel + " · " + learning.short;
  must<HTMLElement>("#goal-materials").innerHTML = progress.directMaterials.map((material) => {
    const complete = material.owned >= material.needed;
    return `<span class="${complete ? "is-complete" : ""}"><b>${material.char}</b> ${material.owned}/${material.needed}</span>`;
  }).join("");
  must<HTMLElement>("#goal-progress-fill").style.width = String(Math.round(progress.progress * 100)) + "%";
}

function renderEvolutions(): void {
  const options = engine.availableEvolutions();
  const key = engine.state.automationMode + "|" + String(engine.state.selectedTowerId) + "|" + options.map((option) => option.recipeId + ":" + option.materialTowerIds.join(",")).join("|");
  must<HTMLElement>("#evolution-count").textContent = String(options.length);
  must<HTMLElement>("#evolve-ready-count").textContent = String(options.length);
  const evolveButton = must<HTMLButtonElement>("#evolve-button");
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
  container.innerHTML = options.slice(0, 3).map((option, index) => evolutionCard(option, index)).join("");
}

function evolutionCard(option: EvolutionOption, index: number): string {
  const style = ELEMENT_STYLES[option.result.wuxing];
  const visual = jaryeongVisualFor(option.result.char, option.result.wuxing);
  const abilities = option.result.combat.abilities;
  const abilitySummary = abilities.role.glyph + " " + abilities.role.name + (abilities.lineage ? " · " + abilities.lineage.glyph + " 계승" : "");
  return `
    <button class="evolution-card ${option.onTargetPath ? "is-target" : ""}" type="button" data-recipe="${option.recipeId}" style="--evo:${style.color}" title="합성 시 ${abilities.role.name}${abilities.lineage ? "와 " + abilities.lineage.name : ""} 획득">
      <span class="evolution-index">${index + 1}</span>
      <span class="recipe-parents">${option.parents.map((parent) => "<i>" + parent + "</i>").join("<em>+</em>")}</span>
      <span class="recipe-arrow">→</span>
      <span class="evolution-spirit" style="background-image:url('${import.meta.env.BASE_URL}assets/jaryeongs/${visual.id}/sheet-transparent.png')" aria-hidden="true"></span>
      <b class="recipe-result">${option.result.char}</b>
      <small>${STAGE_NAMES[option.result.stage]} · <b>${abilitySummary}</b></small>
      ${option.onTargetPath ? '<mark>목표 경로</mark>' : ""}
    </button>
  `;
}

function syncSelectedCharge(card: HTMLElement, definition: HanziDefinition, chargeStep: number): void {
  const ability = definition.combat.abilities.role;
  const signatureEvery = definition.combat.abilities.tuning.signatureEvery;
  const charge = chargeStep / signatureEvery;
  const remaining = signatureEvery - chargeStep;
  const meter = card.querySelector<HTMLElement>(".ability-charge i");
  const label = card.querySelector<HTMLElement>(".ability-charge small");
  const holder = card.querySelector<HTMLElement>(".ability-charge");
  if (meter) meter.style.width = `${Math.round(charge * 100)}%`;
  if (label) label.textContent = `${ability.glyph} ${ability.name} · ${chargeStep}/${signatureEvery}`;
  if (holder) holder.title = `${ability.name}까지 ${remaining}회`;
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
  const key = tower ? tower.definitionId + "|" + String(tower.id) + "|" + String(tower.locked) + "|" + String(stored) + "|" + String(engine.isSynergyActive(tower.wuxing)) + "|" + branchKey + `|C${concentration}:${concentrationPath ?? "none"}:D${duplicateCount}:E${engine.state.elementEssence[tower.wuxing]}` : "none";
  if (key === selectedRenderKey) {
    if (tower && definition) syncSelectedCharge(card, definition, chargeStep);
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
  const damage = Math.round(definition.combat.baseDamage * STAGE_MULTIPLIERS[tower.stage] * definition.combat.budgetMultiplier * (1 + engine.idiomBonus("damage")) * (1 + engine.combinedUpgradeBonus(tower.wuxing, "damage")) * concentrationDamage);
  const range = definition.combat.range + engine.idiomBonus("range") + concentration * 4 + engine.combinedUpgradeBonus(tower.wuxing, "range");
  const attacksPerSecond = 1 / engine.towerAttackCooldown(tower);
  const learning = learningInfo(engine.state.region, tower.char);
  const abilities = definition.combat.abilities;
  const abilityList = [abilities.semantic, abilities.element, abilities.role, abilities.graph, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability));
  const readyBranches = branches.filter((branch) => branch.ready).length;
  const charge = chargeStep / abilities.tuning.signatureEvery;
  const remaining = abilities.tuning.signatureEvery - chargeStep;
  const essenceCost = concentrationEssenceCost(concentration);
  const canUseDuplicate = duplicateCount > 0;
  const concentrationPayment = canUseDuplicate ? `중복 ${duplicateCount}기` : `${tower.wuxing} 문기 ${engine.state.elementEssence[tower.wuxing]}/${essenceCost}`;
  const concentrationControls = concentration >= MAX_CONCENTRATION_LEVEL
    ? '<button id="concentrate-max-button" type="button" disabled>濃 3/3 완성</button>'
    : concentrationPath
      ? `<button id="concentrate-${concentrationPath}-button" type="button">濃 ${concentration + 1}/3 · ${concentrationPath === "swift" ? "연속" : "심화"}</button>`
      : '<button id="concentrate-swift-button" type="button">연속 농축</button><button id="concentrate-potent-button" type="button">심화 농축</button>';
  const cleanup = engine.cleanupAssessments().find((assessment) => assessment.towerId === tower.id);
  const cleanupLabel = cleanup?.protected
    ? `보호 · ${cleanup.protectedReasons[0] ?? "전략 재료"}`
    : `정리 후보 · ${cleanup?.reasons[0] ?? "직접 판단"}`;
  card.innerHTML = `
    <div class="selected-glyph" style="--unit:${style.color};--stage:${STAGE_COLORS[tower.stage]}">${tower.char}${concentration > 0 ? `<small>濃 ${concentration}</small>` : ""}</div>
    <div class="selected-copy">
      <div><span>${STAGE_NAMES[tower.stage]} · ${style.name}행 · ${ROLE_LABELS[tower.combatRole]}</span><h3>${tower.char} <small>${GRAPH_ROLE_LABELS[tower.graphRole]}</small><i class="selected-radical">${displayMode === "spirit" ? `${learning.readingLabel} ${escapeHtml(learning.reading)}` : `부수 ${radicalGlyph(tower.char)}`}</i></h3></div>
      <p class="selected-learning"><b>${learning.readingLabel}</b> ${escapeHtml(learning.reading)} · <em>${learning.meaningSource === "en" ? "뜻(영)" : "뜻"} ${escapeHtml(learning.meaning)}</em></p>
      <p><b>${stored ? "배치 대기" : `공격 ${damage}`}</b> · ${stored ? "찬 칸을 누르면 즉시 교체" : `공속 ${attacksPerSecond.toFixed(2)}/초 · 사거리 ${Math.round(range)} · 파생 합성 ${branches.length}`}</p>
      <small class="cleanup-reason ${cleanup?.protected ? "is-protected" : "is-candidate"}">${escapeHtml(cleanupLabel)} · ${escapeHtml(concentrationPayment)}</small>
    </div>
    <div class="selected-actions">
      <button id="lock-button" class="${tower.locked ? "is-locked" : ""}" type="button" data-testid="lock-tower">${tower.locked ? "鎖 잠금됨" : "잠금"}</button>
      <button id="store-button" type="button" data-testid="store-tower" ${stored ? "disabled" : ""}>${stored ? "인벤 보관 중" : "인벤 넣기"}</button>
      <button id="derivative-button" class="${readyBranches > 0 ? "has-ready" : ""}" type="button" data-testid="derivative-composition">파생 합성 ${readyBranches}</button>
      <button id="sell-button" type="button" ${tower.locked ? "disabled" : ""}>판매 +${sellValue(tower.stage)}</button>
      <button id="dismantle-button" type="button" ${tower.locked ? "disabled" : ""}>분해 ${tower.wuxing}+${dismantleEssenceValue(tower.stage, concentration)}</button>
      ${concentrationControls}
    </div>
    <div class="ability-pills">${abilityList.map((ability) => `<span style="--ability:${ability.color}" title="${ability.trigger} · ${ability.description}"><i>${ability.glyph}</i><b>${ability.name}<small>${ability.summary}</small></b></span>`).join("")}</div>
    <div class="ability-charge" title="${abilities.role.name}까지 ${remaining}회"><i style="width:${Math.round(charge * 100)}%;--charge:${abilities.role.color}"></i><small>${abilities.role.glyph} ${abilities.role.name} · ${chargeStep}/${abilities.tuning.signatureEvery}</small></div>
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
  const visual = jaryeongVisualFor(branch.result.char, branch.result.wuxing);
  const missing = branch.materials.filter((material) => material.towerId === null).map((material) => material.char);
  return `
    <button class="composition-branch ${branch.ready ? "is-ready" : "is-missing"} ${branch.onTargetPath ? "is-target" : ""}" type="button" data-composition-recipe="${branch.recipeId}" aria-disabled="${String(!branch.ready)}" style="--branch:${style.color}">
      <i class="composition-result-spirit" style="background-image:url('${import.meta.env.BASE_URL}assets/jaryeongs/${visual.id}/sheet-transparent.png')" aria-hidden="true"></i>
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

function renderSynergies(): void {
  const active = new Set(engine.activeSynergies());
  must<HTMLElement>("#synergy-strip").innerHTML = WUXING_ORDER.map((wuxing) => {
    const style = ELEMENT_STYLES[wuxing];
    return `<span class="${active.has(wuxing) ? "is-active" : ""}" style="--element:${style.color}" title="${style.combatDescription}"><b>${wuxing}</b><small>${style.name}</small></span>`;
  }).join('<i aria-hidden="true">›</i>');
}

function renderIdiomHud(): void {
  const target = engine.currentIdiomTarget();
  const ownedSignature = engine.state.towers.map((tower) => tower.char).sort().join("");
  const key = engine.state.idiomSeals.map((seal) => seal.idiomId).join(",") + "|" + (target?.id ?? "done") + "|" + ownedSignature;
  if (key === idiomRenderKey) return;
  idiomRenderKey = key;
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

const ROLE_STRATEGY: Record<HanziDefinition["combat"]["role"], string> = {
  rapid: "공격 간격이 짧아 빠른 적과 단일 잔여 적을 정리하기 좋습니다.",
  burst: "충전 뒤 큰 피해를 주므로 보스전과 고체력 적에게 집중 배치하세요.",
  splash: "군집을 빠르게 줄입니다. 길이 겹치는 모서리 구간에서 효율이 높습니다.",
  control: "이동 방해로 공격 시간을 벌어줍니다. 화력 자령 앞쪽에 배치하세요.",
  support: "주변 자령의 공격 흐름을 보조합니다. 여러 자령이 닿는 중앙이 유리합니다.",
  economy: "전투 중 엽전을 보충해 소환·연구를 앞당깁니다. 초중반 가치가 높습니다."
};

function definitionMatches(definition: HanziDefinition, normalized: string): boolean {
  if (!normalized) return true;
  const learning = learningInfo(engine.state.region, definition.char);
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
    abilities.lineage?.name ?? ""
  ].join(" ").toLowerCase();
  return searchable.includes(normalized.toLowerCase());
}

function spriteStyle(definition: HanziDefinition): string {
  const visual = jaryeongVisualFor(definition.char, definition.wuxing);
  return `background-image:url('${import.meta.env.BASE_URL}assets/jaryeongs/${visual.id}/sheet-transparent.png')`;
}

function setCodexMode(mode: CodexMode): void {
  codexMode = mode;
  document.querySelectorAll<HTMLButtonElement>("[data-codex-mode]").forEach((button) => {
    const selected = button.dataset.codexMode === mode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  const search = must<HTMLInputElement>("#codex-search");
  search.placeholder = mode === "inventory" ? "보유 자령 검색" : mode === "recipes" ? "결과·재료·능력 검색" : mode === "idioms" ? "사자성어·효과 검색" : "한자·훈음·능력 검색";
  renderCodex(search.value);
}

function renderCodexSynthesisFilters(definitions: HanziDefinition[], depths: Map<string, number>): void {
  const filters = must<HTMLElement>("#codex-synthesis-filters");
  if (codexMode === "idioms") {
    filters.hidden = true;
    return;
  }
  filters.hidden = false;
  const counts = new Map<number, number>();
  for (const definition of definitions) {
    const depth = depths.get(definition.char) ?? 0;
    counts.set(depth, (counts.get(depth) ?? 0) + 1);
  }
  if (codexSynthesisDepth !== "all" && !counts.has(codexSynthesisDepth)) codexSynthesisDepth = "all";
  const options = [...counts.entries()].sort(([left], [right]) => left - right);
  filters.innerHTML = [
    `<button type="button" data-synthesis-depth="all" class="${codexSynthesisDepth === "all" ? "is-active" : ""}" aria-pressed="${String(codexSynthesisDepth === "all")}">전체 <small>${definitions.length}</small></button>`,
    ...options.map(([depth, count]) => `<button type="button" data-synthesis-depth="${depth}" class="${codexSynthesisDepth === depth ? "is-active" : ""}" aria-pressed="${String(codexSynthesisDepth === depth)}">${synthesisDepthLabel(depth)} <small>${count}</small></button>`)
  ].join("");
}

function renderCodex(query = ""): void {
  const normalized = query.trim();
  const list = must<HTMLElement>("#codex-list");
  const regionalInventory = inventoryEntriesForRegion(jaryeongInventory, engine.state.region);
  must<HTMLElement>("#codex-region").textContent = REGION_META[engine.state.region].title;
  must<HTMLElement>("#inventory-count").textContent = String(regionalInventory.length);

  if (codexMode === "idioms") {
    renderCodexSynthesisFilters([], new Map());
    const activeIds = new Set(engine.idioms().map((idiom) => idiom.id));
    const idioms = engine.allIdioms().filter((idiom) => !normalized || [idiom.chars, idiom.reading, idiom.meaning, idiom.bonus.label].join(" ").includes(normalized));
    must<HTMLElement>("#codex-summary").textContent = `성어 ${idioms.length}/${engine.allIdioms().length} · 이번 런 목표 ${engine.idioms().length}개`;
    list.className = "codex-list codex-list--idioms";
    list.innerHTML = idioms.map((idiom) => {
      const sealed = engine.state.idiomSeals.some((seal) => seal.idiomId === idiom.id);
      const active = activeIds.has(idiom.id);
      return `<button type="button" data-codex-idiom="${idiom.id}" class="codex-idiom-card ${sealed ? "is-discovered" : ""} ${active ? "is-featured" : ""}" style="--codex:${idiom.color}"><b>${idiom.chars}</b><span>${idiom.reading}</span><small>${active ? "이번 런 · " : ""}${idiom.bonus.label}</small></button>`;
    }).join("") || '<p class="codex-empty">검색 결과가 없습니다.</p>';
    renderIdiomCodexDetail(idioms[0]);
    return;
  }

  const synthesisDepths = buildSynthesisDepths(engine.catalog.definitions.values());
  let definitions = codexMode === "recipes" ? [...engine.catalog.recipes] : [...engine.catalog.definitions.values()];
  if (codexMode === "inventory") {
    const owned = new Set(regionalInventory.map((entry) => entry.char));
    definitions = definitions.filter((definition) => owned.has(definition.char));
  }
  renderCodexSynthesisFilters(definitions, synthesisDepths);
  if (codexSynthesisDepth !== "all") definitions = definitions.filter((definition) => (synthesisDepths.get(definition.char) ?? 0) === codexSynthesisDepth);
  definitions = definitions.filter((definition) => definitionMatches(definition, normalized));
  definitions.sort((a, b) => (synthesisDepths.get(a.char) ?? 0) - (synthesisDepths.get(b.char) ?? 0) || a.stage - b.stage || a.char.localeCompare(b.char, "ko"));
  list.className = codexMode === "recipes" ? "codex-list codex-list--recipes" : codexMode === "inventory" ? "codex-list codex-list--inventory" : "codex-list";

  if (codexMode === "recipes") {
    must<HTMLElement>("#codex-summary").textContent = `조합 ${definitions.length.toLocaleString("ko-KR")}/${engine.catalog.recipes.length.toLocaleString("ko-KR")}식 · 재료 → 결과 순서 · ${codexSynthesisDepth === "all" ? "전체 단계" : synthesisDepthLabel(codexSynthesisDepth)}`;
    list.innerHTML = definitions.map((definition) => `<button type="button" data-codex-recipe="${definition.char}" class="codex-recipe-card" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}"><span class="codex-recipe-formula">${definition.parents.map((parent) => `<i>${parent}</i>`).join("<em>+</em>")}<em>→</em><b>${definition.char}</b></span><span>${escapeHtml(learningInfo(engine.state.region, definition.char).short)}</span><small>${synthesisDepthLabel(synthesisDepths.get(definition.char) ?? 0)} · ${STAGE_NAMES[definition.stage]} · ${definition.combat.abilities.role.name}</small></button>`).join("");
  } else if (codexMode === "inventory") {
    const counts = new Map(regionalInventory.map((entry) => [entry.char, entry]));
    must<HTMLElement>("#codex-summary").textContent = `보유 ${definitions.length}종 · 브라우저 자동 저장 · 기록 ${inventoryRevision}`;
    list.innerHTML = definitions.map((definition) => {
      const entry = counts.get(definition.char);
      return `<button type="button" data-codex-char="${definition.char}" class="is-discovered inventory-card" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}"><i class="codex-spirit" style="${spriteStyle(definition)}"></i><b>${definition.char}</b><span>${escapeHtml(learningInfo(engine.state.region, definition.char).short)}</span><small>${synthesisDepthLabel(synthesisDepths.get(definition.char) ?? 0)} · 소환 ${entry?.summons ?? 0} · 합성 ${entry?.evolutions ?? 0}</small></button>`;
    }).join("");
  } else {
    must<HTMLElement>("#codex-summary").textContent = `${definitions.length.toLocaleString("ko-KR")}/${engine.catalog.definitions.size.toLocaleString("ko-KR")}자 · ${codexSynthesisDepth === "all" ? "전체 단계" : synthesisDepthLabel(codexSynthesisDepth)}`;
    list.innerHTML = definitions.map((definition) => {
      const discovered = engine.state.discoveredChars.includes(definition.char);
      const learning = learningInfo(engine.state.region, definition.char);
      return `<button type="button" data-codex-char="${definition.char}" class="${discovered ? "is-discovered" : ""}" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}"><b>${definition.char}</b><span>${escapeHtml(learning.short)}</span><small>${synthesisDepthLabel(synthesisDepths.get(definition.char) ?? 0)} · ${STAGE_NAMES[definition.stage]} · ${definition.combat.abilities.role.name} · ${definition.parents.length ? definition.parents.join("+") : "직접"}</small></button>`;
    }).join("");
  }
  if (definitions.length === 0) list.innerHTML = '<p class="codex-empty">검색 결과가 없습니다.</p>';
  renderCodexDetail(definitions[0] ?? engine.catalog.definitions.get(engine.state.targetChar));
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
  const discovered = engine.state.discoveredChars.includes(definition.char);
  const learning = learningInfo(engine.state.region, definition.char);
  const abilities = definition.combat.abilities;
  const abilityList = [abilities.semantic, abilities.element, abilities.role, abilities.graph, abilities.lineage].filter((ability): ability is AbilitySpec => Boolean(ability));
  const inventoryEntry = jaryeongInventory.entries[`${engine.state.region}:${definition.char}`];
  const children = engine.catalog.recipes.filter((candidate) => candidate.parents.includes(definition.char)).sort((a, b) => a.stage - b.stage).slice(0, 12);
  const recipeSteps = recipeStepsFor(definition.char);
  const synthesisDepth = buildSynthesisDepths(engine.catalog.definitions.values()).get(definition.char) ?? 0;
  const visual = jaryeongVisualFor(definition.char, definition.wuxing);
  detail.innerHTML = `
    <div class="codex-detail-hero" style="--codex:${ELEMENT_STYLES[definition.wuxing].color}">
      <i class="codex-detail-spirit" style="background-image:url('${import.meta.env.BASE_URL}assets/jaryeongs/${visual.id}/sheet-transparent.png')"></i>
      <div class="codex-detail-glyph">${definition.char}</div>
    </div>
    <p class="eyebrow">${definition.id}</p>
    <h3>${synthesisDepthLabel(synthesisDepth)} · ${STAGE_NAMES[definition.stage]} · ${definition.wuxing}행 · ${definition.combat.roleLabel}</h3>
    <div class="codex-stats"><span><small>공격</small><b>${Math.round(definition.combat.baseDamage * STAGE_MULTIPLIERS[definition.stage] * definition.combat.budgetMultiplier)}</b></span><span><small>사거리</small><b>${definition.combat.range}</b></span><span><small>공속</small><b>${definition.combat.cooldown.toFixed(2)}초</b></span><span><small>하위</small><b>${definition.graph.directChildCount}</b></span></div>
    <article class="strategy-note"><b>전략 운용</b><span>${ROLE_STRATEGY[definition.combat.role]} ${definition.combat.description}</span></article>
    <dl>
      <div class="learning-row"><dt>${learning.readingLabel}</dt><dd>${escapeHtml(learning.reading)}</dd></div>
      <div class="learning-row"><dt>${learning.meaningSource === "en" ? "뜻(영)" : "뜻"}</dt><dd>${escapeHtml(learning.meaning)}</dd></div>
      <div class="learning-row"><dt>부수</dt><dd>${radicalLearningLabel(definition.char)}</dd></div>
      <div><dt>획득</dt><dd>${definition.acquisition === "direct" ? "직접 소환" : definition.parents.join(" + ") + " → " + definition.char}</dd></div>
      <div><dt>합성 단계</dt><dd>${synthesisDepthLabel(synthesisDepth)}${synthesisDepth > 0 ? " · 가장 긴 선행 조합 기준" : " · 합성 재료 불필요"}</dd></div>
      <div><dt>전투</dt><dd>${definition.combat.roleLabel} · ${definition.combat.effectLabel}</dd></div>
      <div><dt>조합망</dt><dd>${GRAPH_ROLE_LABELS[definition.graph.graphRole]} · 직접 하위 ${definition.graph.directChildCount}자</dd></div>
      <div><dt>보유 기록</dt><dd>${inventoryEntry ? `소환 ${inventoryEntry.summons}회 · 합성 획득 ${inventoryEntry.evolutions}회 · 자동 저장됨` : "아직 획득 기록 없음"}</dd></div>
      <div><dt>상태</dt><dd>${discovered ? "이번 런 발견" : "이번 런 미발견"}${definition.needsReview ? " · 초벌 검토 대상" : ""}</dd></div>
    </dl>
    <div class="codex-abilities">
      ${abilityList.map((ability) => `<article style="--ability:${ability.color}"><b>${ability.glyph}</b><span><strong>${ability.name}</strong><small>${ability.trigger} · ${ability.summary}</small><em>${ability.description}</em></span></article>`).join("")}
    </div>
    <section class="recipe-guide">
      <h4>조합표</h4>
      <div class="recipe-guide-main">${definition.acquisition === "direct" ? `<span><b>${definition.char}</b><small>직접 소환</small></span>` : `${definition.parents.map((parent) => `<span><b>${parent}</b><small>${escapeHtml(learningInfo(engine.state.region, parent).short)}</small></span>`).join("<em>+</em>")}<em>→</em><span class="is-result"><b>${definition.char}</b><small>${escapeHtml(learning.short)}</small></span>`}</div>
      ${recipeSteps.length ? `<ol>${recipeSteps.map((step, index) => `<li><b>${index + 1}</b><span>${step.parents.join(" + ")} → <strong>${step.char}</strong></span></li>`).join("")}</ol>` : ""}
      <p><b>이 글자로 이어지는 조합</b> ${children.length ? children.map((child) => `<button type="button" data-codex-char="${child.char}">${definition.char} → ${child.char}</button>`).join("") : "현재 직접 하위 조합 없음"}</p>
    </section>
    <p class="combo-key">능력 조합 코드 · ${abilities.comboKey}</p>
    ${definition.acquisition === "craft" ? `<button id="set-target-button" type="button" data-target-char="${definition.char}">이 한자를 목표로 지정</button>` : ""}
  `;
}

function renderRunInventory(): void {
  const selectedId = engine.state.selectedTowerId;
  const key = engine.state.inventoryTowers.map((tower) => `${tower.id}:${tower.locked}:C${tower.concentration ?? 0}:${tower.concentrationPath ?? "-"}`).join("|") + `|${selectedId ?? "none"}|${engine.state.phase}`;
  must<HTMLElement>("#run-inventory-count").textContent = String(engine.state.inventoryTowers.length);
  if (key === runInventoryRenderKey) return;
  runInventoryRenderKey = key;
  const list = must<HTMLElement>("#run-inventory-list");
  const grouped = new Map<string, Tower[]>();
  for (const tower of engine.state.inventoryTowers) grouped.set(tower.char, [...(grouped.get(tower.char) ?? []), tower]);
  must<HTMLElement>("#run-inventory-heading-count").textContent = `${engine.state.inventoryTowers.length}개 · ${grouped.size}종`;
  const cleanupAssessments = new Map(engine.cleanupAssessments().map((assessment) => [assessment.towerId, assessment]));
  const cleanupCandidates = engine.cleanupCandidates(8, true);
  const active = engine.state.phase === "prep" || engine.state.phase === "combat";
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
    const tower = selectedTower && selectedTower.char === stack[0]?.char ? selectedTower : stack.find((candidate) => !candidate.locked) ?? stack[0]!;
    const definition = definitionForTower(engine.catalog, tower.definitionId);
    const visual = jaryeongVisualFor(tower.char, tower.wuxing);
    const learning = learningInfo(engine.state.region, tower.char);
    const selected = tower.id === selectedId;
    const candidates = stack.filter((candidate) => cleanupAssessments.get(candidate.id)?.protected === false).length;
    const concentration = Math.max(...stack.map((candidate) => candidate.concentration ?? 0));
    return `<button class="run-inventory-card ${selected ? "is-selected" : ""} ${candidates > 0 ? "is-cleanup-candidate" : "is-protected-stack"}" type="button" data-run-inventory-id="${tower.id}" style="--inventory-element:${ELEMENT_STYLES[tower.wuxing].color}">
      <span class="run-inventory-spirit" style="background-image:url('${import.meta.env.BASE_URL}assets/jaryeongs/${visual.id}/sheet-transparent.png')" aria-hidden="true"></span>
      <b>${tower.char}</b>
      <span><strong>${escapeHtml(learning.short)} <i>×${stack.length}</i></strong><small>${STAGE_NAMES[tower.stage]} · ${definition.combat.abilities.semantic.name}${concentration > 0 ? ` · 濃 ${concentration}` : ""}</small></span>
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
  drawPaperBackdrop();
  context.save();
  context.translate(mapOffset.x, mapOffset.y);
  context.scale(mapZoom, mapZoom);
  drawTrack();
  drawBoard();
  drawCompositionMaterialLinks();
  drawIdiomSeals();
  drawSelection();
  for (const enemy of state.enemies) drawEnemy(enemy);
  for (const tower of [...state.towers].sort((a, b) => a.cell - b.cell)) drawTower(tower);
  updateAndDrawFx(delta);
  context.restore();
  drawHoveredTowerCard();
}

function drawPaperBackdrop(): void {
  canvas.dataset.mapSurface = "hanji-ink";
  // Keep the paper on the CSS compositor instead of repainting and resampling it every frame.
  // The canvas is cleared to transparency, so only the moving game layers are redrawn.
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawTrack(): void {
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  traceEnemyPath();
  context.strokeStyle = "rgba(61, 47, 34, 0.18)";
  context.lineWidth = 38;
  context.shadowColor = "rgba(47, 35, 24, 0.28)";
  context.shadowBlur = 5;
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(24, 23, 19, 0.78)";
  context.lineWidth = 31;
  context.stroke();
  context.strokeStyle = "rgba(8, 10, 9, 0.72)";
  context.lineWidth = 23;
  context.stroke();

  // Fine paper-colored gaps break the perfect vector edge into a dry brush.
  context.setLineDash([2, 17, 5, 31, 1, 12]);
  context.lineDashOffset = 7;
  context.strokeStyle = "rgba(231, 217, 181, 0.2)";
  context.lineWidth = 2.2;
  context.stroke();
  context.setLineDash([]);

  // Calligraphic chevrons sit on exact segment midpoints so every turn remains predictable.
  context.strokeStyle = "rgba(238, 222, 181, 0.76)";
  context.lineWidth = 3.2;
  for (let index = 0; index < ENEMY_PATH_POINTS.length - 1; index += 1) {
    const from = ENEMY_PATH_POINTS[index] as Point;
    const to = ENEMY_PATH_POINTS[index + 1] as Point;
    const x = (from.x + to.x) / 2;
    const y = (from.y + to.y) / 2;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    for (const offset of [-5, 5]) {
      context.beginPath();
      context.moveTo(offset - 6, -6);
      context.quadraticCurveTo(offset - 1, -1, offset + 2, 0);
      context.quadraticCurveTo(offset - 1, 1, offset - 6, 6);
      context.stroke();
    }
    context.restore();
  }

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
    context.fillStyle = "rgba(3, 5, 4, 0.34)";
    context.beginPath();
    context.ellipse(-7, 0, 12, 3.8, 0, 0, Math.PI * 2);
    context.fill();
    const bead = context.createRadialGradient(-1.5, -2, 0.6, 0, 0, 6.4);
    bead.addColorStop(0, "rgba(86, 91, 85, 0.88)");
    bead.addColorStop(0.18, "rgba(22, 27, 24, 0.98)");
    bead.addColorStop(0.72, "rgba(3, 5, 4, 0.98)");
    bead.addColorStop(1, "rgba(2, 3, 2, 0.18)");
    context.fillStyle = bead;
    context.beginPath();
    context.arc(0, 0, 6.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(218, 209, 183, 0.24)";
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
    const point = positionOnPath(ENEMY_SPAWN_PROGRESS[index] as number);
    const labelOffset = labelOffsets[index] as Point;
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
    context.fillStyle = "#493426";
    context.font = '900 9px "Malgun Gothic", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`출구 ${index + 1}`, point.x + labelOffset.x, point.y + labelOffset.y);
  }
}

function drawBoard(): void {
  context.save();
  context.textAlign = "center";
  const occupied = new Set(engine.state.towers.map((tower) => tower.cell));
  for (let formationIndex = 0; formationIndex < BOARD_FORMATIONS.length; formationIndex += 1) {
    const formation = BOARD_FORMATIONS[formationIndex] as (typeof BOARD_FORMATIONS)[number];
    const resonance = engine.formationResonance(formationIndex);
    const inkColor = INK_ELEMENT_COLORS[formation.preferredWuxing];
    context.fillStyle = formation.color + (resonance.tier > 0 ? "2b" : "1c");
    context.strokeStyle = "rgba(65, 48, 31, 0.48)";
    context.lineWidth = formation.id === "center" ? 2.2 : 1.5;
    context.beginPath();
    context.roundRect(formation.center.x - 91, formation.center.y - 91, 182, 182, 13);
    context.fill();
    context.stroke();
    context.strokeStyle = formation.color + "66";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = inkColor + (resonance.tier > 0 ? "b8" : "88");
    context.font = '900 25px "Batang", serif';
    context.fillText(formation.preferredWuxing, formation.center.x, formation.center.y + 7);
    context.fillStyle = inkColor;
    context.font = '900 9px "Malgun Gothic", sans-serif';
    const bonusLabel = resonance.damageBonus > 0 ? ` · 피해 +${Math.round(resonance.damageBonus * 100)}%` : "";
    context.fillText(`${formation.label} ${resonance.matching}/16${bonusLabel}`, formation.center.x, formation.center.y - 78);
  }
  for (let index = 0; index < BOARD_CELLS.length; index += 1) {
    const cell = BOARD_CELLS[index] as Point;
    context.fillStyle = occupied.has(index) ? "rgba(255, 251, 229, 0.3)" : "rgba(255, 251, 229, 0.13)";
    context.strokeStyle = occupied.has(index) ? "rgba(58, 43, 29, 0.42)" : "rgba(65, 50, 33, 0.24)";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(cell.x - 19, cell.y - 19, 38, 38, 6);
    context.fill();
    context.stroke();
    if (!occupied.has(index)) {
      context.fillStyle = "rgba(67, 49, 31, 0.23)";
      context.font = '700 11px "Malgun Gothic", serif';
      context.fillText("·", cell.x, cell.y + 4);
    }
  }
  context.restore();
}

function drawIdiomSeals(): void {
  for (const seal of engine.state.idiomSeals) {
    const idiom = idiomById(engine.state.region, seal.idiomId);
    if (!idiom) continue;
    const points = seal.cells.map((cell) => BOARD_CELLS[cell] as Point);
    context.save();
    context.globalAlpha = 0.48;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = idiom.color;
    context.shadowColor = idiom.color;
    context.shadowBlur = 18;
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    context.globalAlpha = 0.82;
    context.strokeStyle = "#fff7dc";
    context.shadowBlur = 0;
    context.lineWidth = 2;
    context.stroke();
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index] as Point;
      context.fillStyle = idiom.color;
      context.beginPath();
      context.arc(point.x, point.y, 6, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(point.x + 41, point.y - 41, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#081019";
      context.font = '900 13px "Malgun Gothic", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(index + 1), point.x + 41, point.y - 40);
    }
    context.restore();
  }
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
  context.arc(cell.x, cell.y, definition.combat.range + (tower.stage - 1) * 7 + engine.idiomBonus("range") + (tower.concentration ?? 0) * 4 + engine.combinedUpgradeBonus(tower.wuxing, "range"), 0, Math.PI * 2);
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
  const pulse = 1 + tower.pulse * 0.09;
  const radius = (16 + (tower.stage - 1) * 0.8) * pulse;
  context.shadowColor = material ? "#ffe7a3" : style.glow;
  context.shadowBlur = material ? 28 : selected ? 22 : 10 + tower.stage * 2;
  const gradient = context.createRadialGradient(cell.x - 3, cell.y - 4, 2, cell.x, cell.y, radius);
  gradient.addColorStop(0, style.color + "ee");
  gradient.addColorStop(0.28, style.color + "88");
  gradient.addColorStop(1, "#111925");
  context.fillStyle = gradient;
  context.strokeStyle = material ? "#fff0b7" : selected ? "#ffffff" : STAGE_COLORS[tower.stage];
  context.lineWidth = material || selected ? 2 : 1 + tower.stage * 0.15;
  context.beginPath();
  context.arc(cell.x, cell.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  drawChargeRing(cell, radius + 3, tower, abilities);
  context.fillStyle = "#fbfdff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 ' + String(17 + tower.stage) + 'px "Malgun Gothic", "Noto Sans CJK KR", serif';
  context.fillText(tower.char, cell.x, cell.y - 2);
  context.textBaseline = "alphabetic";
  context.font = '900 8px "Malgun Gothic", sans-serif';
  context.fillStyle = "#efe4c8";
  context.fillText(learningInfo(engine.state.region, tower.char).short, cell.x, cell.y + 24, 40);
}

function drawSpiritTowerLabel(tower: Tower, cell: Point, selected: boolean, material: boolean): void {
  const style = ELEMENT_STYLES[tower.wuxing];
  const learning = learningInfo(engine.state.region, tower.char);
  const glyphOnly = mapZoom / BASE_MAP_ZOOM < 0.6;
  const emphasized = hanjaEmphasis;
  const width = glyphOnly ? 36 : emphasized ? 56 : 44;
  const height = glyphOnly ? 36 : emphasized ? 54 : 22;
  const top = glyphOnly ? -52 : emphasized ? -70 : -39;

  context.save();
  context.translate(cell.x, cell.y);
  // Counter-scale the label so Hanja stays readable while the map zooms and pans.
  context.scale(1 / mapZoom, 1 / mapZoom);
  context.fillStyle = emphasized ? "rgba(4, 9, 16, 0.96)" : "rgba(4, 10, 18, 0.92)";
  context.strokeStyle = selected || material ? "#fff1bf" : style.color;
  context.lineWidth = selected || material ? 2.4 : emphasized ? 1.7 : 1.25;
  context.shadowColor = selected || material ? "rgba(255, 231, 164, 0.55)" : "rgba(0, 0, 0, 0.4)";
  context.shadowBlur = selected || material ? 12 : 6;
  context.beginPath();
  context.roundRect(-width / 2, top, width, height, emphasized ? 8 : 5);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fff8e8";
  context.font = `900 ${glyphOnly ? 26 : emphasized ? 28 : 17}px "Malgun Gothic", "Noto Sans CJK KR", serif`;
  context.fillText(tower.char, !glyphOnly && !emphasized ? -13 : 0, top + (glyphOnly ? 19 : emphasized ? 19 : 11), emphasized || glyphOnly ? width - 8 : 16);
  if (!glyphOnly && emphasized) {
    context.strokeStyle = "rgba(225, 236, 248, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(-width / 2 + 6, top + 36);
    context.lineTo(width / 2 - 6, top + 36);
    context.stroke();
    context.fillStyle = "#f1e5c8";
    context.font = '900 13px "Malgun Gothic", sans-serif';
    context.fillText(learning.short, 0, top + 46, width - 7);
  } else if (!glyphOnly) {
    context.fillStyle = "#f2e7cc";
    context.font = '900 8px "Malgun Gothic", sans-serif';
    context.fillText(learning.short, 12, top + 12, 24);
  }
  context.restore();
}

function drawSpiritTower(tower: Tower, cell: Point, definition: HanziDefinition, selected: boolean, material: boolean): void {
  const abilities = definition.combat.abilities;
  const style = ELEMENT_STYLES[tower.wuxing];
  const visual = jaryeongVisualFor(tower.char, tower.wuxing);
  const image = jaryeongSpriteImage(visual.id);
  const pulse = 1 + tower.pulse * 0.055;
  const auraRadius = 17 + (tower.stage - 1) * 0.6;

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

  context.strokeStyle = material ? "#fff0b7" : selected ? "#ffffff" : STAGE_COLORS[tower.stage];
  context.lineWidth = material || selected ? 3 : 1.5;
  context.shadowColor = material ? "#fff0b7" : style.glow;
  context.shadowBlur = material ? 12 : selected ? 9 : 4;
  context.beginPath();
  context.ellipse(cell.x, cell.y + 15, auraRadius, 6, 0, 0, Math.PI * 2);
  context.stroke();
  context.shadowBlur = 0;
  drawChargeRing({ x: cell.x, y: cell.y + 1 }, 20, tower, abilities);

  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const frame = tower.abilityFlash > 0.08 ? 2 : reducedMotion ? 0 : Math.floor((engine.state.elapsed + tower.id * 0.31) * 1.15) % 2;
    const frameWidth = image.naturalWidth / 2;
    const frameHeight = image.naturalHeight / 2;
    const drawSize = (42 + tower.stage) * pulse;
    context.shadowColor = style.glow;
    context.shadowBlur = selected ? 13 : 5;
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
    context.shadowBlur = 0;
  }

  drawSpiritTowerLabel(tower, cell, selected, material);
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

function drawTower(tower: Tower): void {
  const cell = BOARD_CELLS[tower.cell] as Point;
  const definition = definitionForTower(engine.catalog, tower.definitionId);
  const selected = tower.id === engine.state.selectedTowerId;
  const material = hoveredMaterialIds().has(tower.id);
  context.save();
  if (displayMode === "study") drawStudyTower(tower, cell, definition, selected, material);
  else drawSpiritTower(tower, cell, definition, selected, material);
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  if (engine.isSynergyActive(tower.wuxing)) {
    if (displayMode === "spirit") {
      context.fillStyle = "rgba(5, 12, 19, 0.88)";
      context.beginPath();
      context.roundRect(cell.x + 5, cell.y + 14, 18, 9, 4);
      context.fill();
    }
    context.fillStyle = "#fff2b5";
    context.font = "900 6px sans-serif";
    context.fillText("相生", cell.x + 14, cell.y + 21);
  }
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

function drawHoveredTowerCard(): void {
  const tower = hoveredTowerId === null ? undefined : engine.state.towers.find((candidate) => candidate.id === hoveredTowerId);
  if (!tower || mapPanPointerId !== null || towerDragMoved) return;
  const cell = BOARD_CELLS[tower.cell] as Point;
  const point = { x: mapOffset.x + cell.x * mapZoom, y: mapOffset.y + cell.y * mapZoom };
  if (point.x < -24 || point.x > WORLD_WIDTH + 24 || point.y < -24 || point.y > WORLD_HEIGHT + 24) return;
  const definition = definitionForTower(engine.catalog, tower.definitionId);
  const style = ELEMENT_STYLES[tower.wuxing];
  const learning = learningInfo(engine.state.region, tower.char);
  const width = 178;
  const height = 112;
  const x = point.x + 36 + width > WORLD_WIDTH - 10 ? point.x - width - 36 : point.x + 36;
  const y = Math.min(WORLD_HEIGHT - height - 18, Math.max(72, point.y - height / 2));
  const anchorX = x > point.x ? x : x + width;
  const anchorY = Math.min(y + height - 18, Math.max(y + 18, point.y));

  context.save();
  context.strokeStyle = style.color + "bb";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(point.x, point.y - 14);
  context.lineTo(anchorX, anchorY);
  context.stroke();
  context.fillStyle = "rgba(4, 10, 18, 0.97)";
  context.strokeStyle = style.color;
  context.lineWidth = 2;
  context.shadowColor = "rgba(0, 0, 0, 0.55)";
  context.shadowBlur = 18;
  context.beginPath();
  context.roundRect(x, y, width, height, 12);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;

  context.fillStyle = style.color + "24";
  context.beginPath();
  context.roundRect(x + 9, y + 10, 54, 72, 9);
  context.fill();
  context.strokeStyle = style.color + "88";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = "#fff9e8";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '900 38px "Malgun Gothic", "Noto Sans CJK KR", serif';
  context.fillText(tower.char, x + 36, y + 46, 46);

  context.textAlign = "left";
  context.fillStyle = "#f7edcf";
  context.font = '900 16px "Malgun Gothic", sans-serif';
  context.fillText(learning.short, x + 72, y + 26, width - 82);
  context.fillStyle = style.color;
  context.font = '900 12px "Malgun Gothic", sans-serif';
  context.fillText(`${style.name}행 · ${ROLE_LABELS[tower.combatRole]}`, x + 72, y + 48, width - 82);
  context.fillStyle = "#b9c8d9";
  context.font = '800 11px "Malgun Gothic", sans-serif';
  context.fillText(definition.combat.effectLabel, x + 72, y + 69, width - 82);
  context.fillStyle = "rgba(218, 229, 241, 0.16)";
  context.fillRect(x + 10, y + 90, width - 20, 1);
  context.fillStyle = "#8ea1b8";
  context.font = '800 10px "Malgun Gothic", sans-serif';
  context.fillText("클릭: 선택 · 끌기: 교환", x + 12, y + 102, width - 24);
  context.restore();
}

function drawEnemy(enemy: Enemy): void {
  const point = positionOnPath(enemy.progress);
  const colors: Record<Enemy["archetype"], string> = { normal: "#7770d9", swarm: "#bd78e8", swift: "#5bcde1", armored: "#b69b76", regenerator: "#64c489", boss: "#ff627d" };
  const color = colors[enemy.archetype];
  const weaknessColor = ELEMENT_STYLES[enemy.weakness].color;
  const visual = enemyJaryeongVisualFor(enemy.archetype, enemy.id + enemy.wave);
  const image = jaryeongSpriteImage(visual.id);
  const drawSize = enemy.boss ? 70 : enemy.archetype === "swarm" ? 32 : enemy.archetype === "armored" ? 46 : 40;
  const top = point.y - drawSize * 0.43;
  context.save();
  context.translate(point.x, point.y);
  if (enemy.boss) context.rotate(Math.sin(engine.state.elapsed * 2) * 0.025);

  context.save();
  context.translate(0, drawSize * 0.31);
  context.scale(1, 0.3);
  context.fillStyle = weaknessColor + "4d";
  context.shadowColor = weaknessColor;
  context.shadowBlur = enemy.boss ? 18 : 8;
  context.beginPath();
  context.arc(0, 0, drawSize * 0.36, 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const frame = reducedMotion ? 0 : Math.floor((engine.state.elapsed * 2.2 + enemy.id * 0.37)) % 2;
    const frameWidth = image.naturalWidth / 2;
    const frameHeight = image.naturalHeight / 2;
    context.shadowColor = color;
    context.shadowBlur = enemy.boss ? 12 : 5;
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
    context.globalAlpha = hitStrength * 0.62;
    context.strokeStyle = "#30291f";
    context.lineWidth = 2;
    context.setLineDash([3, 4]);
    context.beginPath();
    context.arc(0, 0, drawSize * 0.36 + (1 - hitStrength) * 4, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
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
    context.arc(x, -drawSize * 0.43 - 14, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = status.color;
    context.font = '900 10px "Malgun Gothic", serif';
    context.fillText(status.glyph, x, -drawSize * 0.43 - 13);
  }
  context.restore();
  const width = enemy.boss ? 64 : Math.max(30, drawSize * 0.7);
  context.fillStyle = "rgba(0,0,0,0.72)";
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
  for (const burst of abilityBursts) burst.age += delta;
  for (const popup of towerAbilityPopups.values()) popup.age += delta;
  for (const projectile of projectiles) {
    const ratio = Math.min(1, projectile.age / projectile.duration);
    const x = projectile.from.x + (projectile.to.x - projectile.from.x) * ratio;
    const y = projectile.from.y + (projectile.to.y - projectile.from.y) * ratio;
    context.save();
    context.globalAlpha = 1 - ratio * 0.45;
    context.strokeStyle = projectile.color;
    context.lineWidth = projectile.critical ? 4 : 2;
    context.shadowColor = projectile.color;
    context.shadowBlur = projectile.critical ? 7 : 3;
    context.beginPath();
    context.moveTo(projectile.from.x, projectile.from.y);
    context.lineTo(x, y);
    context.stroke();
    context.fillStyle = projectile.color;
    context.beginPath();
    context.arc(x, y, projectile.critical ? 5 : 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  for (const ring of rings) {
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
    const spread = ["blast", "burst", "spread"].includes(burst.kind) ? 62 : 42;
    context.save();
    context.globalAlpha = 1 - ratio;
    context.strokeStyle = burst.color;
    context.fillStyle = burst.color;
    context.shadowColor = burst.color;
    context.shadowBlur = 14;
    context.lineWidth = burst.kind === "burst" || burst.kind === "critical" ? 4 : 2;
    context.setLineDash(burst.kind === "chain" || burst.kind === "lineage" ? [5, 5] : []);
    context.beginPath();
    context.arc(point.x, point.y, 12 + ratio * spread, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    for (let ray = 0; ray < 8; ray += 1) {
      const angle = ray / 8 * Math.PI * 2 + ratio * 0.5;
      const inner = 16 + ratio * 15;
      const outer = inner + 9 + (burst.kind === "blast" ? 10 : 0);
      context.beginPath();
      context.moveTo(point.x + Math.cos(angle) * inner, point.y + Math.sin(angle) * inner);
      context.lineTo(point.x + Math.cos(angle) * outer, point.y + Math.sin(angle) * outer);
      context.stroke();
    }
    context.shadowBlur = 5;
    context.font = '900 ' + String(17 + Math.round(ratio * 8)) + 'px "Malgun Gothic", serif';
    context.textAlign = "center";
    context.fillText(burst.glyph, point.x, point.y - 22 - ratio * 17);
    context.restore();
  }
  for (const floater of floaters) {
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
  removeExpired(projectiles);
  removeExpired(floaters);
  removeExpired(rings);
  removeExpired(abilityBursts);
  for (const [towerId, popup] of towerAbilityPopups) {
    if (popup.age >= popup.duration || !engine.state.towers.some((tower) => tower.id === towerId)) towerAbilityPopups.delete(towerId);
  }
}

function removeExpired<T extends { age: number; duration: number }>(items: T[]): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item && item.age >= item.duration) items.splice(index, 1);
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
  canvas.dataset.labelDensity = mapZoom / BASE_MAP_ZOOM < 0.6 ? "glyph" : "reading";
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
  const cell = tower && tower.cell >= 0 ? BOARD_CELLS[tower.cell] : undefined;
  if (!cell) return;
  mapOffset = {
    x: WORLD_WIDTH / 2 - cell.x * mapZoom,
    y: WORLD_HEIGHT / 2 - cell.y * mapZoom
  };
  constrainMapCamera();
  syncMapZoomControl();
}

function summonAndFocus(amount = 1): void {
  sound.unlock();
  const result = amount === 1 ? engine.summon() : engine.summonMany(amount);
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
  showToast(hanjaEmphasis ? "한자 강조 ON · 큰 한자와 훈독을 고정 크기로 표시" : "한자 강조 OFF · 자령 중심의 간결한 표찰");
}

function cellAtPoint(point: Point): number {
  return BOARD_CELLS.findIndex((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 21);
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
  const hoverCell = cellAtPoint(canvasPoint(event));
  hoveredTowerId = hoverCell >= 0 ? towerAtCell(hoverCell)?.id ?? null : null;
  canvas.dataset.hoveredTowerId = hoveredTowerId === null ? "" : String(hoveredTowerId);
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
    if (clickCell < 0) {
      engine.selectTower(null);
      evolutionRenderKey = "";
      selectedRenderKey = "";
      syncPanel();
    } else {
      handleAction(engine.moveSelectedToCell(clickCell));
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
});
canvas.addEventListener("pointercancel", (event) => {
  if (!finishMapPan(event, false)) finishTowerDrag(event, false);
});
canvas.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const anchor = canvasScreenPoint(event);
  setMapZoom(mapZoom * Math.exp(-event.deltaY * 0.0012), anchor);
}, { passive: false });
must<HTMLButtonElement>("#map-zoom-reset").addEventListener("click", resetMapCamera);
must<HTMLButtonElement>("#hanja-emphasis-toggle").addEventListener("click", toggleHanjaEmphasis);
must<HTMLButtonElement>("#speed-button").addEventListener("click", cycleGameSpeed);

document.querySelectorAll<HTMLButtonElement>(".region-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectedRegion = button.dataset.region as RegionCode;
    document.querySelectorAll<HTMLButtonElement>(".region-option").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-checked", String(selected));
    });
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => handleAction(engine.setAutomationMode(button.dataset.mode as AutomationMode)));
});

must<HTMLElement>("#evolution-options").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-recipe]");
  if (button?.dataset.recipe) handleAction(engine.evolve(button.dataset.recipe));
});
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
document.querySelectorAll<HTMLButtonElement>("[data-summon-intent]").forEach((button) => {
  button.addEventListener("click", () => handleAction(engine.setSummonIntent(button.dataset.summonIntent as SummonIntent)));
});
must<HTMLButtonElement>("#summon-button").addEventListener("click", () => summonAndFocus());
must<HTMLButtonElement>("#multi-summon-button").addEventListener("click", () => summonAndFocus(10));
must<HTMLButtonElement>("#summon-reveal-close").addEventListener("click", hideSummonReveal);
document.addEventListener("pointerdown", () => {
  if (summonReveal.classList.contains("is-active")) hideSummonReveal();
});
must<HTMLButtonElement>("#evolve-button").addEventListener("click", () => setPanelTab("evolution"));
must<HTMLButtonElement>("#research-button").addEventListener("click", () => { sound.unlock(); handleAction(engine.upgradeResearch()); });
must<HTMLButtonElement>("#auto-arrange-button").addEventListener("click", () => { sound.unlock(); handleAction(engine.autoArrangeTowers()); });
must<HTMLButtonElement>("#element-upgrade-button").addEventListener("click", () => { renderElementUpgrades(); elementUpgradeDialog.showModal(); });
must<HTMLButtonElement>("#element-upgrade-close").addEventListener("click", () => elementUpgradeDialog.close());
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
must<HTMLButtonElement>("#early-button").addEventListener("click", () => { sound.unlock(); handleAction(engine.startWaveEarly()); });
must<HTMLButtonElement>("#help-button").addEventListener("click", () => helpDialog.showModal());
must<HTMLButtonElement>("#title-help-button").addEventListener("click", () => helpDialog.showModal());
must<HTMLButtonElement>("#settings-button").addEventListener("click", () => {
  syncDisplayModeControls();
  syncAutoPlaceControl();
  settingsDialog.showModal();
});

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
  syncDisplayModeControls();
  syncAutoPlaceControl();
  settingsDialog.showModal();
});
must<HTMLButtonElement>("#settings-close").addEventListener("click", () => settingsDialog.close());
document.querySelectorAll<HTMLButtonElement>("[data-display-mode-option]").forEach((button) => {
  button.addEventListener("click", () => {
    setDisplayMode(button.dataset.displayModeOption as DisplayMode);
    settingsDialog.close();
  });
});
must<HTMLButtonElement>("#auto-place-toggle").addEventListener("click", () => {
  const enabled = !engine.state.autoPlaceSummons;
  saveAutoPlaceSummons(enabled);
  handleAction(engine.setAutoPlaceSummons(enabled));
  syncAutoPlaceControl();
});
must<HTMLButtonElement>("#codex-button").addEventListener("click", () => {
  const search = must<HTMLInputElement>("#codex-search");
  search.value = "";
  renderCodex("");
  codexDialog.showModal();
  search.focus();
});
must<HTMLButtonElement>("#codex-close").addEventListener("click", () => codexDialog.close());
document.querySelectorAll<HTMLButtonElement>("[data-panel-tab]").forEach((button) => {
  button.addEventListener("click", () => setPanelTab(button.dataset.panelTab as PanelTab));
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
  const chars = candidates.map((candidate) => engine.state.inventoryTowers.find((tower) => tower.id === candidate.towerId)?.char).filter(Boolean).join("·");
  if (!window.confirm(`보호 규칙을 통과한 정리 후보 ${candidates.length}기(${chars})를 문기로 분해할까요?`)) return;
  handleAction(engine.dismantleRecommended(8));
});
document.querySelectorAll<HTMLButtonElement>("[data-codex-mode]").forEach((button) => {
  button.addEventListener("click", () => setCodexMode(button.dataset.codexMode as CodexMode));
});
must<HTMLInputElement>("#codex-search").addEventListener("input", (event) => renderCodex((event.target as HTMLInputElement).value));
must<HTMLElement>("#codex-synthesis-filters").addEventListener("click", (event) => {
  const value = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-synthesis-depth]")?.dataset.synthesisDepth;
  if (!value) return;
  codexSynthesisDepth = value === "all" ? "all" : Number(value);
  renderCodex(must<HTMLInputElement>("#codex-search").value);
});
must<HTMLElement>("#codex-list").addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const char = target.closest<HTMLButtonElement>("[data-codex-char]")?.dataset.codexChar
    ?? target.closest<HTMLButtonElement>("[data-codex-recipe]")?.dataset.codexRecipe;
  const idiomId = target.closest<HTMLButtonElement>("[data-codex-idiom]")?.dataset.codexIdiom;
  if (char) renderCodexDetail(engine.catalog.definitions.get(char));
  else if (idiomId) renderIdiomCodexDetail(engine.allIdioms().find((idiom) => idiom.id === idiomId));
});
must<HTMLElement>("#codex-detail").addEventListener("click", (event) => {
  const char = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-target-char]")?.dataset.targetChar;
  if (char) {
    handleAction(engine.setTarget(char));
    codexDialog.close();
  }
});
must<HTMLButtonElement>("#sound-button").addEventListener("click", () => {
  const muted = sound.toggle();
  const button = must<HTMLButtonElement>("#sound-button");
  button.textContent = muted ? "×" : "♪";
  button.setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
  showToast(muted ? "효과음 꺼짐" : "효과음 켜짐");
});
must<HTMLElement>("#selected-card").addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("#derivative-button")) openCompositionDrawer();
  else if ((event.target as HTMLElement).closest("#lock-button")) handleAction(engine.toggleSelectedLock());
  else if ((event.target as HTMLElement).closest("#store-button")) {
    const result = engine.storeSelectedTower();
    if (result.ok) setPanelTab("inventory");
    handleAction(result);
  }
  else if ((event.target as HTMLElement).closest("#sell-button")) handleAction(engine.sellSelected());
  else if ((event.target as HTMLElement).closest("#dismantle-button")) handleAction(engine.dismantleSelected());
  else if ((event.target as HTMLElement).closest("#concentrate-swift-button")) handleAction(engine.concentrateSelected("swift" as ConcentrationPath));
  else if ((event.target as HTMLElement).closest("#concentrate-potent-button")) handleAction(engine.concentrateSelected("potent" as ConcentrationPath));
});

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || helpDialog.open || settingsDialog.open || elementUpgradeDialog.open || codexDialog.open) return;
  if (event.code === "Digit1") summonAndFocus();
  else if (event.code === "KeyQ") summonAndFocus(10);
  else if (event.code === "Digit2") {
    const option = engine.availableEvolutions()[0];
    handleAction(option ? engine.evolve(option.recipeId) : { ok: false, message: "현재 가능한 합성이 없습니다." });
  } else if (event.code === "Digit3") handleAction(engine.upgradeResearch());
  else if (event.code === "Space") {
    event.preventDefault();
    handleAction(engine.startWaveEarly());
  } else if (event.code === "KeyC") must<HTMLButtonElement>("#codex-button").click();
  else if (event.code === "KeyM") must<HTMLButtonElement>("#sound-button").click();
  else if (event.code === "KeyF") cycleGameSpeed();
});

function frame(now: number): void {
  const delta = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  const simulationDelta = delta * gameSpeed;
  lastFrame = now;
  engine.update(simulationDelta);
  const frameEvents = engine.consumeEvents();
  for (const event of frameEvents) processEvent(event);
  showSummonReveal(frameEvents.filter((event): event is Extract<GameEvent, { type: "summon" }> => event.type === "summon"));
  if (engine.state.phase !== previousPhase) {
    previousPhase = engine.state.phase;
    if (previousPhase === "victory" || previousPhase === "defeat") showEndScreen(previousPhase);
  }
  drawWorld(simulationDelta);
  syncPanel();
  window.requestAnimationFrame(frame);
}

function fitShell(): void {
  shell.style.setProperty("--viewport-height", String(window.innerHeight) + "px");
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const displayScale = rect.width / WORLD_WIDTH;
  const pixelScale = Math.min(3, Math.max(1, displayScale * (window.devicePixelRatio || 1)));
  const backingWidth = Math.round(WORLD_WIDTH * pixelScale);
  const backingHeight = Math.round(WORLD_HEIGHT * pixelScale);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
}

fitShell();
window.addEventListener("resize", fitShell);
syncMapZoomControl();
setGameSpeed(1);
setDisplayMode(initialDisplayMode, false);
drawWorld(0);
syncPanel();
window.requestAnimationFrame(frame);
