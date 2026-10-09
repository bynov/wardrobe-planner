import { useStore, type Tab } from '../store/store';
import type { MessageKey } from '../i18n';
import { useExport } from './useExport';
import { useT } from './useT';

const TABS: { key: Exclude<Tab, 'setup'>; labelKey: MessageKey }[] = [
  { key: 'design', labelKey: 'ui.tab.design' },
  { key: '3d', labelKey: 'ui.tab.3d' },
  { key: 'cutlist', labelKey: 'ui.tab.cutlist' },
];

/** The phone's bottom navigation: three modes and the PDF export. Room mode lives in the projects sheet. */
export function MobileNav() {
  const tab = useStore((s) => s.ui.tab);
  const setUi = useStore((s) => s.setUi);
  const { exportPdf, busy, disabled } = useExport();
  const { t } = useT();

  return (
    <nav className="mnav" aria-label={t('ui.modes')}>
      {TABS.map((m) => (
        <button key={m.key} type="button" className={`mnav-btn${tab === m.key ? ' on' : ''}`} aria-current={tab === m.key ? 'page' : undefined} onClick={() => setUi({ tab: m.key })}>
          <span className="mnav-icon" aria-hidden="true" />
          {t(m.labelKey)}
        </button>
      ))}
      <button type="button" className="mnav-btn" disabled={busy || disabled} title={disabled ? t('ui.fixErrorsFirst') : undefined} onClick={() => void exportPdf()}>
        <span className="mnav-icon" aria-hidden="true" />
        {busy ? t('ui.exporting') : t('ui.exportPdf')}
      </button>
    </nav>
  );
}
