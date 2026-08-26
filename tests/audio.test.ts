import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import audioManifest from "../src/data/audio-manifest.json";
import audioQc from "../public/assets/audio/audio-qc.json";
import type { GameEvent } from "../src/core/types";
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  SFX_JITTER_RATIO,
  SFX_MAX_POLYPHONY,
  SFX_MIN_RETRIGGER_MS,
  SFX_RULES,
  SoundManager,
  battleBgmForWave,
  layerSfxForEvent,
  loadAudioSettings,
  saveAudioSettings,
  sfxForEvent,
  sfxRateForEvent,
  starAscendRate,
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
    expect(sfxForEvent(event("casualFuse", { toStar: 3 }))).toBe("fx-star-ascend");
    expect(sfxForEvent(event("concentrate"))).toBe("concentration");
    expect(sfxForEvent(event("dismantle"))).toBe("dismantle");
    expect(sfxForEvent(event("statUpgrade"))).toBe("upgrade");
    expect(sfxForEvent(event("traitUpgrade"))).toBe("upgrade");
    expect(sfxForEvent(event("goal"))).toBe("goal-complete");
    expect(sfxForEvent(event("idiom"))).toBe("fx-idiom-seal");
    expect(sfxForEvent(event("kill"))).toBe("fx-enemy-dissolve");
    expect(sfxForEvent(event("wave", { boss: false }))).toBe("wave-start");
    expect(sfxForEvent(event("wave", { boss: true }))).toBe("fx-boss-drum");
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
    expect(audioManifest.assets.filter((asset) => asset.kind === "sfx")).toHaveLength(25);
    expect(new Set(audioManifest.assets.map((asset) => asset.id)).size).toBe(31);
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

