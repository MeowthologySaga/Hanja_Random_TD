/*
 * 별승급 3합 패널.
 */
import {
  CASUAL_STAR_COLORS,
  CASUAL_STAR_NAMES,
  CASUAL_STAR_POWER,
  casualNaturalStar,
  casualStarRangeLabel,
  casualStrokeCount
} from "../../core/casual";
import { BOARD_FORMATIONS, CELLS_PER_FORMATION } from "../../core/content";
import { type CasualAutoFusionGroup } from "../../core/game";
import { ELEMENT_STYLES, WUXING_ORDER } from "../../core/hanzi";
import { jaryeongVisualFor } from "../../core/jaryeongs";
import { type CasualStar, type Tower, type Wuxing } from "../../core/types";
import { casualFusionConfirmDialog, ctx, must, sound } from "../app-context";
import { essenceRefundSuffix, essenceSnapshot } from "../essence-feedback";
import { casualStarOf, escapeHtml, spiritPortraitMarkup, visualBackgroundStyle } from "../format";
import { handleAction, setPanelTab, showToast } from "../hud";

function casualFusionTowerMarkup(tower: Tower, selected: boolean, disabled: boolean, badge: string | null = null): string {
  const star = casualStarOf(tower);
  const natural = tower.naturalStar ?? casualNaturalStar(tower.char) ?? star;
  const strokes = casualStrokeCount(tower.char);
  const selectedIndex = ctx.casualFusionSelection.indexOf(tower.id);
  const selectedRole = selectedIndex >= 0 ? `소모 ${selectedIndex + 1}` : "";
  const location = tower.cell < 0 ? "인벤" : BOARD_FORMATIONS[Math.floor(tower.cell / CELLS_PER_FORMATION)]?.label ?? "전장";
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
  return `<button type="button" class="casual-fusion-tower ${selected ? "is-selected is-material" : ""} ${badge ? "is-short" : ""}" data-casual-fusion-tower="${tower.id}" style="--element:${ELEMENT_STYLES[tower.wuxing].color};--star:${CASUAL_STAR_COLORS[star]}" aria-pressed="${String(selected)}" ${disabled ? "disabled" : ""}>
    <i class="casual-fusion-sprite" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></i>
    <b>${escapeHtml(tower.char)}</b>
    <span><strong>${casualStarTagMarkup(star)} ${tower.wuxing}행 · ${CASUAL_STAR_NAMES[star]}</strong><small>${strokes ?? "?"}획 · 기본 ${natural}★ · ${location}${tower.locked ? " · 鎖 잠금" : ""}</small></span>
    <em>${badge ? escapeHtml(badge) : selectedRole || (star >= 8 ? "최고" : "선택")}</em>
  </button>`;
}

function casualFusionSlotMarkup(tower: Tower | undefined, index: number): string {
  const roleLabel = `${["①", "②", "③"][index] ?? "＋"} 소모`;
  if (!tower) {
    return `<button type="button" class="casual-fusion-slot is-material" data-casual-fusion-slot="${index}" disabled style="--element:#526274;--star:#526274" aria-label="${roleLabel} 미선택">
      <span>${roleLabel}</span><b>＋</b><strong>사라집니다</strong><small>같은 오행·같은 별 선택</small>
    </button>`;
  }
  const star = casualStarOf(tower);
  const natural = tower.naturalStar ?? casualNaturalStar(tower.char) ?? star;
  const strokes = casualStrokeCount(tower.char);
  const location = tower.cell < 0 ? "인벤" : BOARD_FORMATIONS[Math.floor(tower.cell / CELLS_PER_FORMATION)]?.label ?? "전장";
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
  return `<button type="button" class="casual-fusion-slot is-filled is-material" data-casual-fusion-slot="${index}" style="--element:${ELEMENT_STYLES[tower.wuxing].color};--star:${CASUAL_STAR_COLORS[star]}" aria-label="${roleLabel} ${tower.char} 선택 해제">
    <span>${roleLabel} <em>소모</em></span>
    <i class="casual-fusion-slot-sprite" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></i>
    <b>${escapeHtml(tower.char)}</b>
    <div><strong>${casualStarTagMarkup(star)} ${tower.wuxing}행</strong><small>자연 ${natural}★ · ${strokes ?? "?"}획</small><small>${location}${tower.locked ? " · 鎖 잠금" : ""}</small></div>
  </button>`;
}

