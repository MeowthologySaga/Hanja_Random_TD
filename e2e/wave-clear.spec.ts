/*
 * 「막았다」와 「무슨 뜻인가」가 전장에 있는가 (v042 2차).
 *
 * 실측이 이 스펙을 세웠다(6시드 592웨이브).
 *  · 준비 시간을 되찾은 웨이브 85%(503/592) — 판마다 76~86번 오는 순간인데 그 자리에서
 *    화면이 하던 일은 맨 아래 12px 한 줄이 바뀌는 것뿐이었다.
 *  · 한 웨이브 처치 신호 평균 27번 — 마지막 한 마리는 그 27번째와 구별되지 않는다.
 *  · 우두머리가 쓰러진 시각과 웨이브가 끝나는 시각은 같은 틱(58표본 중 54).
 *  · 성어 뜻은 104구 중앙 17자·최대 25자인데, 발동 순간 그 뜻이 화면 어디에도 없었다.
 *
 * 이 넷은 **시뮬 게이트가 못 본다** — 봇은 이벤트를 걷지도 읽지도 않고 화면을 안 만진다.
 * 단위 시험(tests/wave-clear.test.ts)이 이벤트와 문장을 잡고, 여기서는 그 값이
 * **실제 화면에 서는지**를 잡는다.
 */
import { expect, test, type Page } from "@playwright/test";

async function openRun(page: Page, seed: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:idiom-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto(`/?seed=${seed}&mode=standard`);
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
}

/** 엔진 메서드는 직렬화되지 않는다 — 페이지 안에서 부른다(v041 이 세운 규범). */
async function phaseOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function" ? (handle as () => { engine: { state: { phase: string } } })() : handle) as { engine: { state: { phase: string } } };
    return ctx.engine.state.phase;
  });
}

test("웨이브를 다 막으면 전장이 그렇게 말한다", async ({ page }) => {
  await openRun(page, "WAVE-CLEAR-E2E");
  await page.getByTestId("early-wave").click({ force: true });
  await expect.poll(async () => phaseOf(page)).toBe("combat");

  // 마지막 한 마리를 접는다 — 스폰을 완료 처리해야 엔진이 finishWave 로 간다.
  const wave = await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function"
      ? (handle as () => { engine: { state: { enemies: unknown[]; spawned: number; wave: number }; getCurrentPlan(): { count: number } | null } })()
      : handle) as { engine: { state: { enemies: unknown[]; spawned: number; wave: number }; getCurrentPlan(): { count: number } | null } };
    const plan = ctx.engine.getCurrentPlan();
    ctx.engine.state.enemies = [];
    if (plan) ctx.engine.state.spawned = plan.count;
    return ctx.engine.state.wave;
  });

  const banner = page.locator(".boss-banner");
  await expect(banner).toHaveClass(/boss-banner--clear/u, { timeout: 10_000 });
  await expect(banner).toHaveText(new RegExp(`웨이브 ${wave} 방어 성공`, "u"));
  // 인주(온다)도 금박(발동했다)도 아니어야 한다 — 「막았다」는 제3의 옷이다.
  await expect(banner).not.toHaveClass(/boss-banner--boss/u);
  await expect(banner).not.toHaveClass(/boss-banner--idiom/u);
  // 띠는 1.2초만 산다 — 사라지기 전에 찍는다.
  await page.screenshot({ path: "artifacts/v042-wave-clear-banner-1280x720.png" });
  await expect.poll(async () => phaseOf(page)).toBe("prep");
});

test("띠가 전장 안에 들고 한 줄로 선다", async ({ page }) => {
  await openRun(page, "WAVE-CLEAR-FIT");
  await page.getByTestId("early-wave").click({ force: true });
  await expect.poll(async () => phaseOf(page)).toBe("combat");
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function"
      ? (handle as () => { engine: { state: { enemies: unknown[]; spawned: number }; getCurrentPlan(): { count: number } | null } })()
      : handle) as { engine: { state: { enemies: unknown[]; spawned: number }; getCurrentPlan(): { count: number } | null } };
    const plan = ctx.engine.getCurrentPlan();
    ctx.engine.state.enemies = [];
    if (plan) ctx.engine.state.spawned = plan.count;
  });
  const banner = page.locator(".boss-banner");
  await expect(banner).toHaveClass(/boss-banner--clear/u, { timeout: 10_000 });
  const box = await banner.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const stage = document.querySelector("#battle-canvas")?.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      left: rect.left,
      right: rect.right,
      stageLeft: stage?.left ?? 0,
      stageRight: stage?.right ?? 0,
      // line-height 가 normal 이면 계산값이 수치가 아니다 — 글자 크기로 되돌린다.
      fontSize: Number.parseFloat(getComputedStyle(node).fontSize)
    };
  });
  // 말줄임도 줄바꿈도 없이 든다.
  expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
  // 두 줄로 접히지 않는다 — 띠는 한 줄짜리 자리다(안쪽 여백 위아래 10px 을 얹어 잡는다).
  expect(box.height).toBeLessThan(box.fontSize * 1.6 + 20 + 8);
  // 전장 밖으로 나가지 않는다.
  expect(box.left).toBeGreaterThanOrEqual(box.stageLeft - 1);
  expect(box.right).toBeLessThanOrEqual(box.stageRight + 1);
});

