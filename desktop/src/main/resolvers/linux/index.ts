import type {
  ErrorResponse,
  FocusEvent,
  PingRequest,
  ReadyEvent,
  ResolveOkResponse,
  ResolveRequest,
} from '../../url-capture/protocol';
import { parseRequestLine } from '../../url-capture/protocol';
import { loadBrowserRegistry, lookupBrowser } from '../../url-capture/browser-registry';
import { AtspiClient, type AtspiWindow } from './atspi';
import {
  accessibilityBusUnavailableReason,
  evaluateSupport,
  readSessionEnvironment,
} from './support-gate';

/**
 * The Linux side-car: focus detection and URL reading both come from AT-SPI2
 * over D-Bus. Step 18's `org.gnome.Shell.Introspect.GetWindows` is unusable
 * — it returns `AccessDenied` to an ordinary process on GNOME 46 — and
 * `window:activate` carries the same information.
 */

/**
 * AT-SPI reports an application's display name ("Google Chrome"); the
 * registry keys Linux entries by process name ("google-chrome"). Normalize
 * before matching rather than duplicating every name in the registry.
 */
export function normalizeAppName(appName: string): string {
  return appName.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Derives the protocol's `hwnd` from an AT-SPI object path, whose trailing
 * segment is already a stable per-window integer
 * (`/org/a11y/atspi/accessible/5310`). Linux has no real window handle to
 * report, and the session engine only needs a value that stays consistent
 * for as long as the window does.
 */
export function hwndFromPath(path: string): number {
  const match = /(\d+)$/.exec(path);
  return match ? Number(match[1]) : 0;
}

function writeLine(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function main(): Promise<void> {
  const support = evaluateSupport(readSessionEnvironment());

  // Step 20: an unsupported session still runs and still answers pings — it
  // just never claims the `url` capability, and reports why, instead of
  // the agent looking silently broken.
  if (!support.supported) {
    const ready: ReadyEvent = { ev: 'ready', platform: 'linux', caps: ['focus'] };
    writeLine(ready);
    writeLine({ ev: 'error', code: 'unsupported-session', detail: support.reason });
    startProtocolLoop(null, null);
    return;
  }

  const registry = loadBrowserRegistry();
  let lastFocus: AtspiWindow | null = null;

  const client = new AtspiClient({
    logger: (line) => process.stderr.write(`${line}\n`),
    onWindowActivated: (window) => {
      lastFocus = window;
      const focus: FocusEvent = {
        ev: 'focus',
        pid: 0,
        hwnd: hwndFromPath(window.path),
        app: window.appName,
        title: window.title,
        ts: Date.now(),
      };
      writeLine(focus);
    },
  });

  try {
    await client.start();
  } catch (error) {
    process.stderr.write(`[linux-resolver] accessibility bus unavailable: ${String(error)}\n`);
    const ready: ReadyEvent = { ev: 'ready', platform: 'linux', caps: ['focus'] };
    writeLine(ready);
    writeLine({ ev: 'error', code: 'a11y-bus-unavailable', detail: accessibilityBusUnavailableReason() });
    startProtocolLoop(null, null);
    return;
  }

  // No `private` capability: Chromium exposes no incognito marker through
  // AT-SPI that has been confirmed on a real machine, and claiming the
  // capability without one would under-report `private` — the failure
  // direction that leaks a private URL, per URL_TRACKING_CONTEXT.md's
  // anti-goals. `private` is reported as null instead (unknown), which the
  // session engine already handles.
  const ready: ReadyEvent = { ev: 'ready', platform: 'linux', caps: ['focus', 'url'] };
  writeLine(ready);

  startProtocolLoop(client, () => lastFocus, registry);
}

function startProtocolLoop(
  client: AtspiClient | null,
  getLastFocus: (() => AtspiWindow | null) | null,
  registry?: ReturnType<typeof loadBrowserRegistry>,
): void {
  function handlePing(request: PingRequest): void {
    writeLine({ id: request.id, ok: true });
  }

  async function handleResolve(request: ResolveRequest): Promise<void> {
    const started = Date.now();
    const fail = (message: string): void => {
      const failure: ErrorResponse = { id: request.id, ok: false, message };
      writeLine(failure);
    };

    if (!client || !getLastFocus) {
      fail('[unsupported-session] URL capture is disabled for this desktop session.');
      return;
    }

    const focus = getLastFocus();
    if (!focus) {
      fail('[no-focus] No window has been reported as focused yet.');
      return;
    }

    let barPath: string | null;
    try {
      barPath = await client.findAddressBarPath(focus.bus, focus.path);
    } catch (error) {
      fail(`[atspi-error] ${String(error)}`);
      return;
    }
    if (!barPath) {
      fail('[no-address-bar] The focused window exposes no address bar.');
      return;
    }

    try {
      // Step 21 rule 1 — a focused omnibox means the person is typing, so
      // whatever it holds is not a URL they are viewing.
      if (await client.isFocused(focus.bus, barPath)) {
        fail('[address-bar-focused] The address bar has keyboard focus.');
        return;
      }

      const url = await client.readAddressBarText(focus.bus, barPath);
      if (url.trim().length === 0) {
        fail('[empty-address-bar] The address bar is empty.');
        return;
      }

      const browser = registry
        ? lookupBrowser(registry, 'linux', normalizeAppName(focus.appName)).key
        : focus.appName;

      const response: ResolveOkResponse = {
        id: request.id,
        ok: true,
        url,
        title: focus.title,
        browser,
        private: null,
        source: 'atspi',
        confidence: 'displayed',
        ms: Date.now() - started,
      };
      writeLine(response);
    } catch (error) {
      fail(`[atspi-error] ${String(error)}`);
    }
  }

  let buffer = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.trim().length > 0) {
        const request = parseRequestLine(line);
        if (!request) {
          process.stderr.write(`Dropped unrecognized request line: ${line.slice(0, 200)}\n`);
        } else if (request.op === 'ping') {
          handlePing(request);
        } else {
          void handleResolve(request);
        }
      }
      newlineIndex = buffer.indexOf('\n');
    }
  });
}

// Only auto-run as a real entry point — importing this for its pure
// helpers (see the tests) must not hijack stdin or open a D-Bus connection.
if (require.main === module) {
  void main();
}
