import { describe, expect, it } from 'vitest';
import { pinLevel, shouldPin } from '../window-pinning';

describe('which windows float above everything else', () => {
  it('never floats the full window', () => {
    expect(shouldPin('full', true)).toBe(false);
    expect(shouldPin('full', false)).toBe(false);
  });

  it('floats both small views when the preference is on', () => {
    expect(shouldPin('compact', true)).toBe(true);
    expect(shouldPin('mini', true)).toBe(true);
  });

  // It used to be pinned unconditionally, with no control anywhere.
  it('lets the smallest view be turned off too', () => {
    expect(shouldPin('mini', false)).toBe(false);
  });

  it('keeps the two small views in step', () => {
    expect(shouldPin('compact', false)).toBe(shouldPin('mini', false));
  });

  it('clears the taskbar band on Windows', () => {
    expect(pinLevel('win32')).toBe('pop-up-menu');
  });

  // The level they already used, so the fix cannot change them.
  it('leaves macOS and Linux where they were', () => {
    expect(pinLevel('darwin')).toBe('floating');
    expect(pinLevel('linux')).toBe('floating');
  });
});
