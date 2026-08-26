import audioManifest from "../data/audio-manifest.json";
import type { GameEvent, RunPhase } from "../core/types";

export const AUDIO_SETTINGS_STORAGE_KEY = "hanja-random-td:audio-settings-v1";
export const BOSS_BGM_ENTRY_DELAY_MS = 8_000;
export const BOSS_BGM_EXIT_GRACE_MS = 5_000;
export const BGM_CROSSFADE_MS = 3_000;
const BGM_FADE_STEP_MS = 80;

export type BgmId = "menu" | "early" | "mid" | "late" | "boss" | "final";
export type LegacySfxId =
  | "ui-confirm"
  | "summon"
  | "fusion-strategy"
  | "fusion-casual"
  | "concentration"
  | "upgrade"
  | "dismantle"
  | "goal-complete"
  | "wave-start"
  | "boss-warning"
  | "victory"
  | "defeat";
/** Codex `sfx-v3-audio-pack-v1` delivery: 8 UI plus 5 combat one-shots. */
export type PackSfxId =
  | "ui-paper-tab"
  | "ui-brush-hover"
  | "ui-seal-stamp"
  | "ui-coin-string"
  | "ui-ink-drop"
  | "ui-scroll-open"
  | "ui-scroll-close"
  | "ui-locked-thud"
  | "fx-enemy-dissolve"
  | "fx-idiom-seal"
  | "fx-formation-unlock"
  | "fx-star-ascend"
  | "fx-boss-drum";
export type SfxId = LegacySfxId | PackSfxId;

/** No single one-shot may retrigger faster than this, whatever its own rule says. */
export const SFX_MIN_RETRIGGER_MS = 60;
/** Ceiling on simultaneously sounding one-shots across every pool. */
export const SFX_MAX_POLYPHONY = 8;
/** High-frequency one-shots vary this much in pitch and level to avoid machine-gunning. */
export const SFX_JITTER_RATIO = 0.05;
/** Hover re-entry suppression for one and the same element, per the pack gate. */
export const SFX_HOVER_ELEMENT_GAP_MS = 120;
/** A committed action stamps after this delay unless the engine emits its own one-shot first. */
export const SFX_ACTION_STAMP_DELAY_MS = 40;

export interface AudioSettings {
  masterMuted: boolean;
  bgmMuted: boolean;
  sfxMuted: boolean;
  bgmVolume: number;
  sfxVolume: number;
}

export interface BgmSyncState {
  phase: RunPhase;
  wave: number;
  boss: boolean;
}

export interface AudioDebugState {
  unlocked: boolean;
  targetBgmId: BgmId | null;
  activeBgmId: BgmId | null;
  activeSrc: string | null;
  bgmPlaying: boolean;
  activeVolume: number;
  lastError: string | null;
  settings: AudioSettings;
  /** Total accepted one-shot triggers since load, for headless playback assertions. */
  sfxPlayCount: number;
  /** Triggers dropped by the retrigger gap or the polyphony ceiling. */
  sfxSuppressedCount: number;
  /** One-shots sounding right now, never above SFX_MAX_POLYPHONY. */
  sfxActiveVoices: number;
  lastSfxId: SfxId | null;
  /** Per-id accepted trigger counts, so a test can assert the exact sound fired. */
  sfxCounts: Record<string, number>;
}

interface RuntimeAudioAsset {
  id: string;
  kind: "bgm" | "sfx";
  file: string;
}

const manifestAssets = audioManifest.assets as RuntimeAudioAsset[];
const DEFAULT_SETTINGS: AudioSettings = {
  masterMuted: false,
  bgmMuted: false,
  sfxMuted: false,
  bgmVolume: 0.6,
  sfxVolume: 0.72
};

const BGM_MIX_LEVEL: Record<BgmId, number> = {
  menu: 0.52,
  early: 0.56,
  mid: 0.55,
  late: 0.54,
  boss: 0.6,
  final: 0.62
};

interface SfxRule {
  volume: number;
  gapMs: number;
  poolSize: number;
  /** Milestone one-shots may steal a voice when the polyphony ceiling is reached. */
  priority?: "high";
  /** Applies +-SFX_JITTER_RATIO to pitch and level so repeats do not phase-lock. */
  jitter?: boolean;
  /**
   * Non-destructive runtime trim. The pack ships 2.0-4.9s tails that would smear
   * under rapid fire, so long one-shots fade and stop here while the file on disk
   * stays exactly as Codex normalized it.
   */
  maxMs?: number;
}

