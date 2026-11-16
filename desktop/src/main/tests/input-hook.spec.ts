import { describe, expect, it } from 'vitest';
import { inputHookBlocker } from '../input-hook';

describe('inputHookBlocker', () => {
  it('blocks Linux on Wayland', () => {
    expect(
      inputHookBlocker({ platform: 'linux', isWayland: true, macInputTrusted: () => true }),
    ).toBe('wayland');
  });

  it('allows Linux on X11', () => {
    expect(
      inputHookBlocker({ platform: 'linux', isWayland: false, macInputTrusted: () => false }),
    ).toBeNull();
  });

  it('needs the macOS permission', () => {
    expect(
      inputHookBlocker({ platform: 'darwin', isWayland: false, macInputTrusted: () => false }),
    ).toBe('permission');
    expect(
      inputHookBlocker({ platform: 'darwin', isWayland: false, macInputTrusted: () => true }),
    ).toBeNull();
  });

  // Antivirus can't be known in advance: a refused start is caught then.
  it('allows Windows', () => {
    expect(
      inputHookBlocker({ platform: 'win32', isWayland: false, macInputTrusted: () => false }),
    ).toBeNull();
  });
});
