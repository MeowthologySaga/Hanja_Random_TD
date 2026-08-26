/*
 * 트랙 C — 부적 만들기 (gripe #5).
 *
 * 설정 토글 → 「부적」 탭 등장 → 따라쓰기(마우스 이벤트) → 성공 인장 →
 * 보상 토스트 → 웨이브당 3회 제한 → 기본 소환 무료권까지 한 흐름으로 본다.
 * 손그림 채점은 글꼴 렌더링에 좌우돼 불안정하므로, 임계 통과는 개발 전용
 * QA 자동 따라쓰기(__HANJA_TALISMAN_QA__.autoTrace — 실제 포인터 이벤트 합성)로
 * 결정론화한다. 실마우스 스트로크는 상태 줄 반응까지만 검증한다.
 */
import { expect, test } from "@playwright/test";

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";

const HINT_STORAGE_KEYS = ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence"]
  .map((id) => `hanja-td:hint:${id}:v1`);

interface TalismanQaWindow {
  __HANJA_TALISMAN_QA__: { autoTrace(): void; isSealed(): boolean };
  __HANJA_CTX_QA__: { talismanFreeSummonTokens: number };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), "hanja-td:early-hint-v1");
  await page.addInitScript((keys: string[]) => {
    for (const key of keys) window.localStorage.setItem(key, "1");
  }, HINT_STORAGE_KEYS);
});

test("settings toggle opens the talisman tab and tracing earns sealed rewards", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/?seed=TALISMAN-E2E&mode=casual");
  await page.getByTestId("start-run").click();

  // 기본 꺼짐 — 탭바는 9개 그대로, 부적 탭은 DOM 에도 없다.
  await expect(page.locator(".panel-tabs > button")).toHaveCount(8);
  await expect(page.locator("#talisman-tab")).toHaveCount(0);

  // 설정의 「학습 모드 · 부적 만들기」 토글을 켠다.
  await page.locator("#settings-button").click();
  await expect(page.getByTestId("talisman-mode-toggle")).toHaveAttribute("aria-checked", "false");
  await page.getByTestId("talisman-mode-toggle").click();
  await expect(page.getByTestId("talisman-mode-toggle")).toHaveAttribute("aria-checked", "true");
  await page.locator("#settings-close").click();

  // 탭 등장 → 부적지 패널 진입. 훈음이 병기된다.
  await expect(page.locator("#talisman-tab")).toBeVisible();
  await expect(page.locator(".panel-tabs > button")).toHaveCount(9);
  await page.locator("#talisman-tab").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-panel-tab", "talisman");
  await expect(page.locator("#talisman-panel")).toBeVisible();
  await expect(page.locator("#talisman-reading")).not.toHaveText("글자를 준비하는 중");
  await expect(page.locator("#talisman-reward-note")).toContainText("3/3");
  await page.screenshot({ path: "artifacts/talisman-blank-1280x720.png", fullPage: true });

  // 실마우스 스트로크 — 획을 뗄 때마다 점수 상태 줄이 반응한다.
  const inkBox = await page.locator("#talisman-ink").boundingBox();
  if (!inkBox) throw new Error("talisman ink canvas is not visible");
  await page.mouse.move(inkBox.x + inkBox.width * 0.5, inkBox.y + inkBox.height * 0.28);
  await page.mouse.down();
  await page.mouse.move(inkBox.x + inkBox.width * 0.5, inkBox.y + inkBox.height * 0.72, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator("#talisman-status")).toContainText("%");

  // 낙서를 지우고, 임계 통과는 QA 자동 따라쓰기로 결정론화한다.
  await page.getByTestId("talisman-clear").click();
  await page.evaluate(() => (window as unknown as TalismanQaWindow).__HANJA_TALISMAN_QA__.autoTrace());
  await expect(page.locator("#talisman-status")).toContainText("봉인 성공");
  await expect(page.locator("#talisman-seal")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("부적 완성! 보상 — ");
  await page.screenshot({ path: "artifacts/talisman-reward-toast-1280x720.png", fullPage: true });
  await page.screenshot({ path: "artifacts/talisman-sealed-1280x720.png", fullPage: true });

  // 웨이브당 3회 제한 — 4번째 성공은 연출만 남고 보상 소진 안내가 뜬다.
  for (let round = 0; round < 3; round += 1) {
    await page.getByTestId("talisman-redraw").click();
    await expect(page.locator("#talisman-seal")).toBeHidden();
    await page.evaluate(() => (window as unknown as TalismanQaWindow).__HANJA_TALISMAN_QA__.autoTrace());
    await expect(page.locator("#talisman-seal")).toBeVisible();
  }
  await expect(page.locator("#toast")).toContainText("이번 웨이브 보상은 소진");
  await expect(page.locator("#talisman-reward-note")).toContainText("소진");

  // 기본 소환 무료권 — 배지가 서고, 쓰면 엽전이 줄지 않고 권만 준다.
  await page.evaluate(() => {
    (window as unknown as TalismanQaWindow).__HANJA_CTX_QA__.talismanFreeSummonTokens = 2;
  });
  await page.locator("#shop-tab").click();
  await expect(page.getByTestId("summon-button")).toContainText("무료 1회");
  await expect(page.locator(".summon-card-badge")).toHaveText("부적 ×2");
  await page.screenshot({ path: "artifacts/talisman-token-shop-1280x720.png", fullPage: true });
  const goldBefore = (await page.locator("#gold-value").textContent()) ?? "";
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();
  await expect(page.locator("#gold-value")).toHaveText(goldBefore);
  await expect(page.locator(".summon-card-badge")).toHaveText("부적 ×1");

  // 토글은 브라우저에 저장된다 — 새로고침해도 탭이 그대로 선다.
  await page.reload();
  await expect(page.locator("#talisman-tab")).toHaveCount(1);
});
