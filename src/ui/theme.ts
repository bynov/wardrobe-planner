export type Theme = 'auto' | 'light' | 'dark';

export const THEMES: Theme[] = ['auto', 'light', 'dark'];

export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);

/** The theme button's cycle: auto -> light -> dark -> auto. */
export const nextTheme = (t: Theme): Theme => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];

/**
 * Light/dark are forced with `data-theme` on `<html>`; auto removes it so the
 * `prefers-color-scheme` media query in tokens.css decides. `root` is injected (pass
 * `document.documentElement`) to keep this DOM-free and testable.
 */
export function applyTheme(theme: Theme, root: { dataset: Record<string, string | undefined> }): void {
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
