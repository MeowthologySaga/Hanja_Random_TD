/*
 * 적 체력바의 **뒤따르는 붉은 띠** — 방금 깎인 만큼을 눈에 보이게 남긴다.
 *
 * 여태 피해는 글자로 떴다. 「약점 48」 같은 수치가 타격마다 튀어 올랐는데,
 * 웨이브 약점 오행에 맞춰 짓는 것이 정석이라 사실상 **모든 타격**이 그 조건에
 * 걸렸다 — 48개짜리 풀이 늘 꽉 차서 화면이 숫자 벽이 됐다("데미지 문구 너무
 * 눈 아파서 없애고 싶어" — 사용자).
 *
 * 그래서 숫자를 걷고 체력바가 대신 말하게 한다. 몬스터 헌터의 붉은 체력처럼
 * 앞 띠는 곧바로 줄고 **뒤 띠가 잠깐 머물렀다 따라 내려온다.**
 *
 * ── 이 띠의 목적은 「남아 있는 것」이 아니라 「줄어드는 움직임」이다 (v039) ──
 *
 * "이 효과는 데미지 표시가 눈 아파서 없앤 거고, 없애는 대신 피 다는 효과를
 *  표시해주기 위한 거야. 그러니까 빨간 피 부분을 너무 유지하지마"(사용자).
 *
 * 앞 판은 정확히 그 반대였다. `noteEnemyHit` 이 **타격마다** 머무름 시계를
 * 다시 감았는데, 이 게임은 자령 여럿이 쉬지 않고 때린다 — 시계가 영영 안 끝나
 * 붉은 띠가 줄지 않고 **그냥 서 있었다.** 움직임이 없으니 「방금 이만큼 깎였다」가
 * 아니라 그저 두 색으로 갈린 막대가 됐고, 걷어 낸 숫자의 몫을 못 했다.
 *
 * 이제 머무름은 **뒤 띠가 앞 띠에 붙어 있을 때만** 걸린다. 한 번 뒤처지면
 * 붙을 때까지 계속 내려오므로, 맞는 동안 붉은 띠는 늘 흐른다.
 */

/** 깎인 뒤 뒤 띠가 머무는 시간(초) — 눈이 그 간격을 한 번 짚을 만큼만. */
const HOLD_SECONDS = 0.16;

/** 머문 뒤 따라 내려오는 속도(1초에 전체 길이의 몇 배). */
const DRAIN_PER_SECOND = 2.4;

/** 손대지 않은 지 이만큼(초) 지난 적은 잊는다 — 죽은 적의 자리를 들고 있지 않게. */
const FORGET_SECONDS = 2;

/**
 * 남은 피 — **적 종류와 무관하게 하나다**(v039).
 *
 * 예전에는 아키타입마다 달랐다(보통 보라 · 무리 자주 · 질풍 하늘 · 철갑 갈색 ·
 * 회생 초록 · 우두머리 분홍빨강). 그래서 ① 같은 막대가 적마다 다른 색이라 눈이
 * 기준을 못 잡았고 ② 회생의 초록과 뒤 띠의 연두가 서로 안 보였으며
 * ③ 우두머리의 분홍빨강은 붉은 뒤 띠와 아예 구분이 안 됐다
 * ("적마다 체력 색이 다른데 통일하고 … 초록과 연두는 잘 안보여" — 사용자).
 *
 * 호분 크림 하나로 통일한다. 어두운 전장 위에서도, 붉은 뒤 띠 옆에서도 선다
 * — 실측 대비 바탕 먹판 17.7:1 · 뒤 띠 4.63:1. (걷어 낸 짝은 회생 초록 막대와
 * 약점 연두 띠가 1.54:1, 우두머리 분홍빨강과 잉걸 띠가 1.12:1 이었다.)
 * 적의 종류는 초상·크기·약점 인장이 이미 말한다.
 */
export const HEALTH_BAR_COLOR = "#f7f0e2";

/**
 * 방금 깎인 피 — 하나의 붉은색.
 *
 * 예전에는 타격의 결을 색으로 남겼다(약점 연두 · 치명 금빛 · 그 밖 잉걸). 그런데
 * 약점은 적 발밑 인장과 상단 띠가 이미 말하고, 세 색이 돌아가면 「붉은 피」라는
 * 한 가지 약속이 깨진다. 무엇보다 약점의 연두가 회생 적의 초록 막대 위에서
 * 사라졌다. 결은 타격 섬광이 맡고, 이 띠는 **깎인 양**만 말한다.
 */
export const HEALTH_TRAIL_COLOR = "#cf2a1e";

interface Trail {
  /** 뒤 띠가 가리키는 비율(0~1). 앞 띠보다 크거나 같다. */
  value: number;
  /** 이 시각(게임 초)까지는 머문다. */
  holdUntil: number;
  seenAt: number;
  /**
   * 앞 띠에 붙어 있는가.
   *
   * 붙어 있을 때만 새 타격이 머무름을 건다. 뒤처져 흐르는 중에 또 맞았다고
   * 시계를 다시 감으면, 쉬지 않고 맞는 적의 띠가 영영 안 줄어든다.
   */
  caughtUp: boolean;
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

/**
 * 맞았다고 적어 둔다 — 머무름은 **붙어 있을 때만** 다시 걸린다.
 *
 * 이 한 줄이 v039 의 요점이다. 위 머리말을 보라.
 */
export function noteEnemyHit(enemyId: number): void {
  const trail = trails.get(enemyId);
  if (!trail) {
    trails.set(enemyId, { value: 1, holdUntil: clock + HOLD_SECONDS, seenAt: clock, caughtUp: false });
    return;
  }
  trail.seenAt = clock;
  if (!trail.caughtUp) return;
  trail.holdUntil = clock + HOLD_SECONDS;
  trail.caughtUp = false;
}

/**
 * 이 적의 뒤 띠를 지금 시각에 맞춰 옮기고 그 값을 돌려준다.
 *
 * 앞 띠(실제 체력)보다 뒤에 있을 때만 뜻이 있고, 체력이 올랐거나 처음 보는
 * 적이면 곧바로 붙인다.
 */
export function enemyHealthTrail(enemyId: number, ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  const trail = trails.get(enemyId);
  if (!trail) {
    trails.set(enemyId, { value: clamped, holdUntil: 0, seenAt: clock, caughtUp: true });
    return clamped;
  }
  trail.seenAt = clock;
  if (clamped >= trail.value) {
    trail.value = clamped;
    trail.caughtUp = true;
    return clamped;
  }
  if (clock >= trail.holdUntil) {
    trail.value = Math.max(clamped, trail.value - DRAIN_PER_SECOND * delta);
  }
  // 앞 띠에 닿았으면 다음 타격이 다시 머무름을 걸 수 있다.
  trail.caughtUp = trail.value <= clamped + 0.000001;
  return trail.value;
}

/** 판이 새로 설 때 — 지난 판의 자국이 새 적에게 붙지 않게. */
export function resetEnemyHealth(): void {
  trails.clear();
  clock = 0;
  delta = 0;
}
