/*
 * 부활 부적 — 판이 끝나는 자리의 마지막 한 장(기획안 v035 ⑤).
 *
 * "게임 오버 될 때도 부적쓰기 매커니즘으로 1회 부활할수 있게 하자"(사용자).
 *
 * 이 스펙이 지키는 것 넷.
 *  ① 지면 종료 화면보다 **부적지가 먼저** 선다.
 *  ② 다 쓰면 판이 이어지고, 진 까닭에 맞는 값을 돌려받는다.
 *  ③ **판당 한 번** — 두 번째 패배에는 안 뜬다.
 *  ④ 포기하면 곧바로 종료 화면으로 간다.
 */
import { expect, test, type Page } from "@playwright/test";

interface RevivalQaWindow {
  __HANJA_CTX_QA__: {
    engine: {
      state: { phase: string; enemies: unknown[]; revivalUsed: boolean; defeatCause: string | null; wave: number };
    };
  };
  __HANJA_TALISMAN_QA__: { autoTrace(): void; submit(): void };
}

const qa = (page: Page): Promise<RevivalQaWindow["__HANJA_CTX_QA__"]["engine"]["state"]> =>
  page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => RevivalQaWindow["__HANJA_CTX_QA__"])() : handle) as RevivalQaWindow["__HANJA_CTX_QA__"];
    const { phase, enemies, revivalUsed, defeatCause, wave } = ctx.engine.state;
    return { phase, enemies: enemies.length as unknown as unknown[], revivalUsed, defeatCause, wave };
  }) as never;

test.beforeEach(async ({ page }) => {
  /*
   * QA 자동 따라쓰기는 마스크의 가로줄을 훑을 뿐 획순을 따르지 않아, 획순 안내를
   * 켠 채로는 그 붓질이 판정에 떨어져 스스로 걷힌다. 여기서는 안내를 끈다.
   */
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:stroke-order-guide", "false");
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
});

/** 적 한계로 진 자리를 만든다 — 개발 손잡이로 전장을 채우고 한 칸을 더 민다. */
async function loseByEnemyLimit(page: Page, seed: string): Promise<void> {
  await page.goto(`/?seed=${seed}&mode=standard`);
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.getByTestId("summon-button").click();
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => any)() : handle) as any;
    ctx.engine.startWaveEarly();
  });
  await expect.poll(async () => (await qa(page)).phase).toBe("combat");
  // 본을 뜰 적이 한 체는 있어야 한다 — 빈 전장에서 뜬 본은 체력이 없어 곧 걷힌다.
  await expect.poll(async () => (await qa(page)).enemies as unknown as number).toBeGreaterThan(0);
  await fillToLimit(page, 90_000);
  await expect.poll(async () => (await qa(page)).phase, { timeout: 15_000 }).toBe("defeat");
}

/** 전장을 한계까지 채운다 — 80체에 닿는 순간이 패배 지점이다. */
async function fillToLimit(page: Page, idBase: number): Promise<void> {
  await page.evaluate((base) => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => any)() : handle) as any;
    const engine = ctx.engine;
    const seed = engine.state.enemies[0];
    let index = 0;
    while (engine.state.enemies.length < 80) {
      engine.state.enemies.push({ ...seed, id: base + index, progress: (index % 90) / 100 });
      index += 1;
    }
  }, idBase);
}

test("지면 종료 화면보다 부적지가 먼저 선다", async ({ page }) => {
  test.setTimeout(120_000);
  await loseByEnemyLimit(page, "REVIVE-SHOW");
  await expect(page.locator("#revival-overlay")).toHaveClass(/modal-layer--visible/);
  await expect(page.locator("#end-overlay")).not.toHaveClass(/modal-layer--visible/);
  // 종이가 이 카드 안으로 옮겨 와 있어야 한다 — 늘 쓰던 그 종이다.
  await expect(page.locator("#revival-paper-slot #talisman-paper")).toBeVisible();
  await expect(page.locator("#revival-message")).toContainText("절반");
  // [다시 뽑기]는 접어 둔다 — 가장 어려운 글자로 세운 뜻이 사라지므로.
  await expect(page.locator("#revival-paper-slot #talisman-redraw")).toBeHidden();
});

