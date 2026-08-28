/*
 * 타이틀 화면(S00)과 판 시작·복귀.
 */
import { GameEngine } from "../core/game";
import { createRunSeed } from "../core/rng";
import { restoreRun, type RunSave } from "../core/run-save";
import { type AutomationMode, type GameMode, type RegionCode } from "../core/types";
import { battleAssetProgress, isBattleAssetsReady, whenBattleAssetsReady } from "./asset-loader";
import { buildSynthesisDepths, buildUncombinableStageOneChars } from "./codex-synthesis";
import {
  applySavedUiState,
  autoSaveRun,
  clearSavedRun,
  readRunSaveSlot,
  readSavedRun,
  savedRunConfirmLine,
  savedRunSummaryLines
} from "./run-save-slot";
import { loadAutoPlaceSummons } from "./summon-placement";
import {
  canvas,
  casualFusionConfirmDialog,
  ctx,
  dismantleSelection,
  endOverlay,
  lastAbilityFxByTower,
  must,
  runInventoryBulkSelection,
  s00Mode,
  seedInput,
  shell,
  sound,
  titleOverlay
} from "./app-context";
import {
  abilityBurstPool,
  abilityBursts,
  floaterPool,
  floaters,
  idiomRipples,
  projectilePool,
  projectiles,
  recycleAll,
  ringPool,
  rings,
  towerAbilityPopups
} from "./battle/fx";
import { startCoach } from "./coach";
import { openConfirm } from "./dialogs/confirm";
import { REGION_MENU_INFO, syncS13 } from "./dialogs/s13";
import { gameModeLabel } from "./format";
import { handleAction, setPanelTab, showToast, syncPanel } from "./hud";
import { resetIdiomResult } from "./panels/idiom";
import { closeCompositionDrawer } from "./panels/selected";
import { hideSummonReveal } from "./summon-reveal";

/**
 * S00 2D 폴백(`?menu3d=0` · WebGL 초기화 실패)의 3레이어 배경.
 *
 * 출처: handoff/to-claude/s00-layered-bg-pack-v1/assets/
 * 설치: public/assets/ui/s00-layers-v1/
 *
 * 세 장이 전부 도착했을 때만 기존 단일 배경을 끈다. 한 장이라도 실패하면
 * 합성이 어긋난 채 보이느니 원래 한 장짜리 배경을 그대로 쓴다. 다섯 먹 고리는
 * 책 레이어 RGB 에 그대로 있으므로 좌표가 바뀌지 않는다.
 *
 * R11: `src` 대신 `data-src` 로 들고 있다가 2D 로 갈 때만 붙인다. 3D 가 기본인데
 * `display:none` 인 `<img>` 도 브라우저는 그대로 받아 가서, 쓰지도 않을 6.8MB
 * (배경 4장 4.8MB + 쇼케이스 고리·자령 10장 2.0MB)가 매번 S00 텍스처와 대역을
 * 나눠 쓰고 있었다. 3D 에서 고리·자령은 같은 파일을 텍스처로 쓰므로 그림 자체는
 * 그대로 나온다.
 */
function enableS00LayeredBackground(): void {
  const stage = document.querySelector<HTMLElement>(".s00-stage");
  const group = document.querySelector<HTMLElement>("#s00-parallax");
  if (!stage || !group) return;
  const legacy = stage.querySelector<HTMLImageElement>(".s00-env--legacy");
  if (legacy?.dataset.src && !legacy.src) legacy.src = legacy.dataset.src;
  for (const showcase of stage.querySelectorAll<HTMLImageElement>(".s00-showcase img[data-src]")) {
    if (!showcase.src) showcase.src = showcase.dataset.src ?? "";
  }
  const layers = Array.from(group.querySelectorAll<HTMLImageElement>("img"));
  if (layers.length === 0 || layers[0]?.src) return;
  let settled = 0;
  let failed = false;
  const settle = (ok: boolean, image: HTMLImageElement): void => {
    if (!ok) {
      failed = true;
      console.warn(`[s00-layers] 레이어 로드 실패, 단일 배경 유지: ${image.src.split("/").pop() ?? ""}`);
    }
    settled += 1;
    if (settled === layers.length && !failed) group.classList.add("is-ready");
  };
  for (const image of layers) {
    image.addEventListener("load", () => settle(true, image), { once: true });
    image.addEventListener("error", () => settle(false, image), { once: true });
    if (image.dataset.src) image.src = image.dataset.src;
  }
}

