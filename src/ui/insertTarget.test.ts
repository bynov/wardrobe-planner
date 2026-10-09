import { describe, expect, it } from 'vitest';
import { makeGap } from '../model/factory';
import { makeTemplate } from '../model/templates';
import { createPlannerStore } from '../store/store';
import { insertTarget } from './insertTarget';

const NONE = { wall: 'back', columnId: null, zoneId: null } as const;

describe('insertTarget', () => {
  it('prefers the armed slot over a selection', () => {
    const p = makeTemplate('lShape', 'x');
    const sel = { wall: 'back', columnId: p.wardrobe.walls.back.segments[0][0].id, zoneId: null } as const;
    const t = insertTarget(p, sel, { wall: 'back', segment: 0, index: 2 });
    expect(t).toMatchObject({ wall: 'back', segment: 0, index: 2, label: { kind: 'slot', n: 3 } });
  });

  it('goes after the selected column', () => {
    const p = makeTemplate('lShape', 'x');
    const col = p.wardrobe.walls.back.segments[0][1];
    const t = insertTarget(p, { wall: 'back', columnId: col.id, zoneId: null }, null);
    expect(t).toMatchObject({ segment: 0, index: 2, label: { kind: 'after', tagIndex: 1, isGap: false } });
  });

  it('counts the tag across both segments for a column in segment 1', () => {
    const s = createPlannerStore(makeTemplate('lShape', 'x'));
    const p0 = s.getState().project;
    const wall = p0.door.wall;
    s.getState().insertColumn(wall, 1, 0, makeGap(100));
    const p = s.getState().project;
    const col = p.wardrobe.walls[wall].segments[1][0];
    const t = insertTarget(p, { wall, columnId: col.id, zoneId: null }, null);
    expect(t).toMatchObject({ wall, segment: 1, index: 1, label: { kind: 'after', tagIndex: p.wardrobe.walls[wall].segments[0].length, isGap: true } });
  });

  it('appends to segment 0 when nothing is selected', () => {
    const p = makeTemplate('lShape', 'x');
    expect(insertTarget(p, NONE, null)).toEqual({ wall: 'back', segment: 0, index: p.wardrobe.walls.back.segments[0].length, label: { kind: 'end' } });
  });
});
