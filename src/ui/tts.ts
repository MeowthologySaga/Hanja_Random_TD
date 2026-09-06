/*
 * 읽기 소리 — 부적을 완성하면 그 글자를 목소리로 한 번 더 준다 (v038).
 *
 * "설정 옵션으로 부적모드에서 tts로 부적완성 시 훈 음, 중국어는 한어병음을
 *  읽어주는 기능 추가해줘. 기본값은 꺼져있게 해 줘"(사용자).
 *
 * 이 모듈은 **잎**이다 — app-context·hud 를 수입하지 않는다. 켬/끔은 부르는
 * 쪽(설정)이 쥐고, 여기는 "무엇을 어느 말로 어떻게 말하는가"만 안다. 그래서
 * 브라우저 없이도(vitest) 문장 만들기를 그대로 시험할 수 있다.
 *
 * ── 표기 축이 무엇을 어느 말로 읽는가 ──────────────────────────────
 *   kr-hunum   훈음   「먹을 식」   → ko-KR 로 그대로 읽는다.
 *   jp-onkun   음훈   「シン·ケン」 → ja-JP 로 읽는다(가운뎃점은 쉼표로 바꾼다).
 *   cn-pinyin  병음   「shēn」      → **한자(身)를 zh-CN 목소리로** 읽는다.
 *
 * 마지막 줄이 이 모듈의 유일한 판단이다. 병음은 성조 기호가 붙은 로마자라,
 * 그 문자열을 그대로 넘기면 목소리가 무엇이냐에 따라 "에스-에이치-이-엔"이나
 * 엉뚱한 영어 발음이 나온다. 한자를 중국어 목소리에 넘기면 그 목소리가 곧
 * 표준 중국어 발음(=병음이 적어 둔 그 소리)을 낸다 — 사용자가 원한 것은
 * 로마자 철자가 아니라 그 발음이다. 중국어 목소리가 없는 기기에서만 병음
 * 문자열로 물러선다(그 편이 침묵보다 낫다).
 */
import type { NotationCode } from "../core/types";

/** 표기 축 → 발음 언어. */
const SPEECH_LANG: Record<NotationCode, string> = {
  "kr-hunum": "ko-KR",
  "jp-onkun": "ja-JP",
  "cn-pinyin": "zh-CN"
};

export interface ReadingUtterance {
  /** 실제로 말할 글. */
  readonly text: string;
  /** BCP-47 언어 태그. */
  readonly lang: string;
  /** 이 발화가 가리키는 한자 — QA·기록용. */
  readonly char: string;
}

/**
 * 무엇을 말할지 정한다 — 순수 함수.
 *
 * `reading` 은 화면의 읽기 줄이 쓰는 그 값(learningInfoForNotation 의 short)을
 * 그대로 받는다. 새 자료를 만들지 않는 것이 규범이다: 화면과 소리가 다른 것을
 * 말하면 둘 중 하나는 거짓말이 된다.
 */
export function readingUtterance(char: string, notation: NotationCode, reading: string): ReadingUtterance | null {
  const lang = SPEECH_LANG[notation] ?? "ko-KR";
  // 병음은 철자가 아니라 소리를 원한 것이다 — 한자를 중국어 목소리에 넘긴다.
  const spoken = notation === "cn-pinyin" ? char : reading;
  // 가운뎃점은 목소리가 「나카구로」 따위로 읽어 버린다 — 쉼표가 곧 쉼이다.
  const text = spoken.replace(/[·・]/g, ", ").replace(/\s+/g, " ").trim();
  if (text === "") return null;
  return { text, lang, char };
}

/** 마지막으로 말한 것. 소리는 시험이 들을 수 없으므로 여기로 확인한다. */
let lastSpoken: ReadingUtterance | null = null;

/** 이 창에서 실제로 말할 수 있는가(목소리 API 자체가 있는가). */
export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
}

/**
 * 목소리 목록은 늦게 온다.
 *
 * 크롬은 첫 `getVoices()` 에 빈 배열을 주고 잠시 뒤 voiceschanged 로 채운다.
 * 설정을 켜는 순간 한 번 찔러 두면, 정작 부적을 다 썼을 때 목록이 비어 있어
 * 언어를 못 고르는 일이 없다.
 */
export function primeVoices(): void {
  if (!speechAvailable()) return;
  window.speechSynthesis.getVoices();
}

