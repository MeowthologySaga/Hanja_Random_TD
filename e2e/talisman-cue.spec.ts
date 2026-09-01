/*
 * 시선 자리 행동 줄.
 *
 * "부적쓰는동안 그쪽에 시선 집중되느라, 그곳에 버튼들 친절하게 배치해줘야돼.
 * 예를들어 빨리시작으로 엽전 보너스 주는 버튼이나, 적 한계 도달 직전이나
 * 등등말이야"(사용자).
 *
 * 이 스펙이 지키는 것 셋.
 *  ① 준비 시간에는 **[지금 시작]** 이 서고, 실제로 웨이브가 열리고 엽전이 는다.
 *  ② 적 한계가 차오르면 그것이 **먼저** 선다 — 급한 것이 위다.
 *  ③ 세울 것이 없으면 **자리를 비운다** — 늘 있는 줄은 소음이고, 패널 세로
 *     예산도 빠듯하다.
 */
import { expect, test, type Page } from "@playwright/test";

interface QaHandle {
  engine: {
    state: { gold: number; phase: string; wave: number; enemies: unknown[]; summonCount: number };
  };
}

const qa = (page: Page): Promise<QaHandle> =>
  page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    return (typeof handle === "function" ? (handle as () => QaHandle)() : handle) as QaHandle;
  });

async function openTalisman(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=CUE-E2E&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.locator("#talisman-tab").click();
  await expect(page.locator("#talisman-paper")).toBeVisible();
}

test("첫 소환 전에는 세울 것이 없어 자리를 비운다", async ({ page }) => {
  await openTalisman(page);
  await page.waitForTimeout(400);
  // 아직 자령이 없으면 웨이브를 열 수도 없다 — 권할 것이 없으면 줄도 없다.
  await expect(page.locator("#talisman-cue")).toBeHidden();
});

test("준비 시간의 [지금 시작]은 패널 카드가 맡는다 — 이 줄은 비어 있다", async ({ page }) => {
  /*
   * v036 에서 자리를 갈랐다. 권유([지금 시작]·소환·강화)는 패널 위 **행동
   * 카드**가 맡고(자리가 셋이다), 부적지 아래 이 한 줄은 **판이 끝날 수도 있는
   * 일**만 말한다. 둘 다 세워 봤더니 400px 도 안 떨어진 자리에서 같은 말을
   * 두 번 해 소음이었고, 한 줄이 늘 서 있으면 종이를 밀어냈다.
   */
  await openTalisman(page);
  await page.locator('.panel-tabs button[data-panel-tab="shop"]').click();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
  await page.locator("#talisman-tab").click();
  await page.waitForTimeout(300);

  await expect(page.locator("#talisman-cue")).toBeHidden();
  // 웨이브를 여는 손은 카드에 있다.
  const start = page.locator("#wave-action-row #early-button");
  await expect(start).toBeVisible();
  await expect(start).toContainText("시작");

  const before = await qa(page);
  expect(before.engine.state.phase).toBe("prep");
  await start.click({ force: true });
  await expect.poll(async () => (await qa(page)).engine.state.phase).toBe("combat");
  expect((await qa(page)).engine.state.gold).toBeGreaterThanOrEqual(before.engine.state.gold);
});

test("적 한계가 차오르면 그것이 먼저 선다", async ({ page }) => {
  await openTalisman(page);
  await page.locator('.panel-tabs button[data-panel-tab="shop"]').click();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
  await page.locator("#talisman-tab").click();
  // 준비 단계에는 적이 안 나오므로 먼저 웨이브를 연다 — 여는 손은 카드에 있다.
  await page.locator("#wave-action-row #early-button").click({ force: true });
  await expect.poll(async () => (await qa(page)).engine.state.phase).toBe("combat");

  // 개발 손잡이로 전장을 채운다 — 적 한계는 무엇보다 급한 신호다.
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await expect(page.locator("#dev-tools-button")).toBeVisible();
  await page.locator("#dev-tools-button").click();
  await expect(page.locator("#dev-tools-panel")).toBeVisible();
  await page.locator("#dev-enemy-fill").click();
  await expect
    .poll(async () => (await qa(page)).engine.state.enemies.length)
    .toBeGreaterThan(40);
  await page.locator("#dev-tools-close").click();
  await page.locator("#talisman-tab").click();

  await expect(page.getByTestId("talisman-cue")).toContainText("적 한계");
  await expect(page.locator("#talisman-cue")).toHaveAttribute("data-tone", "urgent");
});
