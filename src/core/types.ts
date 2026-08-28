export type RegionCode = "KR" | "JP" | "CN";
/**
 * 표기(읽기) 축 — gripe #6 범위×표기 2축 분리.
 *
 * RegionCode 는 이제 로스터 범위·자형만 맡고, 화면에 어떤 읽기를 쓸지는
 * 이 축이 정한다. 기본값은 로스터의 자국 표기(KR→kr-hunum, JP→jp-onkun,
 * CN→cn-pinyin)라 현행 동작과 같고, 교차 조합은 통합 표기 테이블
 * (`handoff/to-codex/asset-request-v8-reading-table.md` → `src/data/unified-readings.json`)
 * 도착 뒤 NOTATION_AXIS_READY 플래그로 연다.
 */
export type NotationCode = "kr-hunum" | "jp-onkun" | "cn-pinyin";
export type Wuxing = "木" | "火" | "土" | "金" | "水";
export type ElementKind = "wood" | "fire" | "earth" | "metal" | "water";
export type Stage = 1 | 2 | 3 | 4 | 5;
export type GameMode = "standard" | "casual";
export type CasualStar = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type RunPhase = "title" | "prep" | "combat" | "victory" | "defeat";
// FB3: 패배 사유 구분. 종료 화면이 lastMessage 문자열을 파싱하지 않고
// "왜 졌는지"를 표기할 수 있게 엔진이 원인을 명시한다.
export type DefeatCause = "enemy-limit" | "boss-timeout";
export type AutomationMode = "manual" | "semi" | "goal";
// 상점 소환 상품. `midstar`·`highstar` 는 획수=별 규칙이 있는 캐주얼 8성전 전용
// 티어 소환이다. 밴드 하한은 후보 풀 하드 필터("N★ 확정" 보장), 상한은
// 소프트 — 그 위 별도 가파른 꼬리 확률로 나온다(engine-tuning.CASUAL_STAR_TAIL_DECAY).
export type SummonIntent = "balanced" | "discovery" | "lineage" | "concentration" | "midstar" | "highstar";
export type ConcentrationPath = "swift" | "potent";
/*
 * 농축 단계. 상한이 없다 — 성어 줄에 세우려 고른 낮은 등급 글자도 끝까지
 * 자랄 수 있어야 "성어 때문에 손해"가 되지 않는다(2026-08-28 결정).
 * 무한을 여는 대신 값이 기하급수로 오르고, 힘은 단계마다 덜 붙는다.
 */
export type ConcentrationLevel = number;
export type ConcentrationPayment =
  | { kind: "duplicate"; towerId: number }
  | { kind: "essence" };
export type UpgradeStat = "damage" | "attackSpeed" | "range" | "abilityPower" | "statusPower";
export type StatUpgradeLevels = Record<UpgradeStat, number>;
export type ElementTraitLevels = Record<Wuxing, [number, number, number]>;
export type CombatRole = "rapid" | "burst" | "splash" | "control" | "support" | "economy";
export type GraphRole = "hub" | "bridge" | "finisher" | "independent";
export type SemanticFamily =
  | "sight"
  | "gate"
  | "weather"
  | "mountain"
  | "speech"
  | "motion"
  | "growth"
  | "flame"
  | "metalwork"
  | "heart"
  | "wealth"
  // [SKILL-V1] 스킬 1차 세트가 신설한 의미 계열.
  | "warfare"
  | "momentum"
  | "frost"
  // [SKILL-V2] 스킬 2차 세트가 신설한 의미 계열.
  | "chainseal"
  | "reaper"
  | "command"
  | "scorch"
  | "harvest"
  // [SKILL-V3] 스킬 3차 세트가 신설한 의미 계열.
  | "demise"
  | "mire"
  | "general";
export type TargetPriority = "front" | "strongest" | "fastest" | "armored" | "cluster" | "valuable";
export type EnemyArchetype = "normal" | "swarm" | "swift" | "armored" | "regenerator" | "boss";
export type AbilityCategory = "element" | "semantic" | "role" | "graph" | "lineage";
/*
 * 성어 능력 축. 앞 넷은 기존 성어(104구)가 쓰고, 뒤 넷은 커스텀 성어만 굴린다.
 * 한 타입으로 합친 이유는 성어가 결국 한 종류의 물건이기 때문이다 — 엔진의
 * 발동 판정·줄 세우기·화면 표시가 전부 같은 길을 탄다. 다만 **합산 통은
 * 다르다**(custom-idioms.ts 머리말 참조).
 */
