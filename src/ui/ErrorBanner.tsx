import { useState } from 'react';
import { tmDeep, type Lang } from '../i18n';
import type { Project, ValidationError, Wall } from '../model/types';
import { useStore, type Selection } from '../store/store';
import { useT } from './useT';

// `walls.<wall>[.segments.<segment>.<index>][...]` — the paths validate() emits.
const WALL_PATH = /^walls\.(back|right|front|left)(?:\.segments\.([01])\.(\d+))?/;

/** What an error's path points at, so clicking it can take the user there. */
export function errorTarget(p: Project, path: string): Partial<Selection> | null {
  const m = WALL_PATH.exec(path);
  if (!m) return null;
  const wall = m[1] as Wall;
  if (m[2] === undefined) return { wall, columnId: null, zoneId: null };
  const column = p.wardrobe.walls[wall].segments[Number(m[2]) as 0 | 1][Number(m[3])];
  return { wall, columnId: column?.id ?? null, zoneId: null };
}

/** One entry per distinct rendered text; repeats collapse into a ×N count. */
export function dedupeErrors(lang: Lang, errors: ValidationError[]): { text: string; path: string; count: number }[] {
  const out = new Map<string, { text: string; path: string; count: number }>();
  for (const e of errors) {
    const text = tmDeep(lang, e.message);
    const seen = out.get(text);
    if (seen) seen.count += 1;
    else out.set(text, { text, path: e.path, count: 1 });
  }
  return [...out.values()];
}

/** A long list pushed the whole inspector off-screen, so it collapses past this many entries. */
const MAX_ERRORS_SHOWN = 6;

/** The red card above the inspector: what is wrong, one clickable line per distinct problem. */
export function ErrorBanner() {
  const project = useStore((s) => s.project);
  const errors = useStore((s) => s.errors);
  const select = useStore((s) => s.select);
  const { lang, t } = useT();
  const [expanded, setExpanded] = useState(false);
  const all = dedupeErrors(lang, errors);
  if (all.length === 0) return null;
  const collapsible = all.length > MAX_ERRORS_SHOWN;
  const hidden = collapsible && !expanded ? all.length - MAX_ERRORS_SHOWN : 0;
  const shown = hidden > 0 ? all.slice(0, MAX_ERRORS_SHOWN) : all;
  return (
    <div className="errbanner" role="alert">
      <div className="errhead">{t('ui.issuesHeading', { n: errors.length })}</div>
      {shown.map((e) => {
        const target = errorTarget(project, e.path);
        return (
          <button key={e.text} disabled={!target} onClick={() => target && select(target)}>
            {e.text}
            {e.count > 1 && <span className="times"> ×{e.count}</span>}
          </button>
        );
      })}
      {collapsible && (
        <button className="toggle" onClick={() => setExpanded((v) => !v)}>
          {hidden > 0 ? t('ui.moreErrors', { n: hidden }) : t('ui.lessErrors')}
        </button>
      )}
    </div>
  );
}

