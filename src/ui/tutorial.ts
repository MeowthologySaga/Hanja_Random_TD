/*
 * 수련장(튜토리얼 모드).
 *
 * 별승급 규칙 그대로의 "각본 있는 짧은 런"이다. 고정 시드(TUTORIAL) 위에서
 * 소환 → 배치 → 첫 웨이브 → 3합 승급 → 티어 소환 → 강화 → 사자성어 봉인 →
 * 수료의 여덟 걸음을 밟는다. 각 걸음은 [말풍선 + 스포트라이트 + 나머지
 * 상호작용 잠금(soft-lock)]으로 이루어지고, 해당 조작을 실제로 해내면
 * 저절로 다음으로 넘어간다. 코치(coach.ts)의 시각 언어를 빌리되 구현은
 * 이 모듈 안에서 자기완결한다 — coach.ts 는 건드리지 않는다.
 */
import { WORLD_HEIGHT, WORLD_WIDTH } from "../core/content";
import { GameEngine } from "../core/game";
import { summonProductCost } from "../core/hanzi";
import { type Wuxing } from "../core/types";
import { isBattleAssetsReady, whenBattleAssetsReady } from "./asset-loader";
import { canvas, ctx, must, shell, sound } from "./app-context";
import { focusMapOnCells } from "./battle/camera";
import { showToast } from "./hud";
import { startRun } from "./s00-menu";
import { hideSummonReveal } from "./summon-reveal";
import {
  cellsWorldBounds,
  deployGrantedTower,
  nextPendingGrantId,
  pickFusionGrantChars,
  pickSupportChars,
  prepareIdiomLine,
  startingWuxing,
  totalEssenceSpent,
  TUTORIAL_IDIOM_ID,
  TUTORIAL_SEED
} from "./tutorial-script";

/** 수료 기록. 코치 키(coach-seen)와 같은 패턴, 키는 분리한다. */
const TUTORIAL_STORAGE_KEY = "hanja-td:tutorial-complete-v1";

/** 말풍선 폭(px). 코치(258)보다 살짝 넓혀 두 문장을 편히 담는다. */
const BUBBLE_WIDTH = 272;

interface TutorialView {
  /** 스포트라이트 대상 셀렉터. world 가 있으면 무시된다. */
  readonly target?: string;
  /** 전장 월드 좌표 사각형 스포트라이트(진·성어 줄). */
  readonly world?: { x: number; y: number; width: number; height: number } | null;
  readonly title: string;
  readonly body: string;
  readonly control?: "click" | "wheel" | "drag";
}

interface TutorialStep {
  readonly id: string;
  /** 단계 진입 시 1회 — 각본 지급·카메라 이동. */
  readonly enter?: () => void;
  /** 매 프레임 — 준비 시간 정지 외의 단계별 뒷정리(재선택·카드 걷기). */
  readonly tick?: () => void;
  /** 지금 짚을 곳과 문구. 상태(탭·페이즈)에 따라 갈린다. */
  readonly view: () => TutorialView;
  /** 이 단계에서 클릭을 허용하는 영역. 말풍선·소환 결과 카드는 항상 허용. */
  readonly allow: () => readonly string[];
  readonly satisfied: () => boolean;
}

/** 어느 단계에서든 막지 않는 영역 — 자체 UI·결과 카드·진 해금 확인 창. */
const GLOBAL_ALLOW: readonly string[] = ["#tutorial-layer", "#summon-reveal", "#formation-unlock-dialog"];

/** 각본 밖 단축키(소환·배속·일시정지·도감 등)는 수련 중에 전부 잠근다. */
const BLOCKED_KEYS = new Set(["Digit1", "Digit2", "Digit3", "KeyQ", "KeyC", "KeyM", "KeyF", "KeyP", "Space", "Escape"]);

let active = false;

let stepIndex = -1;

let loopRunning = false;

let renderKey = "";

let nudgeTimer = 0;

let completeTimer = 0;

interface TutorialRuntime {
  summonBaseline: number;
  essenceBaseline: number;
  growthWuxing: Wuxing;
  idiomGrantIds: number[];
  idiomLine: number[];
}

let runtime: TutorialRuntime = freshRuntime();

