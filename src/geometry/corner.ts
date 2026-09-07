import { msg } from '../i18n';
import type { CornerPlan, Project, Wall } from '../model/types';
import { cornerLShelf, cornerWalls, frameTransform, wallFrame } from './frames';
import { heights, PLINTH_SETBACK, SHELF_SETBACK } from './layout';
import { rect, type Material, type Part, type PartKind, type PartNameKey } from './parts';
import { FLAT_ROT, NO_ROT, SIDE_ROT, v2, v3, type Vec2, type Vec3 } from './vec';

/**
 * The L-shaped open corner unit (spec §8.3).
 *
 * Everything is built in the ANCHOR wall's frame: `u` runs along wall A (its local `s`) and `v`
 * runs into the room (its local `z`), so the corner point itself is `(u, v) = (0, 0)`. Leg A lies
 * along wall A (`u ∈ [0, w]`, `v ∈ [0, dA]`) and leg B along wall B (`u ∈ [0, dB]`, `v ∈ [0, w]`).
 * The finished transforms are mapped through `wallFrame(A)` exactly like a unit's.
 *
 * The unit is open on both of its long faces: the only vertical panels are the two end panels
 * that close the far end of each leg, plus a thin back against each wall.
 */
export interface CornerLayout {
  anchor: Wall;
  a: Wall;
  b: Wall;
  plan: CornerPlan;
  /** Leg length along both walls. */
  w: number;
  /** Depth of wall A's run (the leg-A depth) and of wall B's (the leg-B depth). */
  dA: number;
  dB: number;
  t: number;
  bt: number;
  plinth: number;
  floorY: number;
  topY: number;
  carcassHeight: number;
  interiorHeight: number;
  /** Absolute Y of each shelf board's underside, bottom to top — one fewer than `plan.shelves`. */
  shelfYs: number[];
  /** The outer L footprint in anchor-local (u, v) — the plan outline, end panels included. */
  footprint: Vec2[];
  /** The bottom/top slab outline: the same L, held back from both end panels. */
  slab: Vec2[];
}

/**
 * The unit's outer L footprint `(0,0) (w,0) (w,dA) (dB,dA) (dB,w) (0,w)` — leg A along u, leg B
 * along v. This is the plan/hit outline: it includes the end panels, which stand at the far end
 * of each leg. The horizontal slabs use `cornerSlab` instead.
 */
export function cornerFootprint(w: number, dA: number, dB: number): Vec2[] {
  return [v2(0, 0), v2(w, 0), v2(w, dA), v2(dB, dA), v2(dB, w), v2(0, w)];
}

/**
 * The bottom/top slab: the same L stopped `t` short of each leg's end, because the end panels
 * are full height and run from the plinth to the top. Using the full footprint here would bury
 * `t × depth × carcassHeight` of each end panel inside the slabs.
 */
export function cornerSlab(w: number, dA: number, dB: number, t: number): Vec2[] {
  const e = w - t;
  return [v2(0, 0), v2(e, 0), v2(e, dA), v2(dB, dA), v2(dB, e), v2(0, e)];
}

/** The same L, inset for a shelf: clear of both backs, both end panels and the 20 mm front setback. */
function shelfOutline(w: number, dA: number, dB: number, t: number, bt: number): Vec2[] {
  const k = SHELF_SETBACK;
  return [v2(bt, bt), v2(w - t, bt), v2(w - t, dA - k), v2(dB - k, dA - k), v2(dB - k, w - t), v2(bt, w - t)];
}

/** `null` unless the corner is an active `lshelf` one — nothing else builds a corner unit. */
export function layoutCorner(p: Project, anchor: Wall): CornerLayout | null {
  const plan = cornerLShelf(p, anchor);
  if (!plan) return null;
  const { a, b } = cornerWalls(anchor);
  const wd = p.wardrobe;
  const t = wd.panelThickness;
  const H = heights(p);
  // `shelves` counts COMPARTMENTS, exactly as a shelves zone's `count` does: n bays, n - 1 boards.
  const n = Math.max(1, Math.floor(plan.shelves));
  const opening = (H.interiorHeight - (n - 1) * t) / n;
  const shelfYs = Array.from({ length: n - 1 }, (_, i) => H.floorY + (i + 1) * opening + i * t);
  return {
    anchor,
    a,
    b,
    plan,
    w: plan.width,
    dA: wd.walls[a].depth,
    dB: wd.walls[b].depth,
    t,
    bt: wd.backThickness,
    plinth: wd.plinthHeight,
    floorY: H.floorY,
    topY: H.topY,
    carcassHeight: H.carcassHeight,
    interiorHeight: H.interiorHeight,
    shelfYs,
    footprint: cornerFootprint(plan.width, wd.walls[a].depth, wd.walls[b].depth),
    slab: cornerSlab(plan.width, wd.walls[a].depth, wd.walls[b].depth, t),
  };
}

