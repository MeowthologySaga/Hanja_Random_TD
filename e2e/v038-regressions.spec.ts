/*
 * v038 — 사용자가 짚은 네 자리를 못 박는다.
 *
 * 넷 다 「한 곳에만 있던 처방이 새 경로에 안 따라붙었거나, 뒤에 온 규칙이
 * 앞의 것을 조용히 지운」 꼴이었다. 화면은 멀쩡해 보이는데 그림·소리·글자만
 * 사라지는 종류라, 사람이 스크린샷을 보내 주기 전까지 아무 시험도 울지 않았다.
 * 그 침묵을 여기서 깬다 — 넷 모두 **계산된 값**으로 확인한다.
 */
import { expect, test, type Page } from "@playwright/test";

interface TalismanQa {
  currentChar: () => string | null;
  isSealed: () => boolean;
  autoTrace: () => void;
  submit: () => void;
  grantCharges: (count: number) => number;
}

async function openRun(page: Page, seed: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    window.localStorage.setItem("hanja-td:soul-tutor-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto(`/?seed=${seed}&mode=standard`);
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
}

test("전장 아래 조작 픽토그램 셋이 실제로 그려진다", async ({ page }) => {
  await openRun(page, "V038-ICONS");
  /*
   * 대비 패스가 `.canvas-tip i em` 에 `background` **단축 속성**을 !important 로
   * 얹은 순간, 110절이 깔아 둔 `--control-icon` 그림 레이어가 함께 초기화돼
   * 검은 사각형 셋만 남았다("밑부분 ui 아이콘 이미지 사라졌어" — 사용자).
   * 글자는 text-indent 로 상자 밖에 있으니 **그림이 없으면 아무것도 없다.**
   */
  const icons = await page.locator(".canvas-tip i em").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).backgroundImage)
  );
  expect(icons).toHaveLength(3);
  for (const icon of icons) {
    expect(icon).toContain("control-");
    expect(icon).not.toBe("none");
  }
});

test("패널 [시작]은 맥동하고, 곁자리의 인주색은 그대로다", async ({ page }) => {
  await openRun(page, "V038-EARLY");
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#early-button")).toBeEnabled();

  /*
   * v036 에서 이 단추를 전장 위에서 패널 카드 안으로 옮기자 060절의 놋쇠
   * `!important` 가 걸리기 시작했다. !important 일반 선언은 @keyframes 를
   * 이기므로 맥동이 소리 없이 죽었다("빠른시작이 눈에 잘 안 띄어" — 사용자).
   */
  const beacon = await page.locator("#early-button").evaluate((element) => {
    const style = getComputedStyle(element);
    const animation = element.getAnimations()[0] as Animation | undefined;
    const read = (): { seal: boolean; background: string; scale: string } => {
      const now = getComputedStyle(element);
      return {
        seal: /rgba?\(159, 47, 35/.test(now.boxShadow),
        background: now.backgroundImage,
        scale: now.scale
      };
    };
    if (!animation) return { name: style.animationName, at0: null, at50: null };
    // 화면이 가려진 창에서는 시계가 멈춰 있다 — 직접 두 지점으로 옮겨 견준다.
    animation.pause();
    animation.currentTime = 0;
    const at0 = read();
    animation.currentTime = 625;
    const at50 = read();
    animation.currentTime = 0;
    animation.play();
    return { name: style.animationName, at0, at50 };
  });
  expect(beacon.name).toBe("wave-early-beacon");
  // 「깜박거리고 색 바뀌게」 — 두 지점의 바탕색이 다르고, 절반에 인주 테가 든다.
  expect(beacon.at50?.background).not.toBe(beacon.at0?.background);
  expect(beacon.at0?.seal).toBe(false);
  expect(beacon.at50?.seal).toBe(true);

  /*
   * 060 에서 [시작]을 뺄 때 `:not(#early-button)` 로 쓰면 특이도가 (0,1,1) →
   * (1,1,1) 로 올라가 790절의 인주 !important((0,2,1))를 역전시킨다. 그러면
   * 「적 한계」 곁자리가 놋쇠로 되돌아가는데 data-tone 속성은 그대로라 시험은
   * 통과한 채 색만 죽는다. 그래서 **색을 직접 잰다.**
   */
  const urgent = await page.locator("#wave-action-a").evaluate((element) => {
    const previous = element.getAttribute("data-tone");
    element.setAttribute("data-tone", "urgent");
    const painted = getComputedStyle(element).backgroundImage;
    if (previous === null) element.removeAttribute("data-tone");
    else element.setAttribute("data-tone", previous);
    return painted;
  });
  expect(urgent).toContain("rgb(177, 58, 44)");
});

test("곁자리 [부적]으로 들어가도 화선지에 글자가 선다", async ({ page }) => {
  await openRun(page, "V038-TALISMAN");
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");

  const talismanAction = page.locator("#wave-action-a, #wave-action-b").filter({ hasText: "부적" }).first();
  await expect(talismanAction).toBeVisible();
  await talismanAction.click({ force: true });

  /*
   * 준비는 탭바 단추의 click 리스너 안에만 있었다 — 곁자리로 들어오면 종이가
   * 맨 종이로 남았고, 탭바를 한 번 눌러야 글자가 떴다("부적 버튼 누르면 한자
   * 로딩 안되는 버그" — 사용자). 실측: 곁자리 0픽셀 / 탭바 5,959픽셀.
   * 프레임 루프(rAF)에 기대지 않는 것이 요점이라 대기 없이 곧바로 잰다.
   */
  await expect.poll(async () => page.evaluate(() => {
    const qa = (window as unknown as { __HANJA_TALISMAN_QA__: TalismanQa }).__HANJA_TALISMAN_QA__;
    return qa.currentChar();
  })).not.toBeNull();

  const ink = await page.locator("#talisman-guide").evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (!context) return 0;
    const { data } = context.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height);
    let painted = 0;
    for (let index = 3; index < data.length; index += 4) if ((data[index] ?? 0) > 8) painted += 1;
    return painted;
  });
  expect(ink).toBeGreaterThan(1_000);
  await expect(page.locator("#talisman-reading")).not.toHaveText("글자를 준비하는 중");
});
