import { t, type Lang } from '../i18n';
import {
  WALLS, cornerClaim, doorSpan, isSideWall, leftOf, localToWorld, rightOf, wallFrame, wallLength, wallSegments,
  type DoorSpan, type Frame,
} from '../geometry/frames';
import { REVEAL, ROD_DIAMETER, heights, layoutWall, type ColumnLayout, type GapLayout, type UnitLayout, type ZoneLayout } from '../geometry/layout';
import { v2, v3, type Vec2 } from '../geometry/vec';
import type { Project, Wall } from '../model/types';
import { dim, line, makeDrawing, poly, rectPrim, text, textSizeFor, type Drawing, type Prim } from './ir';
import { fmtLen } from './dim';

const HANDLE_LENGTH = 120;
const HANDLE_AT = 0.6; // handle line, as a fraction of the drawer front height
const LABEL_AT = 0.35; // drawers-zone label, same fraction — clear of the handle above it
const ARC_SEGMENTS = 12;
const ROD_SEGMENTS = 16;

export const wallName = (lang: Lang, wall: Wall): string => t(lang, `wall.${wall}`);

/** "B1": the short code that ties a unit in the drawings to its rows in the cut list. */
export const unitTag = (lang: Lang, wall: Wall, columnIndex: number): string =>
  `${t(lang, `wall.abbr.${wall}`)}${columnIndex + 1}`;

/** Wall-local (s, z) -> plan IR (world x, -world z). */
const toIR = (f: Frame, s: number, z: number): Vec2 => {
  const w = localToWorld(f, v3(s, 0, z));
  return v2(w.x, -w.z);
};

const circle = (c: Vec2, r: number, n = ROD_SEGMENTS): Prim =>
  poly(Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return v2(c.x + r * Math.cos(a), c.y + r * Math.sin(a));
  }), 'thin', 'panel');

/**
 * Where a zone's label goes. A drawers zone has no band tall enough for the text between its fronts,
 * so the label sits on the lowest front, below its handle. Every other zone gets the middle of its
 * tallest band that no board covers — shelf slabs are excluded, so a label never lands on one.
 */
function zoneLabelY(z: ZoneLayout, th: number): number {
  const bottom = z.drawerFronts[0];
  if (bottom) return bottom.y0 + (bottom.y1 - bottom.y0) * LABEL_AT;
  const blocked: [number, number][] = z.shelfYs.map((y): [number, number] => [y, y + th]);
  blocked.sort((a, b) => a[0] - b[0]);
  blocked.push([z.yTop, z.yTop]); // sentinel: closes the band above the last board
  let best = (z.yBot + z.yTop) / 2;
  let span = -1;
  let y = z.yBot;
  for (const [b0, b1] of blocked) {
    if (b0 - y > span) {
      span = b0 - y;
      best = (y + b0) / 2;
    }
    y = Math.max(y, b1);
  }
  return best;
}

// ---------------------------------------------------------------- plan view

/** Door leaf + swing arc, and the two wall-line stubs beside the opening. */
function drawDoorPlan(prims: Prim[], p: Project, lang: Lang, s: number): void {
  const d = doorSpan(p);
  const f = wallFrame(p.room, d.wall);
  const w = p.door.width;
  prims.push(line(toIR(f, d.s0, 0), toIR(f, d.s0, w), 'thin')); // leaf, hinged at s0
  const arc: Vec2[] = [];
  for (let k = 0; k <= ARC_SEGMENTS; k++) {
    const a = (Math.PI / 2) * (1 - k / ARC_SEGMENTS);
    arc.push(toIR(f, d.s0 + w * Math.cos(a), w * Math.sin(a)));
  }
  prims.push(poly(arc, 'thin', 'none', false));
  prims.push(text(
    toIR(f, (d.s0 + d.s1) / 2, w + 1.2 * s),
    t(lang, 'drawing.door', { w: fmtLen(p.door.width), h: fmtLen(p.door.height) }),
    s, 'middle', isSideWall(d.wall) ? 90 : undefined,
  ));
}

/** The plan is shown small in the design tab, so its type runs larger than the elevations'. */
const planTextSize = (W: number, D: number): number => Math.max(20, Math.max(W, D) / 40);

