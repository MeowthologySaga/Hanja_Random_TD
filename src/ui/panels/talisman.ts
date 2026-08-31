/*
 * 부적 만들기 패널 — 트랙 C (gripe #5 + 세계관 보강).
 *
 * 부적(符籍)은 이 세계의 봉인구다(GAME_DESIGN.md 「세계관 — 부적과 자령」).
 * 부적지 위에 현재 지역 로스터의 랜덤 한자를 반투명 큰 글씨로 깔고, 마우스로
 * 따라 쓰면(먹선) 채점 v1(획순 비강제 커버리지 — panels/talisman-score.ts)이
 * 통과 여부를 정한다. 성공하면 먹선이 또렷해지고 주홍 인장이 찍히며, 남은
 * 장수를 한 장 써서 가중 랜덤 보상(엽전 60% / 문기 30% / 기본 소환 무료권
 * 10%)을 준다.
 *
 * 트랙 C2 ①: 판정 시점은 사람이 정한다.
 *   예전에는 획을 뗄 때마다 채점해 임계를 넘는 순간 제멋대로 완성 처리했다 —
 *   "다 쓰지도 않았는데 끝나 버린다"(사용자 실황). 이제 획마다 갱신되는 것은
 *   상태 줄(정확·덮음)뿐이고, [부적 완성] 을 눌러야 판정한다. 미달이면 벌 없이
 *   안내만 남기고 먹선을 그대로 둬 이어 그릴 수 있다.
 * 트랙 C2 ②: 통과하면 그 글자의 자령이 내려와 보상을 놓고 간다
 *   (talisman-reward.ts). 엔진 상태에는 남지 않는 방문객이다.
 * 트랙 C2 ③: 보상은 준 대로 남는다. 대가는 난이도로 받는다 — 부적 모드를 켠
 *   런은 적 체력이 5% 오른다(engine-tuning.ts 「부적 모드 경제」).
 * 트랙 C3 ④: 장수는 이월된다 — 시간에 쫓기지 않는다.
 *   예전에는 웨이브당 3장을 주고 안 쓰면 웨이브 전환에 소멸시켰다. "라운드당
 *   3장 계속 쌓이게 해서 유저가 시간에 쫓길 일 없게 하자"(사용자 실황).
 *   이제 웨이브마다 3장이 **더해지고** 남은 장수는 계속 쌓인다(웨이브 3까지
 *   한 장도 안 썼으면 9장). 무한 누적만 막으려고 상한 30장을 둔다
 *   (engine-tuning.ts 「부적 모드 경제」의 상한 근거).
 *   완성하면 보상 연출이 끝나는 대로 종이가 넘어가 다음 글자가 차오르고,
 *   남은 장수가 0이 될 때만 종이가 잠긴 채 다음 웨이브를 기다린다.
 *
 * 설정의 「학습 모드 · 부적 만들기」 토글(기본 켜짐, localStorage)이 「부적」
 * 탭을 세운다. 강제 없음 — 언제든 끌 수 있다.
 *
 * 코어 무수정 원칙: 보상은 engine.state 직접 변형(엽전·문기 — 디버그 QA 핸들
 * 선례)과 ctx 의 무료권 수로만 지급한다. 무료권 사용은 소환 비용만큼 엽전을
 * state 에 먼저 얹고 즉시 소환하는 래퍼다(실패 시 얹은 엽전을 물려 권 보존).
 */
import { casualStrokeCount } from "../../core/casual";
import { TALISMAN_MODE_ENEMY_HP_SCALE } from "../../core/engine-tuning";
import { type GameEngine } from "../../core/game";
import { summonCost } from "../../core/engine-tuning";
import { WUXING_ORDER } from "../../core/hanzi";
import { learningInfoForNotation } from "../../core/learning";
import { notationBadgeText } from "../notation-substitute";
import { type HanziDefinition, type Wuxing } from "../../core/types";
import { calmBattlefield, ctx, must, TALISMAN_MODE_STORAGE_KEY, sound } from "../app-context";
import { summonAndFocus } from "../battle/camera";
import { setPanelTab, showToast } from "../hud";
import { pickTalismanVisitLine } from "../talisman-lines";
import { playTalismanImpact, playTalismanRewardVisit, type TalismanRewardGrant } from "../talisman-reward";
import { rasterizeImageAlpha, scoreTalismanDrawing, TALISMAN_THRESHOLDS, type TalismanCellGrid, type TalismanScore } from "./talisman-score";
import { StrokeGuide } from "./stroke-guide";
import { InkBoard, paintInk } from "./ink-strokes";
import { loadStrokeGlyphs, paperBoxFor, strokeGlyphFor } from "../../core/stroke-order";

/**
 * 부적지(한지 세로 카드) 캔버스 크기.
 * 패널 작업 영역(.context-deck)은 368px 뿐이라 머리글·바닥줄을 빼면
 * 세로 264px 이 상한이다 — 처음 356px 안은 패널을 넘겨 아래 버튼을 누르면
 * 컨테이너가 스크롤돼 종이 위쪽이 잘렸다(실측 후 축소).
 */
const PAPER_WIDTH = 196;

const PAPER_HEIGHT = 260;

/** 제시 글자 크기 — 명세 하한 180px 을 넘긴다. */
const GLYPH_FONT = '900 186px "Batang", "Malgun Gothic", serif';

const GLYPH_CENTER_X = PAPER_WIDTH / 2;

/** 위 훈음 띠·아래 인장 자리를 남기려고 중심을 살짝 아래에 둔다. */
const GLYPH_CENTER_Y = 130;

/** 채점 칸 크기. 칸 양자화 + 1칸 팽창이 손떨림 허용치다(talisman-score.ts). */
const CELL_SIZE = 8;

/*
 * 획순 안내(선택 항목)의 상태. 꺼져 있으면 `available` 이 false 로 남아
 * 아래 분기가 전부 예전 길로 흐른다 — 기본 화면은 한 획도 달라지지 않는다.
 */
const strokeGuide = new StrokeGuide();

/*
 * 붓 글자가 앉을 정사각형.
 *
 * 바탕체 186px 글자가 차지하던 자리에 맞췄다 — 획순 안내를 켜고 끌 때 글자
 * 크기가 튀지 않아야 한다. 위 훈음 띠와 아래 인장 자리를 남기려고 중심은
 * 살짝 위(GLYPH_CENTER_Y)다.
 */
const GLYPH_BOX = paperBoxFor(174, GLYPH_CENTER_X, GLYPH_CENTER_Y);

/** 먹 붓 굵기. */
const BRUSH_WIDTH = 11;

const INK_STYLE = "rgba(26, 19, 11, 0.88)";

/** 판정에 떨어진 붓질을 잠깐 비추는 색 — 인장의 붉은빛이다. */
const WARN_INK_STYLE = "rgba(159, 47, 35, 0.8)";

/**
 * 떨어진 붓질을 비춰 두는 시간.
 *
 * 곧바로 지우면 「내가 뭘 그렸길래 안 넘어갔지」를 알 길이 없고, 남겨 두면
 * 종이가 실패한 붓질로 더러워진다. 눈이 한 번 짚을 만큼만 비추고 걷는다.
 */
