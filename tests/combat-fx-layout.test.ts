import { describe, expect, it } from "vitest";
import { directionOnPath } from "../src/core/content";
import { abilityZoneSpriteLayout } from "../src/ui/combat-fx-layout";

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

  it("keeps the existing zone sprite proportions", () => {
    expect(abilityZoneSpriteLayout(0.1, 100, 1.02)).toMatchObject({ width: 150.96, height: 63.24 });
  });
});
