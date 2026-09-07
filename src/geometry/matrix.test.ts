import { describe, it, expect } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { toWorld, v3, type Vec3 } from './vec';

// The 3D viewport builds a THREE.Matrix4 from a part's {position, rotation} transform
// independently of toWorld(). This test pins the two implementations together so they
// can never silently diverge.
function threeMatrixFor(position: Vec3, rotation: Vec3): Matrix4 {
  const m = new Matrix4().makeRotationX(rotation.x);
  m.premultiply(new Matrix4().makeRotationY(rotation.y));
  m.premultiply(new Matrix4().makeRotationZ(rotation.z));
  m.setPosition(position.x, position.y, position.z);
  return m;
}

describe('three.js matrix matches toWorld()', () => {
  const rotations: Record<string, Vec3> = {
    NO_ROT: v3(0, 0, 0),
    FLAT_ROT: v3(Math.PI / 2, 0, 0),
    SIDE_ROT: v3(0, -Math.PI / 2, 0),
    ROD_ROT: v3(0, Math.PI / 2, 0),
    SLOPED_TOP: v3(Math.PI / 2, Math.PI, 0),
  };
  const position = v3(10, 20, 30);
  const points: Vec3[] = [v3(100, 50, 0), v3(0, 0, 18)];

  for (const [name, rotation] of Object.entries(rotations)) {
    it(`matches for rotation ${name}`, () => {
      const m = threeMatrixFor(position, rotation);
      for (const p of points) {
        const expected = toWorld({ position, rotation }, p);
        const actual = new Vector3(p.x, p.y, p.z).applyMatrix4(m);
        expect(actual.x).toBeCloseTo(expected.x, 6);
        expect(actual.y).toBeCloseTo(expected.y, 6);
        expect(actual.z).toBeCloseTo(expected.z, 6);
      }
    });
  }
});
