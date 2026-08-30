/*
 * 획순 안내 — 선택 항목.
 *
 * 이 스펙이 지키는 것은 셋이다.
 *
 *  ① **기본은 그대로다.** "옵션으로 부가적으로 만들어두고 기본요소는 그대로
 *     둬"(사용자). 끄고 들어온 판의 부적지는 한 획도 달라지면 안 된다.
 *  ② 켜면 획이 순서대로 선다.
 *  ③ 안내는 **관문이 아니다.** 획을 다 안 그어도 채점만 통과하면 [부적 완성]은
 *     눌린다 — 안내를 통과 조건으로 만들면 자료 없는 글자(명단의 5.6%)에서
 *     부적을 아예 못 만들게 된다.
 */
import { expect, test, type Page } from "@playwright/test";

const COACH_KEY = "hanja-td:coach-seen-v1";
const TALISMAN_KEY = "hanja-td:talisman-mode";
const STROKE_KEY = "hanja-td:stroke-order-guide";

async function openTalisman(page: Page, strokeGuide: boolean): Promise<void> {
  await page.addInitScript(
    ([coach, talisman, stroke, on]) => {
      window.localStorage.setItem(coach as string, "1");
      window.localStorage.setItem(talisman as string, "true");
      window.localStorage.setItem(stroke as string, String(on));
    },
    [COACH_KEY, TALISMAN_KEY, STROKE_KEY, strokeGuide] as const
  );
  await page.goto("/?seed=STROKE-E2E&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".resource-grid")).toBeVisible();
  await page.locator("#talisman-tab").click();
  await expect(page.locator("#talisman-paper")).toBeVisible();
}

interface GuideState {
  available: boolean;
  current: number;
  total: number;
  finished: boolean;
}

const guideState = (page: Page): Promise<GuideState> =>
  page.evaluate(() => (window as unknown as {
    __HANJA_TALISMAN_QA__: { strokeGuide: () => GuideState };
  }).__HANJA_TALISMAN_QA__.strokeGuide());

/** 획순 자료가 있는 글자가 나올 때까지 다시 뽑는다. */
async function findGuidedChar(page: Page): Promise<GuideState> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await guideState(page);
    if (state.available) return state;
    await page.locator("#talisman-redraw").click();
    await page.waitForTimeout(120);
  }
  throw new Error("획순 자료가 있는 글자를 20번 안에 못 뽑았다");
}

test("꺼 두면 부적지는 여태 그대로다", async ({ page }) => {
  await openTalisman(page, false);
  // 안내 자료를 아예 받지 않는다 — 2.5MB 를 끈 사람에게 지울 이유가 없다.
  const requested = page.waitForRequest(/hanzi-stroke-medians/u, { timeout: 1500 }).catch(() => null);
  await page.waitForTimeout(900);
  expect(await requested).toBeNull();
  expect((await guideState(page)).available).toBe(false);
  await expect(page.locator("#talisman-status")).toHaveText("반투명 글자를 따라 쓰고 [부적 완성]");
});

test("켜면 획이 순서대로 서고, 그을 때마다 다음 획으로 넘어간다", async ({ page }) => {
  await openTalisman(page, true);
  const state = await findGuidedChar(page);
  expect(state.total).toBeGreaterThan(0);
  expect(state.current).toBe(0);
  await expect(page.locator("#talisman-status")).toContainText(`모두 ${state.total}획`);

  const traced = await page.evaluate(() => (window as unknown as {
    __HANJA_TALISMAN_QA__: { traceStroke: () => boolean };
  }).__HANJA_TALISMAN_QA__.traceStroke());
  expect(traced).toBe(true);
  expect((await guideState(page)).current).toBe(1);
});

test("[지우기] 는 안내도 첫 획으로 되감는다", async ({ page }) => {
  await openTalisman(page, true);
  await findGuidedChar(page);
  await page.evaluate(() => (window as unknown as {
    __HANJA_TALISMAN_QA__: { traceStroke: () => boolean };
  }).__HANJA_TALISMAN_QA__.traceStroke());
  expect((await guideState(page)).current).toBe(1);
  await page.locator("#talisman-clear").click();
  expect((await guideState(page)).current).toBe(0);
});

test("안내는 관문이 아니다 — 획을 다 안 그어도 채점만 통과하면 완성된다", async ({ page }) => {
  await openTalisman(page, true);
  const state = await findGuidedChar(page);
  await page.evaluate(() => (window as unknown as {
    __HANJA_TALISMAN_QA__: { autoTrace: () => void };
  }).__HANJA_TALISMAN_QA__.autoTrace());
  // 자동 따라쓰기는 마스크를 칠할 뿐 획순을 따르지 않는다.
  const after = await guideState(page);
  expect(after.current).toBeLessThan(state.total);
  await expect(page.locator("#talisman-submit")).toBeEnabled();
});
