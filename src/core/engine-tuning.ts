/*
 * 엔진 조율 상수와 순수 계산.
 *
 * game.ts 에서 그대로 옮겨 왔다 — 비용식·관문 표·모드 계수·견적 보조처럼
 * 엔진 상태(`this`)를 하나도 보지 않는 것들이다. 수치를 만지는 사람이
 * 3,700줄을 헤집지 않아도 되도록 한곳에 모은다.
 */
import { casualNaturalStar, casualStrokeCount } from "./casual";
import { type CasualFusionIssue, type CasualFusionIssueKind } from "./engine-quotes";
import { SeededRng } from "./rng";
import {
  type AbilityZone,
  type CasualStar,
  type CombatRole,
  type ConcentrationLevel,
  type ConcentrationPath,
  type GameMode,
  type HanziCatalog,
  type HanziDefinition,
  type Point,
  type RegionCode,
  type Stage,
  type StatUpgradeLevels,
  type SummonIntent,
  type Wuxing
} from "./types";

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const ELEMENT_ZONE_SPECS: Record<Wuxing, { kind: AbilityZone["kind"]; label: string; damageRatio: number; radius: number; duration: number }> = {
  木: { kind: "roots", label: "가시뿌리밭", damageRatio: 0.29, radius: 112, duration: 5.4 },
  火: { kind: "lava", label: "용암화염지대", damageRatio: 0.5, radius: 105, duration: 4.8 },
  土: { kind: "quicksand", label: "유사진흙지대", damageRatio: 0.24, radius: 125, duration: 5.8 },
  金: { kind: "caltrops", label: "쇠압정지대", damageRatio: 0.4, radius: 108, duration: 5.1 },
  水: { kind: "rain", label: "비구름냉우", damageRatio: 0.34, radius: 120, duration: 5.6 }
};

export function elementZoneKind(wuxing: Wuxing): AbilityZone["kind"] {
  return ELEMENT_ZONE_SPECS[wuxing].kind;
}

/**
 * 캐주얼 티어 소환 3종. 별 밴드만 다르고 나머지 규칙은 같으므로
 * 짝 맞추기 가중은 이 셋에 공통으로 적용한다.
 */
export const TIERED_SUMMON_INTENTS: ReadonlySet<SummonIntent> = new Set<SummonIntent>(["balanced", "midstar", "highstar"]);

/**
 * 인연 연구가 성어 부족 글자에 얹는 가중 배율(트랙 B — "성어가 곧 목표").
 *
 * 목표 한자 경로는 connectionBonus×3.2 를 받는데, 성어 경로는 연구와 무관했다.
 * 목표 서책이 성어 축으로 통합되면서 연구의 절반은 성어 부족 글자를 향해야
 * 한다. 곱해지는 값은 0단계 기저(0.12)를 뺀 "실제로 산 연구"만이라 연구 전
 * 분포는 통합 이전과 동일하다. 같은 3.2 에서 시작하되 성어 줄 전체에 ×0.7 이
 * 곱해지므로 실효는 목표 경로의 약 2.24 다. 시뮬 게이트(--runs=135 표준 /
 * 45 캐주얼)를 벗어나면 이 값부터 줄인다.
 */
export const IDIOM_RESEARCH_CONNECTION_SCALE = 3.2;

/** 캐주얼 소환의 실효 별 밴드. 상·하한 모두 포함하는 닫힌 구간이다. */
export interface SummonStarBand {
  readonly min: number;
  readonly max: number;
}

/**
 * 밴드 안에서 별이 하나 오를 때마다 곱해지는 감쇠. 밴드 하한이 가장 흔하고
 * 상한이 가장 귀하다. 글자 수(1★ 332자 · 8★ 18자)에 눌리지 않도록 별 단위
 * 목표 분포로 먼저 나눈 뒤 같은 별의 글자들이 그 몫을 나눠 갖는다.
 */
export const CASUAL_STAR_DECAY = 0.55;