function freshRuntime(): TutorialRuntime {
  return { summonBaseline: 0, essenceBaseline: 0, growthWuxing: "木", idiomGrantIds: [], idiomLine: [] };
}

function tutorialCompleted(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markTutorialCompleted(): void {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
  } catch {
    // 저장이 막혀 있어도 이번 수련은 정상 진행된다.
  }
}

/* ── 여덟 걸음 각본 ─────────────────────────────────────────────── */

const STEPS: readonly TutorialStep[] = [
  {
    id: "summon",
    view: () => ({
      target: '[data-summon-product="balanced"]',
      title: "첫 자령을 뽑아 보세요",
      body: "[기본 소환]을 누르면 한자를 품은 자령이 나와요. 획이 많은 한자일수록 별이 높고, 기본 소환은 1~3★에서 나와요.",
      control: "click"
    }),
    allow: () => ['[data-summon-product="balanced"]'],
    satisfied: () => ctx.engine.state.summonCount >= 1
  },
  {
    id: "place",
    tick: () => {
      // 결과 카드가 전장을 덮으면 빈 칸을 누를 수 없다 — 이 단계에서는 걷는다.
      hideSummonReveal();
      // 어디를 눌러 선택이 풀렸어도, 놓을 자령을 다시 손에 쥐여 준다.
      const held = ctx.engine.state.inventoryTowers[0];
      if (held && ctx.engine.selectedTower() === undefined) ctx.engine.selectTower(held.id);
    },
    view: () => ({
      world: startingFormationWorldRect(),
      title: "전장에 세워 보세요",
      body: "첫 자령 덕분에 같은 오행의 진 하나가 무료로 열렸어요. 밝은 진 안의 빈 칸을 누르면 그 자리에 서요.",
      control: "click"
    }),
    allow: () => ["#battle-canvas"],
    satisfied: () => ctx.engine.state.towers.length >= 1
  },
  {
    id: "wave",
    enter: () => {
      // 지원군 두 기를 함께 세워 "반드시 이기는 첫 교전"을 만든다.
      for (const char of pickSupportChars(ctx.engine, 2)) {
        if (!ctx.engine.tutorialGrantTower(char).ok) break;
        const id = ctx.engine.state.selectedTowerId;
        if (id !== null) deployGrantedTower(ctx.engine, id);
      }
      showToast("수련 지원 — 자령 2기를 함께 세웠어요");
    },
    tick: () => hideSummonReveal(),
    view: () => ctx.engine.state.phase === "combat"
      ? {
        target: "#enemy-limit-chip",
        title: "봉인 중이에요",
        body: "자령은 사거리 안의 적을 알아서 공격해요. 이 [적 한계] 숫자가 가득 차기 전에 모두 잡으면 돼요. 수련의 적은 아주 약해요."
      }
      : {
        target: "#early-button",
        title: "첫 웨이브를 시작해요",
        body: "[시작 보너스]를 누르면 적이 나와요. 적은 길을 돌며 계속 쌓이고, [적 한계]가 가득 차면 져요. 오른쪽 [약점] 표식의 오행은 피해가 더 들어가요.",
        control: "click"
      },
    allow: () => ctx.engine.state.phase === "combat" ? ["#battle-canvas"] : ["#early-button", "#battle-canvas"],
    satisfied: () => ctx.engine.state.wave >= 1 && ctx.engine.state.phase === "prep"
  },
  {
    id: "fusion",
    enter: () => {
      const pick = pickFusionGrantChars(ctx.engine);
      if (pick) for (const char of pick.chars) ctx.engine.tutorialGrantTower(char);
      showToast("수련 지원 — 같은 별 자령 3기를 드렸어요");
    },
    view: () => ctx.activePanelTab === "evolution"
      ? {
        target: "#casual-fuse-all",
        title: "3기를 하나로 승급해요",
        body: "[한 번에 승급]을 누르면 같은 오행·같은 별 3기가 사라지고 다음 별 자령 1기가 나와요. 무엇이 나올지는 열어 봐야 알아요.",
        control: "click"
      }
      : {
        target: '[data-panel-tab="evolution"]',
        title: "승급 서책을 열어요",
        body: "같은 오행·같은 별 3기가 모이면 승급할 수 있어요. 방금 3기를 드렸어요 — [합성] 갈피를 눌러 주세요.",
        control: "click"
      },
    allow: () => ['[data-panel-tab="evolution"]', "#evolve-button", ".evolution-workbench", "#casual-fusion-confirm-dialog"],
    satisfied: () => ctx.engine.state.casualFusionCount >= 1
  },
  {
    id: "tier-summon",
    enter: () => {
      runtime.summonBaseline = ctx.engine.state.summonCount;
      // 이제부터는 본편처럼 뽑는 즉시 빈 칸에 선다.
      ctx.engine.state.autoPlaceSummons = true;
      ctx.engine.tutorialGrantGold(summonProductCost(ctx.engine.state.summonCount, "midstar"));
      showToast("수련 지원 — 중급 소환 값을 드렸어요");
    },
    view: () => ctx.activePanelTab === "shop"
      ? {
        target: '[data-summon-product="midstar"]',
        title: "더 높은 별을 노려 보세요",
        body: "소환마다 별 구간이 달라요 — 기본 1~3★ · 중급 2~5★ · 고급 3~8★. 중급 소환 값은 드렸으니 한 번 뽑아 보세요.",
        control: "click"
      }
      : {
        target: '[data-panel-tab="shop"]',
        title: "상점으로 돌아가요",
        body: "[상점] 갈피를 눌러 주세요.",
        control: "click"
      },
    allow: () => ['[data-panel-tab="shop"]', '[data-summon-product="midstar"]'],
    satisfied: () => ctx.engine.state.summonCount > runtime.summonBaseline
  },
  {
    id: "growth",
    enter: () => {
      runtime.essenceBaseline = totalEssenceSpent(ctx.engine);
      runtime.growthWuxing = startingWuxing(ctx.engine);
      ctx.engine.tutorialGrantEssence(runtime.growthWuxing, 12);
      // 제련소가 열리면 바로 그 오행 갈피가 보이게 맞춰 둔다.
      ctx.growthElement = runtime.growthWuxing;
      ctx.growthRenderKey = "";
      showToast(`수련 지원 — ${runtime.growthWuxing} 문기 12를 드렸어요`);
    },
    view: () => ctx.activePanelTab === "growth"
      ? {
        target: '#growth-upgrade-list [data-growth-upgrade-scope="element"]:not([disabled])',
        title: "문기로 오행을 키워요",
        body: `받은 ${runtime.growthWuxing} 문기로 [1회] 강화를 눌러 보세요. 같은 오행 자령 전원이 함께 강해져요.`,
        control: "click"
      }
      : {
        target: '[data-panel-tab="growth"]',
        title: "강화 제련소를 열어요",
        body: "안 쓰는 자령을 분해하면 '문기'라는 재료가 나와요. 지금은 미리 드렸어요 — [강화] 갈피를 눌러 주세요.",
        control: "click"
      },
    allow: () => ['[data-panel-tab="growth"]', "#growth-panel", "#growth-frame"],
    satisfied: () => totalEssenceSpent(ctx.engine) > runtime.essenceBaseline
  },
  {
    id: "idiom",
    enter: () => {
      ctx.engine.setIdiomTarget(TUTORIAL_IDIOM_ID);
      const idiom = ctx.engine.currentIdiomTarget();
      const line = prepareIdiomLine(ctx.engine);
      runtime.idiomLine = line ?? [];
      runtime.idiomGrantIds = [];
      shell.dataset.tutorialIdiomCells = runtime.idiomLine.join(",");
      if (idiom) {
        for (const char of idiom.chars) {
          if (!ctx.engine.tutorialGrantTower(char).ok) break;
          const id = ctx.engine.state.selectedTowerId;
          if (id !== null) runtime.idiomGrantIds.push(id);
        }
      }
      // 1번째 글자는 각본이 놓는다 — 남은 세 글자의 금색 점선 안내가 이 줄에 선다.
      const first = runtime.idiomGrantIds[0];
      const anchor = runtime.idiomLine[0];
      if (first !== undefined && anchor !== undefined) {
        ctx.engine.selectTower(first);
        ctx.engine.moveSelectedToCell(anchor);
      }
      if (runtime.idiomLine.length > 0) focusMapOnCells(runtime.idiomLine);
    },
    tick: () => {
      hideSummonReveal();
      // 다음에 놓을 글자를 항상 손에 쥐여 준다(지급 순서 = 성어 글자 순서).
      const pending = nextPendingGrantId(ctx.engine, runtime.idiomGrantIds);
      if (pending !== null && ctx.engine.state.selectedTowerId !== pending && ctx.towerDragPointerId === null) {
        ctx.engine.selectTower(pending);
      }
    },
    view: () => ({
      world: cellsWorldBounds(runtime.idiomLine),
      title: "사자성어를 봉인해 보세요",
      body: "네 글자 성어를 드렸고 1번째 글자는 미리 놓았어요. 금색 점선 칸을 눌러 ②→③→④ 순서로 이어 주세요. 완성한 보너스는 네 자령이 그 줄을 지키는 동안만 살아 있어요.",
      control: "click"
    }),
    allow: () => ["#battle-canvas"],
    satisfied: () => ctx.engine.isIdiomSealActive(TUTORIAL_IDIOM_ID)
  },
  {
    id: "finish",
    enter: () => {
      markTutorialCompleted();
      shell.dataset.tutorialComplete = "1";
      must<HTMLButtonElement>("#tutorial-button").classList.remove("is-fresh");
      // 봉인 발동 연출(파문·4자 플래시)을 가리지 않게 잠시 뒤에 수료막을 올린다.
      window.clearTimeout(completeTimer);
      completeTimer = window.setTimeout(() => {
        if (active && STEPS[stepIndex]?.id === "finish") must<HTMLElement>("#tutorial-complete").hidden = false;
      }, 2600);
    },
    view: () => ({
      title: "봉인 발동 — 수련 완수!",
      body: "줄이 완성되어 봉인이 터졌어요. 네 자령이 이 줄을 지키는 동안 보너스가 계속돼요."
    }),
    allow: () => ["#tutorial-complete"],
    satisfied: () => false
  }
];

