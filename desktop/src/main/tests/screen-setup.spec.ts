import { describe, expect, it } from 'vitest';
import { currentScreenSetupKey, monitorSetupKey, screenSetupKey } from '../screen-setup';

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

describe('monitorSetupKey (GNOME, one key per physical monitor)', () => {
  const laptop = { connector: 'eDP-1', vendor: 'LEN', product: '0x40ba', serial: '0x00000000' };
  const hpDeskA = { connector: 'DP-3', vendor: 'HWP', product: 'HP E240', serial: '6CM6510R4J' };
  const hpDeskB = { ...hpDeskA, serial: '6CM6510XYZ' };

  it('tells two monitors of the same model apart by serial, as at two hot desks', () => {
    expect(monitorSetupKey([laptop, hpDeskA])).not.toBe(monitorSetupKey([laptop, hpDeskB]));
  });

  it('is the same monitor whichever port it is plugged into', () => {
    expect(monitorSetupKey([{ ...hpDeskA, connector: 'HDMI-1' }])).toBe(monitorSetupKey([hpDeskA]));
  });

  it('tells twin monitors with no serial apart by port', () => {
    const twin = { connector: 'DP-1', vendor: 'GSM', product: 'LG 24', serial: '' };

    expect(monitorSetupKey([{ ...twin, connector: 'DP-2' }])).not.toBe(monitorSetupKey([twin]));
  });

  it('tells the laptop alone from the monitor alone, and from both', () => {
    const keys = new Set([
      monitorSetupKey([laptop]),
      monitorSetupKey([hpDeskA]),
      monitorSetupKey([laptop, hpDeskA]),
    ]);
    expect(keys.size).toBe(3);
  });

  it('is the same whatever order the monitors are listed in', () => {
    expect(monitorSetupKey([hpDeskA, laptop])).toBe(monitorSetupKey([laptop, hpDeskA]));
  });
});

describe('currentScreenSetupKey', () => {
  const electron = [{ internal: true, label: 'Built-in display', size: { width: 1920, height: 1080 } }];
  const laptop = { connector: 'eDP-1', vendor: 'LEN', product: '0x40ba', serial: '0x00000000' };

  it("uses GNOME's monitors where it can list them", async () => {
    const key = await currentScreenSetupKey({
      listMonitors: () => Promise.resolve([laptop]),
      listDisplays: () => electron,
    });

    expect(key).toBe(monitorSetupKey([laptop]));
  });

  it("falls back to Electron's screens on other desktops, under a key of its own", async () => {
    const key = await currentScreenSetupKey({
      listMonitors: () => Promise.reject(new Error('no Mutter here')),
      listDisplays: () => electron,
    });

    expect(key).toBe(screenSetupKey(electron));
    expect(key).not.toBe(monitorSetupKey([laptop]));
  });

  it('falls back when GNOME lists nothing shown', async () => {
    const key = await currentScreenSetupKey({
      listMonitors: () => Promise.resolve([]),
      listDisplays: () => electron,
    });

    expect(key).toBe(screenSetupKey(electron));
  });
});
