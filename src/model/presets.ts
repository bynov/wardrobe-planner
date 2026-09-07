import { makeGap, makeUnit, makeZone } from './factory';
import type { Column } from './types';

export type PresetKey = 'hanging' | 'doubleHanging' | 'shelves' | 'drawersHanging' | 'drawersShelves' | 'open' | 'gap';

export const PRESET_KEYS: PresetKey[] = [
  'hanging',
  'doubleHanging',
  'shelves',
  'drawersHanging',
  'drawersShelves',
  'open',
  'gap',
];

export const PRESET_DEFAULT_WIDTH = 600;
export const GAP_DEFAULT_WIDTH = 300;

const Z = makeZone;

export function makePreset(key: PresetKey, width: number): Column {
  switch (key) {
    case 'hanging':
      return makeUnit(width, [Z('hanging')]);
    case 'doubleHanging':
      return makeUnit(width, [Z('hanging'), Z('hanging')]);
    case 'shelves':
      return makeUnit(width, [Z('shelves', null, 6)]); // 6 compartments = 5 boards
    case 'drawersHanging':
      return makeUnit(width, [Z('drawers', 600, 3), Z('hanging')]);
    case 'drawersShelves':
      return makeUnit(width, [Z('drawers', 800, 4), Z('shelves', null, 4)]); // 4 compartments = 3 boards
    case 'open':
      return makeUnit(width, [Z('open')]);
    case 'gap':
      return makeGap(width);
  }
}
