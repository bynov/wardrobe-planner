import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { makeUnit, makeZone } from '../model/factory';
import type { Zone } from '../model/types';
import { MAX_ROD_HEIGHT, ROD_DROP, defaultGapRailHeight, heights, layoutAll, layoutUnit, layoutWall, zoneHeights } from './layout';

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

/**
 * The rail offset is measured against the HANGING COMPARTMENT's own ends, not the unit's — so a
 * compartment sitting on top of a shelves block measures from the divider above the shelves, not
 * from the bottom panel. This pins that per-compartment semantics.
 */
describe('layoutUnit: the rail offset is per-compartment', () => {
  const t = p.wardrobe.panelThickness; // 18
  const { floorY, interiorHeight } = heights(p); // 118, 2214
  // Zones run bottom -> top: a fixed 1000 mm shelves block, then the hanging zone taking the rest.
  const unit = (rod: Zone['rod']) =>
    makeUnit(600, [makeZone('shelves', 1000, 3), { ...makeZone('hanging'), rod }]);
  const hanging = (rod: Zone['rod']) => layoutUnit(p, 'back', 0, 0, unit(rod), 0).zones[1];

  it('the hanging compartment starts at the top surface of the divider above the shelves', () => {
    const h = hanging(undefined);
    expect(h.yBot).toBeCloseTo(floorY + 1000 + t); // 1136, not floorY
    expect(h.yTop).toBeCloseTo(floorY + interiorHeight); // 2332 — the last zone takes the leftover
  });

  it('from: bottom measures from the compartment bottom, not from the unit floor', () => {
    const h = hanging({ from: 'bottom', offset: 1000 });
    expect(h.rodY).toBeCloseTo(h.yBot + 1000);
    expect(h.rodY).toBeCloseTo(floorY + 1000 + t + 1000); // 2136
    expect(h.rodY).not.toBeCloseTo(floorY + 1000); // what a unit-relative reading would give
  });

  it('from: top measures from the compartment top', () => {
    const h = hanging({ from: 'top', offset: 300 });
    expect(h.rodY).toBeCloseTo(h.yTop - 300);
    expect(h.rodY).toBeCloseTo(floorY + interiorHeight - 300); // 2032
  });
});

describe('layoutUnit: rail direction', () => {
  const hang = (rodDir?: 'along' | 'across', rod?: Zone['rod']) => {
    const u = makeUnit(600, [{ ...makeZone('hanging', 1000), rodDir, rod }, makeZone('open')]);
    return layoutUnit(p, 'back', 0, 0, u, 0).zones[0];
  };

  it('defaults to "along" when the zone says nothing', () => {
    expect(hang(undefined).rodDir).toBe('along');
  });

  it('carries an explicit direction through', () => {
    expect(hang('along').rodDir).toBe('along');
    expect(hang('across').rodDir).toBe('across');
  });

  it('the direction does not change the rail height, auto or explicit', () => {
    expect(hang('across').rodY).toBeCloseTo(hang('along').rodY!);
    expect(hang('across', { from: 'bottom', offset: 300 }).rodY).toBeCloseTo(118 + 300);
    expect(hang('across', { from: 'top', offset: 200 }).rodY).toBeCloseTo(1118 - 200);
  });

  it('a non-hanging zone reports the default direction and no rail', () => {
    const u = makeUnit(600, [{ ...makeZone('shelves', 1000, 2), rodDir: 'across' as const }]);
    const z = layoutUnit(p, 'back', 0, 0, u, 0).zones[0];
    expect(z.rodY).toBeNull();
    expect(z.rodDir).toBe('across'); // the zone's own field, whether or not a rail uses it
  });
});

