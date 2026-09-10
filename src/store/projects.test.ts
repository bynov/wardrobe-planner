import { describe, expect, it } from 'vitest';
import {
  CURRENT_KEY,
  HINT_KEY,
  INDEX_KEY,
  deleteProject,
  getCurrent,
  listProjects,
  loadProjectById,
  migrateLegacy,
  newProjectId,
  projectKey,
  saveProject,
  setCurrent,
} from './projects';
import { STORAGE_KEY, serializeProject } from './persist';
import { defaultProject } from '../model/defaults';
import { memStorage } from './testStorage';

const named = (name: string) => {
  const p = defaultProject();
  p.name = name;
  return p;
};

describe('project ids', () => {
  it('mints a distinct, key-safe id per call', () => {
    const a = newProjectId(1000);
    const b = newProjectId(1000);
    expect(a).toMatch(/^p[0-9a-z]+$/);
    expect(a).not.toBe(b);
    expect(projectKey(a)).toBe(`wardrobe-planner:project:${a}`);
  });

  it('keeps the storage keys stable', () => {
    expect(INDEX_KEY).toBe('wardrobe-planner:projects');
    expect(CURRENT_KEY).toBe('wardrobe-planner:current');
    expect(HINT_KEY).toBe('wardrobe-planner:hint-dismissed');
  });
});

describe('save / list', () => {
  it('lists both saved projects, newest first, with the names from the projects', () => {
    const s = memStorage();
    expect(saveProject(s, 'a', named('Alpha'), 1000)).toBe(true);
    expect(saveProject(s, 'b', named('Beta'), 2000)).toBe(true);
    expect(listProjects(s)).toEqual([
      { id: 'b', name: 'Beta', updatedAt: 2000 },
      { id: 'a', name: 'Alpha', updatedAt: 1000 },
    ]);
    expect(loadProjectById(s, 'a')?.name).toBe('Alpha');
    expect(loadProjectById(s, 'b')?.name).toBe('Beta');
  });

  it('updates updatedAt and the index name on a rename, without a second entry', () => {
    const s = memStorage();
    saveProject(s, 'a', named('Alpha'), 1000);
    saveProject(s, 'a', named('Renamed'), 3000);
    expect(listProjects(s)).toEqual([{ id: 'a', name: 'Renamed', updatedAt: 3000 }]);
    expect(loadProjectById(s, 'a')?.name).toBe('Renamed');
  });

  it('treats a corrupt or junk index as empty', () => {
    const s = memStorage();
    s.setItem(INDEX_KEY, '{broken');
    expect(listProjects(s)).toEqual([]);
    s.setItem(INDEX_KEY, JSON.stringify([{ id: 'a' }, 42, { id: 'b', name: 'B', updatedAt: 5 }]));
    expect(listProjects(s)).toEqual([{ id: 'b', name: 'B', updatedAt: 5 }]);
  });

  it('returns false when the project write throws, and still saves the project when only the index fails', () => {
    const quota = { ...memStorage(), setItem: () => { throw new Error('quota'); } };
    expect(saveProject(quota, 'a', named('Alpha'), 1000)).toBe(false);

    const s = memStorage();
    const indexOnly = {
      ...s,
      setItem: (k: string, v: string) => {
        if (k === INDEX_KEY) throw new Error('quota');
        s.setItem(k, v);
      },
    };
    expect(saveProject(indexOnly, 'a', named('Alpha'), 1000)).toBe(false);
    expect(loadProjectById(s, 'a')?.name).toBe('Alpha');
  });
});

describe('load by id', () => {
  it('returns null for a missing or corrupt project', () => {
    const s = memStorage();
    expect(loadProjectById(s, 'nope')).toBeNull();
    s.setItem(projectKey('bad'), '{broken');
    expect(loadProjectById(s, 'bad')).toBeNull();
    s.setItem(projectKey('shape'), JSON.stringify({ version: 2, project: { name: 'x' } }));
    expect(loadProjectById(s, 'shape')).toBeNull();
  });
});

describe('current project', () => {
  it('reads back what was set, and null when unset', () => {
    const s = memStorage();
    expect(getCurrent(s)).toBeNull();
    setCurrent(s, 'a');
    expect(getCurrent(s)).toBe('a');
  });
});

describe('delete', () => {
  it('removes the key and the index entry, and clears the current id when it pointed there', () => {
    const s = memStorage();
    saveProject(s, 'a', named('Alpha'), 1000);
    saveProject(s, 'b', named('Beta'), 2000);
    setCurrent(s, 'a');

    deleteProject(s, 'a');
    expect(s.mem.has(projectKey('a'))).toBe(false);
    expect(listProjects(s)).toEqual([{ id: 'b', name: 'Beta', updatedAt: 2000 }]);
    expect(getCurrent(s)).toBeNull();

    setCurrent(s, 'b');
    deleteProject(s, 'a');
    expect(getCurrent(s)).toBe('b');
  });
});

describe('legacy migration', () => {
  it('moves the single legacy project into the index, sets it current and drops the legacy key', () => {
    const s = memStorage();
    s.setItem(STORAGE_KEY, serializeProject(named('Legacy')));

    const id = migrateLegacy(s, 1000);
    expect(id).not.toBeNull();
    expect(listProjects(s)).toEqual([{ id, name: 'Legacy', updatedAt: 1000 }]);
    expect(loadProjectById(s, id!)?.name).toBe('Legacy');
    expect(s.mem.has(STORAGE_KEY)).toBe(false);
    expect(getCurrent(s)).toBe(id);

    expect(migrateLegacy(s, 2000)).toBeNull();
  });

  it('returns null with no legacy key, with a corrupt one, or when an index already exists', () => {
    const empty = memStorage();
    expect(migrateLegacy(empty, 1000)).toBeNull();

    const corrupt = memStorage();
    corrupt.setItem(STORAGE_KEY, '{broken');
    expect(migrateLegacy(corrupt, 1000)).toBeNull();
    expect(listProjects(corrupt)).toEqual([]);

    const indexed = memStorage();
    saveProject(indexed, 'a', named('Alpha'), 500);
    indexed.setItem(STORAGE_KEY, serializeProject(named('Legacy')));
    expect(migrateLegacy(indexed, 1000)).toBeNull();
    expect(listProjects(indexed)).toEqual([{ id: 'a', name: 'Alpha', updatedAt: 500 }]);
    expect(indexed.mem.has(STORAGE_KEY)).toBe(true);
  });
});

describe('a throwing storage', () => {
  const throwing = {
    getItem: () => { throw new Error('disabled'); },
    setItem: () => { throw new Error('disabled'); },
    removeItem: () => { throw new Error('disabled'); },
  };

  it('never escapes as an exception', () => {
    expect(listProjects(throwing)).toEqual([]);
    expect(loadProjectById(throwing, 'a')).toBeNull();
    expect(getCurrent(throwing)).toBeNull();
    expect(saveProject(throwing, 'a', defaultProject(), 1000)).toBe(false);
    expect(() => setCurrent(throwing, 'a')).not.toThrow();
    expect(() => deleteProject(throwing, 'a')).not.toThrow();
    expect(migrateLegacy(throwing, 1000)).toBeNull();
  });
});
