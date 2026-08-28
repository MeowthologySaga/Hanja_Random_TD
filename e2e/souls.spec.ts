/*
 * 집자소 — 판을 넘어 남는 첫 장부.
 *
 * 여기서 못박는 규칙 넷.
 *   ① 자혼 넷을 올리면 **음이 한자 음 그대로** 붙는다(사람이 고치지 못한다).
 *   ② 새기면 그만큼 자혼이 줄고, 성어 한 구가 남는다.
 *   ③ 장착은 15구까지다.
 *   ④ 새긴 성어와 남은 자혼은 창을 닫았다 열어도 그대로다 — 판과 달리
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

test("자혼 넷을 새겨 나만의 성어를 만들고 장착한다", async ({ page }) => {
  await page.goto("/?seed=SOULS-E2E");

  // 제목 화면의 자혼 배지가 지닌 수를 센다(여덟 글자 × 4).
  await expect(page.locator("#s00-souls-badge")).toHaveText("32");

  await page.getByTestId("soul-archive-open").click();
  await expect(page.locator("#soul-dialog")).toBeVisible();
  // 집자소는 갈피 둘로 갈렸다 — 만드는 자리(새기기)와 고르는 자리(장착).
  await expect(page.getByTestId("soul-tab-forge")).toHaveClass(/is-active/);
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

  /*
   * 새김 연출 — 자혼 넷은 되돌릴 수 없이 사라진다. 그 무게에 견주면 토스트
   * 한 줄은 너무 가벼워, 인장이 찍히고 새 성어의 음이 한 박자 머문다.
   */
  await page.getByTestId("soul-forge").click();
  await expect(page.locator("#soul-forge-fx")).toBeVisible();
  await expect(page.locator("#soul-forge-fx-reading")).toHaveText("천지현황");
  // 연출은 스스로 걷힌다 — 막이 남으면 뒤 화면이 계속 뿌옇다.
  await expect(page.locator("#soul-forge-fx")).toBeHidden({ timeout: 3_000 });

  // ② 자혼 넷이 줄고 성어 한 구가 남는다.
  await expect(page.locator("#soul-holdings-count")).toHaveText("28");
  await expect(page.locator(".soul-card")).toHaveCount(1);
  await expect(page.locator(".soul-card-reading")).toHaveText("천지현황");
  await expect(page.locator(".soul-card-meaning")).toHaveText("하늘과 땅이 열리다");
  // 능력은 무작위로 굴리므로 값이 아니라 "한 문장이 적혀 있는가"를 본다.
  await expect(page.locator(".soul-card-bonus")).not.toBeEmpty();

  // 만든 성어는 장착 갈피에서 고른다.
  await page.getByTestId("soul-tab-equip").click();
  await expect(page.locator("#soul-equip-count")).toHaveText("0/15");
  await page.locator(".soul-card button[data-soul-equip]").click();
  await expect(page.locator("#soul-equip-count")).toHaveText("1/15");
  await expect(page.locator(".soul-card")).toHaveClass(/is-equipped/);

  // ④ 창을 닫았다 열어도 그대로다.
  await page.locator("#soul-close").click();
  await expect(page.locator("#soul-dialog")).toBeHidden();
  await page.reload();
  await page.getByTestId("soul-archive-open").click();
  await page.getByTestId("soul-tab-equip").click();
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
  await page.getByTestId("soul-tab-equip").click();
  await expect(page.locator(".soul-card")).toHaveCount(16);

  for (let index = 0; index < 15; index += 1) {
    await page.locator(".soul-card:not(.is-equipped) button[data-soul-equip]").first().click();
  }
  await expect(page.locator("#soul-equip-count")).toHaveText("15/15");

  // 열여섯째는 장착 단추가 잠긴다 — 무엇을 뺄지는 사람이 고른다.
  await expect(page.locator(".soul-card:not(.is-equipped) button[data-soul-equip]").first()).toBeDisabled();
});

test("훈·독이 자혼 옆에 서고, 새기기는 스크롤에 안 가리며, 디버그는 개발자 모드에서만 선다", async ({ page }) => {
  await page.goto("/?seed=SOULS-UX-E2E");
  await page.getByTestId("soul-archive-open").click();
  await expect(page.locator("#soul-dialog")).toBeVisible();

  /*
   * ① 자혼에 훈·독을 적는다.
   *
   * 글자만 덩그러니 있으면 모으기가 수집이지 학습이 아니다. 재료를 고르는
   * 동안 그 글자를 읽을 수 있어야 "오늘 만난 글자"가 내일의 재료로 남는다.
   */
  const chip = page.locator('.soul-chip[data-soul-char="天"]');
  await expect(chip.locator("small")).toHaveText("하늘 천");
  await chip.click();
  // 새김대에 올려 둔 채로도 읽힌다.
  await expect(page.locator(".soul-slot.is-filled small").first()).toHaveText("하늘 천");

  /*
   * ② [새기기]는 스크롤을 따라다니지 않는다.
   *
   * 확률표가 길어 새김대 칸은 스크롤한다. 끝까지 읽고 나서 단추를 찾아
   * 되돌아가야 한다면 그 스크롤이 벌이 된다 — 단추는 스크롤 밖 고정 행에 있다.
   */
  const scroller = page.locator(".soul-forge-scroll");
  const before = (await page.getByTestId("soul-forge").boundingBox())!;
  await scroller.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.waitForTimeout(120);
  const after = (await page.getByTestId("soul-forge").boundingBox())!;
  expect(Math.round(after.y)).toBe(Math.round(before.y));
  expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  /*
   * ③ 디버그 갈피는 개발자 모드(백틱 5회)에서만 선다.
   */
  await expect(page.getByTestId("soul-tab-dev")).toBeHidden();
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await expect(page.getByTestId("soul-tab-dev")).toBeVisible();

  await page.getByTestId("soul-tab-dev").click();
  await page.locator("#soul-dev-char").fill("宇");
  await page.locator("#soul-dev-amount").fill("7");
  await page.getByTestId("soul-dev-grant").click();
  await expect
    .poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem("hanja-td:soul-archive-v1");
      const parsed = raw ? (JSON.parse(raw) as { souls?: Record<string, number> }) : {};
      return (parsed.souls ?? {})["宇"] ?? 0;
    }))
    .toBe(4 + 7);
});