/** 그 언어의 목소리 하나 — 정확히 맞는 것 → 같은 어족(ko·ja·zh) 순. */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const exact = voices.find((voice) => voice.lang.replace("_", "-").toLowerCase() === lang.toLowerCase());
  if (exact) return exact;
  const prefix = lang.slice(0, 2).toLowerCase();
  return voices.find((voice) => voice.lang.replace("_", "-").toLowerCase().startsWith(prefix)) ?? null;
}

/**
 * 한 번 말한다. 켬/끔 판단은 부르는 쪽이 이미 했다.
 *
 * `fallbackText` 는 그 언어의 목소리가 없을 때 대신 말할 글이다(병음 문자열).
 * 목소리가 없는데 한자를 기본 목소리로 넘기면 한국어 음성이 "몸 신"도 아니고
 * "미"도 아닌 소리를 내므로, 차라리 적혀 있는 대로 읽는 편이 정직하다.
 *
 * `onStart`·`onEnd` 는 말하는 동안을 부르는 쪽에 알린다 — 배경음 덕킹이
 * 이 두 지점에 걸린다("부적 tts소리 작아서 배경음에 묻혀" — 사용자).
 * 이 모듈은 소리 설정을 모르는 잎이라, 무엇을 낮출지는 부르는 쪽이 정한다.
 */
export interface SpeakOptions {
  /** 그 언어의 목소리가 없을 때 대신 말할 글(병음 문자열). */
  readonly fallbackText?: string;
  /** 말이 시작될 때 · 끝날 때. 배경음 덕킹이 이 두 지점을 쓴다. */
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
}

export function speakReading(utterance: ReadingUtterance, options: SpeakOptions = {}): boolean {
  lastSpoken = utterance;
  if (!speechAvailable()) return false;
  const synthesis = window.speechSynthesis;
  const voice = pickVoice(utterance.lang);
  const text = voice === null && options.fallbackText ? options.fallbackText : utterance.text;
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = utterance.lang;
  if (voice) speech.voice = voice;
  // 목소리 쪽은 천장까지 올린다 — 배경음을 낮추는 일은 부르는 쪽이 맡는다.
  speech.volume = 1;
  // 훈음 두 마디는 기본 속도로는 뭉개져 들린다. 한 뼘만 늦춘다.
  speech.rate = 0.95;
  /*
   * 끝을 **반드시** 한 번은 알린다.
   *
   * onend 는 취소·오류·목소리 없음에서 안 오는 브라우저가 있다. 덕킹이 그
   * 신호에 걸려 있으므로 한 번이라도 새면 배경음이 눌린 채로 남는다 — 그래서
   * 세 갈래(끝·오류·안전 시계)를 한 문으로 모은다.
   */
  let closed = false;
  const finish = (): void => {
    if (closed) return;
    closed = true;
    window.clearTimeout(guard);
    options.onEnd?.();
  };
  // 글자당 넉넉히 잡은 안전 시계 — 훈음 두 마디는 2초를 넘지 않는다.
  const guard = window.setTimeout(finish, 1_500 + text.length * 220);
  speech.onend = finish;
  speech.onerror = finish;
  // 잇달아 완성해도 겹쳐 읽지 않는다 — 마지막 것만 남긴다.
  synthesis.cancel();
  options.onStart?.();
  synthesis.speak(speech);
  return true;
}

/** 지금 말하는 것을 걷는다 — 설정을 끄거나 창을 떠날 때. */
export function stopReading(): void {
  if (!speechAvailable()) return;
  window.speechSynthesis.cancel();
}

/*
 * 개발 전용 손잡이 — 오디오 QA(__HANJA_AUDIO_QA__)와 같은 결.
 *
 * `typeof window` 를 먼저 묻는다: 이 모듈은 창 없이도(vitest, node 환경) 그대로
 * 수입돼 문장 만들기만 시험받는 잎이라, 여기서 window 를 건드리면 시험이
 * 파일을 여는 순간 터진다(실제로 터졌다).
 */
if (import.meta.env.DEV && typeof window !== "undefined") {
  Object.assign(window, {
    __HANJA_TTS_QA__: {
      last: (): ReadingUtterance | null => lastSpoken,
      available: speechAvailable,
      utterance: readingUtterance
    }
  });
}
