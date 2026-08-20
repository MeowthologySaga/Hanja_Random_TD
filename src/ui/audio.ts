import type { GameEvent } from "../core/types";

export class SoundManager {
  private context: AudioContext | null = null;
  private muted = false;
  private lastShotAt = 0;
  private lastAbilityAt = 0;
  private lastSummonAt = 0;

  get isMuted(): boolean {
    return this.muted;
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (!this.muted) this.ensureContext();
    return this.muted;
  }

  unlock(): void {
    this.ensureContext();
    if (this.context?.state === "suspended") void this.context.resume();
  }

  handle(event: GameEvent): void {
    if (this.muted) return;
    switch (event.type) {
      case "summon":
        if (performance.now() - this.lastSummonAt < 80) break;
        this.lastSummonAt = performance.now();
        this.tone(420, 0.08, "triangle", 0.025, 1.3);
        window.setTimeout(() => this.tone(610, 0.11, "triangle", 0.02, 1.15), 55);
        break;
      case "statUpgrade":
        this.tone(280, 0.1, "triangle", 0.03, 1.45);
        window.setTimeout(() => this.tone(560, 0.14, "triangle", 0.025, 1.18), 70);
        break;
      case "evolve":
        this.tone(330, 0.1, "sine", 0.035, 1.5);
        window.setTimeout(() => this.tone(660, 0.18, "sine", 0.03, 1.3), 75);
        break;
      case "goal":
        [0, 90, 180].forEach((delay, index) => {
          window.setTimeout(() => this.tone([440, 554, 659][index] as number, 0.28, "triangle", 0.028, 1.08), delay);
        });
        break;
      case "interest":
        this.tone(660, 0.08, "triangle", 0.022, 1.18);
        window.setTimeout(() => this.tone(880, 0.12, "triangle", 0.018, 1.08), 70);
        break;
      case "idiom":
        [0, 85, 170, 255].forEach((delay, index) => {
          window.setTimeout(() => this.tone([392, 494, 587, 784][index] as number, 0.32, "triangle", 0.034, 1.06), delay);
        });
        break;
      case "ability": {
        const now = performance.now();
        if (now - this.lastAbilityAt < 55) break;
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
        this.tone(frequencies[event.kind], low ? 0.14 : 0.09, low ? "sawtooth" : "triangle", 0.016, low ? 0.66 : 1.24);
        break;
      }
      case "shot": {
        const now = performance.now();
        if (now - this.lastShotAt > 70) {
          this.tone(event.critical ? 740 : 220, 0.035, "square", event.critical ? 0.018 : 0.006, 0.82);
          this.lastShotAt = now;
        }
        break;
      }
      case "wave":
        this.tone(event.boss ? 92 : 260, event.boss ? 0.7 : 0.2, "triangle", 0.03, event.boss ? 0.58 : 1.35);
        break;
      case "phase":
        if (event.phase === "victory") {
          [0, 110, 220].forEach((delay, index) => window.setTimeout(() => this.tone([392, 523, 659][index] as number, 0.34, "triangle", 0.035, 1.04), delay));
        } else if (event.phase === "defeat") {
          this.tone(160, 0.7, "sawtooth", 0.035, 0.46);
        }
        break;
      default:
        break;
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.context) {
      const AudioContextClass = window.AudioContext;
      this.context = new AudioContextClass();
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
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
