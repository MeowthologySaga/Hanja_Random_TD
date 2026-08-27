// 트랙 W — 2차 감사 후속. 전장 라벨 겹침 · 접힘 신호 · 연출 Esc · 표기 전환.
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // 코치·1회성 안내가 클릭을 가로채지 않도록 이미 본 사용자로 시작한다.
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
});

interface QaHandle {
  readonly engine: {
    readonly state: {
      gold: number;
      wave: number;
      prepRemaining: number;
      lastMessage: string;
      readonly towers: readonly unknown[];
      readonly enemies: readonly unknown[];
    };
  };
}

/**
 * 밀집 판을 세운다 — 웨이브 60 · 자령 16기 · 적 한계 90%.
 * 감사가 "약점 171"이 명패를 덮는 것을 본 조건이다.
 */
async function stageDenseBoard(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/?seed=TRACK-W-DENSE&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "prep");

  // 첫 소환이 시작 오행진 하나(16칸)를 무료로 연다.
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();

  // 개발자 모드 — 웨이브 점프와 적 채우기 손잡이를 연다.
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await expect(page.locator("#dev-tools-button")).toBeVisible();
  await page.locator("#dev-tools-button").click();
  await expect(page.locator("#dev-tools-panel")).toBeVisible();

  // 10연 소환은 10웨이브에 열린다 — 웨이브를 먼저 옮기고 자령을 채운다.
  await page.evaluate(() => {
    const state = (window as unknown as { __HANJA_CTX_QA__: QaHandle }).__HANJA_CTX_QA__.engine.state;
    state.gold = 100_000;
    state.wave = 59;
    state.prepRemaining = 0;
  });
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "combat", { timeout: 15_000 });

  // 10연 두 번이면 열린 진 16칸이 가득 찬다(남는 자령은 보관고로 간다).
  for (let round = 0; round < 2; round += 1) {
    await page.getByTestId("multi-summon-button").click();
    await page.locator("#summon-reveal-close").click();
  }
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __HANJA_CTX_QA__: QaHandle }).__HANJA_CTX_QA__.engine.state.towers.length))
    .toBeGreaterThanOrEqual(16);

  await page.locator("#dev-enemy-fill").click();
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __HANJA_CTX_QA__: QaHandle }).__HANJA_CTX_QA__.engine.state.enemies.length))
    .toBeGreaterThan(40);
  // 패널이 전장을 가리지 않게 접는다 — 스크린샷과 자리 측정 모두를 위해.
  await page.locator("#dev-tools-close").click();
}

/*
 * ── 트랙 W #1 · 피해 수치가 명패·능력 배너를 덮는다 ────────────────
 * 1차 수술은 자리 등록(occupied.push)을 `avoidOverlap` 안에 두어, 그 옵션을
 * 넘기는 피해 플로터만 자리를 잡았다. 명패·능력 배너·오행진 이름표는 등록도
 * 회피도 없어 피해 수치가 그 위에 그대로 얹혔다(피해 수치가 더 위층이다).
 */
