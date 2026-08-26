import { casualStrokeCount } from "./casual";
import { BOARD_CELLS } from "./content";
import {
  type CasualAutoFusionGroup,
  type CasualAutoFusionReport,
  type CasualFusionGain,
  type CasualFusionQuote,
  type CasualFusionResult,
  type CasualResultPool,
  type CleanupAssessment
} from "./engine-quotes";
import {
  casualAutoSkipReason,
  casualFusionDismantleScore,
  casualFusionEssenceRefund,
  casualFusionHeadline,
  casualStarIndexFor,
  concentrationEssenceRefund,
  emptyElementEssence
} from "./engine-tuning";
import { definitionForTower, WUXING_ORDER } from "./hanzi";
import type { IdiomDefinition } from "./idioms";
import type {
  CasualStar,
  GameEvent,
  GameState,
  HanziCatalog,
  HanziDefinition,
  Point,
  Tower,
  Wuxing
} from "./types";

/**
 * 캐주얼 3체 승급이 GameEngine 내부 전체를 알지 않게 만드는 좁은 경계.
 * 공개 API는 계속 GameEngine에 남고, 이 문맥은 그 구현에 필요한 상태와 훅만
 * 전달한다. 따라서 추출이 규칙 변경이나 우회 공개 API로 번지는 것을 막는다.
 */
export interface CasualFusionContext {
  readonly state: GameState;
  readonly catalog: HanziCatalog;
  runSummonPool(): readonly HanziDefinition[];
  random(): number;
  getTargetPath(targetChar: string): Set<string>;
  standardMaterialIds(towers: readonly Tower[], targetChar: string): readonly number[];
  trackedIdioms(): readonly IdiomDefinition[];
  idioms(): readonly IdiomDefinition[];
  sealedIdiomTowerIds(): Set<number>;
  cleanupAssessments(): readonly CleanupAssessment[];
  towerPowerMultiplier(tower: Tower): number;
  towerAttackCooldown(tower: Tower): number;
  createTower(definition: HanziDefinition, cell: number): Tower;
  discover(char: string): void;
  completeGoal(char: string): void;
  resolveIdiomFormations(): void;
  isRunActive(): boolean;
  emit(event: GameEvent): void;
}

interface CasualProtectionContext {
  targetPath: Set<string>;
  unfinishedIdiomChars: Set<string>;
  standardMaterialIds: Set<number>;
  sealedTowerIds: Set<number>;
}

/** 같은 오행·같은 별 3기의 가장 가까운 상위 별 결과 풀. */
export function casualResultPool(
  context: CasualFusionContext,
  wuxing: Wuxing,
  fromStar: CasualStar
): CasualResultPool | null {
  if (fromStar >= 8) return null;
  const runSummonPool = context.runSummonPool();
  const sources: Array<{ index: Map<string, HanziDefinition[]>; rosterFallback: boolean }> = [
    { index: casualStarIndexFor(runSummonPool, runSummonPool), rosterFallback: false },
    { index: casualStarIndexFor(context.catalog.definitions, context.catalog.definitions.values()), rosterFallback: true }
  ];
  for (const source of sources) {
    for (let star = (fromStar + 1) as CasualStar; star <= 8; star = (star + 1) as CasualStar) {
      const candidates = source.index.get(`${wuxing}:${star}`);
      if (!candidates || candidates.length === 0) continue;
      return {
        star,
        candidates,
        starFallback: star !== fromStar + 1,
        rosterFallback: source.rosterFallback
      };
    }
  }
  return null;
}

/*
 * v3 는 3기 전부를 보호 대상에서 빼므로 보호 범위가 곧 "승급이 되느냐"다.
 * 일반 모드 합성식은 캐주얼에서 보호하지 않고, 미완성 성어는 추적 중인 것만
 * 지킨다. 잠금·농축·목표 글자·봉인 완료 성어 보호는 그대로 유지한다.
 */
