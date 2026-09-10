import { describe, it, expect } from 'vitest';
import { drawingToSvg, drawingToSvgParts } from './svg';
import { makeDrawing, text, line, poly, rectPrim, dim } from '../drawing/ir';
import { v2 } from '../geometry/vec';

describe('drawingToSvg', () => {
  it('renders a simple drawing with a viewBox, a polygon and a dimension', () => {
    const d = makeDrawing('t', [rectPrim(0, 0, 100, 50), dim(v2(0, 0), v2(100, 0), -30)], 10);
    const svg = drawingToSvg(d);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<polygon');
    expect(svg).toContain('viewBox');
    expect(svg).not.toContain('NaN');
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(drawingToSvgParts(d).inner).not.toContain('<svg');
  });
  it('flips Y, rotates text the other way, escapes text', () => {
    const d = makeDrawing('t', [
      line(v2(0, 0), v2(10, 20)),
      text(v2(5, 5), 'a<b', 4, 'middle', 90),
      poly([v2(0, 0), v2(1, 0), v2(1, 1)], 'thick', 'panel'),
    ], 4);
    const svg = drawingToSvg(d);
    expect(svg).toContain('y2="-20"');
    expect(svg).toContain('rotate(-90)');
    expect(svg).toContain('a&lt;b');
    expect(svg).toContain('fill="#e8e2d5"');
    expect(svg).toContain('stroke-width="2"');
  });
  it("labels dimensions in the drawing's own units", () => {
    const mm = makeDrawing('t', [dim(v2(0, 0), v2(600, 0), -30)], 10);
    expect(drawingToSvg(mm)).toContain('>600<');
    const inch = makeDrawing('t', [dim(v2(0, 0), v2(600, 0), -30)], 10, 'in');
    expect(inch.units).toBe('in');
    expect(drawingToSvg(inch)).toContain('>23 5/8<');
    expect(drawingToSvg(inch)).not.toContain('>600<');
  });
});
