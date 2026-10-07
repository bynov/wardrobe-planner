import type { Msg } from '../i18n';

export type Wall = 'back' | 'right' | 'front' | 'left'; // runtime list: WALLS in geometry/frames
export const ZONE_TYPES = ['open', 'shelves', 'drawers', 'hanging', 'shoes'] as const;
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
/** Which way a hanging rail runs: `along` the wall (the usual one) or `across` it, front to back —
 * the arrangement a unit boxed into a corner needs. */
export const ROD_DIRS = ['along', 'across'] as const;
export type RodDir = (typeof ROD_DIRS)[number];
/** `rod` and `rodDir` only mean anything on a hanging zone; absent = the automatic rail height and
 * the `along` direction respectively. */
export interface Zone { id: string; type: ZoneType; height: number | null; count: number; rod?: RodPlacement; rodDir?: RodDir }
export interface Unit { id: string; kind: 'unit'; width: number; zones: Zone[] }
/** A wall-mounted rail hung in the empty space of a gap: no carcass, just the rod and its
 * brackets. `height` is the rail axis above the finished floor. */
export interface GapRail { dir: RodDir; height: number }
/** `rail` is optional: a plain gap is simply left empty, as it always was. */
export interface Gap { id: string; kind: 'gap'; width: number; rail?: GapRail }
export type Column = Unit | Gap;
export interface WallPlan { enabled: boolean; depth: number; segments: [Column[], Column[]] }

export interface Wardrobe {
  panelThickness: number;
  backThickness: number;
  plinthHeight: number;
  topGap: number;
  doorMargin: number;
  walls: Record<Wall, WallPlan>;
}
export interface Project { name: string; room: Room; door: Door; wardrobe: Wardrobe }
export interface ValidationError { path: string; message: Msg }