interface CasualFusionBucket {
  wuxing: Wuxing;
  star: CasualStar;
  owned: Tower[];
  groups: CasualAutoFusionGroup[];
  shortReason: string | null;
  /** 막힌 이유의 종류 — 카드가 빈 칸을 그릴지 결과 칸을 지울지 가른다. */
  blockedKind: "no-pool" | "protected" | null;
  /** 보호를 뺀, 지금 실제로 소모할 수 있는 자령(최대 3기까지 초상으로 세운다). */
  usableSamples: Tower[];
  /** 막힌 카드의 툴팁 — 화면에서 덜어낸 수치를 여기 보존한다. */
  blockedTip: string;
}

/**
 * 같은 오행·같은 별로 3체 이상 모인 묶음만 카드로 만든다. 승급이 안 되는
 * 묶음(보호 자령이 많아 소모 후보 3기 미달, 또는 상위 별 글자 자체가 없음)도
 * 사유와 함께 남겨야 "왜 안 되지"가 사라진다.
 */
function casualFusionBuckets(
  allTowers: readonly Tower[],
  plans: ReadonlyMap<Wuxing, CasualAutoFusionGroup[]>,
  protections: ReadonlyMap<number, string>
): CasualFusionBucket[] {
  const owned = new Map<string, Tower[]>();
  for (const tower of allTowers) {
    const star = casualStarOf(tower);
    if (star >= 8) continue;
    const key = `${tower.wuxing}:${star}`;
    const list = owned.get(key) ?? [];
    list.push(tower);
    owned.set(key, list);
  }
  const buckets: CasualFusionBucket[] = [];
  for (const wuxing of WUXING_ORDER) {
    for (let star = 1 as CasualStar; star <= 7; star = (star + 1) as CasualStar) {
      const list = owned.get(`${wuxing}:${star}`) ?? [];
      if (list.length < 3) continue;
      const groups = (plans.get(wuxing) ?? []).filter((group) => group.fromStar === star);
      let shortReason: string | null = null;
      let blockedKind: CasualFusionBucket["blockedKind"] = null;
      let usableSamples: Tower[] = [];
      let blockedTip = "";
      if (groups.length === 0) {
        if (ctx.engine.casualResultPool(wuxing, star) === null) {
          // 재료는 멀쩡한데 위 별 글자가 없다 — 빈 칸이 아니라 결과 칸이 없는 경우다.
          blockedKind = "no-pool";
          usableSamples = list.slice(0, 3);
          shortReason = "이 오행에는 다음 별 글자가 없습니다";
          blockedTip = `${wuxing}행 ${star}★ 보유 ${list.length}기 · ${star + 1}★ 이상 후보 글자가 없어 승급할 수 없습니다`;
        } else {
          const usable = list.filter((tower) => !protections.has(tower.id));
          const reasons = list.map((tower) => protections.get(tower.id)).filter((reason): reason is string => reason !== undefined);
          const top = [...new Set(reasons)].slice(0, 2).join(" · ");
          const need = Math.max(1, 3 - usable.length);
          // 몇 기가 모자란지는 빈 초상 칸이 말한다. 글줄은 사유와 다음 행동만 남긴다.
          blockedKind = "protected";
          usableSamples = usable.slice(0, 3);
          shortReason = `${top || "보호"} 보호 — 같은 별 ${need}기를 더 모으세요`;
          blockedTip = `보유 ${list.length}기 중 소모 가능 ${usable.length}기 · ${top || "보호"} 보호로 ${need}기 부족`;
        }
      }
      buckets.push({ wuxing, star, owned: list, groups, shortReason, blockedKind, usableSamples, blockedTip });
    }
  }
  return buckets;
}

/** `★n` 은 본문과 다른 서체 등록부(금박·굵기·tabular-nums)로 분리한 배지다. */
function casualStarTagMarkup(star: number, variant = ""): string {
  return `<i class="casual-star-tag${variant}">★${star}</i>`;
}

