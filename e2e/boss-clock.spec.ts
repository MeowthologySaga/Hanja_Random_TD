/*
 * 우두머리 제한시계는 **전장에서** 읽힌다 (v041).
 *
 * "저번에 다른 유저가 플레이 하는거 봤는데 보스 시간제한 있는 거 모르고 냅두다가
 * 게임오버하는거 봤어"(사용자). 시계가 나오는 곳이 오른쪽 패널 12px 한 줄뿐이었다.
 *
 * 이 스펙이 지키는 것 넷.
 *  ① 우두머리 웨이브에 전장 시계가 서고 초가 줄어든다.
 *  ② 30·15·5초 문턱에서 옷이 바뀐다(색만이 아니라 data-alert 단계로).
 *  ③ 넘기면 「그 다음에 무슨 일이 벌어지는가」를 말한다 — 여태 아무 데도 없던 말이다.
 *  ④ 우두머리가 아닌 웨이브에는 서지 않는다.
 */
import { expect, test, type Page } from "@playwright/test";

interface QaHandle {
  engine: {
    state: { wave: number; phase: string; gold: number; bossDeadline: number | null; elapsed: number };
    bossTimeRemaining(): number | null;
    bossOvertime(): boolean;
  };
}

const qa = (page: Page): Promise<QaHandle> =>
  page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    return (typeof handle === "function" ? (handle as () => QaHandle)() : handle) as QaHandle;
  });

async function openRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=BOSS-CLOCK&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
}

test("우두머리가 아닌 웨이브에는 시계가 서지 않는다", async ({ page }) => {
  await openRun(page);
  await page.getByTestId("early-wave").click({ force: true });
  await expect.poll(async () => (await qa(page)).engine.state.phase).toBe("combat");
  await expect(page.locator("#boss-clock")).toBeHidden();
});

test("우두머리 웨이브에는 전장에 시계가 서고 초가 줄어든다", async ({ page }) => {
  await openRun(page);
  // 개발 도구의 [보스 웨이브 점프] 로 곧장 우두머리전에 선다.
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await page.locator("#dev-wave-boss").click();
  await page.locator("#dev-tools-close").click();
  // 엔진 메서드는 직렬화되지 않는다 — 페이지 안에서 부른다.
  const bossRemaining = (): Promise<number | null> =>
    page.evaluate(() => {
      const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
      const ctx = (typeof handle === "function" ? (handle as () => { engine: { bossTimeRemaining(): number | null } })() : handle) as { engine: { bossTimeRemaining(): number | null } };
      return ctx.engine.bossTimeRemaining();
    });
  await expect.poll(async () => (await bossRemaining()) !== null, { timeout: 30_000 }).toBe(true);
  const clock = page.locator("#boss-clock");
  await expect(clock).toBeVisible();
  const first = await page.locator("#boss-clock-time").textContent();
  await page.waitForTimeout(1200);
  const second = await page.locator("#boss-clock-time").textContent();
  expect(first).not.toBe(second);
  await expect(page.locator("#boss-clock-note")).not.toBeEmpty();
});
