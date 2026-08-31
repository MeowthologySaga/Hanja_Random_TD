/*
 * 적 체력바의 **뒤따르는 띠** — 방금 깎인 만큼을 눈에 보이게 남긴다.
 *
 * 여태 피해는 글자로 떴다. 「약점 48」 같은 수치가 타격마다 튀어 올랐는데,
 * 웨이브 약점 오행에 맞춰 짓는 것이 정석이라 사실상 **모든 타격**이 그 조건에
 * 걸렸다 — 48개짜리 풀이 늘 꽉 차서 화면이 숫자 벽이 됐다("데미지 문구 너무
 * 눈 아파서 없애고 싶어" — 사용자).
 *
 * 그래서 숫자를 걷고 체력바가 대신 말하게 한다. 몬스터 헌터의 붉은 체력처럼
 * 앞 띠는 곧바로 줄고 **뒤 띠가 잠깐 머물렀다 따라 내려온다.** 얼마나 깎였는지가
 * 그 간격의 길이로 읽히고, 글자가 시야를 가리지 않는다.
 *
 * 색으로 타격의 결도 남긴다 — 약점은 푸른빛, 치명은 금빛, 그 밖은 잉걸색이다.
 * 수치는 사라져도 「무엇이 잘 들었는지」는 남아야 한다.
 */

export type HitTone = "normal" | "weakness" | "critical";

/** 깎인 뒤 뒤 띠가 머무는 시간(초) — 눈이 그 간격을 한 번 짚을 만큼. */
const HOLD_SECONDS = 0.26;

/** 머문 뒤 따라 내려오는 속도(1초에 전체 길이의 몇 배). */
const DRAIN_PER_SECOND = 1.35;

/** 손대지 않은 지 이만큼(초) 지난 적은 잊는다 — 죽은 적의 자리를 들고 있지 않게. */
const FORGET_SECONDS = 2;

interface Trail {
  /** 뒤 띠가 가리키는 비율(0~1). 앞 띠보다 크거나 같다. */
  value: number;
  tone: HitTone;
  /** 이 시각(게임 초)까지는 머문다. */
  holdUntil: number;
  seenAt: number;
}

const trails = new Map<number, Trail>();

/*
 * 게임 시각을 쓴다 — 벽시계가 아니라.
 *
 * 일시정지 중에 뒤 띠가 계속 내려오면 멈춘 화면에서 혼자 움직이고, 배속을
 * 올리면 그만큼 빨리 따라와야 한다. 둘 다 게임 시각이 알아서 해 준다.
 */
let clock = 0;
let delta = 0;

/** 프레임마다 한 번 — 시각을 옮기고 오래된 자국을 잊는다. */
export function advanceEnemyHealth(elapsedSeconds: number): void {
  /*
   * 시각이 뒤로 갔다면 판이 새로 선 것이다.
   *
   * 그냥 두면 `clock - seenAt` 이 음수라 아래 잊기가 영영 안 걸리고, 지난 판의
   * 자국이 같은 번호를 받은 새 적에게 붙는다. 적 번호는 판마다 처음부터
   * 매겨지므로 실제로 겹친다.
   */
  if (elapsedSeconds < clock) {
    resetEnemyHealth();
    clock = elapsedSeconds;
    return;
  }
  delta = elapsedSeconds - clock;
  clock = elapsedSeconds;
  if (trails.size === 0) return;
  for (const [id, trail] of trails) {
    if (clock - trail.seenAt > FORGET_SECONDS) trails.delete(id);
  }
}

/** 타격의 결을 적어 둔다 — 색과 머무는 시간이 여기서 갱신된다. */
export function noteEnemyHit(enemyId: number, tone: HitTone): void {
  const trail = trails.get(enemyId);
  if (!trail) {
    trails.set(enemyId, { value: 1, tone, holdUntil: clock + HOLD_SECONDS, seenAt: clock });
    return;
  }
  trail.holdUntil = clock + HOLD_SECONDS;
  trail.seenAt = clock;
  /*
   * 약점·치명은 잉걸색을 덮어쓴다. 한 붓질에 여러 타격이 겹칠 때 더 말할 값이
   * 있는 쪽을 남긴다.
   */
  if (tone !== "normal" || trail.tone === "normal") trail.tone = tone;
}

/**
 * 이 적의 뒤 띠를 지금 시각에 맞춰 옮기고 그 값을 돌려준다.
 *
 * 앞 띠(실제 체력)보다 뒤에 있을 때만 뜻이 있고, 체력이 올랐거나 처음 보는
 * 적이면 곧바로 붙인다.
 */
export function enemyHealthTrail(enemyId: number, ratio: number): { readonly value: number; readonly tone: HitTone } {
  const clamped = Math.max(0, Math.min(1, ratio));
  const trail = trails.get(enemyId);
  if (!trail) {
    trails.set(enemyId, { value: clamped, tone: "normal", holdUntil: 0, seenAt: clock });
    return { value: clamped, tone: "normal" };
  }
  trail.seenAt = clock;
  if (clamped >= trail.value) {
    trail.value = clamped;
    return { value: clamped, tone: trail.tone };
  }
  if (clock >= trail.holdUntil) {
    trail.value = Math.max(clamped, trail.value - DRAIN_PER_SECOND * delta);
  }
  return { value: trail.value, tone: trail.tone };
}

/** 판이 새로 설 때 — 지난 판의 자국이 새 적에게 붙지 않게. */
export function resetEnemyHealth(): void {
  trails.clear();
  clock = 0;
  delta = 0;
}

/** 뒤 띠의 색. 수치가 사라진 자리에서 「무엇이 잘 들었는지」를 대신 말한다. */
export function healthTrailColor(tone: HitTone): string {
  switch (tone) {
    case "critical":
      return "#ffd45e";
    case "weakness":
      return "#7ef0be";
    default:
      return "#ff7a5c";
  }
}
