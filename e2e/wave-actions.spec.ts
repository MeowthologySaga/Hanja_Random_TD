/*
 * 읽을 것은 전장 위로, 누를 것은 패널로 (v036).
 *
 * "부적 집중하는동안 그곳 패널 밖에 신경 못쓰니까 다음웨이브 진행 버튼등
 * 패널쪽에 배치하라고 했는데 안했어"(사용자). 배치가 정확히 반대였다 —
 * 읽을 것이 패널에, 누를 것이 전장 위에 있었다.
 *
 * 이 스펙이 지키는 것 다섯.
 *  ① 「장 N / 10」 칩은 사라졌다.
 *  ② 그 자리에 **무엇이 오는가**(적 이름 · 약점)가 선다.
 *  ③ 웨이브를 여는 단추가 **패널 안**에 있고, 눌리면 실제로 웨이브가 열린다.
 *  ④ 상황에 따라 권하는 것이 곁에 선다 — 급한 것이 위다.
 *  ⑤ 띠가 부풀어 전장을 밀지 않는다.
 */
import { expect, test, type Page } from "@playwright/test";

interface QaHandle {
  engine: { state: { phase: string; gold: number; enemies: unknown[]; summonCount: number } };
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
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=WAVE-ACTIONS&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
}

test("「장 N / 10」 칩은 사라지고 그 자리에 무엇이 오는가가 선다", async ({ page }) => {
  await openRun(page);
  /*
   * 장 번호는 화면이 두 번 말하던 것이다 — 웨이브 칩의 분자로도 나오고 브리핑
   * 문자열에도 「제N장」이 들어 있다. 95px 을 그런 데 쓸 자리가 아니었다.
   */
  await expect(page.locator("#stage-chapter")).toHaveCount(0);
  await expect(page.locator(".stage-chip--chapter")).toHaveCount(0);

  const info = page.locator(".stage-chip--wave-info");
  await expect(info).toBeVisible();
  await expect(info.locator("#wave-label")).toBeVisible();
  /*
   * 첫 소환 전에는 「할 일」을 여기서 말하지 않는다(v037) — 같은 문장이 상단 띠·
   * 패널 카드·패널 맨 아래 줄 세 군데에 서 있었다. 이 칩은 짧게 「대기」만 하고,
   * 웨이브가 없으니 약점 인장도 감춘다.
   */
  await expect(info.locator("#wave-label")).toHaveText("첫 소환 대기");
  await expect(info.locator("#wave-weakness")).toBeHidden();

  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
  await expect(info.locator("#wave-weakness")).toBeVisible();
  // 약점은 그 오행의 색으로 선다 — 글자만으로는 훑을 때 안 걸린다.
  const painted = await info.locator("#wave-weakness").evaluate((element) => getComputedStyle(element).color);
  expect(painted).not.toBe("rgb(0, 0, 0)");
});

test("띠는 전장을 밀지 않는다", async ({ page }) => {
  await openRun(page);
  /*
   * 브리핑까지 띠로 올렸다가 띠가 41px 에서 72px 로 부풀어, 그 아래 웨이브
   * 진행 레일(56~65)과 전장 안전 영역(stage-labels.ts STAGE_SAFE_AREA.top 71)을
   * 통째로 밀어 냈다. 재어 보고 물린 자리라 그 실측을 여기 못 박는다.
   */
  const bottom = await page.locator(".stage-topbar").evaluate((element) => element.getBoundingClientRect().bottom);
  expect(bottom).toBeLessThanOrEqual(56);
});

test("웨이브를 여는 단추가 패널 안에 있고, 눌리면 웨이브가 열린다", async ({ page }) => {
  await openRun(page);
  await page.getByTestId("summon-button").click();
  // 소환 공개 연출이 막을 덮는다 — 걷어야 단추가 눌린다.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // 단추가 패널(오른쪽 400px) 안에 있어야 한다 — 전장 위가 아니라.
  const inPanel = await page.locator("#early-button").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const panel = document.querySelector(".control-panel")!.getBoundingClientRect();
    return rect.left >= panel.left - 1 && rect.right <= panel.right + 1;
  });
  expect(inPanel).toBe(true);
  await expect(page.locator("#wave-action-row #early-button")).toHaveCount(1);

  await expect.poll(async () => (await qa(page)).engine.state.phase).toBe("prep");
  /*
   * force 로 누른다. 코치마크·공개 연출 막이 패널 위를 덮고 있을 수 있어
   * 기존 스펙들(smoke·run-save·tutorial)도 이 단추만은 force 로 누른다.
   * 자리 검증은 위 inPanel 단언이 이미 했다.
   */
  await page.locator("#early-button").click({ force: true });
  await expect.poll(async () => (await qa(page)).engine.state.phase).toBe("combat");
});

