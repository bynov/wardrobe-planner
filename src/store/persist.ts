import { isLang, msg, t, tmDeep, type Lang, type Msg } from '../i18n';
import { WALLS } from '../geometry/frames';
import { validate } from '../model/validate';
import type { Project } from '../model/types';

export const STORAGE_KEY = 'wardrobe-planner:project';
export const LANG_KEY = 'wardrobe-planner:lang';
export const FILE_VERSION = 1;

export function serializeProject(p: Project): string {
  return JSON.stringify({ version: FILE_VERSION, project: p }, null, 2);
}

export type ParseResult = { ok: true; project: Project } | { ok: false; error: Msg; reason?: Msg };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isWall = (v: unknown): boolean => WALLS.some((w) => w === v);
const nums = (o: Record<string, unknown>, keys: string[]) => keys.every((k) => isNum(o[k]));

function isZoneShape(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (typeof v.id !== 'string' || !isNum(v.count)) return false;
  if (!(v.height === null || isNum(v.height))) return false;
  return v.type === 'open' || v.type === 'shelves' || v.type === 'drawers' || v.type === 'hanging';
}

function isColumnShape(v: unknown): boolean {
  if (!isObj(v) || typeof v.id !== 'string' || !isNum(v.width)) return false;
  if (v.kind === 'gap') return true;
  if (v.kind !== 'unit') return false;
  return Array.isArray(v.zones) && v.zones.every(isZoneShape);
}

function isWallPlanShape(v: unknown): boolean {
  if (!isObj(v) || typeof v.enabled !== 'boolean' || !isNum(v.depth)) return false;
  const segs = v.segments;
  if (!Array.isArray(segs) || segs.length !== 2) return false;
  return segs.every((seg) => Array.isArray(seg) && seg.every(isColumnShape));
}

function isProjectShape(v: unknown): v is Project {
  if (!isObj(v) || typeof v.name !== 'string') return false;
  const { room, door, wardrobe } = v;
  if (!isObj(room) || !nums(room, ['width', 'depth', 'height'])) return false;
  if (!isObj(door) || !nums(door, ['offset', 'width', 'height']) || !isWall(door.wall)) return false;
  if (!isObj(wardrobe) || !nums(wardrobe, ['panelThickness', 'backThickness', 'plinthHeight', 'topGap', 'doorMargin'])) return false;
  const walls = wardrobe.walls;
  if (!isObj(walls) || Object.keys(walls).length !== 4) return false;
  return WALLS.every((w) => isWallPlanShape(walls[w]));
}

/** Accepts anything shape-valid, without the `validate()` gate. Used for autosave restore, where
 * an invalid-but-shape-valid project must survive a reload (the store surfaces validation errors
 * and falls back to `lastValid` for views that need a valid project). */
export function parseProjectShape(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: msg('error.notJson') };
  }
  if (!isObj(data) || data.version !== FILE_VERSION) return { ok: false, error: msg('error.badVersion', { version: FILE_VERSION }) };
  if (!isProjectShape(data.project)) return { ok: false, error: msg('error.badShape') };
  return { ok: true, project: data.project };
}

/** Shape-valid AND passes `validate()`. Used for file import, where an invalid project is rejected. */
export function parseProjectJson(text: string): ParseResult {
  const r = parseProjectShape(text);
  if (!r.ok) return r;
  const errors = validate(r.project);
  if (errors.length) return { ok: false, error: msg('error.failsValidation'), reason: errors[0].message };
  return r;
}

/** Renders a ParseResult's error (with its nested validation reason, if any) as text in `lang`. */
export function parseErrorText(lang: Lang, r: { error: Msg; reason?: Msg }): string {
  return r.reason
    ? t(lang, r.error.key, { ...r.error.params, reason: tmDeep(lang, r.reason) })
    : tmDeep(lang, r.error);
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function loadFromStorage(storage: StorageLike): Project | null {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return null;
    const r = parseProjectShape(text);
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}

export function saveToStorage(storage: StorageLike, p: Project): void {
  try {
    storage.setItem(STORAGE_KEY, serializeProject(p));
  } catch {
    // quota exceeded or storage disabled: autosave is best-effort
  }
}

export function loadLang(storage: StorageLike): Lang | null {
  try {
    const v = storage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(storage: StorageLike, lang: Lang): void {
  try {
    storage.setItem(LANG_KEY, lang);
  } catch {
    // best-effort
  }
}
