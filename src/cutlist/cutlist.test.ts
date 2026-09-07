import { describe, it, expect } from 'vitest';
import { buildCutList, locationTag, partDims } from './cutlist';
import { buildParts, rect, type Part } from '../geometry/parts';
import { defaultProject } from '../model/defaults';
import { v3 } from '../geometry/vec';

describe('cut list', () => {
  it('produces non-empty rows that fully account for every part', () => {
    const parts = buildParts(defaultProject());
    const rows = buildCutList(parts);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.qty).toBeGreaterThanOrEqual(1);
    const totalQty = rows.reduce((s, r) => s + r.qty, 0);
    expect(totalQty).toBe(parts.length);
  });

  it('orders rows with side first (KIND_ORDER)', () => {
    const rows = buildCutList(buildParts(defaultProject()));
    expect(rows[0].kind).toBe('side');
  });

  it('groups every sideL panel (same depth & carcass height across all units) into one row', () => {
    const parts = buildParts(defaultProject());
    const rows = buildCutList(parts);
    const sideL = rows.find((r) => r.nameKey === 'sideL' && r.length === 2250 && r.width === 600)!;
    expect(sideL).toBeDefined();
    // All 8 units (4 back + 2 left + 2 right) share depth 600 & carcass height 2250.
    expect(sideL.qty).toBe(8);
    expect(sideL.kind).toBe('side');
    expect(sideL.thickness).toBe(18);
    expect(sideL.locations).toContainEqual({ wall: 'back', columnIndex: 0 });
    // locations deduplicated, sorted by WALLS order (back, right, front, left) then columnIndex
    expect(sideL.locations).toEqual([
      { wall: 'back', columnIndex: 0 },
      { wall: 'back', columnIndex: 1 },
      { wall: 'back', columnIndex: 2 },
      { wall: 'back', columnIndex: 3 },
      { wall: 'right', columnIndex: 1 },
      { wall: 'right', columnIndex: 2 },
      { wall: 'left', columnIndex: 0 },
      { wall: 'left', columnIndex: 1 },
    ]);
  });

  it('rod rows carry a rodDia note and report thickness as ROD_DIAMETER', () => {
    const rows = buildCutList(buildParts(defaultProject()));
    const rods = rows.filter((r) => r.kind === 'rod');
    expect(rods.length).toBeGreaterThan(0);
    for (const rod of rods) {
      expect(rod.thickness).toBe(25);
      expect(rod.width).toBe(25);
      expect(rod.material).toBe('rod');
      expect(rod.notes).toEqual([{ key: 'note.rodDia', params: { d: 25 } }]);
    }
  });

  it('partDims returns the outline bounding box with the longer edge first', () => {
    const part: Part = {
      id: 'test', wall: 'back', columnIndex: 0, unitId: 'u',
      nameKey: 'shelf', kind: 'shelf', outline: rect(300, 700), thickness: 18,
      transform: { position: v3(0, 0, 0), rotation: v3(0, 0, 0) }, material: 'panel',
    };
    expect(partDims(part)).toEqual({ length: 700, width: 300 });
  });
});

describe('cut list: corner units', () => {
  const withBL = (() => {
    const q = structuredClone(defaultProject());
    q.wardrobe.corners.back = { mode: 'lshelf', width: 1000, shelves: 5 };
    return q;
  })();

  it('locates corner parts by the corner, never by a column index', () => {
    const rows = buildCutList(buildParts(withBL));
    const cornerRows = rows.filter((r) => r.locations.some((l) => l.corner));
    expect(cornerRows.length).toBeGreaterThan(0);
    for (const r of cornerRows) {
      for (const l of r.locations) {
        if (l.corner) expect(l).toEqual({ wall: 'back', columnIndex: -1, corner: 'back' });
      }
    }
    const shelf = rows.find((r) => r.kind === 'shelf' && r.notes.some((n) => n.key === 'note.lShape'))!;
    expect(shelf).toBeDefined();
    expect(shelf.qty).toBe(4); // 5 compartments = 4 boards
    expect(locationTag('en', shelf.locations[0])).toBe('BL');
    expect(locationTag('ru', shelf.locations[0])).toBe('BL');
  });

  it('an identical corner panel merges with the run panels instead of splitting a row', () => {
    const rows = buildCutList(buildParts(withBL));
    // The corner's leg-B end panel is dimensionally the same board as a unit side of the same
    // depth, so it belongs in that row — grouping is by shape, not by where the part sits.
    const sideL = rows.filter((r) => r.nameKey === 'sideL' && r.length === 2250 && r.width === 600);
    expect(sideL).toHaveLength(1);
    expect(sideL[0].locations.some((l) => l.corner === 'back')).toBe(true);
    expect(sideL[0].locations.some((l) => !l.corner)).toBe(true);
  });

  it('two L slabs that differ only in shape stay in separate rows', () => {
    const q = structuredClone(withBL);
    q.wardrobe.walls.front.enabled = true;
    q.wardrobe.walls.front.depth = 400;
    // front-left corner: legs 1000, but dA/dB swapped relative to the back-left one
    q.wardrobe.corners.left = { mode: 'lshelf', width: 1000, shelves: 5 };
    const tops = buildCutList(buildParts(q)).filter((r) => r.nameKey === 'top' && r.notes.some((n) => n.key === 'note.lShape'));
    // both are 1000 x 1000 in bounding size, but the L is mirrored, so they must not merge
    expect(tops.length).toBeGreaterThan(1);
    expect(new Set(tops.map((r) => `${r.length}x${r.width}`)).size).toBe(1);
  });

  it('groups a rectangle regardless of which way round its outline is written', () => {
    const base: Omit<Part, 'id' | 'outline'> = {
      wall: 'back', columnIndex: 0, unitId: 'u', nameKey: 'shelf', kind: 'shelf',
      thickness: 18, transform: { position: v3(0, 0, 0), rotation: v3(0, 0, 0) }, material: 'panel',
    };
    const rows = buildCutList([
      { ...base, id: 'a', outline: rect(600, 500) },
      { ...base, id: 'b', outline: rect(500, 600) },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].qty).toBe(2);
    expect([rows[0].length, rows[0].width]).toEqual([600, 500]);
  });

  it('an L slab never groups with a straight panel of the same bounding size', () => {
    const rows = buildCutList(buildParts(withBL));
    const bottoms = rows.filter((r) => r.nameKey === 'bottom');
    // The L bottom carries note.lShape, so it stays its own row even where the bounding box matches.
    expect(bottoms.some((r) => r.notes.some((n) => n.key === 'note.lShape'))).toBe(true);
    expect(bottoms.some((r) => r.notes.length === 0)).toBe(true);
  });

  it('every part still lands in exactly one row', () => {
    const parts = buildParts(withBL);
    expect(buildCutList(parts).reduce((s, r) => s + r.qty, 0)).toBe(parts.length);
  });
});
