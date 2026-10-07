import { describe, expect, it, vi } from 'vitest';
import { bootstrap, createPlannerStore, findColumn, startAutosave } from './store';
import { STORAGE_KEY, loadLang, loadUnits, saveToStorage } from './persist';
import { getCurrent, listProjects, loadProjectById, projectKey, saveProject, setCurrent } from './projects';
import { defaultProject } from '../model/defaults';
import { makeTemplate } from '../model/templates';
import { t } from '../i18n';
import { makeGap, makeZone } from '../model/factory';
import type { Project, Unit } from '../model/types';
import { memStorage } from './testStorage';

const backCols = (s: ReturnType<typeof createPlannerStore>) => s.getState().project.wardrobe.walls.back.segments[0];
const unitAt = (s: ReturnType<typeof createPlannerStore>, i: number) => backCols(s)[i] as Unit;

describe('findColumn', () => {
  it('locates a column by id and returns null for an unknown id', () => {
    const p = defaultProject();
    const target = p.wardrobe.walls.right.segments[0][1];
    expect(findColumn(p, target.id)).toEqual({ wall: 'right', segment: 0, index: 1, column: target });
    expect(findColumn(p, 'nope')).toBeNull();
  });
});

describe('store: insertPreset', () => {
  it('toasts toast.noRoom and inserts nothing when the segment is full', () => {
    const s = createPlannerStore();
    expect(backCols(s)).toHaveLength(4); // 4 x 600 = 2400 = the whole back wall
    s.getState().insertPreset('back', 0, 0, 'shelves');
    expect(backCols(s)).toHaveLength(4);
    expect(s.getState().ui.toast).toEqual({ key: 'toast.noRoom' });
    expect(s.getState().past).toHaveLength(0);
  });

  it('inserts a 600 mm preset at the given index and selects it', () => {
    const s = createPlannerStore();
    s.getState().removeColumn(backCols(s)[0].id);
    s.getState().insertPreset('back', 0, 1, 'shelves');
    const cols = backCols(s);
    expect(cols).toHaveLength(4);
    expect(cols[1].width).toBe(600);
    expect((cols[1] as Unit).zones[0].type).toBe('shelves');
    expect(s.getState().ui.selection).toEqual({ wall: 'back', columnId: cols[1].id, zoneId: null });
  });

  it('clamps the width to the free space', () => {
    const s = createPlannerStore();
    s.getState().removeColumn(backCols(s)[0].id); // 1800 used
    s.getState().setRoom({ width: 2150 }); // free = 350
    s.getState().insertPreset('back', 0, 0, 'shelves');
    expect(backCols(s)[0].width).toBe(350);
  });

  it('refuses a unit but allows a gap when free is below the minimum unit width', () => {
    const s = createPlannerStore();
    s.getState().removeColumn(backCols(s)[0].id); // 1800 used
    s.getState().setRoom({ width: 1850 }); // free = 50, minUnitWidth = 136
    s.getState().insertPreset('back', 0, 0, 'shelves');
    expect(backCols(s)).toHaveLength(3);
    expect(s.getState().ui.toast).toEqual({ key: 'toast.noRoom' });
    s.getState().insertPreset('back', 0, 0, 'gap');
    expect(backCols(s)).toHaveLength(4);
    expect(backCols(s)[0]).toMatchObject({ kind: 'gap', width: 50 });
  });

  it('inserts into the second segment of the door wall', () => {
    const s = createPlannerStore();
    s.getState().insertPreset('front', 1, 0, 'shelves');
    const cols = s.getState().project.wardrobe.walls.front.segments[1];
    expect(cols).toHaveLength(1);
    expect(cols[0].width).toBe(600);
    expect(s.getState().ui.selection.wall).toBe('front');
  });
});

