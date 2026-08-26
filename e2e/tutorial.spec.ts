/*
 * 수련장(튜토리얼 모드) 완주 스펙.
 *
 * 첫 방문 상태에서 수련장에 들어가 8걸음 각본(소환→배치→첫 웨이브→3합→
 * 티어 소환→강화→사자성어 봉인→수료)을 실제 조작으로 끝까지 밟고, 수료
 * 기록(localStorage)과 첫 방문 강조 해제까지 확인한다. 진행 감지는 각 걸음이
 * 셸에 남기는 data-tutorial-step 을 쓴다(각본 완료 감지 = 속성 전이).
 */
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const TUTORIAL_STORAGE_KEY = "hanja-td:tutorial-complete-v1";

/** 단계별 스크린샷 보관처 — 보고용(.claude/uiux/fbt/). */
const SHOT_DIR = ".claude/uiux/fbt";

/** 트랙 H(#8 죽은 시간 제거) 실측 스크린샷 보관처. */
const TRACK_H_DIR = ".claude/uiux/track-h";

async function canvasPositionForWorld(page: Page, worldX: number, worldY: number): Promise<{ x: number; y: number }> {
  const canvas = page.locator("#battle-canvas");
  const box = await canvas.boundingBox();
  const camera = await canvas.evaluate((element) => ({
    zoom: Number(element.dataset.mapZoom),
    offsetX: Number(element.dataset.mapOffsetX),
    offsetY: Number(element.dataset.mapOffsetY)
  }));
  if (!box) throw new Error("battle canvas is not visible");
  return {
    x: (camera.offsetX + worldX * camera.zoom) * box.width / 880,
    y: (camera.offsetY + worldY * camera.zoom) * box.height / 720
  };
}

/** 판 칸 번호 → 월드 좌표. content.ts 의 진 중심·간격(44)을 그대로 되짚는다. */
function worldXY(cell: number): [number, number] {
  const centers = [{ x: 440, y: 160 }, { x: 240, y: 360 }, { x: 440, y: 360 }, { x: 640, y: 360 }, { x: 440, y: 560 }];
  const center = centers[Math.floor(cell / 16)] as { x: number; y: number };
  const local = cell % 16;
  return [center.x + (local % 4 - 1.5) * 44, center.y + (Math.floor(local / 4) - 1.5) * 44];
}

async function clickCell(page: Page, cell: number): Promise<void> {
  const [worldX, worldY] = worldXY(cell);
  await page.locator("#battle-canvas").click({ position: await canvasPositionForWorld(page, worldX, worldY) });
}

