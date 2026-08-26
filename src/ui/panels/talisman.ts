/*
 * 부적 만들기 패널 — 트랙 C (gripe #5 + 세계관 보강).
 *
 * 부적(符籍)은 이 세계의 봉인구다(GAME_DESIGN.md 「세계관 — 부적과 자령」).
 * 부적지 위에 현재 지역 로스터의 랜덤 한자를 반투명 큰 글씨로 깔고, 마우스로
 * 따라 쓰면(먹선) 채점 v1(획순 비강제 커버리지 — panels/talisman-score.ts)이
 * 통과 여부를 정한다. 성공하면 먹선이 또렷해지고 주홍 인장이 찍히며, 웨이브당
 * 3회까지 가중 랜덤 보상(엽전 60% / 문기 30% / 기본 소환 무료권 10%)을 준다.
 *
 * 트랙 C2 ①: 판정 시점은 사람이 정한다.
 *   예전에는 획을 뗄 때마다 채점해 임계를 넘는 순간 제멋대로 완성 처리했다 —
 *   "다 쓰지도 않았는데 끝나 버린다"(사용자 실황). 이제 획마다 갱신되는 것은
 *   상태 줄(정확·덮음)뿐이고, [부적 봉인] 을 눌러야 판정한다. 미달이면 벌 없이
 *   안내만 남기고 먹선을 그대로 둬 이어 그릴 수 있다.
 * 트랙 C2 ②: 통과하면 그 글자의 자령이 내려와 보상을 놓고 간다
 *   (talisman-reward.ts). 엔진 상태에는 남지 않는 방문객이다.
 * 트랙 C2 ③: 받은 보상의 엽전 환산액은 engine.talismanDebt 에 적히고 웨이브
 *   정산에서 되갚는다 — 부적을 쓰지 않으면 빚이 0 이라 상환도 없다.
 *
 * 설정의 「학습 모드 · 부적 만들기」 토글(기본 켜짐, localStorage)이 「부적」
 * 탭을 세운다. 강제 없음 — 언제든 끌 수 있고, 켜 둔 채 안 써도 손해가 없다.
 *
 * 코어 무수정 원칙: 보상은 engine.state 직접 변형(엽전·문기 — 디버그 QA 핸들
 * 선례)과 ctx 의 무료권 수로만 지급한다. 무료권 사용은 소환 비용만큼 엽전을
 * state 에 먼저 얹고 즉시 소환하는 래퍼다(실패 시 얹은 엽전을 물려 권 보존).
 */
import { TALISMAN_ESSENCE_GOLD_VALUE } from "../../core/engine-tuning";
import { type GameEngine } from "../../core/game";
import { summonCost, WUXING_ORDER } from "../../core/hanzi";
import { learningInfo } from "../../core/learning";
import { type HanziDefinition, type Wuxing } from "../../core/types";
import { ctx, must, TALISMAN_MODE_STORAGE_KEY, sound } from "../app-context";
import { summonAndFocus } from "../battle/camera";
import { setPanelTab, showToast } from "../hud";
import { playTalismanImpact, playTalismanRewardVisit, type TalismanRewardGrant } from "../talisman-reward";
import { rasterizeImageAlpha, scoreTalismanDrawing, TALISMAN_THRESHOLDS, type TalismanCellGrid, type TalismanScore } from "./talisman-score";

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

/** 먹 붓 굵기. */
const BRUSH_WIDTH = 11;

const INK_STYLE = "rgba(26, 19, 11, 0.88)";

/**
 * 웨이브당 성공 보상 상한 — 사람만 쓰는 수입원이라 소액 + 횟수 제한.
 * 인플레는 이 상한이 아니라 상환 장부가 막는다(engine-tuning.ts 「부적 모드
 * 경제」) — 그래서 상한은 "한 웨이브에 몇 번 쓸 만한가"의 체감값으로 남는다.
 */
const REWARDS_PER_WAVE = 3;

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

/** 웨이브당 보상 한도. 엔진 교체(재도전)나 웨이브 전환이면 자동 리셋된다. */
let rewardEngine: GameEngine | null = null;

let rewardWave = -1;

let rewardsGranted = 0;

