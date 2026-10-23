import { systemPreferences } from 'electron';
import type { DesktopDevicePlatform } from './platform';
import type { GnomeWindowFocus } from './gnome-window-focus-tracker';
import { isWaylandSession, toDevicePlatform } from './platform';
import type { WindowSampleSink } from './window-sample';
import { classifyTitleUnavailability } from './window-sample';

export const DEFAULT_WINDOW_SAMPLE_INTERVAL_MS = 5_000;

interface ActiveWindowResult {
  title: string;
  application: string;
  path: string;
  pid: number;
  icon: string;
}

type GetActiveWindowFn = () => ActiveWindowResult;

interface ActiveWindowModule {
  initialize(): void;
  getActiveWindow(): ActiveWindowResult;
  requestPermissions(): void;
}

let activeWindowModule: ActiveWindowModule | null = null;
let attemptedLoad = false;
let initialized = false;

/**
 * Lazily `require()`s @paymoapp/active-window rather than a static `import`
 * — merely *loading* this native addon opens an X11 connection on Linux,
 * and when none is reachable (headless CI, or a Wayland session with no
 * XWayland) it aborts the whole process with an uncatchable native
 * exception (`std::terminate`), not a JS error a `try`/`catch` here can
 * stop. A static import ran this at module-load time unconditionally,
 * which is what crashed every vitest worker that so much as imported this
 * file (none of them call the real getActiveWindow — they all inject a
 * fake — but the import alone was enough). Deferring the `require()` to
 * first actual use means it only ever runs from real app code paths — on
 * Windows and macOS only, since `tick()` reads X11 itself on Linux — never
 * from a test file merely importing this module.
 *
 * (@paymoapp/active-window is a genuine dual ESM/CommonJS package — its
 * "require" export condition resolves to a real CJS build, so a plain
 * `require()` works fine here, same as the static import it replaces. See
 * docs/adr/0011-... for why get-windows needed a dynamic `import()` dance
 * that this library doesn't.)
 */
export function loadActiveWindowModule(): ActiveWindowModule | null {
  if (attemptedLoad) return activeWindowModule;
  attemptedLoad = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('@paymoapp/active-window') as { default: ActiveWindowModule };
    activeWindowModule = loaded.default;
  } catch (error) {
    console.error(
      '[window-sampler] @paymoapp/active-window unavailable, window tracking disabled:',
      error,
    );
  }
  return activeWindowModule;
}

/**
 * The library also needs a one-time `initialize()` call before any
 * `getActiveWindow()`, regardless of platform (its own docs: harmless,
 * but required, on every OS). Electron's main process already runs an
 * event loop by the time this ever gets called (a BrowserWindow is open),
 * so the default (`osxRunLoop` unset) is correct — no manual run-loop
 * pumping needed.
 */
function readActiveWindow(): ActiveWindowResult {
  const activeWindow = loadActiveWindowModule();
  if (!activeWindow) throw new Error('@paymoapp/active-window unavailable');

  if (!initialized) {
    activeWindow.initialize();
    initialized = true;
  }
  // Synchronous, and throws (rather than resolving undefined, like
  // get-windows did) when there's no focused window to report — e.g.
  // everything minimized, or the desktop itself is focused. Left to
  // propagate here; `tick()` below is what normalizes any throw to
  // `undefined` so callers only have one "nothing to report" shape.
  return activeWindow.getActiveWindow();
}

export interface WindowSamplerDeps {
  intervalMs?: number;
  sink?: WindowSampleSink;
  getPlatform?: () => DesktopDevicePlatform;
  isWayland?: () => boolean;
  /**
   * The focused X11 window — on Wayland, an XWayland one. Null when nothing
   * has focus on Xorg, or a Wayland-native window has it on Wayland.
   */
  getX11Focus?: () => GnomeWindowFocus | null;
  isMacScreenRecordingGranted?: () => boolean;
  /** Windows and macOS only — Linux reads X11 and AT-SPI instead. */
  getActiveWindow?: GetActiveWindowFn;
  /**
   * The last window AT-SPI2 saw activated on a GNOME session (see
   * docs/adr/0016-..., `gnome-window-focus-tracker.ts`) — `null` when
   * nothing has been seen yet, or the tracker isn't running at all
   * (non-GNOME/non-Linux). Consulted only on Linux+Wayland, when X11
   * reports nothing.
   */
  getGnomeFocus?: () => { appName: string; title: string } | null;
}

/**
 * Runs entirely in the main process, gated on/off by CaptureSettingsGate.
 * Every tick emits exactly one sample — a permission failure or a thrown
 * @paymoapp/active-window call still produces a sample via
 * classifyTitleUnavailability, it never silently skips a tick.
 *
 * All OS-touching calls are injectable so this is unit-testable with zero
 * Electron mocking: tests always pass explicit fakes, so the real
 * Electron-backed defaults are never invoked under vitest. `readActiveWindow`
 * itself lazily requires @paymoapp/active-window (see `loadActiveWindowModule`
 * above) so merely importing this file — as every test here does — never
 * touches the native module either.
 */
