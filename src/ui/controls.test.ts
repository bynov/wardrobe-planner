import { describe, expect, it } from 'vitest';
import { clampStep } from './controls';

describe('clampStep', () => {
  it('adds the delta inside the range', () => {
    expect(clampStep(500, 50, 100, 1000)).toBe(550);
    expect(clampStep(500, -50, 100, 1000)).toBe(450);
  });
  it('clamps at both ends', () => {
    expect(clampStep(990, 50, 100, 1000)).toBe(1000);
    expect(clampStep(120, -50, 100, 1000)).toBe(100);
  });
  it('returns min when max is below min', () => {
    expect(clampStep(500, 50, 300, 200)).toBe(300);
  });
});
