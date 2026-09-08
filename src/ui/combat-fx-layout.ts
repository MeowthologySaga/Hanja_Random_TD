import { directionOnPath, positionOnPath } from "../core/content";
import type { Point } from "../core/types";

export interface AbilityZoneSpriteLayout {
  point: Point;
  angle: number;
  width: number;
  height: number;
}

/**
 * 광역 장판 스프라이트 배치.
 *
 * aoe-modular-fx-pack-v1 채택: 원근 타원을 1.48R x 0.62R 로 비균등 확대하던
 * 방식은 굽은 먹길 위에서 한 방향 도로 장판으로 읽혀 폐기했다.
 * 자산은 방사형 256x256 이므로 표시 폭·높이는 항상 같은 D = 2R 이다.
 * angle 은 경로 접선으로 유지한다 — 방사형 자산이라 판독성을 바꾸지 않으며,
 * 세로/모서리 구간 계측(data-ability-zone-*-count)이 이 값을 쓴다.
 */
export function abilityZoneSpriteLayout(progress: number, radius: number, pulse = 1): AbilityZoneSpriteLayout {
  const safeRadius = Math.max(0, radius);
  const safePulse = Math.max(0, pulse);
  const smoothingDistance = Math.min(46, Math.max(22, safeRadius * 0.32));
  const direction = directionOnPath(progress, smoothingDistance);
  const diameter = safeRadius * 2 * safePulse;
  return {
    point: positionOnPath(progress),
    angle: Math.atan2(direction.y, direction.x),
    width: diameter,
    height: diameter
  };
}

/** FX_SPEC 3.1.5 — 모듈 회전은 결정적 ±8° 만 허용한다. 매 프레임 난수 금지. */
export function deterministicZoneRotation(seed: number): number {
  const unit = ((Math.sin(seed * 127.1) * 43758.5453) % 1 + 1) % 1;
  return (unit * 2 - 1) * (8 * Math.PI / 180);
}

/**
 * 성어 대형 플래시의 가로 자리 (v042).
 *
 * 이 플래시는 세 줄이다 — 넉 자(62px) · 읽기(19px) · **뜻(15px, 새로 붙음)**.
 * 여태 클램프가 반폭을 150px 으로 **가정**했는데, 실측하면 성어 뜻은 중앙 17자
 * 최대 25자(104구)라 15px 로 375px, 반폭 188px 이다. 가정을 넘는 문장이 전체의
 * 15%(20자 초과 16구)라 왼쪽 끝 칸에서 발동하면 뜻이 잘려 나갔을 것이다.
 *
 * 그래서 가장 넓은 줄을 재서 그 반폭으로 클램프한다. 세 줄이 다 전장 안에 들되,
 * 문장이 전장보다 넓으면(가능하지 않지만) 가운데로 세워 양쪽을 똑같이 잃는다 —
 * 한쪽만 잘리면 읽는 사람이 잘렸다는 사실조차 모른다.
 */
export function idiomFlashClampX(centerX: number, widestText: number, scale: number, worldWidth: number, margin = 12): number {
  const half = Math.min(worldWidth / 2, widestText * scale / 2 + margin);
  return Math.min(worldWidth - half, Math.max(half, centerX));
}

/**
 * 클램프에 넣는 배율은 **고정한다** (v042).
 *
 * 플래시는 0.216초 동안 0.82 에서 1.06 으로 부푼다. 그 값을 그대로 클램프에 넘기면
 * 자리가 프레임마다 바뀌어, 가장자리 칸에서 발동한 세 줄이 커지는 동안 가로로
 * 45px 미끄러졌다가 꺼지면서 11px 되돌아온다 — 「튀어 오른다」로 읽혀야 할 동작이
 * 「옆으로 흐른다」로 읽힌다. 붙이기 전 x 는 프레임 내내 고정이었다.
 *
 * 가장 크게 부푼 순간을 기준으로 한 번만 잡는다. 그러면 자리는 고정이고 크기만
 * 움직인다 — 작을 때 여백이 조금 더 남을 뿐 잘리지 않는다.
 */
export const IDIOM_FLASH_MAX_SCALE = 1.06;

/**
 * 성어 플래시의 **세로** 자리 — 마지막 줄(뜻)의 잉크까지 아래 안전 띠 위에 둔다.
 *
 * 가로만 재서 고치고 세로는 두 줄 시절 예산(`WORLD_HEIGHT - 120`)을 그대로 뒀더니
 * 산술이 어긋났다. 클램프 상한 y = 720 − 120 = 600 이고 뜻 줄은 그 아래 76px 인데,
 * 최대 배율 1.06 을 얹으면 중심이 680.6 이다. 예약 바닥은 720 − 44 = 676 이라
 * (STAGE_SAFE_AREA.bottom) **셋째 줄이 설계상 이미 띠를 밟고 있었다** — 그 자리에는
 * 우두머리 시계와 조작 안내 칩이 산다.
 *
 * 잉크 바닥은 기준선(76) + 아랫배 + 먹 윤곽 절반이다. `textBaseline="middle"` 이라
 * 아랫배는 em 상자 절반(7.5)이 아니라 실측 하강폭이고, 성어 뜻 104구를 15px 로 재면
 * 최대 6.5px(전형 5.5)다. 윤곽은 `lineWidth 5` 의 절반 2.5. 합쳐 85 로 잡는다.
 */
