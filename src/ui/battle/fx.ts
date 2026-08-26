/*
 * 전투 연출 풀과 갱신.
 */
import { type AbilityFxKind, type GameEvent, type Point, type Wuxing } from "../../core/types";
import { elementProjectileImage } from "../combat-fx-sprites";
import { isReady as isPolishSpriteReady } from "../polish-sprites";
import { calmBattlefield, canvas, context, ctx } from "../app-context";
import { drawIdiomRipples, isWorldPointVisible } from "./draw";

interface ProjectileFx {
  from: Point;
  to: Point;
  color: string;
  age: number;
  duration: number;
  critical: boolean;
  wuxing: Wuxing;
}

interface FloatFx {
  at: Point;
  text: string;
  color: string;
  age: number;
  duration: number;
  large: boolean;
}

interface RingFx {
  at: Point;
  color: string;
  age: number;
  duration: number;
}

interface AbilityBurstFx {
  at: Point;
  source: Point;
  glyph: string;
  color: string;
  kind: AbilityFxKind;
  age: number;
  duration: number;
}

interface TowerAbilityPopup {
  text: string;
  color: string;
  age: number;
  duration: number;
}

export const projectiles: ProjectileFx[] = [];

export const floaters: FloatFx[] = [];

export const rings: RingFx[] = [];

export const abilityBursts: AbilityBurstFx[] = [];

export const projectilePool: ProjectileFx[] = [];

export const floaterPool: FloatFx[] = [];

export const ringPool: RingFx[] = [];

export const abilityBurstPool: AbilityBurstFx[] = [];

export const towerAbilityPopups = new Map<number, TowerAbilityPopup>();

/**
 * p1-p2-polish-assets-pack-v1 의 일회성 래스터 연출(별승급 고리·사자성어 봉인).
 * 순수 피드백이라 승급·봉인 규칙이나 수치에는 관여하지 않는다. 에셋이 없으면
 * 이 연출만 건너뛰고 상태 전이는 그대로 진행된다.
 */
interface RasterBurstFx {
  readonly image: HTMLImageElement;
  readonly at: Point;
  readonly size: number;
  age: number;
}

const rasterBursts: RasterBurstFx[] = [];

/** 0~120ms 0.72→1.05, 120~520ms 1.0 으로 안착, 900ms 에 소멸. */
const RASTER_BURST_LIFE = 0.9;

export function pushRasterBurst(image: HTMLImageElement, at: Point, size: number): void {
  if (!isPolishSpriteReady(image)) return;
  if (rasterBursts.length >= 8) rasterBursts.shift();
  rasterBursts.push({ image, at: { x: at.x, y: at.y }, size, age: 0 });
}

/**
 * 봉인 발동 파문 — 코덱스 파문 마스크를 성어 색으로 물들여 네 칸에 한 번씩 띄운다.
 * `delay` 로 1번 칸부터 차례로 터뜨려 "이 넷이 이 순서"라는 사실을 한 번 더 말한다.
 */
export interface IdiomRippleFx {
  at: Point;
  color: string;
  age: number;
  delay: number;
  duration: number;
}

export const idiomRipples: IdiomRippleFx[] = [];

export function pushPooled<T>(active: T[], pool: T[], item: T, limit: number): void {
  if (active.length >= limit) {
    const recycled = active.shift();
    if (recycled && pool.length < limit) pool.push(recycled);
  }
  active.push(item);
}

export function takeProjectile(event: Extract<GameEvent, { type: "shot" }>): ProjectileFx {
  const item = projectilePool.pop() ?? { from: event.from, to: event.to, color: event.color, age: 0, duration: 0.1, critical: false, wuxing: event.wuxing };
  item.from = event.from;
  item.to = event.to;
  item.color = event.color;
  item.age = 0;
  // Combat simulation may run at 2x/3x, but projectile readability is a
  // presentation concern. `frame()` advances these FX with real time, and a
  // slightly longer flight keeps the raster silhouette visible without
  // turning the battlefield into a persistent particle layer.
  item.duration = event.critical ? 0.36 : 0.28;
  item.critical = event.critical;
  item.wuxing = event.wuxing;
  return item;
}

