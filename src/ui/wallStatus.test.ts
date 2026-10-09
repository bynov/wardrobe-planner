import { describe, expect, it } from 'vitest';
import { minUnitWidth, segmentFree, wallSegments } from '../geometry/frames';
import { makeGap } from '../model/factory';
import { makeTemplate } from '../model/templates';
import { createPlannerStore } from '../store/store';
import type { Project, Wall } from '../model/types';
import { wallStatus, wallStatusText } from './wallStatus';

const free = (p: Project, wall: Wall) => wallSegments(p, wall).reduce((s, seg) => s + segmentFree(p, seg), 0);

describe('wallStatus', () => {
  it('reports a populated wall with room left as free', () => {
    const s = wallStatus(makeTemplate('lShape', 'x'), 'back');
    expect(s.kind).toBe('free');
    if (s.kind === 'free') expect(s.units).toBeGreaterThan(0);
  });

  it('reports a disabled wall as off', () => {
    const p = makeTemplate('lShape', 'x');
    const off = (['back', 'left', 'right', 'front'] as Wall[]).find((w) => !p.wardrobe.walls[w].enabled);
    expect(off).toBeDefined();
    expect(wallStatus(p, off!)).toEqual({ kind: 'off' });
  });

  it('reports full once less than a unit is left, and over when columns overflow', () => {
    const s = createPlannerStore(makeTemplate('lShape', 'x'));
    const p0 = s.getState().project;
    const room = free(p0, 'back');
    // Fill the leftover with a gap so nothing fits any more.
    s.getState().insertColumn('back', 0, 0, makeGap(room - minUnitWidth(p0.wardrobe) + 1));
    const full = wallStatus(s.getState().project, 'back');
    expect(full.kind).toBe('full');
    expect(free(s.getState().project, 'back')).toBeLessThan(minUnitWidth(p0.wardrobe));

    const first = s.getState().project.wardrobe.walls.back.segments[0].find((c) => c.kind === 'unit')!;
    s.getState().updateColumn(first.id, { width: 9999 });
    const over = wallStatus(s.getState().project, 'back');
    expect(over.kind).toBe('over');
    if (over.kind === 'over') expect(over.over).toBeGreaterThan(0);
  });

  it('renders text in both languages with lengths', () => {
    expect(wallStatusText({ kind: 'off' }, 'en', 'mm')).toBe('off');
    expect(wallStatusText({ kind: 'full', units: 5 }, 'en', 'mm')).toBe('5 units · full');
    expect(wallStatusText({ kind: 'free', units: 2, free: 600 }, 'en', 'mm')).toContain('600');
    expect(wallStatusText({ kind: 'over', units: 2, over: 50 }, 'ru', 'mm')).toContain('перебор');
  });
});