/* ── 화면 배치(코치의 시각 언어를 자체 구현) ────────────────────── */

interface ShellRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 화면 좌표 → 셸 좌표. 셸이 transform: scale 로 확대되므로 역산한다. */
function toShellRect(rect: DOMRect): ShellRect {
  const shellRect = shell.getBoundingClientRect();
  const scaleX = shellRect.width / Math.max(1, shell.offsetWidth);
  const scaleY = shellRect.height / Math.max(1, shell.offsetHeight);
  return {
    left: (rect.left - shellRect.left) / scaleX,
    top: (rect.top - shellRect.top) / scaleY,
    width: rect.width / scaleX,
    height: rect.height / scaleY
  };
}

function laidOut(selector: string): HTMLElement | null {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1 ? element : null;
}

/** 시작 진(첫 소환이 개방한 진)의 월드 사각형. */
function startingFormationWorldRect(): TutorialView["world"] {
  const index = ctx.engine.state.startingFormationIndex;
  if (index === null) return null;
  return cellsWorldBounds(Array.from({ length: 16 }, (_, local) => index * 16 + local));
}

/** 월드 사각형 → 셸 좌표(카메라 배율·이동 반영, 캔버스 영역으로 잘라냄). */
function worldToShellRect(world: NonNullable<TutorialView["world"]>): ShellRect | null {
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width < 1 || canvasRect.height < 1) return null;
  const sx = canvasRect.width / WORLD_WIDTH;
  const sy = canvasRect.height / WORLD_HEIGHT;
  const screen = new DOMRect(
    canvasRect.left + (ctx.mapOffset.x + world.x * ctx.mapZoom) * sx,
    canvasRect.top + (ctx.mapOffset.y + world.y * ctx.mapZoom) * sy,
    world.width * ctx.mapZoom * sx,
    world.height * ctx.mapZoom * sy
  );
  // 캔버스 밖으로 번지지 않게 자른다.
  const left = Math.max(screen.left, canvasRect.left);
  const top = Math.max(screen.top, canvasRect.top);
  const right = Math.min(screen.left + screen.width, canvasRect.right);
  const bottom = Math.min(screen.top + screen.height, canvasRect.bottom);
  if (right - left < 4 || bottom - top < 4) return null;
  return toShellRect(new DOMRect(left, top, right - left, bottom - top));
}

