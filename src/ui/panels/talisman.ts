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
 *   이제 웨이브마다 장수가 **더해지고** 남은 장수는 계속 쌓인다. 무한 누적만
 *   막으려고 상한 30장을 둔다
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
import { type PickSource, pickWeighted, type RevisitEntry } from "./talisman-revisit";
import { MAX_ENEMIES } from "../../core/content";
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
import { readingUtterance, speakReading } from "../tts";
import { playTalismanImpact, playTalismanRewardVisit, type TalismanRewardGrant } from "../talisman-reward";
import { rasterizeImageAlpha, scoreTalismanDrawing, TALISMAN_THRESHOLDS, type TalismanCellGrid, type TalismanScore } from "./talisman-score";
import { StrokeGuide } from "./stroke-guide";
import { InkBoard, paintInk } from "./ink-strokes";
import { koreanMeaningExplanation } from "../../core/korean-meaning-explanations";
import { loadStrokeGlyphs, paperBoxFor, strokeGlyphFor, strokeGlyphStatus } from "../../core/stroke-order";

/**
 * 부적지(한지 세로 카드) 캔버스 크기.
 * 패널 작업 영역(.context-deck)은 368px 뿐이라 머리글·바닥줄을 빼면
 * 세로 264px 이 상한이다 — 처음 356px 안은 패널을 넘겨 아래 버튼을 누르면
 * 컨테이너가 스크롤돼 종이 위쪽이 잘렸다(실측 후 축소).
 */
const PAPER_WIDTH = 196;

/*
 * [v041] 260 → 256. 쉬운 뜻 두 줄을 세우려고 세로 장부에서 마지막 4px 을 여기서
 * 되찾는다. 캔버스 논리 크기와 화면 크기를 1:1 로 맞추는 규칙(540 절)에 따라
 * CSS 의 `.talisman-paper { height }` 도 함께 움직인다. 제시 글자 상자(174)는
 * 그대로라 글자 크기는 한 픽셀도 안 변한다.
 */
const PAPER_HEIGHT = 256;

/** 제시 글자 크기 — 명세 하한 180px 을 넘긴다. */
const GLYPH_FONT = '900 186px "Batang", "Malgun Gothic", serif';

const GLYPH_CENTER_X = PAPER_WIDTH / 2;

/** 위 훈음 띠·아래 인장 자리를 남기려고 중심을 살짝 아래에 둔다(종이 256의 절반). */
const GLYPH_CENTER_Y = 128;

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

/**
 * 웨이브마다 적립되는 부적 장수. 쓰지 않으면 소멸하지 않고 그대로 쌓인다.
 *
 * 셋 → 둘 → **하나**로 줄였다. 둘로 줄인 뒤에도 "여전히 부적 만드느라
 * 바쁘다"(사용자)였다. 준비 11초에 두 글자는 애초에 안 되는 셈이라 나머지 한
 * 장이 늘 교전 시간을 잡아먹었다 — 웨이브마다 **한 장**이면 준비 시간 안에
 * 끝나고, 그 이상 쓰고 싶은 사람은 쌓아 둔 장수를 몰아 쓰면 된다(상한 30장).
 *
 * 의무는 반이 되고 총량은 그대로다 — 아래 농축이 그만큼 되돌려 준다.
 */
const CHARGES_PER_WAVE = 1;

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

/** 경제 보상 안에서의 가중 — 엽전 60% / 해당 한자 오행 문기 30% / 무료권 10%. */
const REWARD_GOLD_WEIGHT = 0.6;

const REWARD_ESSENCE_WEIGHT = 0.3;

const REWARD_GOLD_MIN = 6;

const REWARD_GOLD_MAX = 14;

/**
 * 장수를 3장에서 2장으로 줄인 만큼 한 장을 값지게 한다.
 *
 * 총량을 **늘리는** 개편이 아니다 — 같은 총량을 덜 자주 주는 개편이다.
 * 처음엔 2장 × 1.35 ≈ 3장이었고, 장수를 하나로 다시 줄이면서 1장 × 2.7 ≈ 3장이
 * 되도록 맞췄다. 여기서 총량이 커지면 시뮬 게이트가 못 잡는 자리에서 경제가
 * 부푼다(부적 보상은 UI 층이 엔진을 직접 만져 시뮬에 안 잡힌다 — 그래서 설계로
 * 지켜야 한다).
 *
 * [v041] 이 농축은 처음에 **엽전 분기만** 탔다. 그래서 장수 3→1 개편이 엽전
 * 총량은 지키고 문기 총량은 3분의 1로 떨어뜨렸다(KR 풀 전수 실측: 100웨이브
 * 100.9 → 33.6). 지금은 문기도 같은 두 배수를 탄다 — **3장 시절 총량 100.9 를
 * 넘지 않는 것**이 그 되돌림의 상한이고, 지금 값은 84.0 이다.
 */
const REWARD_DENSITY = 2.7;

/**
 * 못 넘긴 글자를 적어 두는 명단 (v042) — 이 판에서만 산다.
 *
 * 저장본에 넣지 않는다 — **재회가 「이 판」의 규칙이기 때문이다.** 판을 덮고 새로
 * 시작하면 못 넘긴 글자도 함께 잊혀야 한다.
 *
 * 처음에는 「저장 스키마를 올리면 진행 중인 이어하기가 통째로 날아간다」고 적어
 * 뒀는데, **그건 사실이 아니었다**(v042 3차에서 실측). `parseRunSave` 는 화이트리스트만
 * 검사해 모르는 칸을 안 따지고, `adoptRun` 은 새로 만든 완전한 state 위에
 * `Object.assign` 을 한다 — 나중에 생긴 칸을 지운 저장본이 파싱을 통과했고 그 칸들이
 * `0`·`[]` 로 되살아났다. 옛 저장본은 안 깨진다. 진짜 위험은 **새 칸이 있다고 믿고
 * 읽는 쪽**이라, 더할 때는 빈 값으로 들어오는 길을 함께 열어 두면 된다.
 */
const revisitList = new Map<string, RevisitEntry>();

/** 이 종이에서 빗나간 붓질 수 — 두 번을 넘으면 재회 명단에 적는다. */
let warnedStrokes = 0;

