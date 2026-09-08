/*
 * 읽기 소리 — 부적을 완성하면 그 글자를 소리로 읽는다 (v038, 기본 꺼짐).
 *
 * 시험은 소리를 들을 수 없다. 그래서 ui/tts.ts 가 **말하기 직전의 판단**
 * (무엇을 · 어느 말로)을 개발용 손잡이에 남기고, 여기서 그 값을 읽는다.
 */
import { expect, test, type Page } from "@playwright/test";

interface TalismanQa {
  currentChar: () => string | null;
  isSealed: () => boolean;
  autoTrace: () => void;
  submit: () => void;
  present: (char: string) => boolean;
  grantCharges: (count: number) => number;
}

interface TtsQa {
  last: () => { text: string; lang: string; char: string } | null;
  utterance: (char: string, notation: string, reading: string) => { text: string; lang: string } | null;
}

const READING_VOICE_KEY = "hanja-td:reading-voice";

async function openRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    window.localStorage.setItem("hanja-td:talisman-mode", "true");
    window.localStorage.setItem("hanja-td:soul-tutor-v1", "1");
    // QA 자동 따라쓰기는 획순을 따르지 않는다(souls.spec 과 같은 사정).
    window.localStorage.setItem("hanja-td:stroke-order-guide", "false");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  });
  await page.goto("/?seed=READING-VOICE&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
}

async function sealOneTalisman(page: Page): Promise<void> {
  await page.evaluate(() => {
    const qa = (window as unknown as { __HANJA_TALISMAN_QA__: TalismanQa }).__HANJA_TALISMAN_QA__;
    qa.autoTrace();
  });
  await expect(page.getByTestId("talisman-submit")).toBeEnabled();
  await page.getByTestId("talisman-submit").click();
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __HANJA_TALISMAN_QA__: TalismanQa }).__HANJA_TALISMAN_QA__.isSealed()))
    .toBe(true);
}

test("기본은 꺼짐이고, 켜면 완성한 글자의 훈음을 한국어로 읽는다", async ({ page }) => {
  await openRun(page);

  // ① 기본 꺼짐 — 저장된 것도 없고 토글도 OFF 다. 소리는 켜 달라고 해야 켠다.
  const toggle = page.getByTestId("reading-voice-toggle");
  await page.locator("#settings-button").click();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(toggle.locator("i em")).toHaveText("OFF");
  expect(await page.evaluate((key) => window.localStorage.getItem(key), READING_VOICE_KEY)).toBeNull();

  // ② 꺼진 채로 한 장을 다 써도 아무 말도 하지 않는다.
  await page.locator("#settings-close").click();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");
  await page.locator("#talisman-tab").click();
  await sealOneTalisman(page);
  expect(await page.evaluate(() => (window as unknown as { __HANJA_TTS_QA__: TtsQa }).__HANJA_TTS_QA__.last())).toBeNull();

  // ③ 켠다 — 저장되고 표시가 바뀐다.
  await page.locator("#settings-button").click();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(toggle.locator("i em")).toHaveText("ON");
  expect(await page.evaluate((key) => window.localStorage.getItem(key), READING_VOICE_KEY)).toBe("true");
  await page.locator("#settings-close").click();

  /*
   * ④ 다음 장을 완성하면 그 글자의 훈음을 한국어로 읽는다.
   *
   * 인장이 찍힌 종이는 조작 줄이 잠기고 잠시 뒤 저절로 다음 장으로 넘어간다.
   * 그 타이밍에 기대지 않으려고 글자를 직접 세운다(QA 손잡이) — 무엇을 읽는지
   * 까지 못 박을 수 있어 시험이 더 정확해진다.
   */
  await page.evaluate(() => {
    const qa = (window as unknown as { __HANJA_TALISMAN_QA__: TalismanQa }).__HANJA_TALISMAN_QA__;
    qa.grantCharges(3);
    qa.present("天");
  });
  await expect(page.locator("#talisman-reading")).toContainText("하늘 천");
  await sealOneTalisman(page);
  const spoken = await page.evaluate(() => (window as unknown as { __HANJA_TTS_QA__: TtsQa }).__HANJA_TTS_QA__.last());
  const shown = await page.locator("#talisman-reading").textContent();
  expect(spoken).toMatchObject({ char: "天", lang: "ko-KR", text: "하늘 천" });
  // 화면이 적은 그 읽기를 그대로 말한다 — 두 자리가 다른 말을 하면 하나는 거짓말이다.
  expect(shown).toContain(spoken?.text ?? "");
});

