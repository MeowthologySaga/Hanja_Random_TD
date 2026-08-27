function hashString(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0 || 0x9e3779b9;
}
export class SeededRng {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) {
      throw new Error("Cannot pick from an empty list.");
    }
    return item;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  snapshot(): number {
    return this.state;
  }

  /**
   * `snapshot()` 이 뜬 내부 상태를 그대로 되돌린다 — 런 저장·이어하기(트랙 V)의
   * 결정성 축.
   *
   * 이 난수기의 상태는 uint32 하나가 전부라(mulberry32 계열) 스냅샷 한 숫자면
   * 다음에 나올 수열이 완전히 정해진다. 저장 시점의 숫자를 되돌려 놓으면
   * 이어 돌린 판과 쭉 돌린 판이 같은 눈을 본다.
   */
  restore(state: number): void {
    this.state = state >>> 0;
  }
}

export function createRunSeed(now = Date.now()): string {
  return `JR-${now.toString(36).toUpperCase().slice(-6)}`;
}
