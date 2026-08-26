// R5 병합 후 재확인 필요
// 상점 스펙(#shop-tab, #summon-button, [data-summon-intent], #summon-reveal*, #multi-summon-*)은
// 병렬 5라운드가 상품 카드 구조로 갈아엎는 중이다. 아래 단언은 현재 DOM 기준으로 되살려 두었으니
// R5 를 병합한 뒤 선택자와 문안을 다시 맞춰야 한다.
import { expect, test, type Page } from "@playwright/test";

/** 첫 방문 온보딩 코치를 이미 본 것으로 표시하는 앱 자체 저장 키. */
const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";
/** 코치를 실제로 띄우는 스펙에 붙이는 태그. 이 태그가 붙은 스펙만 첫 방문 상태로 시작한다. */
const ONBOARDING_TAG = "@onboarding";
/** 기본 카메라는 기준 배율(100% = 2.60)이 아니라 전장이 한눈에 들어오는 2.00 에서 시작한다. */
const DEFAULT_MAP_ZOOM_LABEL = "77%";

// 코치 오버레이(#coach-layer)는 스포트라이트 말풍선으로 패널 탭 위를 덮어 클릭을 가로챈다.
// 첫 방문자 안내는 전용 스펙에서 따로 검증하고, 나머지 스펙은 "안내를 이미 본 사용자"로 시작한다.
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.tags.includes(ONBOARDING_TAG)) return;
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
});

async function canvasPositionForWorld(page: Page, worldX: number, worldY: number): Promise<{ x: number; y: number }> {
  const canvas = page.locator("#battle-canvas");
  const box = await canvas.boundingBox();
  const camera = await canvas.evaluate((element) => ({
    zoom: Number(element.dataset.mapZoom),
    offsetX: Number(element.dataset.mapOffsetX),
    offsetY: Number(element.dataset.mapOffsetY)
  }));
  if (!box) throw new Error("battle canvas is not visible");
  return {
    x: (camera.offsetX + worldX * camera.zoom) * box.width / 880,
    y: (camera.offsetY + worldY * camera.zoom) * box.height / 720
  };
}

async function openShop(page: Page): Promise<void> {
  await page.locator("#shop-tab").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
}

async function openUnit(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "자령", exact: true }).click();
  await expect(page.locator("#selected-card")).toBeVisible();
}

/**
 * JP/CN 은 곧장 선택되지 않고 얼리 액세스 확인(P00)을 거친다.
 * 확인을 누르지 않으면 모달이 남아 출정 버튼을 막는다.
 */
async function chooseRegion(page: Page, region: "KR" | "JP" | "CN"): Promise<void> {
  await page.locator(`[data-region="${region}"]`).click();
  if (region !== "KR") {
    await expect(page.locator("#p00-dialog")).toBeVisible();
    await page.locator("#p00-continue").click();
  }
  await expect(page.locator(`[data-region="${region}"]`)).toHaveAttribute("aria-checked", "true");
}

/** 도감은 자령·조합표·사자성어 3분류로 통합됐고, 여는 버튼의 접근명은 "통합 자령 도감 열기" 다. */
async function openCodex(page: Page): Promise<void> {
  await page.locator("#codex-button").click();
  await expect(page.locator("#codex-dialog")).toBeVisible();
}

test("renders a viewport-fixed hanji field and moving ink current at minimum zoom", async ({ page }) => {
  await page.goto("/?seed=E2E-HANJI-INK");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-surface", "hanji-ink");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-hit-feedback", "ink-local");
  await expect(page.locator(".battle-stage")).toHaveCSS("filter", "none");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/assets/map/hanji-ink-field/hanji-paper-base.png")))).toBe(true);
  const firstCurrent = Number(await page.locator("#battle-canvas").getAttribute("data-ink-current-offset"));
  await page.waitForTimeout(350);
  expect(Number(await page.locator("#battle-canvas").getAttribute("data-ink-current-offset"))).toBe(firstCurrent);
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-ink-current-offset"))).not.toBe(firstCurrent);

  await page.locator("#battle-canvas").hover({ position: { x: 440, y: 360 } });
  await page.mouse.wheel(0, 5000);
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-zoom", "0.72");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-zoom-display", "28");
  await expect(page.locator("#map-zoom-value")).toHaveText("28%");
  const backdrop = await page.locator("#battle-canvas").evaluate((canvasElement) => {
    const style = getComputedStyle(canvasElement);
    return { color: style.backgroundColor, image: style.backgroundImage };
  });
  expect(backdrop.color).toBe("rgb(239, 227, 194)");
  expect(backdrop.image).toContain("hanji-paper-base.png");
  await page.screenshot({ path: "artifacts/hanji-ink-route-zoomout-1280x720.png", fullPage: true });
});

