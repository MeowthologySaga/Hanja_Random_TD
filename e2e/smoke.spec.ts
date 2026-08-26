import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByRole("radio", { name: /전략 조합전/ })).toBeChecked();
  await page.getByRole("radio", { name: /캐주얼 8성전/ }).click();
  await expect(page.locator('[data-region="KR"]')).toBeChecked();
  await expect(page.locator('[data-region="JP"]')).toBeDisabled();
  await expect(page.locator('[data-region="CN"]')).toBeDisabled();
  await expect(page.locator("#title-note")).toContainText("실제 획수 8단 희귀도");
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
  // 기본 뷰는 [한 번에 승급] + 그룹 카드. 수동 3슬롯은 접힘 안으로 내려갔다.
  await expect(page.locator("#casual-fuse-all")).toBeVisible();
  await page.locator("#casual-manual-details > summary").click();
  await expect(page.locator("#casual-manual-details")).toHaveAttribute("open", "");
  await expect(page.locator(".casual-rarity-rule > i")).toHaveCount(8);
  await expect(page.locator(".casual-fusion-slot")).toHaveCount(3);
  await expect(page.locator(".casual-fusion-tower")).toHaveCount(4);
  const eligibleKeeper = page.locator(".casual-fusion-tower:not(:disabled)").first();
  await expect(eligibleKeeper).toBeEnabled();
  const keeperChar = await eligibleKeeper.locator("b").first().innerText();
  await eligibleKeeper.click();
  await expect(page.locator(".casual-fusion-slot.is-core")).toContainText("남길 자령");
  await expect(page.locator(".casual-fusion-slot.is-core")).toContainText(keeperChar);
  await expect(page.locator(".casual-fusion-slot.is-core .casual-fusion-slot-sprite")).toHaveCSS("background-image", /assets\/jaryeongs\//u);
  await expect(page.locator(".casual-fusion-result")).toContainText(keeperChar);

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
  await page.getByRole("button", { name: /한자 도감/ }).click();
  await page.locator('[data-codex-mode="jaryeongs"]').click();
  await expect(page.locator("#codex-summary")).toContainText("기록 1,000/1,000");
  await expect(page.locator("#codex-list .codex-jaryeong-card")).toHaveCount(1_000);
  await expect(page.locator("#codex-detail .codex-jaryeong-portrait img")).toBeVisible();
  await expect(page.locator("#codex-detail")).toContainText("도감 기록");
  await expect(page.locator("#codex-detail")).not.toContainText(/QC|검토|pending/iu);
  await page.screenshot({ path: "artifacts/cheonjamun-jaryeong-dex-1000-1280x720.png", fullPage: true });
  await page.getByRole("button", { name: "도감 닫기" }).click();

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
  await expect(page.locator(".region-option.is-selected")).toContainText("천자문 1000");
  await page.screenshot({ path: "artifacts/title-1280x720.png", fullPage: true });

  await page.getByTestId("start-run").click();
  await expect(page.locator("#barrier-value")).toHaveCount(0);
  await expect(page.locator("#enemy-cap-value")).toHaveText("80체");
  await expect(page.locator("#gold-value")).toHaveText("42");
  await expect(page.locator("#interest-preview")).toHaveText("이자 +2");
  await expect(page.locator(".game-shell")).toHaveAttribute("data-game-speed", "1");
  await expect(page.locator("#map-zoom-value")).toHaveText("100%");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-zoom", "2.60");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-zoom-display", "100");
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
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/assets/fx/element-zones/")))).toBe(true);

  await page.locator("#battle-canvas").hover({ position: { x: 516, y: 54 } });
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-map-zoom"))).toBeGreaterThan(2.6);
  await expect(page.locator("#map-zoom-value")).not.toHaveText("100%");
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
  await expect(page.locator("#map-zoom-value")).toHaveText("100%");
  await page.locator("#battle-canvas").hover({ position: { x: 440, y: 360 } });
  await page.mouse.wheel(0, -5_000);
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-map-zoom"))).toBe(5.2);
  await expect(page.locator("#map-zoom-value")).toHaveText("200%");
  await page.locator("#map-zoom-reset").click();
  await expect(page.locator("#map-zoom-value")).toHaveText("100%");
  await page.locator("#battle-canvas").hover({ position: { x: 440, y: 360 } });
  await page.mouse.wheel(0, 500);
  await expect.poll(async () => Number(await page.locator("#battle-canvas").getAttribute("data-map-zoom"))).toBeLessThan(2.6);
  await page.locator("#map-zoom-reset").click();
  await expect(page.locator("#map-zoom-value")).toHaveText("100%");
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
  // 기록은 탭이 아니라 패널 바닥 상시 티커로 노출된다.
  await expect(page.locator("#record-ticker")).toBeVisible();
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

