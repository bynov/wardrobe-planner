import { describe, expect, it } from 'vitest';
import { makeTemplate } from '../model/templates';
import { insertTarget } from './insertTarget';
import { trayState } from './trayState';

const NONE = { wall: 'back', columnId: null, zoneId: null } as const;

describe('trayState', () => {
  it('reports an enabled wall with its free length', () => {
    const p = makeTemplate('lShape', 'x');
    const s = trayState(p, insertTarget(p, NONE, null));
    expect(s.wallOff).toBe(false);
    expect(Number.isFinite(s.free)).toBe(true);
  });
  it('flags a disabled wall', () => {
    const p = makeTemplate('lShape', 'x');
    const wall = (['back', 'right', 'front', 'left'] as const).find((w) => !p.wardrobe.walls[w].enabled);
    expect(wall).toBeDefined();
    const sel = { wall: wall!, columnId: null, zoneId: null } as const;
    expect(trayState(p, insertTarget(p, sel, null)).wallOff).toBe(true);
  });
});
