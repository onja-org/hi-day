import type {
  ErrorResponse,
  FocusEvent,
  PingRequest,
  ReadyEvent,
  ResolveOkResponse,
  ResolveRequest,
} from '../../url-capture/protocol';
import { parseRequestLine } from '../../url-capture/protocol';
import {
  loadBrowserRegistry,
  lookupBrowser,
  normalizeAppName,
} from '../../url-capture/browser-registry';
import { AtspiClient, EventRegistrationError, type AtspiWindow } from './atspi';
import {
  accessibilityBusUnavailableReason,
  eventRegistrationFailedReason,
  evaluateSupport,
  readSessionEnvironment,
} from './support-gate';

/**
 * The Linux side-car: focus detection and URL reading both come from AT-SPI2
 * over D-Bus. Step 18's `org.gnome.Shell.Introspect.GetWindows` is unusable
 * — it returns `AccessDenied` to an ordinary process on GNOME 46 — and
 * `window:activate` carries the same information.
 */

export { normalizeAppName };

/**
 * Derives the protocol's `hwnd` from an AT-SPI object path, whose trailing
 * segment is a per-window integer (`/org/a11y/atspi/accessible/5310`).
 *
 * Unique only *within* one application: every browser numbers its own
 * windows from 1, so this alone is not a window identity. See
 * `pidFromBusName`, which supplies the rest of it.
 */
export function hwndFromPath(path: string): number {
  const match = /(\d+)$/.exec(path);
  return match ? Number(match[1]) : 0;
}

/**
 * Derives the protocol's `pid` from the application's unique D-Bus name
 * (`:1.43`). Linux has no real window handle to report, so the session
 * engine's window identity — the `(pid, hwnd)` pair — has to be built from
 * what AT-SPI does expose.
 *
 * Reporting a constant pid made that pair collide: Chrome, Brave, Edge,
 * Opera and Vivaldi each call their first window `/accessible/1`, so five
 * browsers shared one identity and the engine saw switching between them as
 * staying put. Only whichever was focused first was ever tracked.
 *
 * The bus name is the connection's unique id, stable for as long as the
 * application runs, which is exactly what `pid` needs to convey here.
 */
export function pidFromBusName(bus: string): number {
  const match = /(\d+)$/.exec(bus);
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
    startProtocolLoop(() => null, () => null, () => undefined);
    return;
  }

  const registry = loadBrowserRegistry();
  let lastFocus: AtspiWindow | null = null;
  let connected: AtspiClient | null = null;

  const client = new AtspiClient({
    logger: (line) => process.stderr.write(`${line}\n`),
    onWindowActivated: (window) => {
      lastFocus = window;
      const focus: FocusEvent = {
        ev: 'focus',
        pid: pidFromBusName(window.bus),
        hwnd: hwndFromPath(window.path),
        app: window.appName,
        title: window.title,
        ts: Date.now(),
      };
      writeLine(focus);
    },
  });

  // Before the connection, not after: connecting can take several seconds on
  // a cold login, and a side-car that is not answering pings by then is
  // killed and respawned until the manager gives up on it.
  startProtocolLoop(
    () => connected,
    () => lastFocus,
    () => registry,
  );

  try {
    await startWithRetry(client);
  } catch (error) {
    const registration = error instanceof EventRegistrationError;
    process.stderr.write(
      `[linux-resolver] ${registration ? 'focus events unavailable' : 'accessibility bus unavailable'}: ${String(error)}\n`,
    );
    const ready: ReadyEvent = { ev: 'ready', platform: 'linux', caps: ['focus'] };
    writeLine(ready);
    writeLine({
      ev: 'error',
      code: registration ? 'event-registration-failed' : 'a11y-bus-unavailable',
      detail: registration
        ? eventRegistrationFailedReason()
        : accessibilityBusUnavailableReason(error),
    });
    return;
  }

  connected = client;

  // No `private` capability: Chromium exposes no incognito marker through
  // AT-SPI that has been confirmed on a real machine, and claiming the
  // capability without one would under-report `private` — the failure
  // direction that leaks a private URL, per URL_TRACKING_CONTEXT.md's
  // anti-goals. `private` is reported as null instead (unknown), which the
  // session engine already handles.
  const ready: ReadyEvent = { ev: 'ready', platform: 'linux', caps: ['focus', 'url'] };
  writeLine(ready);
}

/**
 * Delays between connection attempts at start-up, in milliseconds.
 *
 * The agent starts itself at login (`~/.config/autostart`), and the
 * accessibility bus is activated on demand by whatever asks for it first —
 * so on a cold login the side-car can be the one asking before the session
 * is ready to answer. A single attempt made that a whole session with no
 * website tracking, reported as "the accessibility service is not running"
 * on a machine where it was running a second later.
 *
 * Deliberately short and finite. Once the session is up this either works or
 * is genuinely missing, and a side-car retrying forever would hide a real
 * fault behind a capability that silently arrives minutes late.
 */
const START_RETRY_DELAYS_MS = [1_000, 3_000, 6_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A registration refusal is not retried: the bus answered, and it will
 * answer the same way again (see `eventRegistrationFailedReason`).
 */
export async function startWithRetry(
  client: Pick<AtspiClient, 'start'>,
  delaysMs: number[] = START_RETRY_DELAYS_MS,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await client.start();
      return;
    } catch (error) {
      if (error instanceof EventRegistrationError) throw error;
      if (attempt >= delaysMs.length) throw error;
      process.stderr.write(
        `[linux-resolver] accessibility bus not ready, retrying in ${delaysMs[attempt]}ms\n`,
      );
      await wait(delaysMs[attempt]);
    }
  }
}

/**
 * Answers pings from the moment it is called, and reads whatever client is
 * available *at the time of each request* rather than one captured when it
 * started. The manager pings every 5s and kills a side-car that misses two
 * (`resolver-manager.ts`), so anything slow — retrying a bus that is not up
 * yet at login — has to happen with this already listening, or the watchdog
 * ends the process mid-connect and the restart budget drains into a
 * "kept stopping" message instead of the real reason.
 */
function startProtocolLoop(
  getClient: () => AtspiClient | null,
  getLastFocus: () => AtspiWindow | null,
  getRegistry: () => ReturnType<typeof loadBrowserRegistry> | undefined,
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

    const client = getClient();
    if (!client) {
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

      // Read together so the title belongs to the same tab as the URL.
      const [url, title] = await Promise.all([
        client.readAddressBarText(focus.bus, barPath),
        client.readWindowTitle(focus.bus, focus.path),
      ]);
      if (url.trim().length === 0) {
        fail('[empty-address-bar] The address bar is empty.');
        return;
      }

      const registry = getRegistry();
      const browser = registry
        ? lookupBrowser(registry, 'linux', normalizeAppName(focus.appName)).key
        : focus.appName;

      const response: ResolveOkResponse = {
        id: request.id,
        ok: true,
        url,
        title,
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
