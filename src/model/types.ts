import type { Msg } from '../i18n';

export type Wall = 'back' | 'right' | 'front' | 'left'; // runtime list: WALLS in geometry/frames
export const ZONE_TYPES = ['open', 'shelves', 'drawers', 'hanging'] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export interface Room { width: number; depth: number; height: number }
export const DOOR_SWINGS = ['in', 'out'] as const;
export type DoorSwing = (typeof DOOR_SWINGS)[number];
export const DOOR_HINGES = ['left', 'right'] as const;
export type DoorHinge = (typeof DOOR_HINGES)[number];
/** `swing`: which side of the wall the leaf opens to. `hinge`: which end of the opening carries
 * the hinges, as seen from inside the room facing the door wall — 'left' is the `s0` end. */
export interface Door { wall: Wall; offset: number; width: number; height: number; swing: DoorSwing; hinge: DoorHinge }
/** Which end of the hanging zone an explicit rail height is measured from. */
export const ROD_REFS = ['top', 'bottom'] as const;
export type RodRef = (typeof ROD_REFS)[number];
/** An explicit rail placement: `offset` mm below the zone's top, or above its bottom. */
export interface RodPlacement { from: RodRef; offset: number }
/** `rod` only means anything on a hanging zone; absent = the automatic rail height. */
export interface Zone { id: string; type: ZoneType; height: number | null; count: number; rod?: RodPlacement }
export interface Unit { id: string; kind: 'unit'; width: number; zones: Zone[] }
export interface Gap { id: string; kind: 'gap'; width: number }
export type Column = Unit | Gap;
export interface WallPlan { enabled: boolean; depth: number; segments: [Column[], Column[]] }

/** `none` keeps the v1 behaviour (the side wall butts against the back/front run, nothing is
 * built in the corner); `lshelf` puts an L-shaped open corner shelf unit there and makes both
 * runs stop short of it by `width`. */
export const CORNER_MODES = ['none', 'lshelf'] as const;
export type CornerMode = (typeof CORNER_MODES)[number];
/** `width` = the leg length along BOTH walls; `shelves` = COMPARTMENTS >= 1 (lshelf only), so
 * `n` compartments are split by `n - 1` boards and 1 is a single open bay. */
export interface CornerPlan { mode: CornerMode; width: number; shelves: number }
export interface Wardrobe {
  panelThickness: number;
  backThickness: number;
  plinthHeight: number;
  topGap: number;
  doorMargin: number;
  walls: Record<Wall, WallPlan>;
  /** Keyed by the ANCHOR wall: the wall whose `s = 0` end is that corner. `back` is the back-left
   * corner, `right` the back-right, `front` the front-right, `left` the front-left. */
  corners: Record<Wall, CornerPlan>;
}
export interface Project { name: string; room: Room; door: Door; wardrobe: Wardrobe }
export interface ValidationError { path: string; message: Msg }
