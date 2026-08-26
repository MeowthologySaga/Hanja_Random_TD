/*
 * 소환 상점 패널.
 */
import { BOARD_FORMATIONS } from "../../core/content";
import { IDIOM_WISH_COST_MULTIPLIER } from "../../core/engine-tuning";
import { multiSummonCost, SUMMON_SURCHARGE, summonCost } from "../../core/hanzi";
import { type SummonIntent } from "../../core/types";
import { ctx, must } from "../app-context";
import { summonAndFocus, summonIdiomWishAndFocus } from "../battle/camera";
import { escapeHtml } from "../format";
import { showToast } from "../hud";

/**
 * 상점 소환 상품표.
 *
 * 목적 탭 + 단일 버튼은 "지금 어떤 목적인가"를 기억해야 하는 숨은 상태였다.
 * 카드 한 장이 곧 상품 한 개이므로 가격·효과·아이콘이 클릭 지점에 함께 붙는다.
 * 아이콘은 v4-rounds-assets-pack-v1 의 72×72 white-alpha 마스크를 24px 로 쓴다.
 */
interface SummonProductMeta {
  readonly intent: SummonIntent;
  readonly label: string;
  readonly effect: string;
  readonly tint: string;
  readonly icon: string;
}

// 캐주얼 순서는 기본 → 중급 → 고급 → 탐색 → 중복, 자형연성은 기본 → 탐색 → 계보 → 중복.
// 하나의 배열을 모드별로 걸러 두 순서를 동시에 만족시킨다.
// 중급·고급은 별 개수(2개/3개)가 그림 안에 들어 있는 v5 전용 아이콘을 쓴다.
// 두 티어가 같은 별 아이콘을 쓰면 색만이 유일한 구분이 되어 색각 차이에서 무너진다.
const SUMMON_PRODUCTS: readonly SummonProductMeta[] = Object.freeze([
  { intent: "balanced", label: "기본 소환", effect: "전체 풀", tint: "#a8791f", icon: "v4/shop/shop-default-coin-v1" },
  { intent: "midstar", label: "중급 소환", effect: "2~5★ 확정", tint: "#306f89", icon: "v5/shop/shop-tier-mid-v1" },
  { intent: "highstar", label: "고급 소환", effect: "3~8★ 확정", tint: "#af3629", icon: "v5/shop/shop-tier-high-v1" },
  { intent: "discovery", label: "탐색 소환", effect: "새 한자 ×3.4", tint: "#3f7d6e", icon: "v4/shop/shop-explore-compass-lantern-v1" },
  { intent: "lineage", label: "계보 소환", effect: "목표·성어 재료 ×3.2", tint: "#3a5794", icon: "v4/shop/shop-lineage-scroll-v1" },
  { intent: "concentration", label: "중복 소환", effect: "보유 중복 ↑ · 농축 재료", tint: "#9a6d16", icon: "v4/shop/shop-duplicate-cards-v1" }
] as const);

/** 세 티어 공통으로 걸리는 캐주얼 짝 맞추기 보정 안내. */
const PAIR_BOOST_NOTE = "짝이 맞는 자령이 더 자주 나옵니다";

/** FB2 — 별의 근거. 티어 카드(중급·고급) 툴팁에만 붙인다(확률 문구와 별개). */
const STROKE_STAR_NOTE = "획이 많은 한자일수록 별이 높습니다";

// 인라인 style 의 var() 에 담긴 상대 url() 을 크롬은 "사용하는 CSS 파일" 기준으로
// 풀어 버린다(/assets/index.css → /assets/assets/… 404). 문서 기준 절대 URL 로 고정.
const SUMMON_ICON_BASE = new URL(`${import.meta.env.BASE_URL}assets/ui/`, document.baseURI).toString();

let summonShopRenderKey = "";

function summonCardMarkup(options: {
  key: string;
  label: string;
  effect: string;
  tint: string;
  icon: string;
  price: string;
  disabled: boolean;
  affordable: boolean;
  hotkey?: string;
  wide?: boolean;
  testId?: string;
  title: string;
}): string {
  const classes = ["summon-card"];
  if (options.wide) classes.push("summon-card--wide");
  if (!options.affordable) classes.push("summon-card--short");
  const testId = options.testId ? ` data-testid="${options.testId}"` : "";
  const hotkey = options.hotkey ? `<span class="summon-card-key">${options.hotkey}</span>` : "";
  return `<button type="button" class="${classes.join(" ")}" data-summon-product="${options.key}"${testId}`
    + ` style="--product:${options.tint};--product-icon:url('${SUMMON_ICON_BASE}${options.icon}.png')"`
    + ` title="${escapeHtml(options.title)}" aria-label="${escapeHtml(`${options.label} · ${options.effect} · ${options.price}`)}"`
    + `${options.disabled ? " disabled" : ""}>`
    + `<i class="summon-card-icon" aria-hidden="true"></i>`
    + `<b>${escapeHtml(options.label)}</b><small>${escapeHtml(options.effect)}</small>`
    + `<em>${escapeHtml(options.price)}</em>${hotkey}</button>`;
}

