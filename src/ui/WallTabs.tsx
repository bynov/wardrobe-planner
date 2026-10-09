import { wallName } from '../drawing/views';
import type { Wall } from '../model/types';
import { useStore } from '../store/store';
import { PlanEditor } from './PlanEditor';
import { useT } from './useT';
import { wallStatus, wallStatusText } from './wallStatus';

/** The order of the tabs: the room as the spec reads it, not the clockwise `WALLS` order. */
export const WALL_TAB_ORDER: Wall[] = ['back', 'left', 'right', 'front'];

/** The plan thumbnail plus one tab per wall, each with its fill status. */
export function WallTabs() {
  const project = useStore((s) => s.project);
  const wall = useStore((s) => s.ui.selection.wall);
  const select = useStore((s) => s.select);
  const { lang, units } = useT();

  return (
    <div className="walltabs">
      <PlanEditor size="thumb" />
      {WALL_TAB_ORDER.map((w) => {
        const status = wallStatus(project, w);
        return (
          <button
            key={w}
            className={`walltab${w === wall ? ' on' : ''}`}
            aria-pressed={w === wall}
            onClick={() => select({ wall: w, columnId: null, zoneId: null })}
          >
            <span className="walltab-name">{wallName(lang, w)}</span>
            <span className={`mono meta${status.kind === 'over' ? ' danger' : ''}`}>{wallStatusText(status, lang, units)}</span>
          </button>
        );
      })}
    </div>
  );
}
