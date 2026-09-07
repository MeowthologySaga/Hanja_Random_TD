/*
 * 창을 벗어나면 멈추고, 배속을 기억한다 (v042).
 *
 * 100웨이브 한 판은 봇 기준 40~50분이고 사람 손으로는 60분 남짓이다. 그런데 자리를
 * 비우는 동안에도 판이 굴러갔다 — 사전을 찾으러 갔다 돌아오면 무너져 있는 것이다.
 *
 * 이 스펙이 지키는 것 넷.
 *  ① 창을 벗어나면 시계가 **선다**.
 *  ② 돌아오면 한 박자(1초) 뒤에 이어진다 — 돌아오자마자 누른 손이 전장에 떨어지지
 *     않게 두는 유예다.
 *  ③ **손으로 세운 정지(P)는 복귀가 삼키지 않는다.** 판을 읽으려고 세우고 나갔다
 *     돌아왔는데 판이 굴러가면 그 기능은 제 목적을 배신한다.
 *  ④ 배속은 새로고침을 넘어 남는다.
 *
 * 소환을 먼저 하는 까닭: 첫 소환 전에는 코어가 시계를 아예 안 돌린다(game.ts) —
 * 그 상태에서 「멈췄다」를 재면 고치기 전 빌드에서도 초록이 되는 가짜 시험이 된다.
 */
import { expect, test, type Page } from "@playwright/test";

interface QaHandle {
  engine: { state: { elapsed: number; phase: string } };
}

const elapsed = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    return ((typeof handle === "function" ? (handle as () => QaHandle)() : handle) as QaHandle).engine.state.elapsed;
  });

async function openRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=AWAY-PAUSE&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  // 첫 소환 전에는 시계가 안 흐른다 — 재려면 반드시 한 기를 세워야 한다.
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

test("창을 벗어나면 시계가 서고, 돌아오면 한 박자 뒤에 이어진다", async ({ page }) => {
  await openRun(page);
  await expect.poll(async () => (await elapsed(page)) > 0).toBe(true);

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("#pause-chip")).toBeVisible();
  await expect(page.locator("#pause-reason")).toHaveText("창을 다시 누르면 계속");
  const frozen = await elapsed(page);
  await page.waitForTimeout(900);
  expect(await elapsed(page), "벗어난 사이에는 한 틱도 안 흐른다").toBe(frozen);

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  // 한 박자 — 돌아오자마자는 아직 서 있다.
  await page.waitForTimeout(200);
  await expect(page.locator("#pause-chip")).toBeVisible();
  await expect.poll(async () => (await page.locator("#pause-chip").isHidden()), { timeout: 3_000 }).toBe(true);
  await expect.poll(async () => (await elapsed(page)) > frozen).toBe(true);
});

test("손으로 세운 정지는 복귀가 삼키지 않는다", async ({ page }) => {
  await openRun(page);
  await page.keyboard.press("KeyP");
  await expect(page.locator("#pause-chip")).toBeVisible();
  await expect(page.locator("#pause-reason")).toHaveText("P 키로 계속");

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(1500);
  // 창은 돌아왔지만 사람이 세운 정지는 그대로다.
  await expect(page.locator("#pause-chip")).toBeVisible();
  await expect(page.locator("#pause-reason")).toHaveText("P 키로 계속");
});

test("설정에서 끄면 벗어나도 굴러간다", async ({ page }) => {
  await openRun(page);
  await page.locator("#settings-button").click();
  await page.getByTestId("pause-on-blur-toggle").click();
  await expect(page.getByTestId("pause-on-blur-toggle")).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(400);
  await expect(page.locator("#pause-chip")).toBeHidden();
  const before = await elapsed(page);
  await page.waitForTimeout(600);
  expect(await elapsed(page)).toBeGreaterThan(before);
});

test("배속은 새로고침을 넘어 남는다", async ({ page }) => {
  await openRun(page);
  await page.keyboard.press("KeyF");
  await expect(page.locator(".game-shell")).toHaveAttribute("data-game-speed", "2");

  await page.reload();
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await expect(page.locator(".game-shell"), "판을 새로 열어도 눌러 둔 배속 그대로").toHaveAttribute("data-game-speed", "2");
});
