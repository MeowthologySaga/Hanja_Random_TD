/*
 * 트랙 S — 플레이테스트 감사 중·경 결함 회귀.
 *
 * 이 스펙이 지키는 것은 "고쳤다"가 아니라 "다시 무너지지 않는다"다. 감사에서
 * 실측으로 잡힌 자리마다 그때의 수치를 단언으로 박아 둔다.
 */
import { expect, test, type Page } from "@playwright/test";

const COACH_STORAGE_KEY = "hanja-td:coach-seen-v1";
const HINT_STORAGE_KEYS = ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]
  .map((id) => `hanja-td:hint:${id}:v1`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => performance.setResourceTimingBufferSize(8192));
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), "hanja-td:early-hint-v1");
  await page.addInitScript((keys: string[]) => {
    for (const key of keys) window.localStorage.setItem(key, "1");
  }, HINT_STORAGE_KEYS);
});

/** 잘림 판정: 내용 상자가 보이는 상자보다 크면 잘린 것이다. */
async function overflowOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  return page.evaluate((target) => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) throw new Error(`no element for ${target}`);
    return { x: element.scrollWidth - element.clientWidth, y: element.scrollHeight - element.clientHeight };
  }, selector);
}

// ── S/P-08 · 공용 확인 창 ────────────────────────────────────────────
// 되돌릴 수 없는 조작 넷이 브라우저 기본 window.confirm 을 썼다. OS 창이라
// 자동화가 자동 취소해 검증 자체가 불가능했다 — 이제 DOM 이다.
test("routes destructive actions through the shared in-game confirm dialog", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-CONFIRM&mode=standard");
  // 자동배치를 끄면 소환분이 가방에 남아 제련소 분해 목록에 선다.
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await page.getByTestId("auto-place-toggle").click();
  await expect(page.getByTestId("auto-place-toggle")).toHaveAttribute("aria-checked", "false");
  await page.locator("#settings-close").click();
  await page.getByTestId("start-run").click();
  await page.locator("#shop-tab").click();
  for (let index = 0; index < 4; index += 1) await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();

  // 제련소 일괄 분해 — 유일 보호를 끄고(4연 소환은 대개 전부 유일이다) 추천 선택을 그대로 확인한다.
  await page.getByRole("tab", { name: "강화", exact: true }).click();
  await expect(page.locator("#growth-panel")).toBeVisible();
  if (await page.locator("#dismantle-unique-toggle").getAttribute("aria-checked") === "true") {
    await page.locator("#dismantle-unique-toggle").click();
  }
  await expect(page.locator("#dismantle-unique-toggle")).toHaveAttribute("aria-checked", "false");
  await page.locator("#dismantle-recommend-button").click();
  await page.locator("#dismantle-confirm-button").click();

  const dialog = page.getByTestId("confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("한 번에 분해할까요?");
  await expect(dialog).toContainText("되돌릴 수 없습니다");
  // 서책 틀(520×310)을 넘지 않는다 — 분해 목록이 길어도 본문만 접힌다.
  const frame = await page.locator(".confirm-frame").boundingBox();
  expect(frame?.width).toBeLessThanOrEqual(521);
  expect(frame?.height).toBeLessThanOrEqual(311);
  const body = await overflowOf(page, "#confirm-dialog-body");
  expect(body.x).toBeLessThanOrEqual(0);
  const actionsInside = await page.evaluate(() => {
    const actions = document.querySelector<HTMLElement>("#confirm-dialog .p00-actions")!.getBoundingClientRect();
    const shell = document.querySelector<HTMLElement>(".confirm-frame")!.getBoundingClientRect();
    return actions.bottom <= shell.bottom + 1 && actions.top >= shell.top;
  });
  expect(actionsInside).toBe(true);
  await page.screenshot({ path: ".claude/uiux/track-s/p08-confirm-dismantle-1280x720.png" });

  // Esc 는 취소다 — 아무 일도 일어나지 않는다.
  const before = await page.locator("#run-inventory-count").textContent();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#run-inventory-count")).toHaveText(before ?? "");

  // 수락하면 실제로 분해된다.
  await page.locator("#dismantle-confirm-button").click();
  await expect(dialog).toBeVisible();
  await page.getByTestId("confirm-dialog-accept").click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#message-value")).toContainText("분해");
});

