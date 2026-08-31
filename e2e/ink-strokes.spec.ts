/*
 * 먹 정리 — 되돌리기와 자동 정리.
 *
 * 여태 먹은 캔버스 한 장이라 획이라는 단위가 없었다. 한 획을 삐끗하면
 * 전체 지우기밖에 없었다("전체지우기 밖에 없는것도 문제" — 사용자).
 *
 * 이 스펙이 지키는 것 넷.
 *  ① 되돌리기는 **마지막 한 획만** 무른다(두 모드 모두).
 *  ② 안내 모드에서 되돌리면 **안내도 한 획 뒤로** 물린다 — 종이와 안내가
 *     어긋나면 다음에 무엇을 그어야 하는지가 거짓말이 된다.
 *  ③ 제대로 그은 획은 **정본 획으로 갈아 끼워** 종이가 깨끗하게 쌓인다.
 *  ④ 떨어진 붓질은 **스스로 걷힌다** — 남으면 결국 더러워져 원래 문제로 돌아간다.
 */
import { expect, test, type Page } from "@playwright/test";

interface Guide { available: boolean; current: number; total: number; finished: boolean }
type QA = { present: (c: string) => boolean; traceStroke: () => boolean; strokeGuide: () => Guide };

async function openTalisman(page: Page, guideOn: boolean): Promise<void> {
  await page.addInitScript((on) => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    window.localStorage.setItem("hanja-td:stroke-order-guide", String(on));
  }, guideOn);
  await page.goto("/?seed=INK&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".resource-grid")).toBeVisible();
  await page.locator("#talisman-tab").click();
  await expect(page.locator("#talisman-paper")).toBeVisible();
  if (guideOn) await page.waitForTimeout(2200);
}

const guideState = (page: Page): Promise<Guide> =>
  page.evaluate(() => (window as unknown as { __HANJA_TALISMAN_QA__: QA }).__HANJA_TALISMAN_QA__.strokeGuide());

/** 먹 캔버스에 남은 화소 수 — 획이 실제로 지워졌는지 눈이 아니라 수로 본다. */
const inkPixels = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#talisman-ink")!;
    const px = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    for (let i = 3; i < px.length; i += 4) if ((px[i] ?? 0) > 40) n += 1;
    return n;
  });

/** 화선지에 손으로 한 획 긋는다. */
async function drawLine(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const box = (await page.locator("#talisman-ink").boundingBox())!;
  const at = (p: [number, number]): { x: number; y: number } => ({
    x: box.x + (p[0] / 196) * box.width,
    y: box.y + (p[1] / 260) * box.height
  });
  const a = at(from);
  const b = at(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(a.x + (b.x - a.x) * (step / 12), a.y + (b.y - a.y) * (step / 12));
  }
  await page.mouse.up();
}

test("되돌리기는 마지막 한 획만 무른다 — 안내를 꺼도 된다", async ({ page }) => {
  await openTalisman(page, false);
  await expect(page.getByTestId("talisman-undo")).toBeDisabled();

  await drawLine(page, [40, 80], [150, 80]);
  const oneStroke = await inkPixels(page);
  expect(oneStroke).toBeGreaterThan(0);
  await expect(page.getByTestId("talisman-undo")).toBeEnabled();

  await drawLine(page, [40, 140], [150, 140]);
  expect(await inkPixels(page)).toBeGreaterThan(oneStroke);

  await page.getByTestId("talisman-undo").click();
  // 둘째 획만 사라지고 첫째는 남는다.
  expect(await inkPixels(page)).toBe(oneStroke);

  await page.getByTestId("talisman-undo").click();
  expect(await inkPixels(page)).toBe(0);
  await expect(page.getByTestId("talisman-undo")).toBeDisabled();
});

test("안내 모드 — 제대로 그은 획은 정본으로 갈아 끼우고, 되돌리면 안내도 물린다", async ({ page }) => {
  await openTalisman(page, true);
  const ok = await page.evaluate(() => (window as unknown as { __HANJA_TALISMAN_QA__: QA }).__HANJA_TALISMAN_QA__.present("天"));
  expect(ok).toBe(true);
  await page.waitForTimeout(200);
  expect((await guideState(page)).total).toBe(4);

  await page.evaluate(() => { (window as unknown as { __HANJA_TALISMAN_QA__: QA }).__HANJA_TALISMAN_QA__.traceStroke(); });
  await page.waitForTimeout(150);
  expect((await guideState(page)).current).toBe(1);
  const afterOne = await inkPixels(page);
  expect(afterOne).toBeGreaterThan(0);

  await page.evaluate(() => { (window as unknown as { __HANJA_TALISMAN_QA__: QA }).__HANJA_TALISMAN_QA__.traceStroke(); });
  await page.waitForTimeout(150);
  expect((await guideState(page)).current).toBe(2);

  await page.getByTestId("talisman-undo").click();
  await page.waitForTimeout(150);
  // 안내가 함께 물러야 「다음에 그을 획」이 종이와 맞는다.
  expect((await guideState(page)).current).toBe(1);
  expect(await inkPixels(page)).toBe(afterOne);
});

test("안내 모드 — 엉뚱하게 그은 붓질은 잠깐 비쳤다가 스스로 걷힌다", async ({ page }) => {
  await openTalisman(page, true);
  await page.evaluate(() => (window as unknown as { __HANJA_TALISMAN_QA__: QA }).__HANJA_TALISMAN_QA__.present("天"));
  await page.waitForTimeout(200);

  // 글자에서 한참 벗어난 자리에 긋는다 — 어느 획도 아니다.
  await drawLine(page, [14, 246], [180, 250]);
  await page.waitForTimeout(120);
  expect(await inkPixels(page)).toBeGreaterThan(0);
  expect((await guideState(page)).current).toBe(0);

  // 비추는 시간이 지나면 종이가 다시 깨끗해진다.
  await page.waitForTimeout(1200);
  expect(await inkPixels(page)).toBe(0);
  await expect(page.getByTestId("talisman-undo")).toBeDisabled();
});

test("판 도중 설정을 끄면 지금 종이가 곧바로 되돌아온다", async ({ page }) => {
  await openTalisman(page, true);
  await page.waitForTimeout(300);
  expect((await guideState(page)).available).toBe(true);

  await page.locator("#settings-button").click();
  await page.getByTestId("stroke-order-toggle").click();
  await page.locator("#settings-close").click();
  await page.waitForTimeout(500);
  expect((await guideState(page)).available).toBe(false);

  // 다시 켜면 그 자리에서 되살아난다.
  await page.locator("#settings-button").click();
  await page.getByTestId("stroke-order-toggle").click();
  await page.locator("#settings-close").click();
  await page.waitForTimeout(1500);
  expect((await guideState(page)).available).toBe(true);
});
