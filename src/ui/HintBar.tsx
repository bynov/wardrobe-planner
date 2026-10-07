import { useState } from 'react';
import { HINT_KEY } from '../store/projects';
import { useStore } from '../store/store';
import { useT } from './useT';

const STEPS = ['ui.hint.step1', 'ui.hint.step2', 'ui.hint.step3'] as const;

/** Storage can be disabled outright, in which case the hint simply shows every time. */
const wasDismissed = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem(HINT_KEY);
  } catch {
    return false;
  }
};

const remember = (): void => {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    // best-effort: the hint comes back next time, which is better than losing the app
  }
};

/**
 * The three steps that get a first-time visitor from the starter template to their own design.
 * It shows on a first run only, goes for good once dismissed, and steps aside as soon as the user
 * has actually edited something (`past` is non-empty) — whichever comes first.
 */
export function HintBar() {
  const firstRun = useStore((s) => s.ui.firstRun);
  const edited = useStore((s) => s.past.length > 0);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const { t } = useT();

  if (!firstRun || edited || dismissed) return null;
  return (
    <div className="hintbar">
      <ol>
        {STEPS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
      <button
        onClick={() => {
          remember();
          setDismissed(true);
        }}
      >
        {t('ui.hint.dismiss')}
      </button>
    </div>
  );
}
