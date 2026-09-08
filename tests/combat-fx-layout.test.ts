import { describe, expect, it } from "vitest";
import { directionOnPath } from "../src/core/content";
import {
  abilityZoneSpriteLayout,
  deterministicZoneRotation,
  IDIOM_FLASH_MAX_SCALE,
  IDIOM_FLASH_MEANING_INK,
  enemyPlateFlipsUp,
  idiomFlashClampX,
  idiomFlashClampY
} from "../src/ui/combat-fx-layout";

describe("combat effect path layout", () => {
  it("follows vertical and horizontal route segments", () => {
    expect(directionOnPath(0.03125)).toMatchObject({ x: 0, y: -1 });
    expect(directionOnPath(0.09375)).toMatchObject({ x: 1, y: 0 });
    expect(abilityZoneSpriteLayout(0.03125, 80).angle).toBeCloseTo(-Math.PI / 2, 5);
    expect(abilityZoneSpriteLayout(0.09375, 80).angle).toBeCloseTo(0, 5);
  });

  it("turns diagonally through a route corner", () => {
    const direction = directionOnPath(0.0625);
    expect(direction.x).toBeCloseTo(Math.SQRT1_2, 5);
    expect(direction.y).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(abilityZoneSpriteLayout(0.0625, 80).angle).toBeCloseTo(-Math.PI / 4, 5);
  });

  it("keeps zone modules square (aoe-modular-fx-pack-v1)", () => {
    expect(abilityZoneSpriteLayout(0.1, 100, 1.02)).toMatchObject({ width: 204, height: 204 });
  });

  it("bounds deterministic rotation to ±8 degrees and stays stable per seed", () => {
    const limit = 8 * Math.PI / 180;
    for (const seed of [1, 7, 42, 999]) {
      const angle = deterministicZoneRotation(seed);
      expect(Math.abs(angle)).toBeLessThanOrEqual(limit);
      expect(deterministicZoneRotation(seed)).toBe(angle);
    }
  });
});

/*
 * 성어가 켜지는 순간 뜻이 화면에 있는가 (v042).
 *
 * 이 게임이 성어를 가르치는 통로는 셋인데(도감·성어 갈피·발동) 앞의 둘은 사람이
 * 열어야 열리고 마지막 하나만 저절로 온다. 그런데 그 하나가 뜻을 빼고 왔다 —
 * 「以心傳心 · 이심전심 · 발동」까지만 말하고 뜻은 오른쪽 갈피에 두고 왔다.
 *
 * 뜻을 붙이면 줄이 넓어진다. 실측 성어 뜻은 중앙 17자 · 최대 25자(104구)이고,
 * 15px 로 25자면 375px — 반폭 188px 이라 옛 클램프의 가정(150px)을 넘는다. 전체의
 * 15%(20자 초과 16구)가 그 가정 밖이라 왼쪽 끝 칸에서 발동하면 잘렸을 것이다.
 */
describe("성어 대형 플래시 가로 자리", () => {
  const WORLD = 880;

  it("왼쪽 끝에서 발동해도 가장 넓은 줄이 전장 안에 든다", () => {
    // 25자 × 15px = 375px — 실측 최장 뜻.
    const x = idiomFlashClampX(0, 375, 1, WORLD);
    expect(x - 375 / 2).toBeGreaterThanOrEqual(0);
  });

  it("오른쪽 끝에서도 마찬가지다", () => {
    const x = idiomFlashClampX(WORLD, 375, 1, WORLD);
    expect(x + 375 / 2).toBeLessThanOrEqual(WORLD);
  });

  it("튀어 오르는 배율까지 세어 잡는다 — 가장 크게 부푼 순간이 가장 위험하다", () => {
    // drawIdiomFlash 의 배율 상한은 0.82 + 0.24 = 1.06.
    const x = idiomFlashClampX(0, 375, 1.06, WORLD);
    expect(x - 375 * 1.06 / 2).toBeGreaterThanOrEqual(0);
  });

  it("가운데에서 발동하면 옮기지 않는다", () => {
    expect(idiomFlashClampX(440, 375, 1, WORLD)).toBe(440);
  });

  it("전장보다 넓은 문장은 가운데로 세운다 — 한쪽만 잘리면 잘린 줄도 모른다", () => {
    expect(idiomFlashClampX(20, 1_200, 1, WORLD)).toBe(WORLD / 2);
    expect(idiomFlashClampX(860, 1_200, 1, WORLD)).toBe(WORLD / 2);
  });
});

