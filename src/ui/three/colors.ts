import type { PartKind } from '../../geometry/parts';
import type { Theme } from '../theme';

/**
 * three.js materials cannot read CSS variables, so the scene keeps a hex table hand-derived from
 * the tokens in `site/tokens.css` (oklch -> sRGB, approximate). Keep it in step with them. The dark
 * wood is lifted well above the dark `--wood` tokens: scene lighting multiplies a material's colour,
 * and the true token values vanish into the background.
 *
 *   background -> --bg       floor -> --sunk      wall -> --surface   lines -> --ink3
 *   door -> --line2          carcass (side/top/bottom/divider) -> --wood2
 *   shelf/lip -> --wood      back -> --wood2 darkened   drawerFront -> --accent-soft
 *   plinth -> --sunk darkened   rod -> --ink3
 */
export interface SceneColors {
  background: string;
  floor: string;
  wall: string;
  lines: string;
  door: string;
  parts: Record<PartKind, string>;
}

export const LIGHT: SceneColors = {
  background: '#f7f5f3',
  floor: '#ece9e5',
  wall: '#fefdfc',
  lines: '#78746e',
  door: '#cdcac5',
  parts: {
    side: '#e6dacb',
    top: '#e6dacb',
    bottom: '#e6dacb',
    divider: '#e6dacb',
    shelf: '#f2eade',
    lip: '#f2eade',
    back: '#d4c6b3',
    drawerFront: '#fee6d4',
    plinth: '#bfb8ae',
    rod: '#78746e',
  },
};

export const DARK: SceneColors = {
  background: '#110f0d',
  floor: '#1f1b17',
  wall: '#2c2823',
  lines: '#8f8c87',
  door: '#433f3a',
  parts: {
    side: '#8a7a68',
    top: '#8a7a68',
    bottom: '#8a7a68',
    divider: '#8a7a68',
    shelf: '#716455',
    lip: '#716455',
    back: '#554a3e',
    drawerFront: '#b07a4a',
    plinth: '#3a332b',
    rod: '#8f8c87',
  },
};

/** Dark for a forced dark theme, or for `auto` while the OS prefers dark. */
export function sceneColors(theme: Theme, prefersDark: boolean): SceneColors {
  return theme === 'dark' || (theme === 'auto' && prefersDark) ? DARK : LIGHT;
}