describe('store: columns', () => {
  it('moveColumn swaps neighbours and refuses at the edges', () => {
    const s = createPlannerStore();
    const [a, b, , d] = backCols(s);
    s.getState().moveColumn(b.id, -1);
    expect(backCols(s).map((c) => c.id).slice(0, 2)).toEqual([b.id, a.id]);
    const history = s.getState().past.length;
    s.getState().moveColumn(b.id, -1); // already first
    expect(backCols(s)[0].id).toBe(b.id);
    s.getState().moveColumn(d.id, 1); // already last
    expect(backCols(s)[3].id).toBe(d.id);
    s.getState().moveColumn('nope', 1); // unknown id
    expect(s.getState().past).toHaveLength(history); // no-ops create no undo entries
  });

  it('moveColumn never moves a column into the neighbouring segment', () => {
    const s = createPlannerStore();
    s.getState().insertPreset('front', 0, 0, 'shelves');
    s.getState().insertPreset('front', 1, 0, 'shelves');
    const front = s.getState().project.wardrobe.walls.front.segments;
    const first = front[0][0];
    s.getState().moveColumn(first.id, 1);
    const after = s.getState().project.wardrobe.walls.front.segments;
    expect(after[0].map((c) => c.id)).toEqual([first.id]);
    expect(after[1]).toHaveLength(1);
  });

  it('duplicateColumn inserts a copy right after the original with a new id and selects it', () => {
    const s = createPlannerStore();
    const original = unitAt(s, 1);
    s.getState().duplicateColumn(original.id);
    const cols = backCols(s);
    expect(cols).toHaveLength(5);
    const copy = cols[2] as Unit;
    expect(copy.id).not.toBe(original.id);
    expect(copy.width).toBe(original.width);
    expect(copy.zones.map((z) => z.type)).toEqual(original.zones.map((z) => z.type));
    expect(copy.zones[0].id).not.toBe(original.zones[0].id);
    expect(s.getState().ui.selection.columnId).toBe(copy.id);
  });

  it('updateColumn changes the width', () => {
    const s = createPlannerStore();
    const id = backCols(s)[0].id;
    s.getState().updateColumn(id, { width: 550 });
    expect(backCols(s)[0].width).toBe(550);
  });

  it('removeColumn clears the selection that pointed at it', () => {
    const s = createPlannerStore();
    const col = unitAt(s, 0);
    s.getState().select({ wall: 'back', columnId: col.id, zoneId: col.zones[0].id });
    s.getState().removeColumn(col.id);
    expect(backCols(s).find((c) => c.id === col.id)).toBeUndefined();
    expect(s.getState().ui.selection).toEqual({ wall: 'back', columnId: null, zoneId: null });
  });

  it('removeColumn keeps a selection that pointed elsewhere', () => {
    const s = createPlannerStore();
    const keep = unitAt(s, 2);
    s.getState().select({ wall: 'back', columnId: keep.id, zoneId: keep.zones[0].id });
    s.getState().removeColumn(backCols(s)[0].id);
    expect(s.getState().ui.selection).toEqual({ wall: 'back', columnId: keep.id, zoneId: keep.zones[0].id });
  });
});

