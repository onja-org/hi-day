import { desktopCapturer, screen } from 'electron';
import type { DesktopDevicePlatform } from './platform';
import { isWaylandSession, toDevicePlatform } from './platform';
import { captureScreenViaPortal } from './screenshot-portal';

export const DEFAULT_SCREENSHOT_INTERVAL_MS = 600_000; // 10 minutes — matches the backend's DEFAULT_SCREENSHOT_FREQUENCY_SECONDS.

/** Admins pick "N per 10 minutes", so this is the window that promise is
 * kept over — the same ten minutes an ActivitySample covers and the
 * Screenshots page slices its day into. */
export const SCREENSHOT_PERIOD_MS = 600_000;

/**
 * JPEG, not PNG — a full-resolution screen capture as PNG is several times
 * larger for no real benefit here (this isn't pixel-perfect archival, it's
 * a periodic activity snapshot). Quality 70 keeps individual uploads small
 * without visibly degrading legibility of on-screen text.
 */
const SCREENSHOT_JPEG_QUALITY = 70;

export interface ScreenshotCapture {
  buffer: Buffer;
  capturedAt: string;
}

export type ScreenshotSink = (
  capture: ScreenshotCapture,
) => void | Promise<void>;

/**
 * Captures the primary display via Electron's own `desktopCapturer` — no
 * third-party/native package needed (see docs/adr/0012-...), unlike window
 * tracking's @paymoapp/active-window. `desktopCapturer` returns a
 * `NativeImage` thumbnail whose size is capped to whatever `thumbnailSize`
 * is requested, so the primary display's real pixel size (accounting for
 * `scaleFactor` on HiDPI displays) is requested explicitly rather than
 * accepting Electron's small default thumbnail.
 *
 * On macOS, this returns an empty/black image when Screen Recording isn't
 * granted (rather than throwing) — `tick()` below treats an empty image
 * the same as any other "nothing to report" case: skip silently, no
 * partial/placeholder row (there's no `titleUnavailableReason`-style
 * concept for screenshots, unlike AppEvent).
 */
async function captureScreen(): Promise<Buffer | null> {
  const display = screen.getPrimaryDisplay();
  const width = Math.round(display.size.width * display.scaleFactor);
  const height = Math.round(display.size.height * display.scaleFactor);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
  });
  const source = sources[0];
  if (!source || source.thumbnail.isEmpty()) return null;

  return source.thumbnail.toJPEG(SCREENSHOT_JPEG_QUALITY);
}

export interface ScreenshotSamplerDeps {
  intervalMs?: number;
  /** Injectable so the quota can be tested without real clocks. */
  now?: () => number;
  sink?: ScreenshotSink;
  capture?: () => Promise<Buffer | null>;
  getPlatform?: () => DesktopDevicePlatform;
  isWayland?: () => boolean;
  /** The Wayland-only portal capture path — see screenshot-portal.ts. */
  capturePortal?: (interactive: boolean) => Promise<Buffer | null>;
  /**
   * Whether the one-time "Grant Access" portal call has already been
   * approved (persisted in AuthStore, see main.ts's wiring) — periodic
   * ticks only ever call `capturePortal(false)`, so until this is true
   * there's nothing for a silent call to reuse and a tick emits nothing,
   * same as macOS before Screen Recording is granted.
   */
  isWaylandScreenshotGranted?: () => boolean;
  /**
   * The silent Wayland path (ScreenCast portal with a remembered grant — see
   * wayland-silent-capture.ts), tried before the Screenshot portal, which
   * on GNOME plays the shutter sound and flashes the screen every time.
   * Resolves null when it has no grant or fails; never shows UI.
   */
  captureWaylandSilently?: () => Promise<Buffer | null>;
}

/**
 * Runs entirely in the main process, gated on/off by the combination of
 * `screenshotsEnabled` and a running timer (main.ts's `recomputeSampling`
 * combines both, same Hubstaff-style rule as WindowSampler). Unlike
 * WindowSampler, a tick that produces nothing (capture failed, the image
 * came back empty — e.g. macOS Screen Recording or the Wayland portal grant
 * not yet given, see `captureBuffer()`) simply emits no sample — there's no
 * "reason unavailable" row to write for a screenshot.
 *
 * `setIntervalMs` lets main.ts apply an org's `screenshotFrequencySeconds`
 * without tearing down and recreating the sampler every time
 * CaptureSettingsGate reports a change — it takes effect immediately if
 * currently running, restarting the interval (not just applied on the next
 * `start()`), but never fires an extra out-of-cadence capture by itself.
 */
