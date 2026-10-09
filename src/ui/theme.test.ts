import { describe, expect, it } from 'vitest';
import { THEMES, THEME_COLOR_DARK, THEME_COLOR_LIGHT, applyTheme, isTheme, nextTheme } from './theme';

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

  it('writes the forced surface colour to every theme-color meta and restores each original on auto', () => {
    const root: { dataset: Record<string, string | undefined> } = { dataset: {} };
    const metas = [
      { media: '(prefers-color-scheme: light)', content: '#aaaaaa' },
      { media: '(prefers-color-scheme: dark)', content: '#bbbbbb' },
    ];
    applyTheme('light', root, metas);
    expect(metas.map((m) => m.content)).toEqual([THEME_COLOR_LIGHT, THEME_COLOR_LIGHT]);
    applyTheme('dark', root, metas);
    expect(metas.map((m) => m.content)).toEqual([THEME_COLOR_DARK, THEME_COLOR_DARK]);
    applyTheme('auto', root, metas);
    expect(metas.map((m) => m.content)).toEqual(['#aaaaaa', '#bbbbbb']);
  });
});
