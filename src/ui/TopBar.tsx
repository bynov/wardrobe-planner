import { useRef, useState } from 'react';
import { useStore, type Tab } from '../store/store';
import { parseErrorText, parseProjectShape, serializeProject } from '../store/persist';
import { exportPdfBlob } from '../pdf/exportPdf';
import { downloadBlob } from './download';
import { clearSnapshot, takeSnapshot } from './snapshot';
import { useT } from './useT';
import { LANGS, type MessageKey } from '../i18n';

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
  const { lang, t } = useT();
  const { setName, setUi, newProject, loadProject, toast, setLang, undo, redo } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const safeName = (project.name || 'wardrobe').replace(/[^\w.-]+/g, '_');

  const onNew = () => {
    if (!window.confirm(t('ui.confirmNew'))) return;
    // the cached 3D picture belongs to the project being replaced
    clearSnapshot();
    newProject();
  };
  const onExportJson = () => {
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${safeName}.json`);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    // A shape-valid file is always loaded, even when it fails validation: the design tab lists the
    // errors and the user fixes them there — rejecting the file outright left them nothing to edit.
    const r = parseProjectShape(await file.text());
    if (!r.ok) {
      toast({ key: 'toast.importFailed', params: { error: parseErrorText(lang, r) } });
      return;
    }
    clearSnapshot();
    loadProject(r.project);
    const n = useStore.getState().errors.length;
    toast(n ? { key: 'toast.importedWithErrors', params: { n } } : { key: 'toast.imported' });
  };
  const onExportPdf = async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 0)); // let the button repaint
      const blob = exportPdfBlob(lastValid, { lang, snapshotPng: takeSnapshot() });
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
      <span className="spacer" />
      <button onClick={undo} disabled={!canUndo}>{t('ui.undo')}</button>
      <button onClick={redo} disabled={!canRedo}>{t('ui.redo')}</button>
      <button onClick={onNew}>{t('ui.new')}</button>
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
        onClick={onExportPdf}
        disabled={busy || errorCount > 0}
        title={errorCount > 0 ? t('ui.fixErrorsFirst') : undefined}
      >
        {busy ? t('ui.exporting') : t('ui.exportPdf')}
      </button>
    </header>
  );
}