test("lifts damage numbers clear of nameplates, ability banners and zone labels", async ({ page }) => {
  await stageDenseBoard(page);

  const report = await page.evaluate(async () => {
    // tsc 가 dev 서버 경로를 모듈로 풀지 못하므로 track-s 선례대로 변수로 넘긴다.
    const labelsSpecifier = "/src/ui/battle/stage-labels.ts";
    const labels = await import(labelsSpecifier) as typeof import("../src/ui/battle/stage-labels");
    const frames: Array<ReadonlyArray<{ left: number; top: number; right: number; bottom: number; kind: string }>> = [];
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        frames.push(labels.stageLabelBoxes().map((box) => ({ ...box })));
        if (frames.length >= 240) resolve();
        else window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    });
    const hit = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a): boolean =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    let damageOverStatic = 0;
    let damageOverDamage = 0;
    let peakBoxes = 0;
    let plaqueFrames = 0;
    let damageFrames = 0;
    let damageBoxes = 0;
    let dirtyDamageBoxes = 0;
    let peakPlaques = 0;
    for (const boxes of frames) {
      peakBoxes = Math.max(peakBoxes, boxes.length);
      const damage = boxes.filter((box) => box.kind === "damage");
      const statics = boxes.filter((box) => box.kind !== "damage");
      peakPlaques = Math.max(peakPlaques, statics.filter((box) => box.kind === "plaque").length);
      if (statics.some((box) => box.kind === "plaque")) plaqueFrames += 1;
      if (damage.length > 0) damageFrames += 1;
      damageBoxes += damage.length;
      for (let index = 0; index < damage.length; index += 1) {
        const box = damage[index]!;
        let dirty = false;
        for (const other of statics) if (hit(box, other)) { damageOverStatic += 1; dirty = true; }
        for (let other = index + 1; other < damage.length; other += 1) if (hit(box, damage[other]!)) damageOverDamage += 1;
        if (dirty) dirtyDamageBoxes += 1;
      }
    }
    return { frames: frames.length, plaqueFrames, damageFrames, peakBoxes, peakPlaques, damageBoxes, dirtyDamageBoxes, damageOverStatic, damageOverDamage };
  });

  // 실측 기록(트랙 W). 옛 규칙을 같은 판에서 되돌려 잰 값:
  //   피해 수치 1,758개 중 1,224개(69.6%)가 명패·배너·진 이름표 위에 앉았고
  //   정적 라벨 겹침은 1,747건, 피해 수치끼리 겹침은 143건이었다.
  console.log("[track-w#1]", JSON.stringify(report));
  await page.screenshot({ path: ".claude/uiux/track-w/01-dense-labels-after.png" });

  // 측정이 실제로 밀집 판을 봤는지부터 확인한다 — 0/0 은 증거가 아니다.
  expect(report.plaqueFrames).toBeGreaterThan(200);
  expect(report.damageFrames).toBeGreaterThan(100);
  expect(report.peakPlaques).toBeGreaterThanOrEqual(16);
  expect(report.damageBoxes).toBeGreaterThan(600);
  expect(report.damageOverStatic).toBe(0);
  expect(report.damageOverDamage).toBe(0);
});

/*
 * ── 트랙 W #2 · 접힘 신호 없는 스크롤 면 5곳 ──────────────────────
 * 넘치는데 스크롤바 자리도 하단 페이드도 없어, 보이는 만큼이 전부로 읽혔다.
 * 셋은 `<dialog>` 안이라 닫혀 있을 때 스윕이 조용히 건너뛰는지도 함께 잰다.
 */
