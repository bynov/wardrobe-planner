import type { jsPDF } from 'jspdf';
import { PTSANS_REGULAR_BASE64 } from './fonts/ptsans';

export const PDF_FONT = 'PTSans';

/** Embed PT Sans (Cyrillic + Latin) and make it the current font. */
export function registerPdfFont(doc: jsPDF): void {
  doc.addFileToVFS('PT_Sans-Web-Regular.ttf', PTSANS_REGULAR_BASE64);
  doc.addFont('PT_Sans-Web-Regular.ttf', PDF_FONT, 'normal');
  doc.setFont(PDF_FONT, 'normal');
}
