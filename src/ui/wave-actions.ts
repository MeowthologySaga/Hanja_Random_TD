/*
 * 패널 행동 자리 — 눈이 머무는 쪽에 손이 닿게.
 *
 * "부적 집중하는동안 그곳 패널 밖에 신경 못쓰니까 다음웨이브 진행 버튼등
 * 패널쪽에 배치하라고 했는데 안했어"(사용자).
 *
 * v035 ⑥ 은 부적지 **아래**에 한 줄을 세웠는데, 그건 부적 탭을 열었을 때만
 * 보인다. 정작 사람이 오래 머무는 자리는 그 위 카드 — 탭과 무관하게 늘 서 있는
 * 자리다. 그래서 그 카드를 읽는 자리에서 **누르는 자리**로 바꾸고, 고르는 규칙은
 * 여기 한 곳에 둔다. 부적지 아래 줄도 같은 규칙에서 첫 줄을 가져다 쓴다 —
 * 두 자리가 서로 다른 말을 하면 무엇을 믿어야 할지 알 수 없다.
 *
 * 규칙 둘.
 *  ① **급한 것이 위다.** 적 한계가 차오르는 것보다 급한 것은 없다.
 *  ② **노드를 갈아 끼우지 않는다.** 자리는 늘 같은 수만큼 서 있고 글자와 처리만
 *     바뀐다 — 누르는 도중에 노드가 사라지면 click 이 아예 안 난다(제련소에서
 *     겪은 그 사고, e2e/growth-clickable.spec.ts).
 */
import { MAX_ENEMIES } from "../core/content";
import { summonCost } from "../core/engine-tuning";
import { UPGRADE_STAT_ORDER } from "../core/hanzi";
import { ctx, must, sound } from "./app-context";
import { captureTalismanLedger } from "./panels/talisman";

export type ActionTone = "urgent" | "offer" | "note";

export interface PanelAction {
  /** 자리 이름 — 같은 것이 계속 서 있는지 가리는 열쇠. */
  key: string;
  label: string;
  tone: ActionTone;
  title: string;
  /** null 이면 알림일 뿐 누를 수 없다. */
  action: (() => void) | null;
}

