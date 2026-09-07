import { WALLS, doorSpan, minUnitWidth, segmentUsed, wallLength, wallSegments } from '../geometry/frames';
import { MAX_DRAWER_FRONT, MIN_DRAWER_FRONT, MIN_ZONE_HEIGHT, drawerFrontHeight, heights, zoneHeights } from '../geometry/layout';
import type { MessageKey, Params } from '../i18n';
import { msg } from '../i18n';
import type { Project, ValidationError } from './types';

export const MAX_ROOM_DIM = 20000;

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
      if (leftover < 0) push(path, 'error.zonesOverflow', { ...U, n: Math.round(-leftover) });
      c.zones.forEach((z, zi) => {
        const zp = `${path}.zones.${zi}`;
        if (zh[zi] < MIN_ZONE_HEIGHT) push(zp, 'error.zoneHeight', { ...U, n: MIN_ZONE_HEIGHT });
        if (z.type === 'shelves' && z.count < 1) push(zp, 'error.shelfCount', U);
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
  return errs;
}
