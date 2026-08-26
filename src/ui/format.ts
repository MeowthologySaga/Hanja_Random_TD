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