const WARN_HOLD_MS = 620;

/** 웨이브마다 적립되는 부적 장수. 쓰지 않으면 소멸하지 않고 그대로 쌓인다. */
const CHARGES_PER_WAVE = 3;

/**
 * 쌓아 둘 수 있는 최대 장수 = 10웨이브(한 봉인장)치 적립.
 * 이월 자체는 시간 압박을 없애려는 것이지, 후반에 수십 장을 몰아써서 경제를
 * 흔들라는 것이 아니다(engine-tuning.ts 「부적 모드 경제」의 상한 근거).
 */
const CHARGE_CAP = 30;

/**
 * 보상 연출(talisman-reward.ts VISIT_MS 2.7초)이 끝난 뒤 다음 장으로 넘어간다.
 * 종이가 먼저 넘어가면 자령·꾸러미가 도중에 잘려 "뭘 얻었는지" 다시 모르게
 * 되므로, 연출 총 길이보다 항상 뒤에 선다(트랙 C3).
 */
const NEXT_SHEET_DELAY_MS = 2_800;

/** 종이 넘김 — 절반 지점에서 새 글자를 앉힌다. 540절의 애니메이션 길이와 맞춘다. */
const PAGE_TURN_MS = 350;

/** 보상 가중 — 엽전 60% / 해당 한자 오행 문기 30% / 기본 소환 무료권 10%. */
const REWARD_GOLD_WEIGHT = 0.6;

const REWARD_ESSENCE_WEIGHT = 0.3;

const REWARD_GOLD_MIN = 6;

const REWARD_GOLD_MAX = 14;

let guideContext: CanvasRenderingContext2D | null = null;

let inkContext: CanvasRenderingContext2D | null = null;

let maskGrid: TalismanCellGrid | null = null;

/** 글자 마스크 RGBA 원본 — 채점(가는·굵은 격자)이 매번 다시 접는다. */
let maskData: Uint8ClampedArray | null = null;

let currentDefinition: HanziDefinition | null = null;

let sealed = false;

let drawing = false;

let lastPoint = { x: 0, y: 0 };

/*
 * 먹을 획 목록으로 들고 있는다.
 *
 * 캔버스 한 장이던 시절에는 지우는 것도 통째로밖에 못 했다 — 한 획을 삐끗하면
 * 처음부터 다시 써야 했다. 목록이 있으면 되돌리기도, 성공한 획을 정본으로
 * 갈아 끼우는 일도 같은 구조로 풀린다(ink-strokes.ts).
 */
const board = new InkBoard();

/** 판정에 떨어진 붓질을 붉게 비추는 중인가 — 비춘 뒤 스스로 걷는다. */
let warnTimer = 0;

/** 장수 적립 장부. 엔진 교체(재도전)면 처음부터 다시 센다. */
let chargeEngine: GameEngine | null = null;

/** 마지막으로 적립을 정산한 웨이브. 여기서 지금 웨이브까지의 차이만큼 준다. */
let chargeWave = 1;

/** 지금 남아 있는 장수. */
let charges = CHARGES_PER_WAVE;

/** 직전 적립분 — 머리글의 "+3 적립" 표시용(상한에 걸리면 실제 들어온 만큼). */
let waveCredit = CHARGES_PER_WAVE;

/**
 * 이번 웨이브에 실제로 받은 것의 누적. 연출은 몇 초면 지나가지만 "뭘 받았는지
 * 모르겠어"(사용자 실황)를 막으려면 놓친 뒤에도 확인할 자리가 있어야 한다.
 */
interface RecentRewardTally {
  gold: number;
  essence: Partial<Record<Wuxing, number>>;
  tokens: number;
}

function emptyTally(): RecentRewardTally {
  return { gold: 0, essence: {}, tokens: 0 };
}

let recentRewards: RecentRewardTally = emptyTally();

/** 남은 장수가 0이라 종이가 잠겼는가. 다음 웨이브 적립에 스스로 풀린다. */
let outOfCharges = false;

/** 다음 장 자동 전환·잠금 예약. [지우기]·[다시 뽑기] 가 취소한다. */
let advanceTimer = 0;

/**
 * 남은 장수 — 지금 웨이브까지의 적립을 정산하고 돌려준다.
 *
 * 웨이브 0(첫 준비 시간)은 웨이브 1의 몫으로 친다. 그래서 한 장도 쓰지 않고
 * 웨이브 3에 닿으면 3+3+3=9장이다. 탭을 여러 웨이브 동안 닫아 두었어도
 * 웨이브 차이만큼 한 번에 적립되므로 놓치는 장이 없다.
 */
function talismanCharges(): number {
  const state = ctx.engine.state;
  if (chargeEngine !== ctx.engine) {
    chargeEngine = ctx.engine;
    chargeWave = Math.max(1, state.wave);
    charges = CHARGES_PER_WAVE;
    waveCredit = CHARGES_PER_WAVE;
    recentRewards = emptyTally();
    return charges;
  }
  const wave = Math.max(1, state.wave);
  if (wave === chargeWave) return charges;
  if (wave < chargeWave) {
    // 웨이브가 되감긴 경우(같은 엔진의 상태 주입 등) — 장부만 지금에 맞춘다.
    chargeWave = wave;
    return charges;
  }
  const before = charges;
  charges = Math.min(CHARGE_CAP, charges + CHARGES_PER_WAVE * (wave - chargeWave));
  chargeWave = wave;
  waveCredit = charges - before;
  recentRewards = emptyTally();
  return charges;
}

/**
 * 이어하기를 위해 장부를 뜬다 — 남은 장수와 그 기준 웨이브.
 *
 * 장부는 엔진이 바뀌면 스스로 처음부터 세는데(재도전을 위한 규칙), 이어하기도
 * 새 엔진을 세우므로 그 규칙에 걸려 부적이 초기화됐다(사용자 제보).
 */
export function captureTalismanLedger(): { charges: number; chargeWave: number } {
  talismanCharges();
  return { charges, chargeWave };
}

/** 저장본에서 장부를 되살린다. 되살린 판의 엔진을 기준으로 다시 센다. */
export function restoreTalismanLedger(ledger: { charges: number; chargeWave: number }): void {
  chargeEngine = ctx.engine;
  charges = Math.max(0, Math.min(CHARGE_CAP, Math.floor(ledger.charges)));
  chargeWave = Math.max(1, Math.floor(ledger.chargeWave));
  waveCredit = 0;
  recentRewards = emptyTally();
  outOfCharges = charges <= 0;
}

function recentRewardText(): string {
  const parts: string[] = [];
  if (recentRewards.gold > 0) parts.push(`엽전 +${recentRewards.gold}`);
  for (const wuxing of WUXING_ORDER) {
    const amount = recentRewards.essence[wuxing] ?? 0;
    if (amount > 0) parts.push(`${wuxing} 문기 +${amount}`);
  }
  if (recentRewards.tokens > 0) parts.push(`무료권 +${recentRewards.tokens}`);
  return parts.join(" · ");
}

/**
 * 머리글 — 남은 장수가 주인공이다. "n / 3"(이번 웨이브 소진율)은 시간 압박을
 * 만들던 표기라 걷었다. 옆줄에 이번 웨이브 적립분을 함께 적어, 안 써도 계속
 * 쌓인다는 사실이 화면에 남게 한다.
 */
