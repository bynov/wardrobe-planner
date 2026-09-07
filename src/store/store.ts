import { create } from 'zustand';
import { WALLS, minUnitWidth, segmentFree, wallSegments } from '../geometry/frames';
import { detectLang, msg, type Lang, type Msg } from '../i18n';
import { defaultProject } from '../model/defaults';
import { cloneColumn } from '../model/factory';
import { GAP_DEFAULT_WIDTH, PRESET_DEFAULT_WIDTH, makePreset, type PresetKey } from '../model/presets';
import type { Column, Door, Gap, Project, Room, ValidationError, Wall, WallPlan, Wardrobe, Zone } from '../model/types';
import { validate } from '../model/validate';
import { loadFromStorage, loadLang, saveLang, saveToStorage, type StorageLike } from './persist';

export type Tab = 'design' | '3d' | 'cutlist';

export interface Selection {
  wall: Wall;
  columnId: string | null;
  zoneId: string | null;
}

export interface UiState {
  tab: Tab;
  selection: Selection;
  showDims: boolean;
  showRoom: boolean;
  explode: number; // 0..1
  toast: Msg | null;
  lang: Lang;
}

export interface PlannerState {
  project: Project;
  errors: ValidationError[];
  lastValid: Project;
  past: Project[];
  future: Project[];
  ui: UiState;

  setProject: (updater: (p: Project) => Project) => void;
  undo: () => void;
  redo: () => void;

  setName: (name: string) => void;
  setRoom: (patch: Partial<Room>) => void;
  setDoor: (patch: Partial<Door>) => void;
  setWardrobe: (patch: Partial<Omit<Wardrobe, 'walls'>>) => void;
  setWall: (wall: Wall, patch: Partial<Omit<WallPlan, 'segments'>>) => void;

  insertColumn: (wall: Wall, segment: 0 | 1, index: number, column: Column) => void;
  insertPreset: (wall: Wall, segment: 0 | 1, index: number, key: PresetKey) => void;
  updateColumn: (id: string, patch: { width?: number; rail?: Gap['rail'] }) => void;
  removeColumn: (id: string) => void;
  moveColumn: (id: string, dir: -1 | 1) => void;
  duplicateColumn: (id: string) => void;

  addZone: (columnId: string, zone: Zone) => void;
  updateZone: (columnId: string, zoneId: string, patch: Partial<Omit<Zone, 'id'>>) => void;
  removeZone: (columnId: string, zoneId: string) => void;
  moveZone: (columnId: string, zoneId: string, dir: -1 | 1) => void;

  select: (patch: Partial<Selection>) => void;
  newProject: () => void;
  loadProject: (p: Project) => void;
  setUi: (patch: Partial<UiState>) => void;
  toast: (m: Msg | null) => void;
  setLang: (lang: Lang) => void;
}

export const HISTORY_LIMIT = 100;

const SEGMENTS: [0, 1] = [0, 1];
const NO_SELECTION: Selection = { wall: 'back', columnId: null, zoneId: null };

export interface ColumnRef {
  wall: Wall;
  segment: 0 | 1;
  index: number;
  column: Column;
}

/** Locates a column anywhere in the project (all walls, both segments). */
export function findColumn(p: Project, id: string): ColumnRef | null {
  for (const wall of WALLS) {
    const plan = p.wardrobe.walls[wall];
    for (const segment of SEGMENTS) {
      const index = plan.segments[segment].findIndex((c) => c.id === id);
      if (index >= 0) return { wall, segment, index, column: plan.segments[segment][index] };
    }
  }
  return null;
}

/** Drops a selected column/zone that no longer exists; a zone must belong to the selected column. */
export function cleanSelection(p: Project, sel: Selection): Selection {
  if (!sel.columnId) return sel.zoneId === null ? sel : { ...sel, zoneId: null };
  const ref = findColumn(p, sel.columnId);
  if (!ref) return { ...sel, columnId: null, zoneId: null };
  if (sel.zoneId === null) return sel;
  const held = ref.column.kind === 'unit' && ref.column.zones.some((z) => z.id === sel.zoneId);
  return held ? sel : { ...sel, zoneId: null };
}

