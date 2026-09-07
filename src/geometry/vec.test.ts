import { describe, it, expect } from 'vitest';
import { toWorld, bounds2, bounds3, v2, v3, FLAT_ROT, SIDE_ROT, ROD_ROT, NO_ROT } from './vec';

const near = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
  expect(a.z).toBeCloseTo(b.z, 6);
};

describe('toWorld', () => {
  it('FLAT_ROT lays a panel flat: local Y -> world Z, thickness goes down', () => {
    const t = { position: v3(10, 500, 0), rotation: FLAT_ROT };
    near(toWorld(t, v3(100, 50, 0)), v3(110, 500, 50));
    near(toWorld(t, v3(0, 0, 18)), v3(10, 482, 0));
  });
  it('SIDE_ROT stands a panel in YZ: local X -> world Z, thickness goes to -X', () => {
    const t = { position: v3(18, 100, 0), rotation: SIDE_ROT };
    near(toWorld(t, v3(600, 1000, 0)), v3(18, 1100, 600));
    near(toWorld(t, v3(0, 0, 18)), v3(0, 100, 0));
  });
  it('ROD_ROT extrudes along +X', () => {
    const t = { position: v3(18, 1630, 250), rotation: ROD_ROT };
    near(toWorld(t, v3(0, 0, 664)), v3(682, 1630, 250));
  });
  it('sloped top: X rotation then Z tilt', () => {
    const theta = Math.atan(0.5);
    const t = { position: v3(0, 2180, 0), rotation: v3(Math.PI / 2, 0, -theta) };
    const L = 700 / Math.cos(theta);
    near(toWorld(t, v3(L, 0, 0)), v3(700, 1830, 0));
    near(toWorld(t, v3(0, 600, 0)), v3(0, 2180, 600));
  });
  it('NO_ROT is identity plus translation', () => {
    near(toWorld({ position: v3(1, 2, 3), rotation: NO_ROT }, v3(1, 1, 1)), v3(2, 3, 4));
  });
});

describe('bounds', () => {
  it('bounds2/bounds3', () => {
    expect(bounds2([v2(1, 5), v2(-2, 3)])).toEqual({ min: { x: -2, y: 3 }, max: { x: 1, y: 5 } });
    expect(bounds3([v3(1, 5, 0), v3(-2, 3, 9)])).toEqual({ min: { x: -2, y: 3, z: 0 }, max: { x: 1, y: 5, z: 9 } });
  });
});