export class ScreenshotSampler {
  private readonly sink: ScreenshotSink;
  private readonly capture: () => Promise<Buffer | null>;
  private readonly getPlatform: () => DesktopDevicePlatform;
  private readonly isWayland: () => boolean;
  private readonly capturePortal: (interactive: boolean) => Promise<Buffer | null>;
  private readonly isWaylandScreenshotGranted: () => boolean;
  private readonly captureWaylandSilently: () => Promise<Buffer | null>;
  private intervalMs: number;
  private handle: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => number;
  /** Which clock period `takenInPeriod` counts for. */
  private periodKey: number | null = null;
  private takenInPeriod = 0;

  constructor(deps: ScreenshotSamplerDeps = {}) {
    this.intervalMs = deps.intervalMs ?? DEFAULT_SCREENSHOT_INTERVAL_MS;
    this.now = deps.now ?? Date.now;
    this.sink = deps.sink ?? (() => {});
    this.capture = deps.capture ?? captureScreen;
    this.getPlatform =
      deps.getPlatform ?? (() => toDevicePlatform(process.platform));
    this.isWayland = deps.isWayland ?? isWaylandSession;
    this.capturePortal = deps.capturePortal ?? captureScreenViaPortal;
    this.isWaylandScreenshotGranted = deps.isWaylandScreenshotGranted ?? (() => false);
    this.captureWaylandSilently =
      deps.captureWaylandSilently ?? (() => Promise.resolve(null));
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

  get currentIntervalMs(): number {
    return this.intervalMs;
  }

  setIntervalMs(intervalMs: number): void {
    if (intervalMs === this.intervalMs) return;
    this.intervalMs = intervalMs;
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = setInterval(() => void this.tick(), this.intervalMs);
    }
  }

  async tick(): Promise<void> {
    // "3 per 10 minutes" has to mean three.
    if (!this.periodHasRoom()) return;

    const capturedAt = new Date().toISOString();

    let buffer: Buffer | null;
    try {
      buffer = await this.captureBuffer();
    } catch {
      buffer = null;
    }
    // Counted on the way out: a tick that captured nothing must not spend
    // an allowance nobody got an image for.
    if (!buffer) return;
    this.recordCapture();

    await this.sink({ buffer, capturedAt });
  }

  /**
   * The cadence alone does not keep the setting's promise: `start()`
   * captures immediately, so every stop and start adds one out of turn and
   * somebody pausing a few times inside a period collected several extra.
   * Measured against the clock's periods, not the interval's phase, so it
   * lines up with the slots the Screenshots page shows. Per Device — each
   * agent counts only its own.
   */
  private periodHasRoom(): boolean {
    if (this.periodKey !== this.currentPeriodKey()) return true;
    return this.takenInPeriod < this.maxPerPeriod();
  }

  private recordCapture(): void {
    const key = this.currentPeriodKey();
    if (key !== this.periodKey) {
      this.periodKey = key;
      this.takenInPeriod = 0;
    }
    this.takenInPeriod += 1;
  }

  private currentPeriodKey(): number {
    return Math.floor(this.now() / SCREENSHOT_PERIOD_MS);
  }

  /** What the organisation asked for, read off the interval it set. */
  private maxPerPeriod(): number {
    if (this.intervalMs <= 0) return 1;
    return Math.max(1, Math.round(SCREENSHOT_PERIOD_MS / this.intervalMs));
  }

  /**
   * Electron's `desktopCapturer` (`this.capture`) goes through the
   * xdg-desktop-portal ScreenCast API under Wayland (unlike X11, where it
   * needs no such round-trip) — that means every single tick would pop the
   * OS's own "share your screen" picker in front of the person, forever,
   * and canceling it has been observed to take the whole app down with it.
   * `desktopCapturer` is never even called here on Wayland; the separate
   * portal `Screenshot` interface (see screenshot-portal.ts) is used
   * instead, which has no live stream to cancel out from under and so
   * doesn't share that crash. It still only ever captures silently
   * (`interactive: false`) once the one-time "Grant Access" flow has run —
   * see `isWaylandScreenshotGranted`'s doc comment.
   *
   * The silent ScreenCast path goes first; the Screenshot portal is only
   * the fallback (no remembered ScreenCast grant, GStreamer missing, a
   * portal too old), and only once its own grant exists — calling it
   * without one could put a permission dialog in front of the person on a
   * tick.
   */
  private async captureBuffer(): Promise<Buffer | null> {
    if (this.getPlatform() === 'linux' && this.isWayland()) {
      const silent = await this.captureWaylandSilently().catch(() => null);
      if (silent) return silent;
      if (!this.isWaylandScreenshotGranted()) return null;
      return this.capturePortal(false);
    }
    return this.capture();
  }
}
