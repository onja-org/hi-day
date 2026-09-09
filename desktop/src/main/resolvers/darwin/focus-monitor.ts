import { TypedEmitter } from '../../url-capture/typed-emitter';
import type { OsascriptRunner } from './osascript-runner';
import { materializeScript } from './scripts';

export interface FocusTarget {
  pid: number;
  bundleId: string;
  appName: string;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * `ok` with `target: null` means we positively confirmed nothing is
 * frontmost (rare). `unavailable` means this poll couldn't tell — a
 * transient osascript failure (including our own concurrency bound
 * rejecting it as `busy` because a resolve() call is in flight) — and
 * should be skipped rather than treated as "focus was lost," or a resolve
 * racing a poll would spuriously flicker focus to null and back.
 */
export type FocusPollResult = { status: 'ok'; target: FocusTarget | null } | { status: 'unavailable' };

export interface FocusSource {
  poll(): Promise<FocusPollResult>;
}

export type FocusMonitorEvents = { focusChanged: FocusTarget | null };

const DEFAULT_POLL_INTERVAL_MS = 1_500;

/**
 * Poll-based today; the interface (`FocusSource`) is what a future
 * push-based Swift NSWorkspace helper needs to satisfy conceptually to
 * replace this without touching whatever consumes `focusChanged` — see
 * Prompt B.1's "structure it so a push-based helper can replace the poll
 * later without touching callers."
 */
export class FocusMonitor extends TypedEmitter<FocusMonitorEvents> {
  private timer: ReturnType<typeof setInterval> | null = null;
  private last: FocusTarget | null = null;
  private polling = false;

  constructor(
    private readonly source: FocusSource,
    private readonly intervalMs: number = DEFAULT_POLL_INTERVAL_MS,
  ) {
    super();
  }

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.polling) return; // a slow previous poll is still in flight
    this.polling = true;
    try {
      const result = await this.source.poll();
      if (result.status === 'unavailable') return;
      if (!sameTarget(this.last, result.target)) {
        this.last = result.target;
        this.emit('focusChanged', result.target);
      }
    } finally {
      this.polling = false;
    }
  }
}

function sameTarget(a: FocusTarget | null, b: FocusTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.pid === b.pid;
}

const FRONTMOST_APP_SCRIPT = `
on run argv
  tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set appName to name of frontApp
    set bundleId to bundle identifier of frontApp
    -- Some legitimate processes (menu-bar/background helpers) have no
    -- bundle id at all; "missing value" can't be concatenated with & below
    -- without raising a runtime error, so coerce it to empty first.
    if bundleId is missing value then set bundleId to ""
    set appPid to unix id of frontApp
    try
      set w to front window of frontApp
      set winTitle to name of w
      set {xPos, yPos} to position of w
      set {winWidth, winHeight} to size of w
    on error
      set winTitle to ""
      set xPos to 0
      set yPos to 0
      set winWidth to 0
      set winHeight to 0
    end try
  end tell
  return appName & tab & bundleId & tab & appPid & tab & winTitle & tab & xPos & tab & yPos & tab & winWidth & tab & winHeight
end run
`;

export function parseFrontmostAppOutput(stdout: string): FocusTarget | null {
  // appName/bundleId/pid are fixed at the front, x/y/width/height fixed at
  // the back — title (the only field that can plausibly contain a literal
  // tab, e.g. a page title) is whatever's left in between, rejoined.
  const fields = stdout.trimEnd().split('\t');
  if (fields.length < 8) return null;

  const [appName, bundleId, pidStr] = fields;
  const [xStr, yStr, widthStr, heightStr] = fields.slice(-4);
  const title = fields.slice(3, -4).join('\t');

  const pid = Number(pidStr);
  if (!Number.isFinite(pid)) return null;
  return {
    pid,
    bundleId,
    appName,
    title,
    bounds: { x: Number(xStr) || 0, y: Number(yStr) || 0, width: Number(widthStr) || 0, height: Number(heightStr) || 0 },
  };
}

/** The default, poll-based focus source — shells out to System Events, no native addon. */
export class AppleScriptFocusSource implements FocusSource {
  constructor(private readonly runner: OsascriptRunner) {}

  async poll(): Promise<FocusPollResult> {
    const scriptPath = materializeScript('frontmost-app', FRONTMOST_APP_SCRIPT);
    const outcome = await this.runner.run(scriptPath);
    if (!outcome.ok) return { status: 'unavailable' };
    return { status: 'ok', target: parseFrontmostAppOutput(outcome.stdout) };
  }
}