/*
 * 띠에 서는 넷이 전부 한 줄로 선다.
 *
 * 이 띠는 `left:50%` 에 너비가 없어 줄어들어-맞추기의 가용 폭이 880−440=440px 로
 * 잘려 있었다(transform 은 레이아웃 폭을 안 돌려준다). 880px 전장에서 실측하면
 * 우두머리 573px · 첫 발동 축하 511px · 웨이브 청소 476px 로 **넷 중 셋이 넘쳤고**,
 * 잘리지 않고 두 줄이 되므로 v041 잘림 검사가 못 잡았다.
 *
 * 아래 문자열은 실제 로스터·웨이브 계획을 전수로 태워 뽑은 최장이다. 새 표기 축이나
 * 더 긴 훈음이 들어와 한 줄을 넘기면 여기서 걸린다.
 */
const LONGEST_BANNERS: ReadonlyArray<{ kind: string; text: string }> = [
  { kind: "wave", text: "웨이브 11 · 軻 수레 가기 힘들 가 · 약점 木" },
  { kind: "boss", text: "⚠ 우두머리 100 · 軻 수레 가기 힘들 가 · 약점 水 · 제한 126초 ⚠" },
  // 실제로 나갈 수 있는 최장 — 웨이브 계획의 보상과 이자 상한 20으로 전수 계산한 값이다.
  { kind: "clear", text: "우두머리 100 봉인 · 제한 125.9초 남김 · +46엽전 · 은행 이자 +20엽전" },
  { kind: "firstSeal", text: "첫 발동 이심전심! 발동 중 성어는 전장 왼쪽에 표시됩니다" }
];

test("가장 긴 띠 문구도 한 줄로 서고 전장을 안 넘는다", async ({ page }) => {
  await openRun(page, "BANNER-WIDTH");
  const measured = await page.evaluate((rows) => {
    const banner = document.querySelector<HTMLElement>("#boss-banner");
    const stage = document.querySelector("#battle-canvas")?.getBoundingClientRect();
    if (!banner || !stage) return [];
    const previous = banner.textContent;
    // 띄워 놓고 재야 한다 — opacity 0 인 채로도 상자는 잡히지만 보이게 두면 눈으로도 는다.
    banner.classList.add("boss-banner--visible");
    const out = rows.map((row) => {
      banner.textContent = row.text;
      const rect = banner.getBoundingClientRect();
      const line = Number.parseFloat(getComputedStyle(banner).fontSize) * 1.6
        + Number.parseFloat(getComputedStyle(banner).paddingTop)
        + Number.parseFloat(getComputedStyle(banner).paddingBottom);
      return {
        kind: row.kind,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        oneLine: Math.ceil(line) + 4,
        left: Math.round(rect.left - stage.left),
        right: Math.round(rect.right - stage.left),
        stageWidth: Math.round(stage.width)
      };
    });
    banner.textContent = previous;
    banner.classList.remove("boss-banner--visible");
    return out;
  }, LONGEST_BANNERS);

  expect(measured).toHaveLength(LONGEST_BANNERS.length);
  const wrapped = measured.filter((row) => row.height > row.oneLine);
  expect(wrapped.map((row) => `${row.kind} ${row.height}px > ${row.oneLine}px`)).toEqual([]);
  const spilled = measured.filter((row) => row.left < 0 || row.right > row.stageWidth);
  expect(spilled.map((row) => `${row.kind} ${row.left}..${row.right} / ${row.stageWidth}`)).toEqual([]);
});