test("다 쓰면 판이 이어지고 전장의 적 절반이 걷힌다", async ({ page }) => {
  test.setTimeout(120_000);
  await loseByEnemyLimit(page, "REVIVE-WRITE");
  await expect(page.locator("#revival-overlay")).toHaveClass(/modal-layer--visible/);
  const before = await qa(page);
  expect(before.enemies as unknown as number).toBe(80);

  await page.evaluate(() => {
    const qaHandle = (window as unknown as RevivalQaWindow).__HANJA_TALISMAN_QA__;
    qaHandle.autoTrace();
    qaHandle.submit();
  });

  await expect.poll(async () => (await qa(page)).phase, { timeout: 15_000 }).toBe("combat");
  const after = await qa(page);
  expect(after.enemies as unknown as number).toBe(40);
  expect(after.revivalUsed).toBe(true);
  // 부적지는 걷히고 종이는 제자리로 돌아간다.
  await expect(page.locator("#revival-overlay")).not.toHaveClass(/modal-layer--visible/, { timeout: 15_000 });
  await expect(page.locator("#talisman-panel #talisman-paper")).toHaveCount(1);
});

test("붓을 들면 시계가 멈춘다 — 스물아홉 획을 20초에 쓰라고 할 수는 없다", async ({ page }) => {
  test.setTimeout(120_000);
  await loseByEnemyLimit(page, "REVIVE-CLOCK");
  await expect(page.locator("#revival-overlay")).toHaveClass(/modal-layer--visible/);
  await expect(page.locator("#revival-countdown")).toBeVisible();

  // 붓을 한 번 댄다 — 이 화면의 시계는 난이도가 아니라 「안 쓸 사람의 대답」이다.
  const ink = page.locator("#talisman-ink");
  const box = await ink.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.up();

  await expect(page.locator("#revival-status")).toContainText("시간은 세지 않습니다");
  // 20초가 지나도 결과로 넘어가지 않는다.
  await page.waitForTimeout(3_000);
  await expect(page.locator("#revival-overlay")).toHaveClass(/modal-layer--visible/);
  await expect(page.locator("#end-overlay")).not.toHaveClass(/modal-layer--visible/);
});

test("판당 한 번 — 두 번째 패배에는 안 뜬다", async ({ page }) => {
  test.setTimeout(120_000);
  await loseByEnemyLimit(page, "REVIVE-ONCE");
  await page.evaluate(() => {
    const qaHandle = (window as unknown as RevivalQaWindow).__HANJA_TALISMAN_QA__;
    qaHandle.autoTrace();
    qaHandle.submit();
  });
  await expect.poll(async () => (await qa(page)).phase, { timeout: 15_000 }).toBe("combat");
  await expect(page.locator("#revival-overlay")).not.toHaveClass(/modal-layer--visible/, { timeout: 15_000 });

  // 다시 한계까지 민다.
  await fillToLimit(page, 95_000);
  await expect.poll(async () => (await qa(page)).phase, { timeout: 15_000 }).toBe("defeat");
  await expect(page.locator("#end-overlay")).toHaveClass(/modal-layer--visible/);
  await expect(page.locator("#revival-overlay")).not.toHaveClass(/modal-layer--visible/);
});

test("포기하면 곧바로 결과로 간다", async ({ page }) => {
  test.setTimeout(120_000);
  await loseByEnemyLimit(page, "REVIVE-DECLINE");
  await expect(page.locator("#revival-overlay")).toHaveClass(/modal-layer--visible/);
  await page.locator("#revival-give-up").click();
  await expect(page.locator("#end-overlay")).toHaveClass(/modal-layer--visible/);
  await expect(page.locator("#revival-overlay")).not.toHaveClass(/modal-layer--visible/);
  // 안 썼으므로 한 장은 그대로 남는다 — 이 판은 이미 끝났지만 규칙은 규칙이다.
  expect((await qa(page)).revivalUsed).toBe(false);
  // 종이는 제자리로 돌아간다.
  await expect(page.locator("#talisman-panel #talisman-paper")).toHaveCount(1);
});
