/*
 * 야생 자령의 글자가 조판 규칙 안에 있는가 (v042).
 *
 * 한 웨이브는 한 글자이고 그 글자가 적의 몸에 찍혀 나온다 — 100웨이브면 화면
 * 한가운데서 99자를 만나는, 이 게임에서 가장 큰 학습 통로다. 그런데 그 글자만
 * 조판 규칙 밖에 서 있었다. 아군 글자는 보호를 넷 받는데(한자 강조 존중 · 역보정 ·
 * 안전 영역 · 라벨 등록) 적 글자는 하나도 못 받았다.
 *
 * **이 자리를 볼 수 있는 게이트가 없었다.** 봇은 화면을 안 만지고, v041 잘림 검사는
 * DOM 만 보며(`grep canvas e2e/no-clipped-text.spec.ts` 0건), 무대 라벨 계측(track-w)은
 * stage-labels 에 등록된 것만 센다 — 적 명패는 어디에도 등록되지 않는다. 그래서
 * 캔버스가 스스로 프레임마다 수를 적고(`data-enemy-plate-draw`) 여기서 그 수를 읽는다.
 */
import { expect, test, type Page } from "@playwright/test";

async function openCombat(page: Page, seed: string): Promise<void> {
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
  await page.getByTestId("early-wave").click({ force: true });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
        const ctx = (typeof handle === "function" ? (handle as () => { engine: { state: { enemies: unknown[] } } })() : handle) as { engine: { state: { enemies: unknown[] } } };
        return ctx.engine.state.enemies.length;
      }), { timeout: 30_000 })
    .toBeGreaterThan(0);
}

const plateCount = (page: Page): Promise<number> =>
  page.evaluate(() => Number(document.querySelector<HTMLCanvasElement>("#battle-canvas")?.dataset.enemyPlateDraw ?? "-1"));

test("전장에 선 적마다 그 글자가 함께 선다", async ({ page }) => {
  await openCombat(page, "ENEMY-PLATE");
  await expect.poll(async () => plateCount(page), { timeout: 15_000 }).toBeGreaterThan(0);
});

test("한자 강조 OFF 가 적 글자도 숨긴다 — 화면이 약속한 그대로", async ({ page }) => {
  /*
   * 이것이 이 손질의 정직 부분이다. `한자 강조 OFF` 는 「머리 위 표찰 숨김」이라고
   * 말하는데(battle/camera.ts), 여태 아군 명패만 숨기고 적 글자는 최대 307개까지
   * 그대로 세워 뒀다 — `drawEnemy` 에 `ctx.hanjaEmphasis` 참조가 **0건**이었다.
   */
  await openCombat(page, "ENEMY-PLATE-OFF");
  await expect.poll(async () => plateCount(page), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => { hanjaEmphasis: boolean })() : handle) as { hanjaEmphasis: boolean };
    ctx.hanjaEmphasis = false;
  });
  await expect.poll(async () => plateCount(page), { timeout: 10_000 }).toBe(0);
});

test("아래 안전 띠를 지나는 글자는 몸 위로 뒤집힌다", async ({ page }) => {
  /*
   * 이 시험을 두 번 다시 썼다.
   *
   * ① 처음에는 「배율을 바꿔도 글자 폭이 같다」를 쟀는데, 캔버스에 `scale(z)` 뒤
   *    `scale(1/z)` 를 걸어 재는 꼴이라 **자명하게 늘 참**이었다.
   * ② 다음에는 아래 띠에서 명패 색 픽셀을 셌는데, 뒤집기를 꺼도 **그대로 통과했다** —
   *    한 시드 40프레임 안에서는 적이 그 자리를 안 지난다. 못 잡는 게이트다.
   *
   * 그래서 **그 상황을 만든다.** 사람이 지도를 끌어 내리면 노선이 아래 띠로 들어가는데,
   * 그것이 실측된 결함(1~5웨이브 나쁜 경우의 14.9%가 아래 칩 띠)이 나는 자리다.
   * 카메라를 내리고 ⓐ 규칙이 실제로 걸렸는지(뒤집힌 수) ⓑ 그 결과 띠가 비었는지
   * (명패 라벤더 픽셀 0) 를 함께 잰다. 뒤집기를 끄면 ⓐ 가 0 이 되어 붉어진다.
   */
  await openCombat(page, "ENEMY-PLATE-BAND");
  await expect.poll(async () => plateCount(page), { timeout: 15_000 }).toBeGreaterThan(0);

  // 지도를 끌어 내려 노선을 아래 띠에 걸친다 — 사람이 실제로 하는 조작이다.
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => { mapOffset: { x: number; y: number } })() : handle) as { mapOffset: { x: number; y: number } };
    ctx.mapOffset.y += 620;
  });

  const seen = await page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>("#battle-canvas");
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context) return { flips: -1, lavender: -1 };
    const bandTop = canvas.height - 44;
    let flips = 0;
    let lavender = 0;
    for (let frame = 0; frame < 90; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      flips = Math.max(flips, Number(canvas.dataset.enemyPlateFlip ?? "0"));
      const band = context.getImageData(0, bandTop, canvas.width, 44).data;
      for (let index = 0; index < band.length; index += 4) {
        const r = band[index] as number;
        const g = band[index + 1] as number;
        const b = band[index + 2] as number;
        // 명패 테의 라벤더 — 전장에서 이 색을 쓰는 것이 이것 하나다.
        if (r > 150 && r < 225 && g > 120 && g < 195 && b > 215) lavender += 1;
      }
    }
    return { flips, lavender };
  });

  // ⓐ 규칙이 실제로 걸렸다 — 이 줄이 뒤집기를 끄면 붉어지는 자리다.
  expect(seen.flips).toBeGreaterThan(0);
  // ⓑ 그래서 띠가 비었다.
  expect(seen.lavender).toBe(0);
});