export function renderSummonShop(): void {
  const state = ctx.engine.state;
  const active = state.phase === "prep" || state.phase === "combat";
  const base = summonCost(state.summonCount);
  const tenCost = multiSummonCost(state.summonCount, 10);
  const multiUnlocked = state.wave >= 10;
  const products = SUMMON_PRODUCTS
    .filter((product) => ctx.engine.isSummonProductAvailable(product.intent))
    .map((product) => {
      // 좁은 지역 풀에서는 밴드 하한이 한 단계 내려간다. 카드 문구도 실효 밴드를 따른다.
      const band = ctx.engine.summonStarBand(product.intent);
      if (band === null) return { ...product, band: null, bandLabel: "" };
      const bandLabel = `${band.min}~${band.max}★${band.min > 1 ? " 확정" : ""}`;
      // 탐색·중복은 밴드가 아니라 가중이 정체성이므로 효과 문구를 그대로 두고
      // 밴드는 툴팁으로만 알린다. 기본·티어는 밴드 자체가 상품 설명이다.
      const showsBand = product.intent === "balanced" || band.min > 1;
      return { ...product, band, bandLabel, effect: showsBand ? bandLabel : product.effect };
    });
  // 10연은 균형 밴드를 그대로 쓰므로 보장선도 그 상한(기본 3★)이다.
  const multiBand = ctx.engine.summonStarBand("balanced");
  // 성어 기원(트랙 F) — 추적 성어의 부족 글자만 부르는 전투력 비연동 상품.
  const wish = ctx.engine.idiomWishQuote();
  const wishChars = wish.pool.map((definition) => definition.char);
  const key = `${state.mode}|${base}|${tenCost}|${multiUnlocked ? "10" : "-"}|${state.gold}|${active ? "on" : "off"}`
    + `|${multiBand === null ? "-" : multiBand.max}`
    + `|wish:${wish.cost}:${wish.reason ?? wishChars.join("")}`
    + `|${products.map((product) => `${product.intent}:${product.effect}`).join(",")}`;
  if (key === summonShopRenderKey) return;
  summonShopRenderKey = key;
  const cards = products.map((product) => {
    const price = base + SUMMON_SURCHARGE[product.intent];
    const affordable = state.gold >= price;
    const banded = product.band !== null;
    return summonCardMarkup({
      key: product.intent,
      label: product.label,
      effect: product.effect,
      tint: product.tint,
      icon: product.icon,
      price: `${price} 엽전`,
      disabled: !active || !affordable,
      affordable: !active || affordable,
      hotkey: product.intent === "balanced" ? "1" : undefined,
      testId: product.intent === "balanced" ? "summon-button" : undefined,
      title: `${product.label} · ${product.effect} · ${price}엽전`
        + (product.intent === "balanced" ? "" : ` (기본 ${base} + 목적 ${SUMMON_SURCHARGE[product.intent]})`)
        + (banded && product.effect !== product.bandLabel ? ` · ${product.bandLabel}` : "")
        + (banded ? ` · 낮은 별이 더 흔합니다 · ${PAIR_BOOST_NOTE}` : "")
        + (product.band !== null && product.band.min > 1 ? ` · ${STROKE_STAR_NOTE}` : "")
    });
  });
  // 성어 기원 — 부족 글자가 없으면(추적 없음/완성) 비활성 + 사유를 효과 줄에 적는다.
  // 결과는 항상 1★라 전투력이 아니라 성어 완성을 사는 상품이다. 별승급(캐주얼)
  // 전용 — 자형연성은 부족 글자가 곧 합성 재료라 승률로 새는 것이 실측돼
  // (짝시드 90런 0.556→0.733) 계보 소환에 남긴다. 티어 카드와 같은 노출 규칙.
  if (state.mode === "casual") cards.push(summonCardMarkup({
    key: "idiom-wish",
    label: "성어 기원",
    effect: wish.reason === null
      ? `부족 ${wishChars.slice(0, 4).join("·")}${wishChars.length > 4 ? "…" : ""} · 1★`
      : wish.reason,
    tint: "#96324a",
    icon: "v4/shop/shop-lineage-scroll-v1",
    price: `${wish.cost} 엽전`,
    disabled: !active || wish.reason !== null || state.gold < wish.cost,
    affordable: !active || wish.reason !== null || state.gold >= wish.cost,
    testId: "idiom-wish-button",
    title: "성어 기원 · 추적 성어의 부족 글자를 부릅니다(1★)"
      + ` · ${wish.cost}엽전 (기본 ${base} × ${IDIOM_WISH_COST_MULTIPLIER})`
      + " · 부적에 기원을 적어 올리는 소환 — 전투력이 아니라 성어 완성을 삽니다"
      + (wish.reason === null ? ` · 부족 ${wishChars.join("·")}` : ` · ${wish.reason}`)
  }));
  cards.push(summonCardMarkup({
    key: "multi",
    label: "10연 소환",
    effect: multiUnlocked ? (multiBand === null ? "기본 확률 10회" : `${multiBand.max}★ 1기 보장`) : "10웨이브에 개방",
    tint: "#a8791f",
    icon: "v4/shop/shop-ten-pull-coin-bundle-v1",
    price: multiUnlocked ? `${tenCost} 엽전` : "10W 개방",
    disabled: !active || !multiUnlocked || state.gold < tenCost,
    affordable: !active || !multiUnlocked || state.gold >= tenCost,
    hotkey: "Q",
    // [FB1] 2열 격자를 빈칸 없이 채우는 배치가 정본이다. 상품 수가 홀수면
    // 10연이 남은 반 칸에 들어가고(캐주얼 5+1=3행), 짝수면 홀로 한 행을
    // 넓게 차지한다(표준 4+1=3행). 이전 조건(홀수일 때 wide)은 캐주얼에서
    // 빈칸 + 전용 행으로 한 행을 통째로 낭비해 상점 세로 넘침의 주범이었다.
    wide: cards.length % 2 === 0,
    testId: "multi-summon-button",
    title: multiUnlocked
      ? `10연 소환 · ${tenCost}엽전 · 할증 없음`
        + (multiBand === null ? "" : ` · 기본 밴드 ${multiBand.min}~${multiBand.max}★ · ${multiBand.max}★ 1기 보장`)
      : "10웨이브를 지키면 열립니다"
  }));
  must<HTMLElement>("#summon-shop").innerHTML = cards.join("");
}

