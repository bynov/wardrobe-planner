import { useState } from 'react';
import { useStore } from '../store/store';
import { Menu, MenuItem } from './controls';
import { clearSnapshot } from './snapshot';
import { useT } from './useT';
import type { MessageKey, Params } from '../i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MENU_WIDTH = 280;

type Translate = (key: MessageKey, params?: Params) => string;

/** Coarse "when was this saved" for the project list: minutes, then hours, then whole days. */
export function relativeTime(now: number, updatedAt: number, t: Translate): string {
  const d = Math.max(0, now - updatedAt);
  if (d < MINUTE) return t('ui.justNow');
  if (d < HOUR) return t('ui.minutesAgo', { n: Math.floor(d / MINUTE) });
  if (d < DAY) return t('ui.hoursAgo', { n: Math.floor(d / HOUR) });
  return t('ui.daysAgo', { n: Math.floor(d / DAY) });
}

/**
 * The project switcher: the open project's name and "saved" line as the trigger, and in the menu
 * the rename field, every project stored in this browser (newest first) and the actions that make
 * and remove them. The cached 3D picture belongs to the project being left, so each action drops
 * it before the store swaps the project (the store itself stays DOM-free).
 */
export function ProjectsMenu() {
  const projects = useStore((s) => s.projects);
  const projectId = useStore((s) => s.ui.projectId);
  const name = useStore((s) => s.project.name);
  const { t } = useT();
  const { switchProject, newProject, duplicateProject, deleteProject, setName, setUi } = useStore.getState();
  const [open, setOpen] = useState(false);

  const act = (fn: () => void) => {
    clearSnapshot();
    fn();
    setOpen(false);
  };
  const onDelete = () => {
    if (!window.confirm(t('ui.confirmDelete', { name }))) return;
    act(() => deleteProject(projectId));
  };

  const now = Date.now();

  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      width={MENU_WIDTH}
      trigger={
        <button type="button" className="proj" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="proj-name">{name || t('ui.projectName')} <span className="proj-caret">▼</span></span>
          <span className="proj-sub">{t('ui.savedLocally')}</span>
        </button>
      }
    >
      <input
        className="menu-rename"
        value={name}
        aria-label={t('ui.rename')}
        placeholder={t('ui.projectName')}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="menu-sep" />
      {projects.map((m) => (
        <MenuItem
          key={m.id}
          active={m.id === projectId}
          meta={relativeTime(now, m.updatedAt, t)}
          onClick={() => act(() => switchProject(m.id))}
        >
          {m.name || t('ui.projectName')}
        </MenuItem>
      ))}
      <div className="menu-sep" />
      <MenuItem onClick={() => act(() => { newProject(); setUi({ tab: 'setup' }); })}>{t('ui.newProject')}</MenuItem>
      <MenuItem onClick={() => act(() => duplicateProject(projectId))}>{t('ui.duplicateProject')}</MenuItem>
      <MenuItem danger onClick={onDelete}>{t('ui.deleteProject')}</MenuItem>
    </Menu>
  );
}
