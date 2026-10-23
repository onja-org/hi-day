import type { CaptureSourceState } from './app-capture-health';
import type { GnomeWindowFocus } from './gnome-window-focus-tracker';

/** Predefined X11 atoms. */
const ANY_PROPERTY_TYPE = 0;
const WM_NAME = 39;
const WM_CLASS = 67;

const DEFAULT_POLL_INTERVAL_MS = 1_000;
/** A property read that never returns must not wedge the poll. */
const REQUEST_TIMEOUT_MS = 2_000;

/**
 * The focused window as X11 sees it — on a Wayland session, every XWayland
 * client. That includes applications with no accessibility tree at all, such
 * as PyCharm and other JetBrains IDEs, which AT-SPI can never see.
 *
 * Reads the X protocol directly rather than through @paymoapp/active-window:
 * loading that addon inside Electron on Wayland segfaults the process, and
 * its prebuilt binary needs glibc 2.38, ruling out Ubuntu 22.04 and earlier.
 *
 * Polls and caches because WindowSampler.tick() is synchronous — the same
 * shape as GnomeWindowFocusTracker, which it sits in front of.
 */
export class X11WindowTracker {
  private lastFocus: GnomeWindowFocus | null = null;
  private sourceState: CaptureSourceState = 'starting';
  private timer: ReturnType<typeof setInterval> | null = null;
  private display: unknown = null;
  private client: import('x11').X11Client | null = null;
  private activeWindowAtom = 0;
  private nameAtom = 0;
  private root = 0;
  private reading = false;

  constructor(
    private readonly options: {
      pollIntervalMs?: number;
      logger?: (line: string) => void;
    } = {},
  ) {}

  /** Resolves either way: no X display is ordinary, not an error — getLastFocus() just stays null. */
  async start(): Promise<void> {
    try {
      const x11 = (await import('x11')).default;
      await new Promise<void>((resolve) => {
        x11.createClient((err, display) => {
          if (err || !display) {
            this.log(`x11 unavailable: ${err?.message ?? 'no display'}`);
            this.sourceState = 'down';
            resolve();
            return;
          }
          this.display = display;
          this.client = display.client;
          this.root = display.screen[0].root;
          resolve();
        });
      });

      if (!this.client) return;
      this.activeWindowAtom = await this.internAtom('_NET_ACTIVE_WINDOW');
      this.nameAtom = await this.internAtom('_NET_WM_NAME');

      this.timer = setInterval(
        () => void this.refresh(),
        this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      );
      this.timer.unref?.();
      this.sourceState = 'up';
      await this.refresh();
    } catch (error) {
      this.log(`x11 tracker failed to start: ${String(error)}`);
      this.sourceState = 'down';
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lastFocus = null;
    try {
      (this.display as { terminate?: () => void } | null)?.terminate?.();
    } catch {
      // Already gone.
    }
    this.display = null;
    this.client = null;
  }

  /** Whether an X display answered — what app-capture health is judged on. */
  get state(): CaptureSourceState {
    return this.sourceState;
  }

  /** Null when no X11 window has focus — ie. a Wayland-native one does. */
  getLastFocus(): GnomeWindowFocus | null {
    return this.lastFocus;
  }

  private async refresh(): Promise<void> {
    if (!this.client || this.reading) return;
    this.reading = true;
    try {
      const windowId = await this.readActiveWindowId();
      if (!windowId) {
        this.lastFocus = null;
        return;
      }
      const [title, appName] = await Promise.all([
        this.readTitle(windowId),
        this.readWmClass(windowId),
      ]);
      this.lastFocus = appName || title ? { appName, title } : null;
    } catch {
      // A window can vanish mid-read; an ordinary race, not worth logging.
    } finally {
      this.reading = false;
    }
  }

  private async readActiveWindowId(): Promise<number> {
    const data = await this.getProperty(this.root, this.activeWindowAtom, 4);
    return data && data.length >= 4 ? data.readUInt32LE(0) : 0;
  }

  /**
   * `_NET_WM_NAME`, else the legacy `WM_NAME` — older toolkits set only the
   * latter, and the addon this replaced on Xorg read it.
   */
  private async readTitle(windowId: number): Promise<string> {
    return (
      (await this.readString(windowId, this.nameAtom)) ||
      (await this.readString(windowId, WM_NAME))
    );
  }

  private async readString(windowId: number, atom: number): Promise<string> {
    const data = await this.getProperty(windowId, atom, 1000);
    return data ? data.toString('utf8').replace(/\0+$/, '') : '';
  }

  /** `WM_CLASS` is two NUL-separated strings; the second is the application class. */
  private async readWmClass(windowId: number): Promise<string> {
    const data = await this.getProperty(windowId, WM_CLASS, 1000);
    if (!data) return '';
    const parts = data.toString('utf8').split('\0').filter(Boolean);
    return parts[parts.length - 1] ?? '';
  }

  private internAtom(name: string): Promise<number> {
    return this.withTimeout(
      new Promise<number>((resolve) => {
        this.client?.InternAtom(false, name, (err, atom) =>
          resolve(err ? 0 : atom),
        );
      }),
      0,
    );
  }

  private getProperty(
    windowId: number,
    atom: number,
    length: number,
  ): Promise<Buffer | null> {
    if (!atom) return Promise.resolve(null);
    return this.withTimeout(
      new Promise<Buffer | null>((resolve) => {
        this.client?.GetProperty(
          0,
          windowId,
          atom,
          ANY_PROPERTY_TYPE,
          0,
          length,
          (err, prop) => resolve(err ? null : (prop?.data ?? null)),
        );
      }),
      null,
    );
  }

  private withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((resolve) =>
        setTimeout(() => resolve(fallback), REQUEST_TIMEOUT_MS).unref?.(),
      ),
    ]);
  }

  private log(line: string): void {
    this.options.logger?.(`[x11-window-tracker] ${line}`);
  }
}