/** 지금 종이의 글자를 어디서 골랐나 — 뽑는 순간에 굳혀 두고 다시 세지 않는다. */
let lastPickSource: PickSource | "revival" | "scripted" | "qa" | null = null;

/** 그 출처를 사람 말로. [다시 뽑기] 곁말에 실린다. */
const PICK_SOURCE_NOTE: Readonly<Record<string, string>> = Object.freeze({
  board: "지금 전장에 선 자령의 글자입니다",
  wave: "이번 웨이브가 데려온 글자입니다",
  idiom: "쫓는 성어에 아직 없는 글자입니다",
  discovered: "이 판에서 만난 적 있는 글자입니다",
  revisit: "지난번에 못 넘긴 글자 — 다시 만납니다",
  pool: "이 지역 로스터에서 새로 뽑았습니다",
  revival: "마지막 한 장 — 이 판에서 가장 어려운 글자입니다",
  scripted: "수련장이 정해 준 글자입니다",
  qa: "검사용으로 세운 글자입니다"
});

/** 못 넘긴 글자를 명단에 적는다 — 미달 제출·다시 뽑기·획순 되돌림. */
function noteRevisit(char: string): void {
  if (!char) return;
  const prior = revisitList.get(char);
  revisitList.set(char, { fails: (prior?.fails ?? 0) + 1, lastWave: ctx.engine.state.wave });
}

/**
 * 손에 쥘 수 있는 강림부 장수 (v041).
 *
 * 셋인 까닭. 100웨이브를 완주하면 강림부가 열 장 남짓 온다 — 상한이 셋이면 네
 * 장째가 오기 전에 쓰게 된다. 아끼다 못 쓰는 폭탄을 막는 탄막슈팅의 관습이다.
 */
const BURST_CAP = 3;

/**
 * 강림부를 사른다 — 전장 전체를 내리치고 잠깐 묶는다.
 *
 * 세기는 **올리지 않았다**. 즉시 발동이던 시절 KR 활성 풀의 평균 배수(1.289)를
 * 그대로 굳힌 값이다(0.09×1.289 · 6×1.289). 묶음만 상한을 24체로 두었다 —
 * 전장 전체(최대 80체)를 다 묶으면 그것은 타이밍 개편이 아니라 다른 게임이 된다.
 *
 * 무적 프레임은 없다. 웨이브 시계는 그대로 흐르고 새 적도 그대로 나온다 —
 * 사는 것은 2.5초와 한 번의 타격뿐이다.
 */
export function burnTalismanBurst(): void {
  const charge = ctx.talismanBurstCharges[0];
  if (!charge) return;
  if (!runActive() || ctx.engine.state.enemies.length === 0) {
    showToast("지금은 사를 자리가 없습니다 — 적이 있을 때 태우세요", false);
    return;
  }
  ctx.talismanBurstCharges.shift();
  const struck = ctx.engine.talismanStrike(0.116, 7.73, charge.wuxing);
  const bound = ctx.engine.talismanBind(Math.min(24, ctx.engine.state.enemies.length), 2.5);
  syncTalismanBurst();
  sound.playBossDrum();
  const stage = document.querySelector<HTMLElement>(".battle-stage");
  if (stage && !calmBattlefield()) {
    stage.classList.remove("is-burst");
    void stage.offsetWidth;
    stage.classList.add("is-burst");
    window.setTimeout(() => stage.classList.remove("is-burst"), 460);
  }
  showToast(`강림부를 살랐습니다 — ${struck}체 강타 · ${bound}체 봉인 2.5초`, false);
}

/** 손잡이의 장수·경보 상태를 화면에 맞춘다. */
export function syncTalismanBurst(): void {
  const button = document.querySelector<HTMLButtonElement>("#talisman-burst");
  if (!button) return;
  const left = ctx.talismanBurstCharges.length;
  const running = runActive();
  button.hidden = !running || left === 0;
  if (button.hidden) return;
  must<HTMLElement>("#talisman-burst-count").textContent = String(left);
  /*
   * 「위급할 때」의 문턱은 적 한계 경고와 **같은 값**을 쓴다(0.6 · 0.9). 화면 두
   * 곳이 서로 다른 「위급」을 말하면 그 자체가 소음이다.
   */
  const filled = ctx.engine.state.enemies.length / MAX_ENEMIES;
  button.dataset.alarm = filled >= 0.9 ? "2" : filled >= 0.6 ? "1" : "0";
}

/**
 * 획이 많을수록 후하다.
 *
 * 一(1획)과 鬱(29획)의 보상이 같은 것은 한자를 가르치겠다는 게임에서 아깝다.
 * 어려운 글자를 쓸 이유가 보상에 있어야 한다. 6획을 기준으로 획마다 6% 씩,
 * 0.7~2.4배 사이로 자른다.
 */
function rewardScale(char: string): number {
  const strokes = casualStrokeCount(char) ?? 6;
  return Math.max(0.7, Math.min(2.4, 1 + (strokes - 6) * 0.06));
}

/**
 * 경제 밖 보상이 나올 확률.
 *
 * 획이 많을수록 화면에서 무슨 일이 벌어질 확률이 오른다(6획 10% → 20획 35%).
 * 어려운 글자를 쓰면 화면이 반응한다는 규칙 자체가 학습 유인이 된다.
 */
function eventChance(char: string): number {
  const strokes = casualStrokeCount(char) ?? 6;
  return Math.max(0.08, Math.min(0.35, 0.1 + (strokes - 6) * 0.018));
}

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
/**
 * 지금 편 종이가 **부활 부적**이면 완성이 이리로 흐른다(v035 ⑤).
 *
 * 평소 흐름(보상 → 장수 차감 → 다음 장)과 갈라 두는 까닭은 그 종이가 판이
 * 끝나는 자리에서 딱 한 번만 서기 때문이다.
 */
let revivalHandler: ((score: TalismanScore) => void) | null = null;

const board = new InkBoard();

/** 판정에 떨어진 붓질을 붉게 비추는 중인가 — 비춘 뒤 스스로 걷는다. */
let warnTimer = 0;

