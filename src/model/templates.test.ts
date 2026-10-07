import { describe, expect, it } from 'vitest';
import { segmentFree, wallSegments, WALLS } from '../geometry/frames';
import { minUnitWidth } from '../geometry/frames';
import { LSHAPE_SPARE, TEMPLATE_KEYS, isTemplateKey, makeTemplate, type TemplateKey } from './templates';
import type { Wall } from './types';
import { validate } from './validate';

/** The spec table: the room each template starts from, and the runs it puts on which walls. */
const SPEC: Record<
  TemplateKey,
  { room: { width: number; depth: number; height: number }; runs: Partial<Record<Wall, number>>; free: Partial<Record<Wall, number>> }
> = {
  oneWall: { room: { width: 3000, depth: 1800, height: 2500 }, runs: { back: 5 }, free: {} },
  // The L-shape is the starter project, so its back wall keeps room for one more unit: the
  // first-run hint tells the user to press + in the elevation, and every + must offer something.
  lShape: { room: { width: 2500, depth: 2000, height: 2500 }, runs: { back: 3, left: 2 }, free: { back: LSHAPE_SPARE } },
  uShape: { room: { width: 3000, depth: 2500, height: 2500 }, runs: { back: 5, left: 3, right: 3 }, free: {} },
};

describe('templates', () => {
  it('lists exactly the three keys and recognises them', () => {
    expect(TEMPLATE_KEYS).toEqual(['oneWall', 'lShape', 'uShape']);
    expect(TEMPLATE_KEYS.every(isTemplateKey)).toBe(true);
    expect(isTemplateKey('shoes')).toBe(false);
    expect(isTemplateKey('')).toBe(false);
  });

  it.each(TEMPLATE_KEYS)('%s validates clean', (key) => {
    expect(validate(makeTemplate(key, 'x'))).toEqual([]);
  });

  it.each(TEMPLATE_KEYS)('%s takes the given name', (key) => {
    expect(makeTemplate(key, 'Мой шкаф').name).toBe('Мой шкаф');
  });

  it.each(TEMPLATE_KEYS)('%s has the room and the runs from the spec table', (key) => {
    const p = makeTemplate(key, 'x');
    const spec = SPEC[key];
    expect(p.room).toEqual(spec.room);
    expect(p.door.wall).toBe('front'); // the door never sits on a wall a template puts a run on
    for (const wall of WALLS) {
      const plan = p.wardrobe.walls[wall];
      const want = spec.runs[wall];
      expect(plan.enabled, wall).toBe(want !== undefined);
      expect(plan.segments[0].length, wall).toBe(want ?? 0);
      expect(plan.segments[1], wall).toEqual([]);
    }
  });

  it.each(TEMPLATE_KEYS)('%s leaves exactly the free space the table gives it, corner claims included', (key) => {
    const p = makeTemplate(key, 'x');
    for (const wall of WALLS) {
      if (!p.wardrobe.walls[wall].enabled) continue;
      const want = SPEC[key].free[wall] ?? 0;
      for (const seg of wallSegments(p, wall)) expect(segmentFree(p, seg), `${key}/${wall}`).toBe(want);
    }
  });

  it('leaves the starter template somewhere to put the next unit', () => {
    // Hint step 2 is "press + in the elevation to add a unit"; a template with no room anywhere
    // would offer nothing but greyed-out presets.
    const p = makeTemplate('lShape', 'x');
    const free = wallSegments(p, 'back').map((seg) => segmentFree(p, seg));
    expect(free).toEqual([LSHAPE_SPARE]);
    expect(LSHAPE_SPARE).toBeGreaterThanOrEqual(minUnitWidth(p.wardrobe));
    // and it is at the right-hand end of the wall, past the last column
    const used = p.wardrobe.walls.back.segments[0].reduce((n, c) => n + c.width, 0);
    expect(used + LSHAPE_SPARE).toBe(p.room.width);
  });

  it.each(TEMPLATE_KEYS)('%s carries at least one shoe rack', (key) => {
    const p = makeTemplate(key, 'x');
    const zones = WALLS.flatMap((w) => p.wardrobe.walls[w].segments.flat())
      .flatMap((c) => (c.kind === 'unit' ? c.zones : []));
    expect(zones.filter((z) => z.type === 'shoes').length).toBeGreaterThanOrEqual(1);
  });

  it('gives the U-shape a walk-in gap at the door end of both side walls', () => {
    const p = makeTemplate('uShape', 'x');
    // Wall-local `s` starts at the front on the left wall and at the back on the right one, so the
    // two gaps sit at opposite ends of their column lists and still face each other in the plan.
    const left = p.wardrobe.walls.left.segments[0];
    const right = p.wardrobe.walls.right.segments[0];
    expect(left[0].kind).toBe('gap');
    expect(right[right.length - 1].kind).toBe('gap');
  });
});
