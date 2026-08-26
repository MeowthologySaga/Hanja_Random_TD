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

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHotkeys1(): void {
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || helpDialog.open || settingsDialog.open || elementUpgradeDialog.open || abilityGuideDialog.open || casualFusionConfirmDialog.open || codexDialog.open) return;
    if (event.code === "Digit1") summonAndFocus();
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
  });
}
