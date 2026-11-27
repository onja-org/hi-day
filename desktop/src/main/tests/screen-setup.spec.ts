import { describe, expect, it } from 'vitest';
import { screenSetupKey } from '../screen-setup';

const builtIn = { internal: true, label: 'Built-in display', size: { width: 1920, height: 1080 } };
const monitor = { internal: false, label: '', size: { width: 1920, height: 1080 } };

describe('screenSetupKey', () => {
  it('tells the laptop alone from a monitor alone, even at the same size', () => {
    // The lid closed on a monitor leaves one 1920×1080 screen either way.
    expect(screenSetupKey([builtIn])).not.toBe(screenSetupKey([monitor]));
  });

  it('tells the laptop with a monitor from either alone', () => {
    const both = screenSetupKey([builtIn, monitor]);

    expect(both).not.toBe(screenSetupKey([builtIn]));
    expect(both).not.toBe(screenSetupKey([monitor]));
  });

  it('is the same whatever order the screens are listed in', () => {
    expect(screenSetupKey([builtIn, monitor])).toBe(screenSetupKey([monitor, builtIn]));
  });

  it('names a setup the same however the system flags the built-in screen', () => {
    // Under XWayland the flag is not reliable: with the lid closed on a
    // monitor, the monitor was reported as internal once and external the
    // next time — the same setup under two names, so the choice saved for
    // it was not found and "Grant Access" came back.
    const flaggedInternal = { ...monitor, internal: true };

    expect(screenSetupKey([flaggedInternal])).toBe(screenSetupKey([monitor]));
  });

  it('tells monitors apart by name where the system gives one', () => {
    const hp = { ...monitor, label: 'Hewlett Packard 24"' };
    const dell = { ...monitor, label: 'DELL P2419H' };

    expect(screenSetupKey([builtIn, hp])).not.toBe(screenSetupKey([builtIn, dell]));
  });

  it('still names a setup when no screen is reported', () => {
    expect(screenSetupKey([])).toBe('no-screens');
  });
});
