import { v2, type Vec2 } from '../geometry/vec';
import { formatLen, type Units } from '../units';
import type { Prim } from './ir';

/** Expand a linear dimension into extension lines, dimension line, 45-degree ticks and a label. */
export function expandDim(d: Extract<Prim, { t: 'dim' }>, textSize: number, units: Units = 'mm'): Prim[] {
  const dx = d.b.x - d.a.x, dy = d.b.y - d.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [];
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux; // left normal
  const o = d.offset;
  const sign = o >= 0 ? 1 : -1;
  const tick = textSize * 0.5;
  const P = (p: Vec2, s: number) => v2(p.x + nx * s, p.y + ny * s);
  const a2 = P(d.a, o), b2 = P(d.b, o);
  const out: Prim[] = [
    { t: 'line', a: d.a, b: P(d.a, o + sign * tick), stroke: 'thin' },
    { t: 'line', a: d.b, b: P(d.b, o + sign * tick), stroke: 'thin' },
    { t: 'line', a: a2, b: b2, stroke: 'thin' },
  ];
  for (const p of [a2, b2]) {
    const tx = (ux + nx) * tick * 0.5, ty = (uy + ny) * tick * 0.5;
    out.push({ t: 'line', a: v2(p.x - tx, p.y - ty), b: v2(p.x + tx, p.y + ty), stroke: 'thin' });
  }
  let rotate = Math.round((Math.atan2(uy, ux) * 180) / Math.PI);
  if (rotate > 90 || rotate <= -90) rotate += rotate > 0 ? -180 : 180;
  const mid = v2((a2.x + b2.x) / 2, (a2.y + b2.y) / 2);
  out.push({
    t: 'text',
    at: P(mid, sign * textSize * 0.6),
    text: d.label ?? formatLen(len, units),
    size: textSize,
    anchor: 'middle',
    rotate: rotate === 0 ? undefined : rotate,
  });
  return out;
}
