/*
 * 집자소 — 한자를 써서 성어 능력을 다시 굴린다.
 *
 * ── 왜 「쓰기」인가
 *
 * 새긴 성어의 능력은 무작위다. 꽝이 나오면 자혼 넷이 통째로 아깝다. 그렇다고
 * 공짜로 다시 굴리게 두면 굴림이 뜻을 잃는다 — 아무거나 새겨 놓고 원하는 축이
 * 나올 때까지 누르면 되기 때문이다.
 *
 * 그래서 값을 **손으로** 치르게 한다. 그 성어의 **네 글자를 모두** 부적에
 * 써 내야 한 번 다시 굴린다. 자혼 넷을 태워 만든 것이니 다시 굴리는 값도
 * 넷이어야 무게가 맞는다 — 한 글자면 너무 싸서, 마음에 들 때까지 돌리는
 * 손잡이가 되어 버린다.
 *
 * 이 게임이 부적 만들기에서 이미 쓰는 매커니즘 그대로다. 값이 엽전도 자혼도
 * 아니라 **글자를 쓸 줄 아는가**라서, 다시 굴릴수록 그 네 글자를 손이 외운다.
 * 벌이 곧 학습이 되는 자리다.
 *
 * ── 왜 부적 패널을 그대로 안 쓰나
 *
 * panels/talisman.ts 는 런에 매여 있다(남은 장수·보상 장부·웨이브 적립).
 * 집자소는 판 밖의 화면이라 그 경제가 없다. 그래서 **채점만** 같은 모듈
 * (talisman-score.ts)로 나눠 쓰고, 종이와 붓은 여기서 따로 편다.
 * 획순 데이터는 필요 없다 — 채점이 글리프 마스크 덮음률로만 판정한다.
 */
import { rerollCustomIdiom, type SoulArchive } from "../../core/soul-archive";
import type { CustomIdiom } from "../../core/custom-idioms";
import { ctx, must } from "../app-context";
import { rasterizeImageAlpha, scoreTalismanDrawing, TALISMAN_THRESHOLDS, type TalismanCellGrid } from "./talisman-score";
import { StrokeGuide } from "./stroke-guide";
import { paperBoxFor } from "../../core/stroke-order";

/** 종이 크기 — 부적 패널과 같은 비례로 두어 손 감각이 이어진다. */
const PAPER_WIDTH = 196;

const PAPER_HEIGHT = 232;

const GLYPH_FONT = '900 172px "Batang", "Malgun Gothic", serif';

const GLYPH_CENTER_X = PAPER_WIDTH / 2;

const GLYPH_CENTER_Y = PAPER_HEIGHT / 2;

const INK_STYLE = "#241a0e";

const BRUSH_WIDTH = 13;

/** 채점 칸 크기 — 부적 패널과 같다(칸 양자화 + 1칸 팽창이 손떨림 허용치다). */
const CELL_SIZE = 8;

interface RerollSession {
  readonly idiom: CustomIdiom;
  /** 지금 쓰고 있는 자리(0~3). 아직 안 쓴 자리 중에서 고른다. */
  index: number;
  /** 자리마다 다 썼는가. 넷이 모두 참이어야 다시 굴릴 수 있다. */
  readonly written: boolean[];
}

let session: RerollSession | null = null;
let guideContext: CanvasRenderingContext2D | null = null;
let inkContext: CanvasRenderingContext2D | null = null;
let maskData: Uint8ClampedArray | null = null;

/** 획순 안내(선택 항목) — 꺼져 있으면 available 이 false 로 남는다. */
const strokeGuide = new StrokeGuide();

/** 붓 글자가 앉을 정사각형 — 바탕체 172px 글자가 차지하던 자리에 맞췄다. */
const GLYPH_BOX = paperBoxFor(161, GLYPH_CENTER_X, GLYPH_CENTER_Y);

/** 이어 그리기용 직전 점. 없으면 빠르게 끌 때 먹선이 점선으로 끊긴다. */
let lastPoint = { x: 0, y: 0 };
let maskGrid: TalismanCellGrid | null = null;
let drawing = false;
let bound = false;

/** 다시 굴린 뒤 부를 곳 — 집자소가 제 화면을 다시 그리도록. */
let onDone: ((archive: SoulArchive, idiom: CustomIdiom) => void) | null = null;

/** 장부를 읽고 쓰는 통로. 집자소가 꽂아 준다. */
let readArchive: (() => SoulArchive) | null = null;
let writeArchive: ((archive: SoulArchive) => void) | null = null;