/** 「안내가 준비됐다」는 알림을 이 종이에서 이미 띄웠는가 — 한 장에 한 번만. */
let guideReadyNoticeShown = false;

/** 장수 적립 장부. 엔진 교체(재도전)면 처음부터 다시 센다. */
let chargeEngine: GameEngine | null = null;

/** 마지막으로 적립을 정산한 웨이브. 여기서 지금 웨이브까지의 차이만큼 준다. */
let chargeWave = 1;
/** 이 판에서 완성해 본 부적 가운데 가장 많은 획수 — 부활 부적지의 난이도 잣대. */
let sealedStrokeMax = 0;
/** 이 판에서 완성한 부적 장수 — 수련장 「부적」 걸음이 완료를 센다. */
let sealCount = 0;

export function talismanSealCount(): number {
  return sealCount;
}

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
  /**
   * 경제 밖 보상이 몇 번 걸렸나(v035 ①).
   *
   * 이것들은 화면에서 벌어지고 끝나 남는 숫자가 없다. 세지 않으면 자령 강림을
   * 받고도 이 줄이 "아직 없음"이라고 말한다 — 받은 사람에게 못 받았다고 하는
   * 셈이다. 무엇이었는지는 지나갔으니 **몇 번**만 적는다.
   */
  events: number;
}

