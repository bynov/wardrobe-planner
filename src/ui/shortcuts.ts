import type { MessageKey } from '../i18n';

/** What `useKeyboard.ts` implements, one row per binding, for the shortcuts dialog. */
export const SHORTCUTS: { keys: string; labelKey: MessageKey }[] = [
  { keys: '⌘/Ctrl+Z', labelKey: 'shortcut.undo' },
  { keys: '⇧⌘/Ctrl+Z', labelKey: 'shortcut.redo' },
  { keys: '⌘/Ctrl+Y', labelKey: 'shortcut.redo' },
  { keys: '⌘/Ctrl+D', labelKey: 'shortcut.duplicate' },
  { keys: 'Esc', labelKey: 'shortcut.deselect' },
  { keys: 'Delete / Backspace', labelKey: 'shortcut.delete' },
];
