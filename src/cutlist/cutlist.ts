import type { Material, Part, PartKind, PartNameKey } from '../geometry/parts';
import type { Wall } from '../model/types';
import { t, type Lang, type MessageKey, type Msg } from '../i18n';
import { bounds2, type Vec2 } from '../geometry/vec';
import { ROD_DIAMETER } from '../geometry/layout';
import { WALLS } from '../geometry/frames';

/** Where a part belongs: a unit in a wall run, or — when `corner` is set — an L-shaped corner
 * unit (its `columnIndex` is then -1, since a corner unit sits in no run). */
export interface Location { wall: Wall; columnIndex: number; corner?: Wall }

/** "B1" for a unit, "BL" for a corner: the short code printed on the drawings and in the cut list. */
export const locationTag = (lang: Lang, l: Location): string =>
  l.corner ? t(lang, `corner.tag.${l.corner}` as MessageKey) : `${t(lang, `wall.abbr.${l.wall}` as MessageKey)}${l.columnIndex + 1}`;

export interface CutRow {
  nameKey: PartNameKey;
  kind: PartKind;
  locations: Location[];
  qty: number;
  length: number;
  width: number;
  thickness: number;
  material: Material;
  notes: Msg[];
}

const KIND_ORDER: PartKind[] = ['side', 'top', 'bottom', 'back', 'divider', 'shelf', 'drawerFront', 'plinth', 'rod'];
const r1 = (x: number) => Math.round(x * 10) / 10;
/** A 4-point outline spanning exactly two x and two y values is an axis-aligned rectangle. */
function rectDims(outline: Vec2[]): [number, number] | null {
  if (outline.length !== 4) return null;
  const xs = [...new Set(outline.map((q) => r1(q.x)))];
  const ys = [...new Set(outline.map((q) => r1(q.y)))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  const w = Math.abs(xs[1] - xs[0]);
  const h = Math.abs(ys[1] - ys[0]);
  return [Math.max(w, h), Math.min(w, h)];
}

/**
 * The part's shape, to 0.1 mm — what tells two boards of equal bounding size apart. A rectangle
 * is keyed on its sorted dimensions, because a 600 × 500 board is the same board however its
 * outline happens to be written; anything else (an L corner slab, a rod circle) keeps its points,
 * so a mirrored L never merges with its opposite.
 */
function shapeKey(part: Part): string {
  const r = rectDims(part.outline);
  return r ? `rect:${r[0]}x${r[1]}` : JSON.stringify(part.outline.map((q) => [r1(q.x), r1(q.y)]));
}
const wallRank = (w: Wall) => WALLS.indexOf(w);

export function partDims(part: Part): { length: number; width: number } {
  if (part.kind === 'rod') return { length: r1(part.thickness), width: ROD_DIAMETER };
  const b = bounds2(part.outline);
  const a = b.max.x - b.min.x;
  const c = b.max.y - b.min.y;
  return { length: r1(Math.max(a, c)), width: r1(Math.min(a, c)) };
}

export function buildCutList(parts: Part[]): CutRow[] {
  const groups = new Map<string, CutRow>();
  for (const part of parts) {
    const { length, width } = partDims(part);
    const thickness = part.kind === 'rod' ? ROD_DIAMETER : r1(part.thickness);
    const notes = part.notes ?? [];
    // Grouped by what actually gets cut: two boards with the same bounding size can still be
    // different shapes (mirrored L corner slabs), so the outline itself is part of the key —
    // but a corner panel that IS the same board as a run panel merges with it.
    const key = [part.kind, part.nameKey, length, width, thickness, part.material, shapeKey(part), JSON.stringify(notes)].join('|');
    const loc: Location = part.corner
      ? { wall: part.wall, columnIndex: part.columnIndex, corner: part.corner }
      : { wall: part.wall, columnIndex: part.columnIndex };
    const row = groups.get(key);
    if (row) {
      row.qty += 1;
      if (!row.locations.some((l) => l.wall === loc.wall && l.columnIndex === loc.columnIndex && l.corner === loc.corner)) row.locations.push(loc);
    } else {
      groups.set(key, { nameKey: part.nameKey, kind: part.kind, locations: [loc], qty: 1, length, width, thickness, material: part.material, notes });
    }
  }
  return [...groups.values()]
    .map((r) => ({
      ...r,
      locations: [...r.locations].sort((a, b) => wallRank(a.wall) - wallRank(b.wall) || a.columnIndex - b.columnIndex),
    }))
    .sort((a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.nameKey.localeCompare(b.nameKey) ||
      wallRank(a.locations[0]?.wall) - wallRank(b.locations[0]?.wall) ||
      (a.locations[0]?.columnIndex ?? 0) - (b.locations[0]?.columnIndex ?? 0));
}
