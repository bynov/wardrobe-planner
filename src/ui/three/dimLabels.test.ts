import { describe, expect, it } from 'vitest';
import { layoutAll } from '../../geometry/layout';
import { makePreset } from '../../model/presets';
import { makeTemplate } from '../../model/templates';
import type { Project } from '../../model/types';
import type { Units } from '../../units';
import { LABEL_MM_PER_PX, labelWidthMm, wallLabels, widthLabels } from './dimLabels';

const labels = (p: Project, units: Units = 'mm') => widthLabels(p, layoutAll(p), units);
const at = (p: Project, key: string) => {
  const l = labels(p).find((x) => x.key === key);
  if (!l) throw new Error(`no label ${key}`);
  return l.at;
};

describe('labelWidthMm', () => {
  it('scales the estimated pixel width to the scene', () => {
    // 3 digits at 0.6 em of 12 px, plus 4 px padding each side
    expect(labelWidthMm('600')).toBeCloseTo((3 * 0.6 * 12 + 8) * LABEL_MM_PER_PX);
  });
  it('counts the space and slash of an inch fraction as narrow', () => {
    expect(labelWidthMm('23 5/8')).toBeCloseTo((4 * 0.6 * 12 + 2 * 0.3 * 12 + 8) * LABEL_MM_PER_PX);
    expect(labelWidthMm('23 5/8')).toBeGreaterThan(labelWidthMm('600'));
  });
});

describe('widthLabels', () => {
  // L-shape: room 2500 × 2000; back run 600 deep with units 600, 700, 600 from the left corner;
  // left run 600 deep, two 700 units from the front, the second ending at the back run's corner.
  const lShape = makeTemplate('lShape', 'L');

  it('labels every unit, centred on its front edge, below the floor', () => {
    expect(labels(lShape).map((l) => l.text)).toEqual(['600', '700', '600', '700', '700']);
    expect(at(lShape, 'back-0-0')).toEqual({ x: 300, y: -60, z: 680 });
    expect(at(lShape, 'left-0-0').x).toBeCloseTo(680);
    expect(at(lShape, 'left-0-0').z).toBeCloseTo(2000 - 350); // left wall: s runs from the front
  });

  it('moves the side unit at an inner corner away from the corner, inside its own unit', () => {
    // unit spans s 700..1400 (world z 1300..600); centred at s 1050, shifted by the back run's
    // 600 depth to 450 and clamped so the callout stays on the unit: s = 700 + width / 2
    const w = labelWidthMm('700');
    expect(at(lShape, 'left-0-1').z).toBeCloseTo(2000 - (700 + w / 2));
    expect(at(lShape, 'left-0-1').x).toBeCloseTo(680);
    // the back run's corner unit keeps its callout centred
    expect(at(lShape, 'back-0-0').x).toBe(300);
  });

  it('moves it the other way at the start of a run', () => {
    // U-shape right run: s runs from the back corner (claimed, 600) to the front; first unit
    // s 600..1300 is pushed from its centre 950 towards the front and clamped to its far end
    const u = makeTemplate('uShape', 'U');
    const w = labelWidthMm('700');
    expect(at(u, 'right-0-0').z).toBeCloseTo(1300 - w / 2);
    expect(at(u, 'right-0-0').x).toBeCloseTo(3000 - 680);
  });

  it('leaves the side unit centred when the back run does not claim the corner', () => {
    const p: Project = structuredClone(lShape);
    p.wardrobe.walls.back.enabled = false;
    expect(at(p, 'left-0-1').z).toBeCloseTo(2000 - 1050);
  });

  it('slides by the full depth of the corner run when the unit is long enough', () => {
    const p: Project = structuredClone(lShape);
    p.room.depth = 3000; // left run: s 0..2400 in front of the back run's 600 mm corner
    p.wardrobe.walls.left.segments[0] = [makePreset('hanging', 2400)];
    expect(at(p, 'left-0-0').z).toBeCloseTo(3000 - (1200 - 600));
  });

  it('hides a callout wider than its unit, which depends on the units', () => {
    const p: Project = structuredClone(makeTemplate('oneWall', '1'));
    p.wardrobe.walls.back.segments[0][0] = makePreset('shelves', 250);
    p.wardrobe.walls.back.segments[0][1] = makePreset('shelves', 200);
    // 250 mm: "250" (207 mm) fits, "9 13/16" (358 mm) does not; 200 mm: neither fits
    expect(labelWidthMm('250')).toBeLessThan(250);
    expect(labelWidthMm('9 13/16')).toBeGreaterThan(250);
    expect(labels(p, 'mm').map((l) => l.key)).toContain('back-0-0');
    expect(labels(p, 'mm').map((l) => l.key)).not.toContain('back-0-1');
    expect(labels(p, 'in').map((l) => l.key)).not.toContain('back-0-0');
    expect(labels(p, 'in').map((l) => l.text)).toEqual(['23 5/8', '23 5/8', '23 5/8']);
  });
});

describe('wallLabels', () => {
  it('names each enabled wall above the ceiling, over the middle of its run', () => {
    const p = makeTemplate('lShape', 'L');
    const r = wallLabels(p, (w) => w.toUpperCase());
    expect(r.map((l) => l.text)).toEqual(['BACK', 'LEFT']);
    expect(r[0].at).toEqual({ x: 1250, y: 2580, z: 300 });
    expect(r[1].at.x).toBeCloseTo(300);
    expect(r[1].at.z).toBeCloseTo(1000);
  });
});
