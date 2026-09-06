/*
 * 집자소 첫걸음(v037) — 처음 들어온 사람이 빈손으로 나가지 않는다.
 *
 * 지키는 것 넷.
 *  ① 첫 방문에 자혼 넷(食·寐 두 자씩)이 손에 온다 — 지닌 것이 넷 이상이면 안 준다.
 *  ② 안내가 「올리기 → 뜻 적기 → 새기기 → 장착」 순서로 서고, 뜻은 예시가 미리 채워진다.
 *  ③ 음은 한자 음 그대로 — 식매식매.
 *  ④ 장착까지 마치면 안내는 끝나고 다시 열어도 서지 않는다(자혼도 다시 안 준다).
 */
import { expect, test } from "@playwright/test";

const TUTOR_KEY = "hanja-td:soul-tutor-v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), "hanja-td:coach-seen-v1");
});

test("첫 방문에 자혼 넷을 받아 「식매식매」를 새기고 장착한다", async ({ page }) => {
  await page.goto("/?seed=SOUL-TUTOR");
  await page.getByTestId("soul-archive-open").click();
  await expect(page.locator("#soul-dialog")).toBeVisible();

  // ① 자혼 넷 — 두 글자, 두 개씩.
  await expect(page.locator("#soul-holdings-count")).toHaveText("4");
  await expect(page.locator('.soul-chip[data-soul-char="食"]')).toBeVisible();
  await expect(page.locator('.soul-chip[data-soul-char="寐"]')).toBeVisible();

  // ② 안내 1걸음 — 올리기.
  const tutor = page.getByTestId("soul-tutor");
  await expect(tutor).toBeVisible();
  await expect(tutor).toHaveAttribute("data-soul-tutor-step", "pick");
  await expect(page.locator("#soul-tutor-title")).toContainText("자혼 넷");
  await expect(page.locator("#soul-tutor-ring")).toBeVisible();
  for (const char of ["食", "寐", "食", "寐"]) {
    await page.locator(`.soul-chip[data-soul-char="${char}"]`).click();
  }
  // ③ 음은 저절로.
  await expect(page.locator("#soul-reading")).toHaveText("식매식매");

  // 2걸음 — 뜻은 내 말로 + 새기기. 예시 뜻이 채워져 있으니 그대로도, 고쳐도 된다.
  await expect(tutor).toHaveAttribute("data-soul-tutor-step", "forge");
  await expect(page.locator("#soul-tutor-title")).toContainText("뜻은 내 말로");
  await expect(page.locator("#soul-meaning-input")).toHaveValue(/먹고 자고/);

  await expect(page.getByTestId("soul-forge")).toBeEnabled();
  await page.getByTestId("soul-forge").click();
  await expect(page.locator("#soul-forge-fx-reading")).toHaveText("식매식매");
  await expect(page.locator("#soul-forge-fx")).toBeHidden({ timeout: 3_000 });
  await expect(page.locator("#soul-holdings-count")).toHaveText("0");

  // 3걸음 — 장착. 갈피를 옮기면 링이 카드의 [장착]으로 간다.
  await expect(tutor).toHaveAttribute("data-soul-tutor-step", "equip");
  await page.getByTestId("soul-tab-equip").click();
  await page.locator("[data-soul-equip]").first().click();
  await expect(tutor).toBeHidden();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), TUTOR_KEY)).toBe("1");

  // ④ 다시 열어도 안내는 서지 않고, 자혼도 다시 오지 않는다.
  await page.locator("#soul-close").click();
  await page.reload();
  await page.getByTestId("soul-archive-open").click();
  await expect(page.locator("#soul-dialog")).toBeVisible();
  await expect(tutor).toBeHidden();
  await expect(page.locator("#soul-holdings-count")).toHaveText("0");
  await expect(page.locator(".soul-card")).toHaveCount(1);
});

test("이미 자혼을 넷 이상 지녔으면 자혼을 더 주지 않는다", async ({ page }) => {
  await page.addInitScript((key) => {
    if (window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, JSON.stringify({ version: 1, souls: { 天: 5 }, idioms: [], equipped: [] }));
    }
  }, "hanja-td:soul-archive-v1");
  await page.goto("/?seed=SOUL-TUTOR-2");
  await page.getByTestId("soul-archive-open").click();
  await expect(page.locator("#soul-holdings-count")).toHaveText("5");
  // 안내는 선다 — 재료가 있으니 가르칠 수 있다.
  await expect(page.getByTestId("soul-tutor")).toBeVisible();
  await page.getByTestId("soul-tutor-skip").click();
  await expect(page.getByTestId("soul-tutor")).toBeHidden();
});
