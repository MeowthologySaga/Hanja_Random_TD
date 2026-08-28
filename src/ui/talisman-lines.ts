/*
 * 부적 자령의 말 — 스물아홉 줄.
 *
 * DOM 도 엔진도 모르는 순수 모듈이다. 연출 파일(talisman-reward.ts)은 화면을
 * 만드느라 app-context 를 끌고 오고, app-context 는 불러오는 순간 window 를
 * 읽는다 — 그 안에 두면 화면 없이 이 규칙을 잴 수 없다.
 */
import type { TalismanRewardKind } from "./talisman-reward";

/*
 * 자령의 말 — 스물아홉 줄.
 *
 * "왜 이 자령이 나에게 보상을 주는가"의 당위를 말로 세운다. 세계관은 이미
 * 답을 갖고 있다 — 자령은 부적에 깃드는 영이고, 사람이 제 이름을 바르게
 * 써 주어야 불려 나온다. 그러니 이 보상은 적선이 아니라 **삯**이다.
 * 그 사실을 자령이 직접 말하게 두면 연출이 설명을 대신한다.
 *
 * 보상 종류마다 갈래를 나눈 이유: 엽전·문기·소환권은 자령이 갚는 방식이
 * 서로 다르다. 엽전은 삯, 문기는 제 기운을 나눠 준 것, 소환권은 다음 벗을
 * 부를 자리를 남긴 것이다. 같은 말투로 뭉뚱그리면 무엇을 받았는지 흐려진다.
 *
 * 고르기는 Math.random 이다 — 엔진의 시드 난수기(SeededRng)를 쓰면 안 된다.
 * 그 난수기는 상태가 uint32 하나라 한 번만 더 당겨도 뒤따르는 소환·웨이브가
 * 전부 다른 눈을 보게 되고, 런 저장·이어하기와 시뮬 해시 동일성이 함께
 * 깨진다. 부적 기능은 이미 이 축 바깥에 서 있다(보상 굴림도 Math.random).
 */
const TALISMAN_VISIT_LINES: Readonly<Record<TalismanRewardKind, readonly string[]>> = Object.freeze({
  gold: Object.freeze([
    "불러 주어 고맙네. 노잣돈이라 여기게",
    "붓끝이 곧았으니 엽전으로 갚음세",
    "내 이름을 바로 썼으니, 값을 치르는 건 이쪽일세",
    "획을 아끼지 않았구먼. 나도 아끼지 않겠네",
    "종이에 갇혀 지낸 값이라 치게",
    "이 엽전은 자네 손끝에서 나온 것일세",
    "먹이 마르기 전에 받아 두게",
    "잘 썼네. 삯은 후하게 쳐 주지",
    "글씨가 밥을 먹인다는 말, 오늘은 참일세",
    "나를 옮겨 적었으니 곳간도 옮겨 주겠네"
  ]),
  essence: Object.freeze([
    "내 기운이 자네 획을 타고 흘렀네",
    "오행이 한 획씩 자네에게 옮아 붙네",
    "이건 엽전으로는 못 사는 것일세",
    "붓이 지나간 자리에 기운이 고였구먼",
    "글자를 안다는 건 그 기운을 안다는 뜻일세",
    "획순을 지켰으니 기운도 순서대로 주겠네",
    "나를 제대로 불렀으니 제대로 갚겠네",
    "문기는 쌓을수록 무겁다네. 잘 지니게",
    "자네 손이 기억한 것을 내가 기운으로 돌려주네",
    "종이 한 장에서 이만한 기운이 나왔네"
  ]),
  token: Object.freeze([
    "나를 불렀으니, 다음 하나는 내가 부르겠네",
    "벗을 하나 더 데려오게. 값은 내가 치름세",
    "혼자 오기 적적하여 자리를 하나 남기네",
    "이 표를 들고 가면 하나가 더 온다네",
    "자네 글씨가 문을 열었으니, 문은 열어 두겠네",
    "붓 한 자루가 벗 하나를 부르는 법일세",
    "다음에 올 이는 자네가 고르게",
    "나를 옮겨 적은 손이니, 하나쯤 더 믿어 보겠네",
    "부름에 답했으니, 부를 자리도 하나 두고 가네"
  ])
});

/** 직전에 나온 말들. 이 안에 든 줄은 다시 고르지 않는다. */
const recentVisitLines: string[] = [];

/**
 * 이번에 자령이 할 말 한 줄.
 *
 * 직전 여섯 줄은 피한다 — 부적은 웨이브마다 여러 장을 쓰므로, 회피 창이
 * 없으면 같은 말이 연달아 두 번 나오는 일이 실제로 잦다. 여섯은 한 갈래의
 * 절반보다 작아 고를 것이 늘 남는다(가장 짧은 갈래가 아홉 줄이다).
 */
export function pickTalismanVisitLine(kind: TalismanRewardKind): string {
  const pool = TALISMAN_VISIT_LINES[kind];
  const fresh = pool.filter((line) => !recentVisitLines.includes(line));
  const candidates = fresh.length > 0 ? fresh : pool;
  const line = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0] ?? "";
  recentVisitLines.push(line);
  if (recentVisitLines.length > 6) recentVisitLines.shift();
  return line;
}
