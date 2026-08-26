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

const HINT_STORAGE_KEYS = ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]
  .map((id) => `hanja-td:hint:${id}:v1`);

interface TalismanQaWindow {
  __HANJA_TALISMAN_QA__: { autoTrace(): void; submit(): void; isSealed(): boolean };
  __HANJA_CTX_QA__: { talismanFreeSummonTokens: number; engine: { state: { gold: number } } };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), "hanja-td:early-hint-v1");
  await page.addInitScript((keys: string[]) => {
    for (const key of keys) window.localStorage.setItem(key, "1");
  }, HINT_STORAGE_KEYS);
});

test("the default-on talisman tab turns a submitted trace into a jaryeong reward visit", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/?seed=TALISMAN-E2E&mode=casual");
  await page.getByTestId("start-run").click();

  // 기본 켜짐(트랙 C2) — 기록 탭 제거 뒤의 8탭 + 「부적」으로 아홉째가 선다.
  await expect(page.locator(".panel-tabs > button")).toHaveCount(9);
  await expect(page.locator("#talisman-tab")).toBeVisible();
  // 아홉 탭이 한 줄에 들어가고 탭바가 패널 밖으로 새지 않아야 한다.
  // (활성 탭은 한 칸 솟아 있으므로 top 비교가 아니라 "앞 탭보다 왼쪽으로
  //  되돌아간 탭이 있는가"로 줄바꿈을 잡는다.)
  const tabBar = await page.locator(".panel-tabs").evaluate((bar) => {
    let wrapped = false;
    let previousRight = Number.NEGATIVE_INFINITY;
    for (const tab of bar.children) {
      const rect = tab.getBoundingClientRect();
      if (rect.left < previousRight - 1) wrapped = true;
      previousRight = rect.right;
    }
    return { wrapped, overflow: bar.scrollWidth - bar.clientWidth };
  });
  expect(tabBar.wrapped).toBe(false);
  expect(tabBar.overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "artifacts/talisman-tabbar-default-on-1280x720.png", fullPage: true });

  // 설정 토글은 켜진 채로 서 있고, 끄면 탭이 접힌다 — 강제는 아니다.
  await page.locator("#settings-button").click();
  await expect(page.getByTestId("talisman-mode-toggle")).toHaveAttribute("aria-checked", "true");
  // 대가(적 5% 강화)는 설정 설명에 드러나 있어야 한다 — 숨기지 않는다.
  await expect(page.getByTestId("talisman-mode-toggle")).toContainText("적이 5% 강해집니다");
  await page.screenshot({ path: "artifacts/talisman-settings-note-1280x720.png", fullPage: true });
  await page.getByTestId("talisman-mode-toggle").click();
  await expect(page.locator("#talisman-tab")).toHaveCount(0);
  await expect(page.locator(".panel-tabs > button")).toHaveCount(8);
  await page.getByTestId("talisman-mode-toggle").click();
  await expect(page.getByTestId("talisman-mode-toggle")).toHaveAttribute("aria-checked", "true");
  await page.locator("#settings-close").click();

  // 부적지 패널 진입. 훈음이 병기된다.
  await expect(page.locator("#talisman-tab")).toBeVisible();
  await expect(page.locator(".panel-tabs > button")).toHaveCount(9);
  await page.locator("#talisman-tab").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-panel-tab", "talisman");
  await expect(page.locator("#talisman-panel")).toBeVisible();
  await expect(page.locator("#talisman-reading")).not.toHaveText("글자를 준비하는 중");
  await expect(page.locator("#talisman-progress-count")).toHaveText("0 / 3");
  await expect(page.locator("#talisman-recent-reward")).toContainText("아직 없음");
  await expect(page.locator("#talisman-economy-note")).toContainText("적이 5% 강해집니다");
  // 패널 세로 예산 — 부적지·바닥줄이 작업 영역을 넘겨 스크롤을 만들면 안 된다.
  const deckOverflow = await page.locator(".context-deck").evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(deckOverflow).toBeLessThanOrEqual(0);
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

  // ④ 제출 → 완성 인장 · 자령 강림 · 보상.
  await page.getByTestId("talisman-submit").click();
  await expect(page.locator("#talisman-status")).toContainText("부적 완성");
  await expect(page.locator("#talisman-seal")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("자령이 응답했습니다");
  // 그 글자의 자령이 부적지 위로 내려와 보상 꾸러미를 놓는다.
  await expect(page.locator(".talisman-visit")).toHaveCount(1);
  await expect(page.locator(".talisman-visit-name")).toContainText("자령");
  await expect(page.locator(".talisman-gift")).toHaveCount(1);
  await page.screenshot({ path: "artifacts/talisman-reward-visit-1280x720.png", fullPage: true });
  // 연출이 지나가도 "최근 보상" 줄에 누적이 남는다.
  await expect(page.locator("#talisman-recent-reward")).not.toContainText("아직 없음");
  await expect(page.locator("#talisman-progress-count")).toHaveText("1 / 3");
  await expect(page.getByTestId("talisman-submit")).toBeDisabled();
  await page.screenshot({ path: "artifacts/talisman-sealed-1280x720.png", fullPage: true });

  // ⑤ 3장 한 세트 — 완성하면 종이가 저절로 넘어가 다음 글자가 차오르고,
  //    3장을 채우면 세트가 잠긴 채 다음 웨이브를 기다린다.
  for (let sheet = 2; sheet <= 3; sheet += 1) {
    // 손대지 않아도 다음 장이 온다(인장이 걷히고 빈 종이가 선다).
    await expect(page.locator("#talisman-seal")).toBeHidden();
    await expect(page.getByTestId("talisman-submit")).toBeDisabled();
    await page.evaluate(() => (window as unknown as TalismanQaWindow).__HANJA_TALISMAN_QA__.autoTrace());
    await page.getByTestId("talisman-submit").click();
    await expect(page.locator("#talisman-progress-count")).toHaveText(`${sheet} / 3`);
  }
  await expect(page.locator("#talisman-status")).toContainText("3장 완성");
  await expect(page.getByTestId("talisman-submit")).toBeDisabled();
  await expect(page.getByTestId("talisman-redraw")).toBeDisabled();
  await page.screenshot({ path: "artifacts/talisman-set-complete-1280x720.png", fullPage: true });

  // ⑥ 기본 소환 무료권 — 배지가 서고, 쓰면 엽전이 줄지 않고 권만 준다.
  await page.evaluate(() => {
    (window as unknown as TalismanQaWindow).__HANJA_CTX_QA__.talismanFreeSummonTokens = 2;
  });
  await page.locator("#shop-tab").click();
  await expect(page.getByTestId("summon-button")).toContainText("무료 1회");
  await expect(page.locator(".summon-card-badge")).toHaveText("부적 ×2");
  await page.screenshot({ path: "artifacts/talisman-token-shop-1280x720.png", fullPage: true });
  // 엽전 칸은 보상 착탄 순간 잠시 카운트업 표시값을 보여 주므로, 여기서는
  // 연출과 무관한 실제 보유량(엔진 상태)으로 "권을 쓰면 엽전이 줄지 않는다"를 본다.
  const readGold = (): Promise<number> =>
    page.evaluate(() => (window as unknown as TalismanQaWindow).__HANJA_CTX_QA__.engine.state.gold);
  const goldBefore = await readGold();
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();
  await expect(page.locator(".summon-card-badge")).toHaveText("부적 ×1");
  expect(await readGold()).toBe(goldBefore);

  // 토글은 브라우저에 저장된다 — 꺼 두면 새로고침해도 접힌 채로 선다.
  await page.locator("#settings-button").click();
  await page.getByTestId("talisman-mode-toggle").click();
  await page.locator("#settings-close").click();
  await page.reload();
  await expect(page.locator("#talisman-tab")).toHaveCount(0);
  await expect(page.locator(".panel-tabs > button")).toHaveCount(8);
});