export function planView(p: Project, lang: Lang = 'en'): Drawing {
  const { width: W, depth: D } = p.room;
  const s = planTextSize(W, D);
  const door = doorSpan(p);
  const prims: Prim[] = [];
  // Wall names, unit tags, gap captions and dimensions are collected apart from the filled unit
  // rectangles and appended after them: a fill drawn later would paint over the text.
  const labels: Prim[] = [];

  for (const wall of WALLS) {
    const f = wallFrame(p.room, wall);
    const L = wallLength(p.room, wall);
    const rotate = isSideWall(wall) ? 90 : undefined;
    // room outline, one line per wall, split at the door opening
    if (wall === door.wall) {
      prims.push(line(toIR(f, 0, 0), toIR(f, door.s0, 0), 'thick'));
      prims.push(line(toIR(f, door.s1, 0), toIR(f, L, 0), 'thick'));
    } else {
      prims.push(line(toIR(f, 0, 0), toIR(f, L, 0), 'thick'));
    }
    labels.push(text(toIR(f, L / 2, -1.2 * s), wallName(lang, wall), s * 1.2, 'middle', rotate));

    const plan = p.wardrobe.walls[wall];
    if (!plan.enabled) continue;
    const depth = plan.depth;
    for (const c of layoutWall(p, wall)) {
      const quad = [toIR(f, c.s0, 0), toIR(f, c.s1, 0), toIR(f, c.s1, depth), toIR(f, c.s0, depth)];
      const mid = toIR(f, (c.s0 + c.s1) / 2, depth / 2);
      if (c.kind === 'unit') {
        prims.push(poly(quad, 'thin', 'panel'));
        prims.push(line(quad[3], quad[2], 'thick')); // front edge
        // the same tag the cut list uses, so a row can be traced back to a unit on the plan
        labels.push(text(mid, unitTag(lang, wall, c.columnIndex), s * 0.8, 'middle', rotate));
      } else {
        prims.push(poly(quad, 'dashed'));
        labels.push(text(mid, t(lang, 'drawing.gap'), s * 0.8, 'middle', rotate));
      }
    }
    labels.push(dim(toIR(f, 0, 0), toIR(f, 0, depth), -1.5 * s)); // unit depth at the start corner
  }
  prims.push(...labels);

  drawDoorPlan(prims, p, lang, s);
  const df = wallFrame(p.room, door.wall);
  const dL = wallLength(p.room, door.wall);
  // door.offset runs from the world x = 0 / z = 0 corner, which is s = L on the mirrored walls
  // (see doorSpan): dimension the run between the opening and *that* corner, not always s = 0.
  const mirrored = door.wall === 'front' || door.wall === 'left';
  if (p.door.offset > 0) {
    prims.push(mirrored
      ? dim(toIR(df, door.s1, 0), toIR(df, dL, 0), 3 * s)
      : dim(toIR(df, 0, 0), toIR(df, door.s0, 0), 3 * s));
  }
  prims.push(dim(toIR(df, door.s0, 0), toIR(df, door.s1, 0), 3 * s));
  prims.push(dim(v2(0, -D), v2(W, -D), -5.5 * s)); // room width, below
  prims.push(dim(v2(W, -D), v2(W, 0), -5.5 * s)); // room depth, right
  return makeDrawing(t(lang, 'drawing.plan'), prims, s);
}

// ----------------------------------------------------------- wall elevation

function drawUnit(prims: Prim[], u: UnitLayout, p: Project, lang: Lang, s: number): void {
  const th = p.wardrobe.panelThickness;
  const plinth = p.wardrobe.plinthHeight;
  const ix = u.s0 + th;
  const cx = u.s0 + u.width / 2;
  prims.push(rectPrim(u.s0, plinth, u.width, u.topY - plinth, 'thin', 'panel'));
  // the cut-list tag, just above the unit's top edge (the editor's "+" row rides higher still)
  prims.push(text(v2(u.s0 + 0.3 * s, u.topY + 0.6 * s), unitTag(lang, u.wall, u.columnIndex), s * 0.9, 'start'));
  prims.push(line(v2(u.s0, plinth), v2(u.s1, plinth), 'thick')); // plinth top
  prims.push(rectPrim(ix, u.floorY, u.interiorWidth, u.interiorHeight, 'thin'));
  for (const y of u.dividerYs) prims.push(rectPrim(ix, y - th, u.interiorWidth, th, 'thin', 'panel'));
  for (const z of u.zones) {
    for (const y of z.shelfYs) prims.push(rectPrim(ix, y, u.interiorWidth, th, 'thin', 'panel'));
    for (const d of z.drawerFronts) {
      prims.push(rectPrim(ix + REVEAL, d.y0, z.frontW, d.y1 - d.y0, 'thin', 'panel'));
      const hw = Math.min(HANDLE_LENGTH, z.frontW * 0.6) / 2;
      const hy = d.y0 + (d.y1 - d.y0) * HANDLE_AT;
      prims.push(line(v2(cx - hw, hy), v2(cx + hw, hy), 'thick'));
    }
    if (z.rodY !== null) {
      prims.push(line(v2(ix, z.rodY), v2(ix + u.interiorWidth, z.rodY), 'dashed'));
      prims.push(circle(v2(cx, z.rodY), ROD_DIAMETER / 2));
      // Height above the finished floor, right-aligned to the interior edge just above the rod.
      // (End-anchored rather than placed by a guessed width: the RU wording is much longer.)
      // A narrow unit has no room for it — the elevation's rail dimension still carries the number.
      if (u.width >= 5 * s) {
        prims.push(text(v2(u.s1 - th, z.rodY + 0.9 * s),
          t(lang, 'drawing.rodHeight', { n: Math.round(z.rodY) }), s * 0.7, 'end'));
      }
    }
    if (u.width >= 4 * s && z.height >= 1.5 * s) {
      prims.push(text(v2(cx, zoneLabelY(z, th)),
        t(lang, 'drawing.zone', { type: t(lang, `zone.${z.zone.type}`), n: Math.round(z.height) }),
        s * 0.8, 'middle'));
    }
  }
}