/** How far a `none` corner's hit tab reaches along each wall — a corner tab, not a whole run. */
export const CORNER_TAB = 200;

/**
 * The corner's shape on the plan, in anchor-local (u, v), for hit-testing and highlighting: the
 * L itself where one is fitted, otherwise a small square tab in the corner. The tab is
 * deliberately much smaller than the `dB × dA` overlap of the two runs — that square covered
 * most of a short wall's band and made the wall itself hard to pick. Defined for every corner,
 * enabled walls or not, so a corner can always be reached and changed.
 */
export function cornerShape(p: Project, anchor: Wall): Vec2[] {
  const { a, b } = cornerWalls(anchor);
  const dA = p.wardrobe.walls[a].depth;
  const dB = p.wardrobe.walls[b].depth;
  const plan = cornerLShelf(p, anchor);
  if (plan) return cornerFootprint(plan.width, dA, dB);
  const k = Math.max(0, Math.min(CORNER_TAB, dA, dB));
  return [v2(0, 0), v2(k, 0), v2(k, k), v2(0, k)];
}

const L_NOTE = () => [msg('note.lShape')];

/** The corner unit's parts, already mapped into world coordinates through `wallFrame(A)`. */
export function buildCornerParts(p: Project, anchor: Wall): Part[] {
  const L = layoutCorner(p, anchor);
  if (!L) return [];
  const { w, dA, dB, t, bt, plinth, floorY, carcassHeight: ch, interiorHeight: ih } = L;
  const frame = wallFrame(p.room, L.a);
  const parts: Part[] = [];
  const add = (
    key: string, nameKey: PartNameKey, kind: PartKind, outline: Vec2[], thickness: number,
    position: Vec3, rotation: Vec3, material: Material = 'panel', notes?: ReturnType<typeof L_NOTE>, index?: number,
  ) =>
    parts.push({
      id: `corner-${anchor}-${key}`,
      wall: L.a,
      corner: anchor,
      columnIndex: -1,
      unitId: `corner-${anchor}`,
      nameKey,
      index,
      kind,
      outline,
      thickness,
      transform: frameTransform(frame, { position, rotation }),
      material,
      notes,
    });

  // L slabs: the outline already carries absolute (u, v), so both sit at the corner point.
  add('bottom', 'bottom', 'bottom', L.slab, t, v3(0, floorY, 0), FLAT_ROT, 'panel', L_NOTE());
  add('top', 'top', 'top', L.slab, t, v3(0, plinth + ch, 0), FLAT_ROT, 'panel', L_NOTE());
  // End panels closing each leg: A's stands across the run at u = w, B's across wall B at v = w.
  add('endA', 'sideR', 'side', rect(dA, ch), t, v3(w, plinth, 0), SIDE_ROT);
  add('endB', 'sideL', 'side', rect(dB, ch), t, v3(0, plinth, w - t), NO_ROT);
  // Backs, one against each wall.
  add('backA', 'back', 'back', rect(w - t, ih), bt, v3(0, floorY, 0), NO_ROT, 'back');
  // backB starts where backA ends, so the two do not share the corner sliver.
  add('backB', 'back', 'back', rect(w - t - bt, ih), bt, v3(bt, floorY, bt), SIDE_ROT, 'back');
  const shelf = shelfOutline(w, dA, dB, t, bt);
  L.shelfYs.forEach((y, k) => add(`shelf${k + 1}`, 'shelf', 'shelf', shelf, t, v3(0, y + t, 0), FLAT_ROT, 'panel', L_NOTE(), k + 1));
  // Plinth boards run under the open face of each leg only — the corner square itself is enclosed.
  add('plinthA', 'plinth', 'plinth', rect(w - dB, plinth), t, v3(dB, 0, dA - PLINTH_SETBACK - t), NO_ROT);
  add('plinthB', 'plinth', 'plinth', rect(w - dA, plinth), t, v3(dB - PLINTH_SETBACK, 0, dA), SIDE_ROT);
  return parts;
}
