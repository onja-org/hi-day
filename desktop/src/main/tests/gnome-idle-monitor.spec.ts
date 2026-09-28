import { describe, expect, it, vi } from 'vitest';
import { GnomeIdleMonitor } from '../gnome-idle-monitor';

function fakeBus(call: (msg: unknown) => Promise<{ body: unknown[] }>) {
  return { call, disconnect: vi.fn() };
}

describe('GnomeIdleMonitor', () => {
  it('returns the idle milliseconds from GetIdletime', async () => {
    const bus = fakeBus(() => Promise.resolve({ body: [31604n] }));
    const monitor = new GnomeIdleMonitor({ createSessionBus: () => bus as never });

    await expect(monitor.getIdleMilliseconds()).resolves.toBe(31604);
  });

  it('disconnects the bus after a successful call', async () => {
    const bus = fakeBus(() => Promise.resolve({ body: [1000n] }));
    const monitor = new GnomeIdleMonitor({ createSessionBus: () => bus as never });

    await monitor.getIdleMilliseconds();

    expect(bus.disconnect).toHaveBeenCalledTimes(1);
  });

  it('returns null and disconnects when the call rejects (non-GNOME desktop, no session bus, etc)', async () => {
    const bus = fakeBus(() =>
      Promise.reject(
        new Error('org.gnome.Mutter.IdleMonitor was not provided by any .service files'),
      ),
    );
    const monitor = new GnomeIdleMonitor({
      logger: vi.fn(),
      createSessionBus: () => bus as never,
    });

    await expect(monitor.getIdleMilliseconds()).resolves.toBeNull();
    expect(bus.disconnect).toHaveBeenCalledTimes(1);
  });

  it('returns null when the reply body is empty', async () => {
    const bus = fakeBus(() => Promise.resolve({ body: [] }));
    const monitor = new GnomeIdleMonitor({ createSessionBus: () => bus as never });

    await expect(monitor.getIdleMilliseconds()).resolves.toBeNull();
  });
});