/**
 * 이번 웨이브에 실제로 받은 것의 누적. 연출은 1.4초면 지나가지만 "뭘 받았는지
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

function rewardBudgetLeft(): number {
  const state = ctx.engine.state;
  if (rewardEngine !== ctx.engine || rewardWave !== state.wave) {
    rewardEngine = ctx.engine;
    rewardWave = state.wave;
    rewardsGranted = 0;
    recentRewards = emptyTally();
  }
  return Math.max(0, REWARDS_PER_WAVE - rewardsGranted);
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

function syncRewardNote(): void {
  const left = rewardBudgetLeft();
  must<HTMLElement>("#talisman-reward-note").textContent = left > 0
    ? `이번 웨이브 보상 ${left}/${REWARDS_PER_WAVE}회`
    : `이번 웨이브 보상 소진 · 다음 웨이브에 ${REWARDS_PER_WAVE}회`;
  const recent = must<HTMLElement>("#talisman-recent-reward");
  const text = recentRewardText();
  recent.textContent = text === "" ? "최근 보상 · 아직 없음" : `최근 보상 · ${text}`;
  recent.classList.toggle("is-empty", text === "");
  // 상환 규칙은 숨기지 않는다 — 갚을 것이 남았으면 얼마인지까지 밝힌다.
  const debt = Math.round(ctx.engine.talismanDebt);
  must<HTMLElement>("#talisman-economy-note").textContent = debt > 0
    ? `웨이브 정산에서 ${debt}엽전 상환 예정 — 부적으로 번 만큼만 되갚습니다`
    : "받은 보상은 웨이브 정산에서 되갚습니다 · 안 쓰면 상환 없음";
}

/**
 * HUD 렌더 틱이 부른다 — 부적 탭이 열려 있는 동안에만 머리글 숫자를 맞춘다.
 * 웨이브가 넘어가며 보상 잔여 횟수와 상환 잔액이 바뀌는 것을 즉시 비춘다.
 */
export function syncTalismanPanel(): void {
  if (ctx.activePanelTab !== "talisman") return;
  if (!document.querySelector("#talisman-panel")) return;
  syncRewardNote();
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

/** 글자 마스크 준비 — 채점 원본(maskData)과 QA 따라쓰기용 격자(maskGrid). */
function prepareMask(char: string): void {
  const offscreen = document.createElement("canvas");
  offscreen.width = PAPER_WIDTH;
  offscreen.height = PAPER_HEIGHT;
  const context = offscreen.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Talisman mask canvas 2D context is unavailable.");
  drawGlyph(context, char, "#000");
  maskData = context.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT).data;
  maskGrid = rasterizeImageAlpha(maskData, PAPER_WIDTH, PAPER_HEIGHT, CELL_SIZE, 120);
}

