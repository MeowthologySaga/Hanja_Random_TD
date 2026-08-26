/*
 * 셸 DOM 참조와 공유 가변 상태.
 *
 * 분할 전 main.ts 앞머리에 흩어져 있던 `must()` · DOM 상수 · 모듈 수준
 * `let` 들을 한곳에 모았다. 여러 모듈이 함께 쓰는 가변 상태는 `ctx` 하나에
 * 담아 참조를 공유한다 — 게터/세터 없이 `ctx.engine` 처럼 쓴다.
 * 이 파일은 갈래 모듈을 값으로 import 하지 않는다(순환 회피).
 */
import { CHEONJAMUN_JARYEONG_DEX_ENTRIES } from "../core/cheonjamun-jaryeong-dex";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../core/content";
import { type CasualFusionQuote, GameEngine } from "../core/game";
import { type IdiomDefinition, type PartialIdiomChain } from "../core/idioms";
import { createRunSeed } from "../core/rng";
import { type GameMode, type Point, type RegionCode, type RunPhase, type Wuxing } from "../core/types";
import { type S00Mode } from "./asset-loader";
import { SoundManager } from "./audio";
import { buildSynthesisDepths, buildUncombinableStageOneChars, type SynthesisTierFilter } from "./codex-synthesis";
import { type DisplayMode, loadDisplayMode } from "./display-mode";
import { type IdiomOrder } from "./idiom-sprites";
import { initStage } from "./stage";
import { loadAutoPlaceSummons } from "./summon-placement";
import { appShellHtml } from "./templates";

// 1280x720 고정 무대를 먼저 켠다. 리사이즈 시 --stage-scale 갱신이
// fitShell() 의 실측보다 앞서야 캔버스 backing store 가 한 박자 늦지 않는다.
initStage();

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) throw new Error("#app element is missing.");

/**
 * S00 은 3D 서재가 기본이고 `?menu3d=0` 이면 2D 그림 배경으로 되돌아간다.
 * 어느 쪽을 쓰는지에 따라 1차 프리로드 목록과 2D 레이어 `src` 부착 여부가
 * 갈리므로 부팅 맨 앞에서 한 번만 정한다.
 */
export const s00Mode: S00Mode = new URLSearchParams(window.location.search).get("menu3d") === "0" ? "2d" : "3d";

export const initialDisplayMode = loadDisplayMode();

const initialAutoPlaceSummons = loadAutoPlaceSummons();

app.innerHTML = appShellHtml(initialDisplayMode);

export function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("Missing element: " + selector);
  return element;
}

export const shell = must<HTMLElement>(".game-shell");

export const canvas = must<HTMLCanvasElement>("#battle-canvas");

const canvasContext = canvas.getContext("2d");

if (!canvasContext) throw new Error("Canvas 2D context is unavailable.");

export const context: CanvasRenderingContext2D = canvasContext;

export const seedInput = must<HTMLInputElement>("#seed-input");

export const titleOverlay = must<HTMLElement>("#title-overlay");

export const endOverlay = must<HTMLElement>("#end-overlay");

export const toast = must<HTMLElement>("#toast");

export const bossBanner = must<HTMLElement>("#boss-banner");

export const combatFeed = must<HTMLOListElement>("#combat-feed");

export const comboMeter = must<HTMLElement>("#combo-meter");

export const idiomResult = must<HTMLElement>("#idiom-result");

export const idiomTab = must<HTMLButtonElement>("#idiom-tab");

export const helpDialog = must<HTMLDialogElement>("#help-dialog");

export const settingsDialog = must<HTMLDialogElement>("#settings-dialog");

export const elementUpgradeDialog = must<HTMLDialogElement>("#element-upgrade-dialog");

export const abilityGuideDialog = must<HTMLDialogElement>("#ability-guide-dialog");

export const casualFusionConfirmDialog = must<HTMLDialogElement>("#casual-fusion-confirm-dialog");

export const codexDialog = must<HTMLDialogElement>("#codex-dialog");

export const summonReveal = must<HTMLElement>("#summon-reveal");

export const fusionVortex = must<HTMLElement>("#fusion-vortex");

export const sound = new SoundManager();

sound.attachUiSfx(document);

// 자동재생 정책은 "사용자 제스처"만 요구한다 — 버튼일 필요가 없다.
// 첫 클릭·터치·키 입력이 화면 어디에 떨어지든 오디오(메뉴 BGM)를 깨운다.
const wakeAudioOnFirstGesture = (): void => {
  sound.unlock();
  document.removeEventListener("pointerdown", wakeAudioOnFirstGesture, true);
  document.removeEventListener("keydown", wakeAudioOnFirstGesture, true);
};

