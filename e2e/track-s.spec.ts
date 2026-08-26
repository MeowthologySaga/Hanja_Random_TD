/*
 * 트랙 S — 플레이테스트 감사 중·경 결함 회귀.
 *
 * 이 스펙이 지키는 것은 "고쳤다"가 아니라 "다시 무너지지 않는다"다. 감사에서
 * 실측으로 잡힌 자리마다 그때의 수치를 단언으로 박아 둔다.
 */
import { expect, test, type Page } from "@playwright/test";

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";
const HINT_STORAGE_KEYS = ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]
  .map((id) => `hanja-td:hint:${id}:v1`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => performance.setResourceTimingBufferSize(8192));
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), "hanja-td:early-hint-v1");
  await page.addInitScript((keys: string[]) => {
    for (const key of keys) window.localStorage.setItem(key, "1");
  }, HINT_STORAGE_KEYS);
});

/** 잘림 판정: 내용 상자가 보이는 상자보다 크면 잘린 것이다. */
async function overflowOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  return page.evaluate((target) => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) throw new Error(`no element for ${target}`);
    return { x: element.scrollWidth - element.clientWidth, y: element.scrollHeight - element.clientHeight };
  }, selector);
}

// ── S/P-08 · 공용 확인 창 ────────────────────────────────────────────
// 되돌릴 수 없는 조작 넷이 브라우저 기본 window.confirm 을 썼다. OS 창이라
// 자동화가 자동 취소해 검증 자체가 불가능했다 — 이제 DOM 이다.
test("routes destructive actions through the shared in-game confirm dialog", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-CONFIRM&mode=standard");
  // 자동배치를 끄면 소환분이 가방에 남아 제련소 분해 목록에 선다.
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await page.getByTestId("auto-place-toggle").click();
  await expect(page.getByTestId("auto-place-toggle")).toHaveAttribute("aria-checked", "false");
  await page.locator("#settings-close").click();
  await page.getByTestId("start-run").click();
  await page.locator("#shop-tab").click();
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();

  // 제련소 일괄 분해 — 유일 보호를 끄고(4연 소환은 대개 전부 유일이다) 추천 선택을 그대로 확인한다.
  await page.getByRole("tab", { name: "강화", exact: true }).click();
  await expect(page.locator("#growth-panel")).toBeVisible();
  if (await page.locator("#dismantle-unique-toggle").getAttribute("aria-checked") === "true") {
    await page.locator("#dismantle-unique-toggle").click();
  }
  await expect(page.locator("#dismantle-unique-toggle")).toHaveAttribute("aria-checked", "false");
  await page.locator("#dismantle-recommend-button").click();
  await page.locator("#dismantle-confirm-button").click();

  const dialog = page.getByTestId("confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("한 번에 분해할까요?");
  await expect(dialog).toContainText("되돌릴 수 없습니다");
  // 서책 틀(520×310)을 넘지 않는다 — 분해 목록이 길어도 본문만 접힌다.
  const frame = await page.locator(".confirm-frame").boundingBox();
  expect(frame?.width).toBeLessThanOrEqual(521);
  expect(frame?.height).toBeLessThanOrEqual(311);
  const body = await overflowOf(page, "#confirm-dialog-body");
  expect(body.x).toBeLessThanOrEqual(0);
  const actionsInside = await page.evaluate(() => {
    const actions = document.querySelector<HTMLElement>("#confirm-dialog .p00-actions")!.getBoundingClientRect();
    const shell = document.querySelector<HTMLElement>(".confirm-frame")!.getBoundingClientRect();
    return actions.bottom <= shell.bottom + 1 && actions.top >= shell.top;
  });
  expect(actionsInside).toBe(true);
  await page.screenshot({ path: ".claude/uiux/track-s/p08-confirm-dismantle-1280x720.png" });

  // Esc 는 취소다 — 아무 일도 일어나지 않는다.
  const before = await page.locator("#run-inventory-count").textContent();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#run-inventory-count")).toHaveText(before ?? "");

  // 수락하면 실제로 분해된다.
  await page.locator("#dismantle-confirm-button").click();
  await expect(dialog).toBeVisible();
  await page.getByTestId("confirm-dialog-accept").click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#message-value")).toContainText("분해");
});

