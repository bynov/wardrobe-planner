import { describe, expect, it } from 'vitest';
import { layoutAll } from '../../geometry/layout';
import { makePreset } from '../../model/presets';
import { makeTemplate } from '../../model/templates';
import type { Project } from '../../model/types';
import type { Units } from '../../units';
import { LABEL_FONT_PX, declutter, labelSizePx, wallLabels, widthLabels, type LabelRect } from './dimLabels';

const labels = (p: Project, units: Units = 'mm') => widthLabels(p, layoutAll(p), units);
const label = (p: Project, key: string) => {
  const l = labels(p).find((x) => x.key === key);
  if (!l) throw new Error(`no label ${key}`);
  return l;
};
const at = (p: Project, key: string) => label(p, key).at;

describe('labelSizePx', () => {
  it('counts digits wide and the space and slash of an inch fraction narrow', () => {
    expect(labelSizePx('600').width).toBeCloseTo(3 * 0.6 * LABEL_FONT_PX + 8);
    expect(labelSizePx('23 5/8').width).toBeCloseTo((4 * 0.6 + 2 * 0.3) * LABEL_FONT_PX + 8);
    expect(labelSizePx('600').height).toBe(labelSizePx('23 5/8').height);
  });
});

describe('declutter', () => {
  const r = (key: string, x0: number, priority: number, w = 30): LabelRect => ({ key, x0, y0: 0, x1: x0 + w, y1: 17, priority });

  it('keeps every callout that is clear of the others', () => {
    expect(declutter([r('a', 0, 1), r('b', 40, 1), r('c', 80, 1)])).toEqual(new Set(['a', 'b', 'c']));
  });
  it('hides the lower-priority one of an overlapping pair, whatever the order', () => {
    expect(declutter([r('lo', 0, 1), r('hi', 20, 2)])).toEqual(new Set(['hi']));
    expect(declutter([r('hi', 20, 2), r('lo', 0, 1)])).toEqual(new Set(['hi']));
  });
  it('treats callouts closer than the gap as colliding', () => {
    expect(declutter([r('a', 0, 2), r('b', 31, 1)])).toEqual(new Set(['a']));
  });
  it('lets a hidden callout not block a third one', () => {
    // b loses to a; c overlaps only b, so it stays
    expect(declutter([r('a', 0, 3), r('b', 20, 2), r('c', 45, 1)])).toEqual(new Set(['a', 'c']));
  });
  it('breaks ties by input order', () => {
    expect(declutter([r('first', 0, 1), r('second', 10, 1)])).toEqual(new Set(['first']));
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

  it('labels narrow units too, in either unit system', () => {
    const p: Project = structuredClone(makeTemplate('oneWall', '1'));
    p.wardrobe.walls.back.segments[0][0] = makePreset('shelves', 250);
    expect(labels(p, 'in').map((l) => l.text)).toEqual(['9 13/16', '23 5/8', '23 5/8', '23 5/8', '23 5/8']);
  });

  it('moves the side unit at an inner corner away from the corner, up to a quarter of its width', () => {
    // unit spans s 700..1400 (world z 1300..600); centred at s 1050, moved by the back run's 600
    // depth towards s 450 but held at 1050 − 700/4
    expect(at(lShape, 'left-0-1').z).toBeCloseTo(2000 - (1050 - 175));
    expect(at(lShape, 'left-0-1').x).toBeCloseTo(680);
    expect(at(lShape, 'back-0-0').x).toBe(300); // the back run's corner callout stays centred
  });

  it('moves it the other way at the start of a run', () => {
    // U-shape right run: s runs from the back corner (claimed) to the front; first unit s 600..1300
    const u = makeTemplate('uShape', 'U');
    expect(at(u, 'right-0-0').z).toBeCloseTo(950 + 175);
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

  it('ranks back/front callouts over side ones, then the wider unit', () => {
    const back600 = label(lShape, 'back-0-0').priority;
    const back700 = label(lShape, 'back-0-1').priority;
    const left700 = label(lShape, 'left-0-1').priority;
    expect(back700).toBeGreaterThan(back600);
    expect(back600).toBeGreaterThan(left700);
  });
});

describe('wallLabels', () => {
  it('names each enabled wall above the ceiling, over the middle of its run, outranking widths', () => {
    const p = makeTemplate('lShape', 'L');
    const r = wallLabels(p, (w) => w.toUpperCase());
    expect(r.map((l) => l.text)).toEqual(['BACK', 'LEFT']);
    expect(r[0].at).toEqual({ x: 1250, y: 2580, z: 300 });
    expect(r[1].at.x).toBeCloseTo(300);
    expect(r[1].at.z).toBeCloseTo(1000);
    const top = Math.max(...labels(p).map((l) => l.priority));
    for (const l of r) expect(l.priority).toBeGreaterThan(top);
  });
});
