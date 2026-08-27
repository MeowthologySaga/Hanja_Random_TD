/*
 * [트랙 V] 런 저장·이어하기.
 *
 * 한 판이 45~50분이라 새로고침 한 번이 곧 손실이었다. 웨이브를 하나 넘긴 뒤
 * 새로고침하고, 타이틀의 [이어하기] 목패로 같은 자리에 돌아오는지 본다 —
 * 웨이브·엽전·자령 수·처치 수가 저장 순간과 같아야 한다.
 */
import { expect, test, type Page } from "@playwright/test";

const SHOT_DIR = ".claude/uiux/track-v";

/** 저장 슬롯 키 — src/core/run-save.ts 의 RUN_SAVE_STORAGE_KEY 와 같아야 한다. */
const RUN_SAVE_KEY = "hanja-td:run-save-v1";

interface RunSnapshot {
  phase: string;
  wave: number;
  gold: number;
  towers: number;
  inventory: number;
  summonCount: number;
  killCount: number;
  discovered: number;
  seed: string;
  elapsed: number;
  rngState: number;
}

test.beforeEach(async ({ page }) => {
  // 코치·1회성 안내는 패널 클릭을 가로채는 표면이라 이미 본 사용자로 시작한다.
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
    // 저장 슬롯은 일부러 비우지 않는다 — addInitScript 는 새로고침에도 다시 도는데,
    // 이 스펙의 관찰 대상이 바로 "새로고침 뒤에도 남아 있는가"다. 스펙마다 브라우저
    // 문맥이 따로라 localStorage 는 어차피 빈 채로 시작한다.
  });
});

/** 판의 지문 — 저장 전후를 견줄 축. */
async function snapshot(page: Page): Promise<RunSnapshot> {
  return page.evaluate(() => {
    const qa = (window as unknown as {
      __HANJA_CTX_QA__: {
        engine: {
          captureRuntime(): { rngState: number };
          state: {
            phase: string; wave: number; gold: number; seed: string; elapsed: number;
            summonCount: number; killCount: number;
            towers: unknown[]; inventoryTowers: unknown[]; discoveredChars: unknown[];
          };
        };
      };
    }).__HANJA_CTX_QA__;
    const state = qa.engine.state;
    return {
      phase: state.phase,
      wave: state.wave,
      gold: state.gold,
      towers: state.towers.length,
      inventory: state.inventoryTowers.length,
      summonCount: state.summonCount,
      killCount: state.killCount,
      discovered: state.discoveredChars.length,
      seed: state.seed,
      elapsed: state.elapsed,
      rngState: qa.engine.captureRuntime().rngState
    };
  });
}

/**
 * 지금 웨이브를 클리어시킨다.
 *
 * 적을 걷고 스폰을 완료로 표시하면 다음 틱에 엔진이 스스로 `finishWave()` 를
 * 부른다 — 자동 저장이 걸리는 자리가 바로 그 전이(phase → prep)다. 실시간으로
 * 웨이브를 다 잡기를 기다리는 대신 같은 문을 통과시킨다(개발자 도구의
 * 「적 전멸」이 쓰는 것과 같은 손잡이다).
 */
async function clearCurrentWave(page: Page): Promise<void> {
  await page.evaluate(() => {
    const qa = (window as unknown as {
      __HANJA_CTX_QA__: {
        engine: {
          getCurrentPlan(): { count: number } | null;
          state: { enemies: unknown[]; spawned: number; bossDefeated: boolean };
        };
      };
    }).__HANJA_CTX_QA__;
    const plan = qa.engine.getCurrentPlan();
    qa.engine.state.enemies = [];
    if (plan) qa.engine.state.spawned = plan.count;
    qa.engine.state.bossDefeated = true;
  });
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "prep");
}

/** 첫 자령을 소환해 오행진을 열고 시계를 굴린 뒤, 첫 웨이브에 나선다. */
async function openFirstWave(page: Page): Promise<void> {
  await page.getByTestId("start-run").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "prep");
  await page.getByTestId("summon-button").click();
  await page.locator("#summon-reveal-close").click();
  await expect(page.getByTestId("early-wave")).toBeEnabled();
  await page.getByTestId("early-wave").click({ force: true }); // 맥동(early-pulse)이 stable 판정을 막는다
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "combat");
}

