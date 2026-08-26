/*
 * 표시용 문자열·마크업 조각을 만드는 순수 도우미.
 */
import { CASUAL_STAR_NAMES } from "../core/casual";
import { ELEMENT_STYLES, STAGE_NAMES } from "../core/hanzi";
import { jaryeongAssetPath, jaryeongFrameLayout, type JaryeongVisual, jaryeongVisualFor } from "../core/jaryeongs";
import {
  type CasualStar,
  type GameMode,
  type HanziDefinition,
  type RunPhase,
  type Tower,
  type Wuxing
} from "../core/types";
import { ctx } from "./app-context";

/*
 * 진법 이름은 여기서만 만든다.
 *
 * 같은 모드가 화면마다 '전략 조합전'·'캐주얼 8성전'·'자형연성 진법'·
 * '별승급 진법' 네 이름으로 불려서, 메뉴에서 고른 것과 시작 토스트·
 * 종료 화면에 뜨는 것이 서로 다른 게임처럼 읽혔다. S00 메뉴가 쓰는
 * 이름으로 통일한다.
 */
export function gameModeLabel(mode: GameMode): string {
  return mode === "casual" ? "별승급 진법" : "자형연성 진법";
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, "0") + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function visualBackgroundStyle(visual: JaryeongVisual): string {
  const framing = jaryeongFrameLayout(visual) === "single"
    ? "background-size:contain;background-position:center"
    : "background-size:200% 200%;background-position:left top";
  return `background-image:url('${import.meta.env.BASE_URL}${jaryeongAssetPath(visual)}');${framing}`;
}

/**
 * 목록 한 줄에 들어가는 자령 초상(공방 공용).
 *
 * 소환 공개 카드가 쓰는 `jaryeongVisualFor` + 시트 crop(`visualBackgroundStyle`)
 * 을 그대로 쓰되, 시트가 아직(혹은 끝내) 오지 않는 경우를 두 겹으로 대비한다 —
 * 오행색 원판과 한자를 아래층에 깔고 그림을 그 위에 얹는다. 그림이 도착하면
 * 원판을 덮고, 도착하지 않으면 원판이 그대로 남아 빈 사각형이 생기지 않는다.
 *
 * URL 은 자령 하나당 하나이므로 같은 글자가 여러 줄에 나와도 브라우저가
 * 한 번만 내려받는다 — 목록을 길게 굴려도 요청이 늘지 않는다.
 */
export function spiritPortraitMarkup(char: string, wuxing: Wuxing, variant: string): string {
  const visual = jaryeongVisualFor(char, wuxing, ctx.engine.state.region);
  return `<span class="workbench-spirit ${variant}" style="--element:${ELEMENT_STYLES[wuxing].color}" aria-hidden="true">`
    + `<i class="workbench-spirit-fallback">${escapeHtml(char)}</i>`
    + `<i class="workbench-spirit-art" style="${visualBackgroundStyle(visual)}"></i>`
    + `</span>`;
}

export function phaseLabel(phase: RunPhase): string {
  if (phase === "title") return "준비 전";
  if (phase === "prep") return "소환 준비";
  if (phase === "combat") return "교전 중";
  if (phase === "victory") return "봉인 성공";
  return "수비 실패";
}

export function casualStarOf(tower: Tower): CasualStar {
  return tower.casualStar ?? tower.naturalStar ?? 1;
}

export function towerProgressionLabel(tower: Tower): string {
  const star = casualStarOf(tower);
  return ctx.engine.state.mode === "casual" ? `${star}★ ${CASUAL_STAR_NAMES[star]}` : STAGE_NAMES[tower.stage];
}

export function spriteStyle(definition: HanziDefinition): string {
  const visual = jaryeongVisualFor(definition.char, definition.wuxing, ctx.engine.state.region);
  return visualBackgroundStyle(visual);
}

/*
 * [트랙 J-1] 화폐 표기 — 숫자만 적힌 버튼을 없앤다.
 *
 * 사용자 원문: "분해랑 판매 버튼에 숫자에 표시가 없어서 문기인지 엽전인지
 * 헷갈린다." 이 게임의 화폐는 둘이다 — 판 전체가 쓰는 엽전과 오행마다 따로
 * 쌓이는 문기. `+7` 만 적힌 버튼은 어느 쪽인지 말해 주지 않는다.
 * 표기는 여기서만 만든다. 새 자리를 만들 때도 직접 문자열을 짜지 말고
 * 이 함수를 불러라.
 */
export function goldAmountLabel(amount: number, signed = false): string {
  return `${signed && amount > 0 ? "+" : ""}${amount} 엽전`;
}

/** 문기는 오행 글자를 반드시 데리고 다닌다 — "木 문기 +3". */
export function essenceAmountLabel(wuxing: Wuxing, amount: number, signed = true): string {
  return `${wuxing} 문기 ${signed ? "+" : ""}${amount}`;
}

/** 오행색을 살린 문기 조각. 버튼 안에서도 그 오행의 색으로 읽힌다. */
export function essenceAmountChip(wuxing: Wuxing, amount: number): string {
  return `<i class="unit-essence" style="--unit-element:${ELEMENT_STYLES[wuxing].color}">${essenceAmountLabel(wuxing, amount)}</i>`;
}

/** 오행별 회수량 묶음 — 일괄 분해 견적이 쓰는 한 줄. */
export function essenceGainsLabel(gains: Partial<Record<Wuxing, number>>): string {
  return (Object.entries(gains) as Array<[Wuxing, number]>)
    .filter(([, amount]) => amount > 0)
    .map(([wuxing, amount]) => essenceAmountLabel(wuxing, amount))
    .join(" · ");
}