export function renderFormationUnlocks(): void {
  const state = ctx.engine.state;
  const cost = ctx.engine.nextFormationUnlockCost();
  const active = state.phase === "prep" || state.phase === "combat";
  const key = `${state.unlockedFormations.join(",")}|${state.startingFormationIndex ?? "none"}|${state.gold}|${active ? "active" : "inactive"}|${cost ?? "done"}`;
  if (key === ctx.formationRenderKey) return;
  ctx.formationRenderKey = key;
  // 상점의 해금 바는 걷어냈다(전장 자물쇠 + 확인 팝업이 정본).
  // 처음 하는 사람은 진을 추가 구매할 수 있다는 사실 자체를 모르므로,
  // 해금 가능해지는 최초 1회만 토스트로 전장 자물쇠를 짚어 준다.
  if (cost !== null && state.gold >= cost && state.startingFormationIndex !== null && state.unlockedFormations.length < BOARD_FORMATIONS.length && !ctx.formationUnlockHintShown) {
    ctx.formationUnlockHintShown = true;
    showToast(`엽전 ${cost}으로 새 오행진을 해금할 수 있습니다 — 전장의 잠긴 진 자물쇠를 눌러 원하는 진을 고르세요`);
  }
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireShop1(): void {
  // 카드가 곧 상품이다. 목적 상태를 미리 고르는 단계 없이 누른 카드로 즉시 1회 소환한다.
  must<HTMLElement>("#summon-shop").addEventListener("click", (event) => {
    const card = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-summon-product]");
    if (!card || card.disabled) return;
    const product = card.dataset.summonProduct ?? "balanced";
    if (product === "multi") summonAndFocus(10);
    else if (product === "idiom-wish") summonIdiomWishAndFocus();
    else summonAndFocus(1, product as SummonIntent);
  });
}