function sheet(): HTMLElement {
  return must<HTMLElement>("#soul-reroll");
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

/** 채점 원본 — 반투명 안내와 같은 글리프를 검게 찍어 마스크로 삼는다. */
function prepareMask(char: string): void {
  const offscreen = document.createElement("canvas");
  offscreen.width = PAPER_WIDTH;
  offscreen.height = PAPER_HEIGHT;
  const context = offscreen.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("집자소 채점 캔버스를 열 수 없습니다.");
  context.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
  // 획순 안내가 서 있으면 그 자료의 글자로 채점한다 — 보고 그린 것과 같아야 한다.
  if (!strokeGuide.paintGlyph(context, "#000")) drawGlyph(context, char, "#000");
  maskData = context.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT).data;
  maskGrid = rasterizeImageAlpha(maskData, PAPER_WIDTH, PAPER_HEIGHT, CELL_SIZE, 120);
}

function clearInk(): void {
  inkContext?.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
  // 먹을 지웠으면 안내도 첫 획으로 — 남아 있으면 종이와 안내가 어긋난다.
  if (strokeGuide.available) {
    strokeGuide.reset();
    paintGuide(currentChar());
  }
  drawing = false;
  refreshScore();
}

function setStatus(text: string): void {
  must<HTMLElement>("#soul-reroll-status").textContent = text;
}

/**
 * 방금 뗀 한 획을 안내와 견줘 다음 획으로 넘긴다(획순 안내를 켠 경우).
 * 판정에는 손대지 않는다 — 안내는 안내지 관문이 아니다.
 */
function advanceStrokeGuide(): void {
  if (!strokeGuide.available) return;
  const result = strokeGuide.penUp();
  paintGuide(currentChar());
  if (!result) return;
  if (!result.advanced) {
    setStatus(`${strokeGuide.current + 1}번째 획을 붉은 점선을 따라 끝까지 그으세요`);
    return;
  }
  if (result.done) {
    setStatus(`${strokeGuide.total}획을 모두 그었습니다 — [이 글자 완성]`);
    return;
  }
  setStatus(result.reversed
    ? `방향이 거꾸로였습니다 — 다음은 ${strokeGuide.current + 1}번째 획`
    : `${strokeGuide.current + 1}번째 획 · 모두 ${strokeGuide.total}획 — 붉은 점선을 따라 그으세요`);
}

/**
 * 지금 먹선을 재서 상태 줄과 단추를 맞춘다.
 *
 * 판정은 하지 않는다 — 그건 [다시 굴리기] 단추만의 권한이다. 부적 패널이
 * 세운 규범을 그대로 따른다(획을 떼도 저절로 완성되지 않는다).
 */
function refreshScore(): { inside: number; coverage: number; ink: number } | null {
  if (!inkContext || !maskData) return null;
  const data = inkContext.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT).data;
  const score = scoreTalismanDrawing(maskData, data, PAPER_WIDTH, PAPER_HEIGHT);
  const submit = must<HTMLButtonElement>("#soul-reroll-submit");
  submit.disabled = score.inkPixels === 0;
  if (score.inkPixels === 0 && strokeGuide.available && !strokeGuide.finished) {
    setStatus(`${strokeGuide.current + 1}번째 획 · 모두 ${strokeGuide.total}획 — 붉은 점선을 따라 그으세요`);
  } else if (score.inkPixels === 0) {
    setStatus(
      `반투명 글자를 따라 쓰고 [다시 굴리기] · 정확 ${Math.round(TALISMAN_THRESHOLDS.inside * 100)}%`
      + ` · 덮음 ${Math.round(TALISMAN_THRESHOLDS.coverage * 100)}% 이면 통과합니다`
    );
  } else {
    setStatus(
      `정확 ${Math.round(score.insideRatio * 100)}% · 덮음 ${Math.round(score.coverageRatio * 100)}%`
    );
  }
  return { inside: score.insideRatio, coverage: score.coverageRatio, ink: score.inkPixels };
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
  // 제자리 클릭도 점 하나로 남게 미세 오프셋을 준다(부적 패널과 같은 처방).
  inkContext.lineTo(to.x + 0.01, to.y + 0.01);
  inkContext.stroke();
  inkContext.restore();
}

/**
 * 안내 캔버스 — 반투명 글자 한 장, 그 위에 (켰다면) 지금 그을 획.
 * 부적 판과 같은 처방이다(panels/talisman.ts).
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

/** 지금 쓰는 자리의 글자. */
function currentChar(): string {
  return session ? ([...session.idiom.chars][session.index] ?? "") : "";
}

function allWritten(): boolean {
  return session !== null && session.written.every(Boolean);
}

/**
 * 네 자리를 그린다 — 어디까지 왔는지가 한눈에 보여야 한다.
 *
 * 겹친 글자도 자리마다 따로 센다. 「네 글자를 다 쓴다」가 값이므로 같은 글자가
 * 둘이면 두 번 쓴다 — 겹쳐 만든 성어가 값까지 싸지면 중복 보정과 어긋난다.
 */