/**
 * 밴드 상한 위 "잭팟 꼬리" 감쇠 — 원 기획 복원(gripe #10).
 *
 * 하한은 하드다("2★ 확정"의 확정은 하한 보장). 상한만 소프트여서, 기본
 * 소환도 아주 낮은 확률로 상한 위 별이 나온다 — 별이 오를수록 확률이 확
 * 떨어진다. 상한 초과 별은 [상한 몫 × 이 값^(초과 칸수)]를 받는다.
 * 0.12 기준 기본 소환(1~3★ 밴드): 4★ 1.9% · 5★ 0.23% · 8★ 0.0004%(로또).
 */
export const CASUAL_STAR_TAIL_DECAY = 0.12;

/**
 * 별 하나가 받는 목표 분포 몫(정규화 전). 하한 밑은 0(하드), 밴드 안은
 * `CASUAL_STAR_DECAY^(별-하한)`, 상한 위는 상한 몫에 꼬리 감쇠를 곱해 8★까지 잇는다.
 */
export function casualStarBandShare(star: number, band: SummonStarBand): number {
  const min = band.min;
  const max = Math.max(band.min, band.max);
  if (star < min) return 0;
  if (star <= max) return Math.pow(CASUAL_STAR_DECAY, star - min);
  return Math.pow(CASUAL_STAR_DECAY, max - min) * Math.pow(CASUAL_STAR_TAIL_DECAY, star - max);
}

/**
 * 소환 별 분포표(1~8★, 합 1). 확률 공개 UI·보고의 단일 원천 — 수치를 문구에
 * 하드코딩하지 말고 반드시 여기서 계산해 렌더한다(상수를 바꾸면 표가 따라온다).
 * `presentStars` 를 주면 실제 후보가 있는 별만 남겨 재정규화하므로
 * `GameEngine.applyStarBandDecay` 가 만드는 실측 분포와 정확히 일치한다.
 */
export function casualSummonStarDistribution(
  band: SummonStarBand,
  presentStars?: ReadonlySet<number>
): ReadonlyArray<{ star: CasualStar; share: number }> {
  const rows = ([1, 2, 3, 4, 5, 6, 7, 8] as CasualStar[]).map((star) => ({
    star,
    share: presentStars !== undefined && !presentStars.has(star) ? 0 : casualStarBandShare(star, band)
  }));
  const total = rows.reduce((sum, row) => sum + row.share, 0);
  return rows.map((row) => ({ star: row.star, share: total > 0 ? row.share / total : 0 }));
}

export function interestForGold(gold: number): number {
  return Math.min(20, Math.max(0, Math.floor(gold / 20)));
}

export function emptyStatUpgrades(): StatUpgradeLevels {
  return { damage: 0, attackSpeed: 0, range: 0, abilityPower: 0, statusPower: 0 };
}

export function emptyElementUpgrades(): Record<Wuxing, StatUpgradeLevels> {
  return {
    "木": emptyStatUpgrades(),
    "火": emptyStatUpgrades(),
    "土": emptyStatUpgrades(),
    "金": emptyStatUpgrades(),
    "水": emptyStatUpgrades()
  };
}

