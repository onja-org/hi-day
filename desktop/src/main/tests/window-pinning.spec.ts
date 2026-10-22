import { describe, expect, it } from 'vitest';
import { shouldPin } from '../window-pinning';

describe('which windows float above everything else', () => {
  it('follows the preference whatever size is showing', () => {
    // Set from the tray, which is the one control surface reachable from
    // all three — a toggle that did nothing in whichever view happened
    // to be open would be worse than no toggle at all.
    for (const mode of ['full', 'compact', 'mini'] as const) {
      expect(shouldPin(mode, true)).toBe(true);
      expect(shouldPin(mode, false)).toBe(false);
    }
  });
});
