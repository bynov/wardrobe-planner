import { useStore, type Tab } from '../store/store';
import { serializeProject } from '../store/persist';
import { downloadBlob } from './download';
import { useExport } from './useExport';
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
  const tab = useStore((s) => s.ui.tab);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const errorCount = useStore((s) => s.errors.length);
  const { lang, units, t } = useT();
  const theme = useStore((s) => s.ui.theme);
  const { setUi, setUnits, setTheme, undo, redo } = useStore.getState();
  const { share, exportPdf, busy } = useExport();
  const safeName = (project.name || 'wardrobe').replace(/[^\w.-]+/g, '_');

  const onExportJson = () => {
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${safeName}.json`);
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
      <button type="button" className="btn" onClick={() => void share()} disabled={errorCount > 0} title={fixTitle}>
        {t('ui.share')}
      </button>
      <button type="button" className="btn primary" onClick={() => void exportPdf()} disabled={busy || errorCount > 0} title={fixTitle}>
        {busy ? t('ui.exporting') : t('ui.exportPdf')}
      </button>
      <OverflowMenu onExportJson={onExportJson} />
    </header>
  );
}