/*
 * 세로도 재서 잡는다 (v042).
 *
 * 가로만 고치고 세로는 두 줄 시절 예산(WORLD_HEIGHT - 120)을 그대로 뒀었다. 상한
 * y=600 에 뜻 줄이 +76 이고 배율 상한 1.06 을 얹으면 680.6 인데, 예약 바닥은
 * 720-44=676 이라 **셋째 줄이 설계상 이미 아래 안전 띠를 밟고 있었다** — 그 자리에는
 * 우두머리 시계와 조작 안내 칩이 산다.
 */
describe("성어 대형 플래시 세로 자리", () => {
  const WORLD_H = 720;
  const SAFE_BOTTOM = 44;

  it("아래 끝에서 발동해도 뜻 줄의 잉크가 안전 띠를 안 밟는다", () => {
    const y = idiomFlashClampY(WORLD_H, IDIOM_FLASH_MAX_SCALE, WORLD_H, SAFE_BOTTOM);
    expect(y + IDIOM_FLASH_MEANING_INK * IDIOM_FLASH_MAX_SCALE).toBeLessThanOrEqual(WORLD_H - SAFE_BOTTOM);
  });

  it("옛 예산(720-120=600)은 실제로 띠를 밟았다 — 이 시험이 그 회귀를 막는다", () => {
    const old = 600;
    expect(old + IDIOM_FLASH_MEANING_INK * IDIOM_FLASH_MAX_SCALE).toBeGreaterThan(WORLD_H - SAFE_BOTTOM);
    expect(idiomFlashClampY(WORLD_H, IDIOM_FLASH_MAX_SCALE, WORLD_H, SAFE_BOTTOM)).toBeLessThan(old);
  });

  it("위 예산 120 은 그대로 지킨다 — 넉 자가 위 띠로 올라가지 않는다", () => {
    expect(idiomFlashClampY(0, IDIOM_FLASH_MAX_SCALE, WORLD_H, SAFE_BOTTOM)).toBe(120);
    expect(idiomFlashClampY(-500, IDIOM_FLASH_MAX_SCALE, WORLD_H, SAFE_BOTTOM)).toBe(120);
  });

  it("가운데에서 발동하면 옮기지 않는다", () => {
    expect(idiomFlashClampY(360, IDIOM_FLASH_MAX_SCALE, WORLD_H, SAFE_BOTTOM)).toBe(360);
  });
});

/*
 * 클램프에 넣는 배율은 프레임마다 변하면 안 된다 (v042).
 *
 * 플래시는 0.216초 동안 0.82 → 1.06 으로 부푼다. 그 값을 그대로 넘기면 가장자리
 * 칸에서 세 줄이 커지는 동안 옆으로 미끄러진다 — 「튀어 오른다」가 「흐른다」로 읽힌다.
 */
describe("플래시 자리는 부푸는 동안 안 움직인다", () => {
  it("배율을 태우면 가로가 프레임마다 밀린다 — 그래서 태우지 않는다", () => {
    const drift = Math.abs(idiomFlashClampX(0, 375, 1.06, 880) - idiomFlashClampX(0, 375, 0.82, 880));
    expect(drift).toBeGreaterThan(20);
  });

  it("고정 배율로 잡으면 자리는 하나뿐이다", () => {
    const fixed = idiomFlashClampX(0, 375, IDIOM_FLASH_MAX_SCALE, 880);
    for (const animating of [0.82, 0.9, 1.0, 1.06]) {
      // 그리는 배율이 무엇이든 클램프에 넣는 값은 늘 최대 배율이다.
      expect(idiomFlashClampX(0, 375, IDIOM_FLASH_MAX_SCALE, 880)).toBe(fixed);
      expect(animating).toBeLessThanOrEqual(IDIOM_FLASH_MAX_SCALE);
    }
  });

  it("세로도 같은 고정 배율을 쓴다", () => {
    const fixed = idiomFlashClampY(720, IDIOM_FLASH_MAX_SCALE, 720, 44);
    expect(idiomFlashClampY(720, IDIOM_FLASH_MAX_SCALE, 720, 44)).toBe(fixed);
  });
});

