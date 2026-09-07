import { WALLS, cornerWalls, doorArc, doorSpan, localToWorld, minUnitWidth, segmentUsed, wallFrame, wallLength, wallSegments } from '../geometry/frames';
import { MAX_DRAWER_FRONT, MIN_DRAWER_FRONT, MIN_ZONE_HEIGHT, ROD_CLEARANCE, drawerFrontHeight, heights, layoutAll, layoutUnit, zoneHeights } from '../geometry/layout';
import type { MessageKey, Params } from '../i18n';
import { msg } from '../i18n';
import { v3 } from '../geometry/vec';
import type { Project, ValidationError, Wall } from './types';

export const MAX_ROOM_DIM = 20000;

const ARC_SAMPLES = 32;
const LEAF_SAMPLES = 8;
/** Clearance, in mm, a swept point must keep inside a unit before it counts as a clash — so a leaf
 * that only grazes a carcass face (or a jamb sitting exactly on it) is not reported. */
const CLASH_MARGIN = 1;

/**
 * An inward-opening leaf must not sweep through a wardrobe run. Both the quarter-circle swing and
 * the leaf at 90° are sampled and tested against every unit's plan rectangle; wall frames are
 * axis-aligned, so the rectangle is just the min/max of its four world corners.
 */
function doorSwingErrors(p: Project, push: (path: string, key: MessageKey, params?: Params) => void): void {
  if (p.door.swing !== 'in') return;
  const { hinge, tip, arc } = doorArc(p, ARC_SAMPLES);
  const pts = [
    ...arc,
    ...Array.from({ length: LEAF_SAMPLES }, (_, i) => {
      const f = (i + 1) / LEAF_SAMPLES;
      return { x: hinge.x + (tip.x - hinge.x) * f, y: 0, z: hinge.z + (tip.z - hinge.z) * f };
    }),
  ];
  for (const c of layoutAll(p)) {
    if (c.kind !== 'unit') continue;
    const f = wallFrame(p.room, c.wall);
    const corners = [v3(c.s0, 0, 0), v3(c.s1, 0, 0), v3(c.s1, 0, c.depth), v3(c.s0, 0, c.depth)].map((v) => localToWorld(f, v));
    const xs = corners.map((v) => v.x), zs = corners.map((v) => v.z);
    const minX = Math.min(...xs) + CLASH_MARGIN, maxX = Math.max(...xs) - CLASH_MARGIN;
    const minZ = Math.min(...zs) + CLASH_MARGIN, maxZ = Math.max(...zs) - CLASH_MARGIN;
    if (pts.some((q) => q.x > minX && q.x < maxX && q.z > minZ && q.z < maxZ)) {
      // Point the path at the blocking unit, not at the door: the inspector's error chip then
      // selects the run the user has to shorten.
      const ci = p.wardrobe.walls[c.wall].segments[c.segment].findIndex((x) => x.id === c.unit.id);
      push(`walls.${c.wall}.segments.${c.segment}.${ci}`, 'error.doorSwingBlocked', { wall: `wall.${c.wall}`, unit: c.columnIndex + 1 });
      return; // one clash is enough: the fix is the same for all of them
    }
  }
}

/** How much usable shelf a corner leg must keep past the deeper of the two runs. */
export const CORNER_LEG_CLEARANCE = 100;

/**
 * An L-shaped corner unit has to clear both runs (so its legs reach past the deeper of the two)
 * and still leave half of each wall for that wall's own run. `none` corners carry no geometry,
 * so their numbers are never checked.
 *
 * Both bounds are rounded *inwards* to whole millimetres, so the range the inspector prints is
 * exactly the range `validate()` accepts.
 */
export const cornerLegRange = (p: Project, anchor: Wall): { min: number; max: number } => {
  const { a, b } = cornerWalls(anchor);
  const w = p.wardrobe;
  return {
    min: Math.ceil(Math.max(w.walls[a].depth, w.walls[b].depth) + CORNER_LEG_CLEARANCE),
    max: Math.floor(Math.min(wallLength(p.room, a), wallLength(p.room, b)) / 2),
  };
};

function cornerErrors(p: Project, push: (path: string, key: MessageKey, params?: Params) => void): void {
  for (const anchor of WALLS) {
    const plan = p.wardrobe.corners[anchor];
    if (plan.mode !== 'lshelf') continue;
    const path = `corners.${anchor}`;
    const corner = `corner.${anchor}`;
    const { min, max } = cornerLegRange(p, anchor);
    if (!(plan.width >= min && plan.width <= max)) push(path, 'error.cornerWidth', { corner, min, max });
    if (plan.shelves < 1) push(path, 'error.cornerShelves', { corner });
  }
}

