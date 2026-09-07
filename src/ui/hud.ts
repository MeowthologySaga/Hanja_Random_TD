/*
 * 상단 띠·패널 탭·집중 프레임·토스트 등 상시 HUD.
 */
import { bossTimeLimitForWave, composeWaveBriefing, MAX_ENEMIES, WAVE_REINFORCEMENT_DELAY, wavePlan, bossClockNotice, bossFinalWallNotice, bossOvertimeNotice, bossSealedNotice } from "../core/content";
import { FIRST_PREP_SECONDS, type GameEngine } from "../core/game";
import {
  ELEMENT_STYLES,
  GAME_CONFIG,
  REGION_META,
  researchCost,
  researchUnlockWave,
  WUXING_ORDER
} from "../core/hanzi";
import { type ActionResult, type GameState, type Wuxing } from "../core/types";
import {
  abilityGuideDialog,
  bossBanner,
  casualFusionConfirmDialog,
  codexDialog,
  confirmDialog,
  ctx,
  elementUpgradeDialog,
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
import { syncWaveActions } from "./wave-actions";
import { renderConcentration } from "./panels/concentration";
import { renderEvolutions } from "./panels/evolution";
import { bindArrangePolicy } from "./panels/arrange-policy";
import { renderGoal } from "./panels/goal";
import { renderGrowth, syncGrowthAffordability } from "./panels/growth";
import { renderActiveIdioms, renderIdiomHud } from "./panels/idiom";
import { renderRunInventory, setRunInventoryBulkMode } from "./panels/inventory";
import { closeCompositionDrawer, renderCompositionDrawer, renderSelected } from "./panels/selected";
import { renderFormationUnlocks, renderSummonShop } from "./panels/shop";
import { OVERRUN_LABEL } from "./glossary";
import { ensureTalismanSheet, syncTalismanPanel, syncTalismanBurst } from "./panels/talisman";
import { talismanGoldRoll } from "./talisman-reward";

/*
 * 시작 보너스 버튼 주목성.
 *
 * 맥동은 "아직 한 번도 안 써 본 사람"에게만 필요하다. 두 번 눌러 본
 * 뒤에는 잔잔한 금테만 남긴다(과자극 방지). 안내 말풍선은 첫 런에서
 * 조기 시작이 처음 가능해지는 순간 딱 한 번 뜬다.
 */
const EARLY_HINT_STORAGE_KEY = "hanja-td:early-hint-v1";

const EARLY_CALM_THRESHOLD = 2;

/**
 * 이 **판에서** 조기 출전을 몇 번 썼나 (v041).
 *
 * 예전에는 브라우저에 영구 누적했다(`hanja-td:early-used`). 그래서 평생 두 번만
 * 눌러 보면 맥동이 영영 꺼졌다 — 사용자가 "빠른 시작 버튼이 눈에 잘 안 띄어"라고
 * 한 화면이 정확히 그 상태다(실측: `data-early-calm="1"` · animationName "none" ·
 * getAnimations().length 0). v038 에서 살려 둔 맥동을 그 사람은 **구조상 볼 수
 * 없었다.**
 *
 * 「두 번 써 본 뒤에는 조용해진다」는 취지는 한 판 안에서만 뜻이 있다. 판이 새로
 * 서면 0 으로 돌아간다.
 */
let earlyUsedThisRun = 0;

function syncEarlyCalmState(): void {
  shell.dataset.earlyCalm = earlyUsedThisRun >= EARLY_CALM_THRESHOLD ? "1" : "0";
}

/** 새 판이 설 때 맥동을 되살린다(s00-menu 가 engine.begin 곁에서 부른다). */
export function resetEarlyStartRunState(): void {
  earlyUsedThisRun = 0;
  // 우두머리 시계의 「잡았다」도 판에 매인 기억이다 — 새 판은 못 본 상태로 연다.
  bossDefeatedSeen = null;
  bossClockLiveWave = null;
  bossClearHoldUntilMs = null;
  syncEarlyCalmState();
}

function noteEarlyStartUsed(): void {
  earlyUsedThisRun += 1;
  syncEarlyCalmState();
}

let earlyHintTimer = 0;

/**
 * 우두머리를 눕힌 뒤 시계가 「잡았다」로 머무는 시간 — **벽시계** 밀리초.
 *
 * 처음에는 판 시간 2.5초로 셌다. 그러면 3배속으로 노는 사람에게 0.83초만 서 있다가
 * 사라진다 — 열여섯 자를 읽기 전에 없어지므로, v041 이 조인 것을 푸는 유일한 표시가
 * 배속을 올린 사람에게만 안 보인다. 게다가 같은 묶음의 청소 띠는 WAAPI 1200ms 라
 * 벽시계 고정이어서, 배속이 오를수록 두 「해방」 표시의 길이가 서로 어긋난다.
 *
 * **읽는 시간은 판 시간이 아니다.** 띠와 같은 시계를 쓴다.
 */
const BOSS_CLEAR_HOLD_MS = 2_500;

/**
 * 지난 프레임의 `bossDefeated`. **null 은 「아직 못 봤다」**이고, 이어하기로 들어온
 * 판이 여기 걸린다 — 이미 눕힌 우두머리를 방금 눕힌 것처럼 축하하지 않게 한다.
 */
let bossDefeatedSeen: boolean | null = null;

/**
 * 이 웨이브에 시계가 **실제로 돌았는가** — 돌던 웨이브 번호를 적어 둔다.
 *
 * 없으면 「제한시계가 멈췄습니다」가 멈출 시계도 없는 자리에서 뜬다. 실제로 닿는
 * 길이 있다: 10웨이브에서 제한을 넘기면 우두머리가 남은 채 11웨이브가 합류하고
 * (v035 ③ 이 설계한 정상 경로) 11웨이브에는 시계가 없다. 거기서 그 우두머리를
 * 잡으면 `bossDefeated` 가 false→true 로 뒤집힌다 — 숨어 있던 시계가 되살아나
 * 있지도 않던 제한이 멈췄다고 말할 뻔했다.
 */
let bossClockLiveWave: number | null = null;

/** 「잡았다」를 거두는 벽시계 시각. null 이면 지금 보일 것이 없다. */
let bossClearHoldUntilMs: number | null = null;

/** 우두머리 시계가 이번 웨이브에 이미 지난 문턱(0 없음 · 1 30초 · 2 15초 · 3 5초). */
let bossClockStage = 0;
let bossOvertimeAnnounced = false;

/** 직전에 그린 심지 길이·액수 — 값이 바뀔 때만 화면을 건드린다. */
let earlyStepProbe = "";
let earlyBonusProbe = 0;

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
  } catch {
    return;
  }
  /*
   * 자리는 **무대 껍데기(shell)** 기준이다 (v041).
   *
   * 예전에는 `.battle-stage`(0~880, overflow:hidden) 기준으로 놓았다. v036 에서
   * 단추가 오른쪽 패널로 옮겨 간 뒤로 left 가 903.85px 이 되어 상자가 무대 밖으로
   * 나갔고 — 통째로 잘려 아무도 못 봤다. 그런데 코드는 **보여 주기 전에** 「봤다」를
   * 저장해 단 한 번뿐인 기회를 태웠다. 이제 자리를 잡고 세운 **뒤에** 표시한다.
   */
  const shellRect = shell.getBoundingClientRect();
  const rect = button.getBoundingClientRect();
  const scale = shellRect.width / Math.max(1, shell.offsetWidth);
  hint.style.left = `${(rect.left - shellRect.left) / scale}px`;
  hint.style.top = `${(rect.bottom - shellRect.top) / scale + 10}px`;
  hint.hidden = false;
  try {
    window.localStorage.setItem(EARLY_HINT_STORAGE_KEY, "1");
  } catch {
    // 저장이 막혀 있어도 이번 판에서는 한 번 보여 준 것으로 친다.
  }
  earlyHintTimer = window.setTimeout(hideEarlyHint, 6500);
}

