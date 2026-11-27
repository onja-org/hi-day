import dbus from 'dbus-next';
import { screen } from 'electron';

export interface ScreenDescription {
  internal: boolean;
  label: string;
  size: { width: number; height: number };
}

/**
 * Names the set of screens connected right now — "the laptop alone",
 * "the laptop and a monitor", "a monitor with the lid closed" — so a
 * remembered ScreenCast choice is only ever tried in the setup it was made
 * in (wayland-silent-capture.ts).
 *
 * GNOME remembers a choice as one particular screen. Tried while that
 * screen is gone, it shows the picker and then forgets the choice for good,
 * even once the screen is back. So the key has to tell apart setups that
 * look alike by size: closing the lid on a 1920×1080 monitor leaves one
 * 1920×1080 screen, just as the laptop alone does.
 *
 * Names do that: the laptop's screen is reported as "Built-in display", and
 * under XWayland an external monitor has no name at all. `internal` is not
 * used — under XWayland it is not reliable: with the lid closed on a
 * monitor, the same monitor came back flagged internal one time and
 * external the next, which named one setup two ways and lost its choice.
 * Two unnamed monitors of the same size share a key, so the second one is
 * granted after the first one's choice is rejected.
 */
export function screenSetupKey(displays: ScreenDescription[]): string {
  if (displays.length === 0) return 'no-screens';
  return displays
    .map(
      (display) =>
        `${display.label || 'unnamed'}:${display.size.width}x${display.size.height}`,
    )
    .sort()
    .join('+');
}

/** A monitor as GNOME describes it: the port, and the identity its EDID gives. */
export interface PhysicalMonitor {
  connector: string;
  vendor: string;
  product: string;
  serial: string;
}

/** Laptop panels and cheap monitors report no serial, or zeros. */
function hasSerial(serial: string): boolean {
  return !/^(0x)?0*$/i.test(serial.trim());
}

/**
 * The setup as the physical monitors in it, from GNOME — which, unlike
 * Electron under XWayland, can tell two monitors of the same size apart.
 * Without that, hot-desking from one 1920×1080 monitor to another read as
 * the same setup: the choice made for the first was tried on the second,
 * GNOME showed the picker and forgot it, and every desk change cost a grant.
 *
 * By maker, model and serial, so a monitor is the same one whichever port
 * it is plugged into. Where there is no serial (a laptop's own panel, twin
 * monitors that report none) the port stands in for it.
 */
export function monitorSetupKey(monitors: PhysicalMonitor[]): string {
  return `monitors:${monitors
    .map(
      (monitor) =>
        `${monitor.vendor} ${monitor.product} ${
          hasSerial(monitor.serial) ? monitor.serial : `port ${monitor.connector}`
        }`,
    )
    .sort()
    .join('+')}`;
}

/** A desktop that answers at all answers in a few milliseconds. */
const LIST_TIMEOUT_MS = 1_000;

/**
 * The monitors GNOME is showing now — its logical monitors, not every one
 * connected: a closed lid leaves the laptop's panel connected but off.
 * Rejects off GNOME (no `org.gnome.Mutter.DisplayConfig`).
 */
export async function listGnomeMonitors(): Promise<PhysicalMonitor[]> {
  const bus = dbus.sessionBus();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const reply = await Promise.race([
      bus.call(
        new dbus.Message({
          destination: 'org.gnome.Mutter.DisplayConfig',
          path: '/org/gnome/Mutter/DisplayConfig',
          interface: 'org.gnome.Mutter.DisplayConfig',
          member: 'GetCurrentState',
        }),
      ),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('DisplayConfig did not answer')), LIST_TIMEOUT_MS);
      }),
    ]);
    const logical = ((reply?.body ?? [])[2] ?? []) as unknown[][];
    return logical.flatMap((entry) =>
      ((entry[5] ?? []) as string[][]).map(([connector, vendor, product, serial]) => ({
        connector,
        vendor,
        product,
        serial,
      })),
    );
  } finally {
    clearTimeout(timer);
    bus.disconnect();
  }
}

export interface ScreenSetupSources {
  listMonitors: () => Promise<PhysicalMonitor[]>;
  listDisplays: () => ScreenDescription[];
}

/**
 * The key for the screens connected now: GNOME's physical monitors where it
 * can list them, Electron's screens elsewhere (KDE, other desktops). The two
 * never share a key, so a setup granted under one is simply asked for again
 * under the other — the banner, never a picker.
 */
export async function currentScreenSetupKey(
  sources: ScreenSetupSources = {
    listMonitors: listGnomeMonitors,
    listDisplays: () => screen.getAllDisplays(),
  },
): Promise<string> {
  const monitors = await sources.listMonitors().catch(() => []);
  if (monitors.length > 0) return monitorSetupKey(monitors);
  return screenSetupKey(sources.listDisplays());
}