function clearInk(): void {
  if (!inkContext) return;
  inkContext.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
  drawing = false;
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

/** 획이 하나도 없으면 제출할 것이 없다. 봉인이 끝난 부적도 다시 낼 수 없다. */
function syncSubmitButton(hasInk: boolean): void {
  const submit = must<HTMLButtonElement>("#talisman-submit");
  submit.disabled = sealed || !hasInk;
  submit.title = sealed
    ? "이미 완성된 부적입니다 — [새 부적 쓰기] 로 다음 글자를 받으세요"
    : hasInk
      ? `획순은 자유 · 정확 ${Math.round(TALISMAN_THRESHOLDS.inside * 100)}% · 덮음 ${Math.round(TALISMAN_THRESHOLDS.coverage * 100)}% 이상이면 부적이 완성됩니다`
      : "먼저 부적지의 한자를 따라 써 보세요";
}

function hideSeal(): void {
  const seal = must<HTMLElement>("#talisman-seal");
  seal.hidden = true;
  seal.classList.remove("is-stamped");
}

/** 새 글자를 부적지에 앉힌다. 먹선·인장·상태를 함께 되돌린다. */
function presentDefinition(definition: HanziDefinition): void {
  currentDefinition = definition;
  sealed = false;
  prepareMask(definition.char);
  if (guideContext) drawGlyph(guideContext, definition.char, "rgba(34, 26, 16, 0.2)");
  clearInk();
  must<HTMLCanvasElement>("#talisman-ink").classList.remove("is-sealed");
  hideSeal();
  const info = learningInfo(definition.region, definition.char);
  must<HTMLElement>("#talisman-reading").textContent = `${info.readingLabel} · ${info.reading}`;
  setStatus("반투명 글자를 따라 쓰고 [부적 봉인]");
  must<HTMLButtonElement>("#talisman-redraw").textContent = "다시 뽑기";
  syncSubmitButton(false);
  syncRewardNote();
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
    showToast("부적 완성! 자령이 깃들 봉인구가 늘었습니다");
    return;
  }
  if (rewardBudgetLeft() <= 0) {
    showToast(`부적 완성! 이번 웨이브 보상은 소진되었습니다 — 웨이브가 넘어가면 다시 ${REWARDS_PER_WAVE}회`);
    return;
  }
  if (!currentDefinition) return;
  rewardsGranted += 1;
  const state = ctx.engine.state;
  const goldBefore = state.gold;
  const { char, wuxing } = currentDefinition;
  const grants: TalismanRewardGrant[] = [];
  const roll = Math.random();
  if (roll < REWARD_GOLD_WEIGHT) {
    const amount = REWARD_GOLD_MIN + Math.floor(Math.random() * (REWARD_GOLD_MAX - REWARD_GOLD_MIN + 1));
    state.gold += amount;
    recentRewards.gold += amount;
    // 받은 만큼 그대로 장부에 적는다 — 웨이브 정산에서 되갚는다.
    ctx.engine.talismanDebt += amount;
    grants.push({ kind: "gold", amount, glyph: "錢", label: `+${amount} 엽전` });
  } else if (roll < REWARD_GOLD_WEIGHT + REWARD_ESSENCE_WEIGHT) {
    state.elementEssence[wuxing] += 1;
    state.elementEssenceGenerated[wuxing] += 1;
    recentRewards.essence[wuxing] = (recentRewards.essence[wuxing] ?? 0) + 1;
    ctx.engine.talismanDebt += TALISMAN_ESSENCE_GOLD_VALUE;
    grants.push({ kind: "essence", amount: 1, wuxing, glyph: wuxing, label: "+1 문기" });
  } else {
    ctx.talismanFreeSummonTokens += 1;
    recentRewards.tokens += 1;
    // 무료권이 아껴 줄 액수는 지금 소환가와 같다 — 그만큼만 적는다.
    ctx.engine.talismanDebt += summonCost(state.summonCount);
    grants.push({ kind: "token", amount: 1, glyph: "券", label: "+1 소환 무료권" });
  }
  const summary = grants.map((grant) => grant.label).join(" · ");
  showToast(`${char} 자령이 응답했습니다 — 보상을 두고 갑니다 · ${summary}`);
  playTalismanRewardVisit(char, wuxing, grants, goldBefore);
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
  // 인장이 쾅 찍히는 순간의 종이 번쩍·파문·아주 약한 흔들림 + 묵직한 봉인음.
  playTalismanImpact();
  sound.playTalismanSeal();
  setStatus(`부적 완성! 정확 ${Math.round(score.insideRatio * 100)}% · 덮음 ${Math.round(score.coverageRatio * 100)}%`, "pass");
  must<HTMLButtonElement>("#talisman-redraw").textContent = "새 부적 쓰기";
  syncSubmitButton(false);
  grantReward();
  syncRewardNote();
}

/**
 * 지금 먹선을 채점해 상태 줄과 [부적 봉인] 활성 여부를 맞춘다.
 * 판정(완성 처리)은 하지 않는다 — 그것은 제출 버튼만의 권한이다.
 */
function refreshScore(): TalismanScore | null {
  if (!inkContext || !maskData) return null;
  const data = inkContext.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT).data;
  const score = scoreTalismanDrawing(maskData, data, PAPER_WIDTH, PAPER_HEIGHT);
  if (!sealed) {
    syncSubmitButton(score.inkPixels > 0);
    if (score.inkPixels === 0) setStatus("반투명 글자를 따라 쓰고 [부적 봉인]");
    else setStatus(`정확 ${Math.round(score.insideRatio * 100)}% · 덮음 ${Math.round(score.coverageRatio * 100)}%`);
  }
  return score;
}

