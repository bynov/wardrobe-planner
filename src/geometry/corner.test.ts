import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import type { CornerPlan, Project, Wall } from '../model/types';
import { WALLS, wallFrame, wallSegments } from './frames';
import { buildCornerParts, cornerFootprint, cornerShape, cornerSlab, layoutCorner } from './corner';
import { buildParts, partBounds } from './parts';
import { layoutWall } from './layout';

const withCorner = (p: Project, anchor: Wall, patch: Partial<CornerPlan>): Project => ({
  ...p,
  wardrobe: { ...p.wardrobe, corners: { ...p.wardrobe.corners, [anchor]: { ...p.wardrobe.corners[anchor], ...patch } } },
});
const enableAll = (p: Project): Project => ({
  ...p,
  wardrobe: {
    ...p.wardrobe,
    walls: Object.fromEntries(WALLS.map((w) => [w, { ...p.wardrobe.walls[w], enabled: true }])) as Project['wardrobe']['walls'],
  },
});

const base = defaultProject(); // room 2400 x 2000 x 2500, t 18, back 4, plinth 100, topGap 150
const bl = withCorner(base, 'back', { mode: 'lshelf', width: 1000, shelves: 5 });

describe('cornerFootprint', () => {
  it('is the L polygon of §8.3 in anchor-local (u, v)', () => {
    expect(cornerFootprint(1000, 600, 500)).toEqual([
      { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 600 }, { x: 500, y: 600 }, { x: 500, y: 1000 }, { x: 0, y: 1000 },
    ]);
  });
});

describe('layoutCorner', () => {
  it('is null for a "none" corner and for an lshelf corner with a disabled wall', () => {
    expect(layoutCorner(base, 'back')).toBeNull();
    expect(layoutCorner(withCorner(base, 'front', { mode: 'lshelf' }), 'front')).toBeNull(); // front wall off
  });

  it('resolves the two walls, their depths and the shelf heights', () => {
    const L = layoutCorner(bl, 'back')!;
    expect(L).not.toBeNull();
    expect([L.a, L.b]).toEqual(['back', 'left']);
    expect([L.w, L.dA, L.dB]).toEqual([1000, 600, 600]);
    expect([L.floorY, L.topY, L.carcassHeight, L.interiorHeight]).toEqual([118, 2350, 2250, 2214]);
    // 5 COMPARTMENTS in 2214 mm of interior: opening = (2214 - 4*18) / 5 = 428.4, 4 boards
    expect(L.shelfYs).toHaveLength(4);
    expect(L.shelfYs[0]).toBeCloseTo(118 + 428.4);
    expect(L.shelfYs[3]).toBeCloseTo(118 + 4 * 428.4 + 3 * 18);
    expect(L.shelfYs[3] + 18 + 428.4).toBeCloseTo(L.floorY + L.interiorHeight);
  });

  it('a single compartment is one open bay with no board', () => {
    expect(layoutCorner(withCorner(bl, 'back', { shelves: 1 }), 'back')!.shelfYs).toEqual([]);
    // an invalid count is clamped rather than producing negative geometry
    expect(layoutCorner(withCorner(bl, 'back', { shelves: 0 }), 'back')!.shelfYs).toEqual([]);
  });
});

describe('buildCornerParts', () => {
  const parts = buildCornerParts(bl, 'back');
  const byId = (suffix: string) => parts.find((x) => x.id.endsWith(suffix))!;
  const box = (suffix: string) => partBounds(byId(suffix));
  const near = (v: number, e: number) => expect(v).toBeCloseTo(e, 6);

  it('builds carcass + shelves + plinths and tags them all to the corner', () => {
    const count = (k: string) => parts.filter((x) => x.kind === k).length;
    expect(count('bottom')).toBe(1);
    expect(count('top')).toBe(1);
    expect(count('side')).toBe(2);
    expect(count('back')).toBe(2);
    expect(count('shelf')).toBe(4); // 5 compartments
    expect(count('plinth')).toBe(2);
    expect(parts).toHaveLength(12);
    for (const part of parts) {
      expect(part.corner).toBe('back');
      expect(part.columnIndex).toBe(-1);
      expect(part.wall).toBe('back');
    }
  });

  it('the L slabs stop short of both end panels and carry the note', () => {
    const bottom = byId('bottom');
    // NOT the full footprint: the end panels are full height, so the slabs stop at w - t.
    expect(bottom.outline).toEqual(cornerSlab(1000, 600, 600, 18));
    expect(bottom.outline).not.toEqual(cornerFootprint(1000, 600, 600));
    expect(bottom.notes?.map((n) => n.key)).toEqual(['note.lShape']);
    expect(byId('shelf1').notes?.map((n) => n.key)).toEqual(['note.lShape']);
    // shelf polygon: inset by the back thickness, the end panels and the 20 mm front setback
    expect(byId('shelf1').outline).toEqual([
      { x: 4, y: 4 }, { x: 982, y: 4 }, { x: 982, y: 580 }, { x: 580, y: 580 }, { x: 580, y: 982 }, { x: 4, y: 982 },
    ]);
  });

  it('places every part in the back-left corner, in world mm', () => {
    // the back wall's frame is the identity, so anchor-local (u, y, v) == world (x, y, z)
    const bottom = box('bottom');
    near(bottom.min.x, 0); near(bottom.max.x, 982);
    near(bottom.min.z, 0); near(bottom.max.z, 982);
    near(bottom.min.y, 100); near(bottom.max.y, 118); // top surface at floorY

    const top = box('top');
    near(top.min.y, 2332); near(top.max.y, 2350);

    const endA = box('endA'); // end panel closing leg A, at u in [w-t, w]
    near(endA.min.x, 982); near(endA.max.x, 1000);
    near(endA.min.z, 0); near(endA.max.z, 600);
    near(endA.min.y, 100); near(endA.max.y, 2350);

    const endB = box('endB'); // end panel closing leg B, at v in [w-t, w]
    near(endB.min.z, 982); near(endB.max.z, 1000);
    near(endB.min.x, 0); near(endB.max.x, 600);

    const backA = box('backA'); // against wall A (z = 0)
    near(backA.min.z, 0); near(backA.max.z, 4);
    near(backA.min.x, 0); near(backA.max.x, 982);

    const backB = box('backB'); // against wall B (x = 0), starting where backA ends
    near(backB.min.x, 0); near(backB.max.x, 4);
    near(backB.min.z, 4); near(backB.max.z, 982);

    const plinthA = box('plinthA'); // under leg A's open face only
    near(plinthA.min.x, 600); near(plinthA.max.x, 1000);
    near(plinthA.min.y, 0); near(plinthA.max.y, 100);
    near(plinthA.min.z, 542); near(plinthA.max.z, 560);

    const plinthB = box('plinthB');
    near(plinthB.min.z, 600); near(plinthB.max.z, 1000);
    near(plinthB.min.x, 542); near(plinthB.max.x, 560);
  });
});

