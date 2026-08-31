/*
 * 획순 자료가 늦게 올 때 화면이 무엇을 말하는가.
 *
 * 배포 뒤 들어온 제보다 — "원격 획순 로딩 느려서 획순아닌 모드 보이거나 다른
 * 패널 버튼 눌렀다 오면 사라지는 버그 있어".
 *
 * 파 보니 버그는 하나가 아니라 **셋이 같은 얼굴을 하고 있었다.**
 *  ① 자료를 부적 탭을 열 때 받아서, 느린 회선에서는 그 사이가 맨 종이였다.
 *  ② 한국 명단 1000자 중 20자(2%)는 자료가 없어 영구히 안내가 못 선다 —
 *     쉰 장에 한 번꼴이라 "가끔 사라진다"로 읽혔다.
 *  ③ 받는 동안 한 획이라도 쓰면 그 장은 끝까지 맨 종이로 남았다.
 *
 * 셋 다 화면에는 똑같이 「반투명 글자 한 장」으로만 보였다. 그래서 이 스펙이
 * 지키는 것은 **화면이 까닭을 말하는가**이다.
 */
import { expect, test, type Page } from "@playwright/test";

interface Guide { available: boolean; current: number; total: number; finished: boolean }
type QA = { strokeGuide: () => Guide; currentChar: () => string | null; present: (c: string) => boolean };

const guide = (page: Page): Promise<Guide> =>
  page.evaluate(() => (window as unknown as { __HANJA_TALISMAN_QA__: QA }).__HANJA_TALISMAN_QA__.strokeGuide());

async function openRun(page: Page, delayMs: number | null): Promise<void> {
  if (delayMs !== null) {
    await page.route("**/data/hanzi-stroke-glyphs-v1.json", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await route.continue();
    });
  }
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
  });
  await page.goto("/?seed=LOADING-E2E&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".resource-grid")).toBeVisible();
}

async function drawOneStroke(page: Page): Promise<void> {
  const box = (await page.locator("#talisman-ink").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4);
  await page.mouse.up();
}

test("받는 중에는 받는 중이라고 말하고, 오면 그 자리에서 선다", async ({ page }) => {
  test.setTimeout(120_000);
  await openRun(page, 6000);
  await page.locator("#talisman-tab").click();
  await expect(page.locator("#talisman-paper")).toBeVisible();

  // 맨 종이를 말없이 보여 주던 자리 — 이제 까닭을 적는다.
  await expect(page.locator("#talisman-status")).toContainText("받는 중");
  expect((await guide(page)).available).toBe(false);

  await expect(page.locator("#talisman-status")).toContainText("붉은 점선", { timeout: 20_000 });
  expect((await guide(page)).available).toBe(true);
});

test("자료가 있는 글자를 골라, 안내가 쉰 장에 한 번씩 사라지지 않는다", async ({ page }) => {
  test.setTimeout(180_000);
  await openRun(page, null);
  await page.locator("#talisman-tab").click();
  await expect(page.locator("#talisman-status")).toContainText("붉은 점선", { timeout: 20_000 });

  /*
   * 한국 명단의 2% 는 자료가 없다. 예전에는 그 글자가 그대로 나와 안내가 통째로
   * 빠졌다 — 스무 장을 넘겨 한 번도 안 빠지는지 본다.
   */
  for (let sheet = 0; sheet < 20; sheet += 1) {
    await page.locator("#talisman-redraw").click();
    await page.waitForTimeout(120);
    const state = await guide(page);
    expect(state.available, `${sheet + 1}번째 종이에서 안내가 빠졌다`).toBe(true);
    expect(state.total).toBeGreaterThan(0);
  }
});

test("받는 동안 이미 썼으면, 준비됐다고 알리고 [지우기] 로 세운다", async ({ page }) => {
  test.setTimeout(120_000);
  await openRun(page, 5000);
  await page.locator("#talisman-tab").click();
  await expect(page.locator("#talisman-status")).toContainText("받는 중");

  // 자료가 오기 전에 한 획 쓴다 — 쓴 것을 지우면서까지 종이를 갈지는 않는다.
  await drawOneStroke(page);
  await page.waitForTimeout(9000);
  expect((await guide(page)).available).toBe(false);

  // 대신 눈이 있는 자리(패널 안)에서 준비됐다고 알린다.
  await expect(page.locator("#panel-toast")).toContainText("획순 안내가 준비됐습니다");

  // 비우면 그 자리에서 선다.
  await page.getByTestId("talisman-clear").click();
  await page.waitForTimeout(300);
  expect((await guide(page)).available).toBe(true);
  await expect(page.locator("#talisman-status")).toContainText("붉은 점선");
});

test("자료를 못 받으면 그렇다고 적고, 판은 계속 굴러간다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/data/hanzi-stroke-glyphs-v1.json", (route) => route.abort());
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
  });
  await page.goto("/?seed=LOADING-FAIL&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".resource-grid")).toBeVisible();
  await page.locator("#talisman-tab").click();

  await expect(page.locator("#talisman-status")).toContainText("받지 못했습니다", { timeout: 20_000 });
  // 안내만 못 설 뿐, 글자 한 장으로 부적은 그대로 쓸 수 있다.
  await drawOneStroke(page);
  await expect(page.locator("#talisman-submit")).toBeEnabled();
});
