import type {
  ErrorResponse,
  PingRequest,
  ReadyEvent,
  ResolveOkResponse,
  ResolveRequest,
  ResolverRequest,
} from '../../url-capture/protocol';
import type { BrowserRegistryEntry } from '../../url-capture/browser-registry';
import { loadBrowserRegistry, lookupBrowser } from '../../url-capture/browser-registry';
import { AppleEventsResolver } from './apple-events';
import { AppleScriptFocusSource, FocusMonitor, type FocusTarget } from './focus-monitor';
import { FirefoxAxResolver } from './firefox-ax';
import { resolveFirefoxAxHelperPathFromEnv } from './firefox-ax-helper-path';
import { OsascriptRunner } from './osascript-runner';

/**
 * Parses and fully validates one incoming protocol line — not just "is this
 * JSON with an `op` field" but the exact shape a `ResolverRequest` needs.
 * Pulled out as a pure, exported function (rather than inline in the stdin
 * handler) specifically so it's unit-testable without spawning the whole
 * side-car: a malformed line here must never crash the process (it used to
 * — see the fixed bug this guards against), and that's cheap to prove in
 * isolation.
 */
export function parseRequestLine(line: string): ResolverRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.id !== 'number') return null;

  if (obj.op === 'ping') {
    return { id: obj.id, op: 'ping' };
  }
  if (obj.op === 'resolve' && typeof obj.pid === 'number' && typeof obj.hwnd === 'number') {
    return { id: obj.id, op: 'resolve', pid: obj.pid, hwnd: obj.hwnd };
  }
  return null;
}

interface ResolvedUrl {
  ok: true;
  url: string;
  title: string;
  private: boolean | null;
  source: 'apple-events' | 'ax';
  confidence: 'exact' | 'displayed';
}
interface ResolveFailed {
  ok: false;
  message: string;
}

/**
 * The side-car entry point: reads newline-delimited JSON requests from
 * stdin, writes responses/events to stdout, logs everything else to
 * stderr — never anything but protocol JSON on stdout (CLAUDE.md's pinned
 * rule). `hwnd` has no macOS equivalent, so it's always 0 here; `pid` is
 * the real identity a resolve() request is matched against.
 */
function main(): void {
  const registry = loadBrowserRegistry();
  // One runner shared by focus polling AND resolve() calls — the "never
  // more than one osascript process in flight" bound has to be global to
  // the whole side-car, not per-component.
  const runner = new OsascriptRunner();
  const appleEventsResolver = new AppleEventsResolver(runner);
  // This whole process runs via ELECTRON_RUN_AS_NODE (see main.ts) — a
  // plain Node process, not Electron's main process — so app.isPackaged/
  // process.resourcesPath aren't available here directly; main.ts passes
  // the equivalent information in via env vars instead (see
  // firefox-ax-helper-path.ts).
  const firefoxAxResolver = new FirefoxAxResolver({ binaryPath: resolveFirefoxAxHelperPathFromEnv() });
  const focusMonitor = new FocusMonitor(new AppleScriptFocusSource(runner));

  let lastFocus: FocusTarget | null = null;

  function writeLine(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
  }

  focusMonitor.on('focusChanged', (target) => {
    lastFocus = target;
    if (!target) return;
    writeLine({
      ev: 'focus',
      pid: target.pid,
      hwnd: 0,
      app: target.appName,
      title: target.title,
      ts: Date.now(),
    });
  });

  function handlePing(request: PingRequest): void {
    writeLine({ id: request.id, ok: true });
  }

  async function resolveViaAppleEvents(entry: BrowserRegistryEntry): Promise<ResolvedUrl | ResolveFailed> {
    // A resolve racing the focus poller's own osascript call gets `busy`
    // once immediately; retry a couple of times with a short backoff
    // rather than surfacing a spurious failure for something this common.
    let outcome = await appleEventsResolver.resolve(entry);
    for (let attempt = 0; outcome.ok === false && outcome.error.code === 'busy' && attempt < 3; attempt += 1) {
      await new Promise((r) => setTimeout(r, 75));
      outcome = await appleEventsResolver.resolve(entry);
    }
    if (!outcome.ok) return { ok: false, message: `[${outcome.error.code}] ${outcome.error.message}` };
    return {
      ok: true,
      url: outcome.url,
      title: outcome.title,
      private: outcome.private,
      source: 'apple-events',
      confidence: 'exact',
    };
  }

  async function resolveViaFirefoxAx(pid: number): Promise<ResolvedUrl | ResolveFailed> {
    const outcome = await firefoxAxResolver.resolve(pid);
    if (!outcome.ok) return { ok: false, message: `[${outcome.error.code}] ${outcome.error.message}` };
    return {
      ok: true,
      url: outcome.url,
      title: outcome.title,
      private: outcome.private,
      source: 'ax',
      confidence: 'displayed',
    };
  }

  async function handleResolve(request: ResolveRequest): Promise<void> {
    if (!lastFocus || lastFocus.pid !== request.pid) {
      const failure: ErrorResponse = {
        id: request.id,
        ok: false,
        message: 'Resolve request does not match the currently focused app.',
      };
      writeLine(failure);
      return;
    }

    const { entry } = lookupBrowser(registry, 'darwin', lastFocus.bundleId);
    const started = Date.now();
    const outcome =
      entry.family === 'gecko' ? await resolveViaFirefoxAx(lastFocus.pid) : await resolveViaAppleEvents(entry);

    if (!outcome.ok) {
      const failure: ErrorResponse = { id: request.id, ok: false, message: outcome.message };
      writeLine(failure);
      return;
    }

    const response: ResolveOkResponse = {
      id: request.id,
      ok: true,
      url: outcome.url,
      title: outcome.title,
      browser: lastFocus.appName,
      private: outcome.private,
      source: outcome.source,
      confidence: outcome.confidence,
      ms: Date.now() - started,
    };
    writeLine(response);
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
        handleLine(line);
      }
      newlineIndex = buffer.indexOf('\n');
    }
  });

  function handleLine(line: string): void {
    const request = parseRequestLine(line);
    if (!request) {
      process.stderr.write(`Dropped unrecognized request line: ${line.slice(0, 200)}\n`);
      return;
    }
    if (request.op === 'ping') {
      void handlePing(request);
    } else if (request.op === 'resolve') {
      void handleResolve(request);
    } else {
      process.stderr.write(`Dropped request with unknown op: ${line.slice(0, 200)}\n`);
    }
  }

  const ready: ReadyEvent = { ev: 'ready', platform: 'darwin', caps: ['focus', 'url', 'private'] };
  writeLine(ready);
  focusMonitor.start();
}

// Only auto-run when this file is the actual process entry point — not
// when imported (e.g. `parseRequestLine` in tests), which would otherwise
// hijack stdin and start polling for a frontmost app on whatever machine
// runs the test suite.
if (require.main === module) {
  main();
}