test("marks the five newly found scroll surfaces as scrollable with more below", async ({ page }) => {
  await page.goto("/?seed=TRACK-W-SCROLL&mode=standard");
  await page.getByTestId("start-run").click();
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();

  const probe = async (selector: string): Promise<{ clipped: number; scrollable: string | null; more: string | null; surface: boolean }> =>
    page.evaluate((target) => {
      const element = document.querySelector<HTMLElement>(target);
      if (!element) return { clipped: -1, scrollable: null, more: null, surface: false };
      return {
        clipped: element.scrollHeight - element.clientHeight,
        scrollable: element.dataset.scrollable ?? null,
        more: element.dataset.scrollMore ?? null,
        surface: element.classList.contains("scroll-surface")
      };
    }, selector);

  // 닫힌 다이얼로그 안의 면은 신호를 달지 않는다 — 접힌 면을 "다 숨었다"로
  // 오판하지 않게 syncSurface 가 먼저 거른다.
  for (const selector of ["#codex-list", "#codex-detail", "#help-dialog > form"]) {
    const closed = await probe(selector);
    expect(closed.scrollable, `${selector} while closed`).toBeNull();
  }

  const seen: Record<string, unknown> = {};

  // ① 강화 탭 → 제련소 프레임의 오행 강화 목록(탭 진입이 곧 프레임 진입이다).
  await page.locator("#growth-tab").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-focus-frame", "growth");
  await expect.poll(async () => (await probe("#growth-upgrade-list")).more).toBe("1");
  seen["#growth-upgrade-list"] = await probe("#growth-upgrade-list");
  await page.screenshot({ path: ".claude/uiux/track-w/02-scroll-growth-upgrade-list.png" });
  await page.keyboard.press("Escape");

  // ② 목표 탭 → 성어 서책의 카드 격자
  await page.locator("#goal-tab").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-focus-frame", "goal");
  await expect.poll(async () => (await probe("#goal-selector-list")).more).toBe("1");
  seen["#goal-selector-list"] = await probe("#goal-selector-list");
  await page.screenshot({ path: ".claude/uiux/track-w/03-scroll-goal-selector-list.png" });
  await page.keyboard.press("Escape");

  // ③④ 도감 — 목록과 상세는 한 창 안에 나란히 선다.
  await page.locator("#codex-button").click();
  await expect(page.locator("#codex-dialog")).toBeVisible();
  await expect.poll(async () => (await probe("#codex-list")).more).toBe("1");
  seen["#codex-list"] = await probe("#codex-list");
  await expect.poll(async () => (await probe("#codex-detail")).more).toBe("1");
  seen["#codex-detail"] = await probe("#codex-detail");
  await page.screenshot({ path: ".claude/uiux/track-w/04-scroll-codex.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#codex-dialog")).toBeHidden();

  // ⑤ 도움말 본문
  await page.locator("#help-button").click();
  await expect(page.locator("#help-dialog")).toBeVisible();
  await expect.poll(async () => (await probe("#help-dialog > form")).more).toBe("1");
  seen["#help-dialog > form"] = await probe("#help-dialog > form");
  await page.screenshot({ path: ".claude/uiux/track-w/05-scroll-help-form.png" });
  await page.keyboard.press("Escape");

  console.log("[track-w#2]", JSON.stringify(seen));
  for (const [selector, state] of Object.entries(seen)) {
    const probed = state as { clipped: number; scrollable: string | null; more: string | null; surface: boolean };
    expect(probed.surface, `${selector} carries .scroll-surface`).toBe(true);
    expect(probed.clipped, `${selector} really clips`).toBeGreaterThan(0);
    expect(probed.scrollable, `${selector} scrollable flag`).toBe("1");
    expect(probed.more, `${selector} more-below flag`).toBe("1");
  }

  // 창을 닫으면 신호도 걷힌다 — 다음 프레임 스윕이 조용히 지운다.
  await expect.poll(async () => (await probe("#help-dialog > form")).scrollable).toBeNull();
});

/*
 * ── 트랙 W #3 · 소환 연출이 Esc 를 안 받고 스스로 걷히지도 않는다 ──
 * 연출은 `<dialog>` 가 아니라 `<section>` 이라 Esc 를 받는 이가 없었고,
 * 다장 연출에는 자동 숨김 타이머조차 없어 클릭 전까지 전투 정지가 무기한
 * 이어졌다(summon-reveal.ts 의 `events.length === 1` 분기).
 */
test("closes the summon reveal with Escape and auto-hides multi-card reveals", async ({ page }) => {
  await page.goto("/?seed=TRACK-W-REVEAL&mode=standard");
  await page.getByTestId("start-run").click();

  // ① 한 장짜리 — Esc 로 닫힌다. 정지도 함께 풀린다.
  await page.getByTestId("summon-button").click();
  await expect(page.locator("#summon-reveal")).toHaveClass(/is-active/u);
  await expect(page.locator("#pause-reason")).toHaveText("Esc·클릭으로 계속");
  await page.screenshot({ path: ".claude/uiux/track-w/07-reveal-before-escape.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#summon-reveal")).not.toHaveClass(/is-active/u);
  await expect(page.locator("#pause-chip")).toBeHidden();
  await page.screenshot({ path: ".claude/uiux/track-w/08-reveal-after-escape.png" });

  // 연출이 없을 때의 Esc 는 집중 프레임 몫이다 — 캡처 단계가 삼키지 않는다.
  await page.locator("#growth-tab").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-focus-frame", "growth");
  await page.keyboard.press("Escape");
  await expect(page.locator(".game-shell")).not.toHaveAttribute("data-focus-frame", "growth");

  // ② 10연 — 자동 숨김이 실제로 걷는다. 대기 시간은 실측 근거로 정한 값이다.
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await page.evaluate(() => {
    const state = (window as unknown as { __HANJA_CTX_QA__: QaHandle }).__HANJA_CTX_QA__.engine.state;
    state.gold = 100_000;
    state.wave = 12;
    state.prepRemaining = 0;
  });
  await page.locator("#dev-tools-close").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "combat", { timeout: 15_000 });

  const hold = await page.evaluate(async () => {
    const specifier = "/src/ui/summon-reveal.ts";
    const module = await import(specifier) as typeof import("../src/ui/summon-reveal");
    return [1, 3, 10, 20].map((count) => [count, module.summonRevealHoldMs(count)]);
  });
  console.log("[track-w#3] hold(ms)", JSON.stringify(hold));
  expect(hold).toEqual([[1, 3_800], [3, 5_100], [10, 9_650], [20, 12_000]]);

  await page.locator("#shop-tab").click();
  await page.getByTestId("multi-summon-button").click();
  await expect(page.locator("#summon-reveal")).toHaveClass(/is-active/u);
  await expect(page.locator("#summon-reveal-list .summon-result-card")).toHaveCount(10);
  await page.screenshot({ path: ".claude/uiux/track-w/09-reveal-ten-pull.png" });
  // 9.65초 뒤에 스스로 걷힌다 — 옛 동작은 여기서 영원히 서 있었다.
  await expect(page.locator("#summon-reveal")).toHaveClass(/is-active/u, { timeout: 2_000 });
  await expect(page.locator("#summon-reveal")).not.toHaveClass(/is-active/u, { timeout: 12_000 });
});

