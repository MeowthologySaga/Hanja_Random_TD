/*
 * 성어의 뜻에서 효과를 끌어낸다.
 *
 * 여태 천자문 250구의 효과는 `index % 4` 였다. 순서대로 피해·사거리·감속·엽전을
 * 돌려 붙인 것이라, 「가을에 거두고 겨울에 저장한다」에 사거리가 붙고 「이슬이
 * 맺혀 서리가 된다」에 엽전이 붙었다. 성어를 외우게 하려는 게임에서 뜻과 힘이
 * 따로 노는 것은 가르치는 값을 통째로 버리는 짓이다.
 *
 * 그래서 뜻의 낱말을 보고 효과를 정한다. 규칙은 **읽을 수 있어야** 한다 —
 * 「거두다·쌓다·기르다」면 모으는 힘, 「칼·벌·불」이면 치는 힘, 「멀다·펼치다·
 * 오르다」면 닿는 힘. 아래 표가 그 전부이고, 어디에도 안 걸리는 구는 글자에서
 * 뽑은 값으로 정해 같은 구가 늘 같은 힘을 갖게 한다.
 *
 * 진 공격력(formationAttack)은 여기서 쓰지 않는다 — 그 축은 「이 성어가 선
 * 진」이라는 자리 개념이 붙어 있어 커스텀 성어 전용이다(game.ts).
 */
import type { IdiomBonusKind } from "./types";

export interface IdiomEffect {
  readonly kind: IdiomBonusKind;
  readonly value: number;
  readonly label: string;
  readonly color: string;
}

/** 축마다 하나씩 — 값과 문구와 색을 한자리에 묶는다. */
const EFFECTS: Record<Exclude<IdiomBonusKind, "formationAttack">, IdiomEffect> = {
  damage: { kind: "damage", value: 0.12, label: "모든 자령 피해 +12%", color: "#ffb06b" },
  range: { kind: "range", value: 12, label: "모든 자령 사거리 +12", color: "#74dcff" },
  enemySlow: { kind: "enemySlow", value: 0.08, label: "모든 적 이동 속도 -8%", color: "#bca1ff" },
  evolutionGold: { kind: "evolutionGold", value: 4, label: "합성할 때마다 엽전 +4", color: "#9de58c" },
  killEssence: { kind: "killEssence", value: 1, label: "적을 봉인할 때마다 문기 +1", color: "#8fe4ff" },
  waveGold: { kind: "waveGold", value: 8, label: "웨이브를 넘길 때마다 엽전 +8", color: "#ffd56a" },
  weaknessDamage: { kind: "weaknessDamage", value: 0.12, label: "오행 약점 피해 +12%", color: "#ff8fa3" }
};

/**
 * 뜻의 낱말 → 힘.
 *
 * 위에서부터 먼저 걸리는 것을 쓴다. 순서가 곧 우선순위라, 좁고 뚜렷한 것을
 * 위에 둔다 — 「금·옥·보배」는 재물이 분명하지만 「이룬다」는 여러 뜻으로 읽혀
 * 아래에 있어야 한다.
 */
const RULES: ReadonlyArray<{ readonly kind: keyof typeof EFFECTS; readonly words: readonly string[] }> = [
  // 재물 — 금·옥·보배는 웨이브마다 들어오는 엽전으로.
  { kind: "waveGold", words: ["금은", "옥은", "옥도", "구슬", "보배", "귀하", "귀한", "중히", "재물", "영예", "명성"] },
  // 치는 힘 — 무기·벌·불·목숨을 건 자리, 그리고 통솔.
  { kind: "damage", words: ["칼", "벌했", "정벌", "불로", "죄 있는", "훼손", "목숨", "다급", "힘을 다", "힘써", "엄숙", "무왕", "다스", "구별", "신하", "복종"] },
  // 닿는 힘 — 멀리·넓게·높이 미치고 퍼지는 자리.
  { kind: "range", words: ["넓", "아득", "펼쳐", "오른다", "오르면", "날아", "멀리", "먼 곳", "하늘", "온 세상", "온 천하", "이르렀", "전해진다", "들린다", "향기", "노래한다"] },
  // 발을 묶는 힘 — 물·얼음·고요·머무름.
  { kind: "enemySlow", words: ["서리", "이슬", "얼음", "잠기", "물드", "고요", "편안", "침착", "조심", "흐른다", "비춘다", "맑", "무성"] },
  // 허물을 찌르는 힘 — 기울고 물러나고 무너지는 자리.
  { kind: "weaknessDamage", words: ["기운다", "물러간다", "물러난다", "허물", "단점", "잘못", "재앙", "악행", "피로", "흔들", "슬퍼", "어긋남", "잃지"] },
  // 모으는 힘 — 거두고 쌓고 기르는 자리.
  { kind: "killEssence", words: ["거두", "저장", "쌓인", "길렀", "길러", "먹는다", "충만", "나눈다"] },
  // 배우는 힘 — 익히고 고치고 본받고 이루는 자리. 합성이 곧 배움이다.
  { kind: "evolutionGold", words: ["배운", "본받", "고친다", "가르침", "학문", "문자", "법도", "갈고닦", "기억", "잊지", "이룬다", "만들었다", "생각한다", "익히"] }
];

/** 어디에도 안 걸리는 구를 늘 같은 힘으로 보내는 값. */
const FALLBACK: readonly (keyof typeof EFFECTS)[] = ["damage", "range", "enemySlow", "evolutionGold"];

/**
 * 낱말이 **앞 음절에 붙어** 우연히 걸리는 것을 막는다.
 *
 * 부분 문자열로 찾으면 「흔들린다」 안에서 「들린다」가, 「소중히 여긴다」 안에서
 * 「중히 여긴다」가 걸린다. 실제로 둘 다 엉뚱한 힘을 붙였다. 앞 글자가 한글
 * 음절이면 그 낱말의 시작이 아니라고 보고 넘긴다 — 조사·어미가 뒤에 붙는 것은
 * 그대로 허용해야 하므로 뒤쪽은 보지 않는다.
 */
function hasWord(meaning: string, word: string): boolean {
  let from = 0;
  for (;;) {
    const at = meaning.indexOf(word, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : meaning[at - 1] ?? "";
    const glued = before >= "가" && before <= "힣";
    if (!glued) return true;
    from = at + 1;
  }
}

function fingerprint(text: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}

/**
 * 이 구의 힘.
 *
 * `chars` 는 어디에도 안 걸릴 때만 쓴다 — 한자가 같으면 힘도 같아야, 같은 판을
 * 두 번 굴렸을 때 같은 것이 나온다.
 */
export function idiomEffectFor(meaning: string, chars: string): IdiomEffect {
  for (const rule of RULES) {
    for (const word of rule.words) {
      if (hasWord(meaning, word)) return EFFECTS[rule.kind];
    }
  }
  const key = FALLBACK[fingerprint(chars) % FALLBACK.length] as keyof typeof EFFECTS;
  return EFFECTS[key];
}

/** 시험·감사용 — 규칙에 걸렸는지 아니면 글자값으로 갔는지. */
export function idiomEffectSource(meaning: string): "rule" | "fallback" {
  for (const rule of RULES) {
    for (const word of rule.words) {
      if (hasWord(meaning, word)) return "rule";
    }
  }
  return "fallback";
}
