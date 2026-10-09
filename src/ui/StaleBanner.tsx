import { useStore } from '../store/store';
import { useT } from './useT';

/**
 * The 3D view and the cut list are built from `lastValid`, so while the project has validation
 * errors they show something the design tab no longer matches. Say so above them.
 */
export function StaleBanner() {
  const n = useStore((s) => s.errors.length);
  const { t } = useT();
  return n > 0 ? <div className="stale">{t('ui.showingLastValid', { n })}</div> : null;
}