function syncRewardNote(): void {
  const left = talismanCharges();
  must<HTMLElement>("#talisman-charge-count").textContent = `남은 부적 ${left}장`;
  const credit = must<HTMLElement>("#talisman-charge-credit");
  // 다 써서 잠긴 종이 옆에 "이번 웨이브 +3 적립"이 남아 있으면 지금 세 장이
  // 있다는 말로 읽힌다(QA 실측). 0장일 때는 언제 다시 쓸 수 있는지를 적는다.
  credit.textContent = left >= CHARGE_CAP
    ? `상한 ${CHARGE_CAP}장`
    : left === 0
      ? `다음 웨이브에 ${CHARGES_PER_WAVE}장 적립`
      : waveCredit > 0 ? `이번 웨이브 +${waveCredit} 적립` : "이번 웨이브 적립 없음";
  credit.classList.toggle("is-capped", left >= CHARGE_CAP);
  const recent = must<HTMLElement>("#talisman-recent-reward");
  const text = recentRewardText();
  recent.textContent = text === "" ? "최근 보상 · 아직 없음" : `최근 보상 · ${text}`;
  recent.classList.toggle("is-empty", text === "");
}

/**
 * 장수 상태를 지금 웨이브에 맞춘다.
 * 웨이브가 넘어가면 talismanCharges 가 적립을 정산하므로, 다 써서 잠겨 있던
 * 종이는 그 순간 풀리고 새 장이 차오른다.
 */
function refreshCharges(): void {
  const left = talismanCharges();
  if (outOfCharges && left > 0) {
    outOfCharges = false;
    must<HTMLElement>("#talisman-paper").classList.remove("is-out-of-charges");
    const definition = pickDefinition();
    if (definition) presentDefinition(definition);
  }
  syncRewardNote();
}

/**
 * HUD 렌더 틱이 부른다 — 부적 탭이 열려 있는 동안에만 장수 상태를 맞춘다.
 * 웨이브 전환을 이 자리에서 잡아 새 종이를 자동으로 연다.
 */
/**
 * 획순 자료를 **따라 쓰기 판을 처음 열 때** 받는다.
 *
 * 부팅에서 받으면 부적을 한 번도 안 여는 사람까지 gzip 2.4MB 를 끌게 된다.
 * 기본값이 켜짐이 되면서 그 값이 모두에게 붙으므로, 자리를 여기로 옮겼다.
 * 두 번째부터는 `loadStrokeGlyphs` 가 받아 둔 것을 바로 돌려준다.
 */
export function preloadStrokeGuide(): void {
  if (!ctx.strokeOrderGuide) return;
  void loadStrokeGlyphs().then(() => refreshStrokeGuideSheet(false));
}

export function syncTalismanPanel(): void {
  if (ctx.activePanelTab !== "talisman") return;
  preloadStrokeGuide();
  if (!document.querySelector("#talisman-panel")) return;
  refreshCharges();
  // 표기 전환은 이 탭을 다시 그리지 않는다 — 읽기 줄만 따로 따라오게 한다.
  syncTalismanReading();
}

/** 현재 지역 로스터에서 다음 글자를 뽑는다(직전 글자는 피한다). */
function pickDefinition(): HanziDefinition | null {
  const catalog = ctx.engine.catalog;
  const pool = catalog.activePool.length > 0 ? catalog.activePool : [...catalog.definitions.values()];
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0] ?? null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = pool[Math.floor(Math.random() * pool.length)] ?? null;
    if (candidate && candidate.char !== currentDefinition?.char) return candidate;
  }
  return pool[0] ?? null;
}

function drawGlyph(context: CanvasRenderingContext2D, char: string, style: string): void {
  context.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
  context.save();
  context.font = GLYPH_FONT;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = style;
  context.fillText(char, GLYPH_CENTER_X, GLYPH_CENTER_Y);
  context.restore();
}

/**
 * 안내 캔버스 — 반투명 글자 한 장, 그 위에 (켰다면) 지금 그을 획.
 *
 * 획순 안내가 꺼져 있거나 그 글자에 자료가 없으면 덧그릴 것이 없어, 화면은
 * 여태와 완전히 같다.
 */
function paintGuide(char: string): void {
  if (!guideContext) return;
  guideContext.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
  // 안내가 서면 글자도 그 자료로 — 그래야 점선이 먹 위에 정확히 앉는다.
  if (!strokeGuide.paintGlyph(guideContext, "rgba(34, 26, 16, 0.2)")) {
    drawGlyph(guideContext, char, "rgba(34, 26, 16, 0.2)");
  }
  strokeGuide.paint(guideContext);
}

/** 획순 안내가 서 있는 동안의 상태 줄 — 몇 번째 획인지가 먼저다. */
function strokeStatus(): string {
  return `${strokeGuide.current + 1}번째 획 · 모두 ${strokeGuide.total}획 — 붉은 점선을 따라 그으세요`;
}

/**
 * 글자 마스크 준비 — 채점 원본(maskData)과 QA 따라쓰기용 격자(maskGrid).
 *
 * 획순 안내가 서 있으면 **그 자료의 글자**로 마스크를 만든다. 화면에 보이는
 * 글자와 채점하는 글자가 다르면, 보고 그린 사람이 퇴짜를 맞는다.
 */
function prepareMask(char: string): void {
  const offscreen = document.createElement("canvas");
  offscreen.width = PAPER_WIDTH;
  offscreen.height = PAPER_HEIGHT;
  const context = offscreen.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Talisman mask canvas 2D context is unavailable.");
  context.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
  if (!strokeGuide.paintGlyph(context, "#000")) drawGlyph(context, char, "#000");
  maskData = context.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT).data;
  maskGrid = rasterizeImageAlpha(maskData, PAPER_WIDTH, PAPER_HEIGHT, CELL_SIZE, 120);
}

/**
 * 먹을 목록에서 통째로 다시 칠한다.
 *
 * 획을 빼거나 정본으로 갈아 끼운 것이 이 한 번으로 화면에 반영된다. 붓을 뗄
 * 때만 부르므로 매 프레임 비용이 아니다 — 끌고 있는 붓은 점이 찍히는 대로
 * 이어 그린다.
 */
function repaintInk(warnLast = false): void {
  if (!inkContext) return;
  paintInk(inkContext, board, PAPER_WIDTH, PAPER_HEIGHT, {
    brush: BRUSH_WIDTH,
    style: INK_STYLE,
    warnStyle: WARN_INK_STYLE,
    warnLast,
    drawGlyphStroke: (context, index, style) => strokeGuide.paintStroke(context, index, style)
  });
}

function cancelWarn(): void {
  if (warnTimer === 0) return;
  window.clearTimeout(warnTimer);
  warnTimer = 0;
}

function syncUndoButton(): void {
  const undo = document.querySelector<HTMLButtonElement>("#talisman-undo");
  if (undo) undo.disabled = sealed || board.count === 0;
}

