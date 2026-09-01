/* 임시 — 상단 띠·행동 자리 실측. 커밋하지 않는다. */
import { expect, test, type Page } from "@playwright/test";

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=LAYOUT&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
}

const boxes = async (page: Page): Promise<unknown> =>
  page.evaluate(() => {
    const at = (selector: string): unknown => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
    };
    const bar = document.querySelector(".stage-topbar")!.getBoundingClientRect();
    const chips = [...document.querySelectorAll(".stage-topbar > *")].map((chip) => ({
      cls: chip.className,
      w: Math.round(chip.getBoundingClientRect().width),
      hidden: chip.getBoundingClientRect().width === 0
    }));
    return {
      topbar: { w: Math.round(bar.width), h: Math.round(bar.height), bottom: Math.round(bar.bottom) },
      chips,
      waveInfo: at(".stage-chip--wave-info"),
      briefing: at("#wave-briefing"),
      briefingClipped: (() => {
        const b = document.querySelector("#wave-briefing") as HTMLElement | null;
        return b ? b.scrollWidth - b.clientWidth : null;
      })(),
      card: at(".wave-card"),
      clock: at("#wave-kicker"),
      row: at("#wave-action-row"),
      early: at("#early-button"),
      actionA: at("#wave-action-a"),
      actionB: at("#wave-action-b"),
      chipStyle: (() => {
        const c = document.querySelector(".stage-chip--wave-info") as HTMLElement | null;
        if (!c) return null;
        const cs = getComputedStyle(c);
        return { padding: cs.padding, minHeight: cs.minHeight, display: cs.display, rowGap: cs.rowGap, alignItems: cs.alignItems, lineHeight: cs.lineHeight, fontSize: cs.fontSize };
      })(),
      siblingStyle: (() => {
        const c = document.querySelector(".stage-chip--region") as HTMLElement | null;
        if (!c) return null;
        const cs = getComputedStyle(c);
        return { padding: cs.padding, minHeight: cs.minHeight, h: Math.round(c.getBoundingClientRect().height) };
      })(),
      texts: {
        label: document.querySelector("#wave-label")?.textContent,
        weakness: document.querySelector("#wave-weakness")?.textContent,
        briefing: document.querySelector("#wave-briefing")?.textContent,
        clock: document.querySelector("#wave-kicker")?.textContent,
        early: document.querySelector("#early-button")?.textContent,
        a: document.querySelector("#wave-action-a")?.textContent,
        b: document.querySelector("#wave-action-b")?.textContent
      }
    };
  });

test("배치 실측", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  console.log("[첫 소환 전]", JSON.stringify(await boxes(page)));

  await page.getByTestId("summon-button").click();
  await page.waitForTimeout(600);
  console.log("[준비]", JSON.stringify(await boxes(page)));
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
  await page.screenshot({ path: "artifacts/v036-prep-1280x720.png" });

  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => any)() : handle) as any;
    ctx.engine.startWaveEarly();
  });
  await page.waitForTimeout(1_500);
  console.log("[교전]", JSON.stringify(await boxes(page)));
  await page.screenshot({ path: "artifacts/v036-combat-1280x720.png" });
});
