import { describe, expect, it } from 'vitest';
import { ZONE_TYPES } from '../model/types';
import { DEFAULT_COUNT, nextZonePatch, widthRange } from './zonePatch';

describe('nextZonePatch', () => {
  it('resets the count to the new type default', () => {
    expect(nextZonePatch('drawers')).toEqual({ type: 'drawers', count: 3 });
    expect(nextZonePatch('shoes')).toEqual({ type: 'shoes', count: 5 });
  });
  it('has a default for every zone type', () => {
    for (const t of ZONE_TYPES) expect(DEFAULT_COUNT[t]).toBeGreaterThanOrEqual(1);
  });
});

describe('widthRange', () => {
  it('lets a unit grow into the free space and shrink to the minimum unit width', () => {
    expect(widthRange({ kind: 'unit', width: 600 }, 150, 300)).toEqual({ min: 300, max: 750 });
  });
  it('lets a gap shrink to 1', () => {
    expect(widthRange({ kind: 'gap', width: 400 }, 0, 300)).toEqual({ min: 1, max: 400 });
  });
});