describe('store: zones', () => {
  it('addZone appends on top', () => {
    const s = createPlannerStore();
    const col = unitAt(s, 0);
    const before = col.zones.length;
    s.getState().addZone(col.id, makeZone('open'));
    const zones = unitAt(s, 0).zones;
    expect(zones).toHaveLength(before + 1);
    expect(zones[zones.length - 1].type).toBe('open');
  });

  it('updateZone patches the height', () => {
    const s = createPlannerStore();
    const col = unitAt(s, 0);
    s.getState().updateZone(col.id, col.zones[0].id, { height: 700 });
    expect(unitAt(s, 0).zones[0].height).toBe(700);
    s.getState().updateZone(col.id, col.zones[0].id, { height: null });
    expect(unitAt(s, 0).zones[0].height).toBeNull();
  });

  it('updateZone pins and clears the rail placement', () => {
    const s = createPlannerStore();
    const col = unitAt(s, 0);
    const zoneId = col.zones[1].id;
    s.getState().updateZone(col.id, zoneId, { rod: { from: 'bottom', offset: 1200 } });
    expect(unitAt(s, 0).zones[1].rod).toEqual({ from: 'bottom', offset: 1200 });
    // Back to auto: the key goes away entirely rather than lingering as an explicit undefined.
    s.getState().updateZone(col.id, zoneId, { rod: undefined });
    expect('rod' in unitAt(s, 0).zones[1]).toBe(false);
  });

  it('updateZone leaves an existing rail alone when the patch does not mention it', () => {
    const s = createPlannerStore();
    const col = unitAt(s, 0);
    const zoneId = col.zones[1].id;
    s.getState().updateZone(col.id, zoneId, { rod: { from: 'top', offset: 250 } });
    s.getState().updateZone(col.id, zoneId, { height: 900 });
    expect(unitAt(s, 0).zones[1].rod).toEqual({ from: 'top', offset: 250 });
  });

  it('moveZone +1 moves towards the top', () => {
    const s = createPlannerStore();
    const col = unitAt(s, 0);
    const [bottom, top] = col.zones;
    s.getState().moveZone(col.id, bottom.id, 1);
    expect(unitAt(s, 0).zones.map((z) => z.id)).toEqual([top.id, bottom.id]);
    s.getState().moveZone(col.id, bottom.id, 1); // already on top
    expect(unitAt(s, 0).zones.map((z) => z.id)).toEqual([top.id, bottom.id]);
    const history = s.getState().past.length;
    s.getState().moveZone(col.id, top.id, -1); // already at the bottom
    expect(unitAt(s, 0).zones.map((z) => z.id)).toEqual([top.id, bottom.id]);
    s.getState().moveZone(col.id, 'nope', 1); // unknown zone
    expect(s.getState().past).toHaveLength(history);
  });

  it('removeZone keeps the column selected', () => {
    const s = createPlannerStore();
    const col = unitAt(s, 0);
    s.getState().select({ wall: 'back', columnId: col.id, zoneId: col.zones[0].id });
    s.getState().removeZone(col.id, col.zones[0].id);
    expect(unitAt(s, 0).zones.map((z) => z.id)).toEqual([col.zones[1].id]);
    expect(s.getState().ui.selection).toEqual({ wall: 'back', columnId: col.id, zoneId: null });
  });
});

describe('store: history', () => {
  it('undo restores the previous project and redo re-applies it', () => {
    const s = createPlannerStore();
    const before = s.getState().project;
    s.getState().setName('Renamed');
    expect(s.getState().past).toEqual([before]);
    expect(s.getState().future).toEqual([]);
    const after = s.getState().project;

    s.getState().undo();
    expect(s.getState().project).toBe(before);
    expect(s.getState().past).toEqual([]);
    expect(s.getState().future).toEqual([after]);

    s.getState().redo();
    expect(s.getState().project).toBe(after);
    expect(s.getState().project.name).toBe('Renamed');
    expect(s.getState().future).toEqual([]);
  });

  it('undo/redo at the ends of the history are no-ops', () => {
    const s = createPlannerStore();
    const p = s.getState().project;
    s.getState().undo();
    s.getState().redo();
    expect(s.getState().project).toBe(p);
  });

  it('a new edit clears the redo stack', () => {
    const s = createPlannerStore();
    s.getState().setName('A');
    s.getState().undo();
    expect(s.getState().future).toHaveLength(1);
    s.getState().setName('B');
    expect(s.getState().future).toEqual([]);
  });

  it('caps the undo stack at 100 entries', () => {
    const s = createPlannerStore();
    for (let i = 0; i < 120; i++) s.getState().setName(`n${i}`);
    expect(s.getState().past).toHaveLength(100);
    expect(s.getState().past[99].name).toBe('n118');
  });

  it('undo cleans a selection whose column disappears', () => {
    const s = createPlannerStore();
    s.getState().removeColumn(backCols(s)[0].id);
    s.getState().insertPreset('back', 0, 0, 'shelves');
    expect(s.getState().ui.selection.columnId).not.toBeNull();
    s.getState().undo();
    expect(s.getState().ui.selection).toEqual({ wall: 'back', columnId: null, zoneId: null });
  });

  it('newProject clears history and resets the selection', () => {
    const s = createPlannerStore();
    s.getState().select({ wall: 'left', columnId: backCols(s)[0].id });
    s.getState().setName('X');
    s.getState().newProject();
    expect(s.getState().project.name).toBe(defaultProject().name);
    expect(s.getState().past).toEqual([]);
    expect(s.getState().future).toEqual([]);
    expect(s.getState().ui.selection).toEqual({ wall: 'back', columnId: null, zoneId: null });
  });
});