function casualProtectionContext(context: CasualFusionContext): CasualProtectionContext {
  const casual = context.state.mode === "casual";
  const all = [...context.state.towers, ...context.state.inventoryTowers];
  return {
    targetPath: casual ? new Set([context.state.targetChar]) : context.getTargetPath(context.state.targetChar),
    unfinishedIdiomChars: new Set(
      casual
        ? context.trackedIdioms().flatMap((idiom) => [...idiom.chars])
        : context.idioms()
          .filter((idiom) => !context.state.idiomSeals.some((seal) => seal.idiomId === idiom.id))
          .flatMap((idiom) => [...idiom.chars])
    ),
    standardMaterialIds: casual
      ? new Set<number>()
      : new Set(context.standardMaterialIds(all, context.state.targetChar)),
    sealedTowerIds: context.sealedIdiomTowerIds()
  };
}

function casualMaterialProtectionFor(tower: Tower, context: CasualProtectionContext): string | null {
  if (tower.locked) return "잠금 자령";
  if ((tower.concentration ?? 0) > 0) return `농축 ${tower.concentration}단계 투자`;
  if (context.targetPath.has(tower.char)) return "현재 목표 합성 계보";
  if (context.unfinishedIdiomChars.has(tower.char)) return "미완성 사자성어 재료";
  if (context.sealedTowerIds.has(tower.id)) return "발동 중 사자성어 참여";
  if (context.standardMaterialIds.has(tower.id)) return "일반 모드 합성식 재료";
  return null;
}

export function casualFusionQuote(
  context: CasualFusionContext,
  materialIds: readonly number[]
): CasualFusionQuote {
  const quote: CasualFusionQuote = {
    materialIds: [...materialIds],
    fromStar: null,
    toStar: null,
    wuxing: null,
    poolSize: 0,
    starFallback: false,
    rosterFallback: false,
    blocked: [],
    warnings: []
  };
  if (context.state.mode !== "casual") {
    quote.blocked.push({ towerId: null, text: "별승급 진법에서만 같은 오행 3체 조합을 사용할 수 있습니다." });
    return quote;
  }
  if (materialIds.length !== 3) {
    quote.blocked.push({ towerId: null, text: "같은 오행·같은 별 자령 3기를 정확히 선택하세요." });
    return quote;
  }
  if (new Set(materialIds).size !== 3) {
    quote.blocked.push({ towerId: null, text: "서로 다른 자령 3기를 선택해야 합니다." });
    return quote;
  }
  const all = [...context.state.towers, ...context.state.inventoryTowers];
  const materials = materialIds
    .map((id) => all.find((tower) => tower.id === id))
    .filter((tower): tower is Tower => Boolean(tower));
  for (const id of materialIds) {
    if (!materials.some((tower) => tower.id === id)) quote.blocked.push({ towerId: id, text: `자령 #${id}이 이동했거나 사라졌습니다.` });
  }
  if (materials.length !== 3) return quote;

  const first = materials[0] as Tower;
  const fromStar = first.casualStar ?? first.naturalStar ?? null;
  quote.fromStar = fromStar;
  quote.wuxing = first.wuxing;
  if (fromStar === null || materials.some((tower) => (tower.casualStar ?? tower.naturalStar) === undefined)) {
    quote.blocked.push({ towerId: null, text: "선택한 자령의 별 정보를 확인할 수 없습니다." });
    return quote;
  }
  if (fromStar >= 8) {
    quote.blocked.push({ towerId: first.id, text: "8★ 자령은 더 승급할 수 없습니다." });
    return quote;
  }
  for (const material of materials) {
    if (material.wuxing !== first.wuxing) quote.blocked.push({ towerId: material.id, text: `${material.char}은 ${first.wuxing}행이 아닙니다.` });
    if ((material.casualStar ?? material.naturalStar) !== fromStar) {
      quote.blocked.push({ towerId: material.id, text: `${material.char}의 현재 별이 ${fromStar}★가 아닙니다.` });
    }
  }
  const protectionContext = casualProtectionContext(context);
  for (const material of materials) {
    const protection = casualMaterialProtectionFor(material, protectionContext);
    if (protection) {
      quote.blocked.push({ towerId: material.id, text: `${material.char} · ${protection} — 소모할 수 없습니다.`, kind: "protected" });
    }
  }
  if (quote.blocked.length > 0) return quote;

  const pool = casualResultPool(context, first.wuxing, fromStar);
  if (!pool) {
    quote.blocked.push({ towerId: null, text: `이 오행은 ${fromStar}★ 위 글자가 없습니다`, kind: "pool" });
    return quote;
  }
  quote.toStar = pool.star;
  quote.poolSize = pool.candidates.length;
  quote.starFallback = pool.starFallback;
  quote.rosterFallback = pool.rosterFallback;

  const assessmentById = new Map(context.cleanupAssessments().map((assessment) => [assessment.towerId, assessment]));
  const warningKeys = new Set<string>();
  for (const material of materials) {
    const assessment = assessmentById.get(material.id);
    for (const reason of assessment?.protectedReasons ?? []) {
      if (!reason.endsWith("공명 임계치")) continue;
      const key = `${material.id}:${reason}`;
      if (warningKeys.has(key)) continue;
      warningKeys.add(key);
      quote.warnings.push({ towerId: material.id, text: `${material.char} · ${reason}`, kind: "resonance" });
    }
    if (material.cell >= 0) {
      const key = `${material.id}:deployed`;
      if (!warningKeys.has(key)) quote.warnings.push({ towerId: material.id, text: `${material.char} · 현재 전장에 배치됨`, kind: "deployed" });
      warningKeys.add(key);
    }
  }
  return quote;
}

