import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  buildPdf, exportPdfBlob, summaryRows, cutListColumns, ROWS_PER_PAGE, CUT_TABLE_MAX_X,
  SUMMARY_VALUE_MAX_X, SUMMARY_VALUE_W, SUMMARY_VALUE_X,
} from './exportPdf';
import { registerPdfFont } from './font';
import { LANGS } from '../i18n';
import { UNITS } from '../units';
import { defaultProject } from '../model/defaults';
import { buildCutList } from '../cutlist/cutlist';
import { buildParts } from '../geometry/parts';
import { WALLS } from '../geometry/frames';

describe('buildPdf', () => {
  it('produces summary + plan + one elevation per enabled wall + cut-list pages', () => {
    const p = defaultProject();
    const doc = buildPdf(p, { date: new Date('2026-09-07T00:00:00Z') });
    const rows = buildCutList(buildParts(p)).length;
    const enabledWalls = WALLS.filter((w) => p.wardrobe.walls[w].enabled).length;
    const cutPages = Math.max(1, Math.ceil(rows / ROWS_PER_PAGE));
    expect(doc.getNumberOfPages()).toBe(2 + enabledWalls + cutPages);
  });

  it('still emits summary + plan + a min of one cut-list page when every wall is disabled', () => {
    const p = defaultProject();
    for (const w of WALLS) p.wardrobe.walls[w].enabled = false;
    expect(buildPdf(p).getNumberOfPages()).toBe(3);
  });

  it('exports a blob with the font embedded (well over 100kb)', () => {
    const blob = exportPdfBlob(defaultProject(), { date: new Date('2026-09-07') });
    expect(blob.size).toBeGreaterThan(100_000);
  });

  it('builds the Russian document without throwing', () => {
    expect(() => buildPdf(defaultProject(), { lang: 'ru' })).not.toThrow();
  });

  it('spells out the door swing and hinge in the summary', () => {
    const p = defaultProject();
    p.door.swing = 'out';
    p.door.hinge = 'right';
    const row = summaryRows(p, 'en', new Date('2026-09-07')).find(([k]) => k === 'Door');
    expect(row).toBeTruthy();
    expect(row![1]).toContain('opens Outwards');
    expect(row![1]).toContain('hinge Right');
  });

  it('prints the summary in inches when the export asks for them', () => {
    const p = defaultProject();
    const rows = summaryRows(p, 'en', new Date('2026-09-07'), 'in');
    const room = rows.find(([k]) => k === 'Room W \u00d7 D \u00d7 H')![1];
    expect(room).toContain('94 1/2\u2033');   // 2400 mm
    expect(room).not.toContain('2400');
    const door = rows.find(([k]) => k === 'Door')![1];
    expect(door).toContain('31 1/2\u2033');   // 800 mm
    expect(rows.map(([, v]) => v).join(' ')).not.toContain('2500');
  });

  it('still prints the summary in millimetres by default', () => {
    const rows = summaryRows(defaultProject(), 'en', new Date('2026-09-07'));
    expect(rows.find(([k]) => k === 'Room W \u00d7 D \u00d7 H')![1]).toBe('2400 \u00d7 2000 \u00d7 2500');
  });

  it('builds an inch document without throwing', () => {
    expect(() => buildPdf(defaultProject(), { units: 'in' })).not.toThrow();
  });

  it('fits every cut-list heading inside its own column, in both languages and units', () => {
    // The size headings carry the unit ("Ширина, дюйм" is the longest of them); a heading that
    // outgrew its column used to print straight over the next one.
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    registerPdfFont(doc);
    doc.setFontSize(8);
    for (const lang of LANGS) {
      for (const units of UNITS) {
        const cols = cutListColumns(lang, units);
        cols.forEach(([name, x], i) => {
          const next = cols[i + 1]?.[1] ?? CUT_TABLE_MAX_X;
          expect(x + doc.getTextWidth(name), `${lang} ${units}: ${name}`).toBeLessThan(next);
        });
      }
    }
  });

  it('wraps every summary value clear of the 3D snapshot', () => {
    // The snapshot occupies the top-right block; a value line that reached it used to print
    // straight through the picture.
    for (const lang of LANGS) {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      registerPdfFont(doc);
      doc.setFontSize(10);
      for (const units of UNITS) {
        for (const [, value] of summaryRows(defaultProject(), lang, new Date('2026-09-07'), units)) {
          for (const line of doc.splitTextToSize(value, SUMMARY_VALUE_W) as string[]) {
            expect(SUMMARY_VALUE_X + doc.getTextWidth(line), `${lang} ${units}: ${line}`).toBeLessThan(SUMMARY_VALUE_MAX_X);
          }
        }
      }
    }
  });
});
