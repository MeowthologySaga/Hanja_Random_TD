/*
 * 프레임마다 나가는 그림자 드로우 수를 못 박는다 (v042).
 *
 * 실측이 세운 게이트다. 자령 80·적 0 판에서 이미 프레임의 **45%가 20ms 를 넘고**
 * (41.5fps), 같은 장면에서 `shadowBlur` 만 0 으로 강제하면 60.5fps · 초과 0%가 된다 —
 * 이 장면에서 예산을 넘기는 원인은 그림자 **단독**이다. 그리고 봇 4시드 107,380 교전
 * 틱 가운데 **74.2%가 자령 80**이다. 「밀집 판」이 잘못된 이름이었다: 비싼 것은
 * 군중이 아니라 판이고, 값은 자령 한 기당 나가는 그림자 드로우 수에 있다.
 *
 * **이 자리는 다른 어떤 게이트도 안 잡는다.** 봇은 ctx 를 안 만지고(autoplay.ts),
 * vitest 는 node 환경이라 캔버스가 없고, 잘림 검사는 DOM 만 본다. 비용이 전부 래스터라
 * JS 프로파일러에도 안 잡힌다.
 *
 * 그래서 **값이 아니라 호출 수**를 센다. FB6 은 blur 크기만 25% 깎고 호출 수는 그대로
 * 뒀는데, 크기를 깎는 손질은 이 시험을 통과하면서도 문제를 안 고친다.
 */
import { expect, test, type Page } from "@playwright/test";

/** 한 프레임에 `shadowBlur > 0` 인 채로 나간 그리기 호출. */
interface ShadowFrame {
  fill: number;
  stroke: number;
  fillText: number;
  strokeText: number;
  drawImage: number;
  total: number;
}

async function countShadowDraws(page: Page): Promise<ShadowFrame> {
  return page.evaluate(async () => {
    const proto = (window as unknown as { CanvasRenderingContext2D: { prototype: Record<string, unknown> } }).CanvasRenderingContext2D.prototype;
    const names = ["fill", "stroke", "fillText", "strokeText", "drawImage"] as const;
    const tally: Record<string, number> = {};
    const originals: Record<string, (...args: unknown[]) => unknown> = {};
    for (const name of names) {
      originals[name] = proto[name] as (...args: unknown[]) => unknown;
      proto[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]): unknown {
        if (this.shadowBlur > 0) tally[name] = (tally[name] ?? 0) + 1;
        return (originals[name] as (...a: unknown[]) => unknown).apply(this, args);
      };
    }
    // 두 프레임을 흘려 계측을 데운 뒤 **한 프레임**만 센다.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = { ...tally };
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const after = { ...tally };
    for (const name of names) proto[name] = originals[name];
    const frame: Record<string, number> = { fill: 0, stroke: 0, fillText: 0, strokeText: 0, drawImage: 0, total: 0 };
    for (const name of names) {
      const delta = (after[name] ?? 0) - (before[name] ?? 0);
      frame[name] = delta;
      frame.total += delta;
    }
    return frame as unknown as ShadowFrame;
  });
}

test("자령 한 기가 프레임마다 지는 그림자 값이 예산 안에 든다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=SHADOW-BUDGET&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");

  // 첫 진 한 판(16칸)을 채운다 — 재현 가능한 최소 장면이다.
  const towers = await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function"
      ? (handle as () => { engine: { state: { gold: number; towers: unknown[] }; summon(): unknown } })()
      : handle) as { engine: { state: { gold: number; towers: unknown[] }; summon(): unknown } };
    for (let index = 0; index < 40; index += 1) {
      ctx.engine.state.gold += 1_000;
      try {
        ctx.engine.summon();
      } catch {
        // 진이 차면 보관고로 간다 — 그것도 이 장면의 일부다.
      }
    }
    return ctx.engine.state.towers.length;
  });
  expect(towers).toBe(16);

  const frame = await countShadowDraws(page);

  /*
   * **절대값이 아니라 자령당 값으로 잡는다.**
   *
   * 절대값으로 못 박아 봤더니 시드마다 흔들렸다(같은 16기 장면에서 103과 106) —
   * 무엇이 소환됐느냐에 따라 충전 고리·극성 오라가 붙었다 떨어진다. 이 시험이 지켜야
   * 하는 것은 장면의 총합이 아니라 **자령 한 기가 지는 값**이고, 그 값이 자령 수에
   * 곱해져 80기 판을 무너뜨린다.
   *
   * 두 시드에서 고친 뒤와 되돌린 뒤를 각각 재서 문턱을 그 사이에 놓았다.
   *
   * |            | 자령당 전체 | 자령당 테 |
   * |------------|-----------:|---------:|
   * | 고친 뒤    | 6.44~6.63  | 2.00~2.25 |
   * | **문턱**   | **7.0**    | **2.6**   |
   * | 겹치던 때  | 7.44~7.63  | 3.00~3.25 |
   *
   * 문턱을 처음에는 7.5/3.0 으로 잡았다가 **되돌린 코드가 그대로 통과하는 것을 보고**
   * 조였다. 회귀에서 안 붉어지는 게이트는 게이트가 아니다.
   */
  const perTower = frame.total / towers;
  expect(perTower).toBeLessThanOrEqual(7.0);

  /*
   * 테 그림자만 따로 — 별딱지가 같은 도형에 그림자를 두 번 치던 회귀를 정확히 겨눈다.
   */
  expect(frame.stroke / towers).toBeLessThanOrEqual(2.6);
});
