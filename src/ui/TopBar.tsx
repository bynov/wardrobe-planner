import { useState } from 'react';
import { useStore, type Tab } from '../store/store';
import { parseErrorText, parseProjectShape, serializeProject } from '../store/persist';
import { encodeShare, shareUrl } from '../store/share';
import { exportPdfBlob } from '../pdf/exportPdf';
import { downloadBlob } from './download';
import { clearSnapshot } from './snapshot';
import { takeSnapshot } from './three/offscreenSnapshot';
import { ProjectsMenu } from './ProjectsMenu';
import { useT } from './useT';
import type { MessageKey } from '../i18n';
import { UNITS } from '../units';
import { IconButton, Segmented } from './controls';
import { Logo } from './Logo';
import { OverflowMenu } from './OverflowMenu';
import { nextTheme } from './theme';

const MODES: { key: Tab; labelKey: MessageKey }[] = [
  { key: 'setup', labelKey: 'ui.mode.setup' },
  { key: 'design', labelKey: 'ui.tab.design' },
  { key: '3d', labelKey: 'ui.tab.3d' },
  { key: 'cutlist', labelKey: 'ui.tab.cutlist' },
];

export function TopBar() {
  const project = useStore((s) => s.project);
  const lastValid = useStore((s) => s.lastValid);
  const tab = useStore((s) => s.ui.tab);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const errorCount = useStore((s) => s.errors.length);
  const { lang, units, t } = useT();
  const theme = useStore((s) => s.ui.theme);
  const { setUi, createProject, toast, setUnits, setTheme, undo, redo } = useStore.getState();
  const [busy, setBusy] = useState(false);
  const safeName = (project.name || 'wardrobe').replace(/[^\w.-]+/g, '_');

  const onExportJson = () => {
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${safeName}.json`);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    // A shape-valid file is always loaded, even when it fails validation: the design tab lists the
    // errors and the user fixes them there — rejecting the file outright left them nothing to edit.
    // It lands as a new project: overwriting the open one would let autosave bury it.
    const r = parseProjectShape(await file.text());
    if (!r.ok) {
      toast({ key: 'toast.importFailed', params: { error: parseErrorText(lang, r) } });
      return;
    }
    clearSnapshot();
    createProject(r.project);
    const n = useStore.getState().errors.length;
    toast(n ? { key: 'toast.importedWithErrors', params: { n } } : { key: 'toast.imported' });
  };
  const onShare = async () => {
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
  const onExportPdf = async () => {
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

  const fixTitle = errorCount > 0 ? t('ui.fixErrorsFirst') : undefined;

  return (
    <header className="topbar">
      <Logo />
      <ProjectsMenu />
      <span className="spacer" />
      <Segmented
        size="md"
        ariaLabel={t('ui.modes')}
        value={tab}
        options={MODES.map((m) => ({ value: m.key, label: t(m.labelKey) }))}
        onChange={(k) => setUi({ tab: k })}
      />
      <span className="spacer" />
      <IconButton label={t('ui.undo')} onClick={undo} disabled={!canUndo}>↶</IconButton>
      <IconButton label={t('ui.redo')} onClick={redo} disabled={!canRedo}>↷</IconButton>
      <span className="divider" />
      {/* display only: the project itself is always millimetres */}
      <Segmented
        size="sm"
        mono
        ariaLabel={t('ui.units')}
        value={units}
        options={UNITS.map((un) => ({ value: un, label: t(`ui.units.${un}` as MessageKey) }))}
        onChange={setUnits}
      />
      <button type="button" className="btn ghost theme" title={t('ui.themeToggle')} onClick={() => setTheme(nextTheme(theme))}>
        <span className="theme-glyph" aria-hidden />
        {t(`ui.theme.${theme}` as MessageKey)}
      </button>
      <span className="divider" />
      <button type="button" className="btn" onClick={() => void onShare()} disabled={errorCount > 0} title={fixTitle}>
        {t('ui.share')}
      </button>
      <button type="button" className="btn primary" onClick={onExportPdf} disabled={busy || errorCount > 0} title={fixTitle}>
        {busy ? t('ui.exporting') : t('ui.exportPdf')}
      </button>
      <OverflowMenu onImport={(f) => void onImport(f)} onExportJson={onExportJson} />
    </header>
  );
}
