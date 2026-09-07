import { describe, expect, it } from 'vitest';
import { planView, wallElevation, wallName } from './views';
import { defaultProject } from '../model/defaults';
import { cornerClaim, doorSpan, wallSegments } from '../geometry/frames';
import { layoutWall, type UnitLayout } from '../geometry/layout';
import type { Unit } from '../model/types';
import type { Drawing, Prim } from './ir';

type P<K extends Prim['t']> = Extract<Prim, { t: K }>;
const of = <K extends Prim['t']>(d: Drawing, k: K) => d.prims.filter((p): p is P<K> => p.t === k);
const texts = (d: Drawing) => of(d, 'text').map((p) => p.text);
const hasText = (d: Drawing, s: string) => texts(d).some((x) => x.includes(s));
const dimsDx = (d: Drawing) => of(d, 'dim').map((p) => Math.abs(p.b.x - p.a.x));
const dimsDy = (d: Drawing) => of(d, 'dim').map((p) => Math.abs(p.b.y - p.a.y));
const near = (xs: number[], v: number) => xs.filter((x) => Math.abs(x - v) < 0.01).length;

describe('wallName', () => {
  it('translates the wall key', () => {
    expect(wallName('en', 'back')).toBe('Back wall');
    expect(wallName('ru', 'left')).toBe('Левая стена');
  });
});

describe('planView', () => {
  const p = defaultProject();
  const d = planView(p, 'en');

  it('is titled, dimensioned and covers the room', () => {
    expect(d.title).toBe('Plan');
    expect(of(d, 'dim').length).toBeGreaterThanOrEqual(5);
    expect(d.bounds.max.x - d.bounds.min.x).toBeGreaterThan(2400);
    expect(d.bounds.max.y - d.bounds.min.y).toBeGreaterThan(2000);
  });

  it('labels the door and every wall', () => {
    expect(hasText(d, 'Door 800 × 2100')).toBe(true);
    for (const w of ['Back wall', 'Right wall', 'Front wall', 'Left wall']) expect(hasText(d, w)).toBe(true);
    expect(texts(d).join(' ')).not.toContain('NaN');
  });

  it('dimensions the room and the door opening', () => {
    expect(near(dimsDx(d), 2400)).toBeGreaterThanOrEqual(1); // room width
    expect(near(dimsDy(d), 2000)).toBeGreaterThanOrEqual(1); // room depth
    expect(near(dimsDx(d), 800)).toBeGreaterThanOrEqual(2); // door offset + door width
    expect(near(dimsDy(d), 600)).toBeGreaterThanOrEqual(1); // back wall depth
  });

  it('draws every enabled unit as a filled rectangle inside the room', () => {
    const filled = of(d, 'poly').filter((q) => q.fill === 'panel');
    const units = (['back', 'left', 'right'] as const).flatMap((w) => layoutWall(p, w)).filter((c) => c.kind === 'unit');
    expect(filled.length).toBeGreaterThanOrEqual(units.length);
    for (const q of filled) {
      for (const pt of q.pts) {
        expect(pt.x).toBeGreaterThanOrEqual(-0.01);
        expect(pt.x).toBeLessThanOrEqual(2400.01);
        expect(pt.y).toBeLessThanOrEqual(0.01);
        expect(pt.y).toBeGreaterThanOrEqual(-2000.01);
      }
    }
  });

  it('splits the door wall line and draws a swing arc', () => {
    const arcs = of(d, 'poly').filter((q) => !q.closed && q.pts.length === 13);
    expect(arcs).toHaveLength(1);
    const a = arcs[0];
    expect(a.pts[0].x).toBeCloseTo(1600, 6); // leaf tip, 800 mm into the room from the hinge
    expect(a.pts[0].y).toBeCloseTo(-1200, 6);
    expect(a.pts[12].x).toBeCloseTo(800, 6); // back at the wall at the far side of the opening
    expect(a.pts[12].y).toBeCloseTo(-2000, 6);
  });

  it('names the swing direction next to the opening', () => {
    expect(hasText(d, 'opens inwards')).toBe(true);
  });
});

