/*
 * 판 종료 화면.
 */
import { MAX_ENEMIES } from "../../core/content";
import { ctx, endOverlay, must } from "../app-context";
import { formatTime, gameModeLabel } from "../format";
import { setFocusFrame } from "../hud";
import { hideSummonReveal } from "../summon-reveal";
import { totalElementUpgradeLevels, totalGlobalUpgradeLevels } from "./element-upgrade";

export function showEndScreen(phase: "victory" | "defeat"): void {
  // 강화·농축 프레임을 연 채 패배하면 종료 화면 뒤에 프레임이 남아,
  // 재도전 직후 전장이 어두운 유리 아래 갇힌다.
  setFocusFrame(null);
  // 소환·3합 공개 연출도 같은 이유로 먼저 걷는다 — 연출 중에 패배하면
  // 카드 막이 종료 화면 통계 11칸 중 8칸을 그대로 덮었다.
  hideSummonReveal();
  const state = ctx.engine.state;
  const victory = phase === "victory";
  // 최고 기록은 이번 판을 저장하기 "전"에 읽어야 갱신 여부를 알 수 있다.
  const previousBest = loadBestWave();
  const renewed = state.wave > previousBest;
  const bestWave = Math.max(previousBest, state.wave);
  // [FB3] 패배 사유 명시 — "왜 졌는지"를 엔진의 defeatCause 로 읽는다.
  // lastMessage(#end-message)가 상세를 맡고, 제목은 원인을 한 줄로 못박는다.
  const enemyLimitDefeat = !victory && state.defeatCause === "enemy-limit";
  must<HTMLElement>("#end-kicker").textContent = victory ? "봉인 완수" : enemyLimitDefeat ? "적 한계 초과" : "수비 실패";
  must<HTMLElement>("#end-heading").textContent = victory
    ? "천자문 대봉인 완성"
    : enemyLimitDefeat ? "적 한계 초과로 수비 실패" : "수비에 실패했습니다";
  // P-18: lastMessage 는 "마지막으로 한 조작"이라 패배 순간과 무관한 승급 로그가
  // 오는 일이 잦았다. 사유가 분명하면 사유 문장을 쓰고, 조작 로그는 버린다.
  must<HTMLElement>("#end-message").textContent = victory
    ? state.lastMessage
    : state.defeatCause === "enemy-limit"
      ? `적 ${MAX_ENEMIES}체가 전장을 뒤덮어 봉인이 무너졌습니다.`
      : state.defeatCause === "boss-timeout"
        ? "제한시간 안에 우두머리를 처치하지 못했습니다."
        : state.lastMessage;
  must<HTMLElement>("#end-stats").innerHTML = `
    <div><span>진법</span><b>${gameModeLabel(state.mode)}</b></div>
    <div><span>도달 웨이브</span><b>${state.wave} / ${state.maxWaves}</b></div>
    <div${renewed ? ' class="is-record"' : ""}><span>최고 기록</span><b>${bestWave}웨이브${renewed ? "<em>갱신!</em>" : ""}</b></div>
    <div><span>처치한 적</span><b>${state.killCount}</b></div>
    <div><span>${state.mode === "casual" ? "3체 조합" : "한자 합성"}</span><b>${state.mode === "casual" ? state.casualFusionCount : state.evolutionCount}</b></div>
    <div><span>목표 완성</span><b>${state.goalsCompleted.length}</b></div>
    <div><span>사자성어 발동</span><b>${state.idiomSeals.length} / ${ctx.engine.idioms().length}</b></div>
    <div><span>은행 이자</span><b>${state.interestEarned}엽전</b></div>
    <div><span>능력 강화</span><b>${totalGlobalUpgradeLevels() + totalElementUpgradeLevels()}단계</b></div>
    <div><span>발견 한자</span><b>${state.discoveredChars.length}</b></div>
    <div><span>경과 시간</span><b>${formatTime(state.elapsed)}</b></div>
  `;
  endOverlay.classList.add("modal-layer--visible");
  saveBestWave(state.wave);
}

function bestWaveKey(): string {
  return `hanzi-random-defense-best-${ctx.engine.state.mode}-${ctx.engine.state.region}`;
}

/** 저장만 하고 아무도 읽지 않던 값을 종료 화면이 드디어 읽는다. */
function loadBestWave(): number {
  try {
    return Number(window.localStorage.getItem(bestWaveKey()) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBestWave(wave: number): void {
  try {
    const key = bestWaveKey();
    const previous = Number(window.localStorage.getItem(key) ?? 0);
    if (wave > previous) window.localStorage.setItem(key, String(wave));
  } catch {
    // 로컬 저장이 막혀도 현재 런은 정상 진행됩니다.
  }
}
