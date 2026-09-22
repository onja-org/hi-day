import { describe, expect, it } from 'vitest';
import { supportsAutoLaunch, usesNativeLoginItem } from '../auto-launch';

describe('supportsAutoLaunch', () => {
  it('is true on every platform this app ships on', () => {
    expect(supportsAutoLaunch('win32')).toBe(true);
    expect(supportsAutoLaunch('darwin')).toBe(true);
    expect(supportsAutoLaunch('linux')).toBe(true);
  });
});

describe('usesNativeLoginItem', () => {
  it('is true on Windows and macOS', () => {
    expect(usesNativeLoginItem('win32')).toBe(true);
    expect(usesNativeLoginItem('darwin')).toBe(true);
  });

  it('is false on Linux, which goes through linux-autostart.ts instead', () => {
    expect(usesNativeLoginItem('linux')).toBe(false);
  });
});