// ── S/P-12 · 전장 부동 라벨의 무대 경계 ────────────────────────────
// 피해 수치·장판 이름·능력 알약은 월드 좌표를 따라다녀서, 개체가 가장자리에
// 서면 무대 밖으로 나가 잘리거나 상·하단 붙박이 UI 밑으로 들어갔다.
test("keeps floating battlefield labels inside the stage safe area", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-LABELS&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#battle-canvas")).toBeVisible();

  const report = await page.evaluate(async () => {
    const labelsSpecifier = "/src/ui/battle/stage-labels.ts";
    const worldSpecifier = "/src/core/content.ts";
    const labels = await import(labelsSpecifier) as typeof import("../src/ui/battle/stage-labels");
    const world = await import(worldSpecifier) as typeof import("../src/core/content");
    const camera = (window as unknown as { __HANJA_CTX_QA__: { mapZoom: number; mapOffset: { x: number; y: number } } }).__HANJA_CTX_QA__;
    const safe = labels.STAGE_SAFE_AREA;
    const outside: Array<{ zoom: number; worldX: number; worldY: number; left: number; top: number; right: number; bottom: number }> = [];
    // 월드 네 귀퉁이 바깥까지 훑는다 — 카메라가 어디에 있든 라벨은 무대 안이다.
    for (const zoom of [0.72, 2, 5.2]) {
      camera.mapZoom = zoom;
      camera.mapOffset = { x: 0, y: 0 };
      labels.resetStageLabels();
      for (const worldX of [-120, 0, 220, 440, 880, 1_000]) {
        for (const worldY of [-120, 0, 360, 720, 840]) {
          const half = { w: 30, h: 8 };
          const spot = labels.placeStageLabel(worldX, worldY, half.w, half.h, { avoidOverlap: true });
          const left = camera.mapOffset.x + (spot.x - half.w) * zoom;
          const right = camera.mapOffset.x + (spot.x + half.w) * zoom;
          const top = camera.mapOffset.y + (spot.y - half.h) * zoom;
          const bottom = camera.mapOffset.y + (spot.y + half.h) * zoom;
          const fits = 2 * half.w * zoom <= world.WORLD_WIDTH - safe.left - safe.right
            && 2 * half.h * zoom <= world.WORLD_HEIGHT - safe.top - safe.bottom;
          if (!fits) continue;
          if (left < safe.left - 0.5 || right > world.WORLD_WIDTH - safe.right + 0.5
            || top < safe.top - 0.5 || bottom > world.WORLD_HEIGHT - safe.bottom + 0.5) {
            outside.push({ zoom, worldX, worldY, left, top, right, bottom });
          }
        }
      }
    }
    // 같은 자리에 세 번 부르면 세로로 갈라진다(피해 수치 쌓임).
    camera.mapZoom = 2;
    camera.mapOffset = { x: 0, y: 0 };
    labels.resetStageLabels();
    const stacked = [0, 1, 2].map(() => labels.placeStageLabel(220, 200, 24, 8, { avoidOverlap: true }).y);
    return { outside, stacked, safe };
  });
  expect(report.outside).toEqual([]);
  expect(new Set(report.stacked).size).toBe(3);
});

// ── S/P-10 · 웨이브 브리핑 잔존 꼬리 ───────────────────────────────
// 두 줄 클램프는 넘치는 순간 뒤부터 삼킨다. 잔존 수는 이 문장에서만 알 수
// 있는 값이므로 장·우두머리 예고보다 앞에 서야 한다. 조판도 함께 잰다 —
// 자형연성(표준) 모드의 카드 폭은 별승급과 다를 수 있다.
test("keeps the survivor tail ahead of the chapter note and inside two lines", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-BRIEF&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#wave-briefing")).toBeVisible();

  const report = await page.evaluate(async () => {
    const specifier = "/src/core/content.ts";
    const module = await import(specifier) as typeof import("../src/core/content");
    const element = document.getElementById("wave-briefing") as HTMLElement;
    const original = element.textContent;
    const overflowing: Array<{ wave: number; survivors: number; overflow: number; text: string }> = [];
    const misordered: number[] = [];
    for (let wave = 1; wave <= 100; wave += 1) {
      const plan = module.wavePlan(wave);
      for (const survivors of [1, 9, 79]) {
        const text = module.composeWaveBriefing(plan.briefing, wave, plan.boss, survivors);
        const tail = `잔존 ${survivors}체 합류`;
        const chapter = `제${Math.max(1, Math.ceil(wave / 10))}장`;
        if (text.indexOf(tail) > text.indexOf(chapter)) misordered.push(wave);
        element.textContent = text;
        const overflow = element.scrollHeight - element.clientHeight;
        if (overflow > 1) overflowing.push({ wave, survivors, overflow, text });
      }
    }
    element.textContent = original;
    return { overflowing, misordered };
  });
  expect(report.misordered).toEqual([]);
  expect(report.overflowing).toEqual([]);
});

// [최대] 강화도 같은 창을 쓴다. 비용을 통째로 쓰는 조작이라 확인 1회가 붙는다.
test("confirms max-level upgrades in the same dialog", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-MAXUP&mode=standard");
  await page.getByTestId("start-run").click();
  await page.getByRole("tab", { name: "강화", exact: true }).click();
  const maxButton = page.locator('[data-growth-upgrade-scope="global"][data-growth-stat="damage"][data-growth-amount="max"]');
  await expect(maxButton).toBeEnabled();
  await maxButton.click();
  const dialog = page.getByTestId("confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("단계를 한 번에 올릴까요?");
  await expect(dialog).toContainText("누적 비용");
  await expect(dialog).toContainText("엽전");
  await page.getByTestId("confirm-dialog-accept").click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#element-upgrade-total")).toContainText("단계");
});
