import { describe, expect, it } from 'vitest';
import { commitDraft } from './fields';

describe('commitDraft', () => {
  it('mm commits any finite number the box can hold', () => {
    expect(commitDraft('600', 'mm')).toBe(600);
    expect(commitDraft(' 600.5 ', 'mm')).toBe(600.5);
    expect(commitDraft('-5', 'mm')).toBe(-5); // the model, not the input, rejects it
  });
  it('mm holds back a half-typed value', () => {
    for (const s of ['', '  ', '-', '1e', 'abc']) expect(commitDraft(s, 'mm'), s).toBeNull();
  });
  it('in commits whole, decimal and fractional inches as mm', () => {
    expect(commitDraft('23 5/8', 'in')).toBeCloseTo(600.075, 3);
    expect(commitDraft('23.625', 'in')).toBeCloseTo(600.075, 3);
    expect(commitDraft('5/8', 'in')).toBeCloseTo(15.875, 3);
  });
  it('in holds back a half-typed value', () => {
    for (const s of ['', '23 5', '23 5/', '5/0', 'abc']) expect(commitDraft(s, 'in'), s).toBeNull();
  });
});
