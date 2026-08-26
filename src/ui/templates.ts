/*
 * 게임 셸 마크업.
 *
 * main.ts 의 `app.innerHTML` 템플릿을 통째로 옮겨 왔다. 문구·구조·들여쓰기
 * 어느 것도 손대지 않았다 — 붙이는 쪽만 함수 호출로 바뀐다.
 */
import { CASUAL_STAR_BINS, CASUAL_STAR_COLORS } from "../core/casual";
import { MAX_ENEMIES, WORLD_HEIGHT, WORLD_WIDTH } from "../core/content";
import { CHEONJAMUN_JARYEONG_DEX_META } from "../core/cheonjamun-jaryeong-dex";
import { casualSummonStarDistribution, type SummonStarBand } from "../core/engine-tuning";
import { GAME_CONFIG, SUMMON_STAR_BANDS } from "../core/hanzi";
import type { CasualStar } from "../core/types";
import type { DisplayMode } from "./display-mode";

/**
 * 도움말 소환 갈피의 획수→별 구간표 — FB2.
 *
 * "별은 실제 획수로 정해진다"는 규칙은 지금까지 3합 패널의 접힌 표에만
 * 있었다. 데이터(cheonjamun-strokes.json 의 bins)를 그대로 읽어 그리므로
 * 구간이 바뀌어도 도움말이 낡지 않는다.
 */
function helpStrokeBinsHtml(): string {
  return CASUAL_STAR_BINS
    .map((bin) => `<i style="--star:${CASUAL_STAR_COLORS[bin.star]}"><b>★${bin.star}</b><span>${bin.minStrokes}~${bin.maxStrokes}획</span><small>${bin.count}자</small></i>`)
    .join("");
}

/** 확률표 칸 하나. 값이 작아질수록 자릿수를 늘려 "확 떨어짐"이 눈에 보이게 한다. */
function helpOddsPercent(share: number): string {
  if (share <= 0) return "—";
  const percent = share * 100;
  if (percent >= 10) return `${Math.round(percent)}%`;
  if (percent >= 1) return `${percent.toFixed(1)}%`;
  if (percent >= 0.01) return `${percent.toFixed(2)}%`;
  return `${percent.toFixed(4)}%`;
}

/**
 * 도움말 소환 갈피의 티어별 1~8★ 확률표 — gripe #10 확률 공개.
 *
 * 수치는 문구에 하드코딩하지 않는다. 밴드·감쇠 상수에서
 * `casualSummonStarDistribution` 이 계산한 값을 그대로 렌더하므로
 * 상수를 조정하면 표가 따라온다(획수→별 구간표와 같은 원칙).
 * 소형 풀 지역의 실효 밴드 보정은 상점 카드 툴팁이 맡고, 여기는 정규 밴드다.
 */
function helpSummonOddsHtml(): string {
  const tiers: ReadonlyArray<[string, readonly [number, number] | null]> = [
    ["기본 · 탐색 · 중복", SUMMON_STAR_BANDS.balanced],
    ["중급 소환", SUMMON_STAR_BANDS.midstar],
    ["고급 소환", SUMMON_STAR_BANDS.highstar]
  ];
  const stars = [1, 2, 3, 4, 5, 6, 7, 8] as CasualStar[];
  const head = `<div class="help-odds-row is-head"><b></b>${stars
    .map((star) => `<span style="--star:${CASUAL_STAR_COLORS[star]}">${star}★</span>`)
    .join("")}</div>`;
  const rows = tiers.map(([label, bandTuple]) => {
    if (bandTuple === null) return "";
    const band: SummonStarBand = { min: bandTuple[0], max: bandTuple[1] };
    const cells = casualSummonStarDistribution(band)
      .map((row) => {
        const kind = row.share <= 0 ? "" : row.star > band.max ? " class=\"is-tail\"" : " class=\"is-on\"";
        return `<span${kind} style="--star:${CASUAL_STAR_COLORS[row.star]}">${helpOddsPercent(row.share)}</span>`;
      })
      .join("");
    return `<div class="help-odds-row"><b>${label}</b>${cells}</div>`;
  });
  return head + rows.join("");
}

