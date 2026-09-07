import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { makeUnit, makeZone } from '../model/factory';
import type { Zone } from '../model/types';
import { MAX_ROD_HEIGHT, ROD_DROP, heights, layoutAll, layoutUnit, layoutWall, zoneHeights } from './layout';

const p = defaultProject(); // t 18, plinth 100, topGap 150, height 2500 → carcass 2250, interior 2214

describe('heights', () => {
  it('carcass and interior', () => {
    expect(heights(p)).toEqual({ carcassHeight: 2250, interiorHeight: 2214, floorY: 118, topY: 2350 });
  });
});

describe('zoneHeights', () => {
  it('auto zones share leftover', () => {
    const u = makeUnit(600, [makeZone('drawers', 600, 3), makeZone('hanging'), makeZone('hanging')]);
    const r = zoneHeights(u, 2214, 18);
    expect(r.leftover).toBe(2214 - 600 - 36);
    expect(r.heights).toEqual([600, 789, 789]);
  });
  it('top zone absorbs leftover when nothing is auto', () => {
    const u = makeUnit(600, [makeZone('drawers', 600, 3), makeZone('open', 500)]);
    expect(zoneHeights(u, 2214, 18).heights).toEqual([600, 500 + 2214 - 1100 - 18]);
  });
  it('negative leftover is reported', () => {
    const u = makeUnit(600, [makeZone('drawers', 2000, 3), makeZone('open', 500)]);
    expect(zoneHeights(u, 2214, 18).leftover).toBeLessThan(0);
  });
});

describe('layoutUnit', () => {
  it('stacks zones with dividers and places content', () => {
    const u = makeUnit(600, [makeZone('drawers', 600, 3), makeZone('shelves', null, 2), makeZone('hanging', 900)]);
    const L = layoutUnit(p, 'back', 0, 0, u, 100);
    expect(L.s1).toBe(700);
    expect(L.interiorWidth).toBe(564);
    expect(L.interiorDepth).toBe(596);
    const [d, s, h] = L.zones;
    expect(d.yBot).toBe(118); expect(d.yTop).toBe(718);
    expect(L.dividerYs).toEqual([736, 736 + s.height + 18]);
    expect(s.yBot).toBe(736);
    expect(h.yTop).toBeCloseTo(2350 - 18);
    // yTop − ROD_DROP would be 2252, above the 2000 mm reach limit: the rail parks at MAX_ROD_HEIGHT
    expect(h.rodY).toBeCloseTo(MAX_ROD_HEIGHT);
    // drawers: 3 fronts, reveal 2, gap 3
    // fronts are floored to whole mm; the 2 mm remainder widens the reveal above the top front
    expect(d.frontH).toBe(196);
    expect(d.drawerFronts[0].y0).toBe(120);
    expect(d.drawerFronts[2].y1).toBe(120 + 3 * 196 + 2 * 3);
    expect(d.frontW).toBe(560);
    // shelves: count = COMPARTMENTS, so 2 compartments = 1 board splitting the zone in two
    const opening = (s.height - 18) / 2;
    expect(s.shelfYs).toEqual([s.yBot + opening]);
  });

  it('a shelves zone of 1 compartment is a single open bay with no board at all', () => {
    const u = makeUnit(600, [makeZone('shelves', null, 1)]);
    const [z] = layoutUnit(p, 'back', 0, 0, u, 0).zones;
    expect(z.shelfYs).toEqual([]);
  });

  it('n compartments produce n - 1 evenly spaced boards that fill the zone exactly', () => {
    // an auto zone on top, so the fixed 1000 mm zone is not the one that absorbs the leftover
    const u = makeUnit(600, [makeZone('shelves', 1000, 5), makeZone('open')]);
    const [z] = layoutUnit(p, 'back', 0, 0, u, 0).zones;
    expect(z.height).toBe(1000);
    expect(z.shelfYs).toHaveLength(4);
    const opening = (1000 - 4 * 18) / 5;
    expect(z.shelfYs[0]).toBeCloseTo(z.yBot + opening);
    // the last board's top leaves exactly one more opening under the zone top
    expect(z.shelfYs[3] + 18 + opening).toBeCloseTo(z.yTop);
  });
  it('a hanging zone below the reach limit keeps the full rod drop', () => {
    const u = makeUnit(600, [makeZone('hanging', 1000), makeZone('open')]);
    const [h] = layoutUnit(p, 'back', 0, 0, u, 0).zones;
    expect(h.yTop).toBe(1118);
    expect(h.rodY).toBeCloseTo(1118 - ROD_DROP);
    expect(h.rodY).toBeLessThan(MAX_ROD_HEIGHT);
  });
});

describe('layoutWall / layoutAll', () => {
  it('places columns from the segment start and skips disabled walls', () => {
    const right = layoutWall(p, 'right');
    expect(right.map((c) => [c.kind, c.s0, c.s1, c.columnIndex])).toEqual([['gap', 600, 900, 0], ['unit', 900, 1400, 1], ['unit', 1400, 2000, 2]]);
    expect(layoutWall(p, 'front')).toEqual([]);
    expect(layoutAll(p).length).toBe(4 + 2 + 3);
  });
  it('counts columnIndex across both segments of a door wall', () => {
    const q = structuredClone(p);
    q.door = { wall: 'back', offset: 1000, width: 800, height: 2100, swing: 'in', hinge: 'left' };
    q.wardrobe.walls.back.segments = [[makeUnit(500, [makeZone('open')])], [makeUnit(500, [makeZone('open')])]];
    expect(layoutWall(q, 'back').map((c) => [c.segment, c.columnIndex, c.s0])).toEqual([[0, 0, 0], [1, 1, 1880]]);
  });
});

describe('layoutUnit: explicit rail height', () => {
  const hang = (rod: Zone['rod']) => {
    const u = makeUnit(600, [{ ...makeZone('hanging', 1000), rod }, makeZone('open')]);
    return layoutUnit(p, 'back', 0, 0, u, 0).zones[0];
  };

  it('auto is flagged and keeps the derived rail height', () => {
    const h = hang(undefined);
    expect(h.rodAuto).toBe(true);
    expect(h.rodY).toBeCloseTo(1118 - ROD_DROP);
  });

  it('measures an offset from the top of the zone', () => {
    const h = hang({ from: 'top', offset: 200 });
    expect(h.rodAuto).toBe(false);
    expect(h.rodY).toBeCloseTo(1118 - 200);
  });

  it('measures an offset from the bottom of the zone', () => {
    const h = hang({ from: 'bottom', offset: 300 });
    expect(h.rodAuto).toBe(false);
    expect(h.rodY).toBeCloseTo(118 + 300);
  });

  // An explicit height is the fitter's call: it is checked by validate(), not silently clamped,
  // so the drawings show exactly what was asked for (here: above the reach limit).
  it('does not clamp an explicit rail to MAX_ROD_HEIGHT', () => {
    const u = makeUnit(600, [{ ...makeZone('hanging'), rod: { from: 'bottom' as const, offset: 2100 } }]);
    expect(layoutUnit(p, 'back', 0, 0, u, 0).zones[0].rodY).toBeCloseTo(118 + 2100);
  });

  it('a non-hanging zone with a stray rod still has no rail', () => {
    const u = makeUnit(600, [{ ...makeZone('shelves', 1000, 2), rod: { from: 'top' as const, offset: 200 } }]);
    expect(layoutUnit(p, 'back', 0, 0, u, 0).zones[0].rodY).toBeNull();
  });
});
