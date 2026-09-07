/*
 * requestAnimationFrame 루프와 일시정지.
 */
import { type GameEvent } from "../core/types";
import { canvas, ctx, must, shell, sound } from "./app-context";
import { drawWorld } from "./battle/draw";
import { syncCoachProgress } from "./coach";
import { showEndScreen } from "./dialogs/end";
import { showRevivalSheet } from "./dialogs/revival";
import { syncEssenceFeedback } from "./essence-feedback";
import { processEvent } from "./events";
import { syncOneShotHints } from "./hint";
import { showToast, syncPanel } from "./hud";
import { autoSaveRun } from "./run-save-slot";
import { syncScrollAffordances } from "./scroll-affordance";
import { showCasualFusionReveal, showSummonReveal } from "./summon-reveal";

/**
 * 공개 연출은 **판을 세우지 않는다**(v039).
 *
 * 한때는 세웠다 — 연출을 읽는 동안 적이 밀려들어 "카드를 읽었더니 판이 무너져
 * 있다"가 됐기 때문이다. 그런데 소환은 **연달아 누르는 조작**이다. 한 번 누를
 * 때마다 판이 통째로 멎었다 살아나니, 빠르게 누르면 게임이 끊겨 보였다
 * ("자령 소환시 멈추는거 없애. 연속으로 누르는데 렉걸리는거 같잖아" — 사용자).
 *
 * 애초의 걱정은 v037 에서 이미 다른 방식으로 풀렸다: 교전 중 평범한 한 기는
 * 카드 없이 패널 토스트 한 줄로 지나가고(summon-reveal.ts), 카드가 서는 것은
 * 첫 소환·새 발견·10연처럼 값하는 순간뿐이다. 그 몇 초를 위해 손맛을 버릴
 * 이유가 없다.
 *
 * 창(dialog)은 그대로 세운다 — 그것은 읽고 고르는 자리라 성격이 다르다.
 */
function modalPauseActive(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

function syncPauseChip(paused: boolean, manual: boolean, away: boolean): void {
  const chip = must<HTMLElement>("#pause-chip");
  if (chip.hidden !== !paused) chip.hidden = !paused;
  if (!paused) return;
  /*
   * 사유를 셋으로 가른다 (v042). **손으로 세운 것을 먼저 본다** — 창을 벗어났다
   * 돌아와도 사람이 P 로 세운 판은 계속 서 있어야 하기 때문이다.
   */
  const reason = manual ? "P 키로 계속" : away ? "창을 다시 누르면 계속" : "창을 닫으면 계속";
  const label = must<HTMLElement>("#pause-reason");
  if (label.textContent !== reason) label.textContent = reason;
}

export function toggleManualPause(): void {
  if (ctx.engine.state.phase !== "prep" && ctx.engine.state.phase !== "combat") return;
  /*
   * [v042] 창을 벗어나 서 있던 판이라면 P 는 「지금 이어라」다 — 1초 타이머를
   * 기다리게 하면 그 키가 고장 난 것으로 읽힌다.
   */
  if (ctx.awayPause) {
    clearAwayPause();
    ctx.manualPause = false;
    showToast("다시 진행합니다.");
    return;
  }
  ctx.manualPause = !ctx.manualPause;
  showToast(ctx.manualPause ? "일시정지 — P 키로 계속합니다." : "다시 진행합니다.");
}

/** 창을 벗어났다 돌아온 뒤 한 박자 — 복귀 클릭이 전장에 떨어지는 오조작을 막는다. */
const AWAY_RESUME_DELAY_MS = 1_000;

let awayResumeTimer = 0;

function pauseForAway(): void {
  if (!ctx.pauseOnBlur) return;
  // 빠른 알트탭에서 묵은 타이머가 살아 있으면, 다시 나간 뒤 1초 만에 판이 혼자 굴러간다.
  if (awayResumeTimer !== 0) {
    window.clearTimeout(awayResumeTimer);
    awayResumeTimer = 0;
  }
  ctx.awayPause = true;
}

function resumeFromAway(): void {
  if (!ctx.awayPause || awayResumeTimer !== 0) return;
  awayResumeTimer = window.setTimeout(() => {
    awayResumeTimer = 0;
    ctx.awayPause = false;
    // 얼어 있던 사이가 한 프레임에 쏟아지지 않게 시계를 지금으로 되감는다.
    ctx.lastFrame = performance.now();
  }, AWAY_RESUME_DELAY_MS);
}

/** 설정에서 토글을 끌 때 이미 서 있던 정지까지 걷는다. */
export function clearAwayPause(): void {
  if (awayResumeTimer !== 0) {
    window.clearTimeout(awayResumeTimer);
    awayResumeTimer = 0;
  }
  ctx.awayPause = false;
}

/**
 * 창을 벗어나면 멈추고, 탭이 숨으면 소리를 끈다 (v042).
 *
 * 40~50분(사람 손으로는 60분 남짓)짜리 한 판인데 자리를 비우는 동안에도 판이
 * 굴러갔다 — 돌아오면 무너져 있는 것이다. 정지는 **창을 벗어남**(blur)으로, 소리는
 * **탭이 숨음**(visibilitychange)으로 가른다: 옆 창을 쓰는 동안에도 음악은 들리는
 * 편이 낫고, 보이지도 않는 탭에서 나는 소리는 고장으로 읽힌다.
 */
export function wireAwayPause(): void {
  window.addEventListener("blur", pauseForAway);
  window.addEventListener("focus", resumeFromAway);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseForAway();
      sound.setAwayDuck(true);
      return;
    }
    resumeFromAway();
    sound.setAwayDuck(false);
  });
}