function clearInk(): void {
  if (!inkContext) return;
  cancelWarn();
  board.clear();
  inkContext.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
  drawing = false;
  syncUndoButton();
  // 먹을 지웠으면 안내도 첫 획으로 되감는다 — 남아 있으면 종이와 안내가 어긋난다.
  if (strokeGuide.available) {
    strokeGuide.reset();
    if (currentDefinition) paintGuide(currentDefinition.char);
  }
}

/**
 * 마지막 획을 무른다.
 *
 * 안내 모드에서는 안내도 한 획 뒤로 물린다 — 종이에서 사라진 획을 안내가
 * 「이미 그은 것」으로 세고 있으면 둘이 어긋난다.
 */
function undoStroke(): void {
  if (sealed || board.count === 0) return;
  cancelWarn();
  const removed = board.undo();
  if (removed?.kind === "glyph" && strokeGuide.available) strokeGuide.stepBack();
  repaintInk();
  syncUndoButton();
  if (currentDefinition) paintGuide(currentDefinition.char);
  refreshScore();
  if (strokeGuide.available && !strokeGuide.finished) setStatus(strokeStatus());
}

/**
 * 상태 줄. `pass` 는 완성(금빛), `hint` 는 제출 미달 안내(주의 색)다.
 * 안내는 리플로 후 클래스를 다시 얹어 연속 미달에도 매번 눈에 띈다.
 */
function setStatus(text: string, tone: "plain" | "pass" | "hint" = "plain"): void {
  const status = must<HTMLElement>("#talisman-status");
  status.textContent = text;
  status.classList.toggle("is-pass", tone === "pass");
  status.classList.remove("is-hint");
  if (tone !== "hint") return;
  void status.offsetWidth;
  status.classList.add("is-hint");
}

/** 획이 하나도 없으면 제출할 것이 없다. 이미 완성된 부적도 다시 낼 수 없다. */
function syncSubmitButton(hasInk: boolean): void {
  const submit = must<HTMLButtonElement>("#talisman-submit");
  submit.disabled = sealed || !hasInk;
  submit.title = sealed
    ? "이미 완성된 부적입니다 — [새 부적 쓰기] 로 다음 글자를 받으세요"
    : hasInk
      ? `획순은 자유 · 정확 ${Math.round(TALISMAN_THRESHOLDS.inside * 100)}% · 덮음 ${Math.round(TALISMAN_THRESHOLDS.coverage * 100)}%${requiredStrokeCount() === null ? "" : ` · ${requiredStrokeCount()}획 이상`} 이면 부적이 완성됩니다`
      : "먼저 부적지의 한자를 따라 써 보세요";
}

function hideSeal(): void {
  const seal = must<HTMLElement>("#talisman-seal");
  seal.hidden = true;
  seal.classList.remove("is-stamped");
}

/** 읽기 줄을 마지막으로 쓴 조건(글자 + 표기). 표기가 바뀌면 다시 쓴다. */
let talismanReadingKey = "";

/**
 * 부적지 위 글자의 읽기 한 줄.
 *
 * [2차 감사 · 성어 HUD 와 같은 갈래] 이 줄은 presentDefinition 안에서만 쓰였다.
 * 그 함수는 글자를 새로 뽑을 때만 부르므로, 표기를 바꿔도(S13) 눈앞의 글자는
 * 옛 표기로 남아 있었다 — 글자의 출신 지역이 아니라 사용자가 고른 표기로
 * 읽는 것이 규칙인데 그 규칙이 전환 순간에만 깨졌다.
 * 다시 뽑기로 되돌리면 먹선이 지워지므로, 되그리지 않고 읽기 줄만 갈아 끼운다.
 */
function syncTalismanReading(): void {
  const definition = currentDefinition;
  if (!definition) return;
  const notation = ctx.engine.state.notation;
  const key = `${definition.char}|${notation}`;
  if (key === talismanReadingKey) return;
  talismanReadingKey = key;
  const info = learningInfoForNotation(notation, definition.char);
  const infoMark = notationBadgeText(info);
  must<HTMLElement>("#talisman-reading").textContent = `${info.readingLabel} · ${info.reading}${infoMark ? ` (${infoMark})` : ""}`;
}

/** 새 글자를 부적지에 앉힌다. 먹선·인장·상태를 함께 되돌린다. */
function presentDefinition(definition: HanziDefinition): void {
  currentDefinition = definition;
  sealed = false;
  // 안내를 먼저 세운 뒤 마스크를 만든다 — 마스크가 안내의 글자를 따라야 한다.
  strokeGuide.begin(ctx.strokeOrderGuide ? definition.char : "", GLYPH_BOX);
  prepareMask(definition.char);
  paintGuide(definition.char);
  clearInk();
  must<HTMLCanvasElement>("#talisman-ink").classList.remove("is-sealed");
  hideSeal();
  syncTalismanReading();
  setStatus(strokeGuide.available ? strokeStatus() : "반투명 글자를 따라 쓰고 [부적 완성]");
  must<HTMLButtonElement>("#talisman-redraw").textContent = "다시 뽑기";
  syncSubmitButton(false);
  setControlsEnabled(true);
  syncRewardNote();
}

/**
 * 획순 안내 설정이 바뀌었거나 자료가 늦게 도착했을 때 지금 종이를 다시 편다.
 *
 * 여태는 아무것도 안 했다 — 판 도중에 켜면 토스트만 뜨고 종이는 그대로였고,
 * 끄면 해서체 글자와 붉은 점선이 그대로 남았다. 자료가 8.5MB 라 느린 회선에서는
 * 첫 종이가 안내 없이 뜨는 것이 오히려 보통이었다.
 *
 * `force` 는 사람이 설정을 직접 만졌을 때다. 글자 모양이 바뀌므로 쓰던 먹은
 * 버린다 — 종이가 바뀌었는데 옛 먹만 남는 편이 더 이상하다. 자료가 늦게 온
 * 경우에는 force 없이 부르므로, 이미 쓰기 시작한 종이는 건드리지 않는다.
 */
export function refreshStrokeGuideSheet(force: boolean): void {
  if (!currentDefinition || sealed) return;
  const wanted = ctx.strokeOrderGuide && strokeGlyphFor(currentDefinition.char) !== null;
  if (wanted === strokeGuide.available) return;
  if (!force && !board.isEmpty) return;
  presentDefinition(currentDefinition);
}

/** 탭을 열 때 글자를 준비한다 — 지역·런이 바뀌었으면 로스터에 맞춰 다시 뽑는다. */
function ensureDefinition(): void {
  if (currentDefinition && currentDefinition.region === ctx.engine.state.region) return;
  const definition = pickDefinition();
  if (definition) presentDefinition(definition);
}

function runActive(): boolean {
  const phase = ctx.engine.state.phase;
  return phase === "prep" || phase === "combat";
}

/**
 * 가중 랜덤 보상. 엔진 상태 직접 변형은 디버그 QA 핸들과 같은 UI 층 선례다.
 *
 * 지급이 끝나면 그 글자의 자령이 부적지 위로 내려와 받은 것을 자원칸에 놓고
 * 떠난다(talisman-reward.ts). 자령은 방문객일 뿐이라 엔진에는 남지 않는다.
 */