export type IdiomBonusKind =
  | "range"
  | "damage"
  | "evolutionGold"
  | "enemySlow"
  | "killEssence"
  | "waveGold"
  | "weaknessDamage"
  | "formationAttack";
export type AbilityFxKind =
  | "poison"
  | "blast"
  | "stun"
  | "critical"
  | "chain"
  | "rapid"
  | "burst"
  | "spread"
  | "control"
  | "support"
  | "coin"
  | "resonance"
  | "lineage"
  | "execute"
  | "solo";

export interface Point {
  x: number;
  y: number;
}

export interface GraphMetrics {
  directChildCount: number;
  descendantCount: number;
  connectivityScore: number;
  graphRole: GraphRole;
}

export interface AbilitySpec {
  id: string;
  name: string;
  glyph: string;
  category: AbilityCategory;
  fx: AbilityFxKind;
  trigger: string;
  summary: string;
  description: string;
  color: string;
}

export interface AbilityTuning {
  semanticEvery: number;
  semanticMultiplier: number;
  signatureEvery: number;
  signatureMultiplier: number;
  splashRatio: number;
  splashRadius: number;
  chainCount: number;
  chainRatio: number;
  slowFactor: number;
  slowDuration: number;
  poisonRatio: number;
  poisonDuration: number;
  stunChance: number;
  stunDuration: number;
  critChance: number;
  critMultiplier: number;
  armorPenetration: number;
  roleSplashRatio: number;
  roleControlBonus: number;
  supportCooldown: number;
  economyGold: number;
  hubDiversityBonus: number;
  executeThreshold: number;
  executeMultiplier: number;
  soloMultiplier: number;
  lineageEvery: number;
  lineageRatio: number;
}

export interface AbilityLoadout {
  element: AbilitySpec;
  semantic: AbilitySpec;
  semanticFamily: SemanticFamily;
  targetPriority: TargetPriority;
  role: AbilitySpec;
  graph: AbilitySpec;
  lineage?: AbilitySpec;
  lineageWuxing?: Wuxing;
  comboKey: string;
  tuning: AbilityTuning;
}

export interface CombatProfile {
  role: CombatRole;
  baseDamage: number;
  range: number;
  cooldown: number;
  budgetMultiplier: number;
  effectLabel: string;
  roleLabel: string;
  description: string;
  abilities: AbilityLoadout;
}

export interface HanziDefinition {
  id: `${RegionCode}:${string}`;
  region: RegionCode;
  char: string;
  stage: Stage;
  acquisition: "direct" | "craft";
  wuxing: Wuxing;
  parents: string[];
  needsReview: boolean;
  graph: GraphMetrics;
  combat: CombatProfile;
}

export interface HanziCatalog {
  region: RegionCode;
  title: string;
  scope: number;
  definitions: Map<string, HanziDefinition>;
  recipes: HanziDefinition[];
  activePool: HanziDefinition[];
  goalOrder: string[];
}

export interface Tower {
  id: number;
  definitionId: `${RegionCode}:${string}`;
  char: string;
  wuxing: Wuxing;
  stage: Stage;
  combatRole: CombatRole;
  graphRole: GraphRole;
  cell: number;
  cooldownLeft: number;
  pulse: number;
  shotCount: number;
  abilityFlash: number;
  locked: boolean;
  concentration?: ConcentrationLevel;
  concentrationPath?: ConcentrationPath | null;
  naturalStar?: CasualStar;
  casualStar?: CasualStar;
  // [SKILL-V1] 파죽(momentum) 패시브: 같은 적 연속 타격 중첩 상태.
  momentumTargetId?: number;
  momentumStacks?: number;
  // [SKILL-V1] 귀천: 6★ 이상 자령의 충전 스킬 게이지(초).
  ascendCharge?: number;
  // [SKILL-V2] 채기(harvest): 이 자령의 누적 처치 수 — N번째마다 문기 +1.
  harvestKills?: number;
  // [SKILL-V2] 참명(reaper): 다음 참격이 가능해지는 시각(숨 고르기).
  reaperReadyAt?: number;
  // [SKILL-V3] 회향(回響): 3합 승급으로 태어난 자령이 물려받은 여운(남은 초).
  // 준비 시간에는 흐르지 않고 **전투 중에만** 줄어든다 — 준비 화면에서 합쳐도
  // 여운이 그냥 타 버리지 않게 하려는 규칙이다.
  echoRemaining?: number;
}

