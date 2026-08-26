import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const audioManifest = JSON.parse(readFileSync(new URL("../src/data/audio-manifest.json", import.meta.url), "utf8")) as {
  assets: Array<{ file: string }>;
};

interface DebugAudioManager {
  unlock(): void;
  syncBgm(state: { phase: "title" | "prep" | "combat" | "victory" | "defeat"; wave: number; boss: boolean }, now?: number): void;
  getDebugState(): {
    targetBgmId: string | null;
    activeBgmId: string | null;
    activeSrc: string | null;
    bgmPlaying: boolean;
    lastError: string | null;
  };
}

test("loads Suno MP3s, persists the independent mix, and crossfades boss states", async ({ page, request }) => {
  test.setTimeout(45_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  for (const asset of audioManifest.assets) {
    const response = await request.get(`/${asset.file}`);
    expect(response.ok(), asset.file).toBe(true);
    expect(response.headers()["content-type"], asset.file).toContain("audio/mpeg");
    expect((await response.body()).byteLength, asset.file).toBeGreaterThan(1_000);
  }

  await page.goto("/?seed=AUDIO-E2E-01");
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await expect(page.locator(".game-shell")).toHaveAttribute("data-audio-bgm", "menu");
  await expect.poll(() => page.evaluate(() => {
    const manager = (window as typeof window & { __HANJA_AUDIO_QA__?: DebugAudioManager }).__HANJA_AUDIO_QA__;
    return manager?.getDebugState().activeSrc ?? "";
  }), { timeout: 8_000 }).toContain("moonlit-codex-menu-loop.mp3");
  await page.locator("#bgm-volume").fill("44");
  await page.locator("#sfx-volume").fill("37");
  await page.locator("#sfx-mute-button").click();
  await expect(page.locator("#bgm-volume-output")).toHaveText("44%");
  await expect(page.locator("#sfx-volume-output")).toHaveText("37%");
  await expect(page.locator("#sfx-mute-button")).toHaveAttribute("aria-checked", "false");
  await page.locator("#settings-close").click();

  await page.reload();
  await page.getByRole("button", { name: "화면 모드 설정" }).click();
  await expect(page.locator("#bgm-volume")).toHaveValue("44");
  await expect(page.locator("#sfx-volume")).toHaveValue("37");
  await expect(page.locator("#sfx-mute-button")).toHaveAttribute("aria-checked", "false");
  await page.locator("#sfx-mute-button").click();
  await page.locator("#settings-close").click();
  await page.getByTestId("start-run").click();

  await expect(page.locator(".game-shell")).toHaveAttribute("data-audio-bgm", "early");
  await expect.poll(() => page.evaluate(() => {
    const manager = (window as typeof window & { __HANJA_AUDIO_QA__?: DebugAudioManager }).__HANJA_AUDIO_QA__;
    return manager?.getDebugState().bgmPlaying ?? false;
  }), { timeout: 8_000 }).toBe(true);

  await page.evaluate(async () => {
    const moduleUrl = "/src/ui/audio.ts";
    const module = await import(/* @vite-ignore */ moduleUrl) as { SoundManager: new () => DebugAudioManager };
    const manager = new module.SoundManager();
    manager.unlock();
    manager.syncBgm({ phase: "prep", wave: 1, boss: false }, 0);
    Object.assign(window, { __HANJA_AUDIO_TRANSITION_QA__: manager });
  });
  const transitionState = (): Promise<ReturnType<DebugAudioManager["getDebugState"]> | null> => page.evaluate(() => {
    const manager = (window as typeof window & { __HANJA_AUDIO_TRANSITION_QA__?: DebugAudioManager }).__HANJA_AUDIO_TRANSITION_QA__;
    return manager?.getDebugState() ?? null;
  });

  await expect.poll(async () => (await transitionState())?.activeBgmId, { timeout: 5_000 }).toBe("early");
  await page.evaluate(() => {
    const manager = (window as typeof window & { __HANJA_AUDIO_TRANSITION_QA__: DebugAudioManager }).__HANJA_AUDIO_TRANSITION_QA__;
    manager.syncBgm({ phase: "combat", wave: 10, boss: true }, 1_000);
    manager.syncBgm({ phase: "combat", wave: 10, boss: true }, 9_001);
  });
  await expect.poll(async () => (await transitionState())?.activeBgmId, { timeout: 5_000 }).toBe("boss");

  await page.evaluate(() => {
    const manager = (window as typeof window & { __HANJA_AUDIO_TRANSITION_QA__: DebugAudioManager }).__HANJA_AUDIO_TRANSITION_QA__;
    manager.syncBgm({ phase: "prep", wave: 10, boss: false }, 10_000);
  });
  expect((await transitionState())?.targetBgmId).toBe("boss");
  await page.evaluate(() => {
    const manager = (window as typeof window & { __HANJA_AUDIO_TRANSITION_QA__: DebugAudioManager }).__HANJA_AUDIO_TRANSITION_QA__;
    manager.syncBgm({ phase: "prep", wave: 11, boss: false }, 15_001);
  });
  await expect.poll(async () => (await transitionState())?.activeBgmId, { timeout: 5_000 }).toBe("early");

  await page.evaluate(() => {
    const manager = (window as typeof window & { __HANJA_AUDIO_TRANSITION_QA__: DebugAudioManager }).__HANJA_AUDIO_TRANSITION_QA__;
    manager.syncBgm({ phase: "combat", wave: 100, boss: true }, 20_000);
    manager.syncBgm({ phase: "combat", wave: 100, boss: true }, 28_001);
  });
  await expect.poll(async () => (await transitionState())?.activeBgmId, { timeout: 5_000 }).toBe("final");
  const finalState = await transitionState();
  expect(finalState?.activeSrc).toContain("heavenly-seal-final-loop.mp3");
  expect(finalState?.lastError).toBeNull();
  expect(consoleErrors).toEqual([]);
});
