/** The three window sizes; `mini` is the 68px square. */
export type WindowMode = 'full' | 'compact' | 'mini';

/**
 * Whether the window should float above everything else.
 *
 * One preference for every size, set from the tray. A toggle that
 * silently did nothing in whichever view happened to be open would be
 * worse than no toggle at all, and the tray is the one control surface
 * that is reachable from all three.
 */
export function shouldPin(_mode: WindowMode, preference: boolean): boolean {
  return preference;
}
