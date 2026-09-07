import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  buildPdf, exportPdfBlob, summaryRows, ROWS_PER_PAGE,
  SUMMARY_VALUE_MAX_X, SUMMARY_VALUE_W, SUMMARY_VALUE_X,
} from './exportPdf';
import { registerPdfFont } from './font';
import { LANGS } from '../i18n';
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

  it('wraps every summary value clear of the 3D snapshot', () => {
    // The snapshot occupies the top-right block; a value line that reached it used to print
    // straight through the picture.
    for (const lang of LANGS) {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      registerPdfFont(doc);
      doc.setFontSize(10);
      for (const [, value] of summaryRows(defaultProject(), lang, new Date('2026-09-07'))) {
        for (const line of doc.splitTextToSize(value, SUMMARY_VALUE_W) as string[]) {
          expect(SUMMARY_VALUE_X + doc.getTextWidth(line), `${lang}: ${line}`).toBeLessThan(SUMMARY_VALUE_MAX_X);
        }
      }
    }
  });
});