function casualGroupMaterialMarkup(tower: Tower, star: CasualStar): string {
  return `<span class="casual-group-material">`
    + spiritPortraitMarkup(tower.char, tower.wuxing, "workbench-spirit--group")
    + casualStarTagMarkup(star)
    + `</span>`;
}

/**
 * 그룹 카드는 "읽는 표"가 아니라 "보는 문장"이다.
 *
 * `[오행 인장] [초상 3연속(+여분)] → [? 결과 칸]` 가로 한 줄이 곧 규칙이고,
 * 글자는 제목 한 줄 + 필요할 때만 경고 한 줄로 줄인다. 소모 글자 목록·후보
 * 글자 수·보유 수 같은 수치는 지우지 않고 카드 툴팁으로 내린다.
 *
 * 보유 수 `×N` 표기는 폐지했다 — `1★ ×4 → 2★` 를 보고 "왜 4개를 합치냐"고
 * 읽는 오독이 실제로 나왔다. 소모 수는 초상 3개만으로 말하고, 남는 자령은
 * 초상 뒤 흐린 `+N` 스택 칩으로 "쓰이지 않고 남는다"를 그림으로 보여 준다.
 */
function casualGroupCardMarkup(bucket: CasualFusionBucket, allTowers: readonly Tower[], active: boolean): string {
  const next = Math.min(8, bucket.star + 1) as CasualStar;
  const first = bucket.groups[0];
  const toStar = first?.toStar ?? next;
  const style = `--element:${ELEMENT_STYLES[bucket.wuxing].color};--star:${CASUAL_STAR_COLORS[bucket.star]};--result-star:${CASUAL_STAR_COLORS[toStar]}`;
  if (bucket.shortReason) {
    const noPool = bucket.blockedKind === "no-pool";
    // 모자란 만큼을 빈 초상 실루엣으로 세운다 — "2/3" 을 읽지 않아도 보인다.
    const slots = [0, 1, 2].map((index) => {
      const tower = bucket.usableSamples[index];
      return tower
        ? casualGroupMaterialMarkup(tower, bucket.star)
        : `<span class="casual-group-material is-empty"><i>＋</i></span>`;
    }).join("");
    return `<article class="casual-group-card is-blocked" style="${style}" title="${escapeHtml(bucket.blockedTip)}">
      <i class="casual-group-glyph" aria-hidden="true">${bucket.wuxing}</i>
      <div class="casual-group-scene" aria-hidden="true">
        <span class="casual-group-materials">${slots}</span>
        <i class="casual-group-arrow">→</i>
        <span class="casual-group-result is-blocked"><b>${noPool ? "✕" : "?"}</b>${noPool ? "" : casualStarTagMarkup(next, " is-result")}</span>
      </div>
      <div class="casual-group-body"><b class="casual-group-title">${escapeHtml(bucket.shortReason)}</b></div>
      <span class="casual-group-run is-disabled">${noPool ? "상위 없음" : "보호 중"}</span>
    </article>`;
  }
  const materials = (first?.materialIds ?? []).map((id) => allTowers.find((tower) => tower.id === id)).filter((tower): tower is Tower => Boolean(tower));
  const usedIds = new Set(bucket.groups.flatMap((group) => group.materialIds));
  const spares = bucket.owned.filter((tower) => !usedIds.has(tower.id));
  const boardMaterials = [...usedIds]
    .map((id) => allTowers.find((tower) => tower.id === id))
    .filter((tower): tower is Tower => tower !== undefined && tower.cell >= 0).length;
  const results = bucket.groups.length;
  const consumed = results * 3;
  const materialStrip = materials.map((tower) => casualGroupMaterialMarkup(tower, bucket.star)).join("");
  const spare = spares[0];
  const spareChip = spare
    ? `<span class="casual-group-spare">${spiritPortraitMarkup(spare.char, spare.wuxing, "workbench-spirit--group")}<i>+${spares.length}</i></span>`
    : "";
  const notes = [
    boardMaterials > 0 ? `<em class="casual-group-badge is-board">전장 ${boardMaterials}기 소모</em>` : "",
    results > 1 ? `<em class="casual-group-badge">3기씩 ${results}묶음 한 번에</em>` : "",
    first?.starFallback ? `<em class="casual-group-badge is-fallback">상위 별 건너뜀</em>` : "",
    first?.rosterFallback ? `<em class="casual-group-badge is-fallback">지역 로스터 보충</em>` : ""
  ].filter((note) => note !== "").join("");
  const tip = [
    `보유 ${bucket.owned.length}기 중 ${consumed}기 소모${results > 1 ? ` (3기씩 ${results}묶음)` : ""} · 여분 ${spares.length}기 유지`,
    materials.length > 0 ? `소모 ${materials.map((tower) => tower.char).join("·")}` : "",
    first ? `${toStar}★ 후보 ${first.poolSize}자 중 하나가 무작위로 나옵니다` : "",
    boardMaterials > 0 ? `전장 ${boardMaterials}기가 빠집니다` : "",
    first?.starFallback ? `${bucket.star + 1}★ 글자가 없어 ${toStar}★ 에서 뽑습니다` : "",
    first?.rosterFallback ? "이번 런 소환 풀에 후보가 없어 지역 로스터에서 보충합니다" : ""
  ].filter((line) => line !== "").join(" · ");
  const runLabel = `${bucket.wuxing}행 ${bucket.star}★ ${consumed}기를 소모해 ${toStar}★ 자령 ${results}기를 무작위로 얻습니다`;
  return `<article class="casual-group-card" style="${style}" title="${escapeHtml(tip)}">
    <i class="casual-group-glyph" aria-hidden="true">${bucket.wuxing}</i>
    <div class="casual-group-scene" aria-hidden="true">
      <span class="casual-group-materials">${materialStrip}${spareChip}</span>
      <i class="casual-group-arrow">→</i>
      <span class="casual-group-result"><b>?</b>${casualStarTagMarkup(toStar, " is-result")}</span>
    </div>
    <div class="casual-group-body">
      <b class="casual-group-title">다음 별 자령 ${results}기 — 무작위</b>
      ${notes === "" ? "" : `<span class="casual-group-notes">${notes}</span>`}
    </div>
    <button type="button" class="casual-group-run" data-casual-group="${bucket.wuxing}:${bucket.star}" aria-label="${escapeHtml(runLabel)}" ${active ? "" : "disabled"}>승급</button>
  </article>`;
}

