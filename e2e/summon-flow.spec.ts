/*
 * 소환은 연달아 누르는 조작이다 (v039).
 *
 * 지키는 것 둘.
 *  ① 소환해도 **판이 멈추지 않는다.** 공개 카드가 판을 세우던 탓에 빠르게
 *     누르면 게임이 끊겨 보였다("연속으로 누르는데 렉걸리는거 같잖아" — 사용자).
 *  ② 10연은 **상품마다** 있다. 별을 파는 중급·고급에도 열 장 손잡이가 선다.
 */
import { expect, test, type Page } from "@playwright/test";

interface QaHandle {
  engine: {
    state: { elapsed: number; phase: string; gold: number; summonCount: number };
  };
}

const qa = (page: Page): Promise<QaHandle> =>
  page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    return (typeof handle === "function" ? (handle as () => QaHandle)() : handle) as QaHandle;
  });

async function openRun(page: Page, seed: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:soul-tutor-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto(`/?seed=${seed}&mode=standard`);
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
}

test("소환 공개 카드는 판을 세우지 않는다", async ({ page }) => {
  await openRun(page, "SUMMON-FLOW");
  await page.getByTestId("summon-button").click();
  // 카드가 실제로 떠 있는 동안을 잰다 — 첫 소환은 반드시 카드가 선다.
  await expect(page.locator("#summon-reveal")).toHaveAttribute("aria-hidden", "false");

  /*
   * 예전에는 이 순간 `#pause-chip` 이 서고 시계가 멎었다. 이제는 창(dialog)만
   * 판을 세운다 — 카드는 읽는 것이지 고르는 것이 아니다.
   */
  await expect(page.locator("#pause-chip")).toBeHidden();

  const before = (await qa(page)).engine.state.elapsed;
  await page.waitForTimeout(700);
  const after = (await qa(page)).engine.state.elapsed;
  expect(after).toBeGreaterThan(before);
});

test("카드가 떠 있어도 다음 소환이 한 번에 눌린다", async ({ page }) => {
  await openRun(page, "SUMMON-FLOW-2");
  const summon = page.getByTestId("summon-button");
  await summon.click();
  await expect(page.locator("#summon-reveal")).toHaveAttribute("aria-hidden", "false");

  /*
   * 카드가 클릭을 삼키던 탓에 「닫는 클릭」과 「다음 소환 클릭」이 겹치지 못해
   * 두 번 눌러야 한 번 뽑혔다 — 손에는 그것이 렉으로 읽혔다(850 절).
   * 카드가 떠 있는 채로 한 번 더 누르면 소환 수가 곧바로 하나 더 올라야 한다.
   */
  const before = (await qa(page)).engine.state.summonCount;
  await summon.click();
  await expect.poll(async () => (await qa(page)).engine.state.summonCount).toBe(before + 1);
});

test("10연은 상품마다 선다 — 중급·고급에도", async ({ page }) => {
  await openRun(page, "SUMMON-FLOW-3");

  // 균형 10연은 예전 그대로 그 자리에 있다(단축키 Q 포함).
  await expect(page.getByTestId("multi-summon-button")).toBeVisible();

  for (const tier of ["midstar", "highstar"] as const) {
    const card = page.getByTestId(`multi-${tier}-button`);
    const tierCard = page.locator(`[data-summon-product="${tier}"]`);
    // 그 티어가 열려 있으면 10연도 함께 열려 있어야 한다 — 하나만 있으면 반쪽이다.
    if (await tierCard.count() === 0) continue;
    await expect(card).toBeVisible();
    await expect(card).toContainText("10연");
  }

  // 고급 10연을 실제로 눌러 열 기가 한 번에 서는지 본다.
  const highTen = page.getByTestId("multi-highstar-button");
  if (await highTen.count() === 0) return;
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: { engine: { state: { gold: number } } } }).__HANJA_CTX_QA__;
    handle.engine.state.gold = 100_000;
  });
  await expect.poll(async () => highTen.isDisabled()).toBe(false);
  const before = (await qa(page)).engine.state.summonCount;
  await highTen.click();
  await expect.poll(async () => (await qa(page)).engine.state.summonCount).toBe(before + 10);
});
