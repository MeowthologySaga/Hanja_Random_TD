/*
 * 지역 선택(P00)과 맞춤 진법(S13) 창.
 */
import {
  defaultNotationForRegion,
  ensureUnifiedReadings,
  NOTATION_AXIS_READY,
  notationNeedsUnifiedTable,
  unifiedReadingsInstalled
} from "../../core/notation";
import { type GameMode, type NotationCode, type RegionCode } from "../../core/types";
import { type DisplayMode } from "../display-mode";
import { saveNotationPreference } from "../notation-preference";
import { saveAutoPlaceSummons } from "../summon-placement";
import { ctx, must, sound } from "../app-context";
import { toggleHanjaEmphasis } from "../battle/camera";
import { handleAction, showToast } from "../hud";
import { setSelectedGameMode, syncTitleModeSelection } from "../s00-menu";
import { setDisplayMode, setHoverGlyphLarge, syncAutoPlaceControl } from "./settings";

export const REGION_MENU_INFO: Record<RegionCode, { name: string; pool: string }> = {
  KR: { name: "한국", pool: "한국 천자문 1,000" },
  JP: { name: "일본", pool: "일본 상용한자 2,136" },
  CN: { name: "중국", pool: "중국 규범한자 3,500" }
};

const p00Dialog = must<HTMLDialogElement>("#p00-dialog");

/*
 * 미리 해보기 안내(자형연성).
 *
 * 부수 조립 진법은 합성표·난이도가 아직 다듬는 중이라, 지역 미리 해보기
 * 안내(P00)와 같은 확인 창을 태워 "무엇이 덜 여물었는지"를 먼저 말한다.
 * 창 하나를 두 용도로 쓰므로 여는 쪽이 문구를 매번 제자리로 돌려놓는다.
 */
let pendingModeNotice = false;

export function openStandardModeNotice(): void {
  pendingModeNotice = true;
  must<HTMLElement>("#p00-kicker").textContent = "미리 해보기 안내";
  must<HTMLElement>("#p00-title").textContent = "자형연성 진법";
  must<HTMLElement>("#p00-body").innerHTML = "부수를 부품 삼아 글자를 조립하는 학습 진법입니다.<br />합성표와 난이도를 아직 다듬는 중이라 목표가 막히거나 균형이 기울 수 있습니다.<br />가장 완성된 진법은 별승급입니다.";
  must<HTMLButtonElement>("#p00-return").textContent = "별승급으로 돌아가기";
  must<HTMLButtonElement>("#p00-continue").textContent = "자형연성으로 계속";
  p00Dialog.showModal();
  must<HTMLButtonElement>("#p00-return").focus();
}

function openP00(region: RegionCode): void {
  ctx.pendingRegion = region;
  pendingModeNotice = false;
  const info = REGION_MENU_INFO[region];
  must<HTMLElement>("#p00-kicker").textContent = "미리 해보기 안내";
  must<HTMLElement>("#p00-title").textContent = `${info.name} 한자 체계`;
  must<HTMLElement>("#p00-body").innerHTML = "이 지역은 도감 설명과 읽기, 난이도를 아직 다듬는 중입니다.<br />가장 완성된 체계는 한국 천자문 1,000자입니다.";
  must<HTMLButtonElement>("#p00-return").textContent = "한국으로 돌아가기";
  must<HTMLButtonElement>("#p00-continue").textContent = `${info.name}으로 계속`;
  p00Dialog.showModal();
  must<HTMLButtonElement>("#p00-return").focus();
}

