import type { CornerPlan, Project, Room, Wall, Wardrobe } from '../model/types';
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

/** Wall-local `s` of the hinged jamb: 'left' is the `s0` end of the opening, seen from inside. */
export function doorHingeS(p: Pick<Project, 'room' | 'door'>): number {
  const d = doorSpan(p);
  return p.door.hinge === 'left' ? d.s0 : d.s1;
}
/** Which way the leaf swings in wall-local z: +1 into the room ('in'), -1 out of it ('out'). */
export function doorSwingSign(p: Pick<Project, 'door'>): 1 | -1 {
  return p.door.swing === 'in' ? 1 : -1;
}

export interface DoorArc { hinge: Vec3; tip: Vec3; arc: Vec3[] }
/**
 * The door leaf at 90° plus its quarter-circle swing, in WORLD coordinates on the floor plane.
 * `arc` runs from the open tip round to the closed leaf, which lies flat on the wall between the
 * hinge and the other jamb — so a left hinge closes along +s and a right one along -s.
 */
export function doorArc(p: Pick<Project, 'room' | 'door'>, n = 16): DoorArc {
  const f = wallFrame(p.room, p.door.wall);
  const w = p.door.width;
  const hs = doorHingeS(p);
  const sign = doorSwingSign(p);
  const dirS = p.door.hinge === 'left' ? 1 : -1;
  const at = (s: number, z: number) => localToWorld(f, v3(s, 0, z));
  const arc = Array.from({ length: n + 1 }, (_, k) => {
    const a = (Math.PI / 2) * (1 - k / n);
    return at(hs + dirS * w * Math.cos(a), sign * w * Math.sin(a));
  });
  return { hinge: at(hs, 0), tip: at(hs, sign * w), arc };
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

/**
 * A corner of the room, resolved from either of its two walls. It is keyed by its ANCHOR wall
 * `a` — the wall whose `s = 0` end is that corner; the other wall is `b = leftOf(a)`, and the
 * corner sits at `b`'s `s = wallLength(b)` end. So a wall's *start* corner is anchored on the
 * wall itself, and its *end* corner on the next wall clockwise.
 */
export interface CornerRef {
  anchor: Wall;
  a: Wall;
  b: Wall;
  plan: CornerPlan;
  /** Both walls carry wardrobe — nothing is built in a corner that only one run reaches. */
  active: boolean;
}

export const cornerAnchor = (wall: Wall, side: 'start' | 'end'): Wall => (side === 'start' ? wall : rightOf(wall));
/** The two walls that meet at the corner anchored on `anchor`, in (anchor, other) order. */
export const cornerWalls = (anchor: Wall): { a: Wall; b: Wall } => ({ a: anchor, b: leftOf(anchor) });

export function cornerActive(p: Project, anchor: Wall): boolean {
  const { a, b } = cornerWalls(anchor);
  return p.wardrobe.walls[a].enabled && p.wardrobe.walls[b].enabled;
}

export function cornerAt(p: Project, wall: Wall, side: 'start' | 'end'): CornerRef {
  const anchor = cornerAnchor(wall, side);
  const { a, b } = cornerWalls(anchor);
  return { anchor, a, b, plan: p.wardrobe.corners[anchor], active: cornerActive(p, anchor) };
}

/** An active `lshelf` corner — the only mode that builds parts and owns wall length on both runs. */
export function cornerLShelf(p: Project, anchor: Wall): CornerPlan | null {
  const plan = p.wardrobe.corners[anchor];
  return plan.mode === 'lshelf' && cornerActive(p, anchor) ? plan : null;
}

/**
 * How much of `wall` the corner at its `side` end takes away.
 * `lshelf`: both walls give way by the leg length. `none`: the v1 rule — a side wall yields the
 * neighbouring back/front wall's depth when that neighbour's touching segment is usable, and a
 * back/front wall yields nothing.
 */
export function cornerClaim(p: Project, wall: Wall, side: 'start' | 'end'): number {
  const c = cornerAt(p, wall, side);
  if (c.plan.mode === 'lshelf') return c.active ? c.plan.width : 0;
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