describe('planView — hinge side and swing direction', () => {
  const swingArc = (dr: Drawing) => of(dr, 'poly').filter((q) => !q.closed && q.pts.length === 13)[0];
  const leaf = (dr: Drawing, hinge: { x: number; y: number }) =>
    of(dr, 'line').find((q) => Math.hypot(q.a.x - hinge.x, q.a.y - hinge.y) < 0.01 && Math.hypot(q.b.x - q.a.x, q.b.y - q.a.y) > 700);

  it('a right hinge opening outwards mirrors the leaf and swings out of the room', () => {
    const p = defaultProject();
    p.door = { wall: 'front', offset: 800, width: 800, height: 2100, swing: 'out', hinge: 'right' };
    const dr = planView(p, 'en');
    const a = swingArc(dr);
    expect(a.pts[0].x).toBeCloseTo(800, 6); // tip, 800 mm outside the room from the hinge at x = 800
    expect(a.pts[0].y).toBeCloseTo(-2800, 6);
    expect(a.pts[12].x).toBeCloseTo(1600, 6); // closed leaf runs back to the other jamb
    expect(a.pts[12].y).toBeCloseTo(-2000, 6);
    expect(leaf(dr, { x: 800, y: -2000 })).toBeTruthy();
    expect(hasText(dr, 'opens outwards')).toBe(true);
  });

  it('a right hinge opening inwards keeps the leaf inside the room', () => {
    const p = defaultProject();
    p.door = { wall: 'front', offset: 800, width: 800, height: 2100, swing: 'in', hinge: 'right' };
    const a = swingArc(planView(p, 'en'));
    expect(a.pts[0].x).toBeCloseTo(800, 6);
    expect(a.pts[0].y).toBeCloseTo(-1200, 6);
    expect(a.pts[12].x).toBeCloseTo(1600, 6);
    expect(a.pts[12].y).toBeCloseTo(-2000, 6);
  });

  it('the elevation label keeps the plain door text', () => {
    const p = defaultProject();
    p.door = { wall: 'back', offset: 600, width: 800, height: 2100, swing: 'out', hinge: 'right' };
    const dr = wallElevation(p, 'back', 'en');
    expect(hasText(dr, 'Door 800 × 2100')).toBe(true);
    expect(hasText(dr, 'opens')).toBe(false);
  });
});

describe('planView — door offset dimension', () => {
  // the two door dims are the only ones placed at +3 * textSize
  const doorDims = (d: Drawing) =>
    of(d, 'dim').filter((q) => Math.abs(q.offset - 3 * d.textSize) < 1e-6).map((q) => Math.hypot(q.b.x - q.a.x, q.b.y - q.a.y));

  it('measures a front-wall door from the x = 0 corner, not from s = 0', () => {
    const p = defaultProject();
    p.door = { wall: 'front', offset: 600, width: 800, height: 2100, swing: 'in', hinge: 'left' };
    const d = planView(p, 'en');
    expect(near(doorDims(d), 600)).toBe(1); // the offset
    expect(near(doorDims(d), 800)).toBe(1); // the opening
    expect(near(dimsDx(d), 1000)).toBe(0); // L - offset - width, the wrong end of the wall
  });

  it('measures a left-wall door from the z = 0 corner, not from s = 0', () => {
    const p = defaultProject();
    p.door = { wall: 'left', offset: 500, width: 800, height: 2100, swing: 'in', hinge: 'left' };
    const d = planView(p, 'en');
    expect(near(doorDims(d), 500)).toBe(1);
    expect(near(doorDims(d), 800)).toBe(1);
    expect(near(dimsDy(d), 700)).toBe(0); // L - offset - width
  });

  it('measures a back-wall door from s = 0, which is the x = 0 corner there', () => {
    const p = defaultProject();
    p.door = { wall: 'back', offset: 600, width: 800, height: 2100, swing: 'in', hinge: 'left' };
    const d = planView(p, 'en');
    expect(near(doorDims(d), 600)).toBe(1);
    expect(near(doorDims(d), 800)).toBe(1);
    expect(near(dimsDx(d), 1000)).toBe(0);
  });

  it('omits the offset dimension when the door sits in the corner', () => {
    const p = defaultProject();
    p.door = { wall: 'front', offset: 0, width: 800, height: 2100, swing: 'in', hinge: 'left' };
    expect(doorDims(planView(p, 'en'))).toHaveLength(1);
  });
});

