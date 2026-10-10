/**
 * Where Tab / Shift+Tab should land inside a modal with `count` focusable elements, given the
 * index that currently has focus (-1 when focus is outside the list). Wraps at both ends.
 * Returns null when there is nothing to focus.
 */
export function nextFocusIndex(count: number, current: number, shiftKey: boolean): number | null {
  if (count <= 0) return null;
  if (current < 0 || current >= count) return shiftKey ? count - 1 : 0;
  return (current + (shiftKey ? -1 : 1) + count) % count;
}
