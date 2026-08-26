/*
 * 도움말 창.
 */
import { helpDialog, must } from "../app-context";

/*
 * R17. 도움말 갈피.
 *
 * 21개 항목이 한 두루마리에 이어 붙어 있어 아래 절반은 사실상 읽히지 않았다.
 * 다섯 갈피로 갈라 한 번에 한 주제만 보이게 한다. 도감과 같은 `.codex-mode-tabs`
 * 어휘를 쓰고, 갈피를 바꾸면 두루마리를 맨 위로 되감는다 — 이전 갈피에서
 * 내려둔 자리에 새 글이 걸려 "빈 화면"으로 열리는 일을 막는다.
 *
 * 탭 버튼은 `<form method="dialog">` 안에 있으므로 type="button" 이 반드시
 * 필요하다. 기본 submit 이면 갈피를 누를 때마다 창이 닫힌다.
 */
const helpTabButtons = [...helpDialog.querySelectorAll<HTMLButtonElement>("[data-help-tab]")];

const helpPanels = [...helpDialog.querySelectorAll<HTMLElement>("[data-help-panel]")];

const helpScroller = must<HTMLFormElement>("#help-dialog > form");

function setHelpTab(tab: string, focusTab = false): void {
  for (const button of helpTabButtons) {
    const active = button.dataset.helpTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focusTab) button.focus();
  }
  for (const panel of helpPanels) panel.classList.toggle("is-active", panel.dataset.helpPanel === tab);
  helpScroller.scrollTop = 0;
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHelp1(): void {
  for (const [index, button] of helpTabButtons.entries()) {
    button.addEventListener("click", () => setHelpTab(button.dataset.helpTab ?? "start"));
    button.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (step === 0) return;
      event.preventDefault();
      const next = helpTabButtons[(index + step + helpTabButtons.length) % helpTabButtons.length];
      if (next) setHelpTab(next.dataset.helpTab ?? "start", true);
    });
  }
}

/** 언제 열어도 첫 갈피에서 시작한다 — 처음 온 사람이 보는 화면을 고정한다. */
function openHelpDialog(): void {
  setHelpTab("start");
  helpDialog.showModal();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireHelp2(): void {
  must<HTMLButtonElement>("#help-button").addEventListener("click", openHelpDialog);
  must<HTMLButtonElement>("#title-help-button").addEventListener("click", openHelpDialog);
}
