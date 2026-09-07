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
    expect(FILE_VERSION).toBe(1);
  });
});
