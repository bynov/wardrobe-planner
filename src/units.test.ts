import { describe, expect, it } from 'vitest';
import { detectUnits, formatLen, parseLen, stepFor, toDisplay, fromDisplay } from './units';

describe('formatLen', () => {
  it('mm keeps fmtLen behaviour', () => {
    expect(formatLen(600, 'mm')).toBe('600');
    expect(formatLen(600.25, 'mm')).toBe('600.3');
    expect(formatLen(600, 'mm', { suffix: true })).toBe('600');
  });
  it('inches to the nearest 1/16, reduced', () => {
    expect(formatLen(600, 'in')).toBe('23 5/8');         // 23.622 → 23 10/16 → 23 5/8
    expect(formatLen(25.4, 'in')).toBe('1');
    expect(formatLen(12.7, 'in')).toBe('1/2');
    expect(formatLen(0, 'in')).toBe('0');
    expect(formatLen(2540, 'in')).toBe('100');             // no feet
    expect(formatLen(600, 'in', { suffix: true })).toBe('23 5/8″');
    expect(formatLen(25.3, 'in')).toBe('1');               // rounds up across the integer
  });
  // An auto zone height reaches the inputs as NaN and has to render as an empty box.
  it('renders a non-finite length as nothing', () => {
    for (const n of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(formatLen(n, 'mm'), String(n)).toBe('');
      expect(formatLen(n, 'in'), String(n)).toBe('');
    }
  });
});
describe('parseLen', () => {
  it.each([['23', 584.2], ['23.625', 600.075], ['23 5/8', 600.075], ['23-5/8', 600.075], ['5/8', 15.875], [' 1 ', 25.4]])('in %s', (s, mm) => {
    expect(parseLen(s, 'in')).toBeCloseTo(mm, 3);
  });
  it('mm plain numbers only', () => {
    expect(parseLen('600', 'mm')).toBe(600);
    expect(parseLen('600.5', 'mm')).toBe(600.5);
    expect(parseLen('23 5/8', 'mm')).toBeNull();
  });
  it('accepts a leading or trailing dot', () => {
    expect(parseLen('.5', 'mm')).toBe(0.5);
    expect(parseLen('5.', 'mm')).toBe(5);
    expect(parseLen('.5', 'in')).toBeCloseTo(12.7, 3);
    expect(parseLen('5.', 'in')).toBeCloseTo(127, 3);
  });
  // An inch fraction is 25.4 × a binary fraction: the raw product carries float noise into the
  // stored project and its JSON, so the millimetres come back quantised to a micron.
  it('quantises the millimetres it returns', () => {
    expect(parseLen('23 5/8', 'in')).toBe(600.075);
    expect(parseLen('23.625', 'in')).toBe(600.075);
    expect(parseLen('1', 'in')).toBe(25.4);
    expect(parseLen('600.25', 'mm')).toBe(600.25);
    expect(parseLen('600.0006', 'mm')).toBe(600.001);
  });
  it('rejects garbage and negatives', () => {
    for (const s of ['', '-', 'abc', '1/0', '-5', '5/', '1e3x', '.']) expect(parseLen(s, 'in'), s).toBeNull();
    expect(parseLen('-5', 'mm')).toBeNull();
    expect(parseLen('.', 'mm')).toBeNull();
  });
});
describe('detectUnits', () => {
  it('only the US reads inches', () => {
    expect(detectUnits('en-US')).toBe('in');
    expect(detectUnits('EN-us')).toBe('in');
    expect(detectUnits('en-GB')).toBe('mm');
    expect(detectUnits('ru-RU')).toBe('mm');
    expect(detectUnits(undefined)).toBe('mm');
  });
});
it('step and conversions', () => {
  expect(stepFor('mm')).toBe(1);
  expect(stepFor('in')).toBe(0.0625);
  expect(toDisplay(25.4, 'in')).toBeCloseTo(1);
  expect(fromDisplay(1, 'in')).toBeCloseTo(25.4);
  expect(toDisplay(7, 'mm')).toBe(7);
});