describe('store: validation', () => {
  it('reports errors and keeps lastValid when an edit makes the project invalid', () => {
    const s = createPlannerStore();
    const before = s.getState().project;
    expect(s.getState().errors).toEqual([]);
    s.getState().setRoom({ width: 0 });
    expect(s.getState().errors.length).toBeGreaterThan(0);
    expect(s.getState().lastValid).toBe(before);
    s.getState().setRoom({ width: 2400 });
    expect(s.getState().errors).toEqual([]);
    expect(s.getState().lastValid).toBe(s.getState().project);
  });

  it('re-validates on undo', () => {
    const s = createPlannerStore();
    s.getState().setRoom({ height: 100 });
    expect(s.getState().errors.length).toBeGreaterThan(0);
    s.getState().undo();
    expect(s.getState().errors).toEqual([]);
  });
});

describe('store: ui and settings', () => {
  it('setDoor, setWardrobe, setWall and setUi patch their slices', () => {
    const s = createPlannerStore();
    s.getState().setDoor({ offset: 900 });
    expect(s.getState().project.door.offset).toBe(900);
    s.getState().setWardrobe({ plinthHeight: 120 });
    expect(s.getState().project.wardrobe.plinthHeight).toBe(120);
    s.getState().setWall('front', { enabled: true, depth: 450 });
    expect(s.getState().project.wardrobe.walls.front).toMatchObject({ enabled: true, depth: 450 });
    expect(s.getState().project.wardrobe.walls.front.segments).toEqual([[], []]);
    s.getState().setUi({ tab: 'cutlist', explode: 0.5 });
    expect(s.getState().ui.tab).toBe('cutlist');
    expect(s.getState().ui.explode).toBe(0.5);
  });

  it('toast and setLang', () => {
    const s = createPlannerStore(defaultProject(), 'ru');
    expect(s.getState().ui.lang).toBe('ru');
    s.getState().toast({ key: 'toast.imported' });
    expect(s.getState().ui.toast).toEqual({ key: 'toast.imported' });
    s.getState().toast(null);
    expect(s.getState().ui.toast).toBeNull();
    s.getState().setLang('en');
    expect(s.getState().ui.lang).toBe('en');
  });

  it('setUnits flips the display units, defaulting to mm', () => {
    expect(createPlannerStore().getState().ui.units).toBe('mm');
    const s = createPlannerStore(defaultProject(), 'en', 'in');
    expect(s.getState().ui.units).toBe('in');
    s.getState().setUnits('mm');
    expect(s.getState().ui.units).toBe('mm');
  });

  it('starts on the design tab with nothing selected', () => {
    const s = createPlannerStore();
    expect(s.getState().ui).toMatchObject({
      tab: 'design',
      selection: { wall: 'back', columnId: null, zoneId: null },
      showDims: true,
      showRoom: true,
      explode: 0,
      toast: null,
      lang: 'en',
      units: 'mm',
    });
  });
});

describe('store: autosave', () => {
  it('debounces project writes and persists the language and units immediately', () => {
    vi.useFakeTimers();
    const storage = memStorage();
    const s = createPlannerStore(defaultProject(), 'en', 'mm', 'p0', storage);
    const stop = startAutosave(s, storage, 100);
    s.getState().setName('A');
    s.getState().setName('B');
    expect(storage.mem.has(projectKey('p0'))).toBe(false);
    vi.advanceTimersByTime(150);
    expect(loadProjectById(storage, 'p0')?.name).toBe('B');
    s.getState().setLang('ru');
    expect(loadLang(storage)).toBe('ru');
    expect(loadUnits(storage)).toBeNull();
    s.getState().setUnits('in');
    expect(loadUnits(storage)).toBe('in');
    stop();
    s.getState().setName('C');
    vi.advanceTimersByTime(150);
    expect(loadProjectById(storage, 'p0')?.name).toBe('B');
    vi.useRealTimers();
  });
});