/** 지금 화면에 세울 만한 것들 — 급한 차례로. 쓰는 곳은 이 파일 하나다(v041). */
function pickPanelActions(): PanelAction[] {
  const state = ctx.engine.state;
  if (state.phase !== "prep" && state.phase !== "combat") return [];
  /*
   * 첫 소환 전에는 아무것도 안 권한다.
   *
   * 그 순간 할 일은 하나뿐이고, 개문 안내(#opening-guide)가 이미 「① 상점에서
   * 첫 자령을 소환하세요」라고 말한다. 같은 말을 한 줄 더 얹으면 그건 도움이
   * 아니라 소음이다.
   */
  if (state.summonCount === 0) return [];
  const picks: PanelAction[] = [];

  /*
   * ① 적 한계. 이 게임의 패배 조건이라 무엇보다 급하다. 70%(56체)에서 세운다 —
   * 90% 경고등이 켜질 무렵에는 이미 손쓸 시간이 없다.
   */
  const filled = state.enemies.length / MAX_ENEMIES;
  if (filled >= 0.7) {
    picks.push({
      key: "enemy-limit",
      label: `적 한계 ${state.enemies.length}/${MAX_ENEMIES}`,
      tone: "urgent",
      title: "적이 상한에 닿으면 판이 끝납니다. 전장을 보세요.",
      action: () => setTab("unit")
    });
  }

  /*
   * ①′ 화력 부족. 웨이브를 못 치워 합류 시계가 도는데(nextWaveRemaining) 엽전은
   * 소환 한 기 값이 있다 — 페르소나 실측에서 이 상황을 화면 어디도 급하게
   * 말하지 않아 1기로 출정한 사람이 8웨이브 동안 처치 0 으로 졌다. 적이 3할을
   * 넘어 쌓이는 것도 같은 신호다.
   */
  const cost = summonCost(state.summonCount);
  const stacking = state.phase === "combat" && (state.nextWaveRemaining !== null || filled >= 0.3);
  if (stacking && state.gold >= cost && filled < 0.7) {
    picks.push({
      key: "summon",
      label: `소환 ${cost}엽전 · 화력 부족`,
      tone: "urgent",
      title: "적을 다 못 잡으면 다음 웨이브가 합류합니다. 자령을 더 세우세요.",
      action: () => setTab("shop")
    });
  }

  /*
   * ② 지금 시작. 패널에서는 전용 단추(#early-button)가 맡으므로 목록에서는
   * 두 번째다 — 부적지 아래 한 줄이 이 항목을 가져다 쓴다.
   */
  if (state.phase === "prep" && state.summonCount > 0) {
    const bonus = ctx.engine.earlyStartBonus();
    picks.push({
      key: "early-start",
      label: `지금 시작 · 엽전 +${bonus}`,
      tone: "offer",
      title: "준비 시간을 되돌려주고 엽전을 받습니다. 마지막 몇 초는 값이 없어 부적을 마저 쓸 수 있습니다.",
      action: () => {
        const result = ctx.engine.startWaveEarly();
        if (!result.ok) return;
        sound.playUiConfirm();
      }
    });
  }

  // ③ 부적이 남아 있다. 쓰라고 권하는 것이 아니라 **몇 장 남았는지**를 알린다.
  const charges = captureTalismanLedger().charges;
  if (ctx.talismanMode && charges > 0) {
    picks.push({
      key: "talisman",
      label: `부적 ${charges}장`,
      tone: "note",
      title: "따라 쓰면 자령이 응답합니다 — 엽전·문기·전장 이벤트.",
      action: () => setTab("talisman")
    });
  }

  // ④ 소환할 엽전이 있다. 판을 넓히는 것이 언제나 첫 수다.
  if (state.gold >= cost && !picks.some((pick) => pick.key === "summon")) {
    picks.push({
      key: "summon",
      label: `소환 ${cost}엽전`,
      tone: "note",
      title: "자령을 한 기 더 세웁니다.",
      action: () => setTab("shop")
    });
  }

  // ⑤ 올릴 수 있는 강화가 있다.
  if (UPGRADE_STAT_ORDER.some((stat) => ctx.engine.quoteGlobalUpgrade(stat, 1).affordable)) {
    picks.push({
      key: "growth",
      label: "강화 가능",
      tone: "note",
      title: "엽전으로 공용 능력을 올릴 수 있습니다.",
      action: () => setTab("growth")
    });
  }

  return picks;
}

/** 패널 갈피를 옮긴다 — hud 의 setPanelTab 을 늦게 불러 순환 수입을 피한다. */
function setTab(tab: string): void {
  void import("./hud").then((hud) => {
    hud.setPanelTab(tab as Parameters<typeof hud.setPanelTab>[0]);
  });
}

/**
 * 행동 자리를 그린다.
 *
 * 자리는 둘로 고정이다(+ 전용 [시작] 단추). 세울 것이 모자라면 빈 자리를
 * 감추되 **노드는 남긴다** — 위 주석 ②의 규칙.
 */
export function syncWaveActions(): void {
  const row = document.querySelector<HTMLElement>("#wave-action-row");
  if (!row) return;
  // [시작]은 전용 단추가 맡으므로 목록에서 뺀다 — 같은 말이 두 번 서면 소음이다.
  const picks = pickPanelActions().filter((pick) => pick.key !== "early-start");
  for (let slot = 0; slot < 2; slot += 1) {
    const button = must<HTMLButtonElement>(`#wave-action-${slot === 0 ? "a" : "b"}`);
    const pick = picks[slot];
    if (!pick) {
      button.hidden = true;
      button.onclick = null;
      continue;
    }
    button.hidden = false;
    button.dataset.tone = pick.tone;
    button.dataset.actionKey = pick.key;
    if (button.textContent !== pick.label) button.textContent = pick.label;
    button.title = pick.title;
    button.disabled = pick.action === null;
    button.onclick = pick.action === null
      ? null
      : () => {
        sound.unlock();
        pick.action?.();
      };
  }
}