test("우두머리를 눕히면 조인 시계가 풀린다", async ({ page }) => {
  await openRun(page, "BOSS-RELEASE-E2E");
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await page.locator("#dev-wave-boss").click();
  await page.locator("#dev-tools-close").click();

  const clock = page.locator("#boss-clock");
  await expect.poll(
    async () =>
      page.evaluate(() => {
        const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
        const ctx = (typeof handle === "function" ? (handle as () => { engine: { bossTimeRemaining(): number | null } })() : handle) as { engine: { bossTimeRemaining(): number | null } };
        return ctx.engine.bossTimeRemaining() !== null;
      }),
    { timeout: 30_000 }
  ).toBe(true);
  await expect(clock).toBeVisible();

  /*
   * 우두머리만 눕히고 잔존은 남긴다 — 실측 7%가 그 길이고, 거기서는 청소 띠가
   * 안 서므로 **시계가 직접** 말해야 한다. 여태 이 자리에서 시계는 그냥 사라졌다.
   */
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function"
      ? (handle as () => { engine: { state: { bossDefeated: boolean; enemies: Array<{ boss: boolean }> } } })()
      : handle) as { engine: { state: { bossDefeated: boolean; enemies: Array<{ boss: boolean }> } } };
    ctx.engine.state.enemies = ctx.engine.state.enemies.filter((enemy) => !enemy.boss);
    ctx.engine.state.bossDefeated = true;
  });

  await expect(clock).toHaveAttribute("data-alert", "clear", { timeout: 10_000 });
  await expect(page.locator("#boss-clock-time")).toHaveText("우두머리 봉인");
  await expect(page.locator("#boss-clock-note")).toHaveText(/멈췄습니다/u);
  await page.screenshot({ path: "artifacts/v042-boss-clock-release-1280x720.png" });
  /*
   * 붙들고 있지 않는다 — 2.5초 뒤에는 자리를 비운다.
   *
   * 이 줄이 v041 의 거짓말을 잡아냈다. 교전 중 미리 보기를 안 걸러 내던 탓에
   * 「잡았다」가 걷힌 뒤 시계가 **정지한 「우두머리 72초」로 되살아났다** — 이미 끝난
   * 싸움을 아직 안 시작한 것처럼 말한 셈이다(hud.ts bossClockPreview 참조).
   */
  await expect(clock).toBeHidden({ timeout: 15_000 });
});

test("우두머리를 눕힌 뒤 시계가 「제한 72초」로 되살아나지 않는다", async ({ page }) => {
  await openRun(page, "BOSS-CLOCK-LIE");
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await page.locator("#dev-wave-boss").click();
  await page.locator("#dev-tools-close").click();
  await expect.poll(
    async () =>
      page.evaluate(() => {
        const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
        const ctx = (typeof handle === "function" ? (handle as () => { engine: { bossTimeRemaining(): number | null } })() : handle) as { engine: { bossTimeRemaining(): number | null } };
        return ctx.engine.bossTimeRemaining() !== null;
      }),
    { timeout: 30_000 }
  ).toBe(true);
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function"
      ? (handle as () => { engine: { state: { bossDefeated: boolean; enemies: Array<{ boss: boolean }> } } })()
      : handle) as { engine: { state: { bossDefeated: boolean; enemies: Array<{ boss: boolean }> } } };
    ctx.engine.state.enemies = ctx.engine.state.enemies.filter((enemy) => !enemy.boss);
    ctx.engine.state.bossDefeated = true;
  });
  // 「잡았다」가 걷히고도 교전이 이어지는 창을 넉넉히 지나 본다.
  await page.waitForTimeout(6_000);
  const seen = await page.evaluate(() => {
    const clock = document.querySelector<HTMLElement>("#boss-clock");
    const state = (() => {
      const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
      const ctx = (typeof handle === "function" ? (handle as () => { engine: { state: { phase: string } } })() : handle) as { engine: { state: { phase: string } } };
      return ctx.engine.state;
    })();
    return { phase: state.phase, hidden: clock?.hidden ?? true, text: clock?.querySelector("#boss-clock-time")?.textContent ?? "" };
  });
  if (seen.phase === "combat") {
    expect(seen.hidden).toBe(true);
    expect(seen.text).not.toMatch(/우두머리 \d+초/u);
  }
});

/*
 * 띠는 한 번에 한 벌만 입는다.
 *
 * 옷이 셋이 되면서(경보 리본 · 금박 · 비취) 부르는 쪽마다 「무엇을 벗길지」를 따로
 * 적게 됐고 곧바로 샜다 — `firstSealCelebration` 이 `--boss` 만 벗겨서, 웨이브를 막은
 * 뒤 준비 시간에 첫 성어가 서면 판당 한 번뿐인 금박 축하가 비취 발광을 뒤집어쓴
 * 잡종으로 떴다. 벗기는 일을 `dressWaveBanner` 한 곳에 모았고, 이 시험이 그 규칙을 지킨다.
 */