function setStyle(element: HTMLElement, property: string, value: string): void {
  if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
}

function layoutView(view: TutorialView): void {
  const ring = must<HTMLElement>("#tutorial-ring");
  const bubble = must<HTMLElement>("#tutorial-bubble");
  let focus: ShellRect | null = null;
  if (view.world) focus = worldToShellRect(view.world);
  else if (view.target) {
    const element = laidOut(view.target);
    if (element) focus = toShellRect(element.getBoundingClientRect());
  }
  if (!focus) {
    // 짚을 곳이 없으면 링을 걷고 말풍선만 화면 아래 가운데에 세운다.
    if (!ring.hidden) ring.hidden = true;
    setStyle(bubble, "top", `${Math.max(8, shell.offsetHeight - 178)}px`);
    setStyle(bubble, "left", `${Math.max(8, (shell.offsetWidth - BUBBLE_WIDTH) / 2)}px`);
    return;
  }
  if (ring.hidden) ring.hidden = false;
  setStyle(ring, "left", `${focus.left - 6}px`);
  setStyle(ring, "top", `${focus.top - 6}px`);
  setStyle(ring, "width", `${focus.width + 12}px`);
  setStyle(ring, "height", `${focus.height + 12}px`);

  const bubbleHeight = bubble.offsetHeight || 140;
  const below = focus.top + focus.height + 14;
  // 패널 탭 띠를 덮지 않는 선까지만 아래로 내려간다(코치와 같은 규칙).
  const tabs = document.querySelector<HTMLElement>(".panel-tabs");
  const tabsTop = tabs ? toShellRect(tabs.getBoundingClientRect()).top : shell.offsetHeight;
  const bottomLimit = Math.min(shell.offsetHeight - 8, tabsTop - 6);
  const fitsBelow = below + bubbleHeight <= bottomLimit;
  setStyle(bubble, "top", fitsBelow ? `${below}px` : `${Math.max(8, focus.top - bubbleHeight - 14)}px`);
  setStyle(bubble, "left", `${Math.max(8, Math.min(shell.offsetWidth - BUBBLE_WIDTH - 8, focus.left + focus.width / 2 - BUBBLE_WIDTH / 2))}px`);
}