function closeP00(confirm: boolean): void {
  if (pendingModeNotice) {
    pendingModeNotice = false;
    if (p00Dialog.open) p00Dialog.close();
    setSelectedGameMode(confirm ? "standard" : "casual");
    return;
  }
  if (confirm && ctx.pendingRegion) ctx.selectedRegion = ctx.pendingRegion;
  ctx.pendingRegion = null;
  if (p00Dialog.open) p00Dialog.close();
  syncTitleModeSelection();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireS131(): void {
  document.querySelectorAll<HTMLButtonElement>(".region-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const region = button.dataset.region as RegionCode;
      // JP/CN 은 pending 만 두고 P00 확인을 거친다. 취소하면 기존 선택이 유지된다.
      if (region === "KR") {
        ctx.selectedRegion = "KR";
        syncTitleModeSelection();
        return;
      }
      openP00(region);
    });
  });
  must<HTMLButtonElement>("#p00-return").addEventListener("click", () => closeP00(false));
  must<HTMLButtonElement>("#p00-continue").addEventListener("click", () => closeP00(true));
  p00Dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeP00(false);
  });
  p00Dialog.addEventListener("click", (event) => {
    if (event.target === p00Dialog) closeP00(false);
  });
  // 지난 판에서 고른 표기가 교차 조합이면 표를 미리 받아 둔다. 제목 화면에서
  // 시작하므로 읽기가 화면에 나오기 훨씬 전에 끝나고, 늦더라도 캐시 키만
  // 비워 두면 게임 루프의 다음 syncPanel 이 새 표기로 다시 그린다.
  // 고른 적 없는 사람(selectedNotation === null)은 이 바이트를 받지 않는다.
  if (NOTATION_AXIS_READY && ctx.selectedNotation && notationNeedsUnifiedTable(ctx.selectedRegion, ctx.selectedNotation)) {
    void ensureUnifiedReadings().then(() => {
      ctx.selectedRenderKey = "";
      ctx.goalRenderKey = "";
      ctx.runInventoryRenderKey = "";
      ctx.compositionRenderKey = "";
    });
  }
}

const s13Dialog = must<HTMLDialogElement>("#s13-dialog");

/**
 * 표기 선택을 실제로 갈아 끼운다. (트랙 Q)
 *
 * 로스터의 자국 표기가 아니면 통합 표기 테이블이 있어야 글자가 채워진다.
 * 테이블은 별도 청크라 첫 교차 선택에서 한 번 받아 오고, 받는 동안 버튼을
 * 잠가 반쯤 채워진 화면이 스치지 않게 한다. 받아 온 뒤에야 표기를 바꾸므로
 * 라벨은 한 프레임에 전부 새 표기로 갈린다.
 *
 * 표기는 화면 설정이라 다음 런을 기다리지 않고 지금 런에 바로 반영한다 —
 * 고른 것이 눈앞에서 바뀌지 않으면 고른 티가 안 난다.
 */
async function applyNotation(notation: NotationCode): Promise<void> {
  const group = s13Dialog.querySelector<HTMLElement>(".s13-notation-group");
  if (notationNeedsUnifiedTable(ctx.selectedRegion, notation) && !unifiedReadingsInstalled()) {
    group?.classList.add("is-loading");
    const loaded = await ensureUnifiedReadings();
    group?.classList.remove("is-loading");
    if (!loaded) {
      // 표를 못 받으면 교차 표기는 빈칸투성이가 된다 — 고르지 않은 것으로 두고 말한다.
      showToast("읽기 표기 자료를 불러오지 못했습니다 · 자국 표기를 유지합니다");
      return;
    }
  }
  ctx.selectedNotation = notation;
  saveNotationPreference(notation);
  // 합성 서랍은 표기를 캐시 키에 넣지 않는다 — 비워 두지 않으면 옛 읽기가 남는다.
  ctx.compositionRenderKey = "";
  // handleAction 이 나머지 패널 캐시를 비우고 syncPanel 로 한 번에 다시 그린다.
  handleAction(ctx.engine.setNotation(notation));
  syncS13();
}

