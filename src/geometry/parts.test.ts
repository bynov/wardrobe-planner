import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { makeUnit, makeZone } from '../model/factory';
import { ROD_DIAMETER, layoutUnit } from './layout';
import type { Zone } from '../model/types';
import { buildParts, buildUnitParts, partBounds } from './parts';
import { frameTransform, wallFrame } from './frames';

const p = defaultProject();

describe('buildUnitParts', () => {
  it('produces carcass + content for a drawers/shelves/hanging unit', () => {
    const u = makeUnit(600, [makeZone('drawers', 600, 3), makeZone('shelves', null, 3), makeZone('hanging')]);
    const parts = buildUnitParts(layoutUnit(p, 'back', 0, 0, u, 0), p);
    const kinds = parts.map((x) => x.kind);
    const count = (k: string) => kinds.filter((x) => x === k).length;
    expect(count('side')).toBe(2); expect(count('top')).toBe(1); expect(count('bottom')).toBe(1);
    expect(count('back')).toBe(1); expect(count('plinth')).toBe(1);
    expect(count('divider')).toBe(2); expect(count('shelf')).toBe(2); // 3 compartments = 2 boards
    expect(count('drawerFront')).toBe(3); expect(count('rod')).toBe(1);
    const side = parts.find((x) => x.nameKey === 'sideL')!;
    const b = partBounds(side);
    expect(b.min.x).toBeCloseTo(0); expect(b.max.x).toBeCloseTo(18);
    expect(b.min.y).toBeCloseTo(100); expect(b.max.y).toBeCloseTo(2350);
    expect(b.min.z).toBeCloseTo(0); expect(b.max.z).toBeCloseTo(600);
    const front = parts.find((x) => x.kind === 'drawerFront')!;
    const fb = partBounds(front);
    expect(fb.min.z).toBeCloseTo(600 - 18); expect(fb.max.z).toBeCloseTo(600);
    expect(fb.min.x).toBeCloseTo(20); expect(fb.max.x).toBeCloseTo(580);
    const rod = parts.find((x) => x.kind === 'rod')!;
    const rb = partBounds(rod);
    expect(rb.min.x).toBeCloseTo(18); expect(rb.max.x).toBeCloseTo(582);
    expect(rb.min.z).toBeCloseTo(298 - 12.5, 0); // interiorDepth/2 = 298
    const shelf = parts.find((x) => x.kind === 'shelf')!;
    const sb = partBounds(shelf);
    expect(sb.min.z).toBeCloseTo(4); expect(sb.max.z).toBeCloseTo(580);
  });

  it('an explicit rail moves the rod part without changing its length', () => {
    const rodBounds = (rod: Zone['rod']) => {
      const u = makeUnit(600, [{ ...makeZone('hanging', 1000), rod }, makeZone('open')]);
      return partBounds(buildUnitParts(layoutUnit(p, 'back', 0, 0, u, 0), p).find((x) => x.kind === 'rod')!);
    };
    const a = rodBounds(undefined); // auto: 1118 − ROD_DROP
    const b = rodBounds({ from: 'bottom', offset: 300 }); // 118 + 300
    expect(a.min.y + ROD_DIAMETER / 2).toBeCloseTo(1038, 0);
    expect(b.min.y + ROD_DIAMETER / 2).toBeCloseTo(418, 0);
    expect(b.max.x - b.min.x).toBeCloseTo(a.max.x - a.min.x); // the rod is still interior-width long
  });
});

