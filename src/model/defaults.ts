import { makePreset } from './presets';
import type { Project, WallPlan } from './types';

export function emptyWall(depth: number, enabled: boolean): WallPlan {
  return { enabled, depth, segments: [[], []] };
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
    door: { wall: 'front', offset: 800, width: 800, height: 2100 },
    wardrobe: {
      panelThickness: 18,
      backThickness: 4,
      plinthHeight: 100,
      topGap: 150,
      doorMargin: 80,
      walls: { back, right, front, left },
    },
  };
}
