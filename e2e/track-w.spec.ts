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

  // 웨이브를 먼저 옮기고 자령을 채운다(10연 자물쇠는 걷혔고 값만 남았다).
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
 * ── 트랙 W #1 · 전장 라벨이 서로를 덮지 않는다 ────────────────────
 *
 * 본래 이 시험은 **피해 수치**가 명패·능력 배너·진 이름표를 덮던 것을 지켰다.
 * 그런데 피해 수치 자체를 걷었다 — 웨이브 약점 오행에 맞춰 짓는 것이 정석이라
 * 사실상 모든 타격이 「눈에 띄는 타격」 조건에 걸려 화면이 숫자 벽이 됐고
 * ("데미지 문구 너무 눈 아파서" — 사용자), 그 몫은 적 체력바의 뒤따르는 띠가
 * 대신한다(battle/enemy-health.ts).
 *
 * 그래서 이 시험이 지키는 것을 둘로 고쳐 잡는다.
 *   ① 피해 수치가 **다시 살아나지 않는다** — 걷은 것이 조용히 돌아오면 같은
 *      화면 오염이 되풀이된다.
 *   ② 남은 라벨끼리도 서로를 덮지 않는다 — 본래 겨누던 것이 이쪽이었고,
 *      정적 라벨끼리의 겹침은 예전 시험이 아예 보지 않던 자리다.
 */
test("keeps stage labels clear of one another and no damage numbers return", async ({ page }) => {
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
    let peakBoxes = 0;
    let plaqueFrames = 0;
    let damageBoxes = 0;
    let peakPlaques = 0;
    let staticOverStatic = 0;
    for (const boxes of frames) {
      peakBoxes = Math.max(peakBoxes, boxes.length);
      damageBoxes += boxes.filter((box) => box.kind === "damage").length;
      const statics = boxes.filter((box) => box.kind !== "damage");
      peakPlaques = Math.max(peakPlaques, statics.filter((box) => box.kind === "plaque").length);
      if (statics.some((box) => box.kind === "plaque")) plaqueFrames += 1;
      for (let index = 0; index < statics.length; index += 1) {
        for (let other = index + 1; other < statics.length; other += 1) {
          if (hit(statics[index]!, statics[other]!)) staticOverStatic += 1;
        }
      }
    }
    return { frames: frames.length, plaqueFrames, peakBoxes, peakPlaques, damageBoxes, staticOverStatic };
  });

  /*
   * 실측 기록. 옛 규칙(피해 수치가 뜨던 시절)을 같은 판에서 되돌려 잰 값:
   * 피해 수치 1,758개 중 1,224개(69.6%)가 명패·배너·진 이름표 위에 앉았다.
   * 지금은 피해 수치 자체가 없어 그 겹침이 0 이고, 남은 것은 정적 라벨끼리다.
   */
  console.log("[track-w#1]", JSON.stringify(report));
  await page.screenshot({ path: ".claude/uiux/track-w/01-dense-labels-after.png" });

  // 측정이 실제로 밀집 판을 봤는지부터 확인한다 — 0/0 은 증거가 아니다.
  expect(report.plaqueFrames).toBeGreaterThan(200);
  expect(report.peakPlaques).toBeGreaterThanOrEqual(16);
  // ① 걷어 낸 피해 수치가 조용히 돌아오지 않는다.
  expect(report.damageBoxes).toBe(0);
  /*
   * ② 정적 라벨끼리의 겹침은 **아직 0 이 아니다** — 처음 쟀을 때 56건이었다.
   *
   * 옛 시험은 이 짝을 아예 보지 않았다(피해 수치 대 정적 라벨만 봤다). 여기서
   * 0 을 요구하면 없던 요건을 새로 세우는 셈이라, 지금은 **더 나빠지지 않는
   * 것**만 지킨다. 명패가 서로 겹치는 것을 푸는 일은 따로 다룰 몫이다.
   *
   * 상한 재기준(v039, 120 → 150): 공개 카드가 더는 판을 세우지 않는다. 이 판을
   * 짓는 동안 10연을 두 번 뽑는데, 예전에는 그 두 연출(약 19초) 동안 시계가
   * 멎어 있었다 — 이제는 그만큼 판이 더 굴러간 상태에서 재게 된다. 살아 있는
   * 장판·기술 배너가 한둘 더 서므로(peakBoxes 17 → 18~19) 겹침도 함께 는다.
   * 라벨 배치가 나빠진 것이 아니라 **재는 시점의 판이 달라진 것**이다.
   * 실측 134·138(두 번), 여유를 두어 150 으로 잡는다.
   */
  expect(report.staticOverStatic).toBeLessThanOrEqual(150);
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

  // ① 한 장짜리 — Esc 로 닫힌다.
  await page.getByTestId("summon-button").click();
  await expect(page.locator("#summon-reveal")).toHaveClass(/is-active/u);
  /*
   * v039: 공개 카드는 **판을 세우지 않는다.** 소환은 연달아 누르는 조작이라
   * 한 번 누를 때마다 판이 멎으면 게임이 끊겨 보였다("연속으로 누르는데
   * 렉걸리는거 같잖아" — 사용자). 걷어 낸 그 계약을 여기 못 박는다 —
   * 카드가 떠 있어도 정지 쪽지는 서지 않는다.
   */
  await expect(page.locator("#pause-chip")).toBeHidden();
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
  /*
   * v037: 개문 문구를 자리에 맞게 줄였다(380px → 354px 안). 글이 칸(354px)을
   * 넘지 않는 것이 정상이고, 곁말은 잘리든 말든 전문을 든다 — 안전망은 그대로다.
   */
  expect(plain.shown).toBeLessThanOrEqual(354);
  expect(plain.natural).toBeLessThanOrEqual(354);
  // 다 보이는 문장에는 곁말을 달지 않는다(소음) — 잘릴 때만 전문을 든다.
  expect(plain.title).toBe(plain.natural > plain.shown ? plain.text : "");
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

