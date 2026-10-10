import type { ColumnLayout } from '../../geometry/layout';
import { WALLS, cornerClaim, isSideWall, localToWorld, wallFrame, wallLength } from '../../geometry/frames';
import { v3, type Vec3 } from '../../geometry/vec';
import type { Project, Wall } from '../../model/types';
import { formatLen, type Units } from '../../units';

/**
 * Where the 3D view's dimension callouts go, and which of them show. DOM-free: `Viewport3D`
 * projects the anchors to the screen each time the camera moves and hands the resulting
 * rectangles to `declutter`.
 *
 * Callouts are a fixed pixel size, so whether two collide depends on the view; it is decided on
 * the screen (`declutter`), not here in world space. A width that drops out is still printed in
 * the elevation drawing.
 */

/** The callout box, applied inline by `Viewport3D` (`LABEL_STYLE`) so these are the only copy. */
export const LABEL_FONT_PX = 12;
const LABEL_LINE_HEIGHT = 1.25;
const LABEL_PAD_X_PX = 4;
const LABEL_PAD_Y_PX = 1;
export const LABEL_STYLE = {
  fontSize: LABEL_FONT_PX,
  lineHeight: LABEL_LINE_HEIGHT,
  padding: `${LABEL_PAD_Y_PX}px ${LABEL_PAD_X_PX}px`,
} as const;
/** Clear space two callouts must keep between them on screen. */
const LABEL_GAP_PX = 2;
/** Width callouts sit just below the floor and just proud of the unit's front edge. */
const WIDTH_LABEL_DROP = 60;
const WIDTH_LABEL_PROUD = 80;
/** Wall names float this far above the ceiling line, over the middle of the run. */
const WALL_LABEL_RISE = 80;
/** How far a corner shift may take a callout off its unit's centre, as a fraction of the unit's
 * width: it stays over the middle half of its own unit. */
const MAX_SHIFT = 0.25;
/** Slack for the float sums behind a column's `s0`/`s1` when telling whether it meets a corner. */
const CORNER_EPS = 0.5;
/** `declutter` ranks: wall names always stay, then back/front widths, then side-wall widths;
 * within a rank the wider unit wins (unit widths are far below `RANK_STEP` mm). */
const RANK_STEP = 1e6;
const RANK_WALL = 3;
const RANK_BACK_FRONT = 2;
const RANK_SIDE = 1;

export interface DimLabel {
  key: string;
  text: string;
  /** World position of the label's centre. */
  at: Vec3;
  /** Higher wins when two collide on screen. */
  priority: number;
}

/** Screen rectangle of a callout, in CSS pixels. */
export interface LabelRect {
  key: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  priority: number;
}

/** Estimated on-screen size of a callout reading `text`, in CSS pixels: digits and letters at
 * 0.6 em, the space and slash of an inch fraction (`23 5/8`) at 0.3 em. Slightly generous. */
export function labelSizePx(text: string): { width: number; height: number } {
  const em = [...text].reduce((sum, c) => sum + (c === ' ' || c === '/' ? 0.3 : 0.6), 0);
  return {
    width: em * LABEL_FONT_PX + 2 * LABEL_PAD_X_PX,
    height: LABEL_FONT_PX * LABEL_LINE_HEIGHT + 2 * LABEL_PAD_Y_PX,
  };
}

/**
 * The callouts to show: greedily, highest priority first, each one that keeps `LABEL_GAP_PX`
 * clear of every callout already kept. Ties keep the input order.
 */
export function declutter(rects: LabelRect[]): Set<string> {
  const kept: LabelRect[] = [];
  const order = rects.map((r, i) => ({ r, i })).sort((a, b) => b.r.priority - a.r.priority || a.i - b.i);
  for (const { r } of order) {
    const hits = kept.some(
      (k) => r.x0 < k.x1 + LABEL_GAP_PX && k.x0 < r.x1 + LABEL_GAP_PX && r.y0 < k.y1 + LABEL_GAP_PX && k.y0 < r.y1 + LABEL_GAP_PX,
    );
    if (!hits) kept.push(r);
  }
  return new Set(kept.map((r) => r.key));
}

/**
 * One width callout per unit, centred on its front edge.
 *
 * At an inner corner the side run's end unit moves its callout away from the corner by the depth
 * of the back/front run that claims it (`cornerClaim`), but no further than `MAX_SHIFT` of its
 * own width: centred, it sits about 450 mm from the corner unit's callout, nearly in line with
 * the default corner view. Only the side callout moves; sliding the back run's corner callout
 * towards its neighbour stacks that run's callouts where a side-wall preset sees it end-on.
 */
export function widthLabels(project: Project, columns: ColumnLayout[], units: Units): DimLabel[] {
  const { room } = project;
  const out: DimLabel[] = [];
  for (const L of columns) {
    if (L.kind !== 'unit') continue;
    const mid = (L.s0 + L.s1) / 2;
    let s = mid;
    const side = isSideWall(L.wall);
    if (side) {
      const claimStart = cornerClaim(project, L.wall, 'start');
      const claimEnd = cornerClaim(project, L.wall, 'end');
      if (claimStart > 0 && L.s0 - claimStart < CORNER_EPS) s += claimStart;
      if (claimEnd > 0 && wallLength(room, L.wall) - claimEnd - L.s1 < CORNER_EPS) s -= claimEnd;
      const reach = MAX_SHIFT * L.width;
      s = Math.min(Math.max(s, mid - reach), mid + reach);
    }
    out.push({
      key: `${L.wall}-${L.segment}-${L.columnIndex}`,
      text: formatLen(Math.round(L.width), units),
      at: localToWorld(wallFrame(room, L.wall), v3(s, -WIDTH_LABEL_DROP, L.depth + WIDTH_LABEL_PROUD)),
      priority: (side ? RANK_SIDE : RANK_BACK_FRONT) * RANK_STEP + L.width,
    });
  }
  return out;
}

/** A name over each enabled wall's run, above the ceiling line. */
export function wallLabels(project: Project, name: (w: Wall) => string): DimLabel[] {
  const { room } = project;
  return WALLS.filter((w) => project.wardrobe.walls[w].enabled).map((w) => ({
    key: w,
    text: name(w),
    at: localToWorld(wallFrame(room, w), v3(wallLength(room, w) / 2, room.height + WALL_LABEL_RISE, project.wardrobe.walls[w].depth / 2)),
    priority: RANK_WALL * RANK_STEP,
  }));
}
