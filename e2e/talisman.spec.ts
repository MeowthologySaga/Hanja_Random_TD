/*
 * 트랙 C — 부적 만들기 (gripe #5) · 트랙 C2 재작성.
 *
 * 설정 토글 → 「부적」 탭 등장 → 따라쓰기 → **[부적 봉인] 제출** → 완성 인장 →
 * 보상 → 웨이브당 상한 → 기본 소환 무료권까지 한 흐름으로 본다.
 *
 * C2 의 핵심 규칙 두 가지를 여기서 못박는다.
 *   ① 획을 떼도 저절로 완성되지 않는다 — 판정은 제출 버튼만의 권한이다.
 *   ② 미달 제출은 벌이 없다 — 안내만 남고 그린 먹선은 그대로 살아 있다.
 * 손그림 채점은 글꼴 렌더링에 좌우돼 불안정하므로, 임계 통과선까지의 그리기는
 * 개발 전용 QA 자동 따라쓰기(__HANJA_TALISMAN_QA__.autoTrace — 실제 포인터
 * 이벤트 합성)로 결정론화하고 제출은 실제 버튼 클릭으로 한다.
 */
import { expect, test } from "@playwright/test";

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";

const HINT_STORAGE_KEYS = ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence"]
  .map((id) => `hanja-td:hint:${id}:v1`);

interface TalismanQaWindow {
  __HANJA_TALISMAN_QA__: { autoTrace(): void; submit(): void; isSealed(): boolean };
  __HANJA_CTX_QA__: { talismanFreeSummonTokens: number };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), "hanja-td:early-hint-v1");
  await page.addInitScript((keys: string[]) => {
    for (const key of keys) window.localStorage.setItem(key, "1");
  }, HINT_STORAGE_KEYS);
});

test("settings toggle opens the talisman tab and submitting a traced glyph earns rewards", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/?seed=TALISMAN-E2E&mode=casual");
  await page.getByTestId("start-run").click();

  // 기본 꺼짐 — 탭바는 8개 그대로, 부적 탭은 DOM 에도 없다.
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
  // 획이 하나도 없으면 제출할 것이 없다.
  await expect(page.getByTestId("talisman-submit")).toBeDisabled();
  await page.screenshot({ path: "artifacts/talisman-blank-1280x720.png", fullPage: true });

  // ① 실마우스 스트로크 — 상태 줄이 반응하고 제출이 열리지만, 저절로 완성되지 않는다.
  const inkBox = await page.locator("#talisman-ink").boundingBox();
  if (!inkBox) throw new Error("talisman ink canvas is not visible");
  await page.mouse.move(inkBox.x + inkBox.width * 0.5, inkBox.y + inkBox.height * 0.28);
  await page.mouse.down();
  await page.mouse.move(inkBox.x + inkBox.width * 0.5, inkBox.y + inkBox.height * 0.72, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator("#talisman-status")).toContainText("%");
  await expect(page.getByTestId("talisman-submit")).toBeEnabled();
  await expect(page.locator("#talisman-seal")).toBeHidden();
  await page.screenshot({ path: "artifacts/talisman-before-submit-1280x720.png", fullPage: true });

  // ② 획 하나만 그리고 낸 제출은 벌 없이 안내만 남긴다 — 먹선은 살아 있다.
  await page.getByTestId("talisman-submit").click();
  await expect(page.locator("#talisman-status")).toContainText("필요");
  await expect(page.locator("#talisman-seal")).toBeHidden();
  await expect(page.getByTestId("talisman-submit")).toBeEnabled();
  await page.screenshot({ path: "artifacts/talisman-shortfall-1280x720.png", fullPage: true });

  // ③ 낙서를 지우고, 임계 통과선까지는 QA 자동 따라쓰기로 결정론화한다.
  //    자동 따라쓰기는 그리기까지만 한다 — 여기서도 인장은 아직 없다.
  await page.getByTestId("talisman-clear").click();
  await expect(page.getByTestId("talisman-submit")).toBeDisabled();
  await page.evaluate(() => (window as unknown as TalismanQaWindow).__HANJA_TALISMAN_QA__.autoTrace());
  await expect(page.locator("#talisman-seal")).toBeHidden();
  await expect(page.getByTestId("talisman-submit")).toBeEnabled();

  // ④ 제출 → 완성 인장 · 보상.
  await page.getByTestId("talisman-submit").click();
  await expect(page.locator("#talisman-status")).toContainText("부적 완성");
  await expect(page.locator("#talisman-seal")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("부적 완성!");
  await expect(page.getByTestId("talisman-submit")).toBeDisabled();
  await page.screenshot({ path: "artifacts/talisman-sealed-1280x720.png", fullPage: true });

  // ⑤ 웨이브당 상한 — 상한을 넘긴 완성은 연출만 남고 보상 소진 안내가 뜬다.
  for (let round = 0; round < 3; round += 1) {
    await page.getByTestId("talisman-redraw").click();
    await expect(page.locator("#talisman-seal")).toBeHidden();
    await page.evaluate(() => (window as unknown as TalismanQaWindow).__HANJA_TALISMAN_QA__.autoTrace());
    await page.getByTestId("talisman-submit").click();
    await expect(page.locator("#talisman-seal")).toBeVisible();
  }
  await expect(page.locator("#toast")).toContainText("이번 웨이브 보상은 소진");
  await expect(page.locator("#talisman-reward-note")).toContainText("소진");

  // ⑥ 기본 소환 무료권 — 배지가 서고, 쓰면 엽전이 줄지 않고 권만 준다.
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