/** `#app` 에 넣을 게임 셸 전체 마크업. */
export function appShellHtml(initialDisplayMode: DisplayMode): string {
  return `
  <main class="game-shell" data-phase="title" data-display-mode="${initialDisplayMode}" data-game-mode="casual">
    <section class="battle-stage" aria-label="천자진 전장">
      <canvas id="battle-canvas" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}"></canvas>
      <button id="map-zoom-reset" class="map-zoom-control" type="button" title="지도 확대/축소 초기화">
        <span>지도</span><strong id="map-zoom-value">100%</strong><small>휠 확대·축소</small>
      </button>
      <button id="hanja-emphasis-toggle" class="hanja-emphasis-control is-on" type="button" aria-pressed="true" title="전장 한자 표찰 강조 전환 (Space)">
        <span>한자 강조</span><strong>ON</strong>
      </button>
      <span class="canvas-tip" aria-label="지도 조작 안내">
        <i title="빈 곳 끌기: 화면 이동"><em>끌기</em>끌어 화면 이동</i><i title="클릭: 선택·이동"><em>클릭</em>클릭 선택</i><i title="자령 끌기: 자리 교환"><em>자령 끌기</em>자령 끌어 교환</i>
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
      <section id="inventory-frame" class="focus-frame focus-frame--vault" role="dialog" aria-modal="false" aria-labelledby="inventory-frame-title" hidden>
        <header class="focus-frame-head">
          <div><strong id="inventory-frame-title">자령 보관고</strong><span>고르고 · 배치 · 분해까지 여기서</span></div>
          <button id="inventory-frame-close" class="focus-frame-close" type="button" data-focus-close="inventory" aria-label="자령 보관고 닫기">닫기 ✕</button>
        </header>
        <div id="inventory-frame-body" class="focus-frame-body run-inventory-vault"></div>
      </section>
    </section>

    <aside class="control-panel" aria-label="합성과 수비 조작 패널">
      <header class="brand-row">
        <div><p class="eyebrow">오행 자령 디펜스</p><h1>천자진</h1></div>
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
          <div id="shop-scroll" class="shop-scroll">
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
            <section class="action-row" aria-label="핵심 행동">
              <div id="summon-shop" class="summon-shop" role="group" aria-label="소환 상품"></div>
              <button id="evolve-button" class="action-button action-button--evolve" type="button" data-testid="evolve-button">
                <span class="hotkey">2</span><b id="evolve-action-label">합성</b><small><em id="evolve-ready-count">0</em><span id="evolve-action-detail">개 조합 확인</span></small>
              </button>
              <button id="research-button" class="action-button action-button--research" type="button" data-testid="research-button"
                title="인연 연구 — 엽전을 들여 목표 재료가 나올 확률을 올립니다. 최고 5단계 (3키)">
                <span class="hotkey">3</span><b>인연 연구</b><small><em id="research-cost">10W 개방</em> · <i id="research-level">0</i>/5</small>
              </button>
              <button id="element-upgrade-button" class="action-button action-button--element-upgrade" type="button" data-testid="element-upgrade-button">
                <b>강화 탭</b><small id="element-upgrade-total">총 0단계</small>
              </button>
            </section>
          </div>
          <div id="shop-pinned" class="shop-pinned">
            <button id="auto-arrange-button" class="action-button action-button--auto-arrange" type="button" data-testid="auto-arrange-button" title="발동 가능한 사자성어를 봉인하고 오행진 공명을 최적화합니다">
              <b>자동배치</b><small>성어·오행 최적화</small>
            </button>
          </div>
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
              <b>한 번에 승급</b><span id="casual-fuse-all-count" class="casual-fuse-all-count">(0회)</span>
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
            <div class="idiom-rule-figures" aria-hidden="true">
              <figure class="idiom-rule-figure idiom-rule-figure--row">
                <div class="idiom-rule-grid">
                  <i style="--r:1;--c:1">①</i><i style="--r:1;--c:2">②</i><i style="--r:1;--c:3">③</i><i style="--r:1;--c:4">④</i>
                </div>
                <figcaption>가로 · 세로</figcaption>
              </figure>
              <figure class="idiom-rule-figure idiom-rule-figure--diagonal">
                <div class="idiom-rule-grid">
                  <i style="--r:1;--c:1">①</i><i style="--r:2;--c:2">②</i><i style="--r:3;--c:3">③</i><i style="--r:4;--c:4">④</i>
                </div>
                <figcaption>대각선</figcaption>
              </figure>
            </div>
            <p>한 줄로 — 가로·세로·대각선 · 순서대로(역순 인정) · 같은 진 안에서</p>
            <!-- [SKILL-V1] 성어의 가호 한 줄 규칙 안내 -->
            <p>성어의 가호 — 발동 중 성어와 같은 진의 자령 전원 공격 +10%, 같은 진의 추가 발동 성어당 +5%p. 줄이 흩어지면 즉시 사라집니다.</p>
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
              <strong id="idiom-result-name">한 줄에 네 글자를 순서대로</strong>
              <em id="idiom-result-meaning">배치된 자령을 자동으로 판정합니다.</em>
            </span>
            <mark id="idiom-result-bonus">자동 판정</mark>
          </div>
          <div id="idiom-seal-status" class="idiom-seal-status" aria-label="봉인 상태" hidden></div>
        </section>

        <section id="run-inventory-panel" class="run-inventory-panel panel-view" data-panel-view="inventory" aria-label="이번 판 자령 인벤토리">
          <div class="run-inventory-heading">
            <div><span>이번 판에 뽑은 자령</span><strong>자령 보관고</strong></div>
            <div class="run-inventory-tools">
              <small id="essence-summary">문기 木0 火0 土0 金0 水0</small>
              <button id="cleanup-recommended-button" type="button">정리 후보 분해</button>
            </div>
          </div>
          <div id="run-inventory-layout" class="run-inventory-layout">
            <div class="run-inventory-toolbar">
              <div id="run-inventory-element-filters" class="run-inventory-chips" role="group" aria-label="오행 필터"></div>
              <div id="run-inventory-grade-filters" class="run-inventory-chips run-inventory-chips--grade" role="group" aria-label="별 등급 필터"></div>
              <button id="run-inventory-sort" type="button" aria-label="보관고 정렬 전환">획득순</button>
            </div>
            <div class="run-inventory-main">
              <div id="run-inventory-list" class="run-inventory-list">
                <div class="empty-run-inventory"><b>보관 중인 자령이 없습니다</b><span>상점에서 소환하세요</span><button type="button" data-inventory-goto-shop>상점으로</button></div>
              </div>
              <aside id="run-inventory-detail" class="run-inventory-detail" aria-label="선택한 자령 요약"></aside>
            </div>
            <div id="run-inventory-actions" class="run-inventory-actions is-idle">
              <button id="run-inventory-bulk-toggle" class="run-inventory-bulk-toggle" type="button" aria-pressed="false" data-testid="inventory-bulk-toggle" title="여러 자령을 한 번에 담아 분해합니다 · Esc 로 해제">여러 개 선택</button>
              <div id="run-inventory-action-single" class="run-inventory-action-set">
                <span id="run-inventory-action-hint" class="run-inventory-action-hint">카드를 고르세요</span>
                <button id="run-inventory-deploy" class="run-inventory-action run-inventory-action--deploy" type="button" data-testid="inventory-deploy" disabled>전장에 배치</button>
                <button id="run-inventory-dismantle" class="run-inventory-action run-inventory-action--dismantle" type="button" data-testid="inventory-dismantle" disabled>분해</button>
                <button id="run-inventory-lock" class="run-inventory-action" type="button" data-testid="inventory-lock" disabled>잠금</button>
                <button id="run-inventory-concentrate" class="run-inventory-action" type="button" data-testid="inventory-concentrate" disabled>농축으로</button>
              </div>
              <div id="run-inventory-action-bulk" class="run-inventory-action-set" hidden>
                <span id="run-inventory-bulk-hint" class="run-inventory-action-hint">카드를 눌러 담으세요</span>
                <button id="run-inventory-bulk-clear" class="run-inventory-action" type="button">담은 것 비우기</button>
                <button id="run-inventory-bulk-dismantle" class="run-inventory-action run-inventory-action--dismantle" type="button" data-testid="inventory-bulk-dismantle" disabled>선택 0기 분해</button>
              </div>
            </div>
          </div>
          <div class="focus-panel-summary">
            <p id="run-inventory-panel-summary">보관 <b id="run-inventory-heading-count">0기 · 0종</b></p>
            <button id="run-inventory-frame-open" class="focus-open-button" type="button">보관고 열기</button>
          </div>
        </section>

        <section id="concentration-panel" class="concentration-workbench panel-view" data-panel-view="concentration" aria-label="자령 농축 공방">
          <header class="workbench-heading">
            <div><span>같은 자령을 더 강하게</span><strong>농축 공방</strong></div>
            <p class="concentration-guide"><i>①</i> 왼쪽에서 자령 선택 <i>②</i> 재료 지불 → 능력치 영구 상승 · 농축 방향은 역할이 정합니다</p>
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
                <button id="dismantle-unique-toggle" class="dismantle-unique-toggle" type="button" role="switch" aria-checked="true" data-testid="dismantle-unique-toggle" title="끄면 이 한자를 1기만 가진 자령도 분해 후보에 들어옵니다"><b>유일 자령 보호</b><i aria-hidden="true"><em>ON</em></i></button>
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

    <div id="hint-layer" class="coach-layer hint-layer" aria-live="polite" hidden>
      <div id="hint-ring" class="coach-ring hint-ring" aria-hidden="true"></div>
      <div id="hint-bubble" class="coach-bubble hint-bubble" role="status" aria-labelledby="hint-title">
        <p class="coach-step">처음 한 번 안내</p>
        <b id="hint-title"></b>
        <p id="hint-body"></p>
        <div class="coach-actions">
          <button id="hint-dismiss" type="button" class="coach-next">확인</button>
        </div>
      </div>
    </div>

    <div id="tutorial-layer" class="tutorial-layer" aria-live="polite" hidden>
      <div id="tutorial-ring" class="tutorial-ring" aria-hidden="true"></div>
      <div id="tutorial-bubble" class="tutorial-bubble" role="dialog" aria-labelledby="tutorial-title">
        <p class="tutorial-step-count">수련 <span id="tutorial-step-index">1</span> / <span id="tutorial-step-total">8</span></p>
        <b id="tutorial-title"></b>
        <p id="tutorial-body"></p>
      </div>
      <button id="tutorial-exit" class="tutorial-exit" type="button" data-testid="tutorial-exit">수련 건너뛰기</button>
      <section id="tutorial-complete" class="tutorial-complete" aria-labelledby="tutorial-complete-title" hidden>
        <div class="tutorial-complete-card">
          <p class="eyebrow">수련 완수</p>
          <h2 id="tutorial-complete-title">여덟 걸음을 모두 배웠습니다</h2>
          <ul id="tutorial-summary" class="tutorial-summary">
            <li><b>소환</b><span>획이 많은 한자일수록 별이 높아요 · 기본 주로 1~3★ / 중급 2★ 확정 / 고급 3★ 확정</span></li>
            <li><b>승급</b><span>같은 오행·같은 별 3기 → 다음 별 자령 1기, 무엇이 나올지는 무작위</span></li>
            <li><b>강화</b><span>안 쓰는 자령을 분해해 문기를 얻고, 그 오행 전원을 키워요</span></li>
            <li><b>사자성어</b><span>한 줄에 4자 순서대로 — 줄을 지키는 동안만 보너스가 살아 있어요</span></li>
          </ul>
          <button id="tutorial-finish" class="tutorial-finish" type="button" data-testid="tutorial-finish">본편 출정</button>
        </div>
      </section>
    </div>

    <section id="title-overlay" class="modal-layer modal-layer--visible" aria-labelledby="title-heading">
      <div class="s00-stage" data-screen-id="S00">
        <img class="s00-env s00-env--legacy" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/background/S00-living-codex-empty-1280x720-v1.png" alt="" aria-hidden="true" />
        <div id="s00-parallax" class="s00-parallax" aria-hidden="true">
          <img id="s00-desk" class="s00-env s00-env--desk" data-src="${import.meta.env.BASE_URL}assets/ui/s00-layers-v1/S00-bg-desk-v2.png" alt="" aria-hidden="true" />
          <img id="s00-book" class="s00-env s00-env--book" data-src="${import.meta.env.BASE_URL}assets/ui/s00-layers-v1/S00-bg-book-v2.png" alt="" aria-hidden="true" />
          <img id="s00-foreground" class="s00-env s00-env--foreground" data-src="${import.meta.env.BASE_URL}assets/ui/s00-layers-v1/S00-fg-props-v2.png" alt="" aria-hidden="true" />
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
          <button type="button" class="s00-mode game-mode-option is-selected" data-game-mode-option="casual" role="radio" aria-checked="true"
            aria-label="별승급 진법. 같은 별 셋을 모아 다음 별 자령을 무작위로 얻는 본편 진법. 최고 8성">
            <i class="s00-skin" aria-hidden="true"></i><b>별승급 진법</b><small aria-hidden="true"><span class="s00-mode-sub s00-mode-sub--full">같은 별 셋 → 다음 별 무작위 · 최고 8성</span><span class="s00-mode-sub s00-mode-sub--compact">3합 승급 · 무작위 재미</span></small><em>선택됨</em>
          </button>
          <button type="button" class="s00-mode game-mode-option" data-game-mode-option="standard" role="radio" aria-checked="false"
            aria-label="자형연성 진법. 실제 한자의 설계도대로 부수를 부품 삼아 글자를 조립하는 학습 진법">
            <i class="s00-skin" aria-hidden="true"></i><b>자형연성 진법</b><small aria-hidden="true"><span class="s00-mode-sub s00-mode-sub--full">부수를 부품 삼아 조립 · 학습 특화</span><span class="s00-mode-sub s00-mode-sub--compact">부수 조립 · 한자 학습</span></small><em>선택됨</em>
          </button>
        </div>

        <button id="tutorial-button" class="s00-training" type="button" data-testid="tutorial-button"
          aria-label="수련장. 소환부터 사자성어 봉인까지 여덟 걸음으로 배우는 연습 판. 처음이라면 여기부터">
          <b>수련장</b><small>처음이라면 여기부터</small><em>八</em>
        </button>

        <div class="s00-showcase" aria-hidden="true">
          <figure style="left:455px;top:116px"><img class="s00-ring" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-wood-v1.png" alt="" /><img class="s00-spirit" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-wood-orchid-frame-v1.png" alt="" /></figure>
          <figure style="left:803px;top:112px"><img class="s00-ring" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-earth-v1.png" alt="" /><img class="s00-spirit" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-earth-pottery-frame-v1.png" alt="" /></figure>
          <figure style="left:368px;top:334px"><img class="s00-ring" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-water-v1.png" alt="" /><img class="s00-spirit" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-water-ice-frame-v1.png" alt="" /></figure>
          <figure style="left:637px;top:336px"><img class="s00-ring" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-fire-v1.png" alt="" /><img class="s00-spirit" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-fire-fox-frame-v1.png" alt="" /></figure>
          <figure style="left:965px;top:333px"><img class="s00-ring" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/rings/summon-ring-metal-v1.png" alt="" /><img class="s00-spirit" data-src="${import.meta.env.BASE_URL}assets/ui/main-menu-b/jaryeongs/menu-metal-mirror-frame-v1.png" alt="" /></figure>
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
              <button type="button" data-s13-mode="casual" role="radio"><b>별승급</b><small>3합 승급 · 무작위 획득</small></button>
              <button type="button" data-s13-mode="standard" role="radio"><b>자형연성</b><small>부수 조립 · 학습 특화</small></button>
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
          <button id="new-seed-button" class="start-button" type="button">다시 도전</button>
          <button id="retry-button" class="secondary-button" type="button" hidden>같은 시드 재도전</button>
          <button id="return-menu-button" class="secondary-button" type="button">메뉴로 돌아가기</button>
        </div>
      </div>
    </section>

    <dialog id="help-dialog" class="help-dialog">
      <form method="dialog">
        <div class="dialog-heading"><div><p class="eyebrow">놀이 방법</p><h2>봉인술 입문</h2></div><button aria-label="도움말 닫기">×</button></div>
        <div class="codex-mode-tabs help-tabs" role="tablist" aria-label="도움말 갈피">
          <button type="button" class="is-active" role="tab" id="help-tab-start" aria-controls="help-panel-start" aria-selected="true" data-help-tab="start">시작하기</button>
          <button type="button" role="tab" id="help-tab-summon" aria-controls="help-panel-summon" aria-selected="false" tabindex="-1" data-help-tab="summon">소환·상점</button>
          <button type="button" role="tab" id="help-tab-battle" aria-controls="help-panel-battle" aria-selected="false" tabindex="-1" data-help-tab="battle">전투·배치</button>
          <button type="button" role="tab" id="help-tab-growth" aria-controls="help-panel-growth" aria-selected="false" tabindex="-1" data-help-tab="growth">승급·강화</button>
          <button type="button" role="tab" id="help-tab-idiom" aria-controls="help-panel-idiom" aria-selected="false" tabindex="-1" data-help-tab="idiom">사자성어</button>
        </div>
        <div class="help-panels">
          <section class="help-panel is-active" id="help-panel-start" role="tabpanel" aria-labelledby="help-tab-start" data-help-panel="start">
            <p class="help-lead">한자를 품은 <b>자령</b>을 뽑아 오행진에 세우고, 밀려오는 요괴를 <b>봉인</b>합니다. 처음은 세 걸음이면 충분합니다.</p>
            <ol class="help-flow" aria-label="처음 세 걸음">
              <li><i aria-hidden="true">①</i><b>자령 소환</b><span>상점의 <em>기본 소환</em>(<kbd>1</kbd>)으로 한 기를 뽑습니다. 첫 자령이 시작 오행을 정합니다.</span></li>
              <li><i aria-hidden="true">②</i><b>첫 진 자동 개방</b><span>그 오행의 진 하나가 무료로 열리고 빈 칸에 바로 놓입니다. 추가 소환 2기를 권합니다.</span></li>
              <li><i aria-hidden="true">③</i><b>웨이브 시작</b><span>첫 소환 뒤 준비 15초가 흐릅니다. 전장 위 <em>시작</em> 버튼을 누르면 남은 준비 시간만큼 엽전을 더 받습니다.</span></li>
            </ol>
            <h3 class="help-subhead">꼭 알아 둘 여섯 낱말</h3>
            <div class="help-term-grid">
              <article class="help-term" style="--element:#73df8d"><i aria-hidden="true">靈</i><div><b>자령<em>타워</em></b><span>글자에 깃든 타워. 오행진 한 칸에 한 기가 섭니다.</span></div></article>
              <article class="help-term" style="--element:#ff755a"><i aria-hidden="true">封</i><div><b>봉인<em>처치</em></b><span>적을 쓰러뜨리는 일, 그리고 사자성어가 완성되는 일.</span></div></article>
              <article class="help-term" style="--element:#f5c65b"><i aria-hidden="true">錢</i><div><b>엽전<em>골드</em></b><span>이 게임의 돈. 소환·진 해금·공용 강화에 씁니다.</span></div></article>
              <article class="help-term" style="--element:#61c8ff"><i aria-hidden="true">文</i><div><b>문기<em>오행 재료</em></b><span>자령을 분해해 얻습니다. 오행 강화와 농축에 씁니다.</span></div></article>
              <article class="help-term" style="--element:#a98cff"><i aria-hidden="true">濃</i><div><b>농축<em>최고 3</em></b><span>같은 글자를 겹쳐 한 기를 키우는 단계입니다.</span></div></article>
              <article class="help-term" style="--element:#72d8a0"><i aria-hidden="true">共</i><div><b>공명<em>진 보너스</em></b><span>한 진에 그 진의 오행을 4·8·12·16기 모을 때 붙습니다.</span></div></article>
            </div>
            <h3 class="help-subhead">단축키</h3>
            <div class="key-guide"><span><kbd>1</kbd> 소환</span><span><kbd>Q</kbd> 10연</span><span><kbd>2</kbd> 첫 합성</span><span><kbd>3</kbd> 연구</span><span><kbd>Space</kbd> 한자 강조</span><span><kbd>F</kbd> 배속</span><span><kbd>P</kbd> 일시정지</span><span><kbd>C</kbd> 도감</span><span><kbd>M</kbd> 음소거</span></div>
          </section>

          <section class="help-panel" id="help-panel-summon" role="tabpanel" aria-labelledby="help-tab-summon" data-help-panel="summon">
            <p class="help-lead">자령은 오직 뽑기로 얻습니다. 상점 상품마다 <b>무엇이 잘 나오는지</b>가 다릅니다.</p>
            <h3 class="help-subhead">별 구간<em class="help-mode-badge is-casual">별승급 진법</em></h3>
            <div class="help-band" aria-label="소환 상품별 별 구간">
              <div class="help-band-row"><b>기본 · 탐색 · 중복</b><span class="help-band-track" aria-hidden="true"><i class="is-on" style="--star:#aeb9cc">1</i><i class="is-on" style="--star:#72d8a0">2</i><i class="is-on" style="--star:#61c8ff">3</i><i class="is-tail" style="--star:#a98cff">4</i><i class="is-tail" style="--star:#f5c65b">5</i><i class="is-tail" style="--star:#ff8a56">6</i><i class="is-tail" style="--star:#ff5f91">7</i><i class="is-tail" style="--star:#fff1ad">8</i></span><em>주로 1~3★</em></div>
              <div class="help-band-row"><b>중급 소환</b><span class="help-band-track" aria-hidden="true"><i>1</i><i class="is-on" style="--star:#72d8a0">2</i><i class="is-on" style="--star:#61c8ff">3</i><i class="is-on" style="--star:#a98cff">4</i><i class="is-on" style="--star:#f5c65b">5</i><i class="is-tail" style="--star:#ff8a56">6</i><i class="is-tail" style="--star:#ff5f91">7</i><i class="is-tail" style="--star:#fff1ad">8</i></span><em>2★ 확정 · 주로 2~5★</em></div>
              <div class="help-band-row"><b>고급 소환</b><span class="help-band-track" aria-hidden="true"><i>1</i><i>2</i><i class="is-on" style="--star:#61c8ff">3</i><i class="is-on" style="--star:#a98cff">4</i><i class="is-on" style="--star:#f5c65b">5</i><i class="is-on" style="--star:#ff8a56">6</i><i class="is-on" style="--star:#ff5f91">7</i><i class="is-on" style="--star:#fff1ad">8</i></span><em>3★ 확정 · 3~8★</em></div>
            </div>
            <p class="help-note">하한 밑 별은 나오지 않습니다("N★ 확정"). 구간 안에서는 <b>낮은 별이 더 흔하고</b>, 상한 위 별도 <b>아주 낮은 확률</b>로 등장합니다 — 별이 오를수록 확률이 확 떨어집니다. 상위 별의 정공법은 3기 조합입니다.</p>
            <h3 class="help-subhead">별 확률표<em class="help-mode-badge is-casual">별승급 진법</em></h3>
            <div class="help-odds" aria-label="소환 상품별 별 확률표">${helpSummonOddsHtml()}</div>
            <h3 class="help-subhead">획수 → 기본 별 구간<em class="help-mode-badge is-casual">별승급 진법</em></h3>
            <div class="help-stroke-bins" aria-label="획수에 따른 기본 별 구간표">${helpStrokeBinsHtml()}</div>
            <p class="help-note"><b>획이 많은 한자일수록 별이 높습니다</b> — 기본 별은 뽑기 운이 아니라 실제 획수(Unicode kTotalStrokes)로 정해집니다.</p>
            <h3 class="help-subhead">목적 소환 네 갈래</h3>
            <div class="help-cards help-cards--tight">
              <article class="help-card"><b>기본<em>균형</em></b><span>목표와 성어 재료를 고루 섞은 전체 풀입니다.</span></article>
              <article class="help-card"><b>탐색</b><span>아직 못 본 한자를 우선해 부릅니다.</span></article>
              <article class="help-card"><b>계보<em class="help-mode-badge is-synth">자형연성</em></b><span>목표 계보의 재료만 노립니다. 12회마다 재료 1기 보장 · 30회 누적 시 확정 지급.</span></article>
              <article class="help-card"><b>중복 수집</b><span>농축과 분해에 쓸 보유 한자를 다시 부릅니다.</span></article>
            </div>
            <h3 class="help-subhead">더 얻는 길</h3>
            <div class="help-cards">
              <article class="help-card"><b>소환<em><kbd>1</kbd></em></b><span>지역별 1단계 한자를 품은 자령이 무작위로 나옵니다. 목표에 모자란 재료는 뽑을수록 확률이 올라갑니다.</span></article>
              <article class="help-card"><b>10연 소환<em><kbd>Q</kbd></em></b><span>10웨이브를 지키면 열립니다. 현재 소환 비용 10회를 한 번에 지불하며, 별승급 진법에서는 열 장 안에 기본 밴드 상단인 3★ 이상 1기가 보장됩니다.</span></article>
              <article class="help-card"><b>인연 연구<em><kbd>3</kbd></em></b><span>엽전을 들여 목표 재료가 나올 가중치를 올립니다. 최고 5단계이며 각 단계는 정해진 웨이브를 지나야 열립니다.</span></article>
              <article class="help-card"><b>첫 오행진과 해금</b><span>열린 진 없이 상점에서 시작합니다. 첫 소환 자령과 같은 오행진이 무료로 열리고, 나머지는 원하는 순서로 18·32·52·78엽전에 개방합니다.</span></article>
              <article class="help-card"><b>자동배치</b><span>런 인벤토리 자령을 현재 개방된 오행진에 투입하고, 완성 가능한 사자성어와 오행 공명을 함께 정리합니다.</span></article>
            </div>
          </section>

          <section class="help-panel" id="help-panel-battle" role="tabpanel" aria-labelledby="help-tab-battle" data-help-panel="battle">
            <p class="help-lead">적은 경로 끝에서 사라지지 않고 <b>계속 순환</b>합니다. 놓친 적도 다음 바퀴를 돌기 때문에 누적 수를 계속 줄여야 합니다.</p>
            <h3 class="help-subhead">전장 조작</h3>
            <div class="help-chips" aria-label="지도 조작">
              <i><em>끌기</em>빈 곳·길을 끌어 화면 이동</i><i><em>클릭</em>눌러 선택·배치</i><i><em>자령 끌기</em>끌어 자리 교환</i>
            </div>
            <p class="help-note">휠로 약 28%~200% 확대·축소하고, 휠 버튼을 누른 채 끌어도 이동합니다. 왼쪽 아래 배율 버튼은 중앙 정렬된 100%로 되돌리며, 오른쪽 위 배속 버튼이나 <kbd>F</kbd>는 1×·2×·3×를 순환합니다.</p>
            <h3 class="help-subhead">오행 공명 — 한 진에 같은 오행을 모을수록</h3>
            <div class="help-gauge" aria-label="오행 공명 단계">
              <div class="help-gauge-step" style="--fill:25%"><b>4기</b><i>1단계</i><span>진 피해 +6%</span></div>
              <div class="help-gauge-step" style="--fill:50%"><b>8기</b><i>2단계</i><span>진 피해 +12%</span></div>
              <div class="help-gauge-step" style="--fill:75%"><b>12기</b><i>3단계</i><span>진 피해 +18%</span></div>
              <div class="help-gauge-step" style="--fill:100%"><b>16기</b><i>4단계</i><span>진 피해 +25%</span></div>
            </div>
            <p class="help-note">그 진에 놓인 <b>그 진의 오행</b> 자령만 셈합니다. 자동배치가 알려 주는 "오행 공명 N→M단계"가 이 값입니다.</p>
            <h3 class="help-subhead">전투와 살림</h3>
            <div class="help-cards">
              <article class="help-card"><b>약점과 상생</b><span>웨이브 약점 오행은 피해가 30% 증가합니다. 水→木→火→土→金→水 상생을 함께 배치하면 추가 피해를 줍니다.</span></article>
              <article class="help-card"><b>웨이브와 장</b><span>10웨이브가 한 장(章)이고 장 끝에는 우두머리가 옵니다. 제한시간 안에 처치하지 못하면 즉시 실패합니다.</span></article>
              <article class="help-card"><b>게임오버</b><span>전장에 ${MAX_ENEMIES}체가 쌓이면 즉시 실패합니다. 제어 능력은 적을 뒤로 밀지 않고 현재 공격권 안에서 감속·봉쇄합니다.</span></article>
              <article class="help-card"><b>적 특성</b><span>정예 철갑 강시(방어 높음) · 질풍 아귀(빠름) · 백귀야행(다수) · 회생 요괴(체력 회복)를 미리 확인하세요.</span></article>
              <article class="help-card"><b>은행 이자</b><span>웨이브 종료 시 보유 엽전 20개당 1엽전을 지급하며, 한 번에 최대 20엽전까지만 받을 수 있습니다.</span></article>
              <article class="help-card"><b>일시정지<em><kbd>P</kbd></em></b><span>직접 멈출 수 있고, 도감·도움말·설정 창이 열려 있는 동안에도 전투가 저절로 멈춥니다. 창을 닫으면 이어집니다.</span></article>
              <article class="help-card"><b>런 인벤토리</b><span>같은 한자는 한 스택으로 묶입니다. 인벤토리 자령을 고른 뒤 빈 칸을 누르면 배치하고, 찬 칸을 누르면 기존 자령을 인벤토리로 보내며 즉시 교체합니다.</span></article>
              <article class="help-card"><b>훈·독 표시<em><kbd>Space</kbd></em></b><span>기본 자령 모드는 머리 위에 한자·훈음을 얹습니다. 한자 강조를 끄면 표찰을 숨기고 별만 남기며, 설정의 공부 모드는 전장에 큰 한자와 짧은 읽기를 표시합니다.</span></article>
            </div>
          </section>

          <section class="help-panel" id="help-panel-growth" role="tabpanel" aria-labelledby="help-tab-growth" data-help-panel="growth">
            <p class="help-lead">뽑은 자령을 <b>더 센 자령</b>으로 바꾸는 길은 진법마다 다릅니다. 두 갈래를 모두 담았습니다.</p>
            <h3 class="help-subhead">3합 승급<em class="help-mode-badge is-casual">별승급 진법</em></h3>
            <div class="help-fuse" aria-label="같은 오행 같은 별 자령 3기를 다음 별 1기로">
              <span class="help-fuse-tile" style="--element:#73df8d;--star:#61c8ff"><b>木</b><i>3★</i></span>
              <span class="help-fuse-op" aria-hidden="true">+</span>
              <span class="help-fuse-tile" style="--element:#73df8d;--star:#61c8ff"><b>木</b><i>3★</i></span>
              <span class="help-fuse-op" aria-hidden="true">+</span>
              <span class="help-fuse-tile" style="--element:#73df8d;--star:#61c8ff"><b>木</b><i>3★</i></span>
              <span class="help-fuse-op help-fuse-op--to" aria-hidden="true">→</span>
              <span class="help-fuse-tile is-result" style="--element:#73df8d;--star:#a98cff"><b>?</b><i>4★</i></span>
            </div>
            <p class="help-note">기본 별은 천자문 <b>실제 획수</b>로 정해집니다. 같은 오행·같은 현재 별 자령 3기를 고르면 3기가 모두 사라지고, 같은 오행의 다음 별 자령 1기를 무작위로 얻습니다. 최고 8성입니다.</p>
            <div class="help-guard">
              <b>소모 대상에서 빠지는 자령</b>
              <span>잠금</span><span>농축</span><span>목표</span><span>사자성어</span>
              <small>이 넷은 3합과 일괄 분해 후보에서 자동으로 제외됩니다.</small>
            </div>
            <h3 class="help-subhead">구성식 합성<em class="help-mode-badge is-synth">자형연성 진법</em></h3>
            <div class="help-cards help-cards--tight">
              <article class="help-card"><b>조합 서책<em><kbd>2</kbd></em></b><span>실제 구성식의 재료를 모두 보유하면 카드가 열립니다. 木+木처럼 같은 글자 두 개도 각각 필요합니다.</span></article>
              <article class="help-card"><b>방식 세 가지</b><span><em>반자동</em>은 가능한 조합만 제안하고, <em>목표 자동</em>은 목표 경로의 조합만 자동 실행하며, <em>수동</em>은 선택한 한자가 포함된 조합만 봅니다.</span></article>
            </div>
            <h3 class="help-subhead">농축 공방 — 방향은 역할이 정합니다</h3>
            <div class="help-role">
              <div class="help-role-row"><b>연사 · 지원</b><i aria-hidden="true">→</i><span>공격 속도<em>濃당 +7.5%</em></span></div>
              <div class="help-role-row"><b>그 밖의 역할</b><i aria-hidden="true">→</i><span>피해<em>濃당 +12%</em></span></div>
            </div>
            <p class="help-note">같은 한자 중복 1기 또는 같은 오행 문기 4·6·8을 재료로 직접 고릅니다. 실행 전에 전후 전투 수치를 나란히 비교해 보여 줍니다.</p>
            <h3 class="help-subhead">강화 제련소</h3>
            <div class="help-cards">
              <article class="help-card"><b>① 분해</b><span>안 쓰는 인벤토리 자령을 보호 규칙 아래 일괄 분해해 오행 문기로 바꿉니다.</span></article>
              <article class="help-card"><b>② 오행 강화</b><span>공용·오행 5능력치를 각 99단계까지, 오행별 고유 특성 3종을 각 10단계까지 한 화면에서 투자합니다.</span></article>
              <article class="help-card"><b>유일 자령 보호</b><span>스위치를 끄면 이 한자를 1기만 가진 자령도 후보에 들어오며 목록에 <em>유일</em> 배지가 남습니다. 잠금·농축·목표·성어 보호는 그대로입니다.</span></article>
              <article class="help-card"><b>잠금</b><span>잠근 자령은 공격·이동은 유지되지만 합성 재료와 판매 대상에서는 제외됩니다.</span></article>
              <article class="help-card"><b>능력 조합</b><span>모든 한자는 오행 효과·전투 역할·조합망 패시브를 가집니다. 합성 한자는 재료의 오행도 계승해 주기 추가타를 얻습니다.</span></article>
            </div>
          </section>

          <section class="help-panel" id="help-panel-idiom" role="tabpanel" aria-labelledby="help-tab-idiom" data-help-panel="idiom">
            <p class="help-lead">같은 진 안 <b>한 직선</b> 네 칸에 글자를 순서대로 놓으면 사자성어가 자동으로 봉인됩니다.</p>
            <section class="idiom-rule-guide help-idiom-guide" aria-label="성어 발동 규칙">
              <div class="idiom-rule-figures" aria-hidden="true">
                <figure class="idiom-rule-figure idiom-rule-figure--row">
                  <div class="idiom-rule-grid">
                    <i style="--r:1;--c:1">①</i><i style="--r:1;--c:2">②</i><i style="--r:1;--c:3">③</i><i style="--r:1;--c:4">④</i>
                  </div>
                  <figcaption>가로</figcaption>
                </figure>
                <figure class="idiom-rule-figure idiom-rule-figure--column">
                  <div class="idiom-rule-grid">
                    <i style="--r:1;--c:1">①</i><i style="--r:2;--c:1">②</i><i style="--r:3;--c:1">③</i><i style="--r:4;--c:1">④</i>
                  </div>
                  <figcaption>세로</figcaption>
                </figure>
                <figure class="idiom-rule-figure idiom-rule-figure--diagonal">
                  <div class="idiom-rule-grid">
                    <i style="--r:1;--c:1">①</i><i style="--r:2;--c:2">②</i><i style="--r:3;--c:3">③</i><i style="--r:4;--c:4">④</i>
                  </div>
                  <figcaption>대각선</figcaption>
                </figure>
              </div>
              <p>한 줄로 — 가로·세로·대각선 · 순서대로(역순 인정) · 같은 진 안에서</p>
            </section>
            <h3 class="help-subhead">화면이 알려 주는 것</h3>
            <div class="help-idiom-legend">
              <div><span class="help-cell is-placed" aria-hidden="true">③</span><div><b>순번 인장</b><span>추적 중인 성어의 글자를 가진 자령에 몇 번째 글자인지 인장이 붙습니다.</span></div></div>
              <div><span class="help-cell is-next" aria-hidden="true">④</span><div><b>다음 칸 점선</b><span>다음 글자를 놓을 수 있는 빈 칸을 금색 점선 테와 순번으로 표시합니다.</span></div></div>
            </div>
            <p class="help-note">직접 선을 그을 필요는 없습니다. 순서가 맞는 순간 자동으로 발동하고, <b>보너스는 네 자령이 그 줄을 지키는 동안만</b> 발동합니다. 한 기라도 자리를 뜨면 봉인이 풀리고, 줄을 다시 세우면 재발동합니다. 역순으로 읽어도 인정합니다.</p>
            <!-- [SKILL-V1] 성어의 가호 안내 -->
            <p class="help-note"><b>성어의 가호</b> — 발동 중인 성어와 같은 진에 배치된 자령 전원의 공격이 +10% 강해지고, 같은 진에 성어가 하나 더 발동할 때마다 +5%p 씩 더해집니다. 성어가 흩어지면 가호도 즉시 사라집니다.</p>
            <p class="help-note">발동 중인 네 자령은 명패에 <b>금색 鎖</b> 표식이 붙고 자동배치가 건드리지 않습니다. 손으로 옮기는 것은 언제든 가능합니다.</p>
            <h3 class="help-subhead">글자 익히기</h3>
            <div class="help-cards help-cards--tight">
              <article class="help-card"><b>자령 도감<em><kbd>C</kbd></em></b><span>전체 한자와 천자문 자령을 한 화면에서 봅니다. 별·독립 여부·조합표·쉬운 훈 풀이와 자령 초상화를 함께 확인합니다.</span></article>
              <article class="help-card"><b>자세한 읽기</b><span>선택 카드와 도감에서는 훈음·음독·훈독·병음과 뜻까지 확인합니다.</span></article>
            </div>
          </section>
        </div>
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
      <button id="calm-screen-toggle" class="settings-toggle" type="button" role="switch" aria-checked="false" data-testid="calm-screen-toggle">
        <span><b>차분한 화면</b><small>맥동·플래시·먹물 흐름 애니메이션을 멈추고 배경 결 무늬를 옅게 합니다. OS 동작 줄이기 설정이면 자동 적용됩니다.</small></span>
        <i aria-hidden="true"><em>OFF</em></i>
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
}