export function renderCasualFusion(): void {
  const allTowers = [...ctx.engine.state.towers, ...ctx.engine.state.inventoryTowers];
  const ids = new Set(allTowers.map((tower) => tower.id));
  ctx.casualFusionSelection = ctx.casualFusionSelection.filter((id, index) => ids.has(id) && ctx.casualFusionSelection.indexOf(id) === index).slice(0, 3);
  const anchor = allTowers.find((tower) => tower.id === ctx.casualFusionSelection[0]);
  if (anchor && casualStarOf(anchor) >= 8) ctx.casualFusionSelection = [];
  const selectedTowers = ctx.casualFusionSelection.map((id) => allTowers.find((tower) => tower.id === id)).filter((tower): tower is Tower => Boolean(tower));
  const quote = selectedTowers.length === 3 ? ctx.engine.casualFusionQuote(ctx.casualFusionSelection) : null;
  const active = ctx.engine.state.phase === "prep" || ctx.engine.state.phase === "combat";
  const plans = new Map(WUXING_ORDER.map((wuxing) => [wuxing, ctx.engine.casualAutoFusionPlan(wuxing)] as const));
  const protections = ctx.engine.casualMaterialProtections();
  const readyCount = [...plans.values()].reduce((sum, groups) => sum + groups.length, 0);
  const inventorySignature = allTowers.map((tower) => `${tower.id}:${tower.wuxing}:${casualStarOf(tower)}:${tower.cell}:${tower.locked ? 1 : 0}:${tower.concentration ?? 0}`).join("|");
  const key = `${inventorySignature}|S${ctx.casualFusionSelection.join(",")}|R${readyCount}`;

  must<HTMLElement>("#evolution-count").textContent = String(readyCount);
  // 같은 수를 헤더 배지·버튼 칩·버튼 라벨이 셋이 나눠 세던 것을 [한 번에 승급 (N회)]
  // 하나로 모은다. 헤더 배지는 숨기고 설명문은 그대로 둔다.
  must<HTMLElement>("#evolution-count").hidden = true;
  must<HTMLElement>("#evolve-ready-count").textContent = String(readyCount);
  must<HTMLElement>("#evolve-action-label").textContent = "3체 조합";
  must<HTMLElement>("#evolve-action-detail").textContent = "회 가능";
  must<HTMLElement>("#evolution-tab-label").textContent = "3체 조합";
  must<HTMLElement>("#evolution-kicker").textContent = "3체 조합 · 팔성 승급";
  must<HTMLElement>("#evolution-heading-label").textContent = "승급 대기 묶음";
  must<HTMLElement>("#standard-evolution-modes").hidden = true;
  must<HTMLElement>("#casual-fusion-toolbar").hidden = false;
  const evolveButton = must<HTMLButtonElement>("#evolve-button");
  evolveButton.disabled = !active;
  evolveButton.classList.toggle("has-ready", readyCount > 0);
  const container = must<HTMLElement>("#evolution-options");
  container.classList.add("is-casual");
  const buckets = casualFusionBuckets(allTowers, plans, protections);
  const fuseAllButton = must<HTMLButtonElement>("#casual-fuse-all");
  // 일괄 실행은 전장 재료 묶음을 건너뛰므로, 버튼이 세는 수도 실제로
  // 실행될 묶음만이어야 한다. "(2회)"를 보고 눌렀는데 0회 승급되는
  // 죽은 버튼을 만들지 않는다. 건너뛸 묶음은 안내문이 카드로 보낸다.
  const runnableCount = [...plans.values()]
    .reduce((sum, groups) => sum + groups.filter((group) => group.autoSkipReason === null).length, 0);
  const heldCount = readyCount - runnableCount;
  fuseAllButton.disabled = !active || runnableCount === 0;
  must<HTMLElement>("#casual-fuse-all-count").textContent = `(${runnableCount}회)`;
  must<HTMLElement>("#casual-fuse-all-note").textContent = runnableCount > 0
    ? `3기가 모두 사라지고 같은 오행의 다음 별 자령 1기를 무작위로 얻습니다. 인벤토리 자령을 먼저 씁니다.${heldCount > 0 ? ` 전장 자령이 낀 ${heldCount}묶음은 아래 카드에서 개별 실행하세요.` : ""}`
    : heldCount > 0
      ? `모인 ${heldCount}묶음이 전부 전장 자령을 소모합니다. 일괄에서는 건너뛰니, 아래 카드의 [승급] 버튼으로 하나씩 실행하세요.`
      : buckets.some((bucket) => bucket.shortReason !== null)
        ? "3체는 모였지만 소모할 수 없는 자령이 섞여 있습니다. 아래 카드에서 사유를 확인하세요."
        : "같은 오행·같은 별 자령이 3체 모이면 여기서 한 번에 승급합니다.";
  if (key === ctx.evolutionRenderKey) return;
  ctx.evolutionRenderKey = key;

  const slotMarkup = [0, 1, 2].map((index) => casualFusionSlotMarkup(selectedTowers[index], index)).join("");
  const selectedIds = new Set(ctx.casualFusionSelection);
  const candidates = allTowers
    .filter((tower) => {
      if (!anchor || selectedIds.has(tower.id)) return true;
      return tower.wuxing === anchor.wuxing && casualStarOf(tower) === casualStarOf(anchor);
    })
    .sort((left, right) => Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id)) || casualStarOf(right) - casualStarOf(left) || left.wuxing.localeCompare(right.wuxing) || left.id - right.id);
  // 같은 오행·별로 3체가 안 모인 자령은 고르기 전에 흐리게 표시한다.
  const bucketSize = new Map<string, number>();
  for (const tower of allTowers) {
    const key = `${tower.wuxing}:${casualStarOf(tower)}`;
    bucketSize.set(key, (bucketSize.get(key) ?? 0) + 1);
  }
  const candidateMarkup = candidates.length > 0 ? candidates.map((tower) => {
    const selectionIndex = ctx.casualFusionSelection.indexOf(tower.id);
    const incompatible = Boolean(anchor) && selectionIndex < 0 && (tower.wuxing !== anchor?.wuxing || casualStarOf(tower) !== casualStarOf(anchor));
    const star = casualStarOf(tower);
    const tooFew = selectionIndex < 0 && star < 8 && (bucketSize.get(`${tower.wuxing}:${star}`) ?? 0) < 3;
    // v3 규칙 2: 보호 자령은 3기 어디에도 못 들어가므로 첫 슬롯부터 사유를 붙여 잠근다.
    const protection = selectionIndex < 0 ? protections.get(tower.id) ?? null : null;
    const noPool = selectionIndex < 0 && star < 8 && ctx.engine.casualResultPool(tower.wuxing, star) === null;
    const badge = selectionIndex >= 0 ? null : protection ?? (noPool ? "상위 별 없음" : tooFew ? "3체 미달" : null);
    const disabled = !active
      || ctx.casualFusionSelection.length >= 3 && selectionIndex < 0
      || protection !== null
      || noPool
      || selectionIndex < 0 && incompatible
      || !anchor && (star >= 8 || tooFew);
    return casualFusionTowerMarkup(tower, selectionIndex >= 0, disabled, badge);
  }).join("") : `<div class="empty-evolution"><b>소환한 자령이 없습니다</b><span>상점에서 첫 자령을 소환하면 획수에 따른 기본 별이 표시됩니다.</span></div>`;
  const status = quote?.blocked.length
    ? `<p class="casual-fusion-status is-blocked"><b>조합 불가</b><span>${quote.blocked.map((issue) => escapeHtml(issue.text)).join(" · ")}</span></p>`
    : quote
      ? `<p class="casual-fusion-status ${quote.warnings.length > 0 ? "has-warning" : "is-ready"}"><b>${casualStarTagMarkup(quote.fromStar ?? 1)} 3기 → 다음 별 자령 1기 · 무작위</b><span>${quote.warnings.length > 0 ? `${quote.warnings.length}개 확인 사항 · 3기가 모두 사라집니다.` : `3기가 모두 사라지고 ${quote.wuxing}행 ${quote.toStar}★ 후보 ${quote.poolSize}자 중 하나를 얻습니다.`}</span></p>`
      : `<p class="casual-fusion-status"><b>${selectedTowers.length}/3 선택</b><span>${selectedTowers.length === 0 ? "소모할 자령부터 선택하세요 — 3기 모두 사라집니다." : "같은 오행·같은 현재 별 자령을 마저 고르세요."}</span></p>`;
  const previewPool = anchor && casualStarOf(anchor) < 8 ? ctx.engine.casualResultPool(anchor.wuxing, casualStarOf(anchor)) : null;
  const resultStar = quote?.toStar ?? previewPool?.star ?? null;
  const groupCards = buckets.map((bucket) => casualGroupCardMarkup(bucket, allTowers, active)).join("");
  // 트랙 A #1: 빈 상태는 콤팩트 카드 1장 — 안내 1문장 + [상점으로].
  // "상점에서 소환을 계속하세요" 부제는 버튼이 같은 말을 하므로 문장에 합쳤다.
  const emptyState = `<div class="casual-group-empty">
    <b>같은 오행·같은 별 자령이 3체 모이면 여기서 한 번에 승급합니다 — 상점에서 소환을 계속하세요.</b>
    <button type="button" id="casual-goto-shop" class="casual-goto-shop">상점으로</button>
  </div>`;
  container.innerHTML = `
    <div class="casual-group-list">${groupCards || emptyState}</div>
    <details class="casual-manual" id="casual-manual-details"${ctx.casualManualOpen ? " open" : ""}>
      <summary><b>직접 고르기</b><small>소모할 같은 오행·같은 별 자령 3기를 손으로 지정합니다</small></summary>
      <div class="casual-rarity-rule"><span><b>획수 기본 별</b><small>실제 Unicode kTotalStrokes</small></span>${([1, 2, 3, 4, 5, 6, 7, 8] as CasualStar[]).map((star) => `<i style="--star:${CASUAL_STAR_COLORS[star]}"><b>★${star}</b><small>${casualStarRangeLabel(star)}</small></i>`).join("")}</div>
      <div class="casual-fusion-slots">${slotMarkup}<i aria-hidden="true">→</i><div class="casual-fusion-result is-random" style="--star:${resultStar ? CASUAL_STAR_COLORS[resultStar] : "#526274"}"><span>무작위 획득</span><b>?</b><strong${resultStar ? "" : ` class="is-placeholder"`}>${resultStar ? `${casualStarTagMarkup(resultStar, " is-result")} 무작위 1기` : "별 미정 — 자령을 먼저 선택"}</strong><small>${resultStar ? `피해 ×${CASUAL_STAR_POWER[resultStar].toFixed(2)} · 후보 ${quote?.poolSize ?? previewPool?.candidates.length ?? 0}자` : "소모할 자령 선택 필요"}</small></div></div>
      ${status}
      <button id="casual-fusion-review" class="workbench-primary casual-fusion-review" type="button" ${!quote || quote.blocked.length > 0 ? "disabled" : ""}>소모 목록 확인 후 ${resultStar ? `★${resultStar}` : "?"} 무작위 획득</button>
      <div class="casual-candidate-heading"><div><b>보유 자령</b><small>${anchor ? `${anchor.wuxing}행 ★${casualStarOf(anchor)}만 표시` : "3체가 모인 자령만 고를 수 있습니다"}</small></div><em>잠금·농축·목표·성어는 소모 불가</em></div>
      <div class="casual-fusion-candidates">${candidateMarkup}</div>
    </details>`;
}