export interface Enemy {
  id: number;
  wave: number;
  /**
   * 이 적이 이고 나온 한자.
   *
   * 정본 세계관: 자령은 야생으로 존재하고, 부적술사가 그 한자를 적은 부적을
   * 붙여 강시로 부린다. 그래서 내 편은 머리에 부적이 있고 야생(적)은 맨머리다 —
   * 구분은 생김새가 아니라 부적의 유무다(2026-08-28 기획 결정).
   * 봉인하면 이 글자의 자혼이 남아 커스텀 성어의 재료가 된다.
   */
  char: string;
  hp: number;
  maxHp: number;
  speed: number;
  progress: number;
  reward: number;
  boss: boolean;
  archetype: EnemyArchetype;
  weakness: Wuxing;
  armor: number;
  regenPerSecond: number;
  slowFactor: number;
  slowUntil: number;
  stunnedUntil: number;
  poisonDps: number;
  poisonUntil: number;
  flash: number;
  // [SKILL-V1] 상극 각인(warfare): 낙인이 남은 동안 같은 오행 공격이 커진다.
  // 넉백·후퇴류가 아니라 순수 피해 증폭 표식이다.
  brandWuxing?: Wuxing;
  brandUntil?: number;
  brandPower?: number;
  // [SKILL-V3] 유폭 낙인(同歸): 상극 각인과 **같은 낙인 자료**를 쓰되, 낙인을
  // 새긴 쪽이 同歸 계열이면 유폭 반경이 함께 새겨진다(`brandBlastRadius` > 0).
  // 그 동안 받은 피해의 일부가 `brandStored` 에 적립되고, 낙인을 진 채 쓰러지면
  // 적립분이 그 반경 안으로 번진다. 번지는 것은 피해뿐 — 경로·진행도는 그대로다.
  brandBlastRadius?: number;
  brandStored?: number;
  // [SKILL-V3] 진흙밭(泥田): 이 시각까지 **적 고유 방어 특성**이 무효다.
  // 실사한 적 특성 중 무효화 대상은 장갑(`armor`)과 재생(`regenPerSecond`) 둘로,
  // 정예 철갑(0.28~0.48)·회생 요괴(체력 2.6%/초)·우두머리(둘 다)가 실제로 지닌다.
  // 이동에는 손대지 않는다 — 속도·감속·정지·진행도 전부 그대로다.
  traitsSuppressedUntil?: number;
  // [SKILL-V2] 연환 인장(chainseal): 공격마다 쌓이는 인장 스택과 누적 피해.
  // 상한 도달 시 폭발 + 1.2초 제자리 봉인 — 절대 뒤로 밀지 않는다.
  sealStacks?: number;
  sealStored?: number;
  sealUntil?: number;
}

export interface AbilityZone {
  id: number;
  towerId: number;
  // [SKILL-V1] "frost" 는 서리길(피해 없는 감속 장판)이다.
  // [SKILL-V2] "ember" 는 소흔의 잔불(처치 지점 지속 피해 지대)이다.
  // [SKILL-V3] "mire" 는 진흙밭 — 피해도 감속도 없고, 밟는 동안 적의 장갑·재생
  // 특성만 무효로 만드는 지대다(土행 유사진흙지대 `quicksand` 와는 다른 종류).
  kind: "roots" | "lava" | "quicksand" | "caltrops" | "rain" | "frost" | "ember" | "mire";
  wuxing: Wuxing;
  progress: number;
  radius: number;
  damagePerSecond: number;
  expiresAt: number;
  color: string;
  // [SKILL-V1] 서리길 전용: 밟는 적에게 적용할 이동 배율(0.75 = 25% 감속).
  slowFactor?: number;
}

