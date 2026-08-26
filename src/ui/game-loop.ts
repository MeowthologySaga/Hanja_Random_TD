/*
 * requestAnimationFrame 루프와 일시정지.
 */
import { type GameEvent } from "../core/types";
import { canvas, ctx, must, shell, sound, summonReveal } from "./app-context";
import { drawWorld } from "./battle/draw";
import { syncCoachProgress } from "./coach";
import { showEndScreen } from "./dialogs/end";
import { syncEssenceFeedback } from "./essence-feedback";
import { processEvent } from "./events";
import { syncOneShotHints } from "./hint";
import { showToast, syncPanel } from "./hud";
import { showCasualFusionReveal, showSummonReveal } from "./summon-reveal";

/**
 * 소환·3합 공개 연출은 `<dialog>` 가 아니라 화면을 덮는 `<section>` 이라
 * `dialog[open]` 판정에 걸리지 않았다. 3초 남짓한 연출을 읽는 동안 적이 계속
 * 밀려들어 "카드를 읽었더니 판이 무너져 있다"가 됐다 — 도움말 다이얼로그와
 * 같은 규칙으로 세운다.
 */
export function revealPauseActive(): boolean {
  return summonReveal.classList.contains("is-active");
}

/** 열려 있는 모달 다이얼로그·공개 연출이 하나라도 있으면 전투를 세운다. */
function modalPauseActive(): boolean {
  return document.querySelector("dialog[open]") !== null || revealPauseActive();
}

function syncPauseChip(paused: boolean, manual: boolean): void {
  const chip = must<HTMLElement>("#pause-chip");
  if (chip.hidden !== !paused) chip.hidden = !paused;
  if (!paused) return;
  // 연출은 닫는 방법이 창과 달라(아무 곳이나 누름) 안내 문구도 갈라 준다.
  const reason = manual
    ? "P 키로 계속"
    : revealPauseActive() && document.querySelector("dialog[open]") === null
      ? "결과를 닫으면 계속"
      : "창을 닫으면 계속";
  const label = must<HTMLElement>("#pause-reason");
  if (label.textContent !== reason) label.textContent = reason;
}

export function toggleManualPause(): void {
  if (ctx.engine.state.phase !== "prep" && ctx.engine.state.phase !== "combat") return;
  ctx.manualPause = !ctx.manualPause;
  showToast(ctx.manualPause ? "일시정지 — P 키로 계속합니다." : "다시 진행합니다.");
}

export function frame(now: number): void {
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
  // 문기 증가 감시 — 이벤트 처리 직후여야 같은 프레임의 분해 SFX 와 겹침이 걸러진다.
  syncEssenceFeedback();
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
  // 1회성 안내는 코치보다 뒤에서 판정한다 — 코치가 떠 있으면 항상 기다린다.
  syncOneShotHints();
  if (waveStartedThisFrame) canvas.dataset.waveStartWorkMs = (performance.now() - frameWorkStartedAt).toFixed(2);
  window.requestAnimationFrame(frame);
}
