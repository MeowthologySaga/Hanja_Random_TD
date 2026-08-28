/*
 * 집자소 — 한자를 써서 성어 능력을 다시 굴린다.
 *
 * ── 왜 「쓰기」인가
 *
 * 새긴 성어의 능력은 무작위다. 꽝이 나오면 자혼 넷이 통째로 아깝다. 그렇다고
 * 공짜로 다시 굴리게 두면 굴림이 뜻을 잃는다 — 아무거나 새겨 놓고 원하는 축이
 * 나올 때까지 누르면 되기 때문이다.
 *
 * 그래서 값을 **손으로** 치르게 한다. 그 성어를 이루는 네 글자 중 하나를
 * 부적에 써 내면 한 번 다시 굴린다. 이 게임이 부적 만들기에서 이미 쓰는
 * 매커니즘 그대로다 — 값이 엽전도 자혼도 아니라 **글자를 쓸 줄 아는가**라서,
 * 다시 굴릴수록 그 글자를 손이 외운다. 벌이 곧 학습이 되는 자리다.
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
import { must } from "../app-context";
import { rasterizeImageAlpha, scoreTalismanDrawing, TALISMAN_THRESHOLDS, type TalismanCellGrid } from "./talisman-score";

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
  /** 지금 쓰고 있는 글자. 넷 중 사람이 고른다. */
  char: string;
}

let session: RerollSession | null = null;
let guideContext: CanvasRenderingContext2D | null = null;
let inkContext: CanvasRenderingContext2D | null = null;
let maskData: Uint8ClampedArray | null = null;
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
  drawGlyph(context, char, "#000");
  maskData = context.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT).data;
  maskGrid = rasterizeImageAlpha(maskData, PAPER_WIDTH, PAPER_HEIGHT, CELL_SIZE, 120);
}

function clearInk(): void {
  inkContext?.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
  drawing = false;
  refreshScore();
}

function setStatus(text: string): void {
  must<HTMLElement>("#soul-reroll-status").textContent = text;
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
  if (score.inkPixels === 0) {
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

/** 고를 수 있는 네 글자를 그린다. 겹친 글자는 한 번만 세운다. */
function renderChoices(): void {
  if (!session) return;
  const row = must<HTMLElement>("#soul-reroll-chars");
  const unique = [...new Set([...session.idiom.chars])];
  row.replaceChildren(
    ...unique.map((char) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = char === session?.char ? "soul-reroll-char is-active" : "soul-reroll-char";
      button.dataset.rerollChar = char;
      button.textContent = char;
      button.setAttribute("aria-pressed", char === session?.char ? "true" : "false");
      return button;
    })
  );
}

function useChar(char: string): void {
  if (!session) return;
  session.char = char;
  prepareMask(char);
  if (guideContext) drawGlyph(guideContext, char, "rgba(34, 26, 16, 0.2)");
  clearInk();
  renderChoices();
}

/** 다 썼는가 — 부적 완성과 같은 문턱이다. */
function submit(): void {
  if (!session || !readArchive || !writeArchive) return;
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
    const point = canvasPoint(ink, event);
    strokeSegment(point, point);
    refreshScore();
  });
  ink.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const point = canvasPoint(ink, event);
    strokeSegment(point, point);
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
    ink.addEventListener(type, () => {
      if (!drawing) return;
      drawing = false;
      refreshScore();
    });
  }

  must<HTMLElement>("#soul-reroll-chars").addEventListener("click", (event) => {
    const char = (event.target as HTMLElement).closest<HTMLElement>("[data-reroll-char]")?.dataset.rerollChar;
    if (char) useChar(char);
  });
  must<HTMLButtonElement>("#soul-reroll-clear").addEventListener("click", clearInk);
  must<HTMLButtonElement>("#soul-reroll-submit").addEventListener("click", submit);
  must<HTMLButtonElement>("#soul-reroll-cancel").addEventListener("click", closeSoulReroll);
}

export function openSoulReroll(idiom: CustomIdiom): void {
  session = { idiom, char: [...idiom.chars][0] ?? "" };
  must<HTMLElement>("#soul-reroll-title").textContent = `${idiom.reading} 다시 굴리기`;
  must<HTMLElement>("#soul-reroll-current").textContent = idiom.bonus.label;
  sheet().hidden = false;
  useChar(session.char);
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
      currentChar: () => session?.char ?? null,
      isOpen: isSoulRerollOpen
    }
  });
}
