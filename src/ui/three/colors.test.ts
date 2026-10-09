import { describe, expect, it } from 'vitest';
import { DARK, LIGHT, sceneColors } from './colors';
import { THEMES } from '../theme';
import type { PartKind } from '../../geometry/parts';

const KINDS: PartKind[] = ['side', 'top', 'bottom', 'back', 'divider', 'shelf', 'lip', 'drawerFront', 'plinth', 'rod'];
const HEX = /^#[0-9a-f]{6}$/;

describe('sceneColors', () => {
  it('forced light and dark ignore the OS preference', () => {
    expect(sceneColors('light', true)).toBe(LIGHT);
    expect(sceneColors('light', false)).toBe(LIGHT);
    expect(sceneColors('dark', false)).toBe(DARK);
    expect(sceneColors('dark', true)).toBe(DARK);
  });
  it('auto follows the OS preference', () => {
    expect(sceneColors('auto', false)).toBe(LIGHT);
    expect(sceneColors('auto', true)).toBe(DARK);
  });
  it('covers every theme', () => {
    for (const th of THEMES) expect([LIGHT, DARK]).toContain(sceneColors(th, false));
  });
  it.each([['light', LIGHT], ['dark', DARK]])('%s palette has a hex colour for every part kind', (_n, pal) => {
    for (const k of KINDS) expect(pal.parts[k], k).toMatch(HEX);
    expect(Object.keys(pal.parts).sort()).toEqual([...KINDS].sort());
    for (const c of [pal.background, pal.floor, pal.wall, pal.lines, pal.door]) expect(c).toMatch(HEX);
  });
  it('the two palettes differ', () => {
    expect(LIGHT.background).not.toBe(DARK.background);
  });
});
