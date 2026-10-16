const RESERVED_SELECTOR =
  'input, select, textarea, button, a[href], summary, [contenteditable=""], [contenteditable="true"], ' +
  '[role="button"], [role="checkbox"], [role="switch"], [role="slider"]';

/**
 * True when Space already does something for the focused element (types a space, presses a button,
 * opens a list), so the global "Space starts and stops the exercise" shortcut must leave it alone.
 */
export function isSpaceReserved(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(RESERVED_SELECTOR) !== null;
}