function emptyTally(): RecentRewardTally {
  return { gold: 0, essence: {}, tokens: 0, events: 0 };
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
    sealedStrokeMax = 0;
    sealCount = 0;
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
export function captureTalismanLedger(): { charges: number; chargeWave: number; sealCount: number } {
  talismanCharges();
  return { charges, chargeWave, sealCount };
}

/** 저장본에서 장부를 되살린다. 되살린 판의 엔진을 기준으로 다시 센다. */
export function restoreTalismanLedger(ledger: { charges: number; chargeWave: number; sealCount?: number }): void {
  chargeEngine = ctx.engine;
  charges = Math.max(0, Math.min(CHARGE_CAP, Math.floor(ledger.charges)));
  chargeWave = Math.max(1, Math.floor(ledger.chargeWave));
  /*
   * 완성한 장수도 이어진다 (v042, 반박이 잡았다).
   *
   * 여태 이 값을 읽는 곳이 수련장뿐이라 안 이어도 아무도 몰랐는데, 종료 화면이
   * 열두째 칸으로 이 값을 말하게 되면서 **같은 카드 안에서 두 칸이 서로 다른 판을
   * 세는** 꼴이 됐다 — 「도달 웨이브」는 이어하기 이전을 포함하고 「완성한 부적」은 0에서
   * 다시 셌다. 옛 저장본에는 이 칸이 없으므로 없으면 0으로 이어간다.
   */
  sealCount = Math.max(0, Math.floor(ledger.sealCount ?? 0));
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
  if (recentRewards.events > 0) parts.push(`자령 응답 ${recentRewards.events}회`);
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
  /*
   * [v041] 적립 줄은 감췄지만 그 사실은 남는다 — 장수 표시의 곁말로 옮겼다.
   * 머리글에서 12px 을 되찾아 쉬운 뜻 두 줄에 내주었기 때문이다.
   */
  must<HTMLElement>("#talisman-charge-count").title = credit.textContent ?? "";
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
  void loadStrokeGlyphs().then(() => {
    refreshStrokeGuideSheet(false);
    /*
     * 못 받았으면 **그렇다고 적는다.**
     *
     * 위 함수는 안내가 설 수 있을 때만 종이를 갈아 끼운다(wanted === available
     * 이면 곧바로 돌아간다). 그래서 실패는 조용히 지나가고, 상태 줄은 그 종이를
     * 세우던 순간의 문구에 그대로 멈춰 있었다 — 「받는 중입니다」에서 영영.
     * 여태 그 자리에 실패 문구가 뜬 것은 순서 운이었다(부팅에서 이미 실패한
     * 뒤에 종이를 세웠기 때문). loadStrokeGlyphs 는 failed 에서 다시 시도하므로
     * 갈피에 들어설 때마다 그 운이 뒤집힌다 — 운에 기대지 않고 여기서 적는다.
     * 먹이 얹힌 종이는 건드리지 않는다(채점·안내 문구를 덮어쓰면 안 된다).
     */
    if (strokeGlyphStatus() === "failed" && currentDefinition !== null && !sealed && board.isEmpty) setIdleStatus();
  });
}

/*
 * 시선 자리 행동 줄은 **걷었다**(v041).
 *
 * 부적지 아래에 「지금 눌러야 할 것 하나」를 세우던 줄이 있었다. 뜻은 옳았지만
 * 두 가지가 어긋났다.
 *
 * ① **같은 말을 두 번 했다.** 그 줄은 웨이브 카드와 같은 목록(wave-actions 의
 *    pickPanelActions)의 첫 줄을 그대로 가져왔다 — 실측하면 `#wave-action-a` 의
 *    글자와 한 자도 다르지 않은 「소환 15엽전 · 화력 부족」이 400px 도 안 떨어진
 *    두 자리에 나란히 섰다. 웨이브 카드는 갈피와 상관없이 늘 서 있으므로 부적
 *    갈피에서도 그 카드가 이미 보인다.
 * ② **그 줄이 서면 패널이 넘쳤다.** `.context-deck` 는 368px 로 못 박혀 있는데
 *    줄이 서는 순간 scrollHeight 가 395 가 됐다(초과 27px) — 줄 자신의 아래
 *    9px 이 잘리고, 그 아래 난이도 고지(#talisman-economy-note)는 통째로
 *    사라졌다("짤려서 나오는거 싫어" — 사용자). 이 줄의 주석은 스스로 「27px
 *    초과 전례」를 적어 두고 같은 자리에서 같은 일을 냈다.
 *
 * 그래서 말하는 자리를 **하나로 줄인다** — 급한 것은 웨이브 카드가 말한다.
 * 「눈이 부적에 있을 때도 급한 것이 눈에 든다」는 규범은 e2e/wave-actions.spec.ts
 * 로 옮겨 담았다(부적 갈피를 연 채 카드가 적 한계를 말하는지 본다).
 */

/**
 * 부적 갈피에 **들어서는 문** — 어느 단추로 왔든 여기를 지난다(v038).
 *
 * 여태 이 준비는 탭바 [부적] 단추의 click 리스너 안에만 있었다. 그래서 웨이브
 * 카드 곁자리 [부적 N장]으로 들어오면 화선지가 「글자를 준비하는 중」에 멈춰
 * 있었고, 탭바를 한 번 눌러야 비로소 글자가 떴다("부적 버튼 누르면 한자 로딩
 * 안되는 버그" — 사용자). 실측: 곁자리 진입 시 currentChar()=null · 안내 획
 * 0픽셀 / 탭바 진입 시 陛 · 5,959픽셀.
 *
 * 갈피 전환은 hud.setPanelTab 한 곳뿐이므로 준비도 거기서 한 번 부른다.
 * **프레임 루프에 기대지 않는다** — 화면이 가려져 rAF 가 멈춘 창(백그라운드
 * 탭)에서도 갈피는 열리고, 그때 종이가 비어 있으면 안 되기 때문이다.
 */
export function ensureTalismanSheet(): void {
  if (!document.querySelector("#talisman-panel")) return;
  ensureDefinition();
  // 탭을 닫아 둔 사이 지나간 웨이브의 적립이 여기서 한꺼번에 들어온다.
  refreshCharges();
  if (!outOfCharges) refreshScore();
  // 자료 받기는 종이를 세운 **뒤에** 건다 — 2.5MB 를 기다리느라 종이가 늦지 않게.
  preloadStrokeGuide();
}

export function syncTalismanPanel(): void {
  if (ctx.activePanelTab !== "talisman") return;
  preloadStrokeGuide();
  if (!document.querySelector("#talisman-panel")) return;
  // 안전망 — 갈피가 열려 있는 한 글자는 서 있어야 한다(문은 아래 ensureTalismanSheet).
  ensureDefinition();
  refreshCharges();
  // 표기 전환은 이 탭을 다시 그리지 않는다 — 읽기 줄만 따로 따라오게 한다.
  syncTalismanReading();
}

/** 현재 지역 로스터에서 다음 글자를 뽑는다(직전 글자는 피한다). */
/**
 * 다음 글자를 고른다 — **이 판에 묶어서** (v042).
 *
 * 여태 활성 풀에서 균등이었다. 실측하면 그 글자가 지금 전장에 서 있을 확률 8%,
 * 이 판에서 만난 글자일 확률 18%다 — 100웨이브를 다 써도 거의 전부 「처음 보는
 * 글자를 한 번 베끼고 끝」이었다. 노출만 있고 재회가 없다.
 *
 * 지분은 60(이 판에 닿은 글자) / 25(재회 명단) / 15(균등)이고, 규칙은 창 없이
 * 시험할 수 있게 잎 모듈(talisman-revisit)이 갖는다. 여기서는 재료만 긁어 준다.
 *
 * 안내를 켰으면 **획순 자료가 있는 글자**를 고르는 규칙은 그대로다(명단의 2%는
 * 자료가 없어 안내가 못 선다). 다만 이제 그 필터는 가중 **뒤에** 걸린다.
 */
function pickDefinition(): HanziDefinition | null {
  const catalog = ctx.engine.catalog;
  const pool = catalog.activePool.length > 0 ? catalog.activePool : [...catalog.definitions.values()];
  if (pool.length === 0) return null;
  const state = ctx.engine.state;
  const preferGuided = ctx.strokeOrderGuide && strokeGlyphStatus() === "ready";
  const board = new Set<string>();
  for (const tower of state.towers) board.add(tower.char);
  for (const tower of state.inventoryTowers) board.add(tower.char);
  const chosen = pickWeighted(
    {
      board: [...board],
      waveChar: state.waveChar,
      idiomMissing: [...ctx.engine.trackedIdiomMissingChars()],
      discovered: state.discoveredChars
    },
    revisitList,
    state.wave,
    pool.map((entry) => entry.char),
    (char) => !preferGuided || strokeGlyphFor(char) !== null,
    currentDefinition?.char ?? "",
    Math.random
  );
  if (!chosen) return null;
  lastPickSource = chosen.source;
  return catalog.definitions.get(chosen.char) ?? null;
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
 * 안내를 켰는데 안 서 있을 때, **왜 안 서는지**를 말한다.
 *
 * 까닭이 셋인데(아직 받는 중 / 이 글자에 자료가 없음 / 준비됐지만 먹이 이미
 * 있음) 화면에는 셋 다 「반투명 글자 한 장」으로만 보였다. 느린 회선에서 안내가
 * 안 서는 것이 사람에게는 버그로 읽힌 까닭이 이것이다(사용자 제보).
 */
/**
 * 아무것도 안 쓴 종이의 상태 줄 — 안내가 섰으면 몇 번째 획인지, 아니면 그 까닭.
 *
 * 이 결정이 세 곳(제시·채점·지우기)에 흩어져 있었고, [지우기] 만 문구를 박아
 * 두고 있었다. 그래서 자료가 온 뒤 비워도 「반투명 글자를 따라 쓰고」가 덮어써
 * 안내가 선 것을 말하지 못했다. 한 군데로 모은다.
 */
function setIdleStatus(): void {
  setStatus(strokeGuide.available && !strokeGuide.finished ? strokeStatus() : plainSheetNote());
}

function plainSheetNote(): string {
  if (!ctx.strokeOrderGuide) return "반투명 글자를 따라 쓰고 [부적 완성]";
  const char = currentDefinition?.char;
  if (char !== undefined && strokeGlyphStatus() === "ready" && strokeGlyphFor(char) === null) {
    return "이 글자는 획순 자료가 없습니다 — 글자 한 장을 통째로 따라 쓰세요";
  }
  switch (strokeGlyphStatus()) {
    case "loading":
      return "획순 자료를 받는 중입니다 — 오는 대로 한 획씩 짚어 드립니다";
    case "failed":
      return "획순 자료를 받지 못했습니다 — 글자 한 장을 통째로 따라 쓰세요";
    case "ready":
      // 자료도 글자도 있는데 안 서 있다면, 먹이 이미 있어 종이를 못 갈아 끼운 것이다.
      return board.isEmpty
        ? "반투명 글자를 따라 쓰고 [부적 완성]"
        : "획순 안내가 준비됐습니다 — [지우기]를 누르면 한 획씩 짚어 드립니다";
    default:
      return "반투명 글자를 따라 쓰고 [부적 완성]";
  }
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
  /*
   * 종이를 비운 김에 자료가 그새 왔는지 다시 본다.
   *
   * 자료를 받는 동안 한 획이라도 쓰면 그 종이는 갈아 끼울 수 없다(쓴 것을
   * 지울 수 없으니). 그래서 예전에는 자료가 와도 그 장은 끝까지 맨 종이였다 —
   * 사람 눈에는 "안내가 안 온다"로 보였다. 비운 뒤에는 갈아 끼워도 잃을 것이
   * 없으므로 여기서 집어 올린다.
   */
  refreshStrokeGuideSheet(false);
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
  const readingLine = must<HTMLElement>("#talisman-reading");
  readingLine.textContent = `${info.readingLabel} · ${info.reading}${infoMark ? ` (${infoMark})` : ""}`;
  /*
   * 훈음 줄은 한 줄 말줄임이다 — 일본 음훈으로 바꾸면 1,000자 가운데 886자가
   * 넘친다(실측 최장 辱 387px vs 상자 176px). 잘리는 곳에는 전문을 되찾을 길이
   * 있어야 한다는 규범대로 곁말을 단다.
   */
  readingLine.title = readingLine.textContent ?? "";
  /*
   * 쉬운 뜻 (v041). 코어 문장을 그대로 옮기고 라벨만 화면이 붙인다 —
   * 전장 자령 카드가 쓰는 그 규칙이다.
   */
  const explanation = koreanMeaningExplanation(definition.char, info.short, info.meaning);
  const band = must<HTMLElement>("#talisman-easy-meaning");
  must<HTMLElement>("#talisman-easy-meaning-text").textContent = explanation.short;
  band.title = explanation.body;
  band.setAttribute("aria-label", `쉬운 뜻 ${explanation.short}`);
}

/** 새 글자를 부적지에 앉힌다. 먹선·인장·상태를 함께 되돌린다. */
function presentDefinition(definition: HanziDefinition, source: typeof lastPickSource = lastPickSource): void {
  currentDefinition = definition;
  /*
   * 왜 이 글자인지를 **뽑는 순간** 굳힌다 (v042). 나중에 다시 세면 그 사이 자령이
   * 팔렸을 때 문장이 거짓이 된다. 세로 예산은 0px — 종이의 데이터 속성과 [다시 뽑기]
   * 의 곁말에만 적는다.
   */
  lastPickSource = source;
  warnedStrokes = 0;
  sealed = false;
  guideReadyNoticeShown = false;
  // 안내를 먼저 세운 뒤 마스크를 만든다 — 마스크가 안내의 글자를 따라야 한다.
  strokeGuide.begin(ctx.strokeOrderGuide ? definition.char : "", GLYPH_BOX);
  prepareMask(definition.char);
  paintGuide(definition.char);
  clearInk();
  must<HTMLCanvasElement>("#talisman-ink").classList.remove("is-sealed");
  hideSeal();
  syncTalismanReading();
  setIdleStatus();
  must<HTMLButtonElement>("#talisman-redraw").textContent = "다시 뽑기";
  must<HTMLElement>("#talisman-paper").dataset.pickSource = source ?? "pool";
  must<HTMLButtonElement>("#talisman-redraw").title = `${PICK_SOURCE_NOTE[source ?? "pool"] ?? ""} · 다른 글자를 받으려면 [다시 뽑기]`;
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
  if (!force && !board.isEmpty) {
    /*
     * 쓴 것을 지우면서까지 갈아 끼우지는 않는다. 대신 **준비됐다고 알린다** —
     * 말해 주지 않으면 그 장은 끝까지 맨 종이로 남고, 사람은 안내가 영영 안
     * 온다고 읽는다. 알림은 눈이 있는 자리(패널 안)에 띄우고 한 장에 한 번만.
     */
    if (wanted && !guideReadyNoticeShown) {
      guideReadyNoticeShown = true;
      showToast("획순 안내가 준비됐습니다 — [지우기]를 누르면 한 획씩 짚어 드립니다", false, "panel");
    }
    return;
  }
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
/**
 * 경제 밖 보상 — 화면에서 무슨 일이 벌어지게 한다.
 *
 * 여태 부적 보상은 엽전·문기·소환권뿐이라 **화면에서 아무 일도 안 벌어졌다.**
 * 쓴 보람이 숫자로만 남으니 "썼다"는 감각이 약했다(기획안 v035 ①).
 *
 * 지금 쓸 수 있는 것 가운데 하나를 고른다. 하나도 못 쓰면 false 를 돌려주고
 * 부르는 쪽이 경제 보상으로 돌아간다 — 아무 일도 안 일어나는 보상은 없어야 한다.
 */
function grantTalismanEvent(scale: number, wuxing: Wuxing, char: string, grants: TalismanRewardGrant[]): boolean {
  const state = ctx.engine.state;
  const options: Array<() => TalismanRewardGrant | null> = [];

  /*
   * 강림부(降) — 즉시 터지던 일격·봉인을 **손에 쥐는 한 장**으로 바꾼다 (v041).
   *
   * "부적으로 필드 적공격하는건 즉시발동이 아니라 쌓아뒀다가 버튼이나 특정 키
   * 누르면 사용되게해서 위급할 때 사용하게 하자. 탄막슈팅의 폭탄 같은 개념으로"
   * (사용자).
   *
   * 실측이 그 말을 뒷받침한다 — 봇 6런을 훑어 보면 교전 중 전장의 **평균** 적 수는
   * 1.5~4.0체이고 최대는 79체다(상한 80). 「전장 전체를 내리친다」는 효과를 평균
   * 1.6체에 쓰고 버리고 있었다. 세기를 올릴 것이 아니라 **고르는 순간**을 주면
   * 같은 상수가 스무 배가 된다. 그리고 게이트 45런의 패배 18건 가운데 17건이
   * 「적 80체가 전장을 뒤덮었습니다」다 — 폭탄이 겨눌 순간이 정확히 그것이다.
   *
   * 두 갈래를 하나로 합친 까닭: 무엇이 나올지 모르는 폭탄은 폭탄이 아니다.
   * 뜨는 조건(적이 있을 때)은 그대로 둔다 — 보상 섞임 비율이 한 푼도 안 바뀐다.
   */
  if (state.enemies.length > 0) {
    options.push(() => {
      if (ctx.talismanBurstCharges.length >= BURST_CAP) {
        // 가득 찼으면 사라지지 않고 문기로 돌아간다 — 손해로 읽히면 안 된다.
        const amount = Math.max(1, Math.round(scale * REWARD_DENSITY));
        state.elementEssence[wuxing] += amount;
        state.elementEssenceGenerated[wuxing] += amount;
        recentRewards.essence[wuxing] = (recentRewards.essence[wuxing] ?? 0) + amount;
        return { kind: "essence", amount, wuxing, glyph: wuxing, label: `강림부 가득 · ${wuxing} 문기 +${amount}` };
      }
      ctx.talismanBurstCharges.push({ wuxing, char });
      syncTalismanBurst();
      return { kind: "burst", amount: 1, wuxing, glyph: "降", label: `강림부 +1 · ${ctx.talismanBurstCharges.length}/${BURST_CAP}장` };
    });
  }

  // 문기의 숨 — 준비 시간을 늘린다. 준비 중일 때만 뜻이 있다.
  if (state.phase === "prep") {
    options.push(() => {
      const seconds = Math.max(2, Math.round(3 * scale));
      if (!ctx.engine.talismanBreath(seconds)) return null;
      return { kind: "breath", amount: seconds, glyph: "息", label: `문기의 숨 · 준비 +${seconds}초` };
    });
  }

  for (let attempt = options.length; attempt > 0; attempt -= 1) {
    const index = Math.floor(Math.random() * options.length);
    const [pick] = options.splice(index, 1);
    const grant = pick?.();
    if (grant) {
      grants.push(grant);
      return true;
    }
  }
  return false;
}

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
  const scale = rewardScale(char);
  /*
   * 획이 많으면 화면에서 무슨 일이 벌어질 확률이 오른다.
   *
   * 경제 밖 보상을 못 쓰는 자리도 있다(전장에 적이 없거나 교전 중이라 준비
   * 시간을 못 늘리거나). 그럴 때는 조용히 경제 보상으로 돌아간다 — 아무 일도
   * 안 일어나는 보상은 없어야 한다.
   */
  const wantsEvent = Math.random() < eventChance(char);
  if (wantsEvent && grantTalismanEvent(scale, wuxing, char, grants)) {
    // 경제 밖 보상이 실제로 걸렸다 — 남는 숫자가 없으므로 횟수로 적어 둔다.
    recentRewards.events += 1;
  } else {
    const roll = Math.random();
    if (roll < REWARD_GOLD_WEIGHT) {
      const base = REWARD_GOLD_MIN + Math.floor(Math.random() * (REWARD_GOLD_MAX - REWARD_GOLD_MIN + 1));
      const amount = Math.max(1, Math.round(base * scale * REWARD_DENSITY));
      state.gold += amount;
      recentRewards.gold += amount;
      grants.push({ kind: "gold", amount, glyph: "錢", label: `엽전 +${amount}` });
    } else if (roll < REWARD_GOLD_WEIGHT + REWARD_ESSENCE_WEIGHT) {
      /*
       * 문기도 엽전과 **같은 두 배수**를 탄다 — 획수(rewardScale)와 농축(REWARD_DENSITY).
       *
       * "부적의 문기 보상이 다른것에 비해 양이 적은 것 같아. 농축되면서 보상이
       * 올라야되는데 변화가 없는 느낌이야"(사용자). 수치가 그대로였다: 엽전 카드는
       * 평균 +34.8 을 적는데 문기 카드는 언제나 +1(12획 이상 +2)이었다.
       *
       * 이건 인상이 아니라 **되돌림**이다. 부적 장수를 셋에서 하나로 줄인 개편이
       * 농축을 1.35 → 2.7 로 올려 엽전 총량은 지켰는데, 문기 줄만 그 자리에 남아
       * 총량이 조용히 3분의 1이 됐다(KR 풀 전수 실측: 100웨이브 100.9 → 33.6).
       * 같은 배수를 태우면 84.0 — 3장 시절 총량 **아래**다. 그 100.9 가 이 되돌림의
       * 상한이고, 그래서 이 줄은 총량을 늘리는 개편이 아니다.
       *
       * 「낱개라 배수를 못 쓴다」고 적어 두었지만 반올림 한 줄이면 같은 규칙으로
       * 같은 계단이 선다: 1획 2 · 6획 3 · 12획 4 · 20획 5 · 29획 6.
       */
      const amount = Math.max(1, Math.round(scale * REWARD_DENSITY));
      state.elementEssence[wuxing] += amount;
      state.elementEssenceGenerated[wuxing] += amount;
      recentRewards.essence[wuxing] = (recentRewards.essence[wuxing] ?? 0) + amount;
      grants.push({ kind: "essence", amount, wuxing, glyph: wuxing, label: `${wuxing} 문기 +${amount}` });
    } else {
      ctx.talismanFreeSummonTokens += 1;
      recentRewards.tokens += 1;
      grants.push({ kind: "token", amount: 1, glyph: "券", label: "무료 소환권 +1" });
    }
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

/**
 * 인장이 찍히는 순간, 그 글자를 소리로 한 번 더 준다(설정 「읽기 소리내기」).
 *
 * 화면의 읽기 줄(#talisman-reading)이 이미 쓴 그 값을 그대로 읽는다 — 무엇을
 * 읽을지는 core/learning 한 곳에서만 나오므로 화면과 소리가 갈라지지 않는다.
 * 부활 부적지(dialogs/revival.ts)도 같은 완성 경로를 타므로 함께 읽힌다.
 */
function speakCompletedReading(): void {
  if (!ctx.readingVoice || !currentDefinition) return;
  const notation = ctx.engine.state.notation;
  const info = learningInfoForNotation(notation, currentDefinition.char);
  const utterance = readingUtterance(currentDefinition.char, notation, info.short);
  if (!utterance) return;
  /*
   * 말하는 동안 배경음을 눌러 둔다 — 안 그러면 목소리가 반주에 묻힌다
   * ("부적 tts소리 작아서 배경음에 묻혀" — 사용자). 목소리 음량은 이미 천장이라
   * 낮출 것은 반주뿐이다.
   *
   * fallbackText: 중국어 목소리가 없는 기기에서는 적힌 대로(병음) 읽는 편이
   * 침묵보다 낫다.
   */
  speakReading(utterance, {
    fallbackText: info.short,
    onStart: () => sound.duckForSpeech(true),
    onEnd: () => sound.duckForSpeech(false)
  });
}

/** 완성 연출 — 먹선이 또렷해지고 주홍 인장이 찍힌다(calm-screen 은 맥동 없이). */
function completeTalisman(score: TalismanScore): void {
  sealed = true;
  // 넘긴 글자는 명단에서 뺀다 — 재회는 못 넘긴 것에만 걸린다(v042).
  if (currentDefinition) revisitList.delete(currentDefinition.char);
  drawing = false;
  sealCount += 1;
  if (currentDefinition) sealedStrokeMax = Math.max(sealedStrokeMax, casualStrokeCount(currentDefinition.char) ?? 0);
  speakCompletedReading();
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
  /*
   * 마지막 보루로 세운 장(v035 ⑤)은 보상 대신 판을 되돌린다.
   *
   * 장수를 세지 않고 다음 장도 안 넘긴다 — 이 종이는 판이 끝나는 자리에서
   * 딱 한 번 서는 것이라, 평소의 「보상 → 다음 장」 흐름에 얹으면 안 된다.
   */
  if (revivalHandler) {
    const finish = revivalHandler;
    revivalHandler = null;
    finish(score);
    return;
  }
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
 * 부활 부적지를 편다 — 그 판에서 **가장 어려운 글자**로.
 *
 * "글자는 그 판에서 가장 어려운(획수 많은) 글자로 — 마지막 한 번이니 값이
 * 있어야 한다"(기획안 v035 ⑤). 획순 안내가 서 있으면 자료가 있는 글자로
 * 좁힌다 — 마지막 한 장을 맨 종이로 주면 도와주려다 되레 가로막는다.
 *
 * 되돌려주는 것은 종이 조각이다. 부르는 쪽이 그 조각을 제 대화창으로 옮겨
 * 갔다가 끝나면 제자리에 돌려놓는다 — 화선지와 붓 배선을 통째로 다시 만들지
 * 않으려는 것이고, "같은 종이"라는 감각도 그 편이 맞다.
 */
export function beginRevivalSheet(onSealed: (score: TalismanScore) => void): HTMLElement | null {
  const catalog = ctx.engine.catalog;
  const pool = catalog.activePool.length > 0 ? catalog.activePool : [...catalog.definitions.values()];
  const guided = ctx.strokeOrderGuide && strokeGlyphStatus() === "ready";
  const reachable = guided ? pool.filter((entry) => strokeGlyphFor(entry.char) !== null) : pool;
  const candidates = reachable.length > 0 ? reachable : pool;
  if (candidates.length === 0) return null;
  /*
   * v037: 예전에는 풀에서 **획수 최다**(鬱 29획)를 골랐다. 부적 갈피를 한 번도
   * 안 연 사람에게 29획은 「해 볼 만하다」는 느낌이 없다(페르소나 실측). 이 판에서
   * 완성해 본 획수를 잣대로 — 한 장도 안 썼으면 10획 이하, 썼으면 그 최다 +2 이하
   * 가운데 가장 어려운 글자를 고른다. 그래도 마지막 보루답게 쉬운 글자는 아니다.
   */
  const budget = sealedStrokeMax > 0 ? sealedStrokeMax + 2 : 10;
  const withinBudget = candidates.filter((entry) => (casualStrokeCount(entry.char) ?? 0) <= budget);
  const hardest = (withinBudget.length > 0 ? withinBudget : candidates).reduce((best, entry) =>
    (casualStrokeCount(entry.char) ?? 0) > (casualStrokeCount(best.char) ?? 0) ? entry : best
  );
  cancelAdvance();
  revivalHandler = onSealed;
  presentDefinition(hardest, "revival");
  // 붓을 대기 전에 「무엇을 어떻게」를 말한다 — 첫 획을 긋고 나서야 뜨던 안내였다.
  const strokes = casualStrokeCount(hardest.char) ?? 0;
  setStatus(`${hardest.char} ${strokes > 0 ? `${strokes}획` : ""} — 반투명 글자를 마우스로 따라 그으세요 · 다 쓰면 [부적 완성]`, "hint");
  return document.querySelector<HTMLElement>("#talisman-paper");
}

/** 부활 부적지를 접는다 — 다 썼든 안 썼든 평소 흐름으로 되돌린다. */
export function endRevivalSheet(): void {
  revivalHandler = null;
  clearInk();
  hideSeal();
  must<HTMLCanvasElement>("#talisman-ink").classList.remove("is-sealed");
  setControlsEnabled(true);
  setIdleStatus();
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
    /*
     * 한 종이에서 두 번 넘게 빗나가면 그 글자를 재회 명단에 적는다(v042).
     * 한 번은 손이 미끄러진 것이고, 두 번부터가 「아직 못 쓰는 글자」다.
     */
    warnedStrokes += 1;
    if (warnedStrokes === 2 && currentDefinition) noteRevisit(currentDefinition.char);
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
  // 획순이 거꾸로였던 글자도 「아직 못 쓰는 글자」다.
  if (result.reversed && currentDefinition) noteRevisit(currentDefinition.char);
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
      setIdleStatus();
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
    // 못 넘긴 글자는 명단에 적어 나중에 다시 만난다(v042).
    if (currentDefinition) noteRevisit(currentDefinition.char);
    return;
  }
  if (!score.pass) {
    setStatus(shortfallHint(score), "hint");
    sound.playActionOutcome(false);
    if (currentDefinition) noteRevisit(currentDefinition.char);
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
  // 준비는 setPanelTab(hud.ts)이 한 곳에서 한다 — 두 문이 각자 하면 또 갈라진다.
  button.addEventListener("click", () => setPanelTab("talisman"));
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

/**
 * 수련장 「부적」 걸음의 준비(v037).
 *
 * 부적은 임시 기능에서 정식 기능이 됐는데 수련장은 그것을 한 번도 말하지
 * 않았다. 이 판에서만 부적 모드를 켜고(설정 저장은 건드리지 않는다 — 수련을
 * 나가면 새로고침이라 원래 설정으로 돌아온다), 갈피를 세우고, 한 장을 손에
 * 쥐여 준다.
 */
export function prepareTalismanForTutorial(char?: string): void {
  ctx.talismanMode = true;
  syncTabPresence();
  syncModeToggle();
  refreshCharges();
  if (charges <= 0) {
    charges = 1;
    outOfCharges = false;
    document.querySelector("#talisman-paper")?.classList.remove("is-out-of-charges");
    syncRewardNote();
  }
  /*
   * 각본이 글자를 정해 주면 **강제로** 세운다 (v041).
   *
   * `ensureDefinition()` 은 같은 지역이면 조기 반환한다 — 종이를 쓰던 중에 갈피를
   * 여닫아도 글자가 안 날아가게 하는 규칙이다. 그런데 수련장은 새로고침이 아니라
   * 새 판이라, **한 세션에서 부적 갈피를 한 번이라도 연 뒤 수련장에 들어가면**
   * 그 옛 글자가 그대로 남는다. 각본 글자는 그 규칙을 비켜 가야 한다.
   *
   * 글자는 호출부(각본)가 준다 — 부적 모듈이 수련장을 알 필요는 없다.
   */
  const scripted = char === undefined ? undefined : ctx.engine.catalog.definitions.get(char);
  if (scripted) presentDefinition(scripted, "scripted");
  else ensureDefinition();
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
  <header class="workbench-heading talisman-heading">
    <div><strong title="따라 쓰는 봉인구">부적 만들기</strong></div>
    <div class="talisman-reward-column">
      <div id="talisman-charges" class="talisman-charges" aria-label="남은 부적 장수">
        <b id="talisman-charge-count" data-testid="talisman-charge-count">남은 부적 ${CHARGES_PER_WAVE}장</b>
        <em id="talisman-charge-credit" hidden>이번 웨이브 +${CHARGES_PER_WAVE} 적립</em>
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
    <!--
      쉬운 뜻 (v041).

      "부적 기능에서 훈음이 작은 부분, 쉬운 뜻이 안 보이는 부분 아쉬워"(사용자).
      쉬운 뜻은 여태 전장 자령 카드와 도감에만 있었다 — 정작 **글자를 손으로 쓰는
      자리**에는 없었다. 자료는 이미 코어에 있다(korean-easy-meanings, KR 1,000자
      전수 dedicated).

      두 줄로 못 박는다. 패널 전폭 344px · 12px 로 재면 1,000자 가운데 3줄이 되는
      글자가 없다(가장 긴 것이 目 43자). 난이도 고지는 이 줄에 자리를 내주고
      #talisman-status 의 곁말로 옮겼다 — 문장은 한 글자도 안 바뀐다.
    -->
    <p id="talisman-easy-meaning" class="talisman-easy-meaning"><b>쉬운 뜻</b><span id="talisman-easy-meaning-text">글자를 준비하는 중</span></p>
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
  /*
   * 난이도 고지는 쉬운 뜻에 자리를 내주고 **상태 줄의 곁말**로 옮겨 왔다(v041).
   * 문장은 한 글자도 바꾸지 않는다 — 자리만 옮긴 것이다.
   */
  const economyNote = `부적 모드에서는 적이 ${Math.round((TALISMAN_MODE_ENEMY_HP_SCALE - 1) * 100)}% 강해집니다 — 그 대신 부적 보상을 얻습니다 · 설정에서 학습부적을 켜고 끌 수 있습니다`;
  must<HTMLElement>("#talisman-status").title = economyNote + " · " +
    `획순은 자유 · 정확 ${Math.round(TALISMAN_THRESHOLDS.inside * 100)}% · 덮음 ${Math.round(TALISMAN_THRESHOLDS.coverage * 100)}% 이상이면 부적이 완성됩니다`;
  wireDrawing(ink);
  // 강림부 손잡이는 부적 패널이 서기 전에도 눌려야 한다 — 전장 쪽 요소라 여기서 건다.
  document.querySelector<HTMLButtonElement>("#talisman-burst")?.addEventListener("click", () => {
    sound.unlock();
    burnTalismanBurst();
  });
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
    setIdleStatus();
    syncSubmitButton(false);
  });
  must<HTMLButtonElement>("#talisman-redraw").addEventListener("click", () => {
    sound.unlock();
    cancelAdvance();
    // 물린 글자도 「못 넘긴 것」이다 — 뽑기 전에 적는다(v042).
    if (currentDefinition && !sealed) noteRevisit(currentDefinition.char);
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
        /**
         * 장수를 채운다 — 한 스펙에서 여러 장을 이어 쓰려면 필요하다.
         *
         * 웨이브당 한 장이 된 뒤로(v036) 「두 글자를 견주는」 시험은 판을 두 번
         * 굴리지 않고는 못 서는데, 그건 재려는 것과 상관없는 시간이다.
         */
        grantCharges: (count: number) => {
          charges = Math.max(0, Math.min(CHARGE_CAP, charges + Math.floor(count)));
          outOfCharges = charges <= 0;
          syncRewardNote();
          return charges;
        },
        /** 특정 글자를 강제 제시 — 최밀 글자 채점 검증·스크린샷 재현용. */
        present: (char: string) => {
          const definition = ctx.engine.catalog.definitions.get(char);
          if (definition) presentDefinition(definition, "qa");
          return definition !== undefined;
        },
        /** 지금 종이의 글자를 어디서 골랐나(v042). */
        pickSource: () => lastPickSource,
        /** 재회 명단 — 못 넘긴 글자와 그 횟수. */
        revisitList: () => [...revisitList.entries()].map(([char, entry]) => ({ char, ...entry })),
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
