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
