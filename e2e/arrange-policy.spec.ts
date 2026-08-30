/*
 * 자동배치 옵션 — 톱니 하나에 다섯 갈래.
 *
 * 자동배치는 편하지만 남의 손이다. 잠가 둔 자령을 옮기고, 가방을 비우고,
 * 세워 둔 줄을 흩는다 — 무엇을 건드려도 되는지를 사람이 정할 수 있어야 한다.
 *
 * 이 스펙이 지키는 것 셋: 기본값이 여태 동작 그대로인가, 고른 것이 판을 넘어
 * 남는가, 그리고 판이 **잘리지 않고 다 보이는가**(상점 작업대가 overflow:
 * hidden 두 겹이라 위로 뜬 판의 머리가 잘렸던 자리다).
 */
import { expect, test } from "@playwright/test";

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";
const POLICY_KEY = "hanzi-rtd-arrange-policy";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key as string, "1"), COACH_STORAGE_KEY);
});

test("자동배치가 무엇을 건드릴지 고르고, 그 선택이 판을 넘어 남는다", async ({ page }) => {
  await page.goto("/?seed=ARRANGE-E2E&mode=standard");
  await page.getByTestId("start-run").click();

  // 손대기 전에는 배지가 없다 — 기본값이 곧 여태 동작이다.
  await expect(page.locator("#arrange-policy-badge")).toBeHidden();
  await page.getByTestId("arrange-policy").click();
  await expect(page.locator("#arrange-policy-panel")).toBeVisible();

  const rows = page.locator(".arrange-policy-row");
  await expect(rows).toHaveCount(5);
  await expect(page.locator(".arrange-policy-row.is-on")).toHaveCount(3);

  /*
   * 판이 잘리지 않아야 한다. 원래 자리(상점 작업대)는 overflow: hidden 두 겹에
   * 싸여 있어 위로 뜬 판의 머리가 통째로 잘렸다 — 무대 뿌리로 옮겨 고쳤다.
   */
  const fit = await page.evaluate(() => {
    const panel = document.querySelector("#arrange-policy-panel")!.getBoundingClientRect();
    const shell = document.querySelector(".game-shell")!.getBoundingClientRect();
    return {
      insideTop: panel.top >= shell.top - 1,
      insideBottom: panel.bottom <= shell.bottom + 1,
      firstRow: document.querySelector(".arrange-policy-row b")?.textContent ?? ""
    };
  });
  expect(fit.insideTop).toBe(true);
  expect(fit.insideBottom).toBe(true);
  expect(fit.firstRow).toBe("잠근 자령은 그 자리에");

  // 한 갈래를 켜면 톱니에 손댄 수가 적힌다 — 「왜 이렇게 놓였지」의 실마리다.
  await rows.first().click();
  await expect(page.locator(".arrange-policy-row.is-on")).toHaveCount(4);
  await expect(page.locator("#arrange-policy-badge")).toHaveText("1");

  // 고른 것은 설정 서랍에 남는다(런 저장본이 아니다).
  const stored = await page.evaluate((key) => window.localStorage.getItem(key as string), POLICY_KEY);
  expect(stored).toContain("keepLocked");

  // 판 밖을 누르면 닫힌다 — 잠깐 열어 보는 자리이지 머무는 화면이 아니다.
  await page.locator("#battle-canvas").click({ position: { x: 20, y: 20 } });
  await expect(page.locator("#arrange-policy-panel")).toBeHidden();

  // 새로고침해도 그대로다.
  await page.reload();
  await page.getByTestId("start-run").click();
  await expect(page.locator("#arrange-policy-badge")).toHaveText("1");

  // [기본값으로]가 되돌린다.
  await page.getByTestId("arrange-policy").click();
  await page.getByTestId("arrange-policy-reset").click();
  await expect(page.locator("#arrange-policy-badge")).toBeHidden();
  await expect(page.locator(".arrange-policy-row.is-on")).toHaveCount(3);
});
