import dbus from 'dbus-next';
import { AtspiClient, type AtspiWindow } from './resolvers/linux/atspi';

export interface GnomeWindowFocus {
  appName: string;
  title: string;
}

/** The subset of AtspiClient this tracker actually needs — lets tests inject a fake with no real D-Bus involved. */
export interface AtspiClientLike {
  start(): Promise<void>;
  stop(): void;
}

export interface GnomeWindowFocusTrackerDeps {
  logger?: (line: string) => void;
  createAtspiClient?: (options: {
    onWindowActivated: (window: AtspiWindow) => void;
    logger?: (line: string) => void;
  }) => AtspiClientLike;
  /**
   * Sets org.a11y.Status.IsEnabled = true — see this file's own doc comment
   * for why. Injectable so tests never open a real D-Bus connection.
   */
  enableAccessibilityBridge?: () => Promise<void>;
}

async function enableAccessibilityBridge(): Promise<void> {
  // org.a11y.Status lives on the regular SESSION bus's org.a11y.Bus
  // bootstrap object — a distinct connection from the actual accessibility
  // bus AtspiClient talks to (resolved via that same object's GetAddress
  // method). Conflating the two is a real, easy-to-hit mistake: calling
  // Properties.Set here against the accessibility bus itself fails with
  // "not provided by any .service files", since that name simply isn't
  // present there.
  const sessionBus = dbus.sessionBus();
  try {
    await sessionBus.call(
      new dbus.Message({
        destination: 'org.a11y.Bus',
        path: '/org/a11y/bus',
        interface: 'org.freedesktop.DBus.Properties',
        member: 'Set',
        signature: 'ssv',
        body: ['org.a11y.Status', 'IsEnabled', new dbus.Variant('b', true)],
      }),
    );
  } finally {
    sessionBus.disconnect();
  }
}

/**
 * Fills the Wayland gap `WindowSampler` has always had (see
 * docs/adr/0009-.../0011-...: `get-windows`/`@paymoapp/active-window` are
 * X11-only) by reusing the exact AT-SPI2 mechanism the Linux URL-tracking
 * resolver already relies on (`resolvers/linux/atspi.ts`'s `AtspiClient`,
 * subscribed to the accessibility bus's `window:activate` signal) — not a
 * new GNOME Shell extension. See docs/adr/0016-... for the full story and
 * the live verification behind this.
 *
 * The one thing `AtspiClient` alone doesn't do is what actually makes
 * *ordinary, already-running* applications start emitting `window:activate`
 * in the first place: `org.a11y.Status.IsEnabled` must be `true` first
 * (verified live — with it `false`, zero events; with it `true`, an
 * unmodified terminal/Chrome/Slack/VS Code all fired immediately on focus
 * change, no relaunch needed). This is a distinct, session-wide toggle from
 * the browser-specific `.desktop`-launcher rewrite
 * `resolvers/linux/browser-activation.ts` already does — that trick forces
 * one specific process's *own* accessibility tree depth (needed for reading
 * a browser's address bar), independent of this global flag; this tracker
 * needs the global flag instead, since it must work for arbitrary
 * applications it has no launch-time control over.
 *
 * Deliberately never set back to `false` on `stop()`: another AT-SPI
 * consumer on the same session (a real screen reader, or this app's own
 * URL-tracking resolver) may depend on it staying on, and there is no way
 * to tell whether this tracker was the one that turned it on.
 */
export class GnomeWindowFocusTracker {
  private readonly logger: (line: string) => void;
  private readonly createAtspiClient: NonNullable<
    GnomeWindowFocusTrackerDeps['createAtspiClient']
  >;
  private readonly enableAccessibilityBridge: () => Promise<void>;
  private client: AtspiClientLike | null = null;
  private lastFocus: GnomeWindowFocus | null = null;

  constructor(deps: GnomeWindowFocusTrackerDeps = {}) {
    this.logger = deps.logger ?? ((): void => undefined);
    this.createAtspiClient =
      deps.createAtspiClient ?? ((options) => new AtspiClient(options));
    this.enableAccessibilityBridge =
      deps.enableAccessibilityBridge ?? enableAccessibilityBridge;
  }

  /**
   * Best-effort end to end: a failure at either step (no at-spi2-core
   * installed, the accessibility bus unreachable, whatever) is logged and
   * left at "no focus known yet" rather than thrown — this must never be
   * the reason the desktop agent fails to start.
   */
  async start(): Promise<void> {
    try {
      await this.enableAccessibilityBridge();
    } catch (error) {
      this.logger(
        `[gnome-window-focus] could not enable the accessibility bridge: ${String(error)}`,
      );
    }

    try {
      this.client = this.createAtspiClient({
        onWindowActivated: (window) => {
          this.lastFocus = { appName: window.appName, title: window.title };
        },
        logger: this.logger,
      });
      await this.client.start();
    } catch (error) {
      this.logger(
        `[gnome-window-focus] accessibility bus unavailable: ${String(error)}`,
      );
      this.client = null;
    }
  }

  stop(): void {
    this.client?.stop();
    this.client = null;
    this.lastFocus = null;
  }

  /** `null` until the first window:activate this session ever sees — see WindowSampler.tick()'s fallback for that case. */
  getLastFocus(): GnomeWindowFocus | null {
    return this.lastFocus;
  }
}
