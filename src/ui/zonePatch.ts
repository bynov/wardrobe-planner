import type { Column, Zone, ZoneType } from '../model/types';

/** What a freshly switched zone type starts with: shelves = compartments, drawers = fronts, shoes = boards. */
export const DEFAULT_COUNT: Record<ZoneType, number> = { open: 1, shelves: 4, drawers: 3, hanging: 1, shoes: 5 };

/** Switching a zone's type also resets its count, since the old number means something else now. */
export function nextZonePatch(_zone: Zone, type: ZoneType): Partial<Zone> {
  return { type, count: DEFAULT_COUNT[type] };
}

/** The bounds of the width stepper: a column can grow into the segment's free space, units keep a minimum width. */
export function widthRange(column: Pick<Column, 'kind' | 'width'>, free: number, minUnitWidth: number): { min: number; max: number } {
  return { min: column.kind === 'unit' ? minUnitWidth : 1, max: column.width + free };
}

/** Upper bound for the length steppers (zone height, rail offset and height), mm; the layout clamps what is physically possible. */
export const LENGTH_MAX = 5000;
/** Upper bound for the compartment / drawer / board count stepper. */
export const COUNT_MAX = 99;
