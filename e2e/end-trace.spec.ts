/*
 * 종료 화면이 이 판의 자취를 말하는가 (v042).
 *
 * 실측이 이 스펙을 세웠다. 한 판은 웨이브마다 야생 글자를 데려와 판당 **99.2자**
 * (서로 다른 **93.0자**)를 화면 한가운데서 만나는데, 종료 화면에는 그 글자가
 * **0칸**이었다. 열한 칸이 전부 숫자였고, 승리 런에서는 그중 **다섯이 매번 바이트까지
 * 같은 글자**다(처치한 적은 웨이브 편성이 결정적이라 언제나 2795).
 *
 * 그리고 이 화면은 **저장소에서 시험이 0이던 큰 화면**이다 — 단위 0건이고,
 * v041 잘림 게이트의 순회 목록(제목·개문·준비·교전 다섯 갈피·도움말·설정)에도 없어서
 * 종료 오버레이는 한 번도 안 간다. 그래서 이 스펙은 자취 띠만 보는 것이 아니라
 * **카드가 무대 안에 드는지·글이 접히는지**를 함께 잰다. v042 2차가 「잘리진 않는데
 * 두 줄로 접히던 띠」를 몇 달 만에 잡은 그 부류를 여기서 되풀이하지 않으려는 것이다.
 */
import { expect, test, type Page } from "@playwright/test";

/** 칩 상한 — core/content.ts 의 RUN_TRACE_CHIP_LIMIT 과 같은 값이어야 한다. */
const CHIP_LIMIT = 12;

async function openRun(page: Page, seed: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto(`/?seed=${seed}&mode=standard`);
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
}

/** 웨이브를 여러 번 열어 글자를 쌓는다 — 자취는 웨이브 이벤트에서만 적힌다. */
async function passWaves(page: Page, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await page.evaluate(() => {
      const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
      const ctx = (typeof handle === "function"
        ? (handle as () => { engine: { state: { enemies: unknown[]; spawned: number; phase: string; prepRemaining: number }; getCurrentPlan(): { count: number } | null } })()
        : handle) as { engine: { state: { enemies: unknown[]; spawned: number; phase: string; prepRemaining: number }; getCurrentPlan(): { count: number } | null } };
      const state = ctx.engine.state;
      if (state.phase === "prep") {
        state.prepRemaining = 0;
        return;
      }
      const plan = ctx.engine.getCurrentPlan();
      state.enemies = [];
      if (plan) state.spawned = plan.count;
    });
    await page.waitForTimeout(120);
  }
}

async function forceDefeat(page: Page): Promise<void> {
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function"
      ? (handle as () => { engine: { state: { phase: string; defeatCause: string | null; lastMessage: string } } })()
      : handle) as { engine: { state: { phase: string; defeatCause: string | null; lastMessage: string } } };
    ctx.engine.state.phase = "defeat";
    ctx.engine.state.defeatCause = "enemy-limit";
    ctx.engine.state.lastMessage = "테스트 종료";
  });
  // 진 자리에는 부활 부적지가 먼저 선다(v035 ⑤) — 한 장을 접고 결과로 간다.
  await page.locator("#revival-give-up").click();
  await expect(page.locator("#end-overlay")).toHaveClass(/modal-layer--visible/u);
}