function renderChoices(): void {
  if (!session) return;
  const row = must<HTMLElement>("#soul-reroll-chars");
  row.replaceChildren(
    ...[...session.idiom.chars].map((char, index) => {
      const done = session?.written[index] === true;
      const active = session?.index === index;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `soul-reroll-char${done ? " is-done" : ""}${active ? " is-active" : ""}`;
      button.dataset.rerollIndex = String(index);
      // 다 쓴 자리는 인장으로 덮는다 — 남은 자리가 저절로 도드라진다.
      button.innerHTML = `<b>${char}</b>${done ? '<i aria-hidden="true">封</i>' : ""}`;
      button.setAttribute("aria-label", `${index + 1}번째 ${char}${done ? " · 다 썼습니다" : ""}`);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      return button;
    })
  );
  must<HTMLElement>("#soul-reroll-progress").textContent =
    `${session.written.filter(Boolean).length} / ${session.written.length}자`;
}

function useIndex(index: number): void {
  if (!session) return;
  session.index = index;
  const char = currentChar();
  // 안내를 먼저 세운 뒤 마스크를 만든다 — 마스크가 안내의 글자를 따라야 한다.
  strokeGuide.begin(ctx.strokeOrderGuide ? char : "", GLYPH_BOX);
  prepareMask(char);
  paintGuide(char);
  clearInk();
  renderChoices();
  syncActions();
}

/**
 * 단추 둘의 자리 — 쓰는 동안에는 [이 글자 완성]만, 넷을 다 쓰면 그때
 * [다시 굴리기]가 **한 번** 나온다. 두 단추를 늘 함께 보이면 「지금 눌러도
 * 되나」를 매번 판단하게 된다.
 */
function syncActions(): void {
  const done = allWritten();
  must<HTMLButtonElement>("#soul-reroll-submit").hidden = done;
  must<HTMLButtonElement>("#soul-reroll-roll").hidden = !done;
}

/**
 * 이 한 글자를 다 썼는가 — 부적 완성과 같은 문턱이다.
 *
 * 통과하면 그 자리에 인장이 찍히고 다음 빈 자리로 넘어간다. 판정은 이 단추만의
 * 권한이다 — 획을 떼도 저절로 넘어가지 않는다(부적 패널의 규범 그대로).
 */
function submit(): void {
  if (!session) return;
  const score = refreshScore();
  if (!score) return;
  if (score.coverage < TALISMAN_THRESHOLDS.coverage) {
    setStatus(`조금 더 채워 보세요 — 덮음 ${Math.round(TALISMAN_THRESHOLDS.coverage * 100)}% 필요`);
    return;
  }
  if (score.inside < TALISMAN_THRESHOLDS.inside) {
    setStatus(`글자 밖으로 나갔습니다 — 정확 ${Math.round(TALISMAN_THRESHOLDS.inside * 100)}% 필요`);
    return;
  }

  session.written[session.index] = true;
  const nextEmpty = session.written.findIndex((done) => !done);
  renderChoices();
  if (nextEmpty < 0) {
    // 넷을 다 썼다. 이제 [다시 굴리기]가 한 번 나온다.
    clearInk();
    syncActions();
    setStatus("네 글자를 다 썼습니다 — 이제 한 번 다시 굴릴 수 있습니다");
    return;
  }
  useIndex(nextEmpty);
  setStatus(`${currentChar()} — 남은 ${session.written.filter((done) => !done).length}자`);
}

/** 넷을 다 쓴 뒤 딱 한 번. */
function roll(): void {
  if (!session || !readArchive || !writeArchive || !allWritten()) return;
  const next = rerollCustomIdiom(readArchive(), session.idiom.id, Math.random(), Math.random());
  writeArchive(next);
  const rolled = next.idioms.find((entry) => entry.id === session?.idiom.id);
  closeSoulReroll();
  if (rolled) onDone?.(next, rolled);
}

export interface SoulRerollHooks {
  readonly read: () => SoulArchive;
  readonly write: (archive: SoulArchive) => void;
  readonly done: (archive: SoulArchive, idiom: CustomIdiom) => void;
}

