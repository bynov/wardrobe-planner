import type { Theme } from '../store/theme';

export { THEMES, isTheme, nextTheme, type Theme } from '../store/theme';

/** Surface colours of the two themes, as in the `theme-color` metas of the HTML pages (tokens.css `--surface`). */
export const THEME_COLOR_LIGHT = '#fefefd';
export const THEME_COLOR_DARK = '#2a2927';

/** A `<meta name="theme-color">`: DOM elements fit as they are. */
export interface ThemeMeta {
  media: string;
  content: string;
}

const originals = new WeakMap<ThemeMeta, string>();

/**
 * Light/dark are forced with `data-theme` on `<html>`; auto removes it so the
 * `prefers-color-scheme` media query in tokens.css decides. `root` is injected (pass
 * `document.documentElement`) to keep this DOM-free and testable. The `theme-color` metas carry
 * media queries, which follow the OS and not the forced theme, so a forced theme overwrites all of
 * them with its surface colour and auto restores each one's own value.
 */
export function applyTheme(theme: Theme, root: { dataset: Record<string, string | undefined> }, metas: ThemeMeta[] = []): void {
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  for (const m of metas) {
    if (!originals.has(m)) originals.set(m, m.content);
    m.content = theme === 'auto' ? originals.get(m)! : theme === 'light' ? THEME_COLOR_LIGHT : THEME_COLOR_DARK;
  }
}