function renderView(): void {
  const step = STEPS[stepIndex];
  if (!step) return;
  const view = step.view();
  const key = `${stepIndex}|${view.target ?? "world"}|${view.title}`;
  if (key !== renderKey) {
    renderKey = key;
    must<HTMLElement>("#tutorial-step-index").textContent = String(stepIndex + 1);
    must<HTMLElement>("#tutorial-step-total").textContent = String(STEPS.length);
    must<HTMLElement>("#tutorial-title").textContent = view.title;
    must<HTMLElement>("#tutorial-body").textContent = view.body;
    const bubble = must<HTMLElement>("#tutorial-bubble");
    if (view.control) bubble.dataset.tutorialControl = view.control;
    else delete bubble.dataset.tutorialControl;
    // 수료 걸음에서는 [수련 건너뛰기]를 걷는다 — 이미 수료 기록이 남았다.
    must<HTMLElement>("#tutorial-exit").hidden = stepIndex >= STEPS.length - 1;
  }
  layoutView(view);
}

/* ── 진행 루프 ──────────────────────────────────────────────────── */

function advance(): void {
  stepIndex += 1;
  const step = STEPS[stepIndex];
  if (!step) return;
  shell.dataset.tutorialStep = String(stepIndex + 1);
  shell.dataset.tutorialFormation = ctx.engine.state.startingFormationIndex === null
    ? ""
    : String(ctx.engine.state.startingFormationIndex);
  step.enter?.();
  renderKey = "";
}