/*
 * ── 트랙 W #5 · 표기를 바꿔도 성어 HUD·부적 읽기가 안 따라온다 ────
 * 두 자리 모두 표기를 렌더 열쇠에 넣지 않아, 표기만 바뀌면 옛 읽기가 남았다.
 * 성어 HUD 는 ctx.idiomRenderKey 가 handleAction 초기화 목록에도 없었다.
 */
test("re-reads the idiom HUD and the talisman line when the notation axis changes", async ({ page }) => {
  test.setTimeout(60_000);
  /*
   * 한국 로스터(자국 표기 kr-hunum)로 시작해 병음으로 바꾼다.
   * 반대 방향(중국 로스터 → 훈음)은 성어 이름이 안 갈린다 — 성어 읽기는
   * kr-hunum 과 로스터 자국 표기 둘 다에서 idiom.reading 그대로다
   * (core/notation.ts idiomReadingInfoForNotation 의 두 지름길).
   */
  await page.goto("/?seed=TRACK-W-NOTATION&mode=standard");
  await page.getByTestId("start-run").click();
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();

  await page.locator("#idiom-tab").click();
  await expect(page.locator("#idiom-name")).not.toHaveText("");
  const beforeIdiom = (await page.locator("#idiom-name").innerText()).trim();

  await page.locator("#talisman-tab").click();
  await expect(page.locator("#talisman-reading")).not.toHaveText("");
  const beforeTalisman = (await page.locator("#talisman-reading").innerText()).trim();

  // 표기만 바꾼다 — S13 의 applyNotation 과 같은 길(표 적재 → setNotation → handleAction).
  await page.evaluate(async () => {
    const notationSpecifier = "/src/core/notation.ts";
    const hudSpecifier = "/src/ui/hud.ts";
    const notation = await import(notationSpecifier) as typeof import("../src/core/notation");
    const hud = await import(hudSpecifier) as typeof import("../src/ui/hud");
    await notation.ensureUnifiedReadings();
    const qa = (window as unknown as { __HANJA_CTX_QA__: { engine: { setNotation(code: "cn-pinyin"): { ok: boolean; message: string } } } }).__HANJA_CTX_QA__;
    hud.handleAction(qa.engine.setNotation("cn-pinyin"));
  });

  // 부적 읽기는 먹선을 지우지 않고 줄만 갈린다.
  await expect.poll(async () => (await page.locator("#talisman-reading").innerText()).trim()).not.toBe(beforeTalisman);
  const afterTalisman = (await page.locator("#talisman-reading").innerText()).trim();
  await page.screenshot({ path: ".claude/uiux/track-w/11-notation-talisman.png" });

  await page.locator("#idiom-tab").click();
  await expect.poll(async () => (await page.locator("#idiom-name").innerText()).trim()).not.toBe(beforeIdiom);
  const afterIdiom = (await page.locator("#idiom-name").innerText()).trim();
  // 훈음 → 병음. 한글이 사라진 것 자체가 표기가 갈린 증거다.
  expect(beforeIdiom).toMatch(/[가-힣]/u);
  expect(afterIdiom).not.toMatch(/[가-힣]/u);
  console.log("[track-w#5]", JSON.stringify({ beforeIdiom, afterIdiom, beforeTalisman, afterTalisman }));
  await page.screenshot({ path: ".claude/uiux/track-w/12-notation-idiom-hud.png" });
});