export function casualMaterialProtection(context: CasualFusionContext, towerId: number): string | null {
  const tower = [...context.state.towers, ...context.state.inventoryTowers].find((candidate) => candidate.id === towerId);
  if (!tower) return null;
  return casualMaterialProtectionFor(tower, casualProtectionContext(context));
}

export function casualMaterialProtections(context: CasualFusionContext): Map<number, string> {
  const protectionContext = casualProtectionContext(context);
  const protections = new Map<number, string>();
  for (const tower of [...context.state.towers, ...context.state.inventoryTowers]) {
    const reason = casualMaterialProtectionFor(tower, protectionContext);
    if (reason !== null) protections.set(tower.id, reason);
  }
  return protections;
}

export function fuseCasual(
  context: CasualFusionContext,
  materialIds: readonly number[],
  allowWarnings = false
): CasualFusionResult {
  const fail = (message: string): CasualFusionResult =>
    ({ ok: false, message, gained: null, consumedChars: [], fromStar: null, starFallback: false, rosterFallback: false });
  if (!context.isRunActive()) return fail("진행 중인 수비전이 없습니다.");
  const quote = casualFusionQuote(context, materialIds);
  if (quote.blocked.length > 0) return fail(`조합 중단 · ${quote.blocked[0]?.text ?? "조건을 다시 확인하세요."}`);
  if (!allowWarnings && quote.warnings.length > 0) {
    return fail(`확인 필요 · ${quote.warnings[0]?.text ?? "전장 자령이 포함되어 있습니다."}`);
  }
  return performCasualFusion(context, quote);
}

export function casualAutoFusionPlan(
  context: CasualFusionContext,
  wuxing: Wuxing
): CasualAutoFusionGroup[] {
  if (context.state.mode !== "casual") return [];
  const protectionContext = casualProtectionContext(context);
  const owned = [...context.state.towers, ...context.state.inventoryTowers]
    .filter((tower) => tower.wuxing === wuxing
      && (tower.casualStar ?? tower.naturalStar ?? 8) < 8
      && casualMaterialProtectionFor(tower, protectionContext) === null);
  const value = (tower: Tower): number => {
    const definition = definitionForTower(context.catalog, tower.definitionId);
    return definition.combat.baseDamage * context.towerPowerMultiplier(tower) * definition.combat.budgetMultiplier / context.towerAttackCooldown(tower);
  };
  const groups: CasualAutoFusionGroup[] = [];
  for (let star = 1 as CasualStar; star <= 7; star = (star + 1) as CasualStar) {
    const available = owned
      .filter((tower) => (tower.casualStar ?? tower.naturalStar) === star)
      .sort((left, right) =>
        Number(left.cell >= 0) - Number(right.cell >= 0) || value(left) - value(right) || left.id - right.id);
    while (available.length >= 3) {
      const materials = available.splice(0, 3);
      const ids = materials.map((tower) => tower.id);
      const quote = casualFusionQuote(context, ids);
      if (quote.blocked.length > 0 || quote.toStar === null) break;
      groups.push({
        wuxing,
        materialIds: [ids[0] ?? -1, ids[1] ?? -1, ids[2] ?? -1],
        fromStar: star,
        toStar: quote.toStar,
        poolSize: quote.poolSize,
        starFallback: quote.starFallback,
        rosterFallback: quote.rosterFallback,
        warnings: quote.warnings,
        autoSkipReason: casualAutoSkipReason(quote.warnings)
      });
    }
  }
  return groups;
}