test("띠는 한 번에 한 벌만 입는다 — 청소 옷이 첫 발동 축하에 눌어붙지 않는다", async ({ page }) => {
  await openRun(page, "BANNER-DRESS");
  await page.getByTestId("early-wave").click({ force: true });
  await expect.poll(async () => phaseOf(page)).toBe("combat");
  await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function"
      ? (handle as () => { engine: { state: { enemies: unknown[]; spawned: number }; getCurrentPlan(): { count: number } | null } })()
      : handle) as { engine: { state: { enemies: unknown[]; spawned: number }; getCurrentPlan(): { count: number } | null } };
    const plan = ctx.engine.getCurrentPlan();
    ctx.engine.state.enemies = [];
    if (plan) ctx.engine.state.spawned = plan.count;
  });
  const banner = page.locator(".boss-banner");
  await expect(banner).toHaveClass(/boss-banner--clear/u, { timeout: 10_000 });

  // 이어서 이 판의 첫 성어를 세운다 — 개발 도구가 넉 자를 한 번에 놓아 준다.
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await expect(page.locator("#dev-idiom-select option").first()).toHaveAttribute("value", /.+/u);
  await page.locator("#dev-idiom-full").click();
  await page.locator("#dev-tools-close").click();

  await expect(banner).toHaveClass(/boss-banner--idiom/u, { timeout: 15_000 });
  await expect(banner).not.toHaveClass(/boss-banner--clear/u);
  await expect(banner).not.toHaveClass(/boss-banner--boss/u);
});

test("성어가 켜지는 순간 뜻이 전장에 있다", async ({ page }) => {
  await openRun(page, "IDIOM-MEANING-E2E");
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("Backquote");
  await page.locator("#dev-tools-button").click();
  await expect(page.locator("#dev-idiom-select option").first()).toHaveAttribute("value", /.+/u);
  await page.locator("#dev-idiom-full").click();
  await page.locator("#dev-tools-close").click();

  const canvas = page.locator("#battle-canvas");
  await expect(canvas).toHaveAttribute("data-idiom-flash", /.+/u, { timeout: 15_000 });

  /*
   * 뜻은 캔버스에 그려지므로 DOM 으로는 못 읽는다. 대신 **화면이 들고 있는 값**이
   * 코어가 준 그 뜻인지, 그리고 그 줄이 전장 안에 드는지를 잡는다 — 조판 규칙
   * 자체는 순수 잎(combat-fx-layout)이 갖고 단위 시험이 따로 지킨다.
   */
  const flash = await page.evaluate(() => {
    const handle = (window as unknown as { __HANJA_CTX_QA__: unknown }).__HANJA_CTX_QA__;
    const ctx = (typeof handle === "function"
      ? (handle as () => { idiomFlash: { chars: string; reading: string; meaning: string } | null; engine: { state: { idiomSeals: Array<{ idiomId: string }> } } })()
      : handle) as { idiomFlash: { chars: string; reading: string; meaning: string } | null; engine: { state: { idiomSeals: Array<{ idiomId: string }> } } };
    const node = document.querySelector<HTMLCanvasElement>("#battle-canvas");
    const measure = (text: string, font: string): number => {
      const context = node?.getContext("2d");
      if (!context) return 0;
      context.save();
      context.font = font;
      const width = context.measureText(text).width;
      context.restore();
      return width;
    };
    const meaning = ctx.idiomFlash?.meaning ?? "";
    return {
      chars: ctx.idiomFlash?.chars ?? "",
      reading: ctx.idiomFlash?.reading ?? "",
      meaning,
      meaningWidth: measure(meaning, '700 15px "Malgun Gothic", sans-serif'),
      seals: ctx.engine.state.idiomSeals.length
    };
  });

  expect(flash.seals).toBeGreaterThan(0);
  expect(flash.chars).toHaveLength(4);
  expect(flash.reading.length).toBeGreaterThan(0);
  // 여기가 이번 고침의 요점이다 — 여태 이 값이 화면에 아예 없었다.
  expect(flash.meaning.length).toBeGreaterThan(0);
  expect(flash.meaning).not.toBe(flash.reading);
  // 재서 클램프하므로 어떤 뜻이 와도 전장(880) 안에 든다.
  expect(flash.meaningWidth).toBeLessThan(880);
  await page.screenshot({ path: "artifacts/v042-idiom-meaning-flash-1280x720.png" });
});
