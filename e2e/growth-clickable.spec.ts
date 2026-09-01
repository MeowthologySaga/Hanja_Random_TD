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

/*
 * ── 구획 갈피(v035 ④-b) ─────────────────────────────────────────
 *
 * "강화 상점의 ui가 좀 별로고 다 비슷비슷해서 구분되지도 않아 ... 현재 스크롤이
 * 너무 긴 구조야"(사용자). 셋을 한 두루마리에 이어 붙여 내용 1624px / 보이는
 * 자리 324px — 다섯 화면이었다(실측). 한 번에 한 구획만 편다.
 */
test("한 번에 한 구획만 편다 — 다섯 화면짜리 두루마리를 자른다", async ({ page }) => {
  await openForge(page);
  // 펼친 구획은 언제나 하나다.
  await expect(page.locator("#growth-upgrade-list .growth-upgrade-section")).toHaveCount(1);
  await expect(page.locator("#growth-section-tabs button")).toHaveCount(3);

  const screens = async (): Promise<number> =>
    page.locator("#growth-upgrade-list").evaluate((list) => list.scrollHeight / list.clientHeight);
  // 두 화면 안쪽이면 훑어볼 만하다 — 다섯 화면은 훑는 게 아니라 여행이었다.
  expect(await screens()).toBeLessThan(2.6);

  // 갈피를 옮기면 그 구획이 선다.
  await page.locator('[data-growth-section-tab="trait"]').click();
  await expect(page.locator("#growth-upgrade-list .growth-upgrade-section")).toHaveCount(1);
  await expect(page.locator("#growth-upgrade-list header b")).toContainText("고유 특성");
  await expect(page.locator("#growth-upgrade-list .growth-trait-row")).toHaveCount(3);
  await expect(page.locator("#growth-upgrade-list .growth-stat-row")).toHaveCount(0);
  expect(await screens()).toBeLessThan(2.6);

  await page.locator('[data-growth-section-tab="global"]').click();
  await expect(page.locator("#growth-upgrade-list .growth-stat-row")).toHaveCount(5);
});

test("능력치는 기호와 색으로 갈린다 — 읽지 않고 훑어도 갈리게", async ({ page }) => {
  await openForge(page);
  const tints = await page.locator("#growth-upgrade-list .growth-stat-row > i").evaluateAll(
    (nodes) => nodes.map((node) => getComputedStyle(node).color)
  );
  expect(tints).toHaveLength(5);
  // 다섯이 모두 다른 색이어야 한다 — 같은 금빛 다섯 줄은 읽어야만 갈렸다.
  expect(new Set(tints).size).toBe(5);
});

/*
 * 「살 수 없는 항목은 접는다」는 기획 갈래를 **접은** 자리를 지킨다.
 *
 * 여력은 교전 중 매 프레임 바뀐다. 그걸로 줄을 여닫으면 누르는 도중에 줄이
 * 사라진다 — 이 파일 맨 위가 고친 바로 그 사고다. 못 사는 줄은 자리를 지키고
 * 단추만 꺼진다.
 */
test("살 수 없어도 줄은 자리를 지킨다", async ({ page }) => {
  await openForge(page);
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => QaHandle)() : handle) as QaHandle;
    ctx.engine.state.gold = 0;
  });
  await page.waitForTimeout(200);
  await expect(page.locator("#growth-upgrade-list .growth-stat-row")).toHaveCount(5);
  await expect(page.locator('#growth-upgrade-list [data-growth-upgrade-scope="global"]').first()).toBeDisabled();
});
