import { leftOf, rightOf } from '../geometry/frames';
import { msg } from '../i18n';
import type { Wall } from '../model/types';
import { useStore } from '../store/store';

/** How many `error.segmentOverflow` errors currently name one of `walls`. */
const overflowsOn = (errors: { message: { key: string; params?: Record<string, string | number> } }[], walls: Wall[]): number =>
  errors.filter((e) => e.message.key === 'error.segmentOverflow' && walls.some((w) => e.message.params?.wall === `wall.${w}`)).length;

/**
 * Turns a wall's wardrobe on or off; shared by the elevation's empty state and the tray's switch.
 *
 * Enabling a wall makes it claim the corners, which shortens both side walls' usable runs —
 * their existing units can end up overflowing without the user touching them. Say so.
 * Disabling one leaves its columns in the project but out of reach, so a selection on that wall
 * is dropped (the store already drops an insert slot on a disabled wall).
 */
export function useToggleWall(): (wall: Wall, enabled: boolean) => void {
  return (wall, enabled) => {
    const s = useStore.getState();
    const neighbours = [leftOf(wall), rightOf(wall)];
    const before = overflowsOn(s.errors, neighbours);
    s.setWall(wall, { enabled });
    if (!enabled) {
      const sel = useStore.getState().ui.selection;
      if (sel.wall === wall && (sel.columnId || sel.zoneId)) useStore.getState().select({ columnId: null, zoneId: null });
      return;
    }
    if (overflowsOn(useStore.getState().errors, neighbours) > before) {
      useStore.getState().toast(msg('toast.neighbourOverflow', { wall: `wall.${wall}` }));
    }
  };
}
