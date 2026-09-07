/*
 * 글자가 잘리는 자리를 못 박는다 (v041).
 *
 * "짤려서 나오는거 싫어. 없애버리고. 다른 곳도 이런거 안생기는지 조심해"(사용자).
 *
 * 한 번 훑고 고치는 것으로는 같은 흠이 돌아온다 — 실제로 이번에 걸린
 * `#talisman-cue-button` 은 제 주석에 「작업 영역 27px 초과 전례」를 적어 두고도
 * 같은 자리에서 같은 일을 냈다. 그래서 **상시 게이트**로 세운다.
 *
 * 두 갈래로 잰다.
 *  ① **굳은 잘림(hard)** — 요소가 `overflow:hidden|clip` 조상의 상자 밖으로 나가
 *     실제로 잘린다. 사이에 `auto|scroll` 조상이 있으면 스크롤로 되찾을 수 있으니
 *     흠이 아니다. **0 건이어야 한다.**
 *  ② **제 상자 넘침(self)** — 제 안에서 넘쳐 말줄임되는 것. 이건 조판상 불가피할
 *     때가 있으므로 금지하지 않되, **전문을 되찾을 길**(자신이나 가까운 조상의
 *     title·aria-label)이 있어야 통과한다(`#message-value` 가 그 규범이다).
 *
 * 예외는 사유를 적어 ALLOWED 에만 둔다. 목록 길이까지 단언해 사유 없이 조용히
 * 늘어나는 것을 막는다.
 */
import { expect, test, type Page } from "@playwright/test";

interface Finding {
  readonly kind: "hard" | "self";
  readonly selector: string;
  readonly detail: string;
  readonly text: string;
}

/** 사유가 붙은 예외만 통과한다 — 선택자 → 왜 봐주는가. */
const ALLOWED: Record<string, string> = {
  "#gold-value": "38×19 칸에 19px 숫자 — 하강부 없는 글자만 들어가 실제로는 안 잘린다(행간 1.05)"
};

async function collect(page: Page, screen: string): Promise<Finding[]> {
  return page.evaluate((allowed) => {
    const TOLERANCE = 2;
    const results: Array<{ kind: "hard" | "self"; selector: string; detail: string; text: string }> = [];

    const describe = (node: Element): string => {
      if (node.id) return `#${node.id}`;
      const cls = [...node.classList].slice(0, 2).map((name) => `.${name}`).join("");
      return `${node.tagName.toLowerCase()}${cls}`;
    };
    const ownText = (node: Element): string => {
      let text = "";
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? "";
      }
      return text.trim();
    };
    const hasEscape = (node: Element): boolean => {
      let cursor: Element | null = node;
      for (let step = 0; cursor && step < 3; step += 1) {
        if ((cursor.getAttribute("title") ?? "").trim()) return true;
        if ((cursor.getAttribute("aria-label") ?? "").trim()) return true;
        cursor = cursor.parentElement;
      }
      return false;
    };

    /*
     * 조상까지 보고 「안 보이는 것」을 걸러 낸다.
     *
     * 접힌 서랍(예: 웨이브가 열리면 접히는 개문 안내 — `max-height:0; opacity:0`)
     * 안의 글자는 상자 밖으로 나가 있지만 **아무도 볼 수 없다.** 잘림이 아니라
     * 숨김이다. 요소 제 값만 보면 자식의 opacity 는 1 이라 전부 걸린다.
     */
    const invisible = (node: Element): boolean => {
      let cursor: Element | null = node;
      while (cursor && cursor !== document.body) {
        const style = getComputedStyle(cursor);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return true;
        const box = cursor.getBoundingClientRect();
        if (cursor !== node && (box.height < 4 || box.width < 4)) return true;
        cursor = cursor.parentElement;
      }
      return false;
    };

    for (const node of Array.from(document.body.querySelectorAll("*"))) {
      const style = getComputedStyle(node);
      if (invisible(node)) continue;
      // 글자를 화면 밖으로 밀어 그림으로 대신한 배지 — 잘리는 것이 설계다.
      if (parseFloat(style.textIndent) <= -100) continue;
      const text = ownText(node);
      if (!text) continue;
      const box = node.getBoundingClientRect();
      if (box.width < 4 || box.height < 4) continue;
      const selector = describe(node);
      const excuse = allowed[selector];

      // ① 조상에게 잘리는가.
      let cursor = node.parentElement;
      let scrollable = false;
      while (cursor && cursor !== document.body) {
        const parentStyle = getComputedStyle(cursor);
        const overflowX = parentStyle.overflowX;
        const overflowY = parentStyle.overflowY;
        if (overflowX === "auto" || overflowX === "scroll" || overflowY === "auto" || overflowY === "scroll") {
          scrollable = true;
        }
        const clips = (axis: string): boolean => axis === "hidden" || axis === "clip";
        if (!scrollable && (clips(overflowX) || clips(overflowY))) {
          const frame = cursor.getBoundingClientRect();
          const cut: string[] = [];
          if (clips(overflowX) && box.left < frame.left - TOLERANCE) cut.push(`L${Math.round(frame.left - box.left)}`);
          if (clips(overflowX) && box.right > frame.right + TOLERANCE) cut.push(`R${Math.round(box.right - frame.right)}`);
          if (clips(overflowY) && box.top < frame.top - TOLERANCE) cut.push(`T${Math.round(frame.top - box.top)}`);
          if (clips(overflowY) && box.bottom > frame.bottom + TOLERANCE) cut.push(`B${Math.round(box.bottom - frame.bottom)}`);
          if (cut.length > 0 && !excuse) {
            results.push({ kind: "hard", selector, detail: `${describe(cursor)} 밖으로 ${cut.join("·")}`, text: text.slice(0, 46) });
            break;
          }
        }
        cursor = cursor.parentElement;
      }

      // ② 제 상자 안에서 넘치는가 — 되찾을 길이 있으면 통과.
      const clipsSelf = (axis: string): boolean => axis === "hidden" || axis === "clip";
      const overX = clipsSelf(style.overflowX) && node.scrollWidth - node.clientWidth > TOLERANCE;
      const overY = clipsSelf(style.overflowY) && node.scrollHeight - node.clientHeight > TOLERANCE;
      if ((overX || overY) && !excuse && !hasEscape(node)) {
        const axis = overX ? `가로 ${node.scrollWidth - node.clientWidth}px` : `세로 ${node.scrollHeight - node.clientHeight}px`;
        results.push({ kind: "self", selector, detail: `${axis} 넘침 · 곁말 없음`, text: text.slice(0, 46) });
      }
    }
    return results;
  }, ALLOWED).then((rows) => rows.map((row) => ({ ...row, detail: `${screen} · ${row.detail}` })));
}

