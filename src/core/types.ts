export type RegionCode = "KR" | "JP" | "CN";
export type Wuxing = "木" | "火" | "土" | "金" | "水";
export type ElementKind = "wood" | "fire" | "earth" | "metal" | "water";
export type Stage = 1 | 2 | 3 | 4 | 5;
export type GameMode = "standard" | "casual";
export type CasualStar = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type RunPhase = "title" | "prep" | "combat" | "victory" | "defeat";
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
}

export interface AbilityZone {
  id: number;
  towerId: number;
  kind: "roots" | "lava" | "quicksand" | "caltrops" | "rain";
  wuxing: Wuxing;
  progress: number;
  radius: number;
  damagePerSecond: number;
  expiresAt: number;
  color: string;
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

export interface IdiomSeal {
  idiomId: string;
  cells: number[];
  completedAt: number;
}

export interface GameState {
  seed: string;
  region: RegionCode;
  mode: GameMode;
  phase: RunPhase;
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
  | { type: "casualFuse"; at: Point; tower: Tower; consumed: Tower[]; fromStar: CasualStar; toStar: CasualStar }
  | { type: "ability"; at: Point; source: Point; towerId: number; name: string; glyph: string; color: string; kind: AbilityFxKind; targets: number; effect: string; persistent?: boolean }
  | { type: "goal"; char: string; reward: number }
  | { type: "idiom"; idiomId: string; chars: string; reading: string; meaning: string; bonus: string; color: string; cells: number[] }
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
