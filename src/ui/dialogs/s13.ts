/*
 * 지역 선택(P00)과 맞춤 진법(S13) 창.
 */
import { defaultNotationForRegion, NOTATION_AXIS_READY } from "../../core/notation";
import { type GameMode, type NotationCode, type RegionCode } from "../../core/types";
import { type DisplayMode } from "../display-mode";
import { saveAutoPlaceSummons } from "../summon-placement";
import { ctx, must, sound } from "../app-context";
import { toggleHanjaEmphasis } from "../battle/camera";
import { handleAction } from "../hud";
import { setSelectedGameMode, syncTitleModeSelection } from "../s00-menu";
import { setDisplayMode, setHoverGlyphLarge, syncAutoPlaceControl } from "./settings";

export const REGION_MENU_INFO: Record<RegionCode, { name: string; pool: string }> = {
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

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireS131(): void {
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
}

const s13Dialog = must<HTMLDialogElement>("#s13-dialog");

export function syncS13(): void {
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-region]").forEach((button) => {
    const region = button.dataset.s13Region as RegionCode;
    button.disabled = false;
    button.classList.toggle("is-selected", region === ctx.selectedRegion);
    button.setAttribute("aria-checked", String(region === ctx.selectedRegion));
    button.title = REGION_MENU_INFO[region].pool;
  });
  // gripe #6 표기 축. 그룹 노출은 플래그가 정하고(테이블 도착 전 hidden),
  // 선택 표시는 실효 표기(명시 선택 ?? 로스터 자국 표기)를 따른다.
  const notationGroup = s13Dialog.querySelector<HTMLElement>(".s13-notation-group");
  if (notationGroup) notationGroup.hidden = !NOTATION_AXIS_READY;
  const effectiveNotation = ctx.selectedNotation ?? defaultNotationForRegion(ctx.selectedRegion);
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-notation]").forEach((button) => {
    const notation = button.dataset.s13Notation as NotationCode;
    const selected = notation === effectiveNotation;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
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

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireS132(): void {
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
    const notationButton = target.closest<HTMLButtonElement>("[data-s13-notation]");
    if (notationButton) {
      // 플래그가 꺼져 있으면 그룹이 hidden 이라 정상 경로로는 오지 못한다.
      // 방어적으로 한 번 더 막아 테이블 도착 전 표기 이탈을 봉한다.
      if (!NOTATION_AXIS_READY) return;
      sound.unlock();
      ctx.selectedNotation = notationButton.dataset.s13Notation as NotationCode;
      sound.playUiConfirm();
      syncS13();
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
}