export function syncTitleModeSelection(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-game-mode-option]").forEach((button) => {
    const selected = button.dataset.gameModeOption === ctx.selectedGameMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  document.querySelectorAll<HTMLButtonElement>(".region-option").forEach((button) => {
    const region = button.dataset.region as RegionCode;
    button.disabled = false;
    button.setAttribute("aria-disabled", "false");
    const info = REGION_MENU_INFO[region];
    button.title = info.pool;
    button.setAttribute("aria-label", `${info.name} · ${info.pool}`);
    const selected = region === ctx.selectedRegion;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  must<HTMLElement>("#s00-summary-main").textContent = `${REGION_MENU_INFO[ctx.selectedRegion].name} · ${gameModeLabel(ctx.selectedGameMode)}`;
  const s13 = document.querySelector<HTMLDialogElement>("#s13-dialog");
  if (s13?.open) syncS13();
  must<HTMLElement>("#s00-start-sub").textContent = REGION_MENU_INFO[ctx.selectedRegion].pool;
  must<HTMLElement>("#title-lead").innerHTML = ctx.selectedGameMode === "casual"
    ? "획수가 희귀도를 정하고, 같은 오행 세 자령을 모두 바쳐 다음 별을 부릅니다.<br />무엇이 나올지는 열어 봐야 압니다 — 8성 대봉인까지 성장시키세요."
    : "운으로 글자를 부르고, 실제 구성 원리로 합성하라.<br />열 개의 장과 백 번의 망령 행렬을 넘어 대봉인을 완성하세요.";
  // 개발용 표현(심사·제출)은 dev 모드에서만 남긴다. 플레이어에게는
  // "무엇이 가장 잘 갖춰져 있는가"만 말한다.
  const devLabels = shell.dataset.devMode === "1";
  must<HTMLElement>("#title-note").textContent = ctx.selectedRegion === "KR"
    ? devLabels ? "심사 권장 · 현재 제출 기준 콘텐츠" : "가장 완성된 콘텐츠"
    : "미리 해보기 · 도감·현지화·밸런스 보강 중";
}

export function setSelectedGameMode(mode: GameMode): void {
  sound.unlock();
  ctx.selectedGameMode = mode;
  syncTitleModeSelection();
  sound.playUiConfirm();
}

/**
 * 특수 런(수련장)이 같은 시작 절차를 타기 위한 옵션.
 * 엔진만 밖에서 갈아 끼우고, 화면·이펙트·패널 리셋은 본편과 동일하게 지킨다.
 */
export interface StartRunOptions {
  /** 엔진을 밖에서 만들어 넣는다(수련장 고정 시드·완화 옵션). */
  readonly createEngine?: () => GameEngine;
  /** 첫 실행 3단계 코치를 띄우지 않는다(수련장은 자체 각본 안내가 있다). */
  readonly skipCoach?: boolean;
  /**
   * [트랙 V] 이미 저장된 상태를 얹은 엔진이라 `begin()` 으로 되감지 않는다.
   * 화면·이펙트·패널 초기화는 새 판과 똑같이 지나간다 — 지난 판의 투사체나
   * 열려 있던 작업대가 되살린 판까지 따라오면 안 된다.
   */
  readonly resume?: boolean;
}

export function startRun(useNewSeed = false, options: StartRunOptions = {}): void {
  // 판이 실제로 서는 이 지점에서만 3D 서재를 걷는다(위 menu3dHandle 주석 참조).
  menu3dHandle?.dispose();
  menu3dHandle = null;
  /*
   * 부적 보상으로 받은 무료 소환권은 그 판의 자원이다. 엔진에 딸린 값이 아니라
   * ctx 에 얹혀 있어(app-context) 판이 끝나도 그대로 남았다 — 게임오버 뒤
   * [다시 도전]을 누르면 지난 판의 권이 새 판으로 따라왔다(사용자 제보).
   * 부적 장부는 엔진이 바뀌면 스스로 리셋되는데(panels/talisman) 이 값만 빠져
   * 있었다. 이어하기는 이 뒤에 저장본을 얹으므로(applySavedUiState) 영향 없다.
   */
  ctx.talismanFreeSummonTokens = 0;
  const seed = useNewSeed ? createRunSeed() : seedInput.value.trim() || createRunSeed();
  ctx.engine = options.createEngine
    ? options.createEngine()
    // 표기 축(gripe #6): 명시 선택이 없으면(null — 플래그 꺼짐 동안 항상)
    // 엔진 기본값인 로스터 자국 표기라 현행과 같다.
    // 부적 모드(트랙 C2)는 런이 시작될 때의 설정을 그대로 굳힌다 — 한 판
    // 도중에 토글을 만져도 그 런의 적 체력이 흔들리지 않는다.
    : new GameEngine(seed, ctx.selectedRegion, ctx.selectedGameMode, {
      ...(ctx.selectedNotation ? { notation: ctx.selectedNotation } : {}),
      talismanMode: ctx.talismanMode
    });
  seedInput.value = ctx.engine.state.seed;
  if (options.resume) {
    // 되살린 판은 저장된 지역·진법을 따른다 — 목록 선택이 그 사이 바뀌어 있어도
    // 화면 표기(요약 줄·도감 범위)가 실제로 굴러가는 판과 어긋나지 않게.
    // 새 판에서는 애초에 이 선택으로 엔진을 만들었으므로 손대지 않는다(수련장은
    // KR·별승급으로 고정한 판이라, 여기서 옮겨 적으면 메뉴 선택을 덮어 버린다).
    ctx.selectedRegion = ctx.engine.state.region;
    ctx.selectedGameMode = ctx.engine.state.mode;
  }
  shell.dataset.gameMode = ctx.engine.state.mode;
  ctx.mapSynthesisDepths = buildSynthesisDepths(ctx.engine.catalog.definitions.values());
  ctx.mapUncombinableStageOne = buildUncombinableStageOneChars(ctx.engine.catalog.definitions.values());
  // 자동 배치는 런이 아니라 사람의 설정이라 저장본이 아니라 저장소를 따른다.
  ctx.engine.state.autoPlaceSummons = loadAutoPlaceSummons();
  if (options.resume) {
    // 상태는 이미 얹혀 있다. begin() 을 부르면 그 판을 처음으로 되감아 버린다.
    ctx.previousPhase = ctx.engine.state.phase;
  } else {
    ctx.engine.begin();
    ctx.previousPhase = "prep";
  }
  ctx.manualPause = false;
  ctx.mapCameraGestures = 0;
  titleOverlay.classList.remove("modal-layer--visible");
  endOverlay.classList.remove("modal-layer--visible");
  sound.unlock();
  sound.playUiConfirm();
  recycleAll(projectiles, projectilePool, 48);
  recycleAll(floaters, floaterPool, 48);
  recycleAll(rings, ringPool, 32);
  recycleAll(abilityBursts, abilityBurstPool, 12);
  idiomRipples.length = 0;
  ctx.idiomFlash = null;
  // 새 런은 봉인이 0개라 키도 빈 문자열이 된다. 초기값과 겹치지 않게 표식으로 밀어 둔다.
  ctx.activeIdiomsRenderKey = "run-reset";
  ctx.projectileSpriteDrawTotal = 0;
  ctx.abilityZoneSpriteDrawTotal = 0;
  canvas.dataset.projectileSpriteDrawTotal = "0";
  canvas.dataset.abilityZoneSpriteDrawTotal = "0";
  towerAbilityPopups.clear();
  lastAbilityFxByTower.clear();
  ctx.lastGlobalAbilityFxAt = -10;
  resetIdiomResult();
  hideSummonReveal();
  closeCompositionDrawer();
  ctx.concentrationTargetId = null;
  ctx.concentrationPayment = "essence";
  ctx.growthElement = "木";
  dismantleSelection.clear();
  // R19: 보관고 시야·바구니는 한 판짜리다. 새 런은 전체 보기에서 시작한다.
  ctx.runInventoryElementFilter = null;
  ctx.runInventoryGradeFilter = null;
  ctx.runInventoryBulkMode = false;
  runInventoryBulkSelection.clear();
  ctx.casualFusionSelection = [];
  ctx.pendingCasualFusion = null;
  if (casualFusionConfirmDialog.open) casualFusionConfirmDialog.close();
  setPanelTab("shop");
  // 이어하기는 이미 한 판을 굴려 본 사람이다 — 진 해금 안내도 코치도 세우지 않는다.
  ctx.formationUnlockHintShown = options.resume === true;
  if (!options.skipCoach && !options.resume) startCoach();
  ctx.evolutionRenderKey = "";
  ctx.goalRenderKey = "";
  ctx.selectedRenderKey = "";
  ctx.runInventoryRenderKey = "";
  ctx.idiomRenderKey = "";
  ctx.elementUpgradeRenderKey = "";
  ctx.concentrationRenderKey = "";
  ctx.growthRenderKey = "";
  ctx.towerDragPointerId = null;
  ctx.towerDragTowerId = null;
  ctx.towerDragStart = null;
  ctx.towerDragMoved = false;
  showToast(options.resume
    ? `${ctx.engine.state.wave}웨이브 준비 시간부터 이어서 봉인합니다.`
    : `${ctx.engine.catalog.title} · ${gameModeLabel(ctx.engine.state.mode)}을 시작합니다.`);
  syncPanel();
}

/*
 * ── 이어하기 (트랙 V) ───────────────────────────────────────────────
 *
 * 목패는 저장된 런이 있을 때만 선다. 없거나·판이 다르거나·파손이면 그냥
 * 서지 않는다 — 사람에게는 "이어할 것이 없다"가 전부라 셋을 구분할 이유가 없다.
 * 다만 **읽으려다 실패한 경우**만은 부팅 때 한 줄 알린다(`wireS00Menu2` 끝).
 */

/** 부팅 때 슬롯에 무엇이 있었는지. 목패 동기화가 매번 저장소를 다시 읽지 않게 든다. */
let savedRun: RunSave | null = null;

/** 목패를 지금 슬롯 상태에 맞춘다. 저장·삭제 뒤에 부른다. */
export function syncResumePlaque(): void {
  savedRun = readSavedRun();
  const button = must<HTMLButtonElement>("#resume-button");
  button.hidden = savedRun === null;
  if (!savedRun) return;
  const { where, progress } = savedRunSummaryLines(savedRun);
  must<HTMLElement>("#resume-where").textContent = where;
  must<HTMLElement>("#resume-progress").textContent = progress;
  button.setAttribute("aria-label", `이어하기. ${where} · ${progress} 지점부터 다시 시작합니다.`);
}

/** 저장된 런을 되살려 전장으로 들어간다. */
function resumeSavedRun(): void {
  const save = savedRun ?? readSavedRun();
  if (!save) {
    syncResumePlaque();
    return;
  }
  // 순서가 목숨이다: 화면 쪽 자원(부적 장부·무료 소환권)은 **엔진이 꽂힌 뒤** 얹는다.
  // 장부는 자기가 어느 엔진의 것인지 도장을 찍어 두고 판이 갈리면 스스로 리셋한다.
  // 그래서 startRun 앞에서 얹으면 옛 엔진 도장이 찍혀, 새 엔진이 들어오는 순간
  // 통째로 무효가 되고 다시 3장으로 돌아간다 — 이어하기가 매번 부적 3장이던 사고.
  startRun(false, { createEngine: () => restoreRun(save), resume: true, skipCoach: true });
  applySavedUiState(save);
  syncPanel();
}

/**
 * 새 판이 저장된 런을 덮기 전에 한 번 묻는다. 슬롯이 하나뿐이라 시작하는
 * 순간 두고 온 판은 사라진다 — 그 사실을 누르기 전에 말한다.
 *
 * 슬롯이 비어 있으면 묻지 않고 바로 간다(종료 화면에서 오는 길이 그렇다 —
 * 판이 끝나는 순간 이미 지워져 있다).
 */
function withOverwriteGuard(start: () => void): void {
  const save = readSavedRun();
  if (!save) {
    start();
    return;
  }
  openConfirm({
    eyebrow: "이어하기",
    title: "두고 온 판을 덮고 새로 시작할까요?",
    lines: [
      savedRunConfirmLine(save),
      "새 판을 시작하면 이 기록은 사라지고 되돌릴 수 없습니다."
    ],
    confirmLabel: "덮고 새로 시작",
    cancelLabel: "돌아가기"
  }, () => {
    clearSavedRun();
    syncResumePlaque();
    start();
  });
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireS00Menu1(): void {
  must<HTMLButtonElement>("#seed-reroll-button").addEventListener("click", () => {
    seedInput.value = createRunSeed();
    sound.playUiConfirm();
  });
  must<HTMLButtonElement>("#s00-codex-button").addEventListener("click", () => {
    must<HTMLButtonElement>("#codex-button").click();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => handleAction(ctx.engine.setAutomationMode(button.dataset.mode as AutomationMode)));
  });
}

/**
 * 출정 게이트 (R11).
 *
 * 2차 프리로드가 끝나 있으면 한 프레임도 늦추지 않고 그대로 들어간다. 아직이면
 * 출정 버튼 자체에 소형 진행 띠를 띄우고 `BATTLE_GATE_CAP_MS` 까지만 기다린다.
 * 목적은 대기가 아니라 전장 첫 2초의 적·제단 팝인을 없애는 것이다.
 */
let enteringRun = false;

async function enterRun(button: HTMLButtonElement): Promise<void> {
  if (enteringRun) return;
  if (isBattleAssetsReady()) {
    startRun(false);
    return;
  }
  enteringRun = true;
  button.dataset.loading = "1";
  let ticking = 0;
  const tick = (): void => {
    const { done, total } = battleAssetProgress();
    button.style.setProperty("--p2-progress", total === 0 ? "1" : (done / total).toFixed(3));
    ticking = window.requestAnimationFrame(tick);
  };
  tick();
  await whenBattleAssetsReady();
  window.cancelAnimationFrame(ticking);
  delete button.dataset.loading;
  button.style.removeProperty("--p2-progress");
  enteringRun = false;
  startRun(false);
}

const startButton = must<HTMLButtonElement>("#start-button");

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireS00Menu2(): void {
  startButton.addEventListener("click", () => withOverwriteGuard(() => void enterRun(startButton)));
  // 종료 화면의 두 길은 이미 슬롯이 비워진 뒤라(판이 끝나면 지운다) 묻지 않는다.
  must<HTMLButtonElement>("#retry-button").addEventListener("click", () => startRun(false));
  must<HTMLButtonElement>("#new-seed-button").addEventListener("click", () => startRun(true));
  must<HTMLButtonElement>("#resume-button").addEventListener("click", () => {
    sound.unlock();
    sound.playUiConfirm();
    resumeSavedRun();
  });
  /*
   * 부팅 때 슬롯을 한 번 열어 본다.
   *
   * 읽을 수 없는 값이 들어 있으면 — 형식 판을 올린 뒤 첫 방문이 대개 그렇다 —
   * 목패를 세우지 않고 슬롯을 비운 뒤 딱 한 줄만 알린다. 자세한 사정(판이
   * 다르다·JSON 이 잘렸다)은 사람이 할 수 있는 일이 없으므로 말하지 않는다.
   */
  const slot = readRunSaveSlot();
  if (slot.status === "unreadable") {
    clearSavedRun();
    showToast("이전 기록을 불러올 수 없습니다.");
  }
  syncResumePlaque();
}

/*
 * 종료 화면 막다른 길.
 *
 * 재도전·새 시드뿐이라 지역·진법을 바꾸러 메뉴로 갈 길이 없었고 Esc 도
 * 먹지 않았다. 3D 리그·엔진·카메라·패널이 한 판 분량의 상태를 물고 있어
 * 오버레이만 되돌리면 남은 찌꺼기가 다음 판까지 따라온다. 새로고침이
 * 가장 견고하다 — 최고 기록·안내 본 여부·오디오 설정은 전부
 * localStorage 라 그대로 살아남는다.
 */
function returnToMenu(): void {
  window.location.reload();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireS00Menu3(): void {
  must<HTMLButtonElement>("#return-menu-button").addEventListener("click", returnToMenu);
  // 전장 우상단 [家] — 판 도중에도 제목 화면으로. 진행은 자동 저장이 들고
  // 있으므로 "잃는다"가 아니라 "여기서 멈춘다"임을 확인 창이 말한다.
  must<HTMLButtonElement>("#home-button").addEventListener("click", () => {
    const running = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
    if (!running) { returnToMenu(); return; }
    const saved = autoSaveRun();
    openConfirm({
      eyebrow: "제목 화면으로",
      title: "지금 판을 멈추고 제목 화면으로 갈까요?",
      lines: saved
        ? ["진행은 저장돼 있습니다 — 제목 화면의 [이어하기]로 이 자리에서 다시 시작할 수 있어요."]
        : ["아직 저장 지점이 없어(첫 웨이브 전) 이 판은 사라집니다."],
      confirmLabel: "제목 화면으로",
      cancelLabel: "계속 하기",
      tone: saved ? "neutral" : "danger"
    }, returnToMenu);
  });
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Escape") return;
    if (!endOverlay.classList.contains("modal-layer--visible")) return;
    if (document.querySelector("dialog[open]")) return;
    event.preventDefault();
    returnToMenu();
  });
}