// ── S/P-20 · 첫 방문 코치의 마지막 걸음 ────────────────────────────
// [다음]으로 3/3 까지 가면 마지막 걸음이 1걸음을 그대로 되풀이했다.
test("does not repeat the first coach step at the last one", async ({ page }) => {
  // beforeEach 가 심어 둔 "코치 본 사람" 표시를 이 스펙에서만 걷는다.
  await page.addInitScript((key) => window.localStorage.removeItem(key), "hanja-td:coach-seen-v1");
  await page.goto("/?seed=TRACK-S-COACH&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#coach-layer")).toBeVisible();
  await expect(page.locator("#coach-index")).toHaveText("1");
  const firstTitle = await page.locator("#coach-title").textContent();
  const firstBody = await page.locator("#coach-body").textContent();

  // 소환하지 않은 채 [다음]만 눌러 마지막 걸음까지 간다 — 그 길이 되풀이를 만들었다.
  await page.locator("#coach-next").click();
  await page.locator("#coach-next").click();
  await expect(page.locator("#coach-index")).toHaveText("3");
  await expect(page.locator("#coach-total")).toHaveText("3");
  await expect(page.locator("#coach-title")).not.toHaveText(firstTitle ?? "");
  await expect(page.locator("#coach-body")).not.toHaveText(firstBody ?? "");
  await expect(page.locator("#coach-title")).toContainText("웨이브");
  await expect(page.locator("#coach-body")).toContainText("시작 보너스");
  // 소환 카드를 짚어 손을 첫 걸음으로 돌려보내지 않는다.
  const ring = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>("#coach-ring")!;
    const summon = document.querySelector<HTMLElement>('[data-summon-product="balanced"]')!;
    const ringRect = element.getBoundingClientRect();
    const summonRect = summon.getBoundingClientRect();
    return {
      hidden: element.hidden,
      overlapsSummon: ringRect.left < summonRect.right && ringRect.right > summonRect.left
        && ringRect.top < summonRect.bottom && ringRect.bottom > summonRect.top
    };
  });
  expect(ring.hidden).toBe(false);
  expect(ring.overlapsSummon).toBe(false);
});

// ── S/P-13 · 자령 기술 카드의 요약 줄 ──────────────────────────────
// 트랙 N 이 능력 알약을 2열(글자 자리 65 → 126px)로 고쳤다. 그 처방이 지금
// 카탈로그의 모든 기술 문안을 실제로 담는지 전수로 확인한다 — 새 기술이
// 늘어나면 여기서 먼저 안다.
test("fits every ability summary inside the skill card", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-ABILITY&mode=standard");
  await page.getByTestId("start-run").click();
  await page.locator("#shop-tab").click();
  // 잠금 여부와 무관하게 알약 격자는 같은 2열이다 — 몇 기만 뽑아 한 장을 띄운다.
  for (let index = 0; index < 5; index += 1) await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();
  await page.getByRole("tab", { name: "자령", exact: true }).click();
  await expect(page.locator(".ability-card").first()).toBeVisible();

  const report = await page.evaluate(async () => {
    const specifier = "/src/core/abilities.ts";
    const module = await import(specifier) as typeof import("../src/core/abilities");
    const specs = [
      ...Object.values(module.ELEMENT_ABILITY_TABLE),
      ...Object.values(module.ROLE_ABILITY_TABLE),
      ...Object.values(module.GRAPH_ABILITY_TABLE),
      ...Object.values(module.SEMANTIC_ABILITY_TABLE).map((pattern) => pattern.ability)
    ];
    const card = document.querySelector<HTMLElement>(".ability-card small");
    const label = document.querySelector<HTMLElement>(".ability-card em");
    if (!card || !label) throw new Error("ability card not rendered");
    const original = { card: card.textContent, label: label.textContent };
    const clipped: Array<{ name: string; text: string; overflow: number }> = [];
    // selected.ts 의 readableAbilityTrigger 와 같은 다듬기 — 화면에 나가는 글자로 잰다.
    const readable = (trigger: string): string => trigger === "공격 적중"
      ? "공격 적중마다"
      : trigger.replace(/(\d+번째 공격)$/u, "$1마다");
    for (const spec of specs) {
      card.textContent = `${readable(spec.trigger)} · ${spec.summary}`;
      const overflow = card.scrollHeight - card.clientHeight;
      if (overflow > 1) clipped.push({ name: spec.name, text: card.textContent, overflow });
    }
    // 분류 라벨(「고유 기술 · 주기 자동」)도 함께 — 트랙 N 이 잘림 0 으로 만든 자리다.
    const labelOverflow = label.scrollWidth - label.clientWidth;
    card.textContent = original.card;
    label.textContent = original.label;
    return { clipped, labelOverflow, checked: specs.length };
  });
  expect(report.checked).toBeGreaterThan(10);
  expect(report.labelOverflow).toBeLessThanOrEqual(1);
  expect(report.clipped).toEqual([]);
});