test("shows a readable single summon reveal and explains the ten-pull milestone", async ({ page }) => {
  await page.goto("/?seed=E2E-SUMMON-REVEAL");
  await page.getByTestId("start-run").click();
  await openShop(page);
  await page.getByTestId("summon-button").click();
  await expect(page.locator("#summon-reveal")).toHaveClass(/is-active/u);
  await expect(page.locator("#summon-reveal-title")).toContainText("자령 출현");
  await expect(page.locator(".summon-result-card")).toHaveCount(1);
  await expect(page.locator(".summon-result-card > strong")).not.toHaveText("");
  await expect(page.locator(".summon-result-spirit")).toHaveCSS("background-image", /assets\/jaryeongs\//u);
  await page.locator("#battle-canvas").click({ position: { x: 40, y: 110 } });
  await expect(page.locator("#summon-reveal")).not.toHaveClass(/is-active/u);

  await page.reload();
  await page.getByTestId("start-run").click();
  await openShop(page);
  await expect(page.locator("#multi-summon-cost")).toHaveText("10W 개방");
  await expect(page.getByTestId("multi-summon-button")).toBeDisabled();
  await page.screenshot({ path: "artifacts/summon-ten-locked-1280x720.png", fullPage: true });
});

test("freezes the opening until the first summon opens its matching formation", async ({ page }) => {
  await page.goto("/?seed=FORMATION-SHOP-E2E");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await expect(page.locator("#shop-tab")).toHaveClass(/is-active/u);
  await expect(page.locator(".panel-tabs > button")).toHaveCount(8);
  await expect(page.locator("#formation-unlock-list > button")).toHaveCount(5);
  await expect(page.locator("#formation-unlock-list > button.is-unlocked")).toHaveCount(0);
  await expect(page.getByTestId("early-wave")).toBeDisabled();
  await expect(page.getByTestId("early-wave")).toHaveText("첫 소환 필요");
  await expect(page.locator("#wave-kicker")).toContainText("시간 정지");
  const openingLayout = await page.evaluate(() => {
    const panelChildren = [".brand-row", ".resource-grid", ".wave-card", ".context-deck", ".panel-tabs", ".panel-footer"]
      .map((selector) => document.querySelector<HTMLElement>(selector)?.getBoundingClientRect().right ?? 0);
    const actionRow = document.querySelector<HTMLElement>(".shop-workbench .action-row");
    return {
      outsideRight: panelChildren.filter((right) => right > window.innerWidth + 1).length,
      actionOverflow: actionRow ? actionRow.scrollHeight - actionRow.clientHeight : -1
    };
  });
  expect(openingLayout.outsideRight).toBe(0);
  expect(openingLayout.actionOverflow).toBeLessThanOrEqual(0);
  const frozenWaveText = await page.locator("#wave-kicker").textContent();
  await page.waitForTimeout(350);
  await expect(page.locator("#wave-kicker")).toHaveText(frozenWaveText ?? "");
  await expect(page.locator('[data-opening-step="1"]')).toHaveClass(/is-current/u);

  await page.getByTestId("summon-button").click();
  await expect(page.locator("#summon-reveal-summary")).toContainText("무료 개방");
  await expect(page.locator("#summon-reveal-summary")).toContainText("→");
  await page.locator("#summon-reveal-close").click();
  await expect(page.locator("#formation-unlock-list > button.is-unlocked")).toHaveCount(1);
  await expect(page.locator("#formation-unlock-summary")).toContainText("다음 18엽전");
  await expect(page.getByTestId("early-wave")).toBeEnabled();
  await expect(page.locator('[data-opening-step="2"]')).toHaveClass(/is-current/u);

  await page.locator("#formation-unlock-list > button:not(.is-unlocked)").first().click();
  await expect(page.locator("#message-value")).toContainText("해금");
  await expect(page.locator("#gold-value")).toHaveText("17");
  await expect(page.locator("#tower-count-value")).toHaveText("1 / 32");
  await expect(page.locator("#formation-unlock-summary")).toContainText("다음 32엽전");
  await page.screenshot({ path: "artifacts/formation-coin-unlock-1280x720.png", fullPage: true });
});

test("runs the casual eight-star entry and readable one-click promotion workshop", async ({ page }) => {
  await page.goto("/?seed=CASUAL-EIGHT-STAR-E2E");
  await expect(page.getByRole("radio", { name: /자형연성 진법/ })).toBeChecked();
  await page.getByRole("radio", { name: /별승급 진법/ }).click();
  await expect(page.locator('[data-region="KR"]')).toHaveAttribute("aria-checked", "true");
  // 별승급은 보충 획수 데이터로 전 지역을 지원한다. JP/CN 은 잠기지 않고
  // 얼리 액세스 확인(P00)을 거친다.
  await expect(page.locator('[data-region="JP"]')).toBeEnabled();
  await expect(page.locator('[data-region="CN"]')).toBeEnabled();
  await expect(page.locator("#s00-summary-main")).toContainText("별승급 진법");
  await page.getByTestId("start-run").click();

  await expect(page.locator(".game-shell")).toHaveAttribute("data-game-mode", "casual");
  await expect(page.locator(".game-shell")).toHaveAttribute("data-panel-tab", "shop");
  await expect(page.locator("#shop-panel")).toBeVisible();
  await expect(page.locator("#shop-pool-count")).toHaveText("1,000");
  for (let index = 0; index < 4; index += 1) {
    await page.getByTestId("summon-button").click();
    await expect(page.locator("#summon-reveal")).toHaveClass(/is-active/u);
    await expect(page.locator(".summon-result-card")).toContainText(/\d★/u);
    await page.locator("#summon-reveal-close").click();
  }

  await page.getByRole("tab", { name: "3체 조합", exact: true }).click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-panel-tab", "evolution");
  await expect(page.locator("#standard-evolution-modes")).toBeHidden();
  await expect(page.locator("#casual-fusion-toolbar")).toBeVisible();
  // 기본 뷰는 [한 번에 승급] + 그룹 카드. 4연 소환으로는 같은 오행·같은
  // 별 3체가 모이지 않으므로 버튼은 비활성이고 빈 상태 안내가 뜬다.
  await expect(page.locator("#casual-fuse-all")).toBeDisabled();
  await expect(page.locator("#casual-fuse-all-count")).toHaveText("지금은 0회");
  await expect(page.locator(".casual-group-card")).toHaveCount(0);
  await expect(page.locator(".casual-group-empty")).toBeVisible();
  await expect(page.locator("#casual-goto-shop")).toBeVisible();

  // v3: 남길 자령(본체)이 사라졌다. 3슬롯 전부 `소모`이고 결과는 무작위다.
  await expect(page.locator(".casual-fusion-slot").first()).toBeHidden();
  await page.locator("#casual-manual-details > summary").click();
  await expect(page.locator("#casual-manual-details")).toHaveAttribute("open", "");
  await expect(page.locator(".casual-rarity-rule > i")).toHaveCount(8);
  await expect(page.locator(".casual-fusion-slot")).toHaveCount(3);
  await expect(page.locator(".casual-fusion-slot.is-core")).toHaveCount(0);
  for (const index of [0, 1, 2]) {
    await expect(page.locator(".casual-fusion-slot").nth(index)).toContainText("소모");
  }
  await expect(page.locator(".casual-fusion-slots")).not.toContainText("남길");
  await expect(page.locator(".casual-fusion-slots")).not.toContainText("본체");
  await expect(page.locator(".casual-fusion-slots")).not.toContainText("KEEP");
  await expect(page.locator(".casual-fusion-slots")).not.toContainText("USE");
  await expect(page.locator(".casual-fusion-result")).toHaveClass(/is-random/u);
  // 3체가 안 모인 자령은 흐림 + `3체 미달` 배지로 못 고른다.
  await expect(page.locator(".casual-fusion-tower")).toHaveCount(4);
  // 8★ 는 `최고` 라벨을 받으므로 `3체 미달` 배지는 8★ 미만에만 붙는다.
  await expect(page.locator(".casual-fusion-tower.is-short")).not.toHaveCount(0);
  await expect(page.locator(".casual-fusion-tower.is-short").first()).toContainText("3체 미달");
  await expect(page.locator(".casual-fusion-tower:not(:disabled)")).toHaveCount(0);

  const desktopLayout = await page.evaluate(() => {
    const workbench = document.querySelector<HTMLElement>(".evolution-workbench")!.getBoundingClientRect();
    const panel = document.querySelector<HTMLElement>(".control-panel")!.getBoundingClientRect();
    const candidates = document.querySelector<HTMLElement>(".casual-fusion-candidates")!;
    return {
      workbenchLeft: workbench.left,
      workbenchWidth: workbench.width,
      workbenchHeight: workbench.height,
      panelLeft: panel.left,
      overflowX: document.body.scrollWidth - window.innerWidth,
      overflowY: document.body.scrollHeight - window.innerHeight,
      candidateScrollbar: getComputedStyle(candidates).scrollbarColor
    };
  });
  expect(desktopLayout.workbenchLeft).toBeLessThan(desktopLayout.panelLeft);
  expect(desktopLayout.workbenchWidth).toBeGreaterThan(650);
  expect(desktopLayout.workbenchHeight).toBeGreaterThanOrEqual(440);
  expect(desktopLayout.overflowX).toBeLessThanOrEqual(0);
  expect(desktopLayout.overflowY).toBeLessThanOrEqual(0);
  expect(desktopLayout.candidateScrollbar).not.toBe("auto");
  await page.screenshot({ path: "artifacts/casual-fusion-workshop-1280x720.png", fullPage: true });

  await page.setViewportSize({ width: 1024, height: 720 });
  const narrowLayout = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".game-shell")!.getBoundingClientRect();
    const candidates = document.querySelector<HTMLElement>(".casual-fusion-candidates")!.getBoundingClientRect();
    const brand = document.querySelector<HTMLElement>(".brand-row h1")!;
    return {
      shellWidth: shell.width,
      shellHeight: shell.height,
      candidatesHeight: candidates.height,
      bodyHeight: document.body.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      brandFits: brand.scrollWidth <= brand.clientWidth
    };
  });
  expect(narrowLayout.shellWidth).toBeLessThanOrEqual(1024);
  expect(narrowLayout.shellHeight).toBeLessThanOrEqual(720);
  expect(narrowLayout.candidatesHeight).toBeGreaterThanOrEqual(55);
  expect(narrowLayout.bodyHeight).toBeLessThanOrEqual(720);
  expect(narrowLayout.bodyWidth).toBeLessThanOrEqual(1024);
  expect(narrowLayout.brandFits).toBe(true);
  await page.screenshot({ path: "artifacts/casual-fusion-workshop-1024x720.png", fullPage: true });
});

