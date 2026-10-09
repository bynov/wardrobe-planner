import { useState } from 'react';
import { Menu, MenuItem, Segmented } from './controls';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useStore } from '../store/store';
import { serializeProject } from '../store/persist';
import { downloadBlob } from './download';
import { useExport } from './useExport';
import { useT } from './useT';
import { useImportJson } from './useImportJson';
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery';
import { LANGS, type MessageKey } from '../i18n';
import { UNITS } from '../units';

const MENU_WIDTH = 220;
const GITHUB_URL = 'https://github.com/bynov/wardrobe-planner';

/**
 * The "⋯" menu: file import/export, language, keyboard shortcuts, source link. The phone header has
 * no room for the desktop top bar's Share, Redo and units toggle, so on a phone they live here too.
 */
export function OverflowMenu() {
  const { lang, units, t } = useT();
  const { setLang, setUnits, redo } = useStore.getState();
  const canRedo = useStore((s) => s.future.length > 0);
  const { share, disabled: hasErrors } = useExport();
  const phone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const importJson = useImportJson();
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const exportJson = () => {
    const project = useStore.getState().project;
    const safeName = (project.name || 'wardrobe').replace(/[^\w.-]+/g, '_');
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${safeName}.json`);
  };

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
        {phone && (
          <>
            <MenuItem disabled={hasErrors} meta={hasErrors ? t('ui.fixErrorsFirst') : undefined} onClick={run(() => void share())}>{t('ui.share')}</MenuItem>
            <MenuItem disabled={!canRedo} onClick={run(redo)}>{t('ui.redo')}</MenuItem>
            <div className="menu-sep" />
          </>
        )}
        <MenuItem onClick={run(importJson.open)}>{t('ui.importJson')}</MenuItem>
        <MenuItem onClick={run(exportJson)}>{t('ui.exportJson')}</MenuItem>
        {phone && (
          // display only: the project itself is always millimetres
          <div className="menu-row">
            <span className="meta">{t('ui.units')}</span>
            <Segmented
              size="sm"
              mono
              ariaLabel={t('ui.units')}
              value={units}
              options={UNITS.map((un) => ({ value: un, label: t(`ui.units.${un}` as MessageKey) }))}
              onChange={setUnits}
            />
          </div>
        )}
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
        <MenuItem onClick={run(() => setHelp(true))}>{t('ui.shortcuts')}</MenuItem>
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
