/** The three window sizes; `mini` is the 68px square. */
export type WindowMode = 'full' | 'compact' | 'mini';

/**
 * Whether the window should float above everything else.
 *
 * The compact bar and the square are widgets — kept in a corner while the
 * work happens elsewhere, and no use at all behind an editor. The full
 * window is not: at 360×600 it is the app itself, and floating it would
 * put it on top of the very thing being tracked.
 *
 * One preference for both small views, set from the tray, which is the
 * only control surface reachable from all three.
 */
export function shouldPin(mode: WindowMode, preference: boolean): boolean {
  if (mode === 'full') return false;
  return preference;
}
