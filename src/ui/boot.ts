/*
 * 부팅 절차와 화면 맞춤.
 */
import { BOARD_FORMATIONS, WORLD_HEIGHT, WORLD_WIDTH } from "../core/content";
import {
  beginBootStageBuild,
  dismissBootScreen,
  preloadP1,
  registerServiceWorker,
  startP2,
  takeOverBootScreen,
  updateBootProgress
} from "./asset-loader";
import { preloadCombatFxSprites } from "./combat-fx-sprites";
import { preloadEnemySprites } from "./enemy-sprites";
import { preloadFormationPlates } from "./formation-plate-sprites";
import { preloadIdiomSprites } from "./idiom-sprites";
import { preloadInkPathSprites } from "./ink-path-sprites";
import { preloadLockSprites } from "./lock-sprites";
import { preloadNameplateSprites } from "./nameplate-sprites";
import { preloadP0ComponentSprites } from "./p0-component-sprites";
import { preloadPolishSprites } from "./polish-sprites";
import { canvas, context, initialDisplayMode, must, s00Mode, seedInput, shell } from "./app-context";
import { setGameSpeed, syncMapZoomControl } from "./battle/camera";
import { drawWorld } from "./battle/draw";
import { layoutCoach } from "./coach";
import { setDisplayMode, syncAudioControls } from "./dialogs/settings";
import { frame } from "./game-loop";
import { syncPanel } from "./hud";
import { mountS00, syncTitleModeSelection } from "./s00-menu";

const hanjiPaperUrl = `${import.meta.env.BASE_URL}assets/map/hanji-ink-field/hanji-paper-base.webp`;

/**
 * 한지 바탕(2.0MB)은 전장에서만 보인다. 모듈 평가 시점에 붙이면 S00 텍스처와
 * 대역을 다투므로 `bootGame()` 이 1차 프리로드를 마친 뒤에 붙인다.
 */
function attachHanjiPaperBackground(): void {
  canvas.style.backgroundImage = `radial-gradient(circle at 50% 44%, rgba(255, 252, 235, 0.08), rgba(115, 78, 39, 0.09)), url("${hanjiPaperUrl}")`;
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireBoot1(): void {
  canvas.style.backgroundPosition = "center";
  canvas.style.backgroundRepeat = "no-repeat";
  canvas.style.backgroundSize = "cover";
  canvas.dataset.hitFeedback = "ink-local";
  canvas.dataset.formationTileColorMode = "element";
  canvas.dataset.formationTilePalette = BOARD_FORMATIONS.map((formation) => `${formation.preferredWuxing}:${formation.color}`).join("|");
}

/**
 * 전투 스프라이트 예열은 `bootGame()` 의 2차 프리로드가 끝난 뒤로 옮겼다.
 * 여기서 바로 부르면 60여 장이 모듈 평가 즉시 나가 S00 텍스처를 굶긴다
 * (12Mbps 실측: s00-3d 8장이 15초 뒤에도 미도착). 모듈 캐시는 그때
 * `asset-loader` 가 받아 둔 원본을 그대로 집어 간다.
 * (병합 추가: 자물쇠·성어 인장·명패도 같은 2차 예열에 태운다)
 */
function warmCombatSpriteCaches(): void {
  preloadCombatFxSprites();
  preloadInkPathSprites();
  preloadEnemySprites();
  preloadFormationPlates();
  preloadLockSprites();
  preloadP0ComponentSprites();
  preloadPolishSprites();
  preloadIdiomSprites();
  preloadNameplateSprites();
}

/*
 * 개발자 모드.
 *
 * 런 시드는 재현·디버그 도구라 일반 화면에서 치운다. 백틱(`)을 다른 키
 * 없이 5번 연속 누르면 토글되고, 시드 입력·재생성·푸터 시드가 나타난다.
 * ?seed= URL 파라미터는 게이트와 무관하게 항상 동작한다(테스트 계약).
 */
let devKeyStreak = 0;

let devKeyTimer = 0;

function setDevMode(enabled: boolean): void {
  shell.dataset.devMode = enabled ? "1" : "0";
  // 같은 시드 재도전은 재현·디버그용 — 일반 플레이어에겐 시드 개념을 노출하지 않는다.
  must<HTMLButtonElement>("#retry-button").hidden = !enabled;
  if (enabled) {
    seedInput.focus();
    seedInput.select();
  }
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireBoot2(): void {
  window.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest("input, textarea")) return;
    if (event.code === "Backquote") {
      devKeyStreak += 1;
      window.clearTimeout(devKeyTimer);
      devKeyTimer = window.setTimeout(() => {
        devKeyStreak = 0;
      }, 1200);
      if (devKeyStreak >= 5) {
        devKeyStreak = 0;
        // 켜는 순간 시드 입력칸에 포커스가 가므로, 이 백틱 자체가 선택된
        // 시드 문자열을 "`" 로 덮어써 버린다. 입력만 막는다.
        event.preventDefault();
        setDevMode(shell.dataset.devMode !== "1");
      }
      return;
    }
    devKeyStreak = 0;
  });
}

