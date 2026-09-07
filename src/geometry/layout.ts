import { WALLS, wallSegments } from './frames';
import type { Gap, Project, Unit, Wall, Zone } from '../model/types';

export const SHELF_SETBACK = 20;
export const REVEAL = 2;
export const DRAWER_GAP = 3;
export const ROD_DROP = 80;
/**
 * A rail higher than this is out of comfortable reach, so a tall hanging zone parks its rail at
 * 2 m and leaves the space above it as shelf-free headroom (the drawings dimension it).
 */
export const MAX_ROD_HEIGHT = 2000;
export const ROD_DIAMETER = 25;
export const PLINTH_SETBACK = 40;
export const MIN_ZONE_HEIGHT = 100;
export const MIN_DRAWER_FRONT = 80;
export const MAX_DRAWER_FRONT = 450;

export interface Heights {
  carcassHeight: number;
  interiorHeight: number;
  floorY: number; // plinth + t (bottom panel top)
  topY: number; // room.height - topGap
}

export function heights(p: Project): Heights {
  const t = p.wardrobe.panelThickness;
  const topY = p.room.height - p.wardrobe.topGap;
  const carcassHeight = topY - p.wardrobe.plinthHeight;
  return { carcassHeight, interiorHeight: carcassHeight - 2 * t, floorY: p.wardrobe.plinthHeight + t, topY };
}

export function zoneHeights(unit: Unit, interiorHeight: number, t: number): { heights: number[]; leftover: number } {
  const n = unit.zones.length;
  const fixed = unit.zones.reduce((s, z) => s + (z.height ?? 0), 0);
  const autos = unit.zones.filter((z) => z.height === null).length;
  const leftover = interiorHeight - fixed - Math.max(0, n - 1) * t;
  const share = autos > 0 ? Math.max(0, leftover) / autos : 0;
  const heightsOut = unit.zones.map((z, i) => {
    if (z.height === null) return share;
    if (autos === 0 && i === n - 1) return z.height + leftover;
    return z.height;
  });
  return { heights: heightsOut, leftover };
}

/** Raw (unrounded) height of one front in a drawers zone `height` mm tall. */
export function drawerFrontHeight(height: number, count: number): number {
  return (height - 2 * REVEAL - DRAWER_GAP * (count - 1)) / count;
}

export interface DrawerFront {
  y0: number;
  y1: number;
} // absolute Y

export interface ZoneLayout {
  zone: Zone;
  index: number;
  yBot: number;
  yTop: number;
  height: number;
  shelfYs: number[]; // absolute underside Y
  drawerFronts: DrawerFront[];
  frontW: number;
  frontH: number;
  rodY: number | null;
}

export interface UnitLayout {
  kind: 'unit';
  unit: Unit;
  wall: Wall;
  segment: 0 | 1;
  columnIndex: number;
  s0: number;
  s1: number;
  width: number;
  depth: number;
  carcassHeight: number;
  interiorWidth: number;
  interiorDepth: number;
  interiorHeight: number;
  floorY: number;
  topY: number;
  zones: ZoneLayout[];
  dividerYs: number[]; // absolute top-surface Y of each divider between zones
  leftover: number;
}

export interface GapLayout {
  kind: 'gap';
  gap: Gap;
  wall: Wall;
  segment: 0 | 1;
  columnIndex: number;
  s0: number;
  s1: number;
  width: number;
}

export type ColumnLayout = UnitLayout | GapLayout;

export function layoutUnit(p: Project, wall: Wall, segment: 0 | 1, columnIndex: number, unit: Unit, s0: number): UnitLayout {
  const w = p.wardrobe;
  const t = w.panelThickness;
  const H = heights(p);
  const depth = w.walls[wall].depth;
  const interiorWidth = unit.width - 2 * t;
  const interiorDepth = depth - w.backThickness;
  const { heights: zh, leftover } = zoneHeights(unit, H.interiorHeight, t);
  const zones: ZoneLayout[] = [];
  const dividerYs: number[] = [];
  let y = H.floorY;
  unit.zones.forEach((zone, index) => {
    const height = zh[index];
    const yBot = y;
    const yTop = y + height;
    const zl: ZoneLayout = {
      zone,
      index,
      yBot,
      yTop,
      height,
      shelfYs: [],
      drawerFronts: [],
      frontW: interiorWidth - 2 * REVEAL,
      frontH: 0,
      rodY: null,
    };
    if (zone.type === 'shelves' && zone.count >= 1) {
      const opening = (height - zone.count * t) / (zone.count + 1);
      for (let k = 1; k <= zone.count; k++) zl.shelfYs.push(yBot + k * opening + (k - 1) * t);
    } else if (zone.type === 'drawers' && zone.count >= 1) {
      // Whole millimetres: a fitter cuts fronts to a round size, and the remainder (< 1 mm per
      // front) is absorbed by the reveal above the top one.
      zl.frontH = Math.floor(drawerFrontHeight(height, zone.count));
      for (let k = 0; k < zone.count; k++) {
        const y0 = yBot + REVEAL + k * (zl.frontH + DRAWER_GAP);
        zl.drawerFronts.push({ y0, y1: y0 + zl.frontH });
      }
    } else if (zone.type === 'hanging') {
      zl.rodY = Math.min(yTop - ROD_DROP, MAX_ROD_HEIGHT);
    }
    zones.push(zl);
    if (index < unit.zones.length - 1) {
      dividerYs.push(yTop + t);
      y = yTop + t;
    }
  });
  return {
    kind: 'unit',
    unit,
    wall,
    segment,
    columnIndex,
    s0,
    s1: s0 + unit.width,
    width: unit.width,
    depth,
    carcassHeight: H.carcassHeight,
    interiorWidth,
    interiorDepth,
    interiorHeight: H.interiorHeight,
    floorY: H.floorY,
    topY: H.topY,
    zones,
    dividerYs,
    leftover,
  };
}

export function layoutWall(p: Project, wall: Wall): ColumnLayout[] {
  const plan = p.wardrobe.walls[wall];
  if (!plan.enabled) return [];
  const out: ColumnLayout[] = [];
  let columnIndex = 0;
  for (const seg of wallSegments(p, wall)) {
    let s = seg.s0;
    for (const c of plan.segments[seg.index]) {
      if (c.kind === 'unit') out.push(layoutUnit(p, wall, seg.index, columnIndex, c, s));
      else out.push({ kind: 'gap', gap: c, wall, segment: seg.index, columnIndex, s0: s, s1: s + c.width, width: c.width });
      s += c.width;
      columnIndex += 1;
    }
  }
  return out;
}

export const layoutAll = (p: Project): ColumnLayout[] => WALLS.flatMap((w) => layoutWall(p, w));
