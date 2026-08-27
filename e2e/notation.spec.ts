/*
 * 표기(읽기) 축 — 범위×표기 교차 조합. (gripe #6, 트랙 Q)
 *
 * 여기서 지키는 것은 두 가지다.
 *   1. 고르지 않은 사람의 화면은 그대로다 — 중국 로스터는 병음, 배지 0.
 *   2. 표기만 한국 훈음으로 바꾸면 같은 도감의 라벨이 통째로 훈음으로 갈리고,
 *      그중 빌려 온 읽기에는 「정자 기준」·「대체 표기」 배지가 선다.
 *
 * 중국 로스터를 쓰는 이유는 하나다. 한국 1,000자는 세 표기 모두 사전에
 * 실려 있어 배지가 뜰 자리가 없다 — 배지 규칙을 실제로 밟으려면 그 언어권에
 * 없는 글자가 섞인 로스터라야 한다.
 */
import { expect, test } from "@playwright/test";

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";
const HINT_STORAGE_KEYS = ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]
  .map((id) => `hanja-td:hint:${id}:v1`);

const KOREAN = /[가-힣]/u;
/* 병음 — 성조 부호가 붙은 라틴 문자. */
const PINYIN = /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ·\s]+$/u;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), "hanja-td:early-hint-v1");
  await page.addInitScript((keys: string[]) => {
    for (const key of keys) window.localStorage.setItem(key, "1");
  }, HINT_STORAGE_KEYS);
});

/** 맞춤 진법에서 중국 범위를 고른다 — 미리 해보기 확인(P00)을 우회하지 않는다. */
async function chooseChineseRoster(page: import("@playwright/test").Page): Promise<void> {
  await page.locator("#custom-formation-button").click();
  await page.locator('[data-s13-region="CN"]').click();
  await page.locator("#p00-continue").click();
}

test("표기를 고르지 않으면 중국 범위는 병음 그대로이고 배지가 하나도 없다", async ({ page }) => {
  await page.goto("/?seed=NOTATION-E2E&mode=casual");
  await chooseChineseRoster(page);

  // 표기 그룹은 열려 있고, 고른 것이 없으므로 로스터의 자국 표기가 선택돼 있다.
  await page.locator("#custom-formation-button").click();
  const notationGroup = page.locator(".s13-notation-group");
  await expect(notationGroup).toBeVisible();
  await expect(page.locator('[data-s13-notation="cn-pinyin"]')).toHaveAttribute("aria-checked", "true");
  await page.locator("#s13-close").click();

  await page.getByTestId("start-run").click();
  await page.locator("#codex-button").click();
  const firstReading = page.locator(".codex-jaryeong-card .codex-jaryeong-identity strong").first();
  await expect(firstReading).toBeVisible();
  expect((await firstReading.innerText()).trim()).toMatch(PINYIN);
  // 자국 표기는 전부 사전 독음이라 배지가 붙을 자리가 없다.
  await expect(page.locator("#codex-list .notation-mark")).toHaveCount(0);
  await page.screenshot({ path: ".claude/uiux/track-q/e2e-cn-pinyin-no-badge.png", fullPage: true });
});

test("표기를 한국 훈음으로 바꾸면 도감 라벨이 갈리고 빌려 온 읽기에 배지가 선다", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/?seed=NOTATION-E2E&mode=casual");
  await chooseChineseRoster(page);

  // 범위는 중국 그대로 두고 표기만 한국 훈음으로 — 두 축이 독립이라는 것 자체.
  await page.locator("#custom-formation-button").click();
  await page.locator('[data-s13-notation="kr-hunum"]').click();
  await expect(page.locator('[data-s13-notation="kr-hunum"]')).toHaveAttribute("aria-checked", "true");
  // 범위 선택은 흔들리지 않았다.
  await expect(page.locator('[data-s13-region="CN"]')).toHaveAttribute("aria-checked", "true");
  await page.screenshot({ path: ".claude/uiux/track-q/e2e-s13-notation-group.png" });
  await page.locator("#s13-close").click();

  await page.getByTestId("start-run").click();
  await page.locator("#codex-button").click();

  // 같은 도감, 같은 3,500자 — 라벨만 훈음으로 갈렸다.
  const firstReading = page.locator(".codex-jaryeong-card .codex-jaryeong-identity strong").first();
  await expect(firstReading).toBeVisible();
  const reading = (await firstReading.innerText()).trim();
  expect(reading).toMatch(KOREAN);
  expect(reading).not.toMatch(PINYIN);

  // 빌려 온 읽기에는 배지가 선다 — 둘 다 실제로 나온다.
  await expect(page.locator("#codex-list .notation-mark").first()).toBeVisible();
  expect(await page.locator("#codex-list .notation-mark--derived").count()).toBeGreaterThan(0);
  await page.screenshot({ path: ".claude/uiux/track-q/e2e-cn-kr-hunum-badges.png", fullPage: true });

  // 대체 표기는 회색 배지 + 근거 종류를 달고, 영어 원문 뜻은 이탤릭으로 갈린다.
  await page.locator("#codex-search").fill("丐");
  const substituteCard = page.locator(".codex-jaryeong-card").first();
  await expect(substituteCard).toBeVisible();
  await substituteCard.click();
  const substituteMark = page.locator("#codex-detail .notation-mark--substitute").first();
  await expect(substituteMark).toBeVisible();
  await expect(substituteMark).toContainText("대체 표기");
  await expect(substituteMark).toContainText("중국 전용자");
  const gloss = page.locator("#codex-detail .notation-gloss .notation-gloss-text--en").first();
  await expect(gloss).toBeVisible();
  await expect(gloss).toHaveAttribute("lang", "en");
  await expect(gloss).toContainText("beggar");
  await page.screenshot({ path: ".claude/uiux/track-q/e2e-substitute-detail.png" });
});