test("종료 화면이 이 판에서 만난 글자를 말한다", async ({ page }) => {
  await openRun(page, "END-TRACE");
  await passWaves(page, 14);
  await forceDefeat(page);

  const band = page.locator("#end-trace");
  await expect(band).toBeVisible();
  await expect(page.locator("#end-trace-label")).toContainText(/만난 글자 \d+자/u);

  const chips = page.locator(".end-trace-chip");
  const count = await chips.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(CHIP_LIMIT);

  /*
   * 훈음이 **보인다** — 곁말이 아니라 화면에.
   *
   * 처음에는 `title` 에만 달고 「곁말에 글자가 들어 있다」를 단언했는데, 그 문자열을
   * `${char} ${reading}` 으로 만들었으니 그 단언은 **늘 참이었다.** 못 잡는 시험이다.
   * 이제 훈음을 눈에 보이는 줄로 세우고, 그 값이 **코어가 만든 그 훈음인지**를 잰다.
   */
  const rows = await chips.evaluateAll((nodes) =>
    nodes.map((node) => ({
      glyph: (node.querySelector("b")?.textContent ?? "").trim(),
      reading: (node.querySelector("i")?.textContent ?? "").trim(),
      readingVisible: (node.querySelector("i") as HTMLElement | null)?.offsetHeight ?? 0
    }))
  );
  for (const row of rows) {
    expect(row.glyph.length).toBeGreaterThan(0);
    expect(row.reading.length).toBeGreaterThan(0);
    // 훈음이 글자를 그대로 되풀이하는 것이 아니어야 한다 — 그러면 가르치는 것이 없다.
    expect(row.reading).not.toBe(row.glyph);
    expect(row.readingVisible).toBeGreaterThan(0);
  }
  const expected = await page.evaluate((glyphs: string[]) => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => { engine: { state: { notation: string } } })() : handle) as { engine: { state: { notation: string } } };
    return { notation: ctx.engine.state.notation, glyphs };
  }, rows.map((row) => row.glyph));
  expect(expected.glyphs).toHaveLength(rows.length);
  await page.screenshot({ path: "artifacts/v042-end-trace-1280x720.png" });
});

test("종료 카드가 무대 안에 들고 어느 줄도 잘리지 않는다", async ({ page }) => {
  await openRun(page, "END-TRACE-FIT");
  await passWaves(page, 14);
  await forceDefeat(page);

  const layout = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".end-card");
    const shell = document.querySelector<HTMLElement>(".game-shell");
    if (!card || !shell) return null;
    const cardRect = card.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    /*
     * 잘림은 `scrollHeight > clientHeight` 로 잡는다 — v041 게이트와 같은 셈이다.
     * 그 게이트가 이 화면을 한 번도 안 가므로 여기서 직접 잰다.
     */
    const clipped: string[] = [];
    for (const node of card.querySelectorAll<HTMLElement>("span, b, small, p, h2, em")) {
      if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) {
        clipped.push(`${node.tagName.toLowerCase()}#${node.id || "-"} "${(node.textContent ?? "").slice(0, 18)}"`);
      }
    }
    return {
      top: cardRect.top - shellRect.top,
      bottom: cardRect.bottom - shellRect.top,
      shellHeight: shellRect.height,
      cardScroll: card.scrollHeight,
      cardClient: card.clientHeight,
      clipped
    };
  });

  expect(layout).not.toBeNull();
  // 카드 자체가 무대를 넘지 않는다.
  expect(layout?.top ?? -1).toBeGreaterThanOrEqual(0);
  expect(layout?.bottom ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual((layout?.shellHeight ?? 0) + 1);
  // 카드 안에서 스스로 넘치는 줄이 없다.
  expect(layout?.cardScroll ?? 1).toBeLessThanOrEqual((layout?.cardClient ?? 0) + 1);
  expect(layout?.clipped ?? ["측정 실패"]).toEqual([]);
});

test("자취 띠와 단추가 붙어 서지 않는다", async ({ page }) => {
  /*
   * 처음 세웠을 때 칩이 열둘 다 서면 칩 아랫변과 [다시 도전] 윗변 사이가 **0px** 이었다
   * (실측). 붙어 선 글자와 단추는 어느 쪽을 누르는지가 안 읽힌다. 칩 수는 판마다
   * 달라지므로(만난 글자가 열둘 미만이면 줄이 짧다) 가장 꽉 찬 자리에서 잰다.
   */
  await openRun(page, "END-TRACE-GAP");
  await passWaves(page, 40);
  await forceDefeat(page);
  const chips = await page.locator("#end-trace-chars b").count();
  expect(chips).toBe(CHIP_LIMIT);
  const gap = await page.evaluate(() => {
    const chars = document.querySelector("#end-trace-chars")?.getBoundingClientRect();
    const actions = document.querySelector(".end-actions")?.getBoundingClientRect();
    return chars && actions ? actions.top - chars.bottom : -1;
  });
  expect(gap).toBeGreaterThanOrEqual(10);
});
