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
