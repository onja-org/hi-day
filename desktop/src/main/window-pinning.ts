/** The three window sizes; `mini` is the 68px square. */
export type WindowMode = 'full' | 'compact' | 'mini';

/**
 * Whether the window should float above everything else.
 *
 * One preference covers both small views rather than one each. They are
 * the same intent — keep the timer where I can see it — and a person who
 * turns it off in the bar does not then want the square ignoring them.
 * The full window never floats: at 360×600 it is not a widget, and
 * pinning it would sit it on top of the work being tracked.
 *
 * `mini` used to be pinned unconditionally, on the reasoning that a
 * square lost behind an editor is no use at all. True, but it is not the
 * app's call to make — and with no control anywhere, somebody who wanted
 * it behind their work had nothing to turn off.
 */
export function shouldPin(mode: WindowMode, preference: boolean): boolean {
  if (mode === 'full') return false;
  return preference;
}
