import type React from 'react';
import { useStore, type Tab } from '../store/store';
import type { MessageKey } from '../i18n';
import { useExport } from './useExport';
import { useT } from './useT';

const TABS: { key: Exclude<Tab, 'setup'>; labelKey: MessageKey }[] = [
  { key: 'design', labelKey: 'ui.tab.design' },
  { key: '3d', labelKey: 'ui.tab.3d' },
  { key: 'cutlist', labelKey: 'ui.tab.cutlist' },
];

const svg = (d: React.ReactNode) => (
  <svg className="mnav-icon" viewBox="0 0 22 22" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{d}</svg>
);
const ICONS = {
  design: svg(<><rect x="2.5" y="3" width="17" height="16" rx="2" /><path d="M8.2 3v16M13.8 3v16" /></>),
  '3d': svg(<><path d="M11 2.5l8 4.5v8.5l-8 4.5-8-4.5V7z" /><path d="M3 7l8 4.5L19 7M11 11.5V20" /></>),
  cutlist: svg(<><path d="M7 5.5h12M7 11h12M7 16.5h12" /><path d="M3 5.5h.5M3 11h.5M3 16.5h.5" /></>),
  export: svg(<><path d="M11 3v11M6.5 9.5L11 14l4.5-4.5M3.5 18.5h15" /></>),
};

/** The phone's bottom navigation: three modes and the PDF export. Room mode lives in the projects sheet. */
export function MobileNav() {
  const tab = useStore((s) => s.ui.tab);
  const setUi = useStore((s) => s.setUi);
  const { exportPdf, busy, disabled } = useExport();
  const { t } = useT();

  return (
    <nav className="mnav" aria-label={t('ui.modes')}>
      {TABS.map((m) => (
        <button key={m.key} type="button" className={`mnav-btn${tab === m.key ? ' on' : ''}`} aria-current={tab === m.key ? 'page' : undefined} onClick={() => setUi({ tab: m.key, sheetOpen: false, sheetView: 'inspector' })}>
          {ICONS[m.key]}
          {t(m.labelKey)}
        </button>
      ))}
      <button type="button" className="mnav-btn" disabled={busy || disabled} title={disabled ? t('ui.fixErrorsFirst') : undefined} onClick={() => void exportPdf()}>
        {ICONS.export}
        {busy ? t('ui.exporting') : t('ui.exportPdf')}
      </button>
    </nav>
  );
}