export function frame(now: number): void {
  const frameWorkStartedAt = performance.now();
  const delta = Math.min(0.1, Math.max(0, (now - ctx.lastFrame) / 1000));
  const running = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
  const paused = running && (ctx.manualPause || ctx.awayPause || modalPauseActive());
  /*
   * 수련장은 그 순간만 판을 늦춘다(v041) — 연출은 실시간을 지키므로 `drawWorld`
   * 쪽 delta 는 건드리지 않는다.
   */
  const simulationDelta = paused ? 0 : delta * ctx.gameSpeed * ctx.timeDilation;
  ctx.lastFrame = now;
  syncPauseChip(paused, ctx.manualPause, ctx.awayPause);
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
  /*
   * [트랙 V] 웨이브 경계 자동 저장.
   *
   * 전투가 준비 시간으로 넘어가는 순간이 곧 "웨이브를 하나 넘겼다"이고, 그때만
   * 전장이 비어 있어 담을 것이 상태 본체뿐이다. 아직 첫 웨이브 전이거나
   * 수련장이면 `autoSaveRun()` 이 스스로 지나간다.
   *
   * 목패를 여기서 다시 그리지는 않는다 — 타이틀 화면으로 가는 유일한 길이
   * 새로고침이라(returnToMenu) 목패는 다음 부팅에 어차피 슬롯을 다시 읽는다.
   */
  // 웨이브가 넘어갈 때마다 저장한다 — 준비 단계 복귀만 기다리면 잔존 합류로
  // 연쇄되는 판에서 저장이 영영 멈춘다(위 주석의 사고).
  if (frameEvents.some((event) => event.type === "phase" && event.phase === "prep")
    || frameEvents.some((event) => event.type === "wave")) autoSaveRun();
  const summonEvents = frameEvents.filter((event): event is Extract<GameEvent, { type: "summon" }> => event.type === "summon");
  if (summonEvents.length > 0) showSummonReveal(summonEvents);
  else showCasualFusionReveal(frameEvents.filter((event): event is Extract<GameEvent, { type: "casualFuse" }> => event.type === "casualFuse"));
  // 문기 증가 감시 — 이벤트 처리 직후여야 같은 프레임의 분해 SFX 와 겹침이 걸러진다.
  syncEssenceFeedback();
  if (ctx.engine.state.phase !== ctx.previousPhase) {
    ctx.previousPhase = ctx.engine.state.phase;
    if (ctx.previousPhase === "victory") showEndScreen("victory");
    else if (ctx.previousPhase === "defeat") {
      /*
       * 진 자리에서 부적 한 장을 먼저 세운다(v035 ⑤). 세울 수 없는 자리면
       * (이미 썼거나·수련장이거나) 곧바로 평소의 종료 화면으로 간다.
       */
      if (!showRevivalSheet(() => showEndScreen("defeat"))) showEndScreen("defeat");
    }
  }
  // Simulation respects the selected speed, while visual feedback keeps a
  // stable real-time duration so 2x/3x does not make projectiles and skill
  // labels flash for only a few frames.
  // 일시정지 중에는 이펙트도 0 으로 굴려 "적은 멈췄는데 탄만 난다"를 막는다.
  drawWorld(paused ? 0 : delta);
  syncPanel();
  // 접힘 신호는 패널을 다시 그린 "뒤"에 재야 방금 바뀐 내용 높이를 읽는다.
  syncScrollAffordances();
  syncCoachProgress();
  // 1회성 안내는 코치보다 뒤에서 판정한다 — 코치가 떠 있으면 항상 기다린다.
  syncOneShotHints();
  if (waveStartedThisFrame) canvas.dataset.waveStartWorkMs = (performance.now() - frameWorkStartedAt).toFixed(2);
  window.requestAnimationFrame(frame);
}