describe('store: a gap\'s wall-mounted rail', () => {
  const gapStore = () => {
    const s = createPlannerStore();
    s.getState().insertColumn('right', 0, 0, makeGap(600));
    return s;
  };

  it('updateColumn sets and clears the rail, and unticking drops the key', () => {
    const s = gapStore();
    const id = s.getState().project.wardrobe.walls.right.segments[0][0].id;
    s.getState().updateColumn(id, { rail: { dir: 'along', height: 2000 } });
    const gap = () => s.getState().project.wardrobe.walls.right.segments[0][0] as { kind: 'gap'; rail?: unknown };
    expect(gap().rail).toEqual({ dir: 'along', height: 2000 });
    s.getState().updateColumn(id, { rail: { dir: 'across', height: 1800 } });
    expect(gap().rail).toEqual({ dir: 'across', height: 1800 });
    s.getState().updateColumn(id, { rail: undefined });
    expect('rail' in gap()).toBe(false);
  });

  it('an empty patch is still a no-op, so it makes no history entry', () => {
    const s = gapStore();
    const id = s.getState().project.wardrobe.walls.right.segments[0][0].id;
    const before = s.getState().past.length;
    s.getState().updateColumn(id, {});
    expect(s.getState().past).toHaveLength(before);
  });

  it('width and rail edits are both undoable', () => {
    const s = gapStore();
    const id = s.getState().project.wardrobe.walls.right.segments[0][0].id;
    s.getState().updateColumn(id, { rail: { dir: 'along', height: 2000 } });
    s.getState().updateColumn(id, { width: 700 });
    s.getState().undo();
    const gap = s.getState().project.wardrobe.walls.right.segments[0][0] as { width: number; rail?: unknown };
    expect(gap.width).toBe(600);
    expect(gap.rail).toEqual({ dir: 'along', height: 2000 });
  });
});

