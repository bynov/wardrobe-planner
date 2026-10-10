import { describe, expect, it } from 'vitest';
import { nextFocusIndex } from './focusTrap';

describe('nextFocusIndex', () => {
  it('has nowhere to go without focusables', () => {
    expect(nextFocusIndex(0, -1, false)).toBeNull();
  });
  it('stays on a single control in both directions', () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });
  it('moves forward and wraps to the first', () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });
  it('moves back and wraps to the last', () => {
    expect(nextFocusIndex(3, 2, true)).toBe(1);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });
  it('pulls focus in from outside the list', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });
});
