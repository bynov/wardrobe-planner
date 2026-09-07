import { describe, expect, it, vi } from 'vitest';
import { createPlannerStore, findColumn, startAutosave } from './store';
import { loadFromStorage, loadLang } from './persist';
import { defaultProject } from '../model/defaults';
import { makeZone } from '../model/factory';
import type { Unit } from '../model/types';

const memStorage = () => {
  const mem = new Map<string, string>();
  return { mem, getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
};

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

  it('newProject and loadProject clear history and reset the selection', () => {
    const s = createPlannerStore();
    s.getState().select({ wall: 'left', columnId: backCols(s)[0].id });
    s.getState().setName('X');
    s.getState().newProject();
    expect(s.getState().project.name).toBe(defaultProject().name);
    expect(s.getState().past).toEqual([]);
    expect(s.getState().future).toEqual([]);
    expect(s.getState().ui.selection).toEqual({ wall: 'back', columnId: null, zoneId: null });

    const p = defaultProject();
    p.name = 'Loaded';
    s.getState().setName('Y');
    s.getState().loadProject(p);
    expect(s.getState().project.name).toBe('Loaded');
    expect(s.getState().past).toEqual([]);
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
    });
  });
});

describe('store: autosave', () => {
  it('debounces project writes and persists the language immediately', () => {
    vi.useFakeTimers();
    const storage = memStorage();
    const s = createPlannerStore();
    const stop = startAutosave(s, storage, 100);
    s.getState().setName('A');
    s.getState().setName('B');
    expect(storage.mem.has('wardrobe-planner:project')).toBe(false);
    vi.advanceTimersByTime(150);
    expect(loadFromStorage(storage)?.name).toBe('B');
    s.getState().setLang('ru');
    expect(loadLang(storage)).toBe('ru');
    stop();
    s.getState().setName('C');
    vi.advanceTimersByTime(150);
    expect(loadFromStorage(storage)?.name).toBe('B');
    vi.useRealTimers();
  });
});