/** 미달 안내는 모자란 축만 짚는다. 벌은 없고 먹선도 지우지 않는다. */
function shortfallHint(score: TalismanScore): string {
  const coverage = Math.round(TALISMAN_THRESHOLDS.coverage * 100);
  const inside = Math.round(TALISMAN_THRESHOLDS.inside * 100);
  if (score.coverageRatio < TALISMAN_THRESHOLDS.coverage) return `조금 더 채워 보세요 — 덮음 ${coverage}% 필요`;
  return `글자 안쪽으로 더 붙여 보세요 — 정확 ${inside}% 필요`;
}

/**
 * [부적 봉인] — 사람이 "다 썼다"고 선언하는 지점.
 * 통과면 완성 연출·보상, 미달이면 안내만 남기고 그린 것을 그대로 둔다.
 */
function submitTalisman(): void {
  if (sealed) return;
  const score = refreshScore();
  if (!score || score.inkPixels === 0) return;
  if (!score.pass) {
    setStatus(shortfallHint(score), "hint");
    sound.playActionOutcome(false);
    return;
  }
  completeTalisman(score);
}

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (PAPER_WIDTH / Math.max(1, rect.width)),
    y: (event.clientY - rect.top) * (PAPER_HEIGHT / Math.max(1, rect.height))
  };
}

function strokeSegment(from: { x: number; y: number }, to: { x: number; y: number }): void {
  if (!inkContext) return;
  inkContext.save();
  inkContext.strokeStyle = INK_STYLE;
  inkContext.lineWidth = BRUSH_WIDTH;
  inkContext.lineCap = "round";
  inkContext.lineJoin = "round";
  inkContext.beginPath();
  inkContext.moveTo(from.x, from.y);
  // 제자리 클릭도 점 하나로 남게 미세 오프셋을 준다.
  inkContext.lineTo(to.x + 0.01, to.y + 0.01);
  inkContext.stroke();
  inkContext.restore();
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
    strokeSegment(lastPoint, lastPoint);
    event.preventDefault();
  });
  ink.addEventListener("pointermove", (event) => {
    if (!drawing || sealed) return;
    const point = canvasPoint(ink, event);
    strokeSegment(lastPoint, point);
    lastPoint = point;
  });
  const finish = (): void => {
    if (!drawing) return;
    drawing = false;
    // 획을 뗄 때 갱신되는 것은 상태 줄과 제출 활성뿐 — 완성 판정은 하지 않는다.
    refreshScore();
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
  button.title = "부적 만들기 — 한자를 따라 써서 봉인 부적을 완성합니다";
  button.addEventListener("click", () => {
    setPanelTab("talisman");
    ensureDefinition();
    // 같은 글자로 돌아온 경우에도 제출 활성·상태 줄을 지금 먹선에 맞춘다.
    refreshScore();
    syncRewardNote();
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
  showToast(enabled
    ? "부적 만들기 ON · 패널에 「부적」 탭이 열립니다"
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
      <p id="talisman-reward-note" class="talisman-reward-note">이번 웨이브 보상 ${REWARDS_PER_WAVE}/${REWARDS_PER_WAVE}회</p>
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
    <p id="talisman-status" class="talisman-status">반투명 글자를 따라 쓰고 [부적 봉인]</p>
    <div class="talisman-actions">
      <button id="talisman-clear" class="small-button" type="button" data-testid="talisman-clear">지우기</button>
      <button id="talisman-redraw" class="small-button" type="button" data-testid="talisman-redraw">다시 뽑기</button>
      <button id="talisman-submit" class="small-button talisman-submit" type="button" data-testid="talisman-submit" disabled>부적 봉인</button>
    </div>
    <p id="talisman-economy-note" class="talisman-economy-note">받은 보상은 웨이브 정산에서 되갚습니다 · 안 쓰면 상환 없음</p>
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
  must<HTMLButtonElement>("#talisman-clear").addEventListener("click", () => {
    sound.unlock();
    if (sealed && currentDefinition) {
      // 인장까지 찍힌 부적을 지우면 같은 글자를 처음부터 다시 쓴다.
      presentDefinition(currentDefinition);
      return;
    }
    clearInk();
    setStatus("반투명 글자를 따라 쓰고 [부적 봉인]");
    syncSubmitButton(false);
  });
  must<HTMLButtonElement>("#talisman-redraw").addEventListener("click", () => {
    sound.unlock();
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
        }
      }
    });
  }
}
