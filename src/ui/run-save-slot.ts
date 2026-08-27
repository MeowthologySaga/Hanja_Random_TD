/*
 * 런 저장 슬롯의 화면 쪽 — 자동 저장 시점과 목패 문구 (트랙 V).
 *
 * 코어(`core/run-save.ts`)는 형식·무결성·저장소만 안다. 여기서는 "언제 뜨고
 * 언제 지우고 무엇이라 적을 것인가"만 정한다. `s00-menu.ts` 가 목패를 세우고
 * 이 모듈의 함수를 부른다 — 반대 방향 import 는 없다(순환 회피).
 */
import {
  captureRunSave,
  clearRunSave,
  parseRunSave,
  type RunSave,
  RUN_SAVE_STORAGE_KEY,
  runSaveSummary,
  writeRunSave
} from "../core/run-save";
import { captureTalismanLedger, restoreTalismanLedger } from "./panels/talisman";
import { ctx } from "./app-context";
import { REGION_MENU_INFO } from "./dialogs/s13";
import { formatTime, gameModeLabel } from "./format";

/**
 * 슬롯을 열어 본 결과.
 *
 * - `empty`: 아무것도 없다. 첫 방문이거나 방금 판을 끝냈다.
 * - `ready`: 되살릴 수 있는 저장본이 있다.
 * - `unreadable`: 무언가 있긴 한데 이 판으로는 읽을 수 없다(형식 판 불일치·
 *   파손·남이 쓴 값). 판정 자체는 조용하지만, 사람에게는 두고 온 판이 있었던
 *   기억이 있으므로 이 경우에만 한 줄 알린다.
 */
export type RunSaveSlotStatus = "empty" | "ready" | "unreadable";

export function readRunSaveSlot(): { status: RunSaveSlotStatus; save: RunSave | null } {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RUN_SAVE_STORAGE_KEY);
  } catch {
    return { status: "empty", save: null };
  }
  if (raw === null || raw === "") return { status: "empty", save: null };
  const save = parseRunSave(raw);
  return save ? { status: "ready", save } : { status: "unreadable", save: null };
}

/**
 * 슬롯 안의 저장본. 없거나·판이 다르거나·파손이면 null 이다 —
 * 그 셋을 목패는 구분하지 않는다(전부 "이어할 것이 없다"로 같다).
 */
export function readSavedRun(): RunSave | null {
  return readRunSaveSlot().save;
}

/**
 * 웨이브를 하나 넘길 때마다 부른다. 저장할 수 없는 판이면 조용히 지나간다.
 *
 * 저장 지점을 웨이브 경계 하나로 못박은 이유: 그 순간에만 전장이 비어 있어
 * (적·투사체·장판이 전부 정리된 준비 시간) 담을 것이 상태 본체뿐이고, 되살린
 * 판이 "전투 한복판에서 갑자기 시작"하는 어색함도 없다.
 */
export function autoSaveRun(): boolean {
  const ledger = captureTalismanLedger();
  const save = captureRunSave(ctx.engine, {
    talismanFreeSummonTokens: ctx.talismanFreeSummonTokens,
    talismanCharges: ledger.charges,
    talismanChargeWave: ledger.chargeWave
  });
  if (!save) return false;
  return writeRunSave(save);
}

/**
 * 슬롯을 비운다.
 *
 * 부르는 자리는 둘이다. ① 판이 끝났을 때(승리·패배) — 끝난 판에 이어하기가
 * 남아 있으면 종료 화면을 지나 새로고침하는 것만으로 패배 직전으로 되돌아갈
 * 수 있다. 그건 이어하기가 아니라 무르기다. ② 새 판을 시작할 때 — 1슬롯이라
 * 어차피 덮인다. 확인 창은 부르는 쪽(`s00-menu.ts`)이 세운다.
 */
export function clearSavedRun(): void {
  clearRunSave();
}

/** 저장본의 UI 층 자원을 지금 화면에 얹는다. */
export function applySavedUiState(save: RunSave): void {
  ctx.talismanFreeSummonTokens = Math.max(0, Math.floor(save.ui.talismanFreeSummonTokens));
  // 부적 장부가 없는 옛 저장본이면 손대지 않는다 — 그 판은 웨이브 기준으로 다시 센다.
  if (save.ui.talismanCharges !== undefined && save.ui.talismanChargeWave !== undefined) {
    restoreTalismanLedger({ charges: save.ui.talismanCharges, chargeWave: save.ui.talismanChargeWave });
  }
}

/**
 * 이어하기 목패의 요약 두 줄.
 *
 * - `where`: 어떤 판이었나 — 진법 · 지역.
 * - `progress`: 어디까지 갔나 — 웨이브 · 경과 시간. 목패가 답하는 질문이 이쪽이라
 *   화면에서도 한 톤 밝게 선다.
 */
export function savedRunSummaryLines(save: RunSave): { where: string; progress: string } {
  const summary = runSaveSummary(save);
  return {
    where: `${gameModeLabel(summary.mode)} · ${REGION_MENU_INFO[summary.region].name}`,
    progress: `${summary.wave}/${summary.maxWaves}웨이브 · ${formatTime(summary.elapsed)} 진행`
  };
}

/** 목패의 접근성 이름과 확인 창이 함께 읽는 한 줄. */
export function savedRunSummaryText(save: RunSave): string {
  const { where, progress } = savedRunSummaryLines(save);
  return `${where} · ${progress}`;
}

/** 확인 창 본문이 읽는, 덮어쓸 판의 한 줄 소개. */
export function savedRunConfirmLine(save: RunSave): string {
  return savedRunSummaryText(save);
}
