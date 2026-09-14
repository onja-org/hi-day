import { systemPreferences } from 'electron';
import type { DesktopDevicePlatform } from './platform';
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
  isMacScreenRecordingGranted?: () => boolean;
  getActiveWindow?: GetActiveWindowFn;
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
  private readonly isMacScreenRecordingGranted: () => boolean;
  private readonly getActiveWindow: GetActiveWindowFn;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(deps: WindowSamplerDeps = {}) {
    this.intervalMs = deps.intervalMs ?? DEFAULT_WINDOW_SAMPLE_INTERVAL_MS;
    this.sink = deps.sink ?? (() => {});
    this.getPlatform =
      deps.getPlatform ?? (() => toDevicePlatform(process.platform));
    this.isWayland = deps.isWayland ?? isWaylandSession;
    // Non-prompting status check — deliberately Electron's own API, not
    // @paymoapp/active-window's `requestPermissions()`, which triggers
    // macOS's native Screen Recording prompt the first time it's called.
    // That prompt must only ever fire from an explicit "Grant Access"
    // click (see main.ts), never from a background sampling tick.
    this.isMacScreenRecordingGranted =
      deps.isMacScreenRecordingGranted ??
      (() => systemPreferences.getMediaAccessStatus('screen') === 'granted');
    this.getActiveWindow = deps.getActiveWindow ?? readActiveWindow;
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

    if (platform === 'linux' && this.isWayland()) {
      this.sink({
        appName: null,
        title: null,
        titleUnavailableReason: 'not-exposed',
        sampledAt,
      });
      return;
    }

    const macScreenRecordingGranted =
      platform === 'macos' ? this.isMacScreenRecordingGranted() : true;

    let result: ActiveWindowResult | undefined;
    try {
      // Throws (rather than resolving undefined) when there's no focused
      // window to report — e.g. everything minimized, or the desktop
      // itself is focused. Caught here so a tick is still always emitted.
      result = this.getActiveWindow();
    } catch {
      result = undefined;
    }

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
