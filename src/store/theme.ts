export type Theme = 'auto' | 'light' | 'dark';

export const THEMES: Theme[] = ['auto', 'light', 'dark'];

export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);

/** The theme button's cycle: auto -> light -> dark -> auto. */
export const nextTheme = (t: Theme): Theme => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
