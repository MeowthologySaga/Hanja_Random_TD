/*
 * 집자소 — 판을 넘어 남는 첫 장부.
 *
 * 여기서 못박는 규칙 넷.
 *   ① 묵편 넷을 올리면 **음이 한자 음 그대로** 붙는다(사람이 고치지 못한다).
 *   ② 새기면 그만큼 묵편이 줄고, 성어 한 구가 남는다.
 *   ③ 장착은 15구까지다.
 *   ④ 새긴 성어와 남은 묵편은 창을 닫았다 열어도 그대로다 — 판과 달리
 *      보관소는 지워지지 않는다.
 */
import { expect, test } from "@playwright/test";

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";
const ARCHIVE_KEY = "hanja-td:soul-archive-v1";

/** 서재를 열어 보려면 재료가 있어야 한다. 판을 돌리는 대신 장부를 미리 앉힌다. */
function seededArchive(): string {
  const souls: Record<string, number> = {};
  for (const char of ["天", "地", "玄", "黃", "宇", "宙", "洪", "荒"]) souls[char] = 4;
  return JSON.stringify({ version: 1, souls, idioms: [], equipped: [] });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
  // 새로고침에도 다시 심으면 "판을 넘어 남는가"를 잴 수 없다 — 처음 한 번만
  // 앉히고, 그 뒤로는 게임이 적어 둔 것을 그대로 쓴다.
  await page.addInitScript(
    ([key, value]: string[]) => {
      if (window.localStorage.getItem(key as string) === null) {
        window.localStorage.setItem(key as string, value as string);
      }
    },
    [ARCHIVE_KEY, seededArchive()]
  );
});

test("묵편 넷을 새겨 나만의 성어를 만들고 장착한다", async ({ page }) => {
  await page.goto("/?seed=SOULS-E2E");

  // 제목 화면의 묵편 배지가 지닌 수를 센다(여덟 글자 × 4).
  await expect(page.locator("#s00-souls-badge")).toHaveText("32");

  await page.getByTestId("soul-archive-open").click();
  await expect(page.locator("#soul-dialog")).toBeVisible();
  await expect(page.locator("#soul-holdings-count")).toHaveText("32");

  // 넉 자를 올리기 전에는 새기지 못한다.
  await expect(page.getByTestId("soul-forge")).toBeDisabled();

  for (const char of ["天", "地", "玄", "黃"]) {
    await page.locator(`.soul-chip[data-soul-char="${char}"]`).click();
  }

  // ① 음은 한자 음 그대로 — 뜻에 무엇을 적든 음은 바뀌지 않는다.
  await expect(page.locator("#soul-reading")).toHaveText("천지현황");
  await page.locator("#soul-meaning-input").fill("하늘과 땅이 열리다");
  await expect(page.locator("#soul-reading")).toHaveText("천지현황");

  await page.getByTestId("soul-forge").click();

  // ② 묵편 넷이 줄고 성어 한 구가 남는다.
  await expect(page.locator("#soul-holdings-count")).toHaveText("28");
  await expect(page.locator(".soul-card")).toHaveCount(1);
  await expect(page.locator(".soul-card-reading")).toHaveText("천지현황");
  await expect(page.locator(".soul-card-meaning")).toHaveText("하늘과 땅이 열리다");
  // 능력은 무작위로 굴리므로 값이 아니라 "한 문장이 적혀 있는가"를 본다.
  await expect(page.locator(".soul-card-bonus")).not.toBeEmpty();

  await expect(page.locator("#soul-equip-count")).toHaveText("0/15");
  await page.locator(".soul-card button[data-soul-equip]").click();
  await expect(page.locator("#soul-equip-count")).toHaveText("1/15");
  await expect(page.locator(".soul-card")).toHaveClass(/is-equipped/);

  // ④ 창을 닫았다 열어도 그대로다.
  await page.locator("#soul-close").click();
  await expect(page.locator("#soul-dialog")).toBeHidden();
  await page.reload();
  await page.getByTestId("soul-archive-open").click();
  await expect(page.locator(".soul-card")).toHaveCount(1);
  await expect(page.locator("#soul-equip-count")).toHaveText("1/15");
  await expect(page.locator("#soul-holdings-count")).toHaveText("28");
});

test("장착은 15구에서 멈춘다", async ({ page }) => {
  test.setTimeout(60_000);
  // 16구를 미리 새겨 둔 장부로 시작한다 — 화면에서 열여섯 번 새기는 것은
  // 시험이 재려는 규칙(장착 상한)과 상관없는 시간이다.
  await page.addInitScript(
    ([key, value]: string[]) => window.localStorage.setItem(key as string, value as string),
    [
      ARCHIVE_KEY,
      JSON.stringify({
        version: 1,
        souls: {},
        idioms: Array.from({ length: 16 }, (_, index) => ({
          id: `made-${index}`,
          chars: "天地玄黃",
          reading: "천지현황",
          meaning: "",
          bonus: { kind: "damage", value: 0.08, label: "모든 자령 피해 +8%" },
          createdAt: index
        })),
        equipped: []
      })
    ]
  );
  await page.goto("/?seed=SOULS-LIMIT-E2E");
  await page.getByTestId("soul-archive-open").click();
  await expect(page.locator(".soul-card")).toHaveCount(16);

  for (let index = 0; index < 15; index += 1) {
    await page.locator(".soul-card:not(.is-equipped) button[data-soul-equip]").first().click();
  }
  await expect(page.locator("#soul-equip-count")).toHaveText("15/15");

  // 열여섯째는 장착 단추가 잠긴다 — 무엇을 뺄지는 사람이 고른다.
  await expect(page.locator(".soul-card:not(.is-equipped) button[data-soul-equip]").first()).toBeDisabled();
});