export function autoFuseCasual(
  context: CasualFusionContext,
  scope: Wuxing | "all",
  allowWarnings = false,
  onlyStar: CasualStar | null = null
): CasualAutoFusionReport {
  const empty = { fused: 0, consumed: 0, skipped: 0, skipReason: null, gained: [], firstFusion: null } as const;
  if (!context.isRunActive()) return { ok: false, message: "진행 중인 수비전이 없습니다.", ...empty, gained: [] };
  const scopes: Wuxing[] = scope === "all" ? [...WUXING_ORDER] : [scope];
  const planned = scopes
    .flatMap((wuxing) => casualAutoFusionPlan(context, wuxing))
    .filter((group) => onlyStar === null || group.fromStar === onlyStar);
  if (planned.length === 0) {
    const label = scope === "all" ? "보유 자령" : `${scope}행 보유 자령`;
    return { ok: false, message: `${label} 중 소모할 수 있는 같은 별 자령 3기가 없습니다.`, ...empty, gained: [] };
  }
  const runnable = allowWarnings ? planned : planned.filter((group) => group.autoSkipReason === null);
  let skipped = planned.length - runnable.length;
  const skipReason = planned.find((group) => group.autoSkipReason !== null)?.autoSkipReason ?? null;
  if (runnable.length === 0) {
    return {
      ok: false,
      message: `보호로 ${skipped}묶음을 모두 건너뜀 · ${skipReason ?? "소모 후보가 보호 대상입니다."}`,
      ...empty,
      gained: [],
      skipped,
      skipReason
    };
  }

  let fused = 0;
  let fromBoard = 0;
  const gained: CasualFusionGain[] = [];
  let firstFusion: CasualAutoFusionReport["firstFusion"] = null;
  for (const group of runnable) {
    const quote = casualFusionQuote(context, group.materialIds);
    if (quote.blocked.length > 0) {
      skipped += 1;
      continue;
    }
    const all = [...context.state.towers, ...context.state.inventoryTowers];
    const consumedTowers = group.materialIds
      .map((id) => all.find((tower) => tower.id === id))
      .filter((tower): tower is Tower => tower !== undefined);
    const boardCount = consumedTowers.filter((tower) => tower.cell >= 0).length;
    const result = performCasualFusion(context, quote);
    if (!result.ok || !result.gained) {
      skipped += 1;
      continue;
    }
    fused += 1;
    fromBoard += boardCount;
    gained.push(result.gained);
    if (!firstFusion) {
      firstFusion = {
        wuxing: result.gained.wuxing,
        char: result.gained.char,
        fromStar: group.fromStar,
        toStar: result.gained.star,
        consumedChars: result.consumedChars,
        newDiscovery: result.gained.newDiscovery,
        starFallback: result.starFallback,
        rosterFallback: result.rosterFallback
      };
    }
  }
  if (fused === 0) return { ok: false, message: "조합 대상이 바뀌었습니다. 다시 확인하세요.", ...empty, gained: [], skipped, skipReason };

  const tail = skipped > 0 ? ` · 보호로 ${skipped}그룹 건너뜀` : "";
  if (fused === 1 && firstFusion) {
    context.state.lastMessage = `${casualFusionHeadline(firstFusion)} · 소모: ${firstFusion.consumedChars.join("·")}${tail}`;
  } else {
    const chars = gained.map((entry) => entry.char).join("·");
    const newCount = gained.filter((entry) => entry.newDiscovery).length;
    const detail = firstFusion ? ` · 첫 결과 ${casualFusionHeadline(firstFusion)}` : "";
    const board = fromBoard > 0 ? ` · 전장 ${fromBoard}기 포함` : "";
    context.state.lastMessage = `승급 ${fused}회 · 소모 ${fused * 3}기 · 획득: ${chars}${newCount > 0 ? ` · 첫 발견 ${newCount}` : ""}${detail}${board}${tail}`;
  }
  return { ok: true, message: context.state.lastMessage, fused, consumed: fused * 3, skipped, skipReason, gained, firstFusion };
}

