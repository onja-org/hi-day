import type {
  ErrorResponse,
  PingRequest,
  ReadyEvent,
  ResolveOkResponse,
  ResolveRequest,
} from '../../url-capture/protocol';
import { parseRequestLine } from '../../url-capture/protocol';
import type { BrowserRegistryEntry } from '../../url-capture/browser-registry';
import { loadBrowserRegistry, lookupBrowser } from '../../url-capture/browser-registry';
import { AppleEventsResolver } from './apple-events';
import { AppleScriptFocusSource, FocusMonitor, type FocusTarget } from './focus-monitor';
import { FirefoxAxResolver } from './firefox-ax';
import { resolveFirefoxAxHelperPathFromEnv } from './firefox-ax-helper-path';
import { OsascriptRunner } from './osascript-runner';

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
    // A resolve racing the focus poller's own osascript call gets `busy`, and
    // only one osascript may be in flight at a time. The retry budget has to
    // outlast a poll or the race is simply lost: measured on an Intel Air, a
    // poll takes 270-460ms, while 3 attempts at 75ms waited 225ms — less than
    // half of it. Chrome duly reported busy on roughly every other heartbeat.
    //
    // 6 attempts at 150ms waits up to 900ms, comfortably past the slowest poll
    // observed and still inside osascript-runner's own 1200ms deadline.
    let outcome = await appleEventsResolver.resolve(entry);
    for (let attempt = 0; outcome.ok === false && outcome.error.code === 'busy' && attempt < 6; attempt += 1) {
      await new Promise((r) => setTimeout(r, 150));
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
      // Tagged like every other failure here. Untagged, this bucketed as
      // "unknown" on the agent side — indistinguishable from the manager's own
      // 'No response from resolver.' timeout, which is also untagged. Those
      // need opposite fixes, and Chrome hitting one of them looked identical
      // to it hitting the other.
      //
      // The detail goes to stderr, not into the message: the agent keeps only
      // the [code] tag from a failure message, so anything else there is
      // discarded. The tag alone says the guard rejected the request, not why
      // — a stale pid, a pid that moved, and no focus at all are three
      // different faults. Pids and app names are process identity, never page
      // content.
      process.stderr.write(
        `[focus-mismatch] requested pid ${request.pid}, focused ${
          lastFocus ? `${lastFocus.pid} (${lastFocus.appName})` : 'none'
        }\n`,
      );
      const failure: ErrorResponse = {
        id: request.id,
        ok: false,
        message: '[focus-mismatch] Resolve request does not match the currently focused app.',
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