export interface WavePlan {
  wave: number;
  count: number;
  hp: number;
  speed: number;
  interval: number;
  reward: number;
  boss: boolean;
  archetype: EnemyArchetype;
  weakness: Wuxing;
  armor: number;
  regen: number;
  label: string;
  briefing: string;
}

export interface EvolutionOption {
  recipeId: string;
  result: HanziDefinition;
  parents: string[];
  materialTowerIds: number[];
  onTargetPath: boolean;
}

export interface CompositionMaterialPreview {
  char: string;
  towerId: number | null;
  location: "board" | "inventory" | "locked" | "missing";
}

export interface CompositionBranchPreview {
  recipeId: string;
  result: HanziDefinition;
  parents: string[];
  materials: CompositionMaterialPreview[];
  materialTowerIds: number[];
  ready: boolean;
  onTargetPath: boolean;
}

export interface GoalProgress {
  target: HanziDefinition;
  directMaterials: Array<{ char: string; owned: number; needed: number }>;
  ownedNodes: string[];
  craftableNodes: string[];
  progress: number;
}

/**
 * 한 번이라도 봉인한 성어의 자취. 기록과 활성은 나뉘어 있다.
 *
 * - 배열에 남아 있다는 것 자체가 "이 런에서 봉인해 본 적이 있다"는 달성 기록이다.
 *   도감·목표 진행·게임오버 통계는 이 기록을 센다.
 * - `active` 는 지금 이 순간 네 자령이 그 줄을 지키고 있느냐다. 전투 보너스는
 *   오직 활성 봉인만 낸다. 줄이 흩어지면 기록은 남고 보너스만 꺼진다.
 * - `cells` 는 활성일 때의 네 칸이고, 흩어지면 비운다(발광·명패 표식 기준).
 */
export interface IdiomSeal {
  idiomId: string;
  cells: number[];
  completedAt: number;
  active: boolean;
}

export interface GameState {
  seed: string;
  region: RegionCode;
  /** 읽기 표기 축. 기본은 로스터의 자국 표기 — defaultNotationForRegion(region). */
  notation: NotationCode;
  mode: GameMode;
  phase: RunPhase;
  /** phase 가 "defeat" 일 때만 채워진다. 그 외에는 null. */
  defeatCause: DefeatCause | null;
  wave: number;
  maxWaves: number;
  gold: number;
  researchLevel: number;
  globalUpgrades: StatUpgradeLevels;
  elementUpgrades: Record<Wuxing, StatUpgradeLevels>;
  elementTraits: ElementTraitLevels;
  summonCount: number;
  killCount: number;
  evolutionCount: number;
  casualFusionCount: number;
  interestEarned: number;
  elementEssence: Record<Wuxing, number>;
  elementDismantleScore: Record<Wuxing, number>;
  elementEssenceGenerated: Record<Wuxing, number>;
  elementEssenceSpent: Record<Wuxing, number>;
  dismantledTowerCount: number;
  prepRemaining: number;
  elapsed: number;
  waveElapsed: number;
  spawned: number;
  spawnCooldown: number;
  nextWaveRemaining: number | null;
  bossDefeated: boolean;
  selectedTowerId: number | null;
  automationMode: AutomationMode;
  targetChar: string;
  goalsCompleted: string[];
  idiomSeals: IdiomSeal[];
  featuredIdiomIds: string[];
  /**
   * 목표 서책에서 추적 중인 성어(최대 3, 최소 1 — "성어가 곧 목표").
   * 소환 가중·인연 연구 가중·소모 보호가 이 목록의 부족 글자 합집합을 본다.
   * 봉인에 성공한 성어는 목록에서 빠지고, 비면 다음 미봉인 목표 성어를 승계한다.
   */
  trackedIdiomIds: string[];
  discoveredChars: string[];
  softPity: number;
  lineageClueProgress: number;
  lineageTargetProgress: number;
  unlockedFormations: number[];
  startingFormationIndex: number | null;
  lastMessage: string;
  autoPlaceSummons: boolean;
  summonIntent: SummonIntent;
  towers: Tower[];
  inventoryTowers: Tower[];
  enemies: Enemy[];
  abilityZones: AbilityZone[];
}

