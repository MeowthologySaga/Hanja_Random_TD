/*
 * 자동배치 정책 — 「알아서 놔 줘」의 알아서를 사람이 정한다.
 *
 * 자동배치는 편하지만 남의 손이다. 잠가 둔 자령을 옮기고, 가방을 비우고,
 * 애써 세워 둔 줄을 흩는다 — 그때마다 사람은 「되돌리기」가 없는 판에서
 * 손해를 본다. 그래서 무엇을 건드려도 되는지를 다섯 갈래로 갈라 둔다.
 *
 * 기본값은 **오늘과 똑같다**. 옵션을 아무것도 안 만지면 여태 하던 자동배치가
 * 그대로 돈다 — 새 손잡이가 생겼다고 판이 달라지면 안 된다.
 *
 * 이 모듈은 순수하다. 저장은 UI 가, 적용은 엔진이 한다.
 */

export interface ArrangePolicy {
  /**
   * 잠근 자령은 그 자리에 둔다.
   *
   * 지금은 잠금이 **분해·판매**만 막고 자동배치는 그냥 옮긴다. 자물쇠를 채운
   * 사람의 뜻은 대개 "여기 두고 싶다"이므로 켤 수 있게 한다. 기본은 꺼짐 —
   * 여태 동작이 그랬다.
   */
  readonly keepLocked: boolean;

  /** 가방에서 꺼내 빈 칸을 채운다. 끄면 전장에 있는 것만 가지고 맞춘다. */
  readonly deployFromInventory: boolean;

  /** 전장에 이미 선 자령도 옮긴다. 끄면 빈 칸 채우기만 한다. */
  readonly rearrangeBoard: boolean;

  /** 성어 줄을 먼저 맞춘다. 끄면 오행 공명만 맞춘다. */
  readonly idiomFirst: boolean;

  /**
   * 남는 칸은 이번 웨이브 약점 오행부터 채운다.
   *
   * 약점 오행 자령은 그 웨이브에 피해가 배로 들어간다. 기본은 꺼짐 —
   * 켜면 판이 웨이브마다 흔들리므로 고르는 사람의 몫으로 둔다.
   */
  readonly weaknessFirst: boolean;
}

/** 아무것도 안 만졌을 때. 여태 하던 자동배치 그대로다. */
export const DEFAULT_ARRANGE_POLICY: ArrangePolicy = Object.freeze({
  keepLocked: false,
  deployFromInventory: true,
  rearrangeBoard: true,
  idiomFirst: true,
  weaknessFirst: false
});

/** 화면에 세울 다섯 갈래 — 순서가 곧 옵션 목록의 순서다. */
export const ARRANGE_POLICY_OPTIONS: readonly {
  readonly key: keyof ArrangePolicy;
  readonly label: string;
  readonly hint: string;
}[] = Object.freeze([
  {
    key: "keepLocked",
    label: "잠근 자령은 그 자리에",
    hint: "자물쇠를 채운 자령을 옮기지 않습니다"
  },
  {
    key: "deployFromInventory",
    label: "가방에서 꺼내 채우기",
    hint: "빈 칸이 있으면 가방 자령을 내보냅니다"
  },
  {
    key: "rearrangeBoard",
    label: "전장 자령도 옮기기",
    hint: "끄면 이미 선 자령은 손대지 않고 빈 칸만 채웁니다"
  },
  {
    key: "idiomFirst",
    label: "성어 줄을 먼저 맞추기",
    hint: "끄면 오행 공명만 맞춥니다"
  },
  {
    key: "weaknessFirst",
    label: "남는 칸은 약점 오행부터",
    hint: "이번 웨이브 약점 오행 자령을 먼저 내보냅니다"
  }
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 저장된 글을 정책으로 읽는다.
 *
 * 모르는 열쇠는 버리고 빠진 열쇠는 기본값으로 메운다 — 갈래가 늘어도 옛
 * 저장본이 그대로 열린다.
 */
export function parseArrangePolicy(raw: string | null): ArrangePolicy {
  if (!raw) return DEFAULT_ARRANGE_POLICY;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_ARRANGE_POLICY;
  }
  if (!isRecord(parsed)) return DEFAULT_ARRANGE_POLICY;
  const next: Record<string, boolean> = { ...DEFAULT_ARRANGE_POLICY };
  for (const option of ARRANGE_POLICY_OPTIONS) {
    const value = parsed[option.key];
    if (typeof value === "boolean") next[option.key] = value;
  }
  return next as unknown as ArrangePolicy;
}

/** 기본값과 다른 갈래 수 — 톱니 옆에 「2」처럼 적어 손댔음을 알린다. */
export function changedArrangeOptions(policy: ArrangePolicy): number {
  return ARRANGE_POLICY_OPTIONS.filter((option) => policy[option.key] !== DEFAULT_ARRANGE_POLICY[option.key]).length;
}
