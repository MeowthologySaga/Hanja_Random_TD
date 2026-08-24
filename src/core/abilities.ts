import type {
  AbilityLoadout,
  AbilitySpec,
  CombatRole,
  GraphRole,
  HanziDefinition,
  SemanticFamily,
  Stage,
  TargetPriority,
  Wuxing
} from "./types";

const ELEMENT_COLORS: Record<Wuxing, string> = {
  木: "#73df8d",
  火: "#ff755a",
  土: "#d9a46d",
  金: "#ffd66c",
  水: "#68c9ff"
};

export const ELEMENT_ABILITY_TABLE: Record<Wuxing, AbilitySpec> = {
  木: {
    id: "element-wood-root-poison",
    name: "뿌리독",
    glyph: "毒",
    category: "element",
    fx: "poison",
    trigger: "공격 적중",
    summary: "지속 피해",
    description: "적중한 망령에게 생장독을 심어 일정 시간 피해를 줍니다.",
    color: ELEMENT_COLORS.木
  },
  火: {
    id: "element-fire-wheel",
    name: "화륜폭발",
    glyph: "爆",
    category: "element",
    fx: "blast",
    trigger: "공격 적중",
    summary: "주변 폭발",
    description: "적중 지점을 태워 주변 망령에게 범위 피해를 줍니다.",
    color: ELEMENT_COLORS.火
  },
  土: {
    id: "element-earth-seal",
    name: "지맥봉쇄",
    glyph: "封",
    category: "element",
    fx: "stun",
    trigger: "공격 적중 시 확률",
    summary: "이동 봉쇄",
    description: "지맥의 힘으로 망령을 잠시 제자리에 봉쇄합니다.",
    color: ELEMENT_COLORS.土
  },
  金: {
    id: "element-metal-cleave",
    name: "파갑절단",
    glyph: "斬",
    category: "element",
    fx: "critical",
    trigger: "공격 적중 시 확률",
    summary: "관통 치명타",
    description: "장갑을 관통하며 일정 확률로 강한 치명타를 냅니다.",
    color: ELEMENT_COLORS.金
  },
  水: {
    id: "element-water-chain",
    name: "빙류연쇄",
    glyph: "凍",
    category: "element",
    fx: "chain",
    trigger: "공격 적중",
    summary: "감속 연쇄",
    description: "적을 둔화시키고 가까운 망령에게 냉기를 연쇄시킵니다.",
    color: ELEMENT_COLORS.水
  }
};

interface SemanticPattern {
  family: SemanticFamily;
  targetPriority: TargetPriority;
  ability: AbilitySpec;
  every: number;
  multiplier: number;
}
const semanticPattern = (
  family: SemanticFamily,
  targetPriority: TargetPriority,
  every: number,
  multiplier: number,
  name: string,
  glyph: string,
  fx: AbilitySpec["fx"],
  trigger: string,
  summary: string,
  description: string,
  color: string
): SemanticPattern => ({
  family,
  targetPriority,
  every,
  multiplier,
  ability: { id: `semantic-${family}`, name, glyph, category: "semantic", fx, trigger, summary, description, color }
});

