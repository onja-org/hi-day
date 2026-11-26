import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A crash that recurs faster than this is treated as a boot-time crash
 * loop (a bad build, a corrupt local file, …) rather than a one-off — see
 * `shouldRelaunch`.
 */
export const CRASH_LOOP_WINDOW_MS = 60_000;
export const MAX_RELAUNCHES_IN_WINDOW = 3;

/** Drops any timestamp older than `windowMs` relative to `now`. */
export function pruneToWindow(
  timestamps: number[],
  now: number,
  windowMs: number,
): number[] {
  return timestamps.filter((timestamp) => now - timestamp < windowMs);
}

/**
 * False once this process has already relaunched itself
 * `maxRelaunches` times within the trailing `windowMs` — without this, a
 * crash that happens on every startup (not just this one, transient run)
 * would relaunch forever instead of surfacing to whoever notices the app
 * keeps disappearing.
 */
export function shouldRelaunch(
  recentRelaunches: number[],
  now: number,
  opts: { windowMs?: number; maxRelaunches?: number } = {},
): boolean {
  const windowMs = opts.windowMs ?? CRASH_LOOP_WINDOW_MS;
  const maxRelaunches = opts.maxRelaunches ?? MAX_RELAUNCHES_IN_WINDOW;
  return pruneToWindow(recentRelaunches, now, windowMs).length < maxRelaunches;
}

function historyFilePath(userDataDir: string): string {
  return join(userDataDir, 'crash-relaunch-history.json');
}

/**
 * Survives across the relaunch itself (each relaunch is a brand new
 * process, so an in-memory counter would never see the attempts that came
 * before it) — persisted to a small JSON file in `userData`, the same
 * directory the session and offline queue already live in.
 */
export function loadRelaunchHistory(userDataDir: string): number[] {
  try {
    const raw = readFileSync(historyFilePath(userDataDir), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is number => typeof value === 'number')
      : [];
  } catch {
    return [];
  }
}

/**
 * Best-effort: a failed write just means a future crash can't see this
 * one's timestamp, which only makes the loop guard slightly more lenient
 * (one extra relaunch attempt), never less safe.
 */
export function recordRelaunch(
  userDataDir: string,
  now: number,
  windowMs: number = CRASH_LOOP_WINDOW_MS,
): void {
  const history = pruneToWindow(loadRelaunchHistory(userDataDir), now, windowMs);
  history.push(now);
  try {
    writeFileSync(historyFilePath(userDataDir), JSON.stringify(history));
  } catch {
    // See doc comment above.
  }
}

export interface FatalErrorDeps {
  /** A function, so it is read when a crash happens, after any `setPath`. */
  userDataDir: () => string;
  now: () => number;
  log: (...args: unknown[]) => void;
  relaunch: () => void;
  exit: (code: number) => void;
}

/**
 * What main runs on `uncaughtException` / `unhandledRejection`: relaunch
 * into a fresh process rather than leave the person with a vanished app.
 *
 * It deliberately does **not** stop the running timer. The entry stays
 * open on the server and in `offline-cache.json`, and the relaunched app's
 * crash recovery decides what happens to it (ADR-0025, `recovered-timer.ts`):
 * back within two minutes, it simply carries on. Pausing here used to clear
 * the timer locally before the relaunch, so recovery found nothing, and
 * one X11 race during a screenshot silently stopped somebody's tracking
 * until they noticed and pressed Start again.
 *
 * Acts once per process. A single fault can raise several errors before
 * the exit lands, and counting each as a relaunch used up the crash-loop
 * allowance (`shouldRelaunch`) after only a couple of real crashes.
 */
export function createFatalErrorHandler(
  deps: FatalErrorDeps,
): (kind: string, error: unknown) => void {
  let handling = false;
  return (kind, error) => {
    deps.log(`[fatal] unhandled ${kind}:`, error);
    if (handling) return;
    handling = true;

    const userDataDir = deps.userDataDir();
    const now = deps.now();
    if (!shouldRelaunch(loadRelaunchHistory(userDataDir), now)) {
      deps.log('[fatal] too many relaunches in the last minute — not retrying again.');
      deps.exit(1);
      return;
    }
    recordRelaunch(userDataDir, now);
    deps.relaunch();
    deps.exit(1);
  };
}
