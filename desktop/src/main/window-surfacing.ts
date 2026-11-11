/**
 * Getting someone's attention when the window is in the tray. Call sites
 * say what happened; main.ts installs the one handler that knows how to
 * show a window. A handler that throws is swallowed — surfacing never
 * takes down the update flow or settings poll it was called from.
 */

export type SurfaceReason =
  | 'update-available'
  | 'update-downloaded'
  | 'screenshots-enabled';

export interface SurfaceRequest {
  reason: SurfaceReason;
  /** What separates this occurrence from the next — the version for an
   * update. Same key means same event, so a repeat poll stays quiet. */
  occurrence?: string;
}

export interface SurfaceCopy {
  title: string;
  body: string;
}

/** Both update phases share one key, so a version announces itself once:
 * the renderer's banner becomes "restart to apply" on its own once the
 * download lands, so a second interruption buys nothing. */
export function surfaceKey(request: SurfaceRequest): string {
  const family = request.reason === 'screenshots-enabled' ? 'screenshots' : 'update';
  return `${family}:${request.occurrence ?? ''}`;
}

export function surfaceCopy(request: SurfaceRequest): SurfaceCopy {
  switch (request.reason) {
    case 'update-available':
      return {
        title: 'Update available',
        body: request.occurrence
          ? `Version ${request.occurrence} is downloading.`
          : 'A new version is downloading.',
      };
    case 'update-downloaded':
      return {
        title: 'Update available',
        body: request.occurrence
          ? `Version ${request.occurrence} is ready — restart to apply.`
          : 'An update is ready — restart to apply.',
      };
    case 'screenshots-enabled':
      return {
        title: 'Screenshot capture enabled',
        body: 'Screenshot capture has been enabled by your admin.',
      };
  }
}

/** Below this they are working in something else — enough to tell
 * "mid-sentence elsewhere" from "stepped away", not to measure a break. */
export const ACTIVE_IDLE_THRESHOLD_SECONDS = 60;

export type SurfaceAction =
  /** Already being looked at — say nothing twice. */
  | 'nothing'
  /** A notification that opens the window when clicked; focus is left alone. */
  | 'notify'
  /** Restore, resize and come forward, notification included. */
  | 'raise';

export interface SurfaceWindowState {
  exists: boolean;
  visible: boolean;
  focused: boolean;
  minimized: boolean;
}

/** Taking the foreground mid-keystroke is the failure to avoid, so being
 * active anywhere downgrades to a notification. */
export function decideSurface(
  window: SurfaceWindowState,
  idleSeconds: number,
  activeThresholdSeconds = ACTIVE_IDLE_THRESHOLD_SECONDS,
): SurfaceAction {
  const onScreen =
    window.exists && window.visible && !window.minimized && window.focused;
  if (onScreen) return 'nothing';
  return idleSeconds < activeThresholdSeconds ? 'notify' : 'raise';
}

/** Which events have already been surfaced in this run. */
export class SurfacedOnce {
  private readonly seen = new Set<string>();

  shouldSurface(request: SurfaceRequest): boolean {
    const key = surfaceKey(request);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

/** Off-to-on only. The first reading is a baseline, never a transition —
 * the gate replays cached settings through `prime()` on every launch. */
export class ScreenshotEnabledWatcher {
  private last: boolean | null = null;

  observe(enabled: boolean): boolean {
    const turnedOn = this.last === false && enabled;
    this.last = enabled;
    return turnedOn;
  }
}

export type SurfaceHandler = (request: SurfaceRequest) => void | Promise<void>;

let handler: SurfaceHandler | null = null;
let logger: (line: string) => void = () => {};
let surfaced = new SurfacedOnce();

export function installSurfaceHandler(
  next: SurfaceHandler,
  log: (line: string) => void = () => {},
): void {
  handler = next;
  logger = log;
}

/** Tests only — clears both the handler and what has been surfaced. */
export function resetSurfacing(): void {
  handler = null;
  logger = () => {};
  surfaced = new SurfacedOnce();
}

/** Fire and forget: every call site is mid-way through something that
 * matters more, so nothing is awaited and no failure propagates. */
export function surfaceWindow(request: SurfaceRequest): void {
  if (!handler) return;
  if (!surfaced.shouldSurface(request)) return;
  try {
    const result = handler(request);
    if (result instanceof Promise) {
      result.catch((error: unknown) => {
        logger(`[surface-window] ${request.reason} failed: ${String(error)}`);
      });
    }
  } catch (error) {
    logger(`[surface-window] ${request.reason} failed: ${String(error)}`);
  }
}