describe('wallElevation — back wall', () => {
  const p = defaultProject();
  const d = wallElevation(p, 'back', 'en');

  it('is titled and dimensioned per column, segment and wall', () => {
    expect(d.title).toBe('Back wall — elevation');
    expect(near(dimsDx(d), 600)).toBe(4); // four 600 mm columns
    // one lone segment covering the whole wall repeats the wall dim, so only the wall dim is drawn
    expect(near(dimsDx(d), 2400)).toBe(1);
    expect(d.bounds.max.y).toBeGreaterThanOrEqual(2500);
  });

  it('dimensions plinth, carcass, ceiling gap and full height on the right', () => {
    const right = of(d, 'dim').filter((q) => q.a.x === 2400 && q.b.x === 2400);
    const dy = right.map((q) => Math.abs(q.b.y - q.a.y));
    for (const v of [100, 2250, 150, 2500]) expect(near(dy, v)).toBeGreaterThanOrEqual(1);
  });

  it('labels zones with their type and effective height', () => {
    expect(hasText(d, 'Hanging rail')).toBe(true);
    expect(hasText(d, 'Drawers 600')).toBe(true);
    expect(hasText(d, 'Shelves')).toBe(true);
  });

  it('moves the rail and its label when a hanging zone pins one', () => {
    const q = defaultProject();
    // unit 1 = drawers + hanging, and its rail is the one the wall's rail dimension picks up
    const u = q.wardrobe.walls.back.segments[0][0] as Unit;
    u.zones[1] = { ...u.zones[1], rod: { from: 'bottom', offset: 900 } };
    const e = wallElevation(q, 'back', 'en');
    expect(hasText(e, 'rail at 1636')).toBe(true); // the zone starts above the divider, at 736
    expect(near(dimsDy(e), 1636)).toBe(1);
    expect(hasText(d, 'rail at 1636')).toBe(false); // the auto rail sits elsewhere
  });

  it('draws filled carcasses, shelves, drawer fronts and rods', () => {
    const filled = of(d, 'poly').filter((q) => q.fill === 'panel');
    expect(filled.length).toBeGreaterThanOrEqual(4);
    const rods = filled.filter((q) => q.pts.length === 16);
    expect(rods).toHaveLength(3); // hanging zones: drawers+hanging, double hanging (x2)
    // every drawn point stays inside the room rectangle
    for (const q of of(d, 'poly')) for (const pt of q.pts) {
      expect(pt.x).toBeGreaterThanOrEqual(-0.01);
      expect(pt.x).toBeLessThanOrEqual(2400.01);
      expect(pt.y).toBeGreaterThanOrEqual(-0.01);
      expect(pt.y).toBeLessThanOrEqual(2500.01);
    }
  });

  it('keeps shelf/hanging labels off the boards and puts drawer labels on the lowest front', () => {
    const th = p.wardrobe.panelThickness;
    const units = layoutWall(p, 'back').filter((c): c is UnitLayout => c.kind === 'unit');
    const textH = d.textSize * 0.8;
    let checked = 0;
    for (const u of units) {
      const labels = of(d, 'text').filter((q) => Math.abs(q.at.x - (u.s0 + u.width / 2)) < 0.01);
      expect(labels).toHaveLength(u.zones.length); // one per zone, matched to this unit by centre x
      const shelves = u.zones.flatMap((z) => z.shelfYs.map((y): [number, number] => [y, y + th]));
      u.zones.forEach((z, i) => {
        const y = labels[i].at.y;
        checked += 1;
        if (z.zone.type === 'drawers') {
          const f = z.drawerFronts[0]; // lowest front
          const handleY = f.y0 + (f.y1 - f.y0) * 0.6;
          expect(y).toBeCloseTo(f.y0 + (f.y1 - f.y0) * 0.35, 6);
          expect(y + textH / 2).toBeLessThan(handleY); // whole cap height clears the handle
          expect(y - textH / 2).toBeGreaterThan(f.y0); // and stays inside the front
        } else {
          for (const [b0, b1] of shelves) expect([z.zone.type, y > b0 && y < b1]).toEqual([z.zone.type, false]);
          expect(y).toBeGreaterThan(z.yBot);
          expect(y).toBeLessThan(z.yTop);
        }
      });
    }
    expect(checked).toBe(7); // one label per zone: 2 + 2 + 1 + 2 across the four units
  });

  it('marks the ceiling gap', () => {
    expect(hasText(d, 'ceiling gap 150')).toBe(true);
  });

  it('has no door on it', () => {
    expect(hasText(d, 'Door')).toBe(false);
  });
});

