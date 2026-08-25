import { directionOnPath, positionOnPath } from "../core/content";
import type { Point } from "../core/types";

export interface AbilityZoneSpriteLayout {
  point: Point;
  angle: number;
  width: number;
  height: number;
}

export function abilityZoneSpriteLayout(progress: number, radius: number, pulse = 1): AbilityZoneSpriteLayout {
  const safeRadius = Math.max(0, radius);
  const safePulse = Math.max(0, pulse);
  const smoothingDistance = Math.min(46, Math.max(22, safeRadius * 0.32));
  const direction = directionOnPath(progress, smoothingDistance);
  return {
    point: positionOnPath(progress),
    angle: Math.atan2(direction.y, direction.x),
    width: safeRadius * 1.48 * safePulse,
    height: safeRadius * 0.62 * safePulse
  };
}