export function bindSoulReroll(hooks: SoulRerollHooks): void {
  readArchive = hooks.read;
  writeArchive = hooks.write;
  onDone = hooks.done;
  if (bound) return;
  bound = true;

  const guide = must<HTMLCanvasElement>("#soul-reroll-guide");
  const ink = must<HTMLCanvasElement>("#soul-reroll-ink");
  guideContext = guide.getContext("2d");
  inkContext = ink.getContext("2d", { willReadFrequently: true });

  ink.addEventListener("pointerdown", (event) => {
    if (event.button > 0) return;
    drawing = true;
    // 합성 포인터(QA 자동 따라쓰기)에는 잡을 포인터가 없어 던진다 — 그리기
    // 자체는 캡처 없이도 되므로 조용히 넘긴다.
    try {
      ink.setPointerCapture(event.pointerId);
    } catch {
      /* 무시 */
    }
    lastPoint = canvasPoint(ink, event);
    strokeGuide.penDown(lastPoint);
    strokeSegment(lastPoint, lastPoint);
    refreshScore();
  });
  ink.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const point = canvasPoint(ink, event);
    strokeGuide.penMove(point);
    /*
     * 직전 점에서 이어 긋는다. 여기서 점 하나만 찍으면(예전 코드) 빠르게 끄는
     * 붓이 점선으로 끊겨, 성실히 쓴 글자가 덮음 미달로 퇴짜를 맞는다.
     */
    strokeSegment(lastPoint, point);
    lastPoint = point;
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
    ink.addEventListener(type, () => {
      if (!drawing) return;
      drawing = false;
      refreshScore();
      // 안내가 마지막에 말한다 — 먼저 부르면 채점 문구가 덮어쓴다.
      advanceStrokeGuide();
    });
  }

  must<HTMLElement>("#soul-reroll-chars").addEventListener("click", (event) => {
    const raw = (event.target as HTMLElement).closest<HTMLElement>("[data-reroll-index]")?.dataset.rerollIndex;
    if (raw === undefined) return;
    const index = Number(raw);
    // 이미 쓴 자리는 다시 열지 않는다 — 인장이 찍힌 자리다.
    if (session?.written[index] === true) return;
    useIndex(index);
  });
  must<HTMLButtonElement>("#soul-reroll-clear").addEventListener("click", clearInk);
  must<HTMLButtonElement>("#soul-reroll-submit").addEventListener("click", submit);
  must<HTMLButtonElement>("#soul-reroll-roll").addEventListener("click", roll);
  must<HTMLButtonElement>("#soul-reroll-cancel").addEventListener("click", closeSoulReroll);
}

export function openSoulReroll(idiom: CustomIdiom): void {
  session = { idiom, index: 0, written: [...idiom.chars].map(() => false) };
  must<HTMLElement>("#soul-reroll-title").textContent = `${idiom.reading} 다시 굴리기`;
  must<HTMLElement>("#soul-reroll-current").textContent = idiom.bonus.label;
  sheet().hidden = false;
  useIndex(0);
}

export function closeSoulReroll(): void {
  session = null;
  sheet().hidden = true;
}

export function isSoulRerollOpen(): boolean {
  return session !== null;
}

/*
 * 개발 전용 QA 손잡이 — 손그림 채점은 글꼴 렌더링에 좌우돼 시험에서 불안정하다.
 * 부적 패널과 같은 처방으로, 마스크 격자를 따라 **실제 포인터 이벤트를 합성**해
 * 결정론화한다. 제출은 따로다 — 자동 따라쓰기가 통과까지 하지 않는다는 규칙은
 * 여기서도 지킨다.
 */
function autoTraceReroll(): void {
  const ink = document.querySelector<HTMLCanvasElement>("#soul-reroll-ink");
  if (!ink || !maskGrid) return;
  const rect = ink.getBoundingClientRect();
  const dispatch = (type: string, x: number, y: number): void => {
    ink.dispatchEvent(new PointerEvent(type, {
      clientX: rect.left + x * (rect.width / PAPER_WIDTH),
      clientY: rect.top + y * (rect.height / PAPER_HEIGHT),
      pointerId: 9,
      bubbles: true,
      cancelable: true
    }));
  };
  const { columns, rows, counts } = maskGrid;
  for (let row = 0; row < rows; row += 1) {
    const y = (row + 0.5) * CELL_SIZE;
    let runStart = -1;
    for (let column = 0; column <= columns; column += 1) {
      const filled = column < columns && (counts[row * columns + column] ?? 0) > 0;
      if (filled && runStart < 0) runStart = column;
      if (!filled && runStart >= 0) {
        dispatch("pointerdown", (runStart + 0.5) * CELL_SIZE, y);
        dispatch("pointermove", (column - 0.5) * CELL_SIZE, y);
        dispatch("pointerup", (column - 0.5) * CELL_SIZE, y);
        runStart = -1;
      }
    }
  }
  refreshScore();
}

if (import.meta.env.DEV) {
  Object.assign(window, {
    __HANJA_SOUL_QA__: {
      autoTrace: autoTraceReroll,
      submit,
      roll,
      currentChar: () => (session ? currentChar() : null),
      isOpen: isSoulRerollOpen
    }
  });
}
