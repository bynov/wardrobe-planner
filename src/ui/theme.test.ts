import { describe, expect, it } from 'vitest';
import { THEMES, applyTheme, isTheme, nextTheme } from './theme';

describe('theme', () => {
  it('applies light/dark as data-theme and removes it for auto', () => {
    const root: { dataset: Record<string, string | undefined> } = { dataset: {} };
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
    applyTheme('dark', root);
    applyTheme('auto', root);
    expect('theme' in root.dataset).toBe(false);
  });

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
