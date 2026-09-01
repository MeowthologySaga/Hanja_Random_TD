/*
 * 부적 리필·보상 개편(기획안 v035 ①).
 *
 * "웨이브당 리필 2개로 줄이고 보상을 농축하자. 그리고 획수가 많을수록 보상을
 * 더 많이줘. 그리고 경제적 보상외에도 화면 적을 공격해주던가하는 여러 이벤트도
 * 추가해보자"(사용자).
 *
 * 이 스펙이 지키는 것 셋.
 *  ① 한 웨이브에 오는 장수는 **2장**이다.
 *  ② 같은 주사위를 굴려도 **획이 많은 글자가 더 많이 준다**.
 *  ③ 경제 밖 보상이 실제로 **화면에서** 벌어진다 — 준비 시간이 늘고, 적이 맞는다.
 *
 * 보상 굴림은 `Math.random` 이라 그대로 두면 재현이 안 된다. 제출 직전에만
 * 그 주사위를 고정했다가 곧바로 되돌린다 — 엔진의 난수는 씨앗을 따로 쓰므로
 * 이 고정이 판 진행을 바꾸지 않는다.
 */
import { expect, test, type Page } from "@playwright/test";

interface RewardQaWindow {
  __HANJA_TALISMAN_QA__: {
    autoTrace(): void;
    submit(): void;
    present(char: string): boolean;
  };
  __HANJA_CTX_QA__: { engine: { state: { gold: number; phase: string; prepRemaining: number; enemies: unknown[] } } };
  __REAL_RANDOM__?: () => number;
}

const qaState = (page: Page): Promise<{ gold: number; phase: string; prepRemaining: number; enemies: number }> =>
  page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => RewardQaWindow["__HANJA_CTX_QA__"])() : handle) as RewardQaWindow["__HANJA_CTX_QA__"];
    const { gold, phase, prepRemaining, enemies } = ctx.engine.state;
    return { gold, phase, prepRemaining, enemies: enemies.length };
  });

test.beforeEach(async ({ page }) => {
  /*
   * QA 자동 따라쓰기는 마스크의 가로줄을 훑을 뿐 획순을 따르지 않는다. 기본으로
   * 켜져 있는 획순 안내를 그대로 두면 그 붓질이 판정에 떨어져 스스로 걷히므로
   * 여기서는 안내를 끈다 — 안내를 켠 흐름은 stroke-order 스펙의 몫이다.
   */
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:stroke-order-guide", "false");
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
});

async function openTalisman(page: Page, seed: string): Promise<void> {
  await page.goto(`/?seed=${seed}&mode=standard`);
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.locator("#talisman-tab").click();
  await expect(page.locator("#talisman-paper")).toBeVisible();
}

/** 주사위를 고정한 채 한 장을 써 보상을 받는다. 고정은 제출 동안만이다. */
async function submitWithRoll(page: Page, char: string, roll: number): Promise<void> {
  const presented = await page.evaluate((wanted) => {
    const qa = (window as unknown as RewardQaWindow).__HANJA_TALISMAN_QA__;
    return qa.present(wanted);
  }, char);
  expect(presented, `${char} 는 이 판의 자령 도감에 있어야 한다`).toBe(true);
  await page.waitForTimeout(420); // 종이 넘김이 끝나야 마스크가 새 글자로 선다.

  await page.evaluate(
    ([fixed]) => {
      const win = window as unknown as RewardQaWindow;
      win.__REAL_RANDOM__ = Math.random;
      Math.random = () => fixed as number;
      const qa = win.__HANJA_TALISMAN_QA__;
      qa.autoTrace();
      qa.submit();
      Math.random = win.__REAL_RANDOM__!;
    },
    [roll]
  );
  await expect(page.locator("#panel-toast")).toContainText("자령이 응답했습니다");
}

test("한 웨이브에 오는 부적은 두 장이다", async ({ page }) => {
  await openTalisman(page, "REWARD-COUNT");
  // 장수를 줄인 것이 이 개편의 뼈대다 — 부적에 쓰는 시간을 깎아 경영에 돌린다.
  await expect(page.getByTestId("talisman-charge-count")).toContainText("2장");
  await expect(page.locator("#talisman-charge-credit")).toContainText("+2");
});

test("획이 많은 글자가 같은 주사위에도 더 많이 준다", async ({ page }) => {
  test.setTimeout(120_000);
  await openTalisman(page, "REWARD-SCALE");
  /*
   * 첫 소환 전이라 시계가 멈춰 있다 — 적도 없고 엽전이 저절로 늘지도 않는다.
   * 보상만 오롯이 재는 자리다. 0.4 는 경제 밖 보상의 문턱(최대 0.35)보다
   * 위라 두 번 다 엽전 굴림으로 간다.
   */
  const start = await qaState(page);
  expect(start.phase).toBe("prep");
  expect(start.enemies).toBe(0);

  await submitWithRoll(page, "人", 0.4); // 2획
  const afterFew = await qaState(page);
  const fewGain = afterFew.gold - start.gold;

  await submitWithRoll(page, "鬱", 0.4); // 29획
  const afterMany = await qaState(page);
  const manyGain = afterMany.gold - afterFew.gold;

  expect(fewGain).toBeGreaterThan(0);
  // 획수 배수는 0.7~2.4배다. 2획과 29획이면 최소 두 배는 벌어져야 한다.
  expect(manyGain).toBeGreaterThan(fewGain * 2);
});

test("경제 밖 보상 — 준비 중에는 숨을 돌려준다", async ({ page }) => {
  test.setTimeout(120_000);
  await openTalisman(page, "REWARD-BREATH");
  const before = await qaState(page);
  expect(before.phase).toBe("prep");

  // 0 은 언제나 문턱 아래라 경제 밖 보상이 걸린다. 적이 없으니 남는 것은 숨뿐이다.
  await submitWithRoll(page, "人", 0);
  await expect(page.locator("#panel-toast")).toContainText("문기의 숨");

  const after = await qaState(page);
  // 첫 소환 전에는 준비 시계가 멈춰 있어 늘어난 만큼이 그대로 남는다.
  expect(after.prepRemaining).toBeGreaterThan(before.prepRemaining + 1.5);
});

test("경제 밖 보상 — 전장에 적이 있으면 내리친다", async ({ page }) => {
  test.setTimeout(120_000);
  await openTalisman(page, "REWARD-STRIKE");

  // 자령을 한 기 세워야 웨이브를 열 수 있고, 그래야 적이 나온다.
  await page.locator('.panel-tabs button[data-panel-tab="shop"]').click();
  await page.getByTestId("summon-button").click();
  await page.locator("#talisman-tab").click();
  await page.getByTestId("talisman-cue").click();
  await expect.poll(async () => (await qaState(page)).phase).toBe("combat");

  // 개발 손잡이로 전장을 채운다 — 내리칠 것이 있어야 내리치는지 본다.
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await page.locator("#dev-enemy-fill").click();
  await expect.poll(async () => (await qaState(page)).enemies).toBeGreaterThan(10);
  await page.locator("#dev-tools-close").click();
  await page.locator("#talisman-tab").click();

  await submitWithRoll(page, "人", 0);
  await expect(page.locator("#panel-toast")).toContainText("자령 강림");
});
