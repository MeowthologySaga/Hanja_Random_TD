/*
 * 강화 제련소 — 교전 중에도 버튼이 눌린다.
 *
 * "강화상점이 강화 버튼이 잘 안눌려"(사용자). 원인은 화면 갱신이었다.
 * `renderGrowth` 가 목록의 innerHTML 을 통째로 갈아 끼우는데, 다시 그릴지
 * 정하는 열쇠에 **엽전·문기**가 들어 있어 교전 중에는 사실상 매 프레임 바뀌었다.
 * 그러면 `mousedown` 을 받은 버튼 노드가 `mouseup` 전에 사라져 **`click` 이
 * 아예 발생하지 않는다.** 같은 뿌리에서 스크롤도 맨 위로 되감겼다.
 *
 * 그래서 이 스펙이 지키는 것은 셋이다.
 *  ① 값이 계속 바뀌는 동안에도 **버튼 노드가 살아 있다**(신원이 유지된다).
 *  ② 그 상태에서 실제로 눌러 단계가 오른다.
 *  ③ 스크롤이 제자리를 지킨다.
 */
import { expect, test, type Page } from "@playwright/test";

interface QaHandle {
  engine: {
    state: { gold: number; globalUpgrades: Record<string, number>; phase: string };
  };
}

const qa = (page: Page): Promise<QaHandle> =>
  page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    return (typeof handle === "function" ? (handle as () => QaHandle)() : handle) as QaHandle;
  });

async function openForge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=FORGE-E2E&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.locator('.panel-tabs button[data-panel-tab="growth"]').click();
  await expect(page.locator("#growth-upgrade-list")).toBeVisible();
}

/** 엽전을 흔든다 — 교전 중 매 프레임 값이 바뀌던 상황을 그대로 만든다. */
async function jitterGold(page: Page, ticks: number): Promise<void> {
  for (let tick = 0; tick < ticks; tick += 1) {
    await page.evaluate((n) => {
      const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
      const ctx = (typeof handle === "function" ? (handle as () => QaHandle)() : handle) as QaHandle;
      ctx.engine.state.gold = 4000 + (n % 7);
    }, tick);
    await page.waitForTimeout(70);
  }
}

test("값이 계속 바뀌어도 버튼 노드가 살아 있다", async ({ page }) => {
  await openForge(page);
  const first = page.locator('#growth-upgrade-list [data-growth-upgrade-scope="global"]').first();
  await expect(first).toBeVisible();

  // 노드에 표시를 남겨 두고, 값이 흔들리는 동안 그 표시가 살아남는지 본다.
  await first.evaluate((element) => element.setAttribute("data-liveness-probe", "1"));
  await jitterGold(page, 12);
  await expect(page.locator("#growth-upgrade-list [data-liveness-probe]")).toHaveCount(1);
});

test("교전 중 값이 흔들려도 눌러서 단계가 오른다", async ({ page }) => {
  await openForge(page);
  const before = (await qa(page)).engine.state.globalUpgrades["damage"] ?? 0;

  const jitter = jitterGold(page, 14);
  const button = page.locator('#growth-upgrade-list [data-growth-upgrade-scope="global"][data-growth-stat="damage"][data-growth-amount="1"]');
  await expect(button).toBeEnabled();
  await button.click();
  await jitter;

  const after = (await qa(page)).engine.state.globalUpgrades["damage"] ?? 0;
  expect(after).toBeGreaterThan(before);
});

test("값이 바뀌어도 스크롤이 맨 위로 되감기지 않는다", async ({ page }) => {
  await openForge(page);
  const list = page.locator("#growth-upgrade-list");
  await list.evaluate((element) => { element.scrollTop = 120; });
  const parked = await list.evaluate((element) => element.scrollTop);
  test.skip(parked === 0, "이 화면 크기에서는 목록이 스크롤되지 않는다");

  await jitterGold(page, 12);
  expect(await list.evaluate((element) => element.scrollTop)).toBe(parked);
});
