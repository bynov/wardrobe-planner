import { makePreset } from './presets';
import type { CornerMode, CornerPlan, Project, Wall, WallPlan } from './types';

export function emptyWall(depth: number, enabled: boolean): WallPlan {
  return { enabled, depth, segments: [[], []] };
}

export const CORNER_DEFAULT_WIDTH = 1000;
/** Compartments, not boards: 6 bays are split by 5 shelves. */
export const CORNER_DEFAULT_SHELVES = 6;

export function defaultCorner(mode: CornerMode = 'none'): CornerPlan {
  return { mode, width: CORNER_DEFAULT_WIDTH, shelves: CORNER_DEFAULT_SHELVES };
}

/** One plan per anchor wall. Corners start at `none`, i.e. exactly the pre-corners behaviour. */
export function defaultCorners(mode: CornerMode = 'none'): Record<Wall, CornerPlan> {
  return { back: defaultCorner(mode), right: defaultCorner(mode), front: defaultCorner(mode), left: defaultCorner(mode) };
}

export function defaultProject(): Project {
  const back = emptyWall(600, true);
  back.segments[0] = [
    makePreset('drawersHanging', 600),
    makePreset('doubleHanging', 600),
    makePreset('shelves', 600),
    makePreset('drawersShelves', 600),
  ];

  const left = emptyWall(600, true);
  left.segments[0] = [makePreset('doubleHanging', 700), makePreset('shelves', 700)];

  const right = emptyWall(600, true);
  right.segments[0] = [makePreset('gap', 300), makePreset('hanging', 500), makePreset('shelves', 600)];

  const front = emptyWall(400, false);

  return {
    name: 'Walk-in wardrobe',
    room: { width: 2400, depth: 2000, height: 2500 },
    door: { wall: 'front', offset: 800, width: 800, height: 2100, swing: 'in', hinge: 'left' },
    wardrobe: {
      panelThickness: 18,
      backThickness: 4,
      plinthHeight: 100,
      topGap: 150,
      doorMargin: 80,
      walls: { back, right, front, left },
      corners: defaultCorners(),
    },
  };
}