test("walks the training grounds through all eight scripted steps", async ({ page }) => {
  // 3걸음은 이제 전멸 대기 없이 관전 2.6초 뒤 곧장 넘어간다. 여유는 자산
  // 로딩·저사양 CI 를 위한 것이다.
  test.setTimeout(120_000);
  mkdirSync(SHOT_DIR, { recursive: true });
  mkdirSync(TRACK_H_DIR, { recursive: true });
  await page.goto("/");
  const shell = page.locator(".game-shell");

  // 진입점: 서갈피 아래 세 번째 목패 + 첫 방문(수료 기록 없음) 강조.
  const entry = page.getByTestId("tutorial-button");
  await expect(entry).toBeVisible();
  await expect(entry).toContainText("수련장");
  await expect(entry).toContainText("처음이라면 여기부터");
  await expect(entry).toHaveClass(/is-fresh/);
  await entry.click();

  // 1걸음 — 소환. 기본 소환 버튼만 열려 있다.
  await expect(page.locator("#tutorial-layer")).toBeVisible({ timeout: 20_000 });
  await expect(shell).toHaveAttribute("data-tutorial-step", "1", { timeout: 20_000 });
  await expect(page.locator("#tutorial-step-total")).toHaveText("8");
  await expect(page.locator("#tutorial-title")).toContainText("자령");
  await expect(page.getByTestId("tutorial-exit")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/tutorial-step1-summon-1280x720.png` });
  // soft-lock: 각본 밖(웨이브 시작)은 눌리지 않는다 — 대상 버튼만 산다.
  await page.getByTestId("summon-button").click();
  await expect(shell).toHaveAttribute("data-tutorial-step", "2");

  // 2걸음 — 배치. 시작 진(첫 소환 오행)의 빈 칸을 클릭.
  const formation = Number(await shell.getAttribute("data-tutorial-formation"));
  expect(formation).toBeGreaterThanOrEqual(0);
  await clickCell(page, formation * 16 + 5);
  await expect(shell).toHaveAttribute("data-tutorial-step", "3");

  // 3걸음 — 첫 웨이브. 지원 2기가 각본 지급되고 [시작 보너스]만 열린다.
  await expect(page.locator("#early-button")).toBeEnabled();
  const waveStartedAt = Date.now();
  await page.locator("#early-button").click({ force: true }); // 맥동(early-beacon) 이 stable 판정을 막는다

  await expect(shell).toHaveAttribute("data-phase", "combat");
  // 관전 말풍선(적 한계·자동 공격 설명)이 뜨고, 전멸을 기다리지 않는다.
  await expect(page.locator("#tutorial-title")).toContainText("자령에게 맡겨요");
  await page.screenshot({ path: `${TRACK_H_DIR}/tutorial-step3-combat-watch-1280x720.png` });
  // 관전 2.6초 뒤 전투가 배경에서 계속되는 채로 4걸음이 열린다(≤10초 게이트).
  await expect(shell).toHaveAttribute("data-tutorial-step", "4", { timeout: 15_000 });
  const step3Seconds = (Date.now() - waveStartedAt) / 1000;
  console.log(`[track-h] step-3 wave duration: ${step3Seconds.toFixed(1)}s`);
  expect(step3Seconds).toBeLessThan(10);

  // 4걸음 — 3합 승급. 같은 별 3기가 지급돼 있다.
  await page.locator('[data-panel-tab="evolution"]').click();
  const fuseAll = page.locator("#casual-fuse-all");
  await expect(fuseAll).toBeVisible();
  await expect(fuseAll).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/tutorial-step4-fusion-1280x720.png` });
  await fuseAll.click();
  await expect(shell).toHaveAttribute("data-tutorial-step", "5");

  // 5걸음 — 티어 소환. 중급 소환 값이 지급돼 있다.
  await page.locator('[data-panel-tab="shop"]').click();
  const midstar = page.locator('[data-summon-product="midstar"]');
  await expect(midstar).toBeEnabled();
  await midstar.click();
  await expect(shell).toHaveAttribute("data-tutorial-step", "6");

  // 6걸음 — 강화. 문기가 지급돼 있고 오행 강화 [1회]가 눌린다.
  await page.locator('[data-panel-tab="growth"]').click();
  const upgrade = page
    .locator('#growth-upgrade-list [data-growth-upgrade-scope="element"][data-growth-amount="1"]:not([disabled])')
    .first();
  await expect(upgrade).toBeVisible();
  await upgrade.click();
  await expect(shell).toHaveAttribute("data-tutorial-step", "7");

  // 7걸음 — 사자성어 봉인. 네 글자가 지급되고 1번째는 미리 놓여 있다.
  const cellsAttribute = await shell.getAttribute("data-tutorial-idiom-cells");
  const cells = (cellsAttribute ?? "").split(",").map(Number);
  expect(cells).toHaveLength(4);
  await expect(page.locator("#tutorial-body")).toContainText("줄을 지키는 동안만");
  await page.screenshot({ path: `${SHOT_DIR}/tutorial-step7-idiom-1280x720.png` });
  for (const cell of cells.slice(1)) {
    await clickCell(page, cell);
    // 다음 글자 자령이 각본에 의해 자동 선택될 시간을 준다.
    await page.waitForTimeout(250);
  }
  await expect(shell).toHaveAttribute("data-tutorial-step", "8", { timeout: 10_000 });

  // 8걸음 — 수료. 발동 연출 뒤 수료막(배운 것 4줄)이 뜨고 기록이 남는다.
  await expect(page.locator("#tutorial-complete")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#tutorial-summary li")).toHaveCount(4);
  await expect(page.getByTestId("tutorial-exit")).toBeHidden();
  await page.screenshot({ path: `${SHOT_DIR}/tutorial-step8-complete-1280x720.png` });
  expect(await page.evaluate((key) => window.localStorage.getItem(key), TUTORIAL_STORAGE_KEY)).toBe("1");

  // [본편 출정] → 모드 선택 복귀. 수료했으니 첫 방문 강조는 꺼진다.
  await page.getByTestId("tutorial-finish").click();
  await expect(page.locator("#title-overlay")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("tutorial-button")).not.toHaveClass(/is-fresh/);
});

test("guards the quit control behind one confirmation and returns to the mode selection", async ({ page }) => {
  mkdirSync(SHOT_DIR, { recursive: true });
  mkdirSync(TRACK_H_DIR, { recursive: true });
  await page.goto("/");
  await expect(page.getByTestId("tutorial-button")).toBeVisible();
  // 부팅 막(#boot-loader)이 걷힌 실제 서재 화면을 담는다.
  await expect(page.locator("#boot-loader")).toHaveClass(/is-done/, { timeout: 20_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/tutorial-entry-s00-1280x720.png` });
  await page.getByTestId("tutorial-button").click();
  await expect(page.locator("#tutorial-layer")).toBeVisible({ timeout: 20_000 });

  // "다음"으로 오인되지 않는 문구·확인 1회 — 누르면 곧장 나가지 않는다.
  const exit = page.getByTestId("tutorial-exit");
  await expect(exit).toContainText("수련 그만두기");
  await exit.click();
  const quitDialog = page.locator("#tutorial-quit-dialog");
  await expect(quitDialog).toBeVisible();
  await expect(quitDialog).toContainText("수련을 그만두고 나갈까요?");
  await expect(quitDialog).toContainText("저장되지 않아요");
  await page.screenshot({ path: `${TRACK_H_DIR}/tutorial-quit-confirm-1280x720.png` });

  // [계속 수련하기] — 수련은 그대로 이어진다.
  await page.getByTestId("tutorial-quit-cancel").click();
  await expect(quitDialog).toBeHidden();
  await expect(page.locator("#tutorial-layer")).toBeVisible();

  // 다시 열어 [그만두기] — 이번에야 모드 선택으로 나간다.
  await exit.click();
  await expect(quitDialog).toBeVisible();
  await page.getByTestId("tutorial-quit-confirm").click();
  await expect(page.locator("#title-overlay")).toBeVisible({ timeout: 20_000 });
  // 그만두기는 수료가 아니다 — 기록은 남지 않고 강조도 유지된다.
  expect(await page.evaluate((key) => window.localStorage.getItem(key), TUTORIAL_STORAGE_KEY)).toBeNull();
  await expect(page.getByTestId("tutorial-button")).toHaveClass(/is-fresh/);
});
