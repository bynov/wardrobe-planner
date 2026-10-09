import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { SHORTCUTS } from './shortcuts';

describe('SHORTCUTS', () => {
  it('has a translated label for every entry', () => {
    for (const s of SHORTCUTS) expect(Object.keys(en), s.labelKey).toContain(s.labelKey);
  });
  // One entry per branch of useKeyboard.ts: undo, redo (two chords), duplicate, deselect, delete.
  it('lists exactly what useKeyboard implements', () => {
    expect(SHORTCUTS.map((s) => s.keys)).toEqual([
      '⌘/Ctrl+Z', '⇧⌘/Ctrl+Z', '⌘/Ctrl+Y', '⌘/Ctrl+D', 'Esc', 'Delete / Backspace',
    ]);
  });
});
