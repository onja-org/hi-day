import { desktopCapturer, screen } from 'electron';
import type { DesktopDevicePlatform } from './platform';
import { isWaylandSession, toDevicePlatform } from './platform';

export const DEFAULT_SCREENSHOT_INTERVAL_MS = 600_000; // 10 minutes — matches the backend's DEFAULT_SCREENSHOT_FREQUENCY_SECONDS.

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
  sink?: ScreenshotSink;
  capture?: () => Promise<Buffer | null>;
  getPlatform?: () => DesktopDevicePlatform;
  isWayland?: () => boolean;
}

/**
 * Runs entirely in the main process, gated on/off by the combination of
 * `screenshotsEnabled` and a running timer (main.ts's `recomputeSampling`
 * combines both, same Hubstaff-style rule as WindowSampler). Unlike
 * WindowSampler, a tick that produces nothing (capture failed, the image
 * came back empty — e.g. macOS Screen Recording not yet granted — or the
 * session is Wayland, see `tick()`'s guard) simply emits no sample —
 * there's no "reason unavailable" row to write for a screenshot.
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
  private intervalMs: number;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(deps: ScreenshotSamplerDeps = {}) {
    this.intervalMs = deps.intervalMs ?? DEFAULT_SCREENSHOT_INTERVAL_MS;
    this.sink = deps.sink ?? (() => {});
    this.capture = deps.capture ?? captureScreen;
    this.getPlatform =
      deps.getPlatform ?? (() => toDevicePlatform(process.platform));
    this.isWayland = deps.isWayland ?? isWaylandSession;
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
    // Electron's desktopCapturer goes through the xdg-desktop-portal
    // ScreenCast API under Wayland (unlike X11, where it needs no such
    // round-trip) — that means every single tick would pop the OS's own
    // "share your screen" picker in front of the person, forever, and
    // canceling it has been observed to take the whole app down with it.
    // Checked up front and skipped entirely, the same way WindowSampler
    // never calls into its native module under Wayland — never even
    // reaching `this.capture()` here, so the picker never appears.
    if (this.getPlatform() === 'linux' && this.isWayland()) return;

    const capturedAt = new Date().toISOString();

    let buffer: Buffer | null;
    try {
      buffer = await this.capture();
    } catch {
      buffer = null;
    }
    if (!buffer) return;

    await this.sink({ buffer, capturedAt });
  }
}