function grantReward(): void {
  if (!runActive()) {
    showToast("부적 완성! 자령이 깃들 봉인구가 늘었습니다", false, "panel");
    return;
  }
  if (talismanCharges() <= 0) {
    showToast(`부적 완성! 남은 장수가 없습니다 — 다음 웨이브에 ${CHARGES_PER_WAVE}장이 더 옵니다`, false, "panel");
    return;
  }
  if (!currentDefinition) return;
  charges -= 1;
  const state = ctx.engine.state;
  const goldBefore = state.gold;
  const { char, wuxing } = currentDefinition;
  const grants: TalismanRewardGrant[] = [];
  const roll = Math.random();
  if (roll < REWARD_GOLD_WEIGHT) {
    const amount = REWARD_GOLD_MIN + Math.floor(Math.random() * (REWARD_GOLD_MAX - REWARD_GOLD_MIN + 1));
    state.gold += amount;
    recentRewards.gold += amount;
    grants.push({ kind: "gold", amount, glyph: "錢", label: `엽전 +${amount}` });
  } else if (roll < REWARD_GOLD_WEIGHT + REWARD_ESSENCE_WEIGHT) {
    state.elementEssence[wuxing] += 1;
    state.elementEssenceGenerated[wuxing] += 1;
    recentRewards.essence[wuxing] = (recentRewards.essence[wuxing] ?? 0) + 1;
    grants.push({ kind: "essence", amount: 1, wuxing, glyph: wuxing, label: `${wuxing} 문기 +1` });
  } else {
    ctx.talismanFreeSummonTokens += 1;
    recentRewards.tokens += 1;
    grants.push({ kind: "token", amount: 1, glyph: "券", label: "무료 소환권 +1" });
  }
  const summary = grants.map((grant) => grant.label).join(" · ");
  // 말은 한 번만 뽑아 말풍선과 토스트가 같은 말을 하게 한다. 강림 연출은
  // 통째로 aria-hidden 이라, 이 말이 소리로 닿는 길은 토스트뿐이다.
  const line = pickTalismanVisitLine(grants[0]?.kind ?? "gold");
  /*
   * 부적을 쓰는 동안 눈은 오른쪽 패널의 종이에 있다. 무대 아래 가운데에
   * 띄우면 450px 떨어져 있어 나온 줄도 모른다 — 패널에서 알린다.
   */
  showToast(`${char} 자령이 응답했습니다 — "${line}" · ${summary}`, false, "panel");
  playTalismanRewardVisit(char, wuxing, grants, goldBefore, line);
}

/** 완성 연출 — 먹선이 또렷해지고 주홍 인장이 찍힌다(calm-screen 은 맥동 없이). */
function completeTalisman(score: TalismanScore): void {
  sealed = true;
  drawing = false;
  const ink = must<HTMLCanvasElement>("#talisman-ink");
  // 그린 알파를 자기 자신 위에 한 번 더 겹쳐 먹을 진하게 굳힌다.
  inkContext?.drawImage(ink, 0, 0);
  ink.classList.add("is-sealed");
  const seal = must<HTMLElement>("#talisman-seal");
  seal.hidden = false;
  if (!ctx.calmScreen) {
    // 리플로 후 클래스를 얹어야 도장 애니메이션이 확실히 다시 돈다.
    void seal.offsetWidth;
    seal.classList.add("is-stamped");
  }
  // 인장이 쾅 찍히는 순간의 종이 번쩍·파문·아주 약한 흔들림 + 묵직한 인장음.
  playTalismanImpact();
  sound.playTalismanSeal();
  setStatus(`부적 완성! 정확 ${Math.round(score.insideRatio * 100)}% · 덮음 ${Math.round(score.coverageRatio * 100)}%`, "pass");
  must<HTMLButtonElement>("#talisman-redraw").textContent = "새 부적 쓰기";
  syncSubmitButton(false);
  setControlsEnabled(false);
  grantReward();
  syncRewardNote();
  // 보상 연출이 끝나는 대로 다음 장이 차오른다. 남은 장수가 0일 때만 잠근다.
  cancelAdvance();
  advanceTimer = window.setTimeout(() => {
    advanceTimer = 0;
    if (runActive() && talismanCharges() <= 0) lockOutOfCharges();
    else turnToNextSheet();
  }, NEXT_SHEET_DELAY_MS);
}

/**
 * 방금 뗀 한 획을 안내와 견줘 다음 획으로 넘긴다(획순 안내를 켠 경우).
 *
 * 틀렸다고 먹선을 지우지는 않는다 — 지우면 무엇을 그렸는지가 사라져 왜 안
 * 넘어갔는지 알 길이 없다. 안내만 제자리에 두고 다시 그을 기회를 준다.
 *
 * 완성 판정에는 손대지 않는다. 획을 다 안 그어도 마스크 채점이 통과하면
 * [부적 완성]은 눌린다 — 안내는 안내지 관문이 아니다.
 */
/**
 * 비추던 실패 붓질을 걷는다.
 *
 * 걷은 뒤에는 종이에 성공한 획만 남는다 — 안내 모드의 화선지가 늘 깨끗한 것은
 * 이 걷기와 아래 「정본으로 갈아 끼우기」가 짝을 이루기 때문이다.
 */
function dropWarnedStroke(): void {
  cancelWarn();
  board.undo();
  repaintInk();
  syncUndoButton();
  refreshScore();
  if (strokeGuide.available && !strokeGuide.finished) setStatus(strokeStatus());
}

function advanceStrokeGuide(): void {
  if (!strokeGuide.available || sealed) return;
  const result = strokeGuide.penUp();
  if (!currentDefinition) return;
  paintGuide(currentDefinition.char);
  if (!result) return;
  if (!result.advanced) {
    /*
     * 떨어진 붓질은 붉게 비췄다가 스스로 걷는다.
     *
     * 남겨 두면 실패가 쌓여 종이가 지저분해지고, 지우려면 전체 지우기밖에
     * 없었다. 곧바로 지우면 왜 안 넘어갔는지 알 수 없으니 잠깐 비춘다.
     */
    repaintInk(true);
    cancelWarn();
    warnTimer = window.setTimeout(() => {
      warnTimer = 0;
      if (!sealed) dropWarnedStroke();
    }, WARN_HOLD_MS);
    setStatus(`${strokeGuide.current + 1}번째 획을 붉은 점선을 따라 끝까지 그으세요`, "hint");
    return;
  }
  /*
   * 제대로 그은 획은 **정본 획으로 갈아 끼운다.**
   *
   * 손으로 그은 삐뚤한 자국 대신 자형 그대로의 획이 앉으므로, 종이가 붓글씨처럼
   * 쌓이고 더럽혀지지 않는다("깔끔하게 할까 생각중이야" — 사용자). 채점은 이
   * 먹을 그대로 재므로, 안내 모드의 완성 판정은 「몇 획을 순서대로 맞췄나」가
   * 된다 — 획별 판정이 뭉뚱그린 채점보다 엄격하니 관문이 헐거워지지 않는다.
   */
  // penUp 이 이미 한 칸 넘겼으므로 방금 끝낸 획은 바로 앞 번호다.
  board.replaceLastWithGlyph(strokeGuide.current - 1);
  repaintInk();
  syncUndoButton();
  refreshScore();
  if (result.done) {
    setStatus(`${strokeGuide.total}획을 모두 그었습니다 — [부적 완성]`, "pass");
    return;
  }
  setStatus(result.reversed
    ? `방향이 거꾸로였습니다 — 다음은 ${strokeGuide.current + 1}번째 획`
    : strokeStatus(), result.reversed ? "hint" : "plain");
}

