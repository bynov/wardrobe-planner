import type { Msg } from '../i18n';

export type Wall = 'back' | 'right' | 'front' | 'left'; // runtime list: WALLS in geometry/frames
export const ZONE_TYPES = ['open', 'shelves', 'drawers', 'hanging'] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export interface Room { width: number; depth: number; height: number }
export interface Door { wall: Wall; offset: number; width: number; height: number }
export interface Zone { id: string; type: ZoneType; height: number | null; count: number }
export interface Unit { id: string; kind: 'unit'; width: number; zones: Zone[] }
export interface Gap { id: string; kind: 'gap'; width: number }
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