/**
 * [트랙 V] `GameState` 밖에 사는 엔진 내부 상태의 저장본.
 *
 * 런 저장이 상태만 담으면 이어 돌린 판이 갈라진다 — 난수기의 다음 눈과
 * 아이디 카운터가 초기값으로 되돌아가기 때문이다. 이 다섯 숫자가 그 틈을 메운다.
 * `rngState` 는 `SeededRng.snapshot()` 이 뜬 uint32 하나이고,
 * `SeededRng.restore()` 가 같은 수열로 되돌린다.
 */
export interface EngineRuntimeSnapshot {
  rngState: number;
  nextTowerId: number;
  nextEnemyId: number;
  nextAbilityZoneId: number;
  autoEvolutionCooldown: number;
}

export type GameEvent =
  | { type: "shot"; from: Point; to: Point; color: string; critical: boolean; wuxing: Wuxing }
  | { type: "damage"; at: Point; amount: number; critical: boolean; weakness: boolean }
  | { type: "kill"; at: Point; reward: number }
  // 봉인한 야생 자령이 남긴 혼. 우두머리는 반드시, 그 밖은 낮은 확률로 남는다.
  | { type: "soul"; at: Point; char: string; boss: boolean }
  | { type: "interest"; amount: number; gold: number }
  // jackpot = 캐주얼 밴드의 소프트 상한 위 별이 꼬리 확률로 나온 순간(공개 카드가 강조한다).
  | { type: "summon"; at: Point; tower: Tower; stored: boolean; helpful: boolean; helpfulReason: "goal" | "idiom" | "both" | null; newDiscovery: boolean; utility: "new" | "synthesis" | "concentration" | "replacement"; jackpot: boolean }
  | { type: "dismantle"; tower: Tower; wuxing: Wuxing; essence: number }
  | { type: "concentrate"; tower: Tower; level: ConcentrationLevel; path: ConcentrationPath; usedDuplicate: boolean; essenceCost: number }
  | { type: "statUpgrade"; scope: "global" | "element"; wuxing: Wuxing | null; stat: UpgradeStat; level: number; cost: number; bonus: number }
  | { type: "traitUpgrade"; wuxing: Wuxing; traitIndex: number; level: number; cost: number }
  | { type: "evolve"; at: Point; tower: Tower; parents: string[]; targetCompleted: boolean }
  | { type: "casualFuse"; at: Point; tower: Tower; consumed: Tower[]; fromStar: CasualStar; toStar: CasualStar; newDiscovery: boolean; starFallback: boolean; rosterFallback: boolean }
  | { type: "ability"; at: Point; source: Point; towerId: number; name: string; glyph: string; color: string; kind: AbilityFxKind; targets: number; effect: string; persistent?: boolean }
  | { type: "goal"; char: string; reward: number }
  // rejoined 는 흩어졌던 줄을 다시 세운 재발동이다. 첫 발동보다 가벼운 연출을 쓴다.
  | { type: "idiom"; idiomId: string; chars: string; reading: string; meaning: string; bonus: string; color: string; cells: number[]; rejoined: boolean }
  | { type: "idiomBroken"; idiomId: string; chars: string; reading: string; bonus: string; color: string; cells: number[] }
  | { type: "wave"; wave: number; boss: boolean; archetype: EnemyArchetype; weakness: Wuxing }
  | { type: "phase"; phase: RunPhase };

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface SimulationResult {
  seed: string;
  region: RegionCode;
  mode: GameMode;
  result: "victory" | "defeat" | "timeout";
  wave: number;
  elapsed: number;
  summons: number;
  peakTowerCount: number;
  evolutions: number;
  casualFusions: number;
  discoveries: number;
  goals: number;
  idioms: number;
  researchLevel: number;
  startingFormationIndex: number | null;
  startingWuxing: Wuxing | null;
  dismantles: number;
  essenceGenerated: number;
  essenceSpent: number;
  essenceSpendRate: number;
  elementTraitLevels: ElementTraitLevels;
  endReason: string;
  checkpoints: SimulationCheckpoint[];
}

export interface SimulationCheckpoint {
  wave: number;
  gold: number;
  formations: number;
  towers: number;
  inventory: number;
  summons: number;
  evolutions: number;
  casualFusions: number;
  discoveries: number;
  goals: number;
  idioms: number;
  dismantles: number;
  essenceGenerated: number;
  essenceSpent: number;
}