/**
 * 지금 먹선을 채점해 상태 줄과 [부적 완성] 활성 여부를 맞춘다.
 * 판정(완성 처리)은 하지 않는다 — 그것은 제출 버튼만의 권한이다.
 */
function refreshScore(): TalismanScore | null {
  if (!inkContext || !maskData) return null;
  const data = inkContext.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT).data;
  const score = scoreTalismanDrawing(maskData, data, PAPER_WIDTH, PAPER_HEIGHT);
  if (!sealed) {
    syncSubmitButton(score.inkPixels > 0);
    if (score.inkPixels === 0) {
      setStatus(strokeGuide.available && !strokeGuide.finished
        ? strokeStatus()
        : "반투명 글자를 따라 쓰고 [부적 완성]");
    }
    else setStatus(`정확 ${Math.round(score.insideRatio * 100)}% · 덮음 ${Math.round(score.coverageRatio * 100)}%`);
  }
  return score;
}

/* ── 장수 흐름 ───────────────────────────────────────────────── */

function cancelAdvance(): void {
  if (advanceTimer === 0) return;
  window.clearTimeout(advanceTimer);
  advanceTimer = 0;
}

/** 완성 직후에는 조작을 잠가 둔다 — 곧 다음 장이 오거나 장수가 바닥난다. */
function setControlsEnabled(enabled: boolean): void {
  must<HTMLButtonElement>("#talisman-clear").disabled = !enabled;
  syncUndoButton();
  must<HTMLButtonElement>("#talisman-redraw").disabled = !enabled;
}

/** 종이가 넘어가고 다음 글자가 차오른다(차분한 화면이면 넘김 없이 교체). */
function turnToNextSheet(): void {
  const definition = pickDefinition();
  if (!definition) return;
  if (calmBattlefield()) {
    presentDefinition(definition);
    return;
  }
  const paper = must<HTMLElement>("#talisman-paper");
  paper.classList.remove("is-turning");
  // 리플로 후 다시 얹어야 연속 전환에도 넘김이 매번 돈다.
  void paper.offsetWidth;
  paper.classList.add("is-turning");
  // 종이가 가장 얇게 서는 절반 지점에서 글자를 갈아 끼운다.
  window.setTimeout(() => presentDefinition(definition), PAGE_TURN_MS / 2);
  window.setTimeout(() => paper.classList.remove("is-turning"), PAGE_TURN_MS + 40);
}

/** 남은 장수 0 — 이때만 종이가 잠기고 다음 웨이브 적립을 기다린다. */
function lockOutOfCharges(): void {
  outOfCharges = true;
  setControlsEnabled(false);
  syncSubmitButton(false);
  must<HTMLElement>("#talisman-paper").classList.add("is-out-of-charges");
  setStatus(`부적을 다 썼습니다 · 다음 웨이브에 ${CHARGES_PER_WAVE}장이 더 옵니다`, "pass");
}

/** 미달 안내는 모자란 축만 짚는다. 벌은 없고 먹선도 지우지 않는다. */
function shortfallHint(score: TalismanScore): string {
  const coverage = Math.round(TALISMAN_THRESHOLDS.coverage * 100);
  const inside = Math.round(TALISMAN_THRESHOLDS.inside * 100);
  if (score.coverageRatio < TALISMAN_THRESHOLDS.coverage) return `조금 더 채워 보세요 — 덮음 ${coverage}% 필요`;
  return `글자 안쪽으로 더 붙여 보세요 — 정확 ${inside}% 필요`;
}

/**
 * [부적 완성] — 사람이 "다 썼다"고 선언하는 지점.
 * 통과면 완성 연출·보상, 미달이면 안내만 남기고 그린 것을 그대로 둔다.
 */
function submitTalisman(): void {
  if (sealed) return;
  const score = refreshScore();
  if (!score || score.inkPixels === 0) return;
  const needed = requiredStrokeCount();
  /*
   * 종이에 **남아 있는** 획을 센다.
   *
   * 예전에는 붓을 댄 횟수를 따로 세었는데, 되돌리기와 실패 걷기가 생기며 그
   * 수가 종이와 어긋났다 — 다섯 번 실패하고 두 획만 남겨도 일곱 획으로 셌다.
   * 목록 길이가 곧 종이 위의 획이라 어긋날 여지가 없다.
   */
  const strokesOnPaper = board.count;
  if (needed !== null && strokesOnPaper < needed) {
    setStatus(`획을 나눠 써 보세요 — ${needed}획 이상 필요 (지금 ${strokesOnPaper}획)`, "hint");
    sound.playActionOutcome(false);
    return;
  }
  if (!score.pass) {
    setStatus(shortfallHint(score), "hint");
    sound.playActionOutcome(false);
    return;
  }
  completeTalisman(score);
}

/**
 * 이 글자에 요구하는 최소 획 수 — 실제 획 수의 절반(올림), 최소 2획.
 *
 * 절반인 이유: 따라 쓰는 사람도 붓을 안 떼고 두 획을 잇는 일이 흔하다. 반만
 * 나눠 그어도 통과시키되, 가로줄 서너 개짜리 낙서(17획 글자에 3~5획)는 걸러진다.
 * 획 수를 모르는 글자(자료 밖)는 이 관문을 세우지 않는다 — 없는 근거로 막지 않는다.
 */
function requiredStrokeCount(): number | null {
  const char = currentDefinition?.char;
  if (char === undefined) return null;
  const strokes = casualStrokeCount(char);
  if (strokes === null || strokes < 2) return null;
  return Math.max(2, Math.ceil(strokes / 2));
}

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (PAPER_WIDTH / Math.max(1, rect.width)),
    y: (event.clientY - rect.top) * (PAPER_HEIGHT / Math.max(1, rect.height))
  };
}