describe('wallElevation — disabled wall', () => {
  const d = wallElevation(defaultProject(), 'front', 'en');
  it('draws only the room rectangle and a note', () => {
    expect(hasText(d, 'no wardrobe')).toBe(true);
    expect(of(d, 'poly').filter((q) => q.fill === 'panel')).toHaveLength(0);
    expect(of(d, 'dim')).toHaveLength(0);
  });
  it('still shows the door opening that sits on it', () => {
    expect(hasText(d, 'Door 800 × 2100')).toBe(true);
    const opening = of(d, 'poly').find((q) => q.stroke === 'dashed');
    expect(opening).toBeDefined();
    expect(opening!.pts.map((q) => q.x)).toEqual([800, 1600, 1600, 800]); // doorSpan on the front wall
    expect(Math.max(...opening!.pts.map((q) => q.y))).toBe(2100);
  });
  it('omits the door on a disabled wall that has none', () => {
    const p = defaultProject();
    p.wardrobe.walls.back.enabled = false;
    expect(hasText(wallElevation(p, 'back', 'en'), 'Door')).toBe(false);
  });
});

describe('wallElevation — side walls', () => {
  const p = defaultProject();

  it('right wall shows the gap column and the corner claim', () => {
    const d = wallElevation(p, 'right', 'en');
    expect(hasText(d, 'gap')).toBe(true);
    expect(of(d, 'poly').some((q) => q.stroke === 'dashed')).toBe(true);
    expect(hasText(d, 'Back wall')).toBe(true); // corner claim at s = 0
    expect(near(dimsDx(d), 2000)).toBe(1); // wall length only; the segment is 1400
    expect(near(dimsDx(d), 1400)).toBe(1);
  });

  it('left wall claims its corner at the far end', () => {
    const d = wallElevation(p, 'left', 'en');
    expect(hasText(d, 'Back wall')).toBe(true);
    const claim = of(d, 'poly').find((q) => q.stroke === 'dashed' && q.pts[0].x === 1400);
    expect(claim).toBeDefined();
  });
});

describe('russian', () => {
  const p = defaultProject();
  it('translates titles and labels', () => {
    expect(planView(p, 'ru').title).toBe('План');
    expect(planView(p, 'ru').title).not.toBe(planView(p, 'en').title);
    const d = wallElevation(p, 'back', 'ru');
    expect(d.title).toBe('Задняя стена — развёртка');
    expect(d.title).not.toBe(wallElevation(p, 'back', 'en').title);
    expect(hasText(d, 'Штанга')).toBe(true);
    expect(hasText(wallElevation(p, 'front', 'ru'), 'нет гардероба')).toBe(true);
    expect(hasText(wallElevation(p, 'right', 'ru'), 'пропуск')).toBe(true);
    // geometry is unchanged by language
    expect(dimsDx(d)).toEqual(dimsDx(wallElevation(p, 'back', 'en')));
  });
});

describe('wallElevation — left wall carrying the door', () => {
  const p = defaultProject();
  p.door = { wall: 'left', offset: 1000, width: 800, height: 2100, swing: 'in', hinge: 'left' };
  const d = wallElevation(p, 'left', 'en');
  const segs = wallSegments(p, 'left');

  it('splits the wall into two segments around the opening', () => {
    expect(segs).toHaveLength(2);
    expect(segs[0].s1).toBeLessThanOrEqual(segs[1].s0);
    // both are dimensioned: the wall is no longer one run covering its whole length
    for (const seg of segs) {
      if (seg.s1 - seg.s0 > 0) expect(near(dimsDx(d), seg.s1 - seg.s0)).toBeGreaterThanOrEqual(1);
    }
  });

  it('claims the back wall corner and draws the door opening', () => {
    // the back wall owns the far end of the left wall's run, and says so in the elevation
    expect(cornerClaim(p, 'left', 'end')).toBe(600);
    expect(cornerClaim(p, 'left', 'start')).toBe(0); // the front wall is disabled
    expect(hasText(d, 'Back wall')).toBe(true);
    const door = doorSpan(p);
    const opening = of(d, 'poly').find((q) =>
      q.stroke === 'dashed' &&
      Math.abs(Math.min(...q.pts.map((v) => v.x)) - door.s0) < 0.01 &&
      Math.abs(Math.max(...q.pts.map((v) => v.y)) - 2100) < 0.01);
    expect(opening).toBeTruthy();
    expect(hasText(d, 'Door 800 × 2100')).toBe(true);
  });
});

