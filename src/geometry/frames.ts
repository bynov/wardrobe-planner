import type { Project, Room, Wall, Wardrobe } from '../model/types';
import { rotY, v3, type Transform, type Vec3 } from './vec';

export const WALLS: Wall[] = ['back', 'right', 'front', 'left'];
export interface Frame { origin: Vec3; yaw: number }

export function wallLength(room: Room, wall: Wall): number {
  return wall === 'back' || wall === 'front' ? room.width : room.depth;
}
export function wallFrame(room: Room, wall: Wall): Frame {
  const { width: W, depth: D } = room;
  switch (wall) {
    case 'back': return { origin: v3(0, 0, 0), yaw: 0 };
    case 'right': return { origin: v3(W, 0, 0), yaw: -Math.PI / 2 };
    case 'front': return { origin: v3(W, 0, D), yaw: Math.PI };
    case 'left': return { origin: v3(0, 0, D), yaw: Math.PI / 2 };
  }
}
export function localToWorld(f: Frame, p: Vec3): Vec3 {
  const r = rotY(p, f.yaw);
  return v3(r.x + f.origin.x, r.y + f.origin.y, r.z + f.origin.z);
}
export function frameTransform(f: Frame, t: Transform): Transform {
  return { position: localToWorld(f, t.position), rotation: v3(t.rotation.x, t.rotation.y + f.yaw, 0) };
}
export const leftOf = (w: Wall): Wall => WALLS[(WALLS.indexOf(w) + 3) % 4];
export const rightOf = (w: Wall): Wall => WALLS[(WALLS.indexOf(w) + 1) % 4];
export const isSideWall = (w: Wall) => w === 'left' || w === 'right';

export interface DoorSpan { wall: Wall; s0: number; s1: number }
export function doorSpan(p: Pick<Project, 'room' | 'door'>): DoorSpan {
  const { wall, offset, width } = p.door;
  const L = wallLength(p.room, wall);
  const mirrored = wall === 'front' || wall === 'left';
  return mirrored ? { wall, s0: L - offset - width, s1: L - offset } : { wall, s0: offset, s1: offset + width };
}
export const minUnitWidth = (w: Wardrobe) => 2 * w.panelThickness + 100;

export interface Segment { wall: Wall; index: 0 | 1; s0: number; s1: number }

function rawSegments(p: Project, wall: Wall, claimStart: number, claimEnd: number): Segment[] {
  const L = wallLength(p.room, wall);
  const d = doorSpan(p);
  if (d.wall !== wall) return [{ wall, index: 0, s0: claimStart, s1: L - claimEnd }];
  const m = p.wardrobe.doorMargin;
  return [
    { wall, index: 0, s0: claimStart, s1: d.s0 - m },
    { wall, index: 1, s0: d.s1 + m, s1: L - claimEnd },
  ];
}

export function cornerClaim(p: Project, wall: Wall, side: 'start' | 'end'): number {
  if (!isSideWall(wall)) return 0;
  const n = side === 'start' ? leftOf(wall) : rightOf(wall);
  const plan = p.wardrobe.walls[n];
  if (!plan.enabled) return 0;
  const segs = rawSegments(p, n, 0, 0);
  const touching = side === 'start' ? segs[segs.length - 1] : segs[0]; // our start corner = neighbour's end corner and vice versa
  return touching.s1 - touching.s0 >= minUnitWidth(p.wardrobe) ? plan.depth : 0;
}

export function wallSegments(p: Project, wall: Wall): Segment[] {
  return rawSegments(p, wall, cornerClaim(p, wall, 'start'), cornerClaim(p, wall, 'end'));
}
export function segmentUsed(p: Project, seg: Segment): number {
  return p.wardrobe.walls[seg.wall].segments[seg.index].reduce((s, c) => s + c.width, 0);
}
export function segmentFree(p: Project, seg: Segment): number {
  return seg.s1 - seg.s0 - segmentUsed(p, seg);
}
