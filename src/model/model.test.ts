import { describe, expect, it } from 'vitest';
import { makePreset, PRESET_KEYS } from './presets';
import { defaultProject } from './defaults';
import { cloneColumn, makeUnit, makeZone } from './factory';

describe('presets', () => {
  it('every preset builds a column of the requested width', () => {
    for (const k of PRESET_KEYS) {
      const c = makePreset(k, 555);
      expect(c.width).toBe(555);
      if (k === 'gap') expect(c.kind).toBe('gap');
      else expect(c.kind === 'unit' && c.zones.length > 0).toBe(true);
    }
  });
  it('drawersHanging = fixed drawers zone under an auto hanging zone', () => {
    const c = makePreset('drawersHanging', 600);
    expect(c.kind === 'unit' && c.zones.map((z) => [z.type, z.height, z.count])).toEqual([['drawers', 600, 3], ['hanging', null, 1]]);
  });
});

describe('defaults', () => {
  it('matches the spec sample', () => {
    const p = defaultProject();
    expect(p.room).toEqual({ width: 2400, depth: 2000, height: 2500 });
    expect(p.door).toEqual({ wall: 'front', offset: 800, width: 800, height: 2100 });
    expect(p.wardrobe.topGap).toBe(150);
    expect(p.wardrobe.walls.back.segments[0].map((c) => c.width)).toEqual([600, 600, 600, 600]);
    expect(p.wardrobe.walls.right.segments[0][0].kind).toBe('gap');
    expect(p.wardrobe.walls.front.enabled).toBe(false);
    const ids = new Set<string>();
    for (const w of Object.values(p.wardrobe.walls)) for (const seg of w.segments) for (const c of seg) {
      expect(ids.has(c.id)).toBe(false); ids.add(c.id);
      if (c.kind === 'unit') for (const z of c.zones) { expect(ids.has(z.id)).toBe(false); ids.add(z.id); }
    }
  });
});

describe('factory', () => {
  it('cloneColumn gives fresh ids', () => {
    const u = makeUnit(500, [makeZone('shelves', null, 3)]);
    const c = cloneColumn(u);
    expect(c.id).not.toBe(u.id);
    expect(c.kind === 'unit' && c.zones[0].id).not.toBe(u.zones[0].id);
    expect(c.kind === 'unit' && c.zones[0].count).toBe(3);
  });
});