export const SFX_RULES: Record<SfxId, SfxRule> = {
  "ui-confirm": { volume: 0.3, gapMs: 100, poolSize: 2 },
  summon: { volume: 0.48, gapMs: 140, poolSize: 3 },
  "fusion-strategy": { volume: 0.64, gapMs: 420, poolSize: 2 },
  "fusion-casual": { volume: 0.6, gapMs: 420, poolSize: 2 },
  concentration: { volume: 0.56, gapMs: 260, poolSize: 2 },
  upgrade: { volume: 0.46, gapMs: 160, poolSize: 3 },
  dismantle: { volume: 0.43, gapMs: 220, poolSize: 2 },
  "goal-complete": { volume: 0.66, gapMs: 480, poolSize: 2 },
  "wave-start": { volume: 0.47, gapMs: 600, poolSize: 2 },
  "boss-warning": { volume: 0.63, gapMs: 1_000, poolSize: 2 },
  victory: { volume: 0.68, gapMs: 1_500, poolSize: 1 },
  defeat: { volume: 0.56, gapMs: 1_500, poolSize: 1 },
  "ui-paper-tab": { volume: 0.32, gapMs: 70, poolSize: 2, jitter: true, maxMs: 900 },
  "ui-brush-hover": { volume: 0.16, gapMs: 120, poolSize: 3, jitter: true, maxMs: 620 },
  "ui-seal-stamp": { volume: 0.34, gapMs: 90, poolSize: 2, jitter: true, maxMs: 1_000 },
  "ui-coin-string": { volume: 0.29, gapMs: 140, poolSize: 3, jitter: true, maxMs: 1_400 },
  "ui-ink-drop": { volume: 0.36, gapMs: 80, poolSize: 3, jitter: true, maxMs: 900 },
  "ui-scroll-open": { volume: 0.33, gapMs: 120, poolSize: 2, maxMs: 1_200 },
  "ui-scroll-close": { volume: 0.29, gapMs: 120, poolSize: 2, maxMs: 1_000 },
  "ui-locked-thud": { volume: 0.4, gapMs: 250, poolSize: 2, maxMs: 1_100 },
  "fx-enemy-dissolve": { volume: 0.25, gapMs: 110, poolSize: 4, jitter: true, maxMs: 1_100 },
  "fx-idiom-seal": { volume: 0.62, gapMs: 480, poolSize: 2, priority: "high" },
  "fx-formation-unlock": { volume: 0.54, gapMs: 300, poolSize: 2, priority: "high" },
  "fx-star-ascend": { volume: 0.56, gapMs: 420, poolSize: 2, priority: "high", maxMs: 3_000 },
  "fx-boss-drum": { volume: 0.66, gapMs: 1_000, poolSize: 2, priority: "high" }
};

/**
 * The eight bottom-panel tabs and every dialog button share this selector, so one
 * delegated listener covers the whole command panel without touching any renderer.
 */
const HOVER_SELECTOR = "button:not(:disabled), [role='tab']:not([aria-disabled='true'])";

/** Casual ascent reads higher the further the star climbs; the pack gate allows 0.94-1.10. */
export function starAscendRate(toStar: number): number {
  const span = Math.min(1, Math.max(0, (toStar - 1) / 7));
  return Number((0.94 + span * 0.16).toFixed(3));
}

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadAudioSettings(storage: Pick<Storage, "getItem"> | null = browserStorage()): AudioSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(storage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? "{}") as Partial<AudioSettings>;
    return {
      masterMuted: typeof parsed.masterMuted === "boolean" ? parsed.masterMuted : DEFAULT_SETTINGS.masterMuted,
      bgmMuted: typeof parsed.bgmMuted === "boolean" ? parsed.bgmMuted : DEFAULT_SETTINGS.bgmMuted,
      sfxMuted: typeof parsed.sfxMuted === "boolean" ? parsed.sfxMuted : DEFAULT_SETTINGS.sfxMuted,
      bgmVolume: clampVolume(parsed.bgmVolume, DEFAULT_SETTINGS.bgmVolume),
      sfxVolume: clampVolume(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings, storage: Pick<Storage, "setItem"> | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The current run still keeps the mix even when browser storage is blocked.
  }
}