describe('buildParts', () => {
  it('keeps every part inside the room and on its wall', () => {
    const parts = buildParts(p);
    expect(parts.length).toBeGreaterThan(50);
    for (const part of parts) {
      const b = partBounds(part);
      expect(b.min.x).toBeGreaterThanOrEqual(-1e-6); expect(b.max.x).toBeLessThanOrEqual(2400 + 1e-6);
      expect(b.min.z).toBeGreaterThanOrEqual(-1e-6); expect(b.max.z).toBeLessThanOrEqual(2000 + 1e-6);
      expect(b.max.y).toBeLessThanOrEqual(2350 + 1e-6);
      if (part.wall === 'left') expect(b.max.x).toBeLessThanOrEqual(600 + 1e-6);
      if (part.wall === 'right') expect(b.min.x).toBeGreaterThanOrEqual(2400 - 600 - 1e-6);
      if (part.wall === 'back') expect(b.max.z).toBeLessThanOrEqual(600 + 1e-6);
    }
    expect(parts.some((x) => x.wall === 'front')).toBe(false);
  });
  it('gap columns produce no parts and column indexes are per wall', () => {
    const right = buildParts(p).filter((x) => x.wall === 'right');
    expect(new Set(right.map((x) => x.columnIndex))).toEqual(new Set([1, 2]));
  });

  it('an enabled front wall lands in the room, against z = D', () => {
    const q = structuredClone(p);
    q.wardrobe.walls.front.enabled = true;
    q.wardrobe.walls.front.depth = 400;
    q.wardrobe.walls.front.segments[0] = [makeUnit(600, [makeZone('shelves', null, 3)])];
    const front = buildParts(q).filter((x) => x.wall === 'front');
    expect(front.length).toBeGreaterThan(5);
    for (const part of front) {
      const b = partBounds(part);
      expect(b.min.x).toBeGreaterThanOrEqual(-1e-6); expect(b.max.x).toBeLessThanOrEqual(2400 + 1e-6);
      expect(b.min.y).toBeGreaterThanOrEqual(-1e-6); expect(b.max.y).toBeLessThanOrEqual(2350 + 1e-6);
      // the run hangs off the front wall: z between D - depth and D
      expect(b.min.z).toBeGreaterThanOrEqual(2000 - 400 - 1e-6);
      expect(b.max.z).toBeLessThanOrEqual(2000 + 1e-6);
    }
  });

  it('a unit in segment 1 of the door wall stays inside the room', () => {
    const q = structuredClone(p);
    // offset 1000 puts the opening near the front end, leaving a real segment 1 between it and
    // the corner the back wall claims
    q.door = { wall: 'left', offset: 1000, width: 800, height: 2100, swing: 'in', hinge: 'left' };
    q.wardrobe.walls.left.segments = [[], [makeUnit(300, [makeZone('hanging')])]];
    const left = buildParts(q).filter((x) => x.wall === 'left');
    expect(left.length).toBeGreaterThan(5);
    for (const part of left) {
      const b = partBounds(part);
      expect(b.min.x).toBeGreaterThanOrEqual(-1e-6); expect(b.max.x).toBeLessThanOrEqual(600 + 1e-6);
      expect(b.min.z).toBeGreaterThanOrEqual(-1e-6); expect(b.max.z).toBeLessThanOrEqual(2000 + 1e-6);
      expect(b.max.y).toBeLessThanOrEqual(2350 + 1e-6);
    }
  });
});

describe('buildUnitParts: a front-to-back rail', () => {
  const t = 18, bt = 4, K = 20; // panel/back thickness and SHELF_SETBACK
  const rodOf = (rodDir: 'along' | 'across', wall: 'back' | 'left' = 'back') => {
    const u = makeUnit(600, [{ ...makeZone('hanging', 1000), rodDir }, makeZone('open')]);
    const L = layoutUnit(p, wall, 0, 0, u, 0);
    const local = buildUnitParts(L, p).find((x) => x.kind === 'rod')!;
    return { part: local, L };
  };

  it('an across rod runs front to back: centred in the unit, spanning the interior depth', () => {
    const { part, L } = rodOf('across'); // back wall: the frame is the identity
    const b = partBounds({ ...part, transform: frameTransform(wallFrame(p.room, 'back'), part.transform) });
    const cx = L.s0 + t + L.interiorWidth / 2; // 300
    expect(b.min.x).toBeCloseTo(cx - ROD_DIAMETER / 2);
    expect(b.max.x).toBeCloseTo(cx + ROD_DIAMETER / 2);
    expect(b.min.z).toBeCloseTo(bt + K); // 24
    expect(b.max.z).toBeCloseTo(L.depth - K); // 580
    expect(part.material).toBe('rod');
    expect(part.notes?.some((n) => n.key === 'note.rodAcross')).toBe(true);
  });

  it('the across rod is as long as the interior depth less both setbacks', () => {
    const { part, L } = rodOf('across');
    expect(part.thickness).toBeCloseTo(L.interiorDepth - 2 * K); // 596 - 40 = 556
  });

  it('an along rod is unchanged: it spans the interior width at mid-depth', () => {
    const { part, L } = rodOf('along');
    const b = partBounds({ ...part, transform: frameTransform(wallFrame(p.room, 'back'), part.transform) });
    expect(b.min.x).toBeCloseTo(L.s0 + t);
    expect(b.max.x).toBeCloseTo(L.s0 + L.width - t);
    expect(b.min.z).toBeCloseTo(L.interiorDepth / 2 - ROD_DIAMETER / 2);
    expect(part.notes?.some((n) => n.key === 'note.rodAcross')).toBe(false);
  });

  it('maps through the wall frame: on the left wall an across rod runs along world +X', () => {
    const { part, L } = rodOf('across', 'left');
    const b = partBounds({ ...part, transform: frameTransform(wallFrame(p.room, 'left'), part.transform) });
    // left wall: local (s, y, z) -> world (z, y, D - s)
    expect(b.min.x).toBeCloseTo(bt + K);
    expect(b.max.x).toBeCloseTo(L.depth - K);
    const cs = L.s0 + t + L.interiorWidth / 2;
    expect(b.min.z).toBeCloseTo(p.room.depth - cs - ROD_DIAMETER / 2);
    expect(b.max.z).toBeCloseTo(p.room.depth - cs + ROD_DIAMETER / 2);
  });
});

