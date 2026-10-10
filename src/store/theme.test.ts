import { describe, expect, it } from 'vitest';
import { THEMES, isTheme, nextTheme } from './theme';

describe('theme', () => {
  it('cycles auto -> light -> dark -> auto', () => {
    expect(nextTheme('auto')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
  });

  it('recognises only the three themes', () => {
    for (const t of THEMES) expect(isTheme(t)).toBe(true);
    expect(isTheme('blue')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});
