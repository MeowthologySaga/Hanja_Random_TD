/*
 * 부활 부적 — 판이 끝나는 자리에 서는 마지막 한 장(기획안 v035 ⑤).
 *
 * "게임 오버 될 때도 부적쓰기 매커니즘으로 1회 부활할수 있게 하자"(사용자).
 *
 * 종료 대화 대신 이 화면이 먼저 선다. 다 쓰면 판이 이어지고, 못 쓰거나 안 쓰면
 * 그대로 결과로 간다. **판당 한 번**이고 저장본에도 남아 이어하기로 무를 수 없다.
 *
 * 종이를 새로 만들지 않고 부적 패널의 화선지를 통째로 **옮겨 온다.** 붓 배선과
 * 획순 안내가 그 요소에 붙어 있어 다시 만들면 전부 다시 이어야 하고, 무엇보다
 * "늘 쓰던 그 종이"라는 감각이 이 장면에 맞다. 닫을 때 제자리에 돌려놓는다.
 */
import { ctx, must, sound } from "../app-context";
import { showToast } from "../hud";
import { beginRevivalSheet, endRevivalSheet } from "../panels/talisman";

/**
 * 안 쓸 사람을 붙잡아 두지 않는 시계(초).
 *
 * **첫 붓이 닿는 순간 멈춘다.** 이 시계의 몫은 난이도가 아니라 「안 쓸 사람의
 * 대답을 대신 받는 것」이기 때문이다. 종이에 서는 글자는 그 판에서 가장 어려운
 * 글자라(획이 스물아홉인 자도 있다) 시계를 끝까지 돌리면 **아무도 못 쓴다** —
 * 마지막 보루로 세운 장이 조롱이 된다. 쓰기 시작한 사람에게는 시간을 주고,
 * 안 쓰는 사람만 20초 뒤에 결과로 보낸다.
 */
const REVIVAL_SECONDS = 20;

let countdownTimer = 0;
let deadline = 0;
/** 첫 붓 감시를 닫을 때 함께 걷는다 — 안 걷으면 다음 판의 붓질에 얹힌다. */
let strokeWatch: AbortController | null = null;

function overlay(): HTMLElement {
  return must<HTMLElement>("#revival-overlay");
}

/** 옮겨 온 종이와 조작 줄을 부적 패널 제자리에 돌려놓는다. */
function returnPaper(): void {
  const panel = document.querySelector<HTMLElement>("#talisman-panel");
  const paper = document.querySelector<HTMLElement>("#talisman-paper");
  const footer = document.querySelector<HTMLElement>(".talisman-footer");
  if (!panel || !paper || !footer) return;
  panel.append(paper, footer);
}

function stopCountdown(): void {
  if (countdownTimer) window.clearInterval(countdownTimer);
  countdownTimer = 0;
}

function close(): void {
  stopCountdown();
  strokeWatch?.abort();
  strokeWatch = null;
  endRevivalSheet();
  returnPaper();
  // 이 층은 [hidden] 이 아니라 opacity·visibility 로 여닫는다(styles.css 1290절).
  overlay().classList.remove("modal-layer--visible");
}

/**
 * 진 자리에서 부적지를 편다.
 *
 * 살릴 수 없는 자리(이미 썼거나·수련장이거나·글자를 못 고르거나)면 false 를
 * 돌려주고, 부르는 쪽이 평소대로 종료 화면을 띄운다.
 */
export function showRevivalSheet(onDeclined: () => void): boolean {
  if (!ctx.engine.canRevive()) return false;
  const paper = beginRevivalSheet(() => {
    /*
     * 다 썼다. 인장이 찍히는 순간을 잠깐 보여 주고 판으로 돌려보낸다 —
     * 곧바로 걷으면 무엇 때문에 살아났는지가 안 남는다.
     */
    stopCountdown();
    const result = ctx.engine.revive();
    must<HTMLElement>("#revival-status").textContent = result.message;
    window.setTimeout(() => {
      close();
      showToast(result.message, false, "stage");
    }, 1_200);
  });
  if (!paper) return false;

  const footer = document.querySelector<HTMLElement>(".talisman-footer");
  const slot = must<HTMLElement>("#revival-paper-slot");
  slot.append(paper);
  if (footer) slot.append(footer);

  const cause = ctx.engine.state.defeatCause;
  must<HTMLElement>("#revival-message").textContent = cause === "boss-timeout"
    ? "다 쓰면 우두머리 제한시간 30초를 더 얻습니다."
    : "다 쓰면 전장의 적 절반을 봉인하고 이어 갑니다.";

  overlay().classList.add("modal-layer--visible");
  sound.playTalismanSeal();

  deadline = performance.now() + REVIVAL_SECONDS * 1_000;
  const tick = (): void => {
    const left = Math.max(0, (deadline - performance.now()) / 1_000);
    const label = document.querySelector<HTMLElement>("#revival-countdown");
    if (label) label.textContent = left.toFixed(1) + "초";
    if (left > 0) return;
    stopCountdown();
    close();
    onDeclined();
  };
  stopCountdown();
  countdownTimer = window.setInterval(tick, 100);
  tick();

  // 첫 붓이 닿으면 시계를 멈춘다 — 위 상수 주석의 까닭.
  strokeWatch?.abort();
  strokeWatch = new AbortController();
  document.querySelector<HTMLCanvasElement>("#talisman-ink")?.addEventListener("pointerdown", () => {
    stopCountdown();
    must<HTMLElement>("#revival-status").textContent = "붓을 들었으니 시간은 세지 않습니다 — 다 쓰면 이어 갑니다";
  }, { once: true, signal: strokeWatch.signal });

  must<HTMLButtonElement>("#revival-give-up").onclick = (): void => {
    close();
    onDeclined();
  };
  return true;
}
