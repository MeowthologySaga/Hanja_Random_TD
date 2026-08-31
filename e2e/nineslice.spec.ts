/*
 * 9슬라이스 프레임.
 *
 * 이 게임의 액자·띠·쪽지는 모서리를 고정하고 변만 늘리도록 그린 그림이다.
 * 화면에서는 두 가지로 망가져 있었다.
 *
 *  ① `clip-path`·`border-radius` 가 네모난 프레임 그림의 귀퉁이를 베어 냈다.
 *     하필 그 자리가 압정·찢긴 종이·리본 꼬리가 그려진 곳이라 "모서리가
 *     잘렸다"로 읽혔다.
 *  ② border-image 를 통째로 끄고 `background: 100% 100%` 로 늘려, 그림이
 *     9등분되지 않고 가로세로 다른 배율로 찌그러졌다(최악 1.87배).
 *
 * 되살리는 방법은 border-image 를 **절대 위치 가상 요소**에 거는 것이다.
 * 그러면 테두리 두께가 부모 레이아웃을 밀지 않는다 — 예전에 9슬라이스를
 * 걷어야 했던 바로 그 이유가 사라진다.
 *
 * 그래서 이 스펙이 지키는 것은 셋이다: 틀이 실제로 9슬라이스로 그려지는가,
 * 그 틀이 잘리지 않는가, 그리고 **레이아웃을 밀지 않는가**.
 */
import { expect, test, type Page } from "@playwright/test";

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";

/** 설계 좌표(1280×720 무대) 기준 치수. 화면 배율을 되돌려 잰다. */
async function designBox(page: Page, selector: string): Promise<{ w: number; h: number }> {
  return page.evaluate((sel) => {
    const scale = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--stage-scale")
    ) || 1;
    const box = document.querySelector(sel)!.getBoundingClientRect();
    return { w: Math.round(box.width / scale), h: Math.round(box.height / scale) };
  }, selector);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key as string, "1"), COACH_STORAGE_KEY);
});

test("프레임은 9슬라이스로 그려지고, 잘리지 않으며, 레이아웃을 밀지 않는다", async ({ page }) => {
  await page.goto("/?seed=NINESLICE-E2E&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".resource-grid")).toBeVisible();

  /*
   * ① 틀은 가상 요소에 9슬라이스로 걸린다.
   *
   * 요소 자신에 걸면 border-width 가 상자를 키워 고정 높이 격자를 밀어낸다 —
   * 그래서 예전에 통째로 걷어냈다. 가상 요소는 그 문제가 없다.
   */
  const framed = await page.evaluate(() => {
    return [".resource-grid", ".wave-card", ".panel-tabs", ".panel-footer"].map((sel) => {
      const el = document.querySelector(sel)!;
      const own = getComputedStyle(el);
      const frame = getComputedStyle(el, "::before");
      return {
        sel,
        // 늘린 배경은 걷혔는가
        stretchedBackground: own.backgroundImage.includes("url"),
        // 틀이 가상 요소에 9슬라이스로 서 있는가
        frameImage: frame.borderImageSource !== "none",
        frameAbsolute: frame.position === "absolute",
        frameSliced: frame.borderImageSlice.trim() !== "100%",
        // 잘림이 없는가
        clipPath: own.clipPath,
        borderRadius: own.borderRadius
      };
    });
  });

  for (const entry of framed) {
    expect(entry, entry.sel).toMatchObject({
      stretchedBackground: false,
      frameImage: true,
      frameAbsolute: true,
      frameSliced: true,
      clipPath: "none"
    });
    // 둥근 모서리는 네모난 프레임 그림을 깎는다.
    expect(entry.borderRadius, entry.sel).toBe("0px");
  }

  /*
   * ② 잘림이 걷혔는가 — 프레임 그림이 제 실루엣을 정한다.
   *
   * 전장 쪽지는 아직 요소 자신에 9슬라이스를 걸고 있는 유일한 곳이라,
   * 슬라이스와 그리는 두께가 어긋나지 않는지 함께 본다(어긋나면 압정 그림이
   * 가로로만 눌린다).
   */
  const chip = await page.evaluate(() => {
    const el = document.querySelector(".stage-chip")!;
    const cs = getComputedStyle(el);
    return { clipPath: cs.clipPath, imageWidth: cs.borderImageWidth, hasImage: cs.borderImageSource !== "none" };
  });
  expect(chip.hasImage).toBe(true);
  expect(chip.clipPath).toBe("none");
  // 원본 슬라이스(13/16/12/24)로 그려야 모서리 배율이 1.0 이 된다.
  expect(chip.imageWidth).toBe("13px 16px 12px 24px");

  /*
   * ③ 레이아웃을 밀지 않는가 — 이 작업의 유일한 위험이다.
   *
   * 설계 좌표는 1280×720 고정이고 우측 조작 패널은 400×720 이다. 프레임을
   * 되살리며 이 수가 한 픽셀이라도 움직이면 판 전체가 어긋난다.
   * 아래 값은 9슬라이스를 걷어내기 **전에** 같은 조건에서 잰 기준값이다.
   */
  expect(await designBox(page, ".control-panel")).toEqual({ w: 400, h: 720 });
  expect(await designBox(page, ".resource-grid")).toEqual({ w: 376, h: 54 });
  expect(await designBox(page, ".wave-card")).toEqual({ w: 376, h: 82 });
  expect(await designBox(page, ".panel-tabs")).toEqual({ w: 376, h: 76 });
  expect(await designBox(page, ".panel-footer")).toEqual({ w: 376, h: 28 });

  /*
   * ④ 내용이 그려진 틀을 밟지 않는가.
   *
   * 자원 띠와 바닥 띠는 여백을 틀 두께에 맞춰 두었다. 이 둘은 칸 자체에
   * 테두리가 있어 겹침이 그대로 눈에 띄는 자리다.
   */
  const clearance = await page.evaluate(() => {
    const scale = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--stage-scale")
    ) || 1;
    const design = (value: number) => value / scale;
    return ([[".resource-grid", 8], [".panel-footer", 6.5]] as const).map(([sel, band]) => {
      const el = document.querySelector(sel)!;
      const box = el.getBoundingClientRect();
      const kids = [...el.children].filter((kid) => kid.getBoundingClientRect().width > 0);
      const top = Math.min(...kids.map((kid) => design(kid.getBoundingClientRect().top - box.top)));
      const bottom = Math.min(...kids.map((kid) => design(box.bottom - kid.getBoundingClientRect().bottom)));
      return { sel, band, top, bottom };
    });
  });
  for (const entry of clearance) {
    expect(entry.top, entry.sel).toBeGreaterThanOrEqual(entry.band - 0.5);
    expect(entry.bottom, entry.sel).toBeGreaterThanOrEqual(entry.band - 0.5);
  }

  await page.screenshot({ path: "artifacts/nineslice-frames-1280x720.png", fullPage: true });
});