test("표기 축이 발음 언어를 정한다 — 병음은 한자를 중국어로 읽는다", async ({ page }) => {
  await openRun(page);
  const mapped = await page.evaluate(() => {
    const qa = (window as unknown as { __HANJA_TTS_QA__: TtsQa }).__HANJA_TTS_QA__;
    return {
      kr: qa.utterance("身", "kr-hunum", "몸 신"),
      jp: qa.utterance("身", "jp-onkun", "シン·ケン"),
      cn: qa.utterance("身", "cn-pinyin", "shēn")
    };
  });
  expect(mapped.kr).toMatchObject({ text: "몸 신", lang: "ko-KR" });
  expect(mapped.jp).toMatchObject({ text: "シン, ケン", lang: "ja-JP" });
  // 철자가 아니라 소리를 원한 것이다 — 한자를 중국어 목소리에 넘긴다.
  expect(mapped.cn).toMatchObject({ text: "身", lang: "zh-CN" });
});


/*
 * [v042] 저절로 닿는 통로가 하나 생겼다 — 웨이브가 열리면 그 글자를 읽어 준다.
 *
 * 여태 읽기 소리가 붙어 있던 자리는 저장소를 통틀어 **한 곳**이었다(부적 완성).
 * 그 한 자리는 부적 모드 ON + 부적 탭 열기 + 획 다 긋기 + [완성] 누르기까지 사람 손
 * 대여섯 번이 드는 조건부 통로라, 켜 두고도 한 번도 못 듣는 판이 나온다.
 *
 * 웨이브 글자는 판당 97.17회 · 중앙 간격 22.8초이고 300표본에서 3초 안에 겹치는 것이
 * 0건이다. `speakReading` 이 앞말을 자르므로 그 간격이 소음과 도움을 가른다.
 *
 * `src/ui/events.ts` 는 vitest 가 한 번도 수입하지 않는다(node 환경·창 없음). 이
 * 자리를 지킬 게이트는 e2e 뿐이다.
 */
test("웨이브가 열리면 그 글자를 읽어 주고, 배너와 같은 읽기를 말한다", async ({ page }) => {
  await page.addInitScript((key: string) => {
    window.localStorage.setItem(key, "true");
    window.localStorage.setItem("hanja-td:coach-seen-v1", "1");
    window.localStorage.setItem("hanja-td:early-hint-v1", "1");
    for (const id of ["stroke-star", "midstar-open", "research-open", "first-fuse", "essence", "talisman"]) {
      window.localStorage.setItem(`hanja-td:hint:${id}:v1`, "1");
    }
  }, READING_VOICE_KEY);
  await page.goto("/?seed=WAVE-VOICE&mode=standard");
  await page.getByTestId("start-run").click();
  await expect(page.locator("#shop-panel")).toBeVisible();
  await page.getByTestId("summon-button").click();
  await page.keyboard.press("Escape");

  await page.getByTestId("early-wave").click({ force: true });

  // 북과 겹치지 않게 반 초 늦춰 말한다 — 그 뒤에 손잡이가 채워진다.
  const handle = await page.waitForFunction(
    () => (window as unknown as { __HANJA_TTS_QA__: { last: () => { text: string; lang: string; char: string } | null } }).__HANJA_TTS_QA__.last(),
    undefined,
    { timeout: 15_000 }
  );
  const spoken = await handle.jsonValue();

  expect(spoken).not.toBeNull();
  const banner = (await page.locator("#boss-banner").textContent()) ?? "";
  // 읽어 준 글자가 배너에 실제로 서 있는 그 글자다.
  expect(banner).toContain(spoken?.char ?? " ");
  // 그리고 읽는 말도 배너가 쓴 그 읽기다 — 화면과 소리가 갈라지지 않는다.
  expect(banner).toContain(spoken?.text ?? " ");
});
