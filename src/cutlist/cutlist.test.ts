import { describe, it, expect } from 'vitest';
import { buildCutList, partDims } from './cutlist';
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
