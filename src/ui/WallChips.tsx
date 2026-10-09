import { wallName } from '../drawing/views';
import { useStore } from '../store/store';
import { useT } from './useT';
import { wallStatus, wallStatusText } from './wallStatus';
import { WALL_TAB_ORDER } from './WallTabs';

/** The phone's wall switcher: one horizontally scrolling chip per wall, with its fill status. */
export function WallChips() {
  const project = useStore((s) => s.project);
  const wall = useStore((s) => s.ui.selection.wall);
  const select = useStore((s) => s.select);
  const { lang, units } = useT();

  return (
    <div className="wallchips">
      {WALL_TAB_ORDER.map((w) => {
        const status = wallStatus(project, w);
        return (
          <button
            key={w}
            type="button"
            className={`wallchip${w === wall ? ' on' : ''}`}
            aria-pressed={w === wall}
            onClick={() => select({ wall: w, columnId: null, zoneId: null })}
          >
            <span className="wallchip-name">{wallName(lang, w)}</span>
            <span className={`mono meta${status.kind === 'over' ? ' danger' : ''}`}>{wallStatusText(status, lang, units)}</span>
          </button>
        );
      })}
    </div>
  );
}