export function zoneBgmForWave(wave: number): BgmId {
  if (wave >= 61) return "late";
  if (wave >= 31) return "mid";
  return "early";
}

export function battleBgmForWave(wave: number, boss: boolean): BgmId {
  if (!boss) return zoneBgmForWave(wave);
  return wave >= 100 ? "final" : "boss";
}

/**
 * Primary one-shot for an engine event.
 *
 * Four rows moved to the v3 pack because it ships a purpose-built sound for that
 * exact beat. Each is a one-line revert to the legacy id in the comment if the
 * listening pass prefers the older take.
 */
export function sfxForEvent(event: GameEvent): SfxId | null {
  switch (event.type) {
    case "summon": return "summon";
    case "dismantle": return "dismantle";
    case "concentrate": return "concentration";
    case "statUpgrade":
    case "traitUpgrade": return "upgrade";
    case "evolve": return "fusion-strategy";
    case "casualFuse": return "fx-star-ascend";       // was "fusion-casual"
    case "goal": return "goal-complete";
    case "idiom": return "fx-idiom-seal";             // was "goal-complete"
    case "kill": return "fx-enemy-dissolve";          // was silent
    case "wave": return event.boss ? "fx-boss-drum" : "wave-start"; // boss was "boss-warning"
    case "phase": return event.phase === "victory" ? "victory" : event.phase === "defeat" ? "defeat" : null;
    default: return null;
  }
}

/**
 * Optional second one-shot layered under the primary. Summoning pays coin before the
 * talisman unfurls, so the coin string sits beneath the existing summon sound rather
 * than replacing it.
 */
export function layerSfxForEvent(event: GameEvent): SfxId | null {
  return event.type === "summon" ? "ui-coin-string" : null;
}

/** Per-event playback rate, used where the pack gate asks for a graded pitch. */
export function sfxRateForEvent(event: GameEvent): number | undefined {
  return event.type === "casualFuse" ? starAscendRate(event.toStar) : undefined;
}

function assetSource(id: BgmId | SfxId, kind: "bgm" | "sfx"): string {
  const asset = manifestAssets.find((candidate) => candidate.kind === kind && candidate.id === id);
  if (!asset) throw new Error(`Audio manifest is missing ${kind}:${id}`);
  return `${import.meta.env.BASE_URL}${asset.file}?v=${audioManifest.cacheVersion}`;
}

function isBossBgm(id: BgmId | null): boolean {
  return id === "boss" || id === "final";
}

export class SoundManager {
  private context: AudioContext | null = null;
  private settings = loadAudioSettings();
  private unlocked = false;
  private lastShotAt = 0;
  private lastAbilityAt = 0;
  private readonly lastSfxAt = new Map<SfxId, number>();
  private readonly sfxPools = new Map<SfxId, HTMLAudioElement[]>();
  private readonly sfxPoolIndices = new Map<SfxId, number>();
  private readonly bgmNodes = new Map<BgmId, HTMLAudioElement>();
  private waveSfxPreloadScheduled = false;
  private targetBgmId: BgmId | null = null;
  private activeBgmId: BgmId | null = null;
  private activeBgm: HTMLAudioElement | null = null;
  private incomingBgm: HTMLAudioElement | null = null;
  private fadeTimer = 0;
  private fadeGeneration = 0;
  private lastBossActive = false;
  private bossEnteredAt: number | null = null;
  private bossExitedAt: number | null = null;
  private lastError: string | null = null;
  private readonly voiceMeta = new Map<HTMLAudioElement, { high: boolean; startedAt: number }>();
  private readonly trimTimers = new Map<HTMLAudioElement, number>();
  private readonly hoverSeenAt = new WeakMap<Element, number>();
  private readonly sfxCounts = new Map<SfxId, number>();
  private sfxPlayCount = 0;
  private sfxSuppressedCount = 0;
  private lastSfxId: SfxId | null = null;
  private uiSfxAttached = false;
  private pendingStampTimer = 0;
  private armedOutcomeSfx: SfxId | null = null;

  get isMuted(): boolean {
    return this.settings.masterMuted;
  }

  get audioSettings(): AudioSettings {
    return { ...this.settings };
  }