document.addEventListener("pointerdown", wakeAudioOnFirstGesture, true);

document.addEventListener("keydown", wakeAudioOnFirstGesture, true);

if (import.meta.env.DEV) Object.assign(window, { __HANJA_AUDIO_QA__: sound });

const initialSeed = new URLSearchParams(window.location.search).get("seed")?.slice(0, 24) || createRunSeed();

seedInput.value = initialSeed;

// 본편은 별승급 — 게임적 재미 기준의 사용자 결정. 자형연성은 학습 특화로 위치.
// `?mode=standard|casual` 딥링크는 e2e·공유용.
const modeParam = new URLSearchParams(window.location.search).get("mode");

/* R14 보관고 도구는 상단 한 줄로 최소화한다 — 오행 칩 5 + 정렬 토글 1.
   한 판 안에서만 쓰는 임시 시야라 localStorage 로 남기지 않는다. */
export type RunInventorySort = "recent" | "element" | "star";

export const RUN_INVENTORY_SORTS: readonly RunInventorySort[] = ["recent", "element", "star"];

/* R19 보관고 허브.
   등급 필터는 캐주얼의 별과 표준의 단계를 같은 1~8 축으로 읽어 세 대역으로
   접는다(초반·중반·후반). 오행 칩과 마찬가지로 한 판짜리 시야다. */
export type RunInventoryGradeBandId = "low" | "mid" | "high";

export const RUN_INVENTORY_GRADE_BANDS: ReadonlyArray<{ id: RunInventoryGradeBandId; label: string; min: number; max: number }> = [
  { id: "low", label: "1~3", min: 1, max: 3 },
  { id: "mid", label: "4~6", min: 4, max: 6 },
  { id: "high", label: "7~8", min: 7, max: 8 }
];

export const runInventoryBulkSelection = new Set<number>();

export const feedCooldowns = new Map<string, number>();

export const lastAbilityFxByTower = new Map<number, number>();

export type PanelTab = "shop" | "unit" | "inventory" | "evolution" | "concentration" | "growth" | "goal" | "idiom" | "record";

export type GoalPanelMode = "hanzi" | "idiom";

export type CodexMode = "hanzi" | "recipes" | "idioms";

export type JaryeongDexFilter = "all" | Wuxing;

export const dismantleSelection = new Set<number>();

type PendingCasualFusion = { kind: "manual"; materialIds: [number, number, number]; quote: CasualFusionQuote };

/** 발동 순간 뜨는 성어 4자 대형 플래시. 카메라가 어디에 있든 보이도록 화면 좌표로 그린다. */
interface IdiomFlashFx {
  chars: string;
  reading: string;
  color: string;
  at: Point;
  age: number;
  duration: number;
}

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 호버 팝오버 우상단 큰 한자. 기본 ON, 선택은 브라우저에 저장한다.
export const HOVER_GLYPH_STORAGE_KEY = "hanja-td:hover-glyph-large";

/*
 * FB6 차분한 화면.
 *
 * "게임이 눈이 피곤함" 피드백의 2층 대응 중 토글층. 켜면 맥동·플래시·먹물
 * 흐름 상시 애니메이션을 멈추고 결 무늬를 더 옅게 깐다. 명시적 선택이 없으면
 * OS "동작 줄이기"(prefers-reduced-motion)를 따른다 — 우선순위: 설정 > OS.
 */
export const CALM_SCREEN_STORAGE_KEY = "hanja-td:calm-screen";

/*
 * 분해의 "유일 보유 한자" 보호.
 *
 * 초보자를 지키는 규칙이지만 문기를 모으려는 사람에게는 인벤토리 절반을
 * 잠그는 벽이었다. 기본은 ON(현행 유지)이고, 끄면 유일 자령도 후보에 들어온다.
 * 파괴적 행동이므로 목록의 `유일` 배지는 꺼도 남는다 — 토글 자체가 의사 표시라
 * 따로 확인 창을 세우지는 않는다.
 */
export const DISMANTLE_UNIQUE_STORAGE_KEY = "hanja-td:dismantle-protect-unique";

export const MIN_MAP_ZOOM = 0.72;

export const BASE_MAP_ZOOM = 2.6;

export const DEFAULT_MAP_ZOOM = 2;

export const MAX_MAP_ZOOM = BASE_MAP_ZOOM * 2;

const DEFAULT_MAP_FOCUS: Point = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };

export function defaultMapOffset(): Point {
  return {
    x: WORLD_WIDTH / 2 - DEFAULT_MAP_FOCUS.x * DEFAULT_MAP_ZOOM,
    y: WORLD_HEIGHT / 2 - DEFAULT_MAP_FOCUS.y * DEFAULT_MAP_ZOOM
  };
}

