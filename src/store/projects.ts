import { STORAGE_KEY, parseProjectShape, serializeProject, type StorageLike } from './persist';
import type { Project } from '../model/types';

/** One row of the project index: enough to list and sort projects without parsing every payload. */
export interface ProjectMeta { id: string; name: string; updatedAt: number }

/** The index of all saved projects (a JSON `ProjectMeta[]`). */
export const INDEX_KEY = 'wardrobe-planner:projects';
/** The id of the project the app reopens on load. */
export const CURRENT_KEY = 'wardrobe-planner:current';
/** Set once the user dismisses the first-run hint bar; unset means it has never been dismissed. */
export const HINT_KEY = 'wardrobe-planner:hint-dismissed';
/** Each project's payload lives under its own key, in the same JSON format as a saved file. */
export const projectKey = (id: string) => `wardrobe-planner:project:${id}`;

export function newProjectId(now = Date.now()): string {
  return 'p' + now.toString(36) + Math.random().toString(36).slice(2, 6);
}

const isMeta = (v: unknown): v is ProjectMeta => {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return typeof m.id === 'string' && typeof m.name === 'string'
    && typeof m.updatedAt === 'number' && Number.isFinite(m.updatedAt);
};

/** Corrupt or partly corrupt index JSON is treated as empty (resp. as its readable rows): the
 * project payloads are the source of truth, and a broken index must not block the app. */
function readIndex(s: StorageLike): ProjectMeta[] {
  try {
    const text = s.getItem(INDEX_KEY);
    if (!text) return [];
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data.filter(isMeta).map((m) => ({ id: m.id, name: m.name, updatedAt: m.updatedAt })) : [];
  } catch {
    return [];
  }
}

/** `false` when the write failed (quota exceeded or storage disabled). */
function writeIndex(s: StorageLike, index: ProjectMeta[]): boolean {
  try {
    s.setItem(INDEX_KEY, JSON.stringify(index));
    return true;
  } catch {
    return false;
  }
}

/** Most recently saved first. */
export function listProjects(s: StorageLike): ProjectMeta[] {
  return readIndex(s).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProjectById(s: StorageLike, id: string): Project | null {
  try {
    const text = s.getItem(projectKey(id));
    if (!text) return null;
    const r = parseProjectShape(text);
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}

/**
 * Writes the project first and the index second, so a quota failure on the index still leaves a
 * readable project behind. Returns `false` if either write failed.
 */
export function saveProject(s: StorageLike, id: string, p: Project, now = Date.now()): boolean {
  try {
    s.setItem(projectKey(id), serializeProject(p));
  } catch {
    return false;
  }
  const index = readIndex(s).filter((m) => m.id !== id);
  index.push({ id, name: p.name, updatedAt: now });
  return writeIndex(s, index);
}

export function deleteProject(s: StorageLike, id: string): void {
  try {
    s.removeItem(projectKey(id));
  } catch {
    // storage disabled: best-effort
  }
  writeIndex(s, readIndex(s).filter((m) => m.id !== id));
  if (getCurrent(s) === id) {
    try {
      s.removeItem(CURRENT_KEY);
    } catch {
      // best-effort
    }
  }
}

export function getCurrent(s: StorageLike): string | null {
  try {
    return s.getItem(CURRENT_KEY) || null;
  } catch {
    return null;
  }
}

export function setCurrent(s: StorageLike, id: string): void {
  try {
    s.setItem(CURRENT_KEY, id);
  } catch {
    // best-effort
  }
}

/**
 * Adopts the single project older builds autosaved under `STORAGE_KEY` into the index, once: it
 * only runs while the index is empty, and drops the legacy key after a successful save. Returns
 * the new id when it migrated, `null` otherwise (nothing to migrate, or the save failed).
 */
export function migrateLegacy(s: StorageLike, now = Date.now()): string | null {
  if (readIndex(s).length) return null;
  let text: string | null;
  try {
    text = s.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!text) return null;
  const r = parseProjectShape(text);
  if (!r.ok) return null;
  const id = newProjectId(now);
  if (!saveProject(s, id, r.project, now)) return null;
  try {
    s.removeItem(STORAGE_KEY);
  } catch {
    // best-effort: the index now owns the project either way
  }
  setCurrent(s, id);
  return id;
}