// ── S/P-14 · 빈 합성 탭이 다음 한 걸음을 말한다 ────────────────────
// 26웨이브까지 "가능한 합성 0 · 재료를 모으는 중"만 있던 자리다.
test("tells the next step in the empty synthesis tab", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-NEXTSTEP&mode=standard");
  await page.getByTestId("start-run").click();

  // ① 부족 글자가 전부 직접 소환분이면 "다음 한 걸음 — 소환" 과 상점 길이 선다.
  await page.getByRole("tab", { name: "합성", exact: true }).click();
  const step = page.locator(".evolution-next-step");
  await expect(step).toBeVisible();
  await expect(step).toContainText("다음 한 걸음");

  // ② 합성으로만 만드는 글자(知)를 추적하면 부품 트리와 모을 양이 뜬다.
  await page.locator("#goal-tab").click();
  await page.locator("#goal-search").fill("온고지신");
  await page.locator("#goal-selector-list .goal-idiom-card .goal-idiom-track").first().click();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "합성", exact: true }).click();
  await expect(step).toContainText("지금 모을 부품");
  await expect(step.locator(".goal-tree-row").first()).toContainText("知");
  await expect(step.locator(".goal-tree-row").first()).toContainText("矢");

  // 빈 상자가 남은 높이를 통째로 먹지 않고, 한 칸에 한 줄씩 세로로 선다.
  const layout = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>(".evolution-next-step")!;
    const heading = section.querySelector<HTMLElement>("h4")!.getBoundingClientRect();
    const body = section.querySelector<HTMLElement>("p")!.getBoundingClientRect();
    const options = document.querySelector<HTMLElement>("#evolution-options")!;
    return {
      stacked: body.top >= heading.bottom - 1,
      insideRight: Math.round(options.getBoundingClientRect().right - section.getBoundingClientRect().right),
      optionsClipY: options.scrollHeight - options.clientHeight,
      docOverflowY: document.documentElement.scrollHeight - window.innerHeight
    };
  });
  expect(layout.stacked).toBe(true);
  expect(layout.insideRight).toBeGreaterThanOrEqual(0);
  expect(layout.optionsClipY).toBeLessThanOrEqual(0);
  expect(layout.docOverflowY).toBeLessThanOrEqual(0);

  // [목표 서책에서 전체 보기]는 목표 탭으로 데려간다.
  await step.locator("[data-goto-goal]").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-panel-tab", "goal");
});

