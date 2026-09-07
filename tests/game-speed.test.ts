/*
 * 배속은 사람의 설정이지 판의 상태가 아니다 (v042).
 *
 * 여태 새로고침·새 판마다 1× 로 돌아갔다. 100웨이브 한 판이 사람 손으로는 60분
 * 남짓이라 2×·3× 로 도는 사람이 많은데, 판을 열 때마다 다시 눌러야 했다.
 *
 * 저장소는 타입 계약을 안 지킨다 — 다른 탭·옛 판·손으로 고친 값이 그대로 들어오므로
 * 읽는 쪽이 값으로 확인해야 한다.
 */
import { describe, expect, it } from "vitest";
import { GAME_SPEED_STORAGE_KEY, loadGameSpeed, saveGameSpeed } from "../src/ui/game-speed";

function fakeStorage(initial?: string): Pick<Storage, "getItem" | "setItem"> & { value: string | null } {
  return {
    value: initial ?? null,
    getItem(key: string): string | null {
      return key === GAME_SPEED_STORAGE_KEY ? this.value : null;
    },
    setItem(key: string, next: string): void {
      if (key === GAME_SPEED_STORAGE_KEY) this.value = next;
    }
  };
}

describe("배속 기억", () => {
  it("저장이 비어 있으면 1×", () => {
    expect(loadGameSpeed(fakeStorage())).toBe(1);
  });

  it("눌러 둔 배속이 그대로 돌아온다", () => {
    const storage = fakeStorage();
    saveGameSpeed(3, storage);
    expect(storage.value).toBe("3");
    expect(loadGameSpeed(storage)).toBe(3);
  });

  it("저장소가 이상한 값을 주면 1× 로 접는다", () => {
    for (const raw of ["9", "abc", "", "1.5", "0", "-2"]) {
      expect(loadGameSpeed(fakeStorage(raw)), raw).toBe(1);
    }
  });

  it("저장소가 던져도 판을 멈추지 않는다", () => {
    const angry = {
      getItem(): string | null {
        throw new Error("사생활 보호 창");
      },
      setItem(): void {
        throw new Error("사생활 보호 창");
      }
    };
    expect(loadGameSpeed(angry)).toBe(1);
    expect(() => saveGameSpeed(2, angry)).not.toThrow();
  });
});