function casualConfirmTowerRow(tower: Tower): string {
  const star = casualStarOf(tower);
  const strokes = casualStrokeCount(tower.char);
  const visual = jaryeongVisualFor(tower.char, tower.wuxing, ctx.engine.state.region);
  return `<article class="casual-confirm-tower is-material" style="--element:${ELEMENT_STYLES[tower.wuxing].color};--star:${CASUAL_STAR_COLORS[star]}"><i class="casual-confirm-sprite" style="${visualBackgroundStyle(visual)}" aria-hidden="true"></i><b>${escapeHtml(tower.char)}</b><span><strong>소모 · 복구 불가</strong><small>${tower.wuxing}행 · ${star}★ · ${strokes ?? "?"}획 · ${tower.cell < 0 ? "인벤" : "전장"}</small></span><em>소모</em></article>`;
}

export function openCasualManualReview(): void {
  if (ctx.casualFusionSelection.length !== 3) return;
  const [firstId, secondId, thirdId] = ctx.casualFusionSelection;
  if (firstId === undefined || secondId === undefined || thirdId === undefined) return;
  const materialIds: [number, number, number] = [firstId, secondId, thirdId];
  const quote = ctx.engine.casualFusionQuote(materialIds);
  if (quote.blocked.length > 0 || quote.fromStar === null || quote.toStar === null || quote.wuxing === null) {
    showToast(quote.blocked[0]?.text ?? "조합 조건을 다시 확인하세요.", true);
    return;
  }
  const all = [...ctx.engine.state.towers, ...ctx.engine.state.inventoryTowers];
  const materials = materialIds.map((id) => all.find((tower) => tower.id === id)).filter((tower): tower is Tower => Boolean(tower));
  if (materials.length !== 3) return;
  ctx.pendingCasualFusion = { kind: "manual", materialIds, quote };
  const boardCount = materials.filter((tower) => tower.cell >= 0).length;
  must<HTMLElement>("#casual-fusion-confirm-title").textContent = `${quote.wuxing}행 ${quote.fromStar}★×3 → ${quote.toStar}★ 무작위`;
  const fallbackNote = quote.starFallback
    ? `<p class="casual-confirm-safe">${quote.fromStar + 1}★ ${quote.wuxing}행 글자가 없어 ${quote.toStar}★에서 뽑습니다.</p>`
    : quote.rosterFallback
      ? `<p class="casual-confirm-safe">이번 런 소환 풀에 후보가 없어 지역 로스터에서 보충합니다.</p>`
      : "";
  must<HTMLElement>("#casual-fusion-confirm-content").innerHTML = `
    <section class="casual-confirm-summary"><b>3기가 모두 사라지고 ${quote.toStar}★ 자령 1기를 무작위로 얻습니다</b><span>결과 글자는 공개 순간에 정해지며 되돌릴 수 없습니다.${boardCount > 0 ? ` 전장 ${boardCount}기가 빠지고 첫 자리에 새 자령이 들어섭니다.` : ""}</span><div><i>현재 피해 ×${CASUAL_STAR_POWER[quote.fromStar].toFixed(2)}</i><em>→</em><strong>획득 피해 ×${CASUAL_STAR_POWER[quote.toStar].toFixed(2)}</strong></div></section>
    <div class="casual-confirm-towers">${materials.map((tower) => casualConfirmTowerRow(tower)).join("")}</div>
    <p class="casual-confirm-pool"><b>${quote.wuxing}행 ${quote.toStar}★ 후보 ${quote.poolSize}자</b><span>이 중 하나가 무작위로 나옵니다.</span></p>
    ${fallbackNote}
    ${quote.warnings.length > 0 ? `<section class="casual-confirm-warnings"><b>확인 사항 ${quote.warnings.length}개</b><ul>${quote.warnings.map((warning) => `<li>${escapeHtml(warning.text)}</li>`).join("")}</ul></section>` : `<p class="casual-confirm-safe">잠금·목표·성어·농축 충돌이 없습니다.</p>`}`;
  must<HTMLButtonElement>("#casual-fusion-execute").textContent = `3기 소모 · ${quote.toStar}★ 무작위 획득`;
  casualFusionConfirmDialog.showModal();
}

