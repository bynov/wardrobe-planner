import { useEffect } from 'react';
import { segmentFree, wallSegments } from '../geometry/frames';
import { findColumn, useStore } from '../store/store';

const isTyping = (el: EventTarget | null): boolean => {
  const t = el as HTMLElement | null;
  if (!t || !t.tagName) return false;
  const tag = t.tagName.toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea' || t.isContentEditable === true;
};

/** Global editing shortcuts for the design tab. */
export function useKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = useStore.getState();
      const { columnId, zoneId } = s.ui.selection;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && key === 'd') {
        // Duplicate the selected column, but only when its own segment still has room for it.
        // With nothing selected there is nothing to duplicate, so leave the browser's own
        // Cmd/Ctrl+D (add bookmark) alone rather than swallowing it for no effect.
        const ref = columnId ? findColumn(s.project, columnId) : null;
        if (!ref) return;
        e.preventDefault();
        const seg = wallSegments(s.project, ref.wall)[ref.segment];
        if (seg && segmentFree(s.project, seg) >= ref.column.width) s.duplicateColumn(ref.column.id);
        return;
      }
      if (mod) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        s.select({ columnId: null, zoneId: null });
        return;
      }
      // Delete follows the highlight: a drilled-down zone selection deletes that zone (never the
      // last one of a unit — an empty unit is a validation error with no way back), and a plain
      // unit selection deletes the unit.
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!columnId) return;
        e.preventDefault();
        if (!zoneId) {
          s.removeColumn(columnId);
          return;
        }
        const ref = findColumn(s.project, columnId);
        const unit = ref?.column.kind === 'unit' ? ref.column : null;
        if (!unit || unit.zones.length <= 1) return;
        s.removeZone(columnId, zoneId);
        s.select({ zoneId: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
