import type { Project, Wall } from '../model/types';
import { findColumn, type InsertSlot, type Selection } from '../store/store';

export type InsertLabel =
  | { kind: 'slot'; n: number }
  | { kind: 'after'; tagIndex: number; isGap: boolean }
  | { kind: 'end' };

export interface InsertTarget {
  wall: Wall;
  segment: 0 | 1;
  index: number;
  label: InsertLabel;
}

/**
 * Where the next preset lands: the armed slot, else right after the selected column, else the end
 * of the wall's first segment. `tagIndex` is the column's position across both segments (as in B4).
 */
export function insertTarget(project: Project, selection: Selection, insertAt: InsertSlot | null): InsertTarget {
  if (insertAt) return { ...insertAt, label: { kind: 'slot', n: insertAt.index + 1 } };
  const ref = selection.columnId ? findColumn(project, selection.columnId) : null;
  if (ref) {
    const first = project.wardrobe.walls[ref.wall].segments[0].length;
    return {
      wall: ref.wall,
      segment: ref.segment,
      index: ref.index + 1,
      label: { kind: 'after', tagIndex: (ref.segment === 1 ? first : 0) + ref.index, isGap: ref.column.kind === 'gap' },
    };
  }
  return { wall: selection.wall, segment: 0, index: project.wardrobe.walls[selection.wall].segments[0].length, label: { kind: 'end' } };
}
