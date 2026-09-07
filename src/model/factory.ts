import type { Column, Gap, Unit, Zone, ZoneType } from './types';

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}-${seq}`;
}

export function makeZone(type: ZoneType, height: number | null = null, count = 1): Zone {
  return { id: newId('z'), type, height, count };
}

export function makeUnit(width: number, zones: Zone[]): Unit {
  return { id: newId('c'), kind: 'unit', width, zones };
}

export function makeGap(width: number): Gap {
  return { id: newId('c'), kind: 'gap', width };
}

export function cloneColumn(c: Column): Column {
  if (c.kind === 'gap') return { ...c, id: newId('c') };
  return {
    ...c,
    id: newId('c'),
    zones: c.zones.map((z) => ({ ...z, id: newId('z') })),
  };
}
