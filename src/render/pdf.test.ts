import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { dim, makeDrawing, rectPrim, text } from '../drawing/ir';
import { drawingToPdf, pickScale, type PdfBox } from './pdf';
import { v2 } from '../geometry/vec';

const BOX: PdfBox = { x: 12, y: 22, w: 273, h: 162 };

/** The page's content stream, as jsPDF writes it into the output string. */
const stream = (doc: jsPDF): string => {
  const out = doc.output() as string;
  return out.slice(out.indexOf('stream'), out.indexOf('endstream'));
};

describe('pickScale', () => {
  it('picks the smallest standard scale that fits', () => {
    expect(pickScale(2730, 1620, BOX)).toBe(10);
    expect(pickScale(2740, 1620, BOX)).toBe(20);
  });
});

describe('drawingToPdf', () => {
  it('re-states the panel fill after a label, so later polygons are not filled black', () => {
    // jsPDF's text() writes the text colour as the page fill colour; a filled polygon drawn
    // afterwards used to inherit it and come out near-black (the "everything prints solid" bug).
    const d = makeDrawing('t', [text(v2(0, 0), 'label', 20, 'start'), rectPrim(0, 0, 1000, 500, 'thin', 'panel')], 20);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    drawingToPdf(doc, d, BOX);
    const content = stream(doc);

    const lastText = content.lastIndexOf('Tj');
    expect(lastText).toBeGreaterThan(-1);
    const fill = content.indexOf('0.91 0.89 0.84 rg', lastText);
    expect(fill).toBeGreaterThan(lastText); // panel fill re-stated after the last text operator
    // ...and the filled polygon comes after that fill, not after the text's own grey.
    expect(content.indexOf('B\n', fill)).toBeGreaterThan(fill);
  });

  it('strokes an unfilled polygon without filling it', () => {
    const d = makeDrawing('t', [rectPrim(0, 0, 1000, 500, 'dashed')], 20);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    drawingToPdf(doc, d, BOX);
    const content = stream(doc);
    expect(content).toContain('\nS\n'); // stroke only, never `B`/`f`
    expect(content).not.toContain('\nB\n');
  });

  it("prints dimension labels in the drawing's own units", () => {
    const inch = makeDrawing('t', [dim(v2(0, 0), v2(600, 0), -30)], 10, 'in');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    drawingToPdf(doc, inch, BOX);
    expect(stream(doc)).toContain('23 5/8');

    const mm = makeDrawing('t', [dim(v2(0, 0), v2(600, 0), -30)], 10);
    const doc2 = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    drawingToPdf(doc2, mm, BOX);
    expect(stream(doc2)).toContain('600');
  });
});
