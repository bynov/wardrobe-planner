import { segmentFree, wallSegments } from '../geometry/frames';
import type { Project } from '../model/types';
import type { InsertTarget } from './insertTarget';

/** What the preset tray needs about its target: a disabled wall takes no units; otherwise the free length of the target segment, mm. */
export function trayState(project: Project, target: InsertTarget): { wallOff: boolean; free: number } {
  const wallOff = !project.wardrobe.walls[target.wall].enabled;
  const seg = wallSegments(project, target.wall)[target.segment];
  return { wallOff, free: seg ? segmentFree(project, seg) : 0 };
}
