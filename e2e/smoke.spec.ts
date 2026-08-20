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

test("renders a viewport-fixed hanji field and moving ink current at minimum zoom", async ({ page }) => {
  await page.goto("/?seed=E2E-HANJI-INK");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-surface", "hanji-ink");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-hit-feedback", "ink-local");
  await expect(page.locator(".battle-stage")).toHaveCSS("filter", "none");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/assets/map/hanji-ink-field/hanji-paper-base.png")))).toBe(true);
  const firstCurrent = Number(await page.locator("#battle-canvas").getAttribute("data-ink-current-offset"));
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

test("shows a readable single summon reveal and a ten-result board", async ({ page }) => {
  await page.goto("/?seed=E2E-SUMMON-REVEAL");
  await page.getByTestId("start-run").click();
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
  await expect(page.locator("#multi-summon-cost")).toHaveText("60");
  await page.getByTestId("multi-summon-button").click();
  await expect(page.locator("#gold-value")).toHaveText("4");
  await expect(page.locator("#tower-count-value")).toHaveText("10 / 80");
  await expect(page.locator("#summon-reveal-title")).toHaveText("10연 소환 결과");
  await expect(page.locator(".summon-result-card")).toHaveCount(10);
  await expect(page.locator("#summon-reveal-summary")).toContainText("새 발견");
  await expect(page.locator("#summon-reveal-summary")).toContainText("합성 재료");
  await page.waitForTimeout(900);
  await page.screenshot({ path: "artifacts/summon-ten-result-1280x720.png", fullPage: true });
});

test("upgrades each five-element branch from the run forge", async ({ page }) => {
  await page.goto("/?seed=E2E-ELEMENT-UPGRADE");
  await page.getByTestId("start-run").click();
  await page.getByTestId("element-upgrade-button").click();
  await expect(page.locator("#element-upgrade-dialog")).toBeVisible();
  await expect(page.locator(".element-upgrade-card")).toHaveCount(5);
  const commonDamage = page.locator('[data-upgrade-scope="global"][data-upgrade-stat="damage"]');
  await expect(commonDamage).toContainText("16엽전");
  await commonDamage.click();
  await expect(page.locator("#gold-value")).toHaveText("48");
  await expect(commonDamage).toContainText("19엽전");
  await expect(page.locator('[data-upgrade-element="木"][data-upgrade-stat="damage"]')).toBeDisabled();
  await page.screenshot({ path: "artifacts/element-upgrades-1280x720.png", fullPage: true });
  await page.locator("#element-upgrade-close").click();
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
  await expect(page.locator("#gold-value")).toHaveText("64");
  await expect(page.locator("#interest-preview")).toHaveText("이자 +6");
  await expect(page.locator(".game-shell")).toHaveAttribute("data-game-speed", "1");
  await expect(page.locator("#map-zoom-value")).toHaveText("100%");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-zoom", "2.60");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-map-zoom-display", "100");
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-label-density", "reading");
  await expect(page.locator("#hanja-emphasis-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#speed-button").click();
  await expect(page.locator("#speed-button")).toHaveText("2×");
  await page.locator("#speed-button").click();
  await expect(page.locator("#speed-button")).toHaveText("3×");
  await page.locator("#speed-button").click();
  await expect(page.locator("#speed-button")).toHaveText("1×");
  await expect(page.locator("#goal-glyph")).toHaveText("相");
  await expect(page.locator("#goal-recipe")).toHaveText("木 + 目 → 相");
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await expect(page.locator("#tower-count-value")).toHaveText("4 / 80");
  await expect(page.locator("#gold-value")).toHaveText("40");
  await expect(page.locator("#interest-preview")).toHaveText("이자 +4");
  await expect(page.locator("#seed-value")).toHaveText("E2E-FIXED-01");
  await expect(page.locator("#synergy-strip span")).toHaveCount(5);
  await expect(page.locator("#selected-card .ability-pills span")).toHaveCount(4);
  await expect(page.locator("#selected-card .ability-charge")).toBeVisible();
  await expect(page.locator("#selected-card .selected-learning")).toContainText("훈음");
  await expect(page.locator("#selected-card .selected-radical")).toContainText("훈음");
  await expect(page.locator("#selected-card .selected-radical")).not.toContainText("부수");
  await expect(page.locator("#goal-reading")).toContainText("서로 상");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/assets/jaryeongs/")))).toBe(true);

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

  await expect(page.getByTestId("auto-arrange-button")).toBeEnabled();
  await page.getByTestId("auto-arrange-button").click();
  await expect(page.locator("#message-value")).toContainText("자동배치");
  await expect(page.locator("#tower-count-value")).toHaveText("4 / 80");
  await page.screenshot({ path: "artifacts/auto-arrange-1280x720.png", fullPage: true });

  await page.getByTestId("early-wave").click();
  await expect(page.locator("#stage-wave")).toHaveText("1 / 20");
  await expect(page.locator("#stage-phase")).toHaveText("교전 중");
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "combat");
  await expect(page.locator("#combat-feed li").first()).toBeAttached({ timeout: 10_000 });
  await expect(page.locator("#ability-banner")).toHaveCount(0);
  await expect(page.locator("#combat-feed li").first().locator("small")).not.toHaveText("능력 발동");
  await page.getByRole("tab", { name: "기록" }).click();
  await expect(page.locator("#combat-feed li").first()).toBeVisible();
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
  await page.locator("#speed-button").click();
  await page.locator("#speed-button").click();
  await expect(page.locator("#speed-button")).toHaveText("3×");
  await page.getByTestId("early-wave").click();
  await expect(page.locator("#stage-wave")).toHaveText("1 / 20");
  await expect(page.locator("#wave-kicker")).toContainText("다음 웨이브", { timeout: 7_000 });
  await expect(page.locator("#stage-wave")).toHaveText("2 / 20", { timeout: 8_000 });
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

  await page.getByTestId("summon-button").click();
  await expect(page.locator("#tower-count-value")).toHaveText("0 / 80");
  await expect(page.locator("#run-inventory-count")).toHaveText("1");
  await page.locator("#run-inventory-tab").click();
  const inventoryCard = page.locator(".run-inventory-card").first();
  await expect(inventoryCard).toBeVisible();
  await expect(inventoryCard.locator(".run-inventory-spirit")).toHaveCSS("background-image", /assets\/jaryeongs\//u);
  await inventoryCard.click();
  await expect(inventoryCard).toHaveClass(/is-selected/u);

  const deploymentCell = await canvasPositionForWorld(page, 374, 294);
  await page.locator("#battle-canvas").click({ position: deploymentCell });
  await expect(page.locator("#tower-count-value")).toHaveText("1 / 80");
  await expect(page.locator("#run-inventory-count")).toHaveText("0");

  await page.locator("#battle-canvas").click({ position: deploymentCell });
  await expect(page.getByTestId("store-tower")).toBeVisible();
  await page.getByTestId("store-tower").click();
  await expect(page.locator("#tower-count-value")).toHaveText("0 / 80");
  await expect(page.locator("#run-inventory-count")).toHaveText("1");
  await expect(page.locator("#run-inventory-panel")).toBeVisible();
  await page.screenshot({ path: "artifacts/run-inventory-1280x720.png", fullPage: true });

  await page.reload();
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await expect(page.getByTestId("auto-place-toggle")).toHaveAttribute("aria-checked", "false");
  expect(errors).toEqual([]);
});

test("shows synthesis branches, highlights board materials, protects locked Jaryeong, and persists the strategy inventory", async ({ page }) => {
  await page.goto("/?seed=EVO-E2E-2");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#stage-enemies")).toHaveText("0 / 80");
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();

  let readySourceFound = false;
  for (const x of [374, 422, 470, 518]) {
    const towerPosition = await canvasPositionForWorld(page, x, 94);
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
  await expect(page.locator('[data-synthesis-depth="0"]')).toContainText("직접 소환");
  await page.locator('[data-synthesis-depth="2"]').click();
  await expect(page.locator("#codex-summary")).toContainText("2단 합성");
  await expect(page.locator("#codex-list > button").first().locator("small")).toContainText("2단 합성");
  await page.locator("#codex-search").fill("浏");
  await expect(page.locator("#codex-list")).toContainText("水+刘");
  await expect(page.locator("#codex-detail")).toContainText("합성 단계");
  await expect(page.locator("#codex-detail")).toContainText("2단 합성");
  await expect(page.locator("#codex-detail .codex-abilities article")).toHaveCount(5);
  await expect(page.locator("#codex-detail")).toContainText("계승");
  await expect(page.locator("#codex-detail")).toContainText("병음");
  await page.screenshot({ path: "artifacts/cn-codex-1280x720.png", fullPage: true });
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
  await page.goto("/?seed=idiom-v10-24822");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".control-panel #idiom-panel")).toHaveCount(1);
  await expect(page.locator(".battle-stage #idiom-hud, .battle-stage #idiom-result")).toHaveCount(0);
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

test("stacks the battlefield and panel without shrinking learning text on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/?seed=responsive-e2e-01");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#title-overlay")).not.toHaveClass(/modal-layer--visible/u);
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await page.waitForTimeout(250);

  const layout = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".battle-stage")?.getBoundingClientRect();
    const panel = document.querySelector<HTMLElement>(".control-panel")?.getBoundingClientRect();
    const goalGlyph = document.querySelector<HTMLElement>(".goal-glyph");
    return {
      stageBottom: stage?.bottom ?? 0,
      panelTop: panel?.top ?? 0,
      goalGlyphSize: Number.parseFloat(goalGlyph ? getComputedStyle(goalGlyph).fontSize : "0"),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      pageHeight: document.documentElement.scrollHeight
    };
  });

  expect(layout.panelTop).toBeGreaterThanOrEqual(layout.stageBottom - 1);
  expect(layout.goalGlyphSize).toBeGreaterThanOrEqual(56);
  expect(layout.overflowX).toBeLessThanOrEqual(0);
  expect(layout.pageHeight).toBeGreaterThan(700);
  await page.screenshot({ path: "artifacts/responsive-900x700.png", fullPage: true });
});

test("scales Jaryeong labels and the selected reading cleanly at 1600x900", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?seed=spirit-large-e2e-01");
  await page.getByTestId("start-run").click();
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
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