export function emptyElementEssence(): Record<Wuxing, number> {
  return { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
}

export function sumElementValues(values: Record<Wuxing, number>): number {
  return values.木 + values.火 + values.土 + values.金 + values.水;
}

export const MAX_CONCENTRATION_LEVEL: ConcentrationLevel = 3;

export const FIRST_PREP_SECONDS = 15;

/**
 * 수술 8 ⓑ 「개문 보정」: 1~3웨이브 한정, 시작 진의 자령 사거리 +45.
 *
 * 경로 기하 실측: 사거리 235 이하에서는 외곽 진(수·금·목·화)이 반대편 포탈
 * 출신 적을 최장 16.2초 기다리지만, 250 을 넘기면 3.6초로 무너진다. +45 는
 * 별 사거리 곡선 도입 후 가장 좁은 1★ 진(실효 208)도 그 문턱(253) 위에
 * 올린다. 1장 수호(피해 ×1.15, ~10웨이브)와 같은 정신의 초반 완충 장치로,
 * 무작위 첫 진의 재미는 그대로 두고 "다 돌 때까지 기다림"만 걷어 낸다.
 */
export const GATE_OPENING_WARD = Object.freeze({ untilWave: 3, rangeBonus: 45 });

export const SUMMON_STAGE_WEIGHTS: Record<Stage, number> = { 1: 1, 2: 0.22, 3: 0.075, 4: 0.025, 5: 0.008 };

/*
 * 문기 농축은 "비싼 대체 지불"이다. 원래 설계는 중복 자령을 재료로 쓰는
 * 것인데(중복 소환 카드의 존재 이유), 문기가 4/6/8로 싸니 아무도 중복을
 * 쓰지 않았다. 값을 올려 중복이 기본, 문기가 급할 때의 우회가 되게 한다.
 */
const CONCENTRATION_ESSENCE_COSTS = [10, 16, 24] as const;

/*
 * 분해 환급은 지불 방식과 무관하게 농축 단계만 보고 지급된다. 환급을
 * 인상된 비용표로 계산하면 [중복으로 싸게 농축 → 분해] 가 문기 조폐가
 * 되므로, 환급 기준표는 예전 값에 고정한다.
 */
const CONCENTRATION_ESSENCE_REFUND_BASE = [4, 6, 8] as const;

export function concentrationEssenceCost(currentLevel: number): number {
  return CONCENTRATION_ESSENCE_COSTS[Math.max(0, Math.min(2, currentLevel))] ?? 24;
}

/**
 * 농축 방향은 더 이상 사람이 고르지 않는다 — 역할이 곧 방향이다.
 *
 * 두 갈래(swift=공속 / potent=피해)는 밸런스 상수로 남지만, 무엇을 고를지는
 * 이미 정답이 있었다: 초당 타수로 먹고사는 연사·지원은 공속, 한 방으로 먹고사는
 * 나머지는 피해. 자동 배치 경로가 쓰던 규칙을 그대로 승격시켜 수동 경로와
 * 하나로 합친다. 이미 방향이 박힌 자령은 기존 세이브와의 일관성을 위해
 * 그 방향을 그대로 유지한다.
 */
export function autoConcentrationPath(tower: {
  combatRole: CombatRole;
  concentrationPath?: ConcentrationPath | null;
}): ConcentrationPath {
  if (tower.concentrationPath) return tower.concentrationPath;
  return tower.combatRole === "rapid" || tower.combatRole === "support" ? "swift" : "potent";
}

/** 화면 어디서나 같은 어휘를 쓰도록 방향 이름을 한곳에서 정한다. */
export function concentrationPathLabel(path: ConcentrationPath): string {
  return path === "swift" ? "공속 농축" : "피해 농축";
}

export function concentrationEssenceRefund(level: number): number {
  return Math.floor(CONCENTRATION_ESSENCE_REFUND_BASE.slice(0, Math.max(0, Math.min(3, level))).reduce((sum, cost) => sum + cost, 0) * 0.7);
}

export function dismantleEssenceValue(stage: Stage, concentration = 0): number {
  return Math.max(1, stage * stage + concentrationEssenceRefund(concentration));
}

/**
 * 별승급 진법의 분해 표. 별 하나가 문기 몇 개인가.
 *
 * 자형연성의 `단계²`(1/4/9/16/25)와 달리 별승급은 8칸이라 곡선을 따로 둔다.
 * 3체 승급이 잉여 자령을 전부 먹어 분해할 것이 남지 않으므로, 이 표는
 * 분해뿐 아니라 승급 환급(`casualFusionEssenceRefund`)의 기준이기도 하다.
 */
const CASUAL_DISMANTLE_ESSENCE: readonly number[] = Object.freeze([0, 1, 1, 2, 3, 5, 7, 10, 14]);

const CASUAL_DISMANTLE_SCORE: readonly number[] = Object.freeze([0, 1, 1, 3, 3, 6, 6, 10, 15]);

export function casualDismantleEssence(star: number): number {
  return CASUAL_DISMANTLE_ESSENCE[Math.max(0, Math.min(8, Math.floor(star)))] ?? 1;
}

export function casualDismantleScore(star: number): number {
  return CASUAL_DISMANTLE_SCORE[Math.max(0, Math.min(8, Math.floor(star)))] ?? 1;
}

/**
 * 삼체일득 — 사라진 셋 가운데 한 몫은 문기로 남는다.
 *
 * 별승급 진법에서 문기의 유일한 입구는 분해였는데, 3체 승급이 잉여 자령을 전부
 * 먹어 분해 대기열이 비어 버렸다(실측 분해 0~4기·문기 0~6/런). 승급 자체를
 * 문기 입구로 삼아 두 루프의 재료 경쟁을 없앤다. 돌려주는 양은 소모한 별
 * 1기의 분해값이므로 "셋 중 하나만큼은 되찾는다"가 규칙 문장 그대로다.
 */
export function casualFusionEssenceRefund(fromStar: number): number {
  return casualDismantleEssence(fromStar);
}

export function casualFusionDismantleScore(fromStar: number): number {
  return casualDismantleScore(fromStar);
}

// v3 규칙: 3기가 전부 사라지고 같은 오행의 다음 별 글자 하나를 새로 얻는다.
// 잠금·농축·목표 계보·미완 성어·봉인 성어·일반 합성식 자령은 애초에 3기 어디에도
// 선정되지 않으므로(casualMaterialProtection) 경고가 아니라 차단 사유다.
// `전장 배치` 는 막지 않는다 — 뽑기 후 자동 배치가 기본이라 사실상 모든 자령이
// 전장에 서 있고, 이것을 막으면 [한 번에 승급]이 아무 일도 못 한다. 대신 소모
// 내역과 `전장 N기 소모` 배지로 무엇이 사라지는지 먼저 보여 준다.
// 되돌릴 수 없는 판 손실은 오행진 공명 임계치가 깨지는 경우 하나뿐이다.
const CASUAL_AUTO_SKIP_KINDS = new Set<CasualFusionIssueKind>(["resonance"]);

export function casualAutoSkipReason(warnings: readonly CasualFusionIssue[]): string | null {
  return warnings.find((warning) => warning.kind !== undefined && CASUAL_AUTO_SKIP_KINDS.has(warning.kind))?.text ?? null;
}

/** `火 2★×3 → 3★ 炎 획득!` — 폴백이 있었으면 그대로 덧붙인다. */
export function casualFusionHeadline(info: {
  wuxing: Wuxing;
  char: string;
  fromStar: CasualStar;
  toStar: CasualStar;
  newDiscovery: boolean;
  starFallback: boolean;
  rosterFallback: boolean;
}): string {
  const notes: string[] = [];
  if (info.newDiscovery) notes.push("첫 발견!");
  if (info.starFallback) notes.push(`${info.fromStar + 1}★ 글자가 없어 ${info.toStar}★에서 뽑음`);
  if (info.rosterFallback) notes.push("소환 풀에 없어 지역 로스터에서 보충");
  return `${info.wuxing} ${info.fromStar}★×3 → ${info.toStar}★ ${info.char} 획득!${notes.length > 0 ? ` · ${notes.join(" · ")}` : ""}`;
}

/**
 * (오행, 자연 별) → 글자 목록 색인. 소환 풀은 런마다 새 배열로 다시 만들어지고
 * 지역 로스터는 카탈로그 캐시라 둘 다 참조를 키로 삼는 WeakMap 이면 충분하다.
 */
const casualStarIndexCache = new WeakMap<object, Map<string, HanziDefinition[]>>();

export function casualStarIndexFor(key: object, definitions: Iterable<HanziDefinition>): Map<string, HanziDefinition[]> {
  const cached = casualStarIndexCache.get(key);
  if (cached) return cached;
  const index = new Map<string, HanziDefinition[]>();
  for (const definition of definitions) {
    const star = casualNaturalStar(definition.char);
    if (star === null) continue;
    const bucket = `${definition.wuxing}:${star}`;
    const list = index.get(bucket);
    if (list) list.push(definition);
    else index.set(bucket, [definition]);
  }
  casualStarIndexCache.set(key, index);
  return index;
}

const REGION_ENEMY_HP_CURVE: Record<RegionCode, { base: number; chapterGrowth: number }> = {
  // Five 4x4 elemental formations expose eighty active tower positions.
  // The 80-slot field produces far more sustained fire than the former 20-slot
  // board. JP/CN recipe graphs complete substantially more evolutions, so their
  // durability rises by chapter instead of front-loading a punishing wave-10
  // multiplier. This preserves the opening tutorial curve and checks late snowball.
  //
  // 수술 1 재보정(2026-08, 스킬 1차 세트·수술 9 병합 후 재고정): 유지형
  // 성어를 지키는 봇 + 강화 이정표·8성 오라·광역 별스케일 + 보스 관문 보정
  // 기준으로 세 지역을 45런/지역(--runs=135) 시뮬 승률 0.533~0.600 에 맞춘 값.
  // 승률은 이 계수에 극도로 민감하다(±1% 체력 ≈ ±5~20%p, 런 단위 카오스) —
  // 손보려면 반드시 --runs=135 로 재고정하라.
  KR: { base: 25.25, chapterGrowth: 0 },
  JP: { base: 23.4, chapterGrowth: 0.97 },
  CN: { base: 23.4, chapterGrowth: 0.85 }
};

/**
 * 수술 1(FB5): 모드별 적 체력 계수.
 *
 * "별승급(8성)이랑 다른 모드 난이도가 너무 다르다"는 피드백. 기준점은 메인
 * 모드인 별승급(캐주얼)이며, 두 모드 모두 자동 시뮬 승률 45~60% 밴드로
 * 수렴하도록 이 계수만 조정한다 — 웨이브 구성·규칙은 그대로다.
 * (3.8 은 스킬 1차 세트·농축 중복 기본화가 얹힌 뒤의 재고정값. 수량 0.85 와
 * 짝이므로 웨이브 총 내구 기준으로는 ×3.23 상당이다.)
 *
 * 트랙 B 재고정: 성어 가중이 "부족 글자 합집합"으로 바뀌며 보유한 성어
 * 글자가 소환 가중을 더는 빨아들이지 않는다 — 소환이 다양해져 캐주얼 실측
 * 승률이 0.489→0.778 로 뛰었다(45런). 규칙이 좋아진 만큼 체력으로 되받는다.
 */
const MODE_ENEMY_HP_SCALE: Record<GameMode, number> = { standard: 1, casual: 4.02 };

/**
 * 모드별 적 수량 계수. 캐주얼은 웨이브당 몸수를 15% 줄이는 대신 체력 계수를
 * 그만큼 높게 잡는다 — 총 웨이브 내구는 유지하면서 스폰 구간이 짧아져
 * 런 시간(중앙값 43~50분 게이트)이 내려온다. 규칙이 아니라 수량 계수다.
 */
export const MODE_ENEMY_COUNT_SCALE: Record<GameMode, number> = { standard: 1, casual: 0.85 };

/**
 * 캐주얼 보스 체력 트림.
 *
 * 스킬 1차 세트 이후 캐주얼은 체력 계수 하나로는 "승률 0.45~0.60"과
 * "중앙값 43~50분"을 동시에 만족하는 창이 비어 있었다(3.2 이하 = 승률 초과,
 * 3.35 이상 = 런 시간 초과). 보스만 트림해 보스전 길이(런 시간)와 일반
 * 웨이브 난이도(승률)를 분리한다. 규칙 변경이 아니라 체력 계수다.
 *
 * 트랙 B 재고정: 일반 체력 3.8→4.02 인상이 런 시간을 50분 경계까지 밀어,
 * 트림을 0.78→0.76 으로 함께 내려 시간을 되샀다(45런 실측 0.556 / 49.3분).
 */
export const CASUAL_BOSS_HP_TRIM = 0.76;

// The center formation overlaps more of the loop than the east formation.
// These small route-coverage coefficients make "which element appeared first"
// a build choice rather than a hidden map-position difficulty roll. Once all
// five formations are open their bonuses nearly cancel out.
export const FORMATION_ROUTE_COVERAGE_MULTIPLIER = Object.freeze([0.995, 0.995, 0.95, 1.05, 1.01] as const);

export function regionEnemyHpMultiplier(region: RegionCode, wave: number, mode: GameMode): number {
  const curve = REGION_ENEMY_HP_CURVE[region];
  const completedChapters = Math.max(0, Math.floor((wave - 1) / 10));
  const regional = curve.base + completedChapters * curve.chapterGrowth;
  return regional * MODE_ENEMY_HP_SCALE[mode];
}

/**
 * F2: 별승급(캐주얼) 목표는 "뽑을 수 있는 글자"여야 한다.
 *
 * 지역 목표(GOAL_ORDER)는 자형연성 합성 계보 기준이라 JP/CN 미리보기 소환
 * 풀(30·32자) 밖의 글자가 섞여 있고, 캐주얼에는 합성이 없어 그 목표는 원리적으로
 * 달성 불가였다. 데이터는 손대지 않고 선정 로직만 좁힌다 — 풀 안 목표를
 * 순서대로 남기고, 모자라면 활성 풀에서 2★ 이상 글자를 별 오름차순(같은 별은
 * 획수순)으로 채워 "뽑고 승급해서 도달하는" 목표 사다리를 만든다.
 */
export function casualGoalOrder(catalog: HanziCatalog): readonly string[] {
  const poolChars = new Set(catalog.activePool.map((definition) => definition.char));
  const order = catalog.goalOrder.filter((char) => poolChars.has(char));
  const goalCount = Math.max(1, catalog.goalOrder.length);
  if (order.length >= goalCount) return order;
  const fallback = catalog.activePool
    .filter((definition) => !order.includes(definition.char))
    .map((definition) => ({
      char: definition.char,
      star: casualNaturalStar(definition.char) ?? 1,
      strokes: casualStrokeCount(definition.char) ?? 0
    }))
    .sort((left, right) => left.star - right.star || left.strokes - right.strokes || left.char.localeCompare(right.char));
  for (const entry of fallback) {
    if (order.length >= goalCount) break;
    if (entry.star >= 2) order.push(entry.char);
  }
  // 2★ 이상이 부족한 극소형 풀이면 1★ 라도 채워 목표 자체는 남긴다.
  for (const entry of fallback) {
    if (order.length >= goalCount) break;
    if (!order.includes(entry.char)) order.push(entry.char);
  }
  return order;
}

/*
 * 성어 기원 소환 — 부적에 기원을 적어 추적 성어의 부족 글자만 부르는 상점 상품.
 *
 * 밸런스 전수조사에서 KR 성어 획득률이 0.8%에 그쳐 헤드라인 기능이 사실상
 * 보이지 않았다. 과거 "성어 가중 3배"안은 승률(전투력)까지 끌어올려 기각됐으므로
 * 이번 경로는 전투력과 분리한다 — 결과는 캐주얼에서 항상 1★로 태어나고,
 * 자형연성에서는 저단계 직접 재료만 나온다. 가격은 기본 소환가의 배수로
 * "성어 완성에 지불하는 값"이며 2.5~3배 사이에서 조율한다.
 */
export const IDIOM_WISH_COST_MULTIPLIER = 2.75;

export function idiomWishCost(baseCost: number): number {
  return Math.round(baseCost * IDIOM_WISH_COST_MULTIPLIER);
}

/*
 * 수련장(튜토리얼) 완화 계수.
 *
 * 수련장은 각본이 정한 여덟 걸음을 "반드시 이기며" 밟는 판이다. 규칙은
 * 본편 그대로 두고 적의 체력·수량만 눌러, 자령 한둘로도 첫 웨이브를
 * 확실히 넘기게 한다. 계수는 엔진 생성 옵션(tutorial)이 켜졌을 때만 쓴다.
 */
// 3단계 첫 웨이브의 ~29초 대기가 건너뛰기를 유도했다(사용자 실증).
// 응급 완화: 더 무르고 더 적게 — 후속 트랙이 미니 과업·가속으로 마저 채운다.
export const TUTORIAL_ENEMY_HP_SCALE = 0.25;

export const TUTORIAL_ENEMY_COUNT_SCALE = 0.4;

export function weightedPick(rng: SeededRng, entries: readonly HanziDefinition[], weights: readonly number[]): HanziDefinition {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.next() * total;
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll <= 0) return entries[index] as HanziDefinition;
  }
  return entries[entries.length - 1] as HanziDefinition;
}