describe('corners in the drawings', () => {
  const bl = (() => {
    const q = structuredClone(defaultProject());
    q.wardrobe.corners.back = { mode: 'lshelf', width: 1000, shelves: 5 };
    return q;
  })();
  const t = 18;

  it('plan: the L footprint is drawn filled and tagged', () => {
    const d = planView(bl, 'en');
    const l = of(d, 'poly').find((q) => q.pts.length === 6 && q.fill === 'panel')!;
    expect(l).toBeDefined();
    // back-left corner: the back wall's frame is the identity and plan IR y = -world z
    expect(l.pts).toEqual([
      { x: 0, y: -0 }, { x: 1000, y: -0 }, { x: 1000, y: -600 }, { x: 600, y: -600 }, { x: 600, y: -1000 }, { x: 0, y: -1000 },
    ]);
    expect(hasText(d, 'BL')).toBe(true);
    expect(hasText(planView(defaultProject(), 'en'), 'BL')).toBe(false);
  });

  it('elevation of wall A: the solid end-panel face, then the open face with shelf lines', () => {
    const d = wallElevation(bl, 'back', 'en');
    const filled = of(d, 'poly').filter((q) => q.fill === 'panel');
    // the end panel of leg B closes s in [0, dB] = [0, 600]
    const face = filled.find((q) => q.pts[0].x === 0 && Math.max(...q.pts.map((v) => v.x)) === 600)!;
    expect(face).toBeDefined();
    expect(hasText(d, 'Left wall')).toBe(true); // the face belongs to wall B
    expect(hasText(d, 'BL')).toBe(true);
    // five shelf slabs across the open face s in [600, 1000 - t]
    const shelves = filled.filter((q) => q.pts[0].x === 600 && Math.max(...q.pts.map((v) => v.x)) === 1000 - t);
    expect(shelves).toHaveLength(4); // 5 compartments = 4 boards
    expect(near(dimsDx(d), 1000)).toBeGreaterThanOrEqual(1); // the leg length is dimensioned
  });

  it('elevation of wall B: mirrored — open face first, panel face at the far end', () => {
    const d = wallElevation(bl, 'left', 'en');
    const L = 2000;
    const filled = of(d, 'poly').filter((q) => q.fill === 'panel');
    const face = filled.find((q) => Math.min(...q.pts.map((v) => v.x)) === L - 600 && Math.max(...q.pts.map((v) => v.x)) === L)!;
    expect(face).toBeDefined(); // leg A's end panel over [L - dA, L]
    expect(hasText(d, 'Back wall')).toBe(true);
    const shelves = filled.filter((q) =>
      Math.min(...q.pts.map((v) => v.x)) === L - 1000 + t && Math.max(...q.pts.map((v) => v.x)) === L - 600);
    expect(shelves).toHaveLength(4);
  });

  it('a "none" corner still draws the v1 dashed wall section and no tag', () => {
    const d = wallElevation(defaultProject(), 'left', 'en');
    expect(of(d, 'poly').some((q) => q.stroke === 'dashed' && q.pts[0].x === 1400)).toBe(true);
    expect(hasText(d, 'BL')).toBe(false);
  });

  it('an lshelf corner with a disabled wall draws nothing', () => {
    const q = structuredClone(defaultProject());
    q.wardrobe.corners.front = { mode: 'lshelf', width: 1000, shelves: 5 }; // front wall is off
    expect(hasText(planView(q, 'en'), 'FR')).toBe(false);
    expect(hasText(wallElevation(q, 'right', 'en'), 'FR')).toBe(false);
  });

  it('russian keeps the geometry and the latin tag', () => {
    const en = wallElevation(bl, 'back', 'en');
    const ru = wallElevation(bl, 'back', 'ru');
    expect(dimsDx(ru)).toEqual(dimsDx(en));
    expect(hasText(ru, 'BL')).toBe(true);
  });
});
