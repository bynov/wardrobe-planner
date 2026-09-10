import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { TEMPLATE_KEYS, makeTemplate } from '../model/templates';
import { clearSnapshot } from './snapshot';
import { useT } from './useT';
import type { MessageKey, Params } from '../i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

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
 * The project switcher: every project stored in this browser, newest first, plus the actions that
 * make and remove them. The cached 3D picture belongs to the project being left, so each action
 * drops it before the store swaps the project (the store itself stays DOM-free).
 */
export function ProjectsMenu() {
  const projects = useStore((s) => s.projects);
  const projectId = useStore((s) => s.ui.projectId);
  const name = useStore((s) => s.project.name);
  const { t } = useT();
  const { switchProject, newProject, createProject, duplicateProject, deleteProject } = useStore.getState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Closing the menu is all this Escape does: `useKeyboard` (on window) must not also clear
      // the selection underneath.
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
    <div className="projects" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}>{t('ui.projects')} ▾</button>
      {open && (
        <div className="menu">
          <div className="title">{t('ui.projects')}</div>
          {projects.map((m) => (
            <button
              key={m.id}
              className={m.id === projectId ? 'active' : ''}
              onClick={() => act(() => switchProject(m.id))}
            >
              <span>{m.name || t('ui.projectName')}</span>
              <span className="derived">{relativeTime(now, m.updatedAt, t)}</span>
            </button>
          ))}
          <div className="sep" />
          <button onClick={() => act(newProject)}>{t('ui.newBlank')}</button>
          <div className="title">{t('ui.newFromTemplate')}</div>
          {TEMPLATE_KEYS.map((key) => {
            const name = t(`template.${key}`);
            return (
              <button key={key} onClick={() => act(() => createProject(makeTemplate(key, name)))}>
                <span>{name}</span>
              </button>
            );
          })}
          <div className="sep" />
          <button onClick={() => act(() => duplicateProject(projectId))}>{t('ui.duplicateProject')}</button>
          <button onClick={onDelete}>{t('ui.deleteProject')}</button>
        </div>
      )}
    </div>
  );
}
