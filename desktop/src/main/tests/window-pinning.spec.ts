import { describe, expect, it } from 'vitest';
import { shouldPin } from '../window-pinning';

describe('which windows float above everything else', () => {
  it('never pins the full window', () => {
    // At 360x600 it is not a widget, and pinning it would sit it on top
    // of the work being tracked.
    expect(shouldPin('full', true)).toBe(false);
    expect(shouldPin('full', false)).toBe(false);
  });

  it('pins both small views when the preference is on', () => {
    expect(shouldPin('compact', true)).toBe(true);
    expect(shouldPin('mini', true)).toBe(true);
  });

  it('lets the smallest view be turned off too', () => {
    // It used to be pinned unconditionally, with no control anywhere —
    // so somebody who wanted it behind their work had nothing to press.
    expect(shouldPin('mini', false)).toBe(false);
  });

  it('keeps the two small views in step', () => {
    // One preference, so turning it off in the bar is not undone by
    // shrinking to the square.
    expect(shouldPin('compact', false)).toBe(shouldPin('mini', false));
  });
});