function tutorialFrame(): void {
  if (!active) {
    loopRunning = false;
    return;
  }
  const state = ctx.engine.state;
  if (state.phase === "defeat" || state.phase === "victory") {
    // 이론상 없어야 하지만(완화 스케일), 그래도 지면 처음 걸음부터 다시 정비한다.
    showToast("수련을 다시 정비합니다 — 처음 걸음부터 다시 시작해요");
    startTutorial();
    window.requestAnimationFrame(tutorialFrame);
    return;
  }
  const step = STEPS[stepIndex];
  if (step) {
    // 각본 밖에서 웨이브가 저절로 시작되지 않게 준비 시간을 세워 둔다.
    // 웨이브 걸음도 [시작 보너스] 버튼만이 유일한 출구가 된다.
    if (state.phase === "prep" && state.summonCount > 0) {
      state.prepRemaining = Math.max(state.prepRemaining, 12);
    }
    step.tick?.();
    if (step.satisfied()) advance();
  }
  renderView();
  window.requestAnimationFrame(tutorialFrame);
}

/* ── 시작·종료 ──────────────────────────────────────────────────── */

function startTutorial(): void {
  sound.unlock();
  startRun(false, {
    createEngine: () => new GameEngine(TUTORIAL_SEED, "KR", "casual", { tutorial: true }),
    skipCoach: true
  });
  // 배치 걸음(2)을 위해 첫 소환은 손에 쥔 채 시작한다. 5걸음에서 되돌린다.
  ctx.engine.state.autoPlaceSummons = false;
  runtime = freshRuntime();
  stepIndex = -1;
  renderKey = "";
  active = true;
  shell.dataset.tutorial = "1";
  delete shell.dataset.tutorialComplete;
  delete shell.dataset.tutorialIdiomCells;
  const layer = must<HTMLElement>("#tutorial-layer");
  layer.hidden = false;
  must<HTMLElement>("#tutorial-complete").hidden = true;
  must<HTMLElement>("#tutorial-exit").hidden = false;
  advance();
  renderView();
  if (!loopRunning) {
    loopRunning = true;
    window.requestAnimationFrame(tutorialFrame);
  }
}

/**
 * 수련 이탈·수료 뒤 복귀는 본편의 [메뉴로 돌아가기]와 같은 새로고침이다 —
 * 한 판 분량의 상태(엔진·카메라·패널)를 가장 견고하게 털어낸다.
 * 수료 기록·설정은 localStorage 라 그대로 살아남는다.
 */
function leaveTutorial(): void {
  window.location.reload();
}

let enteringTraining = false;

async function enterTraining(button: HTMLButtonElement): Promise<void> {
  if (enteringTraining || active) return;
  sound.unlock();
  if (!isBattleAssetsReady()) {
    enteringTraining = true;
    button.dataset.loading = "1";
    await whenBattleAssetsReady();
    delete button.dataset.loading;
    enteringTraining = false;
  }
  sound.playUiConfirm();
  startTutorial();
}

/* ── soft-lock — 허용 영역 밖 클릭·단축키를 걷어낸다 ───────────── */

function nudgeBubble(): void {
  const bubble = must<HTMLElement>("#tutorial-bubble");
  bubble.classList.remove("is-nudge");
  void bubble.offsetWidth;
  bubble.classList.add("is-nudge");
  window.clearTimeout(nudgeTimer);
  nudgeTimer = window.setTimeout(() => bubble.classList.remove("is-nudge"), 460);
}

function interceptPointer(event: Event): void {
  if (!active) return;
  const target = event.target as HTMLElement | null;
  if (!target || typeof target.closest !== "function") return;
  const allowed = [...GLOBAL_ALLOW, ...(STEPS[stepIndex]?.allow() ?? [])];
  if (allowed.some((selector) => target.closest(selector) !== null)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.type === "pointerdown") nudgeBubble();
}

function interceptKeys(event: KeyboardEvent): void {
  if (!active) return;
  if (!BLOCKED_KEYS.has(event.code)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireTutorial1(): void {
  const button = must<HTMLButtonElement>("#tutorial-button");
  // 첫 방문(수료 기록 없음)에는 은은한 맥동으로 "여기부터"를 짚는다.
  if (!tutorialCompleted()) button.classList.add("is-fresh");
  button.addEventListener("click", () => void enterTraining(button));
  must<HTMLButtonElement>("#tutorial-exit").addEventListener("click", leaveTutorial);
  must<HTMLButtonElement>("#tutorial-finish").addEventListener("click", leaveTutorial);
  document.addEventListener("pointerdown", interceptPointer, true);
  document.addEventListener("click", interceptPointer, true);
  window.addEventListener("keydown", interceptKeys, true);
}
