import type { AtspiFailure } from './gnome-window-focus-tracker';
import type { DesktopDevicePlatform } from './platform';
import type { SessionEnvironment } from './resolvers/linux/support-gate';

/** Whether one window source answered when it started. */
export type CaptureSourceState = 'starting' | 'up' | 'down';

/**
 * Mirrors the backend's AppCaptureStatus and UrlCaptureStatus enums
 * (backend/src/database/entities/app-capture-status.enum.ts,
 * url-capture-status.enum.ts) — the same three values for both.
 */
export type CaptureStatus = 'ok' | 'degraded' | 'unavailable';

export interface CaptureHealth {
  status: CaptureStatus;
  /** What an admin reads on the Devices page; null when status is 'ok'. */
  detail: string | null;
}

export interface AppCaptureSources {
  platform: DesktopDevicePlatform;
  isWayland: boolean;
  x11: CaptureSourceState;
  atspi: CaptureSourceState;
  atspiFailure: AtspiFailure | null;
  /** Windows and macOS: whether @paymoapp/active-window loaded. */
  nativeAddonLoaded: boolean;
}

function atspiCause(failure: AtspiFailure | null): string {
  return failure === 'event-registration-failed'
    ? 'the accessibility service (at-spi2-core) did not accept the listener — updating it usually fixes this'
    : 'the accessibility service (at-spi2-core) is not running';
}

/**
 * Judged on whether each window source came up, not on samples coming back
 * empty — an empty sample is ordinary whenever the desktop itself has
 * focus. Null while a source is still starting, so the heartbeat sends
 * nothing rather than a guess.
 *
 * Supported: Xorg with any window manager (X11 sees every window), and
 * GNOME on Wayland (X11 for XWayland clients, AT-SPI for Wayland-native
 * windows). Another Wayland desktop gets whichever of the two answers.
 */
export function assessAppCapture(
  sources: AppCaptureSources,
): CaptureHealth | null {
  if (sources.platform !== 'linux') {
    return sources.nativeAddonLoaded
      ? { status: 'ok', detail: null }
      : {
          status: 'unavailable',
          detail: 'The window-tracking library failed to load, so no apps are recorded.',
        };
  }

  if (!sources.isWayland) {
    if (sources.x11 === 'starting') return null;
    return sources.x11 === 'up'
      ? { status: 'ok', detail: null }
      : {
          status: 'unavailable',
          detail: 'Could not connect to the X display, so no apps are recorded.',
        };
  }

  if (sources.x11 === 'starting' || sources.atspi === 'starting') return null;

  if (sources.x11 === 'up' && sources.atspi === 'up') {
    return { status: 'ok', detail: null };
  }
  if (sources.x11 === 'up') {
    return {
      status: 'degraded',
      detail: `Apps running natively on Wayland are not recorded: ${atspiCause(sources.atspiFailure)}. Apps running under XWayland still are.`,
    };
  }
  if (sources.atspi === 'up') {
    return {
      status: 'degraded',
      detail:
        'Apps running under XWayland (JetBrains IDEs, VLC, Teams and others) are not recorded: XWayland is not available. Apps running natively on Wayland still are.',
    };
  }
  return {
    status: 'unavailable',
    detail: `No apps are recorded: XWayland is not available and ${atspiCause(sources.atspiFailure)}.`,
  };
}

/**
 * "x11 · ubuntu:GNOME" — the two facts that decide which sources a Linux
 * session has, reported so the Devices page shows why two machines that
 * look alike behave differently. Null off Linux.
 */
export function describeDisplaySession(
  platform: DesktopDevicePlatform,
  environment: SessionEnvironment,
): string | null {
  if (platform !== 'linux') return null;
  const sessionType = environment.sessionType?.trim() || 'unknown';
  const desktop = environment.currentDesktop?.trim();
  return desktop ? `${sessionType} · ${desktop}` : sessionType;
}
