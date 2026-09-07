import { describe, expect, it } from 'vitest';
import {
  FILE_VERSION,
  LANG_KEY,
  STORAGE_KEY,
  loadFromStorage,
  loadLang,
  parseErrorText,
  parseProjectJson,
  parseProjectShape,
  saveLang,
  saveToStorage,
  serializeProject,
} from './persist';
import { defaultProject } from '../model/defaults';
import { msg } from '../i18n';
import { makeUnit, makeZone } from '../model/factory';
import { layoutUnit } from '../geometry/layout';
import { WALLS } from '../geometry/frames';
import type { Unit } from '../model/types';

const memStorage = () => {
  const mem = new Map<string, string>();
  return { mem, getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
};

describe('serialize / parse', () => {
  it('round-trips a project', () => {
    const p = defaultProject();
    const text = serializeProject(p);
    expect(JSON.parse(text).version).toBe(FILE_VERSION);
    const r = parseProjectJson(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });

  it('fills a missing door swing / hinge with the defaults', () => {
    const p = defaultProject() as unknown as { door: Record<string, unknown> };
    delete p.door.swing;
    delete p.door.hinge;
    const r = parseProjectShape(JSON.stringify({ version: FILE_VERSION, project: p }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project.door.swing).toBe('in');
    if (r.ok) expect(r.project.door.hinge).toBe('left');
  });

  it('keeps an explicit door swing / hinge', () => {
    const p = defaultProject();
    p.door.swing = 'out';
    p.door.hinge = 'right';
    const r = parseProjectShape(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.project.door.swing, r.project.door.hinge]).toEqual(['out', 'right']);
  });

  it('rejects a door swing / hinge that is not one of the two values', () => {
    const p = defaultProject() as unknown as { door: Record<string, unknown> };
    p.door.swing = 'sideways';
    expect(parseProjectShape(JSON.stringify({ version: FILE_VERSION, project: p })).ok).toBe(false);
  });

  it('rejects garbage with error.notJson', () => {
    const r = parseProjectJson('not json {');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.key).toBe('error.notJson');
  });

  it('rejects a wrong version with error.badVersion', () => {
    const r = parseProjectJson(JSON.stringify({ version: 99, project: defaultProject() }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toEqual({ key: 'error.badVersion', params: { version: FILE_VERSION } });
  });

  it('rejects a project without walls with error.badShape', () => {
    const p = defaultProject() as unknown as { wardrobe: Record<string, unknown> };
    delete p.wardrobe.walls;
    const r = parseProjectJson(JSON.stringify({ version: FILE_VERSION, project: p }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.key).toBe('error.badShape');
  });

  it('rejects a wall whose segments are not a pair of arrays', () => {
    const p = defaultProject();
    (p.wardrobe.walls.back as unknown as { segments: unknown }).segments = [[]];
    expect(parseProjectShape(serializeProject(p)).ok).toBe(false);
  });

  it('rejects unknown column kinds and zone types', () => {
    const bad = (mutate: (p: ReturnType<typeof defaultProject>) => void) => {
      const p = defaultProject();
      mutate(p);
      return parseProjectShape(serializeProject(p)).ok;
    };
    expect(bad((p) => { (p.wardrobe.walls.back.segments[0][0] as unknown as { kind: string }).kind = 'shelf'; })).toBe(false);
    expect(bad((p) => {
      const u = p.wardrobe.walls.back.segments[0][0] as { zones: { type: string }[] };
      u.zones[0].type = 'wardrobe';
    })).toBe(false);
    expect(bad((p) => {
      const u = p.wardrobe.walls.back.segments[0][0] as { zones: { height: unknown }[] };
      u.zones[0].height = 'tall';
    })).toBe(false);
  });

  it('accepts a null zone height', () => {
    const p = defaultProject();
    (p.wardrobe.walls.back.segments[0][0] as { zones: { height: number | null }[] }).zones[0].height = null;
    expect(parseProjectShape(serializeProject(p)).ok).toBe(true);
  });

  // The rail placement is optional: a pre-rail file simply has none, and every file that pins one
  // must survive a round trip with both ends of the measurement.
  it('round-trips an explicit rail placement', () => {
    const p = defaultProject();
    const zones = (p.wardrobe.walls.back.segments[0][0] as Unit).zones;
    zones[1].rod = { from: 'bottom', offset: 1200 };
    const r = parseProjectShape(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.project.wardrobe.walls.back.segments[0][0] as Unit).zones[1].rod).toEqual({ from: 'bottom', offset: 1200 });
  });

  it('accepts a project whose zones carry no rail placement', () => {
    const p = defaultProject();
    expect((p.wardrobe.walls.back.segments[0][0] as Unit).zones[0].rod).toBeUndefined();
    expect(parseProjectShape(serializeProject(p)).ok).toBe(true);
  });

  it('rejects a malformed rail placement', () => {
    const bad = (rod: unknown) => {
      const p = defaultProject();
      (p.wardrobe.walls.back.segments[0][0] as Unit).zones[1].rod = rod as never;
      return parseProjectShape(JSON.stringify({ version: FILE_VERSION, project: p })).ok;
    };
    expect(bad({ from: 'middle', offset: 100 })).toBe(false);
    expect(bad({ from: 'top', offset: 'high' })).toBe(false);
    expect(bad({ from: 'top' })).toBe(false);
    expect(bad({ offset: 100 })).toBe(false);
    expect(bad(1200)).toBe(false);
  });

  it('accepts an invalid-but-shaped project by shape and rejects it by validation', () => {
    const p = defaultProject();
    p.room.width = 0;
    const text = serializeProject(p);
    const shape = parseProjectShape(text);
    expect(shape.ok).toBe(true);
    if (shape.ok) expect(shape.project.room.width).toBe(0);
    const full = parseProjectJson(text);
    expect(full.ok).toBe(false);
    if (!full.ok) {
      expect(full.error.key).toBe('error.failsValidation');
      expect(full.reason).toBeDefined();
    }
  });
});

describe('parseErrorText', () => {
  it('renders params', () => {
    expect(parseErrorText('en', { error: msg('error.badVersion', { version: 1 }) }))
      .toBe('Unsupported file version (expected 1)');
  });

  it('resolves the nested reason, including its wall reference', () => {
    expect(
      parseErrorText('en', {
        error: msg('error.failsValidation'),
        reason: msg('error.columnWidth', { wall: 'wall.back', unit: 2, n: 136 }),
      }),
    ).toBe('Project fails validation: Back wall, unit 2: the unit is narrower than 136 mm');
    expect(parseErrorText('ru', { error: msg('error.notJson') })).toBe('Файл не является корректным JSON');
  });
});

describe('storage', () => {
  it('saves and loads a project', () => {
    const storage = memStorage();
    const p = defaultProject();
    p.name = 'Stored';
    saveToStorage(storage, p);
    expect(storage.mem.has(STORAGE_KEY)).toBe(true);
    expect(loadFromStorage(storage)).toEqual(p);
  });

  it('returns null for empty or corrupt storage', () => {
    const storage = memStorage();
    expect(loadFromStorage(storage)).toBeNull();
    storage.setItem(STORAGE_KEY, '{broken');
    expect(loadFromStorage(storage)).toBeNull();
  });

  it('restores an invalid-but-shaped autosave instead of dropping it', () => {
    const storage = memStorage();
    const p = defaultProject();
    p.room.height = 100;
    saveToStorage(storage, p);
    expect(loadFromStorage(storage)?.room.height).toBe(100);
    expect(parseProjectJson(storage.mem.get(STORAGE_KEY)!).ok).toBe(false);
  });

  it('saves and loads the language, ignoring junk', () => {
    const storage = memStorage();
    expect(loadLang(storage)).toBeNull();
    saveLang(storage, 'ru');
    expect(storage.mem.get(LANG_KEY)).toBe('ru');
    expect(loadLang(storage)).toBe('ru');
    storage.setItem(LANG_KEY, 'xx');
    expect(loadLang(storage)).toBeNull();
  });

  it('survives a throwing storage', () => {
    const throwing = {
      getItem: () => { throw new Error('disabled'); },
      setItem: () => { throw new Error('disabled'); },
    };
    expect(loadFromStorage(throwing)).toBeNull();
    expect(loadLang(throwing)).toBeNull();
    expect(() => saveToStorage(throwing, defaultProject())).not.toThrow();
    expect(() => saveLang(throwing, 'en')).not.toThrow();
  });

  it('uses the wardrobe-planner storage keys', () => {
    expect(STORAGE_KEY).toBe('wardrobe-planner:project');
    expect(LANG_KEY).toBe('wardrobe-planner:lang');
    expect(FILE_VERSION).toBe(2);
  });
});

describe('corners in files', () => {
  it('fills missing corners with "none" plans, so pre-corners files load unchanged', () => {
    const p = defaultProject() as unknown as { wardrobe: Record<string, unknown> };
    delete p.wardrobe.corners;
    const r = parseProjectShape(JSON.stringify({ version: FILE_VERSION, project: p }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.wardrobe.corners).toEqual({
      back: { mode: 'none', width: 1000, shelves: 6 },
      right: { mode: 'none', width: 1000, shelves: 6 },
      front: { mode: 'none', width: 1000, shelves: 6 },
      left: { mode: 'none', width: 1000, shelves: 6 },
    });
    expect(parseProjectJson(JSON.stringify({ version: FILE_VERSION, project: p })).ok).toBe(true);
  });

  it('round-trips explicit corner plans', () => {
    const p = defaultProject();
    p.wardrobe.corners.back = { mode: 'lshelf', width: 900, shelves: 4 };
    const r = parseProjectShape(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project.wardrobe.corners.back).toEqual({ mode: 'lshelf', width: 900, shelves: 4 });
  });

  it('rejects a corner mode that is not one of the two, and a malformed corner map', () => {
    const bad = defaultProject() as unknown as { wardrobe: { corners: Record<string, unknown> } };
    bad.wardrobe.corners.back = { mode: 'carousel', width: 900, shelves: 4 };
    expect(parseProjectShape(JSON.stringify({ version: FILE_VERSION, project: bad })).ok).toBe(false);

    const bad2 = defaultProject() as unknown as { wardrobe: { corners: unknown } };
    bad2.wardrobe.corners = { back: { mode: 'none', width: 900, shelves: 1 } }; // only one corner
    expect(parseProjectShape(JSON.stringify({ version: FILE_VERSION, project: bad2 })).ok).toBe(false);
  });
});

describe('v1 -> v2 migration (shelves count = compartments)', () => {
  /** A v1 file: version 1, shelf counts meaning BOARDS, corner shelves meaning boards. */
  const v1File = () => {
    const p = defaultProject();
    p.wardrobe.walls.back.segments[0] = [makeUnit(600, [makeZone('shelves', null, 5), makeZone('drawers', 600, 3)])];
    // a real v1 file counted BOARDS everywhere, corners included
    for (const w of WALLS) p.wardrobe.corners[w] = { mode: 'none', width: 1000, shelves: 5 };
    p.wardrobe.corners.back = { mode: 'lshelf', width: 1000, shelves: 5 };
    return JSON.stringify({ version: 1, project: p });
  };

  it('FILE_VERSION is 2 and that is what gets written', () => {
    expect(FILE_VERSION).toBe(2);
    expect(JSON.parse(serializeProject(defaultProject())).version).toBe(2);
  });

  it('bumps every shelves count and every corner shelf count by one', () => {
    const r = parseProjectShape(v1File());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const unit = r.project.wardrobe.walls.back.segments[0][0];
    expect(unit.kind === 'unit' && unit.zones.map((z) => [z.type, z.count])).toEqual([['shelves', 6], ['drawers', 3]]);
    expect(r.project.wardrobe.corners.back.shelves).toBe(6);
    // untouched corners are bumped too, so a v1 file keeps the geometry it was saved with
    expect(r.project.wardrobe.corners.right.shelves).toBe(6);
  });

  it('keeps the drawn geometry identical across the migration', () => {
    const r = parseProjectShape(v1File());
    if (!r.ok) throw new Error('migration failed');
    const zone = layoutUnit(r.project, 'back', 0, 0, r.project.wardrobe.walls.back.segments[0][0] as Unit, 0).zones[0];
    expect(zone.shelfYs).toHaveLength(5); // the 5 boards the v1 file described
  });

  it('leaves a v2 file alone', () => {
    const p = defaultProject();
    p.wardrobe.corners.back = { mode: 'lshelf', width: 1000, shelves: 6 };
    const r = parseProjectShape(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });

  it('rejects a version that is neither 1 nor 2', () => {
    expect(parseProjectShape(JSON.stringify({ version: 3, project: defaultProject() })).ok).toBe(false);
  });

  it('does not migrate corner defaults invented for a pre-corners v1 file', () => {
    // Such a file never counted corner shelves at all, so the back-filled default must land at
    // the current default (6 compartments), not at the migrated 7.
    const p = defaultProject() as unknown as { wardrobe: Record<string, unknown> };
    delete p.wardrobe.corners;
    const r = parseProjectShape(JSON.stringify({ version: 1, project: p }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const w of WALLS) expect(r.project.wardrobe.corners[w]).toEqual({ mode: 'none', width: 1000, shelves: 6 });
  });

  it('migrates an autosaved v1 project out of localStorage too', () => {
    const s = memStorage();
    s.mem.set(STORAGE_KEY, v1File());
    const p = loadFromStorage(s);
    expect(p).not.toBeNull();
    expect(p!.wardrobe.corners.back.shelves).toBe(6);
  });
});