export function validate(p: Project): ValidationError[] {
  const errs: ValidationError[] = [];
  const push = (path: string, key: MessageKey, params?: Params) => errs.push({ path, message: msg(key, params) });
  const w = p.wardrobe, t = w.panelThickness;
  if (!(p.room.width > 0 && p.room.depth > 0 && p.room.height > 0)) push('room', 'error.roomDims');
  if (p.room.width > MAX_ROOM_DIM || p.room.depth > MAX_ROOM_DIM || p.room.height > MAX_ROOM_DIM) push('room', 'error.roomTooBig');
  if (!(t >= 1 && w.backThickness >= 1)) push('wardrobe.panelThickness', 'error.thickness');
  if (w.plinthHeight < 0 || w.topGap < 0 || w.doorMargin < 0) push('wardrobe', 'error.negative');
  if (p.room.height < w.plinthHeight + w.topGap + 2 * t + MIN_ZONE_HEIGHT) push('room.height', 'error.roomHeight');
  if (!(p.door.width > 0)) push('door.width', 'error.doorWidth');
  if (p.door.offset < 0 || p.door.offset + p.door.width > wallLength(p.room, p.door.wall)) push('door.offset', 'error.doorFits', { wall: `wall.${p.door.wall}` });
  if (!(p.door.height > 0 && p.door.height <= p.room.height)) push('door.height', 'error.doorHeight');
  const H = heights(p);
  const doorWall = doorSpan(p).wall;
  for (const wall of WALLS) {
    const plan = w.walls[wall];
    const W = { wall: `wall.${wall}` };
    if (plan.depth < 200) push(`walls.${wall}.depth`, 'error.wallDepth', W);
    const segs = wallSegments(p, wall);
    if (plan.enabled) {
      segs.forEach((seg) => {
        const over = segmentUsed(p, seg) - (seg.s1 - seg.s0);
        // Only a door wall is split in two, so only there does a segment number mean anything.
        const segment = wall === doorWall ? ` #${seg.index + 1}` : '';
        if (over > 0 && plan.segments[seg.index].length > 0) push(`walls.${wall}.segments.${seg.index}`, 'error.segmentOverflow', { ...W, segment, n: Math.round(over) });
      });
    }
    plan.segments.forEach((cols, si) => cols.forEach((c, ci) => {
      const path = `walls.${wall}.segments.${si}.${ci}`;
      // Unit numbers run across both segments of the wall, matching the inspector's heading.
      const U = { ...W, unit: (si === 1 ? plan.segments[0].length : 0) + ci + 1 };
      if (c.kind === 'gap') { if (!(c.width > 0)) push(path, 'error.gapWidth', U); return; }
      if (c.width < minUnitWidth(w)) push(path, 'error.columnWidth', { ...U, n: minUnitWidth(w) });
      if (c.zones.length === 0) { push(path, 'error.noZones', U); return; }
      const { heights: zh, leftover } = zoneHeights(c, H.interiorHeight, t);
      // A pinned rail is checked against absolute Ys, so it borrows the real layout — only for the
      // units that pin one, since every other unit's zones need nothing but their heights.
      const zls = c.zones.some((z) => z.rod) ? layoutUnit(p, wall, si as 0 | 1, ci, c, 0).zones : null;
      if (leftover < 0) push(path, 'error.zonesOverflow', { ...U, n: Math.round(-leftover) });
      c.zones.forEach((z, zi) => {
        const zp = `${path}.zones.${zi}`;
        if (zh[zi] < MIN_ZONE_HEIGHT) push(zp, 'error.zoneHeight', { ...U, n: MIN_ZONE_HEIGHT });
        if (z.type === 'shelves' && z.count < 1) push(zp, 'error.shelfCount', U);
        // A negative offset always lands past one end, so it needs no rule of its own.
        if (z.type === 'hanging' && z.rod && zls) {
          const { rodY, yBot, yTop } = zls[zi];
          if (rodY === null || rodY < yBot + ROD_CLEARANCE || rodY > yTop - ROD_CLEARANCE) push(zp, 'error.rodOutOfZone', U);
        }
        if (z.type === 'drawers') {
          if (z.count < 1) push(zp, 'error.drawerCount', U);
          else {
            const front = drawerFrontHeight(zh[zi], z.count);
            if (front < MIN_DRAWER_FRONT) push(zp, 'error.drawerHeight', { ...U, n: MIN_DRAWER_FRONT });
            else if (Math.floor(front) > MAX_DRAWER_FRONT) push(zp, 'error.drawerTooTall', { ...U, n: MAX_DRAWER_FRONT });
          }
        }
      });
    }));
  }
  cornerErrors(p, push);
  doorSwingErrors(p, push);
  return errs;
}