export class WindowSampler {
  private readonly intervalMs: number;
  private readonly sink: WindowSampleSink;
  private readonly getPlatform: () => DesktopDevicePlatform;
  private readonly isWayland: () => boolean;
  private readonly getX11Focus: () => GnomeWindowFocus | null;
  private readonly isMacScreenRecordingGranted: () => boolean;
  private readonly getActiveWindow: GetActiveWindowFn;
  private readonly getGnomeFocus: () => { appName: string; title: string } | null;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(deps: WindowSamplerDeps = {}) {
    this.intervalMs = deps.intervalMs ?? DEFAULT_WINDOW_SAMPLE_INTERVAL_MS;
    this.sink = deps.sink ?? (() => {});
    this.getPlatform =
      deps.getPlatform ?? (() => toDevicePlatform(process.platform));
    this.isWayland = deps.isWayland ?? isWaylandSession;
    this.getX11Focus = deps.getX11Focus ?? ((): null => null);
    // Non-prompting status check — deliberately Electron's own API, not
    // @paymoapp/active-window's `requestPermissions()`, which triggers
    // macOS's native Screen Recording prompt the first time it's called.
    // That prompt must only ever fire from an explicit "Grant Access"
    // click (see main.ts), never from a background sampling tick.
    this.isMacScreenRecordingGranted =
      deps.isMacScreenRecordingGranted ??
      (() => systemPreferences.getMediaAccessStatus('screen') === 'granted');
    this.getActiveWindow = deps.getActiveWindow ?? readActiveWindow;
    this.getGnomeFocus = deps.getGnomeFocus ?? ((): null => null);
  }

  /** Normalises the addon's throw-on-no-focused-window into one "nothing to report" shape. */
  private readActiveWindowOrUndefined(): ActiveWindowResult | undefined {
    try {
      return this.getActiveWindow();
    } catch {
      return undefined;
    }
  }

  /** A focus read from X11 or AT-SPI — neither is subject to the gap `isWayland` models. */
  private emitFocus(
    platform: DesktopDevicePlatform,
    focus: GnomeWindowFocus,
    sampledAt: string,
  ): void {
    const reason = classifyTitleUnavailability({
      platform,
      macScreenRecordingGranted: true, // meaningless off macOS
      isWayland: false,
      rawTitle: focus.title || undefined,
      rawOwnerName: focus.appName || undefined,
    });
    this.sink({
      appName: focus.appName || null,
      title: reason === null ? focus.title || null : null,
      titleUnavailableReason: reason,
      sampledAt,
    });
  }

  start(): void {
    if (this.handle) return;
    this.tick();
    this.handle = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  get isRunning(): boolean {
    return this.handle !== null;
  }

  /**
   * Exposed directly so tests can trigger one sampling cycle without
   * touching timers. Synchronous end-to-end (@paymoapp/active-window's
   * getActiveWindow() is sync, unlike get-windows' async activeWindow()) —
   * kept `void`-returning rather than `Promise<void>` now that there's no
   * actual async work left to await.
   */
  tick(): void {
    const platform = this.getPlatform();
    const sampledAt = new Date().toISOString();

    // X11 is read on every Linux session. On Xorg it sees every window; on
    // Wayland it still sees every XWayland client — most applications,
    // including PyCharm, VLC and Teams, which publish no accessibility tree.
    // The native addon is never used on Linux: its prebuilt binary needs
    // glibc 2.38, so on Ubuntu 22.04 it failed to load and an Xorg session
    // recorded no apps at all, silently.
    if (platform === 'linux') {
      const fromX11 = this.getX11Focus();
      if (fromX11) {
        this.emitFocus(platform, fromX11, sampledAt);
        return;
      }

      // On Xorg a null from X11 means nothing has focus — the desktop itself.
      if (!this.isWayland()) {
        this.sink({ appName: null, title: null, titleUnavailableReason: null, sampledAt });
        return;
      }

      // On Wayland it means a Wayland-native window has focus, which is
      // AT-SPI's half. 'not-exposed' only when AT-SPI has seen nothing yet
      // this session, or isn't running at all.
      const gnomeFocus = this.getGnomeFocus();
      if (!gnomeFocus) {
        this.sink({
          appName: null,
          title: null,
          titleUnavailableReason: 'not-exposed',
          sampledAt,
        });
        return;
      }

      this.emitFocus(platform, gnomeFocus, sampledAt);
      return;
    }

    const macScreenRecordingGranted =
      platform === 'macos' ? this.isMacScreenRecordingGranted() : true;

    const result = this.readActiveWindowOrUndefined();

    const reason = classifyTitleUnavailability({
      platform,
      macScreenRecordingGranted,
      isWayland: false,
      rawTitle: result?.title,
      rawOwnerName: result?.application,
    });

    this.sink({
      appName: result?.application ?? null,
      title: reason === null ? (result?.title ?? null) : null,
      titleUnavailableReason: reason,
      sampledAt,
    });
  }
}
