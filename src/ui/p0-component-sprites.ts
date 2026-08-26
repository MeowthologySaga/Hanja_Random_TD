/**
 * P0 UI 부품 팩 v1 중 Canvas 위에 그려지는 두 종류 로더.
 *
 * 출처: handoff/to-claude/p0-ui-components-pack-v1/assets/
 * 설치: public/assets/ui/p0-v1/
 *
 * 레일·상태 띠·자원 아이콘·조작 픽토그램은 DOM 요소라 `ui-skin.css` 79~81절이
 * 맡는다. 여기 있는 자령 명패와 오행 셀 소켓만 전장 캔버스가 직접 그린다.
 *
 * 두 부품 모두 장식층이다. 셀 좌표·38×38 히트영역·명패 화면 고정 크기 계약은
 * 호출부가 그대로 유지하고, 이 모듈은 이미지와 준비 여부만 돌려준다.
 */

import type { Wuxing } from "../core/types";

export type NameplateForm = "wide" | "glyph";
/** 상태 우선순위: selected > material > default. */
export type NameplateState = "default" | "selected" | "material";

export const NAMEPLATE_WIDE_SIZE = { width: 104, height: 34 } as const;
export const NAMEPLATE_GLYPH_SIZE = { width: 34, height: 34 } as const;
/** wide 명패 안에서 한자 칸과 훈음 칸을 가르는 x(왼쪽 끝 기준). */
export const NAMEPLATE_DIVIDER_X = 33;

/** 셀 소켓 표시 크기. 원본 114×114을 3분의 1로 줄인다. 확대 금지. */
export const CELL_SOCKET_SIZE = 38;
const CELL_SOCKET_SOURCE = 114;

const WUXING_SLUG: Readonly<Record<Wuxing, string>> = Object.freeze({
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water"
});

interface Entry {
  readonly image: HTMLImageElement;
  ready: boolean;
}

const entries = new Map<string, Entry>();

function load(path: string, expected: readonly [number, number]): Entry {
  const url = `${import.meta.env.BASE_URL}assets/ui/p0-v1/${path}`;
  const image = new Image();
  const entry: Entry = { image, ready: false };
  image.decoding = "async";
  image.addEventListener("load", () => {
    if (image.naturalWidth === expected[0] && image.naturalHeight === expected[1]) {
      entry.ready = true;
      return;
    }
    console.warn(`[p0-component-sprites] 크기 불일치: ${url} (기대 ${expected[0]}×${expected[1]}, 실제 ${image.naturalWidth}×${image.naturalHeight})`);
  });
  image.addEventListener("error", () => {
    console.warn(`[p0-component-sprites] 로드 실패: ${url}`);
  });
  image.src = url;
  entries.set(path, entry);
  return entry;
}

function entryFor(path: string, expected: readonly [number, number]): Entry {
  return entries.get(path) ?? load(path, expected);
}

function nameplatePath(form: NameplateForm, state: NameplateState): string {
  return `nameplates/jaryeong-nameplate-${form}-${state}-v1.png`;
}

function nameplateSize(form: NameplateForm): readonly [number, number] {
  return form === "wide"
    ? [NAMEPLATE_WIDE_SIZE.width, NAMEPLATE_WIDE_SIZE.height]
    : [NAMEPLATE_GLYPH_SIZE.width, NAMEPLATE_GLYPH_SIZE.height];
}

export function nameplateStateFor(selected: boolean, material: boolean): NameplateState {
  if (selected) return "selected";
  if (material) return "material";
  return "default";
}

export function nameplateImage(form: NameplateForm, state: NameplateState): HTMLImageElement {
  return entryFor(nameplatePath(form, state), nameplateSize(form)).image;
}

export function isNameplateReady(form: NameplateForm, state: NameplateState): boolean {
  return entryFor(nameplatePath(form, state), nameplateSize(form)).ready;
}

function socketPath(wuxing: Wuxing, occupied: boolean): string {
  return `cell-sockets/cell-socket-${WUXING_SLUG[wuxing]}-${occupied ? "occupied" : "empty"}-114-v1.png`;
}

export function cellSocketImage(wuxing: Wuxing, occupied: boolean): HTMLImageElement {
  return entryFor(socketPath(wuxing, occupied), [CELL_SOCKET_SOURCE, CELL_SOCKET_SOURCE]).image;
}

export function isCellSocketReady(wuxing: Wuxing, occupied: boolean): boolean {
  return entryFor(socketPath(wuxing, occupied), [CELL_SOCKET_SOURCE, CELL_SOCKET_SOURCE]).ready;
}

export function preloadP0ComponentSprites(): void {
  for (const form of ["wide", "glyph"] as const) {
    for (const state of ["default", "selected", "material"] as const) nameplateImage(form, state);
  }
  for (const wuxing of Object.keys(WUXING_SLUG) as Wuxing[]) {
    cellSocketImage(wuxing, false);
    cellSocketImage(wuxing, true);
  }
}