/*
 * S00 2.5D 리그.
 *
 * 진짜 3D 엔진 없이, 포인터 시차와 원근 기울임만으로 "그림 속 책상 위에
 * 자령이 서 있는" 깊이감을 만든다. 좌표는 CSS 변수로만 전달하므로
 * 버튼 히트 영역은 움직이지 않고, prefers-reduced-motion 이면 껐다.
 */
// 3D 서재가 기본 메인 메뉴다. ?menu3d=0 으로 2D 그림 배경으로 되돌릴 수
// 있고, WebGL 초기화가 실패하면 자동으로 2D 로 폴백한다.
// R11: 1차 프리로드가 끝난 뒤에 세운다. 텍스처가 이미 캐시에 있으므로
// `startMenu3d` 안의 재질 교체가 동기로 끝나고 절차 재질이 화면에 남지 않는다.
/**
 * 3D 서재 손잡이 — 판이 실제로 시작될 때 걷기 위해 들고 있는다.
 *
 * 예전에는 [출정] 버튼 클릭에 곧바로 `dispose()` 를 걸어 두었다. 누르면 판으로
 * 들어간다는 전제였는데, 두고 온 판이 있으면 **출정은 판을 시작하지 않고 덮어쓰기
 * 확인 창만 띄운다** — 그 경로에서 배경만 사라져 제목 화면이 통째로 검게 됐다
 * (사용자 제보). 저장이 고쳐지면서 그 경로가 처음으로 실제로 열렸다.
 * 그래서 해제 시점을 "버튼을 눌렀을 때" 가 아니라 "판이 실제로 서는 순간"으로 옮긴다.
 */