export const IDIOM_FLASH_MEANING_INK = 76 + 6.5 + 2.5;

export function idiomFlashClampY(centerY: number, scale: number, worldHeight: number, safeBottom: number, minY = 120): number {
  const maxY = worldHeight - safeBottom - IDIOM_FLASH_MEANING_INK * scale;
  // 위 예산과 아래 예산이 만나면(좁은 창은 없지만 규칙으로) 위를 지킨다 — 넉 자가 주인공이다.
  return Math.min(Math.max(minY, maxY), Math.max(minY, centerY));
}

/*
 * ── 야생 자령의 글자 명패 (v042) ───────────────────────────────────────
 *
 * 한 웨이브는 한 글자이고 그 글자가 적의 몸에 찍혀 나온다 — 100웨이브면 화면
 * 한가운데서 99자를 만나는, 이 게임에서 가장 큰 학습 통로다. 그런데 그 글자만
 * **조판 규칙 밖에** 서 있었다.
 *
 * 아군 글자는 보호를 넷 받는다(draw-tower.ts): 한자 강조 OFF 존중 · 역보정으로
 * 화면 고정 크기 · 안전 영역 클램프 · 라벨 등록. 적 글자는 **하나도** 못 받았다.
 * 실측(6시드 · 155,921 교전 틱 · 901,876 표본):
 *
 *   1~5웨이브    24.1% 가 잘리거나 띠 밑 (그중 14.9% 가 아래 칩 띠)
 *   11~25웨이브  28.0%
 *   76~100웨이브 11.3% · 그리고 **30.3% 가 다른 적의 명패에 절반 넘게 덮인다**
 *
 * 두 결함이 판의 양 끝에 산다 — **자리 문제는 초반, 밀집 문제는 후반**이다.
 *
 * 규칙을 여기 둔 까닭은 규범이다. 봇은 화면을 안 만지므로 시뮬 게이트가 이 자리를
 * 영영 못 본다(성어 플래시 클램프를 여기 둔 것과 같은 이유). 순수 잎이라야 창 없는
 * vitest 가 지킨다.
 */

/**
 * 명패를 몸 **위로** 뒤집을 것인가.
 *
 * 기본 자리는 발치(몸 아래)다 — 몸을 안 가리려고 그렇게 뒀다. 그런데 노선이 무대
 * 아래쪽을 지날 때 그 발치가 아래 안전 띠(지도 배율 칩·조작 안내가 사는 44px)로
 * 들어간다. 실측으로 1~5웨이브에서 나쁜 경우의 14.9%가 그 띠 하나였다.
 *
 * 옆으로는 **안 민다.** 아군 명패는 자령이 안 움직이니 밀어도 공짜지만, 움직이는
 * 적의 글자를 몸에서 떼면 「초상과 글자가 짝」이라는 학습 알맹이가 깨진다. 위아래로만
 * 뒤집으면 짝은 그대로다.
 */
export function enemyPlateFlipsUp(screenY: number, plateOffset: number, plateRadius: number, worldHeight: number, safeBottom: number): boolean {
  return screenY + plateOffset + plateRadius > worldHeight - safeBottom;
}

/*
 * 가독 문턱을 **안 둔다** — 역보정이 그 일을 이미 한다.
 *
 * 처음에는 「화면 10px 밑이면 먹 얼룩이니 안 그린다」는 문턱을 뒀다. 그런데 같은
 * 손질에서 글자를 역보정해 **배율과 무관하게 12px(우두머리 18px)** 로 고정했으므로,
 * 그 문턱은 영영 안 걸린다. 못 걸리는 가드는 다음 사람에게 「그 갈래가 살아 있다」고
 * 거짓말한다 — 이 바퀴에서만 같은 부류를 세 번 걷어냈다.
 *
 * 밀집 겹침도 역보정이 함께 줄인다. 기본 배율 2 에서 명패 반지름이 월드 10px =
 * 화면 20px 이던 것이 화면 10px 이 되어 **넓이가 1/4** 이다. 실측된 후반 겹침
 * (76~100웨이브에서 30.3%가 절반 넘게 덮임)은 그 크기에서 나온 값이라, 따로 솎아 내는
 * 규칙을 더하기 전에 이 축소만으로 얼마나 남는지부터 봐야 한다. 솎아 내기는 「어떤 적은
 * 글자가 있고 어떤 적은 없다」로 읽힐 위험이 있어 값이 확인되기 전에는 안 넣는다.
 */