describe('buildParts with corners', () => {
  it('appends the corner parts of every active lshelf corner and no others', () => {
    const plain = buildParts(base);
    expect(plain.some((x) => x.corner)).toBe(false);

    const withBL = buildParts(bl);
    expect(withBL.filter((x) => x.corner === 'back')).toHaveLength(12);
    expect(withBL.filter((x) => x.corner && x.corner !== 'back')).toHaveLength(0);
    // The existing units are untouched (an overflowing run is a validation error, not a cull) —
    // they are only pushed along, so the corner adds exactly its own parts.
    expect(withBL.length).toBe(plain.length + 12);
    expect(layoutWall(bl, 'back')[0].s0).toBe(1000); // wall A's run starts past the corner unit
    expect(wallSegments(bl, 'left')[0].s1).toBe(2000 - 1000); // wall B's run ends before it
  });

  it('keeps every corner unit inside the room and inside its own L footprint, on all four corners', () => {
    let p = enableAll(base);
    for (const anchor of WALLS) p = withCorner(p, anchor, { mode: 'lshelf', width: 900, shelves: 4 });
    const parts = buildParts(p).filter((x) => x.corner);
    expect(new Set(parts.map((x) => x.corner))).toEqual(new Set(WALLS));
    expect(parts).toHaveLength(4 * 11); // 8 carcass boards + 3 shelves per corner
    for (const part of parts) {
      const b = partBounds(part);
      expect(b.min.x).toBeGreaterThanOrEqual(-1e-6);
      expect(b.max.x).toBeLessThanOrEqual(2400 + 1e-6);
      expect(b.min.z).toBeGreaterThanOrEqual(-1e-6);
      expect(b.max.z).toBeLessThanOrEqual(2000 + 1e-6);
      expect(b.min.y).toBeGreaterThanOrEqual(-1e-6);
      expect(b.max.y).toBeLessThanOrEqual(2350 + 1e-6);
      // inside the corner's own 900 x 900 bounding square, measured from the corner point itself
      const c = wallFrame(p.room, part.corner!).origin;
      for (const q of [b.min, b.max]) {
        expect(Math.abs(q.x - c.x)).toBeLessThanOrEqual(900 + 1e-6);
        expect(Math.abs(q.z - c.z)).toBeLessThanOrEqual(900 + 1e-6);
      }
    }
  });
});

describe('corner parts never interpenetrate', () => {
  const overlap = (a: { min: number; max: number }, b: { min: number; max: number }) =>
    Math.min(a.max, b.max) - Math.max(a.min, b.min);
  const axes = (b: ReturnType<typeof partBounds>) => [
    { min: b.min.x, max: b.max.x }, { min: b.min.y, max: b.max.y }, { min: b.min.z, max: b.max.z },
  ];

  it.each(WALLS)('%s corner: no two parts share volume', (anchor) => {
    let p = enableAll(base);
    for (const w of WALLS) p = withCorner(p, w, { mode: 'lshelf', width: 900, shelves: 4 });
    const parts = buildCornerParts(p, anchor);
    expect(parts.length).toBeGreaterThan(8);
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = axes(partBounds(parts[i]));
        const b = axes(partBounds(parts[j]));
        // Boards may touch (overlap 0) but never share volume on all three axes at once.
        const shared = a.every((_, k) => overlap(a[k], b[k]) > 1e-6);
        expect(shared, `${parts[i].id} vs ${parts[j].id}`).toBe(false);
      }
    }
  });
});

describe('cornerShape', () => {
  it('is the L for an lshelf corner', () => {
    expect(cornerShape(bl, 'back')).toEqual(cornerFootprint(1000, 600, 600));
  });

  it('is a small tab at the corner for a "none" corner, so it does not swallow the wall bands', () => {
    // 200 mm cap: the runs are 600 deep here, and a 600 x 600 hit square used to eat half a wall
    expect(cornerShape(base, 'back')).toEqual([
      { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 },
    ]);
  });

  it('never exceeds either run depth', () => {
    const shallow = { ...base, wardrobe: { ...base.wardrobe, walls: { ...base.wardrobe.walls, left: { ...base.wardrobe.walls.left, depth: 150 } } } };
    const pts = cornerShape(shallow, 'back'); // b = left, so dB = 150 caps the tab
    expect(Math.max(...pts.map((q) => q.x))).toBe(150);
    expect(Math.max(...pts.map((q) => q.y))).toBe(150);
  });
});
