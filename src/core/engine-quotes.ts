/*
 * 엔진이 화면에 건네는 견적·보고 자료형.
 *
 * 분해·강화·농축·캐주얼 3합의 질의 결과 모양이다. 값이 아니라 계약이므로
 * 엔진 본문과 떼어 둔다.
 */
import {
  type ActionResult,
  type CasualStar,
  type ConcentrationLevel,
  type ConcentrationPath,
  type HanziDefinition,
  type NotationCode,
  type Wuxing
} from "./types";

export interface CleanupAssessment {
  towerId: number;
  protected: boolean;
  score: number;
  reasons: string[];
  protectedReasons: string[];
  /** 이 한자를 이 1기만 갖고 있다. 보호를 껐을 때도 배지로 남겨야 한다. */
  soleCopy: boolean;
}

/**
 * 분해 경로만의 예외.
 *
 * "유일 보유 한자"는 초보자를 지키는 규칙이지만, 문기를 모으려는 숙련자에게는
 * 인벤토리 절반을 잠가 버리는 벽이었다. 이 플래그를 끄면 유일 자령도 후보에
 * 들어온다 — 잠금·농축·전장 공명 등 나머지 보호는 그대로다. 캐주얼 3체 조합의
 * 유일 보호는 이 플래그와 무관하다.
 */
export interface CleanupOptions {
  protectUnique?: boolean;
}

export interface DismantleQuote {
  ids: number[];
  gains: Record<Wuxing, number>;
  scoreGains: Record<Wuxing, number>;
  blocked: Array<{ towerId: number; reason: string }>;
}

export interface UpgradeQuote {
  fromLevel: number;
  toLevel: number;
  levels: number;
  cost: number;
  affordable: boolean;
}

export interface ConcentrationCombatSnapshot {
  damage: number;
  attacksPerSecond: number;
  range: number;
  abilityEffect: number;
}

export interface ConcentrationQuote {
  targetId: number;
  path: ConcentrationPath;
  currentLevel: ConcentrationLevel;
  nextLevel: ConcentrationLevel;
  essenceCost: number;
  duplicateIds: number[];
  current: ConcentrationCombatSnapshot;
  next: ConcentrationCombatSnapshot;
}

// 경고의 성격을 문자열이 아니라 종류로 남긴다. 자동 경로가 "무엇을 건너뛸지"를
// 문안 매칭이 아니라 종류로 판정할 수 있어야 문구를 고쳐도 규칙이 흔들리지 않는다.
export type CasualFusionIssueKind =
  | "deployed"   // 전장에 세워 둔 자령 — 수비 공백이 생긴다
  | "resonance"  // 오행진 공명 임계치가 깨진다
  | "protected"  // 잠금·농축·목표·성어·합성식 — v3 에서는 아예 선정 불가
  | "pool";      // 이 오행에 더 높은 별 글자가 없다

export interface CasualFusionIssue {
  towerId: number | null;
  text: string;
  kind?: CasualFusionIssueKind;
}

/**
 * 3기를 소모하고 나서 "무엇을 뽑을 수 있는가". 별 사다리(star+1 → +2 …)를
 * 훑어 처음으로 비어 있지 않은 칸을 결과 풀로 삼는다.
 */
export interface CasualResultPool {
  star: CasualStar;
  candidates: readonly HanziDefinition[];
  /** star+1 이 비어 상위 별로 건너뛰었는가 */
  starFallback: boolean;
  /** 이번 런 소환 풀에 후보가 없어 지역 로스터까지 넓혔는가 */
  rosterFallback: boolean;
}

export interface CasualFusionQuote {
  /** 소모될 3기. v3 에는 남는 본체가 없다. */
  materialIds: number[];
  fromStar: CasualStar | null;
  toStar: CasualStar | null;
  wuxing: Wuxing | null;
  /** 결과 무작위 후보 수 */
  poolSize: number;
  starFallback: boolean;
  rosterFallback: boolean;
  blocked: CasualFusionIssue[];
  warnings: CasualFusionIssue[];
}

export interface CasualAutoFusionGroup {
  wuxing: Wuxing;
  materialIds: [number, number, number];
  fromStar: CasualStar;
  toStar: CasualStar;
  poolSize: number;
  starFallback: boolean;
  rosterFallback: boolean;
  warnings: CasualFusionIssue[];
  /** 확인 없이 실행하는 원클릭 경로가 스스로 건너뛸 사유. null 이면 즉시 실행 대상. */
  autoSkipReason: string | null;
}

export interface CasualFusionGain {
  wuxing: Wuxing;
  char: string;
  star: CasualStar;
  cell: number;
  newDiscovery: boolean;
}

export interface CasualFusionResult extends ActionResult {
  gained: CasualFusionGain | null;
  consumedChars: string[];
  fromStar: CasualStar | null;
  starFallback: boolean;
  rosterFallback: boolean;
}

export interface CasualAutoFusionReport extends ActionResult {
  fused: number;
  consumed: number;
  skipped: number;
  skipReason: string | null;
  gained: CasualFusionGain[];
  firstFusion: {
    wuxing: Wuxing;
    char: string;
    fromStar: CasualStar;
    toStar: CasualStar;
    consumedChars: string[];
    newDiscovery: boolean;
    starFallback: boolean;
    rosterFallback: boolean;
  } | null;
}

/** 엔진 생성 옵션. */
export interface GameEngineOptions {
  /** 수련장 완화·각본 지급 허용 스위치. */
  readonly tutorial?: boolean;
  /**
   * 읽기 표기 축(gripe #6). 생략하면 로스터의 자국 표기
   * (defaultNotationForRegion)라 현행과 동작이 같다. 교차 조합은
   * NOTATION_AXIS_READY 가 켜진 뒤에만 S13 이 이 값을 넘긴다.
   */
  readonly notation?: NotationCode;
}
