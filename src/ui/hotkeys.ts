/*
 * 전역 단축키.
 */
import {
  abilityGuideDialog,
  casualFusionConfirmDialog,
  codexDialog,
  ctx,
  elementUpgradeDialog,
  helpDialog,
  must,
  settingsDialog
} from "./app-context";
import { cycleGameSpeed, summonAndFocus, toggleHanjaEmphasis } from "./battle/camera";
import { toggleManualPause } from "./game-loop";
import { handleAction, setPanelTab } from "./hud";
import { summonWithTalismanToken } from "./panels/talisman";

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHotkeys1(): void {
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || helpDialog.open || settingsDialog.open || elementUpgradeDialog.open || abilityGuideDialog.open || casualFusionConfirmDialog.open || codexDialog.open) return;
    // 기본 소환(1키)은 상점 카드와 같은 경로 — 부적 무료권이 있으면 먼저 쓴다.
    if (event.code === "Digit1") summonWithTalismanToken();
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
    /*
     * E — 웨이브 시작(v041). 준비 시간에만 살아 있고, 꺼져 있으면 click 이 아무
     * 일도 하지 않는다. 손이 상점 카드(1·Q)에 있는 채로 한 번에 넘길 수 있게.
     */
    else if (event.code === "KeyE") must<HTMLButtonElement>("#early-button").click();
  });
}