test("웨이브를 넘기면 저장되고, 새로고침 뒤 이어하기로 같은 자리에 돌아온다", async ({ page }) => {
  await page.goto("/?seed=RUNSAVE-E2E-01&mode=casual");
  await openFirstWave(page);

  // 아직 한 웨이브도 넘기지 않았으므로 슬롯은 비어 있어야 한다.
  expect(await page.evaluate((key) => window.localStorage.getItem(key), RUN_SAVE_KEY)).toBeNull();

  await clearCurrentWave(page);
  const live = await snapshot(page);
  expect(live.wave).toBeGreaterThanOrEqual(1);

  const raw = await page.evaluate((key) => window.localStorage.getItem(key), RUN_SAVE_KEY);
  expect(raw).not.toBeNull();
  const bytes = new TextEncoder().encode(raw ?? "").length;
  // 실측 기준선. 웨이브 1의 저장본이 100KB 를 넘으면 형식이 잘못 자란 것이다.
  expect(bytes).toBeGreaterThan(500);
  expect(bytes).toBeLessThan(100_000);

  /*
   * 견줄 기준은 살아 있는 엔진이 아니라 **저장본 자체**다. 저장은 웨이브가
   * 끝난 그 프레임에 떠지고, 위의 `snapshot()` 은 그로부터 몇 프레임 뒤를
   * 읽으므로 준비 시계(elapsed)가 이미 조금 흘러 있다. "저장한 것을 그대로
   * 되살리는가"가 이 스펙의 질문이니 저장본을 정본으로 삼는다.
   */
  const saved = JSON.parse(raw ?? "{}") as {
    state: {
      wave: number; gold: number; seed: string; elapsed: number; summonCount: number;
      killCount: number; towers: unknown[]; inventoryTowers: unknown[]; discoveredChars: unknown[];
    };
    runtime: { rngState: number };
  };
  expect(saved.state.wave).toBe(live.wave);
  expect(saved.state.gold).toBe(live.gold);

  // ── 새로고침 — 지금까지는 여기서 판이 사라졌다.
  await page.reload();
  const resume = page.getByTestId("resume-run");
  await expect(resume).toBeVisible();
  await expect(page.locator("#resume-summary")).toContainText(`${saved.state.wave}/`);
  await expect(page.locator("#resume-summary")).toContainText("웨이브");
  await page.screenshot({ path: `${SHOT_DIR}/s00-resume-plaque-1280x720.png` });

  await resume.click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "prep");

  const resumed = await snapshot(page);
  expect(resumed.seed).toBe(saved.state.seed);
  expect(resumed.wave).toBe(saved.state.wave);
  expect(resumed.gold).toBe(saved.state.gold);
  expect(resumed.towers).toBe(saved.state.towers.length);
  expect(resumed.inventory).toBe(saved.state.inventoryTowers.length);
  expect(resumed.summonCount).toBe(saved.state.summonCount);
  expect(resumed.killCount).toBe(saved.state.killCount);
  expect(resumed.discovered).toBe(saved.state.discoveredChars.length);
  // 되살린 직후에도 시계는 곧 흐르기 시작하므로 "저장값 이상, 1초 안"으로 본다.
  expect(resumed.elapsed).toBeGreaterThanOrEqual(saved.state.elapsed);
  expect(resumed.elapsed).toBeLessThan(saved.state.elapsed + 1);
  // 난수기까지 같은 자리라야 이어 돌린 판이 쭉 돌린 판과 갈라지지 않는다.
  expect(resumed.rngState).toBe(saved.runtime.rngState);

  // 타이틀 막이 다 걷힌 뒤에 찍는다 — 페이드 중에 찍으면 서재가 전장 위에 비친다.
  await expect(page.locator("#title-overlay")).not.toHaveClass(/modal-layer--visible/u);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/battle-resumed-1280x720.png` });
});

test("새 판은 두고 온 판을 덮기 전에 한 번 묻는다", async ({ page }) => {
  await page.goto("/?seed=RUNSAVE-E2E-02&mode=casual");
  await openFirstWave(page);
  await clearCurrentWave(page);
  await page.reload();

  await expect(page.getByTestId("resume-run")).toBeVisible();
  await page.getByTestId("start-run").click();

  const confirmDialog = page.getByTestId("confirm-dialog");
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog).toContainText("두고 온 판을 덮고");
  await page.screenshot({ path: `${SHOT_DIR}/overwrite-confirm-1280x720.png` });

  // 돌아가기 — 저장본도 목패도 그대로 남는다.
  await page.getByTestId("confirm-dialog-cancel").click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByTestId("resume-run")).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), RUN_SAVE_KEY)).not.toBeNull();

  // 덮고 새로 시작 — 슬롯이 비고 판이 처음부터 선다.
  await page.getByTestId("start-run").click();
  await expect(confirmDialog).toBeVisible();
  await page.getByTestId("confirm-dialog-accept").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "prep");
  const fresh = await snapshot(page);
  expect(fresh.wave).toBe(0);
  expect(fresh.summonCount).toBe(0);
});

test("판이 끝나면 저장은 사라진다 — 패배를 무를 수 없다", async ({ page }) => {
  await page.goto("/?seed=RUNSAVE-E2E-03&mode=casual");
  await openFirstWave(page);
  await clearCurrentWave(page);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), RUN_SAVE_KEY)).not.toBeNull();

  // 판을 끝낸다(적 한계 초과 패배).
  await page.evaluate(() => {
    const qa = (window as unknown as {
      __HANJA_CTX_QA__: { engine: { state: { phase: string; lastMessage: string; defeatCause: string | null } } };
    }).__HANJA_CTX_QA__;
    qa.engine.state.phase = "defeat";
    qa.engine.state.defeatCause = "enemy-limit";
    qa.engine.state.lastMessage = "테스트 종료";
  });
  await expect(page.locator("#end-overlay")).toHaveClass(/modal-layer--visible/u);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), RUN_SAVE_KEY)).toBeNull();

  await page.reload();
  await expect(page.getByTestId("resume-run")).toBeHidden();
});

test("수련장을 다녀와도 두고 온 판은 그대로 남는다", async ({ page }) => {
  await page.goto("/?seed=RUNSAVE-E2E-05&mode=casual");
  await openFirstWave(page);
  await clearCurrentWave(page);
  const before = await page.evaluate((key) => window.localStorage.getItem(key), RUN_SAVE_KEY);
  expect(before).not.toBeNull();

  // 메뉴로 돌아가 수련장에 들어간다 — 연습 판은 저장되지 않아야 하고,
  // 그 판이 끝나도 본편 저장을 건드려서는 안 된다.
  await page.reload();
  await page.getByTestId("tutorial-button").click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-phase", "prep");
  expect(await page.evaluate(() => {
    const qa = (window as unknown as { __HANJA_CTX_QA__: { engine: { tutorial: boolean } } }).__HANJA_CTX_QA__;
    return qa.engine.tutorial;
  })).toBe(true);

  /*
   * 수련 판을 지게 만든다. 각본은 이 경우 스스로 첫 걸음부터 다시 세우므로
   * 종료 화면이 서지 않을 수도 있다 — 이 스펙이 지키려는 것은 화면이 아니라
   * "그 사이 본편 저장이 지워지지 않는다"이다.
   */
  await page.evaluate(() => {
    const qa = (window as unknown as {
      __HANJA_CTX_QA__: { engine: { state: { phase: string; defeatCause: string | null; lastMessage: string } } };
    }).__HANJA_CTX_QA__;
    qa.engine.state.phase = "defeat";
    qa.engine.state.defeatCause = "enemy-limit";
    qa.engine.state.lastMessage = "테스트 종료";
  });
  await page.waitForTimeout(600);

  // 본편 저장본은 손대지 않은 그대로여야 한다.
  expect(await page.evaluate((key) => window.localStorage.getItem(key), RUN_SAVE_KEY)).toBe(before);
  await page.reload();
  await expect(page.getByTestId("resume-run")).toBeVisible();
});

test("읽을 수 없는 저장본은 조용히 버리고 한 줄만 알린다", async ({ page }) => {
  await page.addInitScript((key) => {
    // 형식 판이 다른 저장본 — 판을 올린 뒤 첫 방문이 꼭 이 모습이다.
    window.localStorage.setItem(key, JSON.stringify({ version: 0, state: { wave: 12 } }));
  }, RUN_SAVE_KEY);
  await page.goto("/?seed=RUNSAVE-E2E-04&mode=casual");

  await expect(page.getByTestId("resume-run")).toBeHidden();
  await expect(page.locator("#toast")).toContainText("이전 기록을 불러올 수 없습니다");
  // 다음 방문에 같은 말을 되풀이하지 않도록 슬롯은 비워 둔다.
  expect(await page.evaluate((key) => window.localStorage.getItem(key), RUN_SAVE_KEY)).toBeNull();
});