// ── S/P-12 · 전장 부동 라벨의 무대 경계 ────────────────────────────
// 피해 수치·장판 이름·능력 알약은 월드 좌표를 따라다녀서, 개체가 가장자리에
// 서면 무대 밖으로 나가 잘리거나 상·하단 붙박이 UI 밑으로 들어갔다.
test("keeps floating battlefield labels inside the stage safe area", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-LABELS&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#battle-canvas")).toBeVisible();

  const report = await page.evaluate(async () => {
    const labelsSpecifier = "/src/ui/battle/stage-labels.ts";
    const worldSpecifier = "/src/core/content.ts";
    const labels = await import(labelsSpecifier) as typeof import("../src/ui/battle/stage-labels");
    const world = await import(worldSpecifier) as typeof import("../src/core/content");
    const camera = (window as unknown as { __HANJA_CTX_QA__: { mapZoom: number; mapOffset: { x: number; y: number } } }).__HANJA_CTX_QA__;
    const safe = labels.STAGE_SAFE_AREA;
    const outside: Array<{ zoom: number; worldX: number; worldY: number; left: number; top: number; right: number; bottom: number }> = [];
    // 월드 네 귀퉁이 바깥까지 훑는다 — 카메라가 어디에 있든 라벨은 무대 안이다.
    for (const zoom of [0.72, 2, 5.2]) {
      camera.mapZoom = zoom;
      camera.mapOffset = { x: 0, y: 0 };
      labels.resetStageLabels();
      for (const worldX of [-120, 0, 220, 440, 880, 1_000]) {
        for (const worldY of [-120, 0, 360, 720, 840]) {
          const half = { w: 30, h: 8 };
          const spot = labels.placeStageLabel(worldX, worldY, half.w, half.h, { avoidOverlap: true });
          const left = camera.mapOffset.x + (spot.x - half.w) * zoom;
          const right = camera.mapOffset.x + (spot.x + half.w) * zoom;
          const top = camera.mapOffset.y + (spot.y - half.h) * zoom;
          const bottom = camera.mapOffset.y + (spot.y + half.h) * zoom;
          const fits = 2 * half.w * zoom <= world.WORLD_WIDTH - safe.left - safe.right
            && 2 * half.h * zoom <= world.WORLD_HEIGHT - safe.top - safe.bottom;
          if (!fits) continue;
          if (left < safe.left - 0.5 || right > world.WORLD_WIDTH - safe.right + 0.5
            || top < safe.top - 0.5 || bottom > world.WORLD_HEIGHT - safe.bottom + 0.5) {
            outside.push({ zoom, worldX, worldY, left, top, right, bottom });
          }
        }
      }
    }
    // 같은 자리에 세 번 부르면 세로로 갈라진다(피해 수치 쌓임).
    camera.mapZoom = 2;
    camera.mapOffset = { x: 0, y: 0 };
    labels.resetStageLabels();
    const stacked = [0, 1, 2].map(() => labels.placeStageLabel(220, 200, 24, 8, { avoidOverlap: true }).y);
    return { outside, stacked, safe };
  });
  expect(report.outside).toEqual([]);
  expect(new Set(report.stacked).size).toBe(3);
});

// ── S/P-10 · 웨이브 브리핑 잔존 꼬리 ───────────────────────────────
// 두 줄 클램프는 넘치는 순간 뒤부터 삼킨다. 잔존 수는 이 문장에서만 알 수
// 있는 값이므로 장·우두머리 예고보다 앞에 서야 한다. 조판도 함께 잰다 —
// 자형연성(표준) 모드의 카드 폭은 별승급과 다를 수 있다.
test("keeps the survivor tail ahead of the chapter note and inside two lines", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-BRIEF&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#wave-briefing")).toBeVisible();

  const report = await page.evaluate(async () => {
    const specifier = "/src/core/content.ts";
    const module = await import(specifier) as typeof import("../src/core/content");
    const element = document.getElementById("wave-briefing") as HTMLElement;
    const original = element.textContent;
    const overflowing: Array<{ wave: number; survivors: number; overflow: number; text: string }> = [];
    const misordered: number[] = [];
    for (let wave = 1; wave <= 100; wave += 1) {
      const plan = module.wavePlan(wave);
      for (const survivors of [1, 9, 79]) {
        const text = module.composeWaveBriefing(plan.briefing, wave, plan.boss, survivors);
        const tail = `잔존 ${survivors}체 합류`;
        const chapter = `제${Math.max(1, Math.ceil(wave / 10))}장`;
        if (text.indexOf(tail) > text.indexOf(chapter)) misordered.push(wave);
        element.textContent = text;
        const overflow = element.scrollHeight - element.clientHeight;
        if (overflow > 1) overflowing.push({ wave, survivors, overflow, text });
      }
    }
    element.textContent = original;
    return { overflowing, misordered };
  });
  expect(report.misordered).toEqual([]);
  expect(report.overflowing).toEqual([]);
});

// [최대] 강화도 같은 창을 쓴다. 비용을 통째로 쓰는 조작이라 확인 1회가 붙는다.
test("confirms max-level upgrades in the same dialog", async ({ page }) => {
  await page.goto("/?seed=TRACK-S-MAXUP&mode=standard");
  await page.getByTestId("start-run").click();
  await page.getByRole("tab", { name: "강화", exact: true }).click();
  const maxButton = page.locator('[data-growth-upgrade-scope="global"][data-growth-stat="damage"][data-growth-amount="max"]');
  await expect(maxButton).toBeEnabled();
  await maxButton.click();
  const dialog = page.getByTestId("confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("단계를 한 번에 올릴까요?");
  await expect(dialog).toContainText("누적 비용");
  await expect(dialog).toContainText("엽전");
  await page.getByTestId("confirm-dialog-accept").click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#element-upgrade-total")).toContainText("단계");
});
