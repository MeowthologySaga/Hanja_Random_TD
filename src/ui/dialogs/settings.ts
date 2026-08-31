/*
 * 설정 창.
 */
import { type GameMode } from "../../core/types";
import { type DisplayMode, saveDisplayMode } from "../display-mode";
import { saveAutoPlaceSummons } from "../summon-placement";
import { CALM_SCREEN_STORAGE_KEY, ctx, HOVER_GLYPH_STORAGE_KEY, must, reducedMotion, settingsDialog, shell, sound, STROKE_ORDER_STORAGE_KEY } from "../app-context";
import { loadStrokeGlyphs } from "../../core/stroke-order";
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
 * 획순 안내 — 켤 때만 자료를 받는다.
 *
 * 2.5MB 라 끈 사람에게는 요청 자체를 보내지 않는다. 받아 두는 일은 여기서
 * 한 번만 하고, 실패하면 조용히 예전 방식으로 돌아간다 — 부적을 쓰는 도중에
 * 오류 창이 뜨는 것보다 안내가 안 서는 편이 낫다.
 */
function syncStrokeOrderControl(): void {
  const button = must<HTMLButtonElement>("#stroke-order-toggle");
  button.classList.toggle("is-on", ctx.strokeOrderGuide);
  button.setAttribute("aria-checked", String(ctx.strokeOrderGuide));
  must<HTMLElement>("#stroke-order-toggle i em").textContent = ctx.strokeOrderGuide ? "ON" : "OFF";
}

export function setStrokeOrderGuide(enabled: boolean): void {
  ctx.strokeOrderGuide = enabled;
  try {
    window.localStorage.setItem(STROKE_ORDER_STORAGE_KEY, String(enabled));
  } catch {
    // 사생활 보호 모드 등에서 저장이 막혀도 이번 세션 선택은 살린다.
  }
  syncStrokeOrderControl();
  if (!enabled) {
    showToast("획순 안내 OFF · 글자 한 장을 통째로 보여 줍니다");
    return;
  }
  void loadStrokeGlyphs().then((glyphs) => {
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
    syncAudioControls();
    settingsDialog.showModal();
  });
  // 저장된 선택이 OFF 면 첫 그림부터 반영되도록 초기 1회 맞춘다.
  syncHoverGlyphControl();
  // FB6: 저장된 선택(또는 OS 동작 줄이기)이 첫 그림부터 게이트에 실리게 한다.
  applyCalmScreen();
  // 켜 둔 채로 새로 연 판에서도 첫 부적지부터 안내가 서게 미리 받아 둔다.
  if (ctx.strokeOrderGuide) void loadStrokeGlyphs();
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
