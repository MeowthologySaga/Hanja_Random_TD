/*
 * 창 공통 동작.
 */
import { codexDialog, helpDialog, settingsDialog } from "../app-context";

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireCommon1(): void {
  /*
   * 바깥 클릭으로 닫기.
   *
   * P00·S13 은 진작 되는데 도감·설정·도움말만 안 돼서, 창을 닫으려고
   * 바깥을 눌렀다가 아무 반응이 없으면 갇힌 것처럼 읽혔다. 같은 규칙으로
   * 맞춘다 — 배경(백드롭)을 누르면 event.target 이 dialog 자신이 된다.
   */
  for (const dialog of [codexDialog, settingsDialog, helpDialog]) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
}
