import { useState } from 'react';
import { Menu, MenuItem, Segmented } from './controls';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useStore } from '../store/store';
import { useT } from './useT';
import { useImportJson } from './useImportJson';
import { LANGS, type MessageKey } from '../i18n';

const MENU_WIDTH = 220;
const GITHUB_URL = 'https://github.com/bynov/wardrobe-planner';

/** The "⋯" menu: file import/export, language, keyboard shortcuts, source link. */
export function OverflowMenu({ onExportJson }: { onExportJson: () => void }) {
  const { lang, t } = useT();
  const setLang = useStore.getState().setLang;
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const importJson = useImportJson();

  return (
    <>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchor="right"
        width={MENU_WIDTH}
        trigger={
          <button type="button" className="icon" aria-label={t('ui.moreActions')} title={t('ui.moreActions')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            ⋯
          </button>
        }
      >
        <MenuItem onClick={() => { setOpen(false); importJson.open(); }}>{t('ui.importJson')}</MenuItem>
        <MenuItem onClick={() => { setOpen(false); onExportJson(); }}>{t('ui.exportJson')}</MenuItem>
        <div className="menu-row">
          <span className="meta">{t('ui.language')}</span>
          <Segmented
            size="sm"
            ariaLabel={t('ui.language')}
            value={lang}
            options={LANGS.map((l) => ({ value: l, label: t(`ui.lang.${l}` as MessageKey) }))}
            onChange={setLang}
          />
        </div>
        <MenuItem onClick={() => { setOpen(false); setHelp(true); }}>{t('ui.shortcuts')}</MenuItem>
        <a className="menu-item" role="menuitem" href={GITHUB_URL} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
          <span>{t('ui.sourceGithub')}</span>
        </a>
      </Menu>
      {/* outside the menu so it survives the menu closing */}
      <input {...importJson.inputProps} />
      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}
    </>
  );
}