export function takeFloater(at: Point, text: string, color: string, duration: number, large: boolean): FloatFx {
  const item = floaterPool.pop() ?? { at, text, color, age: 0, duration, large };
  Object.assign(item, { at, text, color, age: 0, duration, large });
  return item;
}

export function takeRing(at: Point, color: string, duration: number): RingFx {
  const item = ringPool.pop() ?? { at, color, age: 0, duration };
  Object.assign(item, { at, color, age: 0, duration });
  return item;
}

export function takeAbilityBurst(event: Extract<GameEvent, { type: "ability" }>): AbilityBurstFx {
  const item = abilityBurstPool.pop() ?? { at: event.at, source: event.source, glyph: event.glyph, color: event.color, kind: event.kind, age: 0, duration: 0.42 };
  Object.assign(item, { at: event.at, source: event.source, glyph: event.glyph, color: event.color, kind: event.kind, age: 0, duration: 0.42 });
  return item;
}

export function recycleAll<T>(active: T[], pool: T[], limit: number): void {
  while (active.length > 0) {
    const item = active.pop();
    if (item && pool.length < limit) pool.push(item);
  }
}

export function updateAndDrawFx(delta: number): void {
  for (const projectile of projectiles) projectile.age += delta;
  for (const floater of floaters) floater.age += delta;
  for (const ring of rings) ring.age += delta;
  for (let index = rasterBursts.length - 1; index >= 0; index -= 1) {
    const burst = rasterBursts[index] as RasterBurstFx;
    burst.age += delta;
    if (burst.age >= RASTER_BURST_LIFE) {
      rasterBursts.splice(index, 1);
      continue;
    }
    if (!isWorldPointVisible(burst.at, burst.size * 0.6)) continue;
    // reduced motion·차분한 화면: 확대·회전 없이 0.25초 정지 후 페이드만.
    const calm = calmBattlefield();
    const scale = calm
      ? 1
      : burst.age < 0.12
        ? 0.72 + (burst.age / 0.12) * 0.33
        : burst.age < 0.52
          ? 1.05 - ((burst.age - 0.12) / 0.4) * 0.05
          : 1;
    const fadeFrom = calm ? 0.25 : 0.52;
    const alpha = burst.age < fadeFrom ? 1 : 1 - (burst.age - fadeFrom) / (RASTER_BURST_LIFE - fadeFrom);
    const drawn = burst.size * scale;
    context.save();
    context.globalAlpha = Math.max(0, alpha);
    context.drawImage(burst.image, burst.at.x - drawn / 2, burst.at.y - drawn / 2, drawn, drawn);
    context.restore();
  }
  for (const burst of abilityBursts) burst.age += delta;
  for (const ripple of idiomRipples) ripple.age += delta;
  if (ctx.idiomFlash) ctx.idiomFlash.age += delta;
  for (const popup of towerAbilityPopups.values()) popup.age += delta;
  let projectileSpriteDrawnThisFrame = false;
  for (const projectile of projectiles) {
    const ratio = Math.min(1, projectile.age / projectile.duration);
    const x = projectile.from.x + (projectile.to.x - projectile.from.x) * ratio;
    const y = projectile.from.y + (projectile.to.y - projectile.from.y) * ratio;
    if (!isWorldPointVisible({ x, y }, 32)) continue;
    const angle = Math.atan2(projectile.to.y - projectile.from.y, projectile.to.x - projectile.from.x);
    const image = elementProjectileImage(projectile.wuxing);
    const width = projectile.critical ? 54 : 42;
    const height = projectile.critical ? 31 : 24;
    context.save();
    context.globalAlpha = (1 - ratio * 0.32) * 0.95;
    context.strokeStyle = projectile.color;
    context.lineWidth = projectile.critical ? 3.6 : 2.4;
    context.shadowColor = projectile.color;
    // FB6: 탄도 발광 12/7 → 9/5 (-25~29%).
    context.shadowBlur = projectile.critical ? 9 : 5;
    context.beginPath();
    context.moveTo(projectile.from.x + (x - projectile.from.x) * 0.58, projectile.from.y + (y - projectile.from.y) * 0.58);
    context.lineTo(x, y);
    context.stroke();
    context.translate(x, y);
    context.rotate(angle);
    if (image.complete && image.naturalWidth > 0) {
      context.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.projectileSpriteDrawTotal += 1;
      projectileSpriteDrawnThisFrame = true;
    }
    context.restore();
  }
  canvas.dataset.projectileSpriteDraw = String(projectileSpriteDrawnThisFrame);
  canvas.dataset.projectileSpriteDrawTotal = String(ctx.projectileSpriteDrawTotal);
  for (const ring of rings) {
    if (!isWorldPointVisible(ring.at, 90)) continue;
    const ratio = Math.min(1, ring.age / ring.duration);
    context.save();
    context.globalAlpha = 1 - ratio;
    context.strokeStyle = ring.color;
    context.lineWidth = 4 - ratio * 2;
    context.shadowColor = ring.color;
    // FB6: 고리 발광 18 → 13 (-28%).
    context.shadowBlur = 13;
    context.beginPath();
    context.arc(ring.at.x, ring.at.y, 18 + ratio * 58, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
  for (const burst of abilityBursts) {
    const ratio = Math.min(1, burst.age / burst.duration);
    const sourceBased = ["support", "coin", "resonance", "solo"].includes(burst.kind);
    const point = sourceBased ? burst.source : burst.at;
    if (!isWorldPointVisible(point, 64)) continue;
    context.save();
    context.globalAlpha = (1 - ratio) * 0.42;
    context.strokeStyle = burst.color;
    context.fillStyle = burst.color;
    context.lineWidth = burst.kind === "burst" || burst.kind === "critical" ? 2.4 : 1.4;
    context.setLineDash(burst.kind === "chain" || burst.kind === "lineage" ? [4, 7] : []);
    context.beginPath();
    context.ellipse(point.x, point.y + 8, 13 + ratio * 31, 5 + ratio * 11, 0, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    for (let mark = -1; mark <= 1; mark += 1) {
      const offset = mark * 10;
      context.beginPath();
      context.moveTo(point.x + offset - 5, point.y + 5 + ratio * 6);
      context.quadraticCurveTo(point.x + offset, point.y - 2 - ratio * 5, point.x + offset + 6, point.y + 4 + ratio * 5);
      context.stroke();
    }
    context.globalAlpha = (1 - ratio) * 0.68;
    context.font = '900 13px "Malgun Gothic", serif';
    context.textAlign = "center";
    context.fillText(burst.glyph, point.x, point.y - 12 - ratio * 8);
    context.restore();
  }
  for (const floater of floaters) {
    if (!isWorldPointVisible(floater.at, 60)) continue;
    const ratio = Math.min(1, floater.age / floater.duration);
    context.save();
    context.globalAlpha = 1 - ratio;
    context.fillStyle = floater.color;
    context.textAlign = "center";
    context.font = String(floater.large ? 900 : 800) + " " + String(floater.large ? 23 : 16) + "px sans-serif";
    context.shadowColor = "#050810";
    context.shadowBlur = 5;
    context.fillText(floater.text, floater.at.x, floater.at.y - 25 - ratio * 28);
    context.restore();
  }
  drawIdiomRipples();
  recycleExpired(projectiles, projectilePool, 48);
  recycleExpired(floaters, floaterPool, 48);
  recycleExpired(rings, ringPool, 32);
  recycleExpired(abilityBursts, abilityBurstPool, 12);
  for (const [towerId, popup] of towerAbilityPopups) {
    if (popup.age >= popup.duration || !ctx.engine.state.towers.some((tower) => tower.id === towerId)) towerAbilityPopups.delete(towerId);
  }
}

function recycleExpired<T extends { age: number; duration: number }>(items: T[], pool: T[], poolLimit: number): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item || item.age < item.duration) continue;
    const removed = item;
    const last = items.pop();
    if (index < items.length && last) items[index] = last;
    if (pool.length < poolLimit) pool.push(removed);
  }
}
