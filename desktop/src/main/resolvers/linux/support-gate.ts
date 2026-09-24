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
 * Electron overwrites `XDG_CURRENT_DESKTOP` with `Unity` and keeps the real
 * value in `ORIGINAL_XDG_CURRENT_DESKTOP`, which made a genuine GNOME
 * session report as unsupported. Shared by the main process and the
 * side-car, which inherits the modified environment.
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
  /** User-facing explanation, reported as the resolver's `unsupported-session` detail. */
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
 * Surfaced separately from `evaluateSupport` because this is a machine
 * setup problem, not a platform limitation the user is stuck with.
 *
 * Deliberately no longer tells anyone to run
 * `gsettings set org.gnome.desktop.interface toolkit-accessibility true`.
 * That instruction was wrong twice over: it is not what makes a browser
 * expose its address bar (the launcher overrides in browser-activation.ts
 * are — verified with that setting false), and it is a switch the person
 * being tracked can turn back off, so nothing may depend on it.
 */
export function accessibilityBusUnavailableReason(): string {
  return (
    'The accessibility service is not running, so website tracking is off. ' +
    'Install and start at-spi2-core (Debian/Ubuntu: `sudo apt install at-spi2-core`), ' +
    'then sign out and back in.'
  );
}

/**
 * Distinct from `accessibilityBusUnavailableReason`: the bus is reachable,
 * but the registry would not record our request for window-activation
 * events, so focus changes never arrive. Seen on at-spi2-core 2.44
 * (Pop!_OS 22.04), whose `RegisterEvent` takes one argument where 2.46+
 * takes three — the old registry accepts the newer call and drops it.
 */
export function eventRegistrationFailedReason(): string {
  return (
    'The accessibility service did not accept this app as a listener for window changes, ' +
    'so website tracking is off. Updating at-spi2-core usually fixes it ' +
    '(Debian/Ubuntu: `sudo apt install --only-upgrade at-spi2-core`), then sign out and back in.'
  );
}