describe('buildParts: a gap\'s wall-mounted rail', () => {
  const K = 20;
  /** One wall carrying a single 800 mm gap; every other wall is off. */
  const only = (wall: 'back' | 'left', rail?: { dir: 'along' | 'across'; height: number }) => {
    const q = structuredClone(p);
    for (const w of ['back', 'right', 'front', 'left'] as const) q.wardrobe.walls[w].enabled = w === wall;
    q.wardrobe.walls[wall].segments[0] = [{ id: 'g1', kind: 'gap', width: 800, ...(rail ? { rail } : {}) }];
    q.wardrobe.walls[wall].segments[1] = [];
    return buildParts(q);
  };

  it('a plain gap builds nothing at all', () => {
    expect(only('back')).toHaveLength(0);
  });

  it('an along rail runs the length of the gap at mid-depth, on the back wall', () => {
    const parts = only('back', { dir: 'along', height: 1800 });
    expect(parts).toHaveLength(1);
    const rod = parts[0];
    expect(rod.kind).toBe('rod');
    expect(rod.material).toBe('rod');
    expect(rod.unitId).toBe('g1');
    expect(rod.columnIndex).toBe(0);
    expect(rod.notes?.map((n) => n.key).sort()).toEqual(['note.rodDia', 'note.wallMounted']);
    const b = partBounds(rod);
    expect(b.min.x).toBeCloseTo(K); // s0 + 20
    expect(b.max.x).toBeCloseTo(800 - K);
    expect(b.min.y).toBeCloseTo(1800 - ROD_DIAMETER / 2);
    expect(b.max.y).toBeCloseTo(1800 + ROD_DIAMETER / 2);
    expect(b.min.z).toBeCloseTo(300 - ROD_DIAMETER / 2); // depth / 2
    expect(rod.thickness).toBeCloseTo(800 - 2 * K);
  });

  it('an across rail stands at the gap centre and runs into the room, on the back wall', () => {
    const rod = only('back', { dir: 'across', height: 1800 })[0];
    const b = partBounds(rod);
    expect(b.min.x).toBeCloseTo(400 - ROD_DIAMETER / 2);
    expect(b.max.x).toBeCloseTo(400 + ROD_DIAMETER / 2);
    expect(b.min.z).toBeCloseTo(K); // no back panel in a gap: 20, not backThickness + 20
    expect(b.max.z).toBeCloseTo(600 - K);
    expect(rod.thickness).toBeCloseTo(600 - 2 * K);
  });

  it('maps through the wall frame: the same two rails on the left wall', () => {
    const D = p.room.depth; // left wall: local (s, y, z) -> world (z, y, D - s)
    const along = partBounds(only('left', { dir: 'along', height: 1800 })[0]);
    expect(along.min.z).toBeCloseTo(D - (800 - K));
    expect(along.max.z).toBeCloseTo(D - K);
    expect(along.min.x).toBeCloseTo(300 - ROD_DIAMETER / 2); // depth / 2

    const across = partBounds(only('left', { dir: 'across', height: 1800 })[0]);
    expect(across.min.x).toBeCloseTo(K);
    expect(across.max.x).toBeCloseTo(600 - K);
    expect(across.min.z).toBeCloseTo(D - 400 - ROD_DIAMETER / 2);
    expect(across.max.z).toBeCloseTo(D - 400 + ROD_DIAMETER / 2);
  });
});
