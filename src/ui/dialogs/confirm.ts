/*
 * 공용 확인 창 — 되돌릴 수 없는 조작 앞에 세우는 한 벌.
 *
 * [S/P-08] 분해 셋(제련소 일괄·가방 일괄·카드 1기)과 최대 강화가 저마다
 * window.confirm 을 불렀다. 브라우저 기본 창은 ① 게임 어휘 밖의 낯선 상자이고
 * ② 자동화가 자동 취소해 버려 e2e 로 지킬 수 없었다. 여기 한 곳으로 모은다.
 *
 * 창 자체는 <dialog> 라 game-loop 의 "열린 창이 있으면 전투를 세운다" 규칙이
 * 그대로 걸린다 — 확인을 읽는 동안 웨이브가 굴러가지 않는다.
 */
import { must } from "../app-context";

export interface ConfirmSpec {
  /** 작은 머리말 — 어느 공방에서 부른 확인인지. */
  eyebrow: string;
  /** 한 줄 질문. */
  title: string;
  /** 본문 줄들. 각 줄은 이미 이스케이프된 HTML 조각으로 다룬다. */
  lines: readonly string[];
  /** 수락 버튼 문구 — "확인" 같은 빈말 대신 무슨 일이 벌어지는지 적는다. */
  confirmLabel: string;
  /** 취소 버튼 문구. 기본 "취소". */
  cancelLabel?: string;
  /** 되돌릴 수 없는 조작이면 "danger" — 수락 버튼이 붉은 인장을 쓴다. */
  tone?: "danger" | "neutral";
}

let pending: (() => void) | null = null;

function dialog(): HTMLDialogElement {
  return must<HTMLDialogElement>("#confirm-dialog");
}

function settle(accepted: boolean): void {
  const run = pending;
  pending = null;
  const element = dialog();
  if (element.open) element.close();
  if (accepted) run?.();
}

/**
 * 확인 창을 열고, 수락했을 때만 onConfirm 을 부른다.
 *
 * 콜백을 쓰는 이유: 부르는 쪽이 전부 동기 이벤트 처리기라서, Promise 로
 * 바꾸면 await 이 없는 자리에 떠도는 약속이 남는다.
 */
export function openConfirm(spec: ConfirmSpec, onConfirm: () => void): void {
  const element = dialog();
  // 이미 열려 있으면 앞선 확인은 취소로 접는다 — 두 확인이 겹치는 편이 더 위험하다.
  if (element.open) settle(false);
  pending = onConfirm;
  must<HTMLElement>("#confirm-dialog-eyebrow").textContent = spec.eyebrow;
  must<HTMLElement>("#confirm-dialog-title").textContent = spec.title;
  must<HTMLElement>("#confirm-dialog-body").innerHTML = spec.lines.map((line) => `<p>${line}</p>`).join("");
  const accept = must<HTMLButtonElement>("#confirm-dialog-accept");
  accept.textContent = spec.confirmLabel;
  accept.classList.toggle("is-danger", spec.tone !== "neutral");
  must<HTMLButtonElement>("#confirm-dialog-cancel").textContent = spec.cancelLabel ?? "취소";
  element.showModal();
  // 되돌릴 수 없는 창에서 엔터를 눌러 곧장 수락하는 사고를 막는다 — 초점은 취소에.
  must<HTMLButtonElement>("#confirm-dialog-cancel").focus();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireConfirm1(): void {
  const element = dialog();
  must<HTMLButtonElement>("#confirm-dialog-accept").addEventListener("click", () => settle(true));
  must<HTMLButtonElement>("#confirm-dialog-cancel").addEventListener("click", () => settle(false));
  // 백드롭(바깥) 클릭은 취소 — 다른 창들과 같은 규칙이다.
  element.addEventListener("click", (event) => {
    if (event.target === element) settle(false);
  });
  /*
   * Esc 는 네이티브로 닫힌다. 그 길로 들어와도 약속은 반드시 접는다.
   * close 이벤트는 close() 직후가 아니라 한 박자 뒤에 오므로(명세상 큐에 실린다),
   * 그 사이 새 창이 열렸다면 이 close 는 지난 창의 것이다 — 열려 있으면 지나친다.
   */
  element.addEventListener("close", () => {
    if (!element.open && pending !== null) settle(false);
  });
}