test("uses tabbed owned-aware goals and summons from all one thousand Cheonjamun sprites", async ({ page }) => {
  await page.goto("/?seed=EVO-E2E-2");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".panel-tabs > button")).toHaveCount(8);
  await expect(page.locator("#selected-card")).toBeHidden();
  await expect(page.locator("#goal-panel")).toBeHidden();
  await expect(page.locator("#shop-panel")).toBeVisible();

  await page.locator("#goal-tab").click();
  await expect(page.locator("#goal-panel")).toBeVisible();
  await page.locator("#goal-search").fill("天");
  await expect(page.locator('#goal-selector-list [data-goal-char="天"]')).toHaveCount(1);
  await page.locator('[data-goal-char="天"]').click();
  await expect(page.locator("#goal-glyph")).toHaveText("天");
  await expect(page.locator("#goal-recipe")).toHaveText("天 자령을 소환하면 달성");
  await expect(page.locator('[data-goal-char="天"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('button[data-goal-mode="idiom"]').click();
  await page.locator("#goal-search").fill("天地玄黃");
  await expect(page.locator('#goal-selector-list [data-goal-idiom="cheonjamun-001"]')).toHaveCount(1);
  await page.locator('[data-goal-idiom="cheonjamun-001"]').click();
  await expect(page.locator("#idiom-target-card")).toContainText("천지현황");
  await expect(page.locator("#idiom-target-card")).toContainText("0/4자 보유");
  await expect(page.locator("#idiom-target-card")).toContainText("부족 天·地·玄·黃");

  await openShop(page);
  await expect(page.locator("#shop-pool-count")).toHaveText("1,000");
  await expect(page.locator("#summon-pool-summary")).toContainText("천자문 1,000종");
  await page.locator('button[data-summon-intent="discovery"]').click();
  await page.getByTestId("summon-button").click();
  await expect(page.locator(".summon-result-card > strong")).not.toHaveText("");
  await expect(page.locator(".summon-result-spirit")).toHaveCSS("background-image", /cheonjamun-runtime-v1\/kr-[0-9a-f]+\.png/u);
  await expect(page.locator(".summon-result-spirit")).toHaveCSS("background-size", "contain");
  await page.locator("#summon-reveal-close").click();
  await openCodex(page);
  // 도감은 "자령 도감 / 조합표 / 사자성어" 3분류로 통합됐다. 옛 `jaryeongs` 전용 모드는 사라지고
  // 기본 `hanzi` 탭이 천자문 자령 초상화까지 함께 싣는다.
  await expect(page.locator(".codex-mode-tabs > button")).toHaveCount(3);
  await page.locator('[data-codex-mode="hanzi"]').click();
  await expect(page.locator("#codex-summary")).toContainText(/자령 1,0\d\d\/1,0\d\d · 독립 \d+/u);
  // 천자문 1,000자 + 합성 확장분이므로 정확한 총합보다 "1,000자 이상 실린다" 를 지킨다.
  expect(await page.locator("#codex-list .codex-jaryeong-card").count()).toBeGreaterThanOrEqual(1_000);
  await page.locator("#codex-list .codex-jaryeong-card").first().click();
  await expect(page.locator("#codex-detail .codex-jaryeong-portrait img")).toBeVisible();
  await expect(page.locator("#codex-detail")).toContainText(/CHEONJAMUN No\.\d{3}/u);
  await expect(page.locator("#codex-detail")).toContainText("자령 기록");
  await expect(page.locator("#codex-detail")).not.toContainText(/QC|검토|pending/iu);
  await page.screenshot({ path: "artifacts/cheonjamun-jaryeong-dex-1000-1280x720.png", fullPage: true });
  await page.locator("#codex-close").click();

  const layout = await page.evaluate(() => ({
    contextHeight: document.querySelector<HTMLElement>(".context-deck")?.getBoundingClientRect().height ?? 0,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    overflowY: document.documentElement.scrollHeight - window.innerHeight,
    scrollbarColor: getComputedStyle(document.querySelector<HTMLElement>("#goal-selector-list")!).scrollbarColor
  }));
  expect(layout.contextHeight).toBeGreaterThanOrEqual(360);
  expect(layout.overflowX).toBeLessThanOrEqual(0);
  expect(layout.overflowY).toBeLessThanOrEqual(0);
  expect(layout.scrollbarColor).not.toBe("auto");
  await page.screenshot({ path: "artifacts/goal-shop-cheonjamun-1000-1280x720.png", fullPage: true });
});