/**
 * 우두머리 제한시계 — 전장 아래 오른쪽에 세우고, 문턱마다 한 번씩 말을 건다 (v041).
 *
 * "보스 시간제한 있는 거 모르고 냅두다가 게임오버하는거 봤어"(사용자).
 *
 * 그 사람이 실제로 진 방식은 둘 중 하나다. ① 마지막 100웨이브에서 넘겨 즉사했거나
 * ② 넘긴 뒤 20초마다 겹치는 웨이브에 적 80체가 차서 졌거나. 화면은 **둘 다 시계
 * 탓이라고 말하지 않았다** — 넘긴 뒤에도 패널 12px 줄이 「제한 초과 · 잔존 합류
 * N초」로 바뀔 뿐, 그 뒤에 무슨 일이 벌어지는지 아무 데서도 잇지 않았다.
 *
 * 문장은 코어가 만든다(content.ts 의 bossClockNotice·bossOvertimeNotice). 화면은
 * 그 값을 자리에 놓을 뿐이다.
 */
function syncBossClock(remaining: number | null, overtime: boolean, previewLimit: number | null): void {
  const clock = must<HTMLElement>("#boss-clock");
  const state = ctx.engine.state;
  const finalWave = state.wave >= GAME_CONFIG.maxWaves;
  /*
   * 조인 것을 **푼다** (v042).
   *
   * v041 이 이 시계를 세워 72~126초를 조였는데, 우두머리가 쓰러지는 순간
   * `bossTimeRemaining()` 이 null 이 되어 시계는 그냥 사라졌다 — 조인 것만 있고
   * 푸는 것이 없었다. 실측하면 우두머리가 쓰러진 시각과 웨이브가 끝나는 시각이
   * 같은 틱이라(58표본 중 54, 간격 0.0초) 대개는 청소 배너가 그 자리를 맡지만,
   * 잔존이 남은 나머지(7%)에서는 교전이 이어지므로 시계가 직접 말해야 한다.
   */
  // 시계가 돌고 있는 동안 그 웨이브를 적어 둔다 — 「멈췄다」는 돌던 것에만 쓴다.
  if (remaining !== null && state.phase === "combat") bossClockLiveWave = state.wave;
  if (state.bossDefeated && bossDefeatedSeen === false && state.phase === "combat" && bossClockLiveWave === state.wave) {
    bossClearHoldUntilMs = performance.now() + BOSS_CLEAR_HOLD_MS;
  }
  if (!state.bossDefeated) bossClearHoldUntilMs = null;
  bossDefeatedSeen = state.bossDefeated;
  if (bossClearHoldUntilMs !== null && state.phase === "combat" && performance.now() < bossClearHoldUntilMs) {
    clock.hidden = false;
    clock.dataset.alert = "clear";
    // 문장은 코어가 만든다 — 배너와 시계가 같은 순간에 다른 말을 하지 않게.
    const sealed = bossSealedNotice();
    must<HTMLElement>("#boss-clock-time").textContent = sealed.time;
    must<HTMLElement>("#boss-clock-note").textContent = sealed.note;
    bossClockStage = 0;
    bossOvertimeAnnounced = false;
    return;
  }
  if (remaining === null && !overtime && previewLimit === null) {
    clock.hidden = true;
    delete clock.dataset.alert;
    bossClockStage = 0;
    bossOvertimeAnnounced = false;
    return;
  }
  clock.hidden = false;
  const time = must<HTMLElement>("#boss-clock-time");
  const note = must<HTMLElement>("#boss-clock-note");
  if (overtime) {
    // 넘긴 뒤가 진짜 위험한 구간이다 — 그 연쇄를 여기서만 말한다.
    time.textContent = "제한 초과";
    note.textContent = bossOvertimeNotice();
    clock.dataset.alert = "3";
    if (!bossOvertimeAnnounced) {
      bossOvertimeAnnounced = true;
      showToast(bossOvertimeNotice(), true);
      sound.playEnemyLimitWarning();
    }
    return;
  }
  if (remaining === null) {
    // 준비 단계 — 다음 웨이브가 우두머리다. 정지한 채로 미리 보여 준다.
    time.textContent = `우두머리 ${String(previewLimit)}초`;
    note.textContent = finalWave ? bossFinalWallNotice() : "제한 안에 잡지 못하면 웨이브가 겹칩니다";
    clock.dataset.alert = "0";
    bossClockStage = 0;
    bossOvertimeAnnounced = false;
    return;
  }
  time.textContent = `${remaining.toFixed(1)}초`;
  const stage = remaining <= 5 ? 3 : remaining <= 15 ? 2 : remaining <= 30 ? 1 : 0;
  clock.dataset.alert = String(stage);
  /*
   * 평시 문구는 「우두머리를 잡아야 이 웨이브가 끝난다」를 말한다 — 이것도 여태
   * 어디에도 없던 규칙이다(game.ts 의 deadlineUnlocked). 우두머리를 살려 두면
   * 준비 시간이 영영 오지 않는데, 화면은 잔존 합류 때만 그 비슷한 말을 했다.
   */
  note.textContent = stage === 0
    ? finalWave ? bossFinalWallNotice() : "우두머리를 잡아야 이 웨이브가 끝납니다"
    : bossClockNotice(remaining, finalWave) ?? "우두머리 제한";
  /*
   * 문턱을 처음 지날 때만 소리와 토스트를 준다 — 적 한계 3단 경고(아래)와 같은 꼴.
   * 30초는 알림, 15·5초는 북 한 방. 새 자산은 쓰지 않는다.
   */
  if (stage > bossClockStage) {
    bossClockStage = stage;
    const notice = bossClockNotice(remaining, finalWave);
    if (notice) showToast(notice, stage >= 2);
    if (stage === 1) sound.playEnemyLimitWarning();
    else sound.playBossDrum();
  }
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
/*
 * v037: 75% 는 너무 늦었다 — 페르소나 실측에서 61/80 에 첫 경고가 뜨고 두 웨이브
 * 뒤에 졌다. 40% 에 색이 바뀌고(is-watch), 60% 에 빨강 + 토스트(is-danger),
 * 90% 에 맥동(is-critical). 손쓸 시간이 있을 때 말한다.
 */
const ENEMY_LIMIT_WATCH_RATIO = 0.4;
const ENEMY_LIMIT_WARN_RATIO = 0.6;

const ENEMY_LIMIT_CRITICAL_RATIO = 0.9;

let enemyLimitWarnedEngine: GameEngine | null = null;

function syncEnemyLimitWarning(count: number): void {
  const chip = must<HTMLElement>("#enemy-limit-chip");
  const ratio = count / MAX_ENEMIES;
  chip.classList.toggle("is-watch", ratio >= ENEMY_LIMIT_WATCH_RATIO && ratio < ENEMY_LIMIT_WARN_RATIO);
  chip.classList.toggle("is-danger", ratio >= ENEMY_LIMIT_WARN_RATIO);
  chip.classList.toggle("is-critical", ratio >= ENEMY_LIMIT_CRITICAL_RATIO);
  if (ratio < ENEMY_LIMIT_WARN_RATIO || enemyLimitWarnedEngine === ctx.engine) return;
  enemyLimitWarnedEngine = ctx.engine;
  showToast(`적 ${count}체 — ${MAX_ENEMIES}체에 닿으면 봉인이 무너집니다 · 자령을 더 세우세요`, true);
  sound.playEnemyLimitWarning();
}

const FOCUS_FRAME_MOUNTS: ReadonlyArray<{ id: FocusFrameId; source: string; target: string }> = [
  { id: "growth", source: ".growth-layout", target: "#growth-frame-body" },
  { id: "concentration", source: "#concentration-layout", target: "#concentration-frame-body" },
  // R14: 보관고. 많이 뽑는 구조라 376px 패널의 1열 목록으로는 스크롤이 끝없이
  // 길어졌다. 목록 DOM 을 통째로 전장 위 격자 프레임으로 옮긴다.
  { id: "inventory", source: "#run-inventory-layout", target: "#inventory-frame-body" },
  // 트랙 B: 목표 서책. 성어 카드 격자 + 상세 2단은 376px 에 들어가지 않는다.
  { id: "goal", source: "#goal-codex-layout", target: "#goal-frame-body" }
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
  } else if (id === "goal") {
    ctx.goalRenderKey = "";
    renderGoal();
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
  } else if (tab === "talisman") {
    // 갈피 전환은 여기 한 곳뿐이다 — 부적지 준비(글자 세우기)도 여기서 한 번만.
    ensureTalismanSheet();
  }
  // 탭 진입은 곧 집중 프레임 진입이다. 다른 탭으로 나가면 프레임도 닫힌다.
  setFocusFrame(FOCUS_FRAME_MOUNTS.some((mount) => mount.id === tab) ? (tab as FocusFrameId) : null);
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHud1(): void {
  mountFocusFrames();
  syncEarlyCalmState();
}

/**
 * 패널 푸터가 엔진 문장 대신 보여 줄 문장 — 그 엔진 문장과 짝지어 둔다.
 *
 * [S/P-26] 3체 승급의 문기 환급은 UI 가 실측 증가분으로 덧붙인다(엔진 문장
 * 무수정 원칙). 그래서 토스트에는 "水 문기 +2 환급"이 뜨는데 1.9초 뒤 사라지고,
 * 남는 푸터(`#message-value` = state.lastMessage)에는 그 조각이 없었다.
 * 놓치면 다시 볼 데가 없는 정보다 — 덧붙인 문장을 푸터도 함께 쓴다.
 */
let footerMessage: { readonly base: string; readonly shown: string } | null = null;

/** 바닥 문장의 곁말을 마지막으로 다시 잰 조건(문장 + 시드 노출 여부). */
let footerMessageProbe = "";

/**
 * 바닥 문장 한 줄 — 잘리면 곁말(title)로 전문을 남긴다.
 *
 * [2차 감사 실측 · 1280×720] 바닥 줄의 글 자리는 354px 이다(패널 폭에서
 * 인장 자리 26px 을 뺀 값). 웨이브 0 안내 "① 상점에서 첫 자령을 소환하세요.
 * 준비 시간은 아직 흐르지 않습니다." 는 380.25px 이라 26.25px(6.9%)가
 * 말줄임으로 잘렸고, 곁말이 없어 잘린 뒤를 볼 데가 아예 없었다.
 * 개발자 모드에서는 시드(실측 129.5px)가 자리를 나눠 가져 155.8px(41%)가
 * 잘린다 — 시드는 버그 신고에 붙일 값이라 줄지 않는 쪽이 정본이다(S/P-24).
 * 개발자 모드가 꺼져 있으면 `.footer-seed` 가 display:none 이라 문장이
 * 354px 을 온전히 쓴다(실측 확인) — 나눠 쓰는 것은 개발자 모드뿐이다.
 *
 * 곁말은 실제로 잘릴 때만 단다. 다 보이는 문장에 툴팁을 달면 소음이고,
 * scrollWidth 는 강제 리플로를 부르므로 문장이나 시드 노출이 바뀔 때만 잰다.
 */
function syncFooterMessage(message: string): void {
  const value = must<HTMLElement>("#message-value");
  const probe = `${message}|${shell.dataset.devMode ?? "0"}`;
  if (probe === footerMessageProbe) return;
  footerMessageProbe = probe;
  value.textContent = message;
  const clipped = value.scrollWidth > value.clientWidth;
  const title = clipped ? message : "";
  if (value.title !== title) value.title = title;
}

export function handleAction(result: ActionResult, options: { invalidatePanels?: boolean } = {}): void {
  sound.playActionOutcome(result.ok);
  if (!result.ok || !result.message.includes("자동 발동")) showToast(result.message, !result.ok);
  // 엔진 문장을 UI 가 늘려 놓았을 때만 이어받는다(실패 문장·다른 문장은 그대로).
  const engineMessage = ctx.engine.state.lastMessage;
  footerMessage = result.ok && result.message !== engineMessage && result.message.startsWith(engineMessage)
    ? { base: engineMessage, shown: result.message }
    : null;
  if (options.invalidatePanels !== false) {
    ctx.evolutionRenderKey = "";
    ctx.goalRenderKey = "";
    ctx.selectedRenderKey = "";
    ctx.runInventoryRenderKey = "";
    ctx.concentrationRenderKey = "";
    ctx.growthRenderKey = "";
    // [2차 감사] 성어 HUD 도 표기·훈음을 그린다. 표기 전환은 handleAction 을
    // 거쳐 오므로(dialogs/s13.ts) 이 목록에도 세워 둔다 — 열쇠에 표기가 들어간
    // 지금은 이것이 없어도 갈리지만, 다음에 열쇠가 놓치는 축이 생겼을 때
    // 무너지는 자리가 바로 여기다.
    ctx.idiomRenderKey = "";
  }
  syncPanel();
}

/**
 * 트랙 A #2-3: 토스트 문장 속 문기 증감 조각을 분리 강조한다.
 *
 * 엔진 문장(lastMessage)은 " · " 로 조각을 잇는다. 그 조각이 문기 환급·획득
 * 표기(`木 문기 2 환급` · 분해의 `木+3` · 합성의 `농축 문기 木2 환급`)면
 * 굵은 오행색 칩으로 갈라 세워 "문장 끝 덧붙임"으로 흘려보내지 않는다.
 * game.ts 는 손대지 않으므로 표기 인식은 전부 UI 쪽 책임이다.
 */
function toastEssenceChip(segment: string): HTMLElement | null {
  const refund = /^([木火土金水]) 문기 \+?(\d+) 환급$/u.exec(segment);
  const gain = refund === null ? /^([木火土金水])\+(\d+)$/u.exec(segment) : null;
  const concentration = refund === null && gain === null ? /^농축 문기 .+ 환급$/u.exec(segment) : null;
  if (refund === null && gain === null && concentration === null) return null;
  const chip = document.createElement("b");
  chip.className = "toast-essence";
  const wuxing = /[木火土金水]/u.exec(segment)?.[0] as Wuxing | undefined;
  chip.style.setProperty("--element", wuxing ? ELEMENT_STYLES[wuxing].color : "#b8934a");
  chip.textContent = refund
    ? `${refund[1]} 문기 +${refund[2]} 환급`
    : gain
      ? `${gain[1]} 문기 +${gain[2]}`
      : segment;
  return chip;
}

function renderToastMessage(message: string): void {
  toast.textContent = "";
  message.split(" · ").forEach((segment, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "toast-sep";
      separator.textContent = " · ";
      toast.append(separator);
    }
    toast.append(toastEssenceChip(segment) ?? document.createTextNode(segment));
  });
}

