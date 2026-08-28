// 개발자 모드 디버그 패널 — 성어 발동 원클릭 재현 (src/ui/dev-tools.ts).
// 게이트(백틱 5회) → 「開」 버튼 → [성어 발동 보기](3자 배치 + 마지막 1자 보관고)
// → [끝까지 자동](마지막 글자 배치) → 자동 봉인 발동까지를 한 번에 검증한다.
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // 코치·1회성 안내가 패널 클릭을 가로채지 않도록 이미 본 사용자로 시작한다.
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
});

test("dev tools panel stages the tracked idiom and fires the seal", async ({ page }) => {
  await page.goto("/?seed=DEVTOOLS-E2E-01&mode=casual");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "prep");

  // 첫 소환 — 시작 오행진이 무료로 열린다(성어 줄을 세울 진이 필요하다).
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();

  // 개발자 모드 게이트: 켜기 전에는 버튼 자체가 존재를 드러내지 않는다.
  await expect(page.locator("#dev-tools-button")).toBeHidden();
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await expect(page.locator("#dev-tools-button")).toBeVisible();

  await page.locator("#dev-tools-button").click();
  await expect(page.locator("#dev-tools-panel")).toBeVisible();
  await expect(page.locator("#dev-idiom-select option").first()).toHaveAttribute("value", /.+/u);
  await page.screenshot({ path: "artifacts/dev-tools-panel-1280x720.png", fullPage: true });

  // [성어 발동 보기] — 3자는 줄에 서고 마지막 1자는 보관고에 있다.
  await page.locator("#dev-idiom-stage").click();
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-idiom-order-badges", /:3/u);
  await expect(page.locator("#battle-canvas")).toHaveAttribute("data-idiom-next-cells", /\d/u);
  const staged = await page.evaluate(() => {
    const qa = (window as unknown as {
      __HANJA_CTX_QA__: {
        engine: {
          currentIdiomTarget(): { chars: string } | undefined;
          state: { inventoryTowers: Array<{ char: string }>; towers: Array<{ char: string; cell: number }>; idiomSeals: unknown[] };
        };
      };
    }).__HANJA_CTX_QA__;
    const idiom = qa.engine.currentIdiomTarget();
    const chars = idiom ? [...idiom.chars] : [];
    return {
      chars,
      placed: chars.slice(0, 3).every((char) => qa.engine.state.towers.some((tower) => tower.char === char && tower.cell >= 0)),
      lastInVault: chars.length === 4 && qa.engine.state.inventoryTowers.some((tower) => tower.char === chars[3]),
      seals: qa.engine.state.idiomSeals.length
    };
  });
  expect(staged.chars).toHaveLength(4);
  expect(staged.placed).toBe(true);
  expect(staged.lastInVault).toBe(true);
  expect(staged.seals).toBe(0);
  await page.screenshot({ path: "artifacts/dev-tools-idiom-staged-1280x720.png", fullPage: true });

  // [끝까지 자동] — 마지막 글자가 줄에 서고 자동 봉인이 발동한다.
  await page.locator("#dev-idiom-full").click();
  await expect(page.locator("[data-active-idiom]")).toHaveCount(1);
  await expect(page.locator("#message-value")).toContainText("자동 발동");
  await page.screenshot({ path: "artifacts/dev-tools-idiom-fired-1280x720.png", fullPage: true });

  /*
   * 묵편 지급 — 집자소를 손보려고 우두머리를 열 번 잡을 수는 없다.
   *
   * 보관소는 판 밖의 장부라 즉시 localStorage 에 남고, 제목 화면 배지도
   * 그 자리에서 따라 오른다.
   */
  // 안내 문장은 매 프레임 엔진 문장에 덮이므로, 말이 아니라 **장부**를 잰다.
  await page.locator("#dev-shard-char").fill("天");
  await page.getByTestId("dev-shard-grant").click();
  await expect
    .poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem("hanja-td:soul-archive-v1");
      const parsed = raw ? (JSON.parse(raw) as { souls?: Record<string, number> }) : {};
      return (parsed.souls ?? {})["天"] ?? 0;
    }))
    .toBe(1);
  await page.getByTestId("dev-shard-random").click();

  const archive = await page.evaluate(() => {
    const raw = window.localStorage.getItem("hanja-td:soul-archive-v1");
    const parsed = raw ? (JSON.parse(raw) as { souls?: Record<string, number> }) : {};
    const souls = parsed.souls ?? {};
    return { chars: Object.keys(souls).length, total: Object.values(souls).reduce((sum, n) => sum + n, 0) };
  });
  expect(archive.chars).toBeGreaterThan(1);
  expect(archive.total).toBeGreaterThan(1);

  // 비우기는 되돌릴 수 없는 손잡이라 장부가 실제로 비는지까지 본다.
  await page.getByTestId("dev-shard-clear").click();
  const cleared = await page.evaluate(() => {
    const raw = window.localStorage.getItem("hanja-td:soul-archive-v1");
    const parsed = raw ? (JSON.parse(raw) as { souls?: Record<string, number> }) : {};
    return Object.keys(parsed.souls ?? {}).length;
  });
  expect(cleared).toBe(0);

  // 개발자 모드를 끄면 버튼·패널이 즉시 소멸한다.
  // (패널 안은 키 입력을 삼키므로, 먼저 닫아 포커스를 문서로 되돌린다)
  await page.locator("#dev-tools-close").click();
  await expect(page.locator("#dev-tools-panel")).toBeHidden();
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await expect(page.locator("#dev-tools-button")).toBeHidden();
});