export const SEMANTIC_ABILITY_TABLE: Record<SemanticFamily, SemanticPattern> = {
  sight: semanticPattern("sight", "strongest", 5, 1.34, "간파의 눈", "見", "critical", "5번째 공격", "강적 약점 노출", "체력이 가장 높은 적을 간파해 강한 일격을 가합니다.", "#f4e28b"),
  gate: semanticPattern("gate", "front", 7, 0.72, "문맥 전이", "門", "chain", "7번째 공격", "먼 적에게 전이", "공격을 길 반대편의 적에게 전이해 두 구간을 동시에 압박합니다.", "#b7a5ff"),
  weather: semanticPattern("weather", "cluster", 6, 0.46, "비구름 강하", "雨", "spread", "적 5기 이상 · 충전 발동", "경로 비구름 장판", "가장 붐비는 길목에 비구름을 남겨 일정 시간 장판 피해를 줍니다.", "#77d8ff"),
  mountain: semanticPattern("mountain", "front", 7, 0.3, "산맥 진압", "山", "stun", "7번째 공격", "제자리 봉쇄", "길을 울려 선두 적의 발을 묶고 그 자리에서 화력을 집중합니다.", "#d8ab74"),
  speech: semanticPattern("speech", "cluster", 6, 0.18, "언령 메아리", "言", "support", "6번째 공격", "주변 능력 가속", "같은 진의 자령에게 언령을 퍼뜨려 공격 대기를 줄입니다.", "#dda4ff"),
  motion: semanticPattern("motion", "fastest", 5, 0.27, "추행 봉쇄", "行", "control", "5번째 공격", "최고속 추적", "가장 빠른 적을 추적해 이동력을 크게 낮추고 공격권 안에 붙잡습니다.", "#7ee7d5"),
  growth: semanticPattern("growth", "front", 6, 0.22, "연근 번식", "生", "poison", "6번째 공격", "뿌리 연쇄", "대상에게 뿌리를 내리고 가까운 적에게 생장독을 번식시킵니다.", "#73df8d"),
  flame: semanticPattern("flame", "cluster", 5, 0.55, "잔화 지대", "炎", "blast", "5번째 공격", "밀집 지역 연소", "적이 모인 길목을 태워 범위 피해와 긴 화상을 남깁니다.", "#ff8062"),
  metalwork: semanticPattern("metalwork", "armored", 5, 1.28, "파갑 단조", "鍛", "burst", "5번째 공격", "장갑 적 우선", "장갑이 두꺼운 적을 우선 베고 방어를 크게 관통합니다.", "#ffd66c"),
  heart: semanticPattern("heart", "front", 7, 0.14, "심맥 공조", "心", "resonance", "7번째 공격", "진 전체 호흡", "모든 자령의 공격 대기를 조금씩 앞당겨 진법의 호흡을 맞춥니다.", "#ff9fb8"),
  wealth: semanticPattern("wealth", "valuable", 6, 1, "현상금 낙인", "財", "coin", "6번째 공격", "고가치 적 추적", "보상이 큰 적을 노려 공격하고 추가 엽전을 얻습니다.", "#ffe279"),
  general: semanticPattern("general", "front", 6, 1.18, "자의 구현", "字", "solo", "6번째 공격", "뜻의 힘 증폭", "한자의 뜻을 기운으로 구현해 다음 일격을 강화합니다.", "#c7d0e0")
};

const SEMANTIC_CHAR_GROUPS: Readonly<Record<Exclude<SemanticFamily, "general">, ReadonlySet<string>>> = {
  sight: new Set([..."目見視觀明景照覽"]),
  gate: new Set([..."門戶宇宙宮室闕關開閉"]),
  weather: new Set([..."雨雲露霜雪風寒暑陽陰冬"]),
  mountain: new Set([..."山地土岡崑嶽巖堅重黃陵谷岳"]),
  speech: new Set([..."言文字符聲鳴奏律呂銘詩書"]),
  motion: new Set([..."走行翔騰往來流川潛進退步"]),
  growth: new Set([..."木松葉實華茂李秋榮果馨林森草花"]),
  flame: new Set([..."火赤熱烈暉炎光日煥"]),
  metalwork: new Set([..."金銀珠利器劍刀玉鐵鋒"]),
  heart: new Set([..."心人仁情愛女母父慈信"]),
  wealth: new Set([..."財貨貝有百千萬富寶錢"])
};

export function semanticPatternFor(char: string, wuxing: Wuxing): SemanticPattern {
  for (const [family, chars] of Object.entries(SEMANTIC_CHAR_GROUPS) as Array<[Exclude<SemanticFamily, "general">, ReadonlySet<string>]>) {
    if (chars.has(char)) return SEMANTIC_ABILITY_TABLE[family];
  }
  const fallback: Record<Wuxing, SemanticFamily> = { 木: "growth", 火: "flame", 土: "mountain", 金: "metalwork", 水: "weather" };
  return SEMANTIC_ABILITY_TABLE[fallback[wuxing]] ?? SEMANTIC_ABILITY_TABLE.general;
}