function fitShell(): void {
  shell.style.setProperty("--viewport-height", String(window.innerHeight) + "px");
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  // rect 는 고정 무대의 transform 이 반영된 실측값이라 displayScale 이 곧
  // 무대 배율이다. backing store 는 devicePixelRatio x 무대배율로 커져
  // 확대판에서도 흐려지지 않는다. 축소(<1)일 때는 1.0 을 밑돌지 않게 막아
  // 설계 해상도만큼은 지키고, 상한 2.5 로 고배율에서의 과다 렌더를 끊는다
  // (menu3d 의 setPixelRatio 와 같은 상한이다).
  const displayScale = rect.width / WORLD_WIDTH;
  const pixelScale = Math.min(2.5, Math.max(1, displayScale * (window.devicePixelRatio || 1)));
  const backingWidth = Math.round(WORLD_WIDTH * pixelScale);
  const backingHeight = Math.round(WORLD_HEIGHT * pixelScale);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireBoot3(): void {
  fitShell();
  window.addEventListener("resize", () => {
    fitShell();
    layoutCoach();
  });
  /*
   * 첫 오픈에만 늦게 오는 그림 미리 받기.
   *
   * P00·S13 의 두루마리 프레임은 그 창을 처음 열 때에야 요청이 나가서,
   * 도착 전까지 먹 글자와 버튼만 메뉴 위에 둥둥 떠 보였다. CSS 가 쓰는
   * 것과 같은 경로로 미리 받아 둔다(R7-30 의 한지 바탕과 짝).
   */
  for (const path of ["assets/ui/main-menu-b/ui/p00-scroll-frame-v1.webp"]) {
    const warm = new Image();
    warm.decoding = "async";
    // 하위 경로 배포(GitHub Pages)에서 루트 절대 경로는 404 가 된다 — 문서 기준으로.
    warm.src = new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).toString();
  }
  syncMapZoomControl();
  setGameSpeed(1);
  setDisplayMode(initialDisplayMode, false);
  syncTitleModeSelection();
  syncAudioControls();
  syncPanel();
}

/*
 * R11 부팅 순서.
 *
 *   1) 1차(P1) 프리로드 — S00 이 완성된 모습으로 뜨는 데 필요한 것만. 이 동안
 *      `index.html` 인라인 막이 화면을 덮고 진행률을 보여 준다.
 *   2) S00 을 세운다. 텍스처는 이미 캐시에 있으므로 첫 프레임부터 실물이다.
 *   3) 막을 걷고 전장 루프를 돌린다. 전장 첫 draw 가 여기서 처음 일어나므로
 *      제단·먹길 스프라이트 요청도 P1 을 방해하지 않는다.
 *   4) 2차(P2) 프리로드를 뒤에서 시작한다. 출정 클릭이 더 빠르면
 *      `whenBattleAssetsReady()` 가 잠깐만 붙잡는다.
 */
async function bootGame(): Promise<void> {
  // 번들이 살아 있음이 증명됐다. 인라인 안전장치를 거두고 막의 수명을 넘겨받는다.
  takeOverBootScreen();
  // 첫 방문에도 워커가 곧바로 페이지를 물어 P1·P2 응답을 캐시에 담게 한다.
  registerServiceWorker();
  await preloadP1(s00Mode, updateBootProgress);
  // 여기부터 막이 걷힐 때까지가 진행 표시의 사각지대였다(실측 프로덕션 1.1초 ·
  // dev 5.3초를 100% 인 채로 서 있었다). 마지막 걸음에도 이름과 자리를 준다.
  beginBootStageBuild();
  await mountS00();
  dismissBootScreen();
  attachHanjiPaperBackground();
  drawWorld(0);
  window.requestAnimationFrame(frame);
  await startP2();
  warmCombatSpriteCaches();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireBoot4(): void {
  void bootGame();
}