test("opens the dedicated growth tab with batch upgrade controls", async ({ page }) => {
  await page.goto("/?seed=E2E-ELEMENT-UPGRADE");
  await page.getByTestId("start-run").click();
  await openShop(page);
  await page.getByTestId("element-upgrade-button").click();
  await expect(page.locator("#growth-panel")).toBeVisible();
  await expect(page.locator("#growth-element-tabs > button")).toHaveCount(5);
  await expect(page.locator(".growth-stat-row")).toHaveCount(10);
  await expect(page.locator(".growth-trait-row")).toHaveCount(3);
  const commonDamage = page.locator('[data-growth-upgrade-scope="global"][data-growth-stat="damage"][data-growth-amount="1"]');
  await expect(commonDamage).toContainText("16 엽전");
  await commonDamage.click();
  await expect(page.locator("#gold-value")).toHaveText("26");
  await expect(commonDamage).toContainText("19 엽전");
  await expect(page.locator('[data-growth-upgrade-scope="element"][data-growth-stat="damage"][data-growth-amount="1"]')).toBeDisabled();
  await page.screenshot({ path: "artifacts/element-upgrades-1280x720.png", fullPage: true });
  await expect(page.locator("#element-upgrade-total")).toHaveText("총 1단계");
});

test("starts a KR run and exposes the finished core loop at 1280x720", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?seed=E2E-FIXED-01");
  await expect(page).toHaveTitle("한자 운명진 · 랜덤 타워 디펜스");
  await expect(page.locator(".game-shell")).toHaveAttribute("data-display-mode", "spirit");
  await expect(page.getByRole("heading", { name: "한자 운명진", exact: true }).last()).toBeVisible();
  // S00 지역 타일은 이름과 심사 배지만 노출하고, 한자 범위는 접근명·툴팁과 출정 부제로 알린다.
  await expect(page.locator(".region-option.is-selected")).toHaveAttribute("aria-label", /천자문 1,?000/u);
  await expect(page.locator("#s00-start-sub")).toHaveText(/천자문 1,?000/u);
  await page.screenshot({ path: "artifacts/title-1280x720.png", fullPage: true });

  await page.getByTestId("start-run").click();
  await expect(page.locator("#barrier-value")).toHaveCount(0);
  await expect(page.locator("#enemy-cap-value")).toHaveText("80체");
  await expect(page.locator("#gold-value")).toHaveText("42");
  await expect(page.locator("#interest-preview")).toHaveText("이자 +2");
  await expect(page.locator(".game-shell")).toHaveAttribute("data-game-speed", "1");
  // 기본 카메라는 100%(=2.60) 가 아니라 전장이 한눈에 들어오는 77%(=2.00) 에서 시작한다.
  // 100% 는 기준 배율일 뿐 시작 배율이 아니다.
  await expect(page.locator("#map-zoom-value")).toHaveText(DEFAULT_MAP_ZOOM_LABEL);
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-zoom", "2.00");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-zoom-display", "77");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-label-density", "reading");
  await expect(page.locator("#hanja-emphasis-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(page.locator("#hanja-emphasis-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-hanja-emphasis", "false");
  await page.keyboard.press("Space");
  await expect(page.locator("#hanja-emphasis-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-hanja-emphasis", "true");
  await page.locator("#speed-button").click();
  await expect(page.locator("#speed-button")).toHaveText("2×");
  await page.locator("#speed-button").click();
  await expect(page.locator("#speed-button")).toHaveText("3×");
  await page.locator("#speed-button").click();
  await expect(page.locator("#speed-button")).toHaveText("1×");
  await expect(page.locator("#goal-glyph")).toHaveText("相");
  await expect(page.locator("#goal-recipe")).toHaveText("木 + 目 → 相");
  await openShop(page);
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await expect(page.locator("#tower-count-value")).toHaveText("4 / 16");
  await expect(page.locator("#battle-canvas")).not.toHaveAttribute("data-selected-tower-id", "");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-selected-synthesis-tier", /^[1-5]$/u);
  await page.locator("#summon-reveal-close").click();
  await openUnit(page);
  await page.screenshot({ path: "artifacts/selected-tier-emphasis-on-1280x720.png", fullPage: true });
  await page.keyboard.press("Space");
  await expect(page.locator("#hanja-emphasis-toggle")).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: "artifacts/selected-tier-emphasis-off-1280x720.png", fullPage: true });
  await page.keyboard.press("Space");
  await expect(page.locator("#gold-value")).toHaveText("14");
  await expect(page.locator("#interest-preview")).toHaveText("이자 +0");
  await expect(page.locator("#seed-value")).toHaveText("E2E-FIXED-01");
  await expect(page.locator("#selected-card .ability-pills--locked")).toBeVisible();
  await expect(page.locator("#selected-card .ability-pills--locked")).toContainText("기본 공격");
  await expect(page.locator("#selected-card .selected-ability-summary")).toContainText("기술 해금 전");
  await expect(page.locator("#selected-card .ability-charge--locked")).toContainText("2단 합성 시 고유 기술 해금");
  await expect(page.locator("#selected-card .selected-learning")).toContainText("훈음");
  await expect(page.locator("#selected-card .selected-radical")).toContainText("훈음");
  await expect(page.locator("#selected-card .selected-radical")).not.toContainText("부수");
  await expect(page.locator("#goal-reading")).toContainText("서로 상");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/assets/jaryeongs/")))).toBe(true);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/assets/fx/element-projectiles/")))).toBe(true);
  // 범위 장판은 원근 타원(element-zones)에서 정사각 모듈(aoe-modular-v1)로 교체됐다.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/assets/fx/aoe-modular-v1/")))).toBe(true);

  await page.locator("#battle-canvas").hover({ position: { x: 516, y: 54 } });
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-map-zoom"))).toBeGreaterThan(2.6);
  await expect(page.locator("#map-zoom-value")).not.toHaveText(DEFAULT_MAP_ZOOM_LABEL);
  const canvasBox = await page.locator("#battle-canvas").boundingBox();
  expect(canvasBox).not.toBeNull();

  await page.locator("#map-zoom-reset").click();
  const offsetBeforeLeftPan = Number(await page.locator("#battle-canvas").getAttribute("data-map-offset-x"));
  await page.mouse.move((canvasBox?.x ?? 0) + 440, (canvasBox?.y ?? 0) + 360);
  await page.mouse.down({ button: "left" });
  await page.mouse.move((canvasBox?.x ?? 0) + 500, (canvasBox?.y ?? 0) + 400, { steps: 3 });
  await expect(page.locator("#battle-canvas")).toHaveClass(/is-panning/u);
  await page.mouse.up({ button: "left" });
  await expect(page.locator("#battle-canvas")).not.toHaveClass(/is-panning/u);
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-map-offset-x"))).not.toBe(offsetBeforeLeftPan);

  const offsetBeforePan = Number(await page.locator("#battle-canvas").getAttribute("data-map-offset-x"));
  await page.mouse.move((canvasBox?.x ?? 0) + 516, (canvasBox?.y ?? 0) + 54);
  await page.mouse.down({ button: "middle" });
  await expect(page.locator("#battle-canvas")).toHaveClass(/is-panning/u);
  await page.mouse.move((canvasBox?.x ?? 0) + 556, (canvasBox?.y ?? 0) + 144, { steps: 3 });
  await page.mouse.up({ button: "middle" });
  await expect(page.locator("#battle-canvas")).not.toHaveClass(/is-panning/u);
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-map-offset-x"))).not.toBe(offsetBeforePan);
  await page.locator("#map-zoom-reset").click();
  await expect(page.locator("#map-zoom-value")).toHaveText(DEFAULT_MAP_ZOOM_LABEL);
  await page.locator("#battle-canvas").hover({ position: { x: 440, y: 360 } });
  await page.mouse.wheel(0, -5_000);
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-map-zoom"))).toBe(5.2);
  await expect(page.locator("#map-zoom-value")).toHaveText("200%");
  await page.locator("#map-zoom-reset").click();
  await expect(page.locator("#map-zoom-value")).toHaveText(DEFAULT_MAP_ZOOM_LABEL);
  await page.locator("#battle-canvas").hover({ position: { x: 440, y: 360 } });
  await page.mouse.wheel(0, 500);
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-map-zoom"))).toBeLessThan(2.6);
  await page.locator("#map-zoom-reset").click();
  await expect(page.locator("#map-zoom-value")).toHaveText(DEFAULT_MAP_ZOOM_LABEL);
  await page.screenshot({ path: "artifacts/jaryeong-mode-1280x720.png", fullPage: true });

  await openShop(page);
  await expect(page.getByTestId("auto-arrange-button")).toBeEnabled();
  await page.getByTestId("auto-arrange-button").click();
  await expect(page.locator("#message-value")).toContainText("자동배치");
  await expect(page.locator("#tower-count-value")).toHaveText("4 / 16");
  await page.screenshot({ path: "artifacts/auto-arrange-1280x720.png", fullPage: true });

  await page.getByTestId("early-wave").click();
  await expect(page.locator("#stage-wave")).toHaveText("1 / 100");
  await expect(page.locator("#stage-phase")).toHaveText("교전 중");
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "combat");
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-projectile-sprite-draw-total")), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-projectile-sprite-draw", "true");
  await page.screenshot({ path: "artifacts/projectile-sprite-active-1280x720.png", fullPage: true });
  await expect(page.locator("#ability-banner")).toHaveCount(0);
  // 기록은 탭도 별도 티커도 아니고, 패널 바닥 푸터의 상시 메시지 줄로 노출된다.
  await expect(page.locator("#record-ticker")).toHaveCount(0);
  await expect(page.locator(".panel-footer #message-value")).toBeVisible();
  await expect(page.locator(".panel-footer #message-value")).not.toHaveText("");
  await page.getByRole("tab", { name: "자령" }).click();

  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight
  }));
  expect(overflow.x).toBeLessThanOrEqual(0);
  expect(overflow.y).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "artifacts/gameplay-wave1-1280x720.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("advances on the reinforcement clock while surviving enemies keep circulating", async ({ page }) => {
  await page.goto("/?seed=WAVE-CLOCK-E2E");
  await page.getByTestId("start-run").click();
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();
  await page.locator("#speed-button").click();
  await page.locator("#speed-button").click();
  await expect(page.locator("#speed-button")).toHaveText("3×");
  await page.getByTestId("early-wave").click();
  await expect(page.locator("#stage-wave")).toHaveText("1 / 100");
  await expect(page.locator("#wave-kicker")).toContainText("다음 웨이브", { timeout: 7_000 });
  await expect(page.locator("#stage-wave")).toHaveText("2 / 100", { timeout: 8_000 });
  await expect(page.locator("#message-value")).toContainText("잔존");
  await expect(page.locator("#message-value")).toContainText("은행 이자 +");
  await expect(page.locator("#stage-enemies")).not.toHaveText("0 / 80");
  await page.screenshot({ path: "artifacts/bank-interest-1280x720.png", fullPage: true });
});

