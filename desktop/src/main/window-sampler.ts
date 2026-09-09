import { systemPreferences } from 'electron';
import type { DesktopDevicePlatform } from './platform';
import { isWaylandSession, toDevicePlatform } from './platform';
import type { WindowSampleSink } from './window-sample';
import { classifyTitleUnavailability } from './window-sample';

export const DEFAULT_WINDOW_SAMPLE_INTERVAL_MS = 5_000;

interface ActiveWindowResult {
  title: string;
  owner: { name: string; processId: number; bundleId?: string; path: string };
  platform: string;
}

interface ActiveWindowOptions {
  accessibilityPermission?: boolean;
  screenRecordingPermission?: boolean;
}

type ActiveWindowFn = (
  options?: ActiveWindowOptions,
) => Promise<ActiveWindowResult | undefined>;

/**
 * get-windows is an ESM-only package, but this main process compiles to
 * CommonJS (see desktop/tsconfig.json, `module: "commonjs"`). A literal
 * `await import('get-windows')` gets downleveled by tsc into
 * `require('get-windows')`, which throws `ERR_REQUIRE_ESM` against an
 * ESM-only package. Hiding the specifier behind `new Function` keeps the
 * compiled call a genuine runtime `import()`, which Node has supported
 * from CommonJS since Node 12 — verified against this repo's exact
 * tsconfig (see docs/adr/0009-...) rather than assumed.
 */
type Importer = (specifier: string) => Promise<unknown>;
// This is the standard way to force a genuine dynamic `import()` past tsc's
// automatic downlevel-to-require() for `module: commonjs`; the specifier is
// a fixed internal string literal below, never user input.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport: Importer = new Function(
  'specifier',
  'return import(specifier)',
) as Importer;

let activeWindowPromise: Promise<ActiveWindowFn> | null = null;

function loadActiveWindow(): Promise<ActiveWindowFn> {
  activeWindowPromise ??= dynamicImport('get-windows').then(
    (mod) => (mod as { activeWindow: ActiveWindowFn }).activeWindow,
  );
  return activeWindowPromise;
}

export interface WindowSamplerDeps {
  intervalMs?: number;
  sink?: WindowSampleSink;
  getPlatform?: () => DesktopDevicePlatform;
  isWayland?: () => boolean;
  isMacAccessibilityGranted?: () => boolean;
  loadActiveWindow?: () => Promise<ActiveWindowFn>;
}

/**
 * Runs entirely in the main process, gated on/off by CaptureSettingsGate.
 * Every tick emits exactly one sample — a permission failure or a thrown
 * get-windows call still produces a sample via classifyTitleUnavailability,
 * it never silently skips a tick.
 *
 * All OS-touching calls are injectable so this is unit-testable with zero
 * Electron mocking: tests always pass explicit fakes, so the real
 * Electron-backed defaults are never invoked under vitest.
 */
export class WindowSampler {
  private readonly intervalMs: number;
  private readonly sink: WindowSampleSink;
  private readonly getPlatform: () => DesktopDevicePlatform;
  private readonly isWayland: () => boolean;
  private readonly isMacAccessibilityGranted: () => boolean;
  private readonly loadActiveWindow: () => Promise<ActiveWindowFn>;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(deps: WindowSamplerDeps = {}) {
    this.intervalMs = deps.intervalMs ?? DEFAULT_WINDOW_SAMPLE_INTERVAL_MS;
    this.sink = deps.sink ?? (() => {});
    this.getPlatform =
      deps.getPlatform ?? (() => toDevicePlatform(process.platform));
    this.isWayland = deps.isWayland ?? isWaylandSession;
    this.isMacAccessibilityGranted =
      deps.isMacAccessibilityGranted ??
      (() => systemPreferences.isTrustedAccessibilityClient(false));
    this.loadActiveWindow = deps.loadActiveWindow ?? loadActiveWindow;
  }

  start(): void {
    if (this.handle) return;
    void this.tick();
    this.handle = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  get isRunning(): boolean {
    return this.handle !== null;
  }

  /** Exposed directly so tests can await one sampling cycle without touching timers. */
  async tick(): Promise<void> {
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

    const macAccessibilityGranted =
      platform === 'macos' ? this.isMacAccessibilityGranted() : true;

    let result: ActiveWindowResult | undefined;
    try {
      const activeWindow = await this.loadActiveWindow();
      result = await activeWindow({
        accessibilityPermission: true,
        // Per get-windows' own docs this actually forces `title` to always
        // be an empty string on macOS — kept `false` here to match the
        // ticket's explicit scope decision (avoid the Screen Recording
        // prompt ahead of a future screenshot feature). Known, flagged gap
        // — see docs/adr/0009-...
        screenRecordingPermission: false,
      });
    } catch {
      result = undefined;
    }

    const reason = classifyTitleUnavailability({
      platform,
      macAccessibilityGranted,
      isWayland: false,
      rawTitle: result?.title,
      rawOwnerName: result?.owner?.name,
    });

    this.sink({
      appName: result?.owner?.name ?? null,
      title: reason === null ? (result?.title ?? null) : null,
      titleUnavailableReason: reason,
      sampledAt,
    });
  }
}
