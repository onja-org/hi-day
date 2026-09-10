/**
 * Step 20's support matrix, evaluated as a pure function so it's testable
 * without a real desktop session: **GNOME-on-Wayland or any-WM-on-Xorg is
 * supported; everything else reports no `url` capability and says why.**
 * Adopted openly (per the plan) rather than shipping something flaky and
 * calling it support.
 */

export type SessionType = 'wayland' | 'x11' | 'unknown';

export interface SessionEnvironment {
  /** `XDG_SESSION_TYPE` */
  sessionType: string | undefined;
  /** `XDG_CURRENT_DESKTOP` */
  currentDesktop: string | undefined;
}

/**
 * Reads the session identity from the environment, correcting for a
 * Chromium behaviour that silently broke this gate on a real GNOME box:
 * **Electron/Chromium overwrites `XDG_CURRENT_DESKTOP` with `Unity`** and
 * preserves the true value in `ORIGINAL_XDG_CURRENT_DESKTOP`. Reading the
 * former made a genuine `ubuntu:GNOME` Wayland session report as an
 * unsupported desktop, so URL tracking disabled itself and the coverage
 * screen told the user to switch to Xorg for no reason.
 *
 * This matters in two processes, which is why it lives here rather than at
 * either call site: Electron's main process (for the coverage report) and
 * the resolver side-car, which inherits Electron's already-modified
 * environment when spawned.
 */
export function readSessionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): SessionEnvironment {
  return {
    sessionType: env.XDG_SESSION_TYPE,
    currentDesktop: env.ORIGINAL_XDG_CURRENT_DESKTOP ?? env.XDG_CURRENT_DESKTOP,
  };
}

export interface SupportVerdict {
  supported: boolean;
  sessionType: SessionType;
  /** User-facing explanation, surfaced through the coverage screen. */
  reason: string;
}

function normalizeSessionType(raw: string | undefined): SessionType {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'wayland') return 'wayland';
  if (value === 'x11') return 'x11';
  return 'unknown';
}

function isGnome(currentDesktop: string | undefined): boolean {
  // XDG_CURRENT_DESKTOP is a colon-separated list ("ubuntu:GNOME"), so this
  // is a substring test on purpose, not an equality check.
  return (currentDesktop ?? '').toLowerCase().includes('gnome');
}

export function evaluateSupport(environment: SessionEnvironment): SupportVerdict {
  const sessionType = normalizeSessionType(environment.sessionType);

  if (sessionType === 'x11') {
    return {
      supported: true,
      sessionType,
      reason: 'Active via the accessibility bus (AT-SPI) on Xorg.',
    };
  }

  if (sessionType === 'wayland') {
    if (isGnome(environment.currentDesktop)) {
      return {
        supported: true,
        sessionType,
        reason: 'Active via the accessibility bus (AT-SPI) on GNOME Wayland.',
      };
    }
    return {
      supported: false,
      sessionType,
      reason:
        'Website tracking on Wayland is supported only on GNOME. Log in to an Xorg session to enable it here.',
    };
  }

  return {
    supported: false,
    sessionType,
    reason:
      'Could not determine the desktop session type, so website tracking stays off rather than reporting data it cannot stand behind.',
  };
}

/**
 * The accessibility bus can be reachable while GTK apps still expose no
 * tree at all, because `toolkit-accessibility` gates whether they build
 * one. Surfaced separately from `evaluateSupport` because the fix is a
 * command the user runs, not a platform limitation they're stuck with.
 */
export const ENABLE_TOOLKIT_ACCESSIBILITY_COMMAND =
  'gsettings set org.gnome.desktop.interface toolkit-accessibility true';

export function accessibilityBusUnavailableReason(): string {
  return (
    'The accessibility service is not running, so website tracking is off. ' +
    `Enable it with: ${ENABLE_TOOLKIT_ACCESSIBILITY_COMMAND} — then restart your browser.`
  );
}
