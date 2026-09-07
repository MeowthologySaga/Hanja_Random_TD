/*
 * 자령 유래 — 「이 그림이 왜 이런가」 (v041).
 *
 * "검수에서 걸린 스프라이트 예를 들어 올래 같은애는 도감에 유래를 잘 설명한다면
 * 유저가 억지라고 생각 하지 않을 것 같아"(사용자).
 *
 * v037 일러스트 감사에서 걸린 210자 가운데 열둘은 **그림이 틀린 것이 아니었다.**
 * 그 글자의 옛 자형이나 어원을 정확히 그렸는데, 지금 훈으로는 안 읽히는 것이다 —
 * 來의 보리 이삭, 爲의 코끼리, 字의 지붕 아래 아이처럼. 그림을 다시 그리는 대신
 * 도감이 그 사연을 말하면 억지가 지식이 된다.
 *
 * 문장은 **코어가 만든다**. 화면은 자리에 놓고 글자만 새길 뿐이다.
 *
 * 유래는 사실이어야 한다 — 지어내면 한자를 가르치겠다는 게임의 신뢰가 통째로
 * 깨진다. 그래서 이 배본은 손으로 썼고, 설이 갈리는 글자는 `certainty: "갈림"`
 * 으로 표시하고 본문 스스로 「…설도 있다」로 끝난다. 아래 검증이 그 규칙을 적재
 * 시점에 강제한다.
 */
import originData from "../data/jaryeong-origins-v1.json";

export type OriginCertainty = "정설" | "유력" | "갈림";

export interface JaryeongOrigin {
  readonly hanja: string;
  /** 접힌 줄에 보이는 한 마디 — 14자 이하. */
  readonly hook: string;
  /** 본문 — 무엇을 본떴나 → 왜 지금 뜻이 됐나 → 그래서 이 그림이 왜 그런가. */
  readonly body: string;
  /** 근거로 삼은 자료. */
  readonly ground: string;
  readonly certainty: OriginCertainty;
}

const CERTAINTIES: readonly OriginCertainty[] = ["정설", "유력", "갈림"];

/** 본문 길이의 위아래 — 도감 상세는 한 줄 39자이고 넉 줄까지가 첫 화면 안이다. */
const BODY_MIN = 90;

const BODY_MAX = 170;

function assertShape(entries: readonly JaryeongOrigin[], total: number): void {
  if (originData.schema !== "jaryeong-origins-v1") throw new Error("자령 유래: 스키마가 다르다");
  if (entries.length !== total) throw new Error(`자령 유래: total ${total} 인데 항목은 ${entries.length}개다`);
  const seen = new Set<string>();
  for (const entry of entries) {
    if ([...entry.hanja].length !== 1) throw new Error(`자령 유래: 한 글자가 아니다 — ${entry.hanja}`);
    if (seen.has(entry.hanja)) throw new Error(`자령 유래: 같은 글자가 둘 — ${entry.hanja}`);
    seen.add(entry.hanja);
    if ([...entry.hook].length > 14) throw new Error(`자령 유래: 곁말이 14자를 넘는다 — ${entry.hanja}`);
    const length = [...entry.body].length;
    if (length < BODY_MIN || length > BODY_MAX) {
      throw new Error(`자령 유래: 본문 길이 ${length}자 — ${entry.hanja}(${BODY_MIN}~${BODY_MAX} 사이)`);
    }
    if (!CERTAINTIES.includes(entry.certainty)) throw new Error(`자령 유래: 확실성 값이 이상하다 — ${entry.hanja}`);
    // 설이 갈리는 글자는 본문 스스로 그 사실을 말해야 한다 — 배지를 따로 만들지 않는다.
    if (entry.certainty === "갈림" && !entry.body.includes("설도 있다")) {
      throw new Error(`자령 유래: 갈림인데 본문이 다른 설을 안 밝힌다 — ${entry.hanja}`);
    }
  }
}

const ORIGINS: readonly JaryeongOrigin[] = Object.freeze(
  originData.entries.map((entry) => Object.freeze({
    hanja: entry.hanja,
    hook: entry.hook,
    body: entry.body,
    ground: entry.ground,
    certainty: entry.certainty as OriginCertainty
  }))
);

assertShape(ORIGINS, originData.total);

const BY_CHAR = new Map(ORIGINS.map((origin) => [origin.hanja, origin]));

export const JARYEONG_ORIGIN_META = Object.freeze({
  edition: originData.edition,
  total: ORIGINS.length
});

/** 그 글자의 유래문 — 없으면 undefined(대부분의 글자가 그렇다). */
export function jaryeongOrigin(char: string): JaryeongOrigin | undefined {
  return BY_CHAR.get(char);
}

export function allJaryeongOrigins(): readonly JaryeongOrigin[] {
  return ORIGINS;
}