function report(findings: Finding[]): string {
  if (findings.length === 0) return "";
  return findings.map((row) => `  [${row.kind}] ${row.selector} — ${row.detail} — "${row.text}"`).join("\n");
}

async function openRun(page: Page, mode: "standard" | "casual"): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:soul-tutor-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto(`/?seed=CLIP-SWEEP&mode=${mode}`);
}

const TABS = ["shop", "unit", "growth", "goal", "talisman"] as const;

for (const mode of ["standard", "casual"] as const) {
  test(`글자가 잘리는 자리가 없다 — ${mode}`, async ({ page }) => {
    const findings: Finding[] = [];
    await openRun(page, mode);

    // ① 제목 화면.
    await expect(page.getByTestId("start-run")).toBeVisible();
    findings.push(...(await collect(page, "제목")));

    // ② 첫 소환 전 준비.
    await page.getByTestId("start-run").click();
    await expect(page.locator("#shop-panel")).toBeVisible();
    findings.push(...(await collect(page, "개문")));

    // ③ 첫 소환 뒤 준비.
    await page.getByTestId("summon-button").click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    findings.push(...(await collect(page, "준비")));

    /*
     * ④ 교전 × 갈피 다섯. 이번 흠은 **급한 행동 줄이 서는 순간**에만 났으므로
     * 그 상태를 손으로 만든다 — 엽전이 모자라 소환을 못 하는데 다음 웨이브가
     * 다가오는 자리(소환 96회 구간이면 값이 15엽전이다).
     */
    // 맥동이 stable 판정을 막는다(run-save.spec 선례) — force 로 누른다.
    await page.getByTestId("early-wave").click({ force: true });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const handle = (window as unknown as { __HANJA_CTX_QA__: { engine: { state: { gold: number; summonCount: number } } } }).__HANJA_CTX_QA__;
      const state = (typeof handle === "function" ? (handle as unknown as () => typeof handle)() : handle).engine.state;
      state.gold = 12;
      state.summonCount = 96;
    });
    for (const tab of TABS) {
      // 무대(main)도 같은 데이터 속성을 들고 있다 — 단추만 고른다.
      await page.locator(`button[data-panel-tab="${tab}"]`).click();
      await page.waitForTimeout(220);
      findings.push(...(await collect(page, `교전·${tab}`)));
    }

    // ⑤ 창 둘.
    await page.locator("#help-button").click();
    await page.waitForTimeout(250);
    findings.push(...(await collect(page, "도움말")));
    await page.keyboard.press("Escape");
    await page.locator("#settings-button").click();
    await page.waitForTimeout(250);
    findings.push(...(await collect(page, "설정")));
    await page.keyboard.press("Escape");

    const hard = findings.filter((row) => row.kind === "hard");
    const self = findings.filter((row) => row.kind === "self");
    expect(hard, `조상에게 잘리는 글자:\n${report(hard)}`).toHaveLength(0);
    expect(self, `넘치는데 곁말이 없는 글자:\n${report(self)}`).toHaveLength(0);
  });
}

test("예외 목록은 사유와 함께만 늘어난다", () => {
  // 조용히 늘어나는 예외가 이 검사를 무력하게 만든다 — 길이를 못 박는다.
  expect(Object.keys(ALLOWED)).toHaveLength(1);
  for (const [selector, reason] of Object.entries(ALLOWED)) {
    expect(reason.length, `${selector} 의 사유가 너무 짧다`).toBeGreaterThan(20);
  }
});
