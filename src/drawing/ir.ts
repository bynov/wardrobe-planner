import { bounds2, v2, type Box2, type Vec2 } from '../geometry/vec';
import type { Units } from '../units';
import { expandDim } from './dim';

export type Stroke = 'thin' | 'thick' | 'dashed';
export type Fill = 'panel' | 'none';
export type Anchor = 'start' | 'middle' | 'end';

export type Prim =
  | { t: 'line'; a: Vec2; b: Vec2; stroke?: Stroke }
  | { t: 'poly'; pts: Vec2[]; closed: boolean; stroke?: Stroke; fill?: Fill }
  | { t: 'text'; at: Vec2; text: string; size?: number; anchor?: Anchor; rotate?: number }
  | { t: 'dim'; a: Vec2; b: Vec2; offset: number; label?: string };

export interface Drawing {
  title: string;
  prims: Prim[];
  bounds: Box2;
  textSize: number;
  /** Display unit of every length this drawing prints; the geometry itself stays millimetres. */
  units: Units;
}

export const line = (a: Vec2, b: Vec2, stroke: Stroke = 'thin'): Prim => ({ t: 'line', a, b, stroke });
export const poly = (pts: Vec2[], stroke: Stroke = 'thin', fill: Fill = 'none', closed = true): Prim => ({ t: 'poly', pts, closed, stroke, fill });
export const rectPrim = (x: number, y: number, w: number, h: number, stroke: Stroke = 'thin', fill: Fill = 'none'): Prim =>
  poly([v2(x, y), v2(x + w, y), v2(x + w, y + h), v2(x, y + h)], stroke, fill);
export const text = (at: Vec2, s: string, size?: number, anchor: Anchor = 'start', rotate?: number): Prim =>
  ({ t: 'text', at, text: s, size, anchor, rotate });
export const dim = (a: Vec2, b: Vec2, offset: number, label?: string): Extract<Prim, { t: 'dim' }> => ({ t: 'dim', a, b, offset, label });

export function expandPrims(prims: Prim[], textSize: number, units: Units = 'mm'): Prim[] {
  const out: Prim[] = [];
  for (const p of prims) {
    if (p.t === 'dim') out.push(...expandDim(p, textSize, units));
    else out.push(p);
  }
  return out;
}

/**
 * The box a text prim is assumed to cover, with no font to measure: 0.6 em per glyph, one line
 * tall. It is what the sheet bounds are grown to fit and what the collision tests in
 * `views.test.ts` check labels against; `null` for every other prim.
 */
export function textBox(p: Prim, textSize: number): Box2 | null {
  if (p.t !== 'text') return null;
  const s = p.size ?? textSize;
  const w = p.text.length * s * 0.6;
  // Rotated text runs along +y from its anchor point, so its box is a column one line wide.
  if (p.rotate) return { min: v2(p.at.x - s, p.at.y - s), max: v2(p.at.x + s, p.at.y + w) };
  const x0 = p.anchor === 'end' ? p.at.x - w : p.anchor === 'middle' ? p.at.x - w / 2 : p.at.x;
  return { min: v2(x0, p.at.y - s / 2), max: v2(x0 + w, p.at.y + s) };
}

/** Do two boxes share any area? A missing box (a prim that has none) never overlaps anything. */
export const boxesOverlap = (a: Box2 | null, b: Box2 | null): boolean =>
  !!a && !!b && a.min.x < b.max.x && b.min.x < a.max.x && a.min.y < b.max.y && b.min.y < a.max.y;

function primPoints(p: Prim, textSize: number): Vec2[] {
  switch (p.t) {
    case 'line': return [p.a, p.b];
    case 'poly': return p.pts;
    case 'text': {
      const b = textBox(p, textSize);
      return b ? [b.min, b.max] : [];
    }
    case 'dim': return [];
  }
}

export function makeDrawing(title: string, prims: Prim[], textSize: number, units: Units = 'mm'): Drawing {
  // Dimension labels are only expanded here, so the bounds have to be measured in the same unit
  // the renderers will print: an inch label is a different number of glyphs wide than a mm one.
  const pts = expandPrims(prims, textSize, units).flatMap((p) => primPoints(p, textSize));
  const b = pts.length ? bounds2(pts) : { min: v2(0, 0), max: v2(0, 0) };
  const pad = 2 * textSize;
  return {
    title,
    prims,
    textSize,
    units,
    bounds: { min: v2(b.min.x - pad, b.min.y - pad), max: v2(b.max.x + pad, b.max.y + pad) },
  };
}

export function textSizeFor(w: number, h: number): number {
  return Math.max(20, Math.max(w, h) / 60);
}
