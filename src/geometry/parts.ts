import type { Project, Wall } from '../model/types';
import { msg, type Msg } from '../i18n';
import { frameTransform, wallFrame } from './frames';
import { layoutAll, PLINTH_SETBACK, REVEAL, ROD_DIAMETER, SHELF_SETBACK, type GapLayout, type UnitLayout } from './layout';
import { bounds3, FLAT_ROT, NO_ROT, ROD_ROT, SIDE_ROT, toWorld, v2, v3, type Box3, type Transform, type Vec2, type Vec3 } from './vec';

export type PartKind = 'side' | 'top' | 'bottom' | 'back' | 'divider' | 'shelf' | 'drawerFront' | 'plinth' | 'rod';
export const PART_NAME_KEYS = ['sideL', 'sideR', 'top', 'bottom', 'back', 'divider', 'shelf', 'drawerFront', 'plinth', 'rod'] as const;
export type PartNameKey = (typeof PART_NAME_KEYS)[number];
export const MATERIALS = ['panel', 'back', 'rod'] as const;
export type Material = (typeof MATERIALS)[number];

export interface Part {
  id: string;
  wall: Wall;
  columnIndex: number;
  unitId: string;
  nameKey: PartNameKey;
  index?: number;
  kind: PartKind;
  outline: Vec2[];
  thickness: number;
  transform: Transform;
  material: Material;
  notes?: Msg[];
}

export function rect(w: number, h: number): Vec2[] {
  return [v2(0, 0), v2(w, 0), v2(w, h), v2(0, h)];
}

export function circle(r: number, n: number): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return v2(r * Math.cos(a), r * Math.sin(a));
  });
}

export function partBounds(part: Part): Box3 {
  const pts: Vec3[] = [];
  for (const o of part.outline) {
    pts.push(toWorld(part.transform, v3(o.x, o.y, 0)));
    pts.push(toWorld(part.transform, v3(o.x, o.y, part.thickness)));
  }
  return bounds3(pts);
}

export function buildUnitParts(L: UnitLayout, p: Project): Part[] {
  const w = p.wardrobe, t = w.panelThickness, plinth = w.plinthHeight;
  const { s0, width: cw, depth, interiorWidth: iw, interiorDepth: id, carcassHeight: ch, interiorHeight: ih, floorY } = L;
  const parts: Part[] = [];
  const add = (
    key: string, nameKey: PartNameKey, kind: PartKind, outline: Vec2[], thickness: number,
    position: Vec3, rotation: Vec3, material: Material = 'panel', notes?: Msg[], index?: number,
  ) =>
    parts.push({ id: `${L.wall}-${L.columnIndex}-${key}`, wall: L.wall, columnIndex: L.columnIndex, unitId: L.unit.id, nameKey, index, kind, outline, thickness, transform: { position, rotation }, material, notes });
  add('sideL', 'sideL', 'side', rect(depth, ch), t, v3(s0 + t, plinth, 0), SIDE_ROT);
  add('sideR', 'sideR', 'side', rect(depth, ch), t, v3(s0 + cw, plinth, 0), SIDE_ROT);
  add('bottom', 'bottom', 'bottom', rect(iw, depth), t, v3(s0 + t, floorY, 0), FLAT_ROT);
  add('top', 'top', 'top', rect(iw, depth), t, v3(s0 + t, plinth + ch, 0), FLAT_ROT);
  add('back', 'back', 'back', rect(iw, ih), w.backThickness, v3(s0 + t, floorY, 0), NO_ROT, 'back');
  L.dividerYs.forEach((y, k) => add(`divider${k + 1}`, 'divider', 'divider', rect(iw, id), t, v3(s0 + t, y, w.backThickness), FLAT_ROT, 'panel', undefined, k + 1));
  let shelfN = 0, drawerN = 0;
  for (const z of L.zones) {
    for (const y of z.shelfYs) add(`shelf${++shelfN}`, 'shelf', 'shelf', rect(iw, id - SHELF_SETBACK), t, v3(s0 + t, y + t, w.backThickness), FLAT_ROT, 'panel', undefined, shelfN);
    for (const d of z.drawerFronts) add(`drawer${++drawerN}`, 'drawerFront', 'drawerFront', rect(z.frontW, d.y1 - d.y0), t, v3(s0 + t + REVEAL, d.y0, depth - t), NO_ROT, 'panel', undefined, drawerN);
    if (z.rodY !== null) {
      const dia = msg('note.rodDia', { d: ROD_DIAMETER });
      if (z.rodDir === 'across') {
        // Front to back: the circle is already in the local XY plane, so NO_ROT extrudes it along
        // local +z — into the room. It is held clear of the back and of the front edge by the same
        // setback a shelf keeps, so it never fouls the back panel or a door.
        add(`rod${z.index}`, 'rod', 'rod', circle(ROD_DIAMETER / 2, 24), id - 2 * SHELF_SETBACK,
          v3(s0 + t + iw / 2, z.rodY, w.backThickness + SHELF_SETBACK), NO_ROT, 'rod', [dia, msg('note.rodAcross')]);
      } else {
        add(`rod${z.index}`, 'rod', 'rod', circle(ROD_DIAMETER / 2, 24), iw, v3(s0 + t, z.rodY, id / 2), ROD_ROT, 'rod', [dia]);
      }
    }
  }
  add('plinth', 'plinth', 'plinth', rect(cw, plinth), t, v3(s0, 0, depth - PLINTH_SETBACK - t), NO_ROT);
  return parts;
}

/**
 * A gap carries no carcass, so the only thing it can build is a wall-mounted rail: the rod itself,
 * hung on brackets that this model does not carry (see `note.wallMounted`). `along` runs the
 * length of the gap at mid-depth; `across` stands at its middle and runs out into the room.
 */
export function buildGapParts(L: GapLayout): Part[] {
  const r = L.rail;
  if (!r) return [];
  const notes = [msg('note.rodDia', { d: ROD_DIAMETER }), msg('note.wallMounted')];
  const across = r.dir === 'across';
  return [{
    id: `${L.wall}-${L.columnIndex}-gaprail`,
    wall: L.wall,
    columnIndex: L.columnIndex,
    unitId: L.gap.id,
    nameKey: 'rod',
    kind: 'rod',
    outline: circle(ROD_DIAMETER / 2, 24),
    thickness: r.length,
    transform: {
      position: across ? v3(r.s0, r.y, SHELF_SETBACK) : v3(r.s0, r.y, L.depth / 2),
      rotation: across ? NO_ROT : ROD_ROT,
    },
    material: 'rod',
    notes,
  }];
}

export function buildParts(p: Project): Part[] {
  const out: Part[] = [];
  for (const L of layoutAll(p)) {
    const frame = wallFrame(p.room, L.wall);
    const local = L.kind === 'unit' ? buildUnitParts(L, p) : buildGapParts(L);
    for (const part of local) out.push({ ...part, transform: frameTransform(frame, part.transform) });
  }
  return out;
}