/**
 * 알림이 뜰 자리.
 *
 *  · stage — 무대 아래 가운데. 웨이브·보스처럼 **전장에서 일어난** 일.
 *  · panel — 오른쪽 조작 패널 안. 부적·합성·농축처럼 **패널에서 한** 일.
 *
 * 사람은 자기가 손댄 곳을 본다. 부적을 쓰는 동안 눈은 종이에 있는데 알림이
 * 무대 아래 가운데(450px 떨어진 곳)에 뜨면 나온 줄도 모른다.
 */
export type ToastWhere = "stage" | "panel";

let panelToastTimer = 0;

/**
 * 패널 안 알림.
 *
 * 무대 토스트보다 오래 남긴다(3.4초). 패널 일은 손이 바쁜 중에 일어나서,
 * 눈이 종이에서 알림으로 옮겨 오는 데 시간이 더 걸린다.
 */
export function showPanelToast(message: string, warning = false): void {
  const box = document.getElementById("panel-toast");
  if (!box) return;
  box.textContent = message;
  box.classList.toggle("panel-toast--warning", warning);
  box.hidden = false;
  // 재생 중에 또 뜨면 애니메이션이 이어붙지 않도록 한 번 되감는다.
  box.classList.remove("is-live");
  void box.offsetWidth;
  box.classList.add("is-live");
  window.clearTimeout(panelToastTimer);
  panelToastTimer = window.setTimeout(() => {
    box.classList.remove("is-live");
    box.hidden = true;
  }, 3_400);
}