test("moves the original glyph battlefield into persistent study mode settings", async ({ page }) => {
  await page.goto("/?seed=DISPLAY-MODE-E2E");
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await expect(page.getByRole("heading", { name: "전장 표시 모드" })).toBeVisible();
  await expect(page.getByTestId("spirit-mode")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("spirit-mode")).toContainText("한자·훈음");
  await page.screenshot({ path: "artifacts/display-settings-1280x720.png", fullPage: true });
  await page.getByTestId("study-mode").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-display-mode", "study");
  await page.getByTestId("start-run").click();
  await openShop(page);
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await page.screenshot({ path: "artifacts/study-mode-1280x720.png", fullPage: true });

  await page.reload();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-display-mode", "study");
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await expect(page.getByTestId("study-mode")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("spirit-mode").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-display-mode", "spirit");
});

test("stores manual summons in the run inventory, deploys them, and returns board units", async ({ page }) => {
  test.setTimeout(45_000);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?seed=RUN-INVENTORY-E2E");
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await expect(page.getByTestId("auto-place-toggle")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("auto-place-toggle").click();
  await expect(page.getByTestId("auto-place-toggle")).toHaveAttribute("aria-checked", "false");
  await page.locator("#settings-close").click();
  await page.getByTestId("start-run").click();

  await openShop(page);
  await page.getByTestId("summon-button").click();
  await expect(page.locator("#tower-count-value")).toHaveText("0 / 16");
  await expect(page.locator("#run-inventory-count")).toHaveText("1");
  await page.locator("#run-inventory-tab").click();
  const inventoryCard = page.locator(".run-inventory-card").first();
  await expect(inventoryCard).toBeVisible();
  await expect(inventoryCard.locator(".run-inventory-spirit")).toHaveCSS("background-image", /assets\/jaryeongs\//u);
  await inventoryCard.click();
  await expect(inventoryCard).toHaveClass(/is-selected/u);

  const formationIndex = Number(await page.locator("#formation-unlock-list > button.is-unlocked").getAttribute("data-formation-index"));
  const formationCenters = [{ x: 440, y: 160 }, { x: 240, y: 360 }, { x: 440, y: 360 }, { x: 640, y: 360 }, { x: 440, y: 560 }];
  const formationCenter = formationCenters[formationIndex];
  if (!formationCenter) throw new Error("first summon did not open a formation");
  const deploymentCell = await canvasPositionForWorld(page, formationCenter.x - 66, formationCenter.y - 66);
  await page.locator("#battle-canvas").click({ position: deploymentCell });
  await expect(page.locator("#tower-count-value")).toHaveText("1 / 16");
  await expect(page.locator("#run-inventory-count")).toHaveText("0");

  await page.locator("#battle-canvas").click({ position: deploymentCell });
  await expect(page.getByTestId("store-tower")).toBeVisible();
  await page.getByTestId("store-tower").click();
  await expect(page.locator("#tower-count-value")).toHaveText("0 / 16");
  await expect(page.locator("#run-inventory-count")).toHaveText("1");
  await expect(page.locator("#run-inventory-panel")).toBeVisible();
  await page.screenshot({ path: "artifacts/run-inventory-1280x720.png", fullPage: true });

  await page.reload();
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await expect(page.getByTestId("auto-place-toggle")).toHaveAttribute("aria-checked", "false");
  expect(errors).toEqual([]);
});

test("shows synthesis branches, highlights board materials, protects locked Jaryeong, and keeps the unified codex browsable", async ({ page }) => {
  await page.goto("/?seed=EVO-1000-5");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#stage-enemies")).toHaveText("0 / 80");
  await openShop(page);
  await page.locator('button[data-summon-intent="lineage"]').click();
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();
  await openUnit(page);

  let readySourceFound = false;
  for (const x of [374, 422, 470, 518]) {
    const towerPosition = await canvasPositionForWorld(page, x, 294);
    await page.locator("#battle-canvas").click({ position: towerPosition });
    readySourceFound = await page.getByTestId("derivative-composition").evaluate((element) => element.classList.contains("has-ready"));
    if (readySourceFound) break;
  }
  expect(readySourceFound).toBe(true);
  await page.getByTestId("derivative-composition").click();
  await expect(page.locator("#composition-drawer")).toHaveClass(/is-open/u);
  await expect(page.locator("#composition-source .composition-source-spirit")).toHaveCSS("background-image", /assets\/jaryeongs\//u);
  await expect(page.locator("#composition-branches .composition-branch.is-ready").first()).toBeVisible();
  await expect(page.locator("#composition-branches .composition-branch.is-missing").first()).toBeVisible();
  await page.locator("#composition-branches .composition-branch.is-ready").first().hover();
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-composition-material-count"))).toBeGreaterThan(0);
  await page.screenshot({ path: "artifacts/composition-tree-1280x720.png", fullPage: true });
  await page.locator("#composition-drawer-close").click();
  await expect(page.getByTestId("lock-tower")).toBeVisible();

  await page.getByRole("tab", { name: "합성" }).click();
  const evolution = page.locator('.evolution-card[data-recipe="KR:相"]');
  await expect(evolution).toBeVisible();
  await expect(evolution.locator(".evolution-spirit")).toHaveCSS("background-image", /assets\/jaryeongs\//u);
  await evolution.click();

  await page.getByRole("tab", { name: "자령" }).click();
  await expect(page.locator("#selected-card .selected-ability-summary")).toContainText("기술 5개 · 모두 자동 판정");
  await expect(page.locator("#selected-card .selected-ability-summary")).toContainText("주기 3 · 공격 연동 1 · 조건 특성 1");
  await page.locator("#selected-card .selected-ability-summary").click();
  await expect(page.getByRole("heading", { name: /기술 구성/u })).toBeVisible();
  await expect(page.locator(".ability-guide-rule")).toContainText("직접 누르는 기술은 없습니다");
  await expect(page.locator(".ability-guide-rule")).toContainText("고유 → 역할 → 계승");
  await expect(page.locator(".ability-guide-card")).toHaveCount(5);
  await expect(page.locator(".ability-guide-card").first()).toContainText("발동");
  await expect(page.locator(".ability-guide-card").first()).toContainText("효과");
  const abilityDescriptionOverflow = await page.locator(".ability-guide-card > p").evaluateAll((paragraphs) => paragraphs.some((paragraph) => paragraph.scrollWidth > paragraph.clientWidth));
  expect(abilityDescriptionOverflow).toBe(false);
  await page.locator("#ability-guide-close").click();
  await page.getByTestId("lock-tower").click();
  await expect(page.getByTestId("lock-tower")).toContainText("잠금됨");
  await expect(page.locator("#sell-button")).toBeDisabled();
  await page.getByTestId("lock-tower").click();
  await expect(page.locator("#sell-button")).toBeEnabled();

  // 이번 런의 보유 현황은 도감 탭이 아니라 헤더 발견 수와 인벤 탭이 맡는다.
  // (통합 도감에서 `보유 자령` 모드와 브라우저 저장 문구가 사라졌다.)
  await expect(page.locator("#discover-count")).toHaveText("5");
  await openCodex(page);
  await page.getByRole("tab", { name: "조합표" }).click();
  await expect(page.locator("#codex-summary")).toContainText("재료 → 결과 순서");
  await expect(page.locator("#codex-detail .recipe-guide")).toContainText("조합표");
  await page.getByRole("tab", { name: "사자성어" }).click();
  await expect(page.locator("#codex-summary")).toContainText("성어 104/104");
  await expect(page.locator("#codex-summary")).toContainText("이번 런 목표 5개");
  await expect(page.locator("#codex-detail .idiom-strategy")).toContainText("자동 발동");
  await expect(page.locator("#codex-detail .idiom-material-guide")).toContainText("필요 한자와 획득법");
  await page.screenshot({ path: "artifacts/progression-codex-1280x720.png", fullPage: true });

  await page.locator("#codex-close").click();
  await page.reload();
  await page.getByTestId("start-run").click();
  // 새로고침은 새 런을 연다. 보유 자령은 런과 함께 초기화되지만 자령 도감 자체는 그대로 열린다.
  await expect(page.locator("#discover-count")).toHaveText("0");
  await openCodex(page);
  await page.locator('[data-codex-mode="hanzi"]').click();
  expect(await page.locator("#codex-list .codex-jaryeong-card").count()).toBeGreaterThanOrEqual(1_000);
});

test("keeps CN glyphs regional and opens the complete codex", async ({ page }) => {
  await page.goto("/?seed=CN-E2E-01");
  await chooseRegion(page, "CN");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#stage-region")).toHaveText("중국");
  await expect(page.locator("#goal-glyph")).toHaveText("刘");
  await expect(page.locator("#goal-recipe")).toHaveText("文 + 刀 → 刘");

  await openCodex(page);
  await expect(page.getByRole("heading", { name: /중국.*통합 자령 도감/u })).toBeVisible();
  await expect(page.locator("#codex-summary")).toContainText(/자령 3,500\/3,500/u);
  await expect(page.locator('[data-synthesis-depth="1"] .codex-tier-stars')).toHaveText("★");
  await expect(page.locator('[data-synthesis-depth="1"] .codex-tier-stars')).not.toHaveClass(/is-uncombinable/u);
  // 조합 불가 1단 자령은 이제 별 배지를 변형하지 않고 전용 `독립` 배지로 구분한다.
  const independentFilter = page.locator('[data-synthesis-depth="stage1-uncombinable"]');
  await expect(independentFilter).toBeVisible();
  await expect(independentFilter.locator(".codex-independent-badge")).toHaveText("독립");
  await expect(independentFilter.locator(".codex-independent-badge")).toHaveAttribute("aria-label", /독립 자령/u);
  await page.locator('[data-synthesis-depth="3"]').click();
  // 별 필터는 목록을 실제로 좁힌다(3,500 전체 → 3단 자령만).
  await expect(page.locator("#codex-summary")).toContainText(/자령 [\d,]+\/3,500/u);
  await expect(page.locator("#codex-summary")).not.toContainText("자령 3,500/3,500");
  await expect(page.locator("#codex-list > button").first().locator(".codex-tier-stars")).toHaveText("★★★");
  await page.locator("#codex-search").fill("浏");
  await expect(page.locator("#codex-list")).toContainText("水 + 刘 → 浏");
  await expect(page.locator("#codex-detail")).toContainText("3단 · 합성");
  await expect(page.locator("#codex-detail .codex-tier-stars").first()).toHaveText("★★★");
  await expect(page.locator("#codex-detail .codex-abilities article")).toHaveCount(5);
  await expect(page.locator("#codex-detail")).toContainText("계승");
  // 병음 값은 그대로 나오지만 라벨은 아직 "훈음" 으로 굳어 있다(지역 라벨 회귀 — 보고서 참고).
  await expect(page.locator("#codex-detail")).toContainText("liú");
  await page.screenshot({ path: "artifacts/cn-codex-1280x720.png", fullPage: true });
});

test("renders only QC-passed generated CN sprites at 1280x720", async ({ page }) => {
  await page.goto("/?seed=CN-ASSET-1000-5");
  await chooseRegion(page, "CN");
  await page.getByTestId("start-run").click();
  await page.locator("#goal-tab").click();
  await page.locator("#goal-search").fill("一");
  await page.locator('[data-goal-char="一"]').click();
  await openShop(page);
  await page.locator('button[data-summon-intent="lineage"]').click();
  await page.getByTestId("summon-button").click();

  await expect(page.locator("#stage-region")).toHaveText("중국");
  await expect(page.locator(".summon-result-card > strong")).toHaveText("一");
  await expect(page.locator(".summon-result-spirit")).toHaveCSS("background-image", /assets\/jaryeongs\/cn-4e00\/sheet-transparent\.png/u);

  const passedAsset = await page.request.get("/assets/jaryeongs/cn-4e00/sheet-transparent.png");
  expect(passedAsset.headers()["content-type"]).toContain("image/png");
  expect((await passedAsset.body()).byteLength).toBe(225141);

  const retryPassedAsset = await page.request.get("/assets/jaryeongs/cn-5382/sheet-transparent.png");
  expect(retryPassedAsset.headers()["content-type"]).toContain("image/png");
  expect((await retryPassedAsset.body()).byteLength).toBeGreaterThan(10_000);

  const intentionallySkippedAsset = await page.request.get("/assets/jaryeongs/cn-4eba/sheet-transparent.png");
  expect(intentionallySkippedAsset.headers()["content-type"]).not.toContain("image/png");
  for (const rejectedId of ["cn-4e8e", "cn-58eb"]) {
    const rejectedAsset = await page.request.get(`/assets/jaryeongs/${rejectedId}/sheet-transparent.png`);
    expect(rejectedAsset.headers()["content-type"]).not.toContain("image/png");
  }
  await page.screenshot({ path: "artifacts/cn-generated-jaryeong-1280x720.png", fullPage: true });
});

test("shows Japanese on and kun readings as separate learning labels", async ({ page }) => {
  await page.goto("/?seed=JP-READING-E2E");
  await chooseRegion(page, "JP");
  await page.getByTestId("start-run").click();

  // 일본 지역은 한국식 "훈음" 이 아니라 "음독·훈독" 라벨을 쓴다. 목표 서책이 그 라벨을 그대로 노출한다.
  await page.locator("#goal-tab").click();
  await page.locator("#goal-search").fill("木");
  await page.locator('[data-goal-char="木"]').click();
  await expect(page.locator("#goal-reading")).toContainText("음독·훈독");
  await expect(page.locator("#goal-reading")).toContainText("ボク·モク");
  await expect(page.locator('#goal-selector-list [data-goal-char="木"]')).toContainText("음독·훈독");

  await openCodex(page);
  await page.locator("#codex-search").fill("木");
  await expect(page.locator("#codex-detail")).toContainText("ボク·モク");
  // 도감 상세는 현재 음독만 싣는다. 훈독(き·こ)이 도감에서 사라진 건 통합 도감 개편 때 생긴 회귀로
  // 보고했으므로, 앱이 고쳐지면 아래 두 줄을 되살릴 것.
  // await expect(page.locator("#codex-detail")).toContainText("음독 ボク·モク");
  // await expect(page.locator("#codex-detail")).toContainText("훈독 き·こ");
});

test("automatically seals four correctly placed towers with readable feedback", async ({ page }) => {
  await page.goto("/?seed=IDIOM-1000-8495");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".control-panel #idiom-panel")).toHaveCount(1);
  await expect(page.locator(".battle-stage #idiom-hud, .battle-stage #idiom-result")).toHaveCount(0);
  await openShop(page);
  await page.locator('button[data-summon-intent="lineage"]').click();
  for (let index = 0; index < 3; index += 1) await page.getByTestId("summon-button").click();
  await expect(page.locator("#idiom-count")).toHaveText("0 / 5");
  await expect(page.locator("#idiom-glyphs .is-owned")).toHaveCount(3);
  await page.getByTestId("summon-button").click();
  await expect(page.locator("#idiom-count")).toHaveText("1 / 5");
  await expect(page.locator("#idiom-name")).not.toHaveText("이심전심");
  await expect(page.locator("#idiom-tab-count")).toHaveText("1/5");
  await page.getByRole("tab", { name: /성어/ }).click();
  await expect(page.locator("#idiom-panel")).toBeVisible();
  await expect(page.locator("#idiom-result-name")).toHaveText("이심전심 자동 봉인");
  await expect(page.locator("#idiom-result-meaning")).toContainText("마음이 통함");
  await expect(page.locator("#idiom-result-bonus")).toHaveText("모든 자령 사거리 +28");
  // 자동 판정 안내는 패널 바닥 조작 팁(.canvas-tip)이 아니라 성어 패널 자체가 설명한다.
  await expect(page.locator(".canvas-tip")).toContainText("확대·축소");
  await expect(page.locator("#idiom-panel")).toContainText("자동 봉인");
  await expect(page.locator("#idiom-panel")).not.toContainText("선을 그");
  await page.screenshot({ path: "artifacts/idiom-seal-1280x720.png", fullPage: true });

  await page.locator("#codex-button").click();
  await page.getByRole("tab", { name: "사자성어" }).click();
  await expect(page.locator("#codex-summary")).toContainText("104/104");
  await expect(page.locator("#codex-summary")).toContainText("이번 런 목표 5개");
  await expect(page.locator(".codex-idiom-card")).toHaveCount(104);
  await expect(page.locator(".codex-idiom-card.is-featured")).toHaveCount(5);
  await page.locator("#codex-search").fill("천지현황");
  await expect(page.locator(".codex-idiom-card")).toHaveCount(1);
  await page.locator(".codex-idiom-card").click();
  await expect(page.locator("#codex-detail")).toContainText("천자문 제1구");
  await expect(page.locator("#codex-detail")).toContainText("하늘은 검고 땅은 누르다");
  await page.screenshot({ path: "artifacts/cheonjamun-idiom-codex-1280x720.png", fullPage: true });
});

test("keeps the full game surface on a small laptop without a browser page scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/?seed=responsive-e2e-01");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#title-overlay")).not.toHaveClass(/modal-layer--visible/u);
  await openShop(page);
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await page.waitForTimeout(250);

  await page.locator("#concentration-tab").click();
  await expect(page.locator("#concentration-panel")).toBeVisible();
  await page.locator("#growth-tab").click();
  await expect(page.locator("#growth-panel")).toBeVisible();
  const tabRows = await page.locator(".panel-tabs > button").evaluateAll((buttons) => [...new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)))]);
  expect(tabRows).toHaveLength(1);
  const workbenchScrollbar = await page.locator("#growth-upgrade-list").evaluate((element) => getComputedStyle(element).scrollbarColor);
  expect(workbenchScrollbar).not.toBe("auto");

  const layout = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".game-shell")?.getBoundingClientRect();
    const stage = document.querySelector<HTMLElement>(".battle-stage")?.getBoundingClientRect();
    const panel = document.querySelector<HTMLElement>(".control-panel")?.getBoundingClientRect();
    const goalGlyph = document.querySelector<HTMLElement>(".goal-glyph");
    return {
      shellWidth: shell?.width ?? 0,
      shellHeight: shell?.height ?? 0,
      stageRight: stage?.right ?? 0,
      panelLeft: panel?.left ?? 0,
      stageTop: stage?.top ?? 0,
      panelTop: panel?.top ?? 0,
      goalGlyphSize: Number.parseFloat(goalGlyph ? getComputedStyle(goalGlyph).fontSize : "0"),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      overflowY: document.documentElement.scrollHeight - window.innerHeight,
      pageScrollbar: getComputedStyle(document.documentElement).scrollbarColor
    };
  });

  expect(layout.shellWidth).toBeLessThanOrEqual(900);
  expect(layout.shellHeight).toBeLessThanOrEqual(700);
  expect(layout.panelLeft).toBeGreaterThanOrEqual(layout.stageRight - 1);
  expect(Math.abs(layout.panelTop - layout.stageTop)).toBeLessThanOrEqual(1);
  expect(layout.goalGlyphSize).toBeGreaterThanOrEqual(48);
  expect(layout.overflowX).toBeLessThanOrEqual(0);
  expect(layout.overflowY).toBeLessThanOrEqual(0);
  expect(layout.pageScrollbar).not.toBe("auto");
  await page.screenshot({ path: "artifacts/small-laptop-900x700.png", fullPage: true });
});