describe('store: projects', () => {
  const named = (name: string) => ({ ...defaultProject(), name });
  /** Column and zone ids are freshly generated, so a template only ever matches id-free. */
  const idless = (p: Project): unknown => JSON.parse(JSON.stringify(p, (k, v: unknown) => (k === 'id' ? undefined : v)));
  const withStorage = (id: string, project = defaultProject()) => {
    const storage = memStorage();
    return { storage, store: (p = project) => createPlannerStore(p, 'en', 'mm', id, storage) };
  };

  describe('bootstrap', () => {
    it('opens the L-shape starter template on empty storage and stores it', () => {
      const storage = memStorage();
      const first = bootstrap(storage);
      expect(first.firstRun).toBe(true);
      expect(first.projectId).toEqual(expect.any(String));
      expect(first.project.name).toBe(t('en', 'template.lShape'));
      expect(idless(first.project)).toEqual(idless(makeTemplate('lShape', t('en', 'template.lShape'))));

      // Stored and current, so a reload finds it instead of starting over.
      expect(loadProjectById(storage, first.projectId)?.name).toBe(first.project.name);
      expect(getCurrent(storage)).toBe(first.projectId);
      const again = bootstrap(storage);
      expect(again.firstRun).toBe(false);
      expect(again.projectId).toBe(first.projectId);
    });

    it('names the starter template in the given language', () => {
      expect(bootstrap(memStorage(), 'ru').project.name).toBe(t('ru', 'template.lShape'));
    });

    it('reopens a saved project instead of the template', () => {
      const storage = memStorage();
      saveProject(storage, 'p1', named('Saved'));
      const again = bootstrap(storage);
      expect(again.firstRun).toBe(false);
      expect(again.projectId).toBe('p1');
      expect(again.project.name).toBe('Saved');
    });

    it('prefers the current id, and falls back to the newest project', () => {
      const storage = memStorage();
      saveProject(storage, 'old', named('Old'), 1000);
      saveProject(storage, 'new', named('New'), 2000);
      expect(bootstrap(storage).projectId).toBe('new'); // saveProject leaves no current id
      setCurrent(storage, 'old');
      expect(bootstrap(storage).projectId).toBe('old');
    });

    it('falls back to the newest project when the current id is a phantom', () => {
      const storage = memStorage();
      saveProject(storage, 'real', named('Real'), 1000);
      setCurrent(storage, 'gone');
      expect(bootstrap(storage).project.name).toBe('Real');
    });

    it('drops the index row when the current project payload is gone', () => {
      const storage = memStorage();
      saveProject(storage, 'real', named('Real'), 500);
      saveProject(storage, 'ghost', named('Ghost'), 1000);
      storage.mem.delete(projectKey('ghost'));
      setCurrent(storage, 'ghost');
      const b = bootstrap(storage);
      expect(b.projectId).toBe('real');
      expect(b.project.name).toBe('Real');
      expect(listProjects(storage).map((m) => m.id)).toEqual(['real']);
    });

    it('migrates the legacy single-project key', () => {
      const storage = memStorage();
      saveToStorage(storage, named('Legacy'));
      const b = bootstrap(storage);
      expect(b.firstRun).toBe(false);
      expect(b.project.name).toBe('Legacy');
      expect(storage.mem.has(STORAGE_KEY)).toBe(false);
    });

    it('is a first run with no storage at all', () => {
      expect(bootstrap(null).firstRun).toBe(true);
    });
  });

  it('opening another project retires the first-run hint', () => {
    const { storage, store } = withStorage('p0');
    const s = store();
    s.setState((st) => ({ ui: { ...st.ui, firstRun: true } }));
    saveProject(storage, 'p1', named('Other'));
    s.getState().switchProject('p1');
    expect(s.getState().ui.firstRun).toBe(false);
    // and a brand new one retires it just the same
    s.setState((st) => ({ ui: { ...st.ui, firstRun: true } }));
    s.getState().newProject();
    expect(s.getState().ui.firstRun).toBe(false);
  });

  it('createProject saves and selects it, clearing history and selection', () => {
    const { storage, store } = withStorage('p0');
    const s = store();
    s.getState().setName('Zero');
    s.getState().select({ wall: 'right', columnId: 'whatever' });
    s.getState().createProject(named('Second'));

    const id = s.getState().ui.projectId;
    expect(id).not.toBe('p0');
    expect(s.getState().project.name).toBe('Second');
    expect(s.getState().past).toEqual([]);
    expect(s.getState().future).toEqual([]);
    expect(s.getState().ui.selection).toEqual({ wall: 'back', columnId: null, zoneId: null });
    expect(loadProjectById(storage, id)?.name).toBe('Second'); // saved before autosave ever runs
    expect(getCurrent(storage)).toBe(id);
    expect(s.getState().projects.map((m) => m.name)).toEqual(['Second']);
  });

  it('an imported project lands beside the open one, which keeps its stored contents', () => {
    const storage = memStorage();
    saveProject(storage, 'p0', named('Mine'), 1000);
    const s = createPlannerStore(named('Mine'), 'en', 'mm', 'p0', storage);
    // What TopBar's JSON import does: a shape-valid file becomes a project of its own.
    s.getState().createProject(named('Imported'));

    const id = s.getState().ui.projectId;
    expect(id).not.toBe('p0');
    expect(s.getState().project.name).toBe('Imported');
    expect(loadProjectById(storage, 'p0')?.name).toBe('Mine'); // the project that was open is untouched
    expect(loadProjectById(storage, id)?.name).toBe('Imported');
    expect(s.getState().projects.map((m) => m.name).sort()).toEqual(['Imported', 'Mine']);
  });

  it('createProject with select: false saves without leaving the current project', () => {
    const { storage, store } = withStorage('p0', named('Here'));
    const s = store();
    s.getState().createProject(named('Aside'), { select: false });
    expect(s.getState().project.name).toBe('Here');
    expect(s.getState().ui.projectId).toBe('p0');
    expect(s.getState().projects.map((m) => m.name)).toEqual(['Aside']);
    expect(listProjects(storage)).toHaveLength(1);
  });

  it('newProject creates a fresh default project', () => {
    const { store } = withStorage('p0');
    const s = store();
    s.getState().setName('Renamed');
    s.getState().newProject();
    expect(s.getState().project.name).toBe(defaultProject().name);
    expect(s.getState().ui.projectId).not.toBe('p0');
  });

  it('switchProject loads the other project and resets history', () => {
    const { storage, store } = withStorage('p0');
    saveProject(storage, 'p1', named('One'), 1000);
    const s = store();
    s.getState().setName('Zero');
    s.getState().switchProject('p1');
    expect(s.getState().project.name).toBe('One');
    expect(s.getState().ui.projectId).toBe('p1');
    expect(s.getState().past).toEqual([]);
    expect(getCurrent(storage)).toBe('p1');
  });

  it('switchProject drops an index entry whose payload is missing and toasts', () => {
    const { storage, store } = withStorage('p0', named('Here'));
    saveProject(storage, 'ghost', named('Ghost'), 1000);
    storage.mem.delete(projectKey('ghost'));
    const s = store();
    s.getState().switchProject('ghost');
    expect(s.getState().project.name).toBe('Here'); // stays put
    expect(s.getState().ui.projectId).toBe('p0');
    expect(s.getState().ui.toast).toEqual({ key: 'toast.projectMissing' });
    expect(s.getState().projects).toEqual([]);
    expect(listProjects(storage)).toEqual([]);
  });

  it('duplicateProject copies under a new id with a "(copy)" name and selects it', () => {
    const { storage, store } = withStorage('p1', named('One'));
    saveProject(storage, 'p1', named('One'), 1000);
    const s = store();
    s.getState().duplicateProject('p1');
    const id = s.getState().ui.projectId;
    expect(id).not.toBe('p1');
    expect(s.getState().project.name).toBe('One (copy)');
    expect(loadProjectById(storage, 'p1')?.name).toBe('One'); // the original is untouched
    expect(s.getState().projects.map((m) => m.name).sort()).toEqual(['One', 'One (copy)']);
  });

  it('deleteProject of the current one opens the newest of the rest', () => {
    const { storage, store } = withStorage('cur', named('Cur'));
    saveProject(storage, 'old', named('Old'), 1000);
    saveProject(storage, 'newer', named('Newer'), 2000);
    saveProject(storage, 'cur', named('Cur'), 3000);
    const s = store();
    s.getState().deleteProject('cur');
    expect(s.getState().ui.projectId).toBe('newer');
    expect(s.getState().project.name).toBe('Newer');
    expect(s.getState().projects.map((m) => m.id)).toEqual(['newer', 'old']);
    expect(loadProjectById(storage, 'cur')).toBeNull();
  });

  it('deleteProject of another one leaves the current project alone', () => {
    const { storage, store } = withStorage('cur', named('Cur'));
    saveProject(storage, 'cur', named('Cur'), 2000);
    saveProject(storage, 'other', named('Other'), 1000);
    const s = store();
    s.getState().deleteProject('other');
    expect(s.getState().ui.projectId).toBe('cur');
    expect(s.getState().project.name).toBe('Cur');
    expect(s.getState().projects.map((m) => m.id)).toEqual(['cur']);
  });

  it('deleting the last project leaves a fresh default one behind', () => {
    const { storage, store } = withStorage('only', named('Only'));
    saveProject(storage, 'only', named('Only'), 1000);
    const s = store();
    s.getState().deleteProject('only');
    expect(s.getState().ui.projectId).not.toBe('only');
    expect(s.getState().project.name).toBe(defaultProject().name);
    expect(s.getState().projects).toHaveLength(1);
    expect(listProjects(storage)[0].id).toBe(s.getState().ui.projectId);
  });

  it('the actions are graceful no-ops without storage', () => {
    const s = createPlannerStore(named('Alone'), 'en', 'mm', 'p0');
    s.getState().switchProject('p1');
    s.getState().duplicateProject('p0');
    s.getState().deleteProject('p0');
    expect(s.getState().project.name).toBe('Alone');
    expect(s.getState().projects).toEqual([]);
  });

  it('createProject says so when the new project could not be stored', () => {
    const storage = memStorage();
    const failing = { ...storage, setItem: () => { throw new Error('quota'); } };
    const s = createPlannerStore(defaultProject(), 'en', 'mm', 'p0', failing);
    s.getState().createProject(named('Doomed'));
    expect(s.getState().project.name).toBe('Doomed'); // still opened, so the work is not lost
    expect(s.getState().ui.toast).toEqual({ key: 'toast.storageFull' });
  });

  it('autosave writes under the current project id and refreshes the index', () => {
    vi.useFakeTimers();
    const { storage, store } = withStorage('p1');
    const s = store();
    const stop = startAutosave(s, storage, 100);
    s.getState().setName('Renamed');
    vi.advanceTimersByTime(150);
    expect(loadProjectById(storage, 'p1')?.name).toBe('Renamed');
    expect(s.getState().projects[0]).toMatchObject({ id: 'p1', name: 'Renamed' });
    expect(storage.mem.has(STORAGE_KEY)).toBe(false); // never the legacy key any more

    s.getState().createProject(named('Next'));
    const id = s.getState().ui.projectId;
    s.getState().setName('Next edited');
    vi.advanceTimersByTime(150);
    expect(loadProjectById(storage, id)?.name).toBe('Next edited');
    expect(loadProjectById(storage, 'p1')?.name).toBe('Renamed'); // the old one is left as it was
    stop();
    vi.useRealTimers();
  });

  it('autosave flushes a pending edit under the outgoing id when another project is opened', () => {
    vi.useFakeTimers();
    const storage = memStorage();
    saveProject(storage, 'p1', named('One'), 1000);
    saveProject(storage, 'p2', named('Two'), 5000);
    const s = createPlannerStore(named('One'), 'en', 'mm', 'p1', storage);
    const stop = startAutosave(s, storage, 100);

    s.getState().setName('One edited');
    vi.advanceTimersByTime(50); // still inside the debounce
    s.getState().switchProject('p2');
    expect(loadProjectById(storage, 'p1')?.name).toBe('One edited'); // the outgoing edit survived
    expect(s.getState().project.name).toBe('Two');
    expect(listProjects(storage).find((m) => m.id === 'p2')?.updatedAt).toBe(5000);

    vi.advanceTimersByTime(200); // the cancelled timer never writes the incoming project
    expect(loadProjectById(storage, 'p2')?.name).toBe('Two');
    expect(listProjects(storage).find((m) => m.id === 'p2')?.updatedAt).toBe(5000);
    stop();
    vi.useRealTimers();
  });

  it('autosave does not resurrect the project that was just deleted', () => {
    vi.useFakeTimers();
    const storage = memStorage();
    saveProject(storage, 'p1', named('One'), 1000);
    saveProject(storage, 'p2', named('Two'), 500);
    const s = createPlannerStore(named('One'), 'en', 'mm', 'p1', storage);
    const stop = startAutosave(s, storage, 100);

    s.getState().setName('One edited');
    vi.advanceTimersByTime(50); // still inside the debounce
    s.getState().deleteProject('p1');
    expect(s.getState().ui.projectId).toBe('p2');
    expect(storage.mem.has(projectKey('p1'))).toBe(false);
    expect(listProjects(storage).map((m) => m.id)).toEqual(['p2']);

    vi.advanceTimersByTime(200);
    expect(storage.mem.has(projectKey('p1'))).toBe(false);
    expect(listProjects(storage).map((m) => m.id)).toEqual(['p2']);
    expect(loadProjectById(storage, 'p2')?.name).toBe('Two');
    stop();
    vi.useRealTimers();
  });

  it('autosave toasts toast.storageFull once per failure run', () => {
    vi.useFakeTimers();
    const storage = memStorage();
    let full = true;
    const failing = { ...storage, setItem: (k: string, v: string) => { if (full) throw new Error('quota'); storage.setItem(k, v); } };
    const s = createPlannerStore(defaultProject(), 'en', 'mm', 'p1', failing);
    const stop = startAutosave(s, failing, 100);

    s.getState().setName('A');
    vi.advanceTimersByTime(150);
    expect(s.getState().ui.toast).toEqual({ key: 'toast.storageFull' });

    s.getState().toast(null);
    s.getState().setName('B');
    vi.advanceTimersByTime(150);
    expect(s.getState().ui.toast).toBeNull(); // not once per keystroke

    full = false;
    s.getState().setName('C');
    vi.advanceTimersByTime(150);
    expect(loadProjectById(storage, 'p1')?.name).toBe('C');

    full = true;
    s.getState().setName('D');
    vi.advanceTimersByTime(150);
    expect(s.getState().ui.toast).toEqual({ key: 'toast.storageFull' });
    stop();
    vi.useRealTimers();
  });
});
