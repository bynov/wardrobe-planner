import { minUnitWidth, segmentFree, wallSegments } from '../geometry/frames';
import { fmtLenParam, len, t, type Lang } from '../i18n';
import type { Project, Wall } from '../model/types';
import type { Units } from '../units';

export const WALL_STATUS_KINDS = ['off', 'full', 'free', 'over'] as const;

export type WallStatus =
  | { kind: 'off' }
  | { kind: 'full'; units: number }
  | { kind: 'free'; units: number; free: number }
  | { kind: 'over'; units: number; over: number };

/** What a wall tab says about its run: how many units, and what is left or spilling over. */
export function wallStatus(p: Project, wall: Wall): WallStatus {
  const plan = p.wardrobe.walls[wall];
  if (!plan.enabled) return { kind: 'off' };
  const units = plan.segments.reduce((n, cols) => n + cols.filter((c) => c.kind === 'unit').length, 0);
  let free = 0;
  let over = 0;
  for (const seg of wallSegments(p, wall)) {
    const f = segmentFree(p, seg);
    if (f < 0) over += -f;
    else free += f;
  }
  if (over > 0) return { kind: 'over', units, over };
  if (free < minUnitWidth(p.wardrobe)) return { kind: 'full', units };
  return { kind: 'free', units, free };
}

/** A length the way the wall tabs show it: millimetres carry their unit name, inches their ″. */
export function lenText(lang: Lang, mm: number, units: Units): string {
  return fmtLenParam(lang, len(Math.round(mm)), units);
}

export function wallStatusText(s: WallStatus, lang: Lang, units: Units): string {
  switch (s.kind) {
    case 'off':
      return t(lang, 'ui.wallStatus.off');
    case 'full':
      return t(lang, 'ui.wallStatus.full', { n: s.units });
    case 'free':
      return t(lang, 'ui.wallStatus.free', { n: s.units, free: lenText(lang, s.free, units) });
    case 'over':
      return t(lang, 'ui.wallStatus.over', { over: lenText(lang, s.over, units) });
  }
}
