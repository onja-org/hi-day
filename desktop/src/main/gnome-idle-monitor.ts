import dbus from 'dbus-next';

const IDLE_MONITOR_NAME = 'org.gnome.Mutter.IdleMonitor';
const IDLE_MONITOR_CORE_PATH = '/org/gnome/Mutter/IdleMonitor/Core';

export interface GnomeIdleMonitorDeps {
  logger?: (line: string) => void;
  createSessionBus?: () => dbus.MessageBus;
}

/**
 * Idle time from GNOME's `org.gnome.Mutter.IdleMonitor`, which works on both
 * X11 and Wayland. Electron's `powerMonitor.getSystemIdleTime()` relies on the
 * X11 XScreenSaver extension and stays at 0 under Wayland (see
 * docs/adr/0007-...).
 */
export class GnomeIdleMonitor {
  private readonly logger: (line: string) => void;
  private readonly createSessionBus: () => dbus.MessageBus;

  constructor(deps: GnomeIdleMonitorDeps = {}) {
    this.logger = deps.logger ?? ((): void => undefined);
    this.createSessionBus = deps.createSessionBus ?? ((): dbus.MessageBus => dbus.sessionBus());
  }

  /** `null` on any failure (non-GNOME desktop, no session bus, etc) so the caller can fall back to `powerMonitor`. */
  async getIdleMilliseconds(): Promise<number | null> {
    const bus = this.createSessionBus();
    try {
      const reply = await bus.call(
        new dbus.Message({
          destination: IDLE_MONITOR_NAME,
          path: IDLE_MONITOR_CORE_PATH,
          interface: IDLE_MONITOR_NAME,
          member: 'GetIdletime',
        }),
      );
      const [milliseconds] = (reply?.body ?? []) as [bigint | number | undefined];
      return milliseconds === undefined ? null : Number(milliseconds);
    } catch (error) {
      this.logger(`[gnome-idle-monitor] GetIdletime failed: ${String(error)}`);
      return null;
    } finally {
      bus.disconnect();
    }
  }
}