function drawGap(prims: Prim[], g: GapLayout, topY: number, lang: Lang, s: number): void {
  prims.push(rectPrim(g.s0, 0, g.width, topY, 'dashed'));
  prims.push(text(v2((g.s0 + g.s1) / 2, topY / 2), t(lang, 'drawing.gap'), s * 0.8, 'middle', 90));
}

/** The door opening on this wall: dashed hole in the elevation plus its size label. */
function drawDoorElevation(prims: Prim[], p: Project, door: DoorSpan, lang: Lang, s: number): void {
  prims.push(rectPrim(door.s0, 0, door.s1 - door.s0, p.door.height, 'dashed'));
  prims.push(text(v2((door.s0 + door.s1) / 2, p.door.height + 0.8 * s),
    t(lang, 'drawing.door', { w: fmtLen(p.door.width), h: fmtLen(p.door.height) }), s * 0.8, 'middle'));
}

/** Dashed side-sections of the neighbouring walls that own the corners of a side wall. */
function drawClaims(prims: Prim[], p: Project, wall: Wall, L: number, topY: number, lang: Lang, s: number): void {
  const plinth = p.wardrobe.plinthHeight;
  for (const side of ['start', 'end'] as const) {
    const c = cornerClaim(p, wall, side);
    if (c <= 0) continue;
    const x0 = side === 'start' ? 0 : L - c;
    prims.push(rectPrim(x0, plinth, c, topY - plinth, 'dashed'));
    const n = side === 'start' ? leftOf(wall) : rightOf(wall);
    prims.push(text(v2(x0 + c / 2, (plinth + topY) / 2),
      t(lang, 'drawing.wallSection', { wall: wallName(lang, n) }), s * 0.8, 'middle', 90));
  }
}

export function wallElevation(p: Project, wall: Wall, lang: Lang = 'en'): Drawing {
  const L = wallLength(p.room, wall);
  const H = p.room.height;
  const s = textSizeFor(L, H);
  const title = t(lang, 'drawing.elevation', { wall: wallName(lang, wall) });
  const door = doorSpan(p);
  const prims: Prim[] = [rectPrim(0, 0, L, H, 'thick')];

  if (!p.wardrobe.walls[wall].enabled) {
    // Clear of the door opening when there is one, so the label never sits inside its outline.
    const labelY = door.wall === wall ? (p.door.height + H) / 2 : H / 2;
    if (door.wall === wall) drawDoorElevation(prims, p, door, lang, s);
    prims.push(text(v2(L / 2, labelY), t(lang, 'drawing.noWardrobe'), s, 'middle'));
    return makeDrawing(title, prims, s);
  }

  const { topY } = heights(p);
  const plinth = p.wardrobe.plinthHeight;
  const cols: ColumnLayout[] = layoutWall(p, wall);

  prims.push(line(v2(0, 0), v2(L, 0), 'thick')); // floor
  if (p.wardrobe.topGap > 0) {
    prims.push(line(v2(0, topY), v2(L, topY), 'dashed'));
    prims.push(text(v2(L - 0.5 * s, (topY + H) / 2), t(lang, 'drawing.topGap', { n: fmtLen(p.wardrobe.topGap) }), s * 0.8, 'end'));
  }
  for (const c of cols) {
    if (c.kind === 'unit') drawUnit(prims, c, p, lang, s);
    else drawGap(prims, c, topY, lang, s);
    prims.push(dim(v2(c.s0, 0), v2(c.s1, 0), -1.5 * s));
  }

  if (door.wall === wall) drawDoorElevation(prims, p, door, lang, s); // after the units, so a clash stays visible
  drawClaims(prims, p, wall, L, topY, lang, s);
  // A lone segment that covers the whole wall repeats the wall-length dimension below it.
  const segs = wallSegments(p, wall);
  const wholeRun = segs.length === 1 && segs[0].s1 - segs[0].s0 === L;
  if (!wholeRun) {
    for (const seg of segs) {
      if (seg.s1 - seg.s0 > 0) prims.push(dim(v2(seg.s0, 0), v2(seg.s1, 0), -4 * s));
    }
  }
  prims.push(dim(v2(0, 0), v2(L, 0), -6.5 * s));
  prims.push(dim(v2(L, 0), v2(L, plinth), -1.5 * s));
  prims.push(dim(v2(L, plinth), v2(L, topY), -1.5 * s));
  if (topY < H) prims.push(dim(v2(L, topY), v2(L, H), -1.5 * s));
  prims.push(dim(v2(L, 0), v2(L, H), -4.5 * s));
  // Rail height above the finished floor, below the full-height chain: the number a fitter sets out
  // first. One dimension for the first hanging zone on the wall — the rest carry their own labels.
  const firstRodY = cols
    .flatMap((c) => (c.kind === 'unit' ? c.zones : []))
    .find((z) => z.rodY !== null)?.rodY;
  if (firstRodY != null && firstRodY > 0) prims.push(dim(v2(L, 0), v2(L, firstRodY), -7.5 * s));
  return makeDrawing(title, prims, s);
}
