import { jsPDF } from 'jspdf';
import type { Project, Wall } from '../model/types';
import { WALLS } from '../geometry/frames';
import { buildParts } from '../geometry/parts';
import { buildCutList, type CutRow } from '../cutlist/cutlist';
import { planView, unitTag, wallElevation, wallName } from '../drawing/views';
import type { Drawing } from '../drawing/ir';
import { drawingToPdf, type PdfBox } from '../render/pdf';
import { t, tm, type Lang, type MessageKey } from '../i18n';
import { registerPdfFont } from './font';

export interface PdfOptions { lang?: Lang; snapshotPng?: string | null; date?: Date }

const W = 297, H = 210, M = 12;
const BOX: PdfBox = { x: M, y: M + 10, w: W - 2 * M, h: H - 2 * M - 16 };
const ROW_H = 6;
export const ROWS_PER_PAGE = 27;

// --- summary page geometry. The 3D snapshot occupies the top-right block, so the value column
// wraps well clear of it: nothing a value prints may reach SUMMARY_VALUE_MAX_X.
const SNAP_X = W - M - 90, SNAP_Y = M + 14, SNAP_W = 90, SNAP_H = 60;
export const SUMMARY_KEY_X = M;
export const SUMMARY_VALUE_X = M + 70;
export const SUMMARY_VALUE_MAX_X = 190;
export const SUMMARY_VALUE_W = SUMMARY_VALUE_MAX_X - SUMMARY_VALUE_X - 3;

// --- cut list. The location cell holds abbreviated wall codes ("B1, B2, L1") and wraps to two
// lines inside the same 6 mm row.
const CUT_FONT_SIZE = 8;
const LOC_W = 46;
const LOC_LINES = 2;
const LOC_LINE_H = 3;

export function buildPdf(p: Project, opts: PdfOptions = {}): jsPDF {
  const lang = opts.lang ?? 'en';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerPdfFont(doc);
  summaryPage(doc, p, opts, lang);
  doc.addPage();
  drawingPage(doc, planView(p, lang), lang);
  for (const wall of WALLS) {
    if (!p.wardrobe.walls[wall].enabled) continue;
    doc.addPage();
    drawingPage(doc, wallElevation(p, wall, lang), lang);
  }
  cutListPages(doc, buildCutList(buildParts(p)), lang);
  return doc;
}

export function exportPdfBlob(p: Project, opts: PdfOptions = {}): Blob {
  return buildPdf(p, opts).output('blob');
}

function header(doc: jsPDF, title: string): void {
  doc.setFontSize(14);
  doc.text(title, M, M + 4);
  doc.setLineWidth(0.3);
  doc.line(M, M + 7, W - M, M + 7);
}

function drawingPage(doc: jsPDF, d: Drawing, lang: Lang): void {
  header(doc, d.title);
  const N = drawingToPdf(doc, d, BOX);
  doc.setFontSize(9);
  doc.text(t(lang, 'pdf.scale', { n: N }), W - M, H - M / 2, { align: 'right' });
}

/** One wall's segments (both), each rendered as a unit- or gap-summary string, joined by '; '. */
function wallSummaryValue(p: Project, wall: Wall, lang: Lang): string {
  const plan = p.wardrobe.walls[wall];
  if (!plan.enabled) return t(lang, 'pdf.disabled');
  const cols = [...plan.segments[0], ...plan.segments[1]];
  if (cols.length === 0) return t(lang, 'pdf.none');
  return cols
    .map((c) => {
      if (c.kind === 'gap') return t(lang, 'pdf.gapSummary', { w: c.width });
      const zones = c.zones
        .map((z) => t(lang, `zone.${z.type}` as MessageKey) + (z.type === 'shelves' || z.type === 'drawers' ? `×${z.count}` : ''))
        .join('+');
      return t(lang, 'pdf.unitSummary', { w: c.width, zones });
    })
    .join('; ');
}