/*
 * 야생 자령의 글자가 조판 규칙 안에 있는가 (v042).
 *
 * 한 웨이브는 한 글자이고 그 글자가 적의 몸에 찍혀 나온다 — 이 게임에서 가장 큰
 * 학습 통로인데, 그 글자만 규칙 밖에 서 있었다. 아군 글자는 보호를 넷 받는다
 * (한자 강조 존중 · 역보정 · 안전 영역 · 라벨 등록). 적 글자는 하나도 못 받았다.
 *
 * 실측(6시드 · 901,876 표본): 1~5웨이브 24.1% · 11~25웨이브 28.0%가 잘리거나 띠 밑.
 * 가장 큰 조각이 아래 칩 띠였다(1~5웨이브 나쁜 경우의 14.9%).
 *
 * 봇은 화면을 안 만지므로 시뮬 게이트가 이 자리를 영영 못 본다.
 */
describe("야생 자령 글자 명패", () => {
  const WORLD_H = 720;
  const SAFE_BOTTOM = 44;

  it("발치가 아래 안전 띠를 밟으면 위로 뒤집는다", () => {
    // 그 44px 에는 지도 배율 칩과 조작 안내가 산다 — 밟으면 글자가 통째로 안 읽힌다.
    expect(enemyPlateFlipsUp(660, 14, 10, WORLD_H, SAFE_BOTTOM)).toBe(true);
  });

  it("띠 위를 지나는 동안은 발치 그대로다 — 몸을 안 가리는 자리가 기본이다", () => {
    expect(enemyPlateFlipsUp(400, 14, 10, WORLD_H, SAFE_BOTTOM)).toBe(false);
  });

  it("경계에서 한 픽셀 차이로 갈린다", () => {
    // 676 이 예약 바닥(720-44)이다. 명패 아랫변이 그 선을 넘는 순간부터 뒤집는다.
    expect(enemyPlateFlipsUp(676 - 24, 14, 10, WORLD_H, SAFE_BOTTOM)).toBe(false);
    expect(enemyPlateFlipsUp(676 - 23, 14, 10, WORLD_H, SAFE_BOTTOM)).toBe(true);
  });

  it("우두머리는 명패가 커서 더 일찍 뒤집는다", () => {
    // 650 + 14 + 10 = 674 (띠 위) · 650 + 14 + 15 = 679 (띠를 밟는다). 예약 바닥은 676.
    const normalFlips = enemyPlateFlipsUp(650, 14, 10, WORLD_H, SAFE_BOTTOM);
    const bossFlips = enemyPlateFlipsUp(650, 14, 15, WORLD_H, SAFE_BOTTOM);
    expect(normalFlips).toBe(false);
    expect(bossFlips).toBe(true);
  });

  it("역보정이 가독 문턱을 대신한다 — 글자는 배율과 무관하게 같은 크기다", () => {
    /*
     * 처음에는 「화면 10px 밑이면 안 그린다」는 문턱을 뒀는데, 같은 손질에서 글자를
     * 역보정해 12px(우두머리 18px)로 고정했으므로 그 문턱은 **영영 안 걸린다.**
     * 못 걸리는 가드는 「그 갈래가 살아 있다」는 거짓말이라 걷어냈다. 이 시험은 그
     * 결정을 적어 둔다 — 다시 배율을 태우면 문턱이 필요해진다.
     */
    const atZoom = (fontPx: number, zoom: number): number => fontPx / zoom * zoom;
    for (const zoom of [0.72, 1, 2, 5.2]) expect(atZoom(12, zoom)).toBe(12);
  });
});
