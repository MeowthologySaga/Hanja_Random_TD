/*
 * 내가 새긴 성어가 화면에 서는가.
 *
 * "목표랑 성어 패널에서 커스텀 성어가 분리된 느낌으로 들어가있으면 좋겠어.
 * 현재는 커스텀 성어가 안보여"(사용자). 두 자리 모두에서 실제로 안 보였다.
 *
 *  · 성어 패널에는 명단 자체가 없었다 — 추적 중인 한 구와 규칙 도식뿐이었다.
 *  · 목표 서책은 107구를 점수순 28장으로 잘랐다. 갓 새긴 구는 보유 글자가 없어
 *    점수가 낮으니 그 28장 밖으로 밀려났다.
 *
 * 그래서 이 스펙이 지키는 것은 셋이다: 갈피가 갈려 서는가, 장착한 구가 **하나도
 * 안 잘리고** 다 보이는가, 그리고 지역을 넘어온 구가 판을 깨지 않는가.
 */
import { expect, test, type Page } from "@playwright/test";

const COACH_KEY = "hanja-td:coach-seen-v1";
const ARCHIVE_KEY = "hanja-td:soul-archive-v1";

/** 한국 명단 안 글자로 새긴 구 둘 + 명단 밖 글자로 새긴 구 하나. */
const IDIOMS = [
  { id: "c1", chars: "天地人心", reading: "천지인심", meaning: "하늘과 땅, 사람의 마음", bonus: { kind: "damage", value: 0.09, label: "모든 자령 피해 +9%" }, createdAt: 3 },
  { id: "c2", chars: "日月盈昃", reading: "일월영측", meaning: "해와 달이 차고 기운다", bonus: { kind: "range", value: 17, label: "모든 자령 사거리 +17" }, createdAt: 2 },
  { id: "c3", chars: "龍虎風雲", reading: "용호풍운", meaning: "용과 범이 바람과 구름을 부른다", bonus: { kind: "waveGold", value: 6, label: "웨이브를 넘길 때마다 엽전 +6" }, createdAt: 1 }
];

async function openRun(page: Page, equipped: readonly string[]): Promise<void> {
  await page.addInitScript(
    ([coachKey, archiveKey, idioms, equip]) => {
      window.localStorage.setItem(coachKey as string, "1");
      window.localStorage.setItem(archiveKey as string, JSON.stringify({
        version: 1, souls: {}, idioms, equipped: equip
      }));
    },
    [COACH_KEY, ARCHIVE_KEY, IDIOMS, equipped] as const
  );
  await page.goto("/?seed=CUSTOM-PANEL&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".resource-grid")).toBeVisible();
}

const openGoalBook = async (page: Page): Promise<void> => {
  await page.locator('.panel-tabs button[data-panel-tab="goal"]').click();
  await expect(page.locator("#goal-selector-list .goal-idiom-card").first()).toBeVisible();
};

test("성어 패널에 「내가 새긴 성어」 갈피가 서고, 장착한 구가 모두 보인다", async ({ page }) => {
  await openRun(page, ["c1", "c2", "c3"]);
  await page.locator('.panel-tabs button[data-panel-tab="idiom"]').click();
  const rows = page.locator("#idiom-custom-list .idiom-custom-row");
  await expect(rows).toHaveCount(3);
  await expect(page.locator("#idiom-custom-list")).toContainText("천지인심");
  await expect(page.locator("#idiom-custom-list")).toContainText("일월영측");
  // 발동 수는 「지금 몇 구가 서 있나」다 — 시작 직후에는 0 이다.
  await expect(page.locator("#idiom-custom-count")).toHaveText("0/3구 발동");
});

test("장착한 구가 없으면 집자소로 가는 안내 한 줄이 선다", async ({ page }) => {
  await openRun(page, []);
  await page.locator('.panel-tabs button[data-panel-tab="idiom"]').click();
  await expect(page.locator("#idiom-custom-list .idiom-custom-row")).toHaveCount(0);
  await expect(page.locator(".idiom-custom-empty")).toContainText("집자소");
});

test("목표 서책은 내가 새긴 구를 따로 세우고 하나도 자르지 않는다", async ({ page }) => {
  await openRun(page, ["c1", "c2", "c3"]);
  await openGoalBook(page);

  const headings = page.locator("#goal-selector-list .goal-group-heading");
  await expect(headings).toHaveCount(2);
  await expect(headings.first()).toContainText("집자소");
  await expect(headings.nth(1)).toContainText("지역 성어");

  /*
   * 잘림이 이 시험의 핵심이다. 지역 명단이 104구라 한 통에 넣고 자르면 갓 새긴
   * 구가 밖으로 밀려난다 — 그것이 "안보여"의 정체였다.
   */
  await expect(page.locator("#goal-selector-list .goal-idiom-card.is-custom")).toHaveCount(3);
});

test("지역을 넘어온 구는 판을 깨지 않고, 세울 수 없다고 적는다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openRun(page, ["c1", "c3"]);
  await openGoalBook(page);

  const foreign = page.locator('#goal-selector-list .goal-idiom-card[data-goal-idiom="c3"]');
  await expect(foreign).toContainText("이 지역 밖 글자");
  await expect(foreign.locator(".goal-idiom-track")).toBeDisabled();

  // 명단 안 글자로 새긴 구는 그대로 추적할 수 있다.
  const home = page.locator('#goal-selector-list .goal-idiom-card[data-goal-idiom="c1"]');
  await expect(home.locator(".goal-idiom-track")).toBeEnabled();

  expect(errors).toEqual([]);
});

test("고른 구의 상세는 어디서 온 구인지 밝힌다", async ({ page }) => {
  await openRun(page, ["c1"]);
  await openGoalBook(page);
  await page.locator('#goal-selector-list .goal-idiom-card[data-goal-idiom="c1"]').click();
  await expect(page.locator(".goal-detail-kicker")).toContainText("집자소 · 내가 새긴 구");
});

test("검색은 두 갈피에 함께 걸린다", async ({ page }) => {
  await openRun(page, ["c1", "c2", "c3"]);
  await openGoalBook(page);
  await page.locator("#goal-search").fill("천지");
  await expect(page.locator("#goal-selector-list .goal-idiom-card.is-custom")).toHaveCount(1);
  await expect(page.locator("#goal-selector-list")).toContainText("천지인심");
  await expect(page.locator("#goal-selector-list")).toContainText("천지현황");
});