function wireDrawing(ink: HTMLCanvasElement): void {
  ink.addEventListener("pointerdown", (event) => {
    if (sealed || event.button > 0) return;
    drawing = true;
    // 합성 이벤트(QA 자동 따라쓰기)는 활성 포인터가 없어 캡처가 거부될 수 있다.
    try {
      ink.setPointerCapture(event.pointerId);
    } catch {
      // 캡처 없이도 canvas 위 move/up 만으로 그리기는 성립한다.
    }
    lastPoint = canvasPoint(ink, event);
    // 비추던 실패 붓질이 있으면 여기서 걷는다 — 새 붓질과 겹쳐 보이지 않게.
    if (warnTimer !== 0) dropWarnedStroke();
    board.begin(lastPoint);
    strokeGuide.penDown(lastPoint);
    repaintInk();
    event.preventDefault();
  });
  ink.addEventListener("pointermove", (event) => {
    if (!drawing || sealed) return;
    const point = canvasPoint(ink, event);
    board.extend(point);
    strokeGuide.penMove(point);
    /*
     * 끌면서도 목록에서 다시 칠한다.
     *
     * 예전에는 직전 점에서 새 점까지만 이어 그렸다. 그러면 붓을 뗄 때 하는
     * 전체 다시 칠하기와 래스터가 미세하게 어긋나고(이음매마다 알파 0.88이
     * 겹쳐 조금 진해진다), 뗄 때 획이 살짝 옅어지는 「정착」이 보였다. 같은
     * 길로 그리면 그 어긋남이 사라진다 — 화선지가 196×260 이라 매 프레임
     * 다시 칠해도 싸다.
     */
    repaintInk();
    lastPoint = point;
  });
  const finish = (): void => {
    if (!drawing) return;
    drawing = false;
    board.commit();
    syncUndoButton();
    // 획을 뗄 때 갱신되는 것은 상태 줄과 제출 활성뿐 — 완성 판정은 하지 않는다.
    refreshScore();
    // 안내가 마지막에 말한다. 먼저 부르면 채점 문구가 안내를 덮어쓴다.
    advanceStrokeGuide();
  };
  ink.addEventListener("pointerup", finish);
  ink.addEventListener("pointercancel", finish);
}

/* ── 탭 노출(설정 게이트) ─────────────────────────────────────── */

function talismanTabButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>("#talisman-tab");
}

/**
 * 켜짐이면 탭바 끝에 「부적」 탭을 세우고, 꺼짐이면 DOM 에서 제거한다.
 * (hidden 이 아니라 제거인 이유: 기존 e2e 가 `.panel-tabs > button` 을 9개로
 * 세므로, 기본 꺼짐 상태의 DOM 수를 바꾸지 않는다.)
 */
function syncTabPresence(): void {
  const existing = talismanTabButton();
  if (!ctx.talismanMode) {
    if (existing) {
      existing.remove();
      if (ctx.activePanelTab === "talisman") setPanelTab("shop");
    }
    return;
  }
  if (existing) return;
  const button = document.createElement("button");
  button.id = "talisman-tab";
  button.type = "button";
  button.dataset.panelTab = "talisman";
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", "false");
  button.textContent = "부적";
  button.title = "부적 만들기 — 한자를 따라 써서 부적을 완성합니다";
  button.addEventListener("click", () => {
    setPanelTab("talisman");
    ensureDefinition();
    // 같은 글자로 돌아온 경우에도 제출 활성·상태 줄을 지금 먹선에 맞춘다.
    if (!outOfCharges) refreshScore();
    // 탭을 닫아 둔 사이 지나간 웨이브의 적립이 여기서 한꺼번에 들어온다.
    refreshCharges();
  });
  must<HTMLElement>(".panel-tabs").append(button);
}

function syncModeToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>("#talisman-mode-toggle");
  if (!toggle) return;
  toggle.classList.toggle("is-on", ctx.talismanMode);
  toggle.setAttribute("aria-checked", String(ctx.talismanMode));
  const label = toggle.querySelector<HTMLElement>("i em");
  if (label) label.textContent = ctx.talismanMode ? "ON" : "OFF";
}

