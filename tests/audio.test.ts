import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import audioManifest from "../src/data/audio-manifest.json";
import audioQc from "../public/assets/audio/audio-qc.json";
import type { GameEvent } from "../src/core/types";
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  SoundManager,
  battleBgmForWave,
  loadAudioSettings,
  saveAudioSettings,
  sfxForEvent,
  zoneBgmForWave
} from "../src/ui/audio";

describe("Suno audio catalog and runtime mapping", () => {
  it("maps the three wave zones and both boss tiers deterministically", () => {
    expect(zoneBgmForWave(1)).toBe("early");
    expect(zoneBgmForWave(30)).toBe("early");
    expect(zoneBgmForWave(31)).toBe("mid");
    expect(zoneBgmForWave(60)).toBe("mid");
    expect(zoneBgmForWave(61)).toBe("late");
    expect(zoneBgmForWave(100)).toBe("late");
    expect(battleBgmForWave(90, true)).toBe("boss");
    expect(battleBgmForWave(100, true)).toBe("final");
  });

  it("selects the dedicated menu track for the title phase", () => {
    const sound = new SoundManager();
    sound.syncBgm({ phase: "title", wave: 1, boss: false }, 0);
    expect(sound.getDebugState().targetBgmId).toBe("menu");
  });

  it("routes meaningful game events to file SFX", () => {
    const event = (type: GameEvent["type"], extra: Record<string, unknown> = {}): GameEvent => ({ type, ...extra }) as GameEvent;
    expect(sfxForEvent(event("summon"))).toBe("summon");
    expect(sfxForEvent(event("evolve"))).toBe("fusion-strategy");
    expect(sfxForEvent(event("casualFuse"))).toBe("fusion-casual");
    expect(sfxForEvent(event("concentrate"))).toBe("concentration");
    expect(sfxForEvent(event("dismantle"))).toBe("dismantle");
    expect(sfxForEvent(event("statUpgrade"))).toBe("upgrade");
    expect(sfxForEvent(event("traitUpgrade"))).toBe("upgrade");
    expect(sfxForEvent(event("goal"))).toBe("goal-complete");
    expect(sfxForEvent(event("idiom"))).toBe("goal-complete");
    expect(sfxForEvent(event("wave", { boss: false }))).toBe("wave-start");
    expect(sfxForEvent(event("wave", { boss: true }))).toBe("boss-warning");
    expect(sfxForEvent(event("phase", { phase: "victory" }))).toBe("victory");
    expect(sfxForEvent(event("phase", { phase: "defeat" }))).toBe("defeat");
    expect(sfxForEvent(event("shot"))).toBeNull();
    expect(sfxForEvent(event("ability"))).toBeNull();
  });

  it("persists independent BGM and SFX controls and clamps bad values", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string): string | null => values.get(key) ?? null,
      setItem: (key: string, value: string): void => { values.set(key, value); }
    };
    saveAudioSettings({ masterMuted: true, bgmMuted: false, sfxMuted: true, bgmVolume: 0.42, sfxVolume: 0.81 }, storage);
    expect(loadAudioSettings(storage)).toEqual({ masterMuted: true, bgmMuted: false, sfxMuted: true, bgmVolume: 0.42, sfxVolume: 0.81 });

    values.set(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({ bgmVolume: 4, sfxVolume: -2 }));
    expect(loadAudioSettings(storage)).toMatchObject({ bgmVolume: 1, sfxVolume: 0 });
  });

  it("keeps one selected MP3 for every manifest target", () => {
    expect(audioManifest.assets.filter((asset) => asset.kind === "bgm")).toHaveLength(6);
    expect(audioManifest.assets.filter((asset) => asset.kind === "sfx")).toHaveLength(12);
    expect(new Set(audioManifest.assets.map((asset) => asset.id)).size).toBe(18);
    for (const asset of audioManifest.assets) {
      expect(asset.format).toBe("MP3");
      expect(asset.sourceId).not.toBe("pending");
      expect(asset.durationSeconds).toBeGreaterThan(0);
      expect(existsSync(join(process.cwd(), "public", asset.file))).toBe(true);
    }
  });

  it("keeps measured QC and hashes aligned with every shipped MP3", () => {
    expect(audioQc.assets).toHaveLength(audioManifest.assets.length);
    for (const asset of audioManifest.assets) {
      const qc = audioQc.assets.find((candidate) => candidate.id === asset.id);
      expect(qc, asset.id).toBeDefined();
      expect(qc?.durationSeconds).toBeCloseTo(asset.durationSeconds, 3);
      const bytes = readFileSync(join(process.cwd(), "public", asset.file));
      expect(qc?.bytes).toBe(bytes.byteLength);
      expect(qc?.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
      if (qc?.kind === "bgm") {
        expect(qc.integratedLufs).toBeGreaterThanOrEqual(-20.5);
        expect(qc.integratedLufs).toBeLessThanOrEqual(-19.5);
        expect(qc.truePeakDbtp).toBeLessThanOrEqual(-1.5);
      } else if (qc) {
        expect(qc.maxPeakDbfs).toBeGreaterThanOrEqual(-1.3);
        expect(qc.maxPeakDbfs).toBeLessThanOrEqual(-0.7);
      }
    }
  });
});
