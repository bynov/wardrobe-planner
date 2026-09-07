import type { Material, Part, PartKind, PartNameKey } from '../geometry/parts';
import type { Wall } from '../model/types';
import type { Msg } from '../i18n';
import { bounds2 } from '../geometry/vec';
import { ROD_DIAMETER } from '../geometry/layout';
import { WALLS } from '../geometry/frames';

export interface Location { wall: Wall; columnIndex: number }

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
    const key = [part.kind, part.nameKey, length, width, thickness, part.material, JSON.stringify(notes)].join('|');
    const loc: Location = { wall: part.wall, columnIndex: part.columnIndex };
    const row = groups.get(key);
    if (row) {
      row.qty += 1;
      if (!row.locations.some((l) => l.wall === loc.wall && l.columnIndex === loc.columnIndex)) row.locations.push(loc);
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