test("shows synthesis branches, highlights board materials, protects locked Jaryeong, and persists the strategy inventory", async ({ page }) => {
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

  await page.getByRole("button", { name: /한자 도감/ }).click();
  await page.getByRole("tab", { name: /보유 자령/ }).click();
  await expect(page.locator("#codex-summary")).toContainText("브라우저 자동 저장");
  await expect(page.locator("#codex-list .inventory-card")).toHaveCount(5);
  await expect(page.locator("#codex-list")).toContainText("합성 1");

  await page.getByRole("tab", { name: "조합표" }).click();
  await expect(page.locator("#codex-summary")).toContainText("재료 → 결과 순서");
  await expect(page.locator("#codex-detail .recipe-guide")).toContainText("조합표");
  await page.getByRole("tab", { name: "사자성어" }).click();
  await expect(page.locator("#codex-summary")).toContainText("성어 104/104");
  await expect(page.locator("#codex-summary")).toContainText("이번 런 목표 5개");
  await expect(page.locator("#codex-detail .idiom-strategy")).toContainText("자동 발동");
  await expect(page.locator("#codex-detail .idiom-material-guide")).toContainText("필요 한자와 획득법");
  await page.screenshot({ path: "artifacts/progression-codex-1280x720.png", fullPage: true });

  await page.getByRole("button", { name: "도감 닫기" }).click();
  await page.reload();
  await page.getByTestId("start-run").click();
  await page.getByRole("button", { name: /한자 도감/ }).click();
  await page.getByRole("tab", { name: /보유 자령/ }).click();
  await expect(page.locator("#codex-list .inventory-card")).toHaveCount(5);
});

test("keeps CN glyphs regional and opens the complete codex", async ({ page }) => {
  await page.goto("/?seed=CN-E2E-01");
  await page.locator('[data-region="CN"]').click();
  await page.getByTestId("start-run").click();
  await expect(page.locator("#stage-region")).toHaveText("중국");
  await expect(page.locator("#goal-glyph")).toHaveText("刘");
  await expect(page.locator("#goal-recipe")).toHaveText("文 + 刀 → 刘");

  await page.getByRole("button", { name: /한자 도감/ }).click();
  await expect(page.getByRole("heading", { name: /중국.*한자 도감/ })).toBeVisible();
  await expect(page.locator("#codex-summary")).toContainText("3,500자");
  await expect(page.locator('[data-synthesis-depth="1"] .codex-tier-stars')).toHaveText("★");
  await expect(page.locator('[data-synthesis-depth="1"] .codex-tier-stars')).not.toHaveClass(/is-uncombinable/u);
  await expect(page.locator('[data-synthesis-depth="stage1-uncombinable"] .codex-tier-stars')).toHaveText("★");
  await expect(page.locator('[data-synthesis-depth="stage1-uncombinable"] .codex-tier-stars')).toHaveClass(/is-uncombinable/u);
  await expect(page.locator('[data-synthesis-depth="stage1-uncombinable"] .codex-tier-stars')).toHaveAttribute("aria-label", /조합 불가/u);
  await page.locator('[data-synthesis-depth="3"]').click();
  await expect(page.locator("#codex-summary")).toContainText("★★★");
  await expect(page.locator("#codex-list > button").first().locator(".codex-tier-stars")).toHaveText("★★★");
  await page.locator("#codex-search").fill("浏");
  await expect(page.locator("#codex-list")).toContainText("水+刘");
  await expect(page.locator("#codex-detail")).toContainText("단계");
  await expect(page.locator("#codex-detail .codex-tier-stars").first()).toHaveText("★★★");
  await expect(page.locator("#codex-detail .codex-abilities article")).toHaveCount(5);
  await expect(page.locator("#codex-detail")).toContainText("계승");
  await expect(page.locator("#codex-detail")).toContainText("병음");
  await page.screenshot({ path: "artifacts/cn-codex-1280x720.png", fullPage: true });
});

test("renders only QC-passed generated CN sprites at 1280x720", async ({ page }) => {
  await page.goto("/?seed=CN-ASSET-1000-5");
  await page.locator('[data-region="CN"]').click();
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
  await page.locator('[data-region="JP"]').click();
  await page.getByTestId("start-run").click();
  await page.getByRole("button", { name: /한자 도감/ }).click();
  await page.locator("#codex-search").fill("木");
  await expect(page.locator("#codex-detail")).toContainText("음독·훈독");
  await expect(page.locator("#codex-detail")).toContainText("음독 ボク·モク");
  await expect(page.locator("#codex-detail")).toContainText("훈독 き·こ");
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
  await expect(page.locator(".canvas-tip")).toContainText("자동 판정");
  await expect(page.locator(".canvas-tip")).not.toContainText("선을 그");
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
  await page.getByRole("button", { name: "게임 방법 보기" }).click();
  await expect(page.getByRole("heading", { name: "봉인술 입문" })).toBeVisible();
  await expect(page.locator(".key-guide")).toContainText("첫 합성");
  await expect(page.locator(".key-guide")).toContainText("Space");
  await expect(page.locator("#help-dialog")).toContainText("능력 조합");
  await expect(page.locator("#help-dialog")).toContainText("사자성어");
  await expect(page.locator("#help-dialog")).toContainText("자동배치");
  await expect(page.locator("#help-dialog")).toContainText("은행 이자");
  await expect(page.locator("#help-dialog")).toContainText("훈·독");
});