/*
 * ── 트랙 W #4 · 첫 안내 문장이 잘리는데 곁말이 없다 ────────────────
 * 바닥 줄의 글 자리는 354px 인데 웨이브 0 안내는 380.25px 이라 26.25px 이
 * 말줄임으로 잘렸고, 개발자 모드에서는 시드가 자리를 나눠 155.8px 이 잘렸다.
 * 곁말(title)이 없어 잘린 뒤를 볼 데가 아예 없었다.
 */
test("gives the clipped footer message a full-text tooltip", async ({ page }) => {
  await page.goto("/?seed=TRACK-W-FOOTER&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "prep");

  const measure = async (): Promise<{ text: string; title: string; shown: number; natural: number; seed: number }> =>
    page.evaluate(() => {
      const value = document.querySelector<HTMLElement>("#message-value")!;
      const seed = document.querySelector<HTMLElement>("#footer-seed")!;
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;";
      probe.style.font = getComputedStyle(value).font;
      probe.textContent = value.textContent;
      document.body.append(probe);
      const natural = probe.getBoundingClientRect().width;
      probe.remove();
      return {
        text: value.textContent ?? "",
        title: value.title,
        shown: Math.round(value.getBoundingClientRect().width * 100) / 100,
        natural: Math.round(natural * 100) / 100,
        seed: Math.round(seed.getBoundingClientRect().width * 100) / 100
      };
    });

  const plain = await measure();
  // 개발자 모드가 꺼져 있으면 시드는 display:none 이라 문장이 자리를 온전히 쓴다.
  expect(plain.seed).toBe(0);
  expect(plain.shown).toBe(354);
  expect(plain.natural).toBeGreaterThan(plain.shown);
  expect(plain.title).toBe(plain.text);
  await page.screenshot({ path: ".claude/uiux/track-w/10-footer-tooltip-plain.png" });

  // 개발자 모드에서는 시드가 자리를 나눠 가진다 — 그래도 곁말은 전문을 준다.
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await expect.poll(async () => (await measure()).seed).toBeGreaterThan(50);
  const dev = await measure();
  expect(dev.shown).toBeLessThan(plain.shown);
  expect(dev.title).toBe(dev.text);
  console.log("[track-w#4]", JSON.stringify({ plain, dev }));

  // 다 보이는 짧은 문장에는 곁말을 달지 않는다 — 툴팁이 소음이 되지 않게.
  await page.evaluate(() => {
    (window as unknown as { __HANJA_CTX_QA__: QaHandle }).__HANJA_CTX_QA__.engine.state.lastMessage = "짧은 문장";
  });
  await expect.poll(async () => (await measure()).text).toBe("짧은 문장");
  expect((await measure()).title).toBe("");
});