export type GameSpeed = 1 | 2 | 3;

/*
 * 집중 프레임(S06 강화 · S07 농축).
 *
 * 376px 패널 안에 "대상 고르기 + 재료 + 실행"을 전부 밀어 넣은 탓에 글자가
 * 작아지고 과부하가 걸렸다. 작업대 DOM 을 통째로 전장 위 대형 프레임으로
 * **옮긴다**(복제가 아니다 — 기존 id·리스너·렌더러가 그대로 동작한다).
 * 패널에는 요약 몇 줄과 [열기] 버튼만 남는다.
 * 엔진은 계속 돌기 때문에 aria-modal 은 false 다.
 */
export type FocusFrameId = "growth" | "concentration" | "inventory";

/**
 * 추적 중 성어의 배치 안내 — 스펙 6라운드 B.
 * 어떤 자령이 몇 번째 글자인지(순번 배지), 다음 글자를 어디에 놓을 수 있는지
 * (유효 셀)를 한 번만 계산해 두고 명패·보드 오버레이가 함께 읽는다.
 */
interface IdiomPlacementGuide {
  readonly idiom: IdiomDefinition;
  readonly chain: PartialIdiomChain;
  /** 자령 id → 성어에서의 순번(1~4). */
  readonly orders: ReadonlyMap<number, IdiomOrder>;
  /** 다음 글자를 이을 수 있는 빈 칸. */
  readonly nextCells: readonly number[];
}

/*
 * 여러 모듈이 함께 쓰는 가변 상태.
 *
 * 분할 전 main.ts 의 모듈 수준 `let` 들을 선언 순서 그대로 옮겼다. 객체
 * 리터럴이 아니라 클래스인 이유는 하나뿐이다 — 필드는 선언한 타입을 그대로
 * 지키지만, 리터럴의 축약 속성은 초기값으로 좁혀진 타입(`"hanzi"`·`null`·
 * `true` …)이 굳어 재대입이 막힌다.
 */