describe('layoutWall: a gap\'s wall-mounted rail', () => {
  const K = 20; // SHELF_SETBACK, the clearance the rail keeps at either end
  /** The back wall as a single 800 mm gap, optionally carrying a rail. */
  const wallWith = (rail?: { dir: 'along' | 'across'; height: number }) => {
    const q = structuredClone(p);
    q.wardrobe.walls.back.segments[0] = [{ id: 'g1', kind: 'gap', width: 800, ...(rail ? { rail } : {}) }];
    const c = layoutWall(q, 'back')[0];
    if (c.kind !== 'gap') throw new Error('expected a gap');
    return c;
  };

  it('no rail on a plain gap', () => {
    expect(wallWith().rail).toBeNull();
  });

  it('the gap knows the wall\'s unit depth, so a rail can reach into the room', () => {
    expect(wallWith().depth).toBe(600);
  });

  it('an along rail on the last gap runs on to the end of the wall, held clear of both ends', () => {
    // The back wall is 2400 wide and the 800 mm gap is its only column: the rest is empty, so the
    // rail spans the whole empty stretch, from the gap's start to the wall's end.
    const g = wallWith({ dir: 'along', height: 1800 });
    expect(g.rail).toEqual({ dir: 'along', y: 1800, s0: 0 + K, s1: 2400 - K, length: 2400 - 2 * K });
  });

  it('an along rail on a gap followed by a unit stops at that unit', () => {
    const q = structuredClone(p);
    q.wardrobe.walls.back.segments[0] = [
      { id: 'g1', kind: 'gap', width: 800, rail: { dir: 'along', height: 1800 } },
      makeUnit(600, [makeZone('hanging')]),
    ];
    const g = layoutWall(q, 'back')[0];
    if (g.kind !== 'gap') throw new Error('expected a gap');
    expect(g.rail).toEqual({ dir: 'along', y: 1800, s0: 0 + K, s1: 800 - K, length: 800 - 2 * K });
    expect(g.s1).toBe(800); // the gap itself keeps its own width
  });

  it('an along rail runs on over the plain gaps after it, up to the next unit', () => {
    const q = structuredClone(p);
    q.wardrobe.walls.back.segments[0] = [
      { id: 'g1', kind: 'gap', width: 300, rail: { dir: 'along', height: 1800 } },
      { id: 'g2', kind: 'gap', width: 500 },
      makeUnit(600, [makeZone('hanging')]),
    ];
    const [g1, g2] = layoutWall(q, 'back');
    if (g1.kind !== 'gap' || g2.kind !== 'gap') throw new Error('expected gaps');
    expect(g1.rail).toEqual({ dir: 'along', y: 1800, s0: 0 + K, s1: 800 - K, length: 800 - 2 * K });
    expect(g2.rail).toBeNull();
    expect(g1.s1).toBe(300); // the gap itself keeps its own width
  });

  it('an along rail also takes the plain gaps before it, back to the unit', () => {
    const q = structuredClone(p);
    q.wardrobe.walls.back.segments[0] = [
      makeUnit(600, [makeZone('hanging')]),
      { id: 'g1', kind: 'gap', width: 500 },
      { id: 'g2', kind: 'gap', width: 300, rail: { dir: 'along', height: 1800 } },
      makeUnit(600, [makeZone('hanging')]),
    ];
    const g = layoutWall(q, 'back')[2];
    if (g.kind !== 'gap') throw new Error('expected a gap');
    expect(g.rail).toEqual({ dir: 'along', y: 1800, s0: 600 + K, s1: 1400 - K, length: 800 - 2 * K });
  });

  it('two rail gaps in one run split the plain gaps between them at the second rail', () => {
    const q = structuredClone(p);
    q.wardrobe.walls.back.segments[0] = [
      { id: 'g1', kind: 'gap', width: 300, rail: { dir: 'along', height: 1800 } },
      { id: 'g2', kind: 'gap', width: 500 },
      { id: 'g3', kind: 'gap', width: 300, rail: { dir: 'along', height: 1200 } },
      { id: 'g4', kind: 'gap', width: 200 },
    ];
    const [g1, , g3] = layoutWall(q, 'back');
    if (g1.kind !== 'gap' || g3.kind !== 'gap') throw new Error('expected gaps');
    expect(g1.rail).toEqual({ dir: 'along', y: 1800, s0: 0 + K, s1: 800 - K, length: 800 - 2 * K });
    // g3 takes g4 and the empty rest of the wall (2400 wide), but nothing before it.
    expect(g3.rail).toEqual({ dir: 'along', y: 1200, s0: 800 + K, s1: 2400 - K, length: 1600 - 2 * K });
  });

  it('an across rail stays at its own gap\'s centre even beside plain gaps', () => {
    const q = structuredClone(p);
    q.wardrobe.walls.back.segments[0] = [
      { id: 'g1', kind: 'gap', width: 300, rail: { dir: 'across', height: 1800 } },
      { id: 'g2', kind: 'gap', width: 500 },
    ];
    const g = layoutWall(q, 'back')[0];
    if (g.kind !== 'gap') throw new Error('expected a gap');
    expect(g.rail!.s0).toBe(150);
  });

  it('an along rail on the last gap stops at the corner a side wall leaves for its neighbour', () => {
    // Left wall, 2000 long; the back wall is enabled and 600 deep, so the left wall's run ends at
    // 2000 - 600 = 1400. A unit then a trailing gap: the rail runs from the gap to that corner.
    const q = structuredClone(p);
    q.wardrobe.walls.left.enabled = true;
    q.wardrobe.walls.left.segments[0] = [
      makeUnit(600, [makeZone('hanging')]),
      { id: 'g1', kind: 'gap', width: 300, rail: { dir: 'along', height: 1800 } },
    ];
    const g = layoutWall(q, 'left')[1];
    if (g.kind !== 'gap') throw new Error('expected a gap');
    expect(g.s0).toBe(600);
    expect(g.rail).toEqual({ dir: 'along', y: 1800, s0: 600 + K, s1: 1400 - K, length: 800 - 2 * K });
  });

  it('an across rail stands at the gap centre and reaches the wall\'s depth', () => {
    const g = wallWith({ dir: 'across', height: 1800 });
    expect(g.rail).toEqual({ dir: 'across', y: 1800, s0: 400, s1: 400, length: 600 - 2 * K });
  });

  it('the rail height is taken as given, not derived', () => {
    expect(wallWith({ dir: 'along', height: 900 }).rail!.y).toBe(900);
  });

  it('defaultGapRailHeight parks a new rail at the usual reach limit', () => {
    expect(defaultGapRailHeight(p)).toBe(Math.min(MAX_ROD_HEIGHT, heights(p).topY - ROD_DROP));
    expect(defaultGapRailHeight(p)).toBe(2000);
    const low = { ...p, room: { ...p.room, height: 1800 } }; // topY 1650 -> 1650 - 80
    expect(defaultGapRailHeight(low)).toBe(1570);
  });
});