export const ROLE_ABILITY_TABLE: Record<CombatRole, AbilitySpec> = {
  rapid: {
    id: "role-rapid-mark",
    name: "연격 각인",
    glyph: "連",
    category: "role",
    fx: "rapid",
    trigger: "주기 발동",
    summary: "추가 연격",
    description: "공격 횟수를 쌓아 같은 대상에게 빠른 추가 타격을 가합니다.",
    color: "#73e6ff"
  },
  burst: {
    id: "role-burst-crush",
    name: "축력파쇄",
    glyph: "破",
    category: "role",
    fx: "burst",
    trigger: "주기 발동",
    summary: "강한 일격",
    description: "힘을 모은 다음 공격이 큰 피해를 주고 강하게 번쩍입니다.",
    color: "#ff9b70"
  },
  splash: {
    id: "role-spread-array",
    name: "산화진",
    glyph: "散",
    category: "role",
    fx: "spread",
    trigger: "주기 발동",
    summary: "속성 범위화",
    description: "본래 오행과 관계없이 주변 망령까지 공격을 퍼뜨립니다.",
    color: "#d993ff"
  },
  control: {
    id: "role-binding-art",
    name: "봉박술",
    glyph: "縛",
    category: "role",
    fx: "control",
    trigger: "주기 발동",
    summary: "상태 강화",
    description: "오행 상태 효과의 세기와 지속 시간을 크게 높입니다.",
    color: "#8fa8ff"
  },
  support: {
    id: "role-harmonic-vein",
    name: "동조맥",
    glyph: "助",
    category: "role",
    fx: "support",
    trigger: "주기 발동",
    summary: "주변 재사용 가속",
    description: "가까운 자령들의 남은 공격 대기 시간을 줄입니다.",
    color: "#8ff0bd"
  },
  economy: {
    id: "role-coin-alchemy",
    name: "재화연성",
    glyph: "財",
    category: "role",
    fx: "coin",
    trigger: "주기 발동",
    summary: "엽전 생성",
    description: "전투 중 일정한 공격 횟수마다 추가 엽전을 만듭니다.",
    color: "#ffe279"
  }
};

export const GRAPH_ABILITY_TABLE: Record<GraphRole, AbilitySpec> = {
  hub: {
    id: "graph-fivefold-resonance",
    name: "오행공명",
    glyph: "共",
    category: "graph",
    fx: "resonance",
    trigger: "서로 다른 오행 배치",
    summary: "다양성 비례 강화",
    description: "진법에 존재하는 서로 다른 오행 수만큼 공격력이 증가합니다.",
    color: "#f0d7ff"
  },
  bridge: {
    id: "graph-lineage-accelerator",
    name: "계보가속",
    glyph: "承",
    category: "graph",
    fx: "lineage",
    trigger: "부모 계승 주기 단축",
    summary: "계승 효과 가속",
    description: "부모 한자에서 물려받은 오행 추가타가 더 자주 발동합니다.",
    color: "#9ce8ff"
  },
  finisher: {
    id: "graph-ending-mark",
    name: "종결낙인",
    glyph: "終",
    category: "graph",
    fx: "execute",
    trigger: "체력 35% 이하 공격",
    summary: "약한 적 마무리",
    description: "체력이 낮아진 망령에게 추가 피해를 주어 길을 정리합니다.",
    color: "#ff8396"
  },
  independent: {
    id: "graph-solitary-awakening",
    name: "고립각성",
    glyph: "獨",
    category: "graph",
    fx: "solo",
    trigger: "같은 글자가 하나뿐일 때",
    summary: "유일 개체 강화",
    description: "진법에 같은 글자가 중복되지 않으면 공격력이 증가합니다.",
    color: "#c7d0e0"
  }
};

const ROLE_CADENCE: Record<CombatRole, number> = {
  rapid: 9,
  burst: 10,
  splash: 11,
  control: 11,
  support: 12,
  economy: 13
};

const ROLE_MULTIPLIER: Record<CombatRole, number> = {
  rapid: 1.08,
  burst: 1.72,
  splash: 1.18,
  control: 1.12,
  support: 1.06,
  economy: 1.06
};

export interface AbilityComposeInput {
  char: string;
  wuxing: Wuxing;
  stage: Stage;
  role: CombatRole;
  graphRole: GraphRole;
  parents: string[];
  parentWuxing: Wuxing[];
}

export function hasActiveSkills(definition: Pick<HanziDefinition, "stage" | "graph">): boolean {
  // Recipe materials stay visually quiet and teach the value of combining.
  // A direct tier-1 leaf keeps slow skills so a dead-end pull still has a use.
  return definition.stage > 1 || definition.graph.directChildCount === 0;
}

