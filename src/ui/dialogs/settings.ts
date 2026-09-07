/*
 * 설정 창.
 */
import { type GameMode } from "../../core/types";
import { type DisplayMode, saveDisplayMode } from "../display-mode";
import { saveAutoPlaceSummons } from "../summon-placement";
import { CALM_SCREEN_STORAGE_KEY, ctx, HOVER_GLYPH_STORAGE_KEY, must, PAUSE_ON_BLUR_STORAGE_KEY, READING_VOICE_STORAGE_KEY, reducedMotion, settingsDialog, shell, sound, STROKE_ORDER_STORAGE_KEY } from "../app-context";
import { clearAwayPause } from "../game-loop";
import { loadStrokeGlyphs } from "../../core/stroke-order";
import { refreshStrokeGuideSheet } from "../panels/talisman";
import { refreshSoulStrokeGuide } from "../panels/soul-reroll";
import { primeVoices, speechAvailable, stopReading } from "../tts";
import { startCoach } from "../coach";
import { handleAction, showToast } from "../hud";
import { openStandardModeNotice } from "./s13";
import { setSelectedGameMode } from "../s00-menu";

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

export function setHoverGlyphLarge(enabled: boolean): void {
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

/*
 * FB6 차분한 화면.
 *
 * 실효값 = 명시적 선택(localStorage) ?? OS 동작 줄이기. CSS 는
 * .game-shell[data-calm-screen="1"] 게이트로, 전장 캔버스는 draw/fx 의
 * calmBattlefield() 분기로 같은 값을 읽는다.
 */
function syncCalmScreenControl(): void {
  const button = must<HTMLButtonElement>("#calm-screen-toggle");
  button.classList.toggle("is-on", ctx.calmScreen);
  button.setAttribute("aria-checked", String(ctx.calmScreen));
  must<HTMLElement>("#calm-screen-toggle i em").textContent = ctx.calmScreen ? "ON" : "OFF";
}

/*
 * 읽기 소리(TTS) — 기본 꺼짐.
 *
 * 무엇을 어느 말로 읽는지는 ui/tts.ts 가 혼자 안다. 여기서는 켬/끔과 저장,
 * 그리고 끌 때 지금 말하는 것을 걷는 일만 한다.
 */
function syncReadingVoiceControl(): void {
  const button = must<HTMLButtonElement>("#reading-voice-toggle");
  button.classList.toggle("is-on", ctx.readingVoice);
  button.setAttribute("aria-checked", String(ctx.readingVoice));
  must<HTMLElement>("#reading-voice-toggle i em").textContent = ctx.readingVoice ? "ON" : "OFF";
}

export function setReadingVoice(enabled: boolean): void {
  ctx.readingVoice = enabled;
  try {
    window.localStorage.setItem(READING_VOICE_STORAGE_KEY, String(enabled));
  } catch {
    // 저장이 막혀도 이번 판의 선택은 살린다(획순 안내와 같은 규범).
  }
  syncReadingVoiceControl();
  if (!enabled) {
    // 끄는 순간 말하던 것도 걷는다 — 껐는데 계속 말하면 고장으로 읽힌다.
    stopReading();
    // 말이 잘려도 눌러 둔 배경음은 반드시 되돌린다.
    sound.duckForSpeech(false);
    showToast("읽기 소리 OFF");
    return;
  }
  /*
   * 목소리 목록은 늦게 온다(크롬은 첫 호출에 빈 배열을 준다). 켜는 이 순간
   * 한 번 찔러 두면 정작 부적을 다 썼을 때 언어를 못 고르는 일이 없다.
   */
  primeVoices();
  const ready = speechAvailable();
  showToast(ready
    ? "읽기 소리 ON · 부적을 완성하면 그 글자를 읽어 줍니다"
    : "이 브라우저는 읽기 소리를 지원하지 않습니다", !ready);
}

/*
 * 획순 안내 — 켤 때만 자료를 받는다.
 *
 * 2.5MB 라 끈 사람에게는 요청 자체를 보내지 않는다. 받아 두는 일은 여기서
 * 한 번만 하고, 실패하면 조용히 예전 방식으로 돌아간다 — 부적을 쓰는 도중에
 * 오류 창이 뜨는 것보다 안내가 안 서는 편이 낫다.
 */
/**
 * 창을 벗어나면 멈춤 (v042).
 *
 * 40~50분(사람 손으로는 60분 남짓)짜리 한 판인데 자리를 비우는 동안에도 판이
 * 굴러갔다 — 돌아오면 무너져 있는 것이다. 기본은 켜짐이고, 끄면 이미 서 있던
 * 정지까지 함께 걷는다(안 그러면 끈 뒤에도 판이 서 있어 고장으로 읽힌다).
 */
function syncPauseOnBlurControl(): void {
  const button = must<HTMLButtonElement>("#pause-on-blur-toggle");
  button.classList.toggle("is-on", ctx.pauseOnBlur);
  button.setAttribute("aria-checked", String(ctx.pauseOnBlur));
  must<HTMLElement>("#pause-on-blur-toggle i em").textContent = ctx.pauseOnBlur ? "ON" : "OFF";
}

function setPauseOnBlur(enabled: boolean): void {
  ctx.pauseOnBlur = enabled;
  try {
    window.localStorage.setItem(PAUSE_ON_BLUR_STORAGE_KEY, String(enabled));
  } catch {
    // 저장이 막혀 있어도 이번 세션 동작에는 영향이 없다.
  }
  if (!enabled) clearAwayPause();
  syncPauseOnBlurControl();
  showToast(enabled ? "창을 벗어나면 판이 멈춥니다." : "창을 벗어나도 판이 계속 굴러갑니다.");
}

function syncStrokeOrderControl(): void {
  const button = must<HTMLButtonElement>("#stroke-order-toggle");
  button.classList.toggle("is-on", ctx.strokeOrderGuide);
  button.setAttribute("aria-checked", String(ctx.strokeOrderGuide));
  must<HTMLElement>("#stroke-order-toggle i em").textContent = ctx.strokeOrderGuide ? "ON" : "OFF";
}

/**
 * 펴 둔 따라 쓰기 판 둘에 지금 설정을 얹는다.
 *
 * 판이 안 열려 있으면 두 함수 모두 조용히 돌아간다 — 여기서 열려 있는지 묻지
 * 않는 이유는, 그 판단이 각 판의 몫이기 때문이다(무엇이 「지금 글자」인지는
 * 그쪽만 안다).
 */
function applyStrokeGuideToOpenSheets(force: boolean): void {
  refreshStrokeGuideSheet(force);
  refreshSoulStrokeGuide(force);
}

export function setStrokeOrderGuide(enabled: boolean): void {
  ctx.strokeOrderGuide = enabled;
  try {
    window.localStorage.setItem(STROKE_ORDER_STORAGE_KEY, String(enabled));
  } catch {
    // 사생활 보호 모드 등에서 저장이 막혀도 이번 세션 선택은 살린다.
  }
  syncStrokeOrderControl();
  // 지금 펴 둔 종이에 곧바로 반영한다 — 켰는데 안 바뀌면 껐는지 켰는지 모른다.
  applyStrokeGuideToOpenSheets(true);
  if (!enabled) {
    showToast("획순 안내 OFF · 글자 한 장을 통째로 보여 줍니다");
    return;
  }
  void loadStrokeGlyphs().then((glyphs) => {
    // 자료가 늦게 와도 지금 종이에 세운다. 이미 쓰기 시작했으면 건드리지 않는다.
    applyStrokeGuideToOpenSheets(false);
    showToast(glyphs
      ? "획순 안내 ON · 따라 쓰기 판에서 획을 하나씩 짚어 줍니다"
      : "획순 자료를 받지 못했습니다 — 글자 한 장을 통째로 보여 줍니다", glyphs === null);
  });
}

/** 선택(설정 > OS)을 실효값으로 굳혀 셸 게이트에 새긴다. */
function applyCalmScreen(): void {
  ctx.calmScreen = ctx.calmScreenChoice ?? reducedMotion;
  shell.dataset.calmScreen = ctx.calmScreen ? "1" : "0";
  syncCalmScreenControl();
}

export function setCalmScreen(enabled: boolean): void {
  ctx.calmScreenChoice = enabled;
  try {
    window.localStorage.setItem(CALM_SCREEN_STORAGE_KEY, String(enabled));
  } catch {
    // 사생활 보호 모드 등에서 저장이 막혀도 이번 세션 선택은 살린다.
  }
  applyCalmScreen();
  showToast(enabled
    ? "차분한 화면 ON · 맥동·플래시·먹물 흐름을 멈춥니다"
    : "차분한 화면 OFF · 기본 연출로 되돌립니다");
}

export function syncAutoPlaceControl(): void {
  const button = must<HTMLButtonElement>("#auto-place-toggle");
  const enabled = ctx.engine.state.autoPlaceSummons;
  button.classList.toggle("is-on", enabled);
  button.setAttribute("aria-checked", String(enabled));
  must<HTMLElement>("#auto-place-toggle i em").textContent = enabled ? "ON" : "OFF";
}

export function syncAudioControls(): void {
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

export function setDisplayMode(mode: DisplayMode, announce = true): void {
  ctx.displayMode = mode;
  shell.dataset.displayMode = mode;
  saveDisplayMode(mode);
  syncDisplayModeControls();
  if (announce) {
    sound.playUiConfirm();
    showToast(mode === "spirit" ? "자령 모드 · 한자와 훈음을 머리 위에 표시" : "공부 모드 · 큰 한자와 읽기를 전장에 표시");
  }
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireSettings1(): void {
  must<HTMLButtonElement>("#settings-button").addEventListener("click", () => {
    sound.unlock();
    syncDisplayModeControls();
    syncAutoPlaceControl();
    syncHoverGlyphControl();
    syncCalmScreenControl();
    syncStrokeOrderControl();
    syncPauseOnBlurControl();
    syncReadingVoiceControl();
    syncAudioControls();
    settingsDialog.showModal();
  });
  // 저장된 선택이 OFF 면 첫 그림부터 반영되도록 초기 1회 맞춘다.
  syncHoverGlyphControl();
  // FB6: 저장된 선택(또는 OS 동작 줄이기)이 첫 그림부터 게이트에 실리게 한다.
  applyCalmScreen();
  /*
   * 획순 자료를 **한가할 때** 미리 받는다.
   *
   * 부적 탭을 처음 열 때만 받게 두었더니, 느린 회선에서는 그 사이 종이가 맨
   * 종이로 서서 "획순 모드가 아닌 것"으로 보였다(사용자 제보). 그렇다고 부팅
   * 경로에서 곧바로 끌면 자령 그림들과 대역폭을 다툰다 — 브라우저가 한가하다고
   * 할 때 시작해, 사람이 부적을 열 즈음에는 와 있게 한다. 꺼 둔 사람은 받지
   * 않는다.
   */
  if (ctx.strokeOrderGuide) {
    const kick = (): void => {
      void loadStrokeGlyphs().then(() => applyStrokeGuideToOpenSheets(false));
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number })
      .requestIdleCallback;
    if (idle) idle(kick, { timeout: 5_000 });
    else window.setTimeout(kick, 2_500);
  }
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireSettings2(): void {
  must<HTMLButtonElement>("#title-settings-button").addEventListener("click", () => {
    sound.unlock();
    syncDisplayModeControls();
    syncAutoPlaceControl();
    syncHoverGlyphControl();
    syncCalmScreenControl();
    syncStrokeOrderControl();
    syncReadingVoiceControl();
    syncAudioControls();
    settingsDialog.showModal();
  });
  must<HTMLButtonElement>("#hover-glyph-toggle").addEventListener("click", () => {
    sound.unlock();
    setHoverGlyphLarge(!ctx.hoverGlyphLarge);
    sound.playUiConfirm();
  });
  must<HTMLButtonElement>("#calm-screen-toggle").addEventListener("click", () => {
    sound.unlock();
    setCalmScreen(!ctx.calmScreen);
    sound.playUiConfirm();
  });
  must<HTMLButtonElement>("#stroke-order-toggle").addEventListener("click", () => {
    sound.unlock();
    setStrokeOrderGuide(!ctx.strokeOrderGuide);
    sound.playUiConfirm();
  });
  must<HTMLButtonElement>("#pause-on-blur-toggle").addEventListener("click", () => {
    sound.unlock();
    setPauseOnBlur(!ctx.pauseOnBlur);
    sound.playUiConfirm();
  });
  must<HTMLButtonElement>("#reading-voice-toggle").addEventListener("click", () => {
    sound.unlock();
    setReadingVoice(!ctx.readingVoice);
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
    button.addEventListener("click", () => {
      const mode = button.dataset.gameModeOption as GameMode;
      // 자형연성은 얼리 액세스 — 고르는 순간 무엇이 덜 여물었는지 먼저 말한다.
      if (mode === "standard" && ctx.selectedGameMode !== "standard") openStandardModeNotice();
      else setSelectedGameMode(mode);
    });
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
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireSettings3(): void {
  must<HTMLButtonElement>("#sound-button").addEventListener("click", () => {
    const muted = sound.toggle();
    syncAudioControls();
    if (!muted) sound.playUiConfirm();
    showToast(muted ? "전체 소리 꺼짐" : "전체 소리 켜짐");
  });
}
