import { useState } from 'react';
import { useStore } from '../store/store';
import { encodeShare, shareUrl } from '../store/share';
import { exportPdfBlob } from '../pdf/exportPdf';
import { downloadBlob } from './download';
import { takeSnapshot } from './three/offscreenSnapshot';
import { useT } from './useT';

/**
 * Share-link and PDF export, shared by the desktop top bar and the phone bottom nav. Both work from
 * `lastValid`, so `disabled` is true while the project has errors.
 */
export function useExport() {
  const project = useStore((s) => s.project);
  const lastValid = useStore((s) => s.lastValid);
  const disabled = useStore((s) => s.errors.length > 0);
  const { lang, units, t } = useT();
  const [busy, setBusy] = useState(false);
  const { toast } = useStore.getState();
  const safeName = (project.name || 'wardrobe').replace(/[^\w.-]+/g, '_');

  const share = async () => {
    let url: string;
    try {
      url = shareUrl(window.location, await encodeShare(project));
    } catch (e) {
      // Compression or encoding gave way: say so rather than let the rejection vanish.
      toast({ key: 'toast.shareFailed', params: { error: e instanceof Error ? e.message : String(e) } });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ key: 'toast.linkCopied' });
    } catch {
      // No clipboard: an insecure origin, or the browser refused. Show the link to copy by hand.
      window.prompt(t('ui.share'), url);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 0)); // let the button repaint
      // Off-screen render when nothing is cached, so an export made without ever opening the 3D
      // tab still carries the picture.
      const snapshotPng = await takeSnapshot(lastValid);
      const blob = exportPdfBlob(lastValid, { lang, units, snapshotPng });
      downloadBlob(blob, `${safeName}.pdf`);
    } catch (e) {
      toast({ key: 'toast.pdfFailed', params: { error: e instanceof Error ? e.message : String(e) } });
    } finally {
      setBusy(false);
    }
  };

  return { share, exportPdf, busy, disabled };
}
