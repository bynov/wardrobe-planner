import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { v3 } from './vec';
import { WALLS, cornerActive, cornerAt, leftOf, cornerClaim, doorArc, doorHingeS, doorSpan, doorSwingSign, frameTransform, localToWorld, wallFrame, wallLength, wallSegments, segmentFree } from './frames';
import type { CornerPlan, Project, Wall } from '../model/types';

const room = { width: 2400, depth: 2000, height: 2500 };
const near = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6); expect(a.y).toBeCloseTo(b.y, 6); expect(a.z).toBeCloseTo(b.z, 6);
};

describe('wall frames', () => {
  it('maps local (s, y, z) to world per the spec table', () => {
    const p = v3(100, 50, 30);
    near(localToWorld(wallFrame(room, 'back'), p), v3(100, 50, 30));
    near(localToWorld(wallFrame(room, 'right'), p), v3(2400 - 30, 50, 100));
    near(localToWorld(wallFrame(room, 'front'), p), v3(2400 - 100, 50, 2000 - 30));
    near(localToWorld(wallFrame(room, 'left'), p), v3(30, 50, 2000 - 100));
  });
  it('wall lengths', () => {
    expect(wallLength(room, 'back')).toBe(2400);
    expect(wallLength(room, 'left')).toBe(2000);
  });
  it('frameTransform adds yaw to ry and moves the position', () => {
    const t = frameTransform(wallFrame(room, 'right'), { position: v3(10, 0, 0), rotation: v3(Math.PI / 2, 0, 0) });
    near(t.position, v3(2400, 0, 10));
    expect(t.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(t.rotation.x).toBeCloseTo(Math.PI / 2);
  });
});

describe('door span', () => {
  const base = defaultProject();
  it('front wall is mirrored', () => {
    expect(doorSpan(base)).toEqual({ wall: 'front', s0: 2400 - 800 - 800, s1: 2400 - 800 });
  });
  it('back and right walls are direct, left is mirrored', () => {
    expect(doorSpan({ ...base, door: { ...base.door, wall: 'back' } })).toEqual({ wall: 'back', s0: 800, s1: 1600 });
    expect(doorSpan({ ...base, door: { ...base.door, wall: 'right' } })).toEqual({ wall: 'right', s0: 800, s1: 1600 });
    expect(doorSpan({ ...base, door: { ...base.door, wall: 'left' } })).toEqual({ wall: 'left', s0: 2000 - 1600, s1: 2000 - 800 });
  });
});

describe('segments', () => {
  const p = defaultProject(); // back+left+right enabled, front disabled, door on front
  it('back wall runs full length', () => {
    expect(wallSegments(p, 'back')).toEqual([{ wall: 'back', index: 0, s0: 0, s1: 2400 }]);
  });
  it('side walls give way to the back wall only', () => {
    expect(wallSegments(p, 'left')).toEqual([{ wall: 'left', index: 0, s0: 0, s1: 2000 - 600 }]);   // back corner is on the viewer's right
    expect(wallSegments(p, 'right')).toEqual([{ wall: 'right', index: 0, s0: 600, s1: 2000 }]);    // back corner is on the viewer's left
  });
  it('front wall (disabled here) with the door splits into two segments with margins', () => {
    expect(wallSegments(p, 'front')).toEqual([
      { wall: 'front', index: 0, s0: 0, s1: 800 - 80 },
      { wall: 'front', index: 1, s0: 1600 + 80, s1: 2400 },
    ]);
  });
  it('enabling the front wall claims the side walls\' front corners', () => {
    const q = { ...p, wardrobe: { ...p.wardrobe, walls: { ...p.wardrobe.walls, front: { ...p.wardrobe.walls.front, enabled: true } } } };
    expect(wallSegments(q, 'left')[0]).toEqual({ wall: 'left', index: 0, s0: 400, s1: 1400 });
    expect(cornerClaim(q, 'right', 'end')).toBe(400);
  });
  it('a door in the back-left corner removes that claim', () => {
    const q = { ...p, door: { ...p.door, wall: 'back' as const, offset: 0 } };
    expect(cornerClaim(q, 'left', 'end')).toBe(0);
    expect(cornerClaim(q, 'right', 'start')).toBe(600);
  });
  it('disabled neighbour claims nothing', () => {
    const q = { ...p, wardrobe: { ...p.wardrobe, walls: { ...p.wardrobe.walls, back: { ...p.wardrobe.walls.back, enabled: false } } } };
    expect(wallSegments(q, 'left')[0].s1).toBe(2000);
  });
  it('segmentFree', () => {
    expect(segmentFree(p, wallSegments(p, 'back')[0])).toBe(0);
    expect(segmentFree(p, wallSegments(p, 'left')[0])).toBe(0);
    expect(segmentFree(p, wallSegments(p, 'right')[0])).toBe(0);
  });
});

describe('door swing + hinge', () => {
  const base = defaultProject();
  const withDoor = (d: Partial<Project['door']>): Project => ({ ...base, door: { ...base.door, ...d } });

  it('doorHingeS picks the s0 end for a left hinge and the s1 end for a right one', () => {
    const p = withDoor({ wall: 'back', offset: 800, width: 800 });
    const span = doorSpan(p);
    expect(doorHingeS({ ...p, door: { ...p.door, hinge: 'left' } })).toBe(span.s0);
    expect(doorHingeS({ ...p, door: { ...p.door, hinge: 'right' } })).toBe(span.s1);
  });

  it('doorSwingSign is +1 inwards (local +z) and -1 outwards', () => {
    expect(doorSwingSign(withDoor({ swing: 'in' }))).toBe(1);
    expect(doorSwingSign(withDoor({ swing: 'out' }))).toBe(-1);
  });

  it('back wall, hinge left, opening in', () => {
    const p = withDoor({ wall: 'back', offset: 800, width: 800, swing: 'in', hinge: 'left' });
    const { s0 } = doorSpan(p);
    const a = doorArc(p, 16);
    expect(a.arc).toHaveLength(17);
    near(a.hinge, v3(s0, 0, 0));
    near(a.tip, v3(s0, 0, 800));
    near(a.arc[0], v3(s0, 0, 800));
    near(a.arc[16], v3(s0 + 800, 0, 0));
  });

  it('back wall, hinge left, opening out', () => {
    const p = withDoor({ wall: 'back', offset: 800, width: 800, swing: 'out', hinge: 'left' });
    const { s0 } = doorSpan(p);
    const a = doorArc(p, 16);
    near(a.tip, v3(s0, 0, -800));
    near(a.arc[0], v3(s0, 0, -800));
    near(a.arc[16], v3(s0 + 800, 0, 0));
  });

  it('back wall, hinge right, opening in', () => {
    const p = withDoor({ wall: 'back', offset: 800, width: 800, swing: 'in', hinge: 'right' });
    const { s1 } = doorSpan(p);
    const a = doorArc(p, 16);
    near(a.hinge, v3(s1, 0, 0));
    near(a.tip, v3(s1, 0, 800));
    near(a.arc[16], v3(s1 - 800, 0, 0));
  });

  it('back wall, hinge right, opening out', () => {
    const p = withDoor({ wall: 'back', offset: 800, width: 800, swing: 'out', hinge: 'right' });
    const { s1 } = doorSpan(p);
    const a = doorArc(p, 16);
    near(a.hinge, v3(s1, 0, 0));
    near(a.tip, v3(s1, 0, -800));
    near(a.arc[16], v3(s1 - 800, 0, 0));
  });

  it('the arc stays a quarter circle of radius = door width around the hinge', () => {
    const p = withDoor({ wall: 'right', offset: 400, width: 700, swing: 'in', hinge: 'right' });
    const a = doorArc(p, 8);
    for (const q of a.arc) expect(Math.hypot(q.x - a.hinge.x, q.z - a.hinge.z)).toBeCloseTo(700, 6);
  });

  it('front wall is mirrored: world x decreases as local s grows', () => {
    const p = withDoor({ wall: 'front', offset: 800, width: 800, swing: 'in', hinge: 'left' });
    const { s0 } = doorSpan(p); // 800 on a 2400 wall -> world x 1600
    const a = doorArc(p, 16);
    near(a.hinge, v3(2400 - s0, 0, 2000));
    near(a.tip, v3(2400 - s0, 0, 2000 - 800)); // "in" is into the room, i.e. z decreasing here
    near(a.arc[16], v3(2400 - (s0 + 800), 0, 2000)); // closed leaf runs along +s -> x decreases
    expect(a.arc[16].x).toBeLessThan(a.hinge.x);
  });
});

describe('corners', () => {
  const base = defaultProject();
  const withCorner = (anchor: Wall, patch: Partial<CornerPlan>): Project => ({
    ...base,
    wardrobe: { ...base.wardrobe, corners: { ...base.wardrobe.corners, [anchor]: { ...base.wardrobe.corners[anchor], ...patch } } },
  });
  const enableFront = (p: Project): Project => ({
    ...p,
    wardrobe: { ...p.wardrobe, walls: { ...p.wardrobe.walls, front: { ...p.wardrobe.walls.front, enabled: true } } },
  });

  it('a wall start corner is anchored on that wall, its end corner on the next wall clockwise', () => {
    expect(cornerAt(base, 'back', 'start').anchor).toBe('back');
    expect(cornerAt(base, 'back', 'end').anchor).toBe('right');
    expect(cornerAt(base, 'left', 'end').anchor).toBe('back'); // left's far end = the back-left corner
    expect(cornerAt(base, 'back', 'start').b).toBe('left');
    expect(cornerAt(base, 'right', 'start').b).toBe('back');
  });

  it('a corner is active only when both of its walls are enabled', () => {
    expect(cornerActive(base, 'back')).toBe(true); // back + left
    expect(cornerActive(base, 'front')).toBe(false); // front is disabled
    expect(cornerActive(enableFront(base), 'front')).toBe(true);
  });

  it('mode "none" keeps the v1 rule: the side wall yields the back wall depth', () => {
    expect(cornerClaim(base, 'left', 'end')).toBe(600);
    expect(cornerClaim(base, 'right', 'start')).toBe(600);
    expect(cornerClaim(base, 'back', 'start')).toBe(0);
    expect(cornerClaim(base, 'back', 'end')).toBe(0);
  });

  it('mode "lshelf" makes BOTH walls give way by the leg length', () => {
    const p = withCorner('back', { mode: 'lshelf', width: 900 });
    expect(cornerClaim(p, 'back', 'start')).toBe(900); // anchor wall A
    expect(cornerClaim(p, 'left', 'end')).toBe(900); // wall B
    expect(wallSegments(p, 'back')[0]).toEqual({ wall: 'back', index: 0, s0: 900, s1: 2400 });
    expect(wallSegments(p, 'left')[0]).toEqual({ wall: 'left', index: 0, s0: 0, s1: 2000 - 900 });
  });

  it('an lshelf corner with a disabled wall claims nothing', () => {
    const p = withCorner('front', { mode: 'lshelf', width: 900 }); // front wall is disabled
    expect(cornerClaim(p, 'front', 'start')).toBe(0);
    expect(cornerClaim(p, 'right', 'end')).toBe(0);
    expect(cornerClaim(enableFront(p), 'right', 'end')).toBe(900);
  });

  it('every corner of every wall resolves to the same plan from both sides', () => {
    const p = enableFront(withCorner('right', { mode: 'lshelf', width: 800 }));
    for (const wall of WALLS) {
      const start = cornerAt(p, wall, 'start');
      const end = cornerAt(p, leftOf(wall), 'end');
      expect(start.anchor).toBe(end.anchor);
      expect(start.plan).toEqual(end.plan);
      // An lshelf corner is symmetric; a "none" corner keeps the v1 asymmetry on purpose
      // (only the side wall yields), so symmetry is asserted for the lshelf one only.
      if (start.plan.mode === 'lshelf') {
        expect(cornerClaim(p, wall, 'start')).toBe(cornerClaim(p, leftOf(wall), 'end'));
      }
    }
    expect(cornerClaim(p, 'right', 'start')).toBe(800); // back-right, lshelf, from wall A
    expect(cornerClaim(p, 'back', 'end')).toBe(800); //    back-right, lshelf, from wall B
    expect(cornerClaim(p, 'front', 'start')).toBe(0); //   front-right "none": a back/front wall never yields
    expect(cornerClaim(p, 'right', 'end')).toBe(400); //   ...while the side wall does
  });
});
