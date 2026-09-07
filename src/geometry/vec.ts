export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }
export interface Box2 { min: Vec2; max: Vec2 }
export interface Box3 { min: Vec3; max: Vec3 }
export interface Transform { position: Vec3; rotation: Vec3 } // radians, applied X then Y then Z

export const v2 = (x: number, y: number): Vec2 => ({ x, y });
export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const NO_ROT: Vec3 = v3(0, 0, 0);
/** Local XY plan outline lies flat; local Y -> world +Z; extrusion goes to world -Y. */
export const FLAT_ROT: Vec3 = v3(Math.PI / 2, 0, 0);
/** Local XY (depth, height) outline stands in the YZ plane; local X -> world +Z; extrusion -> world -X. */
export const SIDE_ROT: Vec3 = v3(0, -Math.PI / 2, 0);
/** Local XY circle; extrusion -> world +X. */
export const ROD_ROT: Vec3 = v3(0, Math.PI / 2, 0);

export function rotX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
export function rotY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
export function rotZ(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

export function toWorld(t: Transform, p: Vec3): Vec3 {
  const r = rotZ(rotY(rotX(p, t.rotation.x), t.rotation.y), t.rotation.z);
  return { x: r.x + t.position.x, y: r.y + t.position.y, z: r.z + t.position.z };
}

export function bounds2(pts: Vec2[]): Box2 {
  const b: Box2 = { min: v2(Infinity, Infinity), max: v2(-Infinity, -Infinity) };
  for (const p of pts) {
    b.min.x = Math.min(b.min.x, p.x); b.min.y = Math.min(b.min.y, p.y);
    b.max.x = Math.max(b.max.x, p.x); b.max.y = Math.max(b.max.y, p.y);
  }
  return b;
}

export function bounds3(pts: Vec3[]): Box3 {
  const b: Box3 = { min: v3(Infinity, Infinity, Infinity), max: v3(-Infinity, -Infinity, -Infinity) };
  for (const p of pts) {
    b.min.x = Math.min(b.min.x, p.x); b.min.y = Math.min(b.min.y, p.y); b.min.z = Math.min(b.min.z, p.z);
    b.max.x = Math.max(b.max.x, p.x); b.max.y = Math.max(b.max.y, p.y); b.max.z = Math.max(b.max.z, p.z);
  }
  return b;
}
