import { jsPDF } from 'jspdf';
import type { Project, Wall } from '../model/types';
import { WALLS } from '../geometry/frames';
import { buildParts } from '../geometry/parts';
import { buildCutList, locationTag, noteText, type CutRow } from '../cutlist/cutlist';
import { planView, wallElevation, wallName } from '../drawing/views';
import type { Drawing } from '../drawing/ir';
import { drawingToPdf, type PdfBox } from '../render/pdf';
import { t, type Lang, type MessageKey } from '../i18n';
import { formatLen, type Units } from '../units';
import { registerPdfFont } from './font';

export interface PdfOptions { lang?: Lang; units?: Units; snapshotPng?: string | null; date?: Date }

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
  const units = opts.units ?? 'mm';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerPdfFont(doc);
  summaryPage(doc, p, opts, lang, units);
  doc.addPage();
  drawingPage(doc, planView(p, lang, units), lang);
  for (const wall of WALLS) {
    if (!p.wardrobe.walls[wall].enabled) continue;
    doc.addPage();
    drawingPage(doc, wallElevation(p, wall, lang, units), lang);
  }
  cutListPages(doc, buildCutList(buildParts(p)), lang, units);
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
function wallSummaryValue(p: Project, wall: Wall, lang: Lang, units: Units): string {
  const plan = p.wardrobe.walls[wall];
  if (!plan.enabled) return t(lang, 'pdf.disabled');
  const cols = [...plan.segments[0], ...plan.segments[1]];
  if (cols.length === 0) return t(lang, 'pdf.none');
  return cols
    .map((c) => {
      if (c.kind === 'gap') return t(lang, 'pdf.gapSummary', { w: len(c.width, units) });
      const zones = c.zones
        .map((z) => t(lang, `zone.${z.type}` as MessageKey) + (z.type === 'shelves' || z.type === 'drawers' || z.type === 'shoes' ? `×${z.count}` : ''))
        .join('+');
      return t(lang, 'pdf.unitSummary', { w: len(c.width, units), zones });
    })
    .join('; ');
}

/** jsPDF needs the format named explicitly; the snapshot is a JPEG unless it says otherwise. */
const imageFormat = (dataUrl: string): 'JPEG' | 'PNG' => (dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG');

/**
 * A length on the summary page. Nothing there names its unit, so an inch figure carries the ″ mark
 * itself; in millimetres `formatLen` ignores the suffix and the page reads exactly as it always has.
 */
const len = (mm: number, units: Units): string => formatLen(mm, units, { suffix: true });

/** The label/value pairs of the summary page, in print order. */
export function summaryRows(p: Project, lang: Lang, date: Date, units: Units = 'mm'): [string, string][] {
  const { room, door, wardrobe } = p;
  return [
    [t(lang, 'pdf.date'), date.toISOString().slice(0, 10)],
    [t(lang, 'pdf.room'), `${len(room.width, units)} × ${len(room.depth, units)} × ${len(room.height, units)}`],
    [t(lang, 'pdf.door'), t(lang, 'pdf.doorValue', {
      wall: wallName(lang, door.wall), offset: len(door.offset, units), w: len(door.width, units), h: len(door.height, units),
      dir: t(lang, `ui.swingOpt.${door.swing}`), hinge: t(lang, `ui.hinge.${door.hinge}`),
    })],
    [t(lang, 'pdf.thickness'), `${len(wardrobe.panelThickness, units)} / ${len(wardrobe.backThickness, units)}`],
    [t(lang, 'pdf.plinthHeight'), len(wardrobe.plinthHeight, units)],
    [t(lang, 'pdf.topGap'), len(wardrobe.topGap, units)],
    ...WALLS.map((wall): [string, string] => [
      t(lang, 'pdf.wallSummary', { wall: wallName(lang, wall), depth: len(wardrobe.walls[wall].depth, units) }),
      wallSummaryValue(p, wall, lang, units),
    ]),
  ];
}

function summaryPage(doc: jsPDF, p: Project, opts: PdfOptions, lang: Lang, units: Units): void {
  header(doc, p.name || t(lang, 'pdf.defaultTitle'));
  const rows = summaryRows(p, lang, opts.date ?? new Date(), units);
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

/**
 * Heading text and left edge of every cut-list column. The three size columns name the unit in
 * their heading, so the cells below stay bare figures — and they were widened to 20/20/18 mm to
 * hold the longest of those headings ("Ширина, дюйм").
 */
export function cutListColumns(lang: Lang, units: Units): [string, number][] {
  const u = { u: t(lang, `ui.units.${units}` as MessageKey) };
  return [
    [t(lang, 'table.num'), M],
    [t(lang, 'table.part'), M + 10],
    [t(lang, 'table.location'), M + 46],
    [t(lang, 'table.qty'), M + 96],
    [t(lang, 'table.length', u), M + 110],
    [t(lang, 'table.width', u), M + 130],
    [t(lang, 'table.thk', u), M + 150],
    [t(lang, 'table.material'), M + 168],
    [t(lang, 'table.notes'), M + 194],
  ];
}

/** Right edge of the cut-list table — the last column may run up to here. */
export const CUT_TABLE_MAX_X = W - M;

function cutListPages(doc: jsPDF, rows: CutRow[], lang: Lang, units: Units): void {
  const cols = cutListColumns(lang, units);
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
      const location = r.locations.map((l) => locationTag(lang, l)).join(', ');
      const notes = r.notes.map((n) => noteText(lang, n, units)).join('; ').slice(0, 40);
      const vals = [
        String(start + j + 1),
        t(lang, `part.${r.nameKey}` as MessageKey),
        '', // the location cell wraps, so it is drawn separately below
        String(r.qty),
        formatLen(r.length, units),
        formatLen(r.width, units),
        formatLen(r.thickness, units),
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