class AppContext {
  selectedRegion: RegionCode = "KR";
  pendingRegion: RegionCode | null = null;
  formationUnlockHintShown = false;
  selectedGameMode: GameMode = modeParam === "standard" ? "standard" : modeParam === "casual" ? "casual" : "casual";
  displayMode: DisplayMode = initialDisplayMode;
  engine = new GameEngine(initialSeed, this.selectedRegion, this.selectedGameMode);
  mapSynthesisDepths = buildSynthesisDepths(this.engine.catalog.definitions.values());
  mapUncombinableStageOne = buildUncombinableStageOneChars(this.engine.catalog.definitions.values());
  previousPhase: RunPhase = "title";
  lastFrame = performance.now();
  summonRevealTimer = 0;
  fusionVortexTimer = 0;
  toastAnimation: Animation | null = null;
  waveBannerAnimation: Animation | null = null;
  hoveredRecipeId: string | null = null;
  hoveredCompositionMaterialIds = new Set<number>();
  compositionDrawerOpen = false;
  compositionRenderKey = "";
  evolutionRenderKey = "";
  goalRenderKey = "";
  selectedRenderKey = "";
  runInventoryRenderKey = "";
  runInventoryElementFilter: Wuxing | null = null;
  runInventorySort: RunInventorySort = "recent";
  runInventoryGradeFilter: RunInventoryGradeBandId | null = null;
  /* 일괄 모드는 "고르기"의 의미 자체를 바꾼다 — 카드 클릭이 전장 선택이 아니라
     분해 바구니에 담기가 된다. 그래서 엔진의 selectedTowerId 와 섞지 않고
     화면 전용 집합으로 따로 든다(강화 제련소의 dismantleSelection 과도 별개). */
  runInventoryBulkMode = false;
  idiomRenderKey = "";
  elementUpgradeRenderKey = "";
  formationRenderKey = "";
  concentrationRenderKey = "";
  growthRenderKey = "";
  comboTimer = 0;
  comboCount = 0;
  lastKillAt = 0;
  lastGlobalAbilityFxAt = -10;
  codexMode: CodexMode = "hanzi";
  codexSynthesisDepth: SynthesisTierFilter = "all";
  jaryeongDexFilter: JaryeongDexFilter = "all";
  selectedCodexChar = CHEONJAMUN_JARYEONG_DEX_ENTRIES[0]?.hanja ?? "";
  /** 성어 카드에도 한자 카드와 같은 선택 표시를 준다(항목 17). */
  selectedCodexIdiomId = "";
  goalPanelMode: GoalPanelMode = "hanzi";
  goalSearchQuery = "";
  activePanelTab: PanelTab = "shop";
  concentrationTargetId: number | null = null;
  concentrationPayment: "essence" | number = "essence";
  growthElement: Wuxing = "木";
  casualFusionSelection: number[] = [];
  casualManualOpen = false;
  pendingCasualFusion: PendingCasualFusion | null = null;
  projectileSpriteDrawTotal = 0;
  abilityZoneSpriteDrawTotal = 0;
  idiomFlash: IdiomFlashFx | null = null;
  towerDragPointerId: number | null = null;
  towerDragTowerId: number | null = null;
  towerDragStart: Point | null = null;
  towerDragMoved = false;
  mapPanPointerId: number | null = null;
  hoveredTowerId: number | null = null;
  /** 포인터가 올라간 잠긴 오행진. 자물쇠 확대와 캔버스 커서 전환에 쓴다. */
  hoveredLockFormation: number | null = null;
  hanjaEmphasis = true;
  hoverGlyphLarge = ((): boolean => {
    try {
      return window.localStorage.getItem(HOVER_GLYPH_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  })();
  dismantleProtectsUnique = ((): boolean => {
    try {
      return window.localStorage.getItem(DISMANTLE_UNIQUE_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  })();
  /** FB6: 저장된 명시적 선택. null 이면 아직 고르지 않아 OS 값을 따른다. */
  calmScreenChoice: boolean | null = ((): boolean | null => {
    try {
      const stored = window.localStorage.getItem(CALM_SCREEN_STORAGE_KEY);
      return stored === "true" ? true : stored === "false" ? false : null;
    } catch {
      return null;
    }
  })();
  /** FB6: 실효값(설정 > OS). settings.ts 의 applyCalmScreen 이 갱신한다. */
  calmScreen = this.calmScreenChoice ?? reducedMotion;
  mapZoom = DEFAULT_MAP_ZOOM;
  mapOffset: Point = defaultMapOffset();
  /** 휠 확대·축소 1회 또는 팬 1회마다 오른다. 코치 2단계 자동 진행의 근거. */
  mapCameraGestures = 0;
  gameSpeed: GameSpeed = 1;
  openFocusFrame: FocusFrameId | null = null;
  /**
   * 발동 중 성어 스택 — 스펙 6라운드 D.
   *
   * 봉인한 성어의 효과는 런 내내 남는데, 지금까지 그 사실은 성어 탭을 열어야만
   * 보였다. 전장 좌측에 상시 배지로 세워 두고, 배지를 누르면 그 네 칸으로
   * 카메라를 옮겨 "어디에 있는 무엇인지"까지 이어 준다.
   */
  activeIdiomsRenderKey = "init";
  idiomPlacementGuide: IdiomPlacementGuide | null = null;
  /**
   * 발동 중인 봉인에 참여한 자령 id → 그 성어의 색 — R18 자리 고정 표식용.
   * 명패는 자령 수만큼 그려지므로 프레임마다 한 번만 계산해 두고 나눠 읽는다.
   */
  sealedIdiomTowerMarks: ReadonlyMap<number, string> = new Map<number, string>();
  /*
   * 일시정지.
   *
   * 도감·도움말·설정·S13 을 열어 두고 규칙을 읽는 동안에도 전투가 계속
   * 굴러가서, 창을 닫으면 진법이 이미 무너져 있었다. 모달이 열려 있으면
   * `engine.update` 만 건너뛰고 렌더 루프는 그대로 돌린다 — 화면이 얼어붙는
   * 대신 "멈춰 있다"가 그대로 보인다. P 키는 수동 토글이며 같은 칩을 쓴다.
   * 종료 화면은 이미 정지 상태라 무관하다.
   */
  manualPause = false;
}

/** 화면 모듈 전체가 참조를 공유하는 상태 그릇. */
export const ctx = new AppContext();

ctx.engine.state.autoPlaceSummons = initialAutoPlaceSummons;

/**
 * FB6: 전장 캔버스의 상시 연출(맥동·플래시·먹물 흐름)을 멈춰야 하는가.
 * OS 동작 줄이기는 접근성 계약이라 차분한 화면을 꺼도 모션은 계속 줄인다.
 */
export function calmBattlefield(): boolean {
  return reducedMotion || ctx.calmScreen;
}

// 오디오 QA(__HANJA_AUDIO_QA__)와 같은 개발 전용 손잡이 — 1회성 안내처럼
// "웨이브 10 도달·문기 획득" 같은 중반 상태를 e2e·스크린샷이 재현할 때 쓴다.
if (import.meta.env.DEV) Object.assign(window, { __HANJA_CTX_QA__: ctx });
