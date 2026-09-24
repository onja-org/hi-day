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
 * first actual use means it only ever runs from real app code paths that
 * are already gated to platforms with a display (see `tick()`'s Wayland
 * guard below), never from a test file merely importing this module.
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
  /** The focused XWayland window, or null when a Wayland-native one has focus. */
  getX11Focus?: () => GnomeWindowFocus | null;
  isMacScreenRecordingGranted?: () => boolean;
  getActiveWindow?: GetActiveWindowFn;
  /**
   * The last window AT-SPI2 saw activated on a GNOME session (see
   * docs/adr/0016-..., `gnome-window-focus-tracker.ts`) — `null` when
   * nothing has been seen yet, or the tracker isn't running at all
   * (non-GNOME/non-Linux). Consulted only on Linux+Wayland, where
   * `getActiveWindow` above is never even reachable.
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

    // Two complementary sources on Linux: X11 sees every XWayland client —
    // on a Wayland session, still most applications — while AT-SPI sees only
    // what publishes an accessibility tree. PyCharm, VLC and Teams appear in
    // the first and not the second, so X11 is read first. A null from X11
    // means a Wayland-native window has focus, which is AT-SPI's half.
    if (platform === 'linux' && this.isWayland()) {
      const fromX11 = this.getX11Focus();
      if (fromX11) {
        const reason = classifyTitleUnavailability({
          platform,
          macScreenRecordingGranted: true, // meaningless off macOS
          isWayland: false, // an XWayland client is an X11 client
          rawTitle: fromX11.title || undefined,
          rawOwnerName: fromX11.appName || undefined,
        });
        this.sink({
          appName: fromX11.appName || null,
          title: reason === null ? fromX11.title || null : null,
          titleUnavailableReason: reason,
          sampledAt,
        });
        return;
      }
    }

    if (platform === 'linux' && this.isWayland()) {
      // Falls back to the original 'not-exposed' only when nothing has been
      // seen yet (nothing to report before the very first window activation
      // this session, or a non-GNOME/non-Linux caller that never wires
      // getGnomeFocus at all).
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

      const reason = classifyTitleUnavailability({
        platform,
        macScreenRecordingGranted: true, // meaningless off macOS
        isWayland: false, // AT-SPI is unaffected by the gap this flag models
        rawTitle: gnomeFocus.title || undefined,
        rawOwnerName: gnomeFocus.appName || undefined,
      });

      this.sink({
        appName: gnomeFocus.appName || null,
        title: reason === null ? gnomeFocus.title || null : null,
        titleUnavailableReason: reason,
        sampledAt,
      });
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