export function syncS13(): void {
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-region]").forEach((button) => {
    const region = button.dataset.s13Region as RegionCode;
    button.disabled = false;
    button.classList.toggle("is-selected", region === ctx.selectedRegion);
    button.setAttribute("aria-checked", String(region === ctx.selectedRegion));
    button.title = REGION_MENU_INFO[region].pool;
  });
  // gripe #6 표기 축. 그룹 노출은 플래그가 정하고(테이블 도착 전 hidden),
  // 선택 표시는 실효 표기(명시 선택 ?? 로스터 자국 표기)를 따른다.
  const notationGroup = s13Dialog.querySelector<HTMLElement>(".s13-notation-group");
  if (notationGroup) notationGroup.hidden = !NOTATION_AXIS_READY;
  const effectiveNotation = ctx.selectedNotation ?? defaultNotationForRegion(ctx.selectedRegion);
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-notation]").forEach((button) => {
    const notation = button.dataset.s13Notation as NotationCode;
    const selected = notation === effectiveNotation;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-display]").forEach((button) => {
    const selected = button.dataset.s13Display === ctx.displayMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  s13Dialog.querySelectorAll<HTMLButtonElement>("[data-s13-mode]").forEach((button) => {
    const selected = button.dataset.s13Mode === ctx.selectedGameMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  const emphasisButton = must<HTMLButtonElement>("#s13-emphasis");
  emphasisButton.setAttribute("aria-pressed", String(ctx.hanjaEmphasis));
  must<HTMLElement>("#s13-emphasis .s13-state").textContent = ctx.hanjaEmphasis ? "ON" : "OFF";
  emphasisButton.classList.toggle("is-on", ctx.hanjaEmphasis);
  const hoverGlyphButton = must<HTMLButtonElement>("#s13-hover-glyph");
  hoverGlyphButton.setAttribute("aria-pressed", String(ctx.hoverGlyphLarge));
  must<HTMLElement>("#s13-hover-glyph .s13-state").textContent = ctx.hoverGlyphLarge ? "ON" : "OFF";
  hoverGlyphButton.classList.toggle("is-on", ctx.hoverGlyphLarge);
  const autoButton = must<HTMLButtonElement>("#s13-autoplace");
  autoButton.setAttribute("aria-pressed", String(ctx.engine.state.autoPlaceSummons));
  must<HTMLElement>("#s13-autoplace .s13-state").textContent = ctx.engine.state.autoPlaceSummons ? "ON" : "OFF";
  autoButton.classList.toggle("is-on", ctx.engine.state.autoPlaceSummons);
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireS132(): void {
  must<HTMLButtonElement>("#custom-formation-button").addEventListener("click", () => {
    sound.playUiConfirm();
    syncS13();
    s13Dialog.showModal();
  });
  must<HTMLButtonElement>("#s13-close").addEventListener("click", () => s13Dialog.close());
  s13Dialog.addEventListener("click", (event) => {
    if (event.target === s13Dialog) {
      s13Dialog.close();
      return;
    }
    const target = event.target as HTMLElement;
    const regionButton = target.closest<HTMLButtonElement>("[data-s13-region]");
    if (regionButton && !regionButton.disabled) {
      const region = regionButton.dataset.s13Region as RegionCode;
      if (region === "KR") {
        ctx.selectedRegion = "KR";
        syncTitleModeSelection();
      } else {
        // 미리 해보기 확인(P00)을 우회하지 않는다.
        s13Dialog.close();
        openP00(region);
      }
      return;
    }
    const notationButton = target.closest<HTMLButtonElement>("[data-s13-notation]");
    if (notationButton) {
      // 플래그가 꺼져 있으면 그룹이 hidden 이라 정상 경로로는 오지 못한다.
      // 방어적으로 한 번 더 막아 표기 이탈을 봉한다.
      if (!NOTATION_AXIS_READY) return;
      sound.unlock();
      sound.playUiConfirm();
      void applyNotation(notationButton.dataset.s13Notation as NotationCode);
      return;
    }
    const displayButton = target.closest<HTMLButtonElement>("[data-s13-display]");
    if (displayButton) {
      setDisplayMode(displayButton.dataset.s13Display as DisplayMode);
      syncS13();
      return;
    }
    const modeButton = target.closest<HTMLButtonElement>("[data-s13-mode]");
    if (modeButton) {
      setSelectedGameMode(modeButton.dataset.s13Mode as GameMode);
      return;
    }
    if (target.closest("#s13-emphasis")) {
      toggleHanjaEmphasis();
      syncS13();
      return;
    }
    if (target.closest("#s13-hover-glyph")) {
      sound.unlock();
      setHoverGlyphLarge(!ctx.hoverGlyphLarge);
      sound.playUiConfirm();
      syncS13();
      return;
    }
    if (target.closest("#s13-autoplace")) {
      sound.unlock();
      const enabled = !ctx.engine.state.autoPlaceSummons;
      saveAutoPlaceSummons(enabled);
      handleAction(ctx.engine.setAutoPlaceSummons(enabled));
      syncAutoPlaceControl();
      sound.playUiConfirm();
      syncS13();
    }
  });
}