  toggle(): boolean {
    this.settings.masterMuted = !this.settings.masterMuted;
    this.commitSettings();
    if (!this.settings.masterMuted) this.unlock();
    return this.settings.masterMuted;
  }

  toggleBgmMuted(): boolean {
    this.settings.bgmMuted = !this.settings.bgmMuted;
    this.commitSettings();
    if (!this.settings.bgmMuted) this.unlock();
    return this.settings.bgmMuted;
  }

  toggleSfxMuted(): boolean {
    this.settings.sfxMuted = !this.settings.sfxMuted;
    this.commitSettings();
    if (!this.settings.sfxMuted) this.unlock();
    return this.settings.sfxMuted;
  }

  setBgmVolume(volume: number): void {
    this.settings.bgmVolume = clampVolume(volume, this.settings.bgmVolume);
    this.commitSettings();
  }

  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = clampVolume(volume, this.settings.sfxVolume);
    this.commitSettings();
  }

  unlock(): void {
    this.unlocked = true;
    const context = this.ensureContext();
    if (context?.state === "suspended") void context.resume();
    this.scheduleWaveSfxPreload();
    if (this.targetBgmId !== this.activeBgmId && this.fadeTimer === 0) this.beginCrossfade(this.targetBgmId);
  }

  playUiConfirm(): void {
    this.playSfx("ui-confirm");
  }

  /** Bottom-panel tab actually changed. */
  playTabSwitch(): void {
    this.playSfx("ui-paper-tab");
  }

  /**
   * Arms the next successful action so it stamps with a placement or unlock sound
   * instead of the generic seal. Consumed by the very next playActionOutcome call.
   */
  expectPlacement(): void {
    this.armedOutcomeSfx = "ui-ink-drop";
  }

  expectFormationUnlock(): void {
    this.armedOutcomeSfx = "fx-formation-unlock";
  }

  /**
   * Single choke point for every committed UI action.
   *
   * A rejected action thuds immediately. A successful one stamps after a short
   * delay, which playSfx cancels if the engine emits its own one-shot on the next
   * frame, so summoning or fusing never doubles up with the generic seal.
   */
  playActionOutcome(ok: boolean): void {
    const armed = this.armedOutcomeSfx;
    this.armedOutcomeSfx = null;
    if (!this.sfxEnabled()) return;
    if (!ok) {
      this.playSfx("ui-locked-thud");
      return;
    }
    if (armed) {
      this.playSfx(armed);
      return;
    }
    this.cancelPendingStamp();
    this.pendingStampTimer = window.setTimeout(() => {
      this.pendingStampTimer = 0;
      this.playSfx("ui-seal-stamp");
    }, SFX_ACTION_STAMP_DELAY_MS);
  }

  /**
   * Installs the delegated UI one-shots: brush hover on buttons and tabs, and scroll
   * open/close driven by the `open` attribute of every dialog. Using delegation and a
   * MutationObserver keeps this to a single call site and touches no renderer or
   * template markup.
   */
  attachUiSfx(root: Document = document): void {
    if (this.uiSfxAttached) return;
    this.uiSfxAttached = true;

    root.addEventListener("pointerover", (event) => {
      // Touch has no hover state; firing there would double up with the tap sound.
      if ((event as PointerEvent).pointerType === "touch") return;
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(HOVER_SELECTOR);
      if (!target || target.getAttribute("aria-disabled") === "true") return;
      this.playHover(target);
    }, { passive: true });

    root.addEventListener("focusin", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(HOVER_SELECTOR)) return;
      // Pointer focus already sounded on pointerover; only keyboard focus is new.
      if (!target.matches(":focus-visible")) return;
      this.playHover(target);
    });

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.attributeName !== "open") continue;
        const dialog = record.target as HTMLDialogElement;
        this.playSfx(dialog.open ? "ui-scroll-open" : "ui-scroll-close");
      }
    });
    root.querySelectorAll("dialog").forEach((dialog) => {
      observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    });
  }

  private playHover(target: Element): void {
    const now = performance.now();
    if (now - (this.hoverSeenAt.get(target) ?? -Infinity) < SFX_HOVER_ELEMENT_GAP_MS) return;
    this.hoverSeenAt.set(target, now);
    this.playSfx("ui-brush-hover");
  }

  syncBgm(state: BgmSyncState, now = performance.now()): void {
    if (state.phase === "title") {
      this.lastBossActive = false;
      this.bossEnteredAt = null;
      this.bossExitedAt = null;
      this.requestBgm("menu");
      return;
    }

    const activeRun = state.phase === "prep" || state.phase === "combat";
    if (!activeRun) {
      this.lastBossActive = false;
      this.bossEnteredAt = null;
      this.bossExitedAt = null;
      this.requestBgm(null);
      return;
    }

    const bossActive = state.phase === "combat" && state.boss;
    if (bossActive && !this.lastBossActive) {
      this.bossEnteredAt = now;
      this.bossExitedAt = null;
    } else if (!bossActive && this.lastBossActive) {
      this.bossExitedAt = now;
      this.bossEnteredAt = null;
    }
    this.lastBossActive = bossActive;

    const zone = zoneBgmForWave(state.wave);
    if (bossActive) {
      const enteredAt = this.bossEnteredAt ?? now;
      this.requestBgm(now - enteredAt >= BOSS_BGM_ENTRY_DELAY_MS ? battleBgmForWave(state.wave, true) : zone);
      return;
    }

    if (this.bossExitedAt !== null && now - this.bossExitedAt < BOSS_BGM_EXIT_GRACE_MS && isBossBgm(this.targetBgmId)) return;
    this.bossExitedAt = null;
    this.requestBgm(zone);
  }

  handle(event: GameEvent): void {
    if (!this.sfxEnabled()) return;
    const fileSfx = sfxForEvent(event);
    if (fileSfx) {
      // The engine voiced this beat itself, so the pending generic stamp is redundant.
      this.cancelPendingStamp();
      // Wave and boss one-shots wait for the paint so the wave transition never hitches.
      if (event.type === "wave") this.playSfxAfterPaint(fileSfx);
      else this.playSfx(fileSfx, { rate: sfxRateForEvent(event) });
      const layer = layerSfxForEvent(event);
      if (layer) this.playSfx(layer);
      return;
    }

    switch (event.type) {
      case "interest":
        this.tone(660, 0.08, "triangle", 0.018, 1.18);
        window.setTimeout(() => this.tone(880, 0.12, "triangle", 0.014, 1.08), 70);
        break;
      case "ability": {
        const now = performance.now();
        if (now - this.lastAbilityAt < 90) break;
        this.lastAbilityAt = now;
        const frequencies = {
          poison: 330,
          blast: 145,
          stun: 118,
          critical: 880,
          chain: 520,
          rapid: 690,
          burst: 175,
          spread: 410,
          control: 275,
          support: 590,
          coin: 760,
          resonance: 475,
          lineage: 625,
          execute: 210,
          solo: 365
        } as const;
        const low = event.kind === "blast" || event.kind === "burst" || event.kind === "stun" || event.kind === "execute";
        this.tone(frequencies[event.kind], low ? 0.13 : 0.08, low ? "sawtooth" : "triangle", 0.011, low ? 0.66 : 1.24);
        break;
      }
      case "shot": {
        const now = performance.now();
        if (now - this.lastShotAt >= 95) {
          this.tone(event.critical ? 740 : 220, 0.032, "square", event.critical ? 0.012 : 0.0038, 0.82);
          this.lastShotAt = now;
        }
        break;
      }
      default:
        break;
    }
  }

  getDebugState(): AudioDebugState {
    return {
      unlocked: this.unlocked,
      targetBgmId: this.targetBgmId,
      activeBgmId: this.activeBgmId,
      activeSrc: this.activeBgm?.currentSrc || this.activeBgm?.src || null,
      bgmPlaying: Boolean(this.activeBgm && !this.activeBgm.paused && this.activeBgm.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA),
      activeVolume: this.activeBgm?.volume ?? 0,
      lastError: this.lastError,
      settings: this.audioSettings,
      sfxPlayCount: this.sfxPlayCount,
      sfxSuppressedCount: this.sfxSuppressedCount,
      sfxActiveVoices: this.countActiveVoices(),
      lastSfxId: this.lastSfxId,
      sfxCounts: Object.fromEntries(this.sfxCounts)
    };
  }

  private countActiveVoices(): number {
    let active = 0;
    for (const node of this.voiceMeta.keys()) {
      if (node.paused || node.ended) this.voiceMeta.delete(node);
      else active += 1;
    }
    return active;
  }

  private commitSettings(): void {
    saveAudioSettings(this.settings);
    this.applyMixVolumes();
  }

  private applyMixVolumes(): void {
    if (this.activeBgm && this.activeBgmId) this.activeBgm.volume = this.bgmVolume(this.activeBgmId);
    if (this.incomingBgm && this.targetBgmId) this.incomingBgm.volume = this.bgmVolume(this.targetBgmId);
  }

  private sfxEnabled(): boolean {
    return this.unlocked && !this.settings.masterMuted && !this.settings.sfxMuted && this.settings.sfxVolume > 0;
  }

  private bgmVolume(id: BgmId): number {
    if (this.settings.masterMuted || this.settings.bgmMuted) return 0;
    return Math.min(1, this.settings.bgmVolume * BGM_MIX_LEVEL[id]);
  }

  private playSfx(id: SfxId, options: { rate?: number } = {}): void {
    if (!this.sfxEnabled()) return;
    const rule = SFX_RULES[id];
    const now = performance.now();
    const gapMs = Math.max(SFX_MIN_RETRIGGER_MS, rule.gapMs);
    if (now - (this.lastSfxAt.get(id) ?? -Infinity) < gapMs) {
      this.sfxSuppressedCount += 1;
      return;
    }

    const high = rule.priority === "high";
    if (!this.reserveVoice(high)) {
      this.sfxSuppressedCount += 1;
      return;
    }
    this.lastSfxAt.set(id, now);

    const pool = this.sfxPool(id, rule.poolSize);
    let index = pool.findIndex((candidate) => candidate.paused || candidate.ended);
    if (index < 0) index = this.sfxPoolIndices.get(id) ?? 0;
    const node = pool[index] as HTMLAudioElement;
    this.sfxPoolIndices.set(id, (index + 1) % pool.length);
    this.stopVoice(node);

    const jitter = rule.jitter ? 1 + (Math.random() * 2 - 1) * SFX_JITTER_RATIO : 1;
    node.currentTime = 0;
    node.playbackRate = Math.min(4, Math.max(0.25, (options.rate ?? 1) * jitter));
    node.volume = Math.min(1, this.settings.sfxVolume * rule.volume * jitter);
    this.voiceMeta.set(node, { high, startedAt: now });
    if (rule.maxMs !== undefined) this.scheduleTrim(node, rule.maxMs);

    this.sfxPlayCount += 1;
    this.sfxCounts.set(id, (this.sfxCounts.get(id) ?? 0) + 1);
    this.lastSfxId = id;
    void node.play().catch((error: unknown) => {
      this.voiceMeta.delete(node);
      this.lastError = error instanceof Error ? error.message : String(error);
    });
  }

  private playSfxAfterPaint(id: SfxId): void {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => this.playSfx(id), 0);
    });
  }

  private scheduleWaveSfxPreload(): void {
    if (this.waveSfxPreloadScheduled) return;
    this.waveSfxPreloadScheduled = true;
    window.setTimeout(() => {
      // The boss entrance now uses the v3 drum, so that file joins the warm-up.
      for (const id of ["wave-start", "fx-boss-drum"] as const) {
        const rule = SFX_RULES[id];
        for (const node of this.sfxPool(id, rule.poolSize)) node.load();
      }
    }, 0);
  }

  /** Counts sounding one-shots, evicting a low-priority voice for a milestone sound. */
  private reserveVoice(high: boolean): boolean {
    let active = 0;
    let oldest: HTMLAudioElement | null = null;
    let oldestAt = Infinity;
    for (const [node, meta] of this.voiceMeta) {
      if (node.paused || node.ended) {
        this.voiceMeta.delete(node);
        continue;
      }
      active += 1;
      if (!meta.high && meta.startedAt < oldestAt) {
        oldestAt = meta.startedAt;
        oldest = node;
      }
    }
    if (active < SFX_MAX_POLYPHONY) return true;
    if (!high || !oldest) return false;
    this.stopVoice(oldest);
    return true;
  }

  private stopVoice(node: HTMLAudioElement): void {
    const timer = this.trimTimers.get(node);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.trimTimers.delete(node);
    }
    node.pause();
    this.voiceMeta.delete(node);
  }

  /**
   * Fades the tail out at maxMs instead of trimming the MP3, keeping the shipped
   * files byte-identical to the Codex delivery while the UI stays responsive.
   */
  private scheduleTrim(node: HTMLAudioElement, maxMs: number): void {
    const fadeMs = Math.min(180, maxMs * 0.35);
    const steps = 6;
    const start = node.volume;
    let step = 0;
    const tick = (): void => {
      step += 1;
      if (node.paused) {
        this.trimTimers.delete(node);
        return;
      }
      node.volume = Math.max(0, start * (1 - step / steps));
      if (step >= steps) {
        this.trimTimers.delete(node);
        this.stopVoice(node);
        return;
      }
      this.trimTimers.set(node, window.setTimeout(tick, fadeMs / steps));
    };
    this.trimTimers.set(node, window.setTimeout(tick, Math.max(0, maxMs - fadeMs)));
  }

  private cancelPendingStamp(): void {
    if (this.pendingStampTimer === 0) return;
    window.clearTimeout(this.pendingStampTimer);
    this.pendingStampTimer = 0;
  }

  private sfxPool(id: SfxId, size: number): HTMLAudioElement[] {
    const existing = this.sfxPools.get(id);
    if (existing) return existing;
    const source = assetSource(id, "sfx");
    const pool = Array.from({ length: size }, () => {
      const node = new Audio(source);
      node.preload = "auto";
      // Rate changes must move pitch too, otherwise the anti-fatigue jitter is inaudible.
      node.preservesPitch = false;
      node.addEventListener("ended", () => this.voiceMeta.delete(node));
      return node;
    });
    this.sfxPools.set(id, pool);
    return pool;
  }

  private requestBgm(id: BgmId | null): void {
    if (this.targetBgmId === id) return;
    this.targetBgmId = id;
    if (this.unlocked) this.beginCrossfade(id);
  }

  private beginCrossfade(id: BgmId | null): void {
    this.fadeGeneration += 1;
    const generation = this.fadeGeneration;
    if (this.fadeTimer !== 0) window.clearInterval(this.fadeTimer);
    this.fadeTimer = 0;
    if (this.incomingBgm && this.incomingBgm !== this.activeBgm) this.incomingBgm.pause();
    this.incomingBgm = null;

    const outgoing = this.activeBgm;
    const outgoingStart = outgoing?.volume ?? 0;
    if (id && id === this.activeBgmId && outgoing) {
      outgoing.volume = this.bgmVolume(id);
      return;
    }

    let incoming: HTMLAudioElement | null = null;
    if (id) {
      incoming = this.bgmNode(id);
      incoming.volume = 0;
      this.incomingBgm = incoming;
      void incoming.play().catch((error: unknown) => {
        if (generation !== this.fadeGeneration) return;
        this.lastError = error instanceof Error ? error.message : String(error);
      });
      if (!outgoing) {
        this.activeBgm = incoming;
        this.activeBgmId = id;
      }
    }

    const startedAt = performance.now();
    const step = (): void => {
      if (generation !== this.fadeGeneration) return;
      const progress = Math.min(1, (performance.now() - startedAt) / BGM_CROSSFADE_MS);
      if (outgoing && outgoing !== incoming) outgoing.volume = Math.max(0, outgoingStart * (1 - progress));
      if (incoming && id) incoming.volume = Math.max(0, this.bgmVolume(id) * progress);
      if (progress < 1) return;
      if (this.fadeTimer !== 0) window.clearInterval(this.fadeTimer);
      this.fadeTimer = 0;
      if (outgoing && outgoing !== incoming) outgoing.pause();
      this.activeBgm = incoming;
      this.activeBgmId = id;
      this.incomingBgm = null;
    };
    step();
    this.fadeTimer = window.setInterval(step, BGM_FADE_STEP_MS);
  }

  private bgmNode(id: BgmId): HTMLAudioElement {
    const existing = this.bgmNodes.get(id);
    if (existing) return existing;
    const node = new Audio(assetSource(id, "bgm"));
    node.loop = true;
    node.preload = "auto";
    this.bgmNodes.set(id, node);
    return node;
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    try {
      this.context = new AudioContext();
    } catch (error: unknown) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
    return this.context;
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, endRatio: number): void {
    const context = this.ensureContext();
    if (!context || context.state !== "running") return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, frequency * endRatio), now + duration);
    gain.gain.setValueAtTime(volume * this.settings.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