function replaceSegment(p: Project, wall: Wall, segment: 0 | 1, fn: (cols: Column[]) => Column[]): Project {
  const plan = p.wardrobe.walls[wall];
  const next = fn(plan.segments[segment]);
  if (next === plan.segments[segment]) return p; // a no-op edit must not create a history entry
  const segments: [Column[], Column[]] = [plan.segments[0], plan.segments[1]];
  segments[segment] = next;
  return { ...p, wardrobe: { ...p.wardrobe, walls: { ...p.wardrobe.walls, [wall]: { ...plan, segments } } } };
}

function replaceColumn(p: Project, id: string, fn: (c: Column) => Column): Project {
  const ref = findColumn(p, id);
  if (!ref) return p;
  return replaceSegment(p, ref.wall, ref.segment, (cols) => {
    const next = cols.map((c) => (c.id === id ? fn(c) : c));
    return next[ref.index] === cols[ref.index] ? cols : next;
  });
}

function replaceZones(p: Project, columnId: string, fn: (zones: Zone[]) => Zone[]): Project {
  return replaceColumn(p, columnId, (c) => {
    if (c.kind !== 'unit') return c;
    const zones = fn(c.zones);
    return zones === c.zones ? c : { ...c, zones };
  });
}

function swapped<T>(items: T[], i: number, j: number): T[] {
  if (i < 0 || j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function createPlannerStore(initial: Project = defaultProject(), lang: Lang = 'en') {
  const initialErrors = validate(initial);
  return create<PlannerState>()((set, get) => {
    /** Adopts `project` as the current one: re-validates, keeps a valid `lastValid`, cleans the selection. */
    const commit = (s: PlannerState, project: Project, past: Project[], future: Project[]): Partial<PlannerState> => {
      const errors = validate(project);
      const selection = cleanSelection(project, s.ui.selection);
      return {
        project,
        errors,
        lastValid: errors.length ? s.lastValid : project,
        past,
        future,
        ui: selection === s.ui.selection ? s.ui : { ...s.ui, selection },
      };
    };

    return {
      project: initial,
      errors: initialErrors,
      lastValid: initialErrors.length ? defaultProject() : initial,
      past: [],
      future: [],
      ui: { tab: 'design', selection: NO_SELECTION, showDims: true, showRoom: true, explode: 0, toast: null, lang },

      setProject: (updater) =>
        set((s) => {
          const project = updater(s.project);
          if (project === s.project) return {};
          return commit(s, project, [...s.past, s.project].slice(-HISTORY_LIMIT), []);
        }),

      undo: () =>
        set((s) => {
          if (!s.past.length) return {};
          return commit(s, s.past[s.past.length - 1], s.past.slice(0, -1), [s.project, ...s.future]);
        }),

      redo: () =>
        set((s) => {
          if (!s.future.length) return {};
          return commit(s, s.future[0], [...s.past, s.project].slice(-HISTORY_LIMIT), s.future.slice(1));
        }),

      setName: (name) => get().setProject((p) => ({ ...p, name })),
      setRoom: (patch) => get().setProject((p) => ({ ...p, room: { ...p.room, ...patch } })),
      setDoor: (patch) => get().setProject((p) => ({ ...p, door: { ...p.door, ...patch } })),
      setWardrobe: (patch) => get().setProject((p) => ({ ...p, wardrobe: { ...p.wardrobe, ...patch } })),
      setWall: (wall, patch) =>
        get().setProject((p) => ({
          ...p,
          wardrobe: { ...p.wardrobe, walls: { ...p.wardrobe.walls, [wall]: { ...p.wardrobe.walls[wall], ...patch } } },
        })),

      insertColumn: (wall, segment, index, column) => {
        get().setProject((p) =>
          replaceSegment(p, wall, segment, (cols) => {
            const next = [...cols];
            next.splice(Math.max(0, Math.min(index, cols.length)), 0, column);
            return next;
          }),
        );
        get().select({ wall, columnId: column.id, zoneId: null });
      },

      insertPreset: (wall, segment, index, key) => {
        const p = get().project;
        const seg = wallSegments(p, wall)[segment];
        const free = seg ? segmentFree(p, seg) : 0;
        const fits = key === 'gap' ? free > 0 : free >= minUnitWidth(p.wardrobe);
        if (!fits) {
          get().toast(msg('toast.noRoom'));
          return;
        }
        const width = Math.min(key === 'gap' ? GAP_DEFAULT_WIDTH : PRESET_DEFAULT_WIDTH, free);
        get().insertColumn(wall, segment, index, makePreset(key, width));
      },

      updateColumn: (id, patch) =>
        get().setProject((p) => {
          const width = patch.width !== undefined;
          const rail = 'rail' in patch;
          if (!width && !rail) return p; // a no-op edit must not create a history entry
          return replaceColumn(p, id, (c) => {
            const next: Column = { ...c };
            if (width) next.width = patch.width as number;
            // A rail only means anything on a gap. `{ rail: undefined }` is the checkbox being
            // unticked: drop the key instead of leaving an explicit undefined behind for the file
            // and the shape check, exactly as a zone's `rod` does.
            if (rail && next.kind === 'gap') {
              if (patch.rail === undefined) delete next.rail;
              else next.rail = patch.rail;
            }
            return next;
          });
        }),

      removeColumn: (id) =>
        get().setProject((p) => {
          const ref = findColumn(p, id);
          if (!ref) return p;
          return replaceSegment(p, ref.wall, ref.segment, (cols) => cols.filter((c) => c.id !== id));
        }),

      moveColumn: (id, dir) =>
        get().setProject((p) => {
          const ref = findColumn(p, id);
          if (!ref) return p;
          // Only ever within the column's own segment.
          return replaceSegment(p, ref.wall, ref.segment, (cols) => swapped(cols, ref.index, ref.index + dir));
        }),

      duplicateColumn: (id) => {
        const ref = findColumn(get().project, id);
        if (!ref) return;
        get().insertColumn(ref.wall, ref.segment, ref.index + 1, cloneColumn(ref.column));
      },

      addZone: (columnId, zone) => get().setProject((p) => replaceZones(p, columnId, (zones) => [...zones, zone])),

      updateZone: (columnId, zoneId, patch) =>
        get().setProject((p) =>
          replaceZones(p, columnId, (zones) =>
            zones.map((z) => {
              if (z.id !== zoneId) return z;
              const next = { ...z, ...patch };
              // `{ rod: undefined }` means "back to the automatic rail height" and
              // `{ rodDir: undefined }` "back to along the wall": drop the key instead of leaving
              // an explicit undefined behind for the file and the shape check.
              for (const k of ['rod', 'rodDir'] as const) if (k in patch && patch[k] === undefined) delete next[k];
              return next;
            }),
          ),
        ),

      // A unit always keeps at least one zone: an empty unit is a validation error with no way
      // back from the keyboard, so the last zone is simply not removable (the ✕ is disabled too).
      removeZone: (columnId, zoneId) =>
        get().setProject((p) => replaceZones(p, columnId, (zones) => (zones.length <= 1 ? zones : zones.filter((z) => z.id !== zoneId)))),

      moveZone: (columnId, zoneId, dir) =>
        get().setProject((p) =>
          replaceZones(p, columnId, (zones) => {
            const i = zones.findIndex((z) => z.id === zoneId);
            return i < 0 ? zones : swapped(zones, i, i + dir);
          }),
        ),

      select: (patch) => set((s) => ({ ui: { ...s.ui, selection: { ...s.ui.selection, ...patch } } })),

      newProject: () => get().loadProject(defaultProject()),

      loadProject: (project) =>
        set((s) => {
          const errors = validate(project);
          return {
            project,
            errors,
            lastValid: errors.length ? defaultProject() : project,
            past: [],
            future: [],
            ui: { ...s.ui, selection: NO_SELECTION },
          };
        }),

      setUi: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
      toast: (m) => set((s) => ({ ui: { ...s.ui, toast: m } })),
      setLang: (l) => set((s) => ({ ui: { ...s.ui, lang: l } })),
    };
  });
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;

export function startAutosave(store: PlannerStore, storage: StorageLike, delay = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsub = store.subscribe((s, prev) => {
    if (s.ui.lang !== prev.ui.lang) saveLang(storage, s.ui.lang);
    if (s.project === prev.project) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveToStorage(storage, s.project), delay);
  });
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}

const browserStorage: StorageLike | null = typeof localStorage !== 'undefined' ? localStorage : null;
const initialLang: Lang =
  (browserStorage && loadLang(browserStorage)) ?? detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined);

export const useStore = createPlannerStore((browserStorage && loadFromStorage(browserStorage)) ?? defaultProject(), initialLang);
if (browserStorage) startAutosave(useStore, browserStorage);
