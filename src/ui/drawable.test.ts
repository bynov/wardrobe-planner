import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { planView } from '../drawing/views';
import { drawable } from './drawable';

const box = (w: number, h: number) => ({ bounds: { min: { x: 0, y: 0 }, max: { x: w, y: h } } });

describe('drawable', () => {
  it('accepts a finite, non-empty box', () => {
    expect(drawable(box(100, 50))).toBe(true);
  });

  it('rejects NaN and empty boxes', () => {
    expect(drawable(box(Number.NaN, 50))).toBe(false);
    expect(drawable({ bounds: { min: { x: 0, y: 0 }, max: { x: Number.POSITIVE_INFINITY, y: 5 } } })).toBe(false);
    expect(drawable(box(0, 50))).toBe(false);
    expect(drawable(box(100, 0))).toBe(false);
    expect(drawable(box(-10, -10))).toBe(false);
  });

  it('accepts the default project and its plan', () => {
    const p = defaultProject();
    expect(drawable(planView(p), p)).toBe(true);
  });

  it('rejects non-positive room dimensions even when the bounds look fine', () => {
    for (const key of ['width', 'depth', 'height'] as const) {
      for (const bad of [0, -5, Number.NaN]) {
        const p = defaultProject();
        p.room[key] = bad;
        expect(drawable(box(100, 50), p)).toBe(false);
      }
    }
  });

  it('rejects a non-positive depth on an enabled wall but ignores disabled ones', () => {
    const p = defaultProject();
    p.wardrobe.walls.back.enabled = true;
    p.wardrobe.walls.back.depth = -600;
    expect(drawable(box(100, 50), p)).toBe(false);

    const q = defaultProject();
    q.wardrobe.walls.front.enabled = false;
    q.wardrobe.walls.front.depth = -600;
    expect(drawable(box(100, 50), q)).toBe(true);
  });

  it('a negative room width really does produce a finite box — the project check is what catches it', () => {
    const p = defaultProject();
    p.room.width = -3000;
    expect(drawable(planView(p))).toBe(true); // bounds alone say yes
    expect(drawable(planView(p), p)).toBe(false); // the project says no
  });
});
