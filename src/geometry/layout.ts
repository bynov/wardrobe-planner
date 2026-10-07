import { WALLS, cornerClaim, leftOf, rightOf, wallLength, wallSegments } from './frames';
import type { Column, Gap, GapRail, Project, RodDir, Unit, Wall, Zone } from '../model/types';

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
/** Vertical free space a rail keeps below the top and above the bottom of its zone, so a garment
 * can be lifted off it. */
export const ROD_CLEARANCE = 40;
export const PLINTH_SETBACK = 40;
export const MIN_ZONE_HEIGHT = 100;
export const MIN_DRAWER_FRONT = 80;
export const MAX_DRAWER_FRONT = 450;
/** Tilt of a shoe shelf, front edge down: enough to show the shoes without them sliding off. */
export const SHOE_TILT_DEG = 15;
/** Height of the lip along a shoe shelf's front edge that stops the shoes sliding off it. */
export const SHOE_LIP = 40;
/** Least vertical pitch a shoe shelf can be given: below this a pair of shoes no longer fits. */
export const MIN_SHOE_PITCH = 150;
/**
 * A tilted shoe board is shallow — a shoe is about 300 mm long — so it never reaches the back of a
 * 600 mm unit; this also keeps the board's vertical drop (about 91 mm) plus the lip inside the
 * minimum pitch at any unit depth.
 */
export const SHOE_SHELF_DEPTH = 350;

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

/** One tilted shoe shelf: absolute Y of the board's top surface at its back and front edges (the
 * board leans front-edge down), and its depth — `SHOE_SHELF_DEPTH`, or the interior less the
 * setback when the unit is shallower than that. The board is front-aligned: its front edge sits
 * `SHELF_SETBACK` behind the unit's front, like a flat shelf, and the space behind it stays open. */
