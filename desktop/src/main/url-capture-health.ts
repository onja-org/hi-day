import type { CaptureHealth } from './app-capture-health';
import type { ResolverHealthSnapshot } from './url-capture/resolver-health';

export interface UrlCaptureSources {
  /** Null when URL capture is not running at all — nothing to report. */
  resolver: ResolverHealthSnapshot | null;
  /**
   * Display names of browsers running without their accessibility tree
   * (Linux, `BrowserRestartService.findBlind`). Always empty elsewhere.
   */
  blindBrowsers: string[];
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Whether this device can read the websites people visit, for the Devices
 * page — so a gap is visible rather than looking like nobody browsed.
 *
 * A blind browser is the case that prompted this: one opened from a Chrome
 * web-app shortcut, a terminal or an autostart entry starts without its
 * accessibility tree, every window opened afterwards joins that process, and
 * none of its addresses can be read until it is fully closed. Judged from
 * the process itself, not from failed reads: a web-app window legitimately
 * has no address bar either.
 */
export function assessUrlCapture(sources: UrlCaptureSources): CaptureHealth | null {
  const { resolver } = sources;
  if (!resolver || resolver.state === 'starting') return null;

  if (resolver.state === 'degraded') {
    return {
      status: 'unavailable',
      detail: 'The website reader kept stopping and has been switched off until the app restarts.',
    };
  }

  if (resolver.caps !== null && !resolver.caps.includes('url')) {
    return {
      status: 'unavailable',
      detail: resolver.lastErrorDetail ?? 'Website tracking is not available on this device.',
    };
  }

  if (sources.blindBrowsers.length > 0) {
    const one = sources.blindBrowsers.length === 1;
    return {
      status: 'degraded',
      detail:
        `${listNames(sources.blindBrowsers)} ${one ? 'is' : 'are'} running without website tracking, ` +
        `usually because ${one ? 'it was' : 'they were'} first opened from a web-app shortcut or a terminal. ` +
        `${one ? 'Its' : 'Their'} websites are recorded as unknown until ${one ? 'it is' : 'they are'} ` +
        'fully closed and opened again.',
    };
  }

  return { status: 'ok', detail: null };
}