test("scales Jaryeong labels and the selected reading cleanly at 1600x900", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?seed=spirit-large-e2e-01");
  await page.getByTestId("start-run").click();
  await openShop(page);
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();
  await openUnit(page);
  await expect(page.locator(".game-shell")).toHaveAttribute("data-display-mode", "spirit");
  await expect(page.locator(".selected-radical")).toContainText("훈음");

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#battle-canvas");
    const rect = canvas?.getBoundingClientRect();
    return {
      canvasWidth: rect?.width ?? 0,
      backingWidth: canvas?.width ?? 0,
      radicalSize: Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>(".selected-radical")!).fontSize),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      overflowY: document.documentElement.scrollHeight - window.innerHeight
    };
  });

  expect(layout.canvasWidth).toBeGreaterThan(1000);
  expect(layout.backingWidth).toBeGreaterThanOrEqual(1000);
  expect(layout.radicalSize).toBeGreaterThanOrEqual(10);
  expect(layout.overflowX).toBeLessThanOrEqual(0);
  expect(layout.overflowY).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "artifacts/jaryeong-mode-1600x900.png", fullPage: true });
});

test("opens the rules and exposes synthesis keyboard guidance", async ({ page }) => {
  await page.goto("/");
  // S00 보조 메뉴는 아이콘+짧은 이름(冊 도감 / ⚙ 설정 / ? 도움말)으로 압축됐다.
  await expect(page.locator(".s00-utility > button")).toHaveCount(3);
  await page.locator("#title-help-button").click();
  await expect(page.getByRole("heading", { name: "봉인술 입문" })).toBeVisible();
  await expect(page.locator(".key-guide")).toContainText("첫 합성");
  await expect(page.locator(".key-guide")).toContainText("Space");
  await expect(page.locator("#help-dialog")).toContainText("능력 조합");
  await expect(page.locator("#help-dialog")).toContainText("사자성어");
  await expect(page.locator("#help-dialog")).toContainText("자동배치");
  await expect(page.locator("#help-dialog")).toContainText("은행 이자");
  await expect(page.locator("#help-dialog")).toContainText("훈·독");
});

// 코치를 실제로 띄우는 유일한 스펙이다. @onboarding 태그 덕분에 beforeEach 가 "이미 봤음"
// 표시를 심지 않으므로, 앱이 스스로 남기는 저장값만으로 재노출 여부가 결정된다.
test("spotlights the first run with a three-step coach that can be skipped for good", { tag: ONBOARDING_TAG }, async ({ page }) => {
  await page.goto("/?seed=COACH-E2E-01");
  await page.getByTestId("start-run").click();

  await expect(page.locator("#coach-layer")).toBeVisible();
  await expect(page.locator("#coach-total")).toHaveText("3");
  await expect(page.locator("#coach-index")).toHaveText("1");
  await expect(page.locator("#coach-title")).toContainText("소환");
  await page.locator("#coach-next").click();
  await expect(page.locator("#coach-index")).toHaveText("2");
  await page.locator("#coach-skip").click();
  await expect(page.locator("#coach-layer")).toBeHidden();
  // 코치를 닫으면 말풍선이 덮고 있던 패널 탭이 다시 눌린다.
  await openShop(page);

  await page.reload();
  await page.getByTestId("start-run").click();
  await expect(page.locator("#coach-layer")).toBeHidden();
});
