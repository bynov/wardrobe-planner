import { WALLS } from '../geometry/frames';
import type { Project } from '../model/types';

/**
 * Drawings come from the current project whenever its geometry is sound, so an invalid but
 * drawable state (units overflowing a segment, say) still gives live feedback; a state that
 * would produce NaN/empty geometry falls back to the last valid project.
 *
 * The bounds alone are not enough: an imported project with a negative room width or wall depth
 * still produces finite bounds (the dimension chains and labels stretch them out) while every
 * rectangle inside is inside-out, so the room's own numbers are checked too.
 */
export function drawable(
  d: { bounds: { min: { x: number; y: number }; max: { x: number; y: number } } },
  p?: Project,
): boolean {
  const { min, max } = d.bounds;
  if (![min.x, min.y, max.x, max.y].every(Number.isFinite)) return false;
  if (!(max.x - min.x > 0) || !(max.y - min.y > 0)) return false;
  if (!p) return true;
  const { width, depth, height } = p.room;
  if (![width, depth, height].every((n) => Number.isFinite(n) && n > 0)) return false;
  return WALLS.every((w) => {
    const plan = p.wardrobe.walls[w];
    return !plan.enabled || (Number.isFinite(plan.depth) && plan.depth > 0);
  });
}