let menu3dHandle: { dispose(): void } | null = null;

export async function mountS00(): Promise<void> {
  const stage = document.querySelector<HTMLElement>(".s00-stage");
  if (!stage) return;
  if (s00Mode === "2d") {
    enableS00LayeredBackground();
    return;
  }
  stage.classList.add("is-3d");
  try {
    const { startMenu3d } = await import("./menu3d");
    menu3dHandle = startMenu3d(stage);
  } catch (error) {
    // WebGL 이 없으면 2D 배경으로 되돌린다. 이때 비로소 레이어를 내려받는다.
    // 조용히 삼키면 3D 가 왜 안 뜨는지 알 길이 없어 이유는 남긴다.
    console.warn("[menu3d] 3D 서재 초기화 실패, 2D 배경으로 되돌린다:", error instanceof Error ? error.message : error);
    stage.classList.remove("is-3d");
    enableS00LayeredBackground();
  }
}

const s00Stage = document.querySelector<HTMLElement>(".s00-stage");

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireS00Menu4(): void {
  if (s00Stage && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let parallaxRaf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    const applyParallax = (): void => {
      parallaxRaf = 0;
      // 살짝 늦게 따라와야 손맛이 아니라 "무거운 장면"으로 느껴진다.
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      s00Stage.style.setProperty("--plx", currentX.toFixed(4));
      s00Stage.style.setProperty("--ply", currentY.toFixed(4));
      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.002) {
        parallaxRaf = window.requestAnimationFrame(applyParallax);
      }
    };
    s00Stage.addEventListener("pointermove", (event) => {
      const rect = s00Stage.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!parallaxRaf) parallaxRaf = window.requestAnimationFrame(applyParallax);
    });
    s00Stage.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      if (!parallaxRaf) parallaxRaf = window.requestAnimationFrame(applyParallax);
    });
  }
}
