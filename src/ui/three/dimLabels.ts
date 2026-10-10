import type { ColumnLayout } from '../../geometry/layout';
import { WALLS, cornerClaim, isSideWall, localToWorld, wallFrame, wallLength } from '../../geometry/frames';
import { v3, type Vec3 } from '../../geometry/vec';
import type { Project, Wall } from '../../model/types';
import { formatLen, type Units } from '../../units';

/**
 * Where the 3D view's dimension callouts go, and which of them show. DOM-free: `Viewport3D` only
 * maps the result to drei `<Html>` elements.
 *
 * The width callouts are world-sized (drei's `distanceFactor`, see `labelDistanceFactor`): one CSS
 * pixel of one covers `LABEL_MM_PER_PX` mm of the scene whatever the zoom, so their footprint is
 * known here in millimetres and they shrink with the room instead of piling up as it recedes.
 * Wall names keep a fixed pixel size (see `Viewport3D`).
 */

/** World size of one CSS pixel of a callout. The `.dim3d` font is `LABEL_FONT_PX` high. */
export const LABEL_MM_PER_PX = 7;
/** Mirrors `.dim3d` in styles.css: font size and horizontal padding, in CSS pixels. */
const LABEL_FONT_PX = 12;
const LABEL_PAD_PX = 4;
/** Advance of a character as a fraction of the font size: a digit, and the narrow space and
 * slash of an inch fraction (`23 5/8`). Slightly generous, so a callout is never underestimated. */
const DIGIT_EM = 0.6;
const NARROW_EM = 0.3;
const NARROW = new Set([' ', '/']);
/** Width callouts sit just below the floor and just proud of the unit's front edge. */
const WIDTH_LABEL_DROP = 60;
const WIDTH_LABEL_PROUD = 80;
/** Wall names float this far above the ceiling line, over the middle of the run. */
const WALL_LABEL_RISE = 80;
/** Slack for the float sums behind a column's `s0`/`s1` when telling whether it meets a corner. */
const CORNER_EPS = 0.5;

export interface DimLabel {
  key: string;
  text: string;
  /** World position of the label's centre. */
  at: Vec3;
}

/** drei `distanceFactor` that makes one CSS pixel of a callout `LABEL_MM_PER_PX` mm of the scene in
 * a canvas `heightPx` tall. drei scales a callout by `distanceFactor / (2·tan(fov/2)·distance)`,
 * and the scene there shows `heightPx / (2·tan(fov/2)·distance)` pixels per mm. */
export const labelDistanceFactor = (heightPx: number): number => heightPx * LABEL_MM_PER_PX;

/** Estimated rendered width of a callout reading `text`, in mm of the scene. */
export function labelWidthMm(text: string): number {
  const em = [...text].reduce((sum, c) => sum + (NARROW.has(c) ? NARROW_EM : DIGIT_EM), 0);
  return (em * LABEL_FONT_PX + 2 * LABEL_PAD_PX) * LABEL_MM_PER_PX;
}

/**
 * One width callout per unit, centred on its front edge. A callout wider than its unit is left
 * out (it would run into the neighbour's; the elevation still carries the number).
 *
 * At an inner corner the side run's end unit moves its callout away from the corner by the depth
 * of the back/front run that claims it (`cornerClaim`), as far as its own unit allows: centred,
 * it sits about 450 mm from the corner unit's callout and the two touch from the default corner
 * view and from the back-wall preset. Only the side callout moves; sliding the back run's corner
 * callout towards its neighbour as well stacks that run's callouts where a side-wall preset sees
 * the run end-on.
 */
export function widthLabels(project: Project, columns: ColumnLayout[], units: Units): DimLabel[] {
  const { room } = project;
  const out: DimLabel[] = [];
  for (const L of columns) {
    if (L.kind !== 'unit') continue;
    const text = formatLen(Math.round(L.width), units);
    const w = labelWidthMm(text);
    if (w > L.width) continue;
    let s = (L.s0 + L.s1) / 2;
    if (isSideWall(L.wall)) {
      const claimStart = cornerClaim(project, L.wall, 'start');
      const claimEnd = cornerClaim(project, L.wall, 'end');
      if (claimStart > 0 && L.s0 - claimStart < CORNER_EPS) s += claimStart;
      if (claimEnd > 0 && wallLength(room, L.wall) - claimEnd - L.s1 < CORNER_EPS) s -= claimEnd;
    }
    s = Math.min(Math.max(s, L.s0 + w / 2), L.s1 - w / 2);
    out.push({
      key: `${L.wall}-${L.segment}-${L.columnIndex}`,
      text,
      at: localToWorld(wallFrame(room, L.wall), v3(s, -WIDTH_LABEL_DROP, L.depth + WIDTH_LABEL_PROUD)),
    });
  }
  return out;
}

/** A name over each enabled wall's run, above the ceiling line and so clear of the width callouts. */
export function wallLabels(project: Project, name: (w: Wall) => string): DimLabel[] {
  const { room } = project;
  return WALLS.filter((w) => project.wardrobe.walls[w].enabled).map((w) => ({
    key: w,
    text: name(w),
    at: localToWorld(wallFrame(room, w), v3(wallLength(room, w) / 2, room.height + WALL_LABEL_RISE, project.wardrobe.walls[w].depth / 2)),
  }));
}