/**
 * 그룹 카드·[한 번에 승급]의 원클릭 실행. 확인 모달을 거치지 않는 대신
 * 결과(승급 횟수·소모 자령·건너뛴 묶음)를 토스트로 반드시 가시화한다.
 */
export function runCasualAutoFusion(scope: Wuxing | "all", star: CasualStar | null): void {
  sound.unlock();
  // 카드 한 장은 사용자가 배지까지 보고 누른 것이므로 전장 재료도 실행한다.
  // [한 번에 승급] 은 전 오행 일괄이라 전장 재료 묶음을 건너뛴다.
  const essenceBefore = essenceSnapshot();
  const report = ctx.engine.autoFuseCasual(scope, star !== null, star);
  // 트랙 A #2-3: 승급 토스트에는 삼체일득 환급이 빠져 있다(엔진 문장 무수정
  // 원칙). 실측 증가분으로 UI 가 덧붙이고, showToast 가 오행색 칩으로 세운다.
  if (report.ok) report.message += essenceRefundSuffix(essenceBefore);
  ctx.casualFusionSelection = [];
  ctx.evolutionRenderKey = "";
  handleAction(report);
  if (report.ok) setPanelTab("evolution");
}

function closeCasualFusionReview(): void {
  ctx.pendingCasualFusion = null;
  if (casualFusionConfirmDialog.open) casualFusionConfirmDialog.close();
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireCasualFusion1(): void {
  must<HTMLButtonElement>("#casual-fusion-confirm-close").addEventListener("click", closeCasualFusionReview);
  must<HTMLButtonElement>("#casual-fusion-cancel").addEventListener("click", closeCasualFusionReview);
  must<HTMLButtonElement>("#casual-fusion-execute").addEventListener("click", () => {
    const pending = ctx.pendingCasualFusion;
    if (!pending) return;
    sound.unlock();
    const essenceBefore = essenceSnapshot();
    const result = ctx.engine.fuseCasual(pending.materialIds, true);
    if (result.ok) result.message += essenceRefundSuffix(essenceBefore);
    if (result.ok) ctx.casualFusionSelection = [];
    closeCasualFusionReview();
    ctx.evolutionRenderKey = "";
    handleAction(result);
    if (result.ok) setPanelTab("evolution");
  });
}