export function showToast(message: string, warning = false, where: ToastWhere = "stage"): void {
  if (where === "panel") {
    showPanelToast(message, warning);
    return;
  }
  renderToastMessage(message);
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

/**
 * 띠가 옷을 갈아입는 **유일한 자리** (v042).
 *
 * 옷이 셋이 되면서(경보 리본 `--boss` · 금박 `--idiom` · 비취 `--clear`) 부르는 쪽마다
 * 「무엇을 벗길지」를 따로 적게 됐고, 곧바로 새는 자리가 생겼다 — `firstSealCelebration`
 * 은 `--boss` 만 벗겨서, 웨이브를 막은 뒤 준비 시간에 첫 성어가 서면 판당 한 번뿐인
 * 금박 축하가 비취 발광을 뒤집어쓴 잡종으로 떴다. 벗기는 일을 한 곳에 모아 부르는
 * 쪽은 **입을 옷 하나만** 말하게 한다.
 */
export function dressWaveBanner(variant: "plain" | "boss" | "idiom" | "clear"): void {
  bossBanner.classList.toggle("boss-banner--boss", variant === "boss");
  bossBanner.classList.toggle("boss-banner--idiom", variant === "idiom");
  bossBanner.classList.toggle("boss-banner--clear", variant === "clear");
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
 * 첫 발동 축하 — 스펙 6라운드 E3.
 *
 * 첫 발동은 "뭔가 터졌다"로만 남고 그 효과가 어디에 남는지는 알려 주지 않았다.
 * 웨이브 배너를 한 번 빌려 전장 왼쪽 스택을 가리킨다. 런마다 처음 한 번뿐이다.
 */
export function firstSealCelebration(reading: string): void {
  bossBanner.textContent = `첫 발동 ${reading}! 발동 중 성어는 전장 왼쪽에 표시됩니다`;
  dressWaveBanner("idiom");
  showWaveBanner();
}

export function showTowerAbilityPopup(towerId: number, glyph: string, name: string, color: string): void {
  const current = towerAbilityPopups.get(towerId);
  // Frequent procs still happen mechanically, but the same tower cannot flood the screen.
  if (current && current.age < 0.8) return;
  towerAbilityPopups.set(towerId, { text: glyph + " " + name, color, age: 0, duration: 0.82 });
}

/**
 * 다섯 오행에 쌓인 문기의 합.
 *
 * 자원칸은 이 한 수만 적는다. 오행별 잔량은 강화 탭·오행 강화 창이 따로
 * 적으므로, 좁은 칸에 다섯 수를 밀어 넣어 접히게 만들 이유가 없다.
 */
export function totalEssenceOf(state: GameState): number {
  return WUXING_ORDER.reduce((sum, wuxing) => sum + state.elementEssence[wuxing], 0);
}

export function syncPanel(): void {
  const state = ctx.engine.state;
  const plan = ctx.engine.getCurrentPlan();
  const preview = state.phase === "prep" ? wavePlan(Math.min(state.maxWaves, state.wave + 1)) : plan;
  shell.dataset.phase = state.phase;
  shell.dataset.gameMode = state.mode;
  must<HTMLElement>("#stage-wave").textContent = String(state.wave) + " / " + String(state.maxWaves);
  // 「장 N / 10」 칩은 걷었다(v036) — 웨이브 칩과 브리핑이 이미 같은 말을 한다.
  must<HTMLElement>("#stage-region").textContent = `${REGION_META[state.region].title.split(" · ")[0] ?? state.region}${state.mode === "casual" ? " · 8성" : ""}`;
  must<HTMLElement>("#stage-phase").textContent = phaseLabel(state.phase);
  must<HTMLElement>("#stage-enemies").textContent = String(state.enemies.length) + " / " + String(MAX_ENEMIES);
  syncEnemyLimitWarning(state.enemies.length);
  // 트랙 C2: 부적 보상이 자원칸에 꽂히는 순간에만 숫자가 굴러간다. 굴리는 중이
  // 아니거나 다른 수입·지출이 끼어들면 즉시 실제 보유량으로 돌아온다.
  must<HTMLElement>("#gold-value").textContent = String(talismanGoldRoll(state.gold) ?? state.gold);
  /*
   * 문기는 오행별로 적는다.
   *
   * 합계 한 수로는 쓸 수 있는지를 못 판단한다 — 농축도 강화도 **그 오행의**
   * 문기를 요구하므로, 합이 20이어도 필요한 오행이 0이면 아무것도 못 한다.
   * 다섯 수를 오행색으로 나란히 두면 좁은 칸에서도 어느 쪽이 마른지 한눈에 든다.
   * 소리로는 합까지 함께 읽히도록 접근명에 적는다.
   */
  const essenceCell = must<HTMLElement>("#essence-total-value");
  essenceCell.innerHTML = WUXING_ORDER
    .map((wuxing) => `<i style="--element:${ELEMENT_STYLES[wuxing].color}">${wuxing}${state.elementEssence[wuxing]}</i>`)
    .join("");
  essenceCell.setAttribute(
    "aria-label",
    `문기 합 ${totalEssenceOf(state)} · ` + WUXING_ORDER.map((wuxing) => `${wuxing} ${state.elementEssence[wuxing]}`).join(" · ")
  );
  must<HTMLElement>("#seed-value").textContent = state.seed;
  // [S/P-26] UI 가 늘린 문장이 살아 있으면 그것을, 엔진이 다음 문장을 쓰면 그것을.
  syncFooterMessage(footerMessage !== null && footerMessage.base === state.lastMessage
    ? footerMessage.shown
    : state.lastMessage);
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
  /*
   * 액수는 엔진이 센다(earlyStartBonus).
   *
   * 예전에는 여기서 `floor(prepRemaining / 2)` 를 따로 셌는데, 값이 매겨지는
   * 창이 예전 시계에 묶인 뒤로(v035 ②) 그 셈은 실제로 받는 액수보다 커졌다 —
   * 준비 11초에 화면은 5엽전이라 적고 실제로는 4엽전이 들어왔다.
   */
  const earlyBonus = state.phase === "prep" ? ctx.engine.earlyStartBonus() : 0;
  earlyButton.textContent = state.phase === "prep"
    ? state.summonCount === 0 ? "첫 소환 필요" : earlyBonus > 0 ? "시작 +" + String(earlyBonus) + "엽전" : "지금 시작"
    : "교전 중";
  /*
   * 남은 몫을 **심지**로 보인다 (v041) — 단추 아래 3px 띠가 왼쪽으로 줄어든다.
   *
   * "+3보너스 빨리 지나가서 손해보는 느낌이야"(사용자). 손해의 정체는 「언제 한 칸
   * 떨어지는지 모른다」였다. 숫자를 하나 더 띄우면 폭 115px 안에서 두 숫자가 함께
   * 뛰어 오히려 안 읽히므로, 초는 길이로 준다. 값이 실제로 바뀔 때만 쓴다 — 매
   * 프레임 setProperty 는 프레임마다 스타일 무효화를 부른다.
   */
  const stepRatio = state.phase === "prep" && state.summonCount > 0 ? ctx.engine.earlyStartStepRatio() : 0;
  const stepKey = stepRatio.toFixed(2);
  if (earlyStepProbe !== stepKey) {
    earlyStepProbe = stepKey;
    earlyButton.style.setProperty("--early-step", stepKey);
  }
  if (earlyBonusProbe !== earlyBonus) {
    // 한 칸 떨어지는 순간에만 소리를 준다. 마지막 두 계단은 재촉이 되므로 뺀다.
    if (earlyBonusProbe > earlyBonus && earlyBonus >= 2) sound.playEarlyTick();
    earlyBonusProbe = earlyBonus;
  }
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
  /*
   * 미리 보기는 **준비 단계에만** 준다 (v042에서 고침).
   *
   * `preview` 는 준비 단계에서만 다음 웨이브이고 교전 중에는 **지금 이 웨이브**다
   * (611행). v041 은 그 사실을 놓치고 미리 보기를 그대로 넘겼다 — 그래서 우두머리를
   * 눕히고도 잔존이 남은 자리(실측 7%)에서 `bossTimeRemaining()` 이 null 이 되는
   * 순간 시계가 **정지한 「우두머리 72초」로 되돌아갔다.** 사라지는 것보다 나쁘다:
   * 이미 끝난 싸움을 아직 안 시작한 것처럼 말한다.
   *
   * 옆줄인 `#wave-kicker`(712행)는 처음부터 `phase === "prep"` 로 갈라 놓아 이
   * 거짓말을 안 했다. 같은 갈래를 여기에도 세운다.
   */
  const bossClockPreview = state.phase === "prep" && preview?.boss === true ? bossTimeLimitForWave(preview.wave) : null;
  syncBossClock(bossRemaining, ctx.engine.bossOvertime(), bossClockPreview);
  // 제한시간을 넘겨도 판은 안 끝난다(v035 ③) — 그 자리를 화면이 말해 줘야 한다.
  const bossOvertime = ctx.engine.bossOvertime();
  const nextWaveRemaining = state.phase === "combat" ? state.nextWaveRemaining : null;
  const previewBossLimit = preview?.boss ? bossTimeLimitForWave(preview.wave) : null;
  must<HTMLElement>(".wave-card").classList.toggle("is-boss", bossRemaining !== null || bossOvertime || previewBossLimit !== null);
  must<HTMLElement>("#wave-kicker").textContent = state.phase === "prep"
    ? state.summonCount === 0 ? "첫 소환 전 · 시간 정지" : previewBossLimit !== null ? "우두머리전 · 제한 " + String(previewBossLimit) + "초" : "준비 " + state.prepRemaining.toFixed(1) + "초"
    : bossRemaining !== null
      ? "우두머리 제한 " + bossRemaining.toFixed(1) + "초"
      : bossOvertime
        ? nextWaveRemaining !== null
          ? "제한 초과 · 잔존 합류 " + nextWaveRemaining.toFixed(1) + "초"
          : "제한 초과 · 다음 웨이브가 합류합니다"
      : nextWaveRemaining !== null
        ? "다음 웨이브 " + nextWaveRemaining.toFixed(1) + "초"
        : state.phase === "combat" ? formatTime(state.waveElapsed) + " 경과" : "봉인전 종료";
  must<HTMLElement>("#wave-label").textContent = state.phase === "prep"
    /*
     * 첫 소환 전에는 「할 일」을 여기서 말하지 않는다(v037).
     *
     * 같은 문장이 상단 띠·패널 카드·패널 맨 아래 줄 세 군데에 서 있었다(사용자
     * 지적). 할 일은 맨 아래 줄(lastMessage) 한 곳이 말하고, 이 칩은 **무엇이
     * 오는가**만 말한다 — 올 것이 아직 없으니 짧게 「대기」만 적는다.
     */
    /*
     * 웨이브 번호를 **두 번 말하지 않는다** (v042).
     *
     * 계획의 이름이 이미 번호를 지고 있다 — `label = ARCHETYPE_LABEL + " " + wave`
     * (content.ts). 그 앞에 「2웨이브 · 」를 또 붙여 상단 띠가 **「2웨이브 · 망령 행렬 2」**
     * 라고 말하고 있었다. 옆 칸의 `#stage-wave`(「1 / 100」)까지 세면 한 띠에서 번호가
     * 세 번이다.
     *
     * 교전 중 갈래는 처음부터 `plan.label` 만 썼다(아래 줄) — 준비 갈래만 어긋나 있었다.
     * 같은 것으로 맞춘다. 상단 띠는 41px 예산이라 짧아지는 쪽이 덤이다.
     */
    ? state.summonCount === 0 ? "첫 소환 대기" : preview?.label ?? ""
    : plan?.label ?? state.lastMessage;
  const briefing = state.summonCount === 0
    // 첫 소환 전 설명도 비운다 — 맨 아래 줄과 개문 안내(①②③)가 이미 말한다.
    ? ""
    : preview
      ? composeWaveBriefing(preview.briefing, preview.wave, previewBossLimit !== null, nextWaveRemaining !== null ? state.enemies.length : null)
      // [v042] 패배를 부르는 이름은 한 곳에서 온다(ui/glossary) — 도움말·종료 화면과 같은 낱말.
      : "적 " + String(MAX_ENEMIES) + "체 도달 시 즉시 " + OVERRUN_LABEL;
  // 패널 행동 자리 — 탭과 무관하게 늘 서 있으므로 여기서 갱신한다(v036).
  syncWaveActions();
  const briefingElement = must<HTMLElement>("#wave-briefing");
  briefingElement.textContent = briefing;
  /*
   * 전문은 줄 전체의 title 이 받는다.
   *
   * 시계와 설명이 한 줄에 붙어(v036) 말줄임이 줄 단위로 걸리므로, 짚었을 때
   * 나와야 하는 것도 줄 전체다 — 설명만 title 에 두면 잘린 시계는 어디서도
   * 못 읽는다.
   */
  briefingElement.title = briefing;
  const statusLine = document.querySelector<HTMLElement>("#wave-status-line");
  if (statusLine) statusLine.title = `${must<HTMLElement>("#wave-kicker").textContent ?? ""} · ${briefing}`;
  const weakness = preview?.weakness ?? "木";
  const weaknessElement = must<HTMLElement>("#wave-weakness");
  weaknessElement.textContent = weakness;
  weaknessElement.style.color = ELEMENT_STYLES[weakness].color;
  // 웨이브가 서기 전의 약점은 뜻이 없다 — 첫 소환 전에는 인장을 감춘다.
  const weaknessSeal = weaknessElement.closest<HTMLElement>(".stage-weakness-seal");
  if (weaknessSeal) weaknessSeal.hidden = state.summonCount === 0;
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
  if (ctx.activePanelTab === "growth") {
    renderGrowth();
    // 뼈대는 위에서 필요할 때만 다시 그리고, 엽전·문기로 달라지는 값은
    // 노드를 살려 둔 채 여기서 손본다 — 그래야 누르는 도중 버튼이 안 사라진다.
    syncGrowthAffordability();
  }
  if (ctx.activePanelTab === "talisman") syncTalismanPanel();
  // 강림부 손잡이는 갈피와 무관하게 전장에 서 있다 — 장수·경보를 여기서 맞춘다.
  syncTalismanBurst();
  renderIdiomHud();
  renderActiveIdioms();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHud2(): void {
  must<HTMLButtonElement>("#evolve-button").addEventListener("click", () => setPanelTab("evolution"));
  must<HTMLButtonElement>("#research-button").addEventListener("click", () => { sound.unlock(); handleAction(ctx.engine.upgradeResearch()); });
  must<HTMLButtonElement>("#auto-arrange-button").addEventListener("click", () => { sound.unlock(); handleAction(ctx.engine.autoArrangeTowers()); });
  bindArrangePolicy();
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
    // 열린 창은 프레임보다 안쪽 층위다 — 그 창의 Esc(닫기)를 가로채지 않는다.
    // [S/P-08] 공용 확인 창도 같은 줄에 선다. 빠뜨리면 Esc 가 확인 창 대신
    // 프레임을 걷어, 되돌릴 수 없는 확인이 화면에 남는다.
    if (helpDialog.open || settingsDialog.open || elementUpgradeDialog.open || abilityGuideDialog.open || casualFusionConfirmDialog.open || confirmDialog.open || codexDialog.open) return;
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
    /*
     * 액수와 자리를 **누르기 전에** 잡는다 (v041).
     *
     * 둘 다 어긋나 있었다. ① 액수는 `floor(prepRemaining/2)` 라는 옛 셈이라 엔진이
     * 실제로 준 액수와 달랐다(준비 11초에 화면 5 · 실제 4). ② 자리는 웨이브가 열린
     * **뒤에** 단추를 쟀는데, 교전 중에는 그 단추가 `display:none` 이라 상자가 전부
     * 0 이다 — 팝이 무대 왼쪽 위 구석(0,0)에 떠서 절반이 잘려 나갔다(실측: 셸 밖
     * 왼쪽 40px · 위 29px). 이득을 보이려던 연출이 이득을 감추고 있었다.
     */
    const button = must<HTMLButtonElement>("#early-button");
    const bonus = ctx.engine.earlyStartBonus();
    const rect = button.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const result = ctx.engine.startWaveEarly();
    handleAction(result, { invalidatePanels: false });
    if (result.ok) {
      noteEarlyStartUsed();
      if (bonus > 0) sound.playEarlyReward();
      // 이득이 "일어났다"가 눈에 남게: 버튼 자리에서 엽전 팝이 떠오른다.
      const pop = document.createElement("span");
      pop.className = "early-bonus-pop";
      pop.textContent = bonus > 0 ? `+${bonus} 엽전` : "웨이브 시작!";
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
