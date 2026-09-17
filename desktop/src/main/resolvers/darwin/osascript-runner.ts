import { classifyAppleEventsFailure, type ClassifiedAppleEventsError } from './errors';
import { spawnWithTimeout } from './spawn-with-timeout';

export interface OsascriptSuccess {
  ok: true;
  stdout: string;
}
export interface OsascriptFailure {
  ok: false;
  error: ClassifiedAppleEventsError;
}
export type OsascriptOutcome = OsascriptSuccess | OsascriptFailure;

export interface OsascriptRunnerOptions {
  /** Overridable so tests can point this at a fake executable — 'osascript' doesn't exist off macOS. */
  command?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2_000;

/**
 * Runs a compiled AppleScript file via osascript, bounded to one process in
 * flight at a time — a concurrent call while one is already running is
 * rejected immediately with `busy` rather than queued, since the caller
 * (heartbeat or an explicit resolve) will simply try again on its own next
 * tick.
 */
export class OsascriptRunner {
  private readonly command: string;
  private readonly timeoutMs: number;
  private inFlight = false;

  constructor(options: OsascriptRunnerOptions = {}) {
    this.command = options.command ?? 'osascript';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async run(scriptPath: string, args: string[] = []): Promise<OsascriptOutcome> {
    if (this.inFlight) {
      return { ok: false, error: { code: 'busy', message: 'Another osascript call is already in flight.' } };
    }
    this.inFlight = true;
    try {
      const result = await spawnWithTimeout(this.command, [scriptPath, ...args], this.timeoutMs);
      if (result.spawnError) {
        return { ok: false, error: { code: 'unknown', message: `Failed to spawn ${this.command}: ${result.spawnError}` } };
      }
      if (!result.timedOut && result.exitCode === 0) {
        return { ok: true, stdout: result.stdout };
      }
      return { ok: false, error: classifyAppleEventsFailure(result.stderr, result.timedOut) };
    } finally {
      this.inFlight = false;
    }
  }
}