function lineageAbility(wuxing: Wuxing, every: number): AbilitySpec {
  return {
    id: "lineage-" + wuxing,
    name: wuxing + "맥 계승",
    glyph: wuxing,
    category: "lineage",
    fx: "lineage",
    trigger: every + "번째 공격",
    summary: wuxing + "행 추가타",
    description: "부모 구성자에서 물려받은 " + wuxing + "행의 힘으로 추가 피해를 줍니다.",
    color: ELEMENT_COLORS[wuxing]
  };
}

export function composeAbilityLoadout(input: AbilityComposeInput): AbilityLoadout {
  const stageStep = Math.floor((input.stage - 1) / 2);
  const signatureEvery = Math.max(7, ROLE_CADENCE[input.role] - stageStep);
  const lineageWuxing = input.parentWuxing.find((wuxing) => wuxing !== input.wuxing) ?? input.parentWuxing[0];
  const lineageEvery = Math.max(10, 16 - input.stage - (input.graphRole === "bridge" ? 2 : 0));
  const role = { ...ROLE_ABILITY_TABLE[input.role], trigger: signatureEvery + "번째 공격" };
  const semantic = semanticPatternFor(input.char, input.wuxing);
  const semanticEvery = Math.max(7, semantic.every + 4 - Math.floor((input.stage - 1) / 2));
  const lineage = input.parents.length > 0 && lineageWuxing ? lineageAbility(lineageWuxing, lineageEvery) : undefined;
  const tuning = {
    semanticEvery,
    semanticMultiplier: semantic.multiplier + (input.stage - 1) * 0.025,
    signatureEvery,
    signatureMultiplier: ROLE_MULTIPLIER[input.role] + (input.stage - 1) * 0.035,
    splashRatio: 0.38 + input.stage * 0.025,
    splashRadius: 58 + input.stage * 6,
    chainCount: input.stage >= 4 ? 2 : 1,
    chainRatio: 0.28 + input.stage * 0.015,
    slowFactor: Math.max(0.46, 0.73 - input.stage * 0.035),
    slowDuration: 1.1 + input.stage * 0.18,
    poisonRatio: 0.13 + input.stage * 0.014,
    poisonDuration: 2.45 + input.stage * 0.25,
    stunChance: 0.1 + input.stage * 0.025,
    stunDuration: 0.46 + input.stage * 0.065,
    critChance: 0.16 + input.stage * 0.025,
    critMultiplier: 2.02 + input.stage * 0.045,
    armorPenetration: Math.min(0.88, 0.65 + input.stage * 0.04),
    roleSplashRatio: input.role === "splash" ? 0.31 + input.stage * 0.015 : 0,
    roleControlBonus: input.role === "control" ? 0.14 + input.stage * 0.015 : 0,
    supportCooldown: input.role === "support" ? 0.09 + input.stage * 0.012 : 0,
    economyGold: input.role === "economy" ? 1 + Math.floor(input.stage / 3) : 0,
    hubDiversityBonus: input.graphRole === "hub" ? 0.022 + input.stage * 0.003 : 0,
    executeThreshold: input.graphRole === "finisher" ? 0.35 : 0,
    executeMultiplier: input.graphRole === "finisher" ? 1.2 + input.stage * 0.02 : 1,
    soloMultiplier: input.graphRole === "independent" ? 1.1 + input.stage * 0.012 : 1,
    lineageEvery,
    lineageRatio: lineage ? 0.2 + input.stage * 0.025 : 0
  };
  return {
    element: { ...ELEMENT_ABILITY_TABLE[input.wuxing] },
    semantic: { ...semantic.ability, trigger: semantic.family === "weather" ? `적 5기 이상 · ${semanticEvery}번째 공격` : `${semanticEvery}번째 공격` },
    semanticFamily: semantic.family,
    targetPriority: semantic.targetPriority,
    role,
    graph: { ...GRAPH_ABILITY_TABLE[input.graphRole] },
    lineage,
    lineageWuxing,
    comboKey: [input.wuxing, semantic.family, input.role, input.graphRole, lineageWuxing ?? "none", "S" + input.stage].join("|"),
    tuning
  };
}
