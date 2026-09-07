/*
 * 판이 예외로 멈추면 화면이 그렇게 말하고, 판을 은행에 넣고, 손을 받아 낸다 (v042).
 *
 * 실측이 이 스펙을 세웠다. `#pause-chip` 을 지워 결함을 넣으면
 * `must() → syncPauseChip → frame` 으로 던지는데, 재스케줄이 프레임의 **마지막
 * 문장**이라 다음 프레임이 영영 안 걸린다 — 2.5초 동안 프레임 스케줄이 4119 에서
 * 한 번도 안 늘고 판이 71.8초에 섰다. 그런데 화면 신호는 0이었고, **얼어붙은 판이
 * 조작을 계속 먹었다**(소환 클릭 한 번에 엽전 52→45, 자령 4→5).
 *
 * 저장 구멍도 쟀다 — 봇 6시드에서 자동 저장 간격 **중앙 10.0초 · 최대 110.8초**.
 * 그만큼이 새로고침으로 날아갔다.
 *
 * 이 스펙은 **일부러 오류를 낸다.** 그래서 다른 스펙들이 쓰는
 * `expect(errors).toEqual([])` 규약을 여기서는 쓰지 않고, 반대로 오류가 **났는지**를
 * 확인한다 — try/catch 가 pageerror 를 삼키므로 console.error 가 안 나면 그 세 스펙이
 * 앞으로 프레임이 깨져도 초록으로 지나간다.
 */
import { expect, test, type Page } from "@playwright/test";

async function openRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=RUN-INTERRUPT&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
}

test("프레임이 깨지면 말하고, 저장하고, 손을 받는다", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await openRun(page);
  // 웨이브를 열어 저장할 지점을 만든다 — 그래야 「이어할 수 있다」가 참이 된다.
  await page.getByTestId("early-wave").click({ force: true });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
        const ctx = (typeof handle === "function" ? (handle as () => { engine: { state: { phase: string } } })() : handle) as { engine: { state: { phase: string } } };
        return ctx.engine.state.phase;
      })
    )
    .toBe("combat");

  const SAVE_KEY = "hanja-td:run-save-v1";
  // 첫 자동 저장이 실제로 앉을 때까지 기다린다 — 그 뒤라야 「이어할 수 있다」가 참이다.
  await expect
    .poll(async () => page.evaluate((key: string) => window.localStorage.getItem(key) !== null, SAVE_KEY), { timeout: 30_000 })
    .toBe(true);
  const before = await page.evaluate((key: string) => window.localStorage.getItem(key), SAVE_KEY);

  // 결함 주입 — 프레임이 매번 던지게 만든다.
  await page.evaluate(() => document.querySelector("#pause-chip")?.remove());

  const overlay = page.locator("#interrupt-overlay");
  await expect(overlay).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#interrupt-heading")).toHaveText(/멈췄습니다/u);
  // 저장된 판이므로 이어할 수 있다고 말해야 한다.
  await expect(page.locator("#interrupt-body")).toHaveText(/이어하기/u);

  /*
   * 판을 은행에 넣었다 — 그 자리에서 저장이 새로 써졌다.
   *
   * 이것이 이 고침의 요점이다. 저장은 여태 프레임 안(웨이브·준비 경계)에서만
   * 일어났고, 봇 6시드로 그 간격을 재면 중앙 10.0초 · 최대 110.8초다. 얼어붙은 뒤
   * 새로고침하면 그만큼을 잃었다.
   */
  const after = await page.evaluate((key: string) => window.localStorage.getItem(key), SAVE_KEY);
  expect(after).not.toBeNull();
  expect(after).not.toBe(before);

  /*
   * 소리를 냈다. 이것이 계약이다 — try/catch 가 pageerror 를 삼키므로, 여기서
   * console.error 가 안 나면 smoke·custom-idiom 스펙의 오류 단언이 눈멀게 된다.
   */
  expect(consoleErrors.some((text) => text.includes("[frame]"))).toBe(true);

  // 막이 손을 받는다 — 죽은 판이 더는 조작을 안 먹는다.
  const goldBefore = await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => { engine: { state: { gold: number } } })() : handle) as { engine: { state: { gold: number } } };
    return ctx.engine.state.gold;
  });
  await page.getByTestId("summon-button").click({ force: true, timeout: 3_000 }).catch(() => undefined);
  const goldAfter = await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => { engine: { state: { gold: number } } })() : handle) as { engine: { state: { gold: number } } };
    return ctx.engine.state.gold;
  });
  expect(goldAfter).toBe(goldBefore);

  // 막이 무대 안에 들고, 글이 잘리지 않는다.
  const box = await page.locator(".interrupt-card").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const stage = document.querySelector(".game-shell")?.getBoundingClientRect();
    const body = node.querySelector("#interrupt-body") as HTMLElement;
    return {
      top: rect.top - (stage?.top ?? 0),
      bottom: rect.bottom - (stage?.top ?? 0),
      stageHeight: stage?.height ?? 0,
      bodyScroll: body.scrollHeight,
      bodyClient: body.clientHeight
    };
  });
  expect(box.top).toBeGreaterThanOrEqual(-1);
  expect(box.bottom).toBeLessThanOrEqual(box.stageHeight + 1);
  expect(box.bodyScroll).toBeLessThanOrEqual(box.bodyClient + 1);
  await page.screenshot({ path: "artifacts/v042-run-interrupt-1280x720.png" });
});