export function setTalismanMode(enabled: boolean): void {
  ctx.talismanMode = enabled;
  try {
    window.localStorage.setItem(TALISMAN_MODE_STORAGE_KEY, String(enabled));
  } catch {
    // 사생활 보호 모드 등에서 저장이 막혀도 이번 세션 선택은 살린다.
  }
  syncModeToggle();
  syncTabPresence();
  /*
   * 적 체력 +5%는 런이 시작될 때의 설정으로 굳는다(engine 생성 인자). 그래서
   * 판 도중에 끄면 보상만 사라지고 대가는 그 판 끝까지 남는데, 예전 문구는
   * 탭이 접힌다는 말만 했다(QA 실측). 굳어 있는 판에서는 그 사실을 말한다.
   */
  const runFrozenPenalty = ctx.engine.talismanMode
    && (ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat");
  showToast(enabled
    ? "부적 만들기 ON · 패널에 「부적」 탭이 열립니다"
    : runFrozenPenalty
      ? "부적 만들기 OFF · 「부적」 탭을 접습니다 — 이 판의 적 +5%는 그대로 남고, 다음 판부터 사라집니다"
      : "부적 만들기 OFF · 「부적」 탭을 접습니다");
}

/* ── 기본 소환 무료권 ─────────────────────────────────────────── */

/**
 * 무료권 소환 래퍼 — 상점 기본 소환 카드가 부른다(코어 무수정).
 * 소환가만큼 엽전을 먼저 얹고 즉시 소환한다. 성공(소환 수 증가)이면 권을
 * 소비하고, 실패면 얹은 엽전을 물려 권을 보존한다.
 */
export function summonWithTalismanToken(): void {
  if (ctx.talismanFreeSummonTokens <= 0) {
    summonAndFocus(1, "balanced");
    return;
  }
  const state = ctx.engine.state;
  const cost = summonCost(state.summonCount);
  const summonsBefore = state.summonCount;
  state.gold += cost;
  summonAndFocus(1, "balanced");
  if (ctx.engine.state.summonCount > summonsBefore) ctx.talismanFreeSummonTokens -= 1;
  else state.gold -= cost;
}

/* ── 부팅 배선 ────────────────────────────────────────────────── */

const PANEL_MARKUP = `
  <header class="workbench-heading">
    <div><span>따라 쓰는 봉인구</span><strong>부적 만들기</strong></div>
    <div class="talisman-reward-column">
      <div id="talisman-charges" class="talisman-charges" aria-label="남은 부적 장수">
        <b id="talisman-charge-count" data-testid="talisman-charge-count">남은 부적 ${CHARGES_PER_WAVE}장</b>
        <em id="talisman-charge-credit">이번 웨이브 +${CHARGES_PER_WAVE} 적립</em>
      </div>
      <p id="talisman-recent-reward" class="talisman-recent-reward is-empty">최근 보상 · 아직 없음</p>
    </div>
  </header>
  <div id="talisman-paper" class="talisman-paper">
    <p id="talisman-reading" class="talisman-reading">글자를 준비하는 중</p>
    <canvas id="talisman-guide" width="${PAPER_WIDTH}" height="${PAPER_HEIGHT}" aria-hidden="true"></canvas>
    <canvas id="talisman-ink" width="${PAPER_WIDTH}" height="${PAPER_HEIGHT}" aria-label="부적 따라쓰기 화선지"></canvas>
    <div id="talisman-seal" class="talisman-seal" hidden aria-hidden="true"><i>封</i></div>
  </div>
  <div class="talisman-footer">
    <!--
      획순 안내를 켜면 이 줄이 「지금 몇 번째 획인가」를 말하는 주된 통로가
      된다. 화면을 못 보는 사람에게도 그 말이 가야 한다.
    -->
    <p id="talisman-status" class="talisman-status" role="status" aria-live="polite">반투명 글자를 따라 쓰고 [부적 완성]</p>
    <div class="talisman-actions">
      <button id="talisman-undo" class="small-button" type="button" data-testid="talisman-undo" disabled>되돌리기</button>
      <button id="talisman-clear" class="small-button" type="button" data-testid="talisman-clear">지우기</button>
      <button id="talisman-redraw" class="small-button" type="button" data-testid="talisman-redraw">다시 뽑기</button>
      <button id="talisman-submit" class="small-button talisman-submit" type="button" data-testid="talisman-submit" disabled>부적 완성</button>
    </div>
    <p id="talisman-economy-note" class="talisman-economy-note">부적 모드에서는 적이 ${Math.round((TALISMAN_MODE_ENEMY_HP_SCALE - 1) * 100)}% 강해집니다 — 그 대신 부적 보상을 얻습니다 · 설정에서 학습부적을 켜고 끌 수 있습니다</p>
  </div>`;

function mountTalismanPanel(): void {
  if (document.querySelector("#talisman-panel")) return;
  const panel = document.createElement("section");
  panel.id = "talisman-panel";
  panel.className = "talisman-workbench panel-view";
  panel.dataset.panelView = "talisman";
  panel.setAttribute("aria-label", "부적 만들기");
  panel.innerHTML = PANEL_MARKUP;
  must<HTMLElement>(".context-deck").append(panel);
  const guide = must<HTMLCanvasElement>("#talisman-guide");
  const ink = must<HTMLCanvasElement>("#talisman-ink");
  guideContext = guide.getContext("2d");
  inkContext = ink.getContext("2d", { willReadFrequently: true });
  must<HTMLElement>("#talisman-status").title =
    `획순은 자유 · 정확 ${Math.round(TALISMAN_THRESHOLDS.inside * 100)}% · 덮음 ${Math.round(TALISMAN_THRESHOLDS.coverage * 100)}% 이상이면 부적이 완성됩니다`;
  wireDrawing(ink);
  must<HTMLButtonElement>("#talisman-undo").addEventListener("click", () => {
    sound.unlock();
    undoStroke();
  });
  must<HTMLButtonElement>("#talisman-clear").addEventListener("click", () => {
    sound.unlock();
    cancelAdvance();
    if (sealed && currentDefinition) {
      // 인장까지 찍힌 부적을 지우면 같은 글자를 처음부터 다시 쓴다.
      presentDefinition(currentDefinition);
      return;
    }
    clearInk();
    setStatus("반투명 글자를 따라 쓰고 [부적 완성]");
    syncSubmitButton(false);
  });
  must<HTMLButtonElement>("#talisman-redraw").addEventListener("click", () => {
    sound.unlock();
    cancelAdvance();
    const definition = pickDefinition();
    if (definition) presentDefinition(definition);
  });
  must<HTMLButtonElement>("#talisman-submit").addEventListener("click", () => {
    sound.unlock();
    submitTalisman();
  });
  syncSubmitButton(false);
}

/**
 * QA 자동 따라쓰기(개발 전용) — 마스크 칸의 가로 이음선을 따라 포인터
 * 이벤트를 합성해, 실제 그리기 경로 그대로 임계 통과선까지 그려 준다.
 *
 * 트랙 C2: 그리기까지만 한다. 제출은 사람의 몫이므로 e2e 도 이어서
 * `__HANJA_TALISMAN_QA__.submit()` 을 부르거나 실제 버튼을 눌러야 한다.
 */
function autoTraceTalisman(): void {
  const ink = document.querySelector<HTMLCanvasElement>("#talisman-ink");
  if (!ink || !maskGrid || sealed) return;
  const rect = ink.getBoundingClientRect();
  const toClient = (x: number, y: number): { clientX: number; clientY: number } => ({
    clientX: rect.left + x * (rect.width / PAPER_WIDTH),
    clientY: rect.top + y * (rect.height / PAPER_HEIGHT)
  });
  const dispatch = (type: string, x: number, y: number): void => {
    ink.dispatchEvent(new PointerEvent(type, { ...toClient(x, y), pointerId: 7, bubbles: true, cancelable: true }));
  };
  const { columns, rows, counts } = maskGrid;
  for (let row = 0; row < rows; row += 1) {
    const y = (row + 0.5) * CELL_SIZE;
    let runStart = -1;
    for (let column = 0; column <= columns; column += 1) {
      const filled = column < columns && (counts[row * columns + column] ?? 0) > 0;
      if (filled && runStart < 0) runStart = column;
      if (!filled && runStart >= 0) {
        const startX = (runStart + 0.5) * CELL_SIZE;
        const endX = (column - 0.5) * CELL_SIZE;
        dispatch("pointerdown", startX, y);
        dispatch("pointermove", (startX + endX) / 2, y);
        dispatch("pointermove", endX, y);
        dispatch("pointerup", endX, y);
        runStart = -1;
      }
    }
  }
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireTalisman1(): void {
  mountTalismanPanel();
  const toggle = document.querySelector<HTMLButtonElement>("#talisman-mode-toggle");
  toggle?.addEventListener("click", () => {
    sound.unlock();
    setTalismanMode(!ctx.talismanMode);
    sound.playUiConfirm();
  });
  syncModeToggle();
  syncTabPresence();
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __HANJA_TALISMAN_QA__: {
        autoTrace: autoTraceTalisman,
        /** 제출은 따로다 — 자동 따라쓰기가 완성까지 하지 않는다는 규칙의 반영. */
        submit: submitTalisman,
        currentChar: () => currentDefinition?.char ?? null,
        isSealed: () => sealed,
        /** 특정 글자를 강제 제시 — 최밀 글자 채점 검증·스크린샷 재현용. */
        present: (char: string) => {
          const definition = ctx.engine.catalog.definitions.get(char);
          if (definition) presentDefinition(definition);
          return definition !== undefined;
        },
        /* ── 획순 안내(선택 항목) ── */
        strokeGuide: () => ({
          available: strokeGuide.available,
          current: strokeGuide.current,
          total: strokeGuide.total,
          finished: strokeGuide.finished
        }),
        /**
         * 지금 획을 그 중앙선 그대로 한 번 긋는다.
         *
         * 사람이 손으로 긋는 것과 같은 포인터 이벤트를 합성한다 — 판정 경로를
         * 우회하면 "안내가 실제로 넘어가는가"를 못 지킨다.
         */
        traceStroke: () => {
          const ink = document.querySelector<HTMLCanvasElement>("#talisman-ink");
          const path = strokeGuide.currentPath();
          if (!ink || path.length === 0 || sealed) return false;
          const rect = ink.getBoundingClientRect();
          const send = (type: string, point: { x: number; y: number }): void => {
            ink.dispatchEvent(new PointerEvent(type, {
              clientX: rect.left + point.x * (rect.width / PAPER_WIDTH),
              clientY: rect.top + point.y * (rect.height / PAPER_HEIGHT),
              pointerId: 9,
              bubbles: true,
              cancelable: true
            }));
          };
          // 중앙선 점 사이를 잘게 나눠 실제 붓질처럼 촘촘한 점렬을 만든다.
          send("pointerdown", path[0]!);
          for (let index = 1; index < path.length; index += 1) {
            const from = path[index - 1]!;
            const to = path[index]!;
            for (let step = 1; step <= 6; step += 1) {
              const t = step / 6;
              send("pointermove", { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
            }
          }
          send("pointerup", path[path.length - 1]!);
          return true;
        }
      }
    });
  }
}