describe("Codex sfx-v3 pack integration", () => {
  const PACK_IDS = [
    "ui-paper-tab", "ui-brush-hover", "ui-seal-stamp", "ui-coin-string",
    "ui-ink-drop", "ui-scroll-open", "ui-scroll-close", "ui-locked-thud",
    "fx-enemy-dissolve", "fx-idiom-seal", "fx-formation-unlock",
    "fx-star-ascend", "fx-boss-drum"
  ] as const;

  it("ships all thirteen delivered one-shots under the sfx path convention", () => {
    for (const id of PACK_IDS) {
      const asset = audioManifest.assets.find((candidate) => candidate.id === id);
      expect(asset, id).toBeDefined();
      expect(asset?.kind).toBe("sfx");
      expect(asset?.file).toBe(`assets/audio/sfx/${id}.mp3`);
      expect(existsSync(join(process.cwd(), "public", asset?.file ?? ""))).toBe(true);
    }
  });

  it("matches the byte-for-byte delivery recorded in the handoff checksums", () => {
    // Resolves both from the main checkout and from a .claude/worktrees/<agent> worktree.
    const candidates = [
      join(process.cwd(), "handoff", "to-claude", "sfx-v3-audio-pack-v1"),
      join(process.cwd(), "..", "..", "..", "handoff", "to-claude", "sfx-v3-audio-pack-v1")
    ];
    const packRoot = candidates.find((candidate) => existsSync(candidate));
    if (!packRoot) return; // The handoff pack is absent from a packaged checkout.
    for (const id of PACK_IDS) {
      const shipped = readFileSync(join(process.cwd(), "public", "assets", "audio", "sfx", `${id}.mp3`));
      const delivered = readFileSync(join(packRoot, "assets", "audio", "sfx", `${id}.mp3`));
      expect(createHash("sha256").update(shipped).digest("hex"), id)
        .toBe(createHash("sha256").update(delivered).digest("hex"));
    }
  });

  it("gives every runtime one-shot a playback rule and every rule a manifest file", () => {
    const manifestSfx = new Set(audioManifest.assets.filter((asset) => asset.kind === "sfx").map((asset) => asset.id));
    for (const id of Object.keys(SFX_RULES)) expect(manifestSfx.has(id), id).toBe(true);
    for (const id of PACK_IDS) expect(Object.keys(SFX_RULES)).toContain(id);
  });

  it("keeps every retrigger gap at or above the duplicate-suppression floor", () => {
    for (const [id, rule] of Object.entries(SFX_RULES)) {
      expect(rule.gapMs, id).toBeGreaterThanOrEqual(SFX_MIN_RETRIGGER_MS);
      expect(rule.poolSize, id).toBeGreaterThan(0);
      expect(rule.poolSize, id).toBeLessThanOrEqual(SFX_MAX_POLYPHONY);
      expect(rule.volume, id).toBeGreaterThan(0);
      expect(rule.volume, id).toBeLessThanOrEqual(1);
    }
    expect(SFX_MIN_RETRIGGER_MS).toBe(60);
    expect(SFX_MAX_POLYPHONY).toBe(8);
    expect(SFX_JITTER_RATIO).toBeCloseTo(0.05, 5);
  });

  it("honours the pack gate timings for the tab, hover and locked one-shots", () => {
    expect(SFX_RULES["ui-paper-tab"].gapMs).toBeLessThanOrEqual(70);
    expect(SFX_RULES["ui-brush-hover"].gapMs).toBeGreaterThanOrEqual(120);
    expect(SFX_RULES["ui-locked-thud"].gapMs).toBeGreaterThanOrEqual(250);
  });

  it("varies pitch and level only on the high-frequency one-shots", () => {
    expect(SFX_RULES["fx-enemy-dissolve"].jitter).toBe(true);
    expect(SFX_RULES["ui-brush-hover"].jitter).toBe(true);
    expect(SFX_RULES["fx-idiom-seal"].jitter).toBeUndefined();
    expect(SFX_RULES["fx-boss-drum"].jitter).toBeUndefined();
  });

  it("lets milestone one-shots steal a voice at the polyphony ceiling", () => {
    for (const id of ["fx-idiom-seal", "fx-formation-unlock", "fx-star-ascend", "fx-boss-drum"] as const) {
      expect(SFX_RULES[id].priority, id).toBe("high");
    }
    expect(SFX_RULES["fx-enemy-dissolve"].priority).toBeUndefined();
  });

  it("trims the long tails at runtime without touching the delivered files", () => {
    const qcById = new Map(audioQc.assets.map((asset) => [asset.id, asset]));
    for (const id of ["fx-enemy-dissolve", "ui-brush-hover", "ui-ink-drop"] as const) {
      const rule = SFX_RULES[id];
      const durationMs = (qcById.get(id)?.durationSeconds ?? 0) * 1_000;
      expect(rule.maxMs, id).toBeDefined();
      expect(rule.maxMs ?? 0, id).toBeLessThan(durationMs);
    }
  });

  it("grades the casual ascent pitch across the eight stars inside the allowed band", () => {
    expect(starAscendRate(1)).toBeCloseTo(0.94, 3);
    expect(starAscendRate(8)).toBeCloseTo(1.1, 3);
    for (let star = 1; star <= 8; star += 1) {
      expect(starAscendRate(star)).toBeGreaterThanOrEqual(0.94);
      expect(starAscendRate(star)).toBeLessThanOrEqual(1.1);
      if (star > 1) expect(starAscendRate(star)).toBeGreaterThan(starAscendRate(star - 1));
    }
  });

  it("routes the graded rate only through the casual fusion event", () => {
    const event = (type: GameEvent["type"], extra: Record<string, unknown> = {}): GameEvent => ({ type, ...extra }) as GameEvent;
    expect(sfxRateForEvent(event("casualFuse", { toStar: 8 }))).toBeCloseTo(1.1, 3);
    expect(sfxRateForEvent(event("kill"))).toBeUndefined();
    expect(sfxRateForEvent(event("summon"))).toBeUndefined();
  });

  it("layers the coin string under summoning and nothing else", () => {
    const event = (type: GameEvent["type"], extra: Record<string, unknown> = {}): GameEvent => ({ type, ...extra }) as GameEvent;
    expect(layerSfxForEvent(event("summon"))).toBe("ui-coin-string");
    expect(layerSfxForEvent(event("kill"))).toBeNull();
    expect(layerSfxForEvent(event("wave", { boss: true }))).toBeNull();
  });
});