export interface ShoeShelf {
  yBack: number;
  yFront: number;
  depth: number;
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
  shoeShelves: ShoeShelf[];
  drawerFronts: DrawerFront[];
  frontW: number;
  frontH: number;
  rodY: number | null;
  /** True when `rodY` came from the automatic rule rather than the zone's own `rod`. */
  rodAuto: boolean;
  /** Which way the rail runs; `along` unless the zone says otherwise. */
  rodDir: RodDir;
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

/** Where a gap's wall-mounted rail actually hangs. `along`: it spans the whole empty stretch the
 * gap sits in at mid-depth, held `SHELF_SETBACK` clear of each neighbour — the gap itself, the
 * plain (rail-less) gaps beside it, and the free rest of the run after the last column, up to
 * the end of the run (the next wall, or the corner left for the neighbouring wall's units). A
 * unit or another rail gap bounds the stretch; between two rail gaps the plain ones go with the
 * first. `across`: it stands at its own gap's middle and runs into the room, from the wall to
 * the front edge of the runs beside it, with the same clearance. */
export interface GapRailLayout {
  dir: RodDir;
  /** Rail axis, absolute Y. */
  y: number;
  s0: number;
  s1: number;
  length: number;
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
  /** The wall's unit depth — how far into the room an `across` rail may reach. */
  depth: number;
  rail: GapRailLayout | null;
}

/** Where a rail lands when the user first ticks one on: the usual comfortable reach height. */
export function defaultGapRailHeight(p: Project): number {
  return Math.min(MAX_ROD_HEIGHT, heights(p).topY - ROD_DROP);
}

/** `s0`..`s1` is the gap itself; `span` is the empty stretch it sits in (see `GapRailLayout`),
 * which an `along` rail spans instead. Defaults to the gap alone. */
export function layoutGapRail(
  rail: GapRail | undefined, s0: number, s1: number, depth: number, span: { s0: number; s1: number } = { s0, s1 },
): GapRailLayout | null {
  if (!rail) return null;
  const k = SHELF_SETBACK;
  if (rail.dir === 'across') {
    const c = (s0 + s1) / 2;
    return { dir: 'across', y: rail.height, s0: c, s1: c, length: depth - 2 * k };
  }
  return { dir: 'along', y: rail.height, s0: span.s0 + k, s1: span.s1 - k, length: span.s1 - span.s0 - 2 * k };
}

export type ColumnLayout = UnitLayout | GapLayout;

/**
 * Whether an `along` rail at `wall`'s mid-depth can run on through the corner at its `side` end,
 * across the stretch the neighbouring wall claims there. It can when the neighbour keeps that
 * corner empty: its columns nearest the corner are plain gaps (or nothing at all), leaving the
 * rod's line — `depth / 2` from our wall, plus the usual clearance — clear of any unit or rail.
 */
export function cornerPassable(p: Project, wall: Wall, side: 'start' | 'end'): boolean {
  if (cornerClaim(p, wall, side) === 0) return false; // no corner claimed: the run reaches the wall already
  const n = side === 'start' ? leftOf(wall) : rightOf(wall);
  const segs = wallSegments(p, n);
  const touching = side === 'start' ? segs[segs.length - 1] : segs[0];
  const cols = p.wardrobe.walls[n].segments[touching.index];
  const isPlainGap = (c: Column) => c.kind === 'gap' && !c.rail;
  const reach = p.wardrobe.walls[wall].depth / 2 + SHELF_SETBACK;
  if (side === 'end') {
    // Our end corner is the neighbour's start: how far from its wall start does its first solid column begin?
    let solidStart = touching.s0;
    for (const c of cols) {
      if (!isPlainGap(c)) return solidStart >= reach;
      solidStart += c.width;
    }
    return true;
  }
  // Our start corner is the neighbour's end: how far from its wall end does its last solid column stop?
  let solidEnd = touching.s0 + cols.reduce((a, c) => a + c.width, 0);
  for (let i = cols.length - 1; i >= 0; i--) {
    if (!isPlainGap(cols[i])) return wallLength(p.room, n) - solidEnd >= reach;
    solidEnd -= cols[i].width;
  }
  return true;
}

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
      shoeShelves: [],
      drawerFronts: [],
      frontW: interiorWidth - 2 * REVEAL,
      frontH: 0,
      rodY: null,
      rodAuto: zone.rod === undefined,
      rodDir: zone.rodDir ?? 'along',
    };
    if (zone.type === 'shelves' && zone.count >= 1) {
      // `count` counts COMPARTMENTS, as it does for drawers: n bays are separated by n - 1
      // boards, so a count of 1 is a single open bay with no shelf in it.
      const opening = (height - (zone.count - 1) * t) / zone.count;
      for (let k = 1; k < zone.count; k++) zl.shelfYs.push(yBot + k * opening + (k - 1) * t);
    } else if (zone.type === 'shoes' && zone.count >= 1) {
      // `count` counts BOARDS here, not bays: each tilted board is centred in its own equal slice
      // of the zone, so the shoes above it get the same room whichever slice they sit in.
      const shoeDepth = Math.min(SHOE_SHELF_DEPTH, interiorDepth - SHELF_SETBACK);
      const drop = shoeDepth * Math.sin((SHOE_TILT_DEG * Math.PI) / 180);
      const pitch = height / zone.count;
      for (let k = 0; k < zone.count; k++) {
        const mid = yBot + pitch * k + pitch / 2;
        zl.shoeShelves.push({ yBack: mid + drop / 2, yFront: mid - drop / 2, depth: shoeDepth });
      }
    } else if (zone.type === 'drawers' && zone.count >= 1) {
      // Whole millimetres: a fitter cuts fronts to a round size, and the remainder (< 1 mm per
      // front) is absorbed by the reveal above the top one.
      zl.frontH = Math.floor(drawerFrontHeight(height, zone.count));
      for (let k = 0; k < zone.count; k++) {
        const y0 = yBot + REVEAL + k * (zl.frontH + DRAWER_GAP);
        zl.drawerFronts.push({ y0, y1: y0 + zl.frontH });
      }
    } else if (zone.type === 'hanging') {
      // An explicit rail is taken as given — validate() reports one that falls outside its zone,
      // so a clamp here would only hide the mistake from the drawings.
      zl.rodY = zone.rod
        ? zone.rod.from === 'top' ? yTop - zone.rod.offset : yBot + zone.rod.offset
        : Math.min(yTop - ROD_DROP, MAX_ROD_HEIGHT);
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
  const segs = wallSegments(p, wall);
  const L = wallLength(p.room, wall);
  for (const seg of segs) {
    const columns = plan.segments[seg.index];
    // Where a rail that reaches the run's end may go on to: the real wall, if the corner is open.
    const runStart = seg === segs[0] && cornerPassable(p, wall, 'start') ? 0 : seg.s0;
    const runEnd = seg === segs[segs.length - 1] && cornerPassable(p, wall, 'end') ? L : seg.s1;
    // Column starts, plus the end of the run after the last one.
    const starts: number[] = [seg.s0];
    for (const c of columns) starts.push(starts[starts.length - 1] + c.width);
    const isPlainGap = (c: Column | undefined) => c?.kind === 'gap' && !c.rail;
    // The empty stretch a rail gap sits in: back over the plain gaps before it, unless one of
    // those already belongs to an earlier rail; on over the plain gaps after it, and the free
    // rest of the run if nothing but plain gaps follows — through the corner, when it is open.
    const railSpan = (i: number) => {
      let a = i;
      while (a > 0 && isPlainGap(columns[a - 1])) a -= 1;
      if (a > 0 && columns[a - 1].kind === 'gap') a = i; // an earlier rail gap owns that stretch
      let b = i + 1;
      while (b < columns.length && isPlainGap(columns[b])) b += 1;
      return { s0: a === 0 ? runStart : starts[a], s1: b === columns.length ? runEnd : starts[b] };
    };
    columns.forEach((c, i) => {
      const s = starts[i];
      if (c.kind === 'unit') out.push(layoutUnit(p, wall, seg.index, columnIndex, c, s));
      else {
        const depth = plan.depth;
        out.push({
          kind: 'gap', gap: c, wall, segment: seg.index, columnIndex,
          s0: s, s1: s + c.width, width: c.width, depth,
          rail: layoutGapRail(c.rail, s, s + c.width, depth, c.rail ? railSpan(i) : undefined),
        });
      }
      columnIndex += 1;
    });
  }
  return out;
}

export const layoutAll = (p: Project): ColumnLayout[] => WALLS.flatMap((w) => layoutWall(p, w));
