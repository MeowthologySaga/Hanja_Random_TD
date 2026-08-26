export type RegionCode = "KR" | "JP" | "CN";
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
// 티어 소환이며, 가중이 아니라 후보 풀 필터(확정 보장)로 동작한다.
export type SummonIntent = "balanced" | "discovery" | "lineage" | "concentration" | "midstar" | "highstar";
export type ConcentrationPath = "swift" | "potent";
export type ConcentrationLevel = 0 | 1 | 2 | 3;
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
  | "general";
export type TargetPriority = "front" | "strongest" | "fastest" | "armored" | "cluster" | "valuable";
export type EnemyArchetype = "normal" | "swarm" | "swift" | "armored" | "regenerator" | "boss";
export type AbilityCategory = "element" | "semantic" | "role" | "graph" | "lineage";
export type IdiomBonusKind = "range" | "damage" | "evolutionGold" | "enemySlow";
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
}

export interface Enemy {
  id: number;
  wave: number;
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
}

export interface AbilityZone {
  id: number;
  towerId: number;
  // [SKILL-V1] "frost" 는 서리길(피해 없는 감속 장판)이다.
  kind: "roots" | "lava" | "quicksand" | "caltrops" | "rain" | "frost";
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

export type GameEvent =
  | { type: "shot"; from: Point; to: Point; color: string; critical: boolean; wuxing: Wuxing }
  | { type: "damage"; at: Point; amount: number; critical: boolean; weakness: boolean }
  | { type: "kill"; at: Point; reward: number }
  | { type: "interest"; amount: number; gold: number }
  | { type: "summon"; at: Point; tower: Tower; stored: boolean; helpful: boolean; helpfulReason: "goal" | "idiom" | "both" | null; newDiscovery: boolean; utility: "new" | "synthesis" | "concentration" | "replacement" }
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