test("곁자리는 상황에 따라 서고, 급한 것이 위다", async ({ page }) => {
  test.setTimeout(120_000);
  await openRun(page);
  // 첫 소환 전에는 권할 것이 없다 — 개문 안내가 이미 할 일을 말한다.
  await expect(page.getByTestId("wave-action-a")).toBeHidden();

  await page.getByTestId("summon-button").click();
  // 소환 공개 연출이 막을 덮는다 — 걷어야 단추가 눌린다.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  // 소환한 뒤에는 권할 것이 생긴다(부적 장수·소환·강화 가운데 둘).
  await expect(page.getByTestId("wave-action-a")).toBeVisible();

  /*
   * force 로 누른다. 코치마크·공개 연출 막이 패널 위를 덮고 있을 수 있어
   * 기존 스펙들(smoke·run-save·tutorial)도 이 단추만은 force 로 누른다.
   * 자리 검증은 위 inPanel 단언이 이미 했다.
   */
  await page.locator("#early-button").click({ force: true });
  await expect.poll(async () => (await qa(page)).engine.state.phase).toBe("combat");

  // 적 한계가 차오르면 그것이 첫 자리를 차지한다.
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await page.locator("#dev-enemy-fill").click();
  await expect
    .poll(async () => (await qa(page)).engine.state.enemies.length, { timeout: 20_000 })
    .toBeGreaterThan(56);
  await page.locator("#dev-tools-close").click();

  const first = page.getByTestId("wave-action-a");
  await expect(first).toContainText("적 한계");
  await expect(first).toHaveAttribute("data-tone", "urgent");
});

test("부적 갈피를 열어도 급한 것은 카드에서 보인다", async ({ page }) => {
  /*
   * v041 에서 부적지 아래 「시선 자리 행동 줄」(#talisman-cue)을 걷었다. 그 줄이
   * 지키던 규범 — 「눈이 부적에 있을 때도 급한 것이 눈에 든다」 — 은 사라지지
   * 않는다. 웨이브 카드가 갈피와 상관없이 늘 서 있으므로 그 카드가 맡는다.
   *
   * 걷은 까닭은 둘이었다. 그 줄은 카드와 **한 자도 다르지 않은** 문장을 400px
   * 떨어진 자리에 한 번 더 썼고, 서는 순간 `.context-deck`(368px)를 27px 넘겨
   * 제 아래 9px 과 그 밑 난이도 고지를 통째로 잘라 먹었다.
   */
  await openRun(page);
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
  // 맥동이 stable 판정을 막는다(run-save.spec 선례) — force 로 누른다.
    await page.getByTestId("early-wave").click({ force: true });
  await expect.poll(async () => (await qa(page)).engine.state.phase).toBe("combat");

  await page.locator('button[data-panel-tab="talisman"]').click();
  await expect(page.locator("#talisman-panel")).toBeVisible();
  // 걷어 낸 줄이 정말로 없다.
  await expect(page.locator("#talisman-cue")).toHaveCount(0);

  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await page.locator("#dev-enemy-fill").click();
  await expect
    .poll(async () => (await qa(page)).engine.state.enemies.length, { timeout: 20_000 })
    .toBeGreaterThan(56);
  await page.locator("#dev-tools-close").click();

  const first = page.getByTestId("wave-action-a");
  await expect(first).toBeVisible();
  await expect(first).toContainText("적 한계");
  await expect(first).toHaveAttribute("data-tone", "urgent");

  /*
   * 그리고 부적 패널이 더는 넘치지 않는다. 되찾은 자리는 v041 에서 **쉬운 뜻**이
   * 이어받았고(난이도 고지는 상태 줄의 곁말로 옮겼다), 그 자리도 넘치지 않는다.
   */
  const deck = await page.locator(".context-deck").evaluate((node) => node.scrollHeight - node.clientHeight);
  expect(deck).toBeLessThanOrEqual(0);
  await expect(page.locator("#talisman-easy-meaning")).toBeVisible();
});

test("행동 자리는 카드 틀을 넘지 않는다", async ({ page }) => {
  await openRun(page);
  await page.getByTestId("summon-button").click();
  // 소환 공개 연출이 막을 덮는다 — 걷어야 단추가 눌린다.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  /*
   * 카드는 376x82 로 못 박혀 있다(e2e/nineslice.spec.ts). 속을 갈아 끼우면서
   * 줄이 하나 늘면 단추가 테 밖으로 밀린다 — 실제로 석 줄을 넣었다가 시계와
   * 단추가 5px 겹쳤다.
   */
  const fits = await page.locator(".wave-card").evaluate((card) => {
    const box = card.getBoundingClientRect();
    const row = document.querySelector("#wave-action-row")!.getBoundingClientRect();
    const clock = document.querySelector("#wave-status-line")!.getBoundingClientRect();
    return {
      overflow: card.scrollHeight - card.clientHeight,
      rowInside: row.bottom <= box.bottom + 1 && row.top >= box.top - 1,
      noOverlap: clock.bottom <= row.top + 1
    };
  });
  expect(fits.overflow).toBeLessThanOrEqual(0);
  expect(fits.rowInside).toBe(true);
  expect(fits.noOverlap).toBe(true);
});