function performCasualFusion(context: CasualFusionContext, quote: CasualFusionQuote): CasualFusionResult {
  const fail = (message: string): CasualFusionResult =>
    ({ ok: false, message, gained: null, consumedChars: [], fromStar: quote.fromStar, starFallback: false, rosterFallback: false });
  if (quote.fromStar === null || quote.toStar === null || quote.wuxing === null) return fail("조합 별 정보를 다시 확인하세요.");
  const all = [...context.state.towers, ...context.state.inventoryTowers];
  const consumed = quote.materialIds
    .map((id) => all.find((tower) => tower.id === id))
    .filter((tower): tower is Tower => Boolean(tower));
  if (consumed.length !== 3) return fail("조합 대상이 바뀌었습니다. 다시 선택하세요.");
  const pool = casualResultPool(context, quote.wuxing, quote.fromStar);
  if (!pool) return fail(`이 오행은 ${quote.fromStar}★ 위 글자가 없습니다`);
  const definition = pool.candidates[Math.floor(context.random() * pool.candidates.length)] ?? pool.candidates[0] as HanziDefinition;

  const inheritedCell = consumed.find((tower) => tower.cell >= 0)?.cell ?? -1;
  const consumedChars = consumed.map((tower) => tower.char);
  const consumedSnapshots = consumed.map((tower) => ({ ...tower }));
  const consumedIds = new Set(consumed.map((tower) => tower.id));
  const refunds = emptyElementEssence();
  for (const tower of consumed) refunds[tower.wuxing] += concentrationEssenceRefund(tower.concentration ?? 0);
  context.state.towers = context.state.towers.filter((tower) => !consumedIds.has(tower.id));
  context.state.inventoryTowers = context.state.inventoryTowers.filter((tower) => !consumedIds.has(tower.id));
  for (const wuxing of Object.keys(refunds) as Wuxing[]) context.state.elementEssence[wuxing] += refunds[wuxing];

  const fusionEssence = casualFusionEssenceRefund(quote.fromStar);
  if (fusionEssence > 0) {
    context.state.elementEssence[quote.wuxing] += fusionEssence;
    context.state.elementEssenceGenerated[quote.wuxing] += fusionEssence;
    context.state.elementDismantleScore[quote.wuxing] += casualFusionDismantleScore(quote.fromStar);
  }

  const newDiscovery = !context.state.discoveredChars.includes(definition.char);
  const tower = context.createTower(definition, inheritedCell);
  tower.pulse = 1;
  tower.abilityFlash = 1;
  if (inheritedCell >= 0) context.state.towers.push(tower);
  else context.state.inventoryTowers.push(tower);
  context.state.selectedTowerId = tower.id;
  context.state.casualFusionCount += 1;
  context.discover(definition.char);

  const gained: CasualFusionGain = {
    wuxing: tower.wuxing,
    char: tower.char,
    star: pool.star,
    cell: inheritedCell,
    newDiscovery
  };
  const stroke = casualStrokeCount(tower.char);
  const headline = casualFusionHeadline({
    wuxing: quote.wuxing,
    char: tower.char,
    fromStar: quote.fromStar,
    toStar: pool.star,
    newDiscovery,
    starFallback: pool.starFallback,
    rosterFallback: pool.rosterFallback
  });
  context.state.lastMessage = `${headline} · 소모: ${consumedChars.join("·")}${stroke === null ? "" : ` · ${stroke}획`}`;
  context.emit({
    type: "casualFuse",
    at: inheritedCell >= 0 ? BOARD_CELLS[inheritedCell] as Point : { x: 440, y: 360 },
    tower: { ...tower },
    consumed: consumedSnapshots,
    fromStar: quote.fromStar,
    toStar: pool.star,
    newDiscovery,
    starFallback: pool.starFallback,
    rosterFallback: pool.rosterFallback
  });
  if (definition.char === context.state.targetChar) context.completeGoal(definition.char);
  if (context.isRunActive()) context.resolveIdiomFormations();
  return {
    ok: true,
    message: context.state.lastMessage,
    gained,
    consumedChars,
    fromStar: quote.fromStar,
    starFallback: pool.starFallback,
    rosterFallback: pool.rosterFallback
  };
}
