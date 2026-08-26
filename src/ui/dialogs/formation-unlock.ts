/*
 * 오행진 해금 확인 창.
 */
import { BOARD_FORMATIONS } from "../../core/content";
import { ctx, must, sound } from "../app-context";
import { focusMapOnFormation } from "../battle/camera";
import { handleAction } from "../hud";

// ── S13 맞춤 진법: 한자 범위 x 읽기·표기 x 진법 규칙을 한 화면에서 ──
// 세 번째 엔진 모드가 아니라 기존 설정들의 진입점이다(코덱스 스펙).
// JP/CN 범위 선택도 P00 확인을 우회하지 않는다.
/* ── 오행진 해금 확인 ─────────────────────────────────────────
   예전에는 잠긴 칸을 누르는 즉시 엽전이 빠져나갔다. 실수로 눌러도 되돌릴 수
   없었고, 무엇을 얼마에 샀는지도 남지 않았다. 전장 자물쇠와 상점 5칸 모두
   이 팝업 한 곳으로 모아 값과 결과를 먼저 보여 준다.
   ──────────────────────────────────────────────────────────── */
const formationUnlockDialog = must<HTMLDialogElement>("#formation-unlock-dialog");

let pendingFormationUnlock: number | null = null;

export function openFormationUnlockDialog(formationIndex: number): void {
  const formation = BOARD_FORMATIONS[formationIndex];
  if (!formation || ctx.engine.isFormationUnlocked(formationIndex)) return;
  pendingFormationUnlock = formationIndex;
  const cost = ctx.engine.nextFormationUnlockCost();
  const notStarted = ctx.engine.state.startingFormationIndex === null;
  const shortfall = cost === null ? 0 : Math.max(0, cost - ctx.engine.state.gold);
  must<HTMLElement>("#formation-unlock-glyph").textContent = formation.preferredWuxing;
  must<HTMLElement>("#formation-unlock-glyph").style.setProperty("--formation", formation.color);
  must<HTMLElement>("#formation-unlock-label").textContent = `${formation.label} 해금`;
  must<HTMLElement>("#formation-unlock-body").textContent = cost === null
    ? "모든 오행진을 이미 개방했습니다."
    : `${cost}엽전이 필요합니다. 해금하면 ${formation.label}의 4×4 칸이 열립니다.`;
  const reason = must<HTMLElement>("#formation-unlock-reason");
  const blocked = notStarted || cost === null || shortfall > 0;
  reason.hidden = !blocked;
  reason.textContent = notStarted
    ? "첫 자령을 소환하면 같은 오행진이 무료로 먼저 열립니다."
    : cost === null
      ? "더 살 진이 없습니다."
      : `엽전 ${shortfall} 부족`;
  must<HTMLElement>("#formation-unlock-price").textContent = String(cost ?? 0);
  must<HTMLButtonElement>("#formation-unlock-confirm").disabled = blocked;
  if (!formationUnlockDialog.open) formationUnlockDialog.showModal();
}

function closeFormationUnlockDialog(): void {
  pendingFormationUnlock = null;
  if (formationUnlockDialog.open) formationUnlockDialog.close();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireFormationUnlock1(): void {
  must<HTMLButtonElement>("#formation-unlock-confirm").addEventListener("click", () => {
    if (pendingFormationUnlock === null) return;
    const formationIndex = pendingFormationUnlock;
    sound.unlock();
    const result = ctx.engine.unlockFormation(formationIndex);
    closeFormationUnlockDialog();
    handleAction(result);
    // 성공하면 기존 개방 링 연출을 그대로 재사용해 어디가 열렸는지 눈으로 잇는다.
    if (result.ok) focusMapOnFormation(formationIndex);
  });
  must<HTMLButtonElement>("#formation-unlock-close").addEventListener("click", closeFormationUnlockDialog);
  formationUnlockDialog.addEventListener("click", (event) => {
    if (event.target === formationUnlockDialog) closeFormationUnlockDialog();
  });
  formationUnlockDialog.addEventListener("close", () => { pendingFormationUnlock = null; });
}