/** jsPDF needs the format named explicitly; the snapshot is a JPEG unless it says otherwise. */
const imageFormat = (dataUrl: string): 'JPEG' | 'PNG' => (dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG');

/** The label/value pairs of the summary page, in print order. */
export function summaryRows(p: Project, lang: Lang, date: Date): [string, string][] {
  const { room, door, wardrobe } = p;
  return [
    [t(lang, 'pdf.date'), date.toISOString().slice(0, 10)],
    [t(lang, 'pdf.room'), `${room.width} × ${room.depth} × ${room.height}`],
    [t(lang, 'pdf.door'), t(lang, 'pdf.doorValue', { wall: wallName(lang, door.wall), offset: door.offset, w: door.width, h: door.height })],
    [t(lang, 'pdf.thickness'), `${wardrobe.panelThickness} / ${wardrobe.backThickness}`],
    [t(lang, 'pdf.plinthHeight'), `${wardrobe.plinthHeight}`],
    [t(lang, 'pdf.topGap'), `${wardrobe.topGap}`],
    ...WALLS.map((wall): [string, string] => [
      t(lang, 'pdf.wallSummary', { wall: wallName(lang, wall), depth: wardrobe.walls[wall].depth }),
      wallSummaryValue(p, wall, lang),
    ]),
  ];
}

function summaryPage(doc: jsPDF, p: Project, opts: PdfOptions, lang: Lang): void {
  header(doc, p.name || t(lang, 'pdf.defaultTitle'));
  const rows = summaryRows(p, lang, opts.date ?? new Date());
  doc.setFontSize(10);
  let y = M + 16;
  for (const [k, v] of rows) {
    doc.text(k, SUMMARY_KEY_X, y);
    const lines = doc.splitTextToSize(v, SUMMARY_VALUE_W) as string[];
    doc.text(lines, SUMMARY_VALUE_X, y);
    y += ROW_H * Math.max(1, lines.length);
  }
  if (opts.snapshotPng) {
    try {
      doc.addImage(opts.snapshotPng, imageFormat(opts.snapshotPng), SNAP_X, SNAP_Y, SNAP_W, SNAP_H);
    } catch {
      doc.text(t(lang, 'pdf.snapshotFailed'), SNAP_X, SNAP_Y + 6);
    }
  } else {
    doc.text(t(lang, 'pdf.snapshotMissing'), SNAP_X, SNAP_Y + 6);
  }
}

/** "B = Back wall, R = Right wall, …" — what the location codes in the table stand for. */
function locationLegend(lang: Lang): string {
  const list = WALLS.map((w) => `${t(lang, `wall.abbr.${w}` as MessageKey)} = ${wallName(lang, w)}`).join(', ');
  return t(lang, 'pdf.legend', { list });
}

function cutListPages(doc: jsPDF, rows: CutRow[], lang: Lang): void {
  const cols: [string, number][] = [
    [t(lang, 'table.num'), M],
    [t(lang, 'table.part'), M + 10],
    [t(lang, 'table.location'), M + 46],
    [t(lang, 'table.qty'), M + 96],
    [t(lang, 'table.length'), M + 110],
    [t(lang, 'table.width'), M + 128],
    [t(lang, 'table.thk'), M + 146],
    [t(lang, 'table.material'), M + 160],
    [t(lang, 'table.notes'), M + 186],
  ];
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  for (let page = 0; page < pages; page++) {
    doc.addPage();
    header(doc, page === 0 ? t(lang, 'pdf.cutList') : t(lang, 'pdf.cutListCont', { n: page + 1 }));
    doc.setFontSize(CUT_FONT_SIZE);
    // The location cells hold codes, so the first page spells them out once. It rides on the header
    // line, right of the title, where it costs the table none of its ROWS_PER_PAGE rows.
    if (page === 0) doc.text(locationLegend(lang), W - M, M + 4, { align: 'right' });
    let y = M + 14;
    for (const [name, x] of cols) doc.text(name, x, y);
    y += ROW_H;
    const start = page * ROWS_PER_PAGE;
    rows.slice(start, start + ROWS_PER_PAGE).forEach((r, j) => {
      const location = r.locations.map((l) => unitTag(lang, l.wall, l.columnIndex)).join(', ');
      const notes = r.notes.map((n) => tm(lang, n)).join('; ').slice(0, 40);
      const vals = [
        String(start + j + 1),
        t(lang, `part.${r.nameKey}` as MessageKey),
        '', // the location cell wraps, so it is drawn separately below
        String(r.qty),
        String(r.length),
        String(r.width),
        String(r.thickness),
        t(lang, `material.${r.material}` as MessageKey),
        notes,
      ];
      vals.forEach((v, k) => { if (v) doc.text(v, cols[k][1], y); });
      // Up to two tight lines keep a long location inside the 6 mm row; an ellipsis marks a cell
      // whose remaining tags did not fit, so a truncated list never reads as the whole list.
      const wrapped = doc.splitTextToSize(location, LOC_W) as string[];
      const locLines = wrapped.slice(0, LOC_LINES);
      if (wrapped.length > LOC_LINES && locLines.length > 0) {
        locLines[locLines.length - 1] = `${locLines[locLines.length - 1]}…`;
      }
      locLines.forEach((ln, i) => doc.text(ln, cols[2][1], y + i * LOC_LINE_H));
      y += ROW_H;
    });
  }
  const total = rows.reduce((s, r) => s + r.qty, 0);
  doc.setFontSize(9);
  doc.text(t(lang, 'pdf.total', { n: total }), W - M, H - M / 2, { align: 'right' });
}
