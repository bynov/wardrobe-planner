import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Part, PartKind } from '../../geometry/parts';
import type { Vec3 } from '../../geometry/vec';

const COLORS: Record<PartKind, string> = {
  side: '#d9c7a3',
  top: '#d9c7a3',
  bottom: '#d9c7a3',
  divider: '#d9c7a3',
  shelf: '#e3d5b8',
  back: '#cbb997',
  drawerFront: '#9fbbd0',
  plinth: '#8a7a5e',
  rod: '#8c8c8c',
};

/** Explode offset in world mm. Parts that slide out of the carcass travel along the wall's
 * inward normal (`dir` = wall-local +z); the top lifts along world Y. The plinth slides out the
 * same way as the drawers — dropping it along −Y buried it under the floor. */
function explodeOffset(kind: PartKind, f: number, dir: Vec3): THREE.Vector3 {
  const along = (mm: number) => new THREE.Vector3(dir.x * mm * f, dir.y * mm * f, dir.z * mm * f);
  switch (kind) {
    case 'drawerFront': return along(300);
    case 'shelf':
    case 'divider': return along(120);
    case 'top': return new THREE.Vector3(0, 200 * f, 0);
    case 'plinth': return along(60);
    default: return new THREE.Vector3();
  }
}

export function PartMesh({ part, explode, explodeDir, faded = false }: { part: Part; explode: number; explodeDir: Vec3; faded?: boolean }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    part.outline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false });
  }, [part.outline, part.thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const matrix = useMemo(() => {
    const { position: p, rotation: r } = part.transform;
    // Must equal toWorld() in geometry/vec.ts — pinned by geometry/matrix.test.ts
    const m = new THREE.Matrix4().makeRotationX(r.x);
    m.premultiply(new THREE.Matrix4().makeRotationY(r.y));
    m.premultiply(new THREE.Matrix4().makeRotationZ(r.z));
    const o = explodeOffset(part.kind, explode, explodeDir);
    m.setPosition(p.x + o.x, p.y + o.y, p.z + o.z);
    return m;
  }, [part, explode, explodeDir]);

  return (
    <mesh geometry={geometry} matrix={matrix} matrixAutoUpdate={false}>
      <meshStandardMaterial
        color={COLORS[part.kind]}
        side={THREE.DoubleSide}
        transparent={faded}
        opacity={faded ? 0.18 : 1}
        depthWrite={!faded}
      />
    </mesh>
  );
}
