import { useRef, useState } from 'react';
import { useStore, type Tab } from '../store/store';
import { parseErrorText, parseProjectShape, serializeProject } from '../store/persist';
import { encodeShare, shareUrl } from '../store/share';
import { exportPdfBlob } from '../pdf/exportPdf';
import { downloadBlob } from './download';
import { clearSnapshot } from './snapshot';
import { takeSnapshot } from './three/offscreenSnapshot';
import { ProjectsMenu } from './ProjectsMenu';
import { useT } from './useT';
import { LANGS, type MessageKey } from '../i18n';
import { UNITS } from '../units';

const TABS: { key: Tab; labelKey: MessageKey }[] = [
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
  const { setName, setUi, createProject, toast, setLang, setUnits, undo, redo } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
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

  return (
    <header className="topbar">
      <input className="name" value={project.name} onChange={(e) => setName(e.target.value)} placeholder={t('ui.projectName')} />
      <nav className="tabs">
        {TABS.map((tb) => (
          <button key={tb.key} className={tb.key === tab ? 'active' : ''} onClick={() => setUi({ tab: tb.key })}>
            {t(tb.labelKey)}
          </button>
        ))}
      </nav>
      <nav className="tabs lang">
        {LANGS.map((l) => (
          <button key={l} className={l === lang ? 'active' : ''} onClick={() => setLang(l)}>{t(`ui.lang.${l}` as MessageKey)}</button>
        ))}
      </nav>
      {/* display only: the project itself is always millimetres */}
      <nav className="tabs units">
        {UNITS.map((un) => (
          <button key={un} className={un === units ? 'active' : ''} onClick={() => setUnits(un)}>{t(`ui.units.${un}` as MessageKey)}</button>
        ))}
      </nav>
      <span className="spacer" />
      {/* below 600px the secondary actions fold away behind this toggle; CSS shows/hides both */}
      <button
        className="more"
        aria-expanded={actionsOpen}
        aria-controls="topbar-actions"
        title={t('ui.moreActions')}
        aria-label={t('ui.moreActions')}
        onClick={() => setActionsOpen((v) => !v)}
      >
        ⋯
      </button>
      <div id="topbar-actions" className={actionsOpen ? 'actions open' : 'actions'}>
        <button onClick={undo} disabled={!canUndo}>{t('ui.undo')}</button>
        <button onClick={redo} disabled={!canRedo}>{t('ui.redo')}</button>
        <ProjectsMenu />
        <button onClick={() => fileRef.current?.click()}>{t('ui.importJson')}</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button onClick={onExportJson}>{t('ui.exportJson')}</button>
        <button
          onClick={() => void onShare()}
          disabled={errorCount > 0}
          title={errorCount > 0 ? t('ui.fixErrorsFirst') : undefined}
        >
          {t('ui.share')}
        </button>
        <button
          onClick={onExportPdf}
          disabled={busy || errorCount > 0}
          title={errorCount > 0 ? t('ui.fixErrorsFirst') : undefined}
        >
          {busy ? t('ui.exporting') : t('ui.exportPdf')}
        </button>
      </div>
    </header>
  );
}
