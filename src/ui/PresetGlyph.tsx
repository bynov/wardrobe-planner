import type { PresetKey } from '../model/presets';

/** The mini column diagram on a preset card; its look is pure CSS (`.glyph-<preset>`). */
export function PresetGlyph({ preset, size = 'tray' }: { preset: PresetKey; size?: 'tray' | 'zone' }) {
  return <span className={`glyph glyph-${preset} glyph-${size}`} aria-hidden="true" />;
}
